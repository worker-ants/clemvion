import type { Logger } from '@nestjs/common';
import type { ModuleRef } from '@nestjs/core';

// 근거: [EIA 데이터와 흐름 「트리거 단위 토큰」](CLE-EIA-DATA#트리거-단위-토큰),
// [트리거 데이터와 흐름 「트리거 삭제와 자원 해제」](CLE-TRIG-DATA#트리거-삭제와-자원-해제)

/**
 * 트리거 단위 토큰(`itk_*`)이 무효가 될 때 그 토큰으로 연 SSE 스트림을 닫는 포트. 구현은 `SseAdapter`.
 *
 * 무효가 되는 때는 셋이다 — 재발급(`revoke-token`), PATCH 가 전략을 바꿔 토큰을 지울 때, 트리거 삭제.
 * 실행 단위 토큰(`iext_*`)으로 연 스트림은 대상이 아니다.
 *
 * **토큰으로 지연 해석한다.** 호출자는 `TriggersModule` · `SchedulesModule` 인데 두 모듈은
 * `ExternalInteractionModule` 을 import 하지 않는다. `trigger-resource-release.ts` 의
 * `TRIGGER_RESOURCE_RELEASER` 와 같은 이유로 새 `forwardRef` 대신 `ModuleRef.get(TOKEN, { strict: false })`
 * 로 찾는다. 이 파일은 심볼 · 타입 · 해석 함수만 내보내 호출자가 구현 클래스를 파일 수준에서도 import 하지 않게
 * 한다.
 *
 * **해석 실패 정책이 정리 포트와 반대다.** 정리 포트는 못 찾으면 던지지만 여기는 경고만 남긴다. 스트림
 * 닫기는 best-effort 라 재발급 · PATCH · 삭제의 결과를 막지 않는다. 지금은 이 서버 인스턴스에 붙은 구독자만
 * 닫는다(SSE 버퍼가 서버 인스턴스 하나를 전제로 한다. 넓히는 일은 NERV Task `CLE-T-Z35F7P`).
 */
export const INTERACTION_STREAM_CLOSER = Symbol('INTERACTION_STREAM_CLOSER');

export interface InteractionStreamCloserPort {
  /** 지정한 트리거들의 `itk_*` 로 연 스트림을 닫고 닫은 수를 돌려준다. 던지지 않는다. */
  closeTriggerTokenStreams(triggerIds: readonly string[]): number;
}

/**
 * 트리거 단위 토큰으로 연 SSE 스트림을 best-effort 로 닫는다. 커밋 **뒤에** 부른다 — 토큰이 실제로 무효가
 * 된 뒤에 닫아야 클라이언트가 옛 토큰으로 다시 연결했을 때 가드가 401 로 거부한다.
 *
 * @param moduleRef 단위 대역처럼 없으면 경고만 남긴다.
 */
export function closeTriggerTokenStreams(
  moduleRef: Pick<ModuleRef, 'get'> | undefined,
  triggerIds: readonly string[],
  logger: Pick<Logger, 'warn'>,
  caller: string,
): void {
  if (triggerIds.length === 0) return;
  try {
    if (!moduleRef) {
      logger.warn(
        `${caller}: ModuleRef 가 없어 트리거 단위 토큰 SSE 스트림을 닫지 못했다(trigger=${triggerIds.join(',')}).`,
      );
      return;
    }
    const closer = moduleRef.get<InteractionStreamCloserPort>(
      INTERACTION_STREAM_CLOSER,
      { strict: false },
    );
    closer.closeTriggerTokenStreams(triggerIds);
  } catch (err) {
    logger.warn(
      `${caller}: 트리거 단위 토큰 SSE 스트림 닫기 실패(trigger=${triggerIds.join(',')}) — ${
        err instanceof Error ? err.message : String(err)
      }`,
    );
  }
}
