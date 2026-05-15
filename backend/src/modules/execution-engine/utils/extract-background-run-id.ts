/**
 * NodeExecution.outputData JSONB 에서 `meta.backgroundRunId` 를 안전하게
 * 추출. handler 가 발급한 UUID v4 — 모니터링 API (spec/4-nodes/1-logic/12-background.md §8)
 * 의 조회 키이자 WebSocket `background:run:<id>` 채널 식별자.
 *
 * 다음 경우는 모두 빈 문자열로 통일 — `BackgroundExecutionJob.backgroundRunId`
 * 가 `undefined` 가 아닌 빈 문자열로 들어가야 큐 직렬화/역직렬화에서
 * `JSON.stringify({ ..., backgroundRunId: undefined })` 가 키 자체를 누락
 * 시키는 동작과 무관해진다:
 *   - outputData 가 null / 비-object
 *   - meta 가 부재 / 비-object
 *   - meta.backgroundRunId 가 string 이 아님 (number / null / array / object 등)
 *   - 빈 문자열 ("")
 *
 * processor 가 `!data.backgroundRunId` 가드로 빈 문자열을 "없음" 으로 다룬다.
 */
export function extractBackgroundRunId(outputData: unknown): string {
  if (outputData == null || typeof outputData !== 'object') return '';
  const meta = (outputData as { meta?: unknown }).meta;
  if (meta == null || typeof meta !== 'object') return '';
  const value = (meta as { backgroundRunId?: unknown }).backgroundRunId;
  return typeof value === 'string' && value.length > 0 ? value : '';
}
