# Plan 정합성 Check Payload

본 파일은 orchestrator 가 Plan 정합성 checker 용으로 작성한 입력입니다. `plan/in-progress/**` 의 진행 중 작업·미해결 결정과 target 문서가 정합한지 분석한다.
sub-agent 의 system prompt 에 정의된 호출 규약·등급 기준·출력 형식을 그대로
따르되, 분석 시 아래 "점검 관점" 을 빠짐없이 적용하세요. 결과는 `output_file`
인자가 가리키는 경로에 Write 하고 호출자에게는 STATUS 한 줄만 반환합니다.

## 점검 관점 (Plan 정합성)

1. **미해결 결정과의 충돌** — target 이 plan 에서 "결정 필요" 로 남겨둔 항목과 충돌하는 결정을 일방적으로 내리고 있지 않은가
2. **중복 작업** — target 이 이미 다른 plan 에서 진행 중인 작업과 동일한 영역을 손대고 있는가 (병렬 worktree 경합 위험)
3. **선행 plan 미해소** — target 이 가정하는 사전 조건이 plan 에서 아직 해결되지 않았는가
4. **후속 항목 누락** — target 변경이 다른 plan 의 후속 항목을 무효화하거나 새로 만들어야 하는데 반영되지 않았는가
5. **worktree 충돌** — 동일 spec 파일을 target plan 과 다른 worktree 가 동시에 손대고 있는지 (plan frontmatter `worktree` 필드 확인)

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

## 진행 중 plan 문서 모음 (plan/in-progress/)

### plan/in-progress 진행 중 문서

#### `plan/in-progress/0-unimplemented-overview.md`
```
# 미구현 항목 오버뷰 (PRD/Spec 기준)

> 작성일: 2026-05-11
> 출처: `prd/0-overview.md` §6.2~§6.3, 각 PRD/Spec 문서의 ❌·🚧 표기, 코드베이스 spot-check
> 검증 일자 기준: 2026-05-11. 본 문서의 "현재 상태"는 본 시점의 코드/스펙 비교 결과이며, 진행 시점에 다시 확인할 것

본 문서는 `prd/`와 `spec/`을 전수 정독해 식별한 **아직 구현되지 않았거나 부분 구현 상태인 항목**의 인덱스다. 각 항목은 카테고리별 plan 문서로 분리해 추적한다.

---

## 작업 흐름 권장 순서

다음 순서로 plan을 소화하면 의존성 충돌이 적다.

1. **`ai-agent-tool-connection-rewrite.md`** — AI Agent 도구 연결은 의도적으로 제거되어 재설계 대기 중. 사용자 가치 큼, 다른 plan과 독립적.
2. **`parallel-p2.md`** — 중첩 Parallel, `waitAll: false`, `errorPolicy` schema 노출. `logic-node-followups`와 별개로 진행 가능.
2-1. **`merge-p2-async-fanin.md`** (신규) — Merge `timeout` / `partialOnTimeout` P2 활성화. `logic-node-followups` D3 의 fallback 분리 — 엔진 비동기 dispatch 모델 도입 PoC 가 선결 조건.
3. **`background-monitoring-api.md`** — Background 노드는 ✅ 구현됐으나 `meta.backgroundRunId` 모니터링 API는 미구현.
4. **`replay-rerun.md`** — Re-run (재실행) 정책 도입.
5. **`team-workspace-followups.md`** — 공유 워크플로우 표시 + 미가입자 초대 토큰.
6. **`2fa-webauthn.md`** — WebAuthn 2FA.
7. **`accessibility-voiceover-validation.md`** — macOS VoiceOver 수동 검증.
8. **`self-hosting-deployment.md`** — Docker Compose 셀프 호스팅 풀 번들, Helm Chart, 운영·보안 가이드.
9. **`marketplace-and-plugin-sdk.md`** — 마켓플레이스 + 커스텀 노드 SDK (가장 큰 미구현 덩어리).

> 각 plan에는 배경 / 관련 PRD-Spec 참조 / 작업 단위 / 수용 기준이 포함된다. 본 인덱스는 plan 간 우선순위·의존 관계만 정리한다.

### 최근 완료

- ✅ **`prd-spec-sync.md`** (2026-05-11, `plan/complete/prd-spec-sync.md`) — Graph RAG ❌→✅, NF-OB-05 cron ✅, EH-NAV-04 ✅, Background spec 4문서 정합화, 매뉴얼 (knowledge-base.mdx 한·영) 정합화.
- ✅ **`logic-node-followups.md`** (2026-05-11, `plan/complete/logic-node-followups.md`) — D1 If/Else `is_type`/`regex` evaluator 통합 ✅, D2 Loop breakCondition + meta.exitReason ✅, D3 Merge P2 → 별도 plan (`merge-p2-async-fanin.md`) 분리 ✅, D4 Switch `meta.value` alias 제거 + 마이그레이션 ✅, D5 Variable Modification recordValues opt-in + 마스킹 유틸 ✅, D6 보류 ✅, D7 case id reserved word 검증 ✅. spec/4-nodes/1-logic 의 P0/P1 미구현 표기 모두 정리 (Merge dormant 표기는 별도 plan 분리에 따른 의도적 잔존).
- ✅ **`llm-provider-followups.md`** (2026-05-11, `plan/complete/llm-provider-followups.md`) — Azure OpenAI 스트리밍 ✅ / Local LLM (Ollama·vLLM) 검증 ✅. `AzureOpenAIClient`·`LocalClient` 가 `OpenAIClient.stream()` 을 상속하여 자동 지원. spec 2종(7-llm-client.md §8.2, 4-ai-assistant.md §1.2/§11/§13/§15) 🚧·❌→✅, PRD 0 §6.1, 매뉴얼 4종(llm-config.mdx 한·영 + overview.mdx 한·영) 정합화.

---

## 카테고리별 미구현 항목 매핑

### A. 제품 기능 (사용자 가치 큰 기능)

| PRD/Spec 항목 | 상태 | 처리 plan |
|---------------|------|-----------|
| **PRD 1 §3.9 NAV-MP-01~07 Marketplace** | ❌ 전체 미구현 (i18n 사전에만 등장) | `marketplace-and-plugin-sdk.md` |
| **PRD 4 §4 MP-CT/CS/PB-***| ❌ 전체 미구현 | `marketplace-and-plugin-sdk.md` |
| **PRD 3 §10 ND-EX-01~03 노드 확장성 SDK** | ❌ 우선순위 3 | `marketplace-and-plugin-sdk.md` |
| **PRD 5 NF-EX-04 노드 플러그인 시스템** | ❌ | `marketplace-and-plugin-sdk.md` |
| **PRD 2 §4 ED-PL-05 마켓 커스텀 노드 팔레트 표시** | (마켓 의존) | `marketplace-and-plugin-sdk.md` |
| **PRD 3 §6.1 ND-AG-06/10/21 AI Agent 도구 연결** | 🚧 의도적 제거, 재작성 예정 | `ai-agent-tool-connection-rewrite.md` |
| **PRD 3 §4.9 ND-PL-03 Parallel 결과 합산 / 중첩 Parallel / waitAll=false** | 🚧 P2 예정 | `parallel-p2.md` |
| **Spec 4-nodes/1-logic/3-loop §1 / §6 breakCondition** | ✅ 활성화 (D2, meta.exitReason 추가) | `complete/logic-node-followups.md` |
| **Spec 4-nodes/1-logic/1-if-else `is_type` / `regex` 연산자** | ✅ 구현 (D1, evaluator 통합) | `complete/logic-node-followups.md` |
| **Spec 4-nodes/1-logic/0-common If/Else, Switch `meta.matchedConditions` / `meta.matchedCaseIndex`** | ✅ 핸들러 구현 + spec 정합 (PR-1) | `complete/logic-node-followups.md` |
| **Spec 4-nodes/1-logic/0-common Variable Decl/Mod meta** | ✅ 핸들러 구현 + recordValues opt-in (D5) | `complete/logic-node-followups.md` |
| **Spec 4-nodes/1-logic/11-merge `timeout` / `partialOnTimeout`** | 🚧 P2 dormant (엔진 비동기 모델 선결) | `merge-p2-async-fanin.md` |
| **Spec 4-nodes/1-logic/12-background 모니터링 API** | ❌ 미구현 (`meta.backgroundRunId` 키만 발급) | `background-monitoring-api.md` |
| **Spec 5-system/4-execution-engine §6.3 Re-run** | 🚧 미구현 (future PRD) | `replay-rerun.md` |
| **PRD 1 §3.11 NAV-UP-05 미가입자 초대 토큰** | 🚧 후속 (가입 사용자 추가만 ✅) | `team-workspace-followups.md` |
| **PRD 1 §3.1 NAV-WF-07 공유 워크플로우 표시** | 🚧 백엔드만 존재, UI 미노출 | `team-workspace-followups.md` |
| **PRD 5 NF-SC-10 2FA WebAuthn** | 🚧 TOTP만 ✅, WebAuthn 후속 | `2fa-webauthn.md` |

### B. 인프라/배포 (셀프 호스팅)

| PRD 항목 | 상태 | 처리 plan |
|----------|------|-----------|
| **PRD 5 NF-SC-08 셀프 호스팅 보안 가이드** | ❌ | `self-hosting-deployment.md` |
| **PRD 5 NF-EX-03 단일~클러스터 셀프 호스팅** | ❌ | `self-hosting-deployment.md` |
| **PRD 5 NF-DP-02 Docker Compose 셀프 호스팅 번들** | ❌ (현재 docker-compose.yml은 dev infra만) | `self-hosting-deployment.md` |
| **PRD 5 NF-DP-03 Kubernetes Helm Chart** | ❌ | `self-hosting-deployment.md` |
| **PRD 5 NF-DP-06 셀프 호스팅 설치/운영 문서** | ❌ | `self-hosting-deployment.md` |

### C. LLM Provider 확장 — ✅ 완료 (2026-05-11)

본 카테고리는 `plan/complete/llm-provider-followups.md` 에서 모두 처리됨. 결과:

| Spec 항목 | 처리 결과 |
|-----------|-----------|
| **Spec 3-workflow-editor/4 §11 Azure OpenAI 스트리밍** | 🚧 → ✅ (`AzureOpenAIClient extends OpenAIClient` 상속으로 자동 지원, deployment name + `api-version` 매핑) |
| **Spec 5-system/7 §8.2 LLM Client Local (Ollama/vLLM) 스트리밍** | 🚧 → ✅ (`LocalClient extends OpenAIClient` 로 OpenAI 호환 엔드포인트 자동 지원. Ollama 11434 / vLLM OpenAI-compat 모드 검증 완료) |

### D. 접근성

| PRD 항목 | 상태 | 처리 plan |
|----------|------|-----------|
| **PRD 5 NF-A11Y-03 macOS VoiceOver 수동 검증** | 🚧 자동화 ✅, 수동 체크리스트 사용자 수행 대기 | `accessibility-voiceover-validation.md` |

### E. PRD/Spec ↔ 코드 정합성 정리 (실제로는 구현 끝) — ✅ 완료 (2026-05-11)

본 카테고리는 `plan/complete/prd-spec-sync.md` 에서 모두 처리됨. 결과:

| 항목 | 처리 결과 |
|------|-----------|
| **PRD 9 Graph RAG 전체** | ❌ 로드맵 → ✅ P0~P2 구현 완료 (KB-GR-MD/EX/DM/SR/PA/UI/OB-* 모든 ID 에 상태 컬럼 추가). `prd/9-graph-rag.md` §2.1·§3·§6·§7 + `prd/0-overview.md` §6.1 갱신 |
| **PRD 5 NF-OB-05 알림 cron** | 🚧 → ✅ (5분 BullMQ repeatable + cooldown 명시) |
| **PRD 7 EH-NAV-04 AI Assistant read-only 도구** | ❌ → ✅ (`get_workflow_executions` / `get_execution_details` 가 ED-AI-35~38 모두 충족) |
| **Spec Background 노드 (5문서)** | 5-system/4-execution-engine §3.3, 1-data-model.md, 3-workflow-editor/0-canvas.md (3건), 1-node-common.md, 2-edge.md 모두 "🚧 미구현" 제거 + 평면 구현(ND-BG-05) 으로 통일 |
| **AI Agent Tool Area spec 박스** | 재작성 plan(`ai-agent-tool-connection-rewrite.md`) 와 상호 링크 추가 |
| **사용자 매뉴얼** | `frontend/src/content/docs/06-integrations-and-config/knowledge-base.mdx` 한·영 — Graph 모드 "로드맵" 안내 → 실제 사용법 + 검색 파라미터 + Entity/Relation 관리 가이드로 재작성 |

---

## plan 문서 목록

```
plan/in-progress/
├── 0-unimplemented-overview.md        ← 본 문서 (인덱스)
├── ai-agent-tool-connection-rewrite.md ← AI Agent 일반 도구 연결 재설계
├── merge-p2-async-fanin.md            ← Merge timeout/partialOnTimeout — 엔진 비동기 모델 선결
├── parallel-p2.md                     ← 중첩 Parallel·waitAll=false·errorPolicy 노출
├── background-monitoring-api.md       ← meta.backgroundRunId 모니터링 API
├── replay-rerun.md                    ← Re-run 재실행 기능 도입
├── team-workspace-followups.md        ← 공유 워크플로우 표시 + 미가입자 초대 토큰
├── 2fa-webauthn.md                    ← WebAuthn 2FA 추가
├── accessibility-voiceover-validation.md ← macOS VoiceOver 수동 체크리스트
├── self-hosting-deployment.md         ← Docker Compose 풀 번들·Helm·가이드 문서
└── marketplace-and-plugin-sdk.md      ← 마켓플레이스 전체 + 노드 플러그인 SDK

