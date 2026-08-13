---
title: UPDATE/DELETE 의 RETURNING 이 `[rows, count]` 튜플인데 7곳이 행 배열로 다뤘다
worktree: eia-r8-cache-scope-4ae434
started: 2026-08-13
owner: developer
status: in-progress
priority: P1
spec_impact: none
---

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

→ 해당 plan 에 소급 정정 배너를 넣고 뮤턴트 항목의 진단을 바로잡았다. `plan/complete/` 이동
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
- [ ] `/ai-review`
- [ ] 후속 ②(`updateExecutionStatus` 트랜잭션화)·③(EIA `durationMs`/`result.outputs` emit)

## 후속

- **②·③ 은 이 PR 뒤로 미룬다.** ②는 대상 함수가 바로 `updateExecutionStatus` 라 셰이프
  수정이 선행이었고, 이제 그 전제가 정리됐다. ③은 독립이다.
- `.query()` 사각지대(`let`·구조분해·체이닝)는 정규식이 아니라 AST 로 넓혀야 한다 —
  유한한 문제를 무한한 문제와 바꾸지 않도록 착수 전 비용을 먼저 본다.
- [ ] **CHANGELOG Unreleased 항목** (`20_36_35` WARNING 3). 이 저장소는 사용자 영향 있는
      조용한 결함 수정을 Unreleased 에 적는 관행이 있다. 이번 건은 **배포 영향 서술과 함께**
      써야 의미가 있어 릴리스 시점 판단으로 미뤘다 — 무엇이 깨져 있었는지(소셜 로그인 상시
      실패 · admission cap 미집행 · KB CAS 락 미작동 · 재큐 `documentId: undefined`)를 적을 것.
- [ ] **배포 후 관측** (`20_36_35` WARNING 8). 4개월간 죽어 있던 분기들이 **처음으로 라이브**가
      된다. 조치가 아니라 관측 계획이라 여기 남긴다:
      - (a) admission 2s 지연 소멸 — **e2e 로 이미 실측**(4191→2242ms)
      - (b) 동시성 cap 초과 시 실제 `deferred`/`cancelled` 첫 관측
      - (c) `EXECUTION_STARTED` emit 패턴 변화(그 경로에서 처음 발화)
      - (d) KB 재추출/재임베딩 동시 요청이 처음으로 409 거부
      - (e) 소셜 로그인 성공률 — 0% 에서 회복되는지
      동시성 cap 이 실제로 걸리는 워크로드가 있다면 배포 전 운영 공유.
- **[planner 위임]** `spec/5-system/4-execution-engine.md` §1.1 인근 Rationale 에 소급 각주
  한 줄 — 2026-07-30 의 유사 사례(retry-reentry opt-in 미전파)와 대칭 (`20_36_36` WARNING 1
  제안 (3)). `developer` 는 `spec/` 쓰기 권한이 없어 이번 PR 로는 못 넣는다. 그래서
  frontmatter 는 `spec_impact: none` 을 유지한다 — 이 PR 이 실제로 바꾸는 spec 은 0건이고,
  리스트에 적으면 "이 PR 이 그 파일을 고쳤다" 는 거짓이 된다.
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
