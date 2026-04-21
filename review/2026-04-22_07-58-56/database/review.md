해당 없음

변경된 세 파일 모두 데이터베이스와 직접적인 연관이 없습니다.

- `shadow-workflow.ts`: 클래스 주석에 명시된 대로 `"never touches the database"` — `Map<string, ShadowNode>` / `Map<string, ShadowEdge>` 로 구성된 **순수 인메모리 그래프 자료구조**입니다. 이번 변경(`isContainerAncestor`, `wouldCreateCycle` 수정)은 DFS 기반 사이클 탐지 알고리즘 수정에 한정됩니다.
- `shadow-workflow.spec.ts`: 위 인메모리 로직에 대한 유닛 테스트 추가입니다.
- `4-ai-assistant.md`: Shadow 검증 규칙 문서 업데이트입니다.

### 요약

이번 변경은 워크플로우 에디터 AI 어시스턴트의 인메모리 Shadow 그래프에서 컨테이너 루프백 에지(자식 → 조상 컨테이너)를 사이클로 잘못 판정하는 버그를 수정한 것입니다. 데이터베이스 쿼리, 스키마, 트랜잭션, 마이그레이션, 커넥션 등 DB 관련 요소가 전혀 포함되어 있지 않습니다.

### 위험도

NONE