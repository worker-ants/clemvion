# Cross-Spec 일관성 검토 — `spec/conventions/` (impl-done)

## 검토 대상

`origin/main` 대비 실제 diff 3개 파일(prompt 번들이 예산상 diff 본문을 누락해 워킹트리를
절대경로로 직접 대조):

- `spec/conventions/migrations.md` — §3 각주 링크 `§5`→`§6` 정정 + §5 뒤에 "인덱스 교체는
  DROP-먼저" 안내 문단 추가
- `spec/conventions/review-citations.md` — 신규 문서 (코드 주석의 리뷰 산출물 인용 규약)
- `spec/conventions/spec-impl-evidence.md` — §2.1 `code:` 필드 정의에 "시행 코드가 없는
  순수 문서형 convention" 예외 각주 추가

부수적으로 연동 확인한 인접 변경(같은 커밋 배치, scope 밖이지만 상호 참조 검증에 필요):
`codebase/backend/migrations/README.md`(§5 확장 + DROP-먼저 절차 신설), `spec/data-flow/8-notifications.md`(V056 각주 추가).

## 발견사항

교차 검증한 6개 관점(데이터 모델/API 계약/요구사항 ID/상태 전이/RBAC/계층 책임) 전부에서
CRITICAL·WARNING 급 모순을 찾지 못했다. 아래는 확인 과정에서 실측한 정합 근거(문제 없음
확인용 INFO)와 낮은 우선순위의 관찰 1건이다.

- **[INFO]** `migrations.md` §3 각주가 가리키는 절 번호 정정, 실제로 맞다
  - target 위치: `spec/conventions/migrations.md` §3 (`migrate-repair` 각주, `§5`→`§6`)
  - 충돌 대상: `codebase/backend/migrations/README.md`
  - 상세: 기존 링크는 README §5(`executeInTransaction=false` 단일 statement 컨벤션)를
    가리켰으나 migrate-repair 절차 본문은 README §6(`ALTER COLUMN TYPE` 테이블-rewrite) 말미에
    있다. 워킹트리 실측(`grep -n "^### " README.md`) 결과 §6 말미에 `docker compose up
    migrate-repair` 절차가 실제로 존재해 정정이 맞다.
  - 제안: 없음(이미 정합). 향후 README 절 번호가 다시 바뀌면 이 각주도 동반 갱신 필요라는
    점만 유지보수 메모로 남긴다.

- **[INFO]** `review-citations.md` 의 cross-spec 각주(swagger.md §3, plan-lifecycle.md)가 실제 내용과 일치
  - target 위치: `spec/conventions/review-citations.md` §3 표 (DTO/컨트롤러 JSDoc 행, `review/**` 행)
  - 충돌 대상: `spec/conventions/swagger.md` §3(`## 3) 주석/설명 톤`), `.claude/docs/plan-lifecycle.md`
  - 상세: "JSDoc 은 대상 아님 — `swagger.md` §3 이 정한 대로 바로 위 `//` 주석에 적는다" 주장을
    `swagger.md` 실측(line 316, "왜 이 값이 이 타입인지의 경위, 리뷰·PR 참조 | 바로 위 `//`
    주석")으로 대조, 일치. `review/**` 산출물 면제 근거로 인용한 plan-lifecycle.md 의 "review/**
    같은 시점 기록 문서는 옛 경로 유지" 문구도 실측(line 44) 일치.
  - 제안: 없음(이미 정합).

- **[INFO]** `spec-impl-evidence.md` §2.1 `code:` 예외 각주 ↔ `review-citations.md` Rationale 상호 등재 확인
  - target 위치: `spec/conventions/spec-impl-evidence.md` §2.1 `code` 필드 정의 행
  - 충돌 대상: `spec/conventions/review-citations.md` Rationale (`code:` 가 "구현 경로"가
    아니라 "준수 예시"를 가리키는 이유)
  - 상세: 새 예외("시행 코드가 없는 순수 문서형 convention 은 그 규약을 실제로 지키는 예시
    파일을 적는다")가 `review-citations.md` 에서만 쓰이는 게 아니라 SoT 인 `spec-impl-evidence.md`
    §2.1 에도 동일 문구로 반영돼 한쪽만 재해석하는 SoT drift 가 없다. `review-citations.md`
    frontmatter `code:` 의 예시 파일 2개(`roles.guard.spec.ts`, `sanitize-loader-error.ts`)도
    워킹트리에 실존하고 실제로 전체경로+날짜 형식의 리뷰 인용을 담고 있어(`grep` 실측) 신설
    규약 자신의 §2 형태 규정을 스스로 준수한다. `spec-code-paths.test.ts` 가드(≥1 매치)도
    이 두 파일로 통과한다.
  - 제안: 없음(이미 정합).

- **[INFO]** `id:` 네임스페이스 충돌 없음
  - target 위치: 3개 파일 frontmatter `id:`
  - 충돌 대상: `spec/**` 전체
  - 상세: `migrations` / `review-citations` / `spec-impl-evidence` 3개 id 모두 `spec/**` 전역에서
    유일(grep 실측, 중복 0건).
  - 제안: 없음.

- **[INFO]** plan `spec_impact` 가 실제 diff 3개 파일 중 2개만 나열 — spec-impl-evidence.md 누락
  - target 위치: `plan/complete/spec-draft-migration-rerun-and-citations.md` frontmatter
    `spec_impact:` (`migrations.md`, `review-citations.md` 만 나열)
  - 충돌 대상: 실제 diff의 `spec/conventions/spec-impl-evidence.md` 변경분
  - 상세: Gate C(spec-impl-evidence.md §4.2)는 "spec path 목록 실존"만 결정적으로 검증하므로
    build 가드는 통과하지만, 이 plan 이 건드린 spec 파일이 실제로는 3개(spec-impl-evidence.md
    §2.1 각주 포함)인데 `spec_impact` 는 2개만 선언해 완전성이 떨어진다. 데이터 모델·API·상태
    전이 등 6개 관점 자체의 모순은 아니라 CRITICAL/WARNING 대상은 아니고, plan-coherence 검토
    영역과 겹칠 수 있는 낮은 우선순위 문서 위생 항목이다.
  - 제안: `spec_impact` 목록에 `spec/conventions/spec-impl-evidence.md` 추가(plan 은 이미
    `complete/` 로 이동했으므로 사후 정정이 필요하면 별도 plan 턴에서).

## 요약

diff 대상 3개 spec/conventions 문서는 서로, 그리고 인접한 `README.md`·`spec/data-flow/8-notifications.md` 변경과 절 번호·인용 형식·SoT 각주까지 상호 실측 검증한 결과 모순이 없다. 데이터 모델·API 계약·요구사항 ID·상태 전이·RBAC·계층 책임의 6개 관점 어디에도 CRITICAL 또는 WARNING 급 충돌이 발견되지 않았다. 유일한 관찰은 완료된 plan 의 `spec_impact` 선언이 실제 diff 3개 파일 중 2개만 나열한 낮은 우선순위 문서 완전성 이슈로, cross-spec 모순이 아니라 INFO 로 분류한다.

## 위험도

NONE
