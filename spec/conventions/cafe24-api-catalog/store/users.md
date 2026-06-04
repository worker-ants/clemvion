---
resource: store
entity: users
cafe24_docs: https://developers.cafe24.com/docs/ko/api/admin/#users
source: Cafe24 REST API Documentation (admin) — fields from full-page HTML; operation 응답 샘플은 code 엔드포인트 /docs/code/api/admin/shell/<entity>.json
---

# Cafe24 API — Store / Users

> Field-level 카탈로그. Endpoint enumeration index: [`../store.md`](../store.md) · 규약: [`../_overview.md`](../_overview.md) · 공식 docs: [Users](https://developers.cafe24.com/docs/ko/api/admin/#users)
> 복합(nested) 필드의 하위 요소는 `↳` 로 표기한다.

운영자(Users)는 쇼핑몰의 대표관리자와 더불어 쇼핑몰을 운영할 수 있는 운영자와 관련된 기능입니다. · 부운영자는 대표관리자가 부여한 권한 내에서 쇼핑몰을 운영할 수 있습니다. · 쇼핑몰에 등록된 운영자를 목록으로 조회하거나 특정 운영자를 조회할 수 있습니다.

## 응답 속성 (Property list)

| Attribute | 제약 | 설명 |
|---|---|---|
| `user_id` |  | 운영자 아이디 운영자 혹은 부운영자의 아이디 |
| `user_name` |  | 운영자 명 운영자 혹은 부운영자의 이름 |
| `phone` | 전화번호 | 전화번호 운영자 혹은 부운영자의 전화번호 |
| `email` | 이메일 | 이메일 운영자 혹은 부운영자의 이메일 주소 |
| `ip_restriction_type` |  | IP 접근제한 IP 접근제한의 사용여부 A : 사용함 · F : 사용안함 |
| `admin_type` |  | 운영자 구분 대표운영자인지 부운영자인지의 구분 P : 대표운영자 · A : 부운영자 |
| `last_login_date` |  | 최근 접속일시 |
| `shop_no` | 최소값: [1] | 멀티쇼핑몰 번호 |
| `nick_name` |  | 운영자 별명 운영자의 별명 |
| `nick_name_icon_type` |  | 별명 아이콘 타입 별명 아이콘 등록. 직접 등록이나 샘플 등록이 가능함. D : 직접 아이콘 등록 · S : 샘플 아이콘 등록 |
| `nick_name_icon_url` |  | 별명 아이콘 URL |
| `board_exposure_setting` |  | 게시판 노출 설정 |
| `memo` |  | 메모 |
| `available` |  | 사용여부 T : 사용함 · F : 사용안함 |
| `multishop_access_authority` |  | 멀티쇼핑몰 접근 권한 T : 허용함 · F : 허용안함 |
| `menu_access_authority` |  | 메뉴 접근 권한 |
| `detail_authority_setting` |  | 상세 권한 설정 |
| `ip_access_restriction` |  | IP 접근 제한 |
| `access_permission` |  | 접속 허용 권한 T : 접속 허용시간 설정과 상관없이 항상 관리자 페이지 접속을 허용함 · F : 사용안함 |
| `admin_language` |  | 어드민 언어 ko_KR : 한국어 · en_US : 영어 · ja_JP : 일본어 |

## Operations

### `GET /api/v2/admin/users` — Retrieve a list of admin users

- **Scope**: `mall.read_store` (read)
- **호출건수 제한**: 40
- **Platform**: cafe24,youtube
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-admin-users

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `search_type` |  |  |  | 검색 타입 member_Id : 회원 아이디 · name : 이름 |
| `keyword` |  |  |  | 검색어 |
| `admin_type` |  |  |  | 운영자 구분 P : 대표운영자 · A : 부운영자 |

#### 응답 (Response)

> Cafe24 공식 docs 의 대표 응답 샘플. 실제 필드 정의는 위 [응답 속성](#응답-속성-property-list) 참조.

```json
{
    "users": [
        {
            "user_id": "admin",
            "user_name": "John Doe",
            "phone": "02-0000-0000",
            "email": "sample@sample.com",
            "ip_restriction_type": "A",
            "admin_type": "P",
            "last_login_date": "2022-01-01T12:00:00+09:00"
        },
        {
            "user_id": "subadmin",
            "user_name": "Jane Doe",
            "phone": "02-0000-0000",
            "email": "sample@sample.com",
            "ip_restriction_type": "A",
            "admin_type": "A",
            "last_login_date": null
        }
    ]
}
```

### `GET /api/v2/admin/users/{user_id}` — Retrieve admin user details

- **Scope**: `mall.read_store` (read)
- **호출건수 제한**: 40
- **Platform**: cafe24,youtube
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#retrieve-admin-user-details

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  | 최소값: [1] | 1 | 멀티쇼핑몰 번호 |
| `user_id` |  |  |  | 운영자 아이디 운영자 혹은 부운영자의 아이디 |

#### 응답 (Response)

> Cafe24 공식 docs 의 대표 응답 샘플. 실제 필드 정의는 위 [응답 속성](#응답-속성-property-list) 참조.

```json
{
    "user": {
        "shop_no": 1,
        "admin_type": "A",
        "user_name": "John Doe",
        "nick_name": "Cool John",
        "nick_name_icon_type": "S",
        "nick_name_icon_url": "https://img.echosting.cafe24.com/design/skin/admin/ko_KR/ico_nick1.gif",
        "board_exposure_setting": {
            "admin_grade_icon": "T",
            "nick_name_icon": "F",
            "writer_name_icon": "F"
        },
        "phone": "02-1234-5678",
        "email": "subadmin1@cafe24.com",
        "memo": "test memo",
        "available": "T",
        "multishop_access_authority": "T",
        "menu_access_authority": {
            "order": {
                "authority": true,
                "detail_setting": {
                    "74": {
                        "key": "74",
                        "name": "전체 주문 조회",
                        "authority": true
                    },
                    "71": {
                        "key": "71",
                        "name": "입금전 관리",
                        "authority": true
                    },
                    "72": {
                        "key": "72",
                        "name": "배송 준비중 관리",
                        "authority": true
                    }
                }
            },
            "product": {
                "authority": true,
                "detail_setting": {
                    "2037": {
                        "key": "2037",
                        "name": "상품목록",
                        "authority": true
                    },
                    "2031": {
                        "key": "2031",
                        "name": "상품등록",
                        "authority": true,
                        "children": {
                            "2032": {
                                "key": "2032",
                                "name": "간단 등록",
                                "authority": true
                            },
                            "2033": {
                                "key": "2033",
                                "name": "일반 등록",
                                "authority": true
                            },
                            "2138": {
                                "key": "2138",
                                "name": "세트 상품 등록",
                                "authority": true
                            },
                            "2135": {
                                "key": "2135",
                                "name": "엑셀 등록",
                                "authority": true
                            }
                        }
                    }
                }
            }
        },
        "detail_authority_setting": {
            "product": {
                "edit_product_category": "F",
                "modify_product_info": null,
                "remove_product_info": "F",
                "change_product_sale_status": "F",
                "change_product_display_status": "F",
                "edit_product_display_reservation": "F",
                "download_product_excel_data_in_menu": "F",
                "show_product_supply_business": "F",
                "edit_product_supply_business": "F",
                "edit_product_supply_production_cost": "F",
                "show_supplier_product_name": "F",
                "edit_product_manufacturer_info": "F",
                "show_product_delivery_count": "F",
                "show_product_sales_count": "F"
            },
            "order": {
                "restrict_searching_order_info": "F",
                "restrict_searching_personal_info": "F",
                "restrict_printing_in_menu": "F",
                "check_payment": "F",
                "cancel_credit_payment": "F",
                "cancel_payco_point_payment": "F",
                "cancel_affiliated_gift_certificate_payment": "F",
                "cancel_affiliation_point_payment": "F",
                "cancel_order": "F",
                "return_product": "F",
                "exchange_product": "F",
                "accept_refunding_product": "F",
                "handle_refunding_product": "F",
                "edit_order_memo": "F",
                "download_order_data_in_menu": "F",
                "show_dashboard_order_info": "F",
                "show_total_ordered_amount": "F",
                "show_integration_balance": "F",
                "cancel_withdrawal": "F",
                "exchange_withdrawal": "F",
                "return_withdrawal": "F",
                "refund_withdrawal": "F"
            }
        },
        "ip_access_restriction": {
            "usage": "T",
            "registered_ip_list": [
                "127.0.0.1"
            ]
        },
        "access_permission": "F",
        "admin_language": "en_US"
    }
}
```
