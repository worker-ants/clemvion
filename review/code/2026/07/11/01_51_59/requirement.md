# 요구사항(Requirement) Review — 최종 fresh re-review

대상: `variables.__*` 예약 네임스페이스 3계층 강제 전체 (`origin/main...HEAD` = `d8ce7693f` feat +
`6e08fe425` docs/test resolution + `e252c5718` fresh-review 커밋 + `1661b99aa` spec 문구 정정, 코드 변경 없음).
직전 두 라운드(`00_59_29`, `01_24_20`)가 이미 Warning 전량 해소를 확인했으므로, 본 라운드는 **홀리스틱 최종
검증** — 특히 orchestrator 가 지목한 §1.3 dual-surface 주장("L2 는 message-prefix only, HTTP 없음")이 실제
엔진 동작과 line-level 로 정확한지를 코드 추적으로 직접 검증했다.

## 검증 방법

diff 를 신뢰하지 않고 워킹트리의 실제 소스를 Read/Grep 으로 직접 추적했다. 특히 §1.3 주장 검증을 위해
`reservedVariableNameRuntimeError()` 가 만드는 `Error` 객체부터 `execution-engine.service.ts` 의
`executeNode` catch 블록 → `ErrorPolicyHandler` → `finalizeFailedExecution` 까지 실제 호출 경로를 전수
추적했고, 관련 unit 6 suites(188 tests)를 직접 재실행해 통과를 확인했다.

## 발견사항

- **[INFO — 확인됨, 결함 아님]** §1.3 `RESERVED_VARIABLE_NAME` dual-surface 주장은 코드와 **정확히 일치**한다
  - 위치: `spec/5-system/3-error-handling.md:85` vs. `codebase/backend/src/nodes/logic/_shared/reserved-variable-name.util.ts:352-360`(`reservedVariableNameRuntimeError` — 순수 `new Error(...)`, `.code` 속성 없음) · `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:5481-5629`(`executeNode` catch — `err instanceof Error` 인 일반 Error 는 항상 `nodeExecution.error = { message: err.message }` 만 기록, `.code` 필드를 만드는 분기 없음. `AbortError`(:5488-5516)만 `{code:'AbortError', message}` 봉투로 특별 처리) · `:4453-4462`(`finalizeFailedExecution` — top-level `Execution.error.code` 는 오직 `ErrorPortFallbackError`/`ExecutionTimeLimitError` instanceof 인 경우만 보존, 그 외 임의 `Error` 는 `.code` 누수 없이 `{message}` 만 저장한다는 명시적 주석 존재).
  - 상세: `RESERVED_VARIABLE_NAME:` prefix 를 단 thrown `Error` 는 (a) `ErrorPortFallbackError`/`ExecutionTimeLimitError` 어느 것도 아니므로 `Execution.error`(top-level)·`NodeExecution.error`(node-level) 어디에도 구조화 `code` 필드가 생기지 않고 `.message` 문자열에만 prefix 로 존재하며, (b) L2 실행은 BullMQ 잡 실행(비-HTTP 컨텍스트)이라 애초에 HTTP 응답 개념이 없다 — "HTTP 무관" 표현이 은유가 아니라 문자 그대로 사실이다. 반대로 L0(`saveCanvas`/`importWorkflow`)의 `BadRequestException({code, message, details})` 는 `GlobalExceptionFilter`(`common/filters/http-exception.filter.ts:52-77`)가 `resp.code` 를 그대로 읽어 `{error:{code:'RESERVED_VARIABLE_NAME', message, details}}` 로 직렬화하는 **진짜 구조화 HTTP 400** 이다. 즉 §1.3 이 새로 정정한 "400 (저장) / — (런타임)" 은 과장도 축소도 아닌 정확한 서술이다. 코드 어디에도 thrown Error 의 message 를 파싱해 `.code` 를 역추출하는 로직이 없음도 전체 `execution-engine`/`shared` grep 으로 확인했다(0건) — 우회 경로 없음.
  - 프런트엔드도 `RESERVED_VARIABLE_NAME` 문자열을 참조하는 코드가 전무해(grep 0건), L2 에서 구조화 `code` 가 없다는 사실에 의존해 깨지는 소비처도 없다.
  - 제안: 없음 — 스펙 문구를 그대로 유지. (orchestrator 요청 질의에 대한 답: **TRUE, 과장/축소 없음**.)

- **[INFO — 재확인, non-blocking]** `CHANGELOG.md:8`, `spec/conventions/execution-context.md:112` 의 "§variable-declaration §6" 이중 `§` 표기 오타가 이번 라운드에서도 여전히 남아 있다
  - 위치: 위 2곳
  - 상세: 직전 라운드(`00_59_29`)에서 이미 INFO 로 분류되어 fix 대상(W1~W8)에서 의도적으로 제외됐고, 이후 두 라운드 모두 "미반영이나 non-blocking" 으로 재확인된 항목이다. 의미 전달에는 지장 없음(문서명 축약 표기 문제일 뿐).
  - 제안: 다음에 이 문서를 편집할 기회에 "variable-declaration.md §6" 또는 "§variable-declaration.6" 식으로 정리. 차단 사유 아님.

