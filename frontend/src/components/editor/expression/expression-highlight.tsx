/**
 * Renders a highlight overlay behind the input to colorize {{ }} expression blocks.
 * Uses an absolutely positioned div with identical font/sizing as the input.
 *
 * `hasError` paints the blocks red (syntax error). `hasWarning` paints amber
 * (semantic scope error that doesn't block evaluation). When both flags are
 * on, error takes precedence — syntax errors hide scope-level information
 * because the expression can't be parsed yet.
 */
export function ExpressionHighlight({
  value,
  hasError,
  hasWarning,
}: {
  value: string;
  hasError?: boolean;
  hasWarning?: boolean;
}) {
  // Split value into text and expression segments
  const parts: Array<{ text: string; isExpr: boolean }> = [];
  let remaining = value;
  while (remaining.length > 0) {
    const openIdx = remaining.indexOf("{{");
    if (openIdx === -1) {
      parts.push({ text: remaining, isExpr: false });
      break;
    }
    if (openIdx > 0) {
      parts.push({ text: remaining.slice(0, openIdx), isExpr: false });
    }
    const closeIdx = remaining.indexOf("}}", openIdx + 2);
    if (closeIdx === -1) {
      parts.push({ text: remaining.slice(openIdx), isExpr: true });
      break;
    }
    parts.push({
      text: remaining.slice(openIdx, closeIdx + 2),
      isExpr: true,
    });
    remaining = remaining.slice(closeIdx + 2);
    continue;
  }

  return (
    <span className="pointer-events-none whitespace-pre-wrap break-words">
      {parts.map((p, i) =>
        p.isExpr ? (
          <span
            key={i}
            className={`rounded-sm text-transparent ${
              hasError
                ? "bg-red-500/15"
                : hasWarning
                  ? "bg-amber-500/15"
                  : "bg-blue-500/15"
            }`}
          >
            {p.text}
          </span>
        ) : (
          <span key={i} className="text-transparent">
            {p.text}
          </span>
        ),
      )}
    </span>
  );
}
