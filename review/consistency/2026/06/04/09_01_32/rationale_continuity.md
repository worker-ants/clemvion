# Rationale 연속성 검토 결과

검토 모드: `--impl-done`, scope=`spec/conventions/spec-impl-evidence.md`, diff-base=`origin/main`

---

## 발견사항

### [WARNING] 4개 가드 확정 선언 이후 4개 신규 가드 추가 — Rationale 미갱신

- **target 위치**: 구현 diff — 신규 파일 4개
  - `codebase/frontend/src/lib/docs/__tests__/plan-frontmatter.test.ts`
  - `codebase/frontend/src/lib/docs/__tests__/spec-area-index.test.ts`
  - `codebase/frontend/src/lib/docs/__tests__/spec-link-integrity.test.ts`
  - `codebase/frontend/src/lib/docs/__tests__/spec-plan-completion.test.ts`
- **과거 결정 출처**: `spec/conventions/spec-impl-evidence.md` §4 "Build-time 가드 (4건)" 및 Overview 본문
  - Overview: "4개 build-time 가드로 정합성을 강제해 이 갭을 닫는다"
  - §4: "본 컨벤션의 정합성은 다음 4개 단위 테스트가 강제"
  - §6 Rollout: "4개 가드 테스트 동반 작성", "PROJECT.md §자동 가드 표에 4개 row 추가"
