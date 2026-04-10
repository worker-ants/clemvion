# 실행 엔진 아키텍처 분석 (2026-04-10 리팩토링 후)

## 현재 방식: Reachability 기반 노드 스케줄링

### 핵심 흐름
1. 모든 노드를 **위상 정렬**(Kahn's algorithm)로 순서 결정
2. root 노드(incoming forward edge가 없는 노드)를 `reachable` 세트에 초기화
3. pointer로 순서대로 방문하며:
   - `reachable`에 없으면 silent skip (NodeExecution 레코드 없음)
   - disabled 노드면 SKIPPED 레코드 생성, reachability 전파하지 않음
   - 실행 후 `propagateReachability`로 출력 포트에 매칭되는 엣지의 타겟만 `reachable`에 추가

### 이전 방식과의 차이
- **이전**: `portRoutingSkipped` (deny-list) + `shouldSkipForPortRouting` 휴리스틱
- **현재**: `reachable` (allow-list) + `propagateReachability` 명시적 전파

### 핵심 파일/라인 (execution-engine.service.ts)
- outgoingEdgeMap 구축: ~696
- reachable 초기화: ~733
- 실행 루프: ~738-858
- reachable 체크: ~747
- propagateReachability 호출: ~839
- back-edge 처리 (reachable 리셋): ~849-857
- propagateReachability 메서드: ~2100
- isPortFiltered: ~2083
- applyPortSelection: ~2063
- gatherNodeInput: ~2009 (isPortFiltered 재사용)
