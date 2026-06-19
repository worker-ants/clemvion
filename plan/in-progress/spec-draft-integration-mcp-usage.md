---
worktree: agent-ae9a373e25190d9f9
role: project-planner
owner: project-planner
status: in-progress
started: 2026-06-19
---

# Spec draft — 사용처 추적에 AI Agent MCP 참조 포함 (usageKind 구분)

## 배경 (문제)

통합 사용처 추적(usage tracking)이 노드 `config.integrationId` **최상위 필드만** 스캔해서,
AI Agent 노드가 통합을 MCP 로 연결할 때 쓰는 `config.mcpServers[].integrationId`
(배열 내부 중첩)를 누락한다. 결과:

1. 통합 상세 "사용" 탭이 MCP 사용을 "사용처 없음" 으로 오탐.
2. 같은 쿼리를 쓰는 삭제 차단(§7.2)이 우회돼, **사용 중 통합이 무경고 삭제**됨
   → AI Agent 가 런타임에 파손.

게다가 spec 내부에 이미 모순이 존재한다 — §14.2·cafe24(§5.8)/makeshop(§5.9) 섹션과
INT-US-05(활동 로그)는 `mcpServers` MCP 사용을 명시/기록하면서, 사용 탭(INT-US-01/§7.1)만
이를 제외한다. 사용자가 spec-first + MCP 배지 구분 강화안을 승인했다.

## Spec 변경 요약 (4개 edit + Rationale)

### edit A — `spec/4-nodes/4-integration/_product-overview.md` §2.4 INT-US-01
사용처 추적 요구사항을 **두 참조 경로의 합집합**으로 재정의: (a) `config.integrationId`
직접 참조, (b) AI Agent `config.mcpServers[].integrationId` MCP 참조. 노드별
`usageKind`(`direct`/`mcp`) 구분 제공 명문화.

### edit B — `spec/2-navigation/4-integration.md` §7.1 사용처 조회 로직
`GET /api/integrations/:id/usages` 쿼리를 합집합으로 확장:
- (a) 직접 참조 — `config->>'integrationId' = :id`
- (b) MCP 참조 — `config->'mcpServers' @> '[{"integrationId":"<id>"}]'::jsonb` (JSONB containment)
응답 노드 항목에 `usageKind: 'direct' | 'mcp'` 추가. 두 경로 실질 배타적 + 중복 시 `direct` 우선 규칙.

### edit C — `spec/2-navigation/4-integration.md` §4.5 Usage 탭
- C-1: 다이어그램 예시 노드 행을 MCP 사용 사례(`Support Agent [MCP]`)로 교체.
- C-2: `usageKind='mcp'` 노드에 `MCP` 배지(보조 톤) 표시, `direct` 는 배지 없음 bullet 추가.

### edit D — `spec/2-navigation/4-integration.md` §7.2 삭제 차단
차단 대상에 MCP 도구로 참조하는 AI Agent 노드 포함 명시 + 다이얼로그 MCP 행 배지 구분 bullet 추가.

### edit E — `spec/2-navigation/4-integration.md` `## Rationale`
신규 `### 사용처 추적 — AI Agent MCP 참조 포함` 항 추가 (인접 "활동 로그 API 식별" 항 앞).
근거 3가지 + usageKind 도입 사유 + `@>`/GIN 확장성 기술.

## Rationale 근거 (3가지)

1. **spec 내부 정합** — §14.2·cafe24/makeshop·INT-US-05 가 이미 mcpServers MCP 사용을
   명시/기록한다. 사용 탭만 제외하면 "활동 탭엔 호출이 있는데 사용 탭엔 사용처 없음" 모순.
2. **삭제 안전성** — §7.2 삭제 차단이 같은 쿼리를 쓰므로, MCP 참조 누락은 사용 중 통합의
   무경고 삭제(AI Agent 파손)로 직결된다.
3. **사용자 신뢰** — MCP 도 정당한 사용 형태이므로 추적되는 것이 사용자 기대와 일치한다.

## Side-effect 점검

- **데이터 모델 변경 없음** — `Node.config` JSONB 구조 그대로. `usageKind` 는 API 응답
  파생 필드일 뿐 스키마 컬럼 아님.
- **마이그레이션 불필요** — 새 컬럼/인덱스 강제 없음 (GIN 인덱스는 성능 옵션, 기능 전제 아님).
- **INT-US-05 무관** — 활동 로그(`integration_usage_log`) 기록 경로는 본 변경과 별개.
  이번 변경은 "사용처(usage) 조회" 만 다루며 활동 로그 흐름은 손대지 않는다.

## 구현 위임 메모 (developer)

- backend: `getUsages` 쿼리에 OR 분기 추가 — 직접 참조(`->>` 동등) ∪ MCP 참조(`@>` containment).
- backend: 결과 노드 항목에 `usageKind` 매핑 (mcp 경로 매칭 → `'mcp'`, 직접 → `'direct'`,
  중복 시 `direct` 우선).
- frontend: §4.5 Usage 탭 + §7.2 삭제 차단 다이얼로그에 `MCP` 배지 렌더.
- i18n: `MCP` 배지 라벨/툴팁 KO·EN dict.
- test: 직접만 / MCP만 / 둘 다(동일 워크플로) / 워크스페이스 가시성 케이스 단위·통합 테스트.
  삭제 차단(409 INTEGRATION_IN_USE)이 MCP 전용 참조에서도 동작하는 회귀 테스트.

## 수동 일관성 자기검토

mandatory `/consistency-check` 는 main 전용이므로 본 worktree 에서는 수동 자기검토로 대체.

**확인한 파일:**
- `spec/2-navigation/4-integration.md` — §4.5/§7.1/§7.2/§14.2(line 1099~1101) 및
  cafe24 §5.8(AI Agent 노출, line 632) / makeshop §5.9(AI Agent 노출, line 682),
  Rationale 섹션(line 1114~).
- `spec/4-nodes/4-integration/_product-overview.md` — §2.4 INT-US-01 ~ INT-US-05.
- `spec/5-system/11-mcp-client.md` — usage(사용처) 관련 언급 유무 확인.
- `spec/data-flow/5-integration.md` — usage-log 흐름이 본 변경과 별개임 확인.

**검토 결과:**
- §14.2·cafe24/makeshop 섹션은 이미 `service_type='cafe24'/'makeshop'/'mcp'` 통합이
  AI Agent `mcpServers` 에서 사용됨을 명시한다. 본 변경은 사용처 추적을 그 현실에 **정합**시키는
  방향 — 새 모순을 만들지 않고 기존 모순(사용 탭 누락)을 해소한다.
- INT-US-05(line 1095)는 `Cafe24McpToolProvider` 등 MCP 호출도 `integration_usage_log` 에
  기록한다고 이미 명시 → "활동엔 기록되는데 사용처엔 안 잡히는" 비대칭이 본 변경으로 해소.
- `usageKind` / `direct` / `mcp` 는 신규 식별자이나 기존 spec 의 요구사항 ID·엔티티명·API
  필드와 충돌하지 않는다 (naming collision 없음).
- 데이터 모델·마이그레이션 변경 없음 → cross-spec 데이터 모델 충돌 없음.

**BLOCK: NO** — 새 충돌 미발견. 본 변경은 내부 모순 해소 방향으로, 차단 사유 없음.
