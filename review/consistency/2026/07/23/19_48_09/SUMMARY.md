# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음 (5개 checker 전원 success, CRITICAL 0건)

## 전체 위험도
**LOW** — target(`plan/in-progress/presentation-thread-optout-drift.md`)의 핵심 처방(§4.6 을 "동작(구현됨)/표면(미구현)" 2층위로 정밀화)은 코드 실측(`appendInternal`/`isOptedOut` 노드 무관 게이트, 5개 presentation schema `excludeFromConversationThread` 미선언 0건, `.passthrough()` 38회)과 정확히 일치하며 새 요구사항 ID·엔티티·API 도입도 없다. 다만 (1) 인접 문서 `conversation-thread.md §2.4` 의 대칭 편집이 "확인"에만 머물러 실행 방향이 pin 되지 않았고, (2) target 이 자체 발견한 `form.handler.ts` D1 위반의 "별건 백로그 분리"가 실제로 이뤄지지 않아 sibling plan 과 모순이 남고, (3) frontmatter `status` 조정 판단이 `spec-impl-evidence.md §3` 가드와 충돌할 실행 리스크가 있고, (4) 유지되는 UI 그룹 라벨이 AI 카테고리 실제 GROUP 상수와 다르다 — 4건 모두 비차단이나 §4.6 개정 실행 시 함께 반영 권고.

## Critical 위배 (BLOCK 사유)

