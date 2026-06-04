# 신규 식별자 충돌 검토 — spec/conventions/spec-impl-evidence.md

검토 모드: `--impl-done` / diff-base: `origin/main`  
대상 코드 영역: `codebase/frontend/src/lib/docs/__tests__/` (신규 5파일)

---

## 발견사항

충돌로 판정되는 항목이 없다. 아래는 확인 과정에서 주의 깊게 살펴본 항목의 결과다.

### [INFO] `Area` 인터페이스 — 모듈 격리로 충돌 없음
- target 신규 식별자: `interface Area` (`spec-area-index.test.ts` 내부)
- 기존 사용처: `Area` (recharts 컴포넌트, `codebase/frontend/src/components/editor/run-results/renderers/presentation-renderers.tsx` line 5·327)
- 상세: 두 `Area` 는 모듈 경계가 완전히 분리된다. 새 `Area` 인터페이스는 test 파일 내부에서만 사용되며(`export` 없음), recharts `Area` 는 UI 레이어 컴포넌트다. TypeScript 스코프가 교차하지 않아 실제 충돌 없음.
- 제안: 없음. 현 격리가 충분하다.

### [INFO] `slugify` — 기존 사용처 없음, 신규 도입 적절
- target 신규 식별자: `export function slugify(heading: string): string` (`spec-links.ts`)
- 기존 사용처: `codebase/frontend/src/lib/docs/__tests__/` 내 어느 파일에도 동명 함수 없음. 외부 src/ 에도 없음.
- 상세: GitHub-slugger 래퍼로, 테스트 전용 helper 모듈(`spec-links.ts`) 에만 노출. 앱 코드에 동명 함수 없음.
- 제안: 없음.

### [INFO] `extractLinks` / `collectSpecMarkdown` / `findBrokenLinks` / `headingSlugs` — 신규 도입, 충돌 없음
- target 신규 식별자: 위 4개 함수(`spec-links.ts` exports)
- 기존 사용처: `impl-anchor-parse.ts`(기존 helper)에 동명 함수 없음. `spec-frontmatter-parse.ts`에도 없음.
- 상세: 기존 test helper 들은 `collectApplicableSpecs` / `globMatchesAny` / `repoRoot` 등 다른 명칭을 사용하며 의미 도메인도 다름(frontmatter parse vs 링크 추출/slug). 충돌 없음.
- 제안: 없음.

### [INFO] `MdLink` / `SpecMdFile` / `LinkViolation` / `LinkViolationKind` — 신규 인터페이스/타입, 충돌 없음
- target 신규 식별자: 위 4개 타입 (`spec-links.ts` exports)
- 기존 사용처: `spec-frontmatter-parse.ts` 의 `SpecRecord` / `SpecFrontmatter` 와 이름이 다름. `impl-anchor-parse.ts` 의 `ImplAnchorMatch` / `GuiFlowSection` 과도 다름. 외부 src/ 에 동명 타입 없음.
- 상세: 충돌 없음.
- 제안: 없음.

### [INFO] `isGateCEnforced` / `hasValidSpecImpact` — 신규 exports, 충돌 없음
- target 신규 식별자: 두 함수 (`spec-plan-completion.test.ts` exports)
- 기존 사용처: 해당 파일 외 어디에서도 동명 함수 참조 없음. 의미 중복되는 기존 guard 함수도 없음.
- 제안: 없음.

### [INFO] `spec_impact` 프론트매터 키 — 기존 필드와 중복 없음
- target 신규 식별자: plan frontmatter 필드 `spec_impact`
- 기존 사용처: `spec-impl-evidence.md §2.1` 의 기존 spec frontmatter 필드(`id` / `status` / `code` / `pending_plans` / `user_guide`)에 동명 키 없음. `plan-lifecycle.md §4` 의 in-progress 필드(`worktree` / `started` / `owner`)에도 없음.
- 상세: `spec_impact` 는 완료 plan(`plan/complete/`) 전용 신규 필드이며 기존 spec frontmatter 나 in-progress 필드와 의미 도메인이 분리됨. 충돌 없음.
- 제안: 없음.

### [INFO] Gate C / Gate D 레이블 — 기존 Gate A/B 와 일관성
- target 신규 식별자: "Gate C" (`spec-plan-completion.test.ts`), "Gate D" (advisory, `spec-impl-evidence §4.2`)
- 기존 사용처: `plan/in-progress/spec-drift-gates.md` 가 Gate A/B/C/D 를 열거형 레이블로 먼저 정의한 SoT. `project_spec_drift_gate_backlog.md` 에도 동일 레이블 사용.
- 상세: Gate C/D 는 기존 레이블 체계와 일관되게 이어지는 명명이며 의미 충돌 없음.
- 제안: 없음.

### [INFO] `WORKTREE_SENTINEL` / `WORKTREE_PLACEHOLDER` — test-local 상수, 충돌 없음
- target 신규 식별자: 두 상수 (`plan-frontmatter.test.ts` 내부)
- 기존 사용처: `spec-frontmatter-parse.ts` 나 다른 helper 에 동명 상수 없음.
- 제안: 없음.

### [INFO] 파일 경로 — 기존 컨벤션과 일치, 중복 없음
- target 신규 파일: `plan-frontmatter.test.ts` / `spec-area-index.test.ts` / `spec-link-integrity.test.ts` / `spec-links.ts` / `spec-plan-completion.test.ts`
- 기존 사용처: `codebase/frontend/src/lib/docs/__tests__/` 에 이미 `spec-frontmatter.test.ts` / `spec-code-paths.test.ts` / `spec-status-lifecycle.test.ts` / `spec-pending-plan-existence.test.ts` 가 존재하며 같은 `spec-*` / `plan-*` 접두어 패턴을 사용.
- 상세: 파일명이 기존 파일과 겹치지 않으며 컨벤션과 일치함. 충돌 없음.
- 제안: 없음.

---

## 요약

이번 diff 가 도입하는 신규 식별자(함수명·인터페이스·타입·상수·파일경로·프론트매터 키·Gate 레이블) 는 기존 코드베이스 및 spec 에서 사용 중인 식별자와 의미 충돌이 없다. `Area` 인터페이스(recharts 컴포넌트 vs test-internal 인터페이스)와 `slugify` 처럼 범용적인 이름이 있지만 모두 모듈 격리 또는 서로 다른 타입 시스템 스코프로 교차하지 않는다. 요구사항 ID, API endpoint, 이벤트/메시지, 환경변수·설정 키 관점에서도 신규 도입이 없어 해당 관점의 충돌 가능성이 없다.

---

## 위험도

NONE
