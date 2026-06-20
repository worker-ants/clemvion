# RESOLUTION — M-5 레이어1 ai-review (2026-06-20 15_14_06)

전체 위험도 **LOW**, Critical 0. WARNING 3건 수동 처리(전부 trivial — 주석/문서·spec sync). 코드 로직 변경 없음.

## 조치 항목

| SUMMARY # | 카테고리 | 발견 | 조치 | 커밋 |
|---|---|---|---|---|
| W1 | SPEC-DRIFT | spec §1.0/§4 등록 메커니즘이 "정적 배열" — 코드는 DI | spec §1.0/§4/트리를 DI 로 동기 반영(개발자 SPEC-DRIFT 경로, impl-prep W2 사전검증). cross-spec 검증은 `/consistency-check --impl-done` | `7283a216` (review 이전 커밋) |
| W2 | DOCUMENTATION | `execution-engine.module.ts`·`node-bootstrap.service.ts` 주석이 "multi-provider"(코드는 단일 `useValue`) | 3곳 "multi-provider"→"단일 `useValue` 배열 / 토큰" 정정 | 본 REVIEW WORKFLOW 커밋 |
| W3 | DOCUMENTATION | plan 체크리스트 spec-sync 항목 `[ ]` 인데 반영됨 | 체크리스트 spec-sync·TEST·ai-review 항목 실제 상태로 동기화 | 본 REVIEW WORKFLOW 커밋 |

INFO 13건: layer-3 미래 점검(토큰 Symbol화·`registerDynamic` 화이트리스트/인가), pre-existing(`chartComponent` 명명), 선택 개선(테스트 단언 컨텍스트·JSDoc 분량) — 본 PR 조치 불요(아래 후속).

## TEST 결과

- **lint**: 내 변경 14파일 check-mode(`eslint`, --fix 없이) **0 errors**. (`run-test.sh lint` 의 `eslint --fix` 는 repo 전역 pre-existing format drift 로 ~85 파일 수정 + 8 errors 발생 — 전부 내가 안 건드린 파일, M-5 무관. 되돌림.)
- **unit**: 관련 56+ 통과(`node-bootstrap.service.spec` DI·정렬 결정성, `node-components.module.spec` DI 배선+spread 동등, `node-component.registry.spec`, `nodes.controller.spec`, `nodes.integration.spec`). 전체 unit 의 3 FAIL 은 전부 pre-existing frontend/tooling(`plan-frontmatter` stale "known plan" 참조[#648 이동], `spec-plan-completion` exec-single-node, `schedules-page` UI) — backend M-5 무관.
- **build**: 통과 (tsc, 132s).
- **e2e**: 통과 (205 tests, 91s — 부팅 스모크 포함 = DI 교차모듈 주입 실부팅 검증). resolution fix 는 주석/문서만이라 런타임 무영향(재검증 build tsc 통과).

## 보류·후속 항목

- **C1+W1 동적 포트 ID drift(UUID↔slug)** — impl-prep consistency 발견, **본 DI 리팩터와 무관 pre-existing**. 별도 planner 작업(`1-logic/0-common.md §7`·`3-workflow-editor §1.5`·`carousel.md:429`).
- **레이어2(entitlement)·레이어3(Phase D `registerDynamic`)** — 별도 후속. 레이어3 시: `NODE_COMPONENT` Symbol/네임스페이스 전환, `registerDynamic` 화이트리스트/스키마/인가, e2e 스모크.
- **`chartComponent`→`chartNodeComponent` 명명 통일** — 기존 유입, 후속 cleanup PR.