- **상세**: spec-impl-evidence.md 는 총 가드 수를 "4개" 로 확정·열거하고(spec-frontmatter / spec-code-paths / spec-status-lifecycle / spec-pending-plan-existence), 그 목록을 SoT 로 선언했다. 이번 구현은 이 목록에 없는 가드 4개를 추가한다. 추가 이유·범위 변경 근거가 spec Rationale 에 없으며, 새 가드들이 "본 컨벤션" 의 일부인지 아니면 별개 컨벤션인지 분류도 없다. "4개" 고정 표현이 사실과 다른 상태가 됨.
  - `plan-frontmatter.test.ts` — plan/in-progress/*.md 의 worktree/started/owner 필드 강제. plan-lifecycle.md §4 의 frontmatter 스키마를 build-time 가드로 전환하는 것은 새 결정이나 spec-impl-evidence §4 표에 없음.
  - `spec-area-index.test.ts` — spec 영역 폴더 TOC 가드. spec-impl-evidence 가 약속한 4개 가드 범주 어디에도 해당하지 않음.
  - `spec-link-integrity.test.ts` — spec 내 markdown 링크 유효성 가드. 동일하게 비열거.
  - `spec-plan-completion.test.ts` — "Gate C" plan-completion spec-consistency. 테스트 본문 주석에 "SoT: spec/conventions/spec-impl-evidence.md + .claude/docs/plan-lifecycle.md §5" 라고 명시하나, spec-impl-evidence §5 에는 해당 내용이 없고 plan-lifecycle.md §5 도 "이동 commit 자가 점검" 체크리스트로 수동 확인 용도 — 자동 gate 화를 의도하지 않음.
- **제안**:
  1. `spec/conventions/spec-impl-evidence.md` §4 표에 신규 가드 4개(plan-frontmatter / spec-area-index / spec-link-integrity / spec-plan-completion)를 추가하고 "4개" 고정 수식을 실제 수로 갱신.
  2. 각 가드의 SoT 귀속: plan-frontmatter 는 plan-lifecycle §4, Gate C 는 plan-lifecycle §5 와 연결되므로 어느 문서 관할인지 명시. spec-area-index / spec-link-integrity 는 신규 컨벤션 항목으로 §4 또는 별개 문서에 Rationale 추가.
  3. `spec-impl-evidence.md` 의 `code:` frontmatter(현재 6개 파일 열거)도 신규 4개 파일을 포함하도록 갱신(status: `implemented` 유지).

---

### [WARNING] `spec-plan-completion.test.ts` 의 SoT 선언 — plan-lifecycle §5 와 충돌

- **target 위치**: `spec-plan-completion.test.ts` 라인 615: "SoT: spec/conventions/spec-impl-evidence.md + .claude/docs/plan-lifecycle.md §5"
- **과거 결정 출처**: `.claude/docs/plan-lifecycle.md §5 "이동 commit 자가 점검"` 및 `§6 "Audit 도구 (운영 보조)"` 서두
  - §5: 이동 전 수동 체크리스트 ([ ] 형식, 사람이 직접 확인)
  - §6 서두: "본 절은 stale plan 탐지 및 spec-impl 갭 발견을 위한 운영 도구 참조. **규약 변경 아님** — plan/in-progress/ 폴더 자체의 라이프사이클은 §1-§5 그대로."
- **상세**: plan-lifecycle.md 는 §5 를 수동 자가 점검으로 정의하고 §6 을 "CI 차단 아님" 으로 명시했다. `spec-plan-completion.test.ts` 는 `complete/` plan 에 `spec_impact` frontmatter 필드를 의무화하는 build-time 강제 가드로 동작 — 기존에 수동이었던 검사를 자동화·CI 차단으로 격상하는 것이다. Gate C cutoff(2026-06-04) 이후 완료된 plan 부터 강제가 시작되므로 즉시 영향이 크지 않지만, 결정 번복(수동 → 자동 CI 차단)에 대한 새 Rationale 이 plan-lifecycle.md 또는 spec-impl-evidence.md 어디에도 없다.
- **제안**: plan-lifecycle.md §5 또는 §6 에 "Gate C — plan-completion 자동 강제" 항을 추가하고 "수동 체크리스트에서 build-time 가드로 격상" 결정의 근거(반복 누락 방지 등)를 명시. `spec_impact` 필드 스키마도 plan-lifecycle.md §4 (Frontmatter 스키마) 에 추가 필요.

---

### [INFO] `spec-impl-evidence.md` frontmatter `code:` 목록 미갱신

- **target 위치**: `spec/conventions/spec-impl-evidence.md` frontmatter `code:` (1~11번 라인)
- **과거 결정 출처**: `spec/conventions/spec-impl-evidence.md` §3 `status: implemented` 조건 — "`code:` ≥1 매치 의무"
- **상세**: 현재 frontmatter `code:` 는 6개 파일을 열거하며 status: `implemented`. 신규 4개 테스트 파일이 추가됐으나 `code:` 목록에 미포함. spec-code-paths guard 가 glob 매칭 방식이라 `__tests__/**` 형태의 glob 이 있다면 통과할 수 있으나, 명시 파일 열거 방식이라면 stale 글로브(R-1 약점) 로 신규 파일이 누락된다.
- **제안**: `code:` 에 신규 4개 파일 추가 또는 `codebase/frontend/src/lib/docs/__tests__/**` glob 으로 통합.

---

## 요약

`spec/conventions/spec-impl-evidence.md` 는 build-time 가드를 "4개" 로 확정 선언하고 그 목록을 SoT 로 관리한다. 이번 구현은 동일 폴더에 가드 4개를 추가로 신설했으나, spec 본문의 "4개" 고정 표현·가드 목록·`code:` frontmatter 는 갱신되지 않았다. 이는 과거 확정 결정을 근거 없이 확장한 것이다. 특히 `spec-plan-completion.test.ts` 는 plan-lifecycle §5 의 수동 자가 점검을 CI 자동 강제로 격상하는데, 이 번복에 대한 새 Rationale 이 어느 spec 에도 없다. 기각된 대안의 재도입에는 해당하지 않지만, "결정의 무근거 번복"과 "합의된 목록 위반" 두 관점에서 WARNING 등급이다. 가드 수·목록·`code:` frontmatter·plan-lifecycle §4/§5 를 이번 구현과 동기화하는 후속 spec 갱신 PR 이 필요하다.

## 위험도

MEDIUM
