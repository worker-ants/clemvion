# 정식 규약 준수 Check Payload

본 파일은 orchestrator 가 정식 규약 준수 checker 용으로 작성한 입력입니다. target 문서가 정식 규약(`spec/conventions/**`) 을 따르고 있는지 분석한다.
sub-agent 의 system prompt 에 정의된 호출 규약·등급 기준·출력 형식을 그대로
따르되, 분석 시 아래 "점검 관점" 을 빠짐없이 적용하세요. 결과는 `output_file`
인자에 review.md 로 Write 하고 호출자에게는 STATUS 한 줄만 반환합니다.

## 점검 관점 (정식 규약 준수)

1. **명명 규약** — 파일·식별자·API endpoint 명명이 conventions 규칙과 일치하는가
2. **출력 포맷 규약** — 노드 Output, API 응답, error code 형식 등이 정식 규약을 따르는가
3. **문서 구조 규약** — Overview / 본문 / Rationale 3섹션 권장, `_product-overview.md`·`0-` prefix 등 CLAUDE.md 의 명명 컨벤션 준수
4. **API 문서 규약** — Swagger 패턴·request/response DTO 명명
5. **금지 항목** — conventions 에서 명시적으로 금지한 패턴(예: 옛 prd/, memory/ 경로 사용)을 답습하고 있지 않은가

## 검토 모드
spec draft 검토 (--spec)

## Target 문서
경로: `plan/in-progress/spec-draft-cafe24-hmac-raw-fix.md`

```
---
worktree: cafe24-hmac-raw-fix-b8e2d1
started: 2026-05-16
owner: project-planner
spec_files:
  - spec/4-nodes/4-integration/4-cafe24.md
  - spec/2-navigation/4-integration.md
---

# Spec Draft — Cafe24 HMAC 알고리즘 재정정 (Critical 운영 결함)

## 배경

PR #67 (2026-05-16 SEC H-1) 의 "Java URLEncoder 호환 (공백 `+`)" 가정이 오류였다. 사용자가 신규 Cafe24 Private 통합을 등록 직후에도 `CAFE24_INSTALL_INVALID_HMAC` 발생. 진단 로그는 `reason=hmac_verify_failed urlMallId=gehrig0301 dbMallId=gehrig0301 dbAppType=private` 으로 명확 — mall_id / app_type / install_token / client_secret 모두 매칭하는데 HMAC 자체만 불일치.

증거:
- 사용자 URL: `user_name=%EB%8C%80%ED%91%9C%20%EA%B4%80%EB%A6%AC%EC%9E%90` (Cafe24 가 공백을 `%20` 으로 인코딩)
- 우리 옛 알고리즘: `URLSearchParams` decode → `formUrlEncode` 로 `+` 인코딩 → 메시지 안에 `+`
- Cafe24 의 실제 알고리즘 (Java 샘플): URL value 를 raw 그대로 (`%20` 그대로) HMAC 메시지에 사용

→ **Cafe24 는 URLEncoder 를 호출하지 않는다. URL 의 raw byte 를 그대로 보존한다.**

---

## 변경 1 — `spec/4-nodes/4-integration/4-cafe24.md` §9.8 알고리즘 본문 정정

**위치**: §9.8 Private 앱 App URL HMAC 검증, "알고리즘" 단계 2

**옛 텍스트** (현재 line 429):
> 2. **form-urlencoded** query string 형태로 직렬화: `key=URLencoded-value&...`. 값 인코딩은 Java `URLEncoder.encode(value, "UTF-8")` 호환 — `application/x-www-form-urlencoded` MIME 규약 (공백 → `+`).

**새 텍스트**:
> 2. **원본 URL-encoded 값을 그대로 보존** 해서 query string 형태로 직렬화: `key=raw-value&...`. **decode/re-encode 금지** — Cafe24 의 공식 Java 샘플 `validationCheckHmac` 는 `request.getQueryString()` 을 `&` 로 split 한 뒤 `=` 로 한 번만 split 해서 value 부분을 **raw 그대로** TreeMap 에 저장한다. 즉 Cafe24 가 URL 에 `%20` 으로 보냈으면 HMAC 메시지에도 `%20`, `+` 로 보냈으면 `+` 그대로 유지된다. value 의 의미를 해석하지 않고 byte 단위로 매칭하는 게 정답. **재정정 배경**은 [Spec 통합 화면 ## Rationale](../../2-navigation/4-integration.md#rationale) "HMAC 검증 알고리즘 — raw URL-encoded 값 보존 (2026-05-16 재정정)" 항 참조.

**옛 코드 예시** (line 434-458 의 `formUrlEncode` + `URLSearchParams` 사용 예제):
- 통째로 제거

**새 코드 예시**:
```typescript
function buildHmacMessage(rawQuery: string): string {
  return rawQuery
    .split('&')
    .map((part) => {
      const eqIdx = part.indexOf('=');
      const key = eqIdx === -1 ? part : part.slice(0, eqIdx);
      return { key, raw: part };
    })
    .filter((p) => p.key.length > 0 && p.key !== 'hmac')
    .sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0))
    .map((p) => p.raw)
    .join('&');
}

