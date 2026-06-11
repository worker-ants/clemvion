# 신규 식별자 충돌 검토 결과

**대상 문서**: `spec/4-nodes/5-data/2-code.md`
**검토 일시**: 2026-06-11
**검토 모드**: spec draft (--spec)

---

## 발견사항

### 1. [CRITICAL] 공개 에러 코드 명칭이 사용자 문서와 정면 충돌

- **target 신규 식별자**: `CODE_TIMEOUT`, `CODE_EXECUTION_FAILED`, `CODE_MEMORY_LIMIT` (§5.3 정규화된 `output.error.code`). `EXECUTION_TIMEOUT` 과 `CODE_RUNTIME_ERROR` 는 `output.error.details.legacyCode` 로 격하.
- **기존 사용처**:
  - `/Volumes/project/private/clemvion/.claude/worktrees/code-node-isolated-vm/codebase/frontend/src/content/docs/02-nodes/data.mdx` L124–125 — `EXECUTION_TIMEOUT`, `CODE_RUNTIME_ERROR` 를 **사용자 공개 에러 코드**로 FieldTable 에 노출.
  - `/Volumes/project/private/clemvion/.claude/worktrees/code-node-isolated-vm/codebase/frontend/src/content/docs/02-nodes/data.en.mdx` L113–114 — 동일 코드 영문 문서.
- **상세**: 사용자 문서는 워크플로우 작성자가 `error` 포트에서 분기 조건으로 사용할 코드명을 안내한다. 현재 user-docs 는 `EXECUTION_TIMEOUT` / `CODE_RUNTIME_ERROR` 를 조건 분기용 공개 코드로 기술하고 있지만, target spec 은 이 두 코드를 `output.error.details.legacyCode` (내부용) 로 격하하고 `CODE_TIMEOUT` / `CODE_EXECUTION_FAILED` 를 정식 공개 코드로 지정한다. 워크플로우 작성자가 user-docs 를 참조해 `EXECUTION_TIMEOUT` 으로 분기 로직을 작성하면, 엔진이 실제 출력하는 `output.error.code` 는 `CODE_TIMEOUT` 이라 분기가 동작하지 않는다.
  - 추가로 user-docs 에만 존재하는 `CODE_SYNTAX_ERROR` (L126 / L115) 는 target spec 과 `error-codes.ts` 어디에도 정의되지 않은 허상 코드다. spec §6 은 컴파일 실패를 pre-flight throw 로 처리하므로 `error` 포트에 `CODE_SYNTAX_ERROR` 가 내려가지 않는다.
- **제안**:
  1. `data.mdx` / `data.en.mdx` 의 에러 코드 표를 target spec §5.3 과 일치하도록 교체 — `CODE_TIMEOUT`, `CODE_EXECUTION_FAILED`, `CODE_MEMORY_LIMIT` 세 코드로 갱신.
  2. `CODE_SYNTAX_ERROR` 행 제거. 대신 컴파일 실패는 "pre-flight 검증 오류(캔버스 배지)" 로 설명 추가 권장.
  3. 기존 user-docs 의 `EXECUTION_TIMEOUT` / `CODE_RUNTIME_ERROR` 를 교체할 경우 `error-codes.md §3 historical-artifact 레지스트리`에 `EXECUTION_TIMEOUT → CODE_TIMEOUT`, `CODE_RUNTIME_ERROR → CODE_EXECUTION_FAILED` 매핑을 레거시 항목으로 등록해 명명 안정성 근거를 남겨 둘 것.

---

### 2. [WARNING] user-docs 가 `setTimeout` 을 허용 전역으로 기재 — target spec 은 부트스트랩 삭제 목록에 포함

- **target 신규 식별자**: §7.3 차단 API 표 — `setTimeout`, `setInterval`, `setImmediate` 를 "부트스트랩 삭제(`delete`)" 로 명시.
- **기존 사용처**:
  - `data.mdx` L114: `"Array, Object, String, Number, Boolean, Date, RegExp, Map, Set, Math, JSON, Promise, setTimeout(최대 5초) 등이에요."` — `setTimeout` 을 허용 전역으로 안내.
  - `data.en.mdx` L103: `"setTimeout (max 5s)"` 동일.
