# Cross-Spec 일관성 검토 결과

대상: `spec/5-system/1-auth.md`, `spec/5-system/10-graph-rag.md` (--impl-prep, scope=spec/5-system/)

## 발견사항

- **[INFO]** WebSocket 이벤트 목록의 `document:graph_error` 서술이 문서 간 불일치
  - target 위치: `spec/5-system/10-graph-rag.md` §6 (WebSocket 이벤트) — "`document:graph_error` 는 `websocket.service.ts` 의 이벤트 타입 union 에 선언돼 있으나 `graph-extraction.service.ts` 에서 실제로 emit 하지 않는다 (dead-declared). in-flight 일시 오류는 `document:graph_retry`, 최종 실패는 `document:graph_failed` 로만 신호한다."
  - 충돌 대상: `spec/2-navigation/5-knowledge-base.md` §2.7 그래프 패널 — "WebSocket 이벤트 (`document:graph_started` / `_progress` / `_completed` / `_error` / `_retry` / `_failed`) 로 실시간 갱신"
  - 상세: graph-rag.md(target, §6)는 `_error` 이벤트가 타입에만 존재하고 실제로는 emit되지 않는 dead-declared 라고 명시적으로 정정했다. 반면 5-knowledge-base.md는 `_error` 를 실시간 갱신에 관여하는 정상 이벤트 목록에 포함하고 있어, 두 문서를 함께 읽으면 "실제로 emit되는가"에 대한 답이 어긋난다. 기능 동작에 영향을 주는 CRITICAL/WARNING 수준은 아니다(어차피 `_retry`/`_failed`가 커버) — 문서 동기화 누락에 해당.
  - 제안: `spec/2-navigation/5-knowledge-base.md` §2.7 의 이벤트 목록에서 `_error` 를 제거하거나, graph-rag.md §6 과 동일하게 "dead-declared, 미emit" 주석을 추가해 정합성을 맞춘다.

- **[INFO]** Marketplace 설치 RBAC 행이 `backlog` 상태 기능에 대해 이미 확정된 권한처럼 기술됨
  - target 위치: `spec/5-system/1-auth.md` §3.2 리소스별 권한 매트릭스 — `Marketplace 설치 | ✅ | ✅ | ✅ | —`
  - 충돌 대상: `spec/2-navigation/8-marketplace.md` frontmatter `status: backlog` / `spec/0-overview.md` §6.3 "마켓플레이스 — 워크플로우 템플릿·AI Agent 프리셋·Integration 플러그인·커스텀 노드 게시 기능" (로드맵/미구현으로 분류)
  - 상세: auth.md §3.2 RBAC 매트릭스에 다른 행(Workflow, Trigger, Integration 등 모두 구현됨)과 동일한 형식으로 "Marketplace 설치" 권한이 나열되어 있어, 마치 이미 구현되고 시행 중인 권한 규칙처럼 읽힌다. 그러나 실제로 마켓플레이스 기능 자체가 `backlog`(미구현) 상태다. auth.md 자체가 §1.3(셀프 호스팅 LDAP/SAML)처럼 "미구현·Planned" 주석 관례를 이미 사용하는 문서이므로, 이 행에도 동일한 처리가 없는 것이 문서 내 일관성 측면에서 아쉽다. 실제 코드에 영향 없는 순수 문서 정합성 이슈.
  - 제안: 표에 각주(예: "※ Marketplace 자체는 backlog — 본 권한은 구현 시 적용될 목표 설계")를 추가하거나, 최소 §3.2 상단에 "일부 행은 대상 리소스가 미구현이며 목표 권한 설계임" 정도의 안내를 둔다. 급하지 않으면 정보성 정리로 후속 처리해도 무방.

- **[INFO]** `spec/2-navigation/9-user-profile.md` §4.2 간이 RBAC 표와 `spec/5-system/1-auth.md` §3.2 상세 매트릭스의 이중 관리
  - target 위치: `spec/5-system/1-auth.md` §3.2 (Owner/Admin/Editor/Viewer × 다수 리소스)
  - 충돌 대상: `spec/2-navigation/9-user-profile.md` §4.2 역할 권한 매트릭스 (워크플로우/Integration(Org)/멤버관리/워크스페이스 설정·삭제/Admin 역할 부여 만 포함하는 부분집합)
  - 상세: 겹치는 항목의 값 자체는 서로 정확히 일치해 실질 모순은 없다. 다만 동일한 RBAC 사실이 두 문서에 부분·전체 관계로 중복 기술되어 있어, 향후 auth.md §3.2 가 변경될 때 9-user-profile.md §4.2 가 동기화 누락될 위험이 구조적으로 존재한다(9-user-profile.md 는 auth.md 를 명시적으로 참조하지 않고 자체 표를 유지).
  - 제안: 실질 충돌이 아니므로 즉시 조치 불요. 후속 정리 시 9-user-profile.md §4.2 상단에 "canonical: auth.md §3.2, 본 표는 발췌"라는 포인터를 추가하는 것을 권장.

## 요약

`spec/5-system/1-auth.md`(인증/인가/세션/RBAC/감사)와 `spec/5-system/10-graph-rag.md`(Graph RAG)를 다른 spec 영역(데이터 모델, 내비게이션 5-knowledge-base/9-user-profile/6-config, RAG 검색, audit-actions/error-codes 규약, migrations README, 0-overview)과 대조한 결과 **CRITICAL/WARNING 수준의 직접 모순은 발견되지 않았다.** 데이터 모델(User.pending_email/email_change_token, KnowledgeBase.rag_mode/extraction_llm_config_id/max_hops/vector_seed_top_k/expanded_chunk_limit/entity_count/relation_count, Entity/Relation/ChunkEntity, AuditLog/RefreshToken/LoginHistory), API 계약(auth-configs reveal 권한, KB graph 엔드포인트, ragSources origin 스키마), RBAC 매트릭스(auth.md §3.2 ↔ 6-config.md·9-user-profile.md), 요구사항 ID(KB-GR-*), 감사 액션 명명 규약(user.* dot-prefix, audit-actions.md)이 모두 정합적으로 상호 참조되고 있으며, 각 SoT 포인터(예: "본 §2.17.2 가 단일 진실", "canonical 은 §5")도 명확히 관리되고 있다. 발견된 3건은 모두 INFO 등급의 문서 동기화·이중 관리 이슈로, 기능 동작이나 구현 착수를 저해하지 않는다.

## 위험도

LOW