function verifyHmac(rawQuery: string, clientSecret: string, receivedHmac: string): boolean {
  const message = buildHmacMessage(rawQuery);
  const computed = createHmac('sha256', clientSecret).update(message, 'utf8').digest('base64');
  return timingSafeEqual(Buffer.from(computed), Buffer.from(receivedHmac));
}
```

---

## 변경 2 — `spec/4-nodes/4-integration/4-cafe24.md` CHANGELOG 행 추가

**위치**: §10 CHANGELOG 표 끝

**추가할 행** (기존 `2026-05-16 (ux-cleanup)` 행 다음):

```
| 2026-05-16 (hmac-raw-fix) | §9.8 HMAC 검증 알고리즘 **재정정** — PR #67 SEC H-1 의 "Java URLEncoder 호환 (공백 `+`)" 가정이 오류였음. Cafe24 공식 샘플은 URL 의 값을 decode/re-encode 없이 raw 그대로 HMAC 메시지에 사용한다 (`request.getQueryString()` split → TreeMap 보존). 운영 사용자 보고 (2026-05-16) — Cafe24 가 URL 에 `%20` 으로 공백을 인코딩해 보내는데 우리는 `+` 로 변환해 메시지 불일치. raw-value 보존 방식으로 재정정. 자세한 결정 배경은 [Spec 통합 화면 ## Rationale](../../2-navigation/4-integration.md#rationale) "HMAC 검증 알고리즘 — raw URL-encoded 값 보존 (2026-05-16 재정정)" 항. |
```

---

## 변경 3 — `spec/2-navigation/4-integration.md` Rationale 신규 항

**위치**: `## Rationale` 섹션 말미, 현재 마지막 항 "Cafe24 App URL 상세 페이지 표시 (2026-05-16)" 다음에 추가.

**본문**:

```markdown
### HMAC 검증 알고리즘 — raw URL-encoded 값 보존 (2026-05-16 재정정)

PR #67 의 SEC H-1 (2026-05-16) 가 HMAC 검증을 "Java `URLEncoder.encode(value, "UTF-8")` 호환 (공백 `+`)" 으로 정정했으나, 운영 환경에서 **신규 통합 직후 즉시 HMAC 실패** 가 재현됐다 (사용자 보고, 2026-05-16). HMAC 진단 로그가 `reason=hmac_verify_failed` 를 정확히 식별 — mall_id / app_type / install_token / client_secret 모두 매칭하는데 HMAC 자체만 불일치.

**근본 원인**: Cafe24 의 공식 `validationCheckHmac` Java 샘플은 `request.getQueryString()` 을 `&` 로 split → `=` 로 한 번만 split → TreeMap 에 **raw value 그대로** 저장한 뒤 concat 한다. 즉 **URL value 를 decode 하지 않으며 re-encode 도 하지 않는다**. 우리 SEC H-1 fix 는 "Cafe24 가 URLEncoder 를 호출한다" 라고 가정했지만, 실제로는 URL 의 raw byte sequence 를 그대로 HMAC 메시지에 넣는다.

**증거**: 사용자 보고 URL 의 `user_name=%EB%8C%80%ED%91%9C%20%EA%B4%80%EB%A6%AC%EC%9E%90` — Cafe24 가 공백을 `%20` 으로 보낸다. 만약 Cafe24 가 HMAC 계산에 URLEncoder 를 호출한다면 메시지 안의 값은 `%EB%8C%80%ED%91%9C+%EA%B4%80%EB%A6%AC%EC%9E%90` 가 되어야 하고, 그 결과 Cafe24 자신의 HMAC 도 자기네 URL 과 매칭이 안 되어 검증이 동작하지 않을 것이다. 따라서 Cafe24 는 raw 값을 사용한다 (이론적 추론 + 운영 재현 동시 확인).

**해결**: `buildHmacMessage` 가 `URLSearchParams` 로 decode 하지 않고 `rawQuery.split('&')` 로 직접 파싱해 key/value 의 raw byte string 을 그대로 보존한다. sort 는 key 만 알파벳 순. value 인코딩은 Cafe24 가 어떤 인코더로 URL 을 만들었든 무관 — byte 단위로 일치하기만 하면 된다.

```typescript
function buildHmacMessage(rawQuery: string): string {
  return rawQuery
    .split('&')
    .map((part) => {
      const eqIdx = part.indexOf('=');
      const key = eqIdx === -1 ? part : part.slice(0, eqIdx);
      return { key, raw: part };
    })
    .filter((p) => p.key.length > 0 && p.key !== 'hmac')
    .sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0))
    .map((p) => p.raw)
    .join('&');
}
```

**기각된 옵션 (raw 보존 대신 다양한 인코더 시도)**: `encodeURIComponent` / `URLEncoder` 호환 / browser fetch encoding 등 후보 인코더가 매번 차이가 있어 (`%20` vs `+`, `*` vs `%2A`, `!` vs `%21` 등) 어느 하나로 매칭이 보장되지 않는다. Cafe24 자체도 향후 인코더를 바꿀 수 있다. raw byte 보존은 인코더 invariant 다.

**보안 영향 없음**: HMAC 자체의 cryptographic strength 는 변하지 않는다. capability-token 보호 ([Rationale "CAFE24_INSTALL_INVALID_TOKEN(404) 의 보안 전제"](#cafe24_install_invalid_token404-의-보안-전제-2026-05-14)) 도 그대로. 옛 PR #67 의 SEC H-2 (workspace 횡단 enumeration 방지) 도 그대로.

**테스트 보강**: 사용자 실제 URL (`user_name=...%20...` + 실제 timestamp + 실제 hmac) 의 회귀 보호 테스트 추가. 옛 `accepts HMAC for queries containing space-encoded values` 테스트는 `John+Doe` 형식을 사용했으나 — 그건 우리 옛 알고리즘의 self-fulfilling 검증 (compute 와 verify 가 같은 broken 알고리즘 사용) 이라 실제 Cafe24 동작 검증이 안 됐다. 새 테스트는 **Cafe24 가 보내는 형식 (`%20`) 그대로** raw query 를 만들어 검증한다.

**관련 history**:
- 2026-05-14: HMAC 알고리즘 최초 도입 (`encodeURIComponent` 사용, 운영 양호)
- 2026-05-16 (PR #67 SEC H-1): `formUrlEncode` 로 변경 (잘못된 가정에 기반한 회귀)
- 2026-05-16 (본 결정): raw-value 보존으로 재정정 (Cafe24 실제 동작 반영)
```

---

## 정합성 self-check

