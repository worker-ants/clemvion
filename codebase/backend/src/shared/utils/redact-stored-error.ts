// 자매 leaf util — `terminal-error-payload.ts` 와 같은 층이다. 둘 다
// `sanitize-error-message` 하나만 import 하므로 #1175 가 해소한 ES-module 순환
// (ws.service↔gateway↔event-emitter)에 재유입하지 않는다.
import { deepRedactSecrets } from './sanitize-error-message';

/**
 * DB `Execution.error`/`NodeExecution.error` **컬럼 값**을 응답으로 내보내기 직전에
 * 자격증명 값-패턴 마스킹한다. **형태는 보존한다** — 값만 바꾼다.
 *
 * SoT: [응답 자격 증명 마스킹 「내부 읽기 경로」](CLE-API-EGRESS-SURFACE#35-내부-읽기-경로-2026-08-16) "내부 읽기 경로" 불릿.
 *
 * - **`ExecutionError` 예외 클래스와 무관하다**(`execution-engine/workflow-errors.ts`).
 *   그쪽은 제어흐름, 이쪽은 데이터(JSONB 컬럼 값)다 — 이름을 겹치지 않게 고른 이유다.
 * - **`toTerminalErrorPayload` 를 쓰지 않는 이유**: 그 함수는 §6.4 wire 형태로 **정규화**하므로
 *   내부 응답에 쓰면 값 마스킹이 아니라 **응답 계약 변경**이 된다.
 * - **DB 는 원문을 보존한다**(§R17 egress-only). 서버 로그·사후 디버깅의 진실은 그대로다.
 *
 * **보장의 경계**: `deepRedactSecrets` 의 `SECRET_LEAK_PATTERNS` 는 **자격증명**을 겨냥한다.
 * 자격증명 **없는** 연결 문자열·내부 호스트명·스택 프래그먼트는 **통과**하고(별건: shared SoT
 * 승격), 평범한 에러 메시지는 손상되지 않는다. 두 경계 모두 `.spec.ts` 의 캐너리가 고정한다 —
 * 패턴을 넓히면 그 자리가 RED 로 바뀌어 blast radius 를 마주하게 된다.
 *
 * @param err DB 의 `error` 컬럼 값. jsonb 라 레거시 문자열·숫자가 들어와도 `deepRedactSecrets`
 *   가 타입을 보존하며 통과시킨다(`.spec.ts` 로 고정).
 * @returns 마스킹된 **복사본**. 바뀐 것이 없으면 `deepRedactSecrets` 의 copy-on-change 가
 *   같은 참조를 돌려주므로 입력은 변이되지 않는다. 입력이 없으면 `null`.
 */
export function redactStoredErrorForResponse(
  err: Record<string, unknown> | null | undefined,
): Record<string, unknown> | null {
  if (err === null || err === undefined) return null;
  // `deepRedactSecrets` 는 `unknown` 을 돌려주지만 형태를 보존하므로 입력 타입 그대로다.
  // 단언을 **이 한 자리**에 모은다 — 호출부 4곳에 흩으면 한 곳이 다른 캐스트를 쓴다.
  return deepRedactSecrets(err) as Record<string, unknown>;
}

