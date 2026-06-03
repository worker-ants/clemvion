---
resource: community
entity: boards
cafe24_docs: https://developers.cafe24.com/docs/ko/api/admin/#boards
source: Cafe24 REST API Documentation (admin) — downloaded 2026-06-03
---

# Cafe24 API — Community / Boards

> Field-level 카탈로그. Endpoint enumeration index: [`../community.md`](../community.md) · 규약: [`../_overview.md`](../_overview.md) · 공식 docs: [Boards](https://developers.cafe24.com/docs/ko/api/admin/#boards)
> 복합(nested) 필드의 하위 요소는 `↳` 로 표기한다.

게시판(Boards)은 상품리뷰나 상품문의 등 고객의 반응이 글로 게시되는 공간입니다. · 게시판 리소스에서는 현재 쇼핑몰에 있는 게시판의 목록을 확인할 수 있습니다.

## 응답 속성 (Property list)

| Attribute | 제약 | 설명 |
|---|---|---|
| `shop_no` |  | 멀티쇼핑몰 번호 |
| `board_no` |  | 게시판 번호 |
| `board_type` |  | 게시판 분류 1 : 운영 · 2 : 일반 · 3 : 자료실 · 4 : 기타 · 5 : 상품 · 6 : 갤러리 · 7 : 1:1상담 · 11 : 한줄메모 |
| `board_name` |  | 게시판 이름 |
| `use_additional_board` |  | 게시판 추가여부 T : 추가게시판 · F : 기본게시판 |
| `use_board` |  | 게시판 사용여부 T : 사용함 · F : 사용안함 |
| `use_display` |  | 표시여부 T : 표시함 · F : 표시안함 |
| `use_top_image` |  | 화면 상단 이미지 사용여부 T : 사용함 · F : 사용안함 |
| `top_image_url` |  | 화면 상단 이미지 경로 |
| `use_report` |  | 게시글 신고기능 사용 여부 T : 사용함 · F : 사용안함 |
| `use_writer_block` |  | 작성자 차단 기능 사용 여부 T : 사용함 · F : 사용안함 |
| `display_order` |  | 정렬 순서 |
| `attached_file` |  | 파일 첨부 T : 사용함 · F : 사용안함 |
| `attached_file_size_limit` |  | 첨부파일용량제한 (Byte) |
| `article_display_type` |  | 게시물 표시 A : 전체 게시물 표시 · T : 첨부 파일이 있는 게시물만 표시 · F : 첨부 파일이 없는 게시물만 표시 |
| `image_display` |  | 이미지 표시 T : 사용함 · F : 사용안함 |
| `image_resize` |  | 리사이징할 이미지 폭 (px) |
| `use_category` |  | 카테고리 기능 사용여부 T : 사용함 · F : 사용안함 |
| `categories` |  | 카테고리 정보 |
| `secret_only` |  | 비밀글만 등록 가능여부 T: 비밀글만 등록 · F: 공개글과 비밀글을 선택하여 등록 |
| `admin_confirm` |  | 관리자 확인 기능 사용여부 T: 사용함 · F: 사용안함 |
| `comment_author_display` |  | 댓글 작성자 표시 설정 N : 이름 · U : 별명(별명기입전 이름으로 노출) · I : 별명(별명기입전 아이디로 노출) |
| `comment_author_protection` |  | 댓글 작성자 보호 설정 |
| `spam_auto_prevention` |  | 스팸 자동생성방지 기능 |
| `reply_feature` |  | 답변기능 T : 사용함 · F : 사용안함 |
| `write_permission` |  | 쓰기 권한 A : 관리자 · V : 회원이상노출 · I : 회원이상 비노출 · N : 비회원이상 · G : 접근회원그룹설정 |
| `write_member_group_no` |  | 쓰기 권한 접근회원그룹 번호 |
| `write_permission_extra` |  | 쓰기권한 부가설정 |
| `reply_permission` |  | 답변쓰기 권한 A : 관리자 · M : 회원이상 · N : 비회원이상 · G : 접근회원그룹설정 |
| `reply_member_group_no` |  | 답변쓰기 권한 접근회원그룹 번호 |
| `author_display` |  | 작성자 표시 설정 N : 이름 · U : 별명(별명기입전 이름으로 노출) · I : 별명(별명기입전 아이디로 노출) |
| `author_protection` |  | 작성자 보호 설정 |
| `board_guide` |  | 게시판 안내글 |
| `admin_title_fixed` |  | 게시글 제목을 관리자가 설정한 값으로 고정 |
| `admin_reply_fixed` |  | 답변글 제목을 관리자가 설정한 값으로 고정할지 여부 |
| `input_form` |  | 게시글 입력 양식 설정 여부 |
| `page_size` |  | 페이지당 목록 수 |
| `product_page_size` |  | 상품 상세 정보 → 페이지당 목록 수 |
| `page_display_count` |  | 페이지 표시 수 |
| `use_comment` |  | 댓글 기능 사용 여부 T : 사용함 · F : 사용안함 |

## Operations

### `GET /api/v2/admin/boards` — Retrieve a list of boards

- **Scope**: `mall.read_community` (read)
- **호출건수 제한**: 40
- **Platform**: cafe24,youtube
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-boards

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  | 최소값: [1] | 1 | 멀티쇼핑몰 번호 |

### `GET /api/v2/admin/boards/{board_no}` — Retrieve the board settings

- **Scope**: `mall.read_community` (read)
- **호출건수 제한**: 40
- **Platform**: cafe24,youtube
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#retrieve-the-board-settings

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `board_no` | ✓ |  |  | 게시판 번호 |

### `PUT /api/v2/admin/boards/{board_no}` — Update the board settings

- **Scope**: `mall.write_community` (write)
- **호출건수 제한**: 40
- **1회당 요청건수 제한**: 1
- **Platform**: cafe24,youtube
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#update-the-board-settings

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  | 최소값: [1] | 1 | 멀티쇼핑몰 번호 |
| `board_no` | ✓ |  |  | 게시판 번호 |
| `use_board` |  |  |  | 게시판 사용여부 T : 사용함 · F : 사용안함 |
| `use_display` |  |  |  | 표시여부 T : 표시함 · F : 표시안함 |
| `use_top_image` |  |  |  | 화면 상단 이미지 사용여부 T : 사용함 · F : 사용안함 |
| `top_image_url` |  | URL |  | 화면 상단 이미지 경로 |
| `attached_file` |  |  |  | 파일 첨부 T : 사용함 · F : 사용안함 |
| `attached_file_size_limit` |  | 최소값: [1]; 최대값: [10485760] |  | 첨부파일용량제한 (Byte) |
| `use_category` |  |  |  | 카테고리 기능 사용여부 T : 사용함 · F : 사용안함 |
| `categories` |  |  |  | 카테고리 정보 |
| `secret_only` |  |  |  | 비밀글만 등록 가능여부 T: 비밀글만 등록 · F: 공개글과 비밀글을 선택하여 등록 |
| `admin_confirm` |  |  |  | 관리자 확인 기능 사용여부 T: 사용함 · F: 사용안함 |
| `comment_author_display` |  |  |  | 댓글 작성자 표시 설정 N : 이름 · U : 별명(별명기입전 이름으로 노출) · I : 별명(별명기입전 아이디로 노출) |
| `comment_author_protection` |  |  |  | 댓글 작성자 보호 설정 |
| ↳ `is_use` |  |  |  | 보호 설정 사용 여부 · T : 사용함 · F : 사용안함 |
| ↳ `author_name_type` |  |  |  | 보호 설정 · count : 일부 글자 수만 노출 · content : 대체 문구로 노출 |
| ↳ `partial_character_display` |  |  |  | 작성자 보호 설정 시 노출할 일부 글자수 |
| ↳ `alternative_text_display` |  |  |  | 작성자 보호 설정 시 대체 문구 |
| `spam_auto_prevention` |  |  |  | 스팸 자동생성방지 기능 |
| ↳ `apply_scope` |  |  |  | 적용범위 · post_actions : 글쓰기/수정/답변 · comment : 댓글 |
| ↳ `member_scope` |  |  |  | 대상회원 · A : 전체 · M : 회원 · N : 비회원 |
| `reply_feature` |  |  |  | 답변기능 T : 사용함 · F : 사용안함 |
| `write_permission` |  |  |  | 쓰기 권한 A : 관리자 · V : 회원이상노출 · I : 회원이상 비노출 · N : 비회원이상 · G : 접근회원그룹설정 |
| `write_member_group_no` |  |  |  | 쓰기 권한 접근회원그룹 번호 |
| `write_permission_extra` |  |  |  | 쓰기권한 부가설정 |
| ↳ `is_member_buy` |  |  |  | 회원 구매내역 체크 여부 · T : 체크함 · F : 체크안함 |
| ↳ `member_write_after` |  |  |  | 회원 쓰기권한 적용 시점 · place_date : 결제완료 이후 · shipbegin_date : 배송중 이후 · shipend_date : 배송완료 이후 |
| ↳ `use_member_write_period` |  |  |  | 회원 쓰기권한 작성 기간 설정 여부 · T : 사용함 · F : 사용안함 |
| ↳ `member_write_period` |  |  |  | 회원 쓰기권한 작성 기간 |
| ↳ `is_guest_buy` |  |  |  | 비회원 구매내역 체크 여부 · T : 체크함 · F : 체크안함 |
| ↳ `guest_write_after` |  |  |  | 비회원 쓰기권한 적용 시점 · order_date : 주문완료 이후 · place_date : 결제완료 이후 · shipbegin_date : 배송중 이후 · shipend_date : 배송완료 이후 |
| ↳ `use_guest_write_period` |  |  |  | 비회원 쓰기권한 작성 기간 설정 여부 · T : 사용함 · F : 사용안함 |
| ↳ `guest_write_period` |  |  |  | 비회원 쓰기권한 작성 기간 |
| ↳ `product_info_option` |  |  |  | 상품정보 등록 옵션 · T : 글 작성 시 상품 정보 선택 허용 · F : 글 작성 시 상품 정보 선택 불가 |
| ↳ `post_length_limit` |  |  |  | 글자수 제한여부 · T : 제한함 · F : 제한없음 |
| ↳ `post_min_length` |  |  |  | 최소 글자수 |
| ↳ `post_editable` |  |  |  | 글 수정/삭제 가능여부 · T : 가능 · F : 불가 |
| `reply_permission` |  |  |  | 답변쓰기 권한 A : 관리자 · M : 회원이상 · N : 비회원이상 · G : 접근회원그룹설정 |
| `reply_member_group_no` |  |  |  | 답변쓰기 권한 접근회원그룹 번호 |
| `author_display` |  |  |  | 작성자 표시 설정 N : 이름 · U : 별명(별명기입전 이름으로 노출) · I : 별명(별명기입전 아이디로 노출) |
| `author_protection` |  |  |  | 작성자 보호 설정 |
| ↳ `is_use` |  |  |  | 보호 설정 사용 여부 · T : 사용함 · F : 사용안함 |
| ↳ `author_name_type` |  |  |  | 보호 설정 · count : 일부 글자 수만 노출 · content : 대체 문구로 노출 |
| ↳ `partial_character_display` |  |  |  | 작성자 보호 설정 시 노출할 일부 글자수 |
| ↳ `alternative_text_display` |  |  |  | 작성자 보호 설정 시 대체 문구 |
| `board_guide` |  |  |  | 게시판 안내글 |
| `admin_title_fixed` |  |  |  | 게시글 제목을 관리자가 설정한 값으로 고정 |
| ↳ `is_use` | ✓ |  |  | 게시글 제목을 관리자가 설정한 고정값으로 사용할지 여부 · T : 사용함 · F : 사용안함 |
| ↳ `admin_title_list` | ✓ |  |  | 관리자 지정 제목 설정 |
| ↳ `staff_skip_post_title` | ✓ |  |  | 운영자가 게시글을 작성할 때 제목 고정 기능 미사용 · T : 사용함 · F : 사용안함 |
| `admin_reply_fixed` |  |  |  | 답변글 제목을 관리자가 설정한 값으로 고정할지 여부 |
| ↳ `is_use` | ✓ |  |  | 답변글 제목을 관리자 설정값으로 고정할지 여부 · T : 사용함 · F : 사용안함 |
| ↳ `admin_reply_list` | ✓ |  |  | 관리자 지정 답변글 설정 |
| ↳ `staff_skip_reply_title` | ✓ |  |  | 운영자가 게시글을 작성할 때 고정 제목 미사용 · T : 사용함 · F : 사용안함 |
| `input_form` |  |  |  | 게시글 입력 양식 설정 여부 |
| ↳ `is_use` | ✓ |  |  | 게시글 입력 양식 사용 여부 · T : 사용함 · F : 사용안함 |
| ↳ `input_form_title` | ✓ |  |  | 게시글 입력 양식 제목 |
| ↳ `enable_input_form_title` | ✓ |  |  | 게시글 입력 양식 제목 노출 여부 · T : 사용함 · F : 사용안함 |
| `page_size` |  | 최소값: [1]; 최대값: [99] |  | 페이지당 목록 수 |
| `product_page_size` |  | 최소값: [5]; 최대값: [999] |  | 상품 상세 정보 → 페이지당 목록 수 |
| `page_display_count` |  | 최소값: [1]; 최대값: [99] |  | 페이지 표시 수 |
| `use_comment` |  |  |  | 댓글 기능 사용 여부 T : 사용함 · F : 사용안함 |
| `board_name` |  | 최소글자수 : [1자]; 최대글자수 : [50자] |  | 게시판 이름 |
| `board_type` |  |  |  | 게시판 분류 1 : 운영 · 2 : 일반 · 5 : 상품 |
| `article_display_type` |  |  |  | 게시물 표시 A : 전체 게시물 표시 · T : 첨부 파일이 있는 게시물만 표시 · F : 첨부 파일이 없는 게시물만 표시 |
