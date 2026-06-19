# 보안 리뷰 — Integration Usage MCP (usageKind) 변경

대상 diff: `origin/main..HEAD -- codebase/`
리뷰 일시: 2026-06-19 14:09:20

---

## 발견사항

### [INFO] CASE 식에서 `:integrationId` 파라미터 이중 선언 — 잠재적 바인딩 충돌
- **위치**: `codebase/backend/src/modules/integrations/integrations.service.ts` 라인 753–754, 767
- **상세**: `Brackets` 내부의 `.where("n.config ->> 'integrationId' = :integrationId", { integrationId: id })` 와 `.addSelect("CASE WHEN n.config ->> 'integrationId' = :integrationId THEN 'direct' ELSE 'mcp' END", 'usage_kind')` 가 동일한 named parameter `:integrationId` 를 두 번 사용한다. TypeORM QueryBuilder 는 동일 이름 파라미터를 마지막 값으로 덮어쓰지 않고 공유하므로, 현재 코드에서 두 곳 모두 동일한 `id` 값을 참조하여 동작상 문제는 없다. 그러나 향후 파라미터 값이 달라질 리팩터링 시 바인딩이 조용히 잘못될 수 있다. SQL 인젝션 위험은 없음(파라미터 바인딩 사용).
- **제안**: CASE 식 쪽 파라미터를 `:integrationIdCase` 등 별도 이름으로 분리하고 명시적으로 `setParameter('integrationIdCase', id)` 를 추가하면 의도가 명확해진다.

### [INFO] `mcpProbe` 파라미터의 인라인 `::jsonb` 캐스트
- **위치**: `integrations.service.ts` 라인 755
- **상세**: `.orWhere("n.config -> 'mcpServers' @> :mcpProbe::jsonb", { mcpProbe: JSON.stringify([{ integrationId: id }]) })` 에서 `::jsonb` 캐스트가 파라미터 플레이스홀더 바로 뒤에 붙는 PostgreSQL 전용 문법이다. `JSON.stringify()` 로 값을 직렬화하므로 SQL 인젝션은 없으나, `id` 에 큰따옴표나 백슬래시가 포함된 경우 jsonb 파싱 실패(500) 가 발생할 수 있다. `id` 는 UUID 형식이어서 실제 위험은 낮지만, 컨트롤러 레이어에서 UUID 형식 검증(class-validator `@IsUUID`)이 적용되어 있는지 확인이 필요하다.
- **제안**: 컨트롤러 DTO 에 `@IsUUID('4')` 가 이미 있다면 무시해도 좋다. 없다면 추가 권장.

### [INFO] e2e 헬퍼의 하드코딩된 기본값 자격증명
- **위치**: `codebase/backend/test/helpers/db.ts` 라인 12–14
- **상세**: `createDbClient()` 에서 `user: 'clemvion'`, `password: 'clemvion-e2e'`, `database: 'clemvion_e2e'` 가 fallback 기본값으로 하드코딩되어 있다. 이 값은 이번 diff 에서 신규 추가된 것이 아니라 기존 헬퍼에 이미 존재하는 패턴이며, e2e 전용 격리 DB 자격증명이다. 운영 환경에서는 환경변수(`DB_HOST`, `DB_PASSWORD` 등)로 override 되므로 운영 시크릿 노출은 아니다. 다만 CI 에서 환경변수 미설정 시 의도치 않은 DB에 접속될 수 있다.
- **제안**: CI 파이프라인에서 환경변수 존재 여부를 사전 점검하는 가드(assertion)를 추가하거나, 기본값을 `'MISSING'`(연결 실패 유도)으로 변경하면 사일런트 오접속을 예방할 수 있다.

### [INFO] e2e 테스트의 더미 API 키 값 `'secret'`
- **위치**: `codebase/backend/test/integration-usage-mcp.e2e-spec.ts` 라인 75
- **상세**: `createIntegration()` 함수에서 `credentials.value: 'secret'` 을 테스트용 자격증명으로 사용한다. 이는 테스트 스코프 내에서만 사용되는 더미 값으로, 실제 서비스 시크릿이 아니다. e2e DB 는 격리된 `clemvion_e2e` 에만 기록되므로 운영 환경 유출 없음.
- **제안**: 현황 유지 가능. 필요하다면 `'e2e-dummy-secret'` 처럼 명시적으로 테스트용임을 나타내는 값으로 교체하면 grep 오탐을 줄일 수 있다.

### [INFO] workspace 스코프 격리 — 정상 확인
- **위치**: `integrations.service.ts` 라인 737, 750
- **상세**: `getUsages()` 는 진입 시 `this.findById(id, workspaceId)` 를 먼저 호출하여 해당 integration 이 요청 workspaceId 에 속하는지 검증한다(`where: { id, workspaceId }`). 이후 QueryBuilder 에서도 `.where('w.workspace_id = :workspaceId', { workspaceId })` 로 노드 집계 범위를 동일 workspace 로 제한한다. 이중 스코프 체크가 올바르게 작동한다.
- **제안**: 없음.

### [INFO] SQL 인젝션 — 없음
- **위치**: `integrations.service.ts` 라인 748–772 전체 QueryBuilder 블록
- **상세**: 모든 외부 입력(`id`, `workspaceId`)이 TypeORM 파라미터 바인딩(`:integrationId`, `:workspaceId`, `:mcpProbe`)으로 처리된다. 문자열 템플릿 접합(`${...}`)이나 raw SQL 조합 없음. `JSON.stringify()` 로 생성된 `:mcpProbe` 도 파라미터로 전달되어 PostgreSQL 드라이버가 escaping 을 담당한다.
- **제안**: 없음.

---

## 요약

이번 diff 의 핵심 변경인 `getUsages()` SQL 확장(`@>` jsonb containment, Brackets OR, CASE 분기)은 보안 관점에서 양호하다. 모든 외부 입력이 파라미터 바인딩으로 처리되고, workspace 스코프 격리는 진입 시 `findById` 검증과 QueryBuilder `WHERE` 이중 레이어로 유지된다. 신규 e2e 파일에는 실제 시크릿이 포함되지 않았고, 자격증명 기본값은 이전부터 존재하는 e2e 격리 DB 전용 패턴이다. CASE 식과 Brackets 내부에서 동일한 `:integrationId` 파라미터를 공유하는 점은 현재 동작상 문제가 없으나 명시성 개선 여지가 있다.

---

## 위험도

LOW

---

STATUS: DONE
