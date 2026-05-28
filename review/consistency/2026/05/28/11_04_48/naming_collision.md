# 신규 식별자 충돌 검토 — `spec/conventions/cafe24-api-metadata.md`

검토 모드: `--impl-prep` (구현 착수 전)
검토 일시: 2026-05-28

---

## 발견사항

### 1. [CRITICAL] `Cafe24OperationMetadata.label` — spec 제거 선언 vs 코드 전반 현존

- **target 신규 식별자**: 해당 없음 (제거 선언). spec §2 CHANGELOG 2026-05-28 (label 제거) 행은 `Cafe24OperationMetadata.label: string` 을 **완전 제거**한다고 명시한다.
- **기존 사용처**:
  - `codebase/backend/src/nodes/integration/cafe24/metadata/types.ts:125` — `Cafe24OperationMetadata` 인터페이스의 `label: string` 필드가 존재
  - `codebase/backend/src/nodes/integration/cafe24/metadata/public-meta.ts:45,62,104,122` — `PublicCafe24OperationSupported.label: string`, `PublicCafe24OperationPlanned.label: string`, `toPublicSupportedOperation` 이 `op.label` 참조, `toPublicPlannedOperation` 이 `op.label` 참조
  - `codebase/frontend/src/lib/node-definitions/types.ts:250,266` — `Cafe24SupportedOperation.label: string`, `Cafe24PlannedOperation.label: string`
  - `codebase/frontend/src/components/editor/settings-panel/node-configs/integration-configs.tsx:485,486,490` — 노드 에디터 operation 드롭다운 렌더에서 `op.label` 직접 사용
  - 18개 resource metadata 파일 전체 (personal.ts, mileage.ts, privacy.ts, category.ts 등) — 모든 row 가 `label: '한국어 하드코딩'` 을 포함
- **상세**: spec 은 `label` 을 제거하고 `/nodes/definitions` 응답의 `extras.operationsByResource[].label` → `labelKey` 로 필드명을 변경하겠다고 선언하지만, 코드베이스 전반에 `label` 이 그대로 남아 있다. spec 자체는 이를 "frontend ↔ backend 동시 머지 필요 (호환성 단절)" 로 인지하고 있으나, 현재 상태에서는 spec 과 구현 간 충돌이 명확하다. 구현자가 backend `types.ts` 의 `label` 만 제거하고 frontend `Cafe24SupportedOperation.label` 을 유지하거나, 반대로 frontend 만 갱신할 경우 타입 불일치로 런타임 드롭다운이 빈 라벨을 표시한다.
- **제안**: 구현 착수 시 반드시 backend `types.ts` / `public-meta.ts` / 18개 resource 파일 / frontend `types.ts` / `integration-configs.tsx` 를 단일 PR 로 묶어 동시 처리해야 한다. spec CHANGELOG 가 이미 이 요구사항을 명시하고 있다 — 부분 적용 금지.

---

### 2. [WARNING] `operationsByResource[].label` → `labelKey` 필드명 변경 — frontend 타입과 미정렬

- **target 신규 식별자**: `labelKey` (노드 에디터 extras payload 의 필드명 — `extras.operationsByResource[].labelKey`)
- **기존 사용처**:
  - `codebase/frontend/src/lib/node-definitions/types.ts:250,266` — `Cafe24SupportedOperation.label`, `Cafe24PlannedOperation.label` 이 현재 타입 정의에 존재
  - `codebase/frontend/src/components/editor/settings-panel/node-configs/integration-configs.tsx:485,486,490` — `op.label` 을 소비
  - `codebase/frontend/src/components/editor/settings-panel/node-configs/__tests__/cafe24-config.test.tsx:103-105` — `operationsByResource` mock 이 현재 `label` 기반
- **상세**: `labelKey` 는 codebase 의 다른 맥락 (schedules/page.tsx, workflows/page.tsx, integrations/page.tsx 등) 에서 `{ labelKey: TranslationKey }` 패턴으로 이미 광범위하게 쓰이고 있다. 의미는 동일 — i18n dict lookup key. 따라서 **개념 충돌은 없다**. 그러나 cafe24 extras 의 새 `labelKey` 는 형식이 `TranslationKey` (기존 패턴) 가 아닌 `cafe24.<resource>.<operation>` catalog key 이므로, 기존 `TranslationKey` 타입으로 선언하면 TypeScript 가 좁혀진 string literal union 을 기대할 수 있어 타입 충돌 가능성이 있다. 구현 시 `string` 또는 별도 type alias 로 선언해야 한다.
- **제안**: frontend `types.ts` 의 `Cafe24SupportedOperation` / `Cafe24PlannedOperation` 에서 `label: string` → `labelKey: string` 으로 갱신할 때, `TranslationKey` 타입을 사용하지 않고 명시적 `string` 으로 유지해야 기존 `TranslationKey` 패턴과의 타입 혼동을 방지한다. JSDoc 에 "형식: `cafe24.<resource>.<operation>`" 을 명시하면 충분하다.

---

### 3. [WARNING] `cafe24Catalog` i18n dict 네임스페이스 — 기존 코드와 일치하지만 spec 묘사 방식이 다름

