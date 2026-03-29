# PRD/Spec 리뷰 액션 플랜

> 기준일: 2026-03-27
> 참조: [리뷰 결과](../memory/review-2026-03-27.md)

---

## 처리 순서

중대 항목(제품 방향) → 구조적 항목(설계 보완) → 보완 항목(누락/불일치) 순으로 처리한다.
각 항목은 사용자와 논의 후 결정된 방향으로 문서를 수정한다.

---

## Phase 1: 중대 항목

### 1. Integration 노드 부재
- [ ] **논의**: Integration 노드 설계 방향 결정
  - 방안 A: 서비스별 개별 노드 (slack_message, http_request, db_query 등)
  - 방안 B: 범용 Integration 노드 1종 (설정에서 서비스/액션 선택)
  - 방안 C: 혼합 (범용 HTTP/DB + 서비스별 특화 노드)
- [ ] **수정 대상 문서**:
  - prd/3-node-system.md — Integration 노드 카테고리/요구사항 추가
  - prd/0-overview.md — 노드 수 업데이트
  - spec/4-nodes/ — 신규 파일 추가 (Integration 노드 상세)
  - spec/4-nodes/0-overview.md — 노드 목록 업데이트
  - spec/1-data-model.md — Node.type, Node.category에 integration 추가
  - spec/3-workflow-editor/1-node-common.md — 포트 구성 추가

### 2. MVP 범위 조정 (Phase 구분)
- [ ] **논의**: Phase별 기능 분배 결정
  - Phase 1 (MVP) 후보: 개인 워크스페이스, 핵심 노드, Integration 노드, 에디터, 실행
  - Phase 2 후보: 팀/RBAC, AI 노드, Knowledge Base, 스케줄
  - Phase 3 후보: 마켓플레이스, 셀프 호스팅, 고급 노드
- [ ] **수정 대상 문서**:
  - prd/0-overview.md — Phase 로드맵 섹션 추가
  - 각 PRD 문서의 우선순위를 Phase로 재분류

### 5. 데이터 변환/코드 노드 부재
- [ ] **논의**: 어떤 노드를 추가할지 결정
  - Transform 노드 (데이터 재구조화)
  - Code 노드 (JavaScript/Python 스크립트)
  - 기타 유틸리티 (날짜 변환, 문자열 조작 등)
- [ ] **수정 대상 문서**:
  - prd/3-node-system.md — 신규 노드 요구사항 추가
  - spec/4-nodes/ — 신규 파일 또는 기존 파일에 추가

---

## Phase 2: 구조적 항목

### 3. Loop/ForEach body 서브그래프 동작
- [ ] **논의**: 서브그래프 표현 방식 결정
  - 방안 A: 컨테이너 노드 (확장 가능한 그룹 박스)
  - 방안 B: 특수 마커 노드 (body 시작 → ... → body 종료)
  - 방안 C: body 포트 → 하류 노드 체인 → done 포트로 암묵적 귀환
- [ ] **수정 대상 문서**:
  - spec/4-nodes/1-logic-nodes.md — Loop, ForEach, Background 서브그래프 규칙
  - spec/3-workflow-editor/0-canvas.md — 서브그래프 시각적 표현
  - spec/3-workflow-editor/2-edge.md — 서브그래프 관련 엣지 규칙

### 4. AI Agent Tool Use와 그래프 구조
- [ ] **논의**: Tool 노드의 위치/연결 규칙 결정
  - Tool 노드는 그래프에서 독립 존재? 엣지로 연결?
  - 시각적 구분 (점선 엣지 등)?
  - 실행 기록 방식?
- [ ] **수정 대상 문서**:
  - spec/4-nodes/3-ai-nodes.md — Tool 연결 규칙 명확화
  - spec/3-workflow-editor/2-edge.md — Tool 엣지 시각 표현
  - spec/3-workflow-editor/1-node-common.md — Tool 포트 정의

### 7. Trigger↔Schedule UX 중복
- [ ] **논의**: 두 화면의 역할 분담 결정
  - Schedule 생성 시 Trigger 자동 생성 여부
  - Trigger 목록에서 Schedule 타입 표시 규칙
  - 워크플로우 에디터에서 트리거를 어떻게 설정하는지
- [ ] **수정 대상 문서**:
  - prd/1-navigation.md — Trigger/Schedule 관계 명시
  - spec/2-navigation/2-trigger-list.md — Schedule 타입 표시 규칙
  - spec/2-navigation/3-schedule.md — Trigger 자동 생성 규칙
  - spec/1-data-model.md — 관계 설명 보강

### 8. 에러 전용 출력 포트
- [ ] **논의**: 도입 여부 및 방식 결정
  - 모든 노드에 선택적 error 포트 추가?
  - 에러 핸들링 정책에 "Route to Error Port" 옵션 추가?
- [ ] **수정 대상 문서**:
  - prd/3-node-system.md — 에러 처리 요구사항 확장
  - spec/3-workflow-editor/1-node-common.md — 에러 포트 정의
  - spec/3-workflow-editor/2-edge.md — 에러 엣지 시각 표현
  - spec/5-system/3-error-handling.md — 에러 라우팅 정책 추가

### 10. 실행 엔진 설계
- [ ] **논의**: 실행 엔진 아키텍처 결정
  - 메시지 큐 선택 (Redis Queue vs RabbitMQ vs 기타)
  - Worker 프로세스 설계
  - 실행 상태 머신
  - 장애 복구 메커니즘
- [ ] **수정 대상 문서**:
  - spec/5-system/ — 신규 파일: 4-execution-engine.md
  - spec/0-overview.md — 아키텍처 다이어그램에 MQ 추가

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
- [ ] prd/0-overview.md — 노드 수 업데이트 → #1 Integration 노드 결정 후 처리 (TODO 주석 추가됨)

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
