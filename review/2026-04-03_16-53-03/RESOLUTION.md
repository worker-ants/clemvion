# Code Review Resolution

## WARNING 이슈 조치

| # | 발견사항 | 조치 내용 | 상태 |
|---|----------|-----------|------|
| 1 | context.expressionContext 공유 가변 상태 오염 | `nodeContext = { ...context, expressionContext: exprContext }`로 shallow copy하여 핸들러에 전달. 공유 context 미변이 | RESOLVED |
| 2 | TableHandler가 evaluate() 직접 호출 (레이어 위반) | per-item 평가는 핸들러 내부에서만 필요한 로직이므로 직접 호출 유지. 단, safeEvaluate로 래핑하여 에러 처리 통일 | NOTED |
| 3 | 표현식 문자열이 row key로 사용 | 현재 설계 의도. row key는 내부 매핑용이며, 출력의 columns 배열에 label이 별도 제공됨 | NOTED |
| 4 | 표현식 평가 실패 시 전체 노드 중단 | safeEvaluate() 메서드 추가. try-catch로 실패 시 null 반환 | RESOLVED |
| 5 | validate()에서 expression 문법 검증 없음 | 런타임 실패는 safeEvaluate가 처리. validate 단계 검증은 향후 개선 | DEFERRED |
| 6 | static 모드 label expression 미지원 | 스펙상 static 모드의 label은 단순 문자열. 의도된 동작 | NOTED |
| 7 | $dataSource 전체 배열 노출 | 사용자 요구사항으로 $dataSource 제공. 워크플로우 실행 환경은 신뢰된 컨텍스트 | NOTED |
| 8 | escapeHtml single quote 누락 | `.replace(/'/g, '&#x27;')` 추가 | RESOLVED |
| 9 | O(N×M) 패턴 반복 | map 루프 외부에서 Set으로 사전 분류 | RESOLVED |
| 10 | resolveDataSource 로직 중복 | `resolveDataSource()` 헬퍼로 추출 | RESOLVED |
| 11 | resolveColumnLabels 이중 순회 | 성능 영향 미미 (columns 수 소수). 가독성 우선 | NOTED |
| 12 | renderHtml 파라미터 역할 불명확 | resolvedColumns(header용) / originalColumns(key 조회용) 구조 유지 | NOTED |
| 13 | expression-exclusions 암묵적 결합 | 주석으로 결합 관계 명시 추가 | RESOLVED |
