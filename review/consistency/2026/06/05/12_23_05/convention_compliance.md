# 정식 규약 준수 검토 결과

검토 범위: `spec/5-system/` (대표 파일 `1-auth.md`, `10-graph-rag.md`, `11-mcp-client.md`) 및 `spec/conventions/cafe24-api-catalog/` (인덱스 `application.md` + 필드 레벨 파일 `application/apps.md`, `application/appstore-orders.md`)

---

## 발견사항

### [WARNING] `spec/5-system/11-mcp-client.md` — `## Rationale` 섹션 누락

- **target 위치**: `spec/5-system/11-mcp-client.md` 전체 (섹션 §1~§12, 파일 끝)
- **위반 규약**: `CLAUDE.md` "결정의 배경·근거 → 해당 spec 문서 끝의 `## Rationale`" + `.claude/skills/project-planner/SKILL.md §Spec 문서 구조 (3섹션 권장)` — "Overview / 본문 / Rationale"
- **상세**: 파일 내에 `## Rationale` H2 섹션이 존재하지 않는다. 본 파일에는 수많은 설계 결정(Internal Bridge transport 채택, stdio 미지원 사유, stateless JWT challenge, skipReason `lower_snake_case` 의도적 분리, SSRF 가드 패턴 등)이 본문 내 인라인 근거로만 서술되어 있다. 동 영역의 다른 파일(`1-auth.md`, `10-graph-rag.md`)은 `## Rationale` 섹션을 보유한다.
- **제안**: 파일 끝에 `## Rationale` 섹션을 추가하고, 현재 본문 내 인라인으로 흩어진 핵심 결정 근거(transport 선택·Internal Bridge 구조·skipReason 표기법·SSRF 정책·stateless JWT challenge 등)를 해당 섹션으로 이동 또는 요약 참조한다. "권장" 구조이므로 CRITICAL 이 아닌 WARNING 수준.

---

### [WARNING] `spec/5-system/11-mcp-client.md` §9 — preview-test 성공 응답이 `{ data: ... }` 래핑 없이 명시됨

- **target 위치**: `spec/5-system/11-mcp-client.md` §9 연결 테스트, 성공 응답 JSON 예시 (`"capabilities": {...}, "serverInfo": {...}, "preview": {...}`)
- **위반 규약**: `spec/5-system/2-api-convention.md §5 응답 형식` — "모든 응답은 전역 `TransformInterceptor` 가 `{ data: ... }` 로 래핑한다"
- **상세**: §9 에서 성공 시 응답 body 예시가 `{ "capabilities": ..., "serverInfo": ..., "preview": ... }` 로 표기되어 있어 `{ data: { capabilities, serverInfo, preview } }` 래핑이 빠져 있다. 실패 응답 `{ success: false, code, message }` 는 `IntegrationTestResult` shape 으로 기존 통합 spec (`4-integration.md`) 이 동일 패턴을 확립했으므로 예외 근거가 있으나, 성공 케이스는 근거가 명시되지 않았다. `4-integration.md` Rationale 의 "Endpoint 시맨틱 — 테스트를 수행하고 결과를 반환" 논리가 성공 케이스에도 적용된다면 `{ data: ... }` 래핑을 우회하는 설계 선택이지만, 본 MCP spec 이 그 예외를 명시적으로 문서화하지 않는다.
- **제안**: (a) 성공 응답 예시를 `{ "data": { "capabilities": ..., ... } }` 로 수정하거나, (b) 기존 `IntegrationTestResult` 의 `{ success, code? }` 패턴과 일관성을 유지해 성공 케이스도 `{ success: true, capabilities, serverInfo, preview }` 로 통합하고 `4-integration.md` Rationale 에 있는 TransformInterceptor 우회 근거를 여기서도 명시 참조한다.

---

### [WARNING] `spec/5-system/10-graph-rag.md` — 자기 파일을 "PRD Graph RAG" 로 자기 참조

- **target 위치**: `spec/5-system/10-graph-rag.md` 라인 25, 관련 문서 링크: `[PRD Graph RAG](./10-graph-rag.md)`
- **위반 규약**: `CLAUDE.md §정보 저장 위치` — "제품 정의·요구사항 → `spec/<영역>/_product-overview.md` 또는 진입 문서의 `## Overview`". 본 spec 파일이 PRD 와 기술 명세를 동일 파일에 통합한 문서라면 "PRD" 라는 별칭으로 자기 자신을 링크하는 것은 독자에게 혼란을 준다.
- **상세**: 파일 상단 관련 문서 링크에서 `[PRD Graph RAG](./10-graph-rag.md)` 가 현재 열람 중인 파일 자신을 가리킨다. `5-system/` 영역에는 `_product-overview.md` 가 존재하지만 Graph RAG 전용 PRD 내용은 그 안에 없다. 이 파일 자체가 PRD + 기술 명세를 통합한 문서이므로 링크 자체가 불필요하거나 오해를 유발한다.
- **제안**: `[PRD Graph RAG](./10-graph-rag.md)` 링크를 제거하거나, 해당 링크를 `_product-overview.md` 내 Graph RAG 관련 절로 대체한다. 이미 `## Overview (제품 정의)` 섹션이 파일 안에 있으므로 자기 참조 링크 없이도 구조가 명확하다.

