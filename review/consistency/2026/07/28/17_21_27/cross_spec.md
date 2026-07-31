# Cross-Spec 일관성 검토 — spec/5-system/ (impl-prep)

대상: `spec/5-system/1-auth.md`, `spec/5-system/10-graph-rag.md`, `spec/5-system/11-mcp-client.md`
대조: `spec/0-overview.md`, `spec/1-data-model.md`, `spec/2-navigation/9-user-profile.md`, `spec/2-navigation/4-integration.md`, `spec/5-system/9-rag-search.md`, `spec/4-nodes/4-integration/5-makeshop.md`, `spec/conventions/audit-actions.md`, 및 관련 backend 코드(`workspaces.controller.ts`/`workspaces.service.ts`, `integrations` DTO)

## 발견사항

- **[CRITICAL]** RBAC 매트릭스 "멤버 관리" 행에서 Admin 의 삭제 권한 누락 — 자기모순 + cross-doc 불일치 + 실제 구현과 상충
  - target 위치: `spec/5-system/1-auth.md` §3.2 리소스별 권한 매트릭스, L367 `| 멤버 관리 | CRUD | CRU | R | R |` (Owner=CRUD, **Admin=CRU — D 없음**)
  - 충돌 대상 1 (동일 문서 자기모순): 같은 문서 §3.1 RBAC 역할 표, L357 `| **Admin** | 관리자. **멤버 관리** + 설정 변경 + 모든 리소스 CRUD |` — Admin 의 역할 서술 자체가 "멤버 관리"를 Admin 의 핵심 권한으로 명시.
  - 충돌 대상 2 (cross-spec): `spec/2-navigation/9-user-profile.md` §6.1 API, L358 `DELETE /api/workspaces/:id/members/:memberId | 멤버 제거 (**Admin+** / 자가 탈퇴 시 leave로 위임)` 및 §4.2 역할 권한 매트릭스 L235 `| 멤버 관리 | ✅ | ✅ | ❌ | ❌ |` (Admin ✅). auth.md 자신이 문서 헤더에서 이 문서를 "관련 문서"로 직접 인용하고 있어(§3.2 는 자신을 RBAC 의 "단일 진실"로 선언, Overview L26), 두 문서가 같은 액션(Admin 의 멤버 삭제 가능 여부)에 대해 정반대로 답한다.
  - 충돌 대상 3 (실측 코드): `codebase/backend/src/modules/workspaces/workspaces.controller.ts` L355-369 `DELETE :id/members/:memberId` → `codebase/backend/src/modules/workspaces/workspaces.service.ts` L682-720 `removeMember()` 가 `assertAdmin(workspaceId, requesterId)` 만 통과하면 owner 가 아닌 멤버를 제거한다(role 계층 검사, Owner 제한 없음) — 실제 시스템은 이미 "Admin 이 멤버를 삭제할 수 있다"로 동작 중이다.
  - 상세: auth.md §3.2 표는 "본 문서는 사용자 신원과 권한(RBAC)의 단일 진실이다"(Overview)라고 선언하지만, 정작 그 표의 "멤버 관리" 행에서 Owner=CRUD 인데 Admin=CRU 로 D(삭제) 를 빠뜨렸다. 반면 (a) 같은 문서 §3.1 의 Admin 역할 서술, (b) user-profile.md 의 API 스펙·역할 매트릭스, (c) 실제 backend 코드가 모두 "Admin 은 멤버를 제거할 수 있다"로 일치한다. 즉 §3.2 표만 outlier 다. 이 표를 그대로 새 구현(예: 중앙화된 RBAC 가드 리팩터)의 근거로 채택하면 현재 정상 동작하는 "Admin 의 멤버 제거" 기능이 회귀한다 — CRITICAL 등급 기준("그대로 채택하면 두 영역 중 하나가 작동 불가")에 부합.
  - 제안: `spec/5-system/1-auth.md` §3.2 L367 을 `| 멤버 관리 | CRUD | CRUD | R | R |` 로 정정(§3.1 Admin 서술·user-profile.md §4.2/§6.1·실제 코드와 정합). "Admin 역할 부여"(L368, Owner 전용)는 별도 행으로 이미 분리되어 있으므로 이 정정이 "Admin 이 다른 Admin 을 임명"하는 권한까지 확장하지 않음에 유의(역할 부여는 별개 행이 계속 Owner 전용을 담당).

