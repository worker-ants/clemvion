# Cross-Spec 일관성 검토 — cross_spec

## 검토 대상

- `spec/conventions/migrations.md` (§5 절차에 "인덱스 교체 DROP-먼저" 참조 bullet 추가)
- `spec/conventions/review-citations.md` (신규 — 코드 주석의 리뷰 산출물 인용 규약)
- `spec/conventions/spec-impl-evidence.md` (§2.1 `code:` 필드 정의에 "순수 문서형 convention 예외" 각주 추가)
- `spec/data-flow/8-notifications.md` (Rationale 에 V056 인덱스 순서가 이후 DROP-먼저 규약과 다름을 명시하는 caveat 추가)

diff-base `origin/main` 대비 `spec/` 스코프 델타는 위 4개 파일(139 삽입/1 삭제)뿐이며, 동일 브랜치의
`codebase/` 변경은 `codebase/backend/migrations/README.md` 1개 파일(§5 "인덱스 교체는 DROP-먼저" 절
신설)로 확인했다 — 위 spec 변경 3건이 참조하는 실체가 실제로 그 파일에 존재한다.

## 발견사항

교차 검토 결과 CRITICAL/WARNING 급 충돌은 발견되지 않았다. 아래는 확인 과정에서 검증한 항목과 그 결과다.

- **[INFO] 상호 참조 3중 동기화는 확인됨 — 유지만 하면 됨**
  - target 위치: `spec/conventions/migrations.md` 신규 bullet(§5), `spec/data-flow/8-notifications.md` Rationale 신규 인용문
  - 충돌 대상: `codebase/backend/migrations/README.md` §5 "인덱스 교체는 DROP-먼저"
  - 상세: 두 spec 문서 모두 "인덱스 교체는 DROP-먼저" 패턴의 본문을 중복 서술하지 않고 README.md §5 를
    단일 SoT 로 위임한다. 실제로 README.md §5 를 열어 대조한 결과 세 문장 순서(`DROP new IF EXISTS` →
    `CREATE new IF NOT EXISTS` → `DROP old IF EXISTS`)와 "indisvalid 는 IF NOT EXISTS 가 보지 않는다" 는
    근거가 두 spec 문서의 서술과 정확히 일치한다. `migrations.md` §3 (append-only 원칙)과
    `8-notifications.md` 의 "V056 자신은 append-only 라 소급 수정 대상이 아니다" 도 서로 모순 없이
    보강 관계다. 계층 책임(작성 가이드=README.md, 정책 SoT=migrations.md, 개별 사례 caveat=data-flow
    문서)이 기존 결정("실제 작성 가이드는 README.md 가 담당" — migrations.md Overview)과 일치한다.
  - 제안: 없음 (정보성 확인).

- **[INFO] `review-citations.md` 신규 id/frontmatter 충돌 없음**
  - target 위치: `spec/conventions/review-citations.md` frontmatter (`id: review-citations`)
  - 충돌 대상: `spec/**` 전체의 `id:` 네임스페이스
  - 상세: `id: review-citations` 가 다른 spec 파일에서 재사용되고 있지 않음을 전수 grep 으로 확인. 대상
    경로가 `spec-impl-evidence.md` §1 inclusion list(`spec/conventions/**.md`)에 속하고 §1 제외 목록
    (`0-overview.md`/`1-data-model.md`/`6-brand.md`/`_*.md`/카탈로그 필드 파일) 어디에도 해당하지 않아
    frontmatter 의무 대상이며, 실제로 `id`/`status`/`code` 세 필드를 모두 갖춰 §2 스키마를 충족한다.
    `status: implemented` 이므로 §3 이 요구하는 "`code:` ≥1 매치" 도 실제로 두 파일
    (`roles.guard.spec.ts`, `sanitize-loader-error.ts`)이 존재하고 그 안에 review 인용 패턴
    (`review/code/2026/...`)이 실제로 쓰이고 있음을 확인해 frontmatter 약속과 코드가 정합한다.
    `spec/conventions/` 는 §4.2 `spec-area-index.test.ts` 의 "flat reference, 무-index" 예외 목록에
    있어 신규 파일 추가에 따른 area-index 갱신 의무도 없다(실제로 `spec/conventions/` 에 index/overview
    파일이 없음을 확인).
  - 제안: 없음.

