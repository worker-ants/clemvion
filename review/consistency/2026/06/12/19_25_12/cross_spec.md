# Cross-Spec 일관성 검토 결과

검토 대상: `spec/5-system/` (구현 착수 전 --impl-prep)
검토 파일: `1-auth.md`, `10-graph-rag.md`, `11-mcp-client.md` (payload 에 포함된 범위)
대조 파일: `spec/1-data-model.md`, `spec/0-overview.md`, `spec/5-system/8-embedding-pipeline.md`, `spec/2-navigation/9-user-profile.md`, `spec/2-navigation/4-integration.md`, `spec/data-flow/1-audit.md`

---

## 발견사항

### [WARNING] Graph RAG WebSocket 이벤트 목록 불일치 — `document:graph_error` dead-declared 처리

- **target 위치**: `spec/5-system/10-graph-rag.md §6` (WebSocket 이벤트 표) + `KB-GR-OB-02`
- **충돌 대상**: `spec/5-system/8-embedding-pipeline.md §8.2`
- **상세**: `spec/5-system/8-embedding-pipeline.md §8.2` 는 graph RAG 문서에 대해 "6개 이벤트가 추가 emit 된다 — `document:graph_started`, `_progress`, `_completed`, `_error`, `_retry`, `_failed`" 라고 기술한다. 반면 `spec/5-system/10-graph-rag.md §6` 의 이벤트 표는 `document:graph_error` 를 포함하지 않고(5개 이벤트만 표로 나열), KB-GR-OB-02 각주에서 "`_error` 는 타입 union 에만 dead-declared, 미emit" 이라고 명확히 기술한다. 두 spec 이 이벤트 개수를 다르게 서술 — embedding-pipeline 은 6개(오래된 기술), graph-rag 는 5개(현재 현실)로 불일치한다. 구현자가 embedding-pipeline 을 먼저 읽으면 dead-declared `_error` 이벤트를 처리해야 한다고 오해할 수 있다.
- **제안**: `spec/5-system/8-embedding-pipeline.md §8.2` 의 "6개 이벤트" 표현을 `_error` 를 빼고 "5개 이벤트(`document:graph_started`, `_progress`, `_completed`, `_retry`, `_failed`)" 로 갱신하거나, `_error` 가 dead-declared 임을 동일 단락에 주석으로 동기화한다. graph-rag 가 SoT 이므로 embedding-pipeline 을 graph-rag 의 §6 주석과 동일한 언어로 정정한다.

---

### [INFO] RBAC 매트릭스 미등록 신규 리소스 — Agent Memory, Chat Channel 관리 권한 미기재

- **target 위치**: `spec/5-system/1-auth.md §3.2` (리소스별 권한 매트릭스)
- **충돌 대상**: `spec/5-system/17-agent-memory.md §AGM-13`, `spec/5-system/15-chat-channel.md §CCH-SE-01`
- **상세**: `1-auth.md §3.2` 의 RBAC 매트릭스에는 Workflow, Trigger, Schedule, Integration, Knowledge Base, Auth Config, Model Config, Statistics, System Status, Marketplace 만 등재되어 있다. 그러나 `17-agent-memory.md AGM-13` 은 메모리 삭제 API 를 "editor+" 권한으로 명시하고, `15-chat-channel.md` 의 Chat Channel 관리(rotate-bot-token 등)는 Trigger CRUD 의 부속으로 동작한다. 이 권한 규칙들이 auth §3.2 중앙 매트릭스에 없어 완전한 RBAC 그림을 한 곳에서 확인할 수 없다. 작동 불가 모순은 아니지만 신규 기능의 권한 검토 시 누락 가능성이 있다.
- **제안**: `1-auth.md §3.2` 매트릭스에 Agent Memory(Editor+ CRUD)와 Chat Channel 설정(Trigger CRUD 와 동일 권한 또는 별도 행 추가) 항목을 추가하거나, 매트릭스 상단에 "본 표에 없는 리소스는 해당 spec 의 권한 주석 참조" 라는 안내 주석을 추가해 개발자가 개별 spec 을 확인하도록 안내한다.

