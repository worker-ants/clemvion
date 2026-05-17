# 정식 규약 준수 Check Payload

본 파일은 orchestrator 가 정식 규약 준수 checker 용으로 작성한 입력입니다. target 문서가 정식 규약(`spec/conventions/**`) 을 따르고 있는지 분석한다.
sub-agent 의 system prompt 에 정의된 호출 규약·등급 기준·출력 형식을 그대로
따르되, 분석 시 아래 "점검 관점" 을 빠짐없이 적용하세요. 결과는 `output_file`
인자가 가리키는 경로에 Write 하고 호출자에게는 STATUS 한 줄만 반환합니다.

## 점검 관점 (정식 규약 준수)

1. **명명 규약** — 파일·식별자·API endpoint 명명이 conventions 규칙과 일치하는가
2. **출력 포맷 규약** — 노드 Output, API 응답, error code 형식 등이 정식 규약을 따르는가
3. **문서 구조 규약** — Overview / 본문 / Rationale 3섹션 권장, `_product-overview.md`·`0-` prefix 등 CLAUDE.md 의 명명 컨벤션 준수
4. **API 문서 규약** — Swagger 패턴·request/response DTO 명명
5. **금지 항목** — conventions 에서 명시적으로 금지한 패턴(예: 옛 prd/, memory/ 경로 사용)을 답습하고 있지 않은가

## 검토 모드
spec draft 검토 (--spec)

## Target 문서
경로: `plan/in-progress/spec-draft-cafe24-restricted-scopes.md`

```
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

```

## 정식 규약 모음 (spec/conventions/)

### spec/conventions 정식 규약

