---
worktree: spec-sync-audit
started: 2026-06-03
owner: planner
---

# common (Integration 노드 공통 규약) — spec 약속 대비 미구현 surface

> 출처: 2026-06-03 spec-vs-code audit (review/spec-coverage/2026/06/03/08_05_49). 본 spec 을 `partial` 로 강등하며 분리한 미구현 항목 추적.
> 관련 spec: spec/4-nodes/4-integration/0-common.md

## 미구현 항목
- [x] §5 Database Query 캔버스 요약 — `database-query.schema.ts` `summaryTemplate: {{queryType|upper}} · {{query}}` (2026-06-03 구현, downscope: DSL 줄분리 미지원으로 "첫 줄" 대신 전체 query truncate).
- [x] §5 Send Email 캔버스 요약 — `send-email.schema.ts` `summaryTemplate: {{to.length}} recipients · {{subject}}` (2026-06-03 구현, downscope: 배열 슬라이스/조건 카운트 미지원으로 "to: {수신자} +N" 대신 수신자 수 + 제목).
- [ ] §5 `⚠ Missing integration` 배지 — 삭제된 Integration 참조를 감지해 캔버스 요약에 앰버 배지를 표시하는 warningRule/렌더 로직. 현재 docs mdx 에만 기술, 코드 부재. **티어3 (cross-entity 검증 — warningRule DSL 밖, 아키텍처 결정 필요, 보류).**

## 비고
- 각 항목의 근거(claim→코드부재)는 audit findings/4-nodes/4-nodes__4-integration__0-common.md 참조.
- HTTP Request / Cafe24 요약은 이미 `summaryTemplate` 으로 구현됨 (미구현 대상 아님).
- §4.2 `INTEGRATION_NOT_FOUND` 코드 부재는 본문 패치로 정정 완료(강등 사유 아님 — handler 계약 자체는 정합).

## ⚠ 재분류 (2026-06-03 groom): decision-free 아님 → planner 결정 필요
- **db-query**: `{queryType} · {쿼리 첫 줄}` 의 "첫 줄" 은 DSL 줄분리 미지원 → `{{queryType}} · {{query}}`(truncate 40자) 로 downscope 가능(minor 결정).
- **send-email**: `to: {수신자} +N` 은 `to:string[]` 에 슬라이스/조인/조건 카운트 필요 — DSL 불가. **결정 필요**(downscope vs DSL 확장).
- **⚠ Missing integration 배지**: warningRule `when` DSL 은 node config(`integrationId`)만 봄 → **삭제된 integration 존재 검증 불가**. cross-entity 검증(frontend integration 목록 또는 backend join)은 warningRule 메커니즘 밖 → **아키텍처 결정 필요**.
- 패턴(summaryTemplate): `http-request.schema.ts:234-238`, `cafe24.schema.ts:142-146`.

## send-email downscope 확정 (2026-06-03 spec-inprogress-impl2)
- send-email summaryTemplate = `{{to.length}} recipients · {{subject}}` 로 downscope 결정·구현 완료(상기 `## 미구현 항목` [x]). "to: {수신자} +N" 은 DSL 배열 슬라이스/조건 카운트 미지원으로 채택 불가. Missing-integration 배지만 티어3 잔여.

## 결정 옵션 (2026-06-13)

대상: `[ ]` §5 `⚠ Missing integration` 배지 (티어3, 아키텍처 결정).

### 맥락
배지 약속(`spec/4-nodes/4-integration/0-common.md:107`)은 노드의 `integrationId` 가 가리키는 Integration 엔티티가 **삭제됐는지**를 감지해야 한다 — 즉 "config 에 값이 있는가" 가 아니라 "그 값이 워크스페이스에 실재하는가" 라는 cross-entity 존재 검증이다. 그러나 warningRule `when` DSL 의 평가기 `evaluateWhen(expr, config)` (`codebase/packages/node-summary/src/evaluator.ts:237`) 는 인자로 **노드 자신의 config 객체만** 받는다. dot-path 도 config 내부만 탐색하므로 integration 목록·DB·워크스페이스 컨텍스트에 닿을 수 없다. 기존 통합 노드 규칙(`http-request.schema.ts:248-259`, `cafe24.schema.ts:147-163`)의 `!integrationId` 류도 "필드 미선택" 만 검사할 뿐 실재 여부는 못 본다. 따라서 배지는 warningRule 메커니즘 안에서는 표현 불가하며, 별도 데이터 소스(프론트 integration 목록 또는 백엔드 join)가 필요하다.

### 옵션 A — 프론트 캔버스 렌더 시 integration 목록 대조 (client-side cross-check)
캔버스 렌더러가 워크스페이스 integration 목록을 (이미 쓰는 React Query 캐시로) 읽어, 각 integration 노드의 `config.integrationId` 가 목록에 없으면 앰버 배지를 렌더한다. DSL 밖, 렌더러 전용 로직.
- **장점**: integration 목록은 이미 클라이언트에 존재 — `integration-selector.tsx:24`(`["integrations","list"]`), `mcp-server-selector.tsx:85`(`["integrations","mcp-capable"]`) 가 React Query 로 조회하고, `mcp-server-selector.tsx:144-152` 는 `allMcp.find(i => i.id === ref.integrationId)` → `isMissing` 라는 **완전히 동일한 cross-check 패턴**을 이미 구현해 둠. 즉 검증된 선례가 있고 백엔드 변경 0, DSL 순수성 유지.
- **단점**: 캔버스 렌더 경로(`node-config-summary.ts:61` `getConfigSummary` 는 현재 `SummaryContext` 에 integration 목록을 안 받음)에 목록을 주입하는 배선이 필요. 배지가 백엔드 SoT(`warningRules`/`evaluateWarnings`)가 아닌 렌더러 로컬 규칙이 되어, 같은 "경고" 개념이 두 메커니즘에 분산됨(SoT 분기). 목록 미로딩 타이밍엔 일시적 위양성/위음성 가능.

