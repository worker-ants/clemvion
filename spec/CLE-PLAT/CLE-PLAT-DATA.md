---
id: "CLE-PLAT-DATA"
title: "데이터 모델 개요"
type: "design"
version: 4
status: "approved"
requirements: []
basis_superseded: false
parent: "CLE-PLAT"
ancestors: ["CLE-VISION", "CLE-PLAT"]
area: "CLE-PLAT"
content_hash: "0c24caafc3145ef20fd651fd47dd690f710f0bae1feecef9d34083b03f309fb1"
read_as: "approved_fallback"
task: "CLE-T-BV4YXZ"
source_paths: ["spec/1-data-model.md", "spec/data-flow/0-overview.md", "spec/data-flow/12-workspace.md"]
mirror_sha256: "f4c6439accf3fbbf433a5c7156c2647eb6e28fccb990518beab355f56af7a169"
etag: "sha256-e3ac338c775ec17b5eefebf3ffb7c5e4051bc96cfc35b970933a91bb83295a9c"
---
> 구현 상태: 구현됨 · 원문: `spec/1-data-model.md` (§1 엔티티 관계 개요, §1.1 참조의 소속, §2 FK 표기, §3 인덱스 전략, Rationale «`code:` 에 전용 e2e 가드 셋» · «§2 FK 삭제 동작 · 빠진 컬럼» · «쓸 인덱스가 없는 FK 서른하나의 처분»), `spec/data-flow/0-overview.md` (§3.3, §5 벡터 인덱스), `spec/data-flow/12-workspace.md` (Rationale «본문 참조 id 도 저장 전에 소속을 본다») · 용어: [용어 사전](../CLE-GLOSSARY.md)

## 개요

이 문서는 Clemvion 데이터베이스의 전체 지도다. 엔티티 사이의 관계, 모든 엔티티에 공통인 컬럼 규칙, 요청 본문이 보내는 참조 id 의 소속 규칙, 조회 조건의 null · undefined 규칙, 외래 키(FK)의 삭제 동작, 인덱스 전략을 한곳에서 정한다.