#### `spec/conventions/cafe24-api-catalog/_overview.md`
```
# CONVENTION: Cafe24 API Catalog — Overview

> 관련 문서: [Spec Cafe24 노드](../../4-nodes/4-integration/4-cafe24.md) · [Cafe24 API Metadata 컨벤션](../cafe24-api-metadata.md) · [Cafe24 공식 Admin API 문서](https://developers.cafe24.com/docs/ko/api/admin/)

본 디렉토리(`spec/conventions/cafe24-api-catalog/`) 는 Cafe24 Admin API 의 **모든 endpoint** 를 18 resource 단위로 enumerate 한 단일 진실(single source of truth)이다. 노드 메타데이터(`backend/src/nodes/integration/cafe24/metadata/*.ts`) 가 어디까지 구현됐고 어디가 남았는지가 한 화면에서 보이도록 유지한다.

---

## 1. 디렉토리 구조

```
spec/conventions/cafe24-api-catalog/
  _overview.md        # 본 문서 — 인덱스 + 컬럼 정의 + 동기 정책 + coverage matrix
  store.md            # Store (상점) — 50+ sub-resource
  product.md          # Product (상품)
  order.md            # Order (주문)
  customer.md         # Customer (회원)
  community.md        # Community (게시판)
  design.md           # Design (디자인)
  promotion.md        # Promotion (프로모션)
  application.md      # Application (앱 관리)
  category.md         # Category (상품분류)
  collection.md       # Collection (판매분류)
  supply.md           # Supply (공급사)
  shipping.md         # Shipping (배송)
  salesreport.md      # Salesreport (매출통계)
  personal.md         # Personal (개인화)
  privacy.md          # Privacy (개인정보)
  mileage.md          # Mileage (적립금)
  notification.md     # Notification (알림)
  translation.md      # Translation (번역)
```

resource 이름은 `Cafe24Resource` enum (`backend/src/nodes/integration/cafe24/metadata/types.ts`) 와 1:1 일치한다.

## 2. 표 컬럼 정의

각 resource 파일은 다음 컬럼의 표를 가진다.

| 컬럼 | 필수 | 설명 |
|------|------|------|
| `id` | ✓ | 노드 메타데이터의 operation id. `<resource>_<verb>` 또는 `<resource>_<sub>_<verb>` (예: `product_list`, `product_options_create`). 영문 snake_case, resource 내 unique |
| `라벨 (한)` | ✓ | UI 드롭다운에 노출되는 한국어 라벨 (예: "상품 목록 조회") |
| `English title` | ✓ | Cafe24 공식 docs 의 영문 제목 (예: "Retrieve a list of products") |
| `method` | supported 시 ✓ | `GET` / `POST` / `PUT` / `DELETE`. planned 시 `?` 허용 |
| `path` | supported 시 ✓ | path template (예: `products/{product_no}`). `/api/v2/admin/` 접두는 생략. planned 시 `?` 허용 |
| `scope` | supported 시 ✓ | `read` / `write`. `mall.<scope>_<resource>` 의 가운데 토큰. planned 시 `?` 허용 |
| `paginated` | — | `✓` 또는 빈 칸. `paginated: true` 인 operation 만 표시 |
| `status` | ✓ | §3 의 enum 중 하나 |
| `docs` | ✓ | Cafe24 공식 docs anchor URL — `https://developers.cafe24.com/docs/ko/api/admin/#<anchor>` |

## 3. status enum

| 값 | 의미 | 백엔드 메타데이터 |
|-----|------|------|
| `supported` | 노드/MCP Bridge 에서 호출 가능 | `CAFE24_OPERATIONS_BY_RESOURCE[resource]` 에 row 존재 |
| `planned` | 카탈로그에 등재만, 미구현. UI 의 Operation 드롭다운에 **disabled + "지원 예정" 배지** 로 노출 | row 없음 |
| `deprecated` | Cafe24 가 제거 또는 deprecate 했고 우리 노드에서도 더 이상 호출 안 함 | row 없으면 정상. 있으면 마이그레이션 대상 |

`planned` 행의 `method`/`path`/`scope` 가 `?` 인 경우, 구현 시점에 공식 docs 를 다시 검증한 뒤 `supported` 로 승격시키며 정확한 값으로 갱신한다.

## 4. 동기 정책 (Sync Contract)

본 카탈로그는 `backend/src/nodes/integration/cafe24/metadata/*.ts` 와 **양방향 동기 테스트**로 보호된다.

**테스트 위치**: `backend/src/nodes/integration/cafe24/metadata/catalog-sync.spec.ts`

**검증 규칙**:

1. **`supported` row → 메타데이터 존재**: 카탈로그에 `status: supported` 로 적힌 모든 `(resource, id)` 가 `findCafe24Operation(resource, id)` 로 조회되어야 한다. 누락 시 fail.
2. **메타데이터 → `supported` row 존재**: `CAFE24_OPERATIONS_BY_RESOURCE` 의 모든 operation 이 해당 resource 의 카탈로그에 `status: supported` 행으로 적혀 있어야 한다. 누락 시 fail.
3. **`paginated` 일치**: `supported` row 의 `paginated` 컬럼(`✓`/공백)이 메타데이터의 `paginated: boolean` 과 일치해야 한다.
4. **`method`/`path` 일치**: `supported` row 의 `method`·`path` 가 메타데이터와 일치.
5. **`scope` 일치**: `supported` row 의 `scope` 가 메타데이터 `scopeType` 과 일치.
6. **id 의 resource 내 unique**: 한 카탈로그 파일 안에 같은 `id` 가 두 번 나오면 fail.
7. **status 가 enum 중 하나**: `supported` / `planned` / `deprecated` 외의 값이 있으면 fail.

테스트는 카탈로그 MD 의 표를 파싱한다 — MD 표 구문이 깨지면 곧장 fail. 따라서 본 카탈로그는 **사람이 직접 손으로 수정하는 SoT** 이며, 코드 변경 시점에 반드시 카탈로그 동기 갱신을 함께 commit 해야 한다(`spec/conventions/cafe24-api-metadata.md` §5 의 신규 endpoint 추가 절차에 인용).

## 5. Coverage Matrix

2026-05-16 기준. 본 매트릭스는 카탈로그 row 수 + 메타데이터 row 수의 한 화면 요약이다 — 위 동기 테스트와 별개의 휴먼 가독성 보조 정보다. row 추가/삭제 시 본 표도 손으로 갱신한다.

| Resource | Supported | Planned | Cafe24 docs sub-resource 수 |
|----------|-----------|---------|---|
| [store](./store.md) | 8 | 50+ | 50+ |
| [product](./product.md) | 14 | 25+ | 28 |
| [order](./order.md) | 17 | 30+ | 47 |
| [customer](./customer.md) | 24 | 0 | 12 |
| [community](./community.md) | 24 | 0 | 9 |
| [design](./design.md) | 9 | 0 | 3 |
| [promotion](./promotion.md) | 35 | 0 | 10 |
| [application](./application.md) | 19 | 0 | 8 |
| [category](./category.md) | 19 | 0 | 5 |
| [collection](./collection.md) | 15 | 0 | 5 |
| [supply](./supply.md) | 20 | 0 | 6 |
| [shipping](./shipping.md) | 15 | 0 | 5 |
| [salesreport](./salesreport.md) | 5 | 0 | 5 |
| [personal](./personal.md) | 5 | 0 | 3 |
| [privacy](./privacy.md) | 6 | 0 | 2 |
| [mileage](./mileage.md) | 8 | 0 | 5 |
| [notification](./notification.md) | 12 | 0 | 7 |
| [translation](./translation.md) | 9 | 0 | 4 |
| **합계** | **264** | **~109** | **~250** |

> "Cafe24 docs sub-resource 수" 는 공식 docs 좌측 사이드바에서 본 resource 그룹 아래의 두 번째 레벨 항목 수다. 각 sub-resource 마다 통상 2~5 operation 이 존재하므로 endpoint 합계는 ~500.

## 6. 신규 endpoint 등재 절차

1. Cafe24 공식 문서에서 endpoint 확인.
2. 본 카탈로그 해당 resource 파일에 표 row 추가:
   - 처음 등재 시 `status: planned`, `method`/`path` 는 `?` 허용.
   - 구현 PR 에서 backend 메타데이터 row 1줄 추가 + 카탈로그 row 를 `planned → supported` 로 갱신 + `method`/`path`/`scope`/`paginated` 채움.
3. `_overview.md` §5 의 coverage matrix 카운트도 함께 갱신.
4. `npm test --workspace backend -- catalog-sync` 통과 확인.

> `spec/conventions/cafe24-api-metadata.md` §5 의 신규 endpoint 추가 절차도 본 카탈로그 row 갱신을 step 으로 포함한다.

## 7. CHANGELOG

| 일자 | 변경 |
|------|------|
| 2026-05-16 | 신규 컨벤션 — 18 resource 카탈로그 + 양방향 동기 테스트 도입. 사용자 결정(2026-05-16) "Cafe24 docs 전수 등재" 에 따라 supported 53 + planned ~300 으로 초기 채움. |
| 2026-05-16 (coverage Phase 5a) | Order resource — `order_count`, `order_status_update`, `order_status_update_multiple` 3건을 planned → supported 로 승격 (backend metadata + planned.ts mirror 동시 갱신). order supported 6 → 9, 합계 53 → 56. |
| 2026-05-16 (coverage Phase 5b) | Product resource — `product_count`, `product_options_list/create/update/delete`, `product_seo_get/update` 7건을 planned → supported 로 승격. product supported 7 → 14, 합계 56 → 63. |
| 2026-05-16 (coverage Phase 5c) | Customer resource — 회원 메모 CRUD 완성: `customer_memos_count/list/get/update/delete` 5건을 planned → supported 로 승격. customer supported 5 → 10, 합계 63 → 68. |
| 2026-05-16 (coverage Phase 5d) | Promotion resource — 쿠폰 보완: `coupon_count`, `coupon_issues_list`, `coupon_issuance_customers_list`, `customers_coupons_list`, `customers_coupons_count` 5건을 planned → supported 로 승격. promotion supported 5 → 10, 합계 68 → 73. |
| 2026-05-16 (coverage Phase 5e) | Salesreport resource 완성 — `salesreport_monthly`, `salesreport_hourly`, `salesreport_volume` 3건을 planned → supported 로 승격. salesreport supported 2 → 5, planned 3 → 0, 합계 73 → 76. salesreport resource 의 첫 번째 0-planned resource. |
| 2026-05-16 (coverage Phase 5f) | Promotion resource — 시리얼쿠폰 5건 (`serialcoupons_list`, `serialcoupons_generate`, `serialcoupons_delete`, `serialcoupons_issues_get`, `serialcoupons_issues_register`) 를 planned → supported 로 승격. promotion supported 10 → 15, 합계 76 → 81. |
| 2026-05-16 (coverage Phase 6a) | Order resource — A/S 자동화 8건 (`refunds_list/get`, `cancellation_get/create_multiple`, `exchange_get/create_multiple`, `return_get/create_multiple`) 를 planned → supported 로 승격. order supported 9 → 17, 합계 81 → 89. |
| 2026-05-16 (coverage Phase 6b) | Store resource — 결제 설정 6건 (`paymentmethods_list`, `paymentmethods_paymentproviders_list`, `paymentgateway_paymentmethods_list`, `paymentgateway_create/update/delete`) 를 planned → supported 로 승격. store supported 2 → 8, 합계 89 → 95. |
| 2026-05-16 (coverage Phase 6c) | Promotion resource — 회원 혜택 CRUD 6건 + 회원 정보 이벤트 3건 + customers_coupons_delete 1건 = 10건. promotion supported 15 → 25, 합계 95 → 105. |
| 2026-05-16 (coverage Phase 6d) | Category/Collection/Supply/Shipping baseline 10건 — category(category_count/mains_list/autodisplay_list), collection(brands count/create/update/delete), supply(suppliers_count/get), shipping(carriers_get). 합계 105 → 115. |
| 2026-05-16 (coverage Phase 6e) | Mileage resource — 적립금 자동 만료 3건 (`points_autoexpiration_get/create/delete`) + 예치금 2건 (`credits_list`, `credits_report`) = 5건. mileage supported 2 → 7, 합계 115 → 120. |
| 2026-05-16 (coverage Phase 6f) | Notification resource — SMS 2건 (`sms_senders_list`, `sms_receivers_get`) + automails 2건 (`automails_get/update`) + recipientgroups 2건 (`recipientgroups_list/get`) = 6건. notification supported 2 → 8, 합계 120 → 126. |
| 2026-05-16 (coverage Phase 6g) | Translation resource — products_update + categories list/update + store list/update + themes list 6건. translation supported 1 → 7, 합계 126 → 132. 본 사이클 (Phase 6 a~g) 종료. |
| 2026-05-16 (coverage Phase 7a) | Promotion resource — discountcodes CRUD 5건 + commonevents CRUD 4건 = 9건. promotion supported 25 → 34, 합계 132 → 141. |
| 2026-05-16 (coverage Phase 7b) | Customer resource 완성 — 회원 14건 (paymentinfo 3 + properties 2 + customergroups 4 + delete + autoupdate + plusapp + social + social_list). customer supported 10 → 24, planned 14 → 0, 합계 141 → 155. customer 두 번째 0-planned resource. |
| 2026-05-16 (coverage Phase 7c) | Community resource — boards 설정 2건 + boards 글 CRUD 3건 + comments 3건 + commenttemplates 2건 = 10건. community supported 3 → 13, 합계 155 → 165. |
| 2026-05-16 (coverage Phase 7d) | Application resource — apps_update + scripttags CRUD 5건 + webhooks_update + webhooks_logs_list = 8건. application supported 3 → 11, 합계 165 → 173. |
| 2026-05-16 (coverage Phase 7e) | Shipping resource 완성 — carriers CRUD 3건 + regionalsurcharges 2건 + shipping_settings 2건 + shipping_additionalfees_countries + shippingorigins CRUD 5건 = 13건. shipping supported 2 → 15, planned 13 → 0, 합계 173 → 186. shipping 세 번째 0-planned resource. |
| 2026-05-16 (coverage Phase 7f) | Category resource 완성 — decorationimages 2건 (get/update) + seo 2건 (get/update) + mains 3건 (add/update/delete) + autodisplay 3건 (create/update/delete) = 10건. category supported 9 → 19, planned 10 → 0, 합계 186 → 196. category 네 번째 0-planned resource. |
| 2026-05-16 (coverage Phase 7g) | Supply resource 완성 — suppliers CUD 3건 + suppliers_users CRUD 6건 + suppliers_users regional shipping 5건 + shipping_suppliers 3건 = 17건. supply supported 3 → 20, planned 17 → 0, 합계 196 → 213. supply 다섯 번째 0-planned resource. 본 사이클 (Phase 7 a~g) 종료. |
| 2026-05-16 (coverage Phase 8a) | Mileage resource 완성 — `points_report` 1건. mileage supported 7 → 8, planned 1 → 0, 합계 213 → 214. mileage 여섯 번째 0-planned resource. |
| 2026-05-16 (coverage Phase 8b) | Promotion resource 완성 — `coupon_manage` 1건 (use_coupon T/F 토글). promotion supported 34 → 35, planned 1 → 0, 합계 214 → 215. promotion 일곱 번째 0-planned resource. |
| 2026-05-16 (coverage Phase 8c) | Translation resource 완성 — 테마 번역 단건 조회/수정 2건. translation supported 7 → 9, planned 2 → 0, 합계 215 → 217. translation 여덟 번째 0-planned resource. |
| 2026-05-16 (coverage Phase 8d) | Personal resource 완성 — `customers_wishlist_count` + `products_carts_count` + `products_carts_list` 3건. personal supported 2 → 5, planned 3 → 0, 합계 217 → 220. personal 아홉 번째 0-planned resource. |
| 2026-05-16 (coverage Phase 8e) | Notification resource 완성 — `customers_invitation_send` + recipientgroups CUD 3건 = 4건. notification supported 8 → 12, planned 4 → 0, 합계 220 → 224. notification 열 번째 0-planned resource. |
| 2026-05-16 (coverage Phase 8f) | Privacy resource 완성 — customers_privacy list/count/update 3건 + products_wishlist_customers list/count 2건 = 5건. privacy supported 1 → 6, planned 5 → 0, 합계 224 → 229. privacy 열한 번째 0-planned resource. |
| 2026-05-16 (coverage Phase 8g) | Application resource 완성 — appstore_orders get/create 2건 + appstore_payments list/count 2건 + databridge_logs_list + recipes list/create/delete 3건 = 8건. application supported 11 → 19, planned 8 → 0, 합계 229 → 237. application 열두 번째 0-planned resource. |
| 2026-05-16 (coverage Phase 8h) | Collection resource 완성 — manufacturers count/get/create/update 4건 + trends_count + classifications list/count 2건 + origin_list = 8건. collection supported 7 → 15, planned 8 → 0, 합계 237 → 245. collection 열세 번째 0-planned resource. |
| 2026-05-16 (coverage Phase 8i) | Design resource 완성 — themes count/get 2건 + theme_pages CRUD 4건 (get/create/update/delete) + icons_list + icons_update_settings = 8건. design supported 1 → 9, planned 8 → 0, 합계 245 → 253. design 열네 번째 0-planned resource. |
| 2026-05-16 (coverage Phase 8j) | Community resource 완성 — boards_comments_bulk + boards_seo get/update 2건 + commenttemplates get/update/delete 3건 + financials_monthlyreviews_count + urgentinquiry get/reply CRUD 4건 = 11건. community supported 13 → 24, planned 11 → 0, 합계 253 → 264. community 열다섯 번째 0-planned resource. 본 사이클 (Phase 8 a~j) 종료. |

```

#### `spec/conventions/cafe24-api-catalog/application.md`
```
# Cafe24 API Catalog — Application (앱 관리)

> 카탈로그 형식·동기 정책: [`_overview.md`](./_overview.md).
> **주의**: 본 resource 는 Cafe24 앱 관리 API 다. 우리 서비스의 Integration `app_type` (Public/Private OAuth 앱 등록) 과 **무관** — naming collision 회피 참고.

base URL: `https://{mall_id}.cafe24api.com/api/v2/admin/`

## 표

| id | 라벨 (한) | English title | method | path | scope | paginated | status | docs |
|----|---|---|---|---|---|---|---|---|
| `applications_list` | 설치된 앱 목록 조회 | Retrieve an app information | GET | `applications` | read | ✓ | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-an-app-information) |
| `scripttags_list` | 스크립트태그 목록 조회 | Retrieve a list of script tags | GET | `scripttags` | read |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-script-tags) |
| `webhooks_list` | Webhook 설정 조회 | Retrieve webhook settings | GET | `webhooks` | read |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-webhook-settings) |
| `apps_update` | 앱 정보 수정 | Update an app information | PUT | `apps` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-an-app-information) |
| `appstore_orders_get` | 앱스토어 주문 조회 | Retrieve a Cafe24 store order | GET | `appstore/orders/{order_id}` | read |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retreive-a-cafe24-store-order) |
| `appstore_orders_create` | 앱스토어 주문 생성 | Create a Cafe24 store order | POST | `appstore/orders` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#create-a-cafe24-store-order) |
| `appstore_payments_list` | 앱스토어 결제 목록 | Retrieve a list of Cafe24 store payments | GET | `appstore/payments` | read | ✓ | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-cafe24-store-payments) |
| `appstore_payments_count` | 앱스토어 결제 수 | Retrieve a count of Cafe24 store payments | GET | `appstore/payments/count` | read |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-count-of-cafe24-store-payments) |
| `databridge_logs_list` | DataBridge 로그 목록 | Retrieve a list of DataBridge webhook logs | GET | `databridge/logs` | read | ✓ | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-databridge-webhook-logs) |
| `recipes_list` | 레시피 목록 조회 | Retrieve a list of recipes | GET | `recipes` | read | ✓ | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-recipes) |
| `recipes_create` | 레시피 생성 | Create a recipe | POST | `recipes` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#create-a-recipe) |
| `recipes_delete` | 레시피 삭제 | Delete a recipe | DELETE | `recipes/{recipe_no}` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#delete-a-recipe) |
| `scripttags_count` | 스크립트태그 개수 조회 | Retrieve a count of script tags | GET | `scripttags/count` | read |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-count-of-script-tags) |
| `scripttags_get` | 스크립트태그 단건 조회 | Retrieve a script tag | GET | `scripttags/{tag_no}` | read |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-script-tag) |
| `scripttags_create` | 스크립트태그 생성 | Create a script tag | POST | `scripttags` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#create-a-script-tag) |
| `scripttags_update` | 스크립트태그 수정 | Update a script tag | PUT | `scripttags/{tag_no}` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-a-script-tag) |
| `scripttags_delete` | 스크립트태그 삭제 | Delete a script tag | DELETE | `scripttags/{tag_no}` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#delete-a-script-tag) |
| `webhooks_logs_list` | Webhook 로그 목록 | Retrieve a list of webhook logs | GET | `webhooks/logs` | read | ✓ | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-webhook-logs) |
| `webhooks_update` | Webhook 설정 수정 | Edit webhook settings | PUT | `webhooks` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#edit-webhook-settings) |

```

#### `spec/conventions/cafe24-api-catalog/category.md`
```
# Cafe24 API Catalog — Category (상품분류)

> 카탈로그 형식·동기 정책: [`_overview.md`](./_overview.md).

base URL: `https://{mall_id}.cafe24api.com/api/v2/admin/`

## 표

| id | 라벨 (한) | English title | method | path | scope | paginated | status | docs |
|----|---|---|---|---|---|---|---|---|
| `category_list` | 카테고리 목록 조회 | Retrieve a list of product categories | GET | `categories` | read | ✓ | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-product-categories) |
| `category_get` | 카테고리 단건 조회 | Retrieve a product category | GET | `categories/{category_no}` | read |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-product-category) |
| `category_create` | 카테고리 생성 | Create a product category | POST | `categories` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#create-a-product-category) |
| `category_update` | 카테고리 수정 | Update a product category | PUT | `categories/{category_no}` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-a-product-category) |
| `category_delete` | 카테고리 삭제 | Delete a product category | DELETE | `categories/{category_no}` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#delete-a-product-category) |
| `category_products_list` | 카테고리별 상품 목록 조회 | Retrieve a list of products by category | GET | `categories/{category_no}/products` | read | ✓ | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-products-by-category) |
| `category_count` | 카테고리 개수 조회 | Retrieve a count of product categories | GET | `categories/count` | read |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-count-of-product-categories) |
| `category_decorationimages_get` | 카테고리 꾸미기 이미지 조회 | Retrieve decoration image settings by category | GET | `categories/{category_no}/decorationimages` | read |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-decoration-image-settings-by-category) |
| `category_decorationimages_update` | 카테고리 꾸미기 이미지 수정 | Update decoration images of a product category | PUT | `categories/{category_no}/decorationimages` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-decoration-images-of-a-product-category) |
| `category_seo_get` | 카테고리 SEO 조회 | Retrieve SEO settings by category | GET | `categories/{category_no}/seo` | read |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-seo-settings-by-category) |
| `category_seo_update` | 카테고리 SEO 수정 | Update a product category SEO | PUT | `categories/{category_no}/seo` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-a-product-category-seo) |
| `mains_list` | 메인 카테고리 목록 조회 | Retrieve a list of main categories | GET | `mains` | read | ✓ | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-main-categories) |
| `mains_add` | 메인 카테고리 추가 | Add main category | POST | `mains` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#add-main-category) |
| `mains_update` | 메인 카테고리 수정 | Update main category | PUT | `mains/{main_code}` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-main-category) |
| `mains_delete` | 메인 카테고리 삭제 | Delete main category | DELETE | `mains/{main_code}` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#delete-main-category) |
| `autodisplay_list` | 자동 진열 목록 조회 | Retrieve a list of auto layouts | GET | `autodisplay` | read | ✓ | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-auto-layouts) |
| `autodisplay_create` | 자동 진열 생성 | Create auto layout for selected product category | POST | `autodisplay` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#create-auto-layout-for-selected-product-category) |
| `autodisplay_update` | 자동 진열 수정 | Update auto layout for selected product category | PUT | `autodisplay/{category_no}` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-auto-layout-for-selected-product-category) |
| `autodisplay_delete` | 자동 진열 삭제 | Delete auto layout for selected product category | DELETE | `autodisplay/{category_no}` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#delete-auto-layout-for-selected-product-category) |

```

#### `spec/conventions/cafe24-api-catalog/collection.md`
```
# Cafe24 API Catalog — Collection (판매분류)

> 카탈로그 형식·동기 정책: [`_overview.md`](./_overview.md).

base URL: `https://{mall_id}.cafe24api.com/api/v2/admin/`

## 표

| id | 라벨 (한) | English title | method | path | scope | paginated | status | docs |
|----|---|---|---|---|---|---|---|---|
| `brands_list` | 브랜드 목록 조회 | Retrieve a list of brands | GET | `brands` | read | ✓ | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-brands) |
| `manufacturers_list` | 제조사 목록 조회 | Retrieve a list of manufacturers | GET | `manufacturers` | read | ✓ | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-manufacturers) |
| `trends_list` | 트렌드 목록 조회 | Retrieve a list of trends | GET | `trends` | read | ✓ | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-trends) |
| `brands_count` | 브랜드 개수 조회 | Retrieve a count of brands | GET | `brands/count` | read |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-count-of-brands) |
| `brands_create` | 브랜드 생성 | Create a brand | POST | `brands` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#create-a-brand) |
| `brands_update` | 브랜드 수정 | Update a brand | PUT | `brands/{brand_code}` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-a-brand) |
| `brands_delete` | 브랜드 삭제 | Delete a brand | DELETE | `brands/{brand_code}` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#delete-a-brand) |
| `manufacturers_count` | 제조사 개수 조회 | Retrieve a count of manufacturers | GET | `manufacturers/count` | read |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-count-of-manufacturers) |
| `manufacturers_get` | 제조사 단건 조회 | Retrieve a manufacturer | GET | `manufacturers/{manufacturer_code}` | read |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-manufacturer) |
| `manufacturers_create` | 제조사 생성 | Create a manufacturer | POST | `manufacturers` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#create-a-manufacturer) |
| `manufacturers_update` | 제조사 수정 | Update a manufacturer | PUT | `manufacturers/{manufacturer_code}` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-a-manufacturer) |
| `trends_count` | 트렌드 개수 조회 | Retrieve a count of trends | GET | `trends/count` | read |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-count-of-trends) |
| `classifications_list` | 사용자 정의 카테고리 목록 | Retrieve a list of custom categories | GET | `classifications` | read | ✓ | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-custom-categories) |
| `classifications_count` | 사용자 정의 카테고리 수 | Retrieve a count of custom categories | GET | `classifications/count` | read |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-count-of-custom-categories) |
| `origin_list` | 원산지 목록 조회 | Retrieve a list of origins | GET | `origin` | read | ✓ | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-origins) |

```

#### `spec/conventions/cafe24-api-catalog/community.md`
```
# Cafe24 API Catalog — Community (게시판)

> 카탈로그 형식·동기 정책: [`_overview.md`](./_overview.md).

base URL: `https://{mall_id}.cafe24api.com/api/v2/admin/`

## 표

| id | 라벨 (한) | English title | method | path | scope | paginated | status | docs |
|----|---|---|---|---|---|---|---|---|
| `boards_list` | 게시판 목록 조회 | Retrieve a list of boards | GET | `boards` | read | ✓ | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-boards) |
| `board_articles_list` | 게시판 글 목록 조회 | Retrieve a list of posts for a board | GET | `boards/{board_no}/articles` | read | ✓ | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-posts-for-a-board) |
| `board_article_get` | 게시판 글 단건 조회 | Retrieve a list of posts for a board (single) | GET | `boards/{board_no}/articles/{article_no}` | read |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-posts-for-a-board) |
| `boards_settings_get` | 게시판 설정 조회 | Retrieve the board settings | GET | `boards/{board_no}` | read |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-the-board-settings) |
| `boards_settings_update` | 게시판 설정

... (truncated due to size limit) ...
