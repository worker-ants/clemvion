# 코드 리뷰 이슈 조치 내용

## Critical #1: Timer Leak in executeSync
- **파일**: `execution-engine.service.ts`
- **조치**: `finally` 블록에서 `clearTimeout(timeoutHandle!)` 호출 추가
- **검증**: 빌드 및 전체 테스트 통과

## Critical #2: Sync 서브워크플로우 + Interactive 노드 블로킹
- **파일**: `spec/4-nodes/2-flow-nodes.md`
- **조치**: 동기 모드 실행 로직에 주의사항 추가 — interactive 노드 포함 시 비동기 모드 사용 권장
- **근거**: 실행 시점에서 서브워크플로우의 모든 노드 타입을 사전 검사하는 것은 과도한 복잡성. timeout이 안전장치로 동작하며, 향후 필요 시 validate 단계에서 경고 추가 가능

## Warning #3: CANCELLED 상태 미처리
- **파일**: `execution-engine.service.ts`
- **조치**: `executeSync()`에서 `ExecutionStatus.CANCELLED` 체크 추가, 에러 throw
- **검증**: 테스트 케이스 추가 (`should propagate cancellation errors`)

## Warning #4-5: 비동기 에러 전파 / ON DELETE SET NULL
- **조치**: 설계 의도에 부합하므로 Spec에 동작 명시
- **근거**: 비동기 모드는 fire-and-forget이 의도된 동작. SET NULL은 히스토리 보존에 적합

## Info #7: 테스트 커버리지 보강
- **파일**: `workflow.handler.spec.ts`
- **조치**: 4개 테스트 추가 (23→27)
  - `should handle null input with empty inputMapping`
  - `should propagate async execution errors`
  - `should propagate timeout errors from sync execution`
  - `should propagate cancellation errors from sync execution`
