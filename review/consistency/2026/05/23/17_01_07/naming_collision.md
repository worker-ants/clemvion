# 신규 식별자 충돌 검토 — spec-harness-impl-coverage

검토 대상: `plan/in-progress/spec-harness-impl-coverage.md`
검토 일시: 2026-05-23

---

## 발견사항

### [WARNING] frontmatter 키 `code:` — user-guide MDX 와 의미가 다름
- **target 신규 식별자**: `spec/**/*.md` frontmatter 의 `code:` 키 (결정 A) — spec 파일이 구현 경로(glob)를 가리키는 "spec → codebase" 방향
- **기존 사용처**: `codebase/frontend/src/content/docs/**/*.mdx` 의 frontmatter `code:` 키 (`/Volumes/project/private/clemvion/codebase/frontend/src/content/docs/_i18n-conventions.md` 28-29행, `spec/2-navigation/13-user-guide.md` §4 표 71행) — user-guide MDX 파일이 검증에 사용할 소스 경로를 가리키는 "user-guide → codebase" 방향
- **상세**: 키 이름 `code:` 는 동일하나, 문서 종류(spec `.md` vs user-guide `.mdx`)가 달라 실제 혼동 위험은 낮다. 그러나 build-time 가드(`spec-code-paths.test.ts`, `registry.test.ts` 내 "real docs frontmatter spec/code paths" 검증)가 각각 `spec/` 파일과 `content/docs/` 파일을 대상으로 동일 키를 파싱하게 되면, 파서가 문서 경로를 기준으로 명확히 구분하도록 테스트 설계를 보장해야 한다. 현재 `nodes-coverage.test.ts` (`/Volumes/project/private/clemvion/codebase/frontend/src/lib/docs/__tests__/nodes-coverage.test.ts`)는 `02-nodes/<cat>.mdx` 의 frontmatter `code:` 만 읽으므로 직접 충돌은 없다. 그러나 `spec-code-paths.test.ts` 가 신설되면 두 종류의 `code:` 가 repo 안에 공존하므로 향후 유지보수 시 혼동 가능성이 있다.
- **제안**: 결정 A 의 `spec/conventions/spec-impl-evidence.md` 에 "spec frontmatter 의 `code:` 는 user-guide MDX frontmatter 의 동명 키와 대상 문서 종류(`.md` vs `.mdx`)로 구별된다" 는 주석을 추가해 명시적으로 분리 의도를 문서화한다.

---

### [WARNING] frontmatter 키 `status:` — cafe24-api-catalog 와 맥락은 달라도 같은 키 이름
- **target 신규 식별자**: `spec/**/*.md` frontmatter 의 `status:` 키 — 값: `backlog | spec-only | partial | implemented | archived` (결정 A)
- **기존 사용처**: `spec/conventions/cafe24-api-catalog/_overview.md` §3 (`/Volumes/project/private/clemvion/spec/conventions/cafe24-api-catalog/_overview.md` 53-59행) — Cafe24 API Catalog 표의 `status` 컬럼, 값: `supported | planned | deprecated`. 또한 spec 본문 여러 곳 (`spec/2-navigation/4-integration.md`, `spec/3-workflow-editor/4-ai-assistant.md` 등)에서 런타임 리소스의 `status` 필드(예: `status: 'running' | 'completed' | 'failed'`)를 기술하는 맥락에서 동일 키워드가 사용됨
- **상세**: frontmatter `status:` (YAML 메타데이터)와 Cafe24 카탈로그 표의 `status` 컬럼(markdown 표 셀 값), 런타임 `status` 는 사용 계층이 모두 달라 실제 파서 충돌은 없다. 다만 target 이 도입하는 spec frontmatter `status:` 의 5값 enum 이 Cafe24 카탈로그의 3값 enum(`supported/planned/deprecated`) 및 기존 런타임 status 값들과 비슷한 이름 공간에 있어 "spec 파일 상태" 와 "API 엔드포인트 지원 상태" 혼동 가능성이 있다. 특히 `planned` (Cafe24 카탈로그) vs `backlog`/`spec-only` (spec frontmatter) 의 의미가 부분 유사하므로 혼동 우려가 있다.
- **제안**: `spec/conventions/spec-impl-evidence.md` §Rationale 에 "spec frontmatter `status:` 값 5개는 Cafe24 API Catalog 의 `status` 컬럼(`supported/planned/deprecated`)과 의미 도메인이 다르다. 전자는 spec 문서의 구현 성숙도, 후자는 특정 API 엔드포인트의 지원 여부" 임을 명시한다. 혼동을 최소화하기 위해 파서(build-time 가드)가 `spec/conventions/cafe24-api-catalog/` 하위 파일을 대상 spec 에서 제외하는 것을 확인한다.

