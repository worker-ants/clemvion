---
worktree: cafe24-restricted-scopes-a1b2c3
started: 2026-05-17
owner: project-planner
type: spec-draft
target_specs:
  - spec/conventions/cafe24-restricted-scopes.md (NEW)
  - spec/conventions/cafe24-api-metadata.md
  - spec/conventions/cafe24-api-catalog/_overview.md
  - spec/conventions/cafe24-api-catalog/mileage.md
  - spec/conventions/cafe24-api-catalog/notification.md
  - spec/conventions/cafe24-api-catalog/privacy.md
  - spec/conventions/cafe24-api-catalog/store.md
  - spec/2-navigation/4-integration.md
  - spec/4-nodes/4-integration/4-cafe24.md
---

# SPEC DRAFT: Cafe24 별도 승인 scope/operation 식별 메타데이터 도입

본 draft 는 `/consistency-check --spec` 사전 검토용 변경안 본문이다. 승인 후 각 target_spec 에 반영한다.

---

## D1. NEW — `spec/conventions/cafe24-restricted-scopes.md`

```markdown
# CONVENTION: Cafe24 별도 승인이 필요한 Scope · Operation

> 관련 문서: [Cafe24 API Metadata 컨벤션](./cafe24-api-metadata.md) · [Cafe24 API Catalog](./cafe24-api-catalog/_overview.md) · [Spec 통합 화면 §5.8 Cafe24](../2-navigation/4-integration.md#58-cafe24)

Cafe24 Admin API 의 일부 scope·operation 은 카페24 본사가 별도로 승인한 클라이언트만 사용할 수 있다. 공식 문서가 다음 문구로 명시한다:

> "해당 API는 특정 클라이언트만 사용할 수 있는 API입니다. 사용하시려면 카페24 개발자센터로 문의해주세요."

본 컨벤션은 그 명단을 single-source-of-truth 로 박제한다. backend 메타데이터의 `restrictedApproval` 필드 (cafe24-api-metadata 컨벤션 §2) 와 catalog 파일의 `restricted` 컬럼 (cafe24-api-catalog _overview §2) 이 본 명단과 일치해야 하며, `catalog-sync.spec.ts` 가 동기 검증을 강제한다.

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

## 3. 별도 프로그램 승인

카페24 승인 제휴사에만 제공되는 별도 트랙. 본 프로젝트는 현재 직접 호출 경로를 구현하지 않으며, 본 명단은 향후 도입을 위한 placeholder 다.

| API | 설명 |
|---|---|
| Cafe24 Analytics API | 카페24 승인 제휴사에만 제공. 쇼핑몰 사용자 행동 데이터 제공 서비스 제작 용도 |

## 4. 사용 정책

### 4.1 사용자 안내 (UI)

위 §1·§2 의 항목은 다음 4 화면에서 동일한 ⚠ 배지·tooltip 으로 표기된다:

1. **통합 추가 위저드 Step 2 Scope 체크박스** (Spec 통합 화면 §3.2 Cafe24 Public/Private)
2. **통합 상세 §4.4 Scope & Permissions 탭** (현재 scope · 권장 scope · 누락 scope 모두)
3. **Cafe24 노드 Operation 드롭다운** (Spec Cafe24 노드 §2)
4. **AI Agent allowlist UI** (Spec Cafe24 노드 §8.3, Spec MCP Client §5.6)

배지 hover 시 tooltip 문구 (한국어):

> "카페24 본사 승인이 필요한 권한입니다. 미승인 상태로 동의를 시도하면 `invalid_scope` 로 실패하거나, 인증 후 호출 시 403 이 반환될 수 있어요. [Cafe24 개발자센터 문의 →]"

영어 (i18n):

> "This permission requires Cafe24 partner approval. Without approval, the OAuth flow may reject it as `invalid_scope`, or API calls may return 403. [Contact Cafe24 Developer Center →]"

### 4.2 차단 정책

체크/저장은 **차단하지 않는다**. 이미 본사 승인을 받은 사용자가 있을 수 있으므로 "알고 누른다" 만 보장. 단 체크된 권한 중 별도 승인 필요 항목이 1개 이상이면 위저드 Step 2 폼 하단에 **영구 amber 경고 배너**를 띄운다 (사용자가 인지하지 못한 채 진행하는 사례 차단).

### 4.3 에러 안내 (에러 발생 후)

- **OAuth `invalid_scope`**: backend 의 cafe24 OAuth callback 이 응답을 파싱 후 요청한 scopes ∩ 본 명단 §1 의 교집합이 비어있지 않으면 `Integration.status_reason='oauth_invalid_scope'` 와 함께 `last_error.details.requiresCafe24Approval: string[]` 에 영향 scope 를 기록. 통합 상세 페이지가 본 단서를 읽어 "이 권한은 카페24 별도 승인이 필요해요" 분기 메시지 노출.
- **노드 실행 중 `INSUFFICIENT_SCOPE (403)`**: 응답 `details.requiresCafe24Approval: string[]` 에 사용 scope ∩ 본 명단의 교집합을 채워 보낸다. frontend 가 본 필드가 비어있지 않으면 별도 승인 안내 분기 메시지를 노출.

### 4.4 신규 코드 추가 없음

기존 `OAuth invalid_scope` 분기, `INSUFFICIENT_SCOPE (403)` 응답 모두 그대로 유지하고 `details.requiresCafe24Approval` 보강 필드로만 표현. 새 HTTP 상태/에러 코드 vocabulary 추가는 하지 않는다 (하위 호환).

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

## 7. CHANGELOG

| 일자 | 변경 |
|------|------|
| 2026-05-17 | 신규 컨벤션 — 사용자 보고 (질문에서 제공한 표) 와 공식 문서 안내 문구를 기반으로 별도 승인 대상 명단 정식 등재. backend 메타데이터 `restrictedApproval` 필드 + catalog `restricted` 컬럼과 함께 도입. consistency-check 세션: (예정). |
```

