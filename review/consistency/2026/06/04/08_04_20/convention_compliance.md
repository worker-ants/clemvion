# 정식 규약 준수 검토 결과

**검토 모드**: 구현 완료 후 검토 (--impl-done)
**Target 문서**: `spec/conventions/spec-impl-evidence.md`
**관련 구현 파일**:
- `codebase/frontend/src/lib/docs/__tests__/plan-frontmatter.test.ts` (신규)
- `codebase/frontend/src/lib/docs/__tests__/spec-area-index.test.ts` (신규)
- `codebase/frontend/src/lib/docs/__tests__/spec-link-integrity.test.ts` (신규)
- `codebase/frontend/src/lib/docs/__tests__/spec-links.ts` (신규)
- `codebase/frontend/src/lib/docs/__tests__/spec-plan-completion.test.ts` (신규)

---

## 발견사항

### **[CRITICAL]** `spec-impl-evidence.md` 의 `code:` 목록이 신규 구현 파일 4건을 누락

- **target 위치**: `spec/conventions/spec-impl-evidence.md` frontmatter `code:` 섹션 (라인 4–11)
- **위반 규약**: `spec/conventions/spec-impl-evidence.md §3` — `status: implemented` 인 spec 은 `code:` 에 ≥1 매치 의무. 더 중요하게는, `spec/conventions/spec-impl-evidence.md §4` 의 가드 표 (`spec-code-paths.test.ts`) 가 `implemented` spec 의 `code:` 글로브가 실존 파일에 매치되는지 검증한다. 본 spec 자체의 `code:` 는 자기 구현 파일의 목록이므로, 새로 추가된 파일이 등록되어야 한다.
- **상세**: 현재 frontmatter `code:` 는 6개 파일만 열거한다. 이번 diff 로 4개 신규 파일이 추가됐으나 `code:` 에 등재되지 않았다:
  - `codebase/frontend/src/lib/docs/__tests__/plan-frontmatter.test.ts`
  - `codebase/frontend/src/lib/docs/__tests__/spec-area-index.test.ts`
  - `codebase/frontend/src/lib/docs/__tests__/spec-link-integrity.test.ts`
  - `codebase/frontend/src/lib/docs/__tests__/spec-links.ts`
  - `codebase/frontend/src/lib/docs/__tests__/spec-plan-completion.test.ts` (Gate C)

  (`spec-links.ts` 는 테스트 헬퍼 라이브러리이므로 `spec-link-integrity.test.ts` 와 함께 묶을 수 있으나 별도 명시가 안전하다.)
- **제안**: `spec/conventions/spec-impl-evidence.md` frontmatter `code:` 에 위 5개 파일을 추가:
  ```yaml
  code:
    - codebase/frontend/src/lib/docs/__tests__/spec-frontmatter-parse.ts
    - codebase/frontend/src/lib/docs/__tests__/spec-frontmatter-parse.test.ts
    - codebase/frontend/src/lib/docs/__tests__/spec-frontmatter.test.ts
    - codebase/frontend/src/lib/docs/__tests__/spec-code-paths.test.ts
    - codebase/frontend/src/lib/docs/__tests__/spec-status-lifecycle.test.ts
    - codebase/frontend/src/lib/docs/__tests__/spec-pending-plan-existence.test.ts
    - codebase/frontend/src/lib/docs/__tests__/plan-frontmatter.test.ts
    - codebase/frontend/src/lib/docs/__tests__/spec-area-index.test.ts
    - codebase/frontend/src/lib/docs/__tests__/spec-link-integrity.test.ts
    - codebase/frontend/src/lib/docs/__tests__/spec-links.ts
    - codebase/frontend/src/lib/docs/__tests__/spec-plan-completion.test.ts
  ```

---

### **[CRITICAL]** 신규 가드 4건이 `spec-impl-evidence.md §4` 가드 표에 등재되지 않음

