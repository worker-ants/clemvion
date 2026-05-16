# Code Review 통합 보고서 — 2차 (rebase 후)

리뷰 세션: `review/code/2026/05/16/15_24_27`
대상: Cafe24 mall_id 중복 감지 UX 보강 (precheck endpoint 신설, public begin 가드, race backstop, 프론트엔드 inline 배너)
리뷰어: 13개 에이전트 전원 성공 / pending 0건 / fatal 0건

---

## 전체 위험도

**MEDIUM** — Critical 0건. 기능 정확성과 보안 양호. 테스트 커버리지 갭(Connect 버튼 disabled 미검증 등)과 precheck 로딩 구간 버튼 비활성화 누락이 요구사항과 미세하게 불일치. 아키텍처 리팩토링 권고(커스텀 훅 추출, `t` prop 제거)는 단기 처리 권장.

## Critical 발견사항

없음 (rebase 로 1차 리뷰의 6 Critical 해소).

## Warning (23건)

1. Connect 버튼 precheck 로딩 구간 비활성화 누락 (W1, W22)
2. Connect 버튼 disabled 어서션 테스트 누락 (W2)
3. `precheckCafe24Mall` expired 단독 케이스 미커버 (W3)
4. unknown status fallback 분기 미테스트 (W4)
5. legacy row 시나리오 단위 테스트 미존재 (W5)
6. e2e — pending_install / error / expired 응답 미검증 (W6)
7. `formatErrorToast` 분기 테스트 미존재 (W7)
8. precheckLoading 인디케이터 테스트 미존재 (W8)
9. `page.tsx` 비즈니스 로직 비대화 — 커스텀 훅 추출 권고 (W9) [deferred]
10. `Cafe24ExtraFields` `t` prop 패턴 불일치 (W10)
11. `formatErrorToast` 컴포넌트 레벨 분기 — 도메인 상수 분리 권고 (W11) [deferred]
12. legacy fallback 제거 기준 미명시 (W12)
13. `findAllCafe24RowsForMall` 이중 쿼리 (W13)
14. legacy row JSONB 인메모리 필터링 (W14) [deferred — backfill 의존]
15. 에러 코드 `PRIVATE` 토큰이 public 흐름에도 재사용 — Swagger 명시 (W15)
16. fallback 상태 강제 캐스팅 (W16)
17. plan 체크박스 미갱신 (W17)
18. `PRIORITY` 배열 인라인 선언 (W18)
19. status 유니온 타입 3곳 중복 (W19) [deferred]
20. 테스트 mock 인라인 중복 (W20) [deferred]
21. 라우트 순서 주석 Swagger 미반영 (W21) [deferred]
22. `isCafe24OAuth` 전환 시 `cafe24PrecheckLoading` 클리어 누락 (W22)
23. `throwIfUniqueViolation` 트랜잭션 경계 확인 (W23) [deferred]

자세한 발견사항·위치·제안은 각 reviewer review.md 참조.

## 에이전트별 위험도 요약

| Agent | Risk | 핵심 발견 |
|-------|-----:|----------|
| security | LOW | INFO 4건. 보안 양호 |
| performance | LOW | WARNING 3건. 이중 쿼리, JSONB 메모리 필터, 선형 find |
| architecture | MEDIUM | WARNING 5건. SRP, page.tsx 비대화, t prop, legacy 제거 기준, 에러 코드 의미 |
| requirement | MEDIUM | WARNING 4건. precheck 로딩 버튼, unknown status, plan, 에러 코드 |
| scope | LOW | plan 체크박스 외 변경 의도 정합 |
| side_effect | LOW | WARNING 3건 |
| maintainability | LOW | WARNING 4건. PRIORITY 인라인, 유니온 중복, t prop, mock 중복 |
| testing | MEDIUM | WARNING 7건. 단위/e2e 커버리지 갭 |
| documentation | LOW | WARNING 3건 |
| dependency | NONE | 신규 패키지 없음 |
| database | LOW | WARNING 2건 |
| concurrency | LOW | WARNING 1건. TOCTOU 의도 미문서화 |
| api_contract | LOW | WARNING 2건 |

## 조치

`RESOLUTION.md` 참조 — Warning 16건 즉시 처리, 7건 deferred.
