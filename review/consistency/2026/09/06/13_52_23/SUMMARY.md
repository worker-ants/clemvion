# Consistency Check 통합 보고서

**BLOCK: YES** — 신설된 `code:` YAML-주석 금지 규칙이 이미 다른 3개 도메인 7개 spec 파일에서 위반 중이며, 그 결과 이 branch 자신의 diff(`workspace-response.dto.ts`)도 `--impl-done` Gate 2 의 spec-linkage 판정에서 누락된다 (cross_spec·convention_compliance 두 checker가 독립적으로 CRITICAL 판정, 서로 다른 실측 수치로 교차 확인됨).

## 전체 위험도
**HIGH** — 구조적 충돌은 아니나 게이트 무결성(spec-linkage 판정)이 훼손돼 있고, 근본 원인 수정은 developer 권한 밖(다른 도메인 spec 편집)이라 planner 턴이 필요하다.

## Critical 위배 (BLOCK 사유)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | cross_spec, convention_compliance | target(`spec-impl-evidence.md` §2.1, `review-citations.md`)이 이번에 성문화한 "`code:` 블록 리스트에 `#` YAML 주석을 넣으면 `review_guard._parse_frontmatter_code` 가 그 줄에서 `break` 해 뒤 항목이 조용히 사라진다" 는 규칙이, 같은 컨벤션이 관할하는 다른 3개 도메인 **7개 파일**에서 **이미, 지금도** 위반 중임을 실측(파서 로직 재현)으로 확인. 실제 entry 65개 중 **41개**가 harness 관점에서 누락(`spec/2-navigation/_layout.md`, `10-auth-flow.md`, `11-error-empty-states.md`, `9-user-profile.md`, `spec/7-channel-web-chat/2-sdk.md`, `3-auth-session.md`, `spec/conventions/user-guide-evidence.md`). 이 가운데 **이번 branch 자신이 수정한 `workspace-response.dto.ts`(joinedAt 필드)도 `9-user-profile.md` 의 드롭된 항목에 걸려 있어, Gate 2 가 이 diff 를 spec-linked 로 인식하지 못한다.** 특히 `codebase/frontend/src/app/(main)/[...rest]/page.tsx` 는 4개 spec 파일 모두에서 주석 뒤라 완전히 spec-unlinked 상태. | `spec/conventions/spec-impl-evidence.md` §2.1 `code` 필드 신규 경고 문단, `spec/conventions/review-citations.md` Rationale 정정 블록 | `spec/2-navigation/_layout.md`·`10-auth-flow.md`·`11-error-empty-states.md`·`9-user-profile.md`, `spec/7-channel-web-chat/2-sdk.md`·`3-auth-session.md`, `spec/conventions/user-guide-evidence.md` (7개 파일, 41개 entry) + `.claude/hooks/_lib/review_guard.py::_parse_frontmatter_code` (근본 파서 결함) | (a) 위 7개 파일의 `code:` 블록에서 인라인 `#` 주석 제거 → 프로즈/표로 이전(`review-citations.md` 자신에게 적용한 방식과 동일). (b) `plan/in-progress/spec-draft-nullable-notation-followups.md` 의 기존 harness 백로그 항목(L1087-1114)에 이 7개 파일·41개 entry 실측을 추가해 범위 갱신(신규 항목 등재 금지 — 이미 등재된 결함). (c) 근본 수정은 파서가 `#` 주석·빈 줄을 스킵하도록 고치는 것. |

## planner 인계 (권한 밖 Critical)

> 위 Critical 은 그대로 CRITICAL 이고 `BLOCK: YES` 도 유지된다 — 이 표는 차단을 푸는 장치가 아니라 다음 행동을 지정하는 장치다.