- **target 위치**: `spec/conventions/spec-impl-evidence.md` §4 "Build-time 가드 (4건)" 표 (라인 98–108)
- **위반 규약**: `spec/conventions/spec-impl-evidence.md §4` — 본 컨벤션의 정합성을 강제하는 가드 테스트 목록이 §4 표의 단일 진실이다. 신규 가드가 추가되면 표를 갱신해야 한다는 점은 §4 도입부 ("본 컨벤션의 정합성은 다음 4개 단위 테스트가 강제") 에 명시된다.
- **상세**: 이번 diff 로 다음 4개의 신규 가드 테스트가 추가됐다:
  1. `plan-frontmatter.test.ts` — `plan/in-progress/*.md` 의 `worktree`/`started`/`owner` frontmatter 강제 (SoT: `.claude/docs/plan-lifecycle.md §4`)
  2. `spec-area-index.test.ts` — spec 영역 폴더의 TOC 인덱스 완전성 강제
  3. `spec-link-integrity.test.ts` — `spec/**` 인라인 markdown 링크 유효성 (DEAD/ANCHOR)
  4. `spec-plan-completion.test.ts` — Gate C: 완료 plan 의 `spec_impact` frontmatter 강제

  그러나 §4 표는 여전히 "4건" 이라고 표기하고 있으며, 이 4개 가드는 어디에도 등재되어 있지 않다. 신규 가드의 SoT 를 §4 표 밖 어딘가(예: plan-lifecycle.md)에서 선언하더라도, spec-impl-evidence.md 의 `code:` 목록 및 §4 표와는 별개의 SoT 가 생기는 invariant 깨짐이 발생한다.
- **제안**:
  1. §4 표를 갱신하여 신규 가드 4건을 추가하고, 제목을 "4건" → "N건" 또는 단순 "Build-time 가드" 로 수정.
  2. 가드 표 각 행에 검증 대상 도메인 명시 (예: `plan-frontmatter.test.ts` 는 plan frontmatter, `spec-link-integrity.test.ts` 는 spec 링크 무결성 등).
  3. `spec_impact` 필드 정의가 현재 `plan-lifecycle.md` 어디에도 없으므로, `spec-plan-completion.test.ts` 의 SoT 를 명확히 하려면 `plan-lifecycle.md §5` (또는 별도 절) 에 `spec_impact` 스키마를 추가하고 `spec-impl-evidence.md §4` 가드 표에서 참조해야 한다.

---

### **[WARNING]** `spec_impact` 필드가 어떤 공식 spec/convention 에도 정의되어 있지 않음

- **target 위치**: `codebase/frontend/src/lib/docs/__tests__/spec-plan-completion.test.ts` (Gate C), 라인 618–770
- **위반 규약**: CLAUDE.md §정보 저장 위치 — "정식 규약: `spec/conventions/<name>.md`". `.claude/docs/plan-lifecycle.md §4` 가 plan frontmatter 스키마의 SoT 다.
- **상세**: `spec-plan-completion.test.ts` 는 완료된 plan 의 `spec_impact` frontmatter 필드를 검증한다. 그러나 이 필드는 `.claude/docs/plan-lifecycle.md §4` 의 frontmatter 스키마(`worktree`, `started`, `owner`)에 포함되어 있지 않고, `spec/conventions/` 의 어느 문서에도 정의가 없다. 테스트 주석("SoT: spec/conventions/spec-impl-evidence.md + .claude/docs/plan-lifecycle.md §5")이 `plan-lifecycle.md §5` 를 언급하지만, 해당 §5 는 "이동 commit 자가 점검" 체크리스트이지 `spec_impact` 스키마가 아니다.
- **제안**: `.claude/docs/plan-lifecycle.md` 에 `spec_impact` 필드를 plan frontmatter 스키마(§4)에 추가하거나, `complete/` 이동 시 추가되는 필드로 별도 절(§4.1 또는 §5.1)에 명시한다. 이를 `spec-impl-evidence.md §4` 가드 표에서 교차 참조한다.

