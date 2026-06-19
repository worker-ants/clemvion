# Scope Review — 변경 범위 분석

## 발견사항

### INFO: 기존 테스트에 `withWorkspace` 래핑만 추가 — 범위 내 최소 변경
- 위치: `execution-engine.service.spec.ts` 내 executeInline/callStack 관련 테스트 11개
- 상세: W-6 fail-closed 전환으로 `assertSameWorkspace` 가 `callerWorkspaceId` 부재 시 throw 하게 됐기 때문에, 기존 테스트들이 `WORKFLOW_FORBIDDEN_WORKSPACE` 오류로 실패하는 것을 막고자 `withWorkspace(contextService.createContext(...))` 래핑을 추가했다. 기존 어설션(parent_node_execution_id 스탬핑, callStack push/pop 등)은 변경 없이 그대로 유지된다.

### INFO: 신규 테스트 추가 — fail-closed 직접 커버
- 위치: `spec.ts` diff lines 113~137 (executeInline 누락), 167~182 (executeSync 부재·불일치), 241~258 (executeAsync 부재·불일치)
- 상세: `assertSameWorkspace` 의 fail-open → fail-closed 교체를 직접 검증하는 신규 테스트 5건이 추가됐다. 요청 변경 범위(W-6)와 1:1 대응한다.

### INFO: `mockWorkflow` 픽스처 + `withWorkspace` 헬퍼 추가
- 위치: `spec.ts` diff lines 35~51
- 상세: 공유 픽스처 `mockWorkflow` 에 `workspaceId: 'ws-1'` 를 추가하고 컨텍스트에 `__workspaceId` 를 주입하는 `withWorkspace` 헬퍼를 선언했다. W-6 격리 로직이 두 값을 비교하므로 반드시 필요한 최소 보조 인프라다. 다른 픽스처 필드 및 구조는 변경 없다.

### INFO: `executeSync`/`executeAsync` 기존 테스트에 `parentWorkspaceId: 'ws-1'` 추가
- 위치: `spec.ts` diff lines 158, 191~221, 228~236
- 상세: 기존 `{ timeoutMs: 0 }` 만 넘기던 호출에 `parentWorkspaceId: 'ws-1'` 를 추가했다. fail-closed 이후 이 인자 없이는 즉시 throw 되므로 기존 경로(timeout/FAILED/CANCELLED 등)를 테스트하려면 필수다. 어설션 자체는 변경 없다.

### INFO: `service.ts` — `assertSameWorkspace` JSDoc·구현 교체
- 위치: `execution-engine.service.ts` diff lines 1680~1713
- 상세: `!callerWorkspaceId` 분기에서 `logger.warn + return` 을 `throw new Error(WORKFLOW_FORBIDDEN_WORKSPACE...)` 로 교체(2 로직 라인)하고 대응 JSDoc·인라인 주석을 갱신했다. 불필요한 함수·임포트·리팩토링 없음.

## 요약

두 파일의 변경은 **W-6 workspace 격리 fail-closed 전환**이라는 단일 목적에 집중돼 있다. `service.ts` 는 `assertSameWorkspace` 의 fail-open 분기를 fail-closed(즉시 throw)로 교체하는 최소 수정이고, `spec.ts` 는 그 변경으로 전제 조건이 달라진 기존 테스트를 보강하고 신규 차단 케이스를 추가한 것이다. 불필요한 리팩토링, 무관 파일 수정, 포맷팅 변경, 임포트 정리, 기능 확장은 전혀 발견되지 않는다.

## 위험도
NONE