| # | 권한 밖인 이유 | 인계 대상 | planner 가 고칠 것 (파일·섹션) | 추적 위치 |
|---|---------------|----------|------------------------------|----------|
| 1 | 수정 대상 7개 spec 파일(`2-navigation/**`, `7-channel-web-chat/**`, `conventions/user-guide-evidence.md`)의 `code:` 주석은 이 developer 세션이 작성한 문장이 아니며(자기-반증형 소정정 예외 조건 1 불충족), 여러 도메인에 걸친 spec 편집이라 `developer` 권한(`spec/` read-only) 밖이다. | project-planner | 위 7개 파일의 `code:` 블록에서 `#` YAML 주석을 제거하고 범주 설명을 본문 프로즈/표로 옮긴다(`review-citations.md` 정정과 동일 패턴). 겸사겸사 `spec-impl-evidence.md` §2.1 경고 문단에 harness 백로그 링크를 추가해 재발 방지. | `plan/in-progress/spec-draft-nullable-notation-followups.md` L1087-1114 |

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | cross_spec | 동일 결함 클래스가 하루 안에 3번째로 재발할 위험 — target 의 회피책이 매번 "그 문서 하나만" 고치는 국소 패턴을 반복(①`2-api-convention.md`/`swagger.md`→②`review-citations.md`→③위 CRITICAL 의 7개 파일, 아직 미해소). | `spec/conventions/review-citations.md` "왜 PR 번호로 전환하지 않았나" 절 인접 | `plan/in-progress/spec-draft-nullable-notation-followups.md` L1087-1114 | 이번 라운드에서 전역 스윕이 어렵다면 최소한 target 정정 문단에 "이미 알려진 7개 파일이 동일 결함을 갖고 있다"는 사실과 backlog 링크를 남겨 다음 사람이 "이 문서만 고치면 끝"이라 오판하지 않게 한다(위 CRITICAL 제안 (b)와 동일 조치로 겸행 가능). |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | plan_coherence | 직전 라운드(코드 리뷰 `13_39_20` Critical 1)가 잡은 YAML-주석 파서 회귀(`review-citations.md` 자신의 `code:` 블록, 2개→0개)는 **워킹트리에서 이미 수정**됐으나 아직 커밋되지 않았다. | `spec/conventions/review-citations.md`, `spec/conventions/spec-impl-evidence.md` | 이 수정을 별도(또는 정리) 커밋으로 반드시 반영. 반영되면 `spec-draft-review-citations-enforcement.md` 의 마지막 체크박스("`--impl-done` 재실행으로 Critical 해소 확인")를 본 라운드 근거로 닫을 것. |
| 2 | naming_collision | 직전 라운드(`13_39_25`) WARNING(`WorkflowVersionDetail` 백엔드/프론트엔드 동명)이 제안대로 JSDoc 상호 참조로 처분됨 확인 — 추가 조치 불요. | `codebase/backend/src/modules/workflow-versions/workflow-versions.service.ts` | 없음(정합 확인). 다음에 두 타입 중 하나를 만질 때 JSDoc 유지 여부만 확인. |
| 3 | convention_compliance | `review-citations.md` Rationale 안에서 지적 번호 라벨이 `W2`/`INFO#2`/`Critical 1` 세 형식으로 혼재 — 규약 위반은 아니나 다음 저자에게 애매함을 남긴다. | `spec/conventions/review-citations.md` Rationale | 여유가 있을 때 §2 예시 옆에 "라벨은 원 리뷰 산출물 표기를 그대로 옮기며 형식 통일을 요구하지 않는다"는 한 줄 추가. |
| 4 | rationale_continuity | `spec/5-system/2-api-convention.md`·`swagger.md §5-1` 의 "두 검증자" 서술이 3축(구조/이름/JSDoc)을 아직 반영 못함 — 이번 target 의 결함 아니고 이미 다른 라운드·plan 에 등재된 별도 gap. | (참고, target 무변경) | 없음(이 target 의 종결 조건 아님, 후속 planner 턴에서 처리 예정). |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | HIGH | 신설 규칙이 3개 도메인 7개 spec 파일에서 이미 위반 중, 이 branch 자신의 diff 포함해 Gate 2 사각지대 실측 |
| rationale_continuity | NONE | `## Rationale` 정정 절차(취소선 보존·날짜·실재 인용) 정합, 자기-반증형 소정정 예외 절차도 올바르게 planner 턴을 탐 |
| convention_compliance | HIGH | 동일 결함을 65개 entry 중 41개 누락으로 정밀 실측, 게이트 무결성(`--impl-done` spec-linked 판정) 훼손 확인 |
| plan_coherence | LOW | 선행 Critical(주석 파서 회귀)이 워킹트리에서 이미 수정됐으나 미커밋 상태로 잔존 |
| naming_collision | LOW | 직전 WARNING 처분 확인, 신규 CRITICAL/WARNING 없음 |

## 권장 조치사항
1. (BLOCK 해소 최우선, planner 턴) `spec/2-navigation/_layout.md`·`10-auth-flow.md`·`11-error-empty-states.md`·`9-user-profile.md`, `spec/7-channel-web-chat/2-sdk.md`·`3-auth-session.md`, `spec/conventions/user-guide-evidence.md` 의 `code:` 블록에서 YAML 주석 제거 → 프로즈/표로 이전.
2. `plan/in-progress/spec-draft-nullable-notation-followups.md` 의 기존 harness 백로그 항목(L1087-1114)에 위 7개 파일·41개 entry 실측을 추가해 범위 갱신(신규 항목 중복 등재 금지).
3. 근본 수정: `.claude/hooks/_lib/review_guard.py::_parse_frontmatter_code` 파서가 `#` 주석·빈 줄을 스킵하도록 고친다(developer 권한 내, harness 코드).
4. 워킹트리에 이미 반영된 `review-citations.md`/`spec-impl-evidence.md` 정정(주석→표 치환, 사고 경위 기록)을 별도 커밋으로 확정 반영.
5. `spec-impl-evidence.md` §2.1 경고 문단에 harness 백로그(L1087-1114) 링크를 추가해 재발(이미 24시간 내 2회) 방지.
6. (경미, 비차단) `review-citations.md` 지적 번호 라벨 형식 일관성 안내 한 줄 추가.