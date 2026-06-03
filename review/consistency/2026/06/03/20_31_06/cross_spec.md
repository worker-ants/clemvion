# Cross-Spec 일관성 검토 결과

target: `spec/4-nodes/4-integration/5-makeshop.md`
검토일: 2026-06-03

---

## 발견사항

### [CRITICAL] `spec/1-data-model.md` — `service_type`, `mall_id`, Node.type 목록 미갱신

- **target 위치**: §3 (credentials 해석), §9.3 (단일 호스트 + shop_uid path segment)
- **충돌 대상**: `/Volumes/project/private/clemvion/spec/1-data-model.md` §2.10 Integration, §2.6 Node.type 목록
- **상세**: target 은 `Integration.service_type='makeshop'` 을 새 값으로 사용하고, `mall_id` 컬럼이 Cafe24 `credentials.mall_id` 뿐 아니라 MakeShop `credentials.shop_uid` 도 투영한다고 정의한다. 그러나 현재 실제 `spec/1-data-model.md` 에서는:
  - `service_type` 필드 설명이 `(google, github, http, database, email, webhook, mcp, cafe24)` — `makeshop` 이 없음
  - `mall_id` 컬럼 설명이 "Cafe24 `mall_id` 의 plain projection — cafe24 외 service_type 에서는 항상 NULL" — MakeShop 언급 없음
  - `autoRefresh` derived 필드 설명이 "현재 `cafe24` / `google` 만 true" — makeshop 추가 예정 미반영
  - Node.type 목록에 `integration | makeshop` 행 없음
  - Integration 인덱스 표에 `(workspace_id, mall_id) WHERE service_type='makeshop'` partial UNIQUE 항목 없음
  - `IntegrationUsageLog.api_label` 설명에 makeshop 언급 없음
  
  worktree 의 `spec/1-data-model.md` 는 이미 갱신됐지만 **main 브랜치 `spec/1-data-model.md` 에는 반영 미완**. target 을 채택하면 data-model spec 과 직접 모순된다.
- **제안**: `spec/1-data-model.md` 를 worktree 버전으로 동기 갱신 필수 (worktree 내 파일은 이미 올바르게 수정됨 — 이 PR 에 포함시키거나 선행 merge 필요).

---

### [CRITICAL] `spec/0-overview.md` — §6 로드맵에 MakeShop 항목 없음

- **target 위치**: §Overview 전체 (제품 정의, MakeShop 이중 활용 두 번째 사례 선언)
- **충돌 대상**: `/Volumes/project/private/clemvion/spec/0-overview.md` §6.1 구현 완료 / §6.3 로드맵
- **상세**: target 은 MakeShop 이 "두 번째 사례" (Cafe24 에 이은 Internal MCP Bridge 두 번째 통합) 임을 명시하고 `spec/4-nodes/4-integration/5-makeshop.md` 가 공식 spec 으로 존재한다고 선언한다. 그러나 현재 `spec/0-overview.md` 에는 MakeShop 을 전혀 언급하지 않는다 — §6.3 로드맵의 "Internal MCP Bridge 패턴 확장" 행은 Cafe24 (§6.1 완료)만 기재하고 MakeShop 이 planned spec 작성 완료임을 기술하지 않는다.
  
  worktree 의 `spec/0-overview.md` 는 §6.3 "Internal MCP Bridge 패턴 확장" 행에 MakeShop 기재가 추가됐지만 **main 의 `spec/0-overview.md` 에 미반영**.
- **제안**: `spec/0-overview.md` §6.3 "Internal MCP Bridge 패턴 확장" 행에 MakeShop 항목 추가 (worktree 버전 참조).

---

### [CRITICAL] `spec/2-navigation/4-integration.md` — §5.9 MakeShop 절 없음, API 카탈로그·autoRefresh 설명 미반영

- **target 위치**: §1 (integrationId 참조 `service_type='makeshop'`), §4 step 3 (Integration 자격증명 해석)
- **충돌 대상**: `/Volumes/project/private/clemvion/spec/2-navigation/4-integration.md` §5 (서비스별 통합 정의), §9 (API)
- **상세**: target 은 `[Spec 통합 §5.9 MakeShop](../../2-navigation/4-integration.md#59-makeshop)` 을 명시적으로 참조하고, `GET /api/integrations/services/makeshop/catalog` 엔드포인트도 사용한다. 그러나 현재 main `spec/2-navigation/4-integration.md` 에는 §5.9 절이 없고, API 표의 `GET /api/integrations/services/:type/catalog` 응답에 makeshop 이 언급되지 않으며, `IntegrationDto.autoRefresh` / `appUrl` derived 필드 설명에 makeshop 추가 예정이 반영되지 않았다.
  
  target 이 참조하는 앵커 `#59-makeshop` 이 현재 파일에 존재하지 않으므로 참조가 dead link 다.
