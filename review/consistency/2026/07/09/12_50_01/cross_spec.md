<!-- main 이 journal(wf_3dcc5db4-28c)에서 복원 — subagent write 격리. -->

### 발견사항

- **[WARNING]** `WorkspaceInvitation` 엔티티가 데이터 모델 SoT(`spec/1-data-model.md`)에 카탈로그되어 있지 않음
  - target 위치: `spec/2-navigation/10-auth-flow.md` §2.6 (`invitation.acceptedAt`, 초대 토큰 가입 트랜잭션), §8 API 표(`GET /api/invitations/:token` 등); 교차 참조하는 `spec/2-navigation/9-user-profile.md` §6.1(초대 CRUD API), `spec/5-system/1-auth.md`(`WorkspaceInvitation.token`, raw 저장·UNIQUE, §1.5.2/§1.5.3)
  - 충돌 대상: `spec/1-data-model.md` §2 "핵심 엔티티" (2.1~2.23). `RefreshToken`(§2.18.1)·`LoginHistory`(§2.18.2) 등 인증 인접 엔티티는 전부 필드 테이블로 카탈로그되어 있으나, 같은 성격의 `WorkspaceInvitation`은 어디에도 필드 테이블이 없음(직접 `grep -i invitation spec/1-data-model.md` 확인 결과 `Notification.resource_type` 예시값 `workspace_invitation` 한 줄 외 전무). §1 엔티티 관계 다이어그램에도 없음
  - 상세: target(`10-auth-flow.md`)과 인접 spec(`9-user-profile.md`, `5-system/1-auth.md`)이 `WorkspaceInvitation`을 1급 영속 엔티티로 광범위하게 전제(토큰 raw 저장·`acceptedAt`·만료·이메일/역할 필드 등)하지만, 정작 "데이터 모델의 단일 진실"이어야 할 문서에는 필드 스키마가 없다. 필드 정의가 `5-system/1-auth.md`와 `9-user-profile.md`에 산발적으로만 등장해, 두 문서가 향후 개별적으로 갱신되면 이 엔티티의 실제 스키마에 대해 서로 다른 가정을 갖게 될 위험이 있다
  - 제안: `spec/1-data-model.md`에 `2.x WorkspaceInvitation` 절 신설(id/workspace_id/email/role/token/invited_by/expires_at/accepted_at 등 필드 테이블)하고 §1 ER 다이어그램에도 추가. project-planner 담당(spec 변경)

- **[INFO]** `Trigger.type = 'manual'` enum 값의 실사용 근거 불명확
  - target 위치: `spec/2-navigation/14-execution-history.md` §2.4 "Trigger 출처 분류" (`manual` 판정 규칙 = `executed_by != null`, `Trigger.type` 미참조)
  - 충돌 대상: `spec/1-data-model.md` §2.8 Trigger (`type: webhook / schedule / manual`), §2.9.1 (schedule 타입에 대해서만 "직접 생성 금지" 등 라이프사이클 규칙 존재, manual 타입은 규칙 없음)
  - 상세: 데이터 모델은 `Trigger.type`에 `manual` 값을 정의하지만, 실제로 이 값이 붙은 Trigger 행이 언제 생성되는지 규정하는 문구가 없다. 반면 execution-history의 `triggerSource=manual` 분류는 `Trigger.type` 을 전혀 보지 않고 `Execution.executed_by`만으로 판정하며(R-2에서 엔진 마커 `__triggerSource`(3종)와 DTO `triggerSource`(5종)가 별개 네임스페이스임을 명시적으로 구분), `spec/2-navigation/2-triggers.md`(트리거 목록 화면)에도 "manual" 관련 언급이 전혀 없다. `Trigger.type='manual'` 이 실제로 한 번도 persist 되지 않는 vestigial 값인지, 아니면 어딘가(예: Manual Trigger 노드 최초 생성 시 자동 Trigger row 생성)에서 쓰이는지 spec 상 확인 불가
  - 제안: `spec/1-data-model.md` §2.8에 `manual` 타입 Trigger 행의 생성 조건(또는 "미사용/예약값"이라는 명시)을 한 줄 추가

- **[INFO]** `spec/1-data-model.md` §1 엔티티 관계 다이어그램이 non-exhaustive 임을 명시하지 않음
  - target 위치: 없음 (target 문서 자체 문제는 아니며, target이 참조하는 SoT 문서의 구조적 특성)
  - 충돌 대상: `spec/1-data-model.md` §1 ER 다이어그램 vs 같은 문서 §2 상세 목록 (`WebAuthnCredential`·`RefreshToken`·`LoginHistory`·`Entity`/`Relation`/`ChunkEntity`·`WorkflowTestDataset`·`AssistantMessage`·`AgentMemory` 등 §2에는 있으나 §1 다이어그램에는 없음)
  - 상세: 위 `WorkspaceInvitation` 누락을 조사하는 과정에서, §1 다이어그램이 원래도 완전한 목록이 아님을 확인했다(§2에 정의된 엔티티 중 다수가 다이어그램에 빠져 있음). 이 자체는 즉각적 결함은 아니지만, "다이어그램에 없으니 어딘가엔 있겠지"라는 오판을 유발해 `WorkspaceInvitation`처럼 실제로 §2에도 없는 엔티티를 놓치기 쉽게 만든다
  - 제안: §1 상단에 "본 다이어그램은 대표 관계만 표시하며 전체 엔티티 목록은 §2를 참조" 한 줄 caveat 추가 (경미, 선택적)

### 요약
`spec/2-navigation/` (target)이 명시적으로 인용하는 다른 영역 — `spec/0-overview.md`, `spec/1-data-model.md`, 그리고 실제 파일 접근으로 교차 검증한 `spec/2-navigation/_layout.md`·`9-user-profile.md`·`5-system/1-auth.md` — 과의 직접적 모순(CRITICAL)은 발견되지 않았다. 워크스페이스 slug 라우팅 규약(URL slug=FE SoT, 헤더 기반 인가는 backend 담당), Execution.status 6종 enum, WorkspaceMember 4-role RBAC 매트릭스, Folder 깊이/순환 제약, Workflow.settings 스코프 등 핵심 교차 지점은 모두 인용 원문과 정확히 일치했고, 대부분의 잠재 긴장은 이미 각 문서의 `## Rationale` 절에서 명시적으로 해소되어 있었다(장기간 반복 그루밍의 결과로 보임). 유일하게 실질적인 갭은 `10-auth-flow.md`가 전제하는 `WorkspaceInvitation` 엔티티가 `spec/1-data-model.md`의 엔티티 카탈로그에 형식적으로 등재되어 있지 않다는 점(WARNING)이며, 부수적으로 `Trigger.type='manual'`의 실사용 근거 불명확(INFO)·ER 다이어그램의 non-exhaustive 특성(INFO)이 있다. 이들은 구현 착수를 막을 정도는 아니나, phase 2(에디터 슬러그 편입) 작업 중 인증/초대 플로우를 건드릴 경우 SoT 부재로 인한 드리프트 위험을 낮추기 위해 project-planner 트랙에서 가볍게 정리해 두는 것을 권한다.

### 위험도
LOW