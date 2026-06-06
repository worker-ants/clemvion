---
worktree: migration-tooling-eval-1de449
started: 2026-06-05
owner: planner
related_spec: spec/conventions/migrations.md
---

# 마이그레이션 도구 비교 평가 — Flyway vs Sqitch vs Prisma

> 작성일: 2026-06-05
> 동반 문서: [`sqitch-poc.md`](sqitch-poc.md) (본 평가의 후속 PoC 계획)
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
게이트는 [`sqitch-poc.md`](sqitch-poc.md). PoC 가 반드시 검증할 핵심 리스크:

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
- [ ] (6.B 채택 시) [`sqitch-poc.md`](sqitch-poc.md) 게이트 G0 부터 착수
- [ ] 최종 도구 결정 확정 시 `project-planner` 가 `consistency-check --spec` 후
      `spec/conventions/migrations.md` §7 에 결정 기록
