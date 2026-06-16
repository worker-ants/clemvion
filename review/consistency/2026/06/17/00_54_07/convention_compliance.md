# 정식 규약 준수 검토 결과

**검토 대상**: `spec/7-channel-web-chat` (4-security.md 중심, 전 영역 문서 포함)
**검토 모드**: 구현 완료 후 (--impl-done, diff-base=origin/main)

---

## 발견사항

### [WARNING] `refactor 04 m-1` — 대소문자 불일치 (정식 레이블 `M-1`)
- **target 위치**: `spec/7-channel-web-chat/4-security.md` §1 보안 정책 요약 테이블, `입력 sanitize` 행 끝 `(refactor 04 m-1)`
- **위반 규약**: `spec/conventions/swagger.md §0` — 해당 파일 제목·섹션에 `refactor 04 M-1`(대문자 M, 하이픈)로 표기. 프로젝트에서 refactor batch 태그는 `M-1`/`M-2`/… 형식으로 일관 사용됨(`swagger.md §0`, `§0 Swagger UI 노출 정책 (non-production 전용 — refactor 04 M-1)`).
- **상세**: 같은 리팩토링 배치(refactor 04)를 이 문서만 소문자 `m-1`로 참조해 배치 레이블이 불일치함. 검색 및 레이블 기반 추적이 어려워짐.
- **제안**: `(refactor 04 m-1)` → `(refactor 04 M-1)` 로 수정.

---

### [WARNING] `spec/7-channel-web-chat/4-security.md` 의 `§1.1` 섹션과 `safe-html.ts` code: 등재 불일치
- **target 위치**: `spec/7-channel-web-chat/4-security.md` 프롬프트 페이로드 기준 — `§1.1 마크다운/HTML sanitize 정책 매트릭스` 섹션 및 frontmatter `code:` 의 `codebase/channel-web-chat/src/lib/safe-html.ts`
- **위반 규약**: `spec/conventions/spec-impl-evidence.md §2.1` — `status: partial` / `implemented` 인 spec 의 `code:` 는 실제 구현 경로를 포함해야 하며 `spec-code-paths.test.ts` 가 glob ≥1 매치를 강제. 또한 CLAUDE.md 의 단일 진실 원칙 — 본문에서 참조하는 코드 SoT 파일은 frontmatter `code:` 에도 등재되어야 한다.
- **상세**: `§1.1` 본문이 `codebase/channel-web-chat/src/lib/safe-html.ts` 를 코드 SoT 로 명시하나, 작업 트리의 현재 파일(`git show HEAD:spec/7-channel-web-chat/4-security.md`)에는 이 경로가 `code:` 블록에 빠져 있다. 프롬프트 페이로드(orchestrator 가 수집한 버전)에는 포함돼 있으나 실제 디스크 파일과 불일치한다. `§1.1` 본문 자체도 실제 파일에 없는 상태이며, 두 항목이 동시에 누락됐다.
- **제안**: `§1.1` 섹션 유지 시 frontmatter `code:` 에 `codebase/channel-web-chat/src/lib/safe-html.ts` 를 포함할 것. `§1.1` 을 제거할 경우 `§1` 요약 테이블의 sanitize 행이 `§1.1` 을 cross-ref 해서는 안 됨.

---

### [INFO] `§1` 요약 테이블 `입력 sanitize` 행 — 구현 세부가 §1.1 과 §1 사이에서 분산
- **target 위치**: `spec/7-channel-web-chat/4-security.md` §1 테이블 `입력 sanitize` 행
- **위반 규약**: CLAUDE.md 단일 진실 원칙 — 동일 내용을 두 곳에서 산문화하면 drift 발생. 현재 `§1` 행에 `deny-by-default`, DOMPurify 구체 구현 세부(API 이름 `ALLOWED_TAGS`/`ALLOWED_ATTR`/`ALLOWED_URI_REGEXP`)가 직접 기술되고, `§1.1` 에도 동일 내용의 표가 있다(프롬프트 페이로드 기준).
- **상세**: `§1` 요약 테이블은 정책 **요약**용이므로 구현 세부(특정 라이브러리 API 이름)는 `§1.1` 전용이어야 한다. `§1` 에 `DOMPurify ALLOWED_TAGS/ALLOWED_ATTR/ALLOWED_URI_REGEXP` 를 반복하면 `§1.1` 갱신 시 `§1` 도 같이 갱신해야 하는 불필요한 SoT 분산이 생긴다.
- **제안**: `§1` 행은 `XSS 방지 — deny-by-default 화이트리스트(위젯 책임). 세부 §1.1` 수준으로 간결히 유지하고, 구체 구현 세부는 `§1.1` 에만 두는 것이 단일 진실 원칙에 부합한다.

---

### [INFO] `spec/7-channel-web-chat` 전 문서 — `_product-overview.md` 의 `## Overview` vs 본문 구조
- **target 위치**: `spec/7-channel-web-chat/_product-overview.md`
- **위반 규약**: CLAUDE.md "문서 구조 규약" — `_product-overview.md` 의 권장 구조는 `## Overview / 본문 / Rationale` 3섹션. 현재 `## 1. 개요 / 문제`, `## 2. 목표 / 비목표`, `## 3. 사용 시나리오`, `## 4. 제품 구성요소`, `## Rationale` 로 구성돼 있어 Rationale 외의 앞 4섹션을 `## Overview` 단일 섹션으로 통합하지 않고 별개 번호 섹션으로 분리한 형태다.
- **상세**: CLAUDE.md 는 Overview / 본문 / Rationale 3섹션을 "권장"으로 명시. 현 구조는 번호 섹션으로 세분화돼 있고 최상위 `## Overview` 가 없다. 기술 명세 파일들(`0-architecture.md` 등)은 번호 섹션을 쓰는 것이 일반적이나, `_product-overview.md` 는 진입 문서로서 단일 `## Overview` 또는 overview 성격의 섹션 그룹 후 Rationale 을 두는 패턴이 더 가깝다.
- **제안**: `_product-overview.md` 에 `## Overview` 헤더를 추가하거나 현 섹션 구조가 의도적임을 규약 갱신으로 명시할 것. 현재 상태가 타 규약을 직접 위반하지는 않으므로 INFO 등급.

---

## 요약

`spec/7-channel-web-chat` 영역 문서는 spec-impl-evidence 의 frontmatter 의무(id/status/code/pending_plans), 문서 명명(`_product-overview.md`, `0-` prefix, 번호 섹션), API 문서 데코레이터·DTO 패턴과 관련해서는 전반적으로 규약을 준수한다. 주요 발견은 두 가지다. 첫째, `4-security.md` 의 `입력 sanitize` 행에서 refactor 배치 태그가 소문자 `m-1`(`refactor 04 m-1`)로 기재돼 프로젝트 전체 레이블(`M-1`)과 불일치한다. 둘째, `§1.1` 섹션 및 `safe-html.ts` code: 등재가 프롬프트 페이로드(orchestrator 수집본)과 실제 디스크 파일 사이에 불일치하며, 이 두 항목이 함께 누락돼 있어 spec-impl-evidence `spec-code-paths.test.ts` 가드 위험이 있다. 금지 패턴 답습은 없으며 API 응답 봉투·에러 코드 명명 위반도 없다.

## 위험도

LOW
