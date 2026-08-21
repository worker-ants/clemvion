# RESOLUTION — 01_38_26

대상 SUMMARY: `review/code/2026/08/21/01_38_26/SUMMARY.md` (위험도 **LOW**, Critical **0**, WARNING 3, INFO 13)

**처분: 신규 WARNING 1건 수정 · 2건은 조치 불요(선존/이미 정규화).**

---

## WARNING 1 — 불변식이 JSDoc 으로만 강제된다 (architecture) — **가드로 닫음**

`resolveTriggerParameters`(base)와 `resolveTriggerParametersRejectingMasked`(wrapper)가 같은
`utils/` 에 유사한 이름으로 나란히 있다. *"어느 호출부가 어느 쪽을 써야 하는가"* 는 지금
**주석으로만** 강제된다 — 세 번째 Manual 경로가 base 를 import 하면 마커 재제출이 조용히
통과한다.

> **주석은 규칙을 강제하지 못한다.** 이 시리즈에서 자매 발산이 네 번 나왔고, 재발이 멎은
> 지점은 늘 **행위 규칙이 아니라 산출물**이었다.

리뷰어는 ESLint `no-restricted-imports` 를 제안했는데, 이 저장소에 그 선례가 없다(grep 0건).
대신 **repo-guard 테스트** 패턴이 이미 양쪽 스택에 있다(`eslint-unicorn-peer` ·
`typescript-toolchain`) — 파서(순수 로직) + 소비 spec 분리 규약까지 그대로 따랐다.

### 만드는 과정에서 가드가 자기 결함을 세 번 드러냈다

| 단계 | 무엇이 틀렸나 | 어떻게 드러났나 |
|---|---|---|
| 초판 | **언급**까지 매칭 — 9곳 중 5곳이 주석·swagger description 이었다(`{@link ...}` 등) | 실행 결과 목록을 읽고 실측 |
| 2판 | 한 줄 import 만 매칭 — 이 저장소는 named 가 여럿이면 prettier 가 **줄바꿈**한다 | **"죽은 허용목록 항목" 캐너리**가 잡았다 |
| 3판 | `expect(...).toBe(true)` 가 **어느 파일이 죽었는지 숨겼다** | 진단 불가 → 배열 비교로 바꿔 이름이 드러나게 |

> 허용목록을 **손으로 짐작하지 않고 가드를 실행해 받았다.** 셸 `grep` 으로 재현해 보니 접두
> 겹침(`...RejectingMasked`)에 걸려 다른 답이 나왔다 — 정본 구현이 있으면 재현하지 말고
> 실행해야 한다.

**재검증(뮤테이션)**: `executions.service.ts`(Manual 경로)에 base import 를 넣으면 가드가
**그 파일을 지목하며 RED**. 캐너리 둘도 각각 다른 결함을 겨눈다 — 죽은 허용목록 항목 ·
접두 겹침 오탐(wrapper 만 쓰는 파일을 base 사용으로 오인하면 올바른 코드가 RED 를 내
가드 자체가 무시된다).

- `codebase/backend/src/repo-guards/__tests__/masked-reject-callers-guard.ts` (신규)
- `codebase/backend/src/repo-guards/__tests__/masked-reject-callers.spec.ts` (신규)

## WARNING 2 — 절차 위반 (scope) — **조치 불요, 이미 정규화**

리뷰어가 *"작업자 스스로 `git log -S` 로 발견해 planner 턴으로 사후 정규화 완료"* 라고
확인했다. `plan/complete/spec-update-masked-reject-framing.md` 가 그 경로다.

## WARNING 3 — 최상위 `error.code` drift (api_contract) — **조치 불요, 선존 + 범위 밖**

re-run 은 `INVALID_INPUT`, execute 는 `INVALID_TRIGGER_PARAMETERS` 로 최상위 코드가 다르다.
`details[].code` 는 이 PR 이 `MASKED_VALUE_RESUBMITTED` 로 완전히 수렴시켰고, 최상위 drift 는
**이 PR 이 만든 것이 아니다**(리뷰어도 "선존, 병합을 막을 사유 아님" 으로 명시).

두 봉투를 통일하려면 기존 클라이언트가 보는 코드가 바뀐다 — 이 PR 의 스코프를 넘고, 별도
결정이 필요하다. 다음에 그 봉투를 손댈 때 처리한다.

## 미조치 INFO (13건)

전부 확인성(이전 라운드 수정의 실코드 재검증 8건) 또는 리뷰어가 "필수 아님"·"non-blocking"
으로 판정한 것들 — e2e 스모크 · `MASKED_MARKERS` freeze 직접 캐너리 · `isRecord` 배열 케이스 ·
호출부 주석 중복 · `throwIfAny` 명명 · swagger jsdoc 400 분기 · MDX 서버측 방어층 미언급.

## 검증

TEST WORKFLOW 4단계 PASS —

| 단계 | 결과 |
| --- | --- |
| lint | PASS (49s) |
| unit | PASS — backend jest **429 suites / 8,862**(직전 428/8,859 대비 +1 suite·+3) |
| build | PASS (138s) + 타입체크 ratchet **199건/38파일 baseline 일치** |
| e2e | PASS (210s) — backend supertest **276** · playwright **51** (`51 passed (55.6s)` 실측) |
