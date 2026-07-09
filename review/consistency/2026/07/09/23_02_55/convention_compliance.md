# 정식 규약 준수 검토 — spec/4-nodes/7-trigger/

검토 모드: --impl-prep (구현 착수 전 검토, scope=`spec/4-nodes/7-trigger/`)
대상 문서: `spec/4-nodes/7-trigger/0-common.md` · `1-manual-trigger.md` · `providers/_overview.md` · `providers/discord.md` · `providers/slack.md` · `providers/telegram.md`
대조 규약: `spec/conventions/node-output.md` · `chat-channel-adapter.md` · `secret-store.md` · `error-codes.md` · `spec-impl-evidence.md` · `user-guide-evidence.md` · `execution-context.md`

## 발견사항

- **[WARNING]** `output` 필드 표기가 실제 output shape 과 어긋나 보이는 축약 표현
  - target 위치: `spec/4-nodes/7-trigger/0-common.md` §3 표, line 74 — `output` 행: "Manual Trigger: `output: $params` (= `$input.parameters`)"
  - 위반 규약: `spec/conventions/node-output.md` Principle 11 (출력 예시 문서화 규칙 — `output` 아래 실제 필드 구조를 명확히 기술)
  - 상세: 이 표기를 문자 그대로 읽으면 "`output` 필드 자체가 `$params` 값과 같다" (즉 `output === { orderId: ..., count: ... }`) 로 오독될 수 있다. 그러나 같은 문서 §3.2, 그리고 `1-manual-trigger.md` §4 step 5(`output.parameters = resolvedParameters`) · §5.1 JSON 예시(`"output": { "parameters": {...} }`) · Expression 접근 예(`$node["Manual Trigger"].output.parameters.orderId`)는 모두 `output.parameters` 라는 **한 단계 중첩된 키**를 통해서만 값에 접근하도록 규정한다. 즉 정확한 서술은 `output.parameters: $params` 여야 하며, 현재 문구는 같은 트리거 문서군 내부에서 표기가 정합하지 않다.
  - 제안: `0-common.md` §3 표의 `output` 행을 `` `output.parameters: $params` (= `$input.parameters`) `` 로 수정해 §3.2/§5.1 JSON 예시와 표기를 통일한다.

- **[INFO]** `meta.source` 의 Principle 인용 라벨이 원 컨벤션의 제목과 다름
  - target 위치: `spec/4-nodes/7-trigger/1-manual-trigger.md` line 82 ("meta 채움: ... `CONVENTIONS Principle 2 — 실행 컨텍스트`") 및 line 111 (같은 인용, 부제 없이)
  - 위반 규약: `spec/conventions/node-output.md` Principle 2 — 문서상 정식 제목은 "`meta` 는 '실행 메트릭'만 담는다" 이며 표에 열거된 필드는 `durationMs`/`model`/`tokens`/`statusCode`/`rowCount`/`success`/`logs`/`iterations` 등이다. `source`(어떤 어댑터가 트리거를 발동시켰는지)는 Principle 2 표에 명시적으로 열거되어 있지 않다.
  - 상세: `meta.source` 를 `meta` 에 두는 것 자체는 Principle 0 서문("meta: 실행 메타데이터 — duration, statusCode, tokens, logs")의 취지와 합리적으로 정합하나, 인용 시 붙인 부제 "실행 컨텍스트" 는 Principle 2 의 실제 표제가 아니라서 컨벤션 문서를 대조하는 독자에게 혼동을 줄 수 있다. `execution-context.md` (별도 컨벤션 문서, 표제가 실제로 "실행 컨텍스트")와 이름이 겹쳐 더 헷갈리기 쉽다 — 그러나 `execution-context.md` 는 `ExecutionContext` 필드 분류 규약이라 `NodeHandlerOutput.meta` 와는 대상이 다르므로 실제로는 무관하다.
  - 제안: 인용 표기를 `(CONVENTIONS Principle 2 — meta 실행 메트릭, source 는 어댑터 실행 메타데이터로 편입)` 처럼 원 제목 그대로 쓰거나, 최소한 "— 실행 컨텍스트" 부제를 제거해 `execution-context.md` 와의 오인 소지를 없앤다. 규약 자체를 갱신할 필요는 없음(내용 위반이 아니라 인용 라벨의 정확성 문제).

