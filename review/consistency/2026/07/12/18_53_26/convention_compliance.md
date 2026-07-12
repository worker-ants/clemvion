# 정식 규약 준수 검토 — spec/4-nodes/7-trigger/1-manual-trigger.md

## 검토 범위

target: `spec/4-nodes/7-trigger/1-manual-trigger.md` (검토 모드: spec draft, `--spec`)

대조한 정식 규약: `spec/conventions/node-output.md`, `spec/conventions/error-codes.md`,
`spec/conventions/spec-impl-evidence.md`, `spec/conventions/swagger.md`,
`spec/5-system/2-api-convention.md`, `spec/5-system/3-error-handling.md`,
`spec/5-system/12-webhook.md`, `.claude/skills/project-planner/SKILL.md` (문서 구조 3섹션·명명 컨벤션),
및 sibling 문서(`spec/4-nodes/7-trigger/0-common.md`, `spec/4-nodes/4-integration/*.md`,
`spec/4-nodes/1-logic/*.md`)와의 구조·표기 비교.

## 발견사항

- **[WARNING]** HTTP 상태 표기 `BadRequest`(공백 없음)가 정식 규약의 `Bad Request`(공백 포함) 표기와 불일치, 같은 표 안에서도 표기가 통일되지 않음
  - target 위치: §6 "실행 시점 어댑터별 누락(`missing_required`)의 HTTP 응답 코드" 표 — `Manual (주 실행 경로)` 행 `` `400 BadRequest` code `INVALID_TRIGGER_PARAMETERS` ``, `Webhook` 행 `` `400 BadRequest` code `INVALID_WEBHOOK_PAYLOAD` ``
  - 위반 규약: [`spec/5-system/2-api-convention.md` §6 HTTP 상태 코드](../../../../../spec/5-system/2-api-convention.md) — `400` 의 공식 명칭은 `Bad Request`(공백 포함)로 표기
  - 상세: (1) `api-convention.md` §6 뿐 아니라 같은 트리거 폴더의 `0-common.md`("`400 Bad Request`로 요청 거부"), `12-webhook.md`, `14-external-interaction-api.md` 등 spec 전반이 예외 없이 `Bad Request`(공백 포함)로 표기하는데, 본 target 만 `BadRequest`(NestJS `BadRequestException` 클래스명을 그대로 옮긴 듯한 표기)를 쓴다. (2) 같은 표 안에서도 세 번째 행 "Manual re-run (inputOverride)" 은 `` `400 INVALID_INPUT` ``(코드만, `BadRequest`/`Bad Request` 단어 자체가 없음) 로 또 다른 형식이라 표 내부 일관성도 깨진다.
  - 제안: 두 행의 표기를 `` `400 Bad Request` code `INVALID_TRIGGER_PARAMETERS` `` / `` `400 Bad Request` code `INVALID_WEBHOOK_PAYLOAD` `` 로 정정하고, 세 번째 행도 동일 포맷(`` `400 Bad Request` code `INVALID_INPUT` ``)으로 맞춰 표 내부·corpus 전체 표기를 통일.

- **[INFO]** `meta.source` 를 뒷받침하는 CONVENTIONS Principle 2 인용에 실제 존재하지 않는 부제("실행 컨텍스트")가 붙음
  - target 위치: §4 실행 로직, 6번 항목 — "**meta 채움**: `meta.source: ...` (CONVENTIONS Principle 2 — 실행 컨텍스트)"
  - 위반 규약: [`spec/conventions/node-output.md` Principle 2](../../../../../spec/conventions/node-output.md) — 실제 제목은 "`meta` 는 '실행 메트릭'만 담는다"이며 "실행 컨텍스트"라는 문구는 Principle 2 본문 어디에도 없음 (동일 §5.1 표의 같은 필드는 부제 없이 "(CONVENTIONS Principle 2)"로만 인용해 스스로도 표기가 갈림)
  - 상세: 사소하지만 독자가 node-output.md Principle 2 를 열었을 때 "실행 컨텍스트" 프레이밍을 찾지 못해 혼란을 줄 수 있음. Critical 한 의미 위반은 아니고 인용 라벨의 정확성 문제.
  - 제안: 부제를 떼거나 "(CONVENTIONS Principle 2 — 실행 메트릭)" 로 정정. 또는 `meta.source` 의 실제 도메인 SoT 인 `0-common.md §3`(5필드 공통 규약, Trigger 카테고리)를 함께/대신 인용.

