# 신규 식별자 충돌 검토 결과

검토 모드: --impl-done (scope=spec/2-navigation/4-integration.md, diff-base=origin/main)
검토 대상 신규 식별자: `IntegrationUsageNodeDto`, `usageKind`, i18n `usageMcpBadge`, e2e 파일명 `integration-usage-mcp.e2e-spec.ts`

---

## 발견사항

### INFO-1: `IntegrationUsageNodeDto` — 기존 내부 인터페이스 `IntegrationUsageNode` 와 명명 계층 일관

- target 신규 식별자: `IntegrationUsageNodeDto` (DTO 클래스, `integration-response.dto.ts`)
- 기존 사용처: `codebase/backend/src/modules/integrations/integrations.service.ts:173` — `export interface IntegrationUsageNode { id, label, type }` (내부 서비스 레이어 인터페이스)
- 상세: 두 식별자는 다른 레이어에 속한다. `IntegrationUsageNode`(인터페이스)는 서비스 내부 도메인 타입이고, `IntegrationUsageNodeDto`(클래스)는 API 응답 직렬화 타입이다. 명명 접미사(`Dto`)가 레이어를 구분하므로 의미 충돌은 없다. 기존 코드베이스에서 `IntegrationUsageNodeDto`라는 이름은 main 브랜치에 전혀 존재하지 않아 이름 충돌 자체도 없다.
- 제안: 현행 유지. 단, 향후 서비스 내부 인터페이스 `IntegrationUsageNode` 에도 `usageKind` 필드가 추가되었는지 확인하는 것이 좋다 (diff 상 `integrations.service.ts:261` 에서 추가 확인됨 — 정합).

### INFO-2: `usageKind` 필드 — 기존 `nodes` 인라인 타입과의 shape 확장

- target 신규 식별자: `usageKind: 'direct' | 'mcp'` (DTO 필드, 내부 인터페이스 필드, 프론트엔드 `UsageWorkflow.nodes` 인라인 타입)
- 기존 사용처:
  - `codebase/backend/src/modules/integrations/dto/responses/integration-response.dto.ts:331` — `nodes: Array<{ id: string; label: string; type: string }>` (usageKind 없음)
  - `codebase/frontend/src/lib/api/integrations.ts:162` — `nodes: { id: string; label: string; type: string }[]` (usageKind 없음)
- 상세: main 브랜치 기존 shape 에 `usageKind` 가 없으므로 추가는 순수 확장(additive)이다. 기존에 같은 이름 `usageKind` 로 다른 의미를 가진 식별자가 없어 충돌 없음. spec `§7.1` 은 `nodes: [{ id, label, type }]` 만 명시하고 있어 구현이 spec 보다 앞서 있으나, 이는 spec 업데이트 누락 문제이지 식별자 충돌이 아니다.
- 제안: 현행 유지. spec/2-navigation/4-integration.md §7.1 의 `nodes` 스키마 기술을 `{ id, label, type, usageKind }` 로 업데이트하는 별도 spec PR 권장(식별자 충돌 범위 외).

### INFO-3: i18n 키 `usageMcpBadge` — 기존 `usage*` 키군과 일관

- target 신규 식별자: `usageMcpBadge` (i18n key, `en/integrations.ts`, `ko/integrations.ts`)
- 기존 사용처:
  - `codebase/frontend/src/lib/i18n/dict/en/integrations.ts:121` — `usageEmpty`, `usageSummary`
  - `codebase/frontend/src/lib/i18n/dict/ko/integrations.ts:119` — `usageEmpty`, `usageSummary`
- 상세: 기존 `usage` prefix 키군(`usageEmpty`, `usageSummary`)의 명명 패턴과 일치한다. main 브랜치에 `usageMcpBadge` 라는 키는 존재하지 않으므로 중복/충돌 없음.
- 제안: 현행 유지.

### INFO-4: e2e 파일명 `integration-usage-mcp.e2e-spec.ts` — 기존 e2e 명명 컨벤션 준수

- target 신규 식별자: `codebase/backend/test/integration-usage-mcp.e2e-spec.ts`
- 기존 사용처: `codebase/backend/test/` 디렉토리의 기존 파일들 — `integration-attention-filter.e2e-spec.ts`, `integration-cache-invalidate.e2e-spec.ts`, `integration-cafe24-install.e2e-spec.ts` 등
- 상세: `integration-<feature>.e2e-spec.ts` 패턴을 따른다. main 브랜치에 동일 파일명이 존재하지 않으므로 경로 충돌 없음. `integration-usage-*` prefix 의 다른 파일도 없음.
- 제안: 현행 유지.

---

## 요약

PR #633 이 도입하는 신규 식별자(`IntegrationUsageNodeDto`, `usageKind`, `usageMcpBadge`, `integration-usage-mcp.e2e-spec.ts`)는 main 브랜치의 기존 코드베이스 및 spec 어디에서도 다른 의미로 사용 중인 동일 이름이 없다. `IntegrationUsageNodeDto`는 기존 내부 인터페이스 `IntegrationUsageNode`와 명명이 유사하지만 레이어 접미사(`Dto`)로 명확히 구분되며 의미도 대응 관계다. `usageKind`는 기존 `nodes` shape 의 순수 additive 확장이고, `usageMcpBadge`는 기존 `usage*` i18n 키군 패턴과 일치한다. e2e 파일명도 기존 컨벤션을 준수하며 경로 충돌이 없다. Critical 또는 Warning 수준의 식별자 충돌은 발견되지 않았다.

---

## 위험도

NONE

---

Critical 건수: 0건