- **[INFO] `code:` 필드 "예외" 각주가 유일한 정의처(SoT)를 유지**
  - target 위치: `spec/conventions/spec-impl-evidence.md` §2.1 `code` 필드 정의 각주
  - 충돌 대상: `spec/conventions/**.md` 전체에서 `code:` 필드를 재정의하는 다른 문서
  - 상세: `code:` 필드의 의미 정의가 `spec-impl-evidence.md` 한 곳에만 있고(전수 grep으로 경쟁 정의
    부재 확인), 새로 추가된 예외 각주가 가리키는 선례(`review-citations.md`)도 그 문서 자신의
    Rationale 에서 동일한 근거로 자기 참조하고 있어 두 문서가 서로 다른 이야기를 하고 있지 않다
    (CLAUDE.md 원칙 "정식 규약은 spec/conventions/<name>.md" 와도 정합 — SoT 분산 없음).
  - 제안: 없음.

- **[INFO] DTO JSDoc 표면 중첩은 사전에 조정된 상태**
  - target 위치: `spec/conventions/review-citations.md` §3 표의 "DTO·컨트롤러 JSDoc" 행
  - 충돌 대상: `spec/conventions/swagger.md` §3 "JSDoc 은 공개 OpenAPI 로 나간다"
  - 상세: 두 규약 모두 2026-09-05 같은 날 등재되어 DTO JSDoc 표면이 겹칠 뻔했으나, `review-citations.md`
    가 "JSDoc 은 대상 아님 → 바로 위 `//` 주석에 적고 그 `//` 주석은 본 규약을 따른다" 로 명시적으로
    양보/조정했고, 실제 `swagger.md` §3 을 열어 대조한 결과 그 서술("내부 서사는 JSDoc 이 아니라 그
    위의 `//` 주석에 적는다")과 정확히 맞물린다. 충돌이 아니라 이미 해소된 잠재 충돌의 기록이다.
  - 제안: 없음.

- **[INFO] `review/**` 도메인 정의가 `plan-lifecycle.md` 와 일치**
  - target 위치: `spec/conventions/review-citations.md` §3 표의 "`review/**` 산출물" 행
  - 충돌 대상: `.claude/docs/plan-lifecycle.md` §3 "인입 참조"
  - 상세: 인용문 "`review/**` 같은 시점 기록 문서는 옛 경로 유지" 를 `plan-lifecycle.md` 원문과 대조한
    결과 정확히 일치(44행). 두 문서가 `review/**` 를 "시점 기록이라 사후 편집 대상 아님" 이라는 동일한
    모델로 취급하고 있어 충돌 없음.
  - 제안: 없음.

## 요약

이번 델타는 코드가 아닌 규약 문서 3건 갱신 + 신규 규약 문서 1건으로, 데이터 모델·API 계약·요구사항
ID·상태 머신·RBAC 어느 축에도 실질 변경이 없다. 유일하게 넓어진 표면(`review-citations.md` 신규
id/`code:` 예외 각주)은 다른 spec 영역과의 id 충돌·정의 중복·area-index 의무를 모두 실측으로
반증했고, 오히려 `swagger.md`·`spec-impl-evidence.md`·`migrations.md`(및 코드베이스
`migrations/README.md`)·`plan-lifecycle.md` 네 곳과의 잠재적 표면 겹침을 문서 자신이 사전에
식별해 각주·조정 문구로 해소해 두었다. Cross-Spec 관점에서 이 델타는 안전하다.

## 위험도

NONE
