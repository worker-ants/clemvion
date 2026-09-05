# 정식 규약 준수 검토 — `spec/conventions/migrations.md` · `spec/conventions/review-citations.md`

검토 모드: `--impl-done`, scope=`spec/conventions/`, diff-base=`origin/main`.
실제 델타: `spec/conventions/migrations.md` (§5 에 5줄 추가) · `spec/conventions/review-citations.md` (신규 파일, 111줄) + 구현 diff `codebase/backend/migrations/README.md` (54줄, §5 "인덱스 교체는 DROP-먼저" 절 신설).

## 발견사항

- **[WARNING]** `review-citations.md` §3 적용 범위가 이미 등록된 자매 규약(`swagger.md` §3)과 겹치는 표면에서 상충 여지를 만든다
  - target 위치: `spec/conventions/review-citations.md` §3 "적용 범위 — `codebase/**` 의 코드·테스트 주석" (적용 대상 표)
  - 위반 규약: `spec/conventions/swagger.md` §3 "주석/설명 톤" — **"JSDoc 은 공개 OpenAPI 로 나간다 — 내부 서사를 담지 않는다"** (2026-09-05 규약화, 이미 `origin/main`): "정정 경위·리뷰 참조·'왜 이렇게 바꿨는지' 같은 내부 서사는 JSDoc 이 아니라 그 위의 `//` 주석에 적는다"
  - 상세: 두 규약 모두 `status: implemented` 이고 `codebase/backend/src/**/dto/*.ts` 같은 동일 표면(JSDoc 이 붙는 DTO 필드)에 적용된다. `review-citations.md` §1-1 이 처방하는 "리뷰 산출물 인용"은 swagger.md §3 이 예로 드는 "정정 경위·리뷰 참조" 그 자체다 — 즉 review-citations.md 의 형식(전체 경로+날짜)을 만족하는 인용이라도 그것을 DTO 필드의 `/** ... */` 안에 넣으면 swagger.md §3 을 위반한다(공개 OpenAPI 문서에 내부 서사 유출). `review-citations.md` 는 이 구분(JSDoc `/** */` vs 상단 `//`)을 §3 적용 범위 표에서 전혀 언급하지 않아, "코드·테스트 주석" 이라는 넓은 표현만 보고 DTO JSDoc 에 인용을 추가하는 사례가 나올 수 있다. 실측: 현재 `alert-rule-response.dto.ts` 의 `threshold` JSDoc(swagger.md §3 이 예시로 드는 자리)에는 아직 리뷰 인용이 없어 **현재 위반 사례는 없음** — 잠재적 상충이다.
  - 제안: `review-citations.md` §3 표에 한 행 추가 — "DTO/컨트롤러의 `/** */` JSDoc (OpenAPI 로 노출)" 은 대상 아님, swagger.md §3 규약에 따라 상단 `//` 주석에 적는다"는 취지의 cross-reference. 두 규약이 같은 날(2026-09-05) 등재됐다는 점에서 상호 링크 누락은 조정 실수로 보인다.

- **[INFO]** `review-citations.md` §3 적용 범위 표가 실제로 동일 패턴이 쓰이는 위치를 다 덮지 않는다
  - target 위치: `spec/conventions/review-citations.md` §3 적용 대상 표 (`codebase/**` / `plan/**` / `review/**` 세 갈래만 열거)
  - 위반 규약: 없음(명시적 위반은 아님) — CLAUDE.md 폴더 구조 표가 "애플리케이션 코드는 `codebase/` 하위"로 한정하므로 표 자체는 그 정의와 일관적
  - 상세: 실측 — `scripts/check-pnpm-security-config.py:21` 과 `.github/workflows/deps-security-checks.yml:17` 에 이미 동일한 "전체 경로 리뷰 인용"(`review/code/2026/07/14/08_25_10`) 패턴이 존재한다. 둘 다 우연히 이미 "전체 경로" 권장 형태를 쓰고 있어 현재는 문제 없지만, `review-citations.md` 의 규정력이 미치지 않는 지대라 향후 이 두 위치에 bare `hh_mm_ss` 인용이 추가돼도 이 규약으로는 금지되지 않는다.
  - 제안: 조치 불요(스코프 경계는 CLAUDE.md 와 일관) — 다만 §3 표 각주에 "`scripts/**`·`.github/**` 는 `codebase/` 밖이라 스코프 밖"이라는 한 줄을 명시하면 다음 사람이 "왜 두 곳이 빠졌지" 라고 재질문하는 걸 예방할 수 있다.

