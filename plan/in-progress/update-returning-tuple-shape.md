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

## 무엇이 깨져 있었나 (7곳)

| 지점 | 소비 | 실제 |
|---|---|---|
| `execution-engine` `admitExecutionOrDefer` | `rows.length === 1` | **항상 거짓** → admission 영영 실패 |
| `execution-engine` `updateExecutionStatus` | `updated.length > 0` | **항상 참** → "동시 cancel 선점" 분기 사문화 |
| `knowledge-base` re-extract CAS 락 | `acquired.length === 0` | **항상 거짓** → 락이 거절하지 않음(동시 재추출) |
| `knowledge-base` re-embed CAS 락 | `acquired.length === 0` | 〃 |
| `knowledge-base` embedding 재큐 | `rows.map(r => r.id)` | `[undefined, undefined]` → 가짜 job 2개 |
| `knowledge-base` graph 재큐 | `rows.length` / `rows.slice` | 〃 |
| `knowledge-base` reset | `reset.length === 0` | 빈 KB 가 `in_progress` 로 좌초 |

**이 저장소는 이미 이 결함을 두 번 겪고 그 자리만 고쳤다** — `agent-memory-admin` 의
`deletedRowCount`(NotFound 미변환 버그), `stuck-document-recovery` 의 구조분해(가짜 job
2개 큐잉 회귀). 처방이 지점에 갇혀 있어 나머지 7곳에 전파되지 않았다.

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
- 관련 32 스위트 **851 passed**, `lint --max-humans 0` 통과
- typecheck ratchet **199 / 38파일 baseline 일치** (새 테스트가 만든 타입 에러 2건은
  `--update` 로 기준선을 올리지 않고 캐스트로 정정)
- e2e `execution-concurrency-cap` 재실행 — 아래 체크리스트

## 체크리스트

- [x] 전역 감사 — 41 소비 지점 분류, 원래 fail-open 전제는 **반증**
- [x] TypeORM 반환 shape 실측 (소스 읽기 + 실제 DB 프로브 2회)
- [x] e2e 가 통과하는데 코드가 틀린 이유 규명 (rehydration 우회)
- [x] 헬퍼 + 7곳 적용
- [x] RED 재현 후 GREEN 확인
- [x] 구조적 재발 가드
- [ ] e2e 재실행으로 경로 정상화 확인
- [ ] `/ai-review` + `--impl-done`
- [ ] 후속 ②(`updateExecutionStatus` 트랜잭션화)·③(EIA `durationMs`/`result.outputs` emit)

## 후속

- **②·③ 은 이 PR 뒤로 미룬다.** ②는 대상 함수가 바로 `updateExecutionStatus` 라 셰이프
  수정이 선행이었고, 이제 그 전제가 정리됐다. ③은 독립이다.
- `.query()` 사각지대(`let`·구조분해·체이닝)는 정규식이 아니라 AST 로 넓혀야 한다 —
  유한한 문제를 무한한 문제와 바꾸지 않도록 착수 전 비용을 먼저 본다.

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
