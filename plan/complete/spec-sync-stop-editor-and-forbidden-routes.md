---
title: spec 동기화 후속 — /executions/:id/stop 의 Editor+ 반영 · 잔여 61 라우트 403 문서화
worktree: stop-editor-403-docs
started: 2026-08-08
owner: project-planner
status: complete
priority: P3
spec_impact:
  - spec/3-workflow-editor/3-execution.md
  - spec/conventions/node-cancellation.md
  - spec/conventions/swagger.md
---

## Overview

[`auth-workspace-membership-guard`](./auth-workspace-membership-guard.md) (P0 cross-tenant fix)의
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

- [x] 전수 스캔으로 대상 확정 — 티켓 술어(`@Roles()` 부재)로 **51건**, **규약 §5-4 술어**
      (`@Roles()` 있거나 `@WorkspaceId()` 소비)로는 **64건**. 아래 "술어가 규약보다 좁았다" 참조
- [x] 코드모드로 일괄 부착 — 1차 **+57/-0**(51 + import 6), 2차 **+13/-0**(잔여). §5-4 술어
      기준 재스캔 **잔여 0건**
- [x] 설명 문자열 `'워크스페이스 멤버가 아님'` 통일 (§5-4)

## 3. `swagger.md` 교차링크 앵커 (INFO 3)

- [x] `spec/conventions/swagger.md` 의 `12-workspace.md` 인용 **2곳** 에 앵커 프래그먼트 추가.
      **각각을 격리해 뮤테이션 검증** — 아래 "내 뮤테이션 주장이 절반만 참이었다" 참조

## 체크리스트

- [x] 위 §1·§2·§3 처리
- [x] `/consistency-check --spec` → **`--impl-done` 으로 갈음** (2026-08-29 종결)
      > **사전 게이트를 사후에 돌릴 대상이 없다.** 이 항목의 spec 편집은 `#1150`(c3f15ab1a)로
      > 이미 머지됐고, `--spec` 은 **쓰기 직전** 게이트라 지금 돌려도 검토할 draft 가 없다.
      >
      > 대신 같은 작업에 **`--impl-done` 두 라운드**가 동봉돼 있고 둘 다 통과했다
      > (2026-08-29 `meta.json`·`SUMMARY.md` 직접 확인):
      >
      > | 세션 | mode | 판정 |
      > |---|---|---|
      > | `review/consistency/2026/08/11/17_21_43` | `--impl-done, scope=spec/conventions` | — |
      > | `review/consistency/2026/08/11/17_42_52` | `--impl-done, scope=spec/conventions` | **BLOCK: NO** (checker 5/5 전원) |
      >
      > `17_42_52` 의 `cross_spec` 이 `spec_impact` 3파일(3-execution·node-cancellation·
      > swagger)을 실제로 훑었다. 사후 그물이 훑었으므로 이 줄을 열어 둘 이유가 없다.

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
**401 문서화 누락은 별개 갭**이다(**§2-4** 가 401 을 요구한다 — 첫 판에 §5-4 라 적었다).
이 티켓 범위 밖이라 아래 후속에 등재.

### drive-by 를 한 번 만들었다가 되돌렸다

첫 codemod 는 `@nestjs/swagger` import 를 보강하면서 **기존 이름들을 알파벳 재정렬**했다 —
`background-runs.controller.ts` 한 파일에서만 `+8/-3` 이 나왔다. 티켓이 요청하지 않은 변경이고
리뷰 diff 를 부풀려 진짜 변경을 가린다. 폐기하고 **append-only** 로 다시 짰다 → 최종 **+57/-0**.

> 이 저장소는 `eslint --fix` drive-by 주입으로 이미 지적받은 이력이 있다. codemod 도 같은
> 표면이다 — **"고치는 김에" 가 diff 에 섞이면 리뷰어가 그것부터 본다.**

### 검증

- 재스캔 **잔여 0건**, 변경 16파일 lint **0건**, 변경 컨트롤러 타입 오류 **0건**.
- 문서 가드 **2890 passed**. 신규 앵커는 뮤테이션으로 검증했다 — **다만 이 시점의 검증은
  불완전했다**(두 앵커를 동시에 바꿨다). 아래 "내 뮤테이션 주장이 절반만 참이었다" 가 정본이다.
