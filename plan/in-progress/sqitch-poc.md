---
worktree: (unstarted)
started: 2026-06-05
owner: developer
related_plan: plan/in-progress/migration-tooling-evaluation.md
related_spec: spec/conventions/migrations.md
---

# Sqitch PoC 계획서

> 작성일: 2026-06-05
> 선행 평가: [`migration-tooling-evaluation.md`](migration-tooling-evaluation.md) §6.B
> 현행 규약(SoT): [`spec/conventions/migrations.md`](../../spec/conventions/migrations.md)
>
> **상태**: 미착수(조건부). 본 PoC 는 선행 평가의 **6.A(저비용 Flyway 보강)로도 병렬
> 충돌을 못 따라갈 때** 발동한다. 발동 결정 전까지 Flyway 가 단일 진실이다.
> 본 plan 은 **검증(PoC)만** 다룬다 — 전면 마이그레이션은 PoC 통과(G5 PASS) 후 별 plan.

## 0. 목적과 비목적

**목적**: Sqitch 가 본 프로젝트의 제약(병렬 에이전트 충돌 + raw PG 기능 + 무료 플랜 +
무중단 운영)을 실제로 만족하는지 **격리된 실험으로 증명/반증**한다.

**비목적**:
- 운영 Flyway 의 제거·교체 (PoC 는 운영에 무영향, 별도 실험 DB/디렉토리에서만).
- 40개 마이그레이션 전체 포팅 (PoC 는 대표 샘플 5~6개만).
- TypeORM 교체 (Sqitch 는 Flyway 자리만 대체, TypeORM 쿼리 계층은 유지).

## 1. 성공 기준 (PoC 전체 go/no-go)

아래를 **모두** 만족하면 Sqitch 채택을 정식 제안한다. 하나라도 실패하면 6.A 로 회귀하고
사유를 §7 에 기록한다.

- [ ] **C1 병렬 충돌**: 2개 worktree 가 동시에 변경을 추가했을 때, V번호 충돌 없이
      `sqitch.plan` 텍스트 머지만으로 해결된다(재번호 0회).
- [ ] **C2 raw PG**: `CREATE INDEX CONCURRENTLY` + HNSW + halfvec + `NOT VALID` 2-step 이
      Sqitch 비-트랜잭션 변경으로 정상 배포된다(Flyway `TRANSACTIONAL_LOCK` hang 등가 이슈 없음).
- [ ] **C3 의존성 안전망**: 의존성 누락 시 fail-fast 로 잡는 린트가 동작한다.
- [ ] **C4 baseline**: V001~V072 적용된 기존 DB 를 무중단으로 Sqitch 레지스트리에 인입한다.
- [ ] **C5 운영 형태**: 현행과 동일하게 Docker 이미지 → K8s Job 으로 배포 가능하다.
- [ ] **C6 revert/verify**: deploy/revert/verify 3종이 대칭 동작하고, verify 가 반쪽 적용을 잡는다.

## 2. 게이트별 작업

### G0 — 환경 셋업 (½일)

- [ ] Sqitch + Perl 포함 Docker 이미지 작성 (또는 공식 `sqitch/sqitch` 기반).
      `sqitch.conf` target = 격리 실험 DB(`clemvion_sqitch_poc`).
- [ ] pgvector/pg_trgm extension 포함 PG 이미지로 실험 DB 기동 (현행 e2e 와 동일 base).
- [ ] `sqitch init clemvion --engine pg` 로 plan/registry 골격 생성.

### G1 — 대표 샘플 포팅 (1일) → **C2, C6 검증**

현행에서 난이도/특성이 다른 대표 5~6개를 deploy/revert/verify 3종으로 포팅:

- [ ] 단순 테이블 추가 (예: `V063__secret_store.sql`) — 기본 case.
- [ ] 컬럼 추가 + 의존성 (`V044`→`V045` 류, `[prev]` 의존 선언 실험).
- [ ] `CREATE INDEX CONCURRENTLY` 단건 (`.conf` 등가 = Sqitch 비-트랜잭션 변경) — **C2**.
- [ ] HNSW/halfvec 인덱스 (`V023`/`V031` 류, pgvector ≥0.7) — **C2**.
- [ ] `NOT VALID` + `VALIDATE CONSTRAINT` 2-step — **C2**.
- [ ] 각 변경에 verify 스크립트 작성 → 일부러 deploy 를 반쪽 깨뜨려 verify 가 잡는지 — **C6**.