---

### **[WARNING]** `spec-area-index.test.ts` 의 SoT 주석이 `spec-impl-evidence.md` 를 언급하지만 해당 문서에 area-index 가드 규약이 없음

- **target 위치**: `codebase/frontend/src/lib/docs/__tests__/spec-area-index.test.ts` 라인 166 ("SoT: spec/conventions/spec-impl-evidence.md")
- **위반 규약**: `spec/conventions/spec-impl-evidence.md §4` — 가드 표가 SoT 로서 역할을 해야 하나, spec-area-index 가드의 규약(어떤 폴더가 index 의무가 있는가, 예외 목록 등)이 `spec-impl-evidence.md` 본문에 전혀 등재되어 있지 않다.
- **상세**: `spec-link-integrity.test.ts` (라인 268)와 `spec-area-index.test.ts` (라인 166) 모두 SoT 로 `spec/conventions/spec-impl-evidence.md` 를 가리키지만, 이 두 가드의 규약은 해당 문서 본문에 기술되어 있지 않다. 이는 코드가 SoT 문서를 올바르게 가리키되 문서에는 대응하는 규약 절이 빠진 불일치다.
- **제안**: `spec-impl-evidence.md §4` 또는 별도 §5 "확장 가드" 에 다음을 추가:
  - spec 영역 TOC 가드 규약 (index 문서 정의 패턴, 예외 폴더 목록 포함)
  - spec 링크 무결성 가드 규약 (범위, API catalog 제외 이유)

---

### **[INFO]** `plan-frontmatter.test.ts` 의 `(unstarted)` 센티넬이 `plan-lifecycle.md` 에 미정의

- **target 위치**: `codebase/frontend/src/lib/docs/__tests__/plan-frontmatter.test.ts` 라인 58 (`WORKTREE_SENTINEL = "(unstarted)"`)
- **위반 규약**: `.claude/docs/plan-lifecycle.md §4` frontmatter 스키마 — `worktree` 필드는 `<task_name>-<slug>` 로만 정의, 예외 센티넬 언급 없음.
- **상세**: 테스트는 `(unstarted)` 를 합법적인 `worktree` 값으로 허용하지만, `plan-lifecycle.md §4` 의 공식 스키마에 이 센티넬이 정의되어 있지 않다. 사용자/플래너가 이 센티넬의 존재를 모르면 구형 placeholder (TBD 등)를 대신 사용해 가드를 위반하게 된다.
- **제안**: `plan-lifecycle.md §4` frontmatter 스키마에 아래를 추가:
  ```markdown
  worktree: (unstarted)   # worktree 아직 없는 plan 의 명시 sentinel. TBD/미정 등 legacy placeholder 금지.
  ```

---

## 요약

`spec/conventions/spec-impl-evidence.md` 는 문서 구조(Overview/본문/Rationale 3섹션), 명명 규약(`id`/`status`/`code:` 키 kebab-case), 금지 패턴 준수 면에서 규약을 올바르게 따른다. 그러나 이번 구현 diff 에서 신규로 추가된 5개 테스트 파일이 spec frontmatter `code:` 목록에서 빠져 있고, 신규 가드 4건이 §4 가드 표에 등재되지 않아 spec 자체의 `implemented` invariant 가 깨진 상태다. 또한 Gate C 의 `spec_impact` 필드와 `(unstarted)` 센티넬이 공식 규약 문서에 정의되지 않아 단일 진실 원칙이 훼손된다. spec 문서를 구현 변경과 함께 갱신하는 것이 필수다.

## 위험도

**HIGH**

---

STATUS=success ISSUES=6 PATH=/Volumes/project/private/clemvion/.claude/worktrees/kb-quality-fba2f2/review/consistency/2026/06/04/08_04_20/convention_compliance.md RESET_HINT=
