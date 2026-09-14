/**
 * color-distance.mjs — khoảng cách màu ΔE (CIE76) trên không gian Lab.
 *
 * Vì sao không so RGB trực tiếp: RGB không tuyến tính theo cảm nhận mắt người.
 * Hai màu lệch 10 đơn vị RGB ở vùng xanh lá trông y hệt nhau, ở vùng xanh dương thì khác rõ.
 * Lab được thiết kế để 1 đơn vị khoảng cách ≈ 1 mức "thấy khác" như nhau ở mọi vùng màu.
 *
 * ΔE < 1   : mắt thường không phân biệt được
 * ΔE 1–5   : chỉ thấy khác khi đặt cạnh nhau — vùng của lỗi hardcode nhầm
 * ΔE > 10  : rõ ràng là hai màu khác nhau
 *
 * Không dependency: công thức chuẩn sRGB → linear → XYZ (D65) → Lab.
 */

/** Parse `rgb(r, g, b)` / `rgba(r, g, b, a)` / `#rrggbb`. Trả null nếu không phải màu đặc. */
export function parseColor(value) {
  if (typeof value !== 'string') return null;
  const text = value.trim().toLowerCase();

  const rgbMatch = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)\s*(?:[,/]\s*([\d.%]+)\s*)?\)$/.exec(text);
  if (rgbMatch) {
    const alphaRaw = rgbMatch[4];
    const alpha = alphaRaw === undefined ? 1 : alphaRaw.endsWith('%') ? parseFloat(alphaRaw) / 100 : parseFloat(alphaRaw);
    // Màu trong suốt không có "màu" để so — bỏ qua thay vì so bừa với nền.
    if (alpha < 0.99) return null;
    return { r: +rgbMatch[1], g: +rgbMatch[2], b: +rgbMatch[3] };
  }

  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/.exec(text);
  if (hex) {
    const h = hex[1].length === 3 ? [...hex[1]].map((c) => c + c).join('') : hex[1];
    return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16) };
  }
  return null;
}

/** Gỡ gamma sRGB về tuyến tính. */
function toLinear(channel) {
  const c = channel / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

/** sRGB → CIE XYZ, chiếu sáng D65, quan sát 2°. */
function rgbToXyz({ r, g, b }) {
  const R = toLinear(r);
  const G = toLinear(g);
  const B = toLinear(b);
  return {
    x: R * 0.4124564 + G * 0.3575761 + B * 0.1804375,
    y: R * 0.2126729 + G * 0.7151522 + B * 0.0721750,
    z: R * 0.0193339 + G * 0.1191920 + B * 0.9503041,
  };
}

/** XYZ → Lab. Điểm trắng D65. */
export function rgbToLab(rgb) {
  const { x, y, z } = rgbToXyz(rgb);
  // Điểm trắng tham chiếu D65
  const xn = 0.95047;
  const yn = 1.0;
  const zn = 1.08883;

  const f = (t) => (t > 216 / 24389 ? Math.cbrt(t) : (841 / 108) * t + 4 / 29);
  const fx = f(x / xn);
  const fy = f(y / yn);
  const fz = f(z / zn);

  return { L: 116 * fy - 16, a: 500 * (fx - fy), b: 200 * (fy - fz) };
}

/** ΔE CIE76 — khoảng cách Euclid trong Lab. Trả Infinity nếu một trong hai không parse được. */
export function deltaE(colorA, colorB) {
  const a = typeof colorA === 'string' ? parseColor(colorA) : colorA;
  const b = typeof colorB === 'string' ? parseColor(colorB) : colorB;
  if (!a || !b) return Infinity;

  const la = rgbToLab(a);
  const lb = rgbToLab(b);
  return Math.sqrt((la.L - lb.L) ** 2 + (la.a - lb.a) ** 2 + (la.b - lb.b) ** 2);
}
