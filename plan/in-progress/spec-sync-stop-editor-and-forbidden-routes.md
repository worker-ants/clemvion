---
title: spec 동기화 후속 — /executions/:id/stop 의 Editor+ 반영 · 잔여 61 라우트 403 문서화
worktree: stop-editor-403-docs
started: 2026-08-08
owner: project-planner
status: in-progress
priority: P3
spec_impact:
  - spec/3-workflow-editor/3-execution.md
  - spec/conventions/node-cancellation.md
  - spec/conventions/swagger.md
---

## Overview

[`auth-workspace-membership-guard`](../complete/auth-workspace-membership-guard.md) (P0 cross-tenant fix)의
`--impl-done`(`review/consistency/2026/08/08/22_43_48`, **BLOCK: NO**) WARNING 1건 + INFO 2건을
분리 등재한다. 셋 다 **문서 동기화**이고 `spec/` 쓰기라 planner 트랙이다.

미룬 이유: 그 PR 은 이미 게이트를 4회(`--impl-prep` ×2 · `--spec` ×2 · `--impl-done` ×2 ·
`/ai-review` ×2) 돌았고, spec 을 한 줄이라도 더 건드리면 방금 통과한 `--impl-done` 이 다시
stale 이 돼 사이클이 한 번 더 열린다. 그 대가가 P0 보안 fix 의 착지 지연이라 분리했다.

## 1. `/executions/:id/stop` 의 Editor+ 가 에디터 문서에 미반영 (W1)

P0 PR 이 `executions.controller.ts` `stop` 에 `@Roles('editor')` 를 부착하고 FE
`editor-toolbar.tsx` 에 `canEdit` 가드를 넣었다(viewer 는 Stop 버튼 미노출). 근거는
`1-auth.md §3.2` 의 `Workflow 실행 | Owner ✅ | Admin ✅ | Editor ✅ | Viewer —` 다.

그런데 **워크플로우 에디터 쪽 문서 3곳이 이를 반영하지 않는다**:

- [x] `spec/3-workflow-editor/3-execution.md` §9 API 표 — `/stop` 행에 `Editor+` 부기(인접 행 형태와 동일)
- [x] `spec/3-workflow-editor/3-execution.md` §4 "실행 중단(Stop)" — 표에 `권한` 행 신설
- [x] `spec/conventions/node-cancellation.md` §2.3 — "Editor+ 전용(viewer 미노출, FE `canEdit` 가드)" + 근거 링크

> **신규 결정이 아니다** — §3.2 가 이미 확정한 권한을 파생 문서에 반영하는 것뿐이다.
> 따라서 `--spec` 에서 Rationale 신설은 불요하고 표기 동기화로 족하다.

## 2. 잔여 ~61개 라우트의 `@ApiForbiddenResponse` (INFO 4)

P0 PR 은 **자기가 건드린 5개 컨트롤러의 12곳**에만 부착했다. 저장소 전체로는
`@WorkspaceId()` 를 소비하며 `@Roles()` 가 없는 라우트가 73건이라 **~61건이 남는다**
(`workflows.controller.ts`·`integrations.controller.ts` 등).

종전엔 이 항목이 두 plan 의 **산문 권고**로만 있었다 — checker 가 "review/ 에만 있다가
유실되는 패턴" 을 지적해 여기 체크리스트로 승격한다.

- [x] 전수 스캔으로 대상 확정 — **51건 / 16파일**(plan 의 "~61" 은 추정치였다, 아래 실측 참조)
- [x] 코드모드로 일괄 부착 — **+57 / -0**(데코레이터 51 + import 6). 재스캔 결과 잔여 **0건**
- [x] 설명 문자열 `'워크스페이스 멤버가 아님'` 통일 (§5-4)

## 3. `swagger.md` 교차링크 앵커 (INFO 3)

- [x] `spec/conventions/swagger.md` 의 `12-workspace.md` 인용 **2곳** 에 앵커 프래그먼트 추가.
      **앵커 실재는 뮤테이션으로 검증** — 가짜 앵커를 넣으면 `spec-link-integrity` 가 RED 가
      되는 것을 확인했다(GREEN 만 보고 "검증됐다" 고 하지 않는다)

## 체크리스트

- [x] 위 §1·§2·§3 처리
- [ ] `/consistency-check --spec` (spec 본문 편집이므로 의무)

## Rationale