- 참고: `origin/main` 자체의 backend tsc/lint 오류(309줄)는 **선재**이며
  [`backend-lint-gate-broken-on-main`](../in-progress/backend-lint-gate-broken-on-main.md) 에서 별도 추적한다.
  변경 파일에는 0건이다.

## 리뷰 라운드가 잡은 것 (`17_21_33` 코드 6 + `17_21_43` consistency 5)

### 술어가 규약보다 좁았다 — 잔여 13건을 함께 닫았다

티켓 §2 는 대상 술어를 **"`@Roles()` 부재"** 로 적었다. 그런데 `swagger.md §5-4` 원문은
**"`@Roles(...)` 가 붙었거나 `@WorkspaceId()` 를 소비하는 엔드포인트"** 다 — 티켓이 규약보다
좁았고, 그래서 `@Roles()` 는 있는데 `@ApiForbiddenResponse` 가 **아예 없는** 라우트가 남았다.

세 리뷰어가 각각 **6건 / 3건 / 12건**으로 다르게 셌다. 직접 세니 **13건**이다:

| 파일 | 건수 | 역할 |
| --- | --- | --- |
| `workflow-assistant.controller.ts` | 4 | editor |
| `workflow-test-datasets.controller.ts` | 3 | editor |
| `agent-memory.controller.ts` | 2 | viewer |
| `executions.controller.ts` (테스트 훅 2종) | 2 | owner |
| `knowledge-base.controller.ts` (`uploadDocument`) | 1 | editor |
| `workflows.controller.ts` (`graphWarnings`) | 1 | viewer |

설명 문자열은 §5-4 대로 역할에서 파생했다(`'<role> 이상 권한 필요'` — 기존 관례
`'editor 이상 권한 필요'` 46건·`'viewer 이상 권한 필요'` 1건과 동형). **§5-4 술어 기준 잔여 0건.**

> **"잔여 0건" 이 술어에 의존한다.** 1차 검증 때 나는 티켓의 좁은 술어로 세고 "0건" 이라 썼다 —
> 참이지만 **규약 기준으로는 거짓**이었다. 수치를 쓸 땐 **어떤 술어로 셌는지**를 함께 적어야 한다.

### codemod 파서가 데코레이터 인자 안쪽에 삽입했다

2차 codemod 첫 판이 `@UseInterceptors(\n  FileInterceptor('file', {` 의 `FileInterceptor(` 를
**메서드 시그니처로 오인**해 데코레이터 인자 안에 데코레이터를 끼워 넣었다 — 문법이 깨진다.
diff 를 눈으로 보다 발견했다. 시그니처 탐색을 **괄호 깊이 0에서만** 인정하도록 고쳤다.

> 1차 codemod(51건)는 이 버그가 없었다 — `tsc` 가 통과했고 컨트롤러 오류 0이었다. 즉 **타입
> 체크가 이 클래스를 잡는다.** 그럼에도 diff 를 읽은 것이 더 빨랐다.

### 내 뮤테이션 주장이 절반만 참이었다

나는 "가짜 앵커를 주입하니 `spec-link-integrity` 가 RED 가 됐다" 고 적었다. `testing` 리뷰어가
반증했고 나도 재현했다 — **두 앵커를 동시에 바꿔 놓고 RED 하나를 보고 둘 다 검증됐다고 결론**했다.

실제로는 `swagger.md:350` 이 **멀티라인 마크다운 링크**(`[` 와 `](` 가 다른 줄)라
`extractLinks()` 의 **한 줄 단위 정규식**이 원천적으로 못 잡는다. 격리 실측:

| 뮤테이션 | 결과 |
| --- | --- |
| 350 단독(멀티라인 상태) | **GREEN — 생존** |
| 350 단독(한 줄로 편 뒤) | **RED** |
| 398 단독 | **RED** |

링크를 한 줄로 펴서 **두 앵커 모두 독립으로 RED** 임을 확인했다. 이제 주장이 참이다.

> **동시 뮤테이션은 자매 중 하나만 잡혀도 통과한다.** 이 저장소가 이미 등재한 "자매를 각각
> 뮤테이트하라" 의 재발이고, 이번엔 **내가 그 검증을 근거로 삼았다**는 점이 더 나쁘다.

