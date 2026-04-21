# Workflow AI Assistant — 기획 결정 메모

Workflow AI Assistant(에디터 내 채팅형 AI) 스펙 작성 시 사용자와 합의한 결정 사항을 구현자가 재참조할 수 있도록 정리한다.

## 확정된 결정 사항

| 항목 | 결정 | 근거 |
|------|------|------|
| 제품 명칭 | **Workflow AI Assistant** / 워크플로우 AI 어시스턴트 | PRD/Spec/i18n 전 영역에서 통일 사용. "Copilot", "AI Workflow Builder" 후보는 기각 |
| PRD 배치 | `prd/2-workflow-editor.md` §10, 요구사항 ID 접두사 `ED-AI-*` | 에디터 내부 UI/UX가 주 영역이므로 에디터 문서에 포함. PRD 6에서는 cross-ref만 |
| 채팅 세션 영속화 | **서버 저장** (신규 엔티티 `AssistantSession`, `AssistantMessage`) | 페이지 새로고침·재접속 시 이어서 대화 지원. 관련: `spec/1-data-model.md` §2.20~2.21 |
| 변경 적용 방식 | 즉시 반영 + Undo (`editor-store` 재사용) | 기존 자동 저장/Ctrl+S 흐름과 일관. DB 영구 기록은 사용자의 Save를 통해서만 |
| 스트리밍 | SSE + `LLMClient.stream()` 신규 메서드 | 관련: `spec/5-system/7-llm-client.md` §8 |
| 스트리밍 v1 지원 provider | OpenAI, Anthropic만 | Google/Azure는 Tool-use 포맷 차이로 후속. 미지원 provider 선택 시 `ASSISTANT_STREAMING_UNSUPPORTED` 에러 |
| NodeSettings Panel과 동시 오픈 | **상호 배타** (Assistant 열면 Settings 닫힘) | MVP 단순화. 사용자 피드백에 따라 후속 버전에서 나란히 배치 가능 |
| Assistant의 편집 권한 | `editor` 역할 이상 | 기존 RBAC 규약 재사용 |

## 구현 시 유의 사항 (승인된 기술 플랜 `~/.claude/plans/ui-partitioned-porcupine.md` 대비 변경점)

원래 기술 플랜에는 "채팅 히스토리는 in-memory only (MVP)"로 명시되어 있었으나, **기획 단계에서 서버 영속화로 변경**되었다. 따라서 다음 작업이 추가된다:

1. **DB 엔티티 2개 신규**: `AssistantSession`, `AssistantMessage` (Flyway 마이그레이션 필요)
2. **REST API 5개 신규**: `GET/POST/PATCH/DELETE /workflow-assistant/sessions`, `GET /workflow-assistant/sessions/:id`. SSE 엔드포인트는 `POST /workflow-assistant/sessions/:id/messages`로 경로 변경 (기존 플랜의 `/workflow-assistant/message`가 아님).
3. **백엔드 Service**: 세션/메시지 CRUD + 대화 컨텍스트 조립(최근 30턴 프롬프트 주입 룰).
4. **프론트엔드 스토어**: `assistant-store.ts`가 서버 세션 id를 들고 있어야 하며, 패널 오픈 시 `GET /sessions?workflowId=...`로 기존 세션을 로드.
5. **Cascade 삭제**: `Workspace` 삭제 → `Workflow` 삭제 → `AssistantSession` 삭제 → `AssistantMessage` 삭제. Flyway 마이그레이션에서 ON DELETE CASCADE FK 설정.

## 미결 UX (발견 시 확인 필요)

- 세션 보관 기간/자동 archive 정책 — 현재 Spec은 "수동 삭제까지 영속". 향후 워크스페이스별 용량 제한과 연계 가능.
- 세션 공유/내보내기 — v1 스코프 밖 명시. 팀 워크스페이스 RBAC 선행 필요.
- Plan 카드의 step을 사용자가 직접 편집/체크 가능한지 — 현재 Spec은 "사용자 조작 불가, 진행도 표시 전용"(§3.3). 필요해지면 별도 RFC.
