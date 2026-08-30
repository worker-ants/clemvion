---
title: spec draft — raw SQL 결과 shape 규약 승격 + 소급 각주
worktree: raw-update-guard-scope-0e154c
started: 2026-08-30
owner: project-planner
spec_impact:
  - spec/conventions/raw-query-results.md
  - spec/conventions/node-cancellation.md
  - spec/data-flow/2-auth.md
  - spec/5-system/3-error-handling.md
  - spec/5-system/4-execution-engine.md
  - spec/5-system/8-embedding-pipeline.md
  - spec/5-system/10-graph-rag.md
---

> **복원 배너 (2026-08-30) — 이 파일은 `#1242` 당시 커밋되지 않았다.**
>
> planner 턴 끝에 draft 를 `rm` 하는 바람에 git 이력에 0건이었는데, `#1242` 커밋 메시지와
> `backend-lint-gate-broken-on-main.md` 이 이 파일을 근거로 인용하고 있었다. ai-review
> `19_26_58` requirement W1 이 자매 건(`spec-draft-else-branch-transaction.md`)에서 같은
> 결함을 잡아 함께 드러났다.
>
> **본문은 원문 그대로다** — 기억으로 재작성하지 않고, `--spec` 프롬프트 번들
> `review/consistency/2026/08/30/16_50_38/_prompts/cross_spec.md` 의 코드펜스(24~270행)에서
> 그대로 떴다. 그 번들은 `#1242` 로 커밋돼 있어 원문이 보존돼 있었다.
>
> **frontmatter 의 `spec_impact` 는 draft 시점 값이라 결과와 다르다.** 7개가 적혀 있으나
> `#1242` 가 실제로 바꾼 spec 은 **6개**다 — `spec/5-system/3-error-handling.md`
> (`OAUTH_STATE_MISMATCH` 등재)는 검토 중 범위 밖으로 뺐고, 그 판단과 근거는 본문 §C 에
> 그대로 있다. 사후 편집하면 이 파일은 더 이상 그 턴의 증거가 아니게 되므로 **고치지 않고
> 여기 적는다.**


# spec draft — raw SQL 결과 shape 규약 승격 + 소급 각주

`update-returning-tuple-shape.md` 의 `[planner 위임]` 항목을 집행한다.
developer 턴(`#1241` 까지)이 코드·가드는 끝냈고, `spec/` 쓰기 권한이 없어 남긴 몫이다.

> **개정 2 (consistency `16_35_22` 반영)** — 초판은 BLOCK:YES(frontmatter 필수 필드 누락)
> 였고 WARNING 4건이 붙었다. 그중 둘은 내가 **트래커의 앵커를 검증 없이 옮긴** 탓이다.
> 숫자는 재측정했으면서 앵커는 안 했다. 아래 §D 에 개정 내역을 남긴다.

## 왜 지금 적어 두나 — 네 번 독립 재발견

같은 지식이 저장소 안에서 **네 번 각자** 알아내졌다:

| # | 지점 | 그 자리에서 알아낸 형태 |
| --- | --- | --- |
| 1 | `stuck-document-recovery.service.ts` | `const [rows] = await …` 구조분해 |
| 2 | `agent-memory-admin.service.ts` | 로컬 `deletedRowCount()` 가 튜플·비튜플 양쪽 수용 |
| 3 | `integration-oauth.service.ts` | `.query<[Row[], number]>` 로 튜플 타입 명시 |
| 4 | `update-returning-rows.ts` (`#1168`) | 공용 헬퍼 |

네 번 각자 알아낸 것은 개인의 부주의가 아니라 **적어 둔 자리가 없다**는 뜻이다.

---

## A. 신규 `spec/conventions/raw-query-results.md`

### frontmatter (필수)

```yaml
id: raw-query-results
status: implemented
code:
  - codebase/backend/src/common/utils/update-returning-rows.ts
  - codebase/backend/src/common/utils/update-returning-rows.spec.ts
  - codebase/backend/src/common/__test-utils__/source-scan.ts
```

`status: implemented` 인 이유는 대상 구현이 `#1241` 로 이미 끝났기 때문이다.
`code:` 는 `spec-code-paths.test.ts` 가드가 경로 실재를 검사한다.

### 왜 기존 `migrations.md` 확장이 아니라 신규 문서인가

`migrations.md` 는 **스키마 변경 절차**의 SoT 다. 여기서 규정하려는 것은 런타임
**쿼리 결과 읽기**라 축이 다르다. 마이그레이션을 안 건드리는 사람이 이 규약을 찾을
이유가 없어지므로 분리한다.

