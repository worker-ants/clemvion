# PRD/Spec 리뷰 액션 플랜

> **✅ 완료됨** — 모든 항목이 2026-03-29 기준으로 해소되었습니다.

> 기준일: 2026-03-27
> 참조: [리뷰 결과](../memory/review-2026-03-27.md)

---

## 처리 순서

중대 항목(제품 방향) → 구조적 항목(설계 보완) → 보완 항목(누락/불일치) 순으로 처리한다.
각 항목은 사용자와 논의 후 결정된 방향으로 문서를 수정한다.

---

## Phase 1: 중대 항목

### 1. Integration 노드 부재
- [x] **논의**: Integration 노드 설계 방향 결정
  - ~~방안 A: 서비스별 개별 노드~~
  - ~~방안 B: 범용 Integration 노드 1종~~
  - **방안 C(채택): 혼합** (범용 HTTP/DB + 서비스별 특화 노드 = 7종)
- [x] **수정 대상 문서**: 모두 반영 완료
  - prd/3-node-system.md — Integration 노드 카테고리/요구사항 추가
  - prd/0-overview.md — 노드 수 업데이트
  - spec/4-nodes/4-integration-nodes.md — 신규 파일 추가
  - spec/4-nodes/0-overview.md — 노드 목록 업데이트
  - spec/1-data-model.md — Node.type, Node.category에 integration 추가
  - spec/3-workflow-editor/1-node-common.md — 포트 구성 추가

### 2. MVP 범위 조정 (Phase 구분)
- [x] **논의**: Phase별 기능 분배 결정
  - Phase 1 (핵심 자동화): 개인 워크스페이스, Logic 9종, Flow 1종, Integration 4종, Data 2종, 에디터, 실행
  - Phase 2 (AI & 협업): AI 3종, Logic 2종, Integration 3종, 팀/RBAC, Knowledge Base
  - Phase 3 (생태계): 마켓플레이스, 셀프 호스팅, 커스텀 노드 SDK
- [x] **수정 대상 문서**: 모두 반영 완료
  - prd/0-overview.md — Phase 로드맵 섹션 추가
  - 각 PRD 문서의 우선순위를 Phase로 재분류

### 5. 데이터 변환/코드 노드 부재
- [x] **논의**: Data 카테고리 신설 (Transform, Code 2종)
  - Transform 노드 (연산 체인 기반 데이터 변환)
  - Code 노드 (JavaScript 코드 실행)
- [x] **수정 대상 문서**: 모두 반영 완료
  - prd/3-node-system.md — Data 노드 요구사항 추가
  - spec/4-nodes/5-data-nodes.md — 신규 파일 추가

---

## Phase 2: 구조적 항목

### 3. Loop/ForEach body 서브그래프 동작
- [x] **논의**: **방안 A(채택) — 컨테이너 노드** (확장 가능한 그룹 박스)
  - Loop/ForEach/Background를 컨테이너로 렌더링, 내부에 자식 노드 배치
  - 최대 3단계 중첩, 레벨별 배경 틴트
- [x] **수정 대상 문서**: 모두 반영 완료
  - spec/4-nodes/1-logic-nodes.md — Loop, ForEach, Background 컨테이너 렌더링 서브섹션
  - spec/3-workflow-editor/0-canvas.md — §10 컨테이너 노드
  - spec/3-workflow-editor/2-edge.md — §6 컨테이너 내부 엣지 규칙
  - spec/3-workflow-editor/1-node-common.md — 컨테이너 표기
  - spec/4-nodes/0-overview.md — 컨테이너 표기
  - spec/1-data-model.md — Node.container_id 추가
  - prd/3-node-system.md — ND-LP-06, ND-FE-05, ND-BG-05

### 4. AI Agent Tool Use와 그래프 구조
- [x] **논의**: **도구 팔레트(Tool Area) 방식 채택**
  - AI Agent 옆에 전용 Tool Area. 노드를 드래그로 등록
  - 데이터 흐름 그래프에 참여하지 않음 (on-demand 호출)
- [x] **수정 대상 문서**: 모두 반영 완료
  - spec/4-nodes/3-ai-nodes.md — tools→toolNodeIds, Tool Area 연동
  - spec/3-workflow-editor/0-canvas.md — §11 AI Agent Tool Area
  - spec/3-workflow-editor/2-edge.md — §7 Tool Area 연결 규칙
  - spec/1-data-model.md — Node.tool_owner_id 추가
  - prd/3-node-system.md — ND-AG-10

### 7. Trigger↔Schedule UX 중복
- [x] **논의**: **Schedule은 Trigger의 서브타입** 방식 채택
  - Schedule 생성 시 Trigger(type=schedule) 자동 생성
  - 이름/활성 상태 양방향 동기화, 삭제 시 cascade
  - Schedule 유형 트리거는 Trigger 화면에서 직접 생성 불가
- [x] **수정 대상 문서**: 모두 반영 완료
  - prd/1-navigation.md — NAV-TR-07, NAV-TR-08, NAV-SC-08, NAV-SC-09
  - spec/2-navigation/2-trigger-list.md — Schedule 태그, 읽기 전용 Cron
  - spec/2-navigation/3-schedule.md — §4 Trigger 자동 생성 규칙
  - spec/1-data-model.md — §2.9.1 동기화 규칙

