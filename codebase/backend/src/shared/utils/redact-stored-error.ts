// 자매 leaf util — `terminal-error-payload.ts` 와 같은 층이다. 둘 다
// `sanitize-error-message` 하나만 import 하므로 #1175 가 해소한 ES-module 순환
// (ws.service↔gateway↔event-emitter)에 재유입하지 않는다.
import { deepRedactSecrets } from './sanitize-error-message';

/**
 * DB `Execution.error`/`NodeExecution.error` **컬럼 값**을 응답으로 내보내기 직전에
 * 자격증명 값-패턴 마스킹한다. **형태는 보존한다** — 값만 바꾼다.
 *
 * SoT: [EIA §R17](../../../../../spec/5-system/14-external-interaction-api.md) "내부 읽기 경로" 불릿.
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
 * SoT: [EIA §R17](../../../../../spec/5-system/14-external-interaction-api.md) "내부 읽기 경로" 불릿.
 *
 * ## 왜 별건인가 — `error` 와 달리 **앞선 마스킹 층이 있다**
 *
 * 트래커는 이 항목을 *"`Execution.error` 와 같은 형태"* 로 등재했으나 실측하면 다르다.
 * `error` 는 마커가 없는 자유 필드지만, `inputData` 는 webhook ingestion 이 민감 헤더를
 * `[REDACTED]` 로 마스킹해 저장한다 ([12-webhook §5.3](../../../../../spec/5-system/12-webhook.md)) —
 * `1-manual-trigger.md`·`5-expression-language.md`·`4-execution-engine.md`·
 * `data-flow/10-triggers.md` 가 그 전제를 공유하는 **문서화된 계약**이다.
 *
 * 그래서 이 층은 그 마커를 **덮지 않는다** — `deepRedactSecrets` 의 마커 멱등성이 보장하고
 * `.spec.ts` 캐너리가 고정한다. 덮으면 같은 헤더가 읽는 경로마다 다르게 보인다.
 *
 * ## ingestion-time 마스킹과 경쟁하지 않는다 (방어 계층이 다르다)
 *
 * `12-webhook.md` Rationale 은 "display 시점 마스킹" 을 기각하고 ingestion 시점을 택했다.
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
 * 이 조합은 응답 조립부 **네 곳**(`toExecutionDto` · `toResponseExecution` · 노드 레벨 루프 ·
 * `background-runs.service.ts`)에서 각자 손으로 반복됐고, 유일한 동기화 장치가 **사람이 읽는
 * 주석 표**였다. 그 상태에서 실제로 자매 갱신이 빠지는 CRITICAL 이 났다(`14_08_45` C2).
 *
 * ## 왜 헬퍼가 **둘**인가
 *
 * | 헬퍼 | 쓰는 곳 | 부재 처리 |
 * |---|---|---|
 * | 이 함수 | 응답 DTO 조립(3곳) | `null` 로 **정규화** |
 * | {@link redactNodeExecutionRow} | `nodeExecutions[]` 행 | 입력을 **그대로 보존** |
 *
 * 하나로 뭉개면 그 차이가 사라진다 — `nodeExecutions[]` 는 엔티티 형태를 그대로 싣는
 * 자리라 `undefined → null` 이 되면 (a) 응답 shape 이 달라지고 (b) 값이 없어 아무것도 안
 * 바뀐 행까지 참조가 달라져 copy-on-change 최적화가 깨진다.
 *
 * 그래서 **합치지 않고 나란히 둔다.** 넷이 흩어져 주석으로 동기화되던 것을, 둘이 한 파일에서
 * 서로를 보는 상태로 바꾸는 것이 이 통합의 요점이다 — 세 번째 컬럼이 늘어날 때 고칠 자리가
 * 이 파일 하나다.
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

/**
 * 값이 있을 때만 마스킹하고, 없으면 **입력을 그대로** 돌려준다.
 *
 * `redactStored*` 는 부재를 `null` 로 정규화하는데, `nodeExecutions[]` 는 엔티티 형태를 그대로
 * 싣는 자리라 그 정규화가 응답 shape 을 바꾼다.
 *
 * **제네릭을 쓰지 않는다** — `<T>` 로 두면 TS 가 `T` 를 값이 아니라 `mask` 의 **파라미터
 * 타입**(`… | null | undefined`)에서 추론해 반환 타입에 `undefined` 가 섞이고, 배정에서
 * 빌드가 깨진다(실제로 한 번 깨졌다). 두 컬럼이 모두 같은 구체 타입이라 제네릭의 이득도 없다.
 *
 * **시그니처가 `| null` 을 안 적는 것은 의도다** — 엔티티가 두 컬럼을 non-null 로 선언하므로
 * **정적으로는** null 이 올 수 없고, 반환 타입에 `| null` 을 얹으면 배정이 깨진다. 본문의
 * `== null` 은 TypeORM 이 런타임에 `undefined` 를 줄 수 있는 경로에 대한 **방어**다.
 *
 * ## `== null` 가드를 좁히는 뮤턴트는 **동치 뮤턴트**다 — 테스트 갭이 아니다
 *
 * 리뷰가 *"`== null` 을 `=== undefined` 로 좁혀도 전부 GREEN 이니 `null` 쪽이 미검증"* 으로
 * 지적했다(`14_46_46` testing W2). 실측하면 **어떤 테스트로도 못 죽인다**:
 *
 * | 입력 | 가드 경로 | 좁힌 경로 (`mask(v) ?? v`) |
 * |---|---|---|
 * | `null` | `null` | `mask(null)` → `null`, `null ?? null` → `null` |
 * | `undefined` | `undefined` | `mask(undefined)` → `null`, `null ?? undefined` → `undefined` |
 *
 * 두 부재 형태 모두 **결과가 같다** — `?? value` 폴백이 가드와 같은 값을 만들기 때문이다.
 * 관측 가능한 차이가 없으므로 살아남는 것이 정상이다.
 *
 * 그럼 가드는 왜 남기나: 현재 두 mask 가 **스스로 null-check 를 하기 때문에** 동치일 뿐이고,
 * 그러지 않는 mask 가 나중에 들어오면 폴스루가 `mask(null)` 을 실제로 호출한다. 즉 이 가드는
 * *현재 관측되는 동작*이 아니라 *mask 계약에 대한 독립 방어*다. 죽이려면 `maskIfPresent` 를
 * export 해 null 에 throw 하는 mask 를 주입해야 하는데, 사적 헬퍼의 공개 표면을 테스트만을
 * 위해 넓히는 값이 이 방어의 값보다 크지 않다고 판단했다.
 */
