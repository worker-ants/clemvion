# RESOLUTION — ④ (2차 fresh review, fix 커버)

2차 리뷰: **LOW · Critical 0 · Warning 0 · INFO 17**. 1차(20_36_43) fix 커밋(`498da767`)
을 커버하는 fresh review. Warning 0 = 수렴. 전 INFO 가 SPEC-DRIFT(planner)·문서 nicety·
의도된 architecture tradeoff → 추가 코드 변경 없이 dispositioning 으로 종결(학습 #1·#3:
재리뷰마다 새 nicety churn 회피).

## INFO 처분

| # | 처분 | 근거 |
|---|------|------|
| I-1/2/14 (SPEC-DRIFT §Rationale C-1) | **이연 → project-planner** | thin delegator 제거 + ISP 5분할(Core/Interaction/Reentry/AiTurn/Retry) + line 193 단일계약 가정 갱신. c1-engine-split SPEC-DRIFT 백로그 ④항 합류. impl-prep 이 "구현 완료 후 spec 갱신" 정상 선행 확인. developer spec read-only. |
| I-7 (삭제 메서드 외부 호출자) | **검증 완료** | 전수 grep: stale 호출자 0(1차 RESOLUTION I-9). 재확인 — 남은 건 engine 내부 멤버 설명 주석 + retry-turn.service.spec 자기 테스트. |
| I-8 (form/button mock vestigial applyPortSelection) | **수용(비차단)** | `as unknown as jest.Mocked<InteractionEngineDriver>` 캐스트라 excess property 허용·무해(dead mock setup). 테스트가 driver.applyPortSelection 호출 불가(타입 외). 선택적 정리 — 추가 커밋 시 review-gate 재무장이라 비채택. |
| I-9 (gateway forwardRef 필요성) | **수용** | gateway 의 전 execution 관련 주입이 forwardRef(모듈 순환). RetryTurnService 도 일관 유지가 안전. e2e 부팅 통과 확인. 제거 검증은 순환 재노출 위험 — 유지. |
| I-10/11/15/16 (docs/maint nicety) | **수용(비차단)** | ENGINE_DRIVER 토큰 JSDoc 소비자 목록·gateway forwardRef 주석·processor spec 검증범위·it.each 제외 주석. 전부 문서 nicety. 추가 커밋 churn 회피 위해 dispositioning(서비스 클래스 JSDoc 의 핵심 slice 정합은 1차에서 이미 fix). |
| I-3/4/5/6/12/13 (architecture/maint) | **수용** | forwardRef 처방(ES-순환 표준)·gateway leaky(strangler-fig 중간상태)·exports 노출(순환 제거 대가)·다이아몬드 상속(TS 정상 병합, 동일 시그니처)·JSDoc 중복 — 전부 의도된 tradeoff/nicety, 장기 고려. 비차단. |

## 결론
추가 코드 변경 없음 — 2차 리뷰 dispositioning 종결. 최신 codebase 커밋(`498da767`)이 본 fresh
review(Warning 0)로 커버됨. SPEC-DRIFT 는 planner 후속 백로그. 다음: 비-codebase(review/+plan)
커밋 종결 → push → PR.

## 검증
lint ✓ · build(nest) ✓ · affected spec(7 suites/197) ✓ · 전체 unit(355 suites/7120) ✓ ·
dockerized e2e(35 suites/205, app.module 부팅 순환 에러 0) ✓.
