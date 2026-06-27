# 정식 규약 준수 검토 결과

검토 모드: --impl-done (diff-base=origin/main)
Target 경로: `spec/conventions/`
검토일: 2026-06-27

---

## 발견사항

### [WARNING] `spec/conventions/swagger.md` — `## Overview` 섹션 부재

- **target 위치**: `spec/conventions/swagger.md` 전체 구조 (제목 다음 바로 `## 0) Swagger UI 노출 정책...` 로 시작)
- **위반 규약**: CLAUDE.md "Spec 문서 3섹션 구성 (Overview / 본문 / Rationale)" 권장. `spec/conventions/audit-actions.md` 는 동일 계층의 같은 conventions 문서로 `## Overview` 를 명시하고 있어 일관성 차이 발생.
- **상세**: `swagger.md` 는 `## Rationale` 섹션(말미)은 갖추고 있지만 권장 3섹션 중 첫 번째인 `## Overview` 가 없다. 본 브랜치(swagger-passthrough-crossref) 에서 `spec/5-system/2-api-convention.md` 가 `swagger.md` 의 `§2-5` 를 cross-ref 하므로 이 문서의 가독성·구조가 더 중요해졌다. 다만 `swagger.md` 자체는 이 브랜치에서 변경되지 않았으므로 pre-existing deviation 이다.
- **제안**: `swagger.md` 의 `# Swagger 문서화 일관된 패턴 가이드` 제목 바로 아래에 `## Overview` 섹션을 추가해 "무엇을 다루는 규약인가 + 적용 범위"를 1~3 문장으로 기술한다. 현재 제목 아래 플러그인 설명 2개 bullet 이 실질적 Overview 역할을 하므로 해당 내용을 `## Overview` 아래로 이동하면 충분하다.

---

### [INFO] 카탈로그 resource 인덱스 파일(`application.md`, `category.md`) — `## Rationale` 섹션 없음

- **target 위치**: `spec/conventions/cafe24-api-catalog/application.md`, `spec/conventions/cafe24-api-catalog/category.md` (다른 resource 인덱스도 동일 패턴일 가능성 높음)
- **위반 규약**: CLAUDE.md "결정의 배경·근거 → 해당 spec 문서 끝의 `## Rationale`" 권장
- **상세**: 두 파일 모두 `id`+`status: implemented` 를 보유한 정식 spec 으로 `spec-frontmatter.test.ts` 검증 대상이다. 그러나 문서 구조상 `## 표` + `## Field-level 상세 카탈로그` 만 존재하며 Rationale 이 없다. `_overview.md §2` 가 정의한 catalog resource 파일 형식은 "enumeration 표"만 규정하고 Rationale 을 요구하지 않으므로, 카탈로그-도메인 내에서는 이 구조가 자연스럽다. 설계 결정 사유를 기술할 필요가 없는 순수 enumeration 목록이기 때문이다.
- **제안**: 규약 자체를 갱신하는 쪽이 적절하다. `spec/conventions/cafe24-api-catalog/_overview.md §2` (또는 §7.1) 에 "resource 인덱스 파일은 Rationale 면제" 를 한 줄 명시하면 Rationale 권장 규약과의 충돌을 공식 해소할 수 있다. 현재는 암묵적 면제 상태.

---

### [INFO] `spec/conventions/cafe24-api-catalog/_overview.md` — `## Rationale` 섹션 없음

- **target 위치**: `spec/conventions/cafe24-api-catalog/_overview.md` 전체
- **위반 규약**: CLAUDE.md "결정의 배경·근거 → 해당 spec 문서 끝의 `## Rationale`" 권장
- **상세**: `_overview.md` 는 `_*.md` basename 으로 `spec-frontmatter.test.ts` 의 frontmatter 의무에서 면제된 index/layout 성격 문서다. 설계 근거가 문서화되지 않은 상태이나, 이 파일은 생성기 운영 지침 + 동기 정책을 담는 operational reference 성격이라 Rationale 없이도 용도가 명확하다. 빌드 차단 대상이 아님.
- **제안**: 현상 유지. 다만 향후 카탈로그 정책을 변경할 때 변경 이유를 `## Rationale` 절로 누적해 두면 유용하다.

---

### [INFO] `spec/5-system/2-api-convention.md` 신규 cross-ref anchor 유효성 확인

- **target 위치**: `spec/5-system/2-api-convention.md` §5.2 추가 blockquote (`../conventions/swagger.md#2-5-응답-wrapping`)
- **위반 규약**: `spec-link-integrity.test.ts` — in-repo `[..](path#anchor)` 타깃 heading slug 대조
- **상세**: 추가된 링크 `[Swagger 규약 §2-5 응답 wrapping](../conventions/swagger.md#2-5-응답-wrapping)` 의 대상 heading 은 `spec/conventions/swagger.md` 의 `### 2-5. 응답 wrapping` (line 204). github-slugger 규칙("2-5. 응답 wrapping" → 점 제거·공백→하이픈) 적용 결과 slug = `2-5-응답-wrapping`. **앵커 일치 — 링크 유효.** 빌드 가드 통과 예상.
- **제안**: 조치 불필요.

---

## 요약

`spec/conventions/` 문서들은 전반적으로 정식 규약 준수 상태다. 필드 레벨 카탈로그 파일(`application/apps.md` 등)은 `spec-impl-evidence §1 R-7` 면제 대상으로 `resource`/`entity`/`cafe24_docs`/`source` frontmatter 를 올바르게 사용하고 있다. 카탈로그 resource 인덱스(`application.md`, `category.md`)는 `id`/`status: implemented` + `code:` 를 보유해 frontmatter 가드를 통과한다. 주요 규약 문서인 `swagger.md` 는 `## Rationale` 를 갖추고 있으나 `## Overview` 섹션이 없어 동일 계층의 `audit-actions.md` 와 구조 일관성이 어긋난다. 이 브랜치에서 추가된 cross-ref(`2-api-convention.md → swagger.md#2-5-응답-wrapping`)는 anchor 가 유효하며 link-integrity 가드 통과가 예상된다. CRITICAL 위반은 없고, WARNING 1건(swagger.md Overview 부재)·INFO 3건이 전부다.

## 위험도

LOW
