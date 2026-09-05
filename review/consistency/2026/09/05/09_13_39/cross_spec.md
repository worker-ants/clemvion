# Cross-Spec 일관성 검토 — `spec-draft-migration-rerun-and-citations.md`

## 검토 범위와 방법

target 은 두 정식 규약을 건드린다 — (A) `spec/conventions/migrations.md` 에 README 포인터 한 줄 추가, (B)
`spec/conventions/review-citations.md` 신규. 두 항목 모두 데이터 모델·API 계약·요구사항 ID·상태
전이·RBAC 를 정의하지 않는 순수 프로세스 규약이라, 6개 관점 중 실제로 표면이 있는 것은
**계층 책임 충돌**과 (부수적으로) 기존 규약과의 근거 정합 정도다. 조립 프롬프트의 `spec/**`
번들은 예산 초과로 대부분 절단돼 있었으나(`spec/0-overview.md` 만 전문 포함), 대상 파일
(`spec/conventions/migrations.md`, `spec/conventions/spec-impl-evidence.md`, `spec/conventions/swagger.md`,
`codebase/backend/migrations/README.md`, `codebase/backend/migrations/V056/V106/V110`, 인용 예시 코드
2건)은 저장소에서 직접 읽어 대조했다.

## 발견사항

- **[INFO]** `README.md` 안에서 같은 현상(같은 파일에 transactional statement + `CONCURRENTLY` 혼재 시 거부)에
  대한 인접 두 서술의 근거가 다르다
  - target 위치: `## 부록 A` (README.md §5 뒤에 삽입될 전문) — "`DO` 는 transactional statement 라 같은
    파일의 `CONCURRENTLY` 와 섞이는 순간 Flyway 가 거부한다(`Detected both transactional and
    non-transactional statements ... mixed is false`)"
  - 충돌 대상: `codebase/backend/migrations/README.md` 기존 §5 — "같은 파일에 *transactional* statement
    (예: `ALTER TABLE`) 와 `CONCURRENTLY` 를 섞으면 **PostgreSQL 자체 제약** (CONCURRENTLY 는 트랜잭션
    안에서 실행 불가) 에 걸립니다."
  - 상세: 기존 §5 는 원인을 "PostgreSQL 자체 제약"으로, target 이 그 바로 뒤에 붙이는 신규 절은 같은
    현상의 원인을 "Flyway 의 mixed 판정"(`-mixed=true` 로 우회 가능한 **Flyway 레이어**의 검사)으로
    돌린다. target 이 실측한 에러 메시지(`even though mixed is false`)는 Flyway 자체 가드이지 Postgres
    서버가 던지는 에러가 아니므로, 두 서술이 같은 파일 안에서 원인 레이어를 다르게 지목한다. 이 문서는
    `spec/conventions/migrations.md` 가 "실제 작성 가이드 SoT" 로 가리키는 자리라 spec 체인
    (`0-overview.md §2.8` → `migrations.md` → 이 README) 의 말단에서 발생하는 근거 불일치다.
  - 제안: 부록 A 삽입 시 기존 §5 의 "PostgreSQL 자체 제약" 문구를 "Flyway 의 mixed 판정 (Postgres 는
    `CONCURRENTLY` 를 트랜잭션 안에서 실행할 수 없다는 자체 제약도 별도로 갖지만, 여기서 걸리는 것은
    Flyway 가드)" 정도로 함께 정정해 원인 레이어를 통일하는 것을 권장. target 의 `spec_impact` 에는
    `migrations.md`/`review-citations.md` 만 있고 README.md 자체는 spec 이 아니므로 gate 대상은 아니지만,
    같은 커밋에서 인접 서술을 손대는 것이 자연스럽다.

## 그 외 확인했으나 충돌 없음으로 판정한 항목

- **요구사항 ID / 문서 ID**: 신규 `id: review-citations` 는 `spec/conventions/**` 전체에서 유일 —
  기존 26개 규약 문서 `id:` 전수 대조, 중복 없음.
