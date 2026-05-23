# 신규 식별자 충돌 검토 결과

대상: `plan/in-progress/spec-harness-impl-coverage.md`

---

## 발견사항

### 1. [WARNING] spec frontmatter `status` 값 `deprecated` — cafe24-api-catalog status enum 과 동명이의

- **target 신규 식별자**: `status: deprecated` (결정 A — `spec/conventions/spec-impl-evidence.md` 정의 예정)
- **기존 사용처**: `spec/conventions/cafe24-api-catalog/_overview.md` §3 status enum — `supported` / `planned` / `deprecated`. 여기서 `deprecated` 는 "Cafe24 가 제거 또는 deprecate 한 API endpoint" 를 의미하며, `codebase/backend/src/nodes/integration/cafe24/metadata/catalog-sync.spec.ts` 가 이 값을 기준으로 동기 검증을 수행한다.
- **상세**: 두 `status` enum 은 각각 다른 대상(spec 파일의 구현 상태 vs Cafe24 API endpoint 의 지원 상태)에 적용되므로 같은 파일 안에서 의미 충돌은 발생하지 않는다. 그러나 이름이 동일하여 cross-reference 또는 도구/스크립트가 두 enum 을 혼동할 가능성이 있다. 특히 `spec-status-lifecycle.test.ts` 가 `deprecated` 를 처리할 때 catalog-sync.spec.ts 의 로직을 참조하면 혼용될 수 있다. `deprecated` 의 의미가 "spec 폐기(90일 후 파일 삭제 권장)" vs "Cafe24 endpoint 제거" 는 명확히 다르다.
- **제안**: `spec-impl-evidence.md` 내 spec frontmatter status enum 의 `deprecated` 값 정의에 "cafe24-api-catalog 의 `deprecated` 와 무관 — 이 값은 spec 파일 자체의 폐기 상태를 의미한다" 를 명시적으로 주석화. 또는 `archived` 로 개명하여 의미 차별화.

---

### 2. [WARNING] plan frontmatter `status: spec-only` — plan-lifecycle.md 미정의 값

- **target 신규 식별자**: 결정 A 의 spec frontmatter `status: spec-only` 값. 그런데 target plan 파일 자체(`plan/in-progress/spec-harness-impl-coverage.md`) 의 frontmatter 에도 `status: spec-only` 가 이미 사용됨.
- **기존 사용처**: `.claude/docs/plan-lifecycle.md` §4 Frontmatter 스키마 — 정의된 plan 상태 값은 `in-progress` / `complete` / `backlog` / `spec-only` 는 명시 없음. 기존 plan 파일 조사 결과: `status: in-progress`, `status: complete`, `status: completed`, `status: backlog` 가 사용 중이나 `status: spec-only` 는 target plan 파일에서만 나타남(`plan/in-progress/spec-harness-impl-coverage.md:4`).
- **상세**: `spec-only` 는 결정 A 에서 **spec 파일 frontmatter** 에 쓰이는 구현 상태 enum 값으로 도입되는 동시에, **plan 파일 frontmatter** 의 `status` 에도 이미 쓰이고 있다. 두 컨텍스트에서 의미가 다르다: spec 파일에서는 "구현 plan 없는 spec" 의미, plan 파일에서는 비공식적으로 "spec 초안만 있는 plan" 을 가리키는 것으로 보인다. plan-lifecycle.md 에 정의되지 않은 값이 plan 파일 frontmatter 에 사용된 것은 별도 규약 위반이며(convention_compliance.md 에서 이미 CRITICAL 로 지적됨), naming collision 관점에서도 동일 키(`status`)에 동일 값(`spec-only`)이 서로 다른 스키마 도메인(spec 파일 vs plan 파일)에서 쓰이므로 혼동을 유발한다.
- **제안**: plan 파일의 `status: spec-only` 를 `status: in-progress` 로 정정하거나 plan-lifecycle.md 에 `spec-only` 를 공식 plan 상태 값으로 등재하여 의미를 명확히 분리. 이 경우 spec 파일의 `status: spec-only` 와 plan 파일의 `status: spec-only` 가 별개 스키마임을 plan-lifecycle.md 에 명시.