---

### [INFO] Integration (Org) RBAC — auth 매트릭스 vs integration spec 표현 차이 (문서화된 비모순)

- **target 위치**: `spec/5-system/1-auth.md §3.2` (리소스별 권한 매트릭스, Integration (Org) 행)
- **충돌 대상**: `spec/2-navigation/4-integration.md §8` (권한 규칙 표)
- **상세**: `1-auth.md §3.2` 는 `Integration (Org): Owner=CRUD, Admin=CRUD, Editor=R, Viewer=R` 로 기술하지만, `4-integration.md §8` 표는 Organization 범위의 "생성"을 Admin 이상으로, Personal 생성은 "모든 멤버(Editor+)"로 구분한다. `spec/0-overview.md §6.1` 은 이를 "editor 는 라우트 가드 floor 이며 상보 관계(모순 아님)" 으로 명시적으로 해설했다. 현재 작동 불가 모순은 없으나, `1-auth.md` 의 `Integration (Org): Editor=R` 표현만 보면 Editor 가 Org-scope Integration 을 생성할 수 없다는 뜻임에도 "R(읽기)" 표현 자체는 다소 불명확할 수 있다.
- **제안**: `1-auth.md §3.2` 의 Integration (Org) 행 또는 그 주석에 "Org 범위 생성·수정은 Admin+, 상세는 [integration §8](../2-navigation/4-integration.md#8-권한-규칙) 참조" 를 추가해 단락 내 cross-link 를 명시한다. 현재 `0-overview.md` 주석이 이를 설명하지만 auth §3.2 자체에는 없다.

---

### [INFO] audit §4.1 Planned 액션 현황 — data-flow/1-audit.md 와 정합

- **target 위치**: `spec/5-system/1-auth.md §4.1` (Planned 감사 액션 표)
- **충돌 대상**: `spec/data-flow/1-audit.md §1.1` (커버리지 갭 추적)
- **상세**: `1-auth.md §4.1` 의 Planned 표 (`user.password_changed`, `user.2fa_enabled`, `user.2fa_disabled`, `workspace.*`, `member.*`, `workflow.*`, `trigger.*`, `schedule.*`, `model_config.*`) 는 `data-flow/1-audit.md` 가 추적하는 미구현 목록과 동일하게 기술되어 있다. 두 spec 의 내용은 일치하나, 두 파일에서 동일 정보를 중복 관리하는 구조이므로 향후 한쪽만 업데이트될 경우 drift 가능성이 있다. 현재는 내용 일치로 모순 없음.
- **제안**: 현상 유지(이미 cross-link 있음). 미래 Planned 항목 구현 시 두 파일(`1-auth.md §4.1` + `data-flow/1-audit.md`)을 동시 갱신하는 관행을 코멘트로 명기하면 drift 방지에 도움이 된다.

---

## 요약

`spec/5-system/` 의 세 문서 (`1-auth.md`, `10-graph-rag.md`, `11-mcp-client.md`) 는 `spec/1-data-model.md` · `spec/0-overview.md` · 다른 `spec/5-system/` 문서들과 전반적으로 정합한다. 데이터 모델 필드, API 엔드포인트, 상태 머신(embedding_status / graph_extraction_status), WebSocket 채널 명명, Production fail-closed 가드, TOTP/WebAuthn 복구 코드 풀 분리 등 핵심 계약은 일관성이 유지된다. 유일한 실질적 주의 항목은 `spec/5-system/8-embedding-pipeline.md §8.2` 가 graph RAG WebSocket 이벤트를 6개로 나열하는 반면 `10-graph-rag.md §6` 은 `document:graph_error` 를 dead-declared 로 명시해 5개만 유효 이벤트로 기술하는 불일치(WARNING)다. 이 외 RBAC 매트릭스에서 신규 리소스(Agent Memory, Chat Channel) 가 누락된 것과 Integration RBAC 표현 차이는 작동에 영향을 주지 않는 문서 동기화 권장 항목(INFO)이다.

## 위험도

LOW
