# 정식 규약 준수 검토 — spec-draft-frontend-layering

- 검토 모드: spec draft 검토 (`--spec`)
- target: `plan/in-progress/spec-draft-frontend-layering.md`
- 대조 규약: `spec/conventions/**` (특히 `spec/conventions/spec-impl-evidence.md`, `spec/conventions/data-hydration-surfaces.md` 등 기존 문서 형식)

## 발견사항

- **[WARNING] 신설 문서의 frontmatter(`status`/`pending_plans`) 설계가 draft 에 없음**
  - target 위치: draft 전체 — 특히 `## 산출물` 섹션(라인 88-91)과 `## 구현 위임` 섹션(라인 81-86)
  - 위반 규약: `spec/conventions/spec-impl-evidence.md` §1(적용 대상에 `spec/conventions/**.md` 포함) · §2(frontmatter 스키마 `id`/`status`/`code`/`pending_plans`) · §3(`status` 라이프사이클, `partial` 은 `pending_plans:` 의무) · R-5(`partial` 의 `pending_plans:` 의무화 근거)
  - 상세: draft 는 D1(레이어 순서 `types < lib < components < app`)과 D2(가드 스코프를 `src/types/**` 까지 확장)를 **모두 정식 규칙으로 채택**한다고 결정했지만, 실측(`## 실측 근거`)과 코드 확인(`codebase/frontend/eslint.config.mjs` §`files: ["src/lib/**"]`) 상 **D2 는 아직 코드에 반영되지 않았다** — ESLint 가드는 현재 `src/lib/**` 스코프만 덮고 `src/types/**` 는 미가드 상태다. `spec-impl-evidence.md` §3 표에 따르면 이런 "일부 구현" 상태는 `status: partial` + `pending_plans:`(≥1, `plan/in-progress/` 또는 `plan/complete/` 에 실존해야 함, `spec-pending-plan-existence.test.ts` 가 강제)가 의무다. 그런데 draft 의 `## 구현 위임` 섹션은 "developer 후속 PR" 이라고만 서술하고 그 후속 작업을 추적할 `plan/in-progress/<name>.md` 를 생성/지정하지 않는다. 이 상태로 project-planner 가 `spec/conventions/frontend-layering.md` 를 `status: partial` 로 작성하면 `pending_plans:` 가 가리킬 실재 파일이 없어 `spec-pending-plan-existence.test.ts` 가 fail 하고, 반대로 `status: implemented` 로 작성하면 미구현 D2 를 "구현 완료"로 과대 서술해 spec-impl-evidence 의 핵심 invariant(spec 약속 vs 구현 부재 갭 차단, 텔레그램 chat-channel 사례가 이 컨벤션의 존재 이유)를 정확히 재현하는 오류가 된다.
  - 제안: draft 를 spec 으로 전사하기 전에 (a) `## 산출물` 섹션에 D2 구현을 추적할 `plan/in-progress/<name>.md` (developer 담당, eslint.config.mjs `files` 확장 + `eslint-layering-guard.test.ts` 스코프 확장) 생성을 명시적 phase 로 추가하고, (b) `spec/conventions/frontend-layering.md` frontmatter 를 `status: partial` + `code: [codebase/frontend/eslint.config.mjs, codebase/frontend/src/lib/__tests__/eslint-layering-guard.test.ts]` + `pending_plans: [plan/in-progress/<위 (a)의 이름>.md]` 로 명시한다.

- **[INFO] 3섹션(Overview/본문/Rationale) 매핑이 draft 에 미리보기 없음**
  - target 위치: `## 결정` 하위 D1/D2/D3 섹션(라인 50-79)
  - 위반 규약: CLAUDE.md §정보 저장 위치("결정의 배경·근거는 해당 spec 문서 끝의 `## Rationale`") · 기존 관행(`spec/conventions/data-hydration-surfaces.md`, `audit-actions.md` — 번호 매긴 본문 규칙 절 다음 별도 `## Rationale` 절로 배경/기각 대안을 분리)
  - 상세: draft 는 D1/D2/D3 각 결정 헤더 아래에 규칙(무엇을 금지하는가)과 근거(Why/Why not 기각 대안)를 한 번에 섞어 쓰고 있다. 이 자체는 draft(의사결정 로그)로서는 자연스럽지만, 최종 `spec/conventions/frontend-layering.md` 로 전사할 때 규칙 본문(레이어 순서·가드 스코프 규정)과 근거(D2 의 "Why"/"Why not 기각한 대안")를 분리해 각각 본문 절과 `## Rationale` 절로 나눠야 기존 컨벤션 문서들의 3섹션 관행과 일치한다. draft 만으로는 이 분리가 실제로 이뤄질지 확인 불가.
  - 제안: 전사 시 D1(레이어 순서)·D3(app 제외 범위)는 번호 매긴 본문 규칙 절로, D2 의 "Why"/"Why not" 단락은 `## Rationale` 절로 이동해 기존 문서(`data-hydration-surfaces.md` §1-3 + §4 Rationale, `audit-actions.md` §1-3 + Rationale) 패턴을 따를 것을 권장.

