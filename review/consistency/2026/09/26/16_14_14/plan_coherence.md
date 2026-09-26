# Plan 정합성 검토 — target: `spec/3-workflow-editor/4-ai-assistant.md` (impl-prep, plan: `assistant-e2e-contract-gaps`)

## 검토 대상 확인

target 문서는 `spec/3-workflow-editor/4-ai-assistant.md` 전체 번들이며, 실제 작업은
`plan/in-progress/assistant-e2e-contract-gaps.md` 가 정의한 세 e2e 계약 대조 칸이다
(`sessions/latest` 의 `data: null` · 테스트 F 상태 단언 `toBe(200)` · 테스트 H 도구 호출 선택
키 전부-생략 변형). `spec_impact: none` — spec 은 변경하지 않고 기존 계약을 e2e 로 대조만
추가한다.

## 발견사항

### 미해결 결정과의 충돌 (criterion 1)

없음. `plan/in-progress/**` 전체에서 `sessions/latest` · `findLatestActive` ·
`ApiOkWrappedNullableResponse` · `planStepId`/`planStepIds` 를 다루는 다른 plan 을
찾았으나 target 과 정확히 같은 `spec-draft-nullable-notation-followups.md` 트래커
항목(라인 5115~5124)뿐이었다 — 이 plan 자신이 그 항목을 닫는 작업이므로 충돌이 아니라
동일 항목의 실행이다. 상태 코드(200 고정) · null 분기 · 선택 키 생략 어느 것에 대해서도
다른 plan 이 반대 방향의 미결 결정을 남겨 두고 있지 않다.

### 선행 plan 미해소 (criterion 2)

- **[INFO]** target §6 REST API 표가 이미 알려진 두 결함을 그대로 담고 있다 (target 이
  만든 결함 아님, 이 plan 의 작업과도 직접 충돌 없음)
  - target 위치: `4-ai-assistant.md` §6 REST API 표 (`GET /api/workflow-assistant/sessions/{id}` 등
    5행) + "모든 엔드포인트는 `editor` 이상 역할이 필요" 서술
  - 관련 plan: `plan/in-progress/spec-draft-nullable-notation-followups.md` 라인
    5139~5146, planner 소유, `--spec` 필요, 미착수
  - 상세: 표에 `GET /api/workflow-assistant/sessions/latest` 행이 없고(코드·OpenAPI 에는
    존재), "모든 엔드포인트는 editor 이상" 서술은 실제로 `list`/`latest`/`findOne` 세 조회
    라우트가 워크스페이스 멤버십만 요구하는 것과 어긋난다. 이 plan(`assistant-e2e-contract-gaps`)이
    바로 그 `sessions/latest` 를 대상으로 `toBe(200)` 단언을 추가하므로 같은 엔드포인트를
    다루지만, 이 plan 은 테스트 파일만 바꾸고(spec 비접촉) 권한 경계를 새로 단언하지도
    않아 표의 결함을 확대하지도 해소하지도 않는다 — 충돌이 아니라 인접한 별도 트랙.
  - 제안: 별도 조치 불필요. 이미 트래커에 planner 항목으로 등재되어 있으므로 중복 등재하지
    말 것. 다만 이 plan 을 닫을 때(체크리스트 "트래커 항목 닫기") 같은 트래커 파일의
    옆 항목이므로 실수로 함께 체크하지 않도록 주의.

- **[INFO]** `ai-agent-tool-connection-rewrite.md` (미착수, 사용자 디자인 결정 대기)가
  같은 spec 파일(`4-ai-assistant.md`)의 `add_node`/`update_node` 응답 dynamic-ports 모델
  정합화를 §3 작업 단위에 갖고 있으나(라인 71), 이 plan 의 e2e 대조 세 칸과는 교집합이
  없다(다른 tool_call, 다른 필드축 — ports 스키마가 아니라 세션 null 분기·상태코드·
  `AssistantToolCallDto` 선택 키). 선행 조건 아님.

### 후속 항목 누락 (criterion 3)

없음. 이 plan 은 순수 테스트 추가이며 다른 plan 의 후속 항목을 무효화하거나 신규
후속 항목을 만들 변경을 포함하지 않는다. `plan/in-progress/spec-sync-external-interaction-api-gaps.md`
가 같은 spec 파일의 §4.1.1 마스킹 규칙(egress masking)을 다루지만 전부 `[x]` 로 종결되어
있고, 이 plan 의 테스트 대상(응답 필드 존재 여부·상태 코드)과 겹치지 않는다.

## 요약

`assistant-e2e-contract-gaps` plan 은 `/ai-review` `review/code/2026/09/26/14_07_11`
INFO7·8·9 를 그대로 반영한 좁은 범위(테스트 파일 3칸)이며, 같은 트래커
(`spec-draft-nullable-notation-followups.md`)의 해당 항목(라인 5115)과 문구·범위가
일치한다. `plan/in-progress/**` 전체를 대상으로 `sessions/latest`·`ApiOkWrappedNullableResponse`·
`planStepId`/`planStepIds` 관련 항목을 교차 확인했으나 이 plan 의 결정(200 고정 단언,
null 분기 대조, 선택 키 생략 변형 추가)과 충돌하는 미해결 결정이나 미해소 선행 조건은
없다. target spec 의 §6 REST API 표에 이미 알려진 별도 결함(`sessions/latest` 행 누락 +
역할 서술 부정확)이 있으나 이는 별도 planner 항목으로 독립 추적 중이며 이 plan 의 작업
범위·spec_impact: none 과 충돌하지 않는다.

## 위험도

NONE