/**
 * DB `inputData`/`outputData` **컬럼 값**의 응답 egress 마스킹 — 자매
 * {@link redactStoredErrorForResponse} 와 **같은 프리미티브·같은 원칙**이고 대상 컬럼만 다르다.
 *
 * SoT: [응답 자격 증명 마스킹 「내부 읽기 경로」](CLE-API-EGRESS-SURFACE#35-내부-읽기-경로-2026-08-16) "내부 읽기 경로" 불릿.
 *
 * ## 왜 별건인가 — `error` 와 달리 **앞선 마스킹 층이 있다**
 *
 * 트래커는 이 항목을 *"`Execution.error` 와 같은 형태"* 로 등재했으나 실측하면 다르다.
 * `error` 는 마커가 없는 자유 필드지만, `inputData` 는 webhook ingestion 이 민감 헤더를
 * `[REDACTED]` 로 마스킹해 저장한다 ([웹훅 「수신 헤더 마스킹」](CLE-TRIG-WEBHOOK-AUTH#수신-헤더-마스킹)) —
 * [수동 트리거 노드 「웹훅 경로 (port `out`)」](CLE-NODE-MANUAL#웹훅-경로-port-out) ·
 * [표현식 언어 「`$trigger`: 웹훅 요청 뷰」](CLE-WF-EXPR-VARS#trigger-웹훅-요청-뷰) ·
 * [실행 컨텍스트 「트리거 입력 파라미터 싣기」](CLE-EXEC-CONTEXT#트리거-입력-파라미터-싣기) ·
 * [트리거 데이터와 흐름 「웹훅 진입」](CLE-TRIG-DATA#웹훅-진입) 가 그 전제를 공유하는 **문서화된 계약**이다.
 *
 * 그래서 이 층은 그 마커를 **덮지 않는다** — `deepRedactSecrets` 의 마커 멱등성이 보장하고
 * `.spec.ts` 캐너리가 고정한다. 덮으면 같은 헤더가 읽는 경로마다 다르게 보인다.
 *
 * ## ingestion-time 마스킹과 경쟁하지 않는다 (방어 계층이 다르다)
 *
 * [웹훅 「수신 헤더 마스킹을 저장 시점에 하는 이유 (2026-07-07)」](CLE-TRIG-WEBHOOK#수신-헤더-마스킹을-저장-시점에-하는-이유-2026-07-07)
 * 는 "display 시점 마스킹" 을 기각하고 ingestion 시점을 택했다.
 * 본 함수는 그 결정을 **번복하지 않는다** — 그쪽은 *알려진 헤더 key* 를 저장 전에 지우는
 * 층이고, 이쪽은 *임의 값-패턴*(자유 텍스트에 박힌 `Bearer …`·자격증명 포함 URI)을 응답
 * 직전에 가리는 층이다. key-blacklist 로는 못 잡는 클래스를 덮으므로 두 층은 겹치지 않고
 * 쌓인다. DB-at-rest 가 원문인 것은 §R17 `Execution.error` 와 **같은 이유**(서버 로그·
 * 사후 디버깅의 진실 보존)다.
 *
 * @returns 마스킹된 **복사본**. copy-on-change 라 바뀐 것이 없으면 같은 참조를 돌려주므로
 *   입력은 변이되지 않고 불필요한 allocation 도 생기지 않는다. 입력이 없으면 `null`.
 */
export function redactStoredDataForResponse(
  data: Record<string, unknown> | null | undefined,
): Record<string, unknown> | null {
  if (data === null || data === undefined) return null;
  return deepRedactSecrets(data) as Record<string, unknown>;
}

/**
 * 세 컬럼(`inputData` · `outputData` · `error`)을 **한 번에** 마스킹한다.
 *
 * ## 왜 존재하나 — 자매가 갈리는 걸 사람이 막고 있었다
 *
 * 이 조합은 응답 조립부 **네 곳**(목록 매퍼 · `toResponseExecution` · 노드 레벨 루프 ·
 * `background-runs.service.ts`)에서 각자 손으로 반복됐고, 유일한 동기화 장치가 **사람이 읽는
 * 주석 표**였다. 그 상태에서 실제로 자매 갱신이 빠지는 CRITICAL 이 났다(`14_08_45` C2).
 *
 * ## 쓰는 곳 (2026-11-14)
 *
 * `ExecutionsService` 의 `toResponseExecution`(실행 다섯 응답) · `toNodeExecutionSummary`
 * (`nodeExecutions[]` 항목)와 `BackgroundRunsService.toNodeExecutionDto` 다. 부재는 늘 `null`
 * 로 정규화한다. 응답 DTO 가 세 필드를 「키는 늘 있고 값은 `null` 가능」으로 선언하기 때문이다.
 *
 * > 종전에는 `nodeExecutions[]` 용 자매 헬퍼(`redactNodeExecutionRowForResponse`)가 따로
 * > 있었다. 그 자리는 엔티티를 그대로 실어서 부재를 보존하고 바뀐 행만 복제(copy-on-change)
 * > 해야 했다. 노드 실행 항목도 선언 필드만 새 객체로 조립하게 되면서(CLE-T-GA8ZXQ) 그
 * > 이유가 사라져 이 함수 하나로 합쳤다. 마스킹할 컬럼이 늘어날 때 고칠 자리는 이 함수
 * > 하나다.
 */
export function redactStoredFieldsForResponse(row: {
  inputData?: Record<string, unknown> | null;
  outputData?: Record<string, unknown> | null;
  error?: Record<string, unknown> | null;
}): {
  inputData: Record<string, unknown> | null;
  outputData: Record<string, unknown> | null;
  error: Record<string, unknown> | null;
} {
  return {
    inputData: redactStoredDataForResponse(row.inputData),
    outputData: redactStoredDataForResponse(row.outputData),
    error: redactStoredErrorForResponse(row.error),
  };
}