- **[WARNING]** MCP Integration 의 "개인 등록 미지원" 제약이 Integration 공통 스펙에 반영되지 않음
  - target 위치: `spec/5-system/11-mcp-client.md` §1 범위 L27 `워크스페이스 공용 자원 (사용자 개인 MCP 서버는 본 spec 의 범위 밖)`, §3.1 L99 `Integration.scope | 기본 organization (개인 등록 미지원)`
  - 충돌 대상: `spec/2-navigation/4-integration.md` §3.2 Step 2 "공통 필드" 표 L153-157 (`scope` 필드 — Personal/Organization, "Admin이 아니면 Organization 비활성"만 언급, service_type 별 예외 없음), §5.6 MCP Server 섹션(L509-546, scope 제약 서술 전무), §8 권한 규칙(L771-783, 서비스타입 무관 공통 표). `spec/1-data-model.md` §2.10 Integration.scope 정의도 `personal / organization` 로 서비스타입 제약 없이 일반적으로 기술됨.
  - 상세: mcp-client.md 는 `service_type='mcp'` Integration 이 조직 스코프 전용이라고 단정하지만, Integration 엔티티·API·UI 흐름의 SoT 인 4-integration.md 는 이 예외를 어디에도 명시하지 않는다(§3.2 의 scope 필드는 "Admin 이 아니면 Organization 비활성"이라는 **역할** 기반 제약만 서술 — MCP 라서 Personal 옵션 자체가 숨겨진다는 서술이 없음). 실제로 `codebase/backend/src/modules/integrations` 의 DTO(`integration.dto.ts`)·서비스 코드에도 `service_type==='mcp'` 조건부 scope 검증이 없어(grep 무결과), 현재 스펙만으로는 개인 스코프 MCP 등록이 실제로 차단되는지 판정 불가 — 두 문서가 서로 다른 사실을 전제한다.
  - 제안: `4-integration.md` §5.6 MCP Server 섹션에 "personal 스코프 미지원(조직 전용)" 제약을 명시하고, §3.2 공통 필드 표 또는 §8 권한 규칙 표에 service_type 예외 각주를 추가해 mcp-client.md §3.1 과 동기화한다. 혹은 반대로 이 제약이 실제로는 없다면(구현 자유도가 있다면) mcp-client.md §1/§3.1 의 "미지원" 단정 문구를 완화한다 — 어느 쪽이 맞는지 명시적 결정 필요.

- **[WARNING]** MCP Internal Bridge 401 자가회복 예외가 Cafe24 만 명시 — MakeShop 누락
  - target 위치: `spec/5-system/11-mcp-client.md` §2.3 L81, §8.4 L511, §Rationale L579 — 모두 "refresh_token 을 보유한 provider (예: cafe24)"라며 링크는 `[Spec Cafe24 §6.1]` 하나만 건다.
  - 충돌 대상: 같은 문서 §3.1 표(L101-106)는 Internal Bridge 적용 service_type 으로 `cafe24`·`makeshop` 둘 다 명시한다. `spec/4-nodes/4-integration/5-makeshop.md` §6.1 L191-193 은 "Cafe24 §6.1 정책 그대로 재사용 — 401: refresh + 1회 재시도"를 자체 명시하고, §8.6(L214)은 "expired 통합 자가 회복은 refresh_token 보유 시 1회 refresh 동일 정책"이라고 AI Agent Internal MCP Bridge 노출 맥락에서까지 명시적으로 확정한다. `spec/0-overview.md` §6.1(L80) 도 MakeShop 을 "auth-code+refresh 토큰 rotation" 보유 서비스로 명시.
  - 상세: mcp-client.md 의 "refresh_token 보유 provider 는 즉시 격하 대신 refresh+재시도 우선"이라는 정책은 문언상 일반 원칙처럼 쓰였으나(cafe24 는 "예:"로 예시화), 실제 상호참조 링크·Rationale 서술은 Cafe24 §6.1 **하나만** 지목한다. mcp-client.md 만 읽고 구현하는 개발자는 MakeShop Internal Bridge 의 401 을 §8.4 기본 정책(즉시 격하)으로 처리할 위험이 있는데, 이는 makeshop 자신의 spec(§8.6)이 명시한 "refresh 우선" 정책과 어긋난다.
  - 제안: `11-mcp-client.md` §2.3/§8.4/Rationale 의 "예: cafe24" 옆에 "makeshop(§8.6 동일 정책)" 를 병기하거나 `[Spec MakeShop §6.1](../4-nodes/4-integration/5-makeshop.md#61-인증-실패-자동-status-전환)` 링크를 추가해 두 provider 가 동일 예외를 공유함을 명시한다.

