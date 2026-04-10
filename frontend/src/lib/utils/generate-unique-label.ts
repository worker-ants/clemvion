/**
 * Generates a unique node label by appending an incrementing number
 * if the base label already exists among existing labels.
 *
 * Examples:
 *   ("HTTP Request", []) → "HTTP Request"
 *   ("HTTP Request", ["HTTP Request"]) → "HTTP Request 2"
 *   ("HTTP Request", ["HTTP Request", "HTTP Request 2"]) → "HTTP Request 3"
 */
export function generateUniqueLabel(
  baseLabel: string,
  existingLabels: string[],
): string {
  const labelSet = new Set(existingLabels);
  if (!labelSet.has(baseLabel)) return baseLabel;

  let n = 2;
  while (labelSet.has(`${baseLabel} ${n}`)) {
    n++;
  }
  return `${baseLabel} ${n}`;
}
