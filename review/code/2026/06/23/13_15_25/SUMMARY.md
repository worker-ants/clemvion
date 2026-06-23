# Code Review 통합 보고서 (증분 2 — feat 커밋 e5cb32e9)

## 전체 위험도
**MEDIUM** — Critical 0. WARNING 13(postMessage origin 보안·테스트 갭·SPEC-DRIFT·README·plan·copy-widget) + INFO.

## Critical
없음.

## WARNING — 처분
| # | 카테고리 | 발견 | 처분 |
|---|---|---|---|
| 1 | Security | `postBoot` targetOrigin `"*"` 폴백(widgetOrigin 빈 문자열 시) | **fix** — !widgetOrigin 조기 반환 |
| 2 | Security | `onMessage` origin 검증 widgetOrigin 빈 시 건너뜀 | **fix** — `widgetOrigin || location.origin` 검증 |
| 3 | Security | iframe sandbox `allow-scripts+allow-same-origin` 조합 | **fix** — same-origin 동봉 위젯이라 필요, 트레이드오프 주석 |
| 4 | Testing | `getWidgetOrigin()` 테스트 전무 | **fix** — widget-base.test 5 케이스 |
| 5 | Testing | 외형 변경 boot 재전송 경로 미검증 | **fix** — live-preview.test rerender 케이스 |
| 6,7 | Documentation | README Deployment 에 `NEXT_PUBLIC_WIDGET_CDN_BASE`·`build:widget` 선행 누락 | **fix**(README 존재 시) |
| 8 | Plan | Phase 3 체크박스 미갱신 | **fix** — `[x]` |
| 9 | [SPEC-DRIFT] | §6.1 step5 "재마운트" vs 구현 "boot 재전송" | **fix(spec)** — step5 구현 반영 |
| 10 | Maintainability | `postBoot` eslint-disable 억제 | **fix** — useCallback + 적정 deps |
| 11 | Maintainability | `getWidgetOrigin` 불필요 복잡도 | **fix** — `new URL(base).origin` 단순화 |
| 12 | SideEffect | copy-widget rmSync+cpSync non-atomic | **fix** — 빌드타임 주석(서빙 중 미실행) |
| 13 | SideEffect | copy-widget `process.env` 전체 spread | **defer/주석** — pnpm 빌드에 PATH 등 필요, 로그 비노출 |

## 주요 INFO
- 미사용 `waitFor` import 제거(fix). copy-widget main 가드 주석(fix). 320px 매직(저영향). wc:resize 미처리(v1 허용). user guide 의도적 Phase 4 보류(누락 아님).

## 처리
보안(W-1·2·3)·테스트(W-4·5)·SPEC-DRIFT(W-9)·plan(W-8)·maintainability(W-10·11)·copy-widget 주석(W-12·INFO) + README(W-6·7 존재 시) → lint/unit 재통과 → impl-done → 종결.
W-13 은 주석(allowlist 는 pnpm 빌드 깨짐). user guide 는 증분 완성 후 별도 턴(plan Phase 4).
