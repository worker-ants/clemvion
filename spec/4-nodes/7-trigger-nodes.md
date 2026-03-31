# Spec: Trigger 노드

> 관련 문서: [PRD 노드 시스템](../../prd/3-node-system.md#3-trigger-노드) · [Spec 노드 개요](./0-overview.md) · [Spec 노드 공통](../3-workflow-editor/1-node-common.md) · [Spec 실행 엔진](../5-system/4-execution-engine.md)

---

## 1. Manual Trigger

### 1.1 개요

| 속성 | 값 |
|------|------|
| type | `manual_trigger` |
| category | `trigger` |
| 표시 이름 | Manual Trigger |
| 아이콘 | ⚡ (Zap) |
| 색상 | `#F59E0B` (앰버) |
| 입력 포트 | 없음 (0개) |
| 출력 포트 | 1개 (`out`) |
| 컨테이너 | 아니오 |

### 1.2 역할

- 워크플로우의 **시작 노드**로서, 수동 실행(Run 버튼, API 호출)의 진입점
- 워크플로우당 **정확히 1개** 존재해야 하며 삭제 불가
- 워크플로우 생성 시 **자동 생성**됨 (기본 위치: x=250, y=300)

### 1.3 실행 동작

- **패스스루(Pass-through)**: 워크플로우 실행 입력 데이터를 그대로 출력 포트로 전달
- 입력 데이터가 없으면 빈 객체 `{}` 출력
- 실행 시간: 거의 0ms (데이터 변환 없음)

```
워크플로우 실행 요청 (input: { name: "test" })
  ↓
Manual Trigger Node
  ↓ (output: { name: "test" })
다음 노드
```

### 1.4 설정 (Config)

Manual Trigger 노드는 사용자 설정이 없다. 설정 패널에서는 Label과 Notes만 편집 가능.

### 1.5 포트 정의

| 포트 | 방향 | ID | 레이블 | 타입 |
|------|------|-----|--------|------|
| Output | 출력 | `out` | Output | `data` |

### 1.6 제약 조건

| 제약 | 설명 |
|------|------|
| 워크플로우당 1개 | 복수의 Manual Trigger 노드를 추가할 수 없음 |
| 삭제 불가 | 캔버스에서 Delete 키 및 컨텍스트 메뉴로 삭제 불가 |
| 입력 연결 불가 | 입력 포트가 없으므로 다른 노드의 출력을 받을 수 없음 |

### 1.7 실행 흐름

```
1. 사용자가 Run 버튼 클릭 또는 POST /workflows/:id/execute API 호출
2. 실행 엔진이 Execution 레코드 생성 (status: PENDING)
3. 실행 엔진이 비동기로 실행 시작 (status: RUNNING)
4. 워크플로우의 노드와 엣지를 로드하여 DAG 구성
5. 위상 정렬(Topological Sort)로 실행 순서 결정
6. Manual Trigger 노드가 첫 번째로 실행됨 (입력 엣지 없음 → 루트 노드)
7. 워크플로우 입력 데이터를 출력 포트로 전달
8. 출력 포트에 연결된 다음 노드들이 순서대로 실행
9. 모든 노드 실행 완료 → status: COMPLETED
```

---

## 2. 향후 확장: Webhook Trigger, Schedule Trigger

현재 Phase 1에서는 Manual Trigger만 구현되어 있다.
향후 Phase 2에서 아래 트리거 유형이 추가될 예정:

| type | 표시 이름 | 설명 |
|------|-----------|------|
| `webhook_trigger` | Webhook Trigger | 외부 HTTP 요청으로 워크플로우 실행 |
| `schedule_trigger` | Schedule Trigger | 크론 스케줄에 따라 자동 실행 |

이들은 별도의 Trigger 엔티티(`trigger` 테이블)와 연동되며,
Manual Trigger와 동일하게 워크플로우 그래프의 루트 노드 역할을 한다.