### 불변식 (a) — raw `UPDATE`/`DELETE … RETURNING` 은 튜플이다

`.query()` 로 실행한 raw `UPDATE`/`DELETE … RETURNING` 의 런타임 반환은 행 배열이
아니라 `[rows, affectedCount]` **튜플**이다. 소비할 때 반드시 `updateReturningRows` 를
거친다.

경계가 좁다 — 아래 셋은 **대상이 아니다**:

| 형태 | 반환 | 왜 다른가 |
| --- | --- | --- |
| `INSERT … RETURNING` | 행 배열 | command tag 가 INSERT |
| `INSERT … ON CONFLICT DO UPDATE … RETURNING` | 행 배열 | 본문에 UPDATE 가 있어도 **태그는 INSERT** |
| QueryBuilder `.update().returning().execute()` | `UpdateResult { raw, affected }` | `.query()` 가 아니라 **별개 계약** |

**틀렸을 때의 부호가 한 가지가 아니다.** 튜플을 행 배열로 오해하면 길이가 언제나 2다.
그래서 `length > 0` 을 쓰면 **항상 참**, `length === 1` 을 쓰면 **항상 거짓**이 된다 —
같은 결함이 "언제나 성공했다고 착각" 과 "언제나 실패했다고 착각" 양쪽으로 나타난다.
`8332d9a20` 이 두 부호를 한 파일에서 동시에 고쳤다.

### 불변식 (b) — raw 결과의 컬럼명은 snake_case 다

`.query()` 는 TypeORM 의 엔티티 매퍼를 **우회**한다. 그래서 반환 행의 키는 DB 컬럼명
(snake_case) 이지 엔티티 프로퍼티명(camelCase) 이 아니다. **raw 결과를 엔티티 타입으로
단언하지 않는다.**

(a) 만 지키고 (b) 를 놓치면 튜플은 풀리는데 그 안의 필드가 전부 `undefined` 다.

### 이 규약이 없어서 난 일

- **(a)**: OAuth callback 의 `DELETE … RETURNING` 결과를 행 배열로 다뤄 state 가 영영
  해석되지 않았다 → **소셜 로그인 상시 실패** (`#1168`).
- **(b)**: 같은 PR 에서 `rememberMe`(camelCase) 를 읽었는데 실제 행 키는 `remember_me`
  였다 → **"로그인 유지" 가 통째로 무시**됐다. 단위 테스트의 mock 이 엔티티 형태
  (`rememberMe`) 였기 때문에 **초록인 채로** 살아남았다.

(b) 를 (a) 와 **같은 문서에** 두는 이유가 이것이다 — `#1168` 이 (a) 만 처방했다가
(b) 를 놓쳐 CRITICAL 이 났다.

### 집행

`update-returning-rows.spec.ts` 의 발견형 가드가 `src/**` 전수를 스캔해, raw 지점 수만큼
헬퍼를 거치는지 **개수로** 판정한다(`#1241`). 면제는 `(파일, 사유, 검토한 지점 수)` 3-tuple
이고 선언 개수는 실측과 정확히 일치해야 한다.

스캐너가 원리적으로 못 보는 형태 셋 — 변수에 담긴 SQL(`.query(sqlVar)`), 2단계 이상 중첩
제네릭, CTE 접두(`WITH … UPDATE … RETURNING`). 전부 음성 캐너리로 고정돼 있고 **고칠
대상이 아니라 알려진 한계**다. 넓히려면 SQL 파서·데이터플로 분석이 필요하다.

---

## B. 소급 각주

`#1168`·`8332d9a20` 이 고친 것들이 실제로 어겼던 spec 서술에 "이 보장이 4개월간 구현에서
깨져 있었다" 를 남긴다. **서술을 바꾸는 게 아니라 이력을 붙인다** — 원문은 옳았고 구현이
어긋난 것이다.

