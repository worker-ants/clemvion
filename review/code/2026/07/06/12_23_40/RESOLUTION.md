# RESOLUTION — /schedules 역방향 딥링크(?triggerId=) 행 강조

리뷰: `review/code/2026/07/06/12_23_40/`(requirement·maintainability·testing·scope 4인) + `review/consistency/2026/07/06/12_23_40/`(cross-spec·convention-compliance 2인).

**전체 위험도 LOW. Critical 0, Warning 0** — 6인 전원 NONE/LOW. 필수 조치 없음. 아래는 고가치 INFO 폴리시만 반영.

## 반영한 INFO
- **testing INFO(커버리지 갭)**: 빈 `?triggerId=` 가 triggerId 없는(orphan) 스케줄과 blank-match 하지 않는지 고정하는 회귀 테스트 추가(`!!focusTriggerId` 가드 락). 총 18 tests.
- **cross-spec INFO(비대칭 근거 미문서화)**: schedule spec `## Rationale` 에 "딥링크 소비의 방향별 비대칭" 항목 신설 — schedule→trigger=drawer 자동오픈(단건 조회), trigger→schedule=행 강조(목록 의존·페이지 한정)의 근거와 cross-page 후속(backend triggerId 필터)을 문서화.

## 미반영 INFO(근거)
- maintainability: `el.scrollIntoView?.(...)` optional chaining 이 코드베이스 유일 사례(다른 곳은 직접호출+테스트 stub) — 방어적이라 유지가 더 안전, 스타일 편차 무시.
- requirement: 캘린더 뷰 전환 시 강조 소실은 spec 침묵 gray-zone, 저위험.
- testing: scrollIntoView mock restore 부재 — vitest 파일 isolate 로 실 leak 없음(리뷰어 확인), 위생 개선은 생략.

## 검증
- vitest schedules-page.test.tsx: **18 passed** · spec-link-integrity 11 · eslint clean · tsc clean
