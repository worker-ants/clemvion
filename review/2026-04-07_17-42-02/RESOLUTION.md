# Code Review Resolution

## WARNING 이슈 조치

### #1 `targetIndex = -1` 무한루프 위험 - **해결**
- `sortedNodeIds.indexOf()` 대신 사전 구성된 `sortedIndexMap` (Map<id, index>)으로 O(1) 조회 변경
- `targetIndex === undefined`인 경우 `continue`로 해당 back-edge skip 처리
- **파일**: `execution-engine.service.ts` backEdgeMap 구성 루프

### #2 `executedNodes` 재실행 구간 미초기화 - **의도적 동작으로 주석 명시**
- `executedNodes`는 재실행 시 의도적으로 유지 (nodeOutputCache에서 최신 출력을 읽기 위해 필요)
- `portRoutingSkipped`는 재실행 범위에서 초기화 (포트 라우팅 결정이 변경될 수 있으므로)
- 두 Set의 동작 차이를 인라인 주석으로 명시
- **파일**: `execution-engine.service.ts` 변수 선언부

### #3 back-edge 타겟 스타트 노드 입력 처리 - **해결**
- `gatherNodeInput`에서 모든 incoming edge의 소스가 미실행 상태일 때 `workflowInput`으로 fallback하도록 수정
- 첫 실행: workflowInput 사용, 재실행: back-edge 소스 출력 사용
- 신규 테스트 추가로 검증
- **파일**: `execution-engine.service.ts` `gatherNodeInput` 메서드

### #4 `MAX_NODE_ITERATIONS=0` 무제한 루프 DoS 위험 - **경고 로그 추가**
- `maxNodeIterations === 0 && backEdges.length > 0`일 때 `this.logger.warn()` 출력
- **파일**: `execution-engine.service.ts` 실행 루프 진입 전

### #5 DB N+1 쿼리 증폭 - **범위 외 (기존 구조)**
- 기존 `executeNode` 내 DB 패턴이므로 이번 변경 범위에서는 별도 조치하지 않음

### #6 트랜잭션 부재 - **범위 외 (기존 구조)**
- 기존 아키텍처의 트랜잭션 부재 이슈로 이번 변경 범위에서는 별도 조치하지 않음

### #7 에러 메시지 내부 노드 정보 노출 - **수용**
- 내부 시스템용으로 현재 에러 메시지 수준은 적절하다고 판단

### #8 순환 에러 메시지 Breaking Change - **수용**
- 기존에는 순환 그래프 자체가 즉시 실패했으므로 에러 메시지에 의존하는 클라이언트는 없을 것으로 판단

### #9 `service['configService']` private 필드 접근 - **수용**
- 테스트 내 mock override 패턴으로 현재 수준에서 실용적

### #10 self-loop 테스트 미비 - **해결**
- `A → A` self-loop 케이스를 `back-edge-identifier.spec.ts`에 추가
- **파일**: `back-edge-identifier.spec.ts`

### #11 `portRoutingSkipped` 리셋 동작 검증 - **해결**
- back-edge 타겟 스타트 노드의 입력값 검증 테스트 추가 (첫 실행: workflowInput, 재실행: back-edge 소스 출력)
- **파일**: `execution-engine.service.spec.ts`

### #12 `_selectedPort` 없는 노드 back-edge 항상 활성화 - **스펙에 설계 의도 명시**
- pass-through 노드에 back-edge 연결 시 탈출 불가능한 무한 루프가 됨을 스펙에 명시
- MAX_NODE_ITERATIONS 가드에 의해 최종 중단됨을 문서화
- 순환 참조는 반드시 분기 노드(Switch, If/Else)의 특정 포트에서만 연결해야 함을 명시
- **파일**: `spec/5-system/4-execution-engine.md`

## INFO 이슈 조치

### #1 `indexOf` O(n) → O(1) - **해결** (WARNING #1과 함께 처리)
- `sortedIndexMap` 사전 구성으로 해결

### #7 `cycle-detector.ts` dead code - **보존**
- `execution-engine.service.ts`에서 import 제거 완료
- cycle-detector.ts 파일과 테스트는 유틸리티로 보존

### 기타 INFO 이슈 - **범위 외**
- configService 캐싱, JSDoc 보완, 복합 인덱스 확인 등은 이번 변경 범위 외

## 검증 결과

- lint: 변경 파일 전체 통과
- unit test: 398 tests passed (22 suites)
- build: 성공
