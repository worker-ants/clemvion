# 정식 규약 준수 검토 — spec-draft-frontend-layering (2회차)

- 검토 모드: spec draft 검토 (`--spec`)
- target: `plan/in-progress/spec-draft-frontend-layering.md` + **실제로 작성된** `spec/conventions/frontend-layering.md` · `spec/0-overview.md §4` 등재
- 대조 규약: `spec/conventions/spec-impl-evidence.md`(특히 §2·§3·§4·R-5) · 기존 `spec/conventions/**.md` 명명·구조 관행
- 직전 세션(`19_44_52`)에서 지적한 WARNING(frontmatter `status`/`pending_plans` 설계 누락)의 재검증이 본 회차의 핵심.

## 실측 방법

정적 대조뿐 아니라 실제 가드 테스트를 실행해 "규약이 요구하는 결과"가 아니라 "가드가 실제로 통과하는지"를 직접 확인했다 (`grep` count 는 신뢰하지 않는다는 프로젝트 교훈에 따름).

```
codebase/frontend$ npx vitest run \
  src/lib/docs/__tests__/spec-pending-plan-existence.test.ts \
  src/lib/docs/__tests__/spec-code-paths.test.ts \
  src/lib/docs/__tests__/spec-frontmatter.test.ts \
  src/lib/docs/__tests__/spec-status-lifecycle.test.ts \
  src/lib/docs/__tests__/spec-link-integrity.test.ts \
  src/lib/docs/__tests__/spec-area-index.test.ts \
  src/lib/docs/__tests__/plan-frontmatter.test.ts \
  src/lib/__tests__/eslint-layering-guard.test.ts

Test Files  8 passed (8)
Tests       989 + 93 + 34 = 1116 passed
```

## 발견사항

없음 (CRITICAL·WARNING 0건). 직전 WARNING 은 아래와 같이 실제로 해소됐다.

