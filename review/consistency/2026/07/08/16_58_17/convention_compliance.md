# 정식 규약 준수 검토 결과

검토 모드: --impl-prep (scope=`spec/2-navigation/`, 워크스페이스 슬러그 라우팅 구현 착수 전)

## 사전 안내 — 검토 범위 보정

전달받은 payload 의 "target 문서"는 `spec/2-navigation/{0-dashboard,1-workflow-list,10-auth-flow,11-error-empty-states,13-user-guide,14-execution-history,15-system-status,16-agent-memory}.md` 8개였고, 함께 첨부된 "정식 규약 모음"은 `spec/conventions/audit-actions.md` + `spec/conventions/cafe24-api-catalog/**` 였다. 그러나 `plan/in-progress/workspace-slug-routing.md` 의 체크리스트 0번이 명시한 실제 검토 대상은 `9-user-profile·12-workspace·10-auth-flow` 다 — 이 중 **`9-user-profile.md`(워크스페이스 전환·슬러그 §3/§4 의 실제 SoT)가 payload 에서 누락**되었고, 첨부된 conventions 두 건은 스코프 문서 어디에도 등장하지 않는 무관 규약(`audit-actions`/`cafe24-*`)이었다. 실제로 이 스코프에 적용되는 규약은 `error-codes.md`/`swagger.md`/`spec-impl-evidence.md`/`i18n-userguide.md`/`user-guide-evidence.md` 인데 payload 에는 포함되지 않았다.

→ 아래 분석은 payload 에 갇히지 않고 레포 파일시스템의 실제 `spec/2-navigation/9-user-profile.md` + 실제 `spec/conventions/**`(위 5개 포함)를 직접 읽어 보강했다. 다만 이 payload 구성 자체가 재발 패턴(과거 "impl-prep 대형 spec 영역 payload 오배선")과 일치하므로 별도 발견사항으로 기록한다.

---

## 발견사항

- **[WARNING]** impl-prep payload 스코프가 plan 이 지정한 실제 대상과 불일치
  - target 위치: 본 checker 에 전달된 prompt 전체 (target 파일 목록 + "정식 규약 모음" 절)
  - 위반 규약: 직접적인 `spec/conventions/*` 조항 위반은 아니나, `.claude/docs/subagent-call-contract.md` 가 전제하는 "prompt_file 이 점검 관점 + 분석 대상을 정확히 결합" 원칙 및 CLAUDE.md 의 "project-planner 는 spec/ 쓰기 직전 consistency-check 의무" 취지(대상이 정확해야 의무가 성립)에서 벗어남
  - 상세: `plan/in-progress/workspace-slug-routing.md` 체크리스트 0번은 "9-user-profile·12-workspace·10-auth-flow" 를 --impl-prep 대상으로 명시했다. 그러나 실제 payload 는 `9-user-profile.md`(슬러그 전환 §3, 워크스페이스 관리 §4 의 SoT)를 빼고 슬러그 라우팅과 무관한 `0-dashboard/1-workflow-list/11-error-empty-states/13-user-guide/14-execution-history/15-system-status/16-agent-memory` 를 포함시켰다. 또한 "12-workspace" 는 현재 `spec/2-navigation/` 에 실존하지 않는 파일명이다(워크스페이스 관리 내용은 `9-user-profile.md §3/§4` 에 있음 — plan 표기 자체가 부정확하거나 향후 분리 예정 파일을 가리키는 것으로 보임). 첨부된 "정식 규약 모음"(`audit-actions.md`, `cafe24-api-catalog/**`)도 대상 문서 어디에서도 참조되지 않는 무관 규약이며(grep 결과 0건), 실제로 이 스코프가 따라야 할 `error-codes.md`/`swagger.md`/`spec-impl-evidence.md`/`i18n-userguide.md`/`user-guide-evidence.md` 는 빠져 있었다. 이 결과 이 checker 가 payload 만으로 작업했다면 정작 슬러그 라우팅이 손댈 영역(9-user-profile.md)의 규약 위반을 전혀 검출하지 못한 채 "이상 없음"을 보고했을 것이다.
  - 제안: (a) 직접 `9-user-profile.md` + 관련 conventions 5종을 추가로 읽어 보강 분석함(본 문서 하단에 결과 반영, 실질적 CRITICAL 발견은 없었음). (b) orchestrator 스크립트가 `plan/in-progress/<name>.md` 의 체크리스트에 명시된 파일 목록과 실제 prompt 조립 로직이 어긋나지 않도록 향후 payload 생성 단계에 대상 파일 목록 diff 검증을 추가할 것을 권장(개발자 메모리에 기록된 재발 패턴).

