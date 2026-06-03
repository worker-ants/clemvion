# 정식 규약 준수 검토 결과

검토 대상: `spec/` 전체 (--impl-done, scope=spec/, diff-base=origin/main)
검토 일시: 2026-06-03
검토 규약 기준: `spec/conventions/**`

---

## 발견사항

### [CRITICAL] spec/4-nodes/0-overview.md — spec-impl-evidence 의무 frontmatter 누락

- **target 위치**: `/spec/4-nodes/0-overview.md` 전체 파일 (파일 상단에 frontmatter 없음)
- **위반 규약**: `spec/conventions/spec-impl-evidence.md §1` — 적용 대상 목록에 `spec/4-nodes/**.md` 명시. 예외는 `spec/_*.md` 및 `spec/<영역>/_*.md`(밑줄 prefix)에 한정됨. `0-overview.md`는 밑줄 prefix가 아니므로 예외 해당 없음.
- **상세**: 파일 첫 행이 `# Spec: 노드 시스템 설계 개요`로 시작하며 YAML frontmatter(`---`)가 전혀 없다. `spec-impl-evidence §1`의 적용 대상인 `spec/4-nodes/**` 패턴에 해당하므로 `id:`, `status:` 필드 및 `status` 값에 따른 `code:`·`pending_plans:` 가 의무다. 동 파일에는 `§4. 노드 플러그인 인터페이스 (미구현 / Planned)` 섹션이 존재해 일부 미구현 surface가 포함됨에도 불구하고 `status` 분류가 없는 상태다. build-time 가드(`spec-frontmatter.test.ts`)가 이 파일을 누락으로 감지해야 한다.
- **제안**: 아래 frontmatter를 파일 상단에 추가한다. `§4` 미구현 surface가 있으므로 `status: partial`이 적절하며, `pending_plans:` 에 해당 작업을 추적하는 plan 파일을 등록해야 한다. 구현 완료 섹션(§1~§3)의 코드 경로도 `code:` 에 기재.

  ```yaml
  ---
  id: nodes-overview
  status: partial
  code:
    - codebase/backend/src/nodes/**
    - codebase/packages/node-summary/**
  pending_plans:
    - plan/in-progress/<노드-플러그인-SDK-plan>.md
  ---
  ```

---

### [WARNING] spec/conventions/*.md — `## Overview` 헤딩 형식 불일치

- **target 위치**: `spec/conventions/migrations.md` (line 15), `spec/conventions/swagger.md` (line 10), `spec/conventions/error-codes.md` (line 10)
- **위반 규약**: CLAUDE.md §문서 구조 규약 — "단일 spec 파일 영역은 본문 상단에 `## Overview (제품 정의)` 섹션을 직접 둔다". `spec/conventions/spec-impl-evidence.md`(line 19)는 동일 conventions 폴더 내에서 `## Overview (제품 정의)` 형식을 준수하는 반면, migrations.md·swagger.md·error-codes.md는 `## Overview`(괄호 없음)만 사용한다.
- **상세**: 같은 `spec/conventions/` 폴더 안에서 `## Overview (제품 정의)` 형식(spec-impl-evidence.md)과 `## Overview` 형식(migrations.md, swagger.md, error-codes.md)이 혼용되고 있다. 컨벤션 문서들이 각자 서로 다른 헤딩 형식을 사용하면 자동 파서가 Overview 섹션을 일관성 없이 인식한다.
- **제안**: conventions 파일에 대한 헤딩 형식을 통일한다. 두 가지 방향 중 하나를 선택:
  1. (권장) `spec-impl-evidence.md`의 `## Overview (제품 정의)` 형식을 표준으로 채택하고 나머지 3개 파일에도 동일하게 적용.
  2. conventions 파일은 product-area spec이 아니므로 단순 `## Overview`를 허용하고 `spec-impl-evidence.md`만 맞춤 — 이 경우 CLAUDE.md 에 "conventions 파일은 `## Overview`(괄호 없음) 허용" 예외를 명문화.

---

### [INFO] spec/2-navigation/ — 파일 번호 12번 누락 (gap)

- **target 위치**: `spec/2-navigation/` 폴더 파일 목록 (11-error-empty-states.md 다음 13-user-guide.md)
- **위반 규약**: CLAUDE.md §문서 구조 규약 `N-name.md` 패턴 — 연속 번호가 명시적으로 요구되지는 않음. 위반은 아니나 형식 일관성 차원의 메모.
- **상세**: 2-navigation 폴더에 0~11, 13~15 번호가 존재하며 12번 파일이 없다. 번호 gap은 삭제된 spec 파일의 흔적이거나 의도적 예약일 수 있다. 규약상 번호 연속성은 강제되지 않으므로 위반은 아님.
- **제안**: 의도적 gap이라면 무시해도 무방. 이전 spec 파일이 삭제됐다면 주변 문서의 링크 검사 권장(cross-reference 깨짐 여부 확인).

---

## 요약

`spec/` 전체 정식 규약 준수 관점에서 대부분의 파일은 `spec/conventions/spec-impl-evidence.md`의 frontmatter 의무를 충실히 이행하고 있다. `spec/2-navigation/`, `spec/3-workflow-editor/`, `spec/5-system/`, `spec/7-channel-web-chat/`, `spec/conventions/` 영역의 모든 대상 파일이 frontmatter를 보유하며 `status`·`code:`·`pending_plans:` 필드 분류도 일관적이다. 단, **`spec/4-nodes/0-overview.md`가 `spec/4-nodes/**` 적용 대상임에도 frontmatter 전체가 누락**되어 있어 build-time 가드(`spec-frontmatter.test.ts`)가 실패해야 할 상태다 — 이는 정식 규약의 직접 위반(CRITICAL)이다. 보조적으로 `spec/conventions/` 내 `## Overview` vs `## Overview (제품 정의)` 헤딩 형식 불일치(WARNING)가 존재하며, 2-navigation의 12번 파일 gap은 경미한 형식 메모(INFO)다.

---

## 위험도

**MEDIUM** — CRITICAL 1건은 `spec/4-nodes/0-overview.md`의 frontmatter 누락으로, `spec-frontmatter.test.ts` build-time 가드가 감지해야 하는 항목이 미감지 상태이거나 가드 자체가 아직 이 파일을 커버하지 못하는 상황이다. 미구현 surface(`§4 플러그인 SDK`)의 `pending_plans:` 추적이 없어 해당 surface가 plan orphan 상태로 남는다.
