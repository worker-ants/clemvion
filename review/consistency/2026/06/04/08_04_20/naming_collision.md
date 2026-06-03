# 신규 식별자 충돌 검토 — spec/conventions/spec-impl-evidence.md

검토 모드: `--impl-done`  
Target 문서: `spec/conventions/spec-impl-evidence.md`  
신규 구현 파일 (4개):
- `codebase/frontend/src/lib/docs/__tests__/plan-frontmatter.test.ts`
- `codebase/frontend/src/lib/docs/__tests__/spec-area-index.test.ts`
- `codebase/frontend/src/lib/docs/__tests__/spec-link-integrity.test.ts`
- `codebase/frontend/src/lib/docs/__tests__/spec-links.ts`
- `codebase/frontend/src/lib/docs/__tests__/spec-plan-completion.test.ts`

---

## 발견사항

### 1. 파일 경로 충돌 — 없음

새로 추가된 5개 파일은 모두 `codebase/frontend/src/lib/docs/__tests__/` 디렉토리에 위치한다. 동일 경로에 이미 존재하는 파일 목록과 대조한 결과 겹치는 이름이 없다. 기존 파일: `spec-frontmatter.test.ts`, `spec-frontmatter-parse.ts`, `spec-frontmatter-parse.test.ts`, `spec-code-paths.test.ts`, `spec-status-lifecycle.test.ts`, `spec-pending-plan-existence.test.ts`, `registry.test.ts` 등. 신규 파일명은 이 목록과 중복되지 않는다.

---

### 2. 엔티티/타입명 충돌 — 없음

`spec-links.ts` 가 export 하는 인터페이스·타입:
- `MdLink`, `SpecMdFile`, `LinkViolation`, `LinkViolationKind`

이 이름들은 `__tests__` 디렉토리 밖의 `codebase/` 어디에서도 사용되지 않는다. `spec-frontmatter-parse.ts` 가 이미 export 하는 `SpecRecord`, `SpecFrontmatter`, `SpecStatus` 와 이름이 겹치지 않는다.

---

### 3. 함수명 충돌 — 주의 필요 (INFO)

- **[INFO]** `spec-links.ts` 의 `slugify` 함수
  - target 신규 식별자: `export function slugify(heading: string): string` (`codebase/frontend/src/lib/docs/__tests__/spec-links.ts:40`)
  - 기존 사용처: `codebase/` 전체를 검색한 결과 `__tests__` 외부에서 `slugify` 라는 이름의 함수가 사용되지 않는다. 충돌 없음.
  - 상세: `__tests__` 디렉토리 내부 한정 export 이므로 프로덕션 코드와의 이름 충돌 위험 없음. 단, 향후 docs 뷰어 라이브러리가 같은 디렉토리에 `slugify` 유틸을 추가할 경우 혼동 가능성이 있으므로 명칭 인지 차원의 INFO.
  - 제안: 현재 상태에서 변경 불필요. 만약 이 함수가 향후 프로덕션 범위로 승격되면 `slugifyHeading` 또는 `githubSlugify` 로 명확화 권장.

---

### 4. plan frontmatter 키 충돌 — 없음

`spec-plan-completion.test.ts` 가 도입하는 plan frontmatter 키:
- `spec_impact` (string 또는 string[] — `none`/`없음` 또는 spec 경로 목록)

기존 plan frontmatter 에서 `spec_impact` 가 다른 의미로 쓰이는지 검색한 결과:
- `spec/conventions/spec-impl-evidence.md` 와 `.claude/docs/plan-lifecycle.md` 에서 동일 Gate C 용도로 일관되게 정의됨. 충돌 없음.

---

### 5. Gate C / Gate D 명칭 충돌 — 없음

- **Gate C**: `spec-plan-completion.test.ts` 의 describe 블록 이름 "Gate C — plan-completion spec-consistency". `spec-impl-evidence.md §4`, `plan-lifecycle.md §5`, `plan/in-progress/knowledge-base-quality-improvements.md` 모두 Gate C 를 동일 의미(plan 완료 spec_impact 강제)로 사용. 의미 일관성 확인됨.
- **Gate D**: `spec-impl-evidence.md §4.0` 에 "advisory — build 차단 아님" 으로 정의. `.claude/skills/spec-coverage/SKILL.md` 와 `.claude/agents/spec-impl-coverage-auditor.md` 에서도 동일 의미로 사용. 이번 diff 는 Gate D 코드를 도입하지 않으므로 충돌 해당 없음.

---

### 6. 상수 이름 충돌 — 없음

`plan-frontmatter.test.ts` 의 모듈-scope 상수:
- `ISO_DATE`, `WORKTREE_PLACEHOLDER`, `WORKTREE_SENTINEL`

이들은 해당 파일 내부에서만 사용되는 unexported 상수다. `codebase/` 내 다른 파일에서 동명 상수가 사용되지 않는다. `_prompts/` 아래 여러 파일이 동일 이름을 포함하지만, 이는 review 산출물(프롬프트 payload — git diff 를 인용한 것) 이므로 충돌 대상 아님.

---

### 7. API endpoint / 이벤트명 / 환경변수 충돌 — 해당 없음

이번 diff 는 신규 REST endpoint, SSE/webhook 이벤트, 환경변수를 도입하지 않는다. 검토 대상 없음.

---

### 8. spec frontmatter `id` 충돌 — 없음

Target 문서(`spec-impl-evidence.md`)의 frontmatter `id: spec-impl-evidence` 는 `spec/` 전체에서 유일하다. `id: common` 과 같이 동명 ID 가 복수 파일에 존재하는 사례가 있지만 `spec-impl-evidence` 는 그런 사례에 해당하지 않는다.

---

## 요약

이번 diff 가 도입하는 신규 식별자(파일명 5개, export 함수/타입 11개, plan frontmatter 키 1개, 상수 3개)는 기존 코드베이스에서 다른 의미로 사용 중인 식별자와 충돌하지 않는다. 모든 신규 파일은 `__tests__` 디렉토리에 격리되어 있고, 외부 참조는 의도된 import 관계(같은 디렉토리 내 가드들 사이의 `./spec-links`, `./spec-frontmatter-parse` 상대 경로)뿐이다. `slugify` 함수가 일반적인 명칭이라 향후 확장 시 명확화를 권장하나 현재 충돌은 없다.

## 위험도

NONE
