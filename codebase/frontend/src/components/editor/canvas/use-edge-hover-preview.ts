import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export interface EdgeHoverPreviewState {
  edgeId: string;
  x: number;
  y: number;
}

/**
 * §5 — 엣지 hover 데이터 미리보기 툴팁의 표시/숨김 타이밍을 관리한다. 엣지에서 마우스가
 * 벗어나도 즉시 숨기지 않고 짧게 지연(HIDE_DELAY)해, 사용자가 커서를 툴팁 위로 옮겨
 * "전체 데이터 보기" 를 클릭할 수 있게 한다(interactive tooltip 표준 패턴).
 *  - `show`        : 엣지 hover 시작 — 대기 중 숨김 취소 + 위치/대상 설정
 *  - `scheduleHide`: 엣지에서 벗어남 — 지연 후 숨김(툴팁으로 이동 시간 확보)
 *  - `keepAlive`   : 툴팁에 마우스 진입 — 대기 중 숨김 취소
 *  - `dismiss`     : 툴팁에서 벗어남/닫기 — 즉시 숨김
 */
const HIDE_DELAY_MS = 200;

export function useEdgeHoverPreview(): {
  preview: EdgeHoverPreviewState | null;
  show: (edgeId: string, x: number, y: number) => void;
  scheduleHide: () => void;
  keepAlive: () => void;
  dismiss: () => void;
} {
  const [preview, setPreview] = useState<EdgeHoverPreviewState | null>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = useCallback(() => {
    if (hideTimer.current) {
      clearTimeout(hideTimer.current);
      hideTimer.current = null;
    }
  }, []);

  const show = useCallback(
    (edgeId: string, x: number, y: number) => {
      clearTimer();
      setPreview({ edgeId, x, y });
    },
    [clearTimer],
  );

  const scheduleHide = useCallback(() => {
    clearTimer();
    hideTimer.current = setTimeout(() => setPreview(null), HIDE_DELAY_MS);
  }, [clearTimer]);

  const keepAlive = useCallback(() => clearTimer(), [clearTimer]);

  const dismiss = useCallback(() => {
    clearTimer();
    setPreview(null);
  }, [clearTimer]);

  // unmount 시 대기 중 타이머 정리(누수·언마운트 후 setState 방지).
  useEffect(() => clearTimer, [clearTimer]);

  // 반환 객체를 memo 화해 소비처(onEdgeMouseEnter/Leave)의 콜백 참조가 매 렌더 재생성되지
  // 않게 한다(형제 훅의 참조안정성 관례와 정렬).
  return useMemo(
    () => ({ preview, show, scheduleHide, keepAlive, dismiss }),
    [preview, show, scheduleHide, keepAlive, dismiss],
  );
}