---

### [INFO] `spec/5-system/1-auth.md` — `## Overview` 섹션 없이 기술 명세로 직행

- **target 위치**: `spec/5-system/1-auth.md` 전체 구조 (§1 인증~§5 API 엔드포인트, `## Rationale` 존재)
- **위반 규약**: `.claude/skills/project-planner/SKILL.md §Spec 문서 구조 (3섹션 권장)` — Overview / 본문 / Rationale 3섹션
- **상세**: `## Overview (제품 정의)` H2 섹션이 없고 `## 1. 인증 (Authentication)` 으로 바로 시작된다. `## Rationale` 은 존재한다. `5-system/` 영역에 `_product-overview.md` 가 있으나 인증 영역의 사용자 가치·보안 목표 개요가 `1-auth.md` 자체 내에는 없다. 동 영역의 다른 최근 파일(`10-graph-rag.md`, `12-webhook.md`)은 `## Overview` 를 보유한다.
- **제안**: 파일 상단에 간략한 `## Overview` 섹션을 추가해 인증/인가 시스템의 사용자 가치·보안 목표를 요약한다. "권장" 구조이므로 강제 수정 사항은 아니다.

---

### [INFO] `spec/conventions/cafe24-api-catalog/_overview.md` — convention 파일에 `## Rationale` 없음

- **target 위치**: `spec/conventions/cafe24-api-catalog/_overview.md` 전체
- **위반 규약**: `CLAUDE.md §정보 저장 위치` — "결정의 배경·근거 → 해당 spec 문서 끝의 `## Rationale`"
- **상세**: 이 파일은 `_*.md` 접두 규칙에 따라 `spec-impl-evidence.md §1` 의 frontmatter 가드에서 제외되는 layout/index 성격 문서이지만, `spec/conventions/` 하위의 정식 규약 문서로서 신규 endpoint 등재 절차·카탈로그 레이어 설계·sync 테스트 구조 결정 등 중요한 설계 결정을 담고 있다. `## Rationale` 섹션이 없어 결정 근거가 본문에 인라인으로만 산재한다.
- **제안**: 파일 끝에 `## Rationale` 섹션을 추가하고, 카탈로그 2-레이어 구조 채택 이유, `_generator.py` 산출물을 별도 레이어로 분리한 이유, sync 테스트 범위 설계 결정 등을 정리한다. INFO 수준이므로 즉각 수정 의무 없음.

---

### [INFO] `spec/conventions/cafe24-api-catalog/application/apps.md` 등 필드 레벨 파일 — frontmatter 에 `id`/`status` 없음 (의도된 예외)

- **target 위치**: `spec/conventions/cafe24-api-catalog/application/apps.md`, `application/appstore-orders.md` frontmatter
- **위반 규약**: `spec/conventions/spec-impl-evidence.md §2 Frontmatter 스키마` (`id`, `status` 의무)
- **상세**: frontmatter 에 `id`/`status` 없이 `resource`/`entity`/`cafe24_docs`/`source` 만 존재한다. 그러나 `spec-impl-evidence.md §1 적용 대상` 에서 `spec/conventions/<name>-api-catalog/<resource>/**/*.md` (카탈로그 디렉토리 뒤 세그먼트 하나 이상) 는 명시적으로 제외되어 있다 — 생성기 산출물이므로 lifecycle frontmatter 불필요. 규약 자체가 이 제외를 Rationale R-7 에서 근거를 제공하고 있다.
- **제안**: 현재 상태가 정확히 규약 §1 제외 조항을 준수하고 있으므로 수정 불요. 확인 사항으로만 기록.

---

## 요약

`spec/5-system/` 의 핵심 검토 대상 3개 파일 중, `1-auth.md` 는 `## Rationale` 존재 + `pending_plans` 실존 + frontmatter 규격 준수로 전반적으로 양호하다. 초대 API 의 `lower_snake_case` 에러 코드는 `spec/conventions/error-codes.md §3 historical-artifact 레지스트리` 에 정식 등재되어 있어 위반이 아니다. `10-graph-rag.md` 는 3섹션 구조를 완비했으나 자기 파일을 "PRD" 링크로 참조하는 혼란이 있다. `11-mcp-client.md` 는 `status: partial` + `pending_plans` 실존 조건을 충족하나 `## Rationale` 섹션 전체 누락과 preview-test 성공 응답의 `{ data: ... }` 래핑 불명확이 WARNING 수준의 규약 거리감을 만든다. `cafe24-api-catalog/` 인덱스 파일(`application.md`)과 필드 레벨 파일은 각각 적용되는 규약(`id`/`status` 보유 vs 제외)을 올바르게 따르고 있다.

---

## 위험도

**LOW**

CRITICAL 위반(invariant 파괴 수준)은 없다. WARNING 2건(`11-mcp-client.md` Rationale 누락, preview-test 성공 응답 래핑 불명확)은 문서 품질과 API 계약 명확성에 영향을 주지만 런타임 동작이나 다른 시스템의 가정을 즉시 파괴하지는 않는다.
