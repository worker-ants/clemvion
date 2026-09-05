# 정식 규약 준수 검토 — convention_compliance

## 검토 대상

`--impl-done` 모드, diff-base `origin/main`, scope `spec/conventions/`. 실제 델타 3개 파일:

- `spec/conventions/migrations.md` (기존 문서 소폭 수정 — 링크/각주 2건)
- `spec/conventions/review-citations.md` (신규 136줄 — 새 정식 규약)
- `spec/conventions/spec-impl-evidence.md` (기존 문서 1개 필드 정의에 예외 조항 추가)

검토는 HEAD 워킹트리(`/Volumes/project/private/clemvion/.claude/worktrees/plan-in-progress-items-b0c80b`)를 절대경로로 직접 열어 실측했다(코드 존재, 링크 타깃, 인용 경로 실재, 수치 주장 재계산 포함).

## 발견사항

발견된 CRITICAL/WARNING 없음. 아래는 정식 규약 준수 관점에서 확인한 항목과 그 결과다 (모두 통과, 참고용 근거로 남김).

### 확인 1 — 신규 convention 문서(`review-citations.md`)의 문서 구조 규약

- target 위치: `spec/conventions/review-citations.md` 전체
- 대조 규약: CLAUDE.md "Spec 문서 3섹션 구성 (Overview / 본문 / Rationale)", `spec-impl-evidence.md` §1·§2 frontmatter 스키마
- 상세: frontmatter(`id: review-citations` / `status: implemented` / `code:` 2개 파일) → `## Overview (제품 정의)` → `## 1~4` 본문 → `## Rationale` 순서로 구성되어 3섹션 권장 패턴을 그대로 따른다. `id`는 basename 과 일치하고 다른 conventions 문서와 충돌하지 않음 (`grep '^id:' spec/conventions/*.md` 전수 확인, 중복 없음). 파일명도 기존 conventions 파일들과 동일하게 prefix 없는 kebab-case.
- 결론: 위반 없음.

### 확인 2 — `code:` frontmatter 필드의 실재성 (신규 예외 조항 검증)

- target 위치: `review-citations.md` frontmatter `code:` 2건, `spec-impl-evidence.md` §2.1 `code` 필드 정의에 추가된 예외 문구
- 대조 규약: `spec-impl-evidence.md` §2.1 (신설된) "시행 코드가 없는 순수 문서형 convention" 예외 — "그 규약을 실제로 지키는 예시 파일을 적는다"
- 상세: 실측 결과 두 파일 모두 워킹트리에 실존하고(`codebase/backend/src/common/guards/roles.guard.spec.ts`, `codebase/frontend/src/components/llm-config/sanitize-loader-error.ts`), 실제로 "전체 경로" 인용 형태(`review/code/2026/08/08/20_53_48`, `review/code/2026/05/26/12_10_38`)를 본문에 담고 있어 이 규약이 처방하는 형태의 준수 예시가 맞다. Rationale 의 "저장소에 10개 있고 backend·frontend 에서 하나씩"이라는 수치도 `git grep -lE 'review/(code|consistency|merge)/20[0-9]{2}/...' -- 'codebase/**'` 로 재계산하면 정확히 10건 — 실측이 맞다.
- 결론: 위반 없음. `spec-impl-evidence.md`와 `review-citations.md` 양쪽에 예외를 동시 등재해 SoT 단일화 원칙(memory: "선례에 없는 근거를 소급 부여하지 말 것", "SoT 동시 갱신")도 지켰다.

### 확인 3 — 상호 참조 링크·section 인용의 정확성

- target 위치: `migrations.md` 변경분 2건 (`README.md §6 말미`, `README.md §5` 인덱스 교체 패턴), `review-citations.md`의 `swagger.md §3` 인용
- 대조 규약: 문서 간 SoT 참조는 실제 절 위치와 일치해야 함(정식 규약 상호참조 원칙)
- 상세: `codebase/backend/migrations/README.md` 를 직접 열어 대조 — "인덱스 교체는 DROP-먼저" 문구가 실제로 §5(`### 5. executeInTransaction=false 파일은 한 statement 만`) 아래에 있고(README.md:141, 원문이 "같은 절(§5)" 라고 self-reference), `migrate-repair` 절차는 §6 말미(README.md:160)에 있음 — 두 인용 모두 정확. `swagger.md §3`(주석/설명 톤) 도 실제로 "JSDoc 은 공개 OpenAPI 로 나간다... 내부 서사는 `//` 주석에" 문구를 담고 있어 `review-citations.md` §3 표의 DTO/컨트롤러 JSDoc 제외 근거와 정합.
- 결론: 위반 없음.