- **[WARNING]** `0-dashboard.md` / `11-error-empty-states.md` — Overview 섹션 부재 (3섹션 구성 컨벤션 이탈)
  - target 위치: `spec/2-navigation/0-dashboard.md` 문서 서두(관련 문서 라인 + "## 1. 개요" 진입) · `spec/2-navigation/11-error-empty-states.md` 문서 서두
  - 위반 규약: CLAUDE.md "정보 저장 위치" 표 + `.claude/skills/project-planner/SKILL.md` §문서 구조 — "각 spec 문서는 3섹션(Overview/본문/Rationale). 다중 spec 파일을 가진 영역은 `_product-overview.md` 별도 파일"
  - 상세: 같은 폴더의 `1-workflow-list.md`(`_product-overview.md#31-workflow-list-...`)·`13-user-guide.md`(§3.11)·`15-system-status.md`(`_product-overview.md#39-system-status-...`, 앵커까지 정확히 연결)·`16-agent-memory.md`(§3.13)는 모두 `_product-overview.md §3` 에 자신의 PRD 요구사항 서브섹션을 갖고 그 앵커로 연결한다. `14-execution-history.md`는 대신 자체 `## Overview (제품 정의)` + 배경/목표/요구사항(EH-LIST/EH-DETAIL/EH-NAV ID 표)을 문서 안에 완비했다. 반면 `0-dashboard.md`는 "관련 문서"에 `[PRD 내비게이션](./_product-overview.md)`를 앵커 없이 걸어두었으나 실제로 `_product-overview.md §3`에는 Dashboard 서브섹션이 없다(§3.1~§3.14 나열에 Dashboard 항목 없음, `_product-overview.md` §2 내비게이션 구조 다이어그램에만 이름이 등장) — 그리고 파일 자체에도 `## Overview` 격 섹션 없이 바로 "## 1. 개요"(1문단)로 들어간다. `11-error-empty-states.md`는 아예 `_product-overview.md` 를 참조하지 않고(`_layout.md`·`../0-overview.md`·`../5-system/3-error-handling.md`만 링크), 자체 Overview 섹션도 없다. 두 파일 모두 "Overview" 다리가 어느 쪽으로도 충족되지 않는다.
  - 제안: 두 파일 중 하나의 방식으로 통일 — (a) `_product-overview.md §3`에 Dashboard/Error-Empty-States 서브섹션을 신설하고 두 파일 헤더 링크를 해당 앵커로 갱신하거나, (b) `14-execution-history.md`처럼 자체 `## Overview (제품 정의)` 절을 추가한다. 다만 이 두 영역(대시보드 요약 카드, 에러/빈 상태 UI 컨벤션)은 "메뉴 진입점"이라기보다 횡단 UI 관행/집계 화면 성격이라 의도적으로 PRD 요구사항 목록에서 제외됐을 가능성도 있다 — project-planner 가 의도 여부를 확인 후 정규화하거나, 의도된 것이면 SKILL.md 에 "횡단 UI 문서는 Overview 생략 허용" 예외를 명시해 문서화할 것을 권장.

- **[INFO]** `0-dashboard.md` 의 PRD 링크가 앵커 없이 걸려 있어 대상 서브섹션 부재를 감지하기 어려움
  - target 위치: `spec/2-navigation/0-dashboard.md:39` (관련 문서 라인, `[PRD 내비게이션](./_product-overview.md)`)
  - 위반 규약: 명시적 규약 위반은 아니며 위 WARNING 항목의 부수 증상. 다만 같은 폴더 `15-system-status.md`가 `#39-system-status-시스템-상태` 앵커로 정확히 링크하는 것과 대조된다.
  - 상세: 앵커가 없으면 링크가 "존재하되 실질적으로 가리키는 서브섹션이 없는" 상태를 셀프체크하기 어렵다(`spec-link-integrity.test.ts`는 파일 실존만 검증, 앵커 없는 링크는 통과).
  - 제안: 위 WARNING 해결과 함께 앵커를 추가하거나(§신설 시), 의도적으로 서브섹션이 없다면 "전역 PRD 문서" 링크로만 남겨두되 굳이 문제 삼을 필요는 없음 — 참고용 INFO.