### 그 밖에 처분한 것

- `llm-model-config.controller.ts:118` 주석이 **"역할 제한이 없어 `@ApiForbiddenResponse` 도
  두지 않는다"** 고 적혀 있었다 — 이번 부착과 정면 모순. §5-4 확장(2026-08-08)으로 전제가
  깨진 것을 주석만 옛 정책으로 남긴 것이라 정정했다(`api_contract` INFO).
- §4 표의 `**Editor+**` bold → 선례(`13-replay-rerun.md`)대로 plain(`convention` INFO).
- `1-auth §3.2` 를 따옴표로 감싼 **비-verbatim 인용** → 표 참조 서술로 정정(`cross_spec` INFO).
  grep 으로 재검증하려는 사람이 "인용이 틀렸다" 고 오판할 소지를 없앴다.

## 후속 (이 티켓 범위 밖, 등재만)

- **`spec-link-integrity` 멀티라인 링크 사각지대** — 여기서 발견했으나 **하니스 결함**이라
      [`harness-review-gate-followups.md`](../in-progress/harness-review-gate-followups.md) 로 이관했다
      (`plan_coherence` WARNING: 이 P3 spec-doc 티켓이 `complete/` 로 가면 docs-guard
      작업자가 못 찾는다). 이 줄은 포인터다.
- [x] `workflow-assistant.controller.ts` **전 라우트(7개)** 에 `@ApiUnauthorizedResponse` 부재 —
      **완료 (2026-08-31).** 7개 전부에 규약 §2-4 의 정본 문구
      (`description: '인증 실패 또는 토큰 만료'`, 저장소 156회 사용)를 부착했다. 배치는 형제
      컨트롤러 관례대로 `@ApiForbiddenResponse` **바로 앞**이다(`triggers.controller.ts` 대조).
      - **회귀를 잠갔다** — `workflow-assistant.controller.swagger.spec.ts`. 규약을 지키는
        컨트롤러가 40개가 넘는데 이 하나만 0건이었다는 것은 **이 축을 보는 게이트가 없다**는
        뜻이라, 고쳐만 두면 다음 라우트가 같은 방식으로 다시 빠진다.
      - **뮤테이션 실측 (예측 / 실측)**: 데코레이터 1개 제거 → RED / **RED**(`missing` 배열이
        그 라우트를 지목) · 문구를 `'인증 실패'` 로 교체(7개 전부) → RED / **RED**. 원복 GREEN.
        두 축(존재·문구)이 각각 물린다.
      - **공허 방지**: `[전제]` 케이스가 라우트 수를 **7 로 고정**한다. 프로브가 컨트롤러를
        못 세우거나 라우트가 사라지면 본 단언이 0회 실행되고 조용히 통과하기 때문이다.
      - **저장소 전수 가드는 만들지 않았다** — 401 이 0건인 나머지 세 컨트롤러
        (health·invitations·third-party-oauth)는 전 라우트가 `@Public` 이라 정당한 예외이고,
        그 판정 규칙을 세우는 것은 이 티켓의 범위가 아니다.
      > **범위가 3 → 7 로 늘었다 (2026-08-29 재실측).** 그 파일의
      > `@ApiUnauthorizedResponse` 는 **0건**이고 라우트는 **7개**다 — 즉 일부가 아니라
      > **컨트롤러 전량**이 미문서화다. 원래 적힌 "3" 은 §실측표의 *"시그니처 직전 3"*
      > 이라는 **배치 위치 수치**를 라우트 수로 잘못 옮긴 것이다.
      >
      > **이 컨트롤러가 유일한 갭인 이유**: `grep -rL 'ApiUnauthorizedResponse'` 로 401 이
      > 0건인 컨트롤러는 health·invitations·third-party-oauth·workflow-assistant 넷인데,
      > 앞 셋은 전 라우트가 `@Public` 이라 401 을 문서화할 대상이 아니다.
      `swagger.md` **§2-4**(상태 코드 응답 규칙)가 401 을 요구한다. 이 티켓은 403 만 다룬다.
      (첫 판에 §5-4 라 적었으나 401 요구는 §2-4 소관 — `plan_coherence` 정정.)
