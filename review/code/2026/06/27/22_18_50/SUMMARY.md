# Code Review 통합 보고서 (fresh — 후속 커밋 커버)

리뷰 대상: Channel Web Chat 위젯 리팩터(B2/B3/B5/B6) + 테스트 보강(C) — 전체 branch diff vs main (df77e61e6 + 973074062)
리뷰 일시: 2026-06-27 (세션 22_18_50)

> 본 리뷰는 push 가드 충족을 위해 후속 커밋(973074062: helper 단위테스트·주석·backlog)을 포함한 fresh review 다.

---

## 전체 위험도
**LOW** — 7개 reviewer 전원 Critical/Warning 0. 보안만 LOW(pre-existing INFO), 나머지 6개 NONE. behavior-preserving 리팩터로 신규 취약점·기능 회귀·범위 일탈 없음.

## Critical 발견사항
_없음_

## 경고 (WARNING)
_없음_

## 참고 (INFO) — 전부 비차단

| # | 카테고리 | 발견사항 | 처리 |
|---|----------|----------|------|
| 1 | 보안·설계 | isTextInputSurface denylist — 미지 type 텍스트 허용. 상류 parseWaitingForInput 정규화로 위험 낮음 | 의도된 설계, JSDoc 명시. allowlist 전환은 장기 backlog |
| 2 | SPEC-DRIFT | `isTextInputSurface(null)→true` spec 미기재 | pre-existing 동작, planner spec polish followup |
| 3 | 보안·pre-existing | error 메시지 UI 원문 노출 | backlog §A(W1) |
| 4 | 보안·pre-existing | configFromQuery apiBase 무검증 | backlog §C 보안 #6 |
| 5 | 보안·pre-existing | per_execution 토큰 localStorage 잔류 | backlog §A |
| 6 | 유지보수성 | TERMINAL_EVENTS 이중 캐스트 | 인라인 주석으로 커버(비차단). `readonly string[]` 직접 선언은 선택 |
| 7·8·10 | 유지보수성 | 테스트 fetch mock 중복·SSE 설정 패턴 불일치·스텁 no-op 주석 | 비차단, 기존 테스트 보존(diff 최소화) |
| 9 | 유지보수성 | teardownSession "W9" 레퍼런스 | 본 파일 기존 컨벤션, 인근 주석 커버 |
| 11 | 테스트 | unknown type fallback 테스트 부재 | 의도된 denylist, 비차단 (review-churn 회피로 미추가) |
| 12 | 테스트 | C1 폐기 부정 단언 setTimeout | 기존 패턴 일관성 유지(비차단) |
| 13 | 테스트 | phase=blocked Panel 테스트 | backlog §C 메모 |
| 14·15 | 테스트 | teardownSession 직접 테스트 불가·"새 대화" 텍스트 하드코딩 | 통합 경로 커버·i18n 미도입, 비차단 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 |
|----------|--------|------|
| security | LOW | denylist·error 노출·apiBase·localStorage (전부 INFO, 3건 pre-existing backlog) |
| requirement | NONE | spec §2·§3·§3.1·§R6·3-auth-session §3 충족. SPEC-DRIFT 1건 planner 위임 |
| scope | NONE | 변경 전체 B2·B3·B5·B6+C 범위 내 |
| side_effect | NONE | 순수 함수 추출·상수화 behavior-preserving. 테스트 전역상태 복원 정상 |
| maintainability | NONE | 중복 제거·JSDoc 충실. INFO 5 장기 제안 |
| testing | NONE | 신규 9케이스 적절. 갭 3건 INFO |
| documentation | NONE | JSDoc 완비. README/API/CHANGELOG 불요 |

router: security·requirement·scope·side_effect·maintainability·testing·documentation 강제(router_safety). concurrency 도 선별(fake timer) 됐으나 forced 7 외 결과는 본 통합에 미포함.

## 권장 조치사항
1. (planner) SPEC-DRIFT — `1-widget-app §2` pending=null 근거 한 줄.
2. (장기 backlog) isTextInputSurface allowlist 전환 / configFromQuery apiBase 검증 / error 일반화·sessionStorage(§A).
3. 나머지 미세 개선(TERMINAL_EVENTS 선언·테스트 중복)은 비차단 — 차기 정리 시.