- **[INFO]** graph-rag.md 자체 데이터 모델 섹션이 자신이 참조하는 `reextract_status` 컬럼을 나열하지 않음
  - target 위치: `spec/5-system/10-graph-rag.md` §2.1 "KnowledgeBase 추가 컬럼"(L236-249) — `rag_mode`/`extraction_llm_config_id`/`max_hops`/`vector_seed_top_k`/`expanded_chunk_limit`/`entity_count`/`relation_count` 만 나열, `reextract_status` 없음. 같은 문서 §7 에러 처리 표 L564 는 `re-extract` 동시 호출 차단 근거로 `DB 컬럼 (reextract_status) atomic compare-and-swap` 를 직접 인용.
  - 충돌 대상: `spec/1-data-model.md` §2.11 KnowledgeBase, L356 `reextract_status | Enum | KB 전체 그래프 재추출 잠금: idle / in_progress (default: idle). vector 모드에서는 사용 안 함` — data-model.md 는 이 컬럼을 정확히 정의하고 있으나 graph-rag.md 자신의 "추가되는 컬럼" 목록에는 없다.
  - 상세: 모순은 아니지만(정의 자체는 data-model.md 에 존재하고 값도 일치), graph-rag.md 를 단독으로 읽는 구현자는 §2.1 표만 보고 "이 문서가 선언하는 컬럼이 전부"라고 오인해 §7 의 `reextract_status` 참조를 놓치기 쉽다. 이 문서는 "retry-atomic-claim" 류 작업(재시도·동시성 잠금)이 정확히 건드릴 컬럼이라 완결성이 특히 중요하다.
  - 제안: §2.1 표에 `reextract_status` 행을 추가(data-model.md §2.11 문구 그대로 복사)해 §7 과의 self-reference 갭을 없앤다.

## 요약

`spec/5-system/1-auth.md`(RBAC 매트릭스)·`10-graph-rag.md`·`11-mcp-client.md` 3 개 target 문서를 `0-overview.md`/`1-data-model.md`/`2-navigation/9-user-profile.md`/`2-navigation/4-integration.md`/`5-system/9-rag-search.md`/`4-nodes/4-integration/5-makeshop.md`/실제 backend 코드와 교차 검증한 결과, 데이터 모델(Entity/Relation/ChunkEntity/KnowledgeBase 컬럼, `9-rag-search.md` 와의 ragSources/동적 점수 컷 인터페이스, `4-integration.md` §5.6 MCP 인증 스키마)·API 계약·요구사항 ID(`KB-GR-*`/`NF-GR-*` 전역 유일성 확인됨)·감사 액션 명명(`conventions/audit-actions.md` 와 완전 정합)은 대체로 견고하다. 다만 **auth.md 의 RBAC 매트릭스가 "멤버 관리" 행에서 Admin 의 삭제 권한을 누락**해 같은 문서·user-profile.md·실제 코드와 정면으로 어긋나는 CRITICAL 결함이 발견됐고, MCP 관련 두 건(개인 스코프 미지원 여부의 spec 간 불일치, MakeShop 401 자가회복 예외의 cross-reference 누락)이 WARNING 으로, graph-rag.md 의 컬럼 목록 완결성 문제가 INFO 로 확인됐다. 전자(RBAC)는 이번 impl-prep 단계에서 반드시 정정 후 진행해야 한다.

## 위험도

HIGH
