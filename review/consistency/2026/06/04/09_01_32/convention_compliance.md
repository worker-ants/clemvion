# 정식 규약 준수 검토 결과

**Target**: `spec/conventions/spec-impl-evidence.md`
**Mode**: `--impl-done` (구현 완료 후 검토, diff-base=origin/main)
**검토 일시**: 2026-06-04

---

## 발견사항

### 발견사항 1
- **[CRITICAL]** `spec-impl-evidence.md` frontmatter `code:` 가 신규 구현 파일 5개를 누락
  - **target 위치**: `/spec/conventions/spec-impl-evidence.md` frontmatter `code:` 목록 (L4–L11)
  - **위반 규약**: `spec/conventions/spec-impl-evidence.md §2.1` — `status: implemented` 인 spec 의 `code:` 는 해당 spec 이 약속한 surface 의 구현 파일을 열거해야 한다. `spec-code-paths.test.ts` 가드는 `status ∈ {partial, implemented}` 시 `code:` 글로브가 ≥1 파일 매치할 것을 요구한다 (§4 표).
  - **상세**: 이번 diff 로 추가된 파일 5개가 `spec-impl-evidence.md` 의 SoT 로 동작함을 자신의 내부 주석으로 명시하고 있음(`// SoT: spec/conventions/spec-impl-evidence.md`). 그러나 spec 의 `code:` 목록은 이전 6개 파일 그대로이고 신규 5개가 없음:
    - `codebase/frontend/src/lib/docs/__tests__/plan-frontmatter.test.ts`
    - `codebase/frontend/src/lib/docs/__tests__/spec-area-index.test.ts`
    - `codebase/frontend/src/lib/docs/__tests__/spec-link-integrity.test.ts`
    - `codebase/frontend/src/lib/docs/__tests__/spec-links.ts`
    - `codebase/frontend/src/lib/docs/__tests__/spec-plan-completion.test.ts`
  - **제안**: `spec-impl-evidence.md` frontmatter `code:` 에 위 5개 경로 추가.

### 발견사항 2
- **[CRITICAL]** `spec-impl-evidence.md §4` 의 "Build-time 가드 (4건)" 표가 실제 구현된 가드 수와 불일치
  - **target 위치**: `spec/conventions/spec-impl-evidence.md` L98–L112, 헤더 `## 4. Build-time 가드 (4건)` 및 표
  - **위반 규약**: `spec/conventions/spec-impl-evidence.md §4` 자체 — 가드 표가 해당 spec 의 권위 있는 inventory 이므로 구현 추가 시 갱신해야 함. `spec-impl-evidence.md` 는 "단일 진실" 이라고 자체 선언 (L17).
  - **상세**: 신규 diff 로 적어도 3개 이상의 별개 가드가 추가됨:
    - `plan-frontmatter.test.ts` — plan/in-progress 파일의 frontmatter(worktree/started/owner) 강제
    - `spec-area-index.test.ts` — spec area 폴더의 TOC index 존재 + 모든 sibling 링크 강제
    - `spec-link-integrity.test.ts` — spec 내 broken in-repo 링크/anchor 강제
    - `spec-plan-completion.test.ts` — completed plan 의 `spec_impact` 선언 강제 (Gate C)
    
    현재 §4 표는 4개만 열거하며 `## 4. Build-time 가드 (4건)` 헤더가 그대로임. 신규 가드가 보안 surface 를 확장하나 spec 에 등재되지 않아 "어떤 가드가 있는가" 를 이 spec 에서 조회하면 불완전한 정보를 얻게 됨.
  - **제안**: §4 헤더를 `## 4. Build-time 가드` 로 갱신하고 4개 가드 표에 신규 3~4개 행 추가. `spec-links.ts` 는 helper 라이브러리이므로 가드 표 행이 아닌 `code:` 만 추가하면 됨.

### 발견사항 3
- **[WARNING]** `spec-plan-completion.test.ts` 의 SoT 인용이 `.claude/docs/plan-lifecycle.md §5` 를 잘못 가리킴
  - **target 위치**: `codebase/frontend/src/lib/docs/__tests__/spec-plan-completion.test.ts` L614–L617 (Gate C 주석 마지막 줄): `// spec/conventions/spec-impl-evidence.md + .claude/docs/plan-lifecycle.md §5.`
  - **위반 규약**: `spec/conventions/spec-impl-evidence.md` 는 spec 규약의 단일 진실 선언. `plan-lifecycle.md §5` 는 "이동 commit 자가 점검" 체크리스트이며, `spec_impact` frontmatter 필드나 Gate C 에 대한 정의가 없음 (실제로 `plan-lifecycle.md` 전체에 `spec_impact` 문자열 0건). SoT 인용이 실존하지 않는 §5 내용을 가리킴.
  - **상세**: `plan-lifecycle.md §5` = "이동 commit 자가 점검" (5개 체크리스트). `spec_impact` 필드 정의나 Gate C 컷오프 정책은 해당 절에 없음. 테스트가 정의한 `spec_impact` + `GATE_C_CUTOFF` 정책이 어느 spec 에도 문서화되지 않은 상태.
  - **제안**: 두 가지 중 선택. (a) `plan-lifecycle.md §5` 에 Gate C + `spec_impact` 필드 정의를 추가하고 `spec-impl-evidence.md §4` 표에도 이 가드를 등재 — 이 경우 `plan-lifecycle.md §5` SoT 인용이 유효해짐. (b) 또는 `spec-impl-evidence.md §4` 에 Gate C 내용을 추가하고 SoT 인용을 `spec-impl-evidence.md` 단독으로 수정. 어느 쪽이든 `spec_impact` frontmatter 스키마를 정식 spec 문서에 기재해야 함.

