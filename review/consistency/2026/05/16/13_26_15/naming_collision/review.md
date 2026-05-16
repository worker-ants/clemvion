# 신규 식별자 충돌 검토 — integration-attention-filter

검토 모드: `--impl-prep`
대상 scope: `spec/2-navigation/4-integration.md` + 관련 구현 파일
검토 일시: 2026-05-16

---

## 발견사항

### [WARNING] `attentionBreakdown` — i18n 키와 함수명 동일

- **target 신규 식별자**: `attentionBreakdown` (i18n 키, plan `dict/{ko,en}/integrations.ts`)와 `attentionBreakdown(integrations)` (헬퍼 함수, plan `status-badge.tsx`)
- **기존 사용처**: 두 식별자가 각각 신규이므로 직접 충돌은 없으나, 같은 이름이 동일 파일 범위(`status-badge.tsx`의 export 함수)와 i18n 딕셔너리 키(`integrations.attentionBreakdown`)로 동시에 존재하게 된다.
- **상세**: TypeScript 코드에서 `attentionBreakdown`은 함수 이름이고, i18n 딕셔너리에서 `integrations.attentionBreakdown`은 문자열 키다. 직접적인 런타임 충돌은 없지만, 코드 검색·자동완성 시 함수와 키가 동일 이름으로 혼재해 개발자가 혼동할 수 있다. i18n 키를 `attentionBreakdownLabel` 또는 `attentionDetail`로 구분하거나, 함수명을 `computeAttentionBreakdown`으로 명확히 구분하는 것이 바람직하다.
- **제안**: i18n 키를 `attentionDetail` 또는 `attentionBreakdownText`로 변경하거나, 함수명을 `computeAttentionBreakdown`으로 변경해 네임스페이스를 분리한다.

---

### [WARNING] `needsAttention` — 기존 per-item 함수와 신규 `attentionBreakdown` 함수의 역할 분리 불명확

- **target 신규 식별자**: `attentionBreakdown(integrations)` 헬퍼 (plan `status-badge.tsx`)
- **기존 사용처**: `needsAttention(integration: IntegrationDto): boolean` — `frontend/src/app/(main)/integrations/_shared/status-badge.tsx:89`, `page.tsx:26,119`
- **상세**: 기존 `needsAttention`은 단건 판정 술어(predicate)로, `page.tsx`에서 `.filter(needsAttention).length`로 `attentionCount`를 계산하는 데 사용된다. 신규 `attentionBreakdown`은 전체 목록을 받아 `{ expired, expiring, error, total, mostUrgentId }`를 반환하는 집계 함수다. 두 함수가 "attention" 판단 로직을 각각 구현하면 로직이 이원화될 수 있다. `attentionBreakdown`이 내부적으로 `needsAttention`을 호출하거나, `attentionCount` 계산을 `breakdown.total`로 대체하지 않으면 두 곳에서 attention 조건을 별도로 유지해야 하는 부담이 생긴다.
- **제안**: `attentionBreakdown`이 `needsAttention`을 내부에서 활용하거나, `page.tsx`의 `attentionCount` 계산을 `attentionBreakdown(integrations).total`로 교체해 단일 진실 원칙을 유지한다.

---

### [WARNING] `nodeConfigs.integrationSelector.needsAttention` — 기존 i18n 키와 신규 `statusAttention` 키의 의미 중첩

- **target 신규 식별자**: `statusAttention` (i18n 키, `integrations.statusAttention = "주의 필요"`)
- **기존 사용처**: `nodeConfigs.integrationSelector.needsAttention = "주의 필요"` (`frontend/src/lib/i18n/dict/ko/nodeConfigs.ts:174`, `en/nodeConfigs.ts:176`)
- **상세**: 두 키 모두 한국어로 "주의 필요" / 영어로 "needs attention"을 의미하나 서로 다른 딕셔너리 네임스페이스에 위치한다. 현재는 사용 맥락이 달라(노드 설정 패널의 통합 셀렉터 vs. 통합 목록 필터 칩 라벨) 직접 충돌은 없다. 그러나 i18n 키 검색 시 동일 의미어가 두 곳에 분산되어 있어 일관성 갱신이 누락될 수 있다.
- **제안**: 두 키가 의미상 동일하다면 공통 키로 통합을 검토한다. 맥락이 달라 분리가 필요하다면 차이를 주석으로 명시해 혼동을 예방한다.

