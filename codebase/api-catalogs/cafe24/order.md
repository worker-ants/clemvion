---
id: order
status: implemented
code:
  - codebase/backend/src/nodes/integration/cafe24/metadata/order.ts
---

# Cafe24 API Catalog — Order (주문)

> 카탈로그 형식·동기 정책: [`_overview.md`](./_overview.md).

base URL: `https://{mall_id}.cafe24api.com/api/v2/admin/`

## 표

| id | 라벨 (한) | English title | method | path | scope | paginated | status | docs |
|----|---|---|---|---|---|---|---|---|
| `order_list` | 주문 목록 조회 | Retrieve a list of orders | GET | `orders` | read | ✓ | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-orders) |
| `order_get` | 주문 단건 조회 | Retrieve an order | GET | `orders/{order_id}` | read |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-an-order) |
| `order_items_list` | 주문 상품 목록 조회 | Retrieve a list of order items | GET | `orders/{order_id}/items` | read |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-order-items) |
| `order_shipments_create` | 주문 배송 정보 등록 | Create an order shipping information | POST | `orders/{order_id}/shipments` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#create-an-order-shipping-information) |
| `order_buyer_update` | 주문자 정보 수정 | Update customer information of an order | PUT | `orders/{order_id}/buyer` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-customer-information-of-an-order) |
| `order_memos_create` | 주문 메모 작성 | Create an order memo | POST | `orders/{order_id}/memos` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#create-an-order-memo) |
| `order_count` | 주문 개수 조회 | Retrieve a count of orders | GET | `orders/count` | read |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-count-of-orders) |
| `order_status_update_multiple` | 주문 상태 일괄 변경 | Update status for multiple orders | PUT | `orders` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-status-for-multiple-orders) |
| `order_status_update` | 주문 상태 변경 | Update an order status | PUT | `orders/{order_id}` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-an-order-status) |
| `order_autocalculation_delete` | 주문 자동 계산 해제 | Remove auto calculation setting of an order | DELETE | `orders/{order_id}/autocalculation` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#remove-auto-calculation-setting-of-an-order) |
| `order_buyer_get` | 주문자 정보 조회 | Retrieve customer details of an order | GET | `orders/{order_id}/buyer` | read |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-customer-details-of-an-order) |
| `order_buyer_history_list` | 주문자 정보 변경 이력 | Retrieve a list of customer history of an order | GET | `orders/{order_id}/buyer/history` | read |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-customer-history-of-an-order) |
| `order_cancellation_create` | 주문 취소 생성 | Create an order cancellation | POST | `orders/{order_id}/cancellation` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#create-an-order-cancellation) |
| `order_cancellation_update` | 주문 취소 상세 변경 | Change cancellation details | PUT | `orders/{order_id}/cancellation/{claim_code}` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#change-cancellation-details) |
| `order_completions_complete` | PG 결제 후 주문 완료 | Complete an order after PG payment | POST | `orders/{order_id}/completions` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#complete-an-order-after-pg-payment) |
| `order_exchange_create` | 주문 교환 생성 | Create an order exchange | POST | `orders/{order_id}/exchange` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#create-an-order-exchange) |
| `order_exchange_update` | 주문 교환 수정 | Update an order exchange | PUT | `orders/{order_id}/exchange/{claim_code}` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-an-order-exchange) |
| `order_exchangerequests_reject` | 교환 요청 반려 | Reject an exchange request | PUT | `orders/{order_id}/exchangerequests` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#reject-an-exchange-request) |
| `order_items_create` | 주문 상품 추가 | Create an order item | POST | `orders/{order_id}/items` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#create-an-order-item) |
| `order_items_update` | 주문 상품 수정 | Update an order item | PUT | `orders/{order_id}/items/{order_item_code}` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-an-order-item) |
| `order_items_labels_get` | 주문 상품 라벨 조회 | Retrieve an order label | GET | `orders/{order_id}/items/{order_item_code}/labels` | read |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-an-order-label) |
| `order_items_labels_create` | 주문 상품 라벨 생성 | Create an order label | POST | `orders/{order_id}/items/{order_item_code}/labels` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#create-an-order-label) |
| `order_items_labels_update` | 주문 상품 라벨 수정 | Update an order label | PUT | `orders/{order_id}/items/{order_item_code}/labels` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-an-order-label) |
| `order_items_labels_delete` | 주문 상품 라벨 삭제 | Delete an order label | DELETE | `orders/{order_id}/items/{order_item_code}/labels/{name}` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#delete-an-order-label) |
| `order_items_options_create` | 주문 상품 옵션 생성 | Create order item options | POST | `orders/{order_id}/items/{order_item_code}/options` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#create-order-item-options) |
| `order_items_options_update` | 주문 상품 옵션 수정 | Edit order item options | PUT | `orders/{order_id}/items/{order_item_code}/options` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#edit-order-item-options) |
| `order_memos_list` | 주문 메모 목록 | Retrieve a list of order memos | GET | `orders/{order_id}/memos` | read |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-order-memos) |
| `order_memos_update` | 주문 메모 수정 | Update an order memo | PUT | `orders/{order_id}/memos/{memo_no}` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-an-order-memo) |
| `order_memos_delete` | 주문 메모 삭제 | Delete an order memo | DELETE | `orders/{order_id}/memos/{memo_no}` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#delete-an-order-memo) |
| `order_payments_status_update` | 주문 결제 상태 수정 | Update an order payment status | PUT | `orders/{order_id}/payments` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-an-order-payment-status) |
| `order_paymenttimeline_history` | 결제 이력 조회 | Retrieve payment history of an order | GET | `orders/{order_id}/paymenttimeline` | read |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-payment-history-of-an-order) |
| `order_paymenttimeline_details` | 결제 상세 조회 | Retrieve payment details of an order | GET | `orders/{order_id}/paymenttimeline/{payment_no}` | read |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-payment-details-of-an-order) |
| `order_receivers_list` | 받는 사람 목록 | Retrieve a list of recipients of an order | GET | `orders/{order_id}/receivers` | read |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-recipients-of-an-order) |
| `order_receivers_update` | 받는 사람 수정 | Update order recipients | PUT | `orders/{order_id}/receivers` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-order-recipients) |
| `order_receivers_change_shipping` | 받는 사람 배송지 변경 | Change shipping information | PUT | `orders/{order_id}/receivers/{shipping_code}` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#change-shipping-information) |
| `order_receivers_history_list` | 받는 사람 변경 이력 | Retrieve a list of recipient history of an order | GET | `orders/{order_id}/receivers/history` | read |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-recipient-history-of-an-order) |
| `order_refunds_update` | 주문 환불 수정 | Update an order refund | PUT | `orders/{order_id}/refunds/{refund_code}` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-an-order-refund) |
| `order_return_create` | 주문 반품 생성 | Create an order return | POST | `orders/{order_id}/return` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#create-an-order-return) |
| `order_return_update` | 주문 반품 수정 | Update an order return | PUT | `orders/{order_id}/return/{claim_code}` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-an-order-return) |
| `order_shipments_list` | 주문 배송 정보 목록 | Retrieve a list of shipping information of an order | GET | `orders/{order_id}/shipments` | read |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-shipping-information-of-an-order) |
| `order_shipments_update` | 주문 배송 정보 수정 | Update an order shipping | PUT | `orders/{order_id}/shipments/{shipping_code}` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-an-order-shipping) |
| `order_shipments_delete` | 주문 배송 정보 삭제 | Delete an order shipping | DELETE | `orders/{order_id}/shipments/{shipping_code}` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#delete-an-order-shipping) |
| `order_shippingfeecancellation_get` | 배송비 취소 상세 | Retrieve shipping fee cancellation details of an order | GET | `orders/{order_id}/shippingfeecancellation` | read |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-shipping-fee-cancellation-details-of-an-order) |
| `order_shippingfeecancellation_create` | 배송비 취소 생성 | Create an order shipping fee cancellation | POST | `orders/{order_id}/shippingfeecancellation` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#create-an-order-shipping-fee-cancellation) |
| `order_shortagecancellation_create` | 재고 부족 취소 생성 | Create an order cancellation on stock shortage | POST | `orders/{order_id}/shortagecancellation` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#create-an-order-cancellation-on-stock-shortage) |
| `orders_benefits_list` | 주문 혜택 목록 | Retrieve a list of order benefits applied to an order | GET | `orders/benefits` | read |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-order-benefits-applied-to-an-order) |
| `orders_calculation_total` | 주문 결제 금액 계산 | Calculate the total due for an order | POST | `orders/calculation` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#calculate-total-due) |
| `orders_coupons_list` | 주문 쿠폰 목록 | Retrieve a list of coupons applied to an order | GET | `orders/coupons` | read |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-coupons-applied-to-an-order) |
| `orders_dashboard_list` | 주문 대시보드 | List all orders dashboard | GET | `orders/dashboard` | read |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#list-all-orders-dashboard) |
| `orders_inflowgroups_list` | 유입 그룹 목록 | Retrieve a list of traffic source groups | GET | `orders/inflowgroups` | read | ✓ | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-traffic-source-groups) |
| `orders_inflowgroups_create` | 유입 그룹 생성 | Create a traffic source group | POST | `orders/inflowgroups` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#create-a-traffic-source-group) |
| `orders_inflowgroups_update` | 유입 그룹 수정 | Update a traffic source group | PUT | `orders/inflowgroups/{inflow_group_id}` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-a-traffic-source-group) |
| `orders_inflowgroups_delete` | 유입 그룹 삭제 | Delete a traffic source group | DELETE | `orders/inflowgroups/{inflow_group_id}` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#delete-a-traffic-source-group) |
| `orders_inflows_list` | 유입 출처 목록 | Retrieve a list of group traffic sources | GET | `orders/inflowgroups/{group_id}/inflows` | read | ✓ | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-group-traffic-sources) |
| `orders_inflows_create` | 유입 출처 생성 | Create a group traffic source | POST | `orders/inflowgroups/{group_id}/inflows` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#create-a-group-traffic-source) |
| `orders_inflows_update` | 유입 출처 수정 | Update a group traffic source | PUT | `orders/inflowgroups/{group_id}/inflows/{inflow_id}` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-a-group-traffic-source) |
| `orders_inflows_delete` | 유입 출처 삭제 | Delete a group traffic source | DELETE | `orders/inflowgroups/{group_id}/inflows/{inflow_id}` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#delete-a-group-traffic-source) |
| `orders_memos_list` | 관리자 메모 목록 (전체 주문) | Retrieve a list of admin memos for an order | GET | `orders/memos` | read |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-admin-memos-for-an-order) |
| `orders_migrations_get` | 이관 주문 조회 | Retrieve order from migrated store | GET | `orders/migrations` | read |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-order-from-migrated-store) |
| `orders_migrations_create` | 이관 주문 생성 | Create order from migrated store | POST | `orders/migrations` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#create-order-from-migrated-store) |
| `orders_migrations_update` | 이관 주문 수정 | Update order from migrated store | PUT | `orders/migrations` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-order-from-migrated-store) |
| `orders_migrations_delete` | 이관 주문 삭제 | Delete order from migrated store | DELETE | `orders/migrations/{order_id}` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#delete-order-from-migrated-store) |
| `orders_paymentamount_get` | 결제 금액 조회 | Retrieve a payment amount | GET | `orders/paymentamount` | read |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-payment-amount) |
| `orders_saleschannels_list` | 판매 채널 목록 | Retrieve a list of sales channels | GET | `orders/saleschannels` | read | ✓ | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-sales-channels) |
| `orders_saleschannels_create` | 판매 채널 생성 | Create a sales channel | POST | `orders/saleschannels` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#create-a-sales-channel) |
| `orders_saleschannels_update` | 판매 채널 수정 | Update a sales channel | PUT | `orders/saleschannels/{sales_channel_id}` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-a-sales-channel) |
| `orders_saleschannels_delete` | 판매 채널 삭제 | Delete a sales channel | DELETE | `orders/saleschannels/{sales_channel_id}` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#delete-a-sales-channel) |
| `payments_status_update_multiple` | 결제 상태 일괄 변경 | Update payment status for multiple orders | PUT | `payments` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-payment-status-for-multiple-orders) |
| `refunds_list` | 환불 목록 | Retrieve a list of refunds | GET | `refunds` | read | ✓ | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-refunds) |
| `refunds_get` | 환불 단건 조회 | Retrieve a refund | GET | `refunds/{refund_code}` | read |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-refund) |
| `reservations_get` | 예약 상품 조회 | Retrieve a booked item | GET | `reservations` | read |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-booked-item) |
| `return_get` | 반품 조회 | Retrieve a return | GET | `return/{claim_code}` | read |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-return) |
| `return_create_multiple` | 반품 일괄 생성 | Create multiple order returns | POST | `return` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#create-multiple-order-returns) |
| `return_update` | 반품 수정 | Update a return | PUT | `return` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-a-return) |
| `returnrequests_create` | 반품 요청 생성 | Create a return request for multiple items | POST | `returnrequests` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#create-a-return-request-for-multiple-items) |
| `returnrequests_reject` | 반품 요청 거부 | Reject a return request for multiple items | PUT | `returnrequests` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#reject-a-return-request-for-multiple-items) |
| `cancellation_get` | 취소 조회 | Retrieve an order cancellation | GET | `cancellation/{claim_code}` | read |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-an-order-cancellation) |
| `cancellation_create_multiple` | 취소 일괄 생성 | Create multiple order cancellations | POST | `cancellation` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#create-multiple-order-cancellations) |
| `cancellation_update_bulk` | 취소 상세 일괄 변경 | Change cancellation details in bulk | PUT | `cancellation` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#change-cancellation-details-in-bulk) |
| `cancellationrequests_create` | 취소 요청 생성 | Create a cancellation request for multiple items | POST | `cancellationrequests` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#create-a-cancellation-request-for-multiple-items) |
| `cancellationrequests_reject` | 취소 요청 거부 | Reject a cancellation request for multiple items | PUT | `cancellationrequests` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#reject-a-cancellation-request-for-multiple-items) |
| `cashreceipt_list` | 현금영수증 목록 | Retrieve a list of cash receipts | GET | `cashreceipt` | read | ✓ | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-cash-receipts) |
| `cashreceipt_create` | 현금영수증 발행 | Create a cash receipt | POST | `cashreceipt` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#create-a-cash-receipt) |
| `cashreceipt_update` | 현금영수증 수정 | Update a cash receipt | PUT | `cashreceipt/{cashreceipt_no}` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-a-cash-receipt) |
| `cashreceipt_cancel` | 현금영수증 취소 | Update a cash receipt cancellation | PUT | `cashreceipt/{cashreceipt_no}/cancellation` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-a-cash-receipt-cancellation) |
| `collectrequests_update` | 수거 요청 수정 | Update a collection request | PUT | `collectrequests/{request_no}` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-a-collection-request) |
| `exchange_get` | 교환 조회 | Retrieve an exchange | GET | `exchange/{claim_code}` | read |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-an-exchange) |
| `exchange_create_multiple` | 교환 일괄 생성 | Create multiple exchanges | POST | `exchange` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#create-multiple-exchanges) |
| `exchange_update_multiple` | 교환 일괄 수정 | Update multiple order exchanges | PUT | `exchange` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-multiple-order-exchanges) |
| `exchangerequests_create_bulk` | 교환 요청 일괄 생성 | Bulk exchange request API | POST | `exchangerequests` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#bulk-exchange-request-api) |
| `exchangerequests_reject_multiple` | 교환 요청 일괄 거부 | Reject an exchange request for multiple items | PUT | `exchangerequests` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#reject-an-exchange-request-for-multiple-items) |
| `fulfillments_create` | 풀필먼트 배송 생성 | Create shipping information for multiple orders via fulfillment | POST | `fulfillments` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#create-shipping-information-for-multiple-orders-via-fulfillment) |
| `labels_list` | 주문 라벨 목록 | Retrieve order labels | GET | `labels` | read |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-order-labels) |
| `labels_create_multiple` | 주문 라벨 일괄 생성 | Create multiple order labels | POST | `labels` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#create-multiple-order-labels) |
| `orderform_properties_get` | 주문서 추가 필드 조회 | Retrieve an additional checkout field | GET | `orderform/properties` | read |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-an-additional-checkout-field) |
| `orderform_properties_create` | 주문서 추가 필드 생성 | Create an additional checkout field | POST | `orderform/properties` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#create-an-additional-checkout-field) |
| `orderform_properties_update` | 주문서 추가 필드 수정 | Update an additional checkout field | PUT | `orderform/properties/{orderform_property_id}` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-an-additional-checkout-field) |
| `orderform_properties_delete` | 주문서 추가 필드 삭제 | Delete an additional checkout field | DELETE | `orderform/properties/{orderform_property_id}` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#delete-an-additional-checkout-field) |
| `shipments_create_multiple` | 배송 일괄 생성 | Create shipping information for multiple orders | POST | `shipments` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#create-shipping-information-for-multiple-orders) |
| `shipments_update_multiple` | 배송 일괄 수정 | Update multiple order shippings | PUT | `shipments` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-multiple-order-shippings) |
| `subscription_shipments_create` | 정기배송 생성 | Create a subscription | POST | `subscription/shipments` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#create-a-subscription) |
| `subscription_shipments_update` | 정기배송 수정 | Update a subscription | PUT | `subscription/shipments/{subscription_id}` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-a-subscription) |
| `subscription_shipments_items_update` | 정기배송 상품 옵션 수정 | Update product variants in subscription | PUT | `subscription/shipments/{subscription_id}/items` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-product-variants-in-subscription) |
| `unpaidorders_list` | 미결제 주문 목록 | Retrieve unpaid orders | GET | `unpaidorders` | read | ✓ | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-unpaid-orders) |