- **target 신규 식별자**: `cafe24Catalog.<key>` (i18n dict 접두어, spec §7.5 및 Rationale "backend label 제거")
- **기존 사용처**:
  - `codebase/frontend/src/lib/i18n/dict/ko/cafe24Catalog.ts:15` — `export const cafe24Catalog: Record<string, string>` 이미 존재
  - `codebase/frontend/src/lib/i18n/dict/en/cafe24Catalog.ts:11` — 동일 구조로 존재
  - `codebase/frontend/src/app/(main)/integrations/[id]/page.tsx:824` — `` `cafe24Catalog.${catalogKey}` as TranslationKey `` 패턴 이미 사용 중
- **상세**: `cafe24Catalog` dict 와 `cafe24Catalog.<key>` 형식은 이미 codebase 에 구현되어 있다. spec 이 새로 도입하는 것처럼 서술하지만 실제로는 기존 코드와 일치한다. 충돌은 없다. 단, spec 의 §7.5 표에서 "i18n 변환 (단일 진실)" 행의 `labelKey → 사람 친화 라벨` 명시는 `/nodes/definitions` 응답의 새 `labelKey` 필드를 통한 경로와, 기존 `api_label` catalog key 를 통한 활동 로그 렌더 경로 두 가지를 동일 dict 에서 처리함을 뜻한다. 단일 dict 로 두 경로를 처리하는 것은 올바른 설계이나, 구현자가 두 경로가 같은 `cafe24Catalog` dict 를 사용한다는 점을 명시적으로 인지해야 한다.
- **제안**: 문제 없음. 구현 시 두 소비 경로 (활동 로그 라벨 렌더 vs 노드 에디터 드롭다운) 가 동일 `cafe24Catalog` dict key 형식을 사용함을 테스트로 보호하면 충분하다.

---

### 4. [INFO] `descriptionKey` — catalog endpoint 응답 신규 필드, 기존 사용처 없음

- **target 신규 식별자**: `descriptionKey` (catalog endpoint 응답 shape `{ key, method, path, labelKey, descriptionKey }` 의 일부)
- **기존 사용처**:
  - `codebase/backend/src/modules/integrations/dto/responses/integration-response.dto.ts:168` — `descriptionKey?: string` 이미 DTO 에 존재
  - spec §7.5 와 `spec/2-navigation/4-integration.md:745` 가 동일 형식으로 참조
- **상세**: `descriptionKey` 는 이미 backend DTO 에 구현되어 있다. spec 과 코드 간 일치한다. 다른 맥락에서 `descriptionKey` 라는 이름이 다른 의미로 사용되는 곳은 발견되지 않는다.
- **제안**: 특이 사항 없음.

---

### 5. [INFO] `OperationCatalogDto` vs `ServiceCatalogDto` — DTO 이름 이미 정렬됨

- **target 신규 식별자**: `OperationCatalogDto` (spec §7.5 Rationale 에서 기존 `ServiceCatalogDto` 와 혼동 방지 목적으로 명시)
- **기존 사용처**:
  - `codebase/backend/src/modules/integrations/dto/responses/integration-response.dto.ts:177` — `OperationCatalogDto` 이미 선언
  - `codebase/backend/src/modules/integrations/integrations.controller.ts:44,141` — 이미 import 및 사용
  - `ServiceCatalogDto` 는 동일 파일 :138 에 존재 (서비스 목록 endpoint 용)
- **상세**: 두 DTO 가 이미 분리되어 있고 충돌 없음. spec 의 의도대로 구현되어 있다.
- **제안**: 특이 사항 없음.

---

### 6. [INFO] `cafe24.<resource>.<operation>` catalog key 형식 — `api_label` 컬럼과 정렬

- **target 신규 식별자**: catalog key 형식 `cafe24.<resource>.<operation>` (§7.5 명문화)
- **기존 사용처**: `spec/1-data-model.md:744` 의 `IntegrationUsageLog.api_label` 컬럼 설명에 이미 `cafe24.<resource>.<operation>` 형식이 명시되어 있고, `spec/2-navigation/4-integration.md` 및 `spec/4-nodes/4-integration/_product-overview.md` INT-US-05 에서도 동일 형식을 참조한다. 형식 자체는 신규 도입이 아니라 §7.5 에서 이를 단일 SoT 로 명문화하는 것이다.
- **상세**: 충돌 없음. 기존 참조와 완전히 일치한다.
- **제안**: 특이 사항 없음.

---

## 요약

target 문서(`spec/conventions/cafe24-api-metadata.md`)가 2026-05-28에 도입하는 신규 식별자 중 진정한 명명 충돌은 없다. `labelKey`, `descriptionKey`, `cafe24Catalog`, `OperationCatalogDto` 등은 이미 codebase 에서 동일 의미로 구현되어 있어 spec 과 코드가 정렬되어 있다. 그러나 CRITICAL 항목으로 분류된 핵심 위험이 있다: spec 이 `Cafe24OperationMetadata.label` 필드를 완전 제거하겠다고 선언하는 반면, 코드베이스의 backend `types.ts`, `public-meta.ts`, 18개 resource 파일, frontend `types.ts`, `integration-configs.tsx` 전반에 `label` 이 여전히 존재한다. 이는 spec 이 명시한 "frontend ↔ backend 동시 머지 필요 (호환성 단절)" 조건이 아직 충족되지 않은 상태임을 의미하며, 부분 적용 시 노드 에디터 드롭다운에서 라벨이 누락되거나 `undefined` 로 노출되는 런타임 회귀가 발생한다. `labelKey` 도입 시 기존 frontend 의 `TranslationKey` 타입 패턴과 형식이 달라 타입 선언 주의가 필요하다.

---

## 위험도

HIGH