- **제안**: `spec/2-navigation/4-integration.md` §5.9 MakeShop 절 추가, §9.3 API 표의 catalog endpoint 설명에 makeshop 추가, `IntegrationDto` derived 필드 설명 갱신 (worktree 버전 참조).

---

### [WARNING] `spec/conventions/makeshop-api-metadata.md` — main spec 에 없음

- **target 위치**: §1 (operation 필드 설명), §2 (설정 UI), §4 (실행 로직 step 1·5·7)
- **충돌 대상**: `/Volumes/project/private/clemvion/spec/conventions/` (디렉토리 — makeshop-api-metadata.md 파일 없음)
- **상세**: target 은 `[MakeShop API Metadata 컨벤션](../../conventions/makeshop-api-metadata.md)` 을 핵심 SoT 로 다수 참조한다 (`resource/operation 메타데이터 조회`, `requiredFields/optionalFields/paginated`, `fields[*].location` 등). 그러나 현재 main 의 `spec/conventions/` 에는 해당 파일이 존재하지 않는다. worktree 에는 `spec/conventions/makeshop-api-metadata.md` 가 있다.
  
  이 파일이 main 에 없으면 target 이 정의하는 metadata-driven 실행 계약의 SoT 가 없어 spec 자체가 불완전하다 — 구현자가 어떤 메타데이터 스키마를 따라야 하는지 main 기준으로 확인 불가.
- **제안**: worktree 의 `spec/conventions/makeshop-api-metadata.md` 를 이 PR 에 포함시키거나 선행 도입.

---

### [WARNING] `spec/conventions/makeshop-api-catalog/_overview.md` — main spec 에 없음

- **target 위치**: §Overview (지원 범위 161 REST operation), §2 (설정 UI, Operation 드롭다운), §5.1 (output.response 설명)
- **충돌 대상**: `/Volumes/project/private/clemvion/spec/conventions/` (디렉토리 — makeshop-api-catalog 폴더 없음)
- **상세**: target 은 `[MakeShop API Catalog](../../conventions/makeshop-api-catalog/_overview.md)` 를 참조해 161 REST operation 목록·openapi json·라벨 등을 가져온다. main 의 `spec/conventions/` 에 해당 디렉토리가 없다. worktree 에 `spec/conventions/makeshop-api-catalog/` 가 존재한다.
  
  (※ Cafe24 카탈로그는 main 에 `spec/conventions/cafe24-api-catalog/` 가 이미 있으므로 makeshop 카탈로그 디렉토리 패턴 자체는 기존 결정과 일치한다.)
- **제안**: worktree 의 `spec/conventions/makeshop-api-catalog/` 전체를 이 PR 에 포함 (5-makeshop.md 가 직접 SoT 로 참조하므로 같이 머지되어야 함).

---

### [WARNING] `spec/5-system/11-mcp-client.md` — MakeshopMcpToolProvider 언급 누락

- **target 위치**: §Overview (MakeshopMcpToolProvider 선언), §8 (AI Agent 노출 — Internal MCP Bridge)
- **충돌 대상**: `/Volumes/project/private/clemvion/spec/5-system/11-mcp-client.md` §2.3 Internal Bridge
- **상세**: target 은 `MakeshopMcpToolProvider` 가 §2.3 Internal Bridge 패턴으로 동작한다고 명시하며 `[Spec MCP Client §2.3 Internal Bridge]` 를 참조한다. Cafe24 의 `Cafe24McpToolProvider` 가 §2.3 의 첫 번째 구현체로 이미 기술돼 있을 것이나, MakeShop 이 두 번째 구현체라는 사실이 `spec/5-system/11-mcp-client.md` §2.3 에 명시되지 않으면 단방향 참조로 인해 불일치가 발생한다.
  
  (main 파일을 직접 확인한 결과 makeshop 언급이 없음.)
- **제안**: `spec/5-system/11-mcp-client.md` §2.3 에 MakeShop 을 두 번째 Internal Bridge 구현체로 추가 (참조 링크 + (Planned) 표기).

---

### [WARNING] `spec/4-nodes/4-integration/_product-overview.md` — makeshop 노드 요구사항 항목 없음

