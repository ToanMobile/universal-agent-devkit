/**
 * sigv4.mjs — ký request AWS SigV4 bằng node:crypto, không dependency.
 *
 * Dùng cho Cloudflare R2 (S3-compatible): region = "auto", service = "s3", path-style URL.
 * Không dùng wrangler: nó cần bộ credential khác, phải tải binary, và chậm vì npx resolve mỗi lần.
 *
 * KHÔNG BAO GIỜ log secret hay chuỗi Authorization.
 */
import crypto from 'node:crypto';

const ALGORITHM = 'AWS4-HMAC-SHA256';

const sha256Hex = (data) => crypto.createHash('sha256').update(data).digest('hex');
const hmac = (key, data) => crypto.createHmac('sha256', key).update(data).digest();

/** `20260909T064512Z` và `20260909` — SigV4 cần cả hai dạng. */
function amzDates(date = new Date()) {
  const amzDate = date.toISOString().replace(/[:-]|\.\d{3}/g, '');
  return { amzDate, dateStamp: amzDate.slice(0, 8) };
}

/**
 * Encode từng segment của path theo RFC 3986, giữ nguyên dấu `/`.
 * `encodeURIComponent` bỏ sót `!'()*` — S3 tính chữ ký trên bản encode đầy đủ nên phải bù.
 */
function encodePath(pathname) {
  return pathname
    .split('/')
    .map((seg) => encodeURIComponent(seg).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`))
    .join('/');
}

/**
 * Trả về headers đã ký cho một request S3/R2.
 *
 * @param {object} o
 * @param {string} o.method        'PUT' | 'GET' | 'DELETE' ...
 * @param {string} o.url           URL đầy đủ, path-style: <endpoint>/<bucket>/<key>
 * @param {Buffer|string} o.body   body; chuỗi rỗng cho GET/DELETE
 * @param {object} o.headers       header thêm (Content-Type, Cache-Control...)
 * @param {string} o.accessKeyId
 * @param {string} o.secretAccessKey
 * @param {string} [o.region]      R2 luôn là 'auto'
 * @param {string} [o.service]     's3'
 */
export function signRequest({
  method,
  url,
  body = '',
  headers = {},
  accessKeyId,
  secretAccessKey,
  region = 'auto',
  service = 's3',
  date = new Date(),
}) {
  const parsed = new URL(url);
  const { amzDate, dateStamp } = amzDates(date);
  const payloadHash = sha256Hex(body);

  // Header ký: gộp header người gọi truyền vào + 3 header bắt buộc.
  const all = {
    ...headers,
    host: parsed.host,
    'x-amz-content-sha256': payloadHash,
    'x-amz-date': amzDate,
  };

  // Canonical headers phải sắp theo tên viết thường, giá trị trim khoảng trắng thừa.
  const names = Object.keys(all)
    .map((k) => k.toLowerCase())
    .sort();
  const lower = Object.fromEntries(Object.entries(all).map(([k, v]) => [k.toLowerCase(), String(v).trim()]));
  const canonicalHeaders = `${names.map((n) => `${n}:${lower[n]}`).join('\n')}\n`;
  const signedHeaders = names.join(';');

  // Query string phải sắp theo key rồi mới nối — thứ tự sai là chữ ký sai.
  const query = [...parsed.searchParams.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');

  const canonicalRequest = [
    method,
    encodePath(parsed.pathname),
    query,
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join('\n');

  const scope = `${dateStamp}/${region}/${service}/aws4_request`;
  const stringToSign = [ALGORITHM, amzDate, scope, sha256Hex(canonicalRequest)].join('\n');

  // Signing key = HMAC lồng 4 tầng: date -> region -> service -> "aws4_request".
  const signingKey = [dateStamp, region, service, 'aws4_request'].reduce(
    (key, part) => hmac(key, part),
    `AWS4${secretAccessKey}`
  );
  const signature = hmac(signingKey, stringToSign).toString('hex');

  return {
    ...all,
    Authorization: `${ALGORITHM} Credential=${accessKeyId}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
  };
}

/** Ghép URL path-style cho R2: <endpoint>/<bucket>/<key>. */
export function objectUrl(endpoint, bucket, key) {
  const base = endpoint.replace(/\/+$/, '');
  return `${base}/${bucket}/${key.replace(/^\/+/, '')}`;
}