---

### [INFO] 삭제 예정 키(`attentionPrefix`, `attentionSuffix`, `attentionSingle`) — 기존 참조 잔존 가능성

- **target 신규 식별자**: 삭제 대상 — `attentionPrefix`, `attentionSuffix`, `attentionSingle` (plan에서 제거 명시)
- **기존 사용처**: `frontend/src/lib/i18n/dict/ko/integrations.ts:46-47,55`, `en/integrations.ts:48-49,57`. `page.tsx:176-178`에서 `t("integrations.attentionPrefix")`, `t("integrations.attentionSuffix")` 를 직접 참조 중
- **상세**: 삭제 키가 `page.tsx`에서 직접 참조되고 있으므로, 딕셔너리에서 키를 제거하면서 `page.tsx` 사용처도 함께 교체해야 한다. 교체 누락 시 런타임에 i18n 미스 키(missing key) 오류 또는 키 문자열이 그대로 노출된다.
- **제안**: 키 삭제와 `page.tsx` 참조 교체를 단일 PR에서 원자적으로 처리한다. 타입 안전 i18n(`TranslationKey` 타입)을 사용 중이라면 빌드 타임에 감지된다.

---

### [INFO] `'attention'` — 백엔드 `INTEGRATION_STATUSES`에 추가 시 `Integration.status` DB 컬럼과의 의미 분리

- **target 신규 식별자**: `'attention'` — `INTEGRATION_STATUSES` 배열 및 `IntegrationStatusFilter` 타입 (backend DTO), `ListStatusFilter` 타입 (frontend)
- **기존 사용처**: `Integration.status` DB 컬럼의 실제 저장 값 목록은 `connected | expired | error | pending_install` (`spec/1-data-model.md §2.10`). `INTEGRATION_STATUSES`는 현재 `connected | expiring | expired | error` — DB 저장 상태가 아닌 필터 전용 값(`expiring`)을 이미 포함하는 구조다.
- **상세**: `'attention'` 역시 DB에 저장되지 않는 필터 전용 집합 값이므로 기존 `expiring`과 동일한 패턴을 따른다. 직접 충돌은 없으나, `INTEGRATION_STATUSES` 이름이 DB 상태(`Integration.status`)와 혼동될 수 있다. DTO Swagger description 갱신이 계획에 포함되어 있어 적절하다.
- **제안**: DTO Swagger description에 "`attention`은 DB 저장 상태가 아닌 필터 전용 집합 값(`expired + error + expiring`)임"을 명시해 API 소비자 혼동을 방지한다.

---

## 요약

이번 구현이 도입하는 신규 식별자(`'attention'` 필터 값, `attentionBreakdown` 함수·i18n 키, `statusAttention` i18n 키)는 기존 동일 이름의 다른 의미 식별자와 직접 충돌하는 CRITICAL 케이스는 없다. 다만 `attentionBreakdown` 이름이 함수와 i18n 키에 동시에 사용되는 점(WARNING), 기존 `needsAttention` 함수와 신규 `attentionBreakdown` 함수의 로직 이원화 위험(WARNING), `nodeConfigs.integrationSelector.needsAttention`과 신규 `statusAttention`의 의미 중첩(WARNING), 삭제 예정 키의 참조 잔존 가능성(INFO), `'attention'`의 DB 저장 상태와의 혼동(INFO) 등 5건이 발견되었다. CRITICAL 차단 요인은 없으므로 구현 착수 가능하나, WARNING 3건의 명명 정리를 구현과 동시에 진행하도록 권고한다.

---

## 위험도

LOW