### 발견사항 4
- **[INFO]** `spec-area-index.test.ts` 주석이 `spec/conventions/spec-impl-evidence.md` 를 SoT 로 명시하나, 해당 컨벤션 문서는 "spec area 가 TOC index 를 보유해야 한다" 는 규약을 포함하지 않음
  - **target 위치**: `codebase/frontend/src/lib/docs/__tests__/spec-area-index.test.ts` L167: `// SoT: spec/conventions/spec-impl-evidence.md.`
  - **위반 규약**: `spec/conventions/spec-impl-evidence.md` 전체 — area-index 강제 규칙은 `spec-impl-evidence.md` 에 없음.
  - **상세**: `spec-impl-evidence.md` 는 spec 파일의 frontmatter lifecycle, `code:` 경로 검증, `status` 라이프사이클에 집중하는 컨벤션임. "spec area 내 `0-*.md`/`_*overview.md`/`README.md` 인덱스 존재 + 모든 sibling 링크" 규약은 해당 spec 어디에도 기술되지 않음. SoT 인용이 틀리거나 컨벤션에 해당 규약을 추가해야 함.
  - **제안**: `spec-impl-evidence.md` 에 spec area index 규약 절을 추가하거나, 별도 컨벤션 파일(예: `spec/conventions/spec-structure.md`)을 생성하고 그쪽을 SoT 로 수정.

### 발견사항 5
- **[INFO]** `plan-frontmatter.test.ts` 가 `plan-lifecycle.md §4` 의 frontmatter 스키마를 테스트하나, `spec-impl-evidence.md` 의 `code:` 목록과 §4 가드 표에 등재되지 않아 이 가드의 존재 자체가 spec 에서 발견 불가
  - **target 위치**: `codebase/frontend/src/lib/docs/__tests__/plan-frontmatter.test.ts` L44: `// SoT: .claude/docs/plan-lifecycle.md §4.`
  - **위반 규약**: `spec/conventions/spec-impl-evidence.md §4` 표 — build-time 가드는 §4 표에 등재되어야 함. 이 표가 "어디를 보면 가드 전체 목록을 알 수 있는가" 의 단일 진실 역할임.
  - **상세**: 이 파일의 SoT 는 `plan-lifecycle.md §4` 로 올바르게 가리킴. 그러나 `spec-impl-evidence.md §4` 에 미등재이므로 "spec-impl-evidence.md 를 보면 모든 가드를 알 수 있다" 는 invariant 가 깨짐.
  - **제안**: 발견사항 2 수정(§4 표 갱신) 시 함께 해소됨. 별도 추가 조치 불요.

---

## 요약

`spec/conventions/spec-impl-evidence.md` 는 본인 스스로를 "spec-impl 증거 + 가드의 단일 진실" 로 선언하나, 이번 diff 로 추가된 5개 구현 파일(plan-frontmatter, spec-area-index, spec-link-integrity, spec-links, spec-plan-completion 테스트)이 frontmatter `code:` 와 §4 가드 표에 누락되어 있어 spec 의 invariant 가 실제 구현과 어긋난다. 특히 `spec-plan-completion.test.ts` 의 Gate C + `spec_impact` 정책은 어떤 spec 문서에도 기술되지 않아 구현이 정식 규약보다 앞서 존재하는 상태가 되었다. `spec-area-index.test.ts` 의 SoT 인용도 해당 컨벤션 문서에 근거가 없는 잘못된 인용이다. CRITICAL 2건은 `spec-impl-evidence.md` 의 `code:` 와 §4 표를 갱신하면 해소되며, WARNING 1건은 `plan-lifecycle.md §5` 또는 `spec-impl-evidence.md` 에 Gate C 정책을 문서화하여 해소해야 한다.

---

## 위험도

**HIGH**

> CRITICAL 2건 — `status: implemented` spec 의 `code:` 누락은 `spec-code-paths.test.ts` 가드가 통과하는 이유이기도 하나(기존 6개 glob 이 매칭되므로 gate 는 통과), spec 이 약속한 "모든 구현 파일 열거" 의 invariant 가 깨진 상태임. 또한 §4 표의 미갱신으로 인해 이 spec 을 참조하는 하위 시스템·팀원이 실제 가드 수를 과소평가할 수 있음.
