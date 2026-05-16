---
worktree: cafe24-envelope-spec-b8d2e4
started: 2026-05-16
owner: project-planner
---

# Spec Draft: Cafe24 `request` envelope 규약 spec 본문 반영

본 draft 는 코드 fix (PR #102 머지 완료, `Cafe24ApiClient.wrapInCafe24Envelope`) 의 규약을 spec 본문에 반영하기 위한 변경안이다. 인계 노트: `plan/in-progress/spec-update-cafe24-request-envelope.md`.

## 변경 대상

1. `spec/conventions/cafe24-api-metadata.md` — Wire-format 규약 절 신설 + CHANGELOG.
2. `spec/4-nodes/4-integration/4-cafe24.md` — §4 step 8/9 본문 보강 + 새 §4.2 절 + §9.10 Rationale + CHANGELOG.

## 용어 정리 — 기존 "envelope" 과 충돌 회피

spec 안에서 "envelope" 은 이미 두 가지 의미로 쓰인다:

- **노드 출력 envelope** (CONVENTIONS Principle 7) — `{config, output, meta, port}` 의 5필드. 예: `spec/4-nodes/4-integration/0-common.md:33`, `1-http-request.md:181`.
- **Cafe24 wire-format envelope** (본 변경) — POST/PUT 본문의 `{shop_no?, request: {...}}` 구조.

본 변경은 후자를 다루며 모든 신규 문장에서 "**Cafe24 request envelope**" 또는 "**POST/PUT request envelope**" 로 한정 표기한다. 단독 "envelope" 표기는 사용하지 않는다.

---

## Draft #1 — `spec/conventions/cafe24-api-metadata.md`

§3 (예시) 와 §4 (신규 endpoint 추가 절차) **사이** 에 새 §4 를 삽입하고 기존 §4–§7 을 §5–§8 로 번호 이동. 본 절은 메타데이터 row 작성자가 절차(§5, 옛 §4) 에 들어가기 **전에** 읽어야 하는 wire-format 전제이므로 §4 자리가 가장 자연스럽다.

### 새 §4. Wire-format 규약 — POST/PUT request envelope

````markdown
## 4. Wire-format 규약 — POST/PUT `request` envelope

Cafe24 Admin API 의 모든 **POST/PUT** 본문은 다음 형태로 직렬화된다 (Cafe24 자체 규약):

```json
{ "shop_no": <n>, "request": { ...payload } }
```

- `shop_no` 는 top-level 에 두는 유일한 필드. 그 외 모든 필드는 `request` 안으로 wrap.
- envelope 변환은 `Cafe24ApiClient` (`backend/src/nodes/integration/cafe24/cafe24-api.client.ts` 의 `wrapInCafe24Envelope`) 가 일괄 처리한다. 메타데이터 row 작성자는 `location: 'body'` 분류만 신경 쓰면 되고, envelope 적용은 자동.
- `shop_no` 가 body 에 없으면 `{ "request": { ... } }` 만 전송된다.
- body 에 `shop_no` 만 있고 다른 필드가 없는 (degenerate) 케이스도 `{ "shop_no": <n>, "request": {} }` 로 보낸다 — `request` 키 자체가 없으면 Cafe24 가 `400 "Please enter the Request parameter."` 를 반환한다.
- `shop_no` 의 값이 `0` 또는 `null` 인 경우도 그대로 top-level 로 hoist (caller 의 실수가 wire 위에서 가시화되도록). `undefined` 만 hoist 제외.
- DELETE 에는 envelope 을 적용하지 않는다 — 우리 메타데이터의 DELETE row 는 모두 path-only (body 필드 없음) 다. 향후 다른 HTTP method (PATCH 등) 가 추가되면 그 시점에 wire format 확인 후 명시적으로 envelope 적용 여부를 결정한다 (현재 코드는 POST/PUT allowlist 로 강제).

본 규약을 누락하면 Cafe24 가 `400 "Please enter the Request parameter."` 를 반환한다 — 운영 사고 사례 (2026-05-16, `mcp_b74e1adc__product_update` 실패) 가 본 절 신설의 직접 배경.

> **용어 주의**: 본 절의 "envelope" 은 Cafe24 wire format 의 `request` 래퍼다. CONVENTIONS Principle 7 의 **노드 출력 envelope** (`{config, output, meta, port}`) 와 무관한 별개 개념이다.
````

### §7 (옛 §6, allowlist) CHANGELOG 항목 추가 — §8 (옛 §7) 표

기존 표 마지막 행으로 한 항목 추가:

```
| 2026-05-16 | §4 신설 — Cafe24 Admin API 의 POST/PUT 본문 `request` envelope 규약 명문화. 코드 fix(PR #102) 와 결속. 운영에서 `product_update` 가 400 "Please enter the Request parameter." 로 실패한 사례 후속. §4–§7 의 절 번호 일괄 +1 이동. |
```

---

## Draft #2 — `spec/4-nodes/4-integration/4-cafe24.md`

### 2-1. §4 실행 로직 본문 step 8/9 보강

기존:

```
8. **Query / Body 구성**: 메타데이터의 `fieldLocation` (path / query / body) 에 따라 분배. `pagination.{limit, offset, cursor}` 는 항상 query.
9. **호출 (rate-limit-aware)**: `Cafe24ApiClient` wrapper 가 다음을 수행 — `Authorization: Bearer {access_token}` 헤더 부여 → fetch → 응답 헤더 `X-Cafe24-Call-Remain` 모니터링 → 429 응답 시 헤더 값(초) 만큼 sleep 후 재시도(최대 2회).
```

변경:

```
8. **Query / Body 구성**: 메타데이터의 `fieldLocation` (path / query / body) 에 따라 분배. `pagination.{limit, offset, cursor}` 는 항상 query. **POST/PUT 의 경우 body 는 wrapper 가 Cafe24 `request` envelope 으로 wrap 한 뒤 직렬화**한다 (§4.2 참고).
9. **호출 (rate-limit-aware)**: `Cafe24ApiClient` wrapper 가 다음을 수행 — `Authorization: Bearer {access_token}` 헤더 부여 → POST/PUT 본문 `request` envelope wrap (§4.2) → fetch → 응답 헤더 `X-Cafe24-Call-Remain` 모니터링 → 429 응답 시 헤더 값(초) 만큼 sleep 후 재시도(최대 2회).
```

### 2-2. §4.1 (Rate Limit 처리 상세) 뒤에 새 §4.2 신설

````markdown
### 4.2 Request body envelope (POST/PUT 전용)

Cafe24 Admin API 의 POST/PUT 본문은 반드시 `{ shop_no?, request: { ...payload } }` 형태로 직렬화된다. wrapper (`Cafe24ApiClient`) 가 자동 wrap 하므로 호출자(노드 핸들러·MCP Bridge) 는 flat 한 body 객체를 그대로 넘기면 된다.

| caller 의 flat body | wire 직렬화 결과 |
|---|---|
| `{ shop_no: 1, product_name: "X" }` | `{"shop_no":1,"request":{"product_name":"X"}}` |
| `{ product_name: "X" }` (shop_no 생략) | `{"request":{"product_name":"X"}}` |
| `{ shop_no: 1 }` (degenerate — payload 없음) | `{"shop_no":1,"request":{}}` |
| `{}` 또는 body 미지정 | body 미전송 (Content-Type 도 부여 안 함) |

규약 상세는 [`spec/conventions/cafe24-api-metadata.md` §4](../../conventions/cafe24-api-metadata.md#4-wire-format-규약--postput-request-envelope) 가 단일 진실. 본 절은 노드 실행 로직에서 envelope 의 책임이 wrapper 에 있다는 사실만 명시한다.

- DELETE / GET 에는 envelope 을 적용하지 않는다.
- 호출자가 이미 `{request: ...}` 형태로 pre-wrap 한 body 를 넘기면 wrapper 가 즉시 throw 하여 이중 래핑을 차단한다 (개발 단계 가드).

> **용어 주의**: 본 절의 "envelope" 은 Cafe24 wire format 의 `request` 래퍼다. §5 의 노드 출력 envelope (`{config, output, meta, port}`) 와 무관한 별개 개념이다.
````

### 2-3. §9 Rationale 에 §9.10 신설

§9.9 다음에 새 §9.10 삽입:

````markdown
### 9.10 Request envelope wrapping 의 위치 — wrapper 단일 책임

Cafe24 POST/PUT 본문의 `request` envelope 적용 지점 후보:

- (A) 노드 핸들러 / `Cafe24McpToolProvider` 의 body 구성 단계 — `location: 'body'` 분배 직후 wrap.
- (B, 채택) `Cafe24ApiClient.executeWithRateLimit` 의 wire 직렬화 단계 — JSON.stringify 직전에 wrap.

(B) 채택 배경:

- envelope 은 Cafe24 wire format 의 고유 규약이지 노드/MCP 의 관심사가 아니다. wrapper 가 이미 URL prefix (`{mall_id}.cafe24api.com`)·leaky bucket 헤더·토큰 refresh 같은 Cafe24-only 책임을 갖고 있어 SRP 정합.
- 노드 핸들러 (`buildRequestParts`) 와 `Cafe24McpToolProvider.execute` 두 곳이 같은 splitting 로직을 중복 보유 — 단일 지점 fix 가 drift 를 막는다 (코드 fix PR #102 의 실제 결정).
- `Cafe24CallOptions.body: Record<string, unknown>` 외부 시그니처는 변경 없음 — caller 는 flat 객체로 넘기면 됨.
- 운영 사고 (2026-05-16, `product_update` 의 400 "Please enter the Request parameter.") 가 본 결정의 직접 배경. 사고 당시 두 호출 경로가 모두 flat body 를 직렬화해 같은 함정에 빠져 있었다.

POST/PUT 외 method 는 allowlist 로 강제 — 미래 method (PATCH 등) 추가 시 wrapper 안에서 명시적 결정이 강제된다 (DELETE 의 body 가 silently envelope 되지 않도록).
````

### 2-4. §10 CHANGELOG 항목 추가

기존 표 마지막 행으로 한 항목 추가:

```
| 2026-05-16 (envelope) | §4 step 8/9 본문 보강 + §4.2 신설 + §9.10 Rationale 추가 — Cafe24 POST/PUT 본문의 `request` envelope 책임을 wrapper 단일 지점으로 명문화 (코드 fix PR #102 와 결속). 운영 사고 (`product_update` 400 "Please enter the Request parameter.") 후속. 규약 본문 단일 진실은 `spec/conventions/cafe24-api-metadata.md` §4. consistency-check 세션: `review/consistency/2026/05/16/<TBD>/`. |
```

---

## 영향 받지 않는 문서 (점검 후 변경 없음)

- `spec/2-navigation/4-integration.md` — 통합 화면 spec. wire-format 책임은 노드 spec 의 wrapper 에 있어 통합 화면 spec 은 영향 없음.
- `spec/5-system/11-mcp-client.md` — MCP Client. Bridge 호출 경로 (bare operation id) 만 정의. wrapping 은 wrapper 책임이라 본 문서도 변경 없음.
- `spec/conventions/cafe24-api-catalog/` — 카탈로그. endpoint 목록만 다루므로 envelope 규약 변경 영향 없음.

## consistency-check 의무 호출

§6 단계에서 `/consistency-check --spec plan/in-progress/spec-draft-cafe24-request-envelope.md` 를 호출한다. Critical 발견 시 작성 중단.

## 후속

- 본 draft 의 spec 본문 반영이 완료되면 `plan/in-progress/spec-update-cafe24-request-envelope.md` (인계 노트) 와 본 draft 모두 `plan/complete/` 로 `git mv`.
