---
worktree: migration-tooling-eval-1de449
started: 2026-06-05
owner: planner
related_spec: spec/conventions/migrations.md
---

# 마이그레이션 도구 비교 평가 — Flyway vs Sqitch vs Prisma

> 작성일: 2026-06-05
> 후속 PoC 계획: [부록 A](#부록-a--sqitch-poc-계획-조건부-미발동) (종전 별 문서 `sqitch-poc.md` — 2026-07-16 흡수)
> 현행 규약(SoT): [`spec/conventions/migrations.md`](../../spec/conventions/migrations.md)
>
> **상태**: 평가/의사결정 단계. 본 문서는 **현행 규약을 변경하지 않는다** — Flyway 가
> 여전히 단일 진실이다. 도구 교체가 채택되면 그때 `project-planner` 가
> `consistency-check --spec` 후 `spec/conventions/migrations.md` 를 정식 개정한다.

## 1. 배경 — 풀려는 문제

`codebase/backend/migrations/` 의 Flyway 버전 번호(`V<정수>`) 충돌이 **잦다**. 근본 원인은
도구 자체가 아니라 운영 모델이다:

- **여러 Claude 에이전트가 동시에** 마이그레이션을 작성하며, 각 에이전트가 조율 없이
  독립적으로 `max(V)+1` 을 집는다 → 같은 번호 점유가 **구조적 필연**이다.
- 현행 3단계 가드(`migrations.spec.ts` / `check-migration-versions.py` /
  `check-duplicate-versions.sh`)는 충돌을 **감지**할 뿐 **자동 해결**하지 못한다 →
  매번 rebase + 번호 양보가 필요하다.
- 마이그레이션 다수가 인덱스 전용(`CREATE INDEX CONCURRENTLY`)으로 **서로 순서
  의존성이 없는데도** 전순서(total order) 정수 레일에 줄 세워져 충돌 표면을 키운다.

평가 기준은 따라서 "**조율 없이 병렬로 일하는 다수 작성자(에이전트) 환경에서 충돌을
얼마나 줄이고, 남은 충돌을 얼마나 쉽게 자동 해결하는가**" 가 1순위다.

## 2. 현행 스택 제약 (모든 후보가 만족해야 함)

- 백엔드: **NestJS 11 + TypeORM 0.3.28**(엔티티 40개, `synchronize: false`) + raw `pg`.
  스키마의 단일 진실은 **Flyway(순수 SQL)** 이며, TypeORM 은 쿼리/엔티티 매핑 전용.
- **무거운 raw PostgreSQL 기능**: `pgvector`/`halfvec`, **HNSW partial 인덱스**,
  `CREATE INDEX CONCURRENTLY`, `NOT VALID` + `VALIDATE CONSTRAINT` 2-step,
  `.conf` 비-트랜잭션 모드, `FLYWAY_POSTGRESQL_TRANSACTIONAL_LOCK=false` 튜닝.
- 배포 형태: 전용 Docker 이미지를 K8s Job/init container 로 실행 (backend Pod 기동 전).
- **무료 GitHub private 플랜** — merge queue / branch protection "up to date" 강제 불가
  (`migrations.md` §7 대안 3·4 가 이미 기각/보류한 사유).

## 3. 후보별 충돌 모델 (핵심 비교)

| 도구 | 버전/식별 방식 | 병렬 시 충돌 형태 | 자동 해결 난이도 | drift 위험 |
| --- | --- | --- | --- | --- |
| **Flyway (현행)** | 단조 증가 정수 `V<N>` | 두 파일이 같은 정수 N 점유 | **쉬움** — 파일 rename 으로 재할당 (아직 main 에 적용 안 된 append-only 파일) | 없음 |
| **Sqitch** | 번호 없음 — **이름 + 의존성 DAG** | `sqitch.plan` 에 두 줄 append | **가장 쉬움** — 두 줄 보존, 의존성만 맞으면 순서 무관, 재번호 불요 | 없음 |
| **Prisma Migrate** | **타임스탬프** prefix | 공유 `schema.prisma` 내용 충돌 + migration history drift | **어려움** — drift 자동 해결 난망 | **높음** |

요지:

- **Flyway** 충돌은 깔끔히 감지되고 rename 한 번으로 해결되지만, "어떤 새 번호를 줄지"
  조율이 필요해 현재 수동 비용이 발생한다.
- **Sqitch** 는 번호 자체를 없애 충돌의 근원을 제거한다. 남는 충돌(plan 파일 동시 append)은
  재번호가 없어 텍스트 머지로 끝난다 — **병렬 단일 축에서 최선**.
- **Prisma** 는 충돌을 "파일명 정수" → "공유 선언 파일 + history drift" 로 **악화**시킨다.
  게다가 타임스탬프 prefix 는 `migrations.md` §7 **대안 1(타임스탬프)** 이 이미 명시적으로
  기각한 방식이다(작성 시계/머지 순서가 의도된 실행 순서와 어긋남). 병렬 에이전트는 시계가
  거의 동시라 순서가 더 비결정적이다.

## 4. 가중 결정 매트릭스

기준별 가중치(병렬 충돌 1순위)와 1~5 점(높을수록 우수). 점수는 §2 제약 + §3 모델 기반.

| 기준 | 가중 | Flyway(현행) | Sqitch | Prisma |
| --- | ---: | ---: | ---: | ---: |
| **병렬 충돌 회피·자동 해결** | 30% | 2 | **5** | 1 |
| **순서/의존성 안전성** | 20% | 4 (전순서 공짜 보장) | 3 (수동 의존성 선언) | 2 (timestamp 순서 어긋남) |
| **raw PG 기능 적합성**(pgvector/HNSW/CONCURRENTLY/NOT VALID) | 20% | **5** | 4 (순수 SQL, CONCURRENTLY 재구축 필요) | 2 (schema diff 가 미지원→수동 SQL) |
| **전환 비용**(낮을수록 高점) | 15% | **5** (현행) | 2 (전면 재작성) | 1 (ORM 교체+40엔티티+가드 재구축) |
| **revert/verify 운영 안전성** | 10% | 2 (`-- DOWN:` 주석만) | **5** (deploy/revert/verify 3종 강제) | 3 |
| **생태계·후원·런타임** | 5% | 4 | 3 (Perl, 소규모 후원) | **5** (대형 후원) |
| **가중 합계** | 100% | **3.45** | **3.95** | **1.75** |

> 매트릭스는 의사결정 보조다. 가중치는 "병렬 충돌이 현재 가장 아픈 지점" 이라는 전제에서
> 설정됐으며, 전제가 바뀌면(예: 병렬성이 낮아지거나 raw PG 의존이 더 커지면) 결론도 바뀐다.

## 5. 해석

- **Sqitch (3.95)** 가 병렬 충돌 축에서 가장 앞서며 revert/verify 보너스도 크다. 단
  "전순서 공짜 안전망 → **수동 의존성 선언**" 으로 안전망 성격이 바뀌는 점이 병렬 에이전트
  환경의 새 리스크다(에이전트가 의존성을 누락하면 *더 조용한* 순서 사고). 전환 비용도 크다.
- **Flyway (3.45)** 는 현행 자산·raw PG 적합성·전환 0 비용이 강점. 약점은 병렬 충돌의
  수동 해결뿐인데, 이는 **도구 교체 없이** 보강 가능하다(§6).
- **Prisma (1.75)** 는 본 문제에 부적합 — 충돌 악화 + 기각된 타임스탬프 + raw PG 부적합 +
  최대 전환 비용. **탈락.**

## 6. 권고 — 2단계 접근

도구 교체는 비가역적·고비용이므로, **저비용 보강을 먼저 소진**한 뒤 한계가 오면 교체를
검토한다.

### 6.A (1순위, 저비용) Flyway 유지 + 충돌을 "자동 해결" 로 승격

도구를 바꾸지 않고 충돌 빈도·비용을 직접 공략한다.

1. **통합 시점 auto-renumber** — `merge-coordinator` + `integration-order-planner` 가 이미
   topological 통합 순서를 정한다. 거기에 "마이그레이션 `V<N>` 파일을 머지 순서대로 결정적
   재번호" 를 추가한다. 에이전트가 어떤 번호를 집든 통합기가 deterministic 하게 정리 →
   "감지 후 수동" 에서 "자동 해결" 로 승격. Flyway 정수 파일은 rename 만으로 재할당되므로
   궁합이 완벽(Prisma 는 불가).
2. **인덱스류를 Flyway Repeatable(`R__`)로 분리** — `R__` 은 버전 번호가 없어 충돌 불가.
   멱등 인덱스(`CREATE INDEX IF NOT EXISTS ... CONCURRENTLY`)가 다수인 분포에 효과 큼.
   순서 의존 DDL(컬럼/제약 추가)만 `V` 로 유지.

> 6.A 는 현행 3단계 가드·운영 노하우·spec 규약을 보존한 채 충돌을 자동화한다. 무료 플랜의
> merge queue/branch protection 부재(§7 대안 3·4)를 **기존 도구로 우회**하는 셈.

### 6.B (2순위, 조건부) Sqitch PoC

6.A 로도 병렬성 증가를 못 따라가면 Sqitch 를 정식 후보로 PoC 한다. 상세 계획·go/no-go
게이트는 **[부록 A](#부록-a--sqitch-poc-계획-조건부-미발동)** (종전 별 문서 `sqitch-poc.md` 를
2026-07-16 에 흡수 — 근거는 부록 머리말). PoC 가 반드시 검증할 핵심 리스크:

1. **CONCURRENTLY/HNSW/halfvec/NOT VALID 등가 처리** — Flyway `.conf` +
   `TRANSACTIONAL_LOCK` 노하우를 Sqitch 비-트랜잭션 변경으로 재현 가능한가.
2. **의존성 누락 린트** — 에이전트가 `[dep]` 선언을 빠뜨릴 때 fail-fast 로 잡는 가드.
   (전순서 공짜 안전망 상실을 보상.)
3. **기존 DB baseline 흡수** — V001~V072 가 적용된 운영 DB 를 Sqitch 레지스트리로 무중단
   인입.

## 7. 의사결정 기록 (Rationale)

- **Prisma 기각**: §3·§4. 충돌 악화 + `migrations.md` §7 대안 1(타임스탬프) 재현 + raw PG
  부적합 + 최대 전환 비용. (본 결론은 기존 §7 대안 1 기각과 **연속**이다 — 새 근거로
  뒤집는 것이 아니라 동일 원칙을 Prisma 에 적용.)
- **Sqitch 즉시 채택 보류**: 우위는 분명하나 전환 비용·의존성 수동선언 리스크가 커서,
  저비용 6.A 를 먼저 소진하는 것이 비용 대비 효율이 높다(`migrations.md` §7 가 견지하는
  "race 빈도 대비 비용" 판단과 동일 철학).
- **outOfOrder/타임스탬프 재론 안 함**: `migrations.md` §7 대안 1·2 에서 이미 기각.

## 8. 다음 단계

- [ ] 사용자/리뷰 결정: 6.A 먼저 진행 vs 6.B Sqitch PoC 병행
- [ ] (6.A 채택 시) `merge-coordinator` auto-renumber + `R__` 분리를 각각 plan 으로 분기
- [ ] (6.B 채택 시) [부록 A](#부록-a--sqitch-poc-계획-조건부-미발동) 게이트 G0 부터 착수
- [ ] 최종 도구 결정 확정 시 `project-planner` 가 `consistency-check --spec` 후
      `spec/conventions/migrations.md` §7 에 결정 기록

---

## 부록 A — Sqitch PoC 계획 (조건부, 미발동)

> **흡수 경위 (2026-07-16 grooming)**: 본 부록은 종전 별 문서 `plan/in-progress/sqitch-poc.md`
> (작성 2026-06-05, `worktree: (unstarted)`) 를 그대로 흡수한 것이다. 그 문서는 **진행 중 작업이
> 아니라 조건부 우발 계획(contingency)** 이었다 — 발동 조건이 본 평가 §8 의 "6.B 채택" 결정인데,
> 선행 단계인 6.A 조차 착수되지 않아 발동 전제가 성립할 수 없었고, 그 상태로 6주간
> `plan/in-progress/` 에 정체하며 "진행 중 작업" 목록을 오염시켰다. **삭제가 아니라 흡수**인
> 이유는 아래 게이트 설계(C1~C6 성공기준 + G0~G5 단계)가 재사용 가치를 갖기 때문이다 —
> §8 에서 6.B 가 채택되면 이 부록을 별 plan 으로 다시 분리해 착수한다.
>
> **상태**: 미착수(조건부). 본 PoC 는 §6.A(저비용 Flyway 보강)로도 병렬 충돌을 못 따라갈 때
> 발동한다. 발동 결정 전까지 **Flyway 가 단일 진실**이다 ([`spec/conventions/migrations.md`](../../spec/conventions/migrations.md)).
> 본 부록은 **검증(PoC)만** 다룬다 — 전면 마이그레이션은 PoC 통과(G5 PASS) 후 별 plan.

### A.0 목적과 비목적

**목적**: Sqitch 가 본 프로젝트의 제약(병렬 에이전트 충돌 + raw PG 기능 + 무료 플랜 +
무중단 운영)을 실제로 만족하는지 **격리된 실험으로 증명/반증**한다.

> ⚠️ **전제 재검토 필요 (2026-07-16)**: 위 "무료 플랜" 제약은 §2 에서 상속된 것인데, **더 이상
> 사실이 아니다** — 저장소가 PUBLIC 으로 전환돼 branch protection·ruleset·required status check 가
> 무료로 가용하다. 이는 `migrations.md` §7 대안 3·4 의 기각 근거(유료 플랜 한정)를 직접 무효화하며,
> 6.B 발동 여부 판단 자체에 영향을 준다(§8 참조). PoC 착수 전 이 전제를 반드시 재평가할 것.

**비목적**:
- 운영 Flyway 의 제거·교체 (PoC 는 운영에 무영향, 별도 실험 DB/디렉토리에서만).
- 마이그레이션 전체 포팅 (PoC 는 대표 샘플 5~6개만).
- TypeORM 교체 (Sqitch 는 Flyway 자리만 대체, TypeORM 쿼리 계층은 유지).

### A.1 성공 기준 (PoC 전체 go/no-go)

아래를 **모두** 만족하면 Sqitch 채택을 정식 제안한다. 하나라도 실패하면 6.A 로 회귀하고
사유를 A.7 에 기록한다.

- [ ] **C1 병렬 충돌**: 2개 worktree 가 동시에 변경을 추가했을 때, V번호 충돌 없이
      `sqitch.plan` 텍스트 머지만으로 해결된다(재번호 0회).
- [ ] **C2 raw PG**: `CREATE INDEX CONCURRENTLY` + HNSW + halfvec + `NOT VALID` 2-step 이
      Sqitch 비-트랜잭션 변경으로 정상 배포된다(Flyway `TRANSACTIONAL_LOCK` hang 등가 이슈 없음).
- [ ] **C3 의존성 안전망**: 의존성 누락 시 fail-fast 로 잡는 린트가 동작한다.
- [ ] **C4 baseline**: 기존 V번호가 적용된 DB 를 무중단으로 Sqitch 레지스트리에 인입한다.
- [ ] **C5 운영 형태**: 현행과 동일하게 Docker 이미지 → K8s Job 으로 배포 가능하다.
- [ ] **C6 revert/verify**: deploy/revert/verify 3종이 대칭 동작하고, verify 가 반쪽 적용을 잡는다.

### A.2 게이트별 작업

#### G0 — 환경 셋업 (½일)

- [ ] Sqitch + Perl 포함 Docker 이미지 작성 (또는 공식 `sqitch/sqitch` 기반).
      `sqitch.conf` target = 격리 실험 DB(`clemvion_sqitch_poc`).
- [ ] pgvector/pg_trgm extension 포함 PG 이미지로 실험 DB 기동 (현행 e2e 와 동일 base).
- [ ] `sqitch init clemvion --engine pg` 로 plan/registry 골격 생성.

#### G1 — 대표 샘플 포팅 (1일) → **C2, C6 검증**

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

#### G2 — 병렬 충돌 재현 (½일) → **C1 검증**

- [ ] worktree A·B 에서 각각 독립 변경을 `sqitch add` → 두 `sqitch.plan` 을 머지.
- [ ] 충돌이 "두 줄 보존" 텍스트 머지로 끝나는지, 재번호가 0회인지 기록.
- [ ] 의존성 있는 변경을 일부러 잘못된 순서로 plan 에 두고 `sqitch deploy` 가
      의존성으로 올바른 순서를 강제하는지 확인.

#### G3 — 의존성 누락 린트 (½일) → **C3 검증**

- [ ] 에이전트가 `[dep]` 선언을 빠뜨린 변경을 만든 시나리오 재현.
- [ ] CI 가드 PoC: 변경 SQL 이 참조하는 객체(테이블/컬럼)가 같은 plan 내 선행 변경에
      선언됐는지 정적 검사하는 최소 스크립트 작성(현행 `check-migration-versions.py` 의
      Sqitch 등가물). **완성품 아님 — 실현 가능성만 증명.**

#### G4 — 기존 DB baseline 인입 (½일) → **C4 검증**

- [ ] 기존 V번호가 적용된 DB 스냅샷에 Sqitch 레지스트리를 무중단 인입하는 절차 검증
      (Flyway `flyway_schema_history` ↔ Sqitch registry 공존/전환 전략).
- [ ] "이미 존재하는 스키마를 deploy 없이 registry 에만 기록"(baseline) 동작 확인.

#### G5 — 종합 판정 (½일)

- [ ] A.1 C1~C6 체크 종합 → PASS/FAIL 판정표 작성.
- [ ] 산출물: PoC 결과 요약 + (PASS 시) 전면 마이그레이션 plan 초안 / (FAIL 시) 6.A 회귀 사유.

### A.3 리스크와 완화

| 리스크 | 영향 | 완화 |
| --- | --- | --- |
| CONCURRENTLY 가 Sqitch 트랜잭션 모델과 충돌 | C2 실패 → 채택 불가 | G1 에서 최우선 실측. 실패 시 즉시 FAIL 판정(나머지 게이트 skip) |
| 의존성 수동선언을 에이전트가 누락 | 조용한 순서 사고 | C3 린트를 채택 **전제조건**으로. 린트 없이는 채택 불가 |
| Perl 런타임/이미지 크기 증가 | 빌드·배포 부담 | G0 에서 이미지 크기 측정, 현행 Flyway 이미지와 비교 기록 |
| ~~무료 플랜 merge queue 부재는 그대로~~ | 병렬 머지 race 잔존 | **2026-07-16 무효** — 저장소 PUBLIC 전환으로 branch protection 가용(A.0 경고 참조). 이 리스크 행은 재평가 대상 |

### A.4 산출물

- [ ] `review/` 또는 본 부록 A.7 에 PoC 결과 판정표(A.1 C1~C6 PASS/FAIL + 근거).
- [ ] (PASS) 전면 마이그레이션 plan 초안 + `spec/conventions/migrations.md` §7 개정 제안.
- [ ] (FAIL) 6.A 회귀 결정 + 재시도 트리거 조건.

### A.5 일정 (대략)

G0~G5 합산 **약 3.5~4일**(1인 기준). C2(G1) 가 가장 큰 불확실성 — 여기서 빠르게
FAIL 나면 나머지를 조기 종료해 비용을 줄인다.

### A.6 의존성·선행 조건

- 선행: 본 문서 §8 에서 "6.B Sqitch PoC 발동" 결정.
- 비차단: 6.A(Flyway 보강)와 **병행 가능** — 6.A 가 충분하면 본 PoC 는 착수 안 함.

### A.7 결과 기록 (PoC 완료 후 채움)

> (PoC 실행 후 C1~C6 판정·근거·최종 권고를 여기에 기록한다.)