엔티티마다의 컬럼 상세는 이 문서가 아니라 그 엔티티를 소유한 영역 데이터 문서가 정한다. 어느 문서가 어느 엔티티를 소유하는지는 [엔티티와 소유 문서](#엔티티와-소유-문서) 표에 있다. 데이터가 어느 API·큐를 거쳐 흐르는지는 [시스템 아키텍처](CLE-PLAT-ARCH.md) 와 각 영역 데이터 문서가 다룬다. 스키마를 바꾸는 절차는 [DB 마이그레이션 규약](../CLE-ENG/CLE-ENG-MIGRATION.md) 이 정한다.

## 엔티티 관계 지도

관계가 많아 네 그림으로 나눈다. 모든 그림의 뿌리는 사용자와 워크스페이스(Workspace, `workspace`)다. 한 그림에 없는 엔티티와의 관계는 다른 그림에서 다시 나온다. 선의 `|o` 는 부모가 없을 수 있는(nullable) FK 다.

### 계정·워크스페이스·관측

사용자는 워크스페이스를 소유하고 멤버로 여러 워크스페이스에 속한다. 로그인 세션·로그인 이력·Passkey 는 사용자에게, 감사 로그·인앱 알림·알림 규칙은 워크스페이스에 속한다.

```mermaid
erDiagram
  User ||--o{ Workspace : "소유"
  User ||--o{ WorkspaceMember : "소속"
  Workspace ||--o{ WorkspaceMember : "멤버"
  Workspace ||--o{ WorkspaceInvitation : "초대"
  User ||--o{ RefreshToken : "로그인 세션"
  User |o--o{ LoginHistory : "로그인 이력"
  User ||--o{ WebAuthnCredential : "Passkey"
  Workspace ||--o{ AuditLog : "감사 로그"
  User ||--o{ AuditLog : "행위자"
  Workspace ||--o{ Notification : "인앱 알림"
  User ||--o{ Notification : "수신자"
  Workspace ||--o{ AlertRule : "알림 규칙"
  Workflow |o--o{ AlertRule : "대상 워크플로우"
  User |o--o{ AlertRule : "작성자"
```

### 워크플로우·실행·AI 어시스턴트

워크플로우는 노드와 연결선(Edge)으로 이루어지고, 실행(Execution)과 노드 실행(NodeExecution)을 남긴다. 노드·실행·노드 실행에는 자기 참조가 있다(컨테이너 자식, 서브 워크플로우 부모와 재실행 원본, 그룹 부모).

```mermaid
erDiagram
  Workspace ||--o{ Folder : "폴더"
  Folder |o--o{ Folder : "하위 폴더"
  Workspace ||--o{ Workflow : "워크플로우"
  Folder |o--o{ Workflow : "정리"
  Workflow ||--o{ Node : "노드"
  Node |o--o{ Node : "컨테이너 자식"
  Workflow ||--o{ Edge : "연결선"
  Node ||--o{ Edge : "출발 노드"
  Node ||--o{ Edge : "도착 노드"
  Workflow ||--o{ WorkflowVersion : "버전"
  Workflow ||--o{ Execution : "실행"
  Execution |o--o{ Execution : "부모 실행과 재실행 원본"
  Execution ||--o{ NodeExecution : "노드 실행"
  Node ||--o{ NodeExecution : "노드"
  NodeExecution |o--o{ NodeExecution : "그룹 부모"
  Execution ||--o{ ExecutionNodeLog : "진행 로그"
  Execution ||--o{ ExecutionToken : "인터랙션 토큰"
  Workflow ||--o{ WorkflowTestDataset : "테스트 데이터셋"
  Workflow ||--o{ AssistantSession : "어시스턴트 세션"
  AssistantSession ||--o{ AssistantMessage : "메시지"
```

### 트리거·통합

트리거는 워크플로우를 시작시키는 진입점이고, 스케줄 트리거는 스케줄과 1:1 로 묶인다. 통합은 워크스페이스에 속하고 노드 실행마다 활동 로그를 남긴다.

```mermaid
erDiagram
  Workspace ||--o{ Trigger : "트리거"
  Workflow ||--o{ Trigger : "시작 대상"
  Workspace ||--o{ AuthConfig : "인증 설정"
  AuthConfig |o--o{ Trigger : "웹훅 인증"
  Trigger ||--o| Schedule : "스케줄 트리거"
  Workspace ||--o{ Schedule : "스케줄"
  Workspace |o--o{ WebhookEndpointReservation : "경로 예약"
  Trigger |o--o{ Execution : "시작한 실행"
  Workspace ||--o{ Integration : "통합"
  Integration ||--o{ IntegrationUsageLog : "활동 로그"
  NodeExecution ||--o{ IntegrationUsageLog : "호출한 노드 실행"
  Workflow ||--o{ IntegrationUsageLog : "워크플로우"
  Integration |o--o{ IntegrationOAuthState : "OAuth 상태"
  Integration ||--o{ IntegrationExpiryDispatch : "만료 알림 발사 기록"
```

### 지식 저장소·AI

지식 저장소(Knowledge Base, `KnowledgeBase`)는 문서와 청크를 갖고, Graph RAG 모드면 Entity 와 Relation 을 더 갖는다. 모델 설정(`ModelConfig`)은 지식 저장소·어시스턴트 세션·LLM 사용량 기록이 가리킨다.

```mermaid
erDiagram
  Workspace ||--o{ KnowledgeBase : "지식 저장소"
  KnowledgeBase ||--o{ Document : "문서"
  Document ||--o{ DocumentChunk : "청크"
  KnowledgeBase ||--o{ DocumentChunk : "청크(비정규화)"
  KnowledgeBase ||--o{ GraphEntity : "Entity"
  KnowledgeBase ||--o{ GraphRelation : "Relation"
  GraphEntity ||--o{ GraphRelation : "head"
  GraphEntity ||--o{ GraphRelation : "tail"
  DocumentChunk |o--o{ GraphEntity : "마지막 등장 청크"
  DocumentChunk |o--o{ GraphRelation : "근거 청크"
  DocumentChunk ||--o{ GraphChunkEntity : "등장"
  GraphEntity ||--o{ GraphChunkEntity : "등장 Entity"
  Workspace ||--o{ ModelConfig : "모델 설정"
  ModelConfig |o--o{ KnowledgeBase : "임베딩·추출·리랭커 모델"
  Workspace ||--o{ LlmUsageLog : "LLM 사용량"
  ModelConfig |o--o{ LlmUsageLog : "호출 모델"
  ModelConfig |o--o{ AssistantSession : "어시스턴트 모델"
  Workspace ||--o{ AgentMemory : "에이전트 메모리"
```

그림에 없는 관계: LLM 사용량 기록은 워크플로우·실행·노드 실행을 nullable FK 로 가리킨다. 시크릿 저장소(`SecretStore`)는 `workspace_id` 를 갖지만 FK 가 없다. 소셜 로그인 상태(`auth_oauth_state`)와 OAuth 미리보기(`integration_oauth_preview`)는 10분 만료 일시 행이다.

## 엔티티와 소유 문서

컬럼 정의·제약·응답 노출 규칙은 "소유 문서" 열의 문서가 정한다.

| 엔티티 | 한 줄 설명 | 소유 문서 |
| --- | --- | --- |
| User | 로그인 계정 한 명 | [계정과 워크스페이스 데이터 흐름](../CLE-ACCT/CLE-ACCT-DATA.md) |
| Workspace | 리소스를 격리하는 단위(개인·팀) | [계정과 워크스페이스 데이터 흐름](../CLE-ACCT/CLE-ACCT-DATA.md) |
| WorkspaceMember | 워크스페이스 소속과 역할 | [계정과 워크스페이스 데이터 흐름](../CLE-ACCT/CLE-ACCT-DATA.md) |
| WorkspaceInvitation (`workspace_invitation`) | 팀 워크스페이스 초대 | [계정과 워크스페이스 데이터 흐름](../CLE-ACCT/CLE-ACCT-DATA.md) |
| RefreshToken | 리프레시 토큰. 같은 `family_id` 가 한 로그인 세션 | [계정과 워크스페이스 데이터 흐름](../CLE-ACCT/CLE-ACCT-DATA.md) |
| LoginHistory | 인증 이벤트의 사용자별 기록 | [계정과 워크스페이스 데이터 흐름](../CLE-ACCT/CLE-ACCT-DATA.md) |
| WebAuthnCredential | 등록한 Passkey·보안 키 | [계정과 워크스페이스 데이터 흐름](../CLE-ACCT/CLE-ACCT-DATA.md) |
| `auth_oauth_state` | 소셜 로그인 OAuth `state` 일시 행 | [계정과 워크스페이스 데이터 흐름](../CLE-ACCT/CLE-ACCT-DATA.md) |
| Workflow | 노드와 연결선으로 만든 자동화 단위. `folder_id` 의 소속은 [참조의 소속](#참조의-소속) | [워크플로우 데이터와 저장 흐름](../CLE-WF/CLE-WF-DATA.md) |
| Folder | 워크플로우를 묶는 계층 폴더. `parent_id` 의 소속은 [참조의 소속](#참조의-소속) | [워크플로우 데이터와 저장 흐름](../CLE-WF/CLE-WF-DATA.md) |
| Node | 워크플로우의 노드. `container_id`·`tool_owner_id`·새 노드 `id` 의 소속은 [참조의 소속](#참조의-소속) | [워크플로우 데이터와 저장 흐름](../CLE-WF/CLE-WF-DATA.md) |
| Edge | 두 노드 포트를 잇는 연결선. 끝점의 소속은 [참조의 소속](#참조의-소속) | [워크플로우 데이터와 저장 흐름](../CLE-WF/CLE-WF-DATA.md) |
| WorkflowVersion | 워크플로우 버전 스냅샷 | [워크플로우 데이터와 저장 흐름](../CLE-WF/CLE-WF-DATA.md) |
| Trigger | 워크플로우 시작 진입점(웹훅·스케줄·수동). `workflow_id`·`auth_config_id` 의 소속은 [참조의 소속](#참조의-소속) | [트리거 데이터와 흐름](../CLE-TRIG/CLE-TRIG-DATA.md) |
| WebhookEndpointReservation | 웹훅 경로의 영구 예약 | [트리거 데이터와 흐름](../CLE-TRIG/CLE-TRIG-DATA.md) |
| Schedule | cron 스케줄. 스케줄 트리거와 1:1. 생성 요청 `workflowId` 의 소속은 [참조의 소속](#참조의-소속) | [트리거 데이터와 흐름](../CLE-TRIG/CLE-TRIG-DATA.md) |
| AuthConfig | 외부 호출용 인증 설정 | [트리거 데이터와 흐름](../CLE-TRIG/CLE-TRIG-DATA.md) |
| Integration | 외부 서비스 통합과 자격 증명 | [통합 데이터와 흐름](../CLE-INT/CLE-INT-DATA.md) |
| IntegrationUsageLog | 통합 활동 로그 | [통합 데이터와 흐름](../CLE-INT/CLE-INT-DATA.md) |
| `integration_oauth_state` | 통합 OAuth 시작·설치 상태 일시 행 | [통합 데이터와 흐름](../CLE-INT/CLE-INT-DATA.md) |
| `integration_oauth_preview` | OAuth 콜백 뒤 통합 생성 전 미리보기 일시 행 | [통합 데이터와 흐름](../CLE-INT/CLE-INT-DATA.md) |
| `integration_expiry_dispatch` | 만료 임계 알림의 1회 발사 기록 | [통합 데이터와 흐름](../CLE-INT/CLE-INT-DATA.md) |
| SecretStore | 비밀의 암호화 보관소(`secret://` 참조) | [통합 데이터와 흐름](../CLE-INT/CLE-INT-DATA.md) |
| KnowledgeBase | 지식 저장소. 모델 설정 참조 넷의 소속은 [참조의 소속](#참조의-소속) | [지식 저장소 데이터와 흐름](../CLE-KB/CLE-KB-DATA.md) |
| Document | 지식 저장소에 올린 문서 | [지식 저장소 데이터와 흐름](../CLE-KB/CLE-KB-DATA.md) |
| DocumentChunk | 문서 청크와 임베딩 | [지식 저장소 데이터와 흐름](../CLE-KB/CLE-KB-DATA.md) |
| Entity (`GraphEntity`) | Graph RAG Entity | [지식 저장소 데이터와 흐름](../CLE-KB/CLE-KB-DATA.md) |
| Relation (`GraphRelation`) | Graph RAG Entity 사이 Relation | [지식 저장소 데이터와 흐름](../CLE-KB/CLE-KB-DATA.md) |
| ChunkEntity (`GraphChunkEntity`) | 청크-Entity 매핑 | [지식 저장소 데이터와 흐름](../CLE-KB/CLE-KB-DATA.md) |
| Execution | 워크플로우 실행 1회 | [실행 데이터와 흐름](../CLE-EXEC/CLE-EXEC-DATA.md) |
| ExecutionNodeLog | 한 실행의 노드 진행 순서 | [실행 데이터와 흐름](../CLE-EXEC/CLE-EXEC-DATA.md) |
| WorkflowTestDataset | 에디터 테스트 입력 데이터셋 | [실행 데이터와 흐름](../CLE-EXEC/CLE-EXEC-DATA.md) |
| NodeExecution | 노드 실행 1회 | [실행 데이터와 흐름](../CLE-EXEC/CLE-EXEC-DATA.md) |
| ExecutionToken (`execution_token`) | EIA 실행 단위 토큰의 jti 추적 | [EIA 데이터와 흐름](../CLE-IX/CLE-EIA-DATA.md) |
| ModelConfig | 채팅·임베딩·리랭크 모델 설정 | [LLM 사용량 기록](../CLE-AI/CLE-AI-USAGE.md) |
| LlmUsageLog | LLM 호출의 토큰 사용량 | [LLM 사용량 기록](../CLE-AI/CLE-AI-USAGE.md) |
| AgentMemory | 에이전트 메모리 | [에이전트 메모리](../CLE-AI/CLE-AI-MEMORY.md) |
| AuditLog | 감사 로그 | [감사 로그](../CLE-OBS/CLE-OBS-AUDIT.md) |
| Notification | 인앱 알림 | [알림](../CLE-OBS/CLE-OBS-NOTIFY.md) |
| AlertRule | 알림 규칙. `workflow_id` 의 소속은 [참조의 소속](#참조의-소속) | [알림](../CLE-OBS/CLE-OBS-NOTIFY.md) |
| AssistantSession (`workflow_assistant_session`) | AI 어시스턴트 대화 세션. `llm_config_id` 의 소속은 [참조의 소속](#참조의-소속) | [AI 어시스턴트 스트리밍과 세션 API](../CLE-WF/CLE-WF-ASSIST-PROTO.md) |
| AssistantMessage (`workflow_assistant_message`) | AI 어시스턴트 메시지 | [AI 어시스턴트 스트리밍과 세션 API](../CLE-WF/CLE-WF-ASSIST-PROTO.md) |

트리거의 일부 컬럼은 다른 문서가 정한다. 채팅 채널 컬럼(`chat_channel_*`, `config.chatChannel`)은 [채팅 채널 데이터와 흐름](../CLE-CHAT/CLE-CHAT-DATA.md), EIA 컬럼(`notification_*`, `config.notification`·`config.interaction`)은 [EIA 데이터와 흐름](../CLE-IX/CLE-EIA-DATA.md) 이 정한다.

## 공통 컬럼 규칙

1. **기본 키**: 엔티티는 대개 `id`(UUID)를 PK 로 둔다. 예외는 여섯이다.
   - ExecutionNodeLog: `id` 가 BIGSERIAL 이다. PostgreSQL sequence 가 부여한 순서가 곧 노드 실행 순서이고, 다중 인스턴스에서도 안전하다.
   - ExecutionToken: JWT `jti`(TEXT)가 PK 다.
   - SecretStore: `ref`(TEXT, `secret://<scope>/<resourceId>/<name>`)가 PK 다.
   - WebhookEndpointReservation: `endpoint_path` 가 PK 다. 예약하는 대상이 곧 경로라 별도 id 가 할 일이 없다.
   - ChunkEntity: `(chunk_id, entity_id)` 복합 PK 다.
   - 통합 OAuth 미리보기 토큰(`integration_oauth_preview`): `preview_token`(VARCHAR(64), `'tmp_'` + hex 32자)이 PK 다([통합 데이터와 흐름](../CLE-INT/CLE-INT-DATA.md)).
2. **시각 컬럼**: 생성 시각 `created_at` 과 수정 시각 `updated_at` 을 둔다. `updated_at` 은 DB 트리거 `update_updated_at_column`(V001)이 갱신한다.
3. **nullable 표기**: 컬럼 타입 뒤의 `?`(예: `String?`, `UUID?`)는 NULL 을 허용한다는 뜻이다.
4. **FK 표기**: FK 컬럼은 `FK → 부모 (삭제 동작)` 으로 적는다. 모든 FK 행에 삭제 동작을 적는다. 동작 목록은 [FK 삭제 동작](#fk-삭제-동작) 에 있다.
5. **워크스페이스 소속**: 워크스페이스 리소스는 `workspace_id` 로 워크스페이스에 속하고, 워크스페이스를 지우면 CASCADE 로 함께 지워진다. 시크릿 저장소만 `workspace_id` 에 FK 가 없고 앱이 트리거 단위로 정리한다([시크릿 저장소](../CLE-INT/CLE-INT-SECRET.md)).
6. **비정규화 컬럼**: 조회를 빠르게 하려고 부모의 부모를 함께 적는 컬럼이 있다. 활동 로그의 `workflow_id`, 청크의 `knowledge_base_id`, 테스트 데이터셋의 `workspace_id` 가 그 예다.
7. **스키마의 기준**: 스키마는 Flyway SQL 마이그레이션이 만들고 ORM(TypeORM)이 만들지 않는다(`synchronize: false`). 엔티티 파일(`*.entity.ts`)과 마이그레이션이 다르면 마이그레이션이 기준이다. 둘 사이의 drift 는 e2e 가드 `entity-schema-declarations` 가 잡는다. 인덱스와 제약은 선언에서 DB 한 방향으로, 컬럼 정의는 양방향으로 대조한다.
8. **응답 노출**: 해시·토큰 같은 민감 컬럼을 API 응답에서 빼는 규칙은 엔티티 소유 문서가 정한다. 예: 사용자 민감 컬럼 7개는 [계정과 워크스페이스 데이터 흐름](../CLE-ACCT/CLE-ACCT-DATA.md).

## 참조의 소속

참조의 소속(reference ownership)은 요청 본문이 가리키는 행의 범위를 정하는 공통 규칙이다. 클라이언트가 요청 본문으로 보내 컬럼에 저장되는 참조 id 는 요청자의 워크스페이스에 있는 행만 가리킨다. 워크플로우 안의 구조 참조는 같은 워크플로우의 행만 가리킨다. 구조 참조는 노드의 `container_id`·`tool_owner_id`, 연결선 끝점, 캔버스 저장이 새 노드로 싣는 노드 `id` 다.

서버는 이 규칙을 어긴 요청을 저장 전에 거부한다. 실행 경로나 조회 경로가 워크스페이스로 거르는지에 기대지 않는다. 실행 엔진은 워크플로우를 id 로만 읽기 때문이다.

| 요청 본문 필드 | 가리키는 행 | 범위 |
| --- | --- | --- |
| 트리거 생성 `workflowId` · 스케줄 생성 `workflowId`(연결 트리거의 `workflow_id` 가 된다) · 알림 규칙 생성 `workflowId` | Workflow | 워크스페이스 |
| 워크플로우 생성·수정 `folderId` · 폴더 생성·수정 `parentId` | Folder | 워크스페이스 |
| 트리거 생성·수정 `authConfigId` | AuthConfig | 워크스페이스 |
| 어시스턴트 세션 생성·수정 `llmConfigId` · 지식 저장소 생성·수정 `embeddingModelConfigId`·`extractionLlmConfigId`·`rerankConfigId`·`rerankLlmConfigId` | ModelConfig(필드마다 정한 `kind`) | 워크스페이스 |
| 노드 생성·수정 `containerId`·`toolOwnerId` · 연결선 생성 `sourceNodeId`·`targetNodeId` | Node | 같은 워크플로우 |
| 캔버스 저장 `nodes[].containerId`·`nodes[].toolOwnerId`·`edges[].sourceNodeId`·`edges[].targetNodeId` | Node | **이번 페이로드의 노드**. 저장 뒤 워크플로우의 노드가 정확히 그 집합이다 |
| 캔버스 저장 `nodes[].id` 가운데 이 워크플로우에 없는 것 | — | 어느 행도 쓰지 않는 id(새 노드)여야 한다. 다른 행이 쓰는 id 면 거부하고 그 행을 덮어쓰지 않는다 |

거부 응답은 다음과 같다.

- 400 `VALIDATION_ERROR` 와 `details: [{ field, message, code: 'INVALID_FIELD' }]` 를 돌려준다. `details` 는 **배열**이다. 여러 항목이 각각 실패할 수 있을 때 쓰는 형태다([에러 응답과 클라이언트 처리 §`details` 의 형태](../CLE-API/CLE-API-ERROR.md#24-details-의-형태)).
- 캔버스 저장과 연결선 생성은 틀린 필드를 **전부** 싣는다. `field` 는 중첩 경로 표기(`nodes[1].id`)를 쓴다.
- 예외 1: 모델 설정 참조는 기존 검증기(`findEntity(id, workspaceId, kind)`)를 그대로 써서 404 `MODEL_CONFIG_NOT_FOUND` 다.
- 예외 2: 트리거 `authConfigId` 는 400 `AUTH_CONFIG_NOT_FOUND` 다([에러 코드 규약과 카탈로그 §트리거 인증 설정 연결](../CLE-API/CLE-API-ERRCODES.md#614-트리거-인증-설정-연결-도메인-문서-참조)).
- 없는 id 와 다른 워크스페이스의 id 를 구분하지 않는다.

현재 구현은 버전 복원 경로(`skipLegacyDataGates`)에서도 캔버스 저장의 참조 검사를 건너뛰지 않는다. 이 검사는 옛 데이터 호환 게이트가 아니라 워크스페이스 경계이기 때문이다(`workflows.service.ts`). 결정의 근거와 이 규칙 밖에 남긴 것은 [Rationale](#본문-참조-id-도-저장-전에-소속을-본다-2026-09-27) 에 있다.

## 조회 조건의 null · undefined

TypeORM 의 find 계열(`find` · `findOne` · `findBy` · `findOneBy` · `exists` · `count` 등)과 `update` · `delete` 의 where 조건에 값이 null 이나 undefined 인 키를 넣으면 예외(`TypeORMError`)다. 조건을 빼고 조회하지 않는다. 설정은 앱 루트와 eval CLI 의 DataSource 가 명시한다(`invalidWhereValuesBehavior`, `codebase/backend/src/database/typeorm-options.ts` 의 `INVALID_WHERE_VALUES_BEHAVIOR`). 그 밖의 DataSource(일회성 스크립트, e2e)는 명시하지 않고 같은 값인 라이브러리 기본값을 따른다.

- SQL 의 NULL 비교는 `IsNull()` 로 쓴다. 예: 수락되지 않은 초대는 `acceptedAt: IsNull()` 이다.
- QueryBuilder 의 `.where()` · `.andWhere()`(객체형 조건 포함)와 raw SQL 은 이 설정의 대상이 아니다. 그쪽은 파라미터 바인딩으로 값을 넘긴다. raw SQL 결과 읽기는 [raw SQL 결과 읽기 규약](../CLE-ENG/CLE-ENG-RAWQUERY.md) 이 정한다.
- 리터럴 `null` · `undefined` 를 `never` · `any` · `unknown` 으로 단언하는 캐스트(`null as never` 등)는 백엔드 프로덕션 소스(`codebase/backend/src` 의 비-spec `.ts`)에 두지 않는다. 그 캐스트는 where 의 null 을 타입 검사에서 숨긴다. 가드 `nullable-type-lie-cast` 가 이 형태 하나를 막는다. 식 전체를 단언하는 형태(`(x ?? null) as never`, `{ … } as FindOptionsWhere<…>`)는 가드가 보지 않는다.
- 영속 데이터에서 꺼낸 id 처럼 타입이 보장하지 않는 값은 실패를 분류해야 하는 자리에서 조회 전에 확인한다. 확인하지 않은 자리는 위 예외가 마지막 방어선이다. 지금 확인하는 곳은 호출 스택(`resume_call_stack`)의 frame 하나다. `workflowId` · `invokerNodeId` 가 비면 조회하지 않고 `RESUME_CHECKPOINT_MISSING` 으로 마감한다([장애 복구와 안전 종료](../CLE-EXEC/CLE-EXEC-RECOVERY.md)).

근거는 [Rationale](#where-의-null--undefined-를-예외로-막는다-2026-10-04) 에 있다.

## FK 삭제 동작

부모 행을 지울 때 자식 행이 어떻게 되는지를 부모별로 모은다. CASCADE 는 함께 지워지고, SET NULL 은 FK 만 비워지고, NO ACTION 은 참조하는 행이 있으면 부모 삭제를 거부한다.

| 부모 | CASCADE | SET NULL | NO ACTION |
| --- | --- | --- | --- |
| User | Workspace.`owner_id` · WorkspaceMember.`user_id` · WorkflowTestDataset.`owner_id` · RefreshToken.`user_id` · LoginHistory.`user_id` · AssistantSession.`user_id` · WebAuthnCredential.`user_id` | AlertRule.`created_by` · WorkspaceInvitation.`invited_by` · WorkspaceInvitation.`accepted_by` | Workflow.`created_by` · Integration.`created_by` · Execution.`executed_by` · WorkflowVersion.`created_by` · AuditLog.`user_id` · Notification.`user_id` |
| Workspace | WorkspaceMember · Workflow · Folder · Trigger · Schedule · Integration · KnowledgeBase · WorkflowTestDataset · ModelConfig · AuthConfig · AuditLog · Notification · AssistantSession · AgentMemory · LlmUsageLog · AlertRule · WorkspaceInvitation (모두 `workspace_id`) | WebhookEndpointReservation.`workspace_id` | — |
| Folder | Folder.`parent_id` | Workflow.`folder_id` | — |
| Workflow | Node · Edge · Trigger · WorkflowVersion · Execution · WorkflowTestDataset · AssistantSession · IntegrationUsageLog · AlertRule (모두 `workflow_id`) | LlmUsageLog.`workflow_id` | — |
| Node | Edge.`source_node_id` · Edge.`target_node_id` · NodeExecution.`node_id` | Node.`container_id` · Node.`tool_owner_id` | — |
| Trigger | Schedule.`trigger_id` | Execution.`trigger_id` | — |
| AuthConfig | — | Trigger.`auth_config_id` | — |
| Integration | IntegrationUsageLog.`integration_id` · `integration_oauth_state.integration_id` · `integration_expiry_dispatch.integration_id` | — | — |
| KnowledgeBase | Document · DocumentChunk · Entity · Relation (모두 `knowledge_base_id`) | — | — |
| Document | DocumentChunk.`document_id` | — | — |
| DocumentChunk | ChunkEntity.`chunk_id` | Entity.`last_seen_chunk_id` · Relation.`evidence_chunk_id` | — |
| Entity | Relation.`head_entity_id` · Relation.`tail_entity_id` · ChunkEntity.`entity_id` | — | — |
| Execution | NodeExecution.`execution_id` · ExecutionNodeLog.`execution_id` · ExecutionToken.`execution_id` | Execution.`parent_execution_id` · Execution.`re_run_of` · LlmUsageLog.`execution_id` | — |
| NodeExecution | IntegrationUsageLog.`node_execution_id` | NodeExecution.`parent_node_execution_id` · LlmUsageLog.`node_execution_id` | — |
| ModelConfig | — | KnowledgeBase.`embedding_model_config_id` · `extraction_llm_config_id` · `rerank_config_id` · `rerank_llm_config_id` · AssistantSession.`llm_config_id` · LlmUsageLog.`llm_config_id` | — |
| AssistantSession | AssistantMessage.`session_id` | — | — |

다음 사실을 함께 본다.

- **NO ACTION 여섯은 모두 사용자를 가리킨다.** 앱에는 사용자를 지우는 경로가 없다. "탈퇴" 는 워크스페이스 멤버십(`workspace_member` 행) 삭제다. 참조 행이 있는 사용자의 삭제는 지금 스키마가 거부한다. 사용자 삭제를 더하는 변경은 사용자를 가리키는 FK 전체의 처분부터 다시 정해야 한다.
- **시크릿 저장소의 `workspace_id` 에는 FK 가 없다.** 이 컬럼을 조건으로 지우는 경로는 없고, 정리는 트리거 단위 접두 삭제로 한다([트리거 관리](../CLE-TRIG/CLE-TRIG-MANAGE.md)).
- **워크스페이스 초대(`workspace_invitation`)** 는 코드 엔티티에 관계가 선언되지 않아 워크스페이스 삭제 트랜잭션이 멤버와 함께 명시적으로 지운다. DB 에는 `workspace_id` FK(CASCADE, V017)도 있다([계정과 워크스페이스 데이터 흐름](../CLE-ACCT/CLE-ACCT-DATA.md)).
- 통합 OAuth 일시 행 두 테이블의 FK 는 [통합 데이터와 흐름](../CLE-INT/CLE-INT-DATA.md) 이 정한다. 위 표의 `integration_oauth_state`·`integration_expiry_dispatch` 행은 그 문서의 매핑 표에서 옮겼다.

## 인덱스 전략

### 원칙

1. PostgreSQL 은 FK 에 인덱스를 자동으로 만들지 않는다. FK 마다 삭제 연쇄와 조회 경로를 보고 인덱스를 둘지 정한다.
2. 복합 인덱스는 선두 컬럼이 조회 조건과 맞아야 쓰인다. 선두가 다른 기존 인덱스가 있어도 그 컬럼으로 찾는 조회나 FK 삭제는 인덱스 전체를 훑거나 테이블을 훑는다.
3. FK 삭제가 부모 행마다 부르는 조회(`$1 = col`)가 쓸 수 있는 부분 인덱스는 조건이 `col IS NOT NULL` 인 것뿐이다. 다른 조건이 붙은 부분 인덱스만 있으면 인덱스가 없는 것과 같다.
4. nullable FK 컬럼의 인덱스는 `WHERE col IS NOT NULL` 부분 인덱스로 둔다. NULL 행을 빼서 인덱스를 가볍게 한다.
5. 인덱스를 둘지는 "자식 테이블 크기 × 연쇄로 지워지는 부모 행 수" 가운데 어느 쪽이 사용자 데이터로 자라는지로 가른다. 호출당 ms 문턱 하나로 자르면 규모가 바뀔 때마다 결론이 바뀐다. 기준 세부는 [Rationale](#쓸-인덱스가-없는-fk-서른하나의-처분-2026-09-18) 에 있다.
6. 운영 테이블에 인덱스를 더할 때는 `CREATE INDEX CONCURRENTLY` 를 쓴다. `CONCURRENTLY` 와 `ALTER` 는 한 마이그레이션에 함께 둘 수 없어 파일을 나눈다([DB 마이그레이션 규약](../CLE-ENG/CLE-ENG-MIGRATION.md)).

### 벡터 인덱스

pgvector 인덱스는 차원별로 나눈 부분 인덱스다. 임베딩 차원이 다른 행은 각자의 인덱스에 맞춰진다. 두 벡터 테이블이 같은 방식을 쓴다.

| 테이블 | 인덱스 | 마이그레이션 |
| --- | --- | --- |
| DocumentChunk (지식 저장소 검색) | 차원별 부분 HNSW — 768(V022)·3072 halfvec(V023)·384(V030)·1536(V031)·512(V032)·1024(V033) | V022·V023·V030~V033 |
| AgentMemory (에이전트 메모리 회수) | 차원별 부분 HNSW — 384(V074)·512(V075)·768(V076)·1024(V077)·1536(V078)·3072 halfvec(V079) | V074~V079 |

IVFFlat 인덱스는 두 테이블 모두 쓰지 않는다. 인덱스 정의 상세는 [지식 저장소 데이터와 흐름](../CLE-KB/CLE-KB-DATA.md) 과 [에이전트 메모리](../CLE-AI/CLE-AI-MEMORY.md) 에 있다. 차원과 임베딩 모델의 관계는 [문서 임베딩](../CLE-KB/CLE-KB-EMBED.md) 과 [에이전트 메모리](../CLE-AI/CLE-AI-MEMORY.md) 가 정한다.

### 인덱스 목록

영역별로 나눈다. "근거" 열의 CONCURRENTLY 는 운영 중 무중단 생성이고, 뒤의 번호는 그 인덱스를 만든 마이그레이션이다.

**계정과 워크스페이스**

| 테이블 | 인덱스 | 목적과 근거 |
| --- | --- | --- |
| Workspace | `(owner_id)` UNIQUE WHERE `type = 'personal'` | 개인 워크스페이스는 소유자당 1개다. DB 가 강제하고 앱(find-or-create)이 이중으로 막는다. 팀 워크스페이스는 한 사용자가 여럿 가질 수 있어 부분 UNIQUE 다([계정과 워크스페이스 데이터 흐름](../CLE-ACCT/CLE-ACCT-DATA.md)). CONCURRENTLY, V109 |
| WorkspaceMember | `(user_id)` | 사용자별 워크스페이스 목록(`GET /workspaces`). UNIQUE `(workspace_id, user_id)` 는 선두가 달라 테이블을 훑었다. FK `ON DELETE CASCADE` 도 이 인덱스를 쓴다. CONCURRENTLY, V129 |
| RefreshToken | `(user_id, family_id)` WHERE `is_revoked = false` | 사용자별 활성 로그인 세션 조회 |
| LoginHistory | `(user_id, created_at DESC)` | 사용자별 로그인 이력 조회. V040 |
| LoginHistory | `(email, created_at DESC)` | 가입하지 않은 이메일의 로그인 시도 추적. V040 |
| LoginHistory | `(created_at)` | 보존 배치의 `created_at < cutoff` 스캔 전용. V040 |
| WebAuthnCredential | `(user_id)` | 사용자별 등록 인증기 목록 |
| WebAuthnCredential | `(credential_id)` UNIQUE | 인증할 때 `credential_id` 로 행을 찾는다(WebAuthn 표준 요구) |

**워크플로우**

| 테이블 | 인덱스 | 목적과 근거 |
| --- | --- | --- |
| Workflow | `(workspace_id, is_active)` | 워크스페이스별 활성 워크플로우 조회 |
| Workflow | `(workspace_id, name)` | 이름 검색 |
| Workflow | `(folder_id)` WHERE `folder_id IS NOT NULL` | FK `ON DELETE SET NULL`. 폴더 삭제에서 지워지는 하위 폴더마다 찾는다. 폴더 밖 워크플로우(NULL)는 뺀다. CONCURRENTLY, V123 |
| Folder | `(workspace_id, parent_id)` | 워크스페이스별 폴더 조회 |
| Folder | `(parent_id)` WHERE `parent_id IS NOT NULL` | FK `ON DELETE CASCADE`. 폴더 삭제의 하위 폴더마다 찾는다. `(workspace_id, parent_id)` 는 선두가 달라 인덱스 전체를 훑었다. 루트 폴더(NULL)는 뺀다. CONCURRENTLY, V124 |
| Node | `(workflow_id)` | 워크플로우별 노드 조회 |
| Node | `(container_id)` | 컨테이너별 자식 노드 조회 |
| Node | `(tool_owner_id)` | AI 에이전트별 도구 영역 노드 조회. 도구 영역(Tool Area)은 제거된 기능이다([워크플로우 데이터와 저장 흐름](../CLE-WF/CLE-WF-DATA.md)) |
| Edge | `(workflow_id)` | 워크플로우별 연결선 조회 |
| Edge | `(workflow_id, type)` | 워크플로우별 연결선 유형 조회 |
| Edge | `(source_node_id)` | 노드별 나가는 연결선 |
| Edge | `(target_node_id)` | FK `ON DELETE CASCADE`. 캔버스 저장이나 워크플로우 삭제로 노드가 지워질 때마다 찾는다. UNIQUE `(source_node_id, source_port, target_node_id, target_port)` 는 선두가 달라 쓰이지 않는다. CONCURRENTLY, V121 |

**실행**

| 테이블 | 인덱스 | 목적과 근거 |
| --- | --- | --- |
| Execution | `(workflow_id, started_at DESC)` | 워크플로우별 실행 내역 |
| Execution | `(status)` | 상태별 실행 조회 |
| Execution | `(re_run_of)` | 재실행의 직계 부모 조회(체인 배지의 부모 표시) |
| Execution | `(chain_id, started_at)` | 재실행 체인 전체 조회(`GET /api/executions/:id/chain`, [재실행](../CLE-EXEC/CLE-EXEC-RERUN.md)) |
| Execution | `(trigger_id, started_at DESC)` WHERE `trigger_id IS NOT NULL` | 인증 설정 사용 내역(`GET /api/auth-configs/:id/usage`, [외부 호출 인증 설정](../CLE-TRIG/CLE-TRIG-AUTHCFG.md))의 `trigger_id IN (...)` + `started_at` 집계(totalCalls·periodCounts·recentCalls) 가속. 인덱스 이름 `idx_execution_trigger_started`. 스케줄·수동 실행(`trigger_id` NULL)을 빼서 가볍게 한다. V096 |
| NodeExecution | `(execution_id)` | 실행별 노드 실행 조회 |
| NodeExecution | `(execution_id, status)` WHERE `status IN ('waiting_for_input','running')` | 끝나지 않은 노드 실행의 조회와 전이. rehydration `resolveWaitingNodeExecutionId` 와 running 조회·UPDATE 가 핫 경로다. 끝난 행은 아래 `(execution_id, node_id, started_at DESC)` 가 덮으므로 활성 행만 인덱싱해 크기와 쓰기 증폭을 줄인다. CONCURRENTLY, V095 |
| NodeExecution | `(execution_id, node_id, started_at DESC)` | 실행·노드별 최신 노드 실행 조회(rehydration `DISTINCT ON`, `findOne ... ORDER BY started_at DESC`). CONCURRENTLY, V034 |
| NodeExecution | `(parent_node_execution_id)` WHERE `parent_node_execution_id IS NOT NULL` | 부모 노드 실행별 자식 조회(서브 워크플로우·Background·Parallel 노드의 자식). V012 |
| NodeExecution | `(parent_node_execution_id, started_at, id)` WHERE `parent_node_execution_id IS NOT NULL` | 부모별 자식 시간순 조회(`ORDER BY started_at ASC, id ASC`). CONCURRENTLY, V048 |
| NodeExecution | `((output_data #>> '{meta,backgroundRunId}'))` WHERE … IS NOT NULL | Background 노드 모니터링 API 의 `backgroundRunId` 단일 행 조회(부분 식 인덱스). CONCURRENTLY, V047 |
| NodeExecution | `(node_id)` | FK `ON DELETE CASCADE` 의 자식 조회. 캔버스 저장이 노드를 뺄 때(저장마다)와 워크플로우 삭제에서 쓴다. 기존 `(execution_id, node_id, started_at DESC)` 는 선두가 달라 쓰이지 않는다. CONCURRENTLY, V112 |
| ExecutionNodeLog | `(execution_id, id)` | 한 실행의 노드 진행 순서 조회 |

실행 영역 FK 인덱스를 둔 근거는 [실행 데이터와 흐름](../CLE-EXEC/CLE-EXEC-DATA.md) 의 Rationale 에 있다.

**트리거와 인증 설정**

| 테이블 | 인덱스 | 목적과 근거 |
| --- | --- | --- |
| Trigger | `(workspace_id, type)` | 유형별 트리거 조회 |
| Trigger | `(endpoint_path)` UNIQUE WHERE `endpoint_path IS NOT NULL` | 웹훅 URL 라우팅. 라우팅 키(`/api/hooks/:endpointPath`)가 워크스페이스와 무관한 전역 키라 유일성도 전역이다. 수신·공개 가드·웹채팅 embed-config 가 이 컬럼 하나로 찾는다. V002 의 `(workspace_id, endpoint_path)` UNIQUE 를 교체했다(V131 중복 정리, V132 CONCURRENTLY). 근거는 [트리거 데이터와 흐름](../CLE-TRIG/CLE-TRIG-DATA.md) |
| Trigger | `(workflow_id)` | 워크플로우 삭제 경로. 트리거 자원 정리의 열거 두 번(`WHERE workflow_id = ?`, 하나는 `workflow` 행 잠금 안)과 FK `ON DELETE CASCADE` 가 쓴다. 이 셋 말고 `workflow_id` 로 트리거를 찾는 곳은 없다. CONCURRENTLY, V111 |
| Trigger | `(notification_health)` WHERE `notification_health = 'degraded'` | EIA 알림 웹훅 발송이 degraded 인 트리거를 대시보드와 운영 알림에서 전체 스캔 없이 찾는다(부분 인덱스). V061 |
| Trigger | `(auth_config_id)` WHERE `auth_config_id IS NOT NULL` | 인증 설정 사용처(`GET /api/auth-configs/:id/usage`)가 이 컬럼 하나로 트리거를 찾는다. 이어서 위 Execution `(trigger_id, started_at DESC)` 를 쓴다. FK `ON DELETE SET NULL`(인증 설정 삭제)도 이 인덱스를 쓴다. CONCURRENTLY, V126 |
| WebhookEndpointReservation | `(endpoint_path)` PK | 웹훅 경로 예약. 같은 새 경로를 동시에 잡는 두 요청을 가르고, 예약 트리거가 주인을 찾는다. V133 |
| WebhookEndpointReservation | `(workspace_id)` WHERE `workspace_id IS NOT NULL` | FK `ON DELETE SET NULL`. 워크스페이스 삭제가 예약을 훑지 않게 한다. 주인 없는 예약은 다시 찾을 일이 없어 부분 인덱스다. V133 |
| AuthConfig | `(workspace_id)` | 워크스페이스별 인증 설정 목록과 트리거 편집의 선택 상자. FK `ON DELETE CASCADE` 도 쓴다. CONCURRENTLY, V127 |
| Schedule | `(workspace_id, next_run_at)` | 스케줄 목록 조회. `WHERE workspace_id = ?` 진입과 `ORDER BY next_run_at` 정렬을 한 인덱스가 함께 준다. 선두가 `workspace_id` 라 다른 정렬 컬럼에서도 진입을 준다. 발사 경로가 아니다. 발사는 BullMQ 반복 작업이 한다([트리거 데이터와 흐름](../CLE-TRIG/CLE-TRIG-DATA.md)). 종전 `(next_run_at, is_active) WHERE is_active` 를 대체했다. CONCURRENTLY, V110 |
| Schedule | `(trigger_id)` | 트리거 목록의 cron·다음 실행 시각 배치 조회(`WHERE trigger_id IN (...)`). CONCURRENTLY, V106 |

**통합**

| 테이블 | 인덱스 | 목적과 근거 |
| --- | --- | --- |
| Integration | `(workspace_id, service_type)` | 서비스별 통합 조회 |
| Integration | `(workspace_id, name)` UNIQUE | 워크스페이스 안 별칭 유일성 |
| Integration | `(workspace_id, status)` | 만료·에러 상태 배지 수 세기, `pending_install` TTL 스캐너 조회, 중복 방지 조회 겸용([통합 상태와 만료 알림](../CLE-INT/CLE-INT-STATUS.md)) |
| Integration | `(install_token)` UNIQUE WHERE `install_token IS NOT NULL` | Cafe24 Private App URL(`/3rd-party/cafe24/install/:installToken`)과 MakeShop ShopStore 설치 우선 App URL 의 단일 행 식별. `pending_install` 상태에서 쓴다. NULL 을 저장하지 않는 부분 인덱스로 크기를 줄인다. V043 |
| Integration | `(workspace_id, service_type, mall_id)` UNIQUE WHERE `mall_id IS NOT NULL` | 상점 식별자 중복 방지(`idx_integration_workspace_service_mall`). 서비스 종류와 무관해 새 통합은 인덱스를 더할 필요가 없다. 한 워크스페이스 안에서 같은 `(service_type, mall_id)` 통합은 최대 1행이다(Cafe24 는 `mall_id`, MakeShop 은 `shop_uid` 투영, Public 과 Private 동시 보유 불가). 서비스가 다르면 같은 `mall_id` 값이어도 정상이다. 옛 서비스별 UNIQUE(V046 Cafe24, V071 MakeShop)를 합쳤다. V072(V045 컬럼 추가와 분리. `CONCURRENTLY` 와 `ALTER` 는 한 마이그레이션에 둘 수 없다) |
| Integration | `(service_type, mall_id)` WHERE `mall_id IS NOT NULL` | `mall_id` 조회(`idx_integration_service_mall`). Cafe24 `tryRecoverByMallId` 같은 회복 검색을 모든 서비스로 넓혔다. 옛 Cafe24 전용 조회 인덱스(V051 `idx_integration_cafe24_mall_id_partial`)를 합쳤다. 서비스 종류와 무관해 새 통합은 인덱스를 더할 필요가 없다. V072 |
| Integration | `(token_expires_at)` | 만료 스캐너 배치 조회 |
| IntegrationUsageLog | `(integration_id, at DESC)` | 통합별 최근 호출 내역 |
| IntegrationUsageLog | `(at)` | 보존 기간이 지난 행을 지우는 배치 |
| IntegrationUsageLog | `(node_execution_id)` | FK `ON DELETE CASCADE`. 노드 실행 행이 지워질 때마다(캔버스 노드 삭제, 워크플로우 삭제) 찾는다. CONCURRENTLY, V113 |
| IntegrationUsageLog | `(workflow_id)` | FK `ON DELETE CASCADE`. 워크플로우 삭제. CONCURRENTLY, V114 |

**지식 저장소**

| 테이블 | 인덱스 | 목적과 근거 |
| --- | --- | --- |
| KnowledgeBase | `(workspace_id)` | 워크스페이스별 지식 저장소 목록·선택 상자·어시스턴트 도구 `list_knowledge_bases`. FK `ON DELETE CASCADE` 도 쓴다. CONCURRENTLY, V128 |
| Entity | `(last_seen_chunk_id)` WHERE `last_seen_chunk_id IS NOT NULL` | FK `ON DELETE SET NULL`. 청크가 지워질 때마다(재임베딩, 문서 삭제, 지식 저장소 삭제) 찾는다. 다른 인덱스는 모두 `knowledge_base_id` 가 선두라 쓰이지 않는다. CONCURRENTLY, V117 |
| Relation | `(evidence_chunk_id)` WHERE `evidence_chunk_id IS NOT NULL` | 위와 같다. CONCURRENTLY, V118 |
| Relation | `(head_entity_id)` | FK `ON DELETE CASCADE`. Entity 가 지워질 때마다(Entity 삭제, 지식 저장소 삭제) 찾는다. `(knowledge_base_id, head_entity_id)` 는 PostgreSQL 18 skip scan 으로 쓰이지만 비용이 지식 저장소 수에 비례한다. CONCURRENTLY, V119 |
| Relation | `(tail_entity_id)` | 위와 같다(tail). CONCURRENTLY, V120 |

지식 저장소 삭제 연쇄 인덱스의 근거는 [지식 저장소 데이터와 흐름](../CLE-KB/CLE-KB-DATA.md) 에 있다.

**AI 모델·메모리·어시스턴트**

| 테이블 | 인덱스 | 목적과 근거 |
| --- | --- | --- |
| ModelConfig | `(workspace_id, kind)` | 워크스페이스·종류별 모델 설정 목록과 모델 선택 상자. `(workspace_id, kind) WHERE is_default = true` UNIQUE(V089)는 부분 인덱스라 `is_default` 조건 없는 목록 조회와 FK `ON DELETE CASCADE` 가 쓰지 못했다. CONCURRENTLY, V130 |
| LlmUsageLog | `(workspace_id, created_at DESC)` | 워크스페이스별 LLM 사용량 조회. V014 |
| LlmUsageLog | `(provider, model, created_at DESC)` | 프로바이더×모델별 집계(통계 요약). V014 |
| LlmUsageLog | `(workflow_id, created_at DESC)` WHERE `workflow_id IS NOT NULL` | 워크플로우별 비용 집계. 노드 밖·워크플로우 밖 호출(NULL)을 뺀다. V014 |
| LlmUsageLog | `(node_execution_id)` WHERE `node_execution_id IS NOT NULL` | FK `ON DELETE SET NULL`. 노드 실행 행이 지워질 때마다 찾는다. 노드 밖 호출(NULL)을 뺀다. CONCURRENTLY, V115 |
| LlmUsageLog | `(execution_id)` WHERE `execution_id IS NOT NULL` | FK `ON DELETE SET NULL`. 실행 행이 지워질 때마다(워크플로우 삭제) 찾는다. CONCURRENTLY, V116 |
| LlmUsageLog | `(llm_config_id)` WHERE `llm_config_id IS NOT NULL` | FK `ON DELETE SET NULL`. 모델 설정 삭제. 설정 없이 부른 호출(NULL)을 뺀다. CONCURRENTLY, V122 |
| AgentMemory | `(workspace_id, scope_key, created_at)` | 메모리 범위별 회수와 FIFO/LRU 정리 조회. `created_at` 을 넣어 정리 정렬까지 인덱스가 덮는다. 워크스페이스 격리를 강제한다. V073 |
| AgentMemory | `(workspace_id, scope_key, updated_at)` | 관리 화면 범위 목록(`GET /agent-memories/scopes`)의 `MAX(updated_at)` 정렬을 index-only 로 덮는다. `created_at` 인덱스와 직교한다. CONCURRENTLY, V086 |
| AgentMemory | 차원별 부분 HNSW `(embedding)` | pgvector 유사도 회수. DocumentChunk 와 같은 차원별 부분 인덱스 정책이다([에이전트 메모리](../CLE-AI/CLE-AI-MEMORY.md)) |
| AgentMemory | 부분 `(expires_at)` WHERE `expires_at IS NOT NULL` | TTL 만료 정리 스캔 가속. 만료 없는(NULL) 행을 빼서 가볍게 한다. V080 |
| AssistantSession | `(workflow_id, user_id, status, last_interaction_at DESC)` | 워크플로우별 최근 활성 세션 조회 |
| AssistantSession | `(workspace_id, user_id, updated_at DESC)` | 사용자별 세션 목록 |
| AssistantSession | `(llm_config_id)` WHERE `llm_config_id IS NOT NULL` | FK `ON DELETE SET NULL`. 모델 설정 삭제. 세션은 대화마다 생기고 자동 정리가 없어 사용량으로 자란다. CONCURRENTLY, V125 |
| AssistantMessage | `(session_id, created_at ASC)` | 세션 안 메시지 시간순 페이지 조회 |

**관측**

| 테이블 | 인덱스 | 목적과 근거 |
| --- | --- | --- |
| AuditLog | `(workspace_id, created_at DESC)` | 감사 로그 조회 |
| Notification | `(user_id, is_read, created_at DESC)` WHERE `dismissed_at IS NULL` | 사용자별 보이는 안 읽은 알림 조회(벨 배지와 팝오버). 닫은 알림을 인덱스에서 빼서 크기를 작게 유지한다. 수명주기는 [알림](../CLE-OBS/CLE-OBS-NOTIFY.md) |
| Notification | `(workspace_id, created_at DESC)` | 워크스페이스별 알림 조회. 부분 인덱스로 두지 않았다. 나중에 관리·감사 조회가 닫은 알림까지 볼 여지가 있다 |

## 구현 위치

- `codebase/backend/src/modules/**/entities/*.entity.ts`
- `codebase/backend/migrations/V*.sql`
- `codebase/backend/src/database/typeorm-options.ts`, `codebase/backend/src/modules/knowledge-base/eval/eval-cli.module.ts` (조회 조건의 null · undefined 를 예외로)
- 이 문서의 사실을 지키는 전용 e2e:
  - `codebase/backend/test/deletion-cascade-indexes.e2e-spec.ts` (FK 인덱스)
  - `codebase/backend/test/trigger-endpoint-path-dedupe.e2e-spec.ts` (웹훅 경로 중복 정리 V131)
  - `codebase/backend/test/entity-schema-declarations.e2e-spec.ts` (엔티티 선언과 DB 대조)
  - `codebase/backend/test/webhook-endpoint-reservation.e2e-spec.ts` (웹훅 경로 예약 V133)
- 조회 조건 규칙을 지키는 가드: `codebase/backend/src/repo-guards/__tests__/nullable-type-lie-cast*.ts`, `codebase/backend/src/common/__test-utils__/source-scan.ts` (`countNullishEscapeCasts`, nullish 를 타입 밖으로 빼는 캐스트)

## Rationale

### where 의 null · undefined 를 예외로 막는다 (2026-10-04)

TypeORM 0.3 은 where 의 null · undefined 키를 조용히 빼고 조회했다. 그래서 `{ id, workspaceId }` 의 `workspaceId` 가 undefined 면 워크스페이스 조건 없이 조회돼 범위가 넓어졌다. [참조의 소속](#참조의-소속) 이 저장 때 막는 것과 같은 종류의 경계 침범이 조회 조건에서도 값 하나로 생기는 구조다. 이것은 읽는 쪽 조건을 방어선으로 삼는다는 뜻이 아니다. 경계는 여전히 저장 때 지키고, 조회 조건은 그 경계를 넓히지 않아야 한다는 뜻이다. TypeORM 1 은 이 경우를 예외로 막는 것이 기본값이고, 1.x 상향(NERV Task `CLE-T-91JNWW`)에서 그 기본값을 따르기로 했다(사람 결정). 앱 루트와 eval CLI 에는 같은 값을 명시해 라이브러리 기본값이 바뀌어도 동작이 그대로이게 했다.

0.3 동작(조건을 빼고 조회)으로 되돌리지 않은 이유는 그 동작이 실제 결함을 숨기고 있었기 때문이다. 상향하며 where 를 전수 감사했는데 초대 서비스 세 곳이 `acceptedAt: null as never` 로 "수락되지 않은 초대" 를 고르고 있었다. 0.3 은 그 조건을 빼서 수락된 초대까지 다뤘고 타입 검사는 캐스트 때문에 몰랐다. e2e 에서 초대가 500 으로 실패하며 드러났다. 세 곳은 `IsNull()` 로 고쳤고 형태는 가드가 막는다.

타입이 `string` 이어도 런타임에 비는 값(영속 데이터에서 꺼낸 id 등)은 정적으로 가려낼 수 없다. DataSource 옵션 파일과 단위 가드를 구현 위치에 넣은 것은 그 둘이 이 규칙의 시행 지점이라서다. 풀 설정 변경도 이 문서와 대조되는 비용은 받아들인다. 그런 자리에서 예외는 조회 범위가 넓어지는 대신 실패로 드러나는 쪽이다. 실행 재개의 call-stack frame 은 일반 예외 대신 체크포인트 결손으로 분류하도록 조회 전에 확인한다(NERV Task `CLE-T-BV4YXZ`).

### 본문 참조 id 도 저장 전에 소속을 본다 (2026-09-27)

워크스페이스 가드(헤더·토큰·경로 파라미터)는 요청이 어느 워크스페이스에서 도는지를 본다([워크스페이스와 멤버 §API 인가](../CLE-ACCT/CLE-ACCT-WS.md#api-인가)). 요청 본문이 다른 행을 가리키는 id 는 가드가 보지 않는다. 그 id 는 서비스가 저장할 때 봐야 한다. 2026-09-27 에 쓰기 요청 본문의 참조 id 를 전수 조사했다(소스 판독). 그 결과 10개 묶음(요청·필드)이 그 id 를 그대로 저장했다. 이미 검사하던 대조군은 트리거 `authConfigId`, 폴더 수정 `parentId`, 지식 저장소 `embeddingModelConfigId` 등 8자리였다. 규칙은 [참조의 소속](#참조의-소속) 이 정한다.

고치기 전 e2e 가 두 결함을 재현했다. A 는 요청자, B 는 다른 워크스페이스다.

- A 가 B 의 워크플로우로 웹훅 트리거를 만들면 201 이었다. 그 웹훅을 부르면 202 로 **B 의 워크플로우가 실행**됐다. 실행 엔진은 워크플로우를 id 로만 읽으므로 실행의 워크스페이스와 자격 증명이 그 워크플로우 쪽 것이었다. A 의 트리거 목록에도 B 의 워크플로우가 실렸다.
- A 가 캔버스 저장에 B 의 노드 id 를 실으면 200 이었고 **B 의 노드 행이 A 로 옮겨졌다**. 저장은 자기 워크플로우에 없는 id 를 새 노드로 보고 `save` 한다. TypeORM `save` 는 id 로만 행을 찾아 행이 있으면 UPDATE 한다.

나머지는 끊긴 참조로 남았다. 소스 판독으로 본 부수 영향은 둘이고 둘 다 재지 않았다. 하나는 FK `ON DELETE` 때문에 상대가 행을 지우면 이쪽 행이 비워지는 것이다. 폴더 `parent_id` 는 CASCADE 라서 이쪽 폴더가 함께 지워진다. 다른 하나는 연결선 UNIQUE 에 `workflow_id` 가 없어 남의 연결 튜플을 선점할 수 있는 것이다.

- **왜 저장 시점인가**: 모델 설정 `findEntity(id, workspaceId, kind)` 처럼 읽는 쪽이 거르는 자리도 있다. 그러나 실행 엔진은 거르지 않는다. 읽는 자리마다 필터를 기대하는 것은 [워크스페이스와 멤버](../CLE-ACCT/CLE-ACCT-WS.md#멤버십-검증은-가드-한-곳에서-roles-와-상관없이-한다) 의 "멤버십 검증은 가드 한 곳에서" 결정이 "74번째 라우트" 문제로 기각한 모양 그대로다. 저장이 입구 하나다. 현재 구현은 서비스마다 검사 헬퍼(`assertReferenceInScope` 등)를 부른다. 새 쓰기 경로가 검사를 빠뜨리는 것을 막는 정적 가드는 없다.
- **에러**: 400 `VALIDATION_ERROR` 와 `details[]` 배열이다. 파이프가 내는 `VALIDATION_ERROR` 와 같은 모양이다. 캔버스 저장처럼 한 요청에서 여러 항목이 틀릴 수 있어 배열로 싣는다. 본문의 교차 참조는 리소스 부재가 아니라 입력값 유효성 문제로 본다. [에러 코드 규약과 카탈로그 §트리거 인증 설정 연결](../CLE-API/CLE-API-ERRCODES.md#614-트리거-인증-설정-연결-도메인-문서-참조) 의 판단을 따른 것이다. 그 절의 `AUTH_CONFIG_NOT_FOUND` 는 top-level 이 도메인 코드인 **예외**다. `details[].code` 를 싣는 다른 자리는 대부분 `VALIDATION_ERROR` 라서 새 자리는 다수를 따른다. 없는 id 와 다른 워크스페이스의 id 를 구분하지 않는다.
- **모델 설정 참조만 404**: 지식 저장소 `embeddingModelConfigId` 는 이미 `findEntity` 로 404 `MODEL_CONFIG_NOT_FOUND` 를 낸다. 같은 요청의 `rerankConfigId` 등이 400 이면 한 본문 안에서 필드마다 코드가 갈린다. 그래서 같은 검증기를 다시 쓴다.
- **캔버스 저장의 노드 id 는 존재 신호를 준다**: 새 id 는 통과하고 이미 쓰이는 id 는 거부하므로 "있다·없다" 가 갈린다. 이 신호는 그 UUID 를 이미 가진 사람에게만 뜻이 있다. v4 UUID 라 추측할 수 없다. 대안이었던 "충돌한 id 를 서버가 조용히 새로 발급" 은 택하지 않았다. 같은 페이로드의 `containerId`·연결선이 가리키는 id 와 클라이언트가 가진 id 가 어긋나기 때문이다.
- **실행 시점 격리와는 다른 층이다**: 서브 워크플로우 호출의 `WORKFLOW_FORBIDDEN_WORKSPACE`([워크플로우 호출 노드](../CLE-NODE-FLOW/CLE-NODE-SUBWF.md))는 **실행 중** 노드 설정이 가리키는 워크플로우를 막는다. 이 규칙은 **저장 시점**의 요청 본문을 본다.
- **남긴 것**: 트리거 `config` JSONB 안의 비밀 참조(`secret://…`, id 가 아닌 문자열)는 이 결정 밖이다. 저장 경계는 [시크릿 저장소](../CLE-INT/CLE-INT-SECRET.md) 규칙 23 이 정한다(2026-10-04). 요청 본문이 그 참조를 싣지 못한다. 그 거부 응답은 단일 object 로 이 절의 배열 규칙과 다르다([트리거 관리 「PATCH 본문 계약」](../CLE-TRIG/CLE-TRIG-MANAGE.md#patch-본문-계약)). 이미 저장된 행의 비밀 참조는 [시크릿 저장소](../CLE-INT/CLE-INT-SECRET.md) 규칙 24 · 25 와 「교차 행 점검과 정리」 가 다룬다(2026-10-04). 이미 저장된 교차 행의 id 참조(트리거 · 스케줄의 워크플로우 등)에 대한 실행 시점 방어선과 그 운영 데이터 점검은 이 결정 밖이고 NERV Task `CLE-T-XYR067` 로 추적한다.

근거·실측: 옛 plan `cross-workspace-refs.md`(git 이력), e2e `codebase/backend/test/cross-workspace-references.e2e-spec.ts`(고치기 전 코드에서 거부를 기대한 18케이스가 모두 실패했다).

### 전용 e2e 가드를 구현 위치에 나열한 이유 (2026-09-19)

이 문서의 사실을 기계적으로 지키는 e2e 를 구현 위치에 넣었다(사용자 결정). `deletion-cascade-indexes` 는 FK 인덱스를, `trigger-endpoint-path-dedupe` 는 웹훅 경로 중복 정리(V131)를, `entity-schema-declarations` 는 엔티티 선언과 DB 를 지킨다. 인덱스와 제약은 선언에서 DB 한 방향으로, 컬럼 정의는 양방향으로 본다. `webhook-endpoint-reservation` 은 웹훅 경로 예약(V133 백필과 DB 트리거)을 지킨다([트리거 데이터와 흐름](../CLE-TRIG/CLE-TRIG-DATA.md) «지우거나 바꾼 웹훅 경로를 영구 예약하는 결정»). 구현 위치에 넣은 목적은 이 파일을 고치는 변경도 이 문서와 대조하는 것이다. 가드를 약하게 고치는 변경이 코드 리뷰만 거치고 지나가지 않게 하려는 것이다.

2026-10-03 에 대조 경로를 고쳐 적었다. 처음에는 push 리뷰 가드가 이 대조를 강제했다(구현 위치에 걸린 파일을 고치면 구현 완료 검토를 요구했다). 그 가드는 NERV 정본 전환 단계 2(NERV Task `CLE-T-4ABTG7`)에서 없어졌다. 지금은 일관성 검토의 `--impl-done` 을 돌리면 구현 위치가 바뀐 파일을 덮는 문서가 검토 대상에 든다(NERV Task `CLE-T-VP5KDJ`). 이 실행을 강제하는 것은 없다. NERV done 게이트는 Task 에 묶인 consistency 라운드가 있고 통과했는지만 보고 그 라운드가 이 문서를 대상으로 했는지는 보지 않는다.

- **넣지 않은 것**: 자기 기능의 인덱스나 컬럼을 곁들여 확인하는 기능 e2e(`background-monitoring`, `notifications-dismiss`, `terminal-duration-sql`, `webhook-trigger`). 넣으면 그 기능 e2e 를 고친 모든 작업의 구현 완료 검토가 이 문서를 대상으로 끌어들여, 이 문서가 무관한 기능 변경의 관문이 된다. 당시 백엔드 e2e 58개 가운데 어떤 스펙의 구현 위치에 걸린 것은 7개라, 기능 e2e 를 넣지 않는 쪽이 이 저장소의 정상이다.
- **glob 이 아니라 나열한 이유**: 이 넷은 이름으로 묶을 공통 접두가 없고, 새 전용 가드는 드물게 생긴다. 그 가드를 만드는 변경이 여기에 더한다.

근거: 옛 plan `spec-draft-code-guards-and-change-summary.md`(git 이력).

### 모든 FK 행에 삭제 동작을 적는 이유 (2026-09-19)

엔티티 표의 FK 행은 삭제 동작을 적기도 하고 안 적기도 했다. 실제 DB(V001~V132)와 전수 대조하니 FK 75행 중 틀린 곳은 0, 적은 곳 26, 안 적은 곳 49 였다. 49행 모두에 적었다. 적은 행과 안 적은 행의 구분은 우연이었고, 한 행만 채우면 그 구분에 뜻이 있는 것처럼 읽힌다.

- **표기**: 적은 26행의 다수형인 짧은 형 `(CASCADE)` 를 따른다. 이미 괄호가 있으면 괄호 맨 앞에 동작을 넣는다. 이미 다른 표기로 적은 행(`(ON DELETE CASCADE)`, `(cascade 삭제)` 등)은 사실이 맞아 그대로 두었다.
- **같은 대조가 찾은 것**: 엔티티 표에 없던 컬럼 여섯(FK 둘 포함, DB 컬럼 424개 중), FK 표기의 테이블명 오류 하나(`re_run_of`), `parent_node_execution_id` 인덱스 목적 서술의 오류(Loop 는 이 값을 찍지 않는다). 엔티티 표가 DB 에 없는 컬럼을 적은 곳은 0 이었다.
- **대조하지 않은 것**: 엔티티 표 밖(데이터 흐름 문서 등)의 FK 서술, 엔티티 표의 값 목록(enum·마커) 전체.

NO ACTION 여섯이 모두 사용자를 가리킨다는 사실은 아래 절이 적은 사용자 참조 FK 의 처분과 같다.

근거·실측: 옛 plan `spec-draft-data-model-fk-actions.md`(git 이력).

### 쓸 인덱스가 없는 FK 서른하나의 처분 (2026-09-18)

앞선 두 조사([실행 데이터와 흐름](../CLE-EXEC/CLE-EXEC-DATA.md) 의 «삭제 연쇄의 FK 인덱스 다섯», [지식 저장소 데이터와 흐름](../CLE-KB/CLE-KB-DATA.md) 의 «그래프 RAG 삭제 연쇄의 FK 인덱스 넷»)가 닫고 남긴 FK 28개와 그 셈이 놓친 셋을 모두 처분했다. 인덱스 열은 V121~V130 으로 만들고, 스물하나는 대상에서 뺐다.

**셈법 보정.** 앞선 조사의 «37개» 는 `pg_index.indkey[0]` 만 대조해 부분 인덱스도 «있음» 으로 셌다. FK 트리거 조회(`$1 = col`)가 쓸 수 있는 부분 인덱스는 조건이 `col IS NOT NULL` 인 것뿐이다. 그래서 다른 조건이 붙은 부분 인덱스만 가진 셋(`model_config.workspace_id` 의 `WHERE is_default = true`, `workspace.owner_id` 의 `WHERE type = 'personal'`, `notification.user_id` 의 `WHERE dismissed_at IS NULL`)은 «없음» 과 같다. 보정한 전수는 40, 남은 것은 31 이었다.

| 부모 | 앱의 삭제 경로 | 빈도 |
| --- | --- | --- |
| `node` | 캔버스 저장이 제출 목록에 없는 노드를 지운다. 워크플로우·워크스페이스 삭제의 연쇄 | 캔버스 저장마다 |
| `folder` | 폴더 삭제. 하위 폴더는 `parent_id` CASCADE 로 연쇄 | 관리 동작 |
| `workflow` · `auth_config` · `model_config` · `integration` | 각자의 삭제 | 관리 동작 |
| `workspace` | 워크스페이스 삭제 | 워크스페이스당 한 번 |
| `user` | 없다. «탈퇴» 는 워크스페이스 멤버십 삭제다 | — |

실측(PostgreSQL 18, V001~V120. 워크스페이스 W 개마다 워크플로우 10(노드 10·연결선 9·트리거 1)·폴더 10·인증 설정 5·모델 설정 3·지식 저장소 5·LLM 로그 200·어시스턴트 세션 10. 새로 만든 데이터, 워밍 뒤 1회):

| 경로 | W=2,500 | W=10,000 | W=10,000 + V121~V129 |
| --- | --- | --- | --- |
| 캔버스 저장이 노드 하나를 뺀다 | 8.2 ms | 29.1 ms | **0.15 ms** |
| 워크플로우 삭제 | 79.5 ms | 306.8 ms | **1.8 ms** |
| 폴더 삭제(하위 5개) | 5.9 ms | 19.5 ms | 0.53 ms |
| 모델 설정 삭제 | 21 ms | 64~74 ms | 12~13 ms |
| 워크스페이스 삭제 | 856 ms | 3,161 ms | **49.6 ms** |

가장 큰 것은 `edge.target_node_id` 였다. 노드 하나에 28.8 ms(연결선 90만 행 순차 스캔. UNIQUE `(source_node_id, …)` 는 선두가 다르다)이고, 워크플로우 삭제에 10회, 워크스페이스 삭제에 100회 불린다. 다음이 `llm_usage_log.llm_config_id`(모델 설정 삭제 1회 50~58 ms, LLM 로그 200만 행)와 `workflow.folder_id`(폴더 삭제에서 하위 폴더마다)였다. `folder.parent_id` 는 `(workspace_id, parent_id)` 를 쓰지만 인덱스 전체를 훑었다(`Index Searches: 1`).

조회 경로도 함께 보았다. FK 기준으로는 아래 «라»·«바» 에 들지만, 그 컬럼으로 목록을 찾는 조회가 인덱스 없이 요청마다 돌던 다섯이 있었다(W=10,000, 전 → 후): `workspace_member.user_id`(`GET /workspaces`, 0.22 → 0.012 ms), `auth_config.workspace_id`(인증 설정 목록·선택 상자, 0.99 → 0.038 ms), `knowledge_base.workspace_id`(지식 저장소 목록·선택 상자, 1.53 → 0.033 ms), `trigger.auth_config_id`(`GET /api/auth-configs/:id/usage`, 2.97 → 0.006 ms), `model_config.workspace_id`(모델 설정 목록 `workspace_id = ? AND kind = ?`, 부분 UNIQUE 를 못 쓴다, 1.55 → 0.022 ms). FK 비대상으로만 적고 닫으면 이 컬럼들에 «인덱스가 필요 없다» 는 틀린 결론이 남는다.

처분 기준은 곱 «자식 테이블 크기 × 연쇄로 지워지는 부모 행 수» 의 어느 쪽이 사용자 데이터로 자라는가다.

- **둔다**
  - **가.** 한 동작의 호출 수가 사용자 데이터로 는다: `edge.target_node_id`, `workflow.folder_id`, `folder.parent_id`.
  - **나.** 자식이 설정 수가 아니라 사용량으로 자란다: `llm_usage_log.llm_config_id`(보존 정리 없음), `workflow_assistant_session.llm_config_id`(자동 정리 없음).
  - **다.** 위 조회 경로 다섯.
- **두지 않는다**
  - **라.** 부모를 지우는 앱 경로가 없다: `user` 를 가리키는 FK(당시 13개). 그중 NO ACTION 여섯은 참조 행이 있는 사용자의 삭제를 거부한다. 사용자 삭제는 지금 스키마가 받아 주지 않는 동작이고, 사용자 삭제를 더하는 변경은 이 FK 들의 처분부터 다시 정해야 한다.
  - **마.** 10분 만료 일시 행: `integration_oauth_state`·`integration_oauth_preview` 의 FK 셋(호출당 0.1 ms 미만).
  - **바.** 설정 테이블을 한 동작에서 한 번 훑고 조회 경로가 없다: `knowledge_base` 의 모델 설정 FK 넷(각 2.2~3.5 ms), `alert_rule.workflow_id`(1.2~1.3 ms).
- 워크스페이스 삭제는 «가» 의 곱에서 뺀다. 모든 행을 지우는 한 번뿐인 동작이라 연쇄가 전부 곱해지는 것이 정상이다. 합은 3,161 → 49.6 ms 이고 남은 것의 대부분이 «바» 다.

쓰기 비용(10만 행 INSERT 5회 median, FK 컬럼을 모두 채운 최악, «있음 → 없음 → 있음» 세 묶음, 묶음마다 VACUUM)은 행당 +0.8~2.6 µs 였다(`workflow` 는 잡음 수준). 가장 자주 쓰는 둘인 `edge`(+1.7~2.2 µs, 캔버스 저장이 연결선을 한꺼번에 넣는다)와 `llm_usage_log`(+1.8~2.1 µs, LLM 호출 한 번에 1행)도 무시할 만하고, 나머지 여덟은 사람이 설정을 만들 때만 쓰인다. `llm_usage_log`·`workflow_assistant_session` 의 `llm_config_id`, `workflow.folder_id`, `folder.parent_id`, `trigger.auth_config_id` 다섯은 nullable 이라 부분 인덱스다(V115~V118 과 같은 이유). `model_config` 만 `(workspace_id, kind)` 두 컬럼인 것은 목록 조회가 늘 `kind` 를 함께 걸기 때문이다.

28개 밖에서 같은 모양으로 찾은 웹훅 트리거 조회(`endpoint_path` 로만 찾는데 인덱스는 `(workspace_id, endpoint_path)`)는 유일성 범위 결정이 걸려 따로 다뤘다. 같은 날 전역 유일로 정했다. 다시 보니 성능보다 워크스페이스를 넘는 가로채기가 먼저였다([트리거 데이터와 흐름](../CLE-TRIG/CLE-TRIG-DATA.md)).

근거·실측: 옛 plan `spec-draft-fk-remaining-dispositions.md`(git 이력), 구현은 V121~V130.

### 엔티티 정의를 소유 문서로 나눈 이유

옛 데이터 모델 문서는 모든 엔티티의 컬럼을 한 문서에 두었다. 그런데 그 문서에 없는 테이블 다섯(`workspace_invitation`, `auth_oauth_state`, `integration_oauth_state`, `integration_oauth_preview`, `integration_expiry_dispatch`)은 데이터 흐름 문서에만 컬럼이 있었다. 데이터 흐름 문서는 엔티티 정의가 데이터 모델 문서에 있다고 선언하면서도 실제로는 일부 정의를 스스로 들고 있었다. 이 문서는 엔티티 목록과 소유 문서만 두고, 컬럼 정의는 흐름과 함께 읽히는 영역 데이터 문서가 온전히 갖는다. 다섯 테이블도 각자의 소유 문서가 컬럼을 정한다.
