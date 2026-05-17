# Documentation Review

## 발견사항

### 신규 파일 및 공개 API 문서화

- **[INFO]** `restricted-approval.ts` (파일 10) — 신규 모듈 수준 JSDoc 존재, 공개 함수 3개(`pickRestrictedApprovalScopes`, `extractCafe24ScopeTokens`, `RESTRICTED_APPROVAL` 상수) 모두 JSDoc 주석 보유. 특히 `extractCafe24ScopeTokens`의 파싱 전략(string/shallow object 2계층)과 반환 의미가 명확히 기술되어 있어 양호.
  - 위치: `backend/src/nodes/integration/cafe24/metadata/restricted-approval.ts` 전체
  - 상세: 주요 공개 export 전부 JSDoc 커버. `SCOPE_LEVEL_RESTRICTED_SCOPES` set 도 주석으로 spec SoT 참조 명시.
  - 제안: 현행 유지.

- **[INFO]** `types.ts` (파일 12) — `Cafe24RestrictedApproval` 인터페이스와 각 필드(`level`, `approvalGroup`, `docsUrl`, `inquiryUrl`)에 인라인 JSDoc 주석 존재. `level` 의 세 값(`scope`/`operation`/`program`)의 의미 차이가 설명되어 있어 충분.
  - 위치: `backend/src/nodes/integration/cafe24/metadata/types.ts` +91 블록
  - 제안: 현행 유지.

- **[INFO]** `public-meta.ts` (파일 9) — `PublicCafe24OperationSupported.restrictedApproval` 필드에 JSDoc 추가됨. frontend 렌더 연결(`⚠ badge + tooltip`)과 SoT 참조까지 기재.
  - 위치: `backend/src/nodes/integration/cafe24/metadata/public-meta.ts` +849 블록
  - 제안: 현행 유지.

- **[INFO]** `approval-required-badge.tsx` (파일 16) — 두 공개 컴포넌트(`ApprovalRequiredBadge`, `RestrictedScopeNotice`) 모두 JSDoc 보유. 사용 위치와 SoT 링크까지 기술하여 재사용 가이드 충분.
  - 위치: `frontend/src/components/integrations/approval-required-badge.tsx` 전체
  - 제안: 현행 유지.

---

### 주석 정확성 및 인라인 주석

- **[INFO]** `integration-status-reason.ts` (파일 2) — 신규 값 `'oauth_invalid_scope'`에 블록 주석 추가. `details.requiresCafe24Approval`, 연관 status reason과의 차이, spec SoT 참조까지 명시.
  - 위치: `integration-status-reason.ts` +84~88
  - 제안: 현행 유지.

- **[INFO]** `cafe24-api.client.ts` (파일 4) — `markAuthFailed` 내 `requiresApproval` 로직에 인라인 주석 추가. `extractCafe24ScopeTokens`→`pickRestrictedApprovalScopes` 2단계 파이프라인과 `details` omit 정책(`spec/2-navigation/4-integration.md §10.4`)이 설명됨.
  - 위치: `cafe24-api.client.ts` +219~222
  - 제안: 현행 유지.

- **[INFO]** `scope-tab.tsx` (파일 13) — `requiresApprovalFromError` 파생 과정에 인라인 주석으로 backend 기입 근거(`markAuthFailed`/`markIntegrationCallbackError`) + spec 참조 두 개 기재.
  - 위치: `scope-tab.tsx` +178~181
  - 제안: 현행 유지.

- **[INFO]** `catalog-sync.spec.ts` (파일 5) — 최상단 규칙 블록(Rule 8)에 양방향 동기 규칙과 `level='program'` 제외 이유가 명시됨. 테스트 describe 블록과 규칙 번호가 1:1 대응.
  - 위치: `catalog-sync.spec.ts` +282~284
  - 제안: 현행 유지.