- **[INFO]** `node-output.md` Principle 2 분류표에 Trigger 카테고리·`meta.source` 행이 없어 인용의 근거가 표 밖에 있음
  - target 위치: §4 point 6, §5.1 필드 표의 `meta.source` 행 — 모두 "CONVENTIONS Principle 2" 를 근거로 듦
  - 위반 규약: [`spec/conventions/node-output.md` Principle 2](../../../../../spec/conventions/node-output.md) 의 필수/권장 필드 표는 `공통`/`LLM 계열`/`HTTP`/`DB`/`Code`/`Container` 6개 카테고리만 나열하고 `Trigger`(`meta.source`)는 없음. 실제 정의는 `0-common.md §3` 표에만 있음
  - 상세: target 자체의 결함이라기보다 node-output.md(상태 `partial`, `pending_plans: node-output-redesign`) 쪽이 Trigger 카테고리를 아직 반영하지 못한 것으로 보임 — 규약 문서와 인용 대상 사이의 완결성 갭. target 이 원인은 아니나, 검토 관점 5(금지 항목/명명)의 상위 SoT 정합성 차원에서 함께 기록.
  - 제안 (규약 갱신 권장): `node-output.md` Principle 2 표에 `Trigger` 행(`meta.source`) 을 추가해 `0-common.md §3` 과 상호 링크를 맺으면 이후 인용 정확도가 올라감. target 자체 수정은 불필요.

## 검증 완료(위반 없음 확인) 항목

- 프런트매터 `id: manual-trigger` / `status: implemented` / `code:` 5개 경로 모두 실존 확인 — `spec-impl-evidence.md` §2.1 kebab-case·basename 규칙, §3 lifecycle 규칙 준수.
- 문서 구조(제목 → 소개 문단 → `---` → 번호 섹션 → `## Rationale`)는 `0-common.md`·`4-integration/*.md`·`1-logic/*.md` sibling 다수와 동일 패턴 — 개별 노드 spec 은 `_product-overview.md` 가 PRD Overview 를 이미 소유하므로 리터럴 `## Overview` 헤딩이 없어도 SKILL.md §명명 컨벤션 위반 아님.
- `output.error` 미보유·에러 포트 부재 서술은 `node-output.md` Principle 3.3 의 목록(`http_request`/`database_query`/… 에 `manual_trigger` 없음)과 정합.
- `config` echo 는 단일 필드(`context.rawConfig?.parameters`) 명시 방식으로 Principle 7 의 "명시 enumeration 의무화(D1)" 를 준수 — 금지된 spread 패턴 없음.
- `output.parameters`/`config.parameters` 직교성 서술은 Principle 1.1 을 정확히 인용·재확인.
- `INVALID_TRIGGER_PARAMETERS`/`INVALID_WEBHOOK_PAYLOAD`/`MISSING_REQUIRED_FIELD`/`TYPE_COERCION_FAILED`/`INVALID_SCHEMA` 모두 `UPPER_SNAKE_CASE` (`error-codes.md` §1) 이며 `3-error-handling.md §1.7`·`12-webhook.md §5.2` 와 코드명·레이어링(내부 분류 문자열 → public field code 정규화) 이 정확히 일치.
- 에러 응답 봉투 `{ error: { code, message, requestId, details } }` 서술은 `api-convention.md §5.3` 과 1:1 일치.
- `output.request` 가 webhook 어댑터에서만 존재하고 Manual/Schedule 에서는 키 자체가 생략된다는 서술은 두 케이스(§5.1/§5.2)로 명확히 분리 문서화 — Principle 11 "Case 별로 분리" 준수, 생략 사유도 본문에 명시(§5.4 정신과 정합).
- 표 헤더 `필드 | 타입 | 출처 | 설명`(4열)·`## 6. 에러 코드` 헤딩·`$node["Manual Trigger"]` 표기 모두 `4-integration/*.md`·`5-expression-language.md` 의 기존 관례와 동일.
- `__triggerSource` 내부 마커 명명은 `execution-context.md` 원칙 5(`__` 예약 prefix)·`5-expression-language.md` 기존 서술과 계열이 같은 기존 확립 패턴 (본 PR 이 신규 도입한 게 아님).

## 요약

target 문서는 5필드 invariant·config/output 직교성·에러 코드 명명(UPPER_SNAKE_CASE)·에러 응답 봉투·문서 3섹션 구조·표 포맷 등 핵심 정식 규약을 대부분 정확히 준수하며, 다수 항목에서 오히려 규약 원문을 직접 인용해 근거를 명시하는 등 모범적으로 작성됐다. 유일한 실질적 흠은 §6 표의 `BadRequest`(공백 없음) 표기가 `api-convention.md §6` 및 corpus 전체의 `Bad Request`(공백 포함) 관례와 어긋나고 표 내부에서도 통일되지 않은 점이며, 이는 사소한 표기 정정으로 해소 가능하다. 나머지 두 건은 Principle 2 인용 라벨의 정확성에 관한 INFO 수준 참고사항으로, target 자체보다 상위 규약 문서(`node-output.md`)의 Trigger 카테고리 미반영에 가깝다.

## 위험도

LOW