---

## 정상 확인된 항목 (참고 — 발견사항 아님)

검토 중 명시적으로 대조한 항목은 규약을 잘 지키고 있어 별도 조치가 불필요했다:

- `error-codes.md` §3 historical-artifact 레지스트리: `10-auth-flow.md` 의 `invitation_email_mismatch`/`invitation_expired`/`invitation_already_used`, OAuth `?error=invalid_state` 등 lower_snake_case 코드가 정확히 등재된 예외와 일치하고, 문서 스스로 §3 앵커를 인용해 근거를 밝힘 (`10-auth-flow.md` §5.4 하단 각주).
- `1-workflow-list.md` §3.1 폴더 관리 API 의 `400 VALIDATION_ERROR`/`409 RESOURCE_CONFLICT` 는 `api-convention.md §5.3` 기본값 표와 정확히 일치. `DUPLICATE_NODE_LABEL`/`CONTAINER_CYCLE`/`CYCLE_DETECTED` 도 `error-codes.md §1` 의 의미기반 명명 원칙(및 이름 충돌 회피)에 부합.
- `13-user-guide.md` §8 `<ImplAnchor>` 표는 `spec/conventions/user-guide-evidence.md` 의 kind enum(4값)·prop 정의·가드 3종을 정확히 재인용.
- `16-agent-memory.md` 의 `id: nav-agent-memory` 는 `spec-impl-evidence.md §2.1` 이 명시한 basename 충돌 회피 예시(`spec/5-system/17-agent-memory.md` 가 `agent-memory` 선점)와 문자 그대로 일치.
- `9-user-profile.md`(보강 확인) §6.1 의 `POST /api/users/me/sessions/:familyId/revoke`(DELETE 대신 POST+`/revoke`), 세션 목록 `{ data: { items } }` 비-페이징 고정 컬렉션 표기 모두 `api-convention.md §2.2`(RPC-style sub-channel 예외)·§5.2(비-페이징 컬렉션)와 정확히 일치.
- 대상 8개 파일 frontmatter `code:` 경로를 표본 점검(대시보드/워크플로우/에디터/문서/실행내역/시스템상태/에이전트메모리 등 17개 경로 + 6개 glob 디렉터리) — 전부 실제 파일/디렉터리 존재 확인, `spec-code-paths.test.ts` 관점 drift 없음.
- 워크스페이스 슬러그 포맷: `10-auth-flow.md §6.2`(개인 워크스페이스 자동생성, `{email-local}-{random4}`)와 plan 이 인용한 `data-flow/12-workspace.md`(팀 워크스페이스 `team-<uuid8>`)는 서로 다른 생성 경로(개인 vs 팀)를 기술하는 것으로 확인 — 명명 규약 충돌 아님(교차-spec 불일치 오탐 배제).

---

## 요약

전달받은 payload 는 대상 파일 목록과 참조 규약 모음이 실제 plan(`workspace-slug-routing.md`)이 지정한 검토 범위와 어긋나 있어(9-user-profile.md 누락, 무관 conventions 포함) 신뢰도가 낮았다. 이를 직접 보강해 실제 `spec/2-navigation/` 대상 파일 + 관련 정식 규약(error-codes/swagger/spec-impl-evidence/i18n-userguide/user-guide-evidence)을 대조한 결과, CRITICAL 급 위반은 발견되지 않았다 — 에러 코드 명명·API 응답 포맷·frontmatter lifecycle·ImplAnchor 사용 모두 SoT 를 정확히 인용하며 준수하고 있었다. 유일한 실질 이슈는 `0-dashboard.md`·`11-error-empty-states.md` 두 파일이 3섹션(Overview/본문/Rationale) 컨벤션 중 Overview 다리를 어느 형태로도 채우지 않는 구조적 이탈이며, 이는 의도적 설계(횡단 UI 문서)일 수도 있어 WARNING 으로 등급을 두었다. payload 스코프 불일치 자체도 향후 동일 패턴 재발을 막기 위해 WARNING 으로 별도 기록했다.

## 위험도

LOW
