import type { QueueEvents } from 'bullmq';

/**
 * 통합 모듈(Cafe24 · MakeShop)의 종료 훅에서 토큰 갱신 큐의 `QueueEvents` 를 닫는다.
 *
 * `QueueEvents.close()` 는 차단 XREAD 연결을 바로 끊고 연결을 닫는다. 진행 중인 `waitUntilFinished` 를 기다리지
 * 않으므로 그 호출자는 stream-closed 오류를 받는다. 작업 자체는 jobId 중복 제거로 다음 부팅에서 이어진다.
 * `graceMs` 는 close 가 끝나지 않을 때 종료 훅이 기다리는 상한이다. 넘기면 경고를 남기고 기다리지 않는다.
 *
 * grace 타이머는 close 가 먼저 끝나도 반드시 지운다. 지우지 않으면 타이머가 이벤트 루프를 grace 동안 붙잡고,
 * 끝난 close 에 대해 「exceeded grace」 경고를 남긴다. 그러면 SIGTERM 종료가 늘 grace 만큼 늦어진다(CLE-T-7H7VET).
 */
export async function closeQueueEventsWithinGrace(
  queueEvents: Pick<QueueEvents, 'close'>,
  graceMs: number,
  logger: { warn(message: string): void },
  owner: string,
): Promise<void> {
  let timer: NodeJS.Timeout | undefined;
  const graceElapsed = new Promise<'grace_elapsed'>((resolve) => {
    timer = setTimeout(() => resolve('grace_elapsed'), graceMs);
  });
  try {
    const outcome = await Promise.race([
      queueEvents.close().then(() => 'closed' as const),
      graceElapsed,
    ]);
    if (outcome === 'grace_elapsed') {
      logger.warn(
        `${owner} shutdown: queueEvents.close() exceeded ${graceMs}ms grace — forcing exit. In-flight waitUntilFinished listeners may receive stream-closed errors.`,
      );
    }
  } catch (err) {
    logger.warn(
      `${owner} shutdown: queueEvents.close() failed — ${err instanceof Error ? err.message : String(err)}`,
    );
  } finally {
    clearTimeout(timer);
  }
}
