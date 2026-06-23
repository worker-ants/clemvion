# 정식 규약 준수 검토 — spec/2-navigation

검토 모드: --impl-prep (구현 착수 전)
검토 일시: 2026-06-23
대상 경로: spec/2-navigation/

---

## 발견사항

### [INFO] `_layout.md` — 밑줄 prefix 파일에 frontmatter 존재

- target 위치: `spec/2-navigation/_layout.md` lines 1-8 (frontmatter `id: layout`, `status: implemented`)
- 위반 규약: `spec/conventions/spec-impl-evidence.md §1` — `spec/<영역>/_*.md` (밑줄 prefix) 파일은 frontmatter 가드 **제외** 대상("layout/index 성격, leaf 아님")
- 상세: 규약은 밑줄 prefix 파일을 가드 면제 대상으로 열거하며 `_layout.md`, `_product-overview.md`, `_overview.md` 를 예시로 든다. `_layout.md` 에 `id:`/`status:` frontmatter 가 실제로 존재하는데, 이는 위반이 아니라 "불필요하지만 허용"의 영역이다 — 단, 가드가 이 파일을 면제하므로 `code:` 경로 실존 검증은 수행되지 않아 stale 해도 빌드가 통과한다. `_product-overview.md` 는 frontmatter 없음(규약 의도에 부합).
- 제안: 현 상태 유지 가능. 향후 `_layout.md` 를 일반 spec 으로 승격할 의도가 없다면 frontmatter 제거를 고려. 현재 빌드 게이트에 영향 없음.

### [INFO] 문서 구조 규약 — Overview 섹션 채택 일관성

- target 위치: spec/2-navigation 디렉토리 전체 (17개 spec 파일)
- 위반 규약: CLAUDE.md §정보 저장 위치 — "제품 정의·요구사항 → `_product-overview.md` 또는 진입 문서의 `## Overview`". 각 SKILL.md 가 "Overview / 본문 / Rationale 3섹션 권장"을 명시
- 상세: 
  - `14-execution-history.md`와 `6-config.md` 만 `## Overview (제품 정의)` 섹션을 가진다.
  - `0-dashboard.md` 는 `## 1. 개요`, 다수 파일은 `## 1. 화면 구조`로 시작한다.
  - `15-system-status.md`, `16-agent-memory.md`, `8-marketplace.md` 등은 Overview 섹션 없이 바로 본문으로 들어간다.
  - 규약은 "권장"이라 CRITICAL 은 아니지만, 파일 간 일관성이 없다.
- 제안: 현 구현 착수 단계에서는 blocking 아님. 신규 spec 작성 시 Overview / 본문 / Rationale 3섹션 패턴을 채택 권장. 기존 파일 소급 수정은 일관성 검토 시 별도 작업으로 처리.

### [INFO] `spec/2-navigation/2-trigger-list.md` — 구현 착수 타깃 파일 범위 확인

- target 위치: `spec/2-navigation/2-trigger-list.md` frontmatter `status: implemented`
- 위반 규약: 없음 (파악용 INFO)
- 상세: 현 작업(M-2 page API refactor)의 구현 대상인 trigger-list spec 은 `status: implemented`, `pending_plans:` 없음. 구현 변경이 이 spec 의 `code:` 목록에 영향을 준다면 해당 파일 `code:` 갱신이 필요하다. `spec-code-paths.test.ts` 가 `status: implemented` 파일의 `code:` 글로브를 ≥1 매치 검증하므로, glob 범위 밖으로 파일이 이동하면 빌드 게이트에 걸린다.
- 제안: 구현 완료 후 `spec/2-navigation/2-trigger-list.md` 의 `code:` 목록이 실제 변경된 파일 경로를 커버하는지 확인. 현재 `codebase/frontend/src/components/triggers/*.tsx` glob 로 인해 신규 컴포넌트는 자동 커버됨.

---

## 요약

`spec/2-navigation` 내 17개 spec 파일 전체에 대한 정식 규약 준수 검토 결과, CRITICAL·WARNING 발견사항 없음. 모든 파일이 `spec/conventions/spec-impl-evidence.md` 의 frontmatter 의무(`id`, `status`)를 충족하며, `status: partial` 3건(`1-workflow-list.md`, `3-schedule.md`, `9-user-profile.md`) 모두 `pending_plans:` 를 보유한다. API 응답 포맷·에러 코드·DTO 명명은 spec 문서 내에서 규약(`2-api-convention.md`, `error-codes.md`, `swagger.md`) 을 참조·준수하고 있다. INFO 수준의 사소한 형식 비일관성(Overview 섹션 채택 여부 불균일)이 존재하나 구현 착수를 차단하지 않는다.

---

## 위험도

NONE
