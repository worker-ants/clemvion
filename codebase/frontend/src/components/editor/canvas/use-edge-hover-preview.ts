import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export interface EdgeHoverPreviewState {
  edgeId: string;
  x: number;
  y: number;
}

/**
 * §5 — 엣지 hover 데이터 미리보기 툴팁의 표시/숨김 타이밍을 관리한다. 엣지에서 마우스가
 * 벗어나도 즉시 숨기지 않고 짧게 지연(HIDE_DELAY_MS)해, 사용자가 커서를 툴팁 위로 옮겨
 * "전체 데이터 보기" 를 클릭할 수 있게 한다(interactive tooltip 표준 패턴).
 *  - `show`        : 엣지 hover 시작 — 짧게 지연(SHOW_DELAY_MS) 후 위치/대상 설정
 *  - `scheduleHide`: 엣지에서 벗어남 — 지연 후 숨김(툴팁으로 이동 시간 확보)
 *  - `keepAlive`   : 툴팁에 마우스 진입 — 대기 중 숨김 취소
 *  - `dismiss`     : 툴팁에서 벗어남/닫기 — 즉시 숨김
 *
 * `show` 의 진입 지연(SHOW_DELAY_MS)은 sweep 방어다. 여러 엣지가 촘촘한 캔버스에서 커서가
 * 엣지들을 빠르게 스쳐 지날 때, 정착하지 못한 엣지는 지연 타이머가 다음 `show`(또는
 * `scheduleHide`)에 취소돼 `setPreview` 자체가 실행되지 않는다. 그 결과 툴팁 마운트와
 * `summarizeDataForPreview` 의 전체 직렬화는 커서가 실제로 머문 엣지 1개에 대해서만 발생한다.
 */
const SHOW_DELAY_MS = 90;
const HIDE_DELAY_MS = 200;

export function useEdgeHoverPreview(): {
  preview: EdgeHoverPreviewState | null;
  show: (edgeId: string, x: number, y: number) => void;
  scheduleHide: () => void;
  keepAlive: () => void;
  dismiss: () => void;
} {
  const [preview, setPreview] = useState<EdgeHoverPreviewState | null>(null);
  // show(진입 지연)·hide(이탈 유예)는 상호 배타적 상태라 단일 타이머로 관리한다.
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = useCallback(() => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  }, []);

  const show = useCallback(
    (edgeId: string, x: number, y: number) => {
      clearTimer();
      // 지연 후 설정 — sweep 중 스쳐 지나는 엣지는 다음 show/scheduleHide 가 타이머를
      // 취소해 setPreview 가 실행되지 않는다(툴팁/직렬화는 정착한 엣지 1개에만).
      timer.current = setTimeout(
        () => setPreview({ edgeId, x, y }),
        SHOW_DELAY_MS,
      );
    },
    [clearTimer],
  );

  const scheduleHide = useCallback(() => {
    clearTimer();
    timer.current = setTimeout(() => setPreview(null), HIDE_DELAY_MS);
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