- [x] 변경 1 의 새 코드 예시는 변경 3 의 Rationale 코드와 동일 (동기 유지)
- [x] 변경 2 CHANGELOG 행이 변경 3 Rationale 항을 링크
- [x] `formUrlEncode` 헬퍼는 spec 본문 외 다른 인용 없음 (grep 확인)
- [x] `buildHmacMessage` 시그니처 (인자: `rawQuery: string`, 반환: `string`) 호환 — 호출자 (`handleInstall`, `tryRecoverByMallId`) 변경 불필요
- [x] PR #67 SEC H-2 (`tryRecoverByMallId` workspace 횡단 방지) 와 무관 — 본 변경은 message 빌드 알고리즘만 정정
- [x] capability-token 보안 전제 무영향 — install_token 형식 / TTL / 보존 정책 변경 없음

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

테스트는 카탈로그 MD 의 표를 파싱한다 — MD 표 구문이 깨지면 곧장 fail. 따라서 본 카탈로그는 **사람이 직접 손으로 수정하는 SoT** 이며, 코드 변경 시점에 반드시 카탈로그 동기 갱신을 함께 commit 해야 한다(`spec/conventions/cafe24-api-metadata.md` §4 의 신규 endpoint 추가 절차에 인용).

## 5. Coverage Matrix

2026-05-16 기준. 본 매트릭스는 카탈로그 row 수 + 메타데이터 row 수의 한 화면 요약이다 — 위 동기 테스트와 별개의 휴먼 가독성 보조 정보다. row 추가/삭제 시 본 표도 손으로 갱신한다.

| Resource | Supported | Planned | Cafe24 docs sub-resource 수 |
|----------|-----------|---------|---|
| [store](./store.md) | 2 | 50+ | 50+ |
| [product](./product.md) | 7 | 25+ | 28 |
| [order](./order.md) | 6 | 40+ | 47 |
| [customer](./customer.md) | 5 | 15+ | 12 |
| [community](./community.md) | 3 | 25+ | 9 |
| [design](./design.md) | 1 | 5+ | 3 |
| [promotion](./promotion.md) | 5 | 30+ | 10 |
| [application](./application.md) | 3 | 15+ | 8 |
| [category](./category.md) | 6 | 15+ | 5 |
| [collection](./collection.md) | 3 | 10+ | 5 |
| [supply](./supply.md) | 1 | 20+ | 6 |
| [shipping](./shipping.md) | 1 | 15+ | 5 |
| [salesreport](./salesreport.md) | 2 | 3 | 5 |
| [personal](./personal.md) | 2 | 3+ | 3 |
| [privacy](./privacy.md) | 1 | 5+ | 2 |
| [mileage](./mileage.md) | 2 | 8+ | 5 |
| [notification](./notification.md) | 2 | 10+ | 7 |
| [translation](./translation.md) | 1 | 8+ | 4 |
| **합계** | **53** | **~300** | **~250** |

> "Cafe24 docs sub-resource 수" 는 공식 docs 좌측 사이드바에서 본 resource 그룹 아래의 두 번째 레벨 항목 수다. 각 sub-resource 마다 통상 2~5 operation 이 존재하므로 endpoint 합계는 ~500.

## 6. 신규 endpoint 등재 절차

1. Cafe24 공식 문서에서 endpoint 확인.
2. 본 카탈로그 해당 resource 파일에 표 row 추가:
   - 처음 등재 시 `status: planned`, `method`/`path` 는 `?` 허용.
   - 구현 PR 에서 backend 메타데이터 row 1줄 추가 + 카탈로그 row 를 `planned → supported` 로 갱신 + `method`/`path`/`scope`/`paginated` 채움.
3. `_overview.md` §5 의 coverage matrix 카운트도 함께 갱신.
4. `npm test --workspace backend -- catalog-sync` 통과 확인.

> `spec/conventions/cafe24-api-metadata.md` §4 의 신규 endpoint 추가 절차도 본 카탈로그 row 갱신을 step 으로 포함한다.

