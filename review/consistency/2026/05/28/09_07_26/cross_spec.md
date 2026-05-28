# Cross-Spec 일관성 검토 결과

검토 모드: `--impl-prep` (구현 착수 전, scope=spec/)
대상 변경 범위: integration-activity-api-label — `integration_usage_log` 에 `api_label`/`api_method`/`api_path` 3컬럼 추가 + `GET /api/integrations/services/:type/catalog` 신규 endpoint

---

## 발견사항

### 1. **[WARNING]** `spec/5-system/11-mcp-client.md §8.3` IntegrationUsageLog 필드 테이블이 신규 컬럼 미반영

- **target 위치**: `spec/conventions/cafe24-api-metadata.md §7.5` 행 "catalog key 발급" — "`Cafe24McpBridge` (`logUsage` 호출 시)" 라고 명시하여 MCP Bridge 경로에서도 `api_label`/`api_method`/`api_path` 를 채운다고 기술함. `spec/4-nodes/4-integration/4-cafe24.md §8.5` 도 동일 의도로 "MCP 측 호출도 동일한 `IntegrationUsageLog` 에 기록된다" 라고 기술함.
- **충돌 대상**: `spec/5-system/11-mcp-client.md §8.3 IntegrationUsageLog` 필드 테이블 (`status`, `error`, `duration_ms` 3개 필드만 열거됨 — `api_label`/`api_method`/`api_path` 없음).
- **상세**: MCP Client spec §8.3 은 Integration 노드의 usage 로깅 패턴이 MCP 호출에도 적용된다고 하면서, 필드 테이블에는 3개 기존 필드만 명시한다. 신규 3컬럼을 개별 핸들러 spec (cafe24 §8.5, cafe24-api-metadata §7.5) 이 언급하지만, MCP 호출 경로를 최종 권위로 정의하는 `11-mcp-client.md §8.3` 이 갱신되지 않아 다른 spec 기술과 이 테이블 간에 기술 불일치가 존재한다. 구현자가 §8.3 테이블만 보면 MCP bridge 경로에서 `api_label`/`api_method`/`api_path` 를 `logUsage` 에 전달해야 한다는 의무를 인지하지 못할 수 있다.
- **제안**: `spec/5-system/11-mcp-client.md §8.3` 의 필드 테이블에 다음 3행을 추가하고, "Internal Bridge (`Cafe24McpBridge`) 경로에서는 `api_label`/`api_method`/`api_path` 도 함께 전달" 하는 의무를 명시. 외부 MCP 서버 경로 (`service_type='mcp'`) 에서는 catalog key 개념이 없으므로 세 필드가 NULL 임을 구분 기술.

---

### 2. **[INFO]** `GET /api/integrations/services/:type/catalog` — URL 중첩 깊이가 API 규약 권장치(2단계) 초과

- **target 위치**: `spec/2-navigation/4-integration.md §9.3` — `GET /api/integrations/services/:type/catalog` 신규 endpoint 등록.
- **충돌 대상**: `spec/5-system/2-api-convention.md §2.2` — "중첩은 2단계까지 (`/api/knowledge-bases/:id/documents`)" 규칙.
- **상세**: 신규 경로는 `/api/integrations` 이후 `services`, `:type`, `catalog` 로 3단계 중첩이다. API 규약 §2.2 는 2단계까지를 권장하고 3단계 이상은 최상위로 분리하도록 안내한다. 단, `POST /api/integrations/oauth/begin` 이 이미 동일하게 2단계 구조(oauth/begin)를 사용하고 있어 이 경로도 사실상 동일 패턴의 선례가 있다. 또한 신규 경로의 `services` 고정 세그먼트는 NestJS 라우터에서 `/:id` 파라미터보다 우선하므로 기존 `GET /api/integrations/:id` 와 충돌하지 않는다.
- **제안**: 현재 선례(oauth/begin 패턴)와 일관성이 있으므로 충돌 수준은 아니나, `spec/5-system/2-api-convention.md §2.2` 의 예외 조항("RPC-style 액션") 또는 "static-prefix 비UUID 경로" 유형으로 카탈로그 endpoint 를 명시적으로 분류하는 한 줄을 추가해 향후 동일 패턴 사용 시 근거를 남겨 두면 좋다. 이는 필수가 아닌 문서화 개선.

---

### 3. **[INFO]** `database-query` 핸들러의 `queryType='raw'` 경로 — `api_method` 추출 실패 정책이 단일 진실인지 확인 필요

- **target 위치**: `spec/4-nodes/4-integration/2-database-query.md §활동 로그 API 식별 정보` — "`queryType='raw'` 인 경우 evaluated SQL 의 첫 토큰을 대문자로 추출 — 추출 실패 시 NULL".
- **충돌 대상**: `spec/4-nodes/4-integration/_product-overview.md` INT-US-05 표 — `database-query` 의 `api_method` = "SQL 동사 (`SELECT` / `INSERT` / `UPDATE` / `DELETE`)" 로만 기술하고 `raw` 분기의 NULL 폴백을 명시하지 않음.
- **상세**: INT-US-05 표는 `database-query` 의 `api_method` 를 4개 enum 으로만 기술하지만, database-query spec 본문에서는 `queryType='raw'` 일 때 첫 토큰 추출 실패 시 NULL 이 가능하다고 추가 기술한다. 이는 모순이 아닌 세부 기술의 누락으로 분류되나, INT-US-05 표가 "단일 진실"이라고 명시되어 있어(`본 표가 단일 진실 — 위배는 §4.6 / §9.3 의 UI 분기와 직접 어긋난다`) 표 자체가 완전하지 않으면 혼동 여지가 있다.
- **제안**: INT-US-05 표의 `database-query` `api_method` 셀에 "`queryType='raw'` 시 첫 토큰 추출, 실패 시 NULL" 를 각주로 추가해 두 spec 이 완전히 정합되도록 한다. 구현 차단 수준은 아님.

---

## 요약

Cross-Spec 일관성 관점에서 이번 변경 범위(통합 활동 로그 API 식별 3컬럼 + catalog endpoint)의 핵심 데이터 모델 정의, 요구사항 ID(INT-US-05), 상태 전이, RBAC 정책은 관련 spec 간에 일관되게 기술되어 있다. 한 가지 주목할 누락은 `spec/5-system/11-mcp-client.md §8.3` 의 `IntegrationUsageLog` 필드 테이블이 신규 3컬럼을 포함하지 않는 점으로, `cafe24-api-metadata §7.5` 와 `cafe24 §8.5` 가 MCP Bridge 경로에서도 api_label/method/path 를 채운다고 기술하는 것과 불일치한다. 구현자가 MCP client spec 만 참조할 경우 Cafe24McpBridge 경로의 `logUsage` 호출에 `api` 인자를 누락할 위험이 있으며, 이를 WARNING 등급으로 분류한다. 나머지 두 건은 명명 일관성 및 표 완전성 관련 INFO 수준이다. 본 변경의 구현 착수를 차단하는 CRITICAL 충돌은 발견되지 않았다.

---

## 위험도

**LOW**

(WARNING 1건: MCP Client spec §8.3 필드 테이블 누락 — 구현 착수를 차단하지는 않으나 MCP bridge 경로 구현 시 `api` 인자 누락 위험. INFO 2건: 구현과 무관한 문서화 정합성.)
