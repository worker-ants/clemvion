# Stage 3 · Background 노드

## 배경

PRD `ND-BG-*`는 하위 노드 그룹을 **메인 흐름을 블로킹하지 않고** 백그라운드로 실행한다. 오래 걸리는 후속 작업(이메일 발송, 로그 업로드 등)을 메인 응답에서 분리할 때 쓴다. 현재 미구현.

## 설계

### 노드 정의

- 타입: `background`
- 카테고리: `logic`
- 컨테이너 노드 (Loop/ForEach와 같은 멤버십 패턴)
- 입력 포트: 1 (`in`)
- 출력 포트: 2 (`main` — 즉시 진행, `background` — 본문 진입점) + error

### 실행 의미

1. 입력 도착 → `main` 포트로 즉시 다음 노드 진행(블로킹 없음)
2. 동시에 `background` 포트에 연결된 멤버 노드들을 **별도 실행 컨텍스트**에서 fire-and-forget으로 실행
3. 백그라운드 실행 결과·에러는 별도 `NodeExecution` 레코드로 남김 (실행 이력에서 확인 가능)

### 데이터 모델

기존 `node_executions`의 `metadata` JSONB에 `backgroundParentId` 추가(별도 컬럼 대신 메타로). 백그라운드 실행이 원래 컨테이너에서 분기됐음을 표시.

### 영향받는 파일

- 신규: `backend/src/nodes/logic/background/**`
- 수정: `backend/src/modules/execution-engine/**` — 컨테이너 기반 백그라운드 분기 처리
- 수정: 실행 엔진 테스트
- 수정: `spec/4-nodes/1-logic-nodes.md` §Background, `prd/3-node-system.md` ND-BG-*
- 수정: `frontend/src/content/docs/02-nodes/logic.mdx` Background 섹션
- 프론트엔드: 컨테이너 렌더링은 기존 Loop/ForEach와 공유 — 노드 정의만 추가되면 자동 반영

### 테스트

- backend unit: background component
- backend integration: main 경로가 백그라운드 완료를 기다리지 않는지 타임라인으로 검증
- 백그라운드 실행 실패가 메인 워크플로우를 실패시키지 않는지 검증

### 검증

- 실행 이력 타임라인에서 background 분기가 메인 완료 후에도 진행될 수 있음
- 실행 결과 UI에서 background 노드 상태가 별도로 표시됨