| # | 대상 | 붙일 위치 | 무엇이 깨져 있었나 | 부호 |
| --- | --- | --- | --- | --- |
| 1 | `spec/data-flow/2-auth.md` | `### OAuth state 의 one-shot DELETE` (Rationale) | 원자적 one-shot 자체는 맞았고, 반환 해석이 틀려 **항상 미해석** | 항상 실패 |
| 2 | `spec/5-system/4-execution-engine.md` | **§1.1 Execution 상태** | 종결 이벤트의 "동시 cancel 선점 시 emit skip" 분기 | **항상 참** (skip 이 한 번도 안 탐) |
| 3 | `spec/5-system/4-execution-engine.md` | **§8 동시성 cap** | advisory-lock admission gate 의 `rows.length === 1` | **항상 거짓** (매 실행 2s 지연 + `if (admitted)` 사문화) |
| 4 | `spec/5-system/8-embedding-pipeline.md` | `### 7.3 재임베딩` | KB 재임베딩 CAS 락의 0행 거절 분기 | 거절한 적 없음 |
| 5 | `spec/5-system/10-graph-rag.md` | 동시 호출 표의 `re-extract` 행 | KB 재추출 CAS 락의 409 거절 분기 | 거절한 적 없음 |
| 6 | `spec/conventions/node-cancellation.md` | **§2.4 3·4번째 불릿** | 종결 직전 재조회 후 "0행이면 skip" | 항상 참 |
| 7 | `spec/conventions/node-cancellation.md` | **§6 구현 현황 표 2행** | `mutation 6/6`·`mutation 13/13` "검증" 의 범위 | — |

### #2·#3 을 왜 갈랐나 (cross_spec W2 + 내 실측)

초판은 트래커를 따라 "admission gate·종결 이벤트" 를 **§1.1 한 앵커**에 묶었다. 실측하니
**§1.1 에 admission 언급이 0건**이고 admission gate 는 §8 소재다. 앵커를 검증 없이 옮긴
것이다.

갈라야 할 이유가 하나 더 있다. `8332d9a20` 의 diff 를 열어 보니 **두 결함의 부호가
반대**다 — 종결 이벤트 쪽은 `updated.length > 0` 이라 항상 참(skip 이 죽음), admission
쪽은 `rows.length === 1` 이라 항상 거짓(늘 거부). 한 각주에 "그 분기가 죽어 있었다" 로
뭉치면 어느 쪽이 어떻게 죽었는지가 사라진다.

### #6 은 표 행이 아니라 **소비 경로**에 건다

§2.4 는 메커니즘 4개를 불릿으로 나열한다. caveat 을 §2.3/§2.4 비교표의 행이나 절 전체에
걸면, 영향권 밖 메커니즘까지 "검증 안 됨" 으로 뭉뚱그려져 **반대 방향 drift** 가 생긴다.

| §2.4 메커니즘 | 영향 |
| --- | --- |
| 노드 경계 `assertExecutionNotCancelled()` | **없음** — 반환값 분기 아님 |
| turn 경계 같은 가드 | **없음** — 동일 |
| park↔resume 짝 전이의 `SELECT … FOR UPDATE` **잠금 자체** | **없음** — 잠금은 정상 동작했다 |
| 같은 불릿의 **"조건부 UPDATE 가 0행이면 skip"** | **있음** |
| 종결 직전 재조회 후 **"0행이면 저장·emit 모두 skip"** | **있음** |

**caveat 을 12곳에 흩뿌리지 않는다.** 실측해 보면 그 12곳은 전부
`driver.updateExecutionStatus` 라는 **메서드 하나**를 소비하고, 그 단 하나의 구현
(`execution-engine.service.ts`)이 항상 참을 돌려줬다. 그래서 각주는 "이 반환으로 분기하는
모든 소비자의 skip 분기가 죽어 있었다 — 원인은 소비자가 아니라 드라이버 한 곳" 으로 적고,
전수 목록은 트래커를 가리킨다. 위치를 나열하면 목록이 다음 리팩터에 낡는다.

### #7 — "검증됨" 이 한 칸 좁았다 (plan_coherence W3)

§6 표는 `mutation 6/6` · `mutation 13/13` 으로 두 가드를 "검증됨" 으로 적는다. 그 뮤테이션은
**driver mock 경계 안쪽**만 봤다 — mock 이 boolean 을 정직하게 돌려주는 세계에서 로직은
옳았고, 실제 드라이버는 항상 참이었다. 즉 **숫자는 맞고 결론이 넓다.**

caveat: "이 수치는 driver 반환이 정확하다는 전제 아래의 로직 검증이다. `8332d9a20`
(2026-08-13) 이전에는 그 전제가 거짓이라 skip 분기가 실제로는 도달 불가였다."

이 항목은 `retry-turn-terminal-guard.md` → `update-returning-tuple-shape.md` 위임 경로를
거치며 "§2.4 프로즈 1곳" 으로 축소돼 사라졌다. **위임이 한 단계 건널 때마다 범위가
좁아진다** — 이번에 checker 가 되찾았다.

### 영향 범위 실측 (2026-08-30, `origin/main` `84cc53805`)

반환값으로 분기하는 경로는 **12곳 / 3파일**이다.