없음.

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | cross_spec, rationale_continuity, convention_compliance | `conversation-thread.md §2.4`("필드 정의 SoT = 3 노드 공유 fragment")가 presentation 5노드엔 들어맞지 않는 문구를 그대로 남기는데, target 체크리스트는 "정합 확인"만 요구하고 구체 편집 방향을 pin 하지 않음 — §4.6 정정 후에도 같은 drift 계열(스키마 선언 SoT ↔ 실동작 범위 혼동)이 §2.4 에 비대칭으로 잔존할 위험 | `plan/in-progress/presentation-thread-optout-drift.md` §개정방침, 체크리스트 4번째 항목 | `spec/conventions/conversation-thread.md §2.4`, `spec/4-nodes/6-presentation/0-common.md §4.6` | 체크리스트 항목을 "확인"→"조치"로 격상하고 target `## Rationale`에 구체 문구를 미리 pin: "게이트(`appendInternal`)는 노드 종류 무관 공통 적용 / 필드 선언 SoT 는 AI 3노드 shared fragment 한정, presentation 5노드는 schema 미선언(현재) 상태로도 passthrough 로 수동 설정 시 동작"을 §2.4 끝에 추가 |
| 2 | convention_compliance | 체크리스트 3번째 항목("frontmatter status·code 조정 판단")이 `spec-impl-evidence.md §3` 의 `status: partial`→`pending_plans:` 강제 규칙(빌드 가드)과 충돌할 소지를 열어둔 채 미결 — target 은 표면 갭 추적 plan 을 만들지 않기로 이미 결정(`## 비목표` 1항)했으므로, "판단" 결과가 `partial` 로 귀결되면 `pending_plans` 를 채울 실존 plan 이 없어 가드가 즉시 fail | `plan/in-progress/presentation-thread-optout-drift.md` 체크리스트 3번째 항목 | `spec/conventions/spec-impl-evidence.md §3`, `spec-pending-plan-existence.test.ts` 가드 | 체크리스트 항목에 방향을 미리 명시: "status: implemented 유지(런타임 게이트는 전 노드 완비, §3 의 '구현 surface' 정의는 코드 계약이지 UI 노출 미포함), pending_plans 신설 없음" |
| 3 | plan_coherence | target 이 스스로 발견한 `form.handler.ts` 의 `{ ...rawConfig }` spread 가 `node-output.md §7 D1`(명시 enumeration 의무화) 위반이라고 정확히 진단하고 "별건 백로그로 분리한다"고 서술했으나 실제로 분리(신규 추적 항목 생성)되지 않음 — sibling in-progress plan `node-output-redesign/form.md`(:154, 2026-06-25 갱신, D1 정책보다 후행)·`README.md`(:190,:328)는 정반대로 "form 은 D1 부합, 가장 충실한 raw echo 구현"이라 명시해 두 plan 문서가 같은 사실에 모순된 결론을 공표 중 | `plan/in-progress/presentation-thread-optout-drift.md` §비목표 두 번째 항목 | `plan/in-progress/node-output-redesign/form.md:138,154`, `plan/in-progress/node-output-redesign/README.md:190,192,328`, `spec/conventions/node-output.md §7 D1` | target 체크리스트에 "form.handler.ts D1 위반 별건 백로그 등록" 항목을 실제로 추가하거나, 최소 `node-output-redesign/form.md:154`·`README.md:190/328` 에 "D1 재검토 필요(형제 4개 handler 는 enumeration, form 만 spread — 2026-07-23 재발견)" 각주 추가 |
| 4 | naming_collision, cross_spec | target 이 유지 가능성 있는 §4.6 기존 문구 `UI 그룹: Advanced > Conversation`(계층형 표기, 코드 근거 없음)이 AI 카테고리 실제 GROUP 상수 `'Conversation Context'`(`conversation-context-schema.ts:27`, 평면 문자열, `conversation-thread.md:187` 도 SoT 로 동일 명시)와 다름 — target 이 "UI 노출은 Planned, 필요해지면 AI 노드처럼 공유 fragment 선언 추가"라 예고한 경로를 따르면 실제 구현 그룹명은 `Conversation Context` 가 될 것이므로 지금 라벨과 최종 어긋날 개연성 | 현재 `spec/4-nodes/6-presentation/0-common.md:162` | `codebase/backend/src/nodes/ai/shared/conversation-context-schema.ts:27`, `spec/conventions/conversation-thread.md:187` | §4.6 개정 시 `UI 그룹: Advanced > Conversation` 문구를 삭제하거나 "그룹명 미확정 — 구현 시 AI 카테고리 공유 GROUP 상수(`'Conversation Context'`) 재사용 여부 결정 필요"로 명시 조정. 계층형 `Group > Subgroup` 표기를 신규 컨벤션으로 굳힐 의도가 아니면 평면 라벨로 정정 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | cross_spec | frontmatter `status` 를 `implemented` 이외 값으로 내릴 경우 `spec/0-overview.md §6.1` presentation 카테고리 "구현 완료" 서술과 세부 불일치 발생 가능 | `spec/0-overview.md §6.1`, target 체크리스트 3번째 항목 | status 를 실제로 낮추기로 판단할 경우에만 `0-overview.md §6.1` presentation 행에 각주/참조 추가를 후속 확인 항목으로 남김 |
| 2 | convention_compliance | `spec/4-nodes/6-presentation/0-common.md` 는 `## 4. 출력 포맷` 아래 h3(`### 4.1`/`### 4.2`) 서브섹션 관례인데 `## 4.6`이 h2 로 끼어들어 목차 위계 어긋남(target 이 유발한 게 아니라 선재 구조 흠) | `spec/4-nodes/6-presentation/0-common.md`, target 체크리스트 2번째 항목 | 이 섹션을 다시 쓰는 김에 `### 4.6` 로 레벨 정정하거나 `## 5.`로 승격+이후 번호 조정을 plan 본문에 한 줄 추가(필수 아님) |
| 3 | plan_coherence | 선행 plan `presentation-previousoutput-spec-drift.md`(PR #997) 체크리스트 전량 완료(`[x]`)인데 여전히 `plan/in-progress/`에 남아 있음 | `plan/in-progress/presentation-previousoutput-spec-drift.md` | target 작업과 무관하게 `plan/complete/`로 이관하는 정리를 별도 turn 에서 수행 |
| 4 | naming_collision | frontmatter `code:` 후보 경로 중 `shared/conversation-thread/**`(기존 등재, 실제로는 types 파일만 존재)와 실제 게이트 구현 `modules/execution-engine/conversation-thread/conversation-thread.service.ts`가 말단 폴더명은 같지만 상위 경로가 달라 혼동 위험 | target 체크리스트 3번째 항목 | 항목 실행 시 전체 정확 경로 `codebase/backend/src/modules/execution-engine/conversation-thread/conversation-thread.service.ts`를 새 `code:` 줄로 명시 추가, 기존 `shared/conversation-thread/**` 항목과 구분 기재 |
| 5 | naming_collision | target 파일명 `presentation-thread-optout-drift.md`가 선행 plan `presentation-previousoutput-spec-drift.md`의 `-spec-drift` 접미사 패턴과 다름(`-spec-` 생략) | `plan/in-progress/presentation-thread-optout-drift.md` (파일명) | 강제 아님. 같은 영역 세 번째 drift 발생 시 "영역 일괄 정리" 전환 시점에 접미사 통일 고려 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | LOW | §2.4 대칭 편집이 target 본문에 구체 문구로 없음(WARNING) + UI 그룹명·status/0-overview 정합 확인 부재(INFO 2건) |
| rationale_continuity | LOW | §2.4 가 "필드 선언 SoT ↔ 실동작 범위" conflation 을 미해소로 남김 — target 자신이 경고한 "동일 영역 세 번째 재발" 씨앗(WARNING) |
| convention_compliance | LOW | frontmatter status/pending_plans 가드 충돌 리스크(WARNING) + §4.6 헤딩 레벨·§2.4 정합 확인(INFO 2건). CRITICAL 없음, plan frontmatter 스키마는 완전 충족 |
| plan_coherence | LOW | form.handler.ts D1 위반 "별건 분리" 미실행 + sibling plan 모순(WARNING) + 완료 plan 미이관(INFO). 선행 plan(#997) blocking 미해소는 없음 |
| naming_collision | LOW | 신규 식별자 도입 없음(순수 문서 정밀화). 유지되는 UI 그룹 라벨이 AI 실제 GROUP 상수와 불일치(WARNING) + code: 경로 혼동·파일명 접미사(INFO 2건) |

## 권장 조치사항
1. (WARNING 1) `conversation-thread.md §2.4` 개정 방향을 target `## Rationale`/체크리스트에 구체 문구로 pin: "게이트는 노드 무관 공통 적용 / 필드 선언 SoT 는 AI 3노드 한정, presentation 은 passthrough 로 수동 설정 시 동작"을 §2.4 끝에 추가.
2. (WARNING 2) frontmatter `status` 조정 체크리스트 항목에 "implemented 유지, pending_plans 신설 없음" 방향을 미리 명시해 `spec-impl-evidence.md §3` 가드 충돌을 예방.
3. (WARNING 3) `form.handler.ts` D1 위반을 실제 추적 항목(신규 백로그 또는 `node-output-redesign/form.md`/`README.md` 각주)으로 분리해 sibling plan 과의 모순을 해소.
4. (WARNING 4) §4.6 의 `UI 그룹: Advanced > Conversation` 라벨을 삭제하거나 "그룹명 미확정 — AI 공유 GROUP 상수 재사용 여부 결정 필요"로 조정.
5. (INFO, 선택) `0-overview.md §6.1` 참조 각주, `§4.6` 헤딩 레벨 정정, 완료 plan `plan/complete/` 이관, `code:` 정확 경로 보강, 파일명 접미사 통일은 §4.6 개정 실행 시 함께 반영 가능하나 필수는 아니다.

---
---

> **main Claude 정정 주석 (2026-07-23, `/ai-review` 20_05_09 WARNING 2)** — 위 **WARNING #1 행의
> Checker 열에서 `convention_compliance` 는 오귀속**이다. 그 checker 는 §2.4 주제를 `[INFO]` 로만
>평가했고 유일한 `[WARNING]` 은 다른 주제(frontmatter status 가드)였다. 같은 파일의
> "Checker별 위험도" 표와 서로 모순된다. **정확한 제기자는 `cross_spec` · `rationale_continuity` 2인.**
>
> 원문 표는 **고쳐 쓰지 않는다**(감사 무결성 — 산출물은 생성 시점 그대로 보존). 본 주석이 정정
> 기록이며, 이 SUMMARY 를 재집계에 소비할 때는 WARNING #1 의 checker 귀속을 위 2인으로 읽을 것.
> 처리 방향 자체에는 영향이 없다 — `presentation-thread-optout-drift.md` 는 WARNING 번호와 pin
> 내용만 재인용했고 checker 귀속은 재인용하지 않았다.