---

## D2. EDIT — `spec/conventions/cafe24-api-metadata.md`

### D2.1 §2 Operation 메타데이터 형식 — 필드 추가

기존 인터페이스 정의 (§2) 의 끝에 추가:

```diff
  responseShape?: 'list' | 'single' | 'empty';
  paginated?: boolean;
+
+  // 별도 승인 라벨링 — [cafe24-restricted-scopes 컨벤션](./cafe24-restricted-scopes.md)
+  // 의 명단과 일치해야 하며, catalog-sync.spec.ts 가 카탈로그 row 의
+  // `restricted` 컬럼과 양방향 동기를 검증한다.
+  restrictedApproval?: {
+    level: 'scope' | 'operation' | 'program';
+    category:
+      | 'mileage' | 'notification' | 'privacy'         // scope 전체
+      | 'activitylogs' | 'menus' | 'pg_settings'        // store 안 operation 단위
+      | 'naverpay_setting' | 'kakaopay_setting'
+      | 'analytics';                                    // 별도 프로그램 (placeholder)
+    docsUrl?: string;
+    inquiryUrl: string;                                 // 카페24 개발자센터 안내 링크
+  };
}
```

§2 본문 아래에 다음 문단 추가:

```markdown
**`restrictedApproval` 의 의미**

본 필드는 카페24 본사가 별도 승인한 클라이언트만 호출할 수 있는 operation 을 식별한다. 명단의 single-source-of-truth 는 [`cafe24-restricted-scopes.md`](./cafe24-restricted-scopes.md). UI 4 화면 (위저드 / 통합 상세 Scope 탭 / Cafe24 노드 Operation 드롭다운 / AI Agent allowlist) 이 본 필드를 읽어 ⚠ 배지·tooltip 을 자동 렌더한다. `level='scope'` 인 row 는 같은 resource (mileage/notification/privacy) 의 모든 자매 operation 에 같은 라벨이 자동 적용되므로 backend 메타데이터에서는 row 별로 빠짐없이 채운다.
```

### D2.2 §5 신규 endpoint 추가 절차 — 단계 추가

기존 §5 의 step 5 (카탈로그 row 갱신) 본문에 다음 항목 추가:

