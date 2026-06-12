# 정식 규약 준수 검토 — spec-draft-refactor-04-security-drift.md

**검토 모드**: spec draft (--spec)
**Target 문서**: `plan/in-progress/spec-draft-refactor-04-security-drift.md`
**검토 일시**: 2026-06-12

---

## 발견사항

### [CRITICAL] plan 문서에 필수 frontmatter 전무
- **target 위치**: `plan/in-progress/spec-draft-refactor-04-security-drift.md` — 파일 전체 (1행부터 제목으로 시작, `---` 구분자 없음)
- **위반 규약**: `.claude/docs/plan-lifecycle.md §4` · `spec/conventions/spec-impl-evidence.md §4.2` — `plan-frontmatter.test.ts` (build 차단 가드) 는 `plan/in-progress/*.md` 상단에 `worktree` / `started` / `owner` 세 필드를 의무화한다.
- **상세**: 파일에 YAML frontmatter(`---` 블록)가 전혀 없다. `worktree`, `started`, `owner` 필드가 모두 누락됐으므로 `plan-frontmatter.test.ts` build guard 가 즉시 실패한다. 이 가드는 CI 차단 레벨이다.
- **제안**: 파일 최상단에 아래 frontmatter 를 추가한다.
  ```yaml
  ---
  worktree: refactor-04-security-286de9
  started: 2026-06-12
  owner: project-planner
  ---
  ```
  `worktree` 는 현재 작업 중인 worktree 이름(`refactor-04-security-286de9`) 으로 채운다. 아직 착수 전이었다면 `(unstarted)` sentinel 을 써야 하나, 이미 review 세션이 진행 중이므로 실제 worktree 값이 맞다.

---

### [CRITICAL] swagger.md `code:` 에 추가 예정인 경로가 현행 규약의 code-path 분류와 불일치
- **target 위치**: `## 변경 내역 ### 4. swagger 노출 정책 (M-1)` — "`spec/conventions/swagger.md §0` 신설 … frontmatter `code:` 에 production-guards.ts·main.ts 추가"
- **위반 규약**: `spec/conventions/spec-impl-evidence.md §2.1` — `code:` 필드는 "본 spec 이 약속한 surface 의 구현 경로"를 가리킨다. `spec-code-paths.test.ts` 는 `status: implemented` 의 `code:` glob 이 ≥1 파일 매치를 강제하지만, 파일 존재가 곧 해당 기능의 구현 존재를 증명하지는 않는다.
- **상세**: 제안된 변경은 `codebase/backend/src/common/config/production-guards.ts` 와 `codebase/backend/src/main.ts` 를 `swagger.md` `code:` 에 추가하려 한다. 그러나 이 두 파일은 현재 **ENABLE_SWAGGER_IN_PROD 가드를 전혀 포함하지 않는다** — `main.ts` 의 SwaggerModule 셋업에는 NODE_ENV 분기가 없고(`SwaggerModule.setup` 이 항상 실행됨), `production-guards.ts` 에도 Swagger 관련 항목이 없다. plan 은 "코드는 이미 구현·완료" 라고 주장하나 실제 코드를 보면 swagger 노출 정책 구현이 존재하지 않는다. `code:` 에 해당 파일을 추가하면 구현 증거 없이 spec 이 `implemented` 를 주장하는 허위 evidence 가 된다.
- **제안**: 두 가지 중 하나를 선택한다.
  (a) **구현 선행 후 문서화**: `main.ts` 에 `NODE_ENV=production && !ENABLE_SWAGGER_IN_PROD` 조건으로 SwaggerModule 셋업을 감싸는 가드를 추가하고, `production-guards.ts` 에도 해당 guard 로직을 넣은 뒤, 그 경로를 `swagger.md` `code:` 에 포함한다. 이렇게 해야 "이미 구현 완료된 동작의 문서화" 주장이 사실이 된다.
  (b) **status 하향 + pending_plans 등록**: `swagger.md §0` 신설은 하되, 미구현 파일은 `code:` 에 추가하지 않는다. `swagger.md` 의 `status` 를 `partial` 로 낮추고 `pending_plans:` 에 구현 plan 경로를 등록해 가드를 통과시킨다. 구현은 별도 developer plan 으로 처리한다.

---

