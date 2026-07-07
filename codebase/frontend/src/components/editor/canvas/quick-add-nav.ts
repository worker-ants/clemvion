/**
 * §4.3 빠른 노드 추가 팝업의 키보드 네비게이션 순수 리듀서. 현재 하이라이트 인덱스와
 * 방향키를 받아 다음 인덱스를 반환한다 (끝에서 순환). 리스트 길이 0 이면 0 유지.
 */
export function nextHighlightedIndex(
  current: number,
  direction: "up" | "down",
  listLength: number,
): number {
  if (listLength <= 0) return 0;
  // 리스트가 줄어 current 가 범위를 벗어난 경우를 대비해 먼저 clamp.
  const safe = Math.min(Math.max(current, 0), listLength - 1);
  if (direction === "down") return (safe + 1) % listLength;
  return (safe - 1 + listLength) % listLength;
}

/**
 * 현재 하이라이트 인덱스를 리스트 범위로 clamp. 필터로 리스트가 줄어든 뒤 Enter 선택
 * 시 사용 (범위 밖이면 0 으로). 빈 리스트면 0.
 */
export function clampHighlightedIndex(
  current: number,
  listLength: number,
): number {
  if (listLength <= 0) return 0;
  return Math.min(Math.max(current, 0), listLength - 1);
}