### 확인 4 — 링크 경로 실존 (spec-link-integrity 대상)

- target 위치: `review-citations.md` 의 `[swagger.md §3](./swagger.md)`, `[plan-lifecycle.md](../../.claude/docs/plan-lifecycle.md)`
- 대조 규약: `spec-impl-evidence.md` §4.2 `spec-link-integrity.test.ts` (spec 본문의 in-repo 링크 타깃 실존)
- 상세: 두 경로 모두 실존 확인 (`spec/conventions/swagger.md`, `.claude/docs/plan-lifecycle.md`). anchor 없는 링크라 slug 대조도 해당 없음.
- 결론: 위반 없음.

### 확인 5 — 인용 자체의 자기 준수 (review-citations.md 가 스스로의 규칙을 따르는가)

- target 위치: `review-citations.md` Rationale 안의 세션 경로 인용 다수 (`review/consistency/2026/09/05/09_53_09`, `review/code/2026/09/05/{09_27_04,10_39_00,00_06_38}` 등)
- 대조 규약: `review-citations.md` §2 (bare `hh_mm_ss` 금지, 전체 경로 권장), §3 (`spec/**` 문서는 적용 대상)
- 상세: 모두 "전체 경로" 형태로 적혀 있고(§2 권장 형태), 워킹트리에서 실측하니 전부 실존하는 디렉터리(`git log --all` 이력 포함 1건 제외 전부 현재도 실존). 날짜 누락(bare) 케이스 없음.
- 결론: 위반 없음 — 이 문서는 스스로 처방한 인용 규칙을 자기 자신에게도 지켰다.

### INFO — Rationale 표현 "각주로 등재"가 실제 형태와 다소 어긋남

- **[INFO]** 문구 표현의 사소한 부정확
  - target 위치: `spec/conventions/review-citations.md` Rationale > "`code:` 가 '구현 경로' 가 아니라 '준수 예시' 를 가리키는 이유" 마지막 문장 — "이 예외는 `spec-impl-evidence.md` §2.1 `code:` 필드 정의에도 **각주**로 등재했다"
  - 위반 규약: 없음 (형식 강제 규약 아님, 순수 표현 일관성)
  - 상세: 실제 `spec-impl-evidence.md` 쪽 반영은 markdown footnote(`[^n]`) 가 아니라 §2.1 필드 정의 표의 같은 셀 안에 인라인 문장으로 삽입된 형태다. "각주"라는 단어를 "부기/추가 설명"의 느슨한 뜻으로 썼다면 문제 없지만, 문자 그대로 읽으면 실제 구현과 형식이 다르다.
  - 제안: "각주로" → "필드 정의 설명에" 등으로 표현을 정확히 맞추거나, 그대로 두어도 무방(강제되는 서식 규약이 없으므로).

## 요약

이번 델타(`migrations.md` 소폭 수정, `spec-impl-evidence.md` 필드 예외 추가, `review-citations.md` 신규 등재)는 spec/conventions/ 의 정식 규약 — frontmatter 스키마, 3섹션 구조, 파일/식별자 명명, 상호 링크·section 인용 정확성, 그리고 새로 도입한 규약이 스스로의 규칙(bare 인용 금지 등)을 준수하는지 — 모든 항목을 실측 대조한 결과 CRITICAL·WARNING 없이 통과했다. 신규 문서(`review-citations.md`)는 `spec-impl-evidence.md`와 예외 조항을 상호 동기화했고, 인용된 section 번호·경로·수치 주장이 모두 워킹트리 실측과 일치해 근거가 견고하다. 발견된 유일한 항목은 "각주"라는 표현이 실제 인라인 반영 형태와 미세하게 어긋난다는 INFO 수준의 서술 정확성 문제뿐이다.

## 위험도

NONE
