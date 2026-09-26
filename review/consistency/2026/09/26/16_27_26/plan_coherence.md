# Plan 정합성 검토 — target: `plan/in-progress/spec-draft-ed-ai-19-status.md`

## 검토 대상 확인

target 은 `spec/3-workflow-editor/_product-overview.md` §10.4 ED-AI-19 행에 상세 spec(`4-ai-assistant.md`
§12.2)과 같은 "(미구현 — 계획)" 표기를 붙이는 한 줄 사실 정정 draft 다. 발단은
`review/consistency/2026/09/26/16_14_14`(`--impl-prep`, target: `assistant-e2e-contract-gaps` plan)의
cross_spec.md CRITICAL — 실측 확인, 제안 방향, ED-AI-38·§10.9 불변 판단 모두 원 리포트와 일치한다.

## 발견사항

### [WARNING] 같은 발단 리뷰의 WARNING 3건이 트래커에 등재되지 않고 누락됨

- target 위치: `plan/in-progress/spec-draft-ed-ai-19-status.md` "안 하는 것" 절
- 관련 plan: `plan/in-progress/spec-draft-nullable-notation-followups.md` (planner 소유 후속 트래커).
  관련 리뷰: `review/consistency/2026/09/26/16_14_14/convention_compliance.md`
- 상세: target 을 촉발한 `16_14_14` 리뷰는 같은 문서(`4-ai-assistant.md`)에 대해 CRITICAL 1건(ED-AI-19,
  target 이 처리) 외에 **WARNING 4건**을 냈다 — ①frontmatter `status: implemented` vs 본문 §7·§10·§12.2
  "(계획)" 3건 불일치(`pending_plans` 미기재), ②Assistant 도메인 에러 코드 8종이 `3-error-handling.md` §1
  중앙 카탈로그에 미등재, ③SSE `event: error` 페이로드가 REST 에러 봉투와 다른데 그 예외 근거 미기재,
  ④도구 호출 배지 영문 하드코딩이 i18n Principle 1 을 우회하면서 스코프 예외로 미등재. target 의 "안
  하는 것" 절은 이 중 **①만** 언급하며 "`--impl-prep` WARNING 3 으로 트래커에 등재한다"고 적지만, 실제로
  `spec-draft-nullable-notation-followups.md` 를 전수 검색(`grep -n "4-ai-assistant\|pending_plans\|
  ASSISTANT_LLM_CONFIG_INVALID\|도구 호출 배지\|Assistant 에러 코드"`)해도 이 4건 중 **어느 것도** 등재된
  흔적이 없다(0건) — ①은 "등재한다"는 의도만 적혔을 뿐 실제 체크리스트 항목이 아직 생성되지 않았고,
  ②·③·④는 draft 본문에 아예 언급조차 없다. 같은 트래커가 이미 이 문서의 다른 두 결함(REST 표
  `sessions/latest` 누락·RBAC 서술 부정확, 라인 5139)은 "planner, 낮음, 2026-09-26 등재"로 정확히
  기록해 둔 선례가 있어, ②·③·④가 같은 패턴으로 누락된 것은 우연이 아니라 이 draft 가 범위를 CRITICAL
  1건으로 좁히면서 같은 리뷰 세션의 나머지 WARNING 을 드롭한 결과로 보인다. `review/consistency/**`
  세션 디렉터리는 다음 사람이 관성적으로 다시 열어보는 위치가 아니므로, 지금 등재하지 않으면 이 3건은
  근거 채로 유실될 위험이 크다.
- 제안: 이 draft(또는 같은 PR)에서 `spec-draft-nullable-notation-followups.md` 에 ①·②·③·④ 4건을
  "planner, 2026-09-26 등재, `--impl-prep 16_14_14` convention_compliance W1~W4" 형식으로 각각 체크리스트
  항목을 추가한다. 최소한 target 의 "안 하는 것" 절에 ②·③·④ 존재를 언급이라도 남겨 "안 하는 것으로
  확인·의도적으로 스코프 밖" 임을 명시할 것.

### [INFO] "WARNING 3" 인용이 실제 개수(4건)와 어긋남

- target 위치: "안 하는 것" 절 "`--impl-prep` WARNING 3 으로 트래커에 등재한다"
- 관련 plan: `review/consistency/2026/09/26/16_14_14/convention_compliance.md` (실측: `### [WARNING]`
  헤더 4개)
- 상세: `convention_compliance.md` 는 WARNING 을 4건 냈다(frontmatter·에러카탈로그·SSE봉투·i18n하드코딩).
  target 이 인용한 "WARNING 3"이 (a) convention_compliance 파일 내 몇 번째 항목인지, (b) 세션 전체
  WARNING 총계인지 불명확하고 어느 해석으로도 정확히 "3"이 나오지 않는다(파일 내 순번은 1, 세션
  전체 합은 cross_spec 2건 + convention_compliance 4건 = 6). 위 WARNING 항목의 실제 등재 작업을 할 때
  이 인용을 그대로 트래커에 옮기면 나머지 항목을 찾는 사람이 잘못된 좌표를 따라가게 된다.
- 제안: 트래커 등재 시 정확한 파일·섹션 인용("`convention_compliance.md` §1 `status: implemented`…")으로
  교체.

## 요약

target 자체(§10.4 ED-AI-19 행에 "(미구현 — 계획)" 표기 추가)는 발단 리뷰의 CRITICAL 을 정확히 반영하고,
`ai-agent-tool-connection-rewrite.md`(미착수, 사용자 결정 대기)의 ED-AI-19 관련 체크리스트 항목과도
교집합이 없어 미해결 결정을 우회하지 않는다. 다만 target 을 낳은 같은 리뷰 세션이 낸 WARNING 4건 중
1건만 "안 하는 것"에 이름이 올랐고 실제 트래커 등재는 되지 않았으며, 나머지 3건(에러 코드 카탈로그
미등재·SSE 봉투 예외 미기재·i18n 배지 하드코딩)은 draft 어디에도 언급이 없다 — 후속 항목 누락이다.
CRITICAL 급 결정 충돌은 없다.

## 위험도

MEDIUM
