# RESOLUTION — C-1 후속 ④ (EngineDriver ISP + engine→Retry DI 제거)

전수 ai-review(--route=all, 14 reviewer): **LOW · Critical 0 · Warning 2 · INFO 16**.
architecture·concurrency reviewer 결과 확보(사용자 요구) — architecture 전부 INFO(적정),
concurrency NONE(공유 가변상태·async 경로 변경 없음).

## Warning 처분

| # | 처분 | 조치/근거 |
|---|------|-----------|
| W-1 (testing — spec mock 타입 미narrow) | **fix 적용** | 4개 서비스 spec mockDriver 를 slice(`AiTurnEngineDriver`/`InteractionEngineDriver`/`RetryEngineDriver`)로 narrow. ISP 컴파일 계약이 테스트에서 실현됨. 커밋 `498da767`. |
| W-2 (testing — ExecutionEventEmitter forwardRef DI 미검증) | **수용(이미 커버)** | `new ExecutionEventEmitter(...)` 직접 생성 단위 spec 은 유지. forwardRef DI 라이프사이클은 **dockerized e2e(full app.module 부팅, 35 suites/205, 순환 에러 0)** + **app.module 포함 전체 unit(355 suites)** 가 실증한다. 모든 노드 이벤트가 ExecutionEventEmitter→WebsocketService 경유라 e2e 가 forwardRef 해석을 런타임 exercise. 전용 TestingModule 스모크 추가는 중복 — 비채택. |

## INFO 처분

- **I-4 (node_modules 심링크 커밋 포함)**: **fix** — 루트 node_modules 심링크를 HEAD 에서 제거(amend). 루트 node_modules 는 gitignore 안 됨(backend 만). 제거 확인.
- **I-9 (삭제 메서드 범위 외 참조)**: **검증 완료** — 전수 grep: 잔류 stale 호출자 0. 남은 참조는 engine 의 다른 EngineDriver 멤버 설명 주석 2개 + retry-turn.service.spec 의 자기 메서드 테스트(정상).
- **I-10 (processor bypass 어서션)**: **fix** — `toHaveBeenCalledWith('exec-1','ne-spawned')` 추가.
- **I-11 (12 멤버 하드코딩)**: **fix** — 숫자 제거, "합집합" 산문화.
- **I-13/15 (서비스 JSDoc EngineDriver→slice + retry stale delegator 단락)**: **fix** — 4개 클래스 JSDoc slice 명 갱신 + retry-turn JSDoc 의 thin-delegator 단락을 "외부 진입점이 RetryTurnService 직접 호출" 로 정정.
- **I-14 (processor JSDoc retry 분기)**: **fix** — retry_last_turn→RetryTurnService 직접 호출 주석 추가.
- **I-1/2 (SPEC-DRIFT — §Rationale C-1 thin delegator/ISP)**: **이연 → project-planner**. c1-engine-split SPEC-DRIFT 백로그 ④항에 합류(developer spec read-only). impl-prep 이 이미 "구현 완료 후 spec 갱신" 정상 선행으로 확인(INFO-3/6).
- **I-3/5/6/7/8 (architecture — forwardRef 처방·exports 노출·gateway/processor 의존 증가)**: **수용** — 전부 "현재 적정, 장기 고려" 의도된 tradeoff. forwardRef 는 ES-순환 표준 처방, RetryTurnService export 는 순환 제거의 합리적 대가, gateway/processor 의존 1개 증가는 허용 범위. 비차단.
- **I-12 (retry/reentry/resume 용어)** / **I-16 (form-interaction contextKeyOf 이중 호출, pre-existing)**: **이연** — nicety, 비차단.

## 검증
- lint ✓ · build(nest) ✓ · affected spec(7 suites/197) ✓ · 전체 unit(355 suites/7120, 직전) ✓.
- e2e: fix 는 test+JSDoc 전용(프로덕션 로직 무변) → 직전 dockerized e2e(35 suites/205, DI 부팅 순환 에러 0) 유효. fix 커버 fresh /ai-review 1회 수행(review-gate).
