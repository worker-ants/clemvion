# Cross-Spec 일관성 검토 — `spec/conventions/` (migrations.md, review-citations.md, spec-impl-evidence.md)

## 검토 범위 및 방법

이번 라운드의 실제 spec 델타는 3개 파일이다.

- `spec/conventions/migrations.md` — §3(운영 사고 시 `migrate-repair` 참조 섹션 번호 §5→§6 정정) + §4 말미에 "인덱스 교체는 별도 패턴" 안내 문단 신설
- `spec/conventions/review-citations.md` — 신규 파일(코드 주석의 리뷰 산출물 인용 규약)
- `spec/conventions/spec-impl-evidence.md` — §2.1 `code:` 필드 정의에 "시행 코드가 없는 순수 문서형 convention" 예외 조항 1문장 추가

동반 코드 변경은 `codebase/backend/migrations/README.md` 1개 파일(§5 "인덱스 교체는 DROP-먼저" 절 신설)뿐이다. 프롬프트 번들은 컨텍스트 예산으로 대부분 절단되어 있어(`swagger.md`, git diff, `spec/1-data-model.md` 등 다수가 "본문 생략됨"), 아래 검증은 프롬프트 번들 대신 워킹트리(`/Volumes/project/private/clemvion/.claude/worktrees/plan-in-progress-items-b0c80b`)를 절대경로로 직접 열어 수행했다.

## 발견사항

교차 검토 결과 **CRITICAL/WARNING 없음**. 확인한 교차-참조는 모두 정합했다.

- **[INFO] 섹션 번호 정정과 신규 절 신설이 실제 README 구조와 일치**
  - target 위치: `spec/conventions/migrations.md` §3 (`migrate-repair` 참조를 §5→§6 으로 정정) 및 §4 말미(§5 "인덱스 교체는 DROP-먼저" 참조 신규 문단)
  - 충돌 대상(교차 검증): `codebase/backend/migrations/README.md` §5·§6
  - 상세: README.md 를 직접 읽어 확인한 결과, `migrate-repair` 절차는 실제로 §6("테이블-rewrite 형 `ALTER COLUMN TYPE`") 말미(207~224행)에 있고, "인덱스 교체는 DROP-먼저" 패턴은 실제로 §5(125~176행) 안에 신설되어 있다. 두 참조 모두 정확 — 충돌이 아니라 **정합 확인**.
  - 제안: 없음(정보성 기록).

- **[INFO] `spec-impl-evidence.md` 신규 예외 조항과 `review-citations.md` 상호 참조가 양방향으로 정합**
  - target 위치: `spec/conventions/spec-impl-evidence.md` §2.1 `code:` 필드 정의 (신규 예외 문장)
  - 충돌 대상(교차 검증): `spec/conventions/review-citations.md` Rationale "`code:` 가 '구현 경로' 가 아니라 '준수 예시' 를 가리키는 이유"
  - 상세: 두 문서가 서로를 선례/근거로 명시 인용하며 내용이 어긋나지 않는다. `review-citations.md` 의 `code:` (2개 파일: `roles.guard.spec.ts`, `sanitize-loader-error.ts`)를 실제로 열어 확인한 결과 둘 다 전체경로+날짜 형식의 리뷰 인용(`review/code/2026/05/26/12_10_38`, `review/code/2026/08/08/20_53_48`)을 담고 있어 "이 규약을 실제로 지키는 예시 파일"이라는 주장과 일치. `spec/conventions/*.md` 전수를 훑어 다른 "시행 코드 없는 순수 문서형 convention"이 새 예외를 어기고 넓은 글롭을 쓰는 사례도 없음(모든 다른 convention 의 `code:` 는 실제 시행/구현 코드).
  - 제안: 없음.

- **[INFO] `review-citations.md` §3 의 DTO JSDoc 제외 근거가 `swagger.md` §3 실제 문구와 일치**
  - target 위치: `spec/conventions/review-citations.md` §3 적용 범위 표 ("DTO·컨트롤러의 JSDoc — swagger.md §3 이 정한 대로 `//` 주석에 적음")
  - 충돌 대상(교차 검증): `spec/conventions/swagger.md` §3 "JSDoc 은 공개 OpenAPI 로 나간다 — 내부 서사를 담지 않는다" (2026-09-05 규약화)
  - 상세: `swagger.md` 는 이 프롬프트 번들에서는 예산 초과로 절단돼 있었으나 실제 파일(306~318행)을 직접 읽어 확인한 결과, "내부 서사(리뷰 참조 등)는 JSDoc 이 아니라 그 위의 `//` 주석에 적는다"는 표까지 정확히 일치한다. 두 문서가 같은 날(2026-09-05) 등재되며 서로의 존재를 인지하고 있고, `review-citations.md` 자체가 Rationale 에서 "실제 위반 사례는 없다"고 명시해 이미 자체 확인됨.
  - 제안: 없음.

- **[INFO] `plan-lifecycle.md` 인용 문구가 정확히 일치**
  - target 위치: `spec/conventions/review-citations.md` §3 표 (`review/**` 산출물 = 대상 아님, 근거로 `plan-lifecycle.md` 인용)
  - 충돌 대상(교차 검증): `.claude/docs/plan-lifecycle.md` 44행
  - 상세: 인용된 문구("`review/**` 같은 시점 기록 문서는 옛 경로 유지")가 실제 문서 44행과 정확히 일치. 조작/오인용 없음.
  - 제안: 없음.

- **[INFO] `id:` 충돌 없음 / PROJECT.md 자동 가드 표 갱신 불필요**
  - target 위치: `spec/conventions/review-citations.md` frontmatter `id: review-citations`
  - 충돌 대상(교차 검증): `spec/**` 전체 grep, `PROJECT.md §자동 가드`
  - 상세: `id: review-citations` 는 다른 spec 문서와 충돌하지 않는다(유일 사용처 2곳 — 자기 자신과 `spec-impl-evidence.md` 의 참조 링크뿐). 이 convention 은 자체 시행 가드가 없다고 명시하므로 `spec-impl-evidence.md §6` Rollout 절차의 "PROJECT.md §자동 가드 표에 해당 row 추가" 의무 대상이 아니며, 실제로 `PROJECT.md` §자동 가드 표에도 해당 row 가 없다 — 이는 누락이 아니라 규약과 일치하는 상태다.
  - 제안: 없음.

## 요약

이번 라운드의 spec 델타(migrations.md 소폭 정정, review-citations.md 신규, spec-impl-evidence.md 예외 조항 1문장)는 데이터 모델·API 계약·요구사항 ID·상태 전이·RBAC·계층 책임 어느 관점에서도 다른 `spec/**` 영역과 직접 충돌하지 않는다. 오히려 이번 변경이 인용한 모든 교차-참조(README.md §5/§6 섹션 번호, swagger.md §3, plan-lifecycle.md 인용문, 선행 V110 마이그레이션 예시)를 워킹트리에서 직접 열어 대조한 결과 전부 정확했다. 세 파일 모두 순수 컨벤션/프로세스 문서라 엔티티·API·상태 머신·RBAC 정의를 새로 도입하지 않으며, 유일한 신규 관례(review-citations)도 기존 `spec-impl-evidence.md`·`swagger.md`와 같은 날 상호 인지하며 등재되어 표면 중첩(DTO JSDoc)을 이미 자체적으로 해소해 두었다.

## 위험도

NONE