---

### [INFO] `status: archived` vs cafe24 카탈로그 `deprecated` — 이미 target 내부에서 인지됨
- **target 신규 식별자**: `status: archived` (결정 A의 5번째 enum 값)
- **기존 사용처**: `spec/conventions/cafe24-api-catalog/_overview.md` §3 의 `deprecated` (`/Volumes/project/private/clemvion/spec/conventions/cafe24-api-catalog/_overview.md` 59행) — Cafe24 endpoint 폐기 상태. plan 본문(결정 A 항목 §status enum §archived 항목)에서 이미 "명명 근거: cafe24 `deprecated` 와 의미 도메인이 달라 혼동 방지 (naming_collision W-6 반영)" 라고 자기 인지 주석을 달았음
- **상세**: target 이 자체적으로 충돌을 인지하고 `deprecated` 대신 `archived` 를 선택한 이유를 기재했다. 실제 충돌이 아닌 기기록된 설계 결정이다. 단, `spec/conventions/spec-impl-evidence.md` 신설 후 해당 Rationale 절에 반드시 이 근거가 옮겨져야 한다(target §의식적 결정 포인트 rationale_continuity I-3/I-4/I-5/I-6 반영 조건).
- **제안**: 별도 조치 불필요. 신설 spec 의 `## Rationale` 에 이전이 완료됐는지 구현 단계에서 확인하면 충분하다.

---

### [INFO] `id:` frontmatter 키 — 기존 YAML 코드 블록의 `id:` 와 레이어 구분 필요
- **target 신규 식별자**: `spec/**/*.md` frontmatter 의 `id:` 키 (값: kebab-case 파일 basename, 결정 A)
- **기존 사용처**: spec 본문 YAML/코드 블록 안의 `id:` 필드 — 예: `spec/5-system/14-external-interaction-api.md` 316행(`id: 1`), `spec/conventions/cafe24-api-metadata.md` 43행(`id: string`), `spec/3-workflow-editor/4-ai-assistant.md` 288행(`id: string`) 등. 모두 **문서 본문 안의 코드 예시 또는 타입 정의**이며 YAML frontmatter 가 아님
- **상세**: frontmatter `id:` (문서 파일 상단 `---` 블록)는 본문 코드 블록 안의 `id:` 와 파서가 명확히 구분한다. 실제 충돌 없음. 다만 `spec-frontmatter.test.ts` 가 frontmatter `id:` 를 추출할 때 코드 블록 내부를 오파싱하지 않도록 YAML 파서(예: `js-yaml`)를 프론트매터 전용으로 사용해야 한다 — 이미 MDX/MD 생태계의 표준 접근이므로 실질적 위험 없음.
- **제안**: `spec-frontmatter.test.ts` 구현 시 전용 frontmatter 파서 사용 확인으로 충분.

---

### [INFO] `spec-coverage` 슬래시 커맨드 — `.claude/skills/` 하위 신규 디렉토리 `spec-coverage/`
- **target 신규 식별자**: `.claude/skills/spec-coverage/SKILL.md` 디렉토리+파일 (결정 C-2)
- **기존 사용처**: `/Volumes/project/private/clemvion/.claude/skills/` 하위에 `consistency-checker/`, `developer/`, `code-review-agents/`, `project-planner/`, `merge-coordinator/` 등 5개 공식 skill 디렉토리 존재. 현재 `spec-coverage` 이름의 디렉토리는 없음
- **상세**: 충돌 없음. 단, CLAUDE.md §Skill 체계 표에 현재 5개 skill 만 공식 등록되어 있으며 `spec-coverage` 는 별도 row 추가 없이 "consistency 와 동일 권한 도메인" 으로 처리할 계획(결정 E-6). 별 row 없이 tool 이 추가되면 Skill 표의 완결성이 낮아질 수 있다.
- **제안**: 선택적 — 추후 `spec-coverage` SKILL.md 신설 시 CLAUDE.md §Skill 체계 표에 INFO-level 행으로라도 추가해 검색성 확보를 권장한다. 현재 결정대로 생략해도 충돌은 없다.

---

### [INFO] `spec-impl-coverage-auditor` 에이전트 파일명 — 기존 패턴과 일치
- **target 신규 식별자**: `.claude/agents/spec-impl-coverage-auditor.md` (결정 C-2)
- **기존 사용처**: `/Volumes/project/private/clemvion/.claude/agents/` 하위에 `naming-collision-checker.md`, `requirement-reviewer.md`, `user-guide-writer.md` 등 20여 개 파일 존재. `spec-impl-coverage-auditor.md` 와 동일한 이름은 없음
- **상세**: 충돌 없음. 기존 에이전트 파일들과 kebab-case 네이밍 패턴 일치.
- **제안**: 조치 불필요.

