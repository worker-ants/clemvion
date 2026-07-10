# Cross-Spec 일관성 검토 — spec/5-system/ (1-auth.md · 10-graph-rag.md)

## 검토 범위 참고

payload 의 target 은 `spec/5-system/1-auth.md`(전문) · `spec/5-system/10-graph-rag.md`(전문, §4.3 일부 truncate)와, 대조용 참조 자료로 `spec/0-overview.md`·`spec/1-data-model.md`(엔티티 정의 다수)가 함께 포함되어 있었다. impl-done 모드 지시에 따라 워킹트리(`/Volumes/project/private/clemvion/.claude/worktrees/suggestions-prefix-dry-0fae90`)를 절대경로로 직접 조회해 검증했다.

다만 실측 결과 이 워킹트리의 `git diff origin/main --stat -- spec/` 는 **비어 있다** — `spec/5-system/` 아래 실제 diff 는 없고, 이 브랜치의 실 변경분은 `codebase/frontend/.../use-expression-suggestions.ts` 등 expression 관련 코드에 한정된다(`plan/in-progress/suggestions-prefix-dry.md`). 즉 본 cross-spec 호출의 target(`spec/5-system/`)은 이 워크트리의 실제 작업 범위와 무관해 보인다 — orchestrator 의 scope 파라미터가 다른 작업(auth/graph-rag 관련)에서 잘못 전달됐을 가능성이 있다. 그럼에도 지시된 target 문서 자체는 실제로 저장소에 존재하는 현재 spec 내용이므로, 아래는 그 내용을 대상으로 한 정상적인 cross-spec 분석 결과다.

## 발견사항

교차 검증한 항목과 결과 (모두 정합 확인, 충돌 없음):

- **감사 액션 (`workspace.created/updated`, `workspace.deleted` 제외)**: `1-auth.md §4.1` ↔ `spec/conventions/audit-actions.md` ↔ `spec/data-flow/1-audit.md` ↔ `spec/data-flow/12-workspace.md` 전부 동일 결정(결정4=B, `workspace.deleted` 구조적 제외)을 공유. 불일치 없음.
- **RBAC 매트릭스 (§3.2)**: Auth Config(Owner/Admin=CRUD, Editor/Viewer=R), Model Config(Editor=CRUD, Viewer=R action-POST 별도 게이트), Knowledge Base(Editor=CRUD, Viewer=R), System Status(전 역할 R, admin 가드 없음) — `spec/2-navigation/6-config.md`, `spec/5-system/12-webhook.md`, `spec/5-system/16-system-status-api.md`, 실제 코드(`graph.controller.ts` `@Roles('editor')`)와 모두 일치.
- **LoginHistory event enum / `chk_login_history_event` (V040→V058)**: `1-auth.md §4.3`·Rationale 1.4.G ↔ `spec/1-data-model.md §2.18.2` ↔ `spec/data-flow/1-audit.md` 일치. 마이그레이션 파일 `V058__login_history_webauthn_failed_event.sql` 실재 확인.
- **에러코드 historical-artifact 예외 (`invitation_*`, `forbidden`, `rate_limited` lowercase)**: `1-auth.md §1.5.4` ↔ `spec/conventions/error-codes.md §3` 레지스트리 항목이 정확히 일치(scope "초대 API 한정"까지 동일 표현).
- **`activeWorkspaceId` JWT 클레임 (dual-read, header-first)**: `1-auth.md §2.2/§3.3` ↔ `spec/data-flow/12-workspace.md` ↔ 실제 코드(`jwt.strategy.ts`, `websocket.gateway.ts`)가 일관됨. 단, JWT 서명 시 포함되는 `role` 클레임(§2.2 예시)은 `JwtStrategy.validate()`/`RolesGuard` 모두 이를 신뢰하지 않고 매 요청 `WorkspacesService.getMemberRole()` 로 재조회한다 — 문서·구현 모두에서 이 필드는 사실상 미사용 잔존 값이나, 다른 spec 영역과 상충하는 사안은 아니라 CRITICAL/WARNING 대상은 아님(INFO 참고).
- **Graph RAG 데이터 모델 (`KnowledgeBase` 확장 컬럼, `Entity`/`Relation`/`ChunkEntity`)**: `10-graph-rag.md §2` ↔ `spec/1-data-model.md §2.11~§2.12.4` 필드명·타입·제약조건(UNIQUE, 인덱스)까지 완전히 동일.
- **요구사항 ID (`KB-GR-*`, `NF-GR-*`)**: 저장소 전체에서 `spec/5-system/10-graph-rag.md` 외 재사용 없음 — 충돌 없음.
- **AI Agent 노드 KB 파라미터 노출 범위 (KB-GR-PA-03)**: `ai-agent.schema.ts` 실측 결과 `maxHops`/`vectorSeedTopK`/`expandedChunkLimit` 미노출, `ragTopK`/`ragThreshold` 만 존재 — 문서 주장과 일치.
- **RAG 검색 §3.4 동적 점수 컷(token-budget + inject-cap) 참조**: `10-graph-rag.md §3.4·§4.1·§4.2` ↔ `spec/5-system/9-rag-search.md` 상호 참조 내용이 서로 모순 없이 맞물림.
- **KB 생성 폼의 graph 모드 필드 (`추출 LLM`, `그래프 검색 파라미터`)**: `spec/2-navigation/5-knowledge-base.md` 가 `10-graph-rag.md` 와 동일 필드·기본값을 그대로 반영.

