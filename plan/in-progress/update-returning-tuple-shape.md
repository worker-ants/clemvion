---
title: UPDATE/DELETE 의 RETURNING 이 `[rows, count]` 튜플인데 7곳이 행 배열로 다뤘다
worktree: eia-r8-cache-scope-4ae434
started: 2026-08-13
owner: developer
status: in-progress
priority: P1
spec_impact:
  - spec/5-system/4-execution-engine.md
  - spec/5-system/8-embedding-pipeline.md
  - spec/5-system/10-graph-rag.md
  - spec/data-flow/2-auth.md
  - spec/conventions/node-cancellation.md
---

> **`spec_impact` 주의** — 이 PR 자체는 `spec/` 을 1줄도 바꾸지 않는다(코드 전용).
> 그럼에도 `none` 이 아닌 이유는 자매 plan `retry-turn-terminal-guard.md` 가 같은 상황에서
> 확립한 것과 같다: 본문이 **project-planner 위임으로 spec 각주 5건을 스스로 명시**하는데
> frontmatter 가 `none` 이면, `complete/` 이동 시 Gate C(`spec-plan-completion.test.ts`)가
> 그 값을 그대로 신뢰해 "spec 영향 없음" 이 잘못 확정된다.
> **아래 §후속의 [planner 위임] 항목이 반영되기 전에는 완료 처리하지 말 것.**
>
> (처음엔 `none` 으로 두고 "이 PR 이 바꾸는 spec 은 0건이라 리스트는 거짓" 이라 적었는데,
>  이 필드는 **PR 이 아니라 plan 의 라이프사이클**을 가리킨다 — `23_27_49` WARNING 3.)

## Overview

`.query()` 반환 shape 하드닝 후속(①: backend 전역 감사)에서 출발했는데, **원래 전제는
반증됐고 훨씬 큰 결함이 나왔다.**

원래 전제 — *"`computeChainDepth` 같은 fail-open(비배열 → 기본값 → 검사 통과)이 더 있다"*.
backend 전역 `.query()` 소비 41곳을 실패 방향별로 분류하고 미가드 fail-open 후보 4곳을
직접 읽었다. **넷 다 보장을 우회하지 않는다** — 둘은 화면 통계, 하나는 telemetry, 하나는
이미 `try/catch` 안이라 가드가 삼켜진다. `computeChainDepth` 가 특별했던 건 **문서화된
제한(RR-PL-05)** 을 우회했기 때문이고, 그런 지점은 더 없다.

대신 **다른 결함 클래스**가 드러났다.

## 실측 — TypeORM 은 UPDATE/DELETE 에만 튜플을 돌려준다

`PostgresQueryRunner.query` 의 `switch (raw.command)` 가 `UPDATE`/`DELETE` 에만
`result.raw = [raw.rows, raw.rowCount]` 로 감싼다. 소스만 읽고 단정하지 않고,
throwaway postgres + typeorm 0.3.31 로 **직접 쐈다**:

```
UPDATE … RETURNING (1행)   → [[{"id":1}], 1]     length 2
UPDATE … RETURNING (0행)   → [[], 0]             length 2
UPDATE (RETURNING 없음)    → [[], 1]             length 2
DELETE … RETURNING (1행)   → [[{"id":3}], 1]     length 2
INSERT … RETURNING (1행)   → [{"id":4}]          length 1  ← 튜플 아님
TX 안 UPDATE … RETURNING   → [[{"id":2}], 1]     length 2
파라미터 유무·서브쿼리 유무 무관
```

따라서 UPDATE/DELETE 결과에 `.length` / `[0]` / `.map` 을 바로 쓰면 **항상 같은 값**이다.

## 무엇이 깨져 있었나 (8곳)

