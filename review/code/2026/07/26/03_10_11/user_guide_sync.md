# 유저 가이드 동반 갱신(User Guide Sync) 리뷰

## 적재한 SSOT

- `.claude/config/doc-sync-matrix.json` — `rows[]` 20행 색인
- `PROJECT.md` §변경 유형 → 갱신 위치 매핑 (L116–272, 자주 누락 패턴 포함)

## 변경 컨텍스트 식별

리뷰 payload 에 명시된 대상 파일은 `spec/conventions/node-cancellation.md` 1건. `git show HEAD --stat` 로 실제 커밋(`babaf0030`, "docs(spec): chat-channel 범주 오류 제거 + commerce 2행 상태 갱신") 전체 범위를 확인:

- `spec/conventions/node-cancellation.md` (본 파일)
- `spec/4-nodes/1-logic/10-parallel.md` (§4 예시 문구의 같은 오분류 정정)
- `plan/in-progress/node-cancellation-residual-signal-propagation.md` (§6 위임 이행 완료 반영)
- `plan/in-progress/spec-update-node-cancellation-shutdown-classification.md` (동일)
- `plan/complete/spec-draft-node-cancellation-chat-channel-correction.md` (신규 → 완료 이동)
- `review/consistency/2026/07/26/{00_08_39,02_52_18}/**` (consistency-check 산출물)

`codebase/backend/**` · `codebase/frontend/**` 는 이 커밋에 **전혀 포함되지 않음** (router 도 전 카테고리에 "소스 코드 변경 없음" 사유로 skip, `documentation`/`requirement`/`user_guide_sync` 만 강제 선택). MakeShop·Cafe24 노드의 실제 `abortSignal` 배선 코드는 별도의 이미 머지된 선행 커밋 `e83da5052`(`feat(nodes): MakeShop·Cafe24 노드에 execution abortSignal 전파`, #1019)에서 이뤄졌고, 본 커밋은 그 완료를 spec 정본에 뒤늦게 반영하는 **순수 문서 정정**이다.

## 매트릭스 매칭

이 변경 set 은 `codebase/backend/src/nodes/**` · `*.tsx` · `codebase/packages/expression-engine/**` 등 코드 trigger 에는 전혀 걸리지 않는다 (해당 파일이 없음). 유일하게 매칭되는 행은:

- **`spec-major-change`** (`change_type`: "spec 신규/대규모 변경") — `trigger.globs`: `spec/conventions/**` 매칭 (glob match). targets: (a) frontmatter `code:`/`status:`/`pending_plans:` 정합 갱신, (b) `status: partial` 이면 `pending_plans:` 의 plan 신설, (c) `status: implemented` 이면 `code:` 글로브 ≥1 매치 보장.

## 동반 갱신 확인

`spec/conventions/node-cancellation.md` 의 frontmatter(diff 범위 밖, L1–14)를 대조:

- `status: partial` — 유지. 남은 미구현 surface(Email in-flight 중단 미채택, Workflow timeout/graceful shutdown 의 노드 abort 통합 — Planned)가 여전히 있으므로 `partial` 유지가 맞다. `implemented` 로 격상하지 않은 것도 (c) 요건과 정합.
- `pending_plans: [plan/in-progress/node-cancellation-residual-signal-propagation.md]` — 이 plan 파일이 **같은 커밋 안에서** 함께 갱신됨(§6 표 두 행 갱신을 "이행 완료"로 반영, "planner 위임 대기" 포인터 제거). (b) 요건 충족. `plan/in-progress/spec-update-node-cancellation-shutdown-classification.md` 도 같은 커밋에서 동반 갱신됨.
- `code:` 글로브 — 7개 경로 그대로 유지(신규 makeshop/cafe24 client·handler 파일 미추가). 이는 **의도적 결정**으로 확인됨 — `spec-update-node-cancellation-shutdown-classification.md` 의 같은 커밋 diff 에 "`frontmatter.code:` 확장은 기존 부분 등재 관행(`spec-impl-evidence.md` 는 최소 1개 매치만 요구)을 유지해 보류" 라고 명시. `spec-impl-evidence.md` 의 실제 요건은 "글로브 ≥1 매치"(전수 나열 의무 아님)이므로 (a)/(c) 위반 아님 — 기존 7개 경로 모두 여전히 저장소에 실존.
- consistency-check `--spec` 이 같은 턴에서 실행됨(`review/consistency/2026/07/26/02_52_18`, BLOCK: NO, WARNING 2건 모두 반영) — PROJECT.md 의무 절차 준수.

다른 행(`new-node` / `node-schema-change` / `integration-provider-change` / `new-ui-string` / `run-debug-flow-change` 등)은 이 changeset 에 해당 trigger 파일이 없어 매칭되지 않는다. 참고로 실제 코드 배선(`e83da5052`)은 기존 MakeShop/Cafe24 노드의 **내부 취소 견고성 강화**(신규 필드·라벨·에러코드·warningCode 없음, provider 자체 신규 아님)라 애초에 `02-nodes/commerce.mdx` · dict · `backend-labels.ts` · `06-integrations-and-config/` 갱신 대상이 아니다 — 그 커밋은 이미 별도로 머지·리뷰된 범위이므로 본 리뷰 대상 밖으로 판단.

## 발견사항

없음 — 매칭된 유일한 trigger(`spec-major-change`)의 동반 갱신 요건 3가지가 모두 같은 커밋 안에서 충족됐다.

## 요약

매트릭스 20행 중 이 changeset(순수 `spec/conventions/**` 문서 정정, 코드 변경 없음)에 매칭되는 행은 `spec-major-change` 1건뿐이며, frontmatter `status:`/`pending_plans:`/`code:` 정합과 관련 plan 동반 갱신·consistency-check 실행까지 같은 커밋 안에서 모두 완료되어 누락 0건이다. 실제 기능 배선(MakeShop·Cafe24 abortSignal cascade)은 이 changeset 이전에 별도 커밋(#1019)으로 이미 머지됐고 신규 필드/라벨/에러코드가 없어 frontend 유저 가이드·i18n·backend-labels 트리거 대상도 아니다.

## 위험도

NONE