**왜 P3 인가.** 셋 다 **동작 영향 0** 이다. 권한 자체는 코드·`§3.2`·FE 가드로 이미 강제되고
있고, 여기서 고치는 것은 **파생 문서가 그 사실을 말하지 않는다**는 표기 갭이다. 다만 §1 은
방치하면 에디터 문서만 읽은 사람이 "viewer 도 중단할 수 있다" 로 오독하므로 won't-do 는 아니다.

**§2 의 트리거**: `swagger.md §5-4` 가 P0 PR 에서 확장됐으므로, 이제 규약을 그대로 따르는
신규 라우트는 올바르게 부착된다. 잔여 61건은 **소급 정리**라 급하지 않다.

## 실측 (2026-08-11 착수)

### §2 대상은 51건이다 — "~61" 은 추정치였다

plan 은 "`@WorkspaceId()` 소비 && `@Roles()` 부재가 73건이라 ~61건이 남는다" 로 적었다.
**데코레이터 블록 파서**로 전수를 세니 수치가 다르다:

| 지표 | 값 |
| --- | --- |
| 전체 라우트 | 222 |
| `@WorkspaceId()` 소비 | 141 |
| ├ `@Roles()` 있음 | 75 |
| ├ `@ApiForbiddenResponse` 있음 | 79 |
| ├ 둘 다 있음 | 64 |
| └ **대상(둘 다 없음)** | **51** |

내부 정합 확인: `141 = 75 + 79 − 64 + 51`. 스캐너는 `alerts.controller.ts`(4라우트 중 3건이
`@Roles('admin')`+`@ApiForbiddenResponse`, 1건만 대상)로 육안 대조해 검증했고, 클래스 레벨
`@ApiForbiddenResponse` 가 0건임도 확인했다(있으면 과다 계수했을 것).

### 배치 규약은 선례에서 읽었다

P0 PR 의 `nodes.controller.ts` 가 `@ApiUnauthorizedResponse`(401) → `@ApiForbiddenResponse`(403)
→ `@ApiNotFoundResponse`(404) **status 오름차순**으로 배치했다. 그대로 따랐다:

| 배치 | 건수 |
| --- | --- |
| 401 직후 | 47 |
| (401 없음) 404 직전 | 1 |
| (둘 다 없음) 시그니처 직전 | **3** |

**3번 3건은 조용히 넘기지 않는다** — `workflow-assistant.controller.ts` 의 세 라우트는
`@ApiUnauthorizedResponse` 자체가 없어 403 이 마지막 데코레이터가 됐다. status 순서상 정합이나,
**401 문서화 누락은 별개 갭**이다(§5-4 는 401 도 요구한다). 이 티켓 범위 밖이라 아래 후속에 등재.

### drive-by 를 한 번 만들었다가 되돌렸다

첫 codemod 는 `@nestjs/swagger` import 를 보강하면서 **기존 이름들을 알파벳 재정렬**했다 —
`background-runs.controller.ts` 한 파일에서만 `+8/-3` 이 나왔다. 티켓이 요청하지 않은 변경이고
리뷰 diff 를 부풀려 진짜 변경을 가린다. 폐기하고 **append-only** 로 다시 짰다 → 최종 **+57/-0**.

> 이 저장소는 `eslint --fix` drive-by 주입으로 이미 지적받은 이력이 있다. codemod 도 같은
> 표면이다 — **"고치는 김에" 가 diff 에 섞이면 리뷰어가 그것부터 본다.**

### 검증

- 재스캔 **잔여 0건**, 변경 16파일 lint **0건**, 변경 컨트롤러 타입 오류 **0건**.
- 문서 가드 **2890 passed**. 신규 앵커는 **뮤테이션으로 검증** — 가짜 앵커 주입 시
  `spec-link-integrity` 가 RED 가 됨을 확인하고 `cp` 로 원복했다.
- 참고: `origin/main` 자체의 backend tsc/lint 오류(309줄)는 **선재**이며
  [`backend-lint-gate-broken-on-main`](./backend-lint-gate-broken-on-main.md) 에서 별도 추적한다.
  변경 파일에는 0건이다.

## 후속 (이 티켓 범위 밖, 등재만)

- [ ] `workflow-assistant.controller.ts` 3라우트에 `@ApiUnauthorizedResponse` 부재 —
      `swagger.md §5-4` 는 401 도 요구한다. §2 codemod 중 발견(403 배치 3번 폴백 사유).
      이 티켓은 403 만 다루므로 분리한다.