```diff
5. [`cafe24-api-catalog/<resource>.md`](./cafe24-api-catalog/_overview.md) 의 표에 해당 row 의 `status` 를 `planned → supported` 로 갱신하고 `method` / `path` / `scope` / `paginated` 컬럼을 채운다. 카탈로그에 row 자체가 없으면 새로 추가.
+   - 추가로 별도 승인 대상인 경우 [`cafe24-restricted-scopes.md`](./cafe24-restricted-scopes.md) 명단과 비교해 catalog 의 `restricted` 컬럼(`scope` / `op` / 빈칸) 과 backend 메타데이터의 `restrictedApproval` 필드를 동시 갱신한다.
```

§5 의 step 7 (백엔드 단위 테스트 검증) 본문에 다음 줄 추가:

```diff
   - **카탈로그 ↔ 메타데이터 양방향 동기** (`catalog-sync.spec.ts`)
+   - **restricted 컬럼 ↔ `restrictedApproval` 양방향 동기** (`catalog-sync.spec.ts`) — catalog 가 `scope` 또는 `op` 면 메타데이터에 `restrictedApproval` 존재, 그 역도 동일.
```

### D2.3 §8 CHANGELOG 추가

```markdown
| 2026-05-17 | §2 `Cafe24OperationMetadata.restrictedApproval` optional 필드 추가 + §5 절차에 catalog `restricted` 컬럼 동시 갱신 의무 명문화. SoT 는 신규 컨벤션 [`cafe24-restricted-scopes.md`](./cafe24-restricted-scopes.md). 사용자 보고 — 카페24 본사 승인 필요 권한이 사용자에게 식별되지 않는 UX 문제 해소. consistency-check 세션: (예정). |
```

---

## D3. EDIT — `spec/conventions/cafe24-api-catalog/_overview.md`

### D3.1 §2 표 컬럼 정의 — 컬럼 추가

기존 표에서 `status` 행 위에 다음 행 삽입:

```markdown
| `restricted` | — | `scope` / `op` / 빈칸. `scope` = 본 scope 자체가 카페24 별도 승인 대상이라 같은 resource 의 모든 row 가 영향. `op` = 본 row 만 단독 승인 대상 (store 안 케이스). 빈칸 = 일반 사용 가능. 명단의 SoT 는 [`cafe24-restricted-scopes.md`](../cafe24-restricted-scopes.md) |
```

### D3.2 §4 동기 정책 — 검증 규칙 추가

기존 검증 규칙 7번 뒤에 8번 추가:

```markdown
8. **`restricted` 컬럼 ↔ 메타데이터 `restrictedApproval` 동기**: catalog row 의 `restricted` 컬럼이 `scope` 또는 `op` 이면 그 row 에 대응하는 backend 메타데이터에 `restrictedApproval` 필드가 존재해야 하고 그 역도 동일. 컬럼 값과 메타데이터 `level` 의 매핑은: `scope` ↔ `level='scope'`, `op` ↔ `level='operation'`. `level='program'` 은 본 catalog 와 별개로 다뤄진다 (Analytics 등 catalog 화 대상이 아닌 트랙).
```

### D3.3 §7 CHANGELOG 추가

```markdown
| 2026-05-17 | §2 에 `restricted` 컬럼 추가 + §4 에 검증 규칙 8 신설. 카페24 별도 승인 대상 식별 — SoT 는 [`cafe24-restricted-scopes.md`](../cafe24-restricted-scopes.md). 사용자 보고 (질문에서 제공한 표) 후속. |
```

---

## D4. EDIT — catalog 표 (영향 resource)

### D4.1 `mileage.md` — 표 헤더 + 모든 row 갱신

표 헤더에 `restricted` 컬럼 추가 (scope 와 paginated 사이):

```diff
- | id | 라벨 (한) | English title | method | path | scope | paginated | status | docs |
- |----|---|---|---|---|---|---|---|---|
+ | id | 라벨 (한) | English title | method | path | scope | restricted | paginated | status | docs |
+ |----|---|---|---|---|---|---|---|---|---|
```

모든 supported row 의 `restricted` 컬럼 = `scope`. 예:

