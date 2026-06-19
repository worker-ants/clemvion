# 신규 식별자 충돌 검토 결과

검토 모드: --impl-done  
대상 scope: `spec/2-navigation/4-integration.md`  
diff-base: origin/main

---

## 발견사항

충돌로 판정된 항목이 없습니다. 아래는 각 관점별 검토 결과입니다.

### [INFO] IntegrationUsageNodeDto — 동일 모듈 내 명명 계층 확인

- target 신규 식별자: `IntegrationUsageNodeDto` (클래스, `/codebase/backend/src/modules/integrations/dto/responses/integration-response.dto.ts` line 323)
- 기존 사용처:
  - `IntegrationUsageNode` (인터페이스, `integrations.service.ts` line 173) — 서비스 계층 내부 타입
  - `IntegrationUsageLog` (엔티티, `entities/integration-usage-log.entity.ts` line 19) — DB 호출 이력 엔티티
  - `IntegrationUsageParams` (인터페이스, `nodes/integration/_base/integration-handler-base.ts` line 17) — 핸들러 로깅 파라미터
  - `IntegrationUsageItemDto` (클래스, `integration-response.dto.ts` line 343) — 기존 DTO (워크플로우 단위 응답)
  - `IntegrationUsagesDto` (클래스, `integration-response.dto.ts` line 358) — 최상위 응답 래퍼
- 상세: 모두 `IntegrationUsage` 프리픽스를 공유하지만 각각 다른 책임 계층(`Log`=DB 이력, `Params`=핸들러 입력, `Node`=서비스 내부, `NodeDto`=HTTP 응답)에 속하며 의미가 명확히 구분된다. 이름 충돌은 없고, 계층 일관성도 유지된다 (`Node` → `NodeDto` 대응은 기존 `Item` → `ItemDto` 패턴과 동형).
- 제안: 현행 유지. 추가 조치 불필요.

### [INFO] usageKind 필드명 — 다른 모듈에서의 동일 필드명 사용 없음

- target 신규 식별자: `usageKind: 'direct' | 'mcp'` (백엔드 `IntegrationUsageNode` 인터페이스 및 `IntegrationUsageNodeDto`, 프런트엔드 `UsageWorkflow.nodes` 인라인 타입)
- 기존 사용처: 검색 결과 `usageKind` 필드명은 이번 PR 이전에 코드베이스 어디에도 존재하지 않았다. origin/main 의 `integrations.service.ts` 및 `integration-response.dto.ts` 에도 부재. `usage_kind` SQL 별칭도 신규.
- 상세: 충돌 없음. 'direct' | 'mcp' 리터럴 값은 타 모듈에서도 `service_type='mcp'` 구분자로 사용되나, 그쪽은 Integration 엔티티의 `serviceType` 필드이며 이번 PR 의 `usageKind` 와 의미 도메인이 다르다(`서비스 종류` vs `노드의 통합 참조 방식`). 혼동 위험 낮음.
- 제안: 현행 유지.

### [INFO] i18n 키 usageMcpBadge — 기존 integrations 네임스페이스 내 중복 없음

- target 신규 식별자: `integrations.usageMcpBadge` (`codebase/frontend/src/lib/i18n/dict/en/integrations.ts` line 123, `ko/integrations.ts` line 121)
- 기존 사용처: `integrations` i18n 딕셔너리에는 이미 `usageEmpty`, `usageSummary` 키가 존재한다. `usageMcpBadge` 는 origin/main 에 없었고, 유사 키도 없다.
- 상세: `usage` 프리픽스 그룹 내 새로운 키이며 기존 키와 충돌하지 않는다. 네이밍 컨벤션(`usage` + 기능 설명)과도 일치한다.
- 제안: 현행 유지.

### [INFO] e2e 파일 integration-usage-mcp.e2e-spec.ts — 기존 파일명과 충돌 없음

- target 신규 식별자: `codebase/backend/test/integration-usage-mcp.e2e-spec.ts`
- 기존 사용처: 동일 디렉토리에 `integration-attention-filter.e2e-spec.ts`, `integration-cache-invalidate.e2e-spec.ts`, `integration-cafe24-*.e2e-spec.ts`, `integration-credentials.e2e-spec.ts`, `integration-makeshop-*.e2e-spec.ts` 가 존재한다.
- 상세: `integration-usage-mcp` 는 기존 파일명과 겹치지 않는다. `integration-<기능>-<세부>.e2e-spec.ts` 컨벤션과 일치한다.
- 제안: 현행 유지.

---

## 요약

PR #633 이 도입하는 신규 식별자 4종(`IntegrationUsageNodeDto`, `usageKind: 'direct'|'mcp'`, i18n 키 `integrations.usageMcpBadge`, e2e 파일 `integration-usage-mcp.e2e-spec.ts`) 은 기존 코드베이스 어디에서도 동일한 이름이 다른 의미로 사용된 사례가 발견되지 않았다. `IntegrationUsage*` 프리픽스 계열은 이미 같은 모듈에 여러 타입이 존재하지만 책임 계층이 명확히 구분되어 있고, 이번 추가도 그 패턴을 따른다. `usageKind` 의 `'direct'|'mcp'` 값이 타 모듈의 `serviceType='mcp'` 와 표면상 유사하나 의미 도메인이 달라 혼동 가능성이 낮다.

---

## 위험도

NONE