## 7. CHANGELOG

| 일자 | 변경 |
|------|------|
| 2026-05-16 | 신규 컨벤션 — 18 resource 카탈로그 + 양방향 동기 테스트 도입. 사용자 결정(2026-05-16) "Cafe24 docs 전수 등재" 에 따라 supported 53 + planned ~300 으로 초기 채움. |

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
| `apps_update` | 앱 정보 수정 | Update an app information | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-an-app-information) |
| `appstore_orders_get` | 앱스토어 주문 조회 | Retrieve a Cafe24 store order | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retreive-a-cafe24-store-order) |
| `appstore_orders_create` | 앱스토어 주문 생성 | Create a Cafe24 store order | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#create-a-cafe24-store-order) |
| `appstore_payments_list` | 앱스토어 결제 목록 | Retrieve a list of Cafe24 store payments | ? | ? | ? | ✓ | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-cafe24-store-payments) |
| `appstore_payments_count` | 앱스토어 결제 수 | Retrieve a count of Cafe24 store payments | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-count-of-cafe24-store-payments) |
| `databridge_logs_list` | DataBridge 로그 목록 | Retrieve a list of DataBridge webhook logs | ? | ? | ? | ✓ | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-databridge-webhook-logs) |
| `recipes_list` | 레시피 목록 조회 | Retrieve a list of recipes | ? | ? | ? | ✓ | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-recipes) |
| `recipes_create` | 레시피 생성 | Create a recipe | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#create-a-recipe) |
| `recipes_delete` | 레시피 삭제 | Delete a recipe | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#delete-a-recipe) |
| `scripttags_count` | 스크립트태그 개수 조회 | Retrieve a count of script tags | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-count-of-script-tags) |
| `scripttags_get` | 스크립트태그 단건 조회 | Retrieve a script tag | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-script-tag) |
| `scripttags_create` | 스크립트태그 생성 | Create a script tag | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#create-a-script-tag) |
| `scripttags_update` | 스크립트태그 수정 | Update a script tag | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-a-script-tag) |
| `scripttags_delete` | 스크립트태그 삭제 | Delete a script tag | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#delete-a-script-tag) |
| `webhooks_logs_list` | Webhook 로그 목록 | Retrieve a list of webhook logs | ? | ? | ? | ✓ | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-webhook-logs) |
| `webhooks_update` | Webhook 설정 수정 | Edit webhook settings | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#edit-webhook-settings) |

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
| `category_count` | 카테고리 개수 조회 | Retrieve a count of product categories | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-count-of-product-categories) |
| `category_decorationimages_get` | 카테고리 꾸미기 이미지 조회 | Retrieve decoration image settings by category | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-decoration-image-settings-by-category) |
| `category_decorationimages_update` | 카테고리 꾸미기 이미지 수정 | Update decoration images of a product category | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-decoration-images-of-a-product-category) |
| `category_seo_get` | 카테고리 SEO 조회 | Retrieve SEO settings by category | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-seo-settings-by-category) |
| `category_seo_update` | 카테고리 SEO 수정 | Update a product category SEO | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-a-product-category-seo) |
| `mains_list` | 메인 카테고리 목록 조회 | Retrieve a list of main categories | ? | ? | ? | ✓ | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-main-categories) |
| `mains_add` | 메인 카테고리 추가 | Add main category | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#add-main-category) |
| `mains_update` | 메인 카테고리 수정 | Update main category | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-main-category) |
| `mains_delete` | 메인 카테고리 삭제 | Delete main category | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#delete-main-category) |
| `autodisplay_list` | 자동 진열 목록 조회 | Retrieve a list of auto layouts | ? | ? | ? | ✓ | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-auto-layouts) |
| `autodisplay_create` | 자동 진열 생성 | Create auto layout for selected product category | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#create-auto-layout-for-selected-product-category) |
| `autodisplay_update` | 자동 진열 수정 | Update auto layout for selected product category | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-auto-layout-for-selected-product-category) |
| `autodisplay_delete` | 자동 진열 삭제 | Delete auto layout for selected product category | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#delete-auto-layout-for-selected-product-category) |

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
| `brands_count` | 브랜드 개수 조회 | Retrieve a count of brands | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-count-of-brands) |
| `brands_create` | 브랜드 생성 | Create a brand | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#create-a-brand) |
| `brands_update` | 브랜드 수정 | Update a brand | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-a-brand) |
| `brands_delete` | 브랜드 삭제 | Delete a brand | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#delete-a-brand) |
| `manufacturers_count` | 제조사 개수 조회 | Retrieve a count of manufacturers | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-count-of-manufacturers) |
| `manufacturers_get` | 제조사 단건 조회 | Retrieve a manufacturer | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-manufacturer) |
| `manufacturers_create` | 제조사 생성 | Create a manufacturer | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#create-a-manufacturer) |
| `manufacturers_update` | 제조사 수정 | Update a manufacturer | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-a-manufacturer) |
| `trends_count` | 트렌드 개수 조회 | Retrieve a count of trends | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-count-of-trends) |
| `classifications_list` | 사용자 정의 카테고리 목록 | Retrieve a list of custom categories | ? | ? | ? | ✓ | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-custom-categories) |
| `classifications_count` | 사용자 정의 카테고리 수 | Retrieve a count of custom categories | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-count-of-custom-categories) |
| `origin_list` | 원산지 목록 조회 | Retrieve a list of origins | ? | ? | ? | ✓ | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-origins) |

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
| `boards_settings_get` | 게시판 설정 조회 | Retrieve the board settings | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-the-board-settings) |
| `boards_settings_update` | 게시판 설정 수정 | Update the board settings | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-the-board-settings) |
| `board_articles_create` | 게시판 글 작성 | Create a board post | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#create-a-board-post) |
| `board_articles_update` | 게시판 글 수정 | Update a board post | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-a-board-post) |
| `board_articles_delete` | 게시판 글 삭제 | Delete a board post | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#delete-a-board-post) |
| `board_articles_comments_list` | 게시판 댓글 목록 | Retrieve a list of comments for a board post | ? | ? | ? | ✓ | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-comments-for-a-board-post) |
| `board_articles_comments_create` | 게시판 댓글 작성 | Create a comment for a board post | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#create-a-comment-for-a-board-post) |
| `board_articles_comments_delete` | 게시판 댓글 삭제 | Delete a comment for a board post | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#delete-a-comment-for-a-board-post) |
| `boards_comments_bulk` | 게시판 댓글 일괄 조회 | Retrieve comments in bulk | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-comments-in-bulk) |
| `boards_seo_get` | 게시판 SEO 조회 | Retrieve SEO settings for board | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-seo-settings-for-board) |
| `boards_seo_update` | 게시판 SEO 수정 | Update SEO settings for board | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-seo-settings-for-board) |
| `commenttemplates_list` | 자주 쓰는 답변 목록 | Retrieve frequently used answers | ? | ? | ? | ✓ | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-frequently-used-answers) |
| `commenttemplates_get` | 자주 쓰는 답변 단건 | Retrieve a frequently used answer | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-frequently-used-answer) |
| `commenttemplates_create` | 자주 쓰는 답변 생성 | Create a frequently used answer | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#create-a-frequently-used-answer) |
| `commenttemplates_update` | 자주 쓰는 답변 수정 | Update a frequently used answer | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-a-frequently-used-answer) |
| `commenttemplates_delete` | 자주 쓰는 답변 삭제 | Delete a frequently used answer | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#delete-a-frequently-used-answer) |
| `financials_monthlyreviews_count` | 월별 후기 카운트 | Retrieve the total count for monthly reviews and ratings | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-the-total-count-for-monthly-reviews-and-ratings) |
| `urgentinquiry_get` | 긴급 문의 게시글 조회 | Retrieve an urgent inquiry post | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-an-urgent-inquiry-post) |
| `urgentinquiry_reply_get` | 긴급 문의 답변 조회 | Retrieve a reply for urgent inquiry post | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-reply-for-urgent-inquiry-post) |
| `urgentinquiry_reply_create` | 긴급 문의 답변 작성 | Create a reply for urgent inquiry post | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#create-a-reply-for-urgent-inquiry-post) |
| `urgentinquiry_reply_update` | 긴급 문의 답변 수정 | Update a reply for urgent inquiry post | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-a-reply-for-urgent-inquiry-post) |