### 8. 에러 전용 출력 포트
- [x] **논의**: **선택적 에러 포트** 방식 채택
  - 에러 정책에 "Route to Error Port" 옵션 추가
  - 선택 시 error 포트가 동적 생성, 빨간 점선 엣지로 연결
- [x] **수정 대상 문서**: 모두 반영 완료
  - prd/3-node-system.md — ND-CM-05 에러 포트 라우팅 추가
  - spec/3-workflow-editor/1-node-common.md — error 포트 규약, 5번째 에러 정책
  - spec/3-workflow-editor/2-edge.md — 에러 포트 엣지 스타일
  - spec/5-system/3-error-handling.md — §3.1 Route to Error Port, §3.2 에러 포트 데이터 구조
  - spec/4-nodes/0-overview.md — PortDef.type에 error 추가
  - spec/1-data-model.md — Edge.type(data/error) 추가

### 10. 실행 엔진 설계
- [x] **논의**: 실행 엔진 아키텍처 결정
  - Redis BQ 기반 메시지 큐, 1 Worker = 1 NodeExecution
  - Execution/NodeExecution 상태 머신
  - 토폴로지 정렬 기반 그래프 순회, 컨테이너 내부 독립 정렬
  - Heartbeat + 체크포인트 기반 장애 복구
- [x] **수정 대상 문서**: 모두 반영 완료
  - spec/5-system/4-execution-engine.md — 신규 파일 생성
  - spec/0-overview.md — PRD↔Spec 매핑에 실행 엔진 행 추가

---

## Phase 3: 보완 항목

### 6. Folder 엔티티 누락
- [x] **작업**: spec/1-data-model.md에 Folder 엔티티(2.5) 추가 완료
  - id, workspace_id, name, parent_id(중첩 폴더, 최대 5단계), sort_order
  - 엔티티 관계 개요에도 반영, 인덱스 추가, 이후 엔티티 번호 재정렬(2.6~2.18)

### 9. 버전 관리와 자동 저장 관계
- [x] **적용**: 자동 저장 ≠ 버전 생성 정책으로 결정
  - 자동 저장 = Workflow 테이블 직접 업데이트 (WorkflowVersion 생성 안 함)
  - 수동 저장(Ctrl+S) / 실행 직전 = WorkflowVersion 스냅샷 생성
  - spec/3-workflow-editor/0-canvas.md 섹션 8.1에 명시

### 11. 알림(Notification) 시스템
- [x] **작업 완료**:
  - spec/1-data-model.md — Notification 엔티티(2.19) 추가, 인덱스 추가
  - spec/2-navigation/0-layout.md — 사이드바 하단에 알림 벨 아이콘 반영
  - spec/2-navigation/9-user-profile.md — 알림 센터 UI spec, 이메일 알림 정책, 알림 API 추가
  - 엔티티 관계 개요에 Notification 반영

### 12. 교차 참조 불일치 수정
- [x] spec/5-system/3-error-handling.md — `http_request` → `ai_agent`로 변경
- [x] spec/2-navigation/4-integration.md — Expired 상태 아이콘 🔴 → 🟡 통일
- [x] spec/0-overview.md — 아키텍처 다이어그램에 Message Queue + Workers 추가, Execution Engine 설명 보강
- [x] prd/3-node-system.md ND-CM-01 — 시작 노드(트리거 직후)의 입력 포트 역할 명시
- [x] prd/0-overview.md — 노드 수 업데이트 (Phase별 정확한 수치 확인 완료: P1=16종, P2=AI 3+Logic 2+Integration 3)

---

## 진행 현황

| 항목 | 상태 | 비고 |
|------|------|------|
| #1 Integration 노드 | ✅ 완료 | 하이브리드 전략 (범용 2종 + 서비스 특화 5종 = 7종). PRD/Spec 반영 완료 |
| #2 MVP 범위 | ✅ 완료 | 3-Phase 구분 (핵심 자동화 → AI & 협업 → 생태계). 모든 PRD에 Phase 컬럼 추가 |
| #5 변환/코드 노드 | ✅ 완료 | Data 카테고리 신설 (Transform, Code 2종). PRD/Spec 반영 완료 |
| #3 서브그래프 동작 | ✅ 완료 | 컨테이너 노드 방식. Loop/ForEach/Background를 확장 가능 그룹 박스로 렌더링 |
| #4 Tool Use 구조 | ✅ 완료 | 도구 팔레트 방식. AI Agent 옆 Tool Area에 노드 드래그 등록. 데이터 흐름 그래프와 분리 |
| #7 Trigger↔Schedule | ✅ 완료 | Schedule은 Trigger 서브타입. Schedule 생성 시 Trigger 자동 생성. 양방향 동기화 |
| #8 에러 출력 포트 | ✅ 완료 | 선택적 에러 포트. 에러 정책에 "Route to Error Port" 추가. 선택 시 error 포트 동적 생성 |
| #10 실행 엔진 | ✅ 완료 | 신규 spec/5-system/4-execution-engine.md. 상태 머신, 그래프 순회, Worker 모델, 장애 복구 |
| #6 Folder 엔티티 | ✅ 완료 | spec/1-data-model.md |
| #9 버전/자동저장 | ✅ 완료 | spec/3-workflow-editor/0-canvas.md |
| #11 알림 시스템 | ✅ 완료 | data-model, layout, user-profile |
| #12 불일치 수정 | ✅ 완료 | 노드 수만 #1 결정 후 처리 |
