---
title: "`TERMINAL_DURATION_MS_SQL` 을 실제 Postgres 에서 값으로 검증한다"
status: in-progress
worktree: eia-tracker-groom-7d0396
started: 2026-08-23
owner: developer
spec_impact: none
---

# `TERMINAL_DURATION_MS_SQL` 안전망

정본 트래커
[`spec-sync-external-interaction-api-gaps.md`](./spec-sync-external-interaction-api-gaps.md)
의 **W10 + 바로 아래 저비용 형제(W7)** 를 함께 집행한다. 트래커 문면:

> *"단위 테스트는 문자열 `toContain` 뿐이고, 이 SQL 을 태우는 유일한 e2e 도 `duration_ms` 를
> SELECT/assert 하지 않는다. **부호·단위(초 vs ms)·클램프 오류를 잡을 안전망이 없다** —
> 이번 라운드가 클램프 부재를 리뷰로만 잡았다는 사실이 그 비용을 실증한다."*

## 왜 단위 테스트로는 원리적으로 못 잡나

이 SQL 은 **문자열**이다. 단위 테스트가 할 수 있는 건 그 문자열에 `LEAST` 가 들어 있는지
보는 것뿐이고, 그건 *"`EXTRACT(EPOCH …)` 가 초를 주므로 `* 1000` 이 필요하다"* 같은 **의미**를
검증하지 못한다. 초/밀리초를 헷갈려도, 부호 분기를 뒤집어도 `toContain` 은 초록이다.

**실행해야만 갈리는 것**이라 실제 Postgres 에 태운다. e2e 헬퍼 `createDbClient()` 가
같은 network 의 postgres 로 raw `pg` 접속을 준다.

## 무엇을 단언하나

SQL 을 합성 행(`SELECT $2::timestamptz AS started_at`)에 적용해 **정본 문자열 그대로** 태운다
— 테스트가 SQL 을 재작성하면 검증 대상이 사라진다. 이름 있는 파라미터만 `$1` 로 바꾼다.

| 케이스 | 기대 | 잡는 결함 |
| --- | --- | --- |
| 1,500ms 경과 | `1500` | **단위** — 초로 계산하면 `1`/`2` 가 나온다 |
| `finishedAt < started_at` | `NULL` | **부호** — 종전 `GREATEST(0, …)` 회귀(0 vs null) |
| 100일 경과 (int4 초과) | `PG_INT4_MAX` | **클램프** — 없으면 `integer out of range` 로 문장 전체 실패 |
| 0ms | `0` | 경계 — null 과 0 의 구분 |

### 형제 W7 — 하드코딩 컬럼명과 **스키마 자체**를 대조

SQL 이 `started_at` 을 문자열로 하드코딩한다. `information_schema.columns` 로 대조하면
컬럼명뿐 아니라 **`duration_ms` 가 정말 `integer`(int4)인지**도 확인된다 — 그게 `PG_INT4_MAX`
클램프의 **전제**다. 전제가 조용히 바뀌면(예: `bigint` 승격) 클램프는 불필요한 절단이 된다.

## 작업

- [ ] `/consistency-check --impl-prep`
- [ ] e2e 신설 — SQL 값 검증 4케이스 + 스키마 전제 2건
- [ ] **뮤테이션으로 판별력 검증** (아래 기준)
- [ ] 트래커 W10·W7 종결
- [ ] TEST WORKFLOW 4단계 + 타입체크 ratchet
- [ ] `/ai-review`

## 검증 기준

단위 테스트가 못 잡는다는 것이 이 작업의 전제이므로, **그 전제부터 뮤테이션으로 실증한다** —
아래 뮤턴트에서 기존 단위 스펙이 GREEN 이고 신규 e2e 만 RED 여야 한다.

- **M1 `* 1000` 제거** (초 단위 버그) → 신규 RED, 기존 단위 GREEN 예상
- **M2 `LEAST(...)` 제거** (클램프 부재) → 신규 RED (`integer out of range`)
- **M3 `THEN NULL` → `THEN 0`** (부호 sentinel 회귀) → 신규 RED

기존 단위 스펙이 M1·M3 에서 **GREEN 이면** 트래커의 주장(*"안전망이 없다"*)이 실측으로
확인되는 것이고, RED 면 내 전제가 틀린 것이니 그때 기록한다.

뮤테이션은 **커밋 후** `cp` 백업으로. `git checkout`/`reset --hard` 금지.
