# 정식 규약 준수 검토 결과

**Target**: `spec/conventions/spec-impl-evidence.md`
**검토 모드**: 구현 완료 후 검토 (--impl-done, scope=spec/conventions/spec-impl-evidence.md, diff-base=origin/main)
**검토일**: 2026-06-04

---

## 발견사항

### [CRITICAL] spec-impl-evidence.md 의 `code:` frontmatter 에 신규 구현 가드 4건 미등록
- **target 위치**: `spec/conventions/spec-impl-evidence.md` frontmatter `code:` 리스트 (라인 4–10)
- **위반 규약**: `spec/conventions/spec-impl-evidence.md §2.1` — `status: implemented` 인 spec 의 `code:` 에는 해당 spec 이 약속한 surface 의 구현 경로를 ≥1 매치 의무로 등재해야 한다. §4 Build-time 가드 표 — 본 컨벤션의 모든 가드 파일이 `code:` 에 나열되어야 self-referential integrity 가 유지된다.
- **상세**: 이번 diff 는 다음 4개 신규 테스트 파일(+ 1개 공유 헬퍼)을 추가했다.
  - `codebase/frontend/src/lib/docs/__tests__/plan-frontmatter.test.ts`
  - `codebase/frontend/src/lib/docs/__tests__/spec-area-index.test.ts`
  - `codebase/frontend/src/lib/docs/__tests__/spec-link-integrity.test.ts`
  - `codebase/frontend/src/lib/docs/__tests__/spec-links.ts`
  - `codebase/frontend/src/lib/docs/__tests__/spec-plan-completion.test.ts`

  이 중 `plan-frontmatter.test.ts`, `spec-area-index.test.ts`, `spec-link-integrity.test.ts`, `spec-plan-completion.test.ts` 는 각각 plan lifecycle frontmatter 가드, spec area TOC 가드, spec 링크 무결성 가드, Gate C plan-completion spec-consistency 가드로, 본 spec 이 §4에서 약속하는 구현 surface 의 확장이다. 그러나 `spec-impl-evidence.md` 의 `code:` 리스트는 기존 6개 파일 그대로이며 신규 파일이 전혀 반영되지 않았다.

  동일 spec 의 `spec-code-paths.test.ts` 가드가 실행되면, `status: implemented` 스펙에 대해 `code:` 글로브 ≥1 매치를 검증하는데, 현재 `code:` 항목들은 여전히 실존 파일을 가리키므로 기술적 gate 위반은 없다. 그러나 §4에서 기술한 "4개 가드" 목록과 실제 구현이 현재 **8개 이상**의 가드로 확장됐음에도 spec 본문이 갱신되지 않아 spec 약속 vs 구현 표면 불일치가 발생한다. 이 컨벤션 자체의 SoT 역할(§Overview)을 고려하면, 자기 자신의 구현 범위가 outdated 된 상태는 CRITICAL 로 분류한다.

- **제안**:
  1. `spec/conventions/spec-impl-evidence.md` frontmatter `code:` 에 아래 경로 추가:
     ```yaml
     - codebase/frontend/src/lib/docs/__tests__/plan-frontmatter.test.ts
     - codebase/frontend/src/lib/docs/__tests__/spec-area-index.test.ts
     - codebase/frontend/src/lib/docs/__tests__/spec-link-integrity.test.ts
     - codebase/frontend/src/lib/docs/__tests__/spec-links.ts
     - codebase/frontend/src/lib/docs/__tests__/spec-plan-completion.test.ts
     ```
  2. §4 Build-time 가드 표에 신규 4개 가드 행 추가 (`plan-frontmatter.test.ts`, `spec-area-index.test.ts`, `spec-link-integrity.test.ts`, `spec-plan-completion.test.ts` 각각의 검증 내용 기재).
  3. 필요 시 §Rationale 에 Gate C 도입 근거(frontmatter `spec_impact` 의무화) 항목 추가.

---

### [WARNING] §4 Build-time 가드 표가 신규 가드 4건을 누락
- **target 위치**: `spec/conventions/spec-impl-evidence.md §4` "Build-time 가드 (4건)" 표 (라인 100–107)
- **위반 규약**: `spec/conventions/spec-impl-evidence.md §Overview` — "spec 가 약속한 surface 가 지금 구현됐는가"를 보장하는 SoT. CLAUDE.md §문서 구조 규약 — spec 문서는 실제 구현과 동기를 유지해야 한다.
- **상세**: §4 제목에서 "(4건)"이라고 명시하고 4개 행만 나열하지만, 이번 diff 로 실제 가드는 plan-frontmatter, spec-area-index, spec-link-integrity, spec-plan-completion 4개가 추가되어 총 8개 이상이 됐다. 표 제목과 내용이 구현 현실과 불일치한다. 표를 보는 독자가 가드 범위를 오해할 위험이 있다.
- **제안**: §4 제목을 `"Build-time 가드 (4건)"` → `"Build-time 가드"` (숫자 제거 또는 현행 총수 반영)로 갱신하고, 신규 4개 가드 행을 표에 추가한다. 각 행의 "검증" 컬럼에는 해당 테스트 파일이 검증하는 내용을 간결하게 기재한다.

---