## Field-level 상세 카탈로그

> 각 sub-resource 의 **응답 속성(field) + operation 요청 파라미터**를 Cafe24 공식 docs 기준으로 담은 상세 카탈로그. 위 표가 endpoint enumeration index 라면, 아래는 field-level 본문이다. 출처: Cafe24 REST API Documentation (admin), 2026-06-03 download.

- [`order/cancellation.md`](./order/cancellation.md) · Cancellation — 31 fields, 3 ops
- [`order/cancellationrequests.md`](./order/cancellationrequests.md) · Cancellationrequests — 5 fields, 2 ops
- [`order/cashreceipt.md`](./order/cashreceipt.md) · Cashreceipt — 20 fields, 3 ops
- [`order/cashreceipt__cancellation.md`](./order/cashreceipt__cancellation.md) · Cashreceipt cancellation — 3 fields, 1 ops
- [`order/collectrequests.md`](./order/collectrequests.md) · Collectrequests — 6 fields, 1 ops
- [`order/control.md`](./order/control.md) · Control — 2 fields, 1 ops
- [`order/exchange.md`](./order/exchange.md) · Exchange — 44 fields, 3 ops
- [`order/exchangerequests.md`](./order/exchangerequests.md) · Exchangerequests — 7 fields, 2 ops
- [`order/fulfillments.md`](./order/fulfillments.md) · Fulfillments — 9 fields, 1 ops
- [`order/labels.md`](./order/labels.md) · Labels — 4 fields, 2 ops
- [`order/orderform-properties.md`](./order/orderform-properties.md) · Orderform properties — 18 fields, 4 ops
- [`order/orders.md`](./order/orders.md) · Orders — 83 fields, 5 ops
- [`order/orders__autocalculation.md`](./order/orders__autocalculation.md) · Orders autocalculation — 2 fields, 1 ops
- [`order/orders-benefits.md`](./order/orders-benefits.md) · Orders benefits — 10 fields, 1 ops
- [`order/orders__buyer.md`](./order/orders__buyer.md) · Orders buyer — 18 fields, 2 ops
- [`order/orders__buyer-history.md`](./order/orders__buyer-history.md) · Orders buyer history — 9 fields, 1 ops
- [`order/orders-calculation.md`](./order/orders-calculation.md) · Orders calculation — 26 fields, 1 ops
- [`order/orders__cancellation.md`](./order/orders__cancellation.md) · Orders cancellation — 12 fields, 2 ops
- [`order/orders__completions.md`](./order/orders__completions.md) · Orders completions — 5 fields, 1 ops
- [`order/orders-coupons.md`](./order/orders-coupons.md) · Orders coupons — 8 fields, 1 ops
- [`order/orders-dashboard.md`](./order/orders-dashboard.md) · Orders dashboard — 17 fields, 1 ops
- [`order/orders__exchange.md`](./order/orders__exchange.md) · Orders exchange — 22 fields, 2 ops
- [`order/orders__exchangerequests.md`](./order/orders__exchangerequests.md) · Orders exchangerequests — 5 fields, 1 ops
- [`order/orders-inflowgroups.md`](./order/orders-inflowgroups.md) · Orders inflowgroups — 2 fields, 4 ops
- [`order/orders-inflowgroups__inflows.md`](./order/orders-inflowgroups__inflows.md) · Orders inflowgroups inflows — 4 fields, 4 ops
- [`order/orders__items.md`](./order/orders__items.md) · Orders items — 115 fields, 3 ops
- [`order/orders__items__history.md`](./order/orders__items__history.md) · Orders items history — 6 fields, 1 ops
- [`order/orders__items__labels.md`](./order/orders__items__labels.md) · Orders items labels — 5 fields, 4 ops
- [`order/orders__items__options.md`](./order/orders__items__options.md) · Orders items options — 6 fields, 2 ops
- [`order/orders__memos.md`](./order/orders__memos.md) · Orders memos — 13 fields, 4 ops
- [`order/orders-memos.md`](./order/orders-memos.md) · Orders memos — 12 fields, 1 ops
- [`order/orders-migrations.md`](./order/orders-migrations.md) · Orders migrations — 15 fields, 4 ops
- [`order/orders-paymentamount.md`](./order/orders-paymentamount.md) · Orders paymentamount — 9 fields, 1 ops
- [`order/orders__payments.md`](./order/orders__payments.md) · Orders payments — 10 fields, 1 ops
- [`order/orders__paymenttimeline.md`](./order/orders__paymenttimeline.md) · Orders paymenttimeline — 12 fields, 2 ops
- [`order/orders__receivers.md`](./order/orders__receivers.md) · Orders receivers — 29 fields, 3 ops
- [`order/orders__receivers-history.md`](./order/orders__receivers-history.md) · Orders receivers history — 23 fields, 1 ops
- [`order/orders__refunds.md`](./order/orders__refunds.md) · Orders refunds — 4 fields, 1 ops
- [`order/orders__return.md`](./order/orders__return.md) · Orders return — 20 fields, 2 ops
- [`order/orders-saleschannels.md`](./order/orders-saleschannels.md) · Orders saleschannels — 3 fields, 4 ops
- [`order/orders__shipments.md`](./order/orders__shipments.md) · Orders shipments — 11 fields, 4 ops
- [`order/orders__shippingfeecancellation.md`](./order/orders__shippingfeecancellation.md) · Orders shippingfeecancellation — 24 fields, 2 ops
- [`order/orders__shortagecancellation.md`](./order/orders__shortagecancellation.md) · Orders shortagecancellation — 5 fields, 1 ops
- [`order/payments.md`](./order/payments.md) · Payments — 6 fields, 1 ops
- [`order/refunds.md`](./order/refunds.md) · Refunds — 61 fields, 2 ops
- [`order/reservations.md`](./order/reservations.md) · Reservations — 26 fields, 1 ops
- [`order/return.md`](./order/return.md) · Return — 51 fields, 3 ops
- [`order/returnrequests.md`](./order/returnrequests.md) · Returnrequests — 6 fields, 2 ops
- [`order/shipments.md`](./order/shipments.md) · Shipments — 9 fields, 2 ops
- [`order/subscription-shipments.md`](./order/subscription-shipments.md) · Subscription shipments — 26 fields, 3 ops
- [`order/subscription-shipments__items.md`](./order/subscription-shipments__items.md) · Subscription shipments items — 7 fields, 1 ops
- [`order/unpaidorders.md`](./order/unpaidorders.md) · Unpaidorders — 13 fields, 1 ops