- **[WARNING]** `service-registry.ts` (파일 3) `ScopeOption.requiresApproval` JSDoc에 "Frontend renders a ⚠ badge + tooltip"이라는 렌더 행동이 기재되어 있으나, 실제 SoT 참조는 `spec/conventions/cafe24-restricted-scopes.md §1` 로 연결됨. 같은 필드가 `frontend/src/lib/api/integrations.ts`(파일 17)의 `ScopeOption.requiresApproval` JSDoc에도 동일 내용으로 중복 기재됨. 두 정의가 향후 독립적으로 표류할 위험이 있다.
  - 위치: `backend/src/modules/integrations/services/service-registry.ts` +130~136 / `frontend/src/lib/api/integrations.ts` +1461~1467
  - 상세: backend의 `ScopeOption`(service-registry.ts)과 frontend DTO의 `ScopeOption`(api/integrations.ts)은 별개 타입인데 JSDoc이 동일 문구로 병렬 유지되어야 한다. 어느 한쪽이 변경되면 나머지가 stale될 수 있다.
  - 제안: 두 JSDoc 중 한쪽에 "See also: [frontend/src/lib/api/integrations.ts ScopeOption]" 또는 "mirrored in backend service-registry.ts" 식의 cross-reference를 추가하거나, 공통 JSDoc 문구를 spec SoT로 일원화하여 유지 부담 명시.

---

### README / CHANGELOG / 설정 문서

- **[WARNING]** `integration-oauth.service.ts` (파일 1) — `markIntegrationCallbackError` 시그니처에 `extra?: { requiresCafe24Approval?: string[] }` 파라미터가 추가되었으나 함수 수준 JSDoc이 없다. 해당 함수는 OAuth 에러 기록의 중심 진입점(backend 공개 메서드)임에도 파라미터 설명이 전무.
  - 위치: `integration-oauth.service.ts` +788~792
  - 상세: `extra` 인자가 존재할 때와 없을 때 `lastError.details` 포함 여부가 달라지는 중요한 조건부 로직이 있으나, 호출자가 참조할 JSDoc이 없어 사용법을 코드 본문에서 추적해야 한다.
  - 제안: 함수에 JSDoc을 추가하고 `extra.requiresCafe24Approval`의 의미와 omit 조건, spec 참조(`spec/2-navigation/4-integration.md §10.4`)를 기재.

- **[INFO]** `node-definitions/types.ts` (파일 22) — `Cafe24RestrictedApproval` 프론트엔드 타입에 JSDoc 없음. 동일 구조가 `backend/src/nodes/integration/cafe24/metadata/types.ts`에는 JSDoc과 함께 정의되어 있으나 frontend 사본은 필드 설명이 없다.
  - 위치: `frontend/src/lib/node-definitions/types.ts` +1606~1611
  - 상세: `level`, `approvalGroup`, `docsUrl`, `inquiryUrl` 의미가 주석 없이 타입만 노출. backend 타입에서 이미 설명한 내용이라 중복이기는 하나, frontend 독립 타입으로 분리된 이상 소비자가 참조할 최소 JSDoc 또는 "See: backend types.ts Cafe24RestrictedApproval" 주석이 필요.
  - 제안: 최소한 SoT 참조(`spec/conventions/cafe24-restricted-scopes.md`) 한 줄과 `level` 값 의미 설명 추가 권장.

- **[INFO]** `integration-configs.tsx` (파일 15) — `supportedOp?.restrictedApproval` 조건부로 amber 경고 문구를 렌더하는 코드에 인라인 주석이 없다. 왜 `restrictedApproval`이 있을 때만 렌더하는지, tooltip 텍스트 키가 `integrations.approvalRequiredTooltip`인지 맥락을 코드에서 파악하기 어렵다.
  - 위치: `frontend/src/components/editor/settings-panel/node-configs/integration-configs.tsx` +1330~1334
  - 제안: 해당 블록에 "Cafe24 partner-approval warning — shown when the selected operation requires explicit Cafe24 approval" 정도의 한 줄 주석 추가.

