# Code Review 통합 보고서

## 전체 위험도
**LOW** — Critical 없음. WARNING 3건(CHANGELOG 미갱신·유저 가이드 mdx stale·wiring 스모크 테스트 부재)은 문서/테스트 보강. 코드 자체(신규 `ActivityDisconnectedBanner` + `page.tsx` 배선)는 보안·범위·부작용·유지보수성 문제 없음.

## Critical
없음.

## 경고 (WARNING)

| # | 카테고리 | 발견 | 위치 | 조치 |
|---|---|---|---|---|
| 1 | testing | `ActivityTab` 통합 지점(status/onNavigate 배선, 빈상태·목록 위 배너 합성, onGoToOverview 클로저)이 미테스트 | page.tsx `ActivityTab` | 최소 스모크 테스트 추가 (activity/catalog mock) — **조치: RESOLUTION 참조** |
| 2 | documentation | CHANGELOG 미갱신 | 루트 CHANGELOG.md | `## Unreleased — 활동 탭 "연결 안 됨" 배너` 추가 — **조치 완료** |
| 3 | user_guide_sync | `integration-management.mdx`/`.en.mdx` Activity 탭 설명 stale | docs/06-integrations-and-config | ko/en 배너 안내 문장 추가 — **조치 완료** |

## 참고 (INFO)
- requirement: spec §4.6 "[개요 탭] 이동 버튼" 이 실제 "상태 확인" 문구와 표현 차이(모호성) → spec 문구 명확화(조치).
- side_effect: prop 확장·setTab 넓은 타입 전달·테스트 store 조작·hook 순서 — 실질 위험 없음.
- maintainability #7: 배너 `role="status"` 누락(scope-tab 형제는 명시) → **조치: role="status" 추가**.
- maintainability #8: dark border 톤 미세 차이(amber-900 vs 800) → tone escalation fix 로 정합.
- documentation: JSDoc/inline 주석 이중 기술, expires-soon 경계 테스트 부재 → 경계 테스트 추가(조치).

## 에이전트별
security NONE · requirement NONE(INFO 2) · scope NONE · side_effect NONE(INFO 4) · maintainability NONE(INFO 3) · testing LOW(W1) · documentation LOW(W2) · user_guide_sync LOW(W3).

## 라우터
실행 8(security/requirement/scope/side_effect/maintainability/testing/documentation/user_guide_sync). 제외 6(performance/architecture/dependency/database/concurrency/api_contract — 순수 프레젠테이션 배너, 신규 네트워크/쿼리/계약 없음).
