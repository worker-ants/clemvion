---
title: schedule 인덱스 전략 정정 — 쓰이지 않는 부분 인덱스 교체
worktree: plan-in-progress-items-b0c80b
started: 2026-09-05
owner: planner
status: in-progress
priority: P2
spec_impact:
  - spec/1-data-model.md
---

# schedule 인덱스 전략 정정

> 출처: `spec-draft-nullable-notation-followups.md` 의 마지막 열린 developer 항목
> — *"`idx_schedule_next_run` — 부분 조건이 어떤 쿼리와도 맞지 않는다"*.
> 그 항목은 **`EXPLAIN`·테이블 크기 실측**을 선행 조건으로 걸어 두었다. 실측했고,
> **등재된 두 선택지 (a)/(b) 가 둘 다 답이 아니었다.**

---

## 1. 실측

Postgres 18.4 (e2e 와 같은 `pgvector/pgvector:pg18`), 실제 마이그레이션의 DDL·인덱스
집합을 그대로 재현한 일회용 컨테이너. 두 규모에서 쟀다.

### 대상 쿼리 — 코드에서 전수 열거한 13개 호출부 중 인덱스가 관여할 수 있는 둘

| 쿼리 | 술어 | 출처 |
|---|---|---|
| **Q1 목록** | `WHERE s.workspace_id = $1` + `ORDER BY s.next_run_at DESC LIMIT 20` (+ `trigger`·`workflow` LEFT JOIN) | `schedules.service.ts:80-105` |
| **Q2 부팅** | `WHERE s.is_active = true` (+ `trigger` LEFT JOIN) | `schedule-runner.service.ts:114` |

나머지 11개는 전부 PK(`id`) 또는 `trigger_id` 술어라 `idx_schedule_trigger_id`·`schedule_pkey`
가 받는다. **`next_run_at` 을 술어로 쓰는 자리는 Q1 의 `ORDER BY` 하나뿐이다.**

### Q1 — 200,000행 (워크스페이스 2,000 × 100)

| 인덱스 | 계획 | 필터로 버린 행 | 실행 시간 |
|---|---|---|---|
| **현재** `(next_run_at, is_active) WHERE is_active` | Parallel Seq Scan | 66,633 × 3 | 7.80 ms |
| (a) 인덱스 없음 | Parallel Seq Scan | 66,633 × 3 | 5.86 ms |
| (b) `(next_run_at)` | Index Scan Backward | **39,797** | **12.39 ms** |
| (c) `(workspace_id, next_run_at)` | Index Scan Backward | 0 | **0.188 ms** |
| (d) `(workspace_id)` | Bitmap + top-N heapsort | 0 | 1.060 ms |

### Q1 — 5,000행 (워크스페이스 100 × 50)

| 인덱스 | 계획 | 실행 시간 |
|---|---|---|
| 현재 | Seq Scan (schedule·trigger **둘 다**) | 0.589 ms |
| (c) | Index Scan Backward | **0.089 ms** |

### Q2 부팅 — 부분 인덱스가 있으나 없으나 같다

`is_active = TRUE` 는 부분 인덱스 술어를 **함의한다**. 그런데 활성 비율이 70%(140,168/200,000)
라 선택도가 낮아 플래너가 인덱스를 고르지 않는다 — 인덱스 유·무 모두 **Parallel Seq Scan**
(64.5 ms / 50.0 ms, 계획 동일).

---

## 2. 등재된 두 선택지가 왜 둘 다 답이 아닌가

### (a) DROP — 결론은 맞았지만 **근거가 틀렸다**

항목은 *"지금 어떤 쿼리도 못 쓰므로 쓰기 비용만 낸다"* 라고 적었다. 앞 절이 보이듯
**Q2 는 부분 인덱스 술어를 함의한다** — "못 쓴다" 가 아니라 "쓸 수 있는데 안 쓴다"(선택도
70%)가 정확하다. 결론(제거해도 잃는 것이 없다)은 실측이 뒷받침하지만, 근거를 그대로 두면
**활성 비율이 낮아지면 결론이 뒤집힌다**는 잘못된 인상을 준다. 실제로는 활성 비율이 낮아져
Q2 가 이 인덱스를 쓰게 되더라도, Q2 는 **부팅 시 1회** 도는 쿼리다.

### (b) 부분 조건만 떼기 — **실측이 반증했다**

항목은 *"UI 정렬이 실제로 쓸 수 있는 인덱스를 준다"* 라고 기대했다. 실제로는 플래너가 그
인덱스를 **집어 들고 더 느려진다** — `next_run_at` 순으로 훑으며 `workspace_id` 로 거르므로
20행을 찾으려 **39,797개 엔트리**를 버린다. 아무 인덱스도 없을 때(5.86 ms)보다 **2.1배 느리다**
(12.39 ms).

원인은 **컬럼 순서**다. 이 쿼리의 술어는 `workspace_id` 등치이고 `next_run_at` 은 정렬일 뿐인데,
(b) 는 정렬 컬럼을 선두에 놓는다.

### 답은 (c) — 선두 컬럼을 술어로 바꾼다