- **[INFO]** provider spec 이 Chat Channel Adapter 컨벤션의 옵션 함수명을 본문에서 직접 인용하지 않음
  - target 위치: `spec/4-nodes/7-trigger/providers/discord.md` §3.3(MODAL 구체) · §4(명령 매핑 표의 `open_form_modal` 행), `providers/slack.md` §3.3(views.open 구체)
  - 위반 규약: `spec/conventions/chat-channel-adapter.md` §1 Adapter Interface — `openFormModal?(params): Promise<OpenFormModalResult>` / `buildFormSubmissionResponse?(params): FormSubmissionResult` 두 옵션 메서드가 정의되어 있음
  - 상세: discord.md/slack.md 는 `openFormModal` 이 수행하는 *동작*(HooksService 가 modal JSON 을 webhook 응답으로 반환 / `views.open` 호출)은 정확히 서술하지만, ack·검증 실패 응답 합성을 담당하는 `buildFormSubmissionResponse?` 함수명은 두 문서 어디에도 등장하지 않는다(behavior 는 §3.3/§4 에 텍스트로 흩어져 서술됨). 기능적 오류는 아니지만 컨벤션 인터페이스 함수명과 provider 문서 서술 간 1:1 대응이 약해 추적성이 다소 떨어진다.
  - 제안: 필수는 아니나, `buildFormSubmissionResponse` 가 실제로 합성하는 응답(예: Slack `response_action: errors`, Discord `{ type: 4 }`/modal 재open 안내)을 언급하는 자리에 함수명을 괄호로 병기하면 컨벤션 인터페이스와의 매핑이 더 명확해진다.

- **[INFO]** `0-common.md` / `1-manual-trigger.md` 에 명시적 `## Overview` / `## Rationale` 섹션 부재
  - target 위치: `spec/4-nodes/7-trigger/0-common.md` (전체), `spec/4-nodes/7-trigger/1-manual-trigger.md` (전체)
  - 위반 규약: CLAUDE.md "정보 저장 위치" 표 — "Spec 문서 3섹션 구성 (Overview / 본문 / Rationale) 권장"
  - 상세: 같은 폴더의 `providers/_overview.md`·`discord.md`·`slack.md`·`telegram.md` 는 모두 `## Overview (제품 정의)` 와 `## Rationale` 섹션을 갖추었지만, 트리거 노드 본체 문서 2건은 타이틀 직후 설명 문단으로 Overview 를 대신하고 별도 `## Rationale` 섹션이 없다. 다만 이는 트리거 문서만의 이례적 패턴이 아니라 `spec/4-nodes/1-logic/1-if-else.md` 등 다수의 "단순" 노드 spec 이 동일하게 Overview/Rationale 헤딩을 생략하는 저장소 전반의 기존 관행과 일치한다(예: `spec/4-nodes/` 전체 38개 노드 문서 중 `## Rationale` 보유는 15개, `## Overview` 보유는 5개뿐). 따라서 이는 CRITICAL/WARNING 급 이탈이 아니라 저장소 전반에 걸친 관행형 편차이며, 이번 트리거 영역만 새로 도입된 이슈는 아니다.
  - 제안: 트리거 영역만 별도로 고칠 필요는 없음(현재 관행과 일치). 다만 저장소 전체 차원에서 3섹션 구조를 강제할지 여부를 별도로 결정한다면 이 파일들도 그 일괄 정리 대상에 포함한다.

## 검증 완료 항목 (위반 없음 — 참고용)