- **[INFO]** §1.3 테이블에서 `RESERVED_VARIABLE_NAME` 행의 HTTP 열 값 `400 (저장) / — (런타임)` 은 같은 문서 §1.3 테이블 내에서 유일한 복합 셀이다
  - 위치: `spec/5-system/3-error-handling.md:85` vs. 같은 문서 §1.4 의 `EXECUTION_TIMEOUT`/`WORKER_HEARTBEAT_TIMEOUT` 행(:97, :99)
  - 상세: 커밋 메시지·본문이 "레이어 분리 선례" 로 인용하는 `EXECUTION_TIMEOUT`/`WORKER_HEARTBEAT_TIMEOUT` 은 실제로는 §1.4("워크플로우 실행 에러") 라는 **별도 테이블**에 있고 그 테이블 자체가 HTTP 열이 없다(순수 엔진 레벨 코드이기 때문) — 즉 그 선례는 "복합 셀 포맷" 이 아니라 "테이블 자체 분리" 로 이중성을 표현한다. `RESERVED_VARIABLE_NAME` 은 실제로 L0 가 진짜 HTTP surface 를 갖는다는 점에서 §1.3(HTTP 열 있는 표)에 남아있는 것 자체는 타당하지만, "선례와 같은 방식" 이라는 근거 문구는 정확히는 아니다(선례=테이블 분리, 본 건=단일 행 복합 셀). 내용은 정확하나 선례 인용의 정밀도가 약간 느슨하다.
  - 제안: 차단 사유 아님. 원한다면 §1.3 위 안내 문장에 "테이블 분리가 아니라 단일 행 dual-value 로 표현한 이유(L0 는 §1.3 성격의 검증 에러, L2 는 §1.4 성격의 엔진 실행 에러이나 같은 코드 문자열을 공유하므로 행을 나누지 않음)" 를 한 줄 덧붙이면 더 정밀해짐 — 사소한 개선 여지.

## 독립 재검증 결과

- L0(`saveCanvas`/`importWorkflow` 리터럴 400, `restoreVersion` 면제, offenders 다건 집계) / L1(`validateConfig` → 엔진 `INVALID_NODE_CONFIG`, `node.config` **미해석 raw** 값에 대해서만 실행됨을 `execution-engine.service.ts:5278`(`handler.validate(node.config)` 가 expression 해석(:5297~) **이전**에 호출됨)로 확인) / L2(handler 루프에서 write 이전에 throw, 시스템 변수 미변조를 테스트로 고정) 3계층 모두 스펙 서술과 라인 단위로 일치.
- `restoreVersion` 의 legacy-data escape(`skipLegacyDataGates=true`)와 `importWorkflow` 의 escape 부재(가져온 JSON 은 새 데이터)가 각각 테스트로 고정됨 (`workflows.service.spec.ts:1622-1663`, `:1184-1212`).
- Code 노드(`code.handler.ts:462-477`)가 `$vars` 를 필터 없이 atomic 전체 교체함을 직접 확인 — "강제 범위 밖" 서술이 정확.
- 단일 underscore(`_private`)는 예약 아님(원칙 4 top-level 필드와 스코프 분리) — util/handler/schema 3곳 모두 일관.
- 6 관련 suites 직접 재실행: **188/188 passed** (`reserved-variable-name.util.spec.ts`, `variable-declaration/*.spec.ts`, `variable-modification/*.spec.ts`, `workflows.service.spec.ts`).
- Critical·Warning 신규 발견 없음. TODO/FIXME/HACK/XXX 스캔 결과 실제 코드에 미완성 마커 없음(review 산출물 텍스트 내 "TODO" 언급 1건은 plan-lifecycle 분류 기준 인용문일 뿐 실제 마커 아님).

## 요약

`variables.__*` 예약 네임스페이스 3계층 강제(L0 저장 400·L1 pre-flight `INVALID_NODE_CONFIG`·L2 런타임 throw)는
의도한 기능을 빠짐없이 구현했고, 세 계층의 경계(리터럴 vs. 해석 후, 저장 vs. 실행)가 정확히 코드로 실증된다.
가장 최근 커밋(`1661b99aa`)이 §1.3 에 추가한 "L0=진짜 HTTP 400, L2=message-prefix only·구조화 error.code 없음·
HTTP 무관" dual-surface 서술은 `execution-engine.service.ts` 의 catch 체인·`finalizeFailedExecution` 의 sentinel
타입 좁히기(`ErrorPortFallbackError`/`ExecutionTimeLimitError` 만 code 보존)를 직접 추적한 결과 **정확히 사실과
일치** — 과장도 축소도 없다. `restoreVersion` 면제, Code 노드 범위 밖 처리도 각각 spec 서술과 실제 동작이
정합한다. 잔여 지적은 전부 INFO(사소한 서식 오타·선례 인용 정밀도) 수준이며 차단 사유가 아니다. 이 PR 은 push
가능한 상태다.

## 위험도

NONE

STATUS: DONE