```markdown
| `mileage_list` | 적립금 내역 조회 | Retrieve points | GET | `points` | read | scope | ✓ | supported | [↗](...) |
| `mileage_grant` | 적립금 지급 | Issue and deduct points | POST | `points` | write | scope |  | supported | [↗](...) |
| `points_autoexpiration_get` | 적립금 자동 만료 조회 | Retrieve an automatic points expiration | GET | `points/autoexpiration/{id}` | read | scope |  | supported | [↗](...) |
| `points_autoexpiration_create` | 적립금 자동 만료 생성 | Create an automatic points expiration | POST | `points/autoexpiration` | write | scope |  | supported | [↗](...) |
| `points_autoexpiration_delete` | 적립금 자동 만료 삭제 | Delete an automatic points expiration | DELETE | `points/autoexpiration/{id}` | write | scope |  | supported | [↗](...) |
| `points_report` | 적립금 리포트 조회 | Retrieve a points report by date range | GET | `points/report` | read | scope |  | supported | [↗](...) |
| `credits_list` | 예치금 내역 조회 | Retrieve a list of credits by date range | GET | `credits` | read | scope | ✓ | supported | [↗](...) |
| `credits_report` | 예치금 리포트 조회 | Retrieve a credit report by date range | GET | `credits/report` | read | scope |  | supported | [↗](...) |
```

### D4.2 `notification.md` — 동일 패턴

12 supported row 모두 `restricted: scope`.

### D4.3 `privacy.md` — 동일 패턴

6 supported row 모두 `restricted: scope`.

### D4.4 `store.md` — 영향 row 만 갱신

전체 헤더에 `restricted` 컬럼 추가. 빈칸이 기본이며 다음 row 만 `restricted: op`:

- `activitylogs_list` (planned)
- `activitylogs_get` (planned)
- `financials_paymentgateway_get` (planned)
- `menus_get` (planned)
- `naverpay_setting_get` (planned)
- `naverpay_setting_create` (planned)
- `naverpay_setting_update` (planned)
- `kakaopay_setting_get` (planned)
- `kakaopay_setting_update` (planned)
- `paymentgateway_create` (supported)
- `paymentgateway_update` (supported)
- `paymentgateway_delete` (supported)
- `paymentgateway_paymentmethods_list` (supported)
- `paymentgateway_paymentmethods_create` (planned)
- `paymentgateway_paymentmethods_update` (planned)
- `paymentgateway_paymentmethods_delete` (planned)

> 참고: `paymentmethods_list` / `paymentmethods_paymentproviders_list` 는 사용자 자료에 명시되지 않았으므로 빈칸 유지. 향후 공식 문서 재검증 시 갱신.

---

## D5. EDIT — `spec/2-navigation/4-integration.md`

### D5.1 §3.2 Cafe24 Public 흐름 — Step 2 폼 안내 추가

기존 Step 2 의 끝에 다음 노트 추가:

```markdown
> **별도 승인 필요 권한 안내** — 체크박스 옆 ⚠ 아이콘이 표시된 카테고리·operation 은 카페24 본사가 별도 승인한 클라이언트만 사용 가능하다. 명단의 SoT 는 [`spec/conventions/cafe24-restricted-scopes.md`](../conventions/cafe24-restricted-scopes.md). 체크 자체는 차단하지 않으나, 체크된 권한 중 별도 승인 대상이 1개 이상이면 폼 하단에 영구 amber 경고 배너를 띄운다. 미승인 상태로 진행하면 OAuth 단계에서 `invalid_scope` 또는 호출 시 `INSUFFICIENT_SCOPE (403)` 으로 실패할 수 있음을 안내. tooltip 문구 / 경고 배너 / 에러 분기 메시지의 i18n 키 정의는 같은 컨벤션 §4 참고.
```

### D5.2 §5 Scope 권장 프리셋 표 — "별도 승인" 컬럼 추가

기존 표:

```diff
- | 카테고리 | scope 값 (R / W) |
- |---------|------------------|
+ | 카테고리 | scope 값 (R / W) | 별도 승인 |
+ |---------|------------------|----------|
```

각 행의 마지막 컬럼:

- 일반 카테고리 (Product, Order, Customer, Category, Promotion, Shipping, Sales report, Translation, Application, Design, Community, Collection, Supply, Personal): 빈칸
- Mileage, Notification, Privacy: `⚠ 필요` (R/W 모두)
- Store: `⚠ 일부 sub-resource` (Activitylogs, Menus, Naverpay/Kakaopay/PG settings — 자세한 명단은 [`cafe24-restricted-scopes.md`](../conventions/cafe24-restricted-scopes.md) 링크)