### [WARNING] swagger.md §0 신설이 기존 문서 번호 체계 및 Rationale 누락 문제를 방치
- **target 위치**: `## 변경 내역 ### 4. swagger 노출 정책 (M-1)` — "§0 신설"
- **위반 규약**: CLAUDE.md §정보 저장 위치 — spec 문서 3섹션 권장(Overview / 본문 / Rationale). `spec/conventions/swagger.md` 는 현재 Rationale 섹션이 없다.
- **상세**: plan 이 `§0` 을 기존 `## 1)` 이전에 삽입할 경우 기존 `1)`~`6)` 번호 체계와 충돌하지 않으려면 명시적으로 번호를 어떻게 매길지 결정해야 한다. 또한 swagger.md 에는 `## Rationale` 이 없는데, production guard 정책 근거(비-production 전용인 이유, opt-in 설계 근거)는 Rationale 에 위치해야 3섹션 구조를 만족한다. 이번 변경을 계기로 Rationale 를 함께 신설하지 않으면 CLAUDE.md 권장 구조 미충족 상태가 지속된다.
- **제안**: `§0` 신설 시 기존 `1)`~`6)` 번호는 유지하고, 새 섹션을 `## 0. Swagger UI 노출 정책` 형태로 명시적 번호를 부여한다. 아울러 `swagger.md` 끝에 `## Rationale` 섹션을 추가해 production guard opt-in(`ENABLE_SWAGGER_IN_PROD`) 설계 근거를 기록한다.

---

### [WARNING] 변경 내역 §5 운영 가이드 텍스트 추가가 code surface 여부에 대해 ambiguous
- **target 위치**: `## 변경 내역 ### 5. code stack 노출 staging 가이드 (m-2)` — "코드 무변경(이미 spec 정합). … 운영 가이드 1단락 추가."
- **위반 규약**: `spec/conventions/spec-impl-evidence.md §3` — `status: implemented` spec 에 새로운 규범적 약속을 추가하면 `code:` 검증 대상이 달라질 수 있다.
- **상세**: "외부 노출 staging 은 NODE_ENV=production 으로 운영"은 운영자에 대한 규범적 지침이다. 이것이 단순 설명 텍스트라면 `code:` 갱신 불필요이나, 이 요건이 코드로 강제되는 무언가를 약속한다면 `code:` 경로가 필요하다. plan 이 "코드 무변경" 임을 명시했으나 이 구분이 plan 본문에 드러나지 않는다.
- **제안**: plan 에 "이 단락은 기존 구현의 운영 가이드이며 새 code surface 를 약속하지 않는다(code: 갱신 불필요)" 한 줄을 명시해 ambiguity 를 제거한다.

---

### [INFO] 변경 내역에서 참조하는 spec 파일 경로가 완료 시 `spec_impact` 수집을 위해 미리 구조화되지 않음
- **target 위치**: `## 변경 내역` 전체 — 각 항목에서 spec 파일 경로가 inline 산문으로만 언급됨
- **위반 규약**: `.claude/docs/plan-lifecycle.md §5 Gate C` — 완료(`plan/complete/` 이동) 시 `spec_impact` 필드 선언 의무(started ≥ 2026-06-04 인 plan).
- **상세**: 변경 대상 spec 파일(`spec/5-system/1-auth.md`, `spec/5-system/6-websocket-protocol.md`, `spec/4-nodes/1-logic/8-filter.md`, `spec/4-nodes/5-data/1-transform.md`, `spec/4-nodes/1-logic/1-if-else.md`, `spec/conventions/swagger.md`, `spec/4-nodes/5-data/2-code.md`)이 본문 산문에만 흩어져 있다. 완료 시 frontmatter `spec_impact:` 에 집계해야 할 목록이 미리 정리되지 않으면 누락 위험이 있다.
- **제안**: in-progress 단계에서는 의무 아니지만, frontmatter 에 `spec_impact` draft 또는 본문에 "변경 spec 파일 목록" 섹션을 미리 구조화해 두면 완료 시 Gate C 준수가 용이하다.

---

## 요약

정식 규약 준수 관점에서 target plan 문서는 두 가지 심각한 문제를 가진다. 첫째, `plan/in-progress/*.md` build 차단 가드(`plan-frontmatter.test.ts`)가 요구하는 `worktree`/`started`/`owner` frontmatter 가 전혀 없어 현재 상태 그대로 CI 가 실패한다. 둘째, plan 이 "이미 구현·완료된 동작의 문서화"라고 주장하는 swagger production 노출 가드(`ENABLE_SWAGGER_IN_PROD`)가 실제 `main.ts` 와 `production-guards.ts` 에 구현되어 있지 않아, `swagger.md` `code:` 에 해당 파일을 추가하면 `spec-impl-evidence` 가드의 "구현 존재" invariant 가 허위가 된다. WARNING 2건은 문서 구조(§0 삽입·Rationale 누락)와 운영 가이드 텍스트의 spec surface ambiguity 에 관한 것으로, 채택 전 명확히 할 필요가 있다.

## 위험도

HIGH