`(workspace_id, next_run_at)` 은 등치 술어로 진입해 정렬 순서대로 나오므로 20행에서 멈춘다.
버리는 행 0, **0.188 ms** — 현재 상태 대비 31배, 5,000행에서도 6.6배다.

(d) `(workspace_id)` 단독도 크게 낫지만(1.060 ms), 정렬을 인덱스가 주지 못해 워크스페이스의
전체 행을 읽고 top-N 정렬한다. 워크스페이스당 행이 늘수록 격차가 벌어진다.

> **동시에 드러난 것**: schedule 에는 `workspace_id` 인덱스가 **아예 없었다**. 목록 조회는
> 정렬 컬럼과 무관하게 매번 전체 테이블을 훑고 있었다. (c) 는 선두 컬럼이 `workspace_id`
> 라 기본 정렬(`created_at`)에서도 Bitmap 진입을 준다 — 실측 0.904 ms (현재 5.86 ms).

---

## 3. 변경안 (A) — §3 인덱스 전략의 Schedule 행 교체

종전:

```
| Schedule | (next_run_at, is_active) | 스케줄 목록의 "다음 실행" 정렬·필터 (UI 조회용). **발사 경로가 아니다** — 발사는 BullMQ job scheduler 가 한다 ([data-flow §3.2](./data-flow/10-triggers.md#32-schedulenext_run_at-계산)) |
```

변경:

```
| Schedule | (workspace_id, next_run_at) | 스케줄 목록 조회 — `WHERE workspace_id = ?` 진입 + `ORDER BY next_run_at` 정렬을 한 인덱스가 함께 준다. 선두가 `workspace_id` 라 다른 정렬 컬럼(`created_at` 등)에서도 진입을 준다. **발사 경로가 아니다** — 발사는 BullMQ job scheduler 가 한다 ([data-flow §3.2](./data-flow/10-triggers.md#32-schedulenext_run_at-계산)). 종전 `(next_run_at, is_active) WHERE is_active` 를 대체한다 — 목록이 `is_active` 를 걸지 않아 그 부분 인덱스를 쓸 수 없었다. CONCURRENTLY, V110 |
```

## 4. 변경안 (B) — 빠져 있던 `(trigger_id)` 행 추가

`V106` 이 `idx_schedule_trigger_id` 를 추가했는데 **이 표에 행이 없다**. 같은 표·같은
테이블이므로 함께 메운다:

```
| Schedule | (trigger_id) | 트리거 목록 cron·nextRunAt enrichment 배치 조회 (`WHERE trigger_id IN (...)`). Postgres 는 FK 에 인덱스를 자동 생성하지 않는다. CONCURRENTLY, V106 |
```

---

## 5. 이 draft 가 구현을 포함하지 않는 이유

인덱스 교체는 **마이그레이션**이라 `developer` 트랙이다. 이 draft 는 `spec/` 서술만 실제에
맞춘다. 구현(V110)은 같은 PR 의 developer 단계에서 이어서 수행한다 — spec 과 마이그레이션이
갈라진 채 머지되면 그것이 이 저장소가 반복해 싸워 온 drift 그 자체가 된다.

---

## Rationale

### 왜 "쓰이지 않으니 지운다" 에서 멈추지 않았나

등재된 두 선택지는 **인덱스를 지울까 고칠까**만 물었다. 그런데 실측해 보니 문제는 그
인덱스가 아니라 **`workspace_id` 인덱스의 부재**였다 — 목록 조회가 매번 전 테이블을 훑고
있었고, 부분 인덱스는 그 사실을 가리는 장식이었다. (a) 만 하면 "쓸모없는 것을 치웠다" 로
끝나고 진짜 갭은 그대로 남는다.

### 왜 (d) 가 아니라 (c) 인가

(d) `(workspace_id)` 단독이 더 작고 쓰기 비용이 싸다. 그런데 `next_run_at` 정렬은 이
목록의 **화이트리스트에 든 정렬 컬럼**(`schedules.service.ts:119`)이고, (c) 는 그 정렬을
인덱스가 직접 주므로 워크스페이스당 행 수와 무관하게 상수 시간이다. 두 번째 컬럼 하나의
크기 차이로 정렬 비용의 스케일 의존성을 없애는 거래라 (c) 를 택한다.

### 기각한 대안 — 두 인덱스 병설

`(workspace_id)` 와 `(next_run_at)` 을 따로 두는 안은 검토하지 않았다. 실측에서 (b)
`(next_run_at)` 이 **단독으로 해를 끼치는 것**(플래너가 집어 들고 2.1배 느려짐)이 확인됐기
때문이다. 존재만으로 잘못된 계획을 유도하는 인덱스는 병설 대상이 아니다.

### 표의 다른 행과의 정합

이 표는 이미 partial 인덱스에 술어를 적고(`Execution (trigger_id, started_at DESC) WHERE
trigger_id IS NOT NULL`), 마이그레이션 버전을 끝에 붙이는 관례(`V096`·`V095`·`V034`)를
갖고 있다. 두 신규/변경 행 모두 그 형식을 따랐다.