---

### [INFO] `plan-stale-audit.sh` 스크립트 파일명 — 기존 tools 와 충돌 없음
- **target 신규 식별자**: `.claude/tools/plan-stale-audit.sh` (결정 C-1)
- **기존 사용처**: `/Volumes/project/private/clemvion/.claude/tools/` 하위에 `ensure-worktree.sh`, `cleanup-worktree.sh`, `run-test.sh` 3개만 존재. `plan-stale-audit.sh` 는 없음
- **상세**: 충돌 없음. 명명 패턴(`<kebab>.sh`) 일치.
- **제안**: 조치 불필요.

---

### [INFO] `review/consistency/coverage/` 출력 경로 — 기존 경로와 중첩 가능
- **target 신규 식별자**: `/spec-coverage` 산출물 위치 `review/consistency/coverage/<YYYY>/<MM>/<DD>/<hh>_<mm>_<ss>/SUMMARY.md` (결정 C-2)
- **기존 사용처**: `review/consistency/` 하위에 `2026/05/23/` 형식의 날짜 디렉토리가 이미 존재 (`/Volumes/project/private/clemvion/review/consistency/2026/05/23/` 등). 기존 날짜 디렉토리는 ISO timestamp 직접 하위에 checker 결과 파일을 두는 구조이고, 신규 경로는 중간에 `coverage/` 디렉토리를 삽입하는 구조
- **상세**: 기존 `review/consistency/2026/05/23/<hh>_<mm>_<ss>/` 와 신규 `review/consistency/coverage/2026/05/23/<hh>_<mm>_<ss>/` 는 `coverage/` 세그먼트로 구분되어 파일 충돌은 없다. 그러나 `review/consistency/` 하위의 첫 번째 세그먼트가 기존에는 연도(`2026/`)이고 신규는 `coverage/` 로 달라진다 — 패턴 일관성이 낮아지는 것은 target 의 cross_spec W-1 반영으로 이미 설명됨.
- **제안**: 조치 불필요 (cross_spec W-1 에서 이미 검토 완료).

---

### [INFO] `ImplAnchor` 컴포넌트 파일 경로 — 기존 docs 컴포넌트 경로 패턴 확인 필요
- **target 신규 식별자**: `codebase/frontend/src/components/docs/impl-anchor.tsx` (결정 B)
- **기존 사용처**: `spec/2-navigation/13-user-guide.md` §8 표에 기존 공용 MDX 컴포넌트 목록 `<Steps>`, `<FieldTable>`, `<Callout>`, `<Example>` 이 있으나 이들의 실제 파일 경로 패턴은 본 검토에서 직접 확인하지 않았음. `codebase/frontend/src/components/docs/` 디렉토리가 규약에 맞는지 확인이 필요하다
- **상세**: target 이 `codebase/frontend/src/components/docs/impl-anchor.tsx` 를 지정했지만, 기존 MDX 컴포넌트(`<Steps>` 등)가 실제로 어느 경로에 있는지 확인하지 않았다. 경로 패턴이 일치하지 않으면 `spec/2-navigation/13-user-guide.md §8 공용 MDX 컴포넌트` 카탈로그에 추가할 때 일관성이 깨질 수 있다.
- **제안**: 구현 단계에서 기존 공용 MDX 컴포넌트 파일들의 실제 경로를 확인하고, `impl-anchor.tsx` 가 동일 디렉토리 패턴을 따르는지 검증한다.

---

## 요약

target 이 도입하는 신규 식별자 중 기존과 **동일 이름·동일 의미로 충돌하는 CRITICAL 케이스는 없다**. 주된 위험은 WARNING 2건으로, 모두 `spec/**/*.md` frontmatter 의 `code:` 및 `status:` 키가 user-guide MDX frontmatter 의 동명 키 및 Cafe24 API Catalog 의 `status` 컬럼과 같은 이름을 쓰면서 의미·대상이 다른 데서 오는 잠재적 혼동이다. 실제 파서 충돌은 없으나, 두 용례의 의미 차이를 `spec/conventions/spec-impl-evidence.md` §Rationale 에 명시적으로 기재하면 미래 유지보수 시 혼동을 방지할 수 있다. 나머지 항목들(신규 파일·경로·에이전트·스크립트)은 기존 식별자와 충돌 없이 기존 명명 컨벤션을 준수한다.

---

## 위험도

LOW