- **[해소 확인] frontmatter `status`/`pending_plans` 설계**
  - target 위치: `spec/conventions/frontend-layering.md` frontmatter (라인 1-9)
  - 대조 규약: `spec/conventions/spec-impl-evidence.md` §2(스키마) · §3(`partial` → `code:` ≥1 매치 의무 + `pending_plans:` 의무) · R-5(spec→plan 역방향 링크 강제 근거)
  - 확인 내용:
    - `status: partial` + `code: [codebase/frontend/eslint.config.mjs, codebase/frontend/src/lib/__tests__/eslint-layering-guard.test.ts]` — 두 경로 모두 실재 파일 존재 확인 (`ls` 실측), `spec-code-paths.test.ts` 통과.
    - `pending_plans: [plan/in-progress/spec-draft-frontend-layering.md]` — 해당 경로가 `plan/in-progress/` 에 실재 (`ls` 실측), `spec-pending-plan-existence.test.ts` 통과.
    - §4 CI 강제 절의 단서 블록("현재 CI 커버리지는 `files: ["src/lib/**"]` 뿐")이 `eslint.config.mjs` 의 실제 `files:` 값과 일치함을 `grep` 으로 재확인 — 문서가 미구현 상태(D2: `src/types/**` 미확장)를 정확히 서술하고 과대 서술(≒ 텔레그램 chat-channel 케이스 재현)하지 않는다.
  - 결론: §3 표의 `partial` 요건(코드 매치·pending_plans 실존) 을 정확히 충족하며, R-5 가 막으려는 "어떤 plan 도 책임지지 않는 빈 약속" 패턴이 아니다. `spec-pending-plan-existence.test.ts` 는 실제로 green.

## 확인된 준수 사항 (긍정 근거, 추가 검증분)

- **명명 규약**: `id: frontend-layering` 은 파일 basename 과 일치하는 kebab-case이며 (`spec-impl-evidence.md §2.1`), 전체 `spec/` 트리에서 유일 (`grep -rl "^id: frontend-layering$" spec/` → 자기 자신 1건만). 파일명은 기존 `spec/conventions/*.md` (audit-actions.md·data-hydration-surfaces.md·chat-channel-adapter.md 등) 와 동일한 kebab-case 토픽명 패턴.
- **문서 구조 규약**: `## Overview` → 번호 매긴 본문(`## 1.`~`## 4.`, `### 4.1`) → `## Rationale` 3섹션 구성이 `audit-actions.md` 와 동일한 관행을 따른다 — 직전 세션 INFO 제안("전사 시 규칙/근거를 본문·Rationale 로 분리")이 실제로 반영됐다 (예: §4.1 "왜 테스트가 필수인가", Rationale "왜 이 방향인가"/"왜 규칙 2종 조합인가" 등 근거성 서술이 전부 `## Rationale` 아래로 이동).
- **`spec/0-overview.md §4` 등재**: `git diff origin/main -- spec/0-overview.md` 로 대조한 결과 §4 표에 정확히 한 행(`| Frontend 레이어 경계 규약 | — | [\`./conventions/frontend-layering.md\`](./conventions/frontend-layering.md) |`)만 추가됐다. 같은 절의 기존 행들(node-output.md·execution-context.md·error-codes.md)과 열 구성·링크 형식이 동일 — CLAUDE.md "정식 규약 → `spec/conventions/<name>.md`" + 진입 문서 등재 원칙 준수.
- **영역 index 예외**: `spec/conventions/` 는 `spec-area-index.test.ts` 의 "flat reference, 무-index" 예외 대상이라 별도 index 갱신 불필요 — 실제로 draft·최종본 모두 index 갱신을 하지 않았고 이는 정확한 처사 (가드 실행으로 재확인).
- **cross-link 헤더**: 직전 세션 INFO(관련 문서 cross-link 부재)가 `> 관련 문서: [Spec 0-Overview §4](../0-overview.md#4-영역별-진입-문서) · [Data Hydration Surfaces](./data-hydration-surfaces.md)` 로 반영됐다. 앵커 `#4-영역별-진입-문서` 는 `spec-link-integrity.test.ts`(실제 렌더러와 동등한 slug 규칙 적용) 통과로 유효성이 실측 확인됐다.
- **`code:`/가드 코드 경로 노출 방식(경미한 대안)**: 직전 INFO 제안은 도입부 `> 관련 문서`에 `eslint.config.mjs`/`eslint-layering-guard.test.ts` 링크를 직접 넣으라는 것이었다. 최종본은 대신 §4 "CI 강제" 절에 표 형태로 두 파일의 역할을 상세 서술하는 방식을 택했다 — frontmatter `code:` 필드에도 두 경로가 이미 명시돼 있어 정보 자체는 빠짐없이 노출된다. 원 제안과 문자 그대로 일치하진 않으나 의도(코드 연결 관계의 명시적 노출)는 충족돼 규약 위반으로 볼 근거가 없다. **[INFO]** 로만 남긴다 — 원한다면 도입부에도 짧은 링크를 추가할 수 있으나 필수는 아니다.
- **출력 포맷/API 문서 규약 (점검 관점 2·4)**: 본 문서는 API 응답·이벤트 페이로드·OpenAPI 데코레이터와 무관한 frontend import 레이어 정책이라 해당 관점은 N/A — 위반 없음.
- **금지 항목 (점검 관점 5)**: `spec/conventions/**` 전체에서 본 문서의 `id`/파일명/구조와 충돌하는 명시적 금지 패턴을 찾지 못했다. 병렬 브랜치(`claude/zen-kapitsa-c5e1de`)와의 naming collision 은 plan 본문("선행 작업과의 관계") 이 사용자 결정으로 처분을 명시했고, 현재 워크트리의 `spec/conventions/frontend-layering.md` 는 그 결정에 따라 main `099f63cc` 기준으로 정정된 단일 버전만 존재 — 중복 정의 없음.

## Phase 2/3 설계에 대한 전방 검증 (참고, 이번 spec draft 자체의 판정에는 영향 없음)

- Phase 3(`partial` → `implemented` 승격 + `pending_plans:` 제거)이 §3.1 전이 규칙("마지막 `pending_plans` 가 `complete/` 로 이동한 commit 안에서 승격")과 정확히 일치하는 절차로 설계돼 있다. `spec-status-lifecycle.test.ts` 의 (c) 조건(모든 pending_plans 가 complete 인데 status 미승격)에 걸리지 않으려면 이 동일 커밋 요건이 지켜져야 하며, plan 본문이 이를 명시적으로 인지하고 있다 (Phase 2·Phase 3 "developer, 동일 커밋").

## 요약

이번 회차는 실측(파일 존재·`grep`)과 실제 vitest 가드 실행(8개 테스트 파일, 1,116개 테스트 전부 통과) 두 층위로 검증했다. 직전 세션이 지적한 WARNING(신설 문서의 `status`/`pending_plans` 설계 누락)은 `status: partial` + 실재하는 `code:` 2건 + 실재하는 `pending_plans: [plan/in-progress/spec-draft-frontend-layering.md]` 로 정확히 해소됐고, `spec-pending-plan-existence.test.ts`·`spec-code-paths.test.ts`·`spec-status-lifecycle.test.ts` 모두 green 이다. 직전 세션의 INFO 두 건(3섹션 분리, cross-link 헤더)도 최종본에 반영됐다. `spec/0-overview.md §4` 등재는 기존 행과 동일한 형식으로 정확히 한 줄만 추가됐다. 새로 발견된 CRITICAL/WARNING 은 없으며, 도입부 cross-link 에 코드 경로를 직접 나열하지 않은 점만 경미한 INFO 로 남긴다(§4 표·frontmatter `code:` 로 이미 충족).

## 위험도

NONE