### INFO — JWT payload `role` 필드의 사실상 미사용 (경미, cross-spec 아님)

- target 위치: `1-auth.md §2.2` (JWT payload 예시의 `"role": "editor"`), `auth.service.ts` `generateTokens`/`buildTokenPayload` (`role: context.role`)
- 충돌 대상: 없음 (동일 영역 내부 사안 — 참고용으로만 보고)
- 상세: 서명 시점에는 `role` 클레임이 실제로 포함되지만(`auth.service.ts:1063`), 소비 측(`jwt.strategy.ts`·`RolesGuard`)은 이 필드를 참조하지 않고 매 요청 DB 재조회로 role 을 확정한다. 워크스페이스 전환(`switch`) 시에도 access token 이 재발급되므로 stale-role 로 인한 실제 보안 문제는 없으나, §2.2 예시가 "구현에서 실제로 신뢰되는 필드"처럼 읽힐 여지가 있다.
- 제안: 결정적 이슈는 아니므로 즉시 조치 불필요. 추후 §2.2 에 "role 클레임은 참고용 스냅샷이며 인가는 항상 DB 재조회로 확정" 같은 1줄 주석을 추가하면 오독을 줄일 수 있다.

## 요약

`spec/5-system/1-auth.md`·`spec/5-system/10-graph-rag.md` 두 target 문서를 데이터 모델(`1-data-model.md`), 감사 로그/워크스페이스(`conventions/audit-actions.md`, `data-flow/1-audit.md`, `data-flow/12-workspace.md`), 에러코드 레지스트리(`conventions/error-codes.md`), RBAC 관련 타 영역 문서(`2-navigation/6-config.md`, `2-navigation/5-knowledge-base.md`, `5-system/12-webhook.md`, `5-system/16-system-status-api.md`, `5-system/9-rag-search.md`) 및 실제 구현 코드(`jwt.strategy.ts`, `websocket.gateway.ts`, `auth.service.ts`, `graph.controller.ts`, `ai-agent.schema.ts`)와 대조한 결과, 데이터 모델·API 계약·요구사항 ID·RBAC·감사 액션·에러코드 어디에서도 직접적인 모순을 발견하지 못했다. 다만 이 워크트리(`suggestions-prefix-dry-0fae90`)의 실제 `git diff origin/main` 범위에는 `spec/5-system/` 변경이 전혀 없어(diff 는 frontend expression 코드에 한정), 본 cross-spec 호출의 target scope 자체가 이 작업과 무관하게 지정된 것으로 보인다 — orchestrator 쪽에서 scope 파라미터를 재확인할 필요가 있다. 문서 내용 자체의 cross-spec 정합성은 매우 높다.

## 위험도

NONE