- **frontmatter 스키마**(`spec-impl-evidence.md` §2): `0-common.md`/`1-manual-trigger.md`/`providers/{discord,slack,telegram}.md` 모두 `id`(kebab-case) · `status: implemented` · `code:` 필드를 규약대로 보유. `code:` 경로 9건을 실제 파일 존재로 스팟체크 — 전부 실존. `id: common` 은 `1-logic/0-common.md`·`2-flow/0-common.md`·`3-ai/0-common.md`·`4-integration/0-common.md`·`5-data/0-common.md` 와 동일 패턴으로 저장소 전역에서 이미 정착된 관행(카테고리별 `0-common.md` 는 모두 `id: common`).
- **secret ref 포맷**(`secret-store.md` §1): `secret://triggers/{id}/bot-token`, `secret://triggers/{id}/inbound-signing` 등 discord.md/slack.md 의 모든 ref 표기가 `secret://<scope>/<resourceId>/<name>` (lower-kebab) 규약과 정확히 일치.
- **에러 코드 명명**(`error-codes.md` §1/§4): `INVALID_TRIGGER_PARAMETERS`/`INVALID_WEBHOOK_PAYLOAD`/`MISSING_REQUIRED_FIELD`/`TYPE_COERCION_FAILED`/`INVALID_SCHEMA` 는 모두 `UPPER_SNAKE_CASE` + 의미 기반 명명이며, 내부 소문자 분류 문자열(`missing_required`/`coerce_failed`/`invalid_schema`) → public 코드로의 정규화 패턴은 `error-codes.md §4` (Code 노드 `EXECUTION_TIMEOUT`→`CODE_TIMEOUT` 과 동일 패턴)와 정확히 합치. `spec/5-system/12-webhook.md`·`3-error-handling.md` 양쪽에 동일 SoT 로 교차 링크되어 drift 없음.
- **5필드 invariant / Principle 1.1·7·10·5**(`node-output.md`): `config`/`output` 직교성, `context.rawConfig?.parameters ?? []` 명시 키 echo(스프레드 패턴 미사용), `{}` fallback, `port: undefined` 단일 출력 모델 모두 Principle 정의와 일치. §5.1/§5.2 JSON 예시는 Principle 11 규칙대로 `undefined` 필드 생략 + 5필드 외 top-level 키 없음을 준수.
- **Chat Channel Adapter 인터페이스**(`chat-channel-adapter.md` §1/§2/§4.1/R-CCA-8): discord.md/slack.md 의 `setupChannel`/`teardownChannel`/`parseUpdate`/`sendMessage`/`ackInteraction` 서술과 `ChannelUpdate.command` kind 값(`open_form_modal`/`form_submission` 등), `Convention §4.1 (a)` 교차링크(R-CCA-8 세부 (a) 항목과 정확히 일치) 모두 정합.
- **provider 식별자 컨벤션**(`providers/_overview.md` §4): `discord`/`slack`/`telegram` 모두 lower-case, kebab-case 요구사항 충족(단일 단어라 하이픈 불필요).

## 요약

`spec/4-nodes/7-trigger/` 영역은 `node-output.md`(5필드 invariant, config/output 직교성, config echo, null fallback), `chat-channel-adapter.md`(6+2 함수 인터페이스, native modal 예외 R-CCA-8), `secret-store.md`(URI scheme), `error-codes.md`(명명·정규화 패턴), `spec-impl-evidence.md`(frontmatter 스키마) 등 관련 정식 규약을 전반적으로 충실히 따르고 있으며, cross-file SoT 링크(webhook.md/error-handling.md/manual-trigger.md 3자 교차참조 등)도 정확하다. CRITICAL 급 위반은 발견되지 않았다. 유일하게 실질적으로 손볼 가치가 있는 항목은 `0-common.md` §3 표의 `output: $params` 축약 표기로, 같은 문서군의 다른 곳(§3.2/§5.1 JSON/Expression 예시)과 대조하면 `output.parameters` 로 명확화하는 편이 오독을 줄인다(WARNING). 나머지 두 건(Principle 2 인용 라벨, provider 문서의 옵션 함수명 미인용)은 INFO 수준의 가독성/추적성 제안이며, Overview/Rationale 3섹션 미비는 트리거 문서만의 이례적 이탈이 아니라 저장소 전반의 기존 관행과 일치하므로 이번 영역 특유의 문제로 보지 않는다. 금번 작업(manual trigger output.parameters 자동완성 enricher, 프론트엔드 전용, spec 변경 없음) 은 이 spec 영역이 이미 규정한 `output.parameters` 계약을 그대로 소비하므로 구현 착수를 막을 컨벤션 이슈는 없다.

## 위험도

LOW