표 아래 본문 추가:

```markdown
> "⚠" 표기된 카테고리는 카페24 본사가 별도 승인한 클라이언트만 사용 가능하다. 일반 사용자가 무심코 체크 후 OAuth 진행 시 `invalid_scope` 로 실패할 수 있어, UI 에서 체크박스 옆에 ⚠ 아이콘 + tooltip + 폼 하단 경고 배너로 인지를 보장한다. Store 의 부분 제한은 scope 단위가 아닌 operation 단위라 노드 Operation 드롭다운 ([Spec Cafe24 노드 §2](../4-nodes/4-integration/4-cafe24.md#2-설정-ui)) 의 ⚠ 라벨이 1차 안내 지점이다. 명단 SoT 는 [`cafe24-restricted-scopes.md`](../conventions/cafe24-restricted-scopes.md).
```

### D5.3 §4.4 Scope & Permissions 탭 — 표에 행 추가

기존 표:

```diff
| 요소 | 설명 |
|------|------|
| 현재 scope 목록 | `credentials.scopes[]` 전체를 체크된 상태로 표시 |
| 권장 scope 목록 | 서비스별 프리셋. 현재 scope에 없는 항목은 체크 해제 상태 |
| 누락 scope 배지 | `status_reason = insufficient_scope`일 때 누락 scope 목록을 빨간 뱃지로 강조 |
+ | 별도 승인 필요 ⚠ 배지 | 현재 scope·권장 scope·누락 scope 의 각 항목 옆에 `restrictedApproval` (메타데이터) 가 있는 scope/operation 만 ⚠ 배지 자동 노출. tooltip 본문은 [`cafe24-restricted-scopes.md`](../conventions/cafe24-restricted-scopes.md) §4.1 의 i18n 문구. `[Request scopes]` 버튼 위쪽에 "추가하려는 scope 중 N개는 카페24 별도 승인 필요" 보조 텍스트 (N=교집합 크기) |
| `[Request scopes]` 버튼 | (기존 그대로) |
```

### D5.4 §9.4 공통 응답 포맷 — `INSUFFICIENT_SCOPE` 보강 필드 명시

기존 `INSUFFICIENT_SCOPE (403)` 행 본문 갱신:

```diff
-  - `INSUFFICIENT_SCOPE` (403) — 노드 실행 중 감지 시 `Integration.status`도 갱신
+  - `INSUFFICIENT_SCOPE` (403) — 노드 실행 중 감지 시 `Integration.status` 도 갱신. `details.missingScopes: string[]` 에 누락 scope 목록을 담고, 그 중 카페24 별도 승인이 필요한 항목은 추가로 `details.requiresCafe24Approval: string[]` 에 채워 반환한다 (Cafe24 통합에 한정 — 다른 통합은 본 필드 미포함). frontend 는 `requiresCafe24Approval` 가 비어있지 않으면 에러 메시지에 "이 권한은 카페24 별도 승인이 필요해요" 분기 메시지를 추가 노출. 본 필드는 신규 에러 코드 없이 보강만 — 하위 호환 유지. 명단 SoT 는 [`spec/conventions/cafe24-restricted-scopes.md`](../conventions/cafe24-restricted-scopes.md).
```

### D5.5 §10.4 에러 매핑 — OAuth `invalid_scope` 분기 보강

기존 §10.4 (에러 매핑) 에 다음 행 추가:

```markdown
| `oauth_invalid_scope` | OAuth callback 이 Cafe24 의 `invalid_scope` 응답을 받음. `last_error.details.requiresCafe24Approval: string[]` 에 요청 scope ∩ [`cafe24-restricted-scopes.md`](../conventions/cafe24-restricted-scopes.md) §1 의 교집합을 기록. 통합 상세 페이지가 본 단서를 읽어 "이 권한은 카페24 별도 승인이 필요해요" 분기 메시지 노출. status 는 보존 (재인증으로 회복 가능) |
```

### D5.6 Rationale — 신규 항목 추가

`## Rationale` 섹션의 끝에 추가:

```markdown
### Cafe24 별도 승인 scope 의 식별·안내 (2026-05-17)

**문제**: Cafe24 Admin API 중 mileage/notification/privacy 의 모든 scope 와 store 안 일부 operation (activitylogs, menus, naverpay/kakaopay/PG settings 등) 은 카페24 본사가 별도 승인한 클라이언트만 사용 가능하다. spec 에 이를 표현하는 차원이 없어 사용자가 위저드에서 일반 카테고리처럼 체크 → OAuth `invalid_scope` 거부 또는 호출 시 `INSUFFICIENT_SCOPE (403)` 으로 좌초. 원인 안내 장치 부재.

**채택**: backend 메타데이터의 `Cafe24OperationMetadata.restrictedApproval` 필드와 catalog 의 `restricted` 컬럼을 SoT 로 두고, UI 4 화면 (위저드 / 상세 §4.4 / 노드 Operation 드롭다운 / AI Agent allowlist) 이 같은 필드를 읽어 ⚠ 배지·tooltip·경고 배너를 자동 렌더. 명단 SoT 는 신규 컨벤션 [`spec/conventions/cafe24-restricted-scopes.md`](../conventions/cafe24-restricted-scopes.md).

**기각 대안**:
- (A) 사용자가 체크 시 차단 — 이미 승인받은 합법 사용자 케이스를 막아버린다. 안내만, 차단 없음 정책 채택.
- (B) 신규 에러 코드 추가 (`CAFE24_APPROVAL_REQUIRED`) — 기존 `INSUFFICIENT_SCOPE (403)` / `invalid_scope` 처리 경로를 분기시켜 client 코드 호환성에 영향. `details.requiresCafe24Approval` 보강 필드만으로 충분.
- (C) catalog 의 `status` enum 에 `restricted` 값 추가 — supported / planned / deprecated 와는 직교 차원이라 enum 확장은 의미 오염. 별도 컬럼이 정답.

**Trade-off**: mileage resource 안의 `credits_*` (예치금) 가 정확히 `mall.read_mileage` 를 쓰는지 vs 별도 scope (`mall.read_deposits` 등) 인지의 공식 분리 확인은 사용자 자료 범위 밖이므로, scope 단위 라벨링 (level='scope') 을 mileage resource 전체에 적용. 향후 공식 문서로 분리 확인되면 본 결정 정정.

출처: 사용자 보고 (2026-05-17). consistency-check 세션: (예정).
```

---

## D6. EDIT — `spec/4-nodes/4-integration/4-cafe24.md`

### D6.1 §2 설정 UI — Operation 드롭다운 라벨링 추가

기존 §2 의 Operation 드롭다운 설명 줄에 추가:

```diff
- Operation 후보 표시: 카탈로그 (`spec/conventions/cafe24-api-catalog/`) 의 `status: planned` 행도 dropdown 에 노출하되 disabled + "(지원 예정)" 접미사로 구분. resource 옆에 "지원 N개 · 추후 지원 M개" coverage hint.
+ Operation 후보 표시: 카탈로그 (`spec/conventions/cafe24-api-catalog/`) 의 `status: planned` 행도 dropdown 에 노출하되 disabled + "(지원 예정)" 접미사로 구분. resource 옆에 "지원 N개 · 추후 지원 M개" coverage hint.
+ - **별도 승인 라벨**: 메타데이터 row 에 `restrictedApproval` 이 있는 operation 은 라벨 우측에 ⚠ 아이콘 + 보조 텍스트 ("별도 승인 필요") 표시. resource 가 scope 단위 restricted (mileage/notification/privacy) 면 같은 resource 의 모든 operation 에 자동 적용. tooltip 본문·문의 링크는 [`spec/conventions/cafe24-restricted-scopes.md`](../../conventions/cafe24-restricted-scopes.md) §4.1.
```

### D6.2 §8.3 allowlist — UI 라벨링 추가

기존 §8.3 끝에 다음 문단 추가:

```markdown
**별도 승인 라벨 (UI)**: AI Agent allowlist 의 카테고리 단위 grouping UI 에서, scope 전체가 별도 승인 대상인 카테고리 (mileage/notification/privacy) 는 그룹 헤더에 ⚠ + "별도 승인 필요". store 안 일부 operation 단위 restricted (paymentgateway_*, activitylogs_*, menus_*, naverpay_setting_*, kakaopay_setting_*, financials_paymentgateway_get 등) 는 operation 행 단위로 같은 ⚠ 표기. backend 가 `mcpServers` 메타데이터 응답에 `restrictedApproval` 을 통과시켜 frontend 가 자동 렌더한다. 명단 SoT 는 [`spec/conventions/cafe24-restricted-scopes.md`](../../conventions/cafe24-restricted-scopes.md).
```