- **target 위치**: §4 step 11 (`api_label` = `makeshop.<resource>.<operation>`, INT-US-05 참조)
- **충돌 대상**: `/Volumes/project/private/clemvion/spec/4-nodes/4-integration/_product-overview.md` §2.4 (INT-US-05 사용처 추적)
- **상세**: target §4 step 11 은 활동 로그 `api_label` 형식으로 `makeshop.<resource>.<operation>` 을 정의하고 `[_product-overview.md INT-US-05]` 를 참조한다. INT-US-05 의 api_label 표에 현재 cafe24 만 기재돼 있고 makeshop 행이 없다면 이 참조도 dead link / 정의 누락이다.
  
  (main의 _product-overview.md 에서 확인 필요하나, worktree 비교 시 갭이 관측됨.)
- **제안**: `spec/4-nodes/4-integration/_product-overview.md` INT-US-05 표에 makeshop 행 추가.

---

### [INFO] MCP 도구 이름 sanitize 규칙 — 기존 §5.2 위치 명시 필요

- **target 위치**: §8.1 (도구 이름 매핑 — 하이픈 → underscore)
- **충돌 대상**: `spec/5-system/11-mcp-client.md` §5.2 도구 이름 규칙
- **상세**: target §8.1 은 "MCP §5.2 도구 이름 규칙은 영숫자·underscore 외 문자를 sanitize" 라고 설명하며 Cafe24 와 동일한 규칙을 재사용한다. 이는 기존 결정과 충돌하지 않으나, MakeShop operationId 가 하이픈 포함(`get-product` → `get_product`)이라는 점을 §5.2 에도 명시해 두면 구현자 혼선을 방지할 수 있다.
- **제안**: `spec/5-system/11-mcp-client.md` §5.2 에 하이픈 포함 operationId 의 sanitize 처리를 예시로 추가 (INFO 수준 — 필수 아님).

---

### [INFO] `auth.makeshop.com` OAuth 호스트 — 다른 spec 과 교차 확인 불가 (open question 으로 명시됨)

- **target 위치**: §4 step 6 (토큰 갱신 endpoint), §9.1 (인증 흐름 Rationale), §9.7 (미확인 항목)
- **충돌 대상**: 없음 (기존 spec 에 makeshop auth 호스트 정의 없음)
- **상세**: target 이 `auth.makeshop.com` 을 OAuth 호스트로 명시하면서 "구현 착수 시 공식 OAuth 문서로 재확인" 이라고 §9.7 에 open question 으로 표기하고 있다. 이는 spec 내부 정합성보다 외부 확인 사항이며, 다른 spec 영역과의 모순은 없다. 단, OAuth 인프라를 공유하는 `spec/2-navigation/4-integration.md` §5.9 가 생성될 때 같은 호스트·endpoint 를 일관되게 기술해야 한다.
- **제안**: §5.9 작성 시 `auth.makeshop.com` 을 일관 기재. 구현 착수 전 별도 확인 task 트래킹.

---

## 요약

target `spec/4-nodes/4-integration/5-makeshop.md` 의 설계 자체는 기존 Cafe24 노드·Integration 공통 규약·Internal MCP Bridge 패턴과 동형이며 상호 모순이 없다. 그러나 **이 파일을 단독으로 채택하면 반드시 갱신되어야 할 4개 spec 파일이 아직 main 에서 갱신되지 않은 상태**다 — `spec/1-data-model.md` (`service_type`, `mall_id`, Node.type, 인덱스, IntegrationUsageLog.api_label), `spec/0-overview.md` (§6.3 로드맵), `spec/2-navigation/4-integration.md` (§5.9 절 전체, API 표), `spec/5-system/11-mcp-client.md` (§2.3 두 번째 구현체). 아울러 target 이 SoT 로 참조하는 `spec/conventions/makeshop-api-metadata.md` 와 `spec/conventions/makeshop-api-catalog/` 가 main 에 없으므로 spec 체인이 끊긴다. worktree 내부에서는 이 모든 파일이 이미 올바르게 수정/추가된 것으로 확인되므로, **이 PR 이 해당 파일들을 함께 포함하고 있는지 확인하는 것이 최우선 과제**이다.

---

## 위험도

**HIGH**

(target 자체 설계 모순은 없으나, 4개 핵심 cross-cutting spec 의 동반 갱신 없이 단독 채택 시 data-model·navigation spec 과 직접 모순이 발생하며, 두 개의 convention 파일 부재로 spec 체인이 끊김.)
