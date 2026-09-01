# Plan 정합성 검토 — spec/5-system/ (--impl-done, diff-base=origin/main)

## 발견사항

없음.

이 changeset(8 파일 / 134줄)은 `plan/in-progress/expression-engine-error-shape-spec-broken-on-main.md`
가 스스로 계획하고 체크리스트로 추적해 온 수정을 **정확히 그대로** 구현한다:

- `codebase/packages/{ai-end-reason,chat-channel-validation,expression-engine,graph-warning-rules,masked-markers,node-summary}/package.json`
  의 `lint` 스크립트 glob 따옴표 처리 — plan 체크리스트 "로컬-CI 차이" 항목이 원인을 "따옴표
  없는 글롭"(`eslint src/**/*.ts`)으로 확정하고 "이 PR 에서 6개 패키지를 고쳤다" 고 기록한
  바와 파일 목록·개수가 일치한다.
- `codebase/packages/expression-engine/src/parser.ts` 의 `case TokenType.LParen` 블록화 —
  plan 체크리스트 "`parser.ts:317` `no-case-declarations` — 이 PR 에서 해소" 항목과 정확히
  일치(원인 재판정: 환경 문제가 아니라 lint 글롭 버그였다는 정정도 diff 와 부합).
- `codebase/packages/expression-engine/src/__tests__/error-shape.spec.ts` 의 타입 유도 방식
  전환(`Object.entries` 런타임 발견 유지 + 매핑 타입으로 타입만 좁힘) — plan 체크리스트
  "타입 유도로 해소 (2026-09-01)" 항목과 방법론까지 동일(명시 배열로 좁히면 전수성 단언의
  존재 이유가 사라진다는 근거도 diff 의 주석과 일치).

plan 프런트매터의 `worktree: close-two-residuals-e5f7a9` 는 이 검토 대상 워킹트리와 동일하며,
`spec_impact: none` 은 diff 가 `spec/` 을 건드리지 않는 것과 일치한다(scope 델타 0 는 이
plan 관점에서도 정상).

`plan/in-progress/backend-lint-gate-broken-on-main.md` 가 세운 "main 선재 breakage 는 별
PR 로 분리" 선례("발견 브랜치가 `codebase/packages/` 를 전혀 건드리지 않으므로")도 이 diff 와
충돌하지 않는다 — 이 PR 이 바로 그 "분리된 별 PR" 이며 실제로 `codebase/packages/` 를
건드린다.

plan 에 아직 열려 있는 두 체크리스트 항목(① `plan/complete/**` 상대링크 가드 범위 밖 문제,
② 로컬-CI toolchain 차이의 근본 원인 — "재개 신호: 이 PR 의 `packages-checks` 결과")은 이
diff 의 스코프 밖으로 plan 스스로 명시했고, 둘 다 이 changeset 의 8 파일과 직접 관계가
없다. ②는 오히려 이 PR 의 CI 실행 결과 자체가 판정 신호이므로, 이 PR 을 미루거나 확장할
근거가 아니라 후속 관찰 대상이다.

다른 `plan/in-progress/**` 문서 중 이 6개 패키지(`expression-engine` 등)를 언급하는 항목
(`eia-context-schema-followups.md`, `spec-sync-external-interaction-api-gaps.md`)은 모두
이미 `[x]` 로 종결된 무관 항목(harness 배선·마커 리터럴 추출)이며 이 diff 와 충돌하지 않는다.

## 요약

이 changeset 은 `plan/in-progress/expression-engine-error-shape-spec-broken-on-main.md` 가
사전에 진단·확정해 둔 3가지 수정(lint glob 따옴표 처리 6패키지·`parser.ts` case 블록화·
`error-shape.spec.ts` 타입 유도)을 그대로 구현한 것으로, 대상 plan 의 체크리스트·근거·파일
목록과 완전히 일치한다. 미해결 결정을 우회하거나 선행 plan 을 무시한 흔적이 없고, 다른
plan 의 후속 항목을 무효화하지도 않는다. plan 에 남은 두 개의 미체크 항목은 이 diff 의
스코프 밖이라고 plan 자신이 이미 명시했으므로 갱신이 필요하지 않다.

## 위험도

NONE