- **상세**: 사용자 문서는 `setTimeout` 이 "최대 5초" 제한으로 허용된다고 안내하지만, target spec §7.3 은 `setTimeout` 을 부트스트랩 스크립트로 `globalThis` 에서 **삭제**하는 차단 항목으로 분류한다. 구현(`code.handler.ts`)이 이미 isolated-vm 으로 전환된 상태이므로 사용자가 `setTimeout` 을 사용하면 `ReferenceError` 가 발생하는데 user-docs 는 허용된다고 안내해 혼선을 일으킨다.
- **제안**: `data.mdx` / `data.en.mdx` 의 "허용 전역" 항목에서 `setTimeout` 을 제거하고, `Promise` / `async/await` 로 비동기 처리를 하라는 안내로 대체.

---

### 3. [INFO] `error-codes.md §3 historical-artifact 레지스트리` 에 legacy 코드 매핑 미등록

- **target 신규 식별자**: `output.error.details.legacyCode` — `EXECUTION_TIMEOUT`, `CODE_RUNTIME_ERROR`, `EXECUTION_MEMORY_EXCEEDED` 를 `legacyCode` 로 내부 보존.
- **기존 사용처**: `/Volumes/project/private/clemvion/.claude/worktrees/code-node-isolated-vm/spec/conventions/error-codes.md` §3 (historical-artifact 예외 레지스트리) — 현재 세 legacy 코드에 대한 항목 없음.
- **상세**: `error-codes.md §2` 안정성 정책은 "rename = breaking change" 임을 명시하고, §3 은 부정확한 기존 코드를 명시적으로 등록하도록 요구한다. target spec 이 `EXECUTION_TIMEOUT` 을 `legacyCode` 로 격하하면서 사실상 rename/mapping 이 발생했는데, 이 결정이 `error-codes.md §3` 에 등록되지 않아 명명 안정성 SoT 가 불완전해진다.
- **제안**: `error-codes.md §3` 에 다음 항목 추가:
  - `EXECUTION_TIMEOUT` → 격하: `output.error.code` 에서 제거, `output.error.details.legacyCode` 내부 보존. 정규화 코드 `CODE_TIMEOUT`.
  - `CODE_RUNTIME_ERROR` → 동일 격하. 정규화 코드 `CODE_EXECUTION_FAILED`.
  - `EXECUTION_MEMORY_EXCEEDED` → 동일 격하. 정규화 코드 `CODE_MEMORY_LIMIT`.

---

### 4. [INFO] spec frontmatter `id: code` — 중복 없음, 파일 경로 충돌 없음

- **target 신규 식별자**: frontmatter `id: code`, 파일 경로 `spec/4-nodes/5-data/2-code.md`.
- **기존 사용처**: `grep "^id: code" spec/**` 결과 해당 파일 외 동일 `id` 없음. 파일 경로는 `spec/4-nodes/5-data/` 디렉터리에 기존 `1-transform.md`, `0-common.md` 가 있고 `2-code.md` 는 새 파일 — 명명 컨벤션(`N-name.md`) 준수, 기존 파일과 겹치지 않음.
- **상세**: 충돌 없음.
- **제안**: 해당 없음.

---

## 요약

target spec `spec/4-nodes/5-data/2-code.md` 가 도입하는 에러 코드 식별자 체계(`CODE_TIMEOUT` / `CODE_EXECUTION_FAILED` / `CODE_MEMORY_LIMIT` 정규화, `EXECUTION_TIMEOUT` / `CODE_RUNTIME_ERROR` → `legacyCode` 격하)는 현재 사용자 문서(`data.mdx`, `data.en.mdx`)가 공개 코드로 안내하고 있는 `EXECUTION_TIMEOUT` / `CODE_RUNTIME_ERROR` 와 직접 충돌한다. 워크플로우 작성자가 `error` 포트 분기를 사용자 문서 기준으로 작성하면 조건이 일치하지 않는 런타임 오작동이 발생한다. 추가로 user-docs 에만 존재하는 `CODE_SYNTAX_ERROR` 는 spec·구현 어디에도 정의되지 않은 허상 코드다. `setTimeout` 이 user-docs 에서 "허용 전역"으로 기재되어 있으나 spec §7.3 은 이를 차단 목록으로 분류해 혼선을 야기한다. 파일 경로·spec frontmatter ID 충돌은 없다. 결론적으로 user-docs 갱신과 `error-codes.md §3` 레지스트리 보완이 spec 적용과 동시에 수행되어야 한다.

## 위험도

**HIGH**
