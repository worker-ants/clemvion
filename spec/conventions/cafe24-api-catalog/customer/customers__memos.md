---
resource: customer
entity: customers__memos
cafe24_docs: https://developers.cafe24.com/docs/ko/api/admin/#customers--memos
source: Cafe24 REST API Documentation (admin) — downloaded 2026-06-03
---

# Cafe24 API — Customer / Customers memos

> Field-level 카탈로그. Endpoint enumeration index: [`../customer.md`](../customer.md) · 규약: [`../_overview.md`](../_overview.md) · 공식 docs: [Customers memos](https://developers.cafe24.com/docs/ko/api/admin/#customers--memos)
> 복합(nested) 필드의 하위 요소는 `↳` 로 표기한다.

회원 메모(Customers memos)는 특정 회원의 메모에 대한 회원의 하위 리소스입니다. · 회원 메모를 통해 특정 회원에 대하여 메모를 등록, 수정, 삭제 등을 할 수 있습니다.

## 응답 속성 (Property list)

| Attribute | 제약 | 설명 |
|---|---|---|
| `shop_no` |  | 멀티쇼핑몰 번호 |
| `memo_no` |  | 메모 번호 시스템에서 부여한 상품 메모의 고유한 번호. 상품 메모 번호는 쇼핑몰 내에서 중복되지 않는다. |
| `author_id` |  | 작성자 아이디 메모를 작성한 관리자의 아이디 정보. |
| `memo` |  | 메모 내용 메모의 내용. HTML을 사용하여 등록할 수 있다. |
| `important_flag` |  | 중요 메모 여부 중요 메모의 구분여부. T : 중요 메모 · F : 일반 메모 |
| `created_date` |  | 생성일 메모를 작성한 시간. |

## Operations

### `GET /api/v2/admin/customers/{member_id}/memos/count` — Retrieve a count of customer memos

- **Scope**: `mall.read_customer` (read)
- **호출건수 제한**: 40
- **Platform**: cafe24
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-count-of-customer-memos

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  |  | 1 | 멀티쇼핑몰 번호 멀티쇼핑몰 구분을 위해 사용하는 멀티쇼핑몰 번호. |
| `member_id` | ✓ |  |  | 회원아이디 |

### `GET /api/v2/admin/customers/{member_id}/memos` — Retrieve a list of customer memos

- **Scope**: `mall.read_customer` (read)
- **호출건수 제한**: 40
- **Platform**: cafe24
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-customer-memos

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  |  | 1 | 멀티쇼핑몰 번호 |
| `member_id` | ✓ |  |  | 회원아이디 |
| `start_date` |  | 날짜 |  | 검색 시작일 |
| `end_date` |  | 날짜 |  | 검색 종료일 |
| `important_flag` |  |  |  | 중요 메모 여부 T : 중요 메모 · F : 일반 메모 |
| `memo` |  |  |  | 메모 |
| `offset` |  | 최대값: [10000] | 0 | 조회결과 시작위치 |
| `limit` |  | 최소: [1]~최대: [100] | 10 | 조회결과 최대건수 |

### `GET /api/v2/admin/customers/{member_id}/memos/{memo_no}` — Retrieve a customer memo

- **Scope**: `mall.read_customer` (read)
- **호출건수 제한**: 40
- **Platform**: cafe24
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-customer-memo

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  |  | 1 | 멀티쇼핑몰 번호 |
| `memo_no` | ✓ |  |  | 메모 번호 시스템에서 부여한 상품 메모의 고유한 번호. 상품 메모 번호는 쇼핑몰 내에서 중복되지 않는다. |
| `member_id` | ✓ |  |  | 회원아이디 |

### `POST /api/v2/admin/customers/{member_id}/memos` — Create a customer memo

- **Scope**: `mall.write_customer` (write)
- **호출건수 제한**: 30
- **1회당 요청건수 제한**: 1
- **Platform**: cafe24
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#create-a-customer-memo

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  |  | 1 | 멀티쇼핑몰 번호 |
| `member_id` | ✓ |  |  | 회원아이디 |
| `author_id` | ✓ | 최대글자수 : [20자] |  | 작성자 아이디 메모를 작성한 관리자의 아이디 정보. |
| `memo` | ✓ |  |  | 메모 메모의 내용. HTML을 사용하여 등록할 수 있다. |
| `important_flag` |  |  | F | 중요 메모 여부 중요 메모의 구분여부. T : 중요 메모 · F : 일반 메모 |

### `PUT /api/v2/admin/customers/{member_id}/memos/{memo_no}` — Update a customer memo

- **Scope**: `mall.write_customer` (write)
- **호출건수 제한**: 30
- **1회당 요청건수 제한**: 1
- **Platform**: cafe24
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#update-a-customer-memo

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  |  | 1 | 멀티쇼핑몰 번호 |
| `shop_no` |  |  | 1 | 멀티쇼핑몰 번호 |
| `memo_no` | ✓ |  |  | 메모 번호 시스템에서 부여한 상품 메모의 고유한 번호. 상품 메모 번호는 쇼핑몰 내에서 중복되지 않는다. |
| `member_id` | ✓ |  |  | 회원아이디 |
| `author_id` | ✓ | 최대글자수 : [20자] |  | 작성자 아이디 메모를 작성한 관리자의 아이디 정보. |
| `memo` |  |  |  | 메모 메모의 내용. HTML을 사용하여 등록할 수 있다. |
| `important_flag` |  |  |  | 중요 메모 여부 중요 메모의 구분여부. T : 중요 메모 · F : 일반 메모 |

### `DELETE /api/v2/admin/customers/{member_id}/memos/{memo_no}` — Delete a customer memo

- **Scope**: `mall.write_customer` (write)
- **호출건수 제한**: 30
- **Platform**: cafe24
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#delete-a-customer-memo

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  |  | 1 | 멀티쇼핑몰 번호 |
| `memo_no` | ✓ |  |  | 메모 번호 시스템에서 부여한 상품 메모의 고유한 번호. 상품 메모 번호는 쇼핑몰 내에서 중복되지 않는다. |
| `member_id` | ✓ |  |  | 회원아이디 |