---

### 3. [WARNING] `spec-impl-evidence.md` 의 `status` 필드 — `spec/1-data-model.md` 및 여러 엔티티의 `status` 컬럼과 동명

- **target 신규 식별자**: spec 파일 frontmatter 키 `status` (값: `spec-only` / `partial` / `implemented` / `deprecated`)
- **기존 사용처**: `spec/1-data-model.md` 에서 `Integration.status` (`connected` / `expired` / `error` / `pending_install`), `KnowledgeBase.reembed_status`, `Document.embedding_status`, `Execution.status` (`pending` / `running` / `completed` / `failed`), `Notification.status` 등 다수 엔티티 컬럼이 모두 `status` 키를 사용. `spec/conventions/cafe24-api-catalog/_overview.md` 의 catalog row `status` 도 동명.
- **상세**: spec frontmatter `status` 는 문서 레이어(YAML frontmatter)에서 사용되고, 엔티티 `status` 는 DB 레이어에서 사용되므로 직접 충돌은 없다. 그러나 build-time 가드(`spec-frontmatter.test.ts`, `spec-status-lifecycle.test.ts`)가 spec 파일을 파싱할 때 `status` 키를 spec frontmatter 전용으로 인식하는 로직을 구현해야 하며, DB 엔티티 `status` 필드와 무관함을 테스트 코드 주석에 명시하는 것이 좋다.
- **제안**: 테스트 파일 헤더에 "spec frontmatter status (spec-only|partial|implemented|deprecated) 는 엔티티 status 컬럼과 별개" 를 명시. 혹은 frontmatter 키를 `impl_status` 또는 `coverage_status` 로 차별화하여 키 레벨에서 의미를 구분. (단, 사용자가 이미 yaml 패턴을 확정한 경우 주석 명시로 충분함.)

---

### 4. [INFO] `spec-impl-evidence.md` 의 `partial` 값 — `KnowledgeBase.reembed_status` 등 기존 `partial` 의미와 무관

- **target 신규 식별자**: spec frontmatter `status: partial`
- **기존 사용처**: `spec/conventions/node-output.md:179` — `information_extractor` 출력의 `partial?` 필드 ("부분적으로 수집된 extracted 필드"), `spec/conventions/chat-channel-adapter.md` — `partialFormData` 변수명
- **상세**: 위 기존 `partial` 사용처는 모두 런타임 데이터 구조(node output, adapter 내부 버퍼)에서의 "부분 수집" 의미이고, target 의 `partial` 은 spec 구현 상태 "일부 구현됨" 의미다. 의미 충돌은 없으나 동일 단어가 다른 레이어에서 서로 다른 뉘앙스로 쓰임을 인식할 필요가 있다.
- **제안**: 충돌 없음. 명시적 조치 불필요.

---

### 5. [INFO] `review/coverage/` 신규 경로 — CLAUDE.md 단일 진실 표에 미등재

- **target 신규 식별자**: `/spec-coverage` 결과 저장 경로 `review/coverage/<YYYY>/<MM>/<DD>/<hh>_<mm>_<ss>/SUMMARY.md`
- **기존 사용처**: `CLAUDE.md` 정보 저장 위치 표는 `review/code/`, `review/consistency/`, `review/merge/` 만 정의. `review/coverage/` 는 없음.
- **상세**: 파일 경로 충돌(동명 기존 파일)은 없으나, CLAUDE.md 의 단일 진실 원칙상 정보 저장 위치는 표에 등재되어야 한다. 미등재 시 다른 agent 가 산출물 위치를 모르는 invariant 깨짐. (convention_compliance.md 에서도 WARNING 으로 지적됨.)
- **제안**: 결정 E(PROJECT.md 갱신) 범위에 CLAUDE.md 정보 저장 위치 표에 `review/coverage/` 행 추가를 포함. 또는 `review/consistency/coverage/<timestamp>/` 로 기존 경로 체계를 재사용해 신규 경로 신설을 피함.