## 검증한 항목 (위반 없음 확인)

- **frontmatter 스키마** (`spec/conventions/spec-impl-evidence.md` §2 기준): `review-citations.md` 의 `id: review-citations` (basename 일치) · `status: implemented` · `code:` 2개 파일 — 둘 다 실존 확인(`codebase/backend/src/common/guards/roles.guard.spec.ts`, `codebase/frontend/src/components/llm-config/sanitize-loader-error.ts`), `spec-code-paths.test.ts` 가 요구하는 "≥1 매치" 통과. `id` 충돌 없음(전체 conventions frontmatter 대조).
- **문서 구조 3섹션** (CLAUDE.md "Overview / 본문 / Rationale"): `review-citations.md` 는 `## Overview (제품 정의)` → 본문 §1~§4 → `## Rationale` 순서로 구성 — `spec-impl-evidence.md` 와 동일한 heading 문구("Overview (제품 정의)") 사용, 기존 관례와 정확히 일치.
- **제목 표기 스타일**: `# Convention: 코드 주석의 리뷰 산출물 인용` — `rag-evaluation.md`/`user-guide-evidence.md` 가 쓰는 기존 `# Convention: ...` 패턴과 일치(`spec/conventions/*.md` 전체가 이미 4가지 스타일이 혼재하므로 위반 아님).
- **자체 인용 형식 self-consistency**: `review-citations.md` 본문이 스스로 인용하는 `review/code/2026/09/05/00_06_38`, `review/code/2026/09/05/09_27_04`, `f7c56bf0a` 등이 모두 자신이 처방하는 "전체 경로"/커밋 SHA 형태를 따름.
- **경험적 수치 신뢰성**: "107개 파일 · 514회" 주장 — 실측 재현 결과 파일 수 **107 (정확히 일치)**, 발생 횟수 **506** (문서 주장 514 와 근접, 정규식 경계 차이로 추정) → 수치가 지어낸 값이 아님을 확인. "review/code/2026/05/26/12_10_38 이 워킹트리에 없다"는 주장도 실측 일치.
- **README.md §5 인용 정확성** (`migrations.md` 신규 5줄): `[README.md §5 "인덱스 교체는 DROP-먼저"]` 링크·앵커·인용구 — README.md 실제 `### 5. executeInTransaction=false ...` 절 안에 `**인덱스 교체는 DROP-먼저**` 문구 실존 확인. 상대경로(`../../codebase/backend/migrations/README.md`) resolve 정상. 선례로 든 `V110__schedule_workspace_next_run_index.sql`(및 대조군 `V056`/`V106`) 모두 실존 + 내용이 README 서술과 일치.
- **Append-only 원칙과의 정합**: 신설된 "DROP-먼저" 패턴은 신규 마이그레이션 파일 작성 규칙이지 기존 V번호 수정이 아니므로 `migrations.md` §3 (Append-only) 와 상충하지 않음.
- **spec-area-index 예외**: `spec/conventions/` 는 flat reference 로 index 의무 면제(`spec-impl-evidence.md` §4.2) — 신규 파일 추가에 별도 index 갱신 불요, 실제로 갱신 안 됨은 위반 아님.

## 요약

이번 델타(`migrations.md` 소규모 추가 5줄 + 신규 `review-citations.md`)는 frontmatter 스키마·문서 3섹션 구조·id 명명·상호 링크 정확성 면에서 기존 `spec/conventions/` 관례를 정확히 재현하고 있고, 두 문서가 제시하는 경험적 수치·선례 인용은 모두 재현 검증에서 실측과 부합해 "지어낸 근거" 문제가 없다. 유일하게 실질적인 지적은 신설된 `review-citations.md` 가 같은 날 등재된 `swagger.md` §3(JSDoc 공개 노출 규칙)과 표면이 겹치는데도 서로를 인용하지 않아, DTO JSDoc 에 리뷰 인용을 넣는 미래 사례에서 두 규약이 충돌할 잠재 여지를 남긴 것이다(현재 코드에 실제 위반 사례는 없음). 나머지 하나는 적용 범위 표가 실제 존재하는 두 위치(`scripts/**`, `.github/**`)를 침묵으로 남긴 완결성 관찰로, CLAUDE.md 정의와는 일관되어 조치 필요성이 낮다.

## 위험도

LOW