### [WARNING] `spec-plan-completion.test.ts` 의 Gate C 가 spec 본문에 미기술 (Rationale 누락)
- **target 위치**: `spec/conventions/spec-impl-evidence.md §Rationale` (라인 174–215)
- **위반 규약**: CLAUDE.md §정보 저장 위치 — "결정의 배경·근거" 는 해당 spec 문서 끝의 `## Rationale` 에 기재한다. `spec/conventions/spec-impl-evidence.md §Overview` — 본 컨벤션의 가드 전략과 근거는 이 문서에 집약되어야 한다.
- **상세**: 이번 diff 로 `spec-plan-completion.test.ts` 에서 Gate C(완료된 plan 의 `spec_impact` 의무화)가 구현됐다. Gate C 는 plan 완료 시 spec 파일 경로 또는 "none" 명시를 강제하는 새로운 lifecycle invariant 다. 그러나 spec-impl-evidence.md §Rationale 에는 Gate C 도입 배경·`spec_impact` 필드 설계·cutoff 날짜 정책(2026-06-04 그랜드파더링)에 대한 근거가 전혀 없다.
- **제안**: `## Rationale` 에 `### R-8. Gate C — plan-completion spec-consistency (spec_impact 의무화)` 항목을 추가해 도입 배경, `spec_impact` 필드 의미, 그랜드파더링 cutoff 정책, `.claude/docs/plan-lifecycle.md §5` 와의 관계를 기술한다.

---

### [WARNING] `spec-area-index.test.ts` 와 `spec-link-integrity.test.ts` 가 spec 본문에 정의된 가드 범주 밖에 위치
- **target 위치**: `spec/conventions/spec-impl-evidence.md §1` 적용 대상 및 §4 가드 표
- **위반 규약**: `spec/conventions/spec-impl-evidence.md §Overview` — 본 컨벤션의 SoT 역할 정의. CLAUDE.md §단일 진실 원칙.
- **상세**: `spec-area-index.test.ts` (spec area TOC 가드) 와 `spec-link-integrity.test.ts` (spec 링크 무결성 가드) 는 기능적으로 spec 문서 구조의 정합성을 보장하는 가드다. 이 두 가드는 `spec-impl-evidence.md` 의 §4에 열거된 "spec frontmatter + code: 경로" 관련 4개 가드와는 별개의 관심사(spec TOC 완전성 + 링크 무결성)를 다룬다. 이들을 동일 `spec-impl-evidence.md` 의 `code:` 목록에만 추가하면, 독자가 "이 컨벤션이 해당 가드의 SoT인가"에 대해 혼동할 수 있다. 별도 컨벤션 문서나 적어도 §4 하위 구분으로 명확히 분리할 필요가 있다.
- **제안**: §4 에 두 가드를 별도 소섹션(`### 4.2 구조·링크 무결성 가드`)으로 분리해 "frontmatter/lifecycle 가드(§4.1)"와 구분하거나, 장기적으로는 `spec/conventions/spec-doc-structure.md` 같은 별도 컨벤션 문서로 이전을 검토한다. 당장은 최소한 §4 표에 명확한 설명 행을 추가해 혼동을 방지한다.

---

### [INFO] `spec-links.ts` 헬퍼 파일이 테스트 파일이 아님에도 `__tests__/` 에 위치
- **target 위치**: `codebase/frontend/src/lib/docs/__tests__/spec-links.ts`
- **위반 규약**: 직접적인 정식 규약 위반은 아님. 일반적인 파일 구조 컨벤션 — `__tests__/` 디렉토리는 테스트 파일을 담는 관례.
- **상세**: `spec-links.ts` 는 순수 공유 헬퍼(유틸리티 함수 모음)로, 내부에 `describe`/`it` 블록이 없다. 테스트 런너가 이를 테스트 파일로 오인해 "0 tests" 또는 "no test suite" 경고를 낼 수 있다. 단, vitest 의 기본 `include` 패턴(`**/__tests__/**/*.test.ts`)이 `.test.ts` 확장자를 요구하므로 실제 실행 대상에서 제외될 가능성이 높아 실질적 오류는 낮다.
- **제안**: `spec-links.ts` 를 `__tests__/` 외부의 별도 `lib/` 또는 동일 파일에서 `.ts` → `spec-links-utils.ts` 로 명명해 테스트 헬퍼임을 명시하거나, vitest config 에서 non-test 헬퍼를 명시적으로 제외한다. 규약 갱신은 불필요하나, 일관성 향상을 위해 고려 권장.

---

## 요약

`spec/conventions/spec-impl-evidence.md` 는 자기 자신을 SoT 로 선언하는 컨벤션 문서임에도 불구하고, 이번 diff 에서 추가된 4개 신규 Build-time 가드(plan-frontmatter, spec-area-index, spec-link-integrity, spec-plan-completion)와 공유 헬퍼 1개가 frontmatter `code:` 에 등록되지 않고, §4 가드 표에서도 누락되어 있으며, Gate C 도입 Rationale 도 부재한다. spec-impl-evidence 가 약속하는 "spec 약속 vs 구현 현황의 단일 진실" invariant 가 자기 문서 자체에서 깨진 상태로, 구현 팀이 §4 표를 신뢰해 가드 목록을 파악할 때 오류가 발생할 수 있다. CRITICAL 1건, WARNING 3건, INFO 1건.

## 위험도

**HIGH**