> **검증 포인트(C2)**: Flyway 에서 겪은 `FLYWAY_POSTGRESQL_TRANSACTIONAL_LOCK` hang 의
> Sqitch 등가물이 있는지 명시 기록. Sqitch 는 변경 단위로 트랜잭션을 끌 수 있으나
> (`-- @transaction off` 류 디렉티브/플래그) 실제 CONCURRENTLY 동작을 반드시 실측.

### G2 — 병렬 충돌 재현 (½일) → **C1 검증**

- [ ] worktree A·B 에서 각각 독립 변경을 `sqitch add` → 두 `sqitch.plan` 을 머지.
- [ ] 충돌이 "두 줄 보존" 텍스트 머지로 끝나는지, 재번호가 0회인지 기록.
- [ ] 의존성 있는 변경을 일부러 잘못된 순서로 plan 에 두고 `sqitch deploy` 가
      의존성으로 올바른 순서를 강제하는지 확인.

### G3 — 의존성 누락 린트 (½일) → **C3 검증**

- [ ] 에이전트가 `[dep]` 선언을 빠뜨린 변경을 만든 시나리오 재현.
- [ ] CI 가드 PoC: 변경 SQL 이 참조하는 객체(테이블/컬럼)가 같은 plan 내 선행 변경에
      선언됐는지 정적 검사하는 최소 스크립트 작성(현행 `check-migration-versions.py` 의
      Sqitch 등가물). **완성품 아님 — 실현 가능성만 증명.**

### G4 — 기존 DB baseline 인입 (½일) → **C4 검증**

- [ ] V001~V072 가 적용된 DB 스냅샷에 Sqitch 레지스트리를 무중단 인입하는 절차 검증
      (Flyway `flyway_schema_history` ↔ Sqitch registry 공존/전환 전략).
- [ ] "이미 존재하는 스키마를 deploy 없이 registry 에만 기록"(baseline) 동작 확인.

### G5 — 종합 판정 (½일)

- [ ] §1 C1~C6 체크 종합 → PASS/FAIL 판정표 작성.
- [ ] 산출물: PoC 결과 요약 + (PASS 시) 전면 마이그레이션 plan 초안 / (FAIL 시) 6.A 회귀 사유.

## 3. 리스크와 완화

| 리스크 | 영향 | 완화 |
| --- | --- | --- |
| CONCURRENTLY 가 Sqitch 트랜잭션 모델과 충돌 | C2 실패 → 채택 불가 | G1 에서 최우선 실측. 실패 시 즉시 FAIL 판정(나머지 게이트 skip) |
| 의존성 수동선언을 에이전트가 누락 | 조용한 순서 사고 | C3 린트를 채택 **전제조건**으로. 린트 없이는 채택 불가 |
| Perl 런타임/이미지 크기 증가 | 빌드·배포 부담 | G0 에서 이미지 크기 측정, 현행 Flyway 이미지와 비교 기록 |
| 무료 플랜 merge queue 부재는 그대로 | 병렬 머지 race 잔존 | Sqitch 도 plan 파일 race 존재 — 단 재번호 불요라 6.A auto-renumber 와 동급 이상 |

## 4. 산출물

- [ ] `review/` 또는 본 plan 내 PoC 결과 판정표(§1 C1~C6 PASS/FAIL + 근거).
- [ ] (PASS) 전면 마이그레이션 plan 초안 + `spec/conventions/migrations.md` §7 개정 제안.
- [ ] (FAIL) 6.A 회귀 결정 + 재시도 트리거 조건.

## 5. 일정 (대략)

G0~G5 합산 **약 3.5~4일**(1인 기준). C2(G1) 가 가장 큰 불확실성 — 여기서 빠르게
FAIL 나면 나머지를 조기 종료해 비용을 줄인다.

## 6. 의존성·선행 조건

- 선행: [`migration-tooling-evaluation.md`](migration-tooling-evaluation.md) §8 에서
  "6.B Sqitch PoC 발동" 결정.
- 비차단: 6.A(Flyway 보강)와 **병행 가능** — 6.A 가 충분하면 본 PoC 는 착수 안 함.

## 7. 결과 기록 (PoC 완료 후 채움)

> (PoC 실행 후 C1~C6 판정·근거·최종 권고를 여기에 기록한다.)