```

#### `spec/conventions/cafe24-api-catalog/customer.md`
```
# Cafe24 API Catalog — Customer (회원)

> 카탈로그 형식·동기 정책: [`_overview.md`](./_overview.md).

base URL: `https://{mall_id}.cafe24api.com/api/v2/admin/`

## 표

| id | 라벨 (한) | English title | method | path | scope | paginated | status | docs |
|----|---|---|---|---|---|---|---|---|
| `customer_list` | 회원 목록 조회 | Retrieve a list of customers | GET | `customers` | read | ✓ | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-customers) |
| `customer_get` | 회원 단건 조회 | Retrieve a list of customers (single) | GET | `customers/{member_id}` | read |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-customers) |
| `customer_update` | 회원 정보 수정 | Update a customer | PUT | `customers/{member_id}` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-customers) |
| `customer_group_update` | 회원 등급 변경 | Update a customer's customer tier | PUT | `customergroups/customers` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-a-customer-s-customer-tier) |
| `customer_memos_create` | 회원 메모 작성 | Create a customer memo | POST | `customers/{member_id}/memos` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#create-a-customer-memo) |
| `customer_delete` | 회원 탈퇴 처리 | Delete an account | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#delete-an-account) |
| `customer_autoupdate_get` | 회원 등급 자동 갱신 조회 | Retrieve customer tier auto-update details | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-customer-tier-auto-update-details) |
| `customer_memos_count` | 회원 메모 개수 | Retrieve a count of customer memos | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-count-of-customer-memos) |
| `customer_memos_list` | 회원 메모 목록 | Retrieve a list of customer memos | ? | ? | ? | ✓ | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-customer-memos) |
| `customer_memos_get` | 회원 메모 단건 조회 | Retrieve a customer memo | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-customer-memo) |
| `customer_memos_update` | 회원 메모 수정 | Update a customer memo | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-a-customer-memo) |
| `customer_memos_delete` | 회원 메모 삭제 | Delete a customer memo | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#delete-a-customer-memo) |
| `customer_paymentinfo_list` | 회원 결제수단 목록 | Retrieve a customer's list of payment methods | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-customer-s-list-of-payment-methods) |
| `customer_paymentinfo_delete` | 회원 결제수단 삭제 | Delete customer's payment information | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#delete-customer-s-payment-information) |
| `customer_paymentinfo_delete_by_id` | 회원 결제수단 ID 삭제 | Delete customer's payment information by payment method ID | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#delete-customer-s-payment-information-by-payment-method-id) |
| `customer_plusapp_get` | Plus 앱 설치 정보 조회 | Retrieve app installation information | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-app-installation-information) |
| `customer_social_get` | 소셜 계정 조회 | Retrieve a customer's social account | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-customer-s-social-account) |
| `customers_properties_view` | 회원가입 필드 조회 | View account signup fields | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#view-account-signup-fields) |
| `customers_properties_edit` | 회원가입 필드 수정 | Edit account signup fields | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#edit-account-signup-fields) |
| `social_list` | 소셜 연동 목록 | List all social | ? | ? | ? |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#list-all-social) |
| `customergroups_list` | 회원 등급 목록 | Retrieve a list of customer tiers | ? | ? | ? | ✓ | planned | [↗](https://d

... (truncated due to size limit) ...
