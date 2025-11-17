const fits = (el: HTMLElement) => el.scrollWidth <= el.clientWidth && el.scrollHeight <= el.clientHeight;

interface AutoFitFontParams {
  el: HTMLElement;
  min?: number;
  max?: number;
  precision?: number;
}

export function autoFitFont({el, min = 4, max = 200, precision = 0.5}: AutoFitFontParams) {
  // Try to quickly see if max doesn't even overflow (early exit)
  el.style.fontSize = max + 'px';
  if (fits(el)) return max;

  let low = min;
  let high = max;
  while (high - low > precision) {
    const mid = (low + high) / 2;
    el.style.fontSize = mid + 'px';

    if (fits(el)) low = mid;
    else high = mid; // too big, go smaller
  }

  // Use the largest size that we know fits
  el.style.fontSize = low + 'px';
  return low;
}
