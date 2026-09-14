/**
 * audit-checks.mjs — toàn bộ logic ĐO chạy trong page context.
 *
 * QUY TẮC BẤT DI BẤT DỊCH: `auditPage` phải TỰ CHỨA.
 * Playwright serialize hàm này rồi chạy trong browser, nơi không có module scope.
 * Mọi helper phải khai BÊN TRONG thân hàm. Khai ở top-level module thì serialize vẫn
 * trót lọt nhưng ném `ReferenceError` trong page — nhìn như lỗi check, thật ra là lỗi plumbing.
 *
 * Nguyên tắc: khi phân vân thì KHÔNG báo. False-positive giết niềm tin nhanh hơn bỏ sót.
 */

/**
 * @param {object} cfg  { alignTolerancePx: [min,max], ignoreSelectors: string[], minElementArea: number }
 * @returns {Array} findings — { type, selector, severity, evidence, boundingRect, textHint }
 */
export function auditPage(cfg) {
  const [TOL_MIN, TOL_MAX] = cfg.alignTolerancePx;
  const IGNORE = cfg.ignoreSelectors ?? [];
  const MIN_AREA = cfg.minElementArea ?? 4;
  const findings = [];

  // ---------- helper ----------

  const styleOf = (el) => window.getComputedStyle(el);

  /** Element bị người viết chủ động ẩn — không phải lỗi layout. */
  function isHidden(el) {
    for (let node = el; node && node.nodeType === 1; node = node.parentElement) {
      if (node.hasAttribute('hidden') || node.getAttribute('aria-hidden') === 'true') return true;
      const s = styleOf(node);
      if (s.display === 'none' || s.visibility === 'hidden' || s.opacity === '0') return true;
      // Kỹ thuật "screen-reader only": element ở lại DOM cho trình đọc màn hình nhưng bị
      // clip sạch. Mắt người không thấy nên mọi số đo hình học của nó đều vô nghĩa.
      if (s.clip === 'rect(0px, 0px, 0px, 0px)' || s.clipPath === 'inset(50%)') return true;
    }
    return false;
  }

  /** Element nằm trong danh sách bỏ qua của config. */
  function isIgnored(el) {
    return IGNORE.some((sel) => {
      try {
        return el.matches(sel) || el.closest(sel) !== null;
      } catch {
        return false; // selector sai trong config không được làm sập cả audit
      }
    });
  }

  /** Có tổ tiên (kể cả chính nó) cuộn được theo trục này → tràn là cố ý. */
  function hasScrollableAncestor(el, axis) {
    const prop = axis === 'x' ? 'overflowX' : 'overflowY';
    for (let node = el; node && node.nodeType === 1; node = node.parentElement) {
      if (node === document.documentElement) break;
      const v = styleOf(node)[prop];
      if (v === 'auto' || v === 'scroll' || v === 'hidden') return true;
    }
    return false;
  }

  /** Element tách khỏi luồng bố cục — so sánh hình học với sibling là vô nghĩa. */
  function isOutOfFlow(el) {
    const s = styleOf(el);
    return (
      s.position === 'absolute' ||
      s.position === 'fixed' ||
      s.position === 'sticky' ||
      s.float !== 'none' ||
      s.zIndex !== 'auto'
    );
  }

  /** data-testid > id > đường dẫn CSS ngắn nhất còn duy nhất. */
  function getStableSelector(el) {
    const testId = el.getAttribute('data-testid');
    if (testId) return `[data-testid="${testId}"]`;
    if (el.id && document.querySelectorAll(`#${CSS.escape(el.id)}`).length === 1) {
      return `#${CSS.escape(el.id)}`;
    }

    const parts = [];
    for (let node = el; node && node.nodeType === 1 && parts.length < 5; node = node.parentElement) {
      if (node.id) {
        parts.unshift(`#${CSS.escape(node.id)}`);
        break;
      }
      const tag = node.tagName.toLowerCase();
      const siblings = node.parentElement ? [...node.parentElement.children] : [];
      const sameTag = siblings.filter((s) => s.tagName === node.tagName);
      parts.unshift(sameTag.length > 1 ? `${tag}:nth-of-type(${sameTag.indexOf(node) + 1})` : tag);

      const candidate = parts.join(' > ');
      try {
        if (document.querySelectorAll(candidate).length === 1) return candidate;
      } catch {
        /* selector chưa hợp lệ giữa chừng, cứ đi tiếp */
      }
    }
    return parts.join(' > ');
  }

  /** Mốc văn bản để dev nhận ra element khi selector là nth-of-type. */
  function textHint(el) {
    const text = (el.textContent ?? '').replace(/\s+/g, ' ').trim();
    return text ? text.slice(0, 40) : null;
  }

  function rectOf(el) {
    const r = el.getBoundingClientRect();
    return {
      x: Math.round(r.x + window.scrollX),
      y: Math.round(r.y + window.scrollY),
      width: Math.round(r.width),
      height: Math.round(r.height),
    };
  }

  function report(el, type, severity, evidence) {
    findings.push({
      type,
      severity,
      selector: getStableSelector(el),
      evidence,
      boundingRect: rectOf(el),
      textHint: textHint(el),
    });
  }

  /** Mọi element trong body — bỏ qua thẻ không có bố cục. */
  const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'META', 'LINK', 'TITLE', 'HEAD', 'BR', 'NOSCRIPT']);
  const allElements = [...document.body.querySelectorAll('*')].filter(
    // Con bên trong <svg> không theo box model HTML: clientHeight/clientWidth luôn 0 và
    // các <g> chồng nhau là cách vẽ bình thường của chart → mọi check hình học đều sai ở đây.
    // Giữ lại chính thẻ <svg> (ownerSVGElement = null) vì nó vẫn là hộp HTML thật.
    (el) => !SKIP_TAGS.has(el.tagName) && !el.ownerSVGElement && !isIgnored(el)
  );

  // ---------- check: collapsed-container ----------
  // Container có con nhìn thấy được nhưng chiều cao nội dung bằng 0 → nội dung bị nuốt.
  for (const el of allElements) {
    if (isHidden(el)) continue;
    if (el.clientHeight > 1) continue;

    const rect = el.getBoundingClientRect();
    if (rect.width < 1) continue; // rộng 0 luôn thì là element ẩn kiểu khác, không phải container sập

    const children = [...el.children].filter((c) => !SKIP_TAGS.has(c.tagName));
    if (!children.length) continue;

    // Con đều ẩn → cha cao 0 là đúng, không phải lỗi.
    const visibleChildren = children.filter((c) => !isHidden(c));
    if (!visibleChildren.length) continue;

    // Con đều tách khỏi luồng (absolute/fixed) → cha cao 0 là bình thường.
    const inFlowChildren = visibleChildren.filter((c) => {
      const p = styleOf(c).position;
      return p !== 'absolute' && p !== 'fixed';
    });
    if (!inFlowChildren.length) continue;

    const floated = inFlowChildren.filter((c) => styleOf(c).float !== 'none');
    const severity = floated.length === inFlowChildren.length ? 'medium' : 'high';
    const cause = floated.length === inFlowChildren.length ? 'con float không được clear' : 'chiều cao bị ép về 0';

    report(
      el,
      'collapsed-container',
      severity,
      `clientHeight=0 nhưng có ${inFlowChildren.length} con hiển thị (${cause}); rộng ${Math.round(rect.width)}px`
    );
  }

  // ---------- check: horizontal-overflow ----------
  // Chỉ xét khi trang THẬT SỰ cuộn ngang được. Element thò ra ngoài nhưng bị clip
  // thì người dùng không thấy thanh cuộn — không phải lỗi.
  const docEl = document.documentElement;
  if (docEl.scrollWidth > docEl.clientWidth + 1) {
    const viewportWidth = docEl.clientWidth;

    for (const el of allElements) {
      if (isHidden(el)) continue;

      const rect = el.getBoundingClientRect();
      const right = rect.left + rect.width + window.scrollX;
      if (right <= viewportWidth + 1) continue;
      if (rect.width < 1 || rect.height < 1) continue;

      // Tổ tiên cuộn/clip được theo trục X → tràn nằm trong vùng cuộn, là cố ý.
      if (el.parentElement && hasScrollableAncestor(el.parentElement, 'x')) continue;

      // Chỉ báo element ĐẦU TIÊN phá khung. Cha đã tràn thì con tràn theo là hệ quả,
      // báo cả chuỗi chỉ làm dev phải tự lọc.
      const parent = el.parentElement;
      if (parent && parent !== document.body) {
        const pRect = parent.getBoundingClientRect();
        if (pRect.left + pRect.width + window.scrollX > viewportWidth + 1) continue;
      }

      report(
        el,
        'horizontal-overflow',
        'high',
        `right=${Math.round(right)}px vượt viewport ${viewportWidth}px (thừa ${Math.round(right - viewportWidth)}px)`
      );
    }
  }

  // ---------- check: text-truncation ----------
  // Chữ bị cắt mà KHÔNG có dấu hiệu nào cho người đọc biết còn nội dung phía sau.
  // Cắt có ellipsis / line-clamp / cuộn được đều là cắt có chủ đích — không báo.
  const INTERACTIVE = new Set(['BUTTON', 'A', 'INPUT', 'SELECT', 'TEXTAREA', 'LABEL', 'SUMMARY']);

  for (const el of allElements) {
    if (isHidden(el)) continue;
    if (el.scrollWidth <= el.clientWidth + 1) continue;
    if (el.clientWidth < 1) continue;

    const s = styleOf(el);

    // Cuộn được theo X → người dùng kéo xem tiếp được.
    if (s.overflowX === 'auto' || s.overflowX === 'scroll') continue;
    // Không clip gì cả → chữ tràn ra ngoài chứ không bị cắt; đó là ca overflow, không phải truncation.
    if (s.overflowX === 'visible') continue;
    // Có báo hiệu bị cắt.
    if (s.textOverflow === 'ellipsis') continue;
    if (s.webkitLineClamp && s.webkitLineClamp !== 'none') continue;

    // Phải là element MANG CHỮ trực tiếp. Container bọc element khác thì thủ phạm
    // là phần tử bên trong, báo ở đây chỉ trỏ sai chỗ.
    const ownText = [...el.childNodes]
      .filter((n) => n.nodeType === 3)
      .map((n) => n.textContent.trim())
      .join('');
    if (!ownText) continue;

    const severity = INTERACTIVE.has(el.tagName) ? 'high' : 'medium';
    report(
      el,
      'text-truncation',
      severity,
      `scrollWidth=${el.scrollWidth}px > clientWidth=${el.clientWidth}px (mất ${el.scrollWidth - el.clientWidth}px), ` +
        `overflow-x=${s.overflowX}, không có text-overflow/line-clamp`
    );
  }

  // ---------- check: overlap ----------
  // CHỈ so sánh sibling cùng cha và cùng nằm trong luồng bố cục.
  // Lớp nổi (absolute/fixed/sticky/z-index/float) đè lên nội dung là chuyện bình thường
  // của dropdown, tooltip, modal — loại ngay từ đầu, đừng lọc sau.
  const INTERACTIVE_SEL = 'button, a, input, select, textarea, [role="button"], [onclick]';

  const parents = new Set();
  for (const el of allElements) if (el.parentElement) parents.add(el.parentElement);

  for (const parent of parents) {
    const kids = [...parent.children].filter(
      (c) => !SKIP_TAGS.has(c.tagName) && !isIgnored(c) && !isHidden(c) && !isOutOfFlow(c)
    );
    if (kids.length < 2) continue;

    const boxes = [];
    for (const el of kids) {
      // Element inline xuống dòng có NHIỀU hộp dòng; getBoundingClientRect gộp chúng
      // thành một hộp bao trùm cả khoảng trắng giữa các dòng — vùng đó không hề được vẽ.
      // So hai hộp gộp như vậy sinh "đè nhau" hoàn toàn tưởng tượng (gặp thật trên index.html
      // ở viewport 390px: hai thẻ <code> ở hai dòng khác nhau bị báo đè 100%).
      // Chỉ so element có đúng MỘT hộp — lúc đó hộp chính là vùng vẽ thật.
      const rects = el.getClientRects();
      if (rects.length !== 1) continue;
      const r = rects[0];
      boxes.push({ el, left: r.left, top: r.top, right: r.right, bottom: r.bottom, area: r.width * r.height });
    }
    if (boxes.length < 2) continue;

    for (let i = 0; i < boxes.length; i += 1) {
      for (let j = i + 1; j < boxes.length; j += 1) {
        const a = boxes[i];
        const b = boxes[j];
        if (a.area < MIN_AREA || b.area < MIN_AREA) continue;

        const overlapW = Math.min(a.right, b.right) - Math.max(a.left, b.left);
        const overlapH = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
        // Chạm mép (0 hoặc âm) không phải đè. Trừ 1px cho sai số làm tròn của trình duyệt.
        if (overlapW <= 1 || overlapH <= 1) continue;

        const overlapArea = overlapW * overlapH;
        if (overlapArea < MIN_AREA) continue;

        const ratio = overlapArea / Math.min(a.area, b.area);
        const touchesInteractive =
          a.el.matches(INTERACTIVE_SEL) || b.el.matches(INTERACTIVE_SEL) ||
          a.el.querySelector(INTERACTIVE_SEL) !== null || b.el.querySelector(INTERACTIVE_SEL) !== null;

        // Đè nhiều, hoặc đè lên thứ bấm được → chặn sử dụng.
        const severity = ratio >= 0.25 || touchesInteractive ? 'high' : 'medium';

        // Báo element ĐỨNG SAU trong DOM: nó là cái bị dịch chuyển đè lên cái trước.
        report(
          b.el,
          'overlap',
          severity,
          `đè lên ${getStableSelector(a.el)} ${Math.round(overlapW)}×${Math.round(overlapH)}px ` +
            `(${Math.round(ratio * 100)}% diện tích element nhỏ hơn)`
        );
      }
    }
  }

  // ---------- check: misalignment ----------
  //
  // Cách tiếp cận: KHÔNG so từng cặp element, mà so với NEO DO CHÍNH CSS KHAI BÁO.
  // Container flex khai `align-items` tức là đã tuyên bố "mọi con phải căn theo mốc này".
  // Con nào lệch mốc 1–8px là vi phạm tuyên bố đó — không cần suy đoán ý đồ từ số đông.
  //
  // Lệch 0px  = căn đúng.
  // Lệch 1–8px = gần như chắc chắn lỗi: mắt thấy "sai sai" nhưng không chỉ ra được.
  // Lệch >8px = bố cục khác hẳn, có chủ đích. Báo là noise.
  const ALIGN_START = new Set(['flex-start', 'start', 'normal', 'stretch', 'self-start']);
  const ALIGN_END = new Set(['flex-end', 'end', 'self-end']);
  const ALIGN_CENTER = new Set(['center', 'safe center', 'anchor-center']);

  for (const parent of parents) {
    const ps = styleOf(parent);
    if (ps.display !== 'flex' && ps.display !== 'inline-flex') continue;
    // Flex nhiều dòng: mỗi dòng có mốc riêng, so với mốc container là sai.
    if (ps.flexWrap === 'wrap' || ps.flexWrap === 'wrap-reverse') continue;

    const align = ps.alignItems;
    // baseline căn theo đường chân chữ, không theo cạnh hộp — phép đo này không áp dụng.
    if (!ALIGN_START.has(align) && !ALIGN_END.has(align) && !ALIGN_CENTER.has(align)) continue;

    const isRow = ps.flexDirection === 'row' || ps.flexDirection === 'row-reverse';
    const pRect = parent.getBoundingClientRect();
    const num = (v) => parseFloat(v) || 0;

    // Mốc lấy trên CONTENT BOX của container — trừ border và padding.
    const startEdge = isRow
      ? pRect.top + num(ps.borderTopWidth) + num(ps.paddingTop)
      : pRect.left + num(ps.borderLeftWidth) + num(ps.paddingLeft);
    const endEdge = isRow
      ? pRect.bottom - num(ps.borderBottomWidth) - num(ps.paddingBottom)
      : pRect.right - num(ps.borderRightWidth) - num(ps.paddingRight);
    const centerEdge = (startEdge + endEdge) / 2;

    const kids = [...parent.children].filter(
      (c) => !SKIP_TAGS.has(c.tagName) && !isIgnored(c) && !isHidden(c) && !isOutOfFlow(c)
    );
    if (kids.length < 2) continue;

    for (const child of kids) {
      const cs = styleOf(child);
      // Con tự khai mốc riêng → nó cố ý không theo container.
      const self = cs.alignSelf;
      if (self && self !== 'auto' && self !== 'normal' && self !== align) continue;

      const r = child.getBoundingClientRect();
      if (r.width < 1 || r.height < 1) continue;

      let actual;
      let expected;
      let label;
      if (ALIGN_CENTER.has(align)) {
        actual = isRow ? (r.top + r.bottom) / 2 : (r.left + r.right) / 2;
        expected = centerEdge;
        label = isRow ? 'tâm dọc' : 'tâm ngang';
      } else if (ALIGN_END.has(align)) {
        actual = isRow ? r.bottom : r.right;
        expected = endEdge;
        label = isRow ? 'cạnh dưới' : 'cạnh phải';
      } else {
        actual = isRow ? r.top : r.left;
        expected = startEdge;
        label = isRow ? 'cạnh trên' : 'cạnh trái';
      }

      const delta = Math.abs(actual - expected);
      if (delta < TOL_MIN || delta > TOL_MAX) continue;

      // Lệch càng lớn càng dễ thấy bằng mắt.
      const severity = delta >= 3 ? 'medium' : 'low';
      report(
        child,
        'misalignment',
        severity,
        `${label}=${Math.round(actual)}px, container khai align-items:${align} nên phải là ${Math.round(expected)}px ` +
          `— lệch ${delta.toFixed(1)}px`
      );
    }
  }

  // ---------- check: *-drift (token) ----------
  // Chỉ chạy khi đã có inferred-tokens.json. Bảng tra là phẳng theo thuộc tính CSS:
  // audit không cần biết token được suy ra thế nào, chỉ cần biết giá trị nào là drift.
  const driftByProperty = cfg.driftByProperty ?? null;
  if (driftByProperty) {
    // Ưu tiên nguyên nhân GỐC. Font-size lệch kéo theo margin `1em` lệch, padding `1em` lệch…
    // Báo cả chuỗi là báo một lỗi nhiều lần; chỉ giữ finding gần gốc nhất trên mỗi element.
    const PRIORITY = { 'color-drift': 0, 'typography-drift': 1, 'spacing-drift': 2 };
    const SEVERITY = { 'color-drift': 'medium', 'typography-drift': 'low', 'spacing-drift': 'low' };
    const props = Object.keys(driftByProperty);

    for (const el of allElements) {
      if (isHidden(el)) continue;
      const s = styleOf(el);

      let best = null;
      for (const prop of props) {
        const hit = driftByProperty[prop][s[prop]];
        if (!hit) continue;
        if (!best || PRIORITY[hit.findingType] < PRIORITY[best.hit.findingType]) {
          best = { prop, value: s[prop], hit };
        }
      }
      if (!best) continue;

      const { prop, value, hit } = best;
      const delta = hit.deltaKind === 'deltaE' ? `ΔE=${hit.delta}` : `lệch ${(hit.delta * 100).toFixed(1)}%`;
      // Nói rõ token ở đâu ra: suy đoán thì người đọc phải được quyền nghi ngờ nó.
      const origin = cfg.tokensAreInferred
        ? 'token SUY ĐOÁN từ CSS thực tế, không phải khai báo từ design system'
        : 'token khai tay trong qa.config.json';

      report(
        el,
        hit.findingType,
        SEVERITY[hit.findingType],
        `${prop}=${value} — ${delta} so với ${hit.nearestToken}; ` +
          `giá trị này chỉ xuất hiện ${hit.count} lần trong toàn app (${origin})`
      );
    }
  }

  // ---------- check: text-contrast (WCAG 2.1) ----------
  // Kiểm tra độ tương phản giữa màu chữ và màu nền theo chuẩn WCAG.
  // Chỉ chạy khi cfg.checkContrast = true hoặc --a11y được truyền.
  if (cfg.checkContrast) {
    function parseRgbChannel(str) {
      if (!str) return null;
      const m = str.match(/rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)(?:\s*,\s*([\d.]+))?\)/);
      if (!m) return null;
      const a = m[4] !== undefined ? parseFloat(m[4]) : 1;
      return { r: parseFloat(m[1]), g: parseFloat(m[2]), b: parseFloat(m[3]), a };
    }

    function relLuminance(rgb) {
      const ch = [rgb.r, rgb.g, rgb.b].map((v) => {
        const c = v / 255;
        return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
      });
      return ch[0] * 0.2126 + ch[1] * 0.7152 + ch[2] * 0.0722;
    }

    function calcContrast(lum1, lum2) {
      const lighter = Math.max(lum1, lum2);
      const darker = Math.min(lum1, lum2);
      return (lighter + 0.05) / (darker + 0.05);
    }

    function effectiveBg(targetEl) {
      for (let node = targetEl; node && node.nodeType === 1; node = node.parentElement) {
        const bg = styleOf(node).backgroundColor;
        const parsed = parseRgbChannel(bg);
        if (parsed && parsed.a > 0.05) {
          if (parsed.a >= 0.95) return parsed;
          return {
            r: Math.round(parsed.r * parsed.a + 255 * (1 - parsed.a)),
            g: Math.round(parsed.g * parsed.a + 255 * (1 - parsed.a)),
            b: Math.round(parsed.b * parsed.a + 255 * (1 - parsed.a)),
            a: 1,
          };
        }
      }
      return { r: 255, g: 255, b: 255, a: 1 };
    }

    for (const el of allElements) {
      if (isHidden(el)) continue;
      if (el.hasAttribute('disabled') || el.closest('[disabled]')) continue;

      const s = styleOf(el);
      if (s.backgroundImage && s.backgroundImage !== 'none') continue;

      const ownText = [...el.childNodes]
        .filter((n) => n.nodeType === 3)
        .map((n) => n.textContent.trim())
        .join('');
      if (!ownText) continue;

      const textColor = parseRgbChannel(s.color);
      if (!textColor || textColor.a < 0.2) continue;

      const bgColor = effectiveBg(el);
      const lumText = relLuminance(textColor);
      const lumBg = relLuminance(bgColor);
      const ratio = calcContrast(lumText, lumBg);

      const fontSize = parseFloat(s.fontSize) || 16;
      const fontWeight = parseFloat(s.fontWeight) || 400;
      const isLarge = fontSize >= 24 || (fontSize >= 18.66 && fontWeight >= 700);
      const minRatio = isLarge ? 3.0 : 4.5;

      if (ratio < minRatio) {
        const severity = ratio < (isLarge ? 2.0 : 2.5) ? 'high' : 'medium';
        report(
          el,
          'text-contrast',
          severity,
          `độ tương phản ${ratio.toFixed(2)}:1 thấp hơn ngưỡng WCAG ${minRatio}:1 ` +
            `(chữ: ${s.color}, nền: rgb(${bgColor.r},${bgColor.g},${bgColor.b}), cỡ chữ: ${s.fontSize})`
        );
      }
    }
  }

  // ---------- check: touch-target-size (Mobile Viewport) ----------
  // Đo kích thước các phần tử tương tác trên màn hình di động (<= 480px).
  // Ngưỡng tối thiểu: 44×44px (Apple HIG / WCAG 2.5.5/2.5.8).
  const isMobileViewport = (cfg.viewportWidth && cfg.viewportWidth <= 480) || window.innerWidth <= 480;
  if (cfg.checkTouchTarget || (cfg.checkTouchTarget !== false && isMobileViewport && cfg.checkTouchTarget !== null)) {
    const TOUCH_INTERACTIVE = new Set(['BUTTON', 'A', 'INPUT', 'SELECT', 'TEXTAREA']);
    for (const el of allElements) {
      if (isHidden(el)) continue;
      if (el.hasAttribute('disabled') || el.closest('[disabled]')) continue;

      const tag = el.tagName;
      const role = el.getAttribute('role');
      const isInteractive = TOUCH_INTERACTIVE.has(tag) || role === 'button' || el.hasAttribute('onclick');
      if (!isInteractive) continue;

      if (tag === 'A') {
        const s = styleOf(el);
        if (s.display === 'inline') continue;
      }

      const r = el.getBoundingClientRect();
      if (r.width < 1 || r.height < 1) continue;

      const MIN_TOUCH_PX = 44;
      if (r.width < MIN_TOUCH_PX || r.height < MIN_TOUCH_PX) {
        const severity = r.width < 32 || r.height < 32 ? 'high' : 'medium';
        report(
          el,
          'touch-target-size',
          severity,
          `vùng bấm ${Math.round(r.width)}×${Math.round(r.height)}px < ${MIN_TOUCH_PX}×${MIN_TOUCH_PX}px ` +
            `(chuẩn Apple HIG/WCAG khuyến nghị cho thiết bị cảm ứng)`
        );
      }
    }
  }

  return findings;
}