function maskIfPresent(
  value: Record<string, unknown>,
  mask: (v: Record<string, unknown>) => Record<string, unknown> | null,
): Record<string, unknown> {
  return value == null ? value : (mask(value) ?? value);
}

/**
 * `nodeExecutions[]` 행 하나를 마스킹하되 **copy-on-change 를 지킨다** —
 * 세 컬럼 다 무변화면 **같은 참조**를 돌려준다.
 *
 * 무조건 spread 하면 이 조회에 `take` 상한이 없어(자매 `ExecutionNodeLog` 조회와 달리)
 * 대규모 ForEach 실행에서 불필요한 shallow-copy 가 **행 수만큼** 쌓인다. 진행 중 실행은
 * 스냅샷 캐시 대상도 아니라 폴링·WS 재연결마다 재계산된다 (`17_12_34` performance W1).
 *
 * 자매는 {@link redactStoredFieldsForResponse} — 왜 둘인지는 그쪽 docstring 참조.
 */
export function redactNodeExecutionRow<
  T extends {
    inputData: Record<string, unknown>;
    outputData: Record<string, unknown>;
    error: Record<string, unknown>;
  },
>(row: T): T {
  const inputData = maskIfPresent(row.inputData, redactStoredDataForResponse);
  const outputData = maskIfPresent(row.outputData, redactStoredDataForResponse);
  const error = maskIfPresent(row.error, redactStoredErrorForResponse);
  return inputData === row.inputData &&
    outputData === row.outputData &&
    error === row.error
    ? row
    : { ...row, inputData, outputData, error };
}