| 지점 | 소비 | 실제 |
|---|---|---|
| `execution-engine` `admitExecutionOrDefer` | `rows.length === 1` | **항상 거짓** → admission 영영 실패 |
| `execution-engine` `updateExecutionStatus` | `updated.length > 0` | **항상 참** → "동시 cancel 선점" 분기 사문화 |
| `knowledge-base` re-extract CAS 락 | `acquired.length === 0` | **항상 거짓** → 락이 거절하지 않음(동시 재추출) |
| `knowledge-base` re-embed CAS 락 | `acquired.length === 0` | 〃 |
| `knowledge-base` embedding 재큐 | `rows.map(r => r.id)` | `[undefined, undefined]` → 가짜 job 2개 |
| `knowledge-base` graph 재큐 | `rows.length` / `rows.slice` | 〃 |
| `knowledge-base` reset | `reset.length === 0` | 빈 KB 가 `in_progress` 로 좌초 |
| **`auth-oauth` 소셜 로그인 콜백** | `consumed.length === 0` / `consumed[0].provider` | **모든 정상 콜백이 `OAUTH_STATE_MISMATCH` 로 실패 — 로그인 상시 불가.** 1차 감사가 놓쳤다(ai-review `20_36_35` CRITICAL 1) |

**이 저장소는 이미 이 결함을 세 번 겪었고 매번 그 자리만 고쳤다** —
`agent-memory-admin` 의 `deletedRowCount`(NotFound 미변환 버그), `stuck-document-recovery` 의
구조분해(가짜 job 2개 큐잉 회귀), 그리고 **세 번째는 고치지도 못했다**: 아래 §소급 영향 참조.
처방이 지점에 갇혀 있어 나머지 7곳에 전파되지 않았다.

## 왜 아무도 못 봤나 — GREEN 두 겹

- **단위 테스트가 틀린 현실을 mock 했다.** admission 테스트가 `UPDATE … RETURNING` 에
  `[{id}]`(INSERT 형태)를 돌려주도록 세워서 `rows.length === 1` 이 GREEN 이었다.
- **e2e 는 최종 상태만 봤다.** `execution-concurrency-cap` 은 실행이 `completed` 되는지만
  단언한다. 실제로는 admission 이 실패해 `deferred` 로 빠지는데, **그 UPDATE 는 이미
  커밋**돼 row 가 `running` 이 되고, 재큐된 job 을 `runExecutionFromQueue` 의 RUNNING arm 이
  **"stalled 재배달"(워커 크래시)로 오인**해 §7.5 rehydration 으로 재구동한다.
  결과만 맞고 경로가 틀렸다.

대가:
- 큐 경로 실행마다 `EXECUTION_ADMISSION_RETRY_DELAY_MS`(2s) 지연 —
  e2e 의 "슬롯 해제 시 admitted" 가 **4191ms** 걸린 것이 그 흔적
- `if (admitted)` 블록이 통째로 사문화 → `recordRunningSegmentStart`(§8 active-running
  타임아웃 baseline)와 `EXECUTION_STARTED` emit 이 그 경로에서 실행되지 않음
- 크래시 복구 경로가 정상 경로로 상시 사용됨

## 소급 영향 — 다른 plan 이 이 버그 위에서 "닫았다" 고 종결했다

consistency `20_36_36` plan_coherence WARNING 1. 직접 검증했다:

- `git show 1657c0435` (2026-06-14, #600) 이 `const persisted = updated.length > 0;` 를 도입
- `plan/in-progress/ie-resume-turn-boundary-cancel.md` (2026-07-26~28) 가 6~8차 라운드에 걸쳐
  **바로 그 `persisted`** 를 근거로 "동시 cancel 레이스를 닫았다" 고 CRITICAL 을 종결

즉 그 작업 전 기간 동안 `persisted` 는 **항상 참**이었고, 종결은 코드가 아니라 문서의 상태였다.

**가장 아픈 부분**: 그 plan 은 생존 뮤턴트를 이미 기록해 뒀다 —
*"`emitTerminalExecutionMetrics(..., persisted)` 를 `true` 로 되돌리는 뮤턴트가 RED 로 안
떨어진다(단언 부재). 영향은 metrics 정확도 한정이며 취소 정합성과 무관."*
**단언 부재가 아니라 등가 뮤턴트였다** — `persisted` 가 이미 상수 `true` 라 치환이 프로그램을
바꾸지 않았다. 생존은 **버그의 증거**였는데 테스트 위생 항목으로 접수됐고, 영향 평가도
틀렸다(`persisted` 는 종결 이벤트 emit 분기를 가른다).

**두 번째 plan 도 같은 구간 위에 있었다** (`22_45_25` plan_coherence WARNING 1).
`retry-turn-terminal-guard.md` 는 12+ 라운드에 걸쳐 "동시 cancel 방어" 를 검증했고,
그 방어는 `updateExecutionStatus` 의 `persisted` 값에 의존한다 — **프로덕션에서 항상
`true` 였던 그 값**이다.

> **처음엔 "mock 안쪽만 검증했다" 고 적었는데 틀렸다.** consistency `23_07_12` 와
> ai-review `23_27_48` 두 리뷰어가 그렇게 서술했고 나는 확인 없이 두 plan 에 옮겨 적었다.
> `grep -c 'updateExecutionStatus.mockResolvedValueOnce(false)'` 한 번이면 **3건**이 나온다 —
> complete·fail·cancel 세 경로가 대조군까지 갖춰 양방향으로 덮여 있다.
>
> **정확한 서술**: 단위 테스트는 온전했다. 계약(`false` 를 받으면 emit 을 건너뛴다)은
> 검증됐는데 **그 계약을 지키는 driver 가 값을 안 만들어 줬다.** 그래서 이 방어는 코드로는
> 옳고 프로덕션에서는 한 번도 발동하지 않았다. 무효화된 것은 라운드의 결론이 아니라
> **"실제로 레이스를 막아 왔다" 는 주장**뿐이다.
>
> 리뷰어의 지적도 액면가로 받으면 안 된다 — 이번엔 **내가 남의 미검증 주장을 증폭**했다.

→ 두 plan 모두에 소급 정정 배너를 넣었다. `ie-resume-turn-boundary-cancel.md` 는 뮤턴트
항목의 진단도 바로잡았고, `retry-turn-terminal-guard.md` 에는 **`persisted=false` 를 mock
경계 밖에서 재검증** 하는 미완료 항목을 등재했다(`complete/` 이동 전 필수).

> 처음엔 "두 plan 모두" 라고 **써 놓고 한 곳만 고쳤다** — consistency `23_07_12` WARNING 1 이
> grep 0건으로 잡았다. 이 세션에서 같은 형태(완료 선언이 사실보다 앞섬)를 네 번째 반복했다. `plan/complete/` 이동
전에 6~8차 결론을 코드로 재검증해야 한다.

> **교훈**: 생존 뮤턴트를 "테스트가 부족하다" 로만 읽으면 안 된다. **치환해도 안 죽는다는 건
> 그 자리가 이미 상수라는 뜻일 수 있고, 그건 테스트가 아니라 코드의 문제다.** 등가 뮤턴트와
> 미검출 뮤턴트를 가르는 질문은 "이 값이 실제로 두 값을 가질 수 있는가" 하나다.

## 1차 감사가 왜 놓쳤나 — 도구의 사각지대가 감사의 사각지대였다

감사 스크립트가 SQL 첫 키워드를 **백틱 뒤에서만** 찾았다. `auth-oauth` 의 쿼리는
작은따옴표다. 한 줄의 정규식 가정이 **프로덕션 로그인 장애를 "전역 감사 통과" 로 만들었다.**
따옴표 무관으로 고쳐 재실행하니 미처방 신규는 이 1건이었고, `integration-oauth` 2곳은 이미
튜플로 정확히 다루고 있었다(네 번째로 이 지식이 있던 자리).

> **교훈**: "전역" 이라고 부르기 전에 **도구가 무엇을 못 보는지**를 먼저 세라. 이 세션에서
> 구조적 가드의 사각지대는 주석으로 적어 뒀으면서, 정작 그 가드를 만든 감사 도구의
> 사각지대는 안 적었다.

## 두 번째 축 — 튜플을 고치자 그 아래 컬럼명 결함이 드러났다

`00_20_21` requirement CRITICAL. **shape 을 고쳐 처음 실행 가능해진 코드에 별개 버그가 있었다.**

raw `.query()` 는 ORM 매핑을 타지 않아 행의 키가 **DB 그대로 snake_case** 다. entity 의
`@Column({ name: 'remember_me' }) rememberMe` 매핑은 적용되지 않는다. 그런데 콜백은
`record.rememberMe` 를 읽었다 → 항상 `undefined` → `rememberMe ? 30 : 7` 이 늘 7 을 골라
**소셜 로그인의 "로그인 유지" 가 침묵으로 무시**됐다(refresh 토큰 만료·쿠키 `Max-Age` 둘 다).

| | 값 |
|---|---|
| 정답 (`remember_me = true`) | 30일 = `Max-Age=2592000` |
| 버그 | 7일 = `Max-Age=604800` |

**타입이 막아 주지 않았다.** `updateReturningRows<AuthOAuthState>` 의 제네릭은 검증이 아니라
**단언**이라, 실제로는 존재하지 않는 필드를 컴파일러가 있다고 믿었다. 그래서 raw 행 전용 타입
`AuthOAuthStateRow`(snake_case)를 따로 두고 그걸로 단언하게 바꿨다 — 이제 `record.rememberMe`
는 `tsc` 가 거부한다(`TS2551: Did you mean 'remember_me'?`).

자매 `integration-oauth.service.ts` 는 `normalizeRawStateRow` 로 같은 문제를 이미 풀어 뒀는데
**"entity shape 이면 그대로 통과" 하는 우회로**를 둔다. 여기서는 의도적으로 두지 않았다 —
그 우회로가 바로 entity shape mock 을 초록으로 통과시켜 이 결함을 숨긴 구멍이다.

> **내가 그 파일을 열어 놓고 놓쳤다.** 튜플 처방을 쓰면서 "`integration-oauth` 는 이미 튜플로
> 다루고 있었다" 고 주석까지 달았는데, 바로 옆의 컬럼명 정규화는 못 봤다. **방어의 정의를
> 한 칸 좁게 잡은 것** — "반환 shape" 까지만 보고 "행의 키" 는 같은 질문의 일부로 세지 않았다.

**어떻게 잡혔나**: 그 자리에 `propagates rememberMe through to token issuance` 라는 테스트가
**이미 있었다.** mock 이 `[{ …, rememberMe: true }]` — 행 배열(튜플 아님) + camelCase 라 코드와
같은 두 오해를 공유해 4개월간 초록이었다. mock 을 실 shape 으로 바꾸니 즉시 RED.

`false` 가 아니라 `true` 로 고정한 것이 요점이다 — `false` 면 정답과 버그가 같은 값(7일)을 내
**분기가 갈리지 않는다.** e2e 대조군(`false` → 7일)이 이를 실증한다: 버그 상태로 되돌리면
`true` 케이스만 실패하고 대조군은 통과한다.

## 처방

`common/utils/update-returning-rows.ts` — `updateReturningRows<T>(result): T[]`.
튜플이면 `[0]` 을, 아니면 그대로 돌려준다(버전·드라이버 차이를 호출부가 몰라도 되게).
7곳 전부 이 헬퍼를 거친다.

**헬퍼만으로는 재발을 막지 못한다**(호출을 잊으면 그만) → `update-returning-rows.spec.ts`
에 구조적 가드: 두 파일의 UPDATE/DELETE 소비 지점 수 == 헬퍼 호출 수, 그리고 이미 올바른
두 선례(구조분해 · `deletedRowCount`)가 유지되는지도 고정.

## 검증

- **RED → GREEN**: 실측 shape 로 admission 테스트를 걸면 `Expected "admitted",
  Received "deferred"` 로 실패 → 수정 후 통과 (engine 스위트 446 passed)
- 관련 32 스위트 **851 passed**, `lint --max-warnings 0` 통과
- typecheck ratchet **199 / 38파일 baseline 일치** (새 테스트가 만든 타입 에러 2건은
  `--update` 로 기준선을 올리지 않고 캐스트로 정정)
- **e2e `execution-concurrency-cap` 재실행 — 예측이 실측으로 확인됐다.**
  코드만 읽고 "매 실행 2s 지연" 을 예측했고, 수정 전후로 쟀다:

  | 테스트 | 수정 전 | 수정 후 |
  |---|---|---|
  | 슬롯 해제 시 admitted | 4191 ms | **2242 ms** |
  | workspace-level cap | 4181 ms | **2221 ms** |

  정확히 `EXECUTION_ADMISSION_RETRY_DELAY_MS`(2000ms) 한 사이클씩. 5개 테스트 모두 통과 유지.

## 체크리스트

- [x] 전역 감사 — 41 소비 지점 분류, 원래 fail-open 전제는 **반증**
- [x] TypeORM 반환 shape 실측 (소스 읽기 + 실제 DB 프로브 2회)
- [x] e2e 가 통과하는데 코드가 틀린 이유 규명 (rehydration 우회)
- [x] 헬퍼 + 7곳 적용
- [x] RED 재현 후 GREEN 확인
- [x] 구조적 재발 가드
- [x] e2e 재실행 — 4191ms → **2242ms** (2s 재큐 사이클 소멸), 5/5 통과 유지
- [x] `--impl-done` `20_36_36` **BLOCK: NO** (Critical 0 / Warning 1 — 소급 영향, 조치 완료)
- [x] 소급 영향 조사·정정 — `ie-resume-turn-boundary-cancel.md` 배너 + 뮤턴트 오진 정정
- [x] `/ai-review` `20_36_35` — CRITICAL 2 + WARNING 6 조치 완료 (RESOLUTION 참조)
- [x] `/ai-review` 6라운드 — `00_00_44` **CRITICAL 0 / WARNING 1**(forced 7명 전원).
      마지막 WARNING(OAuth 콜백 e2e 부재)까지 조치
- [x] **OAuth 콜백 e2e 신설** — 실 Postgres 왕복으로 성공/거절 양방향 관측.
      버그 상태로 되돌리면 **2 failed(사살)**. 거절 방향만 봤으면 버그 있는 채 5/5 GREEN 이었다
- [x] 소급 영향 **세 번째** plan(`exec-intake-followups.md`) 배너 + 위임 5건 집결 티켓 `#12` 등재
- [x] **`rememberMe` 컬럼명 결함**(`00_20_21` requirement CRITICAL) — raw 행 전용 타입으로
      `tsc` 가 막게 하고, 이미 있던 단위 테스트의 거짓 mock 을 실 shape 으로 정정.
      2층 뮤테이션으로 확인: 타입층 `TS2551` 사살 / 타입 우회 시 테스트 3건 RED
- [x] **e2e 에 `Max-Age` 단언 2건 추가** — `true`→2592000, 대조군 `false`→604800.
      되돌리면 `true` 만 실패(대조군 통과)해 판별자가 `rememberMe` 임을 확정
- [x] CHANGELOG — 이번 결함 Unreleased 항목 + 기존 1·5·6·7 소급 정정
- [x] caveat 소비 경로 목록 정정 — 서술형 라벨·단일 파일 집계 오류 2회, 최종 **11곳/3파일**
- [ ] 후속 ②(`updateExecutionStatus` 트랜잭션화)·③(EIA `durationMs`/`result.outputs` emit)

## 후속

- **②·③ 은 이 PR 뒤로 미룬다.** ②는 대상 함수가 바로 `updateExecutionStatus` 라 셰이프
  수정이 선행이었고, 이제 그 전제가 정리됐다. ③은 독립이다.
- `.query()` 사각지대(`let`·구조분해·체이닝)는 정규식이 아니라 AST 로 넓혀야 한다 —
  유한한 문제를 무한한 문제와 바꾸지 않도록 착수 전 비용을 먼저 본다.
- [x] **CHANGELOG Unreleased 항목** (`20_36_35` WARNING 3 → `00_20_21` documentation W5·INFO 11).
      **"릴리스 시점에 몰아쓴다" 는 유예 근거가 틀렸다** — 리뷰어가 이 파일의 커밋 이력을 실측해
      "즉시 작성" 이 실제 관행임을 보였다. 미측정 전제로 미룬 것이다. 두 건을 함께 썼다:
      이번 결함의 Unreleased 항목 + **기존 항목 1·5·6·7 의 소급 정정**(그 항목들이 서술한
      "0행이면 skip" 방어는 이 PR 이전엔 발동한 적이 없다). 정정 범위는 좁게 못박았다 —
      SQL 의 `status IN (non-terminal)` 가드는 정상이었으므로 **DB 는 안 깨졌고**, 죽은 것은
      호출부의 `persisted === false` 분기(이벤트 emit skip)뿐이다.
- [ ] **배포 후 관측** (`20_36_35` WARNING 8). 4개월간 죽어 있던 분기들이 **처음으로 라이브**가
      된다. 조치가 아니라 관측 계획이라 여기 남긴다:
      - (a) admission 2s 지연 소멸 — **e2e 로 이미 실측**(4191→2242ms)
      - (b) 동시성 cap 초과 시 실제 `deferred`/`cancelled` 첫 관측
      - (c) `EXECUTION_STARTED` emit 패턴 변화(그 경로에서 처음 발화)
      - (d) KB 재추출/재임베딩 동시 요청이 처음으로 409 거부
      - (e) 소셜 로그인 성공률 — 0% 에서 회복되는지
      동시성 cap 이 실제로 걸리는 워크로드가 있다면 배포 전 운영 공유.
- [ ] **리뷰 중 뮤테이션 금지 (관행)** — `23_07_11` WARNING 3. 리뷰가 도는 동안 같은
      워크트리에 뮤테이션을 돌렸고, 리뷰어가 **내가 고친 버그가 그대로 있는 상태**를
      수십 초간 관측했다. 스크립트가 즉시 원복해도 읽는 쪽에는 거짓 사실이 보인다.
      이 저장소는 "병렬 리뷰어가 저장소를 뮤테이션해 서로를 오염시킨다" 를 이미 겪었는데
      이번엔 **내가 뮤테이터**였다 — 리뷰 중에는 돌리지 않거나 복사본에서 돌린다.
- **[planner 위임]** raw SQL 결과 shape 을 **규약으로 승격** (`00_54_07` rationale_continuity INFO 2).
  이 지식이 **네 번 독립적으로 재발견**됐다 — `stuck-document-recovery` 의 구조분해,
  `agent-memory-admin` 의 `deletedRowCount`, `integration-oauth` 의 명시 튜플 타입, 그리고
  이 PR 의 헬퍼. 네 번 각자 알아낸 것은 개인의 부주의가 아니라 **적어 둔 자리가 없다**는 뜻이다.
  - 승격할 불변식 두 개: (a) raw `UPDATE`/`DELETE … RETURNING` 결과는 반드시
    `updateReturningRows` 경유, (b) raw `.query()` 결과의 **컬럼명은 snake_case** —
    entity 타입으로 단언하지 말 것(이 PR 의 `rememberMe` 결함이 (b) 의 실례다).
  - 위치는 `spec/conventions/` 신규 문서 또는 기존 `migrations.md` 확장. **어느 쪽이든
    (b) 를 빼지 말 것** — 이번에 (a) 만 처방했다가 (b) 를 놓쳐 CRITICAL 이 났다.
- **[planner 위임]** 소급 각주 — 대상이 **한 문서가 아니다** (`22_45_25` WARNING 2 · INFO 1).
  이 PR 이 고친 것들이 실제로 어겼던 spec 서술을 전부 세면 **다섯**이다:
  - `spec/5-system/4-execution-engine.md` §1.1 — admission gate·종결 이벤트
    (2026-07-30 의 유사 사례 retry-reentry opt-in 미전파와 대칭)
  - `spec/5-system/8-embedding-pipeline.md` §7.3 — KB 재임베딩 CAS 락
  - `spec/5-system/10-graph-rag.md` 동시 호출 표 — KB 재추출 CAS 락
  - `spec/data-flow/2-auth.md` OAuth state 소비 — 소셜 로그인 상시 실패
  - `spec/conventions/node-cancellation.md` **§2.4** — caveat 을 붙이되 **표의 행 라벨이
    아니라 실제 소비 경로 단위로** 적을 것 (`23_46_01` WARNING 5). 행 전체에 caveat 을
    걸면 영향권 밖 메커니즘(`assertExecutionNotCancelled` 관측, `linkedNodeExec` 의
    `FOR UPDATE` 잠금)까지 "검증 안 됨" 으로 뭉뚱그려져 **반대 방향 drift** 를 만든다.
    - **영향 있음 — 11곳 / 3파일.** `updateExecutionStatus` 반환값으로 분기하는 경로.
      `8332d9a20` 이전엔 `persisted`/`completed` 가 항상 `true` 라 skip 분기가 죽어 있었다.

      | 파일 | 호출부 |
      |---|---|
      | `execution-engine.service.ts` | `failFirstSegmentSetup`(`:645`) · `driveResumeAwaited`(`:2366`) · `driveCallStackResume`(`:2533`) · `driveStuckRedrive`(`:3470`) · `runExecution`(`:4657`) · `finalizeFailedExecution`(`:4844`) |
      | `ai-turn-orchestrator.service.ts` | `reparkAiResumeTurn`(`:453`) · `emitAiWaitingForInput`(`:550`) · `finalizeAiNode`(`:1608`) |
      | `retry-turn.service.ts` | `finalizeGuarded`(`:672`) · `resumeGraphAfterRetry`(`:892`) |

    - **영향 없음 — 9곳.** 반환값을 버리는 호출이라 shape 과 무관하다:
      `execution-engine.service.ts` 의 `driveResumeAwaited`(`:2268`) ·
      `driveCallStackResume`(`:2443`) · `executeSync`(`:4209`) · `runExecution`(`:4334`) ·
      `finalizeCancelledExecution`(`:4781`), `button-interaction.service.ts` 2곳,
      `form-interaction.service.ts` 2곳. 그 밖에 `assertExecutionNotCancelled`(DB 재조회),
      `linkedNodeExec` 의 `FOR UPDATE` 잠금(SELECT)은 애초에 이 함수를 거치지 않는다.

    > **이 목록을 두 번 틀렸다** (`00_20_21` side_effect W2).
    > **1차** — "`executeSync` timeout·retry 재진입 종결" 처럼 **서술형 라벨**로 적었다.
    > `executeSync`(`:4209`)는 반환값을 버려 애초에 무관했고, 실제로 분기하는 4곳이
    > 빠졌다. 바로 위에 "행 라벨로 뭉개지 말라" 고 써 놓고 한 칸 덜 내려갔다.
    > **2차** — 고치면서 `execution-engine.service.ts` **한 파일만** 셌다(6곳). 이 함수는
    > `EngineDriver` 인터페이스로 공개돼 있어 `ai-turn-orchestrator`·`retry-turn` 도
    > `this.driver.updateExecutionStatus(...)` 로 부르고 반환값을 소비한다 — 5곳이 더 있었다.
    > 하마터면 리뷰어의 CHANGELOG 인용(`:279`·`:321`, 둘 다 retry-turn 항목)을 "그건
    > `QueryBuilder.affected` 라 무관" 이라며 **틀리게 반박**할 뻔했다. `.affected` 는
    > 그 파일의 *다른* UPDATE 고, terminal 전이는 `driver.updateExecutionStatus` 를 탄다.
    > 최종 수치는 `execution-engine/*.ts` 전수를 대입 여부로 갈라 얻었다.
    - 덧붙여 `node-cancellation.md` frontmatter `pending_plans:` 에 이 plan 을 등재해
      `spec-pending-plan-existence.test.ts` 가 추적하게 할 것 (`23_46_01` WARNING 2).
  > **한 문서만 적으려던 것이 바로 이 PR 이 진단한 패턴("그 자리만 고친다")의 재현이었다.**

  `developer` 는 `spec/` 쓰기 권한이 없어 이번 PR 로는 못 넣는다 — frontmatter
  `spec_impact` 를 리스트로 둔 이유는 **문서 상단 배너** 참조(Gate C 가 `complete/` 이동 시
  이 값을 신뢰한다).
- **[planner 위임]** 같은 결함이 **세 번** 개별 발생했는데 invariant 가 `spec/conventions/`
  에 없다 (`20_36_36` INFO 2·3). "raw UPDATE/DELETE RETURNING 소비는 `updateReturningRows`
  경유" 를 정식 규약으로 승격할지 판단 필요. 네 번째 재발을 막는 유일한 구조적 수단이다 —
  이번 PR 의 회귀 가드는 **두 파일 범위**로 한정돼 있다.

## Rationale

### 왜 `assertRowArray` 로는 못 잡았나

직전 PR 에서 넣은 `assertRowArray` 는 "배열인가" 만 묻는다. **튜플도 배열이다.** 가드는
통과하고 의미는 계속 틀렸다. 방어의 정의를 한 칸 좁게 잡은 전형이다 — "비배열" 이 위험의
전부라고 가정했는데, 진짜 위험은 **배열이지만 다른 배열**이었다.

### 왜 코드가 아니라 mock 을 먼저 의심했어야 했나

`rows.length === 1` 은 4개월간 GREEN 이었다. 그 GREEN 의 근거가 **내가 만든 mock** 이라면
그건 코드가 맞다는 증거가 아니라 **mock 과 코드가 같은 오해를 공유한다는 증거**다.
"실제 드라이버가 무엇을 돌려주는가" 를 한 번도 안 물어본 것이 근본 원인이고, 그래서
이번 수정의 첫 단계가 **실제 DB 에 쏴 보는 것**이었다.