| 파일 | 분기 지점 |
| --- | --- |
| `execution-engine.service.ts` (7) | `failFirstSegmentSetup` · `driveResumeAwaited` · `driveCallStackResume` · `driveStuckRedrive` · `runExecution` · `finalizeCancelledExecution` · `finalizeFailedExecution` |
| `ai-turn-orchestrator.service.ts` (3) | `reparkAiResumeTurn` · `emitAiWaitingForInput` · `finalizeAiNode` |
| `retry-turn.service.ts` (2) | `finalizeGuarded` · `resumeGraphAfterRetry` |

> **트래커의 "11곳" 은 낡았다.** 그 목록은 `#1168`(2026-08-14) 시점에 맞았고, 다음 날
> `#1172` 가 `finalizeCancelledExecution` 을 추가하면서 12가 됐다. 하필 **취소 종결자**라
> `node-cancellation.md` 각주의 대상 중 가장 관련 깊은 경로가 목록에서 빠져 있었다.
> 줄 번호는 싣지 않는다 — 트래커의 `:645`·`:4844` 는 지금 전부 밀렸다.

---

## C. 카탈로그 등재 — `OAUTH_STATE_MISMATCH`

성격이 다르다. caveat 이 아니라 **누락된 에러 코드 등재**다.

`spec/5-system/3-error-handling.md` **§1.2 인증/인가 에러**에 `OAUTH_STATE_MISMATCH` (400)
를 등재하고 `data-flow/2-auth.md` 와 상호링크한다.

실측(2026-08-30): `3-error-handling.md` 안의 출현 `OAUTH_STATE_MISMATCH` **0** vs
자매 `KB_REEMBED_IN_PROGRESS` **1** · `KB_REEXTRACT_IN_PROGRESS` **1**. 코드에는 실재한다
(`auth.controller.ts` · `auth-oauth.service.ts`).

> **범위를 넓힌 이유**: 이 항목은 내 초판에 없었고 자매 집결 티켓
> `spec-update-node-cancellation-shutdown-classification.md` 에만 있었다. 같은 위임 배치이고
> 표 한 행이라, 별도 planner 턴으로 미루면 잃을 가능성이 실제 비용보다 크다.

---

## D. `node-cancellation.md` frontmatter

`pending_plans:` 에 `plan/in-progress/update-returning-tuple-shape.md` 를 추가한다.
현재 `node-cancellation-residual-signal-propagation.md` 한 건만 등재돼 있다.

같은 지시가 자매 집결 티켓에도 있다(값 동일, 충돌 아님). 반영 후 그쪽 항목을 소거한다.

---

## E. 원본 트래커 갱신

`update-returning-tuple-shape.md` 의 "11곳 / 3파일" 표를 **12곳**으로 갱신하고, 두
`[planner 위임]` 항목을 체크한다.

---

## Rationale

### 기각한 대안 — `migrations.md` 확장

축이 다르다(스키마 변경 절차 vs 런타임 결과 읽기). 마이그레이션을 안 건드리는 사람이
이 규약에 닿지 못한다.

### 기각한 대안 — 타입 경계 래퍼로 강제

`DataSource`/`EntityManager` 확장 래퍼로 "호출 즉시 언랩" 을 컴파일 타임에 강제하는 안을
`#1241` 이 검토했다. 보장은 더 강하지만 **기존 raw 호출부 전수 이관**을 요구한다. 발견형
가드는 호출부를 하나도 안 건드리고 같은 축을 지킨다. 이관 비용을 치를 이유가 생기면
그때 승격한다 — 그 판단은 아직 유효하다.

### 기각한 대안 — §2.4 caveat 을 12곳에 개별 부착

consistency 초회가 제안한 형태다. 채택하지 않는다 — 12곳은 **드라이버 메서드 하나**의
소비자이고, 위치 목록은 다음 리팩터에 낡는다. 원인 지점 하나를 짚고 전수 목록은 트래커를
가리키는 편이 오래 산다. (실제로 이번에 트래커 목록이 이미 한 건 낡아 있었다.)

### 왜 소급 각주를 "지금" 남기나

`#1168`·`8332d9a20` 이 이미 고쳤으므로 각주가 코드를 바꾸지는 않는다. 그러나 대상 문서들은
**그 보장이 언제나 참이었다**고 읽힌다. 4개월간 거짓이었던 기간을 적어 두지 않으면, 다음
사람이 "이 경로는 spec 이 보장하니 테스트가 얇아도 된다" 고 판단할 근거가 된다 — 실제로
그 얇음이 결함을 4개월 살렸다.

