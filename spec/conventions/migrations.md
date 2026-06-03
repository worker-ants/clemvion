---
id: migrations
status: implemented
code:
  - codebase/backend/migrations/**
  - codebase/backend/src/migrations.spec.ts
  - scripts/check-migration-versions.py
  - .github/workflows/migration-check.yml
  - .github/workflows/migration-recheck-on-main.yml
  - .github/PULL_REQUEST_TEMPLATE.md
---

# Flyway 마이그레이션 운영 규약

## Overview

본 규약은 PostgreSQL 스키마 마이그레이션을 다음 세 가지 안전성 기준으로 운영하기 위한 정식 규칙이다.

1. **충돌 방지** — 여러 PR 이 병렬로 진행될 때 같은 V번호를 동시에 점유하는 사고를 사전에 차단한다.
2. **순서 보장** — 마이그레이션 적용 순서를 작성 의도와 일치시켜, 의존성 (예: `V<N+1>` 이 `V<N>` 컬럼을 참조) 사고를 막는다.
3. **운영 안전성** — 이미 운영에 적용된 마이그레이션을 수정해 Flyway checksum 불일치로 부팅이 실패하는 일을 막는다.

본문 절차·도구는 모두 위 세 기준을 보장하기 위한 수단이다. 실제 작성 가이드(트랜잭션 모드, NOT VALID 패턴, extension 의존성 등)는 [`codebase/backend/migrations/README.md`](../../codebase/backend/migrations/README.md) 가 담당하며, 본 문서는 **버전 번호 정책과 머지 race 안전망**에 집중한다.

---

## 1. 명명 규약

```text
codebase/backend/migrations/V<번호>__<snake_case_descriptor>.sql
codebase/backend/migrations/V<번호>__<snake_case_descriptor>.conf  # 필요한 경우만 (executeInTransaction=false 등)
```

- 번호는 **단조 증가하는 정수**. `V001__initial_schema.sql` 부터 시작해 1씩 증가한다.
- 설명자는 `snake_case`. **권장 문자집합은 영문 소문자 + 숫자 + `_`** 이며, 모든 실파일(`V001`~)이 이를 따른다. 단 가드 정규식의 허용 집합은 위치마다 더 넓다 — `codebase/backend/src/migrations.spec.ts` 의 `SQL_NAME_RE` 는 하이픈까지 허용(`[a-z0-9_-]+`), `scripts/check-migration-versions.py` 의 `SQL_RE` 는 대문자까지 허용(`[A-Za-z0-9_]+`). 권장 집합을 벗어나도 두 가드는 통과하므로, 일관성은 본 컨벤션으로 보장한다.
- `.conf` 페어는 항상 `.sql` 과 동일한 base name (`V<NNN>__<descriptor>`) 을 사용한다. 예: `V033__embedding_hnsw_1024.sql` ↔ `V033__embedding_hnsw_1024.conf`.
- ⚠️ **alphanumeric suffix 금지** — `V035a`, `V035_1` 처럼 정수가 아닌 접미사를 붙이면 Flyway 의 기본 version 파서가 매치에 실패해 schema_history 에 미등록된 채 silent skip 된다. 이 조건은 `codebase/backend/src/migrations.spec.ts` 가 빌드/CI 마다 자동 검증한다.

## 2. V번호 정책

- **단조 증가**: 신규 V번호는 항상 현재 main 의 max(V) **+1** 이다.
- **gap 금지**: 작업 도중 V번호를 건너뛰지 않는다. 두 개를 추가하면 `+1`, `+2` 가 되어야 한다.
- **재사용 금지**: 한번 main 에 들어간 V번호는 다른 마이그레이션으로 재할당하지 않는다.

작성 시 절차는 [§5 새 마이그레이션 추가 절차](#5-새-마이그레이션-추가-절차) 를 따른다.

## 3. Append-only 원칙

이미 main 에 들어간 V<N> 의 `.sql` / `.conf` 는 **절대 수정하지 않는다**.

- Flyway 는 부팅 시 각 적용된 마이그레이션의 SQL 내용 checksum 을 `flyway_schema_history` 와 비교한다. 파일이 한 글자라도 바뀌면 `Migration checksum mismatch for migration version NNN` 으로 부팅이 실패한다.
- 컬럼/인덱스/제약 추가·변경·삭제가 필요하면 **새 V<N+k>** 로 `ALTER`·`DROP`·`CREATE` 를 작성한다.
- 운영 사고로 어쩔 수 없이 checksum 을 재정렬해야 한다면 `migrate-repair` 서비스를 사용한다 (절차는 [`codebase/backend/migrations/README.md`](../../codebase/backend/migrations/README.md) §5 참고).

## 4. `outOfOrder=false` 유지

Flyway 의 `outOfOrder=true` 옵션은 옛 V번호가 늦게 들어와도 실행을 허용한다. 본 repo 는 이 옵션을 **명시적으로 사용하지 않는다** (Flyway 기본값 `false` 유지).

이유:
- `outOfOrder=true` 환경에서 두 PR 이 동시에 V<N+1> 을 만들고 한쪽이 V<N+2> 로 양보한 뒤 늦게 머지되면, **의도된 의존성 순서와 실제 적용 순서가 어긋난다**.
- 본 규약은 PR CI 단계에서 V번호 충돌을 잡아내므로 (`§5`), `outOfOrder` 를 켤 필요가 없다.

## 5. 새 마이그레이션 추가 절차

1. `git fetch origin main && git rebase origin/main` — base 를 최신화한다.
2. `ls codebase/backend/migrations | tail -2` 로 현재 max V 를 확인한다.
3. `V<max+1>__<descriptor>.sql` 을 작성한다. 필요하면 동일 base name 의 `.conf` 를 함께 둔다 ([`codebase/backend/migrations/README.md`](../../codebase/backend/migrations/README.md) §4·§5 참고).
4. 로컬에서 `python3 scripts/check-migration-versions.py --base origin/main` 으로 V번호 가드를 통과시킨다.
5. `make e2e-test` 로 dry-run — e2e 컨테이너의 Flyway 가 실제 마이그레이션을 적용해 본다.
6. PR 을 연다. CI 의 `migration-check` 가 동일한 검사를 다시 돌린다.

> PR open 후에는 가능한 빠르게 리뷰·머지하여 다른 PR 과의 V번호 점유 윈도우를 짧게 유지한다.

## 6. 충돌 검출 / 머지 race

본 repo 는 다음 안전망으로 V번호 충돌과 merge race 를 차단한다. 우회 가능한 단계가 있을 때마다 다음 단계가 fail-fast 로 잡도록 다층화되어 있다 — 유닛테스트 → PR CI → 머지 직전 rebase → 사후 recheck → 이미지 빌드 시점.

### 6.1 PR CI 가드 (`scripts/check-migration-versions.py`)

`pull_request` 이벤트마다 [`/.github/workflows/migration-check.yml`](../../.github/workflows/migration-check.yml) 이 실행되어 다음을 검사한다.

모든 위반 메시지는 `[migration-guard] ` prefix 로 시작한다 (아래 표는 prefix 이후 본문).

| 검사 | 위반 예시 | 메시지 |
| --- | --- | --- |
| 중복 | 같은 V<N>__*.sql 두 개 | `[migration-guard] FAIL: V041 is duplicated` |
| 단조성 | 신규 V<N> 가 main_max 이하 | `[migration-guard] FAIL: V040 is not greater than base (origin/main) max V040` |
| 연속성 | gap 발생 (예: V041 없이 V042) | `[migration-guard] FAIL: V042 leaves a gap (expected V041 after base max V040)` |
| `.conf` 페어 | `.conf` 의 base name 이 `.sql` 과 다름 | `[migration-guard] FAIL: V041 .conf base name does not match its .sql` |

위반 시 workflow exit 1 로 PR 머지가 막힌다. 작성자가 rebase 해 V번호를 재할당하면 즉시 재검증된다.

로컬에서 동일 검사를 돌리려면:

```bash
python3 scripts/check-migration-versions.py --base origin/main
```

### 6.2 머지 직전 rebase 규약 (운영 규약)

PR CI 가 통과한 직후 다른 PR 이 먼저 머지되어 main 의 max(V) 가 추월되는 **merge race** 가 발생할 수 있다. 본 repo 는 GitHub 무료 플랜의 private 저장소여서 branch protection 의 "Require branches to be up to date before merging" 옵션을 사용할 수 없으므로 (자세한 사유는 [§7 대안 4](#대안-4-github-branch-protection--require-branches-to-be-up-to-date)), race 차단을 다음 운영 규약으로 대체한다.

**머지 직전 확인 (작성자 책임)**

1. `git fetch origin main && git rebase origin/main` 으로 base 를 최신화한다.
2. push 후 `migration-check` 가 PR 의 latest commit 기준 green 인지 확인한다.
3. 본 PR 에 `migration-recheck-on-main` 알림 코멘트가 게시되어 있다면, 무조건 위 1·2 단계를 다시 수행한다.

이 규약은 [`/.github/PULL_REQUEST_TEMPLATE.md`](../../.github/PULL_REQUEST_TEMPLATE.md) 의 Migration checklist 와 짝을 이룬다 — 작성자는 체크박스를 통해 self-confirmation 한다.

### 6.3 사후 안전망 — `migration-recheck-on-main`

`codebase/backend/migrations/**` 가 main 에 push 될 때 (= migration PR 이 머지된 직후) [`/.github/workflows/migration-recheck-on-main.yml`](../../.github/workflows/migration-recheck-on-main.yml) 이 두 가지를 자동 수행한다.

- **Post-merge sanity** — `python3 scripts/check-migration-versions.py --base HEAD~1` 를 main 에서 실행. dup / gap / 단조성 / `.conf` 페어 위반이 main 에 실제로 도달했으면 워크플로가 fail 하여 Actions 탭에 빨간불이 켜진다 (Slack/Email 알림이 연동되어 있으면 자동 통지).
- **Auto-nudge** — 열린 PR 중 `codebase/backend/migrations/**` 파일이 변경 목록에 포함된 PR 들에 "rebase + CI 재실행 필요" 코멘트를 자동 게시. PR 작성자가 race 가능성을 즉시 인지하고 §6.2 규약을 수행하도록 nudge.

두 작업 모두 머지 자체를 막진 못한다 — 무료 private 환경에서 가능한 최대 강도는 "즉시 가시화 + nudge" 다. 향후 유료 플랜으로 전환 시 [§7 대안 4](#대안-4-github-branch-protection--require-branches-to-be-up-to-date) 의 branch protection 을 §6.2 로 승격하고 본 절은 backup 으로 유지할 수 있다.

### 6.4 빌드 시점 가드 (`codebase/backend/migrations/check-duplicate-versions.sh`)

마이그레이션 Docker 이미지 ([`codebase/backend/migrations/Dockerfile`](../../codebase/backend/migrations/Dockerfile)) 빌드의 마지막 RUN 단계에서 `/flyway/sql` 디렉토리의 `V*.sql` 파일을 검사해 동일 V번호가 둘 이상이면 **빌드 자체를 fail** 시킨다. 같은 정수로 정규화되는 모든 형태(`V41` vs `V041`, `V050__a.sql` vs `V050__b.sql` 등) 가 중복으로 잡힌다.

용도는 §6.1·§6.3 와 동일한 중복 검출이지만 검사 시점이 다르다 — 다음 시나리오에서도 차단된다.

- **유닛테스트·PR CI 가 우회된 빌드** — 긴급 hotfix, 로컬 운영자의 임시 빌드, 외부 환경의 직접 `docker build`.
- **CI 가드 스크립트나 spec 자체가 잘못 수정**되어 §6.1 가 무의미해진 경우 — 빌드 단계의 가드는 동일 이미지를 사용하는 모든 환경에서 동일하게 적용되므로 정책 수정의 일시적 drift 에도 안전.

위반 출력 예 (stderr) :

```text
ERROR: duplicate Flyway migration version(s) detected in /flyway/sql:
  V041:
    - /flyway/sql/V041__one.sql
    - /flyway/sql/V041__two.sql

Policy: spec/conventions/migrations.md §6 (V번호 단조성·중복 방지).
Add a new migration with a unique V<N+1> prefix instead.
```

로컬에서 이미지 빌드 없이 같은 검사를 돌리려면:

```bash
codebase/backend/migrations/check-duplicate-versions.sh codebase/backend/migrations
```

본 가드는 §6.1 / §6.3 의 Python 가드와 동일한 V번호 정규화 규칙(`V0*([0-9]+)__`) 을 사용한다. 정책 변경이 발생하면 두 가드를 함께 갱신해야 한다.

## 7. 폐기 대안 (Rationale)

### 대안 1: 타임스탬프 prefix (`V<YYYYMMDDHHMMSS>__...`)

장점은 unique 보장이 자연스럽다는 점이지만, 다음 단점으로 폐기.

- 타임스탬프 순서가 **실제 의도된 실행 순서와 어긋날 수 있다** — 작성자 시계 차이 / merge 순서 / cherry-pick 으로 인해 의존성 깨짐이 발생한다.
- Flyway 의 단조 정수 모델과 자연스럽게 맞물리지 않아 `outOfOrder` 위험을 흡수하게 된다.
- 한 PR 의 마이그레이션을 다른 PR 의 마이그레이션 사이에 끼워 넣을 동기가 발생해 (시계 후순위) append-only 원칙이 흔들린다.

### 대안 2: `flyway.outOfOrder=true`

옛 V번호가 늦게 들어와도 실행한다. PR 충돌 부담은 줄지만:

- **의존성 사고 위험** — V<N+1> 이 V<N> 컬럼을 참조하는 코드를 작성해 두었는데, 운영 환경에는 V<N> 이 더 늦게 들어가는 케이스가 가능해진다.
- 환경별 적용 이력이 비결정적이 되어 디버깅·재현이 어려워진다.

본 규약은 `outOfOrder=false` 를 유지하고 PR CI 가드로 충돌을 사전 차단한다.

### 대안 3: GitHub Merge Queue

자동화 강도는 가장 높지만:

- GitHub plan 의존성 + 셋업 비용이 작지 않다 (private 저장소의 merge queue 는 유료 플랜 한정).
- 본 repo 규모에서는 §6.2/§6.3 의 규약 + 사후 안전망만으로도 race 빈도 대비 비용 대비 효율이 더 낫다.
- 향후 PR 동시성이 늘어 race 가 빈번해지면 재검토 후보로 둔다.

### 대안 4: GitHub branch protection — "Require branches to be up to date"

race 차단의 **정공법**이지만 본 repo 는 GitHub 무료 플랜의 private 저장소여서 다음 제약이 있다.

- Settings → Branches → Branch protection rules 의 일부 옵션 (특히 required status checks / "up to date" 강제) 이 무료 private 에서 비활성화되어 있다.
- `gh api -X PUT repos/<owner>/<repo>/branches/main/protection` CLI 역시 동일한 플랜 제약으로 실패한다.

따라서 현재는 §6.2 (작성자 책임 규약) + §6.3 (`migration-recheck-on-main`) 으로 대체한다. 향후 유료 플랜으로 전환하면 다음 순서로 승격을 검토한다.

1. Settings → Branches → main → "Require branches to be up to date before merging" 활성화.
2. `migration-check / guard` 를 required status check 로 등록.
3. §6.2 의 작성자 책임 규약을 자동화 차단으로 흡수.
4. §6.3 의 `migration-recheck-on-main` 은 backup 으로 유지 — race 가 사후에라도 main 에 도달했을 때 가시화하는 역할은 branch protection 이 대체하지 못한다.

---

## 참고

- 실제 작성 가이드(트랜잭션 모드, NOT VALID 패턴, extension, `.conf` 사용법, repair 절차): [`codebase/backend/migrations/README.md`](../../codebase/backend/migrations/README.md)
- 시스템 아키텍처 §2.8 (Flyway 운영): [`spec/0-overview.md`](../0-overview.md)
- 가드 스크립트: [`scripts/check-migration-versions.py`](../../scripts/check-migration-versions.py)
- CI workflow: [`.github/workflows/migration-check.yml`](../../.github/workflows/migration-check.yml)