### D6.3 §10 CHANGELOG 추가

```markdown
| 2026-05-17 | §2 Operation 드롭다운에 별도 승인 ⚠ 라벨 명세 + §8.3 AI Agent allowlist UI 의 동일 ⚠ 라벨 명세 추가. 메타데이터 `Cafe24OperationMetadata.restrictedApproval` 신설 ([cafe24-api-metadata 컨벤션 §2](../../conventions/cafe24-api-metadata.md#2-operation-메타데이터-형식)) + 카탈로그 `restricted` 컬럼 ([_overview §2](../../conventions/cafe24-api-catalog/_overview.md#2-표-컬럼-정의)) + SoT 컨벤션 [`cafe24-restricted-scopes.md`](../../conventions/cafe24-restricted-scopes.md) 신설과 한 세트. 사용자 보고 (2026-05-17) — 카페24 본사 승인 필요 권한이 사용자에게 식별되지 않는 UX 문제 해소. consistency-check 세션: (예정). |
```

### D6.4 Rationale — 신규 항목 추가

`## 9. Rationale` 의 끝에 추가:

```markdown
### 9.11 별도 승인 라벨 — 노드 Operation / AI Agent allowlist 의 ⚠ 표기

UI 4 화면 (통합 위저드 / 통합 상세 §4.4 / 노드 Operation 드롭다운 / AI Agent allowlist) 의 라벨링은 같은 메타데이터 SoT (`Cafe24OperationMetadata.restrictedApproval`) 에서 자동 렌더. 명단의 진위는 [`cafe24-restricted-scopes.md`](../../conventions/cafe24-restricted-scopes.md) 가 유일 출처이며, 본 노드 spec 은 그 라벨이 노드/AI Agent 의 어디에서 시각화되는지만 명시한다 — 명단을 직접 enumerate 하지 않는 이유는 drift 방지 (cafe24-api-metadata.md §3 의 "endpoint enumeration 을 spec 본문에 인라인하지 않는다" 정책과 동일).
```

---

## D7. 영향 요약

### 신규 파일

- `spec/conventions/cafe24-restricted-scopes.md`

### 수정 파일

- `spec/conventions/cafe24-api-metadata.md` (§2 / §5 / CHANGELOG)
- `spec/conventions/cafe24-api-catalog/_overview.md` (§2 / §4 / CHANGELOG)
- `spec/conventions/cafe24-api-catalog/mileage.md` (헤더 + 전체 row)
- `spec/conventions/cafe24-api-catalog/notification.md` (헤더 + 전체 row)
- `spec/conventions/cafe24-api-catalog/privacy.md` (헤더 + 전체 row)
- `spec/conventions/cafe24-api-catalog/store.md` (헤더 + 영향 16 row)
- `spec/2-navigation/4-integration.md` (§3.2 / §4.4 / §5 / §9.4 / §10.4 / Rationale)
- `spec/4-nodes/4-integration/4-cafe24.md` (§2 / §8.3 / §10 CHANGELOG / Rationale 9.11)

### 신규 식별자 (충돌 검토 대상)

- `restrictedApproval` (메타데이터 필드명)
- `restricted` (catalog 표 컬럼명)
- `requiresCafe24Approval` (API 에러 details 필드명)
- `oauth_invalid_scope` (Integration.status_reason 값)
- `level` enum: `scope` / `operation` / `program`
- `category` enum: `mileage` / `notification` / `privacy` / `activitylogs` / `menus` / `pg_settings` / `naverpay_setting` / `kakaopay_setting` / `analytics`

### 기각된 대안 (Rationale 에 기록)

- 차단 정책 (사용자 안내만, 차단 없음)
- 신규 에러 코드 (`CAFE24_APPROVAL_REQUIRED` 등 — 보강 필드로 대체)
- catalog `status` enum 확장 (별도 컬럼이 정답)
