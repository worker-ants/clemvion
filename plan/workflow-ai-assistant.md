# Workflow AI Assistant — 기획 작업 계획

## 개요

워크플로우 에디터 내부에 채팅형 AI 어시스턴트 패널을 추가한다. 사용자가 자연어로 요구사항(구체적 또는 모호)을 전달하면 **Clarify → Propose Plan → Execute** 3단계 대화 루프를 통해 노드·엣지를 자동 생성·수정한다. LLM은 LLM Config에 등록된 모델을 사용한다.

## 사용자 결정 사항

| 결정 항목 | 값 | 비고 |
| --- | --- | --- |
| 제품 명칭 | **Workflow AI Assistant** / 워크플로우 AI 어시스턴트 | PRD/Spec/i18n 공통 |
| PRD 위치 | `prd/2-workflow-editor.md` 신규 §10 — `ED-AI-*` 접두사 | 에디터 문서에 일관성 |
| 채팅 기록 저장 | **서버 영속화** — 세션/메시지 테이블 신규 | 세션 복원 지원 |
| 변경 적용 방식 | 즉시 반영 + Undo | 기존 editor-store 재사용 |
| 스트리밍 | SSE + LLMClient.stream() 확장 | MVP는 OpenAI/Anthropic |

## 영향 문서

### 신규
- `spec/3-workflow-editor/4-ai-assistant.md` — 어시스턴트 상세 스펙 (UX/API/데이터 흐름)

### 개정
- `prd/2-workflow-editor.md` — §10 AI Assistant 요구사항 (ED-AI-*)
- `prd/6-phase2-ai.md` — §3.6 Workflow AI Assistant 요약 + 상호 참조
- `prd/0-overview.md` — §6 로드맵/구현 상태 업데이트
- `spec/0-overview.md` — §4 PRD↔Spec 매핑표에 `ED-AI-*` 라인 추가
- `spec/1-data-model.md` — §1 ER 다이어그램 + §2.20 AssistantSession, §2.21 AssistantMessage 추가
- `spec/5-system/7-llm-client.md` — §8 Streaming 인터페이스 추가
- `spec/3-workflow-editor/0-canvas.md` — §1 에디터 레이아웃 다이어그램 + §13 AI Assistant 패널 간단 참조

## Open Question (사용자에게 추가 확인이 필요한 경우만)
- Assistant Panel과 NodeSettings Panel 동시 오픈 가능 여부 → 기본값: **상호배타**(어시스턴트 열면 Settings 자동 닫음), 사용자 피드백 수용 가능
- 세션 보관 기간/삭제 정책 → 기본값: **영속**(수동 삭제만), 워크스페이스 삭제 시 cascade
- 기록된 메시지 공개 범위 → 기본값: **세션 생성자만 접근**

## 작업 순서 (진행 상태)

- [x] 신규 Spec `spec/3-workflow-editor/4-ai-assistant.md` 작성
- [x] `spec/1-data-model.md` — §1 ER, §2.20 AssistantSession, §2.21 AssistantMessage, §3 인덱스 추가
- [x] `spec/5-system/7-llm-client.md` — §8 스트리밍 인터페이스 추가
- [x] `spec/3-workflow-editor/0-canvas.md` — §1 레이아웃·§2 헤더·§10 단축키 반영
- [x] `prd/2-workflow-editor.md` — §10 `ED-AI-*` 요구사항 추가
- [x] `prd/6-phase2-ai.md` — §2.1·§3.6 반영 및 로드맵 표시
- [x] `prd/0-overview.md` — §6.3 로드맵 + §8 문서 맵 업데이트
- [x] `spec/0-overview.md` — §4 매핑표에 ED-AI-* 라인 추가
- [x] `memory/workflow-ai-assistant-decisions.md` — 사용자 합의 기록

## 후속 (developer 역할에서 수행)

- Flyway 마이그레이션: `workflow_assistant_session`, `workflow_assistant_message`
- Backend 모듈: `modules/workflow-assistant/` (session/message CRUD + SSE)
- Backend LLM 스트리밍 구현: `OpenAIClient.stream`, `AnthropicClient.stream`, `LlmService.chatStream`
- Frontend: `AssistantPanel`, `assistant-store`, SSE 클라이언트, i18n 키 (스펙 §13), editor-store dispatcher
- 기존 기술 플랜(`~/.claude/plans/ui-partitioned-porcupine.md`) 대비 **서버 영속화 추가** 반영 필요. 메모: `memory/workflow-ai-assistant-decisions.md`

## 완료 기준 (달성)
- PRD 요구사항(ED-AI-01~34) 각각이 Spec 섹션과 매칭됨 (스펙 §14 매핑표)
- 기존 LLM Client / 워크플로우 에디터 / 데이터 모델 스펙과 정합성 유지 (cross-ref 링크 추가)
- 개발자(developer) 역할이 Spec + memory 메모만 보고 구현 착수 가능
