# 신규 식별자 충돌 검토 — spec/5-system/ (--impl-prep)

## 조사 방법

target 으로 제공된 번들은 `spec/5-system/1-auth.md`·`2-api-convention.md`·`3-error-handling.md`
전문(본문 생략 없음)과, 예산 초과로 생략된 나머지 15개 파일 목록이다. 검색 대상 코퍼스도
전량 예산 초과로 생략되어 있어, 프롬프트 지시("여기 없다는 사실을 근거로 삼지 말고 Read 로
직접 열어라")에 따라 실제 저장소를 직접 조사했다.

이번 `--impl-prep` 호출의 실제 작업 대상은 `plan/in-progress/assistant-mask-leak.md`
(`spec_impact: none`)로, workflow-assistant LLM 도구가 노출하는 `inputData`/`outputData`/
`error` 세 필드의 마스킹 강화 작업이다. 현재 워크트리에는 이미 코드 diff 가 존재한다
(`git status` — `mask-sensitive-fields.util.ts`·`explore-tools.service.ts`·
`explore-tools.service.spec.ts` 3개 파일, `spec/**` 변경 0). 이 diff 를 "target 이 새로
도입하는 식별자" 의 실제 후보 집합으로 삼아 조사했다:

- `explore-tools.service.ts` 신규 로컬 함수 `redactAssistantFields` (미export, 파일 내 2회
  참조 외 전 저장소 매치 없음 — 충돌 없음)
- `mask-sensitive-fields.util.ts` `DEFAULT_SENSITIVE_KEYS` 에 `csrfToken`/`csrf_token`/
  `authToken`/`auth_token`/`sessionToken`/`session_token`/`idToken`/`id_token` 8개 리터럴 추가
  — 신규 식별자가 아니라 기존 Set 의 원소 확장이며, 이미 자매 표면
  `CREDENTIAL_KEY_PATTERN`(`websocket.service.ts`/`sanitize-error-message.ts`)이 동일 계열을
  정규식으로 잡고 있어 명명 자체는 저장소 전역과 일치한다.

`spec/5-system/*` 3개 파일(및 언급된 conventions·data-flow 참조)을 훑어 요구사항 ID·엔티티/
타입명·API endpoint·이벤트명·env/설정키·파일 경로 6개 관점을 적용했다.

## 발견사항

이번 target 이 실제로 도입하는 식별자는 위 하나의 로컬 함수명과 8개 마스킹 키 리터럴뿐이며,
둘 다 충돌이 없다. `spec/5-system/` 쪽은 `spec_impact: none` 대로 변경이 없고, 번들로 제공된
세 파일은 기존에 이미 수 차례 consistency-check 라운드를 거친 상태로(문서 내부에 "근접 명명
주의" 각주가 다수 선제적으로 박혀 있음 — 예: `PASSWORD_INVALID` vs `INVALID_PASSWORD`,
`NOT_A_MEMBER` vs `already_a_member`/`workspace_type_mismatch`), 신규 충돌을 추가로 만들지
않는다.

- **[INFO]** 마스킹 마커 표기가 두 형태로 갈린다 (`***` vs `****<last4>`) — 이번 target 범위는 아니지만 확장 표면에 걸림
  - target 신규 식별자: 이번 diff 로 `DEFAULT_SENSITIVE_KEYS`(→ `****<last4>` 산출,
    `mask-sensitive-fields.util.ts`)가 커버하는 키가 8개 늘었고, 같은 필드가
    `explore-tools.service.ts`(LLM 도구 표면)에서는 `deepRedactSecrets` 가 겹쳐 적용되어
    `***`(bare, `@workflow/masked-markers` 의 `VALUE_MASK_MARKER`)로 다시 덮인다.
  - 기존 사용처: `codebase/packages/masked-markers/src/index.ts` — `VALUE_MASK_MARKER = "***"`
    는 backend egress 마스킹과 frontend 재제출-거부 판정(`isMaskedMarker`,
    `reject-masked-resubmission.ts`)이 **공유하는 계약**이라고 명시. 같은 파일 주석이
    "저장소에는 `***`·`[REDACTED]` 를 **독립적으로** 쓰는 마스커가 여럿 있고 이 집합과
    **무관**하다"고 선제적으로 경고한다.
  - 상세: `handler-output.adapter.ts`(node config echo → DB/WS/expression, 이번 target 의
    "자매 표면")는 `maskSensitiveFields` 만 적용해 `****<last4>` 를 산출하며 `deepRedactSecrets`
    를 겹치지 않는다(plan 이 "값 축은 별건" 이라 명시). 즉 같은 개념(민감 필드 마스킹)이
    표면에 따라 `***`(공유 마커 계약 준수, 재제출 거부 대상)와 `****<last4>`(공유 마커 계약
    밖, 재제출 거부 대상 아님) 두 가지 다른 산출물을 낸다. `handler-output.adapter.ts` 의
    출력은 현재 `resolveTriggerParametersRejectingMasked`/`findMaskedResubmissions` 의
    입력 경로(Manual 실행 `Execution.inputData`)에 들어가지 않으므로 **오늘 시점엔 보안
    구멍은 아니다** — 다만 이번 plan 이 `DEFAULT_SENSITIVE_KEYS` 를 token 계열로 넓히면서
    `****<last4>` 를 내는 필드 수가 늘어, 향후 이 값이 재제출 경로로 흘러드는 새 소비처가
    생기면 `isMaskedMarker` 가 그 값을 마스킹 산물로 인식하지 못하는 오탐(= 재제출 허용)
    위험이 커진다.
  - 제안: 신규 결함은 아니므로 이번 target 을 막을 사유는 아니다. `plan/in-progress/
    assistant-mask-leak.md` 의 "자매의 값 축 잔여를 트래커에 등재" 항목에, `handler-output.
    adapter.ts` 산출물이 장래 재제출 가능 경로에 들어갈 경우 `isMaskedMarker` 계약과
    맞추거나(→ `VALUE_MASK_MARKER` 로 통일) 별도 가드를 두어야 한다는 한 줄을 덧붙여 두는
    편이 안전하다.

다른 5개 관점(요구사항 ID·엔티티/타입명·API endpoint·이벤트/메시지명·파일 경로)에서는
target 이 새로 도입하는 식별자가 없어(spec 변경 0, 코드 diff 도 로컬 함수 1개·기존 Set
리터럴 확장뿐) 충돌 후보가 발견되지 않았다.

## 요약

이번 `--impl-prep` 호출의 실제 target(`assistant-mask-leak` 작업)은 `spec_impact: none` 이며
코드 diff 도 로컬 함수 1개(`redactAssistantFields`, 충돌 없음)와 기존 마스킹 키 Set 리터럴
8개 확장뿐이라, 요구사항 ID·엔티티/타입명·API endpoint·이벤트명·env/설정키·파일 경로 6개
관점 어디에서도 신규 식별자 충돌이 발견되지 않았다. 함께 번들된 `spec/5-system/1-auth.md`·
`2-api-convention.md`·`3-error-handling.md` 는 이미 여러 라운드의 명명 정합화를 거쳐 근접
명명을 스스로 각주로 방어하고 있어 추가 충돌 없음. 유일한 관찰은 이번 target 범위 밖의
기존 아키텍처 특성(마스킹 마커가 표면별로 `***`/`****<last4>` 두 형태로 갈리는 것)이 이번
key-set 확장으로 노출 표면이 약간 넓어진다는 점이며, INFO 로만 등재한다.

## 위험도
NONE