plan/complete/
├── prd-spec-sync.md                   ← §E "PRD/Spec ↔ 코드 정합성 정리" 완료 (2026-05-11)
├── llm-provider-followups.md          ← §C "LLM Provider 확장" 완료 (2026-05-11)
└── logic-node-followups.md            ← Logic 노드 잔여 P0/P1 (D1·D2·D4·D5·D7) 완료, D3 → merge-p2-async-fanin.md 분리 (2026-05-11)
```

각 plan 문서는 다음 구조를 따른다:

- **배경** — PRD/Spec의 어떤 항목이 미구현인지, 현 코드 상태
- **관련 문서** — PRD·Spec·메모리·기존 plan 링크
- **작업 단위** — 체크박스 todo 목록 (SDD: spec → 테스트 → 구현 순서)
- **수용 기준** — Definition of Done
- **의존성·리스크** — 다른 plan, 외부 시스템 영향

---

## 참고: 이미 완료되어 본 plan에 포함되지 않은 영역

- `plan/complete/feature-roadmap/stages.md` Stage 1~11 (LLM 토큰 추적 / Parallel P1 / Background 평면 구현 / 팀 워크스페이스 UI / RBAC / 2FA TOTP / 조직 Integration 공유 / OTel 트레이싱 / 알림 룰 CRUD / 접근성 자동화 / 매뉴얼 검색)
- `plan/complete/node-architecture/*` (handler colocation, schema audit, sub-workflow execution 등)
- `plan/complete/workflow-assistant/*` (Workflow AI Assistant 본체)
- `plan/complete/ai-knowledge-base/*` (Phase 2 KB + Graph RAG PRD 단계 — 코드 구현은 ✅, PRD 표기 갱신은 본 plan의 `prd-spec-sync.md`에서 처리)

```

#### `plan/in-progress/20260516-full-review/RESOLUTION.md`
```
---
worktree: full-review-fixes-a1b2c3
started: 2026-05-16
owner: developer
---

# Full-Review Resolution — 2026-05-16

> 기준 보고서: `plan/in-progress/20260516-full-review/SUMMARY.md`
> 작업 worktree: `.claude/worktrees/full-review-fixes-a1b2c3` / branch `claude/full-review-fixes-a1b2c3`
> 사용자 요청: "우선순위가 높은 순서대로 의사결정이 필요 없는 부분을 순차적으로 경고 단계까지 모두 처리해줘"
> 검증: 백엔드 단위 테스트 3,762/3,762 통과, `tsc --noEmit -p tsconfig.build.json` 통과

본 문서는 위 SUMMARY 의 발견사항 중 "의사결정 불필요 + 위험도 Critical~Warning" 항목을 1회 작업으로 일괄 처리한 결과를 기록한다. 후속 의사결정이 필요한 항목과 deferred 항목은 마지막 두 절에서 명시한다.

---

## 처리 완료 (Critical)

| # | 위치 | 변경 |
|---|------|------|
| C-5 | `backend/src/modules/execution-engine/execution-engine.service.ts:3637,3679,3735` | `planContainerBody` 안의 `allNodes.find()` 를 함수 도입부에서 1회 생성한 `nodeMap` 의 `nodeMap.get()` 호출로 전환. 동일 `nodeMap` 을 반환 plan 에 재사용해 중복 Map 생성 제거 |
| C-7 | spec/*.md 11곳 | `11-mcp-client.md#23-internal-bridge` 깨진 앵커를 실제 헤딩(`### 2.3 Internal Bridge (in-process)`) 의 GFM slug `#23-internal-bridge-in-process` 로 일괄 치환 |
| C-9 | `backend/migrations/V052__notification_type_integration_action_required.sql` (신규) | `notification.type` CHECK 제약에 `integration_action_required` 추가. `IntegrationActionRequiredNotifierService` INSERT 가 check_violation 으로 실패하던 결함 해소 |
| C-11 (부분) | `backend/src/main.ts`, `backend/src/modules/hooks/hooks.service.spec.ts` | `NestFactory.create(AppModule, { rawBody: true })` 적용 (HMAC 서명 검증 활성화). HMAC + bearer 경로 단위 테스트 9건 추가 (length mismatch / equal-length mismatch / valid match / missing signature / missing rawBody / signature mismatch / valid sha256 / unsupported algorithm 등) |
| C-13 | `backend/package.json` | `overrides` 에 `protobufjs ^7.5.6`, `fast-uri ^3.1.2` 추가. `npm audit` 결과 fast-uri/protobufjs 다중 CVE 해소 (잔여: hono via @modelcontextprotocol/sdk W-57, OTel breaking W-54/W-56 — deferred) |
| C-14 | `spec/conventions/conversation-thread.md:3` | `[Spec AI 공통 §11](.../0-common.md#11-conversation-context)` → `[Spec AI 공통 §10](.../0-common.md#10-conversation-context-자동-컨텍스트-주입)`. 실제 헤딩 번호 10 과 동기화 |
| C-15 | `spec/2-navigation/4-integration.md:951` | `[Spec Cafe24 API 메타데이터 §6](.../cafe24-api-metadata.md#6-allowlist-와의-관계)` → `§7` / `#7-allowlist-와의-관계`. 실제 헤딩 번호 7 과 동기화 |

W-60 (V049 파일-디렉토리 충돌) 은 현 base 커밋(`3f5457aa`) 에 빈 V049 디렉토리가 존재하지 않아 별도 조치 없이 already-resolved 로 분류한다.

---

## 처리 완료 (Warning)

| # | 위치 | 변경 |
|---|------|------|
| W-2 | `backend/src/modules/hooks/hooks.service.ts:18,159` | HMAC 알고리즘 허용 목록 `Set(['sha256','sha512'])` 신설. `verifyAuth` 안에서 외부 입력 algorithm 을 허용 목록 외 값일 때 `UnauthorizedException`. 단위 테스트 1건 추가 |
| W-15 | `spec/5-system/10-graph-rag.md:236` | `graph_extraction_status` Enum 값에 `failed` 추가 + 부연 설명. §7/§3.2 의 영구 실패 분기와 자체 모순 해소 |
| W-21 | `backend/src/modules/statistics/statistics.service.ts:80` | `getSummary` 의 unconditional 워크스페이스 집계 쿼리 + workflowId 별 재집계 패턴을 단일 QueryBuilder 로 통합. workflowId 가 있을 때만 `andWhere` 추가, 첫 쿼리 결과 폐기 제거 |
| W-22 | `backend/src/modules/executions/executions.service.ts:20,127` | `executionPath` 조회에 `MAX_EXECUTION_PATH_ROWS=10000` 상한 (`take`). 대규모 ForEach 로그 행 메모리 적재량 안전망. 관련 spec 테스트 갱신 |
| W-25 | `backend/src/modules/websocket/websocket.service.ts:92` | `sanitizePayloadForWs` 가 자식 mutation 없는 경우 원본 참조를 반환하도록 변경. GC pressure 감소 + emit hot path 의 객체 할당 제거 |
| W-31 (5건) | `backend/src/modules/integrations/services/credentials-transformer.ts`, `backend/src/modules/integrations/integrations.service.ts:702`, `backend/src/modules/integrations/integration-oauth.service.ts:282,307`, `backend/src/nodes/presentation/table/table.handler.ts:264` | `console.warn` / `console.error` 5곳을 NestJS `Logger` 인스턴스로 교체. 모듈 수준 인스턴스가 필요한 곳은 `new Logger('<name>')` 로 import |
| W-37 | `backend/src/modules/hooks/hooks.service.spec.ts` | `constantTimeEquals` 분기 (length mismatch / equal-length / 성공) 단위 테스트가 bearer + HMAC 시나리오로 9건 추가 (C-11 와 합쳐 한 번에 작성) |
| W-41 | `backend/test/webhook-trigger.e2e-spec.ts:74,95,112,134` | `e2e-X-${Date.now()}` 4곳을 `crypto.randomBytes(8).toString('hex')` 기반으로 전환. 동시 e2e 실행 시 endpointPath 충돌 방지 |
| W-46 | `backend/src/common/dto/pagination.dto.ts:11,53` | `PaginationQueryDto.sort` 에 `@Matches(/^[a-zA-Z][a-zA-Z0-9_]*$/)` + `@MaxLength(64)` 적용. 서비스별 `getSortColumn()` 화이트리스트를 보조하는 DTO 레벨 1차 차단 |
| W-55 | `backend/package.json` | C-13 와 함께 `fast-uri` overrides 추가. `npm audit` GHSA-q3j6-qgpj-74h6 / GHSA-v39h-62p7-jpjc 해소 |
| W-63 | `backend/migrations/V053__notification_workspace_type_resource_idx.{sql,conf}` (신규) | `notification(workspace_id, type, resource_id, created_at DESC)` 복합 인덱스를 `CONCURRENTLY` 로 추가. `NotificationsService.hasRecentByResource` idempotency 쿼리 hot path 인덱스 보강 |
| W-68 | `backend/src/modules/websocket/websocket.gateway.ts:217` | `authorize()` await 경계 이후 `clientSubs.size >= MAX_SUBSCRIPTIONS_PER_CONNECTION` 재검사 추가. 동시 subscribe 가 한도 검사를 interleave 하는 race 해소 |
| W-69 | `spec/4-nodes/4-integration/4-cafe24.md:23,90` | `pagination` 필드의 `cursor?: string` 제거 + 사유 문구 추가. §3, §4.2 의 cursor 언급 동시 삭제 |
| W-77 | `frontend/README.md:7` | `yarn dev` / `pnpm dev` / `bun dev` 명령 제거. 루트 CLAUDE.md "패키지 매니저" 규약(npm 전용) 과 정합 |
| W-79 | `packages/expression-engine/README.md`, `packages/node-summary/README.md` (신규) | 두 패키지의 목적·빌드·사용·boundary 를 정리한 최소 README 작성 |
| W-80 | `README.md:333` | h1 `# integration (SSO)` 을 h2 로 강등. 직속 자식 `## Google OAuth 연동 설정` 도 h3 로 동시 강등 |

> 자료의 단일 진실 원칙 상, 본 표의 변경은 모두 동일 branch (`claude/full-review-fixes-a1b2c3`) 의 단일 작업 단위로 묶여 있다.

---

## 의사결정 보류 (사용자/스펙 합의 필요)

| # | 사유 |
|---|------|
| C-1 / C-2 | Re-run 기능 백엔드·프론트엔드 완전 미구현. 신규 worktree 에서 `replay-rerun.md` PR2 단위로 별도 진행 필요 |
| C-3 | AI Agent 일반 도구 연결 모델 결정 — 사용자 합의 필요 |
| C-4 | `sanitizePayloadForWs` 설정 레이어 이동 — emit hot path 의 trust boundary 재설계 필요 (allowlist 정의가 의사결정 사안) |
| C-6 | `ExecutionEngineService` God-Object 분해 — 4단계 분리안 (`AiConversationOrchestrator` 등) 별도 plan 으로 진행 |
| C-8 | README 포트 혼재 — 환경별(host dev=3000 vs docker fullstack=3012) 매핑 정확도 확인이 필요 |
| C-10 | `AuthConfig.config` 평문 → encryptedJsonTransformer + 평문 행 마이그레이션 스크립트 — 데이터 마이그레이션 절차 사용자 합의 필요 |
| C-12 | Cafe24 OAuth callback/refresh e2e — HTTP stub 컨테이너 추가가 e2e 인프라 변경 사안 |
| W-1 | WebSocket CORS `*` → frontendUrl 화이트리스트 — 환경 분기(`NODE_ENV==='production'`) 외의 조건 결정 필요 |
| W-3 | DOMPurify `ALLOWED_ATTR` 의 `style` 제거 — CSS 정책 결정 필요 |
| W-4 / W-5 | DNS rebinding / DB 호스트 SSRF — 보안 정책 결정 필요 |
| W-6 | sub-workflow workspace 격리 — 엔진 invariant 변경, 별도 plan 권장 |
| W-7~W-14 | 요구사항 항목 (`errorPolicy`, marketplace SDK, integration_action_required UI 등) — 각각 별도 plan |
| W-16 | API 경로 prefix `/api/v1/` vs `/api/` — 정책 확정 필요 |
| W-18 | spec §2.2 API 직호출 대비 — 별도 spec 보강 |
| W-19 | i18n parity main 병합 여부 확인 (다른 worktree 상태 검증) |
| W-23 | `deriveContainerAssignments` 16 패스 — 자료구조 재설계 필요 |
| W-24 | `appendExecutionPath` 배치 INSERT 전환 — 별도 PR 권장 |
| W-26 / W-27 | expression-resolver/ws snapshot 캐시 — 별도 PR 권장 |
| W-28 / W-29 / W-30 / W-33~W-36 | 대형 파일 분해·헬퍼 단일화 리팩토링 — 영역별 별도 PR |
| W-44 / W-47 / W-48 | API 계약 변경 (controller 단 IDOR 보강, throttle, PATCH 패턴) — 호환성·spec 동시 갱신 필요 |
| W-49~W-53 | 아키텍처 디커플링 (DI 토큰, 순환 의존 해소, common/shared 경계, Cafe24ApiClient 분해) — 별도 plan |
| W-54 / W-56 | OpenTelemetry 0.76.0 업데이트 — breaking change, 호환성 검증 필요 |
| W-57 | `@modelcontextprotocol/sdk` 최신화 → hono 취약점 해소 — SDK breaking 확인 필요 |
| W-58 / W-59 | Playwright/MinIO 이미지 버전 정렬 — 사용자 환경 검증 |
| W-61 / W-62 / W-64 | DB·entity·service 변경 — 호출자 영향 확인 필요 |
| W-65 / W-66 / W-67 | 동시성 (boot race, schedule runner, foreach context clone) — invariant 변경, 별도 PR |
| W-70 / W-71 | 커밋 원자성 원칙 수립 — 프로세스 차원의 합의 |
| W-72 / W-73 / W-74 / W-75 | 부작용 (redis config 확장, OnModuleDestroy, OAUTH_STUB_MODE 가드 통합, mock 보강) — 영향 범위 확인 필요 |
| W-76 | `INTEGRATION_ENCRYPTION_KEY` README 보강 — C-8 README 포트 결정과 함께 처리 권장 |
| W-78 | spec Rationale 56개 보강 — 우선순위별 별도 plan |

---

## 검증

```bash
cd backend
npx tsc --noEmit -p tsconfig.build.json   # exit 0 (src 빌드 그래프 클린)
npx jest --no-coverage --silent           # 210 suites / 3,762 tests / all passed
npm audit                                 # fast-uri / protobufjs CVE 해소 (잔여: hono via mcp/sdk W-57, OTel W-54/W-56)
```

후속 작업으로 commit + PR 작성은 사용자 confirm 후 진행한다.

---

## 후속 조치 (`/ai-review` 통합 후 처리)

PR #126 commit `13d21fcd` 에 대한 `/ai-review` (router 11/13 선별, Critical 0 / Warning 15 / Info 27) 결과 발견된 Warning 항목을 추가 처리했다. 검증: tsc clean, 211 suites / 3,772 tests 통과.

| # | 영역 | 위치 | 변경 |
|---|------|------|------|
| F-A | 부작용/DB | `backend/migrations/V052__*.{sql,conf}` | `ALTER TABLE ADD CONSTRAINT NOT VALID` + `VALIDATE CONSTRAINT` 2단계 + 화이트리스트 외 행 pre-flight 검사 (`RAISE EXCEPTION`). `executeInTransaction=false` 로 짧은 ACCESS EXCLUSIVE lock 만 사용 |
| F-B | 동시성 | `backend/src/modules/websocket/websocket.gateway.ts` | `authorize()` 후 한도 검사·`Set.add`·tentative-add 롤백 패턴으로 묶음. 단위 테스트: deferred authorize 동시 2건에서 정확히 1건만 성공하는지 검증 |
| F-C | 보안 | `backend/src/modules/hooks/hooks.service.ts` | 미허용 HMAC 알고리즘 응답에서 알고리즘 명 제거 (`"Authentication failed"` 고정). 진단은 `this.logger.warn` 으로만. 단위 테스트로 응답에 `md5` 노출 안 됨 검증 |
| F-D | 보안 | `backend/src/modules/websocket/websocket.service.ts` | `sanitizePayloadForWs` 가 `depth > MAX_SANITIZE_DEPTH` 도달 시 원본 대신 `'[REDACTED_DEPTH]'` 반환. 단위 테스트로 깊이 12 페이로드에서 평문 secret 직렬화 미노출 검증 |
| F-E | 요구사항/문서 | `backend/src/modules/executions/executions.service.ts`, `executions.service.spec.ts` | `MAX_EXECUTION_PATH_ROWS` export + 응답에 `executionPathTruncated: boolean` 노출. 테스트에서 10,000 행 case 추가 |
| F-F | 테스트 | `websocket.service.spec.ts`, `websocket.gateway.spec.ts`, `hooks.service.spec.ts`, `pagination.dto.spec.ts` (신규) | 참조 동일성 / depth-redact / sha512 성공 / HMAC 응답 비누출 / WS race / pagination 식별자 패턴 양·음성 케이스 추가 (+10 testcase) |
| F-G | 문서 | `spec/5-system/12-webhook.md` §4.2, `backend/src/common/dto/pagination.dto.ts` | HMAC 알고리즘 허용 목록·information leakage 차단·rawBody 요구를 spec 에 명시. `@ApiPropertyOptional` 에 `pattern`/`maxLength` 메타데이터 추가 |
| F-INFO | 유지보수성 | `backend/src/modules/integrations/integration-oauth.service.ts` | 모듈 수준 logger 변수명 `moduleLogger` → `logger` (다른 파일과 일관성) |
| F-호환성 | 프론트엔드 | grep 결과 | `frontend/src/app/(main)/workflows/[id]/executions/[executionId]/page.tsx:152` 의 `sort: "started_at"` 가 신규 `@Matches` 패턴에 적합. 기존 클라이언트 호환성 영향 없음 |

여전히 보류되는 deferred 항목은 위 §의사결정 보류 표 그대로 유지된다.

```

#### `plan/in-progress/20260516-full-review/SUMMARY.md`
```
# Code Review 통합 보고서

> 기준 커밋: `bbd838ef` (main)
> 검토 일시: 2026-05-16
> 범위: spec/, backend/, frontend/, packages/ 전체
> 리뷰 세션: `plan/in-progress/20260516-full-review/`
> 세션 메타: 13/13 reviewer 성공, 총 154 issue

---

## 세션 개요

본 세션은 표준 `review/code/<...>` 경로가 아닌 `plan/in-progress/20260516-full-review/`에서 실행된 전체 코드베이스 audit 세션이다. 사용자 강조 관점은 **일관성**, **스펙 준수**, **보안**, **리팩토링** 4개 축이다.

---

## 전체 위험도

**HIGH** — Critical 보안/데이터 결함 9건, 구현 미완성(Re-run) 3건, 테스트 커버리지 공백 2건 포함. 즉각 조치가 필요한 CRITICAL 항목이 다수 존재하며, 특히 AuthConfig 평문 저장과 HMAC 웹훅 인증 무동작은 운영 환경 보안에 직결된다.

---

## Critical 발견사항

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| C-1 | 요구사항/스펙 | Re-run 기능 백엔드·프론트엔드 완전 미구현. `POST /executions/:id/re-run`, chain API, 권한 가드, rate limit, audit log, 프론트 UI 모두 없음 | `executions.controller.ts` 전체; `spec/5-system/13-replay-rerun.md`; `plan/in-progress/replay-rerun.md` §3/4/5 전체 미체크 | 새 worktree에서 `replay-rerun.md` PR2 착수. DB 마이그레이션(`re_run_of`, `chain_id` 컬럼) 선행 |
| C-2 | 요구사항/데이터모델 | `Execution` 엔티티에 Re-run 추적 컬럼(`re_run_of`, `chain_id`) 누락 — spec RR-PL-05 및 `spec/1-data-model.md §2.13` 정의 미반영 | `execution.entity.ts:21-81`; `spec/5-system/13-replay-rerun.md §9.1` | TypeORM migration으로 컬럼 추가 + `spec/1-data-model.md §2.13` 갱신 |
| C-3 | 요구사항/AI | AI Agent 일반 도구 연결(ND-AG-06/10/21) 의도적 제거 후 재설계 완전 미결 — 핵심 AI 기능 무기한 보류 | `plan/in-progress/ai-agent-tool-connection-rewrite.md §1`; `spec/4-nodes/3-ai/1-ai-agent.md` | 도구 연결 모델 결정을 위한 사용자 합의를 우선 진행 |
| C-4 | 성능 | `sanitizePayloadForWs`가 모든 WS emit 경로에서 재귀 순회 실행 — 대규모 ForEach(5000+ emit) 시 CPU 병목 | `backend/src/modules/websocket/websocket.service.ts:92-107` | 설정 레이어에서 한 번만 적용하고 WS emit 시 재검사 생략; `messages` 배열 등 신뢰된 필드는 allowlist 방식으로 skip |
| C-5 | 성능 | ForEach 내부 `allNodes.find()` O(N) 선형 탐색이 매 iteration 반복 — 1000회 ForEach × 500노드 시 500,000회 비교 발생 | `execution-engine.service.ts:3679`; `planContainerBody` 내 여러 곳 | `nodeMap.get(id)` O(1) 조회로 전환 (Map이 이미 존재함) |
| C-6 | 아키텍처 | `ExecutionEngineService` 4,733줄 God-Object — 그래프 순회·노드 dispatch·상태 머신·WS 이벤트·AI 대화·분산 continuation을 단일 파일에 집중 | `execution-engine.service.ts:377` 전체 | `AiConversationOrchestrator`, `UserInteractionService`, `GraphTraversalService`, `ExecutionEventEmitter`로 분리 |
| C-7 | 문서 | `spec/5-system/11-mcp-client.md` 헤딩 변경으로 앵커 링크 13건 전 코드베이스에서 파손 (`#23-internal-bridge` → `#23-internal-bridge-in-process`) | `spec/1-data-model.md:247`, `spec/0-overview.md:101`, `spec/4-nodes/4-integration/4-cafe24.md:3,11,337` 외 8개 파일 | 헤딩을 `### 2.3 Internal Bridge`로 단순화하거나 11개 참조 파일 앵커 일괄 수정 |
| C-8 | 문서/보안 | README `FRONTEND_URL` 포트 3000·3002·3012 세 가지 혼재 — OAuth redirect URI 오등록 위험 | `README.md:183, 217, 354-357`; `docker-compose.yml:176` | 환경별(host dev=3000, docker fullstack=3012) 명확히 구분해 기재 |
| C-9 | 데이터베이스/보안 | `integration_action_required` 알림 타입이 DB CHECK constraint에 없어 INSERT 시 `check_violation` 오류로 알림 발사 전체 실패 | `backend/migrations/V001__initial_schema.sql:338`; `integration-action-required-notifier.service.ts:76` | `V052__notification_type_integration_action_required.sql` 마이그레이션 즉시 추가 |
| C-10 | 데이터베이스/보안 | `AuthConfig.config` JSONB가 평문 저장 — spec은 `JSONB (encrypted)` 명시, Webhook Bearer Token/API Key 등 민감 인증 정보 노출 위험 | `auth-config.entity.ts:31`; `auth-configs.service.ts` | `Integration.credentials`와 동일한 `encryptedJsonTransformer` 적용 + 기존 평문 행 마이그레이션 스크립트 |
| C-11 | 테스트/보안 | `HooksService.verifyAuth` HMAC 분기 단위 테스트 전무 + `main.ts`에 `rawBody: true` 미설정으로 HMAC 인증이 운영에서 실제로 동작하지 않을 가능성 | `main.ts`; `hooks.service.spec.ts`; `webhook-trigger.e2e-spec.ts:133-167` | `NestFactory.create(AppModule, { rawBody: true })` 추가; HMAC 단위 테스트 5개 시나리오 추가 |
| C-12 | 테스트 | Cafe24 OAuth callback/BullMQ refresh e2e 미존재 — 핵심 토큰 획득·갱신 경로의 회귀 안전망 부재 | `backend/test/` (관련 파일 없음) | `docker-compose.e2e.yml`에 HTTP stub 컨테이너 추가 후 `integration-cafe24-callback.e2e-spec.ts` 작성 |
| C-13 | 의존성/보안 | `protobufjs <=7.5.5` 다중 CVE — 코드 인젝션, DoS, Prototype pollution 5건 이상 | `backend/package.json` 간접 dep (`@google/genai`, `@opentelemetry/*`) | `npm audit fix` 또는 `"overrides": { "protobufjs": "^7.5.6" }` 추가 |
| C-14 | 문서 | `spec/4-nodes/3-ai/0-common.md#11-conversation-context` 앵커 오기재(실제 섹션 번호 10) | `spec/conventions/conversation-thread.md:3` | 앵커를 `#10-conversation-context-자동-컨텍스트-주입`으로 수정 |
| C-15 | 문서 | `spec/conventions/cafe24-api-metadata.md#6-allowlist-와의-관계` 앵커 불일치(실제 섹션 번호 7) | `spec/2-navigation/4-integration.md:951` | 앵커를 `#7-allowlist-와의-관계`로 수정 |

---

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| W-1 | 보안 | WebSocket 게이트웨이 CORS 와일드카드(`*`) | `websocket.gateway.ts:52` | `NODE_ENV=production`에서 `origin: configService.get('app.frontendUrl')`로 제한 |
| W-2 | 보안 | 웹훅 HMAC `hmacAlgorithm` 허용 목록 없음 | `hooks.service.ts:144`; `create-trigger.dto.ts:61` | `@IsIn(['sha256', 'sha512'])` 검증 추가 |
| W-3 | 보안 | DOMPurify `ALLOWED_ATTR`에 `style` 포함 — CSS 클릭재킹·데이터 유출 벡터 | `presentation-renderers.tsx:45` | `style` 속성 제거; 필요시 `afterSanitizeAttributes` hook으로 CSS 속성 단위 허용 |
| W-4 | 보안 | HTTP Request 노드 DNS rebinding 2차 공격 미차단 | `http-safety.ts:8-12` | `dns.lookup` 결과 IP 재검사 또는 egress 방화벽 보완 |
| W-5 | 보안 | Database Query 노드 사용자 제공 DB 호스트 SSRF 검증 없음 | `database-query.handler.ts:333` | `isPrivateHost`+`resolvesToPrivate` 검증 추가 |
| W-6 | 보안/아키텍처 | sub-workflow 실행 시 workspace 격리 검증 누락 — 교차 workspace 실행 가능 | `execution-engine.service.ts:1049-1054, 1155-1160, 718-725` | `executeSync/Async/Inline` 내부에서 대상 workflow의 `workspaceId` 비교 검증 |
| W-7 | 요구사항 | Parallel 노드 `errorPolicy` schema 미노출 — 항상 기본값 `stop` 동작 | `parallel.schema.ts`; `spec/4-nodes/1-logic/10-parallel.md §1` | `parallel-p2.md §1` 처리 — schema에 `errorPolicy` 노출 |
| W-8 | 요구사항 | Merge 노드 `timeout`/`partialOnTimeout` dormant — 설정해도 warn 로그만 | `merge.handler.ts:89-101` | 프론트엔드 설정 패널에 disabled + 툴팁; 또는 validate 경고 룰 추가 |
| W-9 | 요구사항 | 마켓플레이스·플러그인 SDK 전체 미구현 | `spec/2-navigation/8-marketplace.md`; `plan/in-progress/marketplace-and-plugin-sdk.md` | `0-unimplemented-overview.md` 권장 순서로 Phase A부터 진행 |
| W-10 | 요구사항 | `integration_action_required` 프론트엔드 type-specific 처리 미구현 | `frontend/src/components/` (notification 관련) | frontend notification 컴포넌트에 type-specific 분기 추가 |
| W-11 | 요구사항 | `0-unimplemented-overview.md` 인덱스가 실제 구현 현황과 불일치 | `plan/in-progress/0-unimplemented-overview.md:54, 108-120` | background 모니터링 API 항목 ✅ 갱신 + plan 목록 재동기 |
| W-12 | 보안 | install endpoint IP 기반 rate limiting 미구현 | `cafe24-backlog-residual.md §A-3` | nginx 또는 ThrottlerModule IP 기반 rate limit 추가 |
| W-13 | 요구사항 | Cafe24 BullMQ refresh 실패 시 Sentry/외부 오류 추적 미정의 | `cafe24-backlog-residual.md §D-2` | 에러 격리 정책 spec 명시 + 외부 오류 추적 결정 |
| W-14 | 테스트 | `exchangeCodeForToken`/`refreshAccessToken` fetch 단위 테스트 5개 시나리오 전체 미체크 | `cafe24-backlog-residual.md §B-5-8` | mock fetch + fixture 기반 단위 테스트 추가 |
| W-15 | 스펙 | `graph_extraction_status` Enum에 `failed` 누락(§2.2 vs §7·§3.2 자체 모순) | `spec/5-system/10-graph-rag.md §2.2` | `§2.2` Enum에 `failed` 추가; consistency-check C2 처리 |
| W-16 | 스펙 | API 경로 prefix 혼재 `/api/v1/` vs `/api/` | `spec/5-system/2-api-convention.md` | prefix 정책 확정 + 전체 spec 경로 통일 |
| W-17 | 유지보수성 | `workflow.handler.ts` 에러 분류 문자열 매칭 — 메시지 변경 시 silent regression | `workflow.handler.ts:216-220` | Typed error 계층 도입 후 `instanceof` 분기 전환 |
| W-18 | 스펙 | Cafe24 install endpoint `pending_install` 상태 보호 미명시 | `spec-update-cafe24-test-connection.md §9.1` | spec §2.2 API 직호출 대비 조항 추가 + 구현 확인 |
| W-19 | 요구사항 | i18n ko↔en dict parity 자동 가드 main 병합 여부 불명확 | `harness-i18n-userguide-gap.md`; `harness-review-router-c4f1a2` worktree | worktree 상태 확인 → main 병합 완료 여부 검증 |
| W-20 | 문서/API | Cafe24 신규 에러 코드 2종 Swagger `@ApiResponse` 미명시 | `cafe24-backlog-residual.md §D-1` | 관련 controller에 `@ApiResponse` 데코레이터 추가 |
| W-21 | 성능 | `getSummary`에서 `workflowId` 필터 시 동일 쿼리 두 번 실행 — 첫 번째 결과를 버림 | `statistics.service.ts:80-123` | 단일 쿼리로 통합 |
| W-22 | 성능 | `executionPath` 조회 — 수천 행 메모리 적재 후 `nodeId`만 추출 | `executions.service.ts:123-127` | `MAX_PATH_ROWS` 상한 + LIMIT SQL 절 추가 |
| W-23 | 성능 | `deriveContainerAssignments` 엣지 변경마다 최대 16 패스 × 전체 엣지 동기 순회 — 대형 워크플로 UI 렉 | `frontend/src/lib/stores/editor-store.ts:281-304` | containerId를 엣지에 embed하거나 증분 방식 전환; 단기: pass 상한 축소 |
| W-24 | 성능 | `appendExecutionPath` 노드 실행 시마다 개별 INSERT — 100노드 × 50 ForEach = 5000 INSERT | `execution-engine.service.ts:1554-1567` | 완료 시점에 배치 INSERT로 전환 |
| W-25 | 성능 | `sanitizePayloadForWs` 재귀 호출마다 빈 `result` 객체 새로 생성 — GC pressure | `websocket.service.ts:98` | 민감 키 없으면 원본 참조 반환 |
| W-26 | 성능 | `resolveString`에서 `FULL_EXPRESSION_PATTERN` 중복 정규식 매칭 | `expression-resolver.service.ts:239-245` | 단일 패스 처리 또는 `evaluate` 반환값에 플래그 포함 |
| W-27 | 성능 | `emitExecutionSnapshot` REPEATABLE READ + `findById` 전체 조회 — 동시 구독자 多일 때 반복 heavy 조회 | `websocket.gateway.ts:258-284` | 완료된 실행 snapshot Redis 캐시; 장기: snapshot 전용 경량 쿼리 |
| W-28 | 유지보수성 | `APP_URL` 폴백 리터럴 두 파일 6곳 분산 + `replace(/\/$/, '')` 체인 누락 | `integrations.service.ts:830,1076`; `integration-oauth.service.ts:490,968,1079,1359` | `getAppBaseUrl()` 단일 함수로 통합 |
| W-29 | 유지보수성 | 메시지 길이 상한 불일치 — `LAST_ERROR_MESSAGE_MAX_LEN=200` vs `MCP_ERROR_MESSAGE_MAX_LEN=2048`, 클램프 함수 이중 구현 | `integration-oauth.service.ts:193,220`; `mcp-error-codes.ts:35` | `integrations-error-utils.ts`로 통합 |
| W-30 | 유지보수성 | `extractSid`/`extractOperationId` 파싱 로직 두 provider에 별도 구현 | `cafe24-mcp-tool-provider.ts:454-468`; `mcp-tool-provider.ts:150-161` | `parseMcpToolName` 재사용으로 중복 제거 |
| W-31 | 유지보수성 | `console.warn`/`console.error`가 NestJS Logger 대신 사용된 위치 5곳 이상 | `integrations.service.ts:702`; `integration-oauth.service.ts:307`; `credentials-transformer.ts:45,58`; `table.handler.ts:264-269` | `this.logger.warn/error` 또는 `new Logger(...)` 교체 |
| W-32 | 유지보수성 | `EXPIRING_SOON_INTERVAL` SQL 내장 vs 프론트엔드 `EXPIRING_SOON_DAYS=7` 주석으로만 동기화 | `integrations.service.ts:250` | 공유 상수로 추출 |
| W-33 | 유지보수성 | `integration-oauth.service.ts`(1,818줄) 단일 클래스에 OAuth 흐름 전반과 Cafe24 특화 로직 혼재 | `integration-oauth.service.ts` 전체 | Cafe24 특화 로직을 `cafe24-oauth.service.ts`로 분리 |
| W-34 | 유지보수성 | `ai-agent.handler.ts`(2,099줄) 단일 파일에 AI 에이전트 거의 모든 책임 집중 | `ai-agent.handler.ts` 전체 | `RagAccumulator`, 렌더링 유틸, 멀티-턴 상태 관리 분리 |
| W-35 | 유지보수성 | `IntegrationOAuthService.begin()` Cafe24 private/public 3단 중첩 — 순환 복잡도 높음 | `integration-oauth.service.ts:364` | `beginCafe24(params, meta)`로 추출 + 얼리 리턴 패턴 |
| W-36 | 유지보수성 | `credentials-transformer.ts` 모듈 수준 전역 boolean 플래그 — 테스트 간 상태 오염 가능 | `credentials-transformer.ts:38-39` | `resetWarningFlags()` hook 제공 또는 Logger rate-limiter 활용 |
| W-37 | 테스트 | `HooksService.constantTimeEquals` 분기 미커버 | `hooks.service.ts:176-181` | 길이 불일치·성공 케이스 단위 테스트 추가 |
| W-38 | 테스트 | Cafe24 install e2e `mall_id 불일치 → 403` 케이스 명시됐으나 미구현 | `integration-cafe24-install.e2e-spec.ts:20` | `rejection paths` describe 블록에 케이스 추가 |
| W-39 | 테스트 | Nonce cache Redis 키 HMAC 앞 8자 prefix 충돌 위험 미테스트 | `cafe24-install-nonce-cache.service.ts:108` | 동일 prefix 두 HMAC 독립성 검증; 또는 전체 HMAC 해시로 키 설계 변경 검토 |
| W-40 | 테스트 | `cafe24-token-refresh.processor.spec.ts` `Date.now()` fake timer 없이 사용 | `cafe24-token-refresh.processor.spec.ts:32,48` | `jest.useFakeTimers()` + `jest.setSystemTime()` 사용 |
| W-41 | 테스트 | 웹훅 e2e `Date.now()` 기반 `endpointPath` 생성 — 병렬 실행 시 충돌 가능 | `webhook-trigger.e2e-spec.ts:74,95,112,134` | `randomBytes(8).toString('hex')` 사용 |
| W-42 | 테스트 | `integration-cafe24-install.e2e-spec.ts` credentials 암호화 transformer 우회 — production 경로 미커버 | `integration-cafe24-install.e2e-spec.ts:84-111` | `credentials-transformer.spec.ts`에 암호화/비암호화 경로 통합 추가 |
| W-43 | 테스트 | 웹훅 HMAC 양성 케이스가 `hooks.service.spec.ts`에 위임된다고 명시됐으나 실제로는 없음 — 참조 단절 | `webhook-trigger.e2e-spec.ts:155` | `hooks.service.spec.ts`에 올바른 rawBody+HMAC 서명 케이스 추가 |
| W-44 | API 계약 | `GET /executions/:id`, `GET /executions/workflow/:workflowId` workspaceId 소유권 미검증 IDOR | `executions.controller.ts:56-79` | `@WorkspaceId()` 파라미터 추가 + `verifyOwnership()` 호출 |
| W-45 | API 계약 | webhook spec(§5.2) 에러 응답 형식이 실제 GlobalExceptionFilter envelope과 불일치 | `spec/5-system/12-webhook.md:248-254`; `http-exception.filter.ts:63-72` | spec §5.2를 실제 envelope(`{ error: { code, message, details } }`)과 동기화 |
| W-46 | API 계약 | `PaginationQueryDto.sort` 허용 값 미검증 — 서비스별 `getSortColumn()` 누락 위험 | `pagination.dto.ts:46-51` | DTO 레벨에 `@IsIn([...])` 공통 허용 값 추가 |
| W-47 | API 계약/보안 | `POST /auth/login`/`POST /auth/register`에 개별 throttle 미적용 — spec 10 req/min 대신 100 req/min | `auth.controller.ts:165-200,104-135` | `@Throttle({ default: { ttl: 60_000, limit: 10 } })` 추가 |
| W-48 | API 계약 | `PATCH /notifications/:id/read` — spec §12.1 상태 토글 패턴 위반 | `notifications.controller.ts:73` | `PATCH /notifications/:id` + body `{ isRead: true }`로 변경 또는 spec 예외 명문화 |
| W-49 | 아키텍처 | `ExecutionEngineService` 생성자 16개 의존성 과부하 | `execution-engine.service.ts:421-457` | `HandlerDependenciesFactory` 분리 또는 `NodeRuntimeContext` 인터페이스 추상화 |
| W-50 | 아키텍처 | `ExecutionEngineModule`이 `Cafe24Module` 직접 import — OCP 위반 | `execution-engine.module.ts:25` | `CAFE24_API_CLIENT` DI 토큰 추상화, AppModule conditional provider 등록 |
| W-51 | 아키텍처 | `WebsocketModule` ↔ `ExecutionEngineModule` ↔ `KnowledgeBaseModule` 양방향 순환 의존성 | `execution-engine.module.ts:43`; `websocket.module.ts:22-26`; `knowledge-base.module.ts:38` | `EventEmitter2` 기반 이벤트 분리로 순환 해소 |
| W-52 | 아키텍처 | `backend/src/common` vs `backend/src/shared` 역할 경계 미명시 — `S3Service`가 `common/`에 위치 | `backend/src/common/`, `backend/src/shared/` | `common/` = HTTP/NestJS 레이어, `shared/` = 레이어 독립 타입으로 정의, `S3Service` 이동, ADR 명문화 |
| W-53 | 아키텍처 | `Cafe24ApiClient`(1,271줄) HTTP 요청, rate-limit, OAuth 토큰 갱신, 상태 전이 혼재 | `cafe24-api.client.ts` 전체 | `Cafe24HttpTransport`, `Cafe24TokenManager`, `Cafe24RateLimiter`로 분해 |
| W-54 | 의존성 | OTel 패키지 두 버전 공존(`sdk-node@0.205.0` + `0.57.2`) — trace context 전파 단절 위험 | `backend/package.json` | `@opentelemetry/auto-instrumentations-node`를 `^0.76.0`으로 업데이트 |
| W-55 | 의존성/보안 | `fast-uri` path traversal·host confusion 취약점(CVSS 7.5 HIGH) | `backend/package.json` 간접 dep | `"overrides": { "fast-uri": ">=3.2.0" }` 추가 |
| W-56 | 의존성/보안 | OTel Prometheus DoS 취약점(CVSS 7.5 HIGH) | `@opentelemetry/auto-instrumentations-node@0.55.3` | `^0.76.0`으로 업데이트 |
| W-57 | 의존성 | `hono` JWT 검증 오류·CSS 인젝션·cross-user 캐시 누수 | `backend/package.json` 간접 dep | `@modelcontextprotocol/sdk` 최신 버전으로 업데이트 |
| W-58 | 의존성/테스트 | Playwright docker 이미지(v1.47.0)와 devDependencies(`^1.59.1`) 12 minor 버전 불일치 | `docker-compose.e2e.yml:169`; `frontend/package.json` | docker 이미지를 lock 파일 기준 버전과 일치하도록 업데이트 |
| W-59 | 의존성 | `minio/minio:latest` 태그 미고정 | `docker-compose.yml`, `docker-compose.e2e.yml` | 특정 date-tagged release로 고정 |
| W-60 | 데이터베이스 | V049 마이그레이션 파일-디렉토리 명충돌 — Flyway Linux 환경 예측 불가 동작 | `backend/migrations/V049__integration_consecutive_network_failures.sql` | `git rm -r`로 빈 디렉토리 제거 |
| W-61 | 데이터베이스 | `NotificationsService.findByResource` workspaceId 격리 없음 — 향후 재사용 시 IDOR 위험 | `notifications.service.ts:22-30` | 선택적 `workspaceId` 파라미터 추가 |
| W-62 | 데이터베이스 | `install_token` 컬럼 `VARCHAR(64)` vs spec "길이 제약 없음" 서술 불일치 | `integration.entity.ts:62`; `V042__cafe24_private_app_pending_install.sql:13` | spec Rationale 수정 또는 마이그레이션으로 `TEXT` 변경 |
| W-63 | 데이터베이스 | `hasRecentByResource` 복합 조건 쿼리 인덱스 누락 — 알림 발사 시마다 seq scan | `notifications.service.ts:125-134` | `CREATE INDEX CONCURRENTLY idx_notification_workspace_type_resource` 추가 |
| W-64 | 데이터베이스 | `duplicate`(Workflow 복사) 시 Nodes/Edges 미복사 — 메서드명과 동작 불일치 가능 | `workflows.service.ts:171-188` | spec 의도 확인; 전체 복사라면 `dataSource.transaction` + Node/Edge 복사 |
| W-65 | 동시성 | `pendingContinuations` Map 핸들러 등록 타이밍 race — 부팅 직후 cancel 메시지 drop 가능 | `execution-engine.service.ts:459-526` | 메시지 버퍼 + handler 등록 시 flush 패턴; 또는 `OnApplicationBootstrap`으로 통일 |
| W-66 | 동시성 | `ScheduleRunnerService.onModuleInit` 다중 인스턴스 중복 upsert 동작 가정 미명시 | `schedule-runner.service.ts:107-126` | 동작 가정을 코드 주석에 명시 또는 lock 활용 |
| W-67 | 동시성 | `ForEachExecutor` context 직접 mutate — Parallel 조합 시 잠재 오염 위험 | `foreach-executor.ts:78-83` | `{ ...context, itemContext: { ... } }` shallow clone 전달 |
| W-68 | 동시성 | `handleSubscribe` async await 경계에서 MAX_SUBSCRIPTIONS 한도 재검사 누락 | `websocket.gateway.ts:64` | `authorizer.authorize` 완료 후 `clientSubs.size` 재검사 |
| W-69 | 변경 범위 | B-3-7 cursor 제거 후 `spec/4-nodes/4-integration/4-cafe24.md` §3/§4.2 미갱신 | `spec/4-nodes/4-integration/4-cafe24.md:23,90` | spec에서 `cursor` 언급 제거 + Rationale 결정 근거 명문화 |
| W-70 | 변경 범위 | `test(cafe24)` 커밋에 프로덕션 런타임 동작 변경(`logUsage` try/catch) 혼입 | `d6baf89a`; `integration-handler-base.ts` | fix/test 성격 분리 커밋 원칙 수립 |
| W-71 | 변경 범위 | refactor 커밋에 review 아카이브 파일 26개 혼입 — 코드 히스토리 가독성 저하 | `eacbd45e`, `bb038f90` | review 산출물은 별도 `chore(review):` 커밋으로 분리 |
| W-72 | 부작용 | `Cafe24InstallNonceCache` 독립 Redis 연결 생성 — `redis.config.ts`에 `password/tls` 키 미정의로 인증 Redis 도입 시 replay 방어 무음 비활성화 | `cafe24-install-nonce-cache.service.ts:43-65` | `redisConfig`에 `password/tls` 키 추가 또는 공유 ioredis 인스턴스 DI |
| W-73 | 부작용 | `Cafe24InstallNonceCache.close()` NestJS `OnModuleDestroy` 미등록 — 정상 종료 시 Redis 연결 누수 | `cafe24-install-nonce-cache.service.ts:115-121` | `implements OnModuleDestroy` + `async onModuleDestroy() { await this.close(); }` |
| W-74 | 부작용 | `OAUTH_STUB_MODE` 가드 로직이 세 곳에 서로 다른 허용 목록으로 중복 | `integration-oauth.service.ts:66-70`; `main.ts:27-35` | `isStubModeAllowed()` 공통 유틸로 추출 |
| W-75 | 부작용 | `NotificationsService.hasRecentByResource` 신규 공개 메서드가 기존 부분 mock 테스트에서 누락 시 런타임 오류 | `notifications.service.ts:117-138` | 기존 mock에 `hasRecentByResource: jest.fn()` 추가 |
| W-76 | 문서 | README `INTEGRATION_ENCRYPTION_KEY` 누락 — 신규 개발자가 설정 시 통합 자격증명 암호화 실패 | `README.md:155-196` | `backend/.env` 예시에 `INTEGRATION_ENCRYPTION_KEY=<32-byte-hex>` 추가 |
| W-77 | 문서 | `frontend/README.md` yarn/pnpm/bun 명령 나열 — 프로젝트 규약(npm 전용)과 충돌 | `frontend/README.md:10-14` | yarn/pnpm/bun 줄 제거, npm 단일 명령만 유지 |
| W-78 | 문서 | spec 파일 85개 중 56개(66%)에 `## Rationale` 섹션 부재 | `spec/4-nodes/1-logic/` 외 다수 | 비자명한 complex 노드와 핵심 시스템 스펙부터 우선 추가 |
| W-79 | 문서 | `packages/expression-engine`, `packages/node-summary` README 없음 | `packages/expression-engine/`, `packages/node-summary/` | 최소한의 README(목적, 빌드/사용법, export API) 추가 |
| W-80 | 문서 | `README.md:328` `# integration (SSO)` h1 헤딩 수준 오류 | `README.md:328` | `## integration (SSO)`로 변경 |

---

## 참고 (INFO)

개별 항목은 생략하고 카테고리별 건수를 집계한다. 대표 항목만 인용한다.

| 카테고리 | 건수 | 대표 항목 |
|----------|------|-----------|
| 요구사항 | 7 | ED-AI-39 legacy fallback 만료 기준 미명시(`review-workflow.ts:716`); `buildIntegrationMeta` provider 레지스트리 패턴 필요 시점 미명시 |
| 보안 | 5 | bcrypt 라운드 12 상수 여러 파일 분산; expression-engine AST 샌드박스 확인됨(긍정); `.env` git 추적 제외 확인됨(긍정) |
| 성능 | 4 | `TO_CHAR` GROUP BY 인덱스 미활용 (`statistics.service.ts:135-154`); `Evaluator` new 인스턴스 매 expression 생성; `sortByStartedAt` 매 WS 이벤트마다 전체 배열 정렬 |
| 유지보수성 | 5 | `sanitizeId`/`sanitizeToolName` 동일 정규식 중복; `Cafe24McpToolProvider.__resetForTesting()` public API 노출; `result-detail.tsx` 1,111줄 |
| 테스트 | 5 | 프론트엔드 Cafe24 Private App 설치 흐름 e2e 미커버; Zustand 전역 상태 초기화 패턴 누락; fix ↔ test 추적성(`// 회귀 안전망: <issue-ref>` 주석) 낮음 |
| API 계약 | 4 | `DELETE /workspaces/:id` 204 대신 200; OAuth 콜백 access_token URL 노출(`?token=...`); `GET /login-history` cursor DTO 미사용 |
| 아키텍처 | 3 | `nodes/core/node-component.interface.ts`가 `modules/` 구체 서비스 타입 import; frontend 컴포넌트 레이어 직접 API 호출; `packages/*` 경계 건전함(긍정) |
| 의존성 | 4 | `expression-engine` `dayjs` 버전 낮음; `react`/`react-dom` exact pin; `cron-parser` 중복 설치; `p-limit@7` ESM/CJS 혼용 |
| 데이터베이스 | 3 | `AuthConfig.type` CHECK constraint ORM 미반영; `LlmConfig.apiKey` VARCHAR(500) 암호화 후 근접 가능성; `findByResource` N+1 잠재 + 인덱스 누락 |
| 동시성 | 4 | `WebsocketGateway.subscriptions` async 핸들러 interleave; Nonce SETNX 원자성 확인됨(긍정); `ContinuationBusService` 분산 락 확인됨(긍정); `ParallelExecutor.nodeOutputCache` shallow copy invariant 런타임 검증 없음 |
| 변경 범위 | 3 | `pg-error.ts` 공통 헬퍼 신설 conventions 미언급; Phase 8 spec 동시 갱신 확인됨(긍정); plan/complete 이동 시 spec 링크 갱신 여부 미확인 |
| 부작용 | 2 | `logUsage` swallow 메트릭 연동 없음; `CAFE24_MALL_ID_PATTERN` 정규식 3중 중복 |
| 문서 | 6 | spec 내 `prd/` 경로 참조 역사 표기로 잔존; spec 내 `memory/` 경로 5곳 잔존; CHANGELOG 단일 "Unreleased" 섹션; `backend/README.md` 환경변수 불완전; backend 핵심 서비스 JSDoc 밀도 저조; `frontend/README.md` 보일러플레이트 잔존 |

---

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| requirement | HIGH | Re-run 완전 미구현(C-1/C-2), AI Agent 도구 연결 무기한 보류(C-3), spec-코드-plan 3축 드리프트 |
| security | HIGH | Database Query 노드 SSRF 무방어(W-5), WebSocket CORS 와일드카드(W-1), protobufjs CVE 5건(C-13) |
| performance | HIGH | `sanitizePayloadForWs` CPU 병목(C-4), ForEach O(N) 선형 탐색(C-5), 프론트 16패스 동기 순회(W-23) |
| maintainability | MEDIUM | `APP_URL` 6곳 분산(W-28), 메시지 클램프 이중 구현(W-29), 대형 파일 2건(W-33/W-34) |
| testing | HIGH | HMAC 웹훅 운영 미동작 + 테스트 전무(C-11), Cafe24 OAuth callback e2e 부재(C-12) |
| documentation | HIGH | spec 앵커 링크 13건 파손(C-7/C-14/C-15), README 포트 혼재(C-8), `INTEGRATION_ENCRYPTION_KEY` 누락(W-76) |

... (truncated due to size limit) ...
