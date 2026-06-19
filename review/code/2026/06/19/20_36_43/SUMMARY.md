# Code Review 통합 보고서 — C-1 후속 ④ (EngineDriver ISP + engine→Retry DI 제거)

## 전체 위험도
**LOW** — 순수 리팩터(런타임 동작 불변). Critical 0 · Warning 2(테스트 타입 정합). 전수 14 reviewer 실행(--route=all). architecture·concurrency 포함. 상세 reviewer 결과는 본 세션 디렉토리 개별 *.md.

## Critical
없음.

## 경고 (WARNING)
- **W-1 (testing)**: 4개 서비스 spec 의 mockDriver 가 분할 후에도 full `EngineDriver` 사용 → ISP 컴파일 계약이 테스트에서 미실현. 각 spec 을 slice 타입(`AiTurnEngineDriver`/`InteractionEngineDriver`/`RetryEngineDriver`)으로 narrow 권장.
- **W-2 (testing)**: `execution-event-emitter.service.spec.ts` 가 `new ExecutionEventEmitter(...)` 직접 생성 → forwardRef DI 라이프사이클 미검증. TestingModule 스모크 추가 또는 상위 통합 커버 확인.

## 참고 (INFO 주요)
- I-4 (security): **루트 node_modules 심링크가 diff 에 포함** — 커밋 제외.
- I-9 (side-effect): 삭제된 retryLastTurn/applyRetryLastTurn 의 범위 외 참조 grep 확인.
- I-1/2 (SPEC-DRIFT): §Rationale C-1 thin delegator 제거 + ISP 5분할 반영(planner).
- I-10 (testing): processor bypass 케이스 인수 어서션 추가.
- I-13/14 (docs): FormInteractionService JSDoc EngineDriver→InteractionEngineDriver; processor retry 분기 주석.
- I-11/12 (maint): "12 멤버" 하드코딩·retry/reentry/resume 용어 구분.
- I-16 (perf): form-interaction contextKeyOf 이중 호출 가독성.
- I-3/5/6/7/8 (architecture): forwardRef 처방·exports 노출·gateway/processor 의존 증가 — 전부 "현재 적정, 장기 고려"(수용).

## 에이전트별
security LOW · architecture NONE(전부 INFO) · concurrency NONE · performance NONE · requirement NONE(SPEC-DRIFT) · scope NONE · side_effect LOW · maintainability NONE · testing LOW(W-1/2) · documentation NONE · dependency LOW · database/api_contract/user_guide_sync NONE.

> main Claude 멱등 persist (worktree isolation guard 로 workflow terminal write 차단).
