# Cross-Spec 일관성 검토 (impl-done) — `spec/conventions/migrations.md` · `spec/conventions/review-citations.md`

## 검토 방법

scope 델타는 두 파일이다 — (A) `migrations.md` §5 새 절차 뒤에 README 포인터 5줄 추가, (B) `review-citations.md`
신규 111줄. 구현 diff(54줄, `codebase/backend/migrations/README.md`)가 실제로 이 두 spec 문서가 가리키는
본문(§5 "인덱스 교체는 DROP-먼저")을 담고 있는지, 그리고 그 서술이 코드·타 spec 영역과 어긋나지 않는지를
HEAD 워킹트리에서 직접 대조했다.

확인한 것:
- `codebase/backend/migrations/README.md` 실제 §5 본문 (diff 적용 후) — 앵커·문구 일치 확인.
- `V110__schedule_workspace_next_run_index.sql/.conf`, `V056__notification_active_partial_index.sql`,
  `V106__schedule_trigger_id_index.sql` 원문 — target 이 서술하는 "DROP→CREATE→DROP" vs "CREATE+DROP" vs
  "CREATE 만" 3분류가 실제 파일과 일치하는지.
- `spec/1-data-model.md` §3 인덱스 전략 + Rationale "Schedule 인덱스 …(2026-09-04)" (전문 포함 번들) — Schedule
  인덱스 교체(V110)에 대한 데이터 모델 쪽 서술과 migrations.md 쪽 서술이 같은 사실을 가리키는지.
  §2.8 (`spec/0-overview.md`) 의 Flyway 계층 분업 선언.
  migrations.md 자체 diff 및 README.md 전체 §5 원문 대조.
- `spec/5-system/1-auth.md:565`, `spec/data-flow/12-workspace.md:334` (기존 review 인용 실사례) — review-citations.md
  가 "권장" 하는 전체 경로 형태와 실제 관행 일치 여부.
- `codebase/backend/migrations/**`, `.github/workflows/*.yml`, `Dockerfile` 전수 grep — `mixed=true` 가
  이미 어딘가 설정돼 target 의 "별도 결정 항목" 서술과 모순되지 않는지.
- 이전 라운드 `review/consistency/2026/09/05/09_13_39/cross_spec.md` (동일 draft 의 `--spec` 단계 cross_spec) —
  그 라운드가 지적한 INFO(README 안 원인 레이어 불일치: "PostgreSQL 자체 제약" vs "Flyway mixed 판정")가
  실제 구현에서 해소됐는지.

## 발견사항

없음. CRITICAL/WARNING/INFO 어느 등급도 신규로 발견되지 않았다.

- 전 라운드(`09_13_39`)가 지적한 유일한 INFO — README.md 안에서 같은 현상(트랜잭션 statement +
  `CONCURRENTLY` 혼재 시 거부)의 원인을 인접 서술이 "PostgreSQL 자체 제약"과 "Flyway mixed 판정"으로
  다르게 지목하던 문제 — 는 실제 diff에서 **기존 문구 자체를 고쳐** 해소됐다: `README.md` §5 규칙 목록의
  해당 줄이 이제 "Flyway 의 mixed 판정에 걸립니다 … 근본 이유는 PostgreSQL 제약이지만 거부를 내는 주체는
  Flyway 가드입니다" 로 원인 레이어를 하나로 통일해 서술한다. 새 "부록"을 별도로 추가해 두 서술이
  공존하는 형태가 아니라 원 문장을 치환하는 형태라 재발 소지가 없다.
- `migrations.md` 가 새로 가리키는 "README.md §5 의 '인덱스 교체는 DROP-먼저'" 절은 실제로 그 이름 그대로
  §5 본문에 존재하며 (`**인덱스 교체는 DROP-먼저** (2026-09-05 규약화):`), 인용한 V056/V106/V110 3파일의
  실제 SQL 형태(CREATE+DROP / CREATE만 / DROP→CREATE→DROP)와 서술이 모두 일치한다.
- `spec/1-data-model.md` §3 의 Schedule 인덱스 행("종전 `(next_run_at, is_active)` … 를 대체한다 …
  CONCURRENTLY, V110")과 migrations.md/README.md 가 서술하는 V110 의 성격(진짜 교체·DROP-first 선례)이
  같은 사실을 가리키며 모순이 없다. 두 문서 모두 데이터 모델(컬럼·엔티티)은 건드리지 않고 인덱스
  운영 절차만 다루므로 데이터 모델 충돌 표면 자체가 없다.
- 계층 책임 분업(§6 "계층 책임 충돌" 관점) — `migrations.md` Overview 가 "버전 번호 정책은 본 문서,
  실제 작성 가이드는 README.md" 라고 이미 선언해 두었고 `spec/0-overview.md` §2.8 도 같은 체인을 건다.
  target 이 이번에 추가한 5줄은 "인덱스 교체 패턴 본문은 README, spec 은 포인터만" 형태라 이 기존
  분업을 강화할 뿐 역행하지 않는다.
- `review-citations.md` 가 "권장"으로 못 박는 전체 경로 인용 형태는 이미 `spec/5-system/1-auth.md`,
  `spec/data-flow/12-workspace.md` 에 선례가 있어 새 규약과 기존 spec 관행이 부합한다. 신규 `id:
  review-citations` 는 `spec/conventions/**` 전체에서 유일하고, `code:` 로 지목한 두 테스트 파일도
  다른 spec 문서가 선점하고 있지 않다.
- `mixed=true` 는 target 의 "도입 여부는 별도 결정 항목" 서술대로 저장소 어디에도(Dockerfile, `.conf`,
  workflow) 아직 설정되어 있지 않아 실제 상태와 서술이 일치한다.
- 요구사항 ID·상태 전이·RBAC 축은 이번 델타에 해당 표면이 없다(두 문서 모두 순수 프로세스 규약이며
  신규 requirement ID·상태 머신·권한 구조를 정의하지 않는다).

## 요약

이번 impl-done 델타(`migrations.md` 5줄 추가, `review-citations.md` 신규, 구현측 `README.md` 54줄)는
순수 프로세스 규약으로, 데이터 모델·API 계약·요구사항 ID·상태 전이·RBAC 어느 축도 새로 정의하지 않는다.
유일하게 표면이 있는 계층 책임 분업(spec=정책, README=작성 가이드)은 기존 결정을 강화하는 방향이며,
`--spec` 단계에서 지적됐던 유일한 INFO(README 내 원인 레이어 불일치)는 실제 구현에서 문장 자체를 고쳐
해소된 것을 코드 대조로 확인했다. Schedule 인덱스(V110)에 대한 서술은 `spec/1-data-model.md` 및 실제 3개
마이그레이션 파일과 정확히 일치한다. Cross-Spec 관점에서 신규 CRITICAL/WARNING/INFO 는 없다.

## 위험도

NONE