- **evidence 재사용**: 신규 문서가 `code:` 로 지목하는 `codebase/backend/src/common/guards/roles.guard.spec.ts`,
  `codebase/frontend/src/components/llm-config/sanitize-loader-error.ts` 두 파일은 실존하고 실제로
  전체 경로 형태(`review/code/2026/08/08/20_53_48`, `review/code/2026/05/26/12_10_38`)로 인용하고
  있어 `status: implemented` + `spec-code-paths.test.ts` (≥1 매치 의무) 요건을 만족한다. 다른 spec
  문서가 이 두 파일을 `code:` 로 이미 선점하고 있지 않아 evidence 충돌도 없다.
- **`mixed=true` 관련 결정 상태**: 저장소 어디에도(`Dockerfile`, `.conf`, CI workflow) `mixed=true`
  가 이미 설정돼 있지 않음을 확인 — target 이 "별도 결정 항목"으로 미루는 서술과 실제 상태가 일치한다.
  다른 spec 이 이 값을 이미 결정된 것처럼 서술하는 곳도 없다.
- **DROP-first 패턴 vs 실코드**: `V110__schedule_workspace_next_run_index.sql`/`.conf` 를 직접 읽어
  target §1 의 (b) 형태 서술과 실제 DROP→CREATE→DROP 순서·`executeInTransaction=false` 가 일치함을
  확인. `V056`/`V106` 에 해당 줄이 없다는 서술도 실제 파일과 일치.
  `spec/1-data-model.md §3`·`spec/data-flow/10-triggers.md §2.1` 이 인덱스 대상 테이블(`schedule`)의
  데이터 모델을 정의하지만, target 은 그 스키마를 바꾸지 않고 인덱스 교체 절차만 다뤄 데이터 모델
  충돌 없음.
- **레이어 분업**: `migrations.md` Overview 가 이미 "버전 정책은 본 문서, 작성 가이드는 README" 로
  분업을 선언해 두었고, `spec/0-overview.md §2.8` 도 "상세 운영 규약: migrations.md" 로 체인을 건다.
  target 의 "migrations.md 에는 포인터만, 패턴 본문은 README" 결정은 이 기존 분업과 정확히 부합한다
  (역행이 아니라 강화).
- **`spec-impl-evidence.md` 규약과의 정합**: 신규 문서가 속하는 `spec/conventions/**` 는 §1 inclusive
  list 대상이라 frontmatter 의무가 적용되지만, flat reference 트리라 `spec-area-index.test.ts` 의
  index 요구는 면제 — target 문서가 index 갱신 없이 신규 파일만 추가해도 이 가드와 충돌하지 않는다.
  `status: implemented` 선택도 §3 라이프사이클 표(코드 매치 ≥1 의무)와 부합.
- **기존 인용 실사례와의 정합**: `spec/5-system/1-auth.md:565`, `spec/data-flow/12-workspace.md:334`
  가 이미 spec 본문 안에서 전체 경로 형태(`review/consistency/2026/07/28/17_21_27`,
  `review/code/2026/08/01/13_46_48/security.md`)로 리뷰 산출물을 인용하고 있어, target 의 "전체 경로가
  권장" 결정과 이미 있는 spec 관행이 정확히 일치한다(충돌 아님, 오히려 선례).
- **"소급 정리 안 함" 원칙의 선례 인용**: target 이 근거로 드는 `swagger.md §1-4·§3`(신규 변경 한정,
  기존 필드 일괄 소급 안 함)을 직접 대조 — 문구·취지 모두 실제 존재하고 target 의 인용과 부합.

## 요약

target 은 데이터 모델·API 계약·요구사항 ID·상태 머신·RBAC 어느 축도 새로 정의하지 않는 순수 프로세스
규약 2건(마이그레이션 재실행 안전성 패턴, 리뷰 산출물 인용 형식)이며, 저장소에 실존하는 코드
(`V110`, `roles.guard.spec.ts`, `sanitize-loader-error.ts`, `README.md`)와 인접 spec 문서
(`0-overview.md §2.8`, `migrations.md` 기존 분업 선언, `swagger.md` 소급 정리 원칙, `spec-impl-evidence.md`
frontmatter 요건)를 전수 대조한 결과 CRITICAL/WARNING 급 모순은 발견되지 않았다. 유일한 지적은
README.md 안에서 `CONCURRENTLY`+transactional 혼재 거부의 원인을 기존 문구("PostgreSQL 자체 제약")와
target 신규 문구("Flyway mixed 판정")가 인접 섹션에서 다르게 설명한다는 INFO 성격의 근거 정합 이슈뿐이다.

## 위험도

LOW