- **[INFO] 관련 문서 cross-link 헤더 계획 부재**
  - target 위치: draft 전체
  - 위반 규약: 기존 관행(`data-hydration-surfaces.md` 라인 13 `> 관련 문서: ...`, `audit-actions.md` 라인 114-117 SoT 경계 명시)
  - 상세: 기존 conventions 문서는 도입부에 관련 spec/문서로의 cross-link 와 "본 문서가 유일하게 소유하는 것"을 명시하는 관행이 있다. 이 신설 문서는 ESLint 가드(`codebase/frontend/eslint.config.mjs`)·가드 테스트(`eslint-layering-guard.test.ts`)와 직접 연결되므로 최종본에 해당 코드 경로 cross-link 를 넣는 것이 일관적이나, draft 에는 이 부분이 계획되어 있지 않다.
  - 제안: 전사 시 도입부에 `> 관련 문서: eslint.config.mjs (가드 구현) · eslint-layering-guard.test.ts (가드 회귀 테스트)` 형태의 cross-link 를 추가.

## 확인된 준수 사항 (긍정 근거)

- **파일명/식별자**: `spec/conventions/frontend-layering.md` — kebab-case, `spec/conventions/` 내 기존 파일들(`data-hydration-surfaces.md`, `chat-channel-adapter.md`, `node-cancellation.md` 등)과 명명 패턴 일치. `id: frontend-layering` 도 기존 conventions 전체에서 미사용(grep 확인) — 충돌 없음.
- **문서 구조 위치**: `spec/conventions/` 는 `spec-impl-evidence.md` §4.2 `spec-area-index.test.ts` 예외 목록의 "flat reference, 무-index" 대상이라 이 신설 문서는 영역 index 갱신 의무가 없다 — draft 가 index 갱신을 언급하지 않은 것은 누락이 아니라 정확한 처사.
- **실측 근거·코드 인용 정확성**: draft 가 인용한 `eslint.config.mjs` 의 `files: ["src/lib/**"]`, `eslint-layering-guard.test.ts` 파일 경로·PR #967 배경 주석(`rag-types.ts` → `conversation-utils.ts`)은 실제 코드와 대조해 정확하다 (날조·과장 없음).
- **"코드 우선 → spec 사후 문서화" 패턴**: 이미 병합된 PR #967 (ESLint 가드)을 사후에 `spec/conventions/` 로 승격하는 흐름은 CLAUDE.md §정보 저장 위치 "정식 규약 → `spec/conventions/<name>.md`" 원칙에 부합하는 정상적인 gap-closure 이며, 금지된 패턴을 답습하지 않는다.
- **출력 포맷/API 문서 규약(점검 관점 2·4)**: 본 문서는 API 응답·이벤트 페이로드·OpenAPI 데코레이터와 무관한 frontend import 레이어 정책이라 해당 관점은 비적용(N/A) — 위반 없음.

## 요약

`spec-draft-frontend-layering.md` 는 이미 병합된 ESLint 가드(PR #967)를 정식 `spec/conventions/` 로 승격하는 취지 자체는 CLAUDE.md 의 "정식 규약 → `spec/conventions/<name>.md`" 원칙에 정확히 부합하고, 파일명·id·실측 인용은 기존 컨벤션 문서 관행과 일치한다. 다만 신설 예정 문서의 **frontmatter 설계**(특히 `status`/`pending_plans`) 가 draft 에 전혀 계획되어 있지 않은 점이 실질적 리스크다 — D1 전체 규칙 중 D2(types 스코프 확장)는 아직 코드 미반영 상태라 `status: partial` + 실재하는 `pending_plans:` 항목이 필요한데, 그 항목이 가리킬 developer 구현 plan 이 draft 산출물 목록에 없다. 이대로 전사하면 `spec-pending-plan-existence.test.ts` 또는 spec-impl-evidence 의 "spec 약속 vs 구현" 정합 invariant 중 하나를 깨뜨릴 개연성이 있다. 3섹션(Overview/본문/Rationale) 분리와 cross-link 헤더는 draft 단계에서 미리보기가 없을 뿐이라 INFO 수준 권고로 충분하다.

## 위험도

MEDIUM