---

### 6. [INFO] `.claude/skills/spec-coverage/SKILL.md` + `.claude/agents/spec-impl-coverage-auditor.md` 신규 파일 — 기존 naming 패턴과 일관성 확인

- **target 신규 식별자**: `.claude/skills/spec-coverage/SKILL.md`, `.claude/agents/spec-impl-coverage-auditor.md`
- **기존 사용처**: `.claude/agents/` 에는 `naming-collision-checker.md`, `convention-compliance-checker.md` 등 `-checker.md` / `-reviewer.md` 패턴. `.claude/skills/` 에는 `consistency-checker/`, `developer/`, `project-planner/` 등 역할 이름 기반 폴더명.
- **상세**: `spec-impl-coverage-auditor` 는 기존 패턴과 일관됨. `spec-coverage` 는 기능(standing audit) 기반 명칭으로, 다른 skills 의 역할(역할명) 기반 명칭과 약간 다르다. 큰 혼동 없으나 `spec-coverage-auditor` 로 통일하면 더 일관적이다.
- **제안**: agent 파일명 `spec-impl-coverage-auditor.md` 는 유지. skills 폴더는 `spec-coverage` 대신 `spec-coverage-auditor` 로 통일 검토(선택).

---

### 7. [INFO] `ImplAnchor` 컴포넌트 신규 도입 — 기존 코드베이스 내 동명 식별자 미존재 확인

- **target 신규 식별자**: MDX 컴포넌트 `<ImplAnchor>`, 파일 경로 `codebase/frontend/src/components/docs/impl-anchor.tsx`
- **기존 사용처**: 코드베이스 내 `ImplAnchor` 또는 `impl-anchor` 검색 결과 없음 (확인됨).
- **상세**: 충돌 없음. `kind` prop enum (`ui-entry` / `component` / `api-endpoint` / `e2e-scenario`) 도 컴포넌트 전용 범위이며 기존 enum 과 이름 충돌 없음.
- **제안**: 충돌 없음. 조치 불필요.

---

### 8. [INFO] `spec-frontmatter-rollout`, `user-guide-reverse-coverage` 등 후속 plan 파일명 — 기존 plan 파일과 중복 없음

- **target 신규 식별자**: `plan/in-progress/{developer-partial-impl-discipline, spec-frontmatter-rollout, user-guide-reverse-coverage, plan-stale-audit, spec-coverage-slash-command}.md`
- **기존 사용처**: `plan/in-progress/` 및 `plan/complete/` 에 동명 파일 없음 (확인됨).
- **상세**: 충돌 없음.
- **제안**: 충돌 없음. 조치 불필요.

---

## 요약

target 문서(`spec-harness-impl-coverage.md`)가 도입하는 신규 식별자 중 실질적인 의미 충돌은 발견되지 않았다. 가장 주의할 충돌 후보는 두 가지다: (1) spec frontmatter `status: deprecated` 와 `spec/conventions/cafe24-api-catalog/_overview.md` §3 의 `deprecated` — 적용 대상 도메인이 달라 직접 충돌은 없으나 동명이의로 혼동 여지가 있다. (2) spec frontmatter `status: spec-only` 가 plan 파일 frontmatter 에서도 이미 비공식으로 사용 중인 점 — plan-lifecycle.md 미정의 값이며 의미 도메인이 다름에도 동일 키·값 쌍이 두 컨텍스트에서 쓰이는 구조적 모호성이 있다. 나머지(review/coverage 경로 미등재, skills 폴더 명칭 일관성)는 INFO 수준이다. 신규 엔티티명·컴포넌트명·파일명 충돌은 없다.

---

## 위험도

LOW

---

STATUS: SUCCESS