- **[WARNING]** `plan/in-progress/cafe24-restricted-scopes.md` (파일 26) — Implementation phase 체크리스트(§5)에 많은 항목이 `[ ]` 미완으로 남아 있지만 실제 diff에서는 대부분 구현 완료된 상태다(backend 메타데이터 `restrictedApproval`, catalog-sync 규칙, frontend 배지 컴포넌트, i18n 키 등). Plan 문서와 실제 구현 진척 간 불일치가 발생해 있어 plan을 읽는 다음 작업자가 잘못된 상태를 인식할 수 있다.
  - 위치: `plan/in-progress/cafe24-restricted-scopes.md` §5 Implementation phase 체크리스트
  - 상세: diff 기준으로 완료된 항목: `Cafe24OperationMetadata.restrictedApproval` 필드, mileage/notification/privacy/store 메타데이터 boilerplate, catalog-sync Rule 8, frontend 공통 배지/notice 컴포넌트, scope-tab/new-page/integration-configs UI, i18n 키(한/영). 미완성: OAuth callback `invalid_scope` 분기(파일 25 별도 plan으로 분리됨).
  - 제안: 완료된 체크박스를 `[x]`로 갱신하고, OAuth callback 분기는 별도 plan(cafe24-oauth-invalid-scope-handler.md)으로 이전했음을 명시. 잔여 미완 항목이 있으면 plan을 `in-progress`에 유지하되 항목 수를 정확히 반영.

- **[INFO]** CHANGELOG 업데이트 필요성 — 변경 내용이 공개 API shape(`IntegrationDto.lastError.details`, `ScopeOption.requiresApproval`, `PublicCafe24OperationSupported.restrictedApproval`)을 확장하는 수준임에도, 이번 diff에는 backend/frontend의 CHANGELOG 파일 변경이 포함되지 않았다. plan 문서(파일 26)의 §3 영향 범위 표에는 spec 파일 CHANGELOG 갱신이 포함되어 있으나 코드 레벨 CHANGELOG는 언급이 없다.
  - 위치: 프로젝트 루트 또는 `backend/CHANGELOG`, `frontend/CHANGELOG` (존재 여부에 따라)
  - 상세: 이번 변경은 기능 추가(new feature) 수준이고 API shape 확장을 포함하므로 CHANGELOG 기록이 권장됨. spec 컨벤션 파일들에 CHANGELOG 섹션을 갱신하는 것은 plan에 명시되어 있어 spec 레벨은 커버됨.
  - 제안: 코드 레벨 CHANGELOG(존재하는 경우)에 "feat(cafe24): add `restrictedApproval` metadata, `requiresApproval` scope flag, and `lastError.details.requiresCafe24Approval` for partner-approval scopes" 항목 추가 검토.

---

### 설정/환경변수 문서화

- **[INFO]** 이번 변경에서 신규 환경변수나 설정 옵션 추가는 없음. `INQUIRY_URL`/`SCOPE_GUIDE_URL`은 하드코딩된 상수로, 운영 환경별 주입이 필요하지 않은 공개 URL이므로 별도 환경변수 문서 불필요.

---

### 예제 코드 필요성

- **[INFO]** `extractCafe24ScopeTokens` 함수는 `body: unknown` 타입을 받아 Cafe24 에러 응답에서 scope 토큰을 추출하는 비자명적 로직(정규식 + 2계층 객체 순회)을 갖는다. JSDoc에 입력 예시(string 형태와 object 형태) 또는 test case를 가리키는 `@example` 태그가 있으면 소비자가 사용 의도를 빠르게 파악할 수 있다.
  - 위치: `backend/src/nodes/integration/cafe24/metadata/restricted-approval.ts` +943~971
  - 제안: 필수는 아니나 `@example` 태그로 `{ error: { message: "mall.read_mileage is not allowed" } }` 형태의 예시 추가를 고려.

---

## 요약

전반적으로 이번 PR의 문서화 수준은 높다. 신규 모듈(`restricted-approval.ts`)과 핵심 인터페이스(`Cafe24RestrictedApproval`, `Cafe24ApprovalGroup`)에 목적·제약·SoT 참조가 명시된 JSDoc이 갖춰져 있고, 신규 컴포넌트(`ApprovalRequiredBadge`, `RestrictedScopeNotice`)도 사용 컨텍스트가 명확히 기술되어 있다. 다만 `markIntegrationCallbackError`에 신규 `extra` 파라미터가 추가되었음에도 함수 수준 JSDoc이 부재하고, 구현 완료된 plan 체크리스트가 아직 `[ ]`로 남아 있어 상태 정합성이 깨진 점, backend/frontend에 병렬로 존재하는 `ScopeOption.requiresApproval` JSDoc이 향후 표류할 여지가 있는 점이 개선 대상이다. 치명적 문서 누락은 없으며 spec SoT 참조(`spec/conventions/cafe24-restricted-scopes.md`) 패턴이 일관적으로 사용되고 있다.

## 위험도

LOW
