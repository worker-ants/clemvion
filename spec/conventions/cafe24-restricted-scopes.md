# CONVENTION: Cafe24 별도 승인이 필요한 Scope · Operation

> 관련 문서: [Cafe24 API Metadata 컨벤션](./cafe24-api-metadata.md) · [Cafe24 API Catalog](./cafe24-api-catalog/_overview.md) · [Spec 통합 화면 §5.8 Cafe24](../2-navigation/4-integration.md#58-cafe24) · [Spec Cafe24 노드](../4-nodes/4-integration/4-cafe24.md) · [Spec Integration 데이터 모델](../1-data-model.md#210-integration)

Cafe24 Admin API 의 일부 scope·operation 은 카페24 본사가 별도로 승인한 클라이언트만 사용할 수 있다. 공식 문서가 다음 문구로 명시한다:

> "해당 API는 특정 클라이언트만 사용할 수 있는 API입니다. 사용하시려면 카페24 개발자센터로 문의해주세요."

본 컨벤션은 그 명단을 single-source-of-truth 로 박제한다. backend 메타데이터의 `restrictedApproval` 필드 ([cafe24-api-metadata 컨벤션 §2](./cafe24-api-metadata.md#2-operation-메타데이터-형식)) 와 catalog 파일의 `restricted` 컬럼 ([cafe24-api-catalog _overview §2](./cafe24-api-catalog/_overview.md#2-표-컬럼-정의)) 이 본 명단과 일치해야 하며, `catalog-sync.spec.ts` 가 동기 검증을 강제한다.

---

## 1. Scope 단위 별도 승인 (resource 전체 영향)

해당 scope 가 부여된 OAuth 동의 자체가 본사 승인 없이는 실패한다. 자매 operation 모두 영향을 받는다.

| Scope | Resource (catalog 파일) | 설명 |
|---|---|---|
| `mall.read_mileage` | [mileage.md](./cafe24-api-catalog/mileage.md) | 적립금 조회 |
| `mall.write_mileage` | [mileage.md](./cafe24-api-catalog/mileage.md) | 적립금 수정 |
| `mall.read_notification` | [notification.md](./cafe24-api-catalog/notification.md) | 알림 조회 |
| `mall.write_notification` | [notification.md](./cafe24-api-catalog/notification.md) | 알림 발송 |
| `mall.read_privacy` | [privacy.md](./cafe24-api-catalog/privacy.md) | 개인정보 조회 |
| `mall.write_privacy` | [privacy.md](./cafe24-api-catalog/privacy.md) | 개인정보 수정 |

> 위 카탈로그의 모든 row 는 catalog 표의 `restricted` 컬럼 = `scope`, backend 메타데이터의 `restrictedApproval.level='scope'` 로 표기된다.

## 2. Operation 단위 별도 승인 (store scope 안의 일부)

`mall.read_store` / `mall.write_store` 자체는 일반 사용 가능하지만, 안의 일부 operation 만 별도 승인 대상이다. 카탈로그 표에서 해당 row 만 `restricted: op` 로 표기한다.

| 영역 | 영향 operation id (catalog [store.md](./cafe24-api-catalog/store.md)) | 설명 |
|---|---|---|
| Activitylogs | `activitylogs_list`, `activitylogs_get` | 활동 로그 목록/상세 조회 |
| Financials paymentgateway | `financials_paymentgateway_get` | PG사 계약정보 조회 |
| Menus | `menus_get` | 메뉴 조회 |
| Naverpay setting | `naverpay_setting_get`, `naverpay_setting_create`, `naverpay_setting_update` | 네이버페이 설정 조회·등록·수정 |
| Kakaopay setting | `kakaopay_setting_get`, `kakaopay_setting_update` | 카카오페이 설정 조회·수정 |
| Paymentgateway | `paymentgateway_create`, `paymentgateway_update`, `paymentgateway_delete` | PG 생성·수정·삭제 |
| Paymentgateway paymentmethods | `paymentgateway_paymentmethods_list`, `paymentgateway_paymentmethods_create`, `paymentgateway_paymentmethods_update`, `paymentgateway_paymentmethods_delete` | PG 결제수단 목록/생성·수정·삭제 |

> 카탈로그 `restricted: op` 와 메타데이터 `restrictedApproval.category` 의 매핑은 다음과 같다:
>
> - Activitylogs → `category: 'activitylogs'`
> - Menus → `category: 'menus'`
> - Naverpay setting → `category: 'naverpay_setting'`
> - Kakaopay setting → `category: 'kakaopay_setting'`
> - **Paymentgateway / Paymentgateway paymentmethods / Financials paymentgateway** → `category: 'pg_settings'` (세 영역을 하나의 PG 설정 범주로 묶어 i18n 메시지와 tooltip 을 단일화)

## 3. 별도 프로그램 승인

카페24 승인 제휴사에만 제공되는 별도 트랙. 본 프로젝트는 현재 직접 호출 경로를 구현하지 않으며, 본 명단은 향후 도입을 위한 placeholder 다. Cafe24 측 계약 후 별도 spec 으로 상세화한다 — 그 시점에 카탈로그 / backend 메타데이터에도 들어간다.

| API | 설명 |
|---|---|
| Cafe24 Analytics API | 카페24 승인 제휴사에만 제공. 쇼핑몰 사용자 행동 데이터 제공 서비스 제작 용도 |

> `restrictedApproval.level='program'` 인 row 는 catalog 의 `restricted` 컬럼 정합성 검증 대상에서 **제외**된다 (catalog 화 대상이 아닌 트랙). 메타데이터에는 별도 분류만 두고, UI 라벨링은 향후 도입 시 동일 메타데이터 차원을 재사용한다.

## 4. 사용 정책

### 4.1 사용자 안내 (UI)

위 §1·§2 의 항목은 다음 4 화면에서 동일한 ⚠ 배지·tooltip 으로 표기된다:

1. **통합 추가 위저드 Step 2 Scope 체크박스** ([Spec 통합 화면 §3.2 Cafe24 Public/Private](../2-navigation/4-integration.md#32-step-2-인증-정보-입력))
2. **통합 상세 §4.4 Scope & Permissions 탭** (현재 scope · 권장 scope · 누락 scope 모두) ([Spec 통합 화면 §4.4](../2-navigation/4-integration.md#44-scope--permissions-탭-oauth-한정))
3. **Cafe24 노드 Operation 드롭다운** ([Spec Cafe24 노드 §2](../4-nodes/4-integration/4-cafe24.md#2-설정-ui))
4. **AI Agent allowlist UI** ([Spec Cafe24 노드 §8.3](../4-nodes/4-integration/4-cafe24.md#83-allowlist-mcpservers-enabledtools))

배지 hover 시 tooltip 문구 (한국어):

> "카페24 본사 승인이 필요한 권한입니다. 미승인 상태로 동의를 시도하면 `invalid_scope` 로 실패하거나, 인증 후 호출 시 403 이 반환될 수 있어요. [Cafe24 개발자센터 문의 →]"

영어 (i18n):

> "This permission requires Cafe24 partner approval. Without approval, the OAuth flow may reject it as `invalid_scope`, or API calls may return 403. [Contact Cafe24 Developer Center →]"

### 4.2 차단 정책

체크/저장은 **차단하지 않는다**. 이미 본사 승인을 받은 사용자가 있을 수 있으므로 "알고 누른다" 만 보장. 단 체크된 권한 중 별도 승인 필요 항목이 1개 이상이면 위저드 Step 2 폼 하단에 **영구 amber 경고 배너**를 띄운다 (사용자가 인지하지 못한 채 진행하는 사례 차단).

### 4.3 에러 안내 (에러 발생 후)

- **OAuth `invalid_scope`**: backend 의 cafe24 OAuth callback 이 응답을 파싱 후 요청한 scopes ∩ 본 명단 §1 의 교집합이 비어있지 않으면 `Integration.status_reason='oauth_invalid_scope'` 와 함께 `last_error.details.requiresCafe24Approval: string[]` 에 영향 scope 를 기록 ([Spec 통합 화면 §10.4](../2-navigation/4-integration.md#104-에러-매핑), [Spec Integration 데이터 모델 §2.10](../1-data-model.md#210-integration) `last_error` JSONB 스키마). 통합 상세 페이지가 본 단서를 읽어 "이 권한은 카페24 별도 승인이 필요해요" 분기 메시지 노출. status 는 `pending_install` 그대로 유지하여 사용자가 다시 시도 가능.
- **노드 실행 중 `INSUFFICIENT_SCOPE (403)`**: 응답 `details` 의 기존 `missingScopes: string[]` 옆에 추가로 `requiresCafe24Approval: string[]` (누락 scope ∩ 본 명단의 교집합) 을 채워 보낸다. frontend 가 본 필드가 비어있지 않으면 별도 승인 안내 분기 메시지를 노출.

### 4.4 신규 코드 추가 없음

기존 `OAuth invalid_scope` 분기, `INSUFFICIENT_SCOPE (403)` 응답 모두 그대로 유지하고 `details.requiresCafe24Approval` 보강 필드 + `status_reason='oauth_invalid_scope'` 의 status_reason 열거 확장만으로 표현. 새 HTTP 상태/에러 코드 vocabulary 추가는 하지 않는다 (하위 호환).

## 5. 명단 갱신 절차

1. Cafe24 공식 문서를 다시 확인해 본 명단의 진위·추가/삭제를 검증.
2. 본 문서의 §1·§2·§3 표 갱신.
3. 영향받는 catalog 파일 (`mileage.md` / `notification.md` / `privacy.md` / `store.md` / 추가 영향 resource) 의 `restricted` 컬럼 갱신.
4. backend 메타데이터의 `restrictedApproval` 필드 동시 갱신.
5. `npm test --workspace backend -- catalog-sync` 로 양방향 동기 확인.
6. UI 4 화면에서 ⚠ 표기가 새 명단을 따라 자동 갱신되는지 시각 회귀 (해당 컴포넌트는 메타데이터 기반 자동 렌더링).

## 6. 참고 링크

- Cafe24 Admin API 공식 문서: https://developers.cafe24.com/docs/api/admin/
- Scope별 사용 동의 가이드: https://developers.cafe24.com/app/front/app/develop/api/scope
- Cafe24 Analytics API: https://developers.cafe24.com/docs/ko/api/cafe24data/
- 카페24 개발자센터 문의: https://developers.cafe24.com

---

## Rationale

### 메타데이터 SoT 한 곳, UI 4 화면 자동 전파 (2026-05-17)

**문제**: Cafe24 Admin API 중 mileage/notification/privacy 의 모든 scope 와 store 안 일부 operation 은 카페24 본사가 별도 승인한 클라이언트만 사용 가능하다. spec 에 이를 표현하는 차원이 없어 사용자가 위저드에서 일반 카테고리처럼 체크 → OAuth `invalid_scope` 거부 또는 호출 시 `INSUFFICIENT_SCOPE (403)` 으로 좌초. 원인 안내 장치 부재.

**채택**: backend 메타데이터의 `Cafe24OperationMetadata.restrictedApproval` 필드와 catalog 의 `restricted` 컬럼을 SoT 로 두고, UI 4 화면 (위저드 / 통합 상세 §4.4 / 노드 Operation 드롭다운 / AI Agent allowlist) 이 같은 필드를 읽어 ⚠ 배지·tooltip·경고 배너를 자동 렌더. 명단 자체의 진위 SoT 는 본 컨벤션이 단독으로 보유한다. catalog-sync 테스트가 catalog ↔ 메타데이터 양방향 동기를 강제하므로 명단을 한 곳에서 갱신하면 코드/UI 양쪽이 자동 정합.

### 기각된 대안

- **(A) 사용자가 체크 시 차단** — 이미 본사 승인을 받은 합법 사용자 케이스를 막아버린다. "안내만, 차단 없음" 정책 채택. 단 체크된 항목 중 1개 이상이 별도 승인 대상이면 amber 경고 배너로 인지를 강제한다.
- **(B) 신규 에러 코드 추가 (`CAFE24_APPROVAL_REQUIRED` 등)** — 기존 `INSUFFICIENT_SCOPE (403)` / OAuth `invalid_scope` 처리 경로를 분기시켜 client 코드 호환성에 영향. `details.requiresCafe24Approval` 보강 필드만으로 충분.
- **(C) catalog 의 `status` enum 에 `restricted` 값 추가** — `supported` / `planned` / `deprecated` 와는 직교 차원이라 enum 확장은 의미 오염. 별도 컬럼이 정답이며, 이는 catalog _overview §2 의 `restricted` 컬럼 설명에도 "이 컬럼은 `status` 와 직교하며 `status` 의 값이 아니다" 로 명시한다.
- **(D) 명단을 spec 본문에 직접 enumerate** — drift 위험. `cafe24-api-metadata.md` §3 의 "endpoint enumeration 을 spec 본문에 인라인하지 않는다" 정책과 동일 사유로 본 컨벤션 파일 하나에 집중.

### Trade-off

- mileage resource 안의 `credits_*` (예치금) 가 정확히 `mall.read_mileage` 를 쓰는지 vs 별도 scope (`mall.read_deposits` 등) 인지의 공식 분리 확인은 사용자 자료 범위 밖이다. 본 컨벤션은 사용자 자료를 1차 SoT 로 받아 scope 단위 라벨링 (`level='scope'`) 을 mileage resource 전체에 적용한다. 향후 공식 문서로 분리 확인되면 본 결정을 정정한다 (§5 명단 갱신 절차).
- `paymentmethods_list` / `paymentmethods_paymentproviders_list` 는 사용자 자료에 명시되지 않았으므로 빈칸 유지. 별도 승인 대상으로 확인되면 §2 표 + catalog `restricted` 컬럼 + backend 메타데이터를 동시 갱신.

### 출처

- 사용자 보고 (2026-05-17) — 카페24 본사 승인 필요 권한이 사용자에게 식별되지 않는 UX 문제 + 별도 승인 명단 3종 표 제공.
- consistency-check 세션: `review/consistency/2026/05/17/12_12_46/` (BLOCK: NO, WARNING 10건 — 모두 본 spec 반영 단계에서 흡수).

---

## CHANGELOG

| 일자 | 변경 |
|------|------|
| 2026-05-17 | 신규 컨벤션 — 사용자 보고와 공식 문서 안내 문구를 기반으로 별도 승인 대상 명단 정식 등재. backend 메타데이터 `restrictedApproval` 필드 + catalog `restricted` 컬럼과 함께 도입. consistency-check 세션: `review/consistency/2026/05/17/12_12_46/`. |