### 옵션 B — 백엔드가 `integrationExists` 플래그를 join 으로 계산해 응답에 포함
노드 메타/캔버스(또는 graph-warnings) 응답 직렬화 시 백엔드가 각 integration 노드의 `integrationId` 를 워크스페이스 integration 과 join 해 `integrationExists`(혹은 missing 경고)를 산출, 렌더러는 플래그만 소비.
- **장점**: 경고 SoT 가 백엔드에 일원화(현 `warningRules`/graph-warnings 철학과 합치). 프론트는 플래그만 그려 렌더러 로직 단순. 다중 클라이언트/재사용에 일관.
- **단점**: 직렬화 경로(`workflows.service.ts:488` `getGraphWarnings` 등)에 integration 테이블 join/배치 조회 추가 — 노드 수만큼 N+1 위험이 있어 `IN (...)` 배치로 막아야 함. warningRule DSL 로는 못 푸는 예외를 백엔드 직렬화에 하드코딩하므로, "warning = schema DSL" 단일 규칙에 특례가 생김. spec/5-system 직렬화 계약 개정 동반.

### 옵션 C — warningRule DSL 을 cross-entity lookup 지원하도록 확장
`when` DSL 에 `exists(integration, integrationId)` 류 lookup 원시함수를 추가하고, 평가기에 integration 목록(또는 조회 콜백) 컨텍스트를 주입한다.
- **장점**: 범용 — 향후 다른 cross-entity 경고(삭제된 변수·삭제된 sub-workflow 등)도 같은 메커니즘으로 선언적 표현 가능. 경고가 schema SoT 에 남음.
- **단점**: `evaluateWhen(expr, config)` 시그니처(`evaluator.ts:237`)를 `(expr, config, ctx)` 로 확장 → **모든 노드의 평가 경로**(프론트 렌더·백엔드 `metadata-validation.ts` 양쪽)와 컨텍스트 공급선을 손대는 광범위·고비용 변경. 단일 배지 하나를 위해 DSL 을 범용 lookup 엔진으로 키우는 과잉. lookup 데이터 소스(프론트 캐시 vs 백엔드 DB)를 결국 또 정해야 해 A/B 의 선택을 미루는 것에 불과.

### 옵션 D — 배지 약속을 spec 에서 제거/강등 (미구현 명시)
`0-common.md:107` 의 배지 계획을 삭제하거나 "미구현(향후 검토)" 로 명시 강등해 spec-impl 갭을 닫는다.
- **장점**: 구현·테스트 비용 0, 즉시 spec↔code 정합. 코드가 없는 약속을 spec 에서 빼 audit 노이즈 제거.
- **단점**: 삭제된 integration 을 참조하는 노드가 캔버스에서 무징표로 남아 사용자가 런타임 `RESOURCE_NOT_FOUND`(→ `INTEGRATION_CALL_FAILED`, `0-common.md:87`) 까지 못 알아챔 — 실사용 가치(stale 참조 조기 발견)를 포기. MCP selector 는 이미 같은 UX 를 제공하므로 노드 캔버스만 빠지는 불일치가 남음.

### 권장안 — 옵션 A
근거: ① 필요한 데이터(integration 목록)가 **이미 클라이언트에 있고**, `mcp-server-selector.tsx:144-152` 가 동일한 missing 판정 패턴을 검증된 형태로 운영 중 — 재사용·일관 UX 확보. ② warningRule DSL 의 순수성(config-only)을 깨지 않아 C 의 광역 리스크를 피함. ③ 백엔드 join/N+1·직렬화 계약 개정(B)을 불필요하게 만듦 — 배지는 본질적으로 "현재 보고 있는 사용자의 워크스페이스 목록 대비" 표시이므로 클라이언트 렌더 시점 판정이 자연스러움. SoT 분산 우려(단점)는 "배지는 warningRule 이 아니라 렌더러 전용 cross-entity 표식" 임을 spec 에 명시해 봉합한다. cross-entity 경고가 향후 다수 등장하면 그때 C 로 일반화 재평가.

### 트레이드오프 / downstream
- **공통**: spec 본문(`0-common.md:107`)을 `project-planner` 로 개정(배지 작동 방식·데이터 소스 명문화) → `consistency-check --spec` 의무. 그 후 `developer` 가 구현.
- **A(권장)**: 프론트 단일 변경 — `getConfigSummary`/캔버스 노드에 integration 목록 주입 배선 + 배지 렌더. 백엔드·DSL 무변경. 비용 최소.
- **B**: 백엔드 직렬화에 join/serialization 추가(N+1 배치 처리 필수) + spec/5-system 응답 계약 개정 동반.
- **C**: `evaluateWhen` 시그니처·평가 컨텍스트 공급선을 **전 노드**에 걸쳐 변경하는 generic DSL 개정 — blast radius 최대, 회귀 테스트 광범위.
- **D**: 구현 비용 0이나 사용자 가치 포기 — 다른 옵션 채택 시 자연 폐기되는 fallback.
