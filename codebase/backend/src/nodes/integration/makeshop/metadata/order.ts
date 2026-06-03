import type { MakeshopOperationMetadata } from './types.js';

export const orderOperations: MakeshopOperationMetadata[] = [
  {
    id: 'get-cash_bill',
    description:
      '현금영수증 리스트를 조회합니다. 월단위 주문 계산(search_ordernum_month) 입력 시, 검색 시작 일의 일자와 검색 종료 일은 무시합니다. 복합과세 표기는 주문서 2.0버전에서만 지원합니다. 주문서 버전 1.0, 2.0 사용 가능 합니다.',
    scopeType: 'read',
    method: 'GET',
    path: 'cash_bill',
    requiredFields: ['InquiryTimeFrom'],
    fields: {
      limit: {
        type: 'string',
        location: 'query',
        description: '검색 한도 (MAX: 5000 (default))',
      },
      page: {
        type: 'string',
        location: 'query',
        description: '검색할 페이지 (default: 1)',
      },
      InquiryTimeFrom: {
        type: 'string',
        location: 'query',
        description:
          '검색 시작 일자 (0000-00-00, 등록일, 특정 회원을 검색하는 경우가 아니면 필수 입력)',
      },
      InquiryTimeTo: {
        type: 'string',
        location: 'query',
        description:
          '검색 종료 일자 (0000-00-00, 검색 시작 일자만 있는 경우 종료 일자는 당일 일자로 검색)',
      },
      search_type: {
        type: 'string',
        location: 'query',
        description:
          '검색 기준 (tsditme : 처리일자, ordernum : 주문일자 default : tsditme)',
      },
      search_ordernum_month: {
        type: 'string',
        location: 'query',
        description:
          '월단위 주문 계산 (Y, 검색 기준이 ordernum일 때, Y일 경우 주문일자의 해당 월 전체 검색)',
      },
      pay_status: {
        type: 'string',
        location: 'query',
        description: '입금여부',
      },
      order_status: {
        type: 'string',
        location: 'query',
        description:
          '주문 처리 상태 (Y:배송, P:부분배송, S:발송준비, C:취소, R:반송, N:미배송)',
      },
      status: {
        type: 'string',
        location: 'query',
        description: '상태 (Y:발급완료, N:발급요청, C:취소완료)',
      },
      tax_type: {
        type: 'string',
        location: 'query',
        description: '발급 형태 (Y:과세, N:비과세, A:혼합)',
      },
      reissue: {
        type: 'string',
        location: 'query',
        description: '재발행 여부 (Y)',
      },
    },
    responseShape: 'list',
    paginated: true,
  },
  {
    id: 'get-order-1',
    description:
      '주문서 1.0 정보를 조회합니다. 조회 범위는 30일 까지 가능합니다. 주문 데이터가 많은 경우 조회 기간을 1일로 권장합니다. 최근 주문서 순으로 정렬됩니다. 메이크샵 신규 가입 시 주문 1.0은 사용할 수 없습니다. 요청 전문 중 fields필드를 이용하면 불필요한 값으로 인한 검색 속도 저하를 최소화 할 수 있습니다.',
    scopeType: 'read',
    method: 'GET',
    path: 'order/1',
    requiredFields: [],
    fields: {
      InquiryTimeFrom: {
        type: 'string',
        location: 'query',
        description: '검색 시작 일자 (0000-00-00 00:00:00)',
      },
      InquiryTimeTo: {
        type: 'string',
        location: 'query',
        description: '검색 종료 일자 (0000-00-00 00:00:00)',
      },
      limit: {
        type: 'string',
        location: 'query',
        description: '검색 한도 (MAX : 5000 (default))',
      },
      page: { type: 'string', location: 'query', description: '검색할 페이지' },
      orderStatus: {
        type: 'array',
        location: 'query',
        description: 'A.2.1 참고',
      },
      payStatus: {
        type: 'string',
        location: 'query',
        description:
          '결제 여부 (Y : 입금 승인, B : 미입금 실패, C : 환불 취소, P : 부분취소가능, P2 : 부분취소)',
      },
      ordernum: {
        type: 'string',
        location: 'query',
        description: '주문번호 (주문번호 검색 시 검색일자 무시)',
      },
      fields: {
        type: 'string',
        location: 'query',
        description:
          '조회필드 (서버 부하를 줄이고 API 이용 시 응답 속도 개선. fields=ordernum,num,basket_status)',
      },
    },
    responseShape: 'single',
    paginated: true,
  },
  {
    id: 'get-order-2',
    description:
      '주문서 2.0 정보를 조회합니다. 조회 범위는 30일 까지 가능합니다. 주문 데이터가 많은 경우 조회 기간을 1일로 권장합니다. 최근 주문서 순으로 정렬됩니다. 요청 전문 중 fields필드를 이용하면 불필요한 값으로 인한 검색 속도 저하를 최소화 할 수 있습니다. 검색한도를 1000개 이상으로 조회 할 경우 정상적으로 조회되지 않을 수 있습니다.',
    scopeType: 'read',
    method: 'GET',
    path: 'order/2',
    requiredFields: [],
    fields: {
      InquiryTimeFrom: {
        type: 'string',
        location: 'query',
        description: '검색 시작 일자 (0000-00-00 00:00:00)',
      },
      InquiryTimeTo: {
        type: 'string',
        location: 'query',
        description: '검색 종료 일자 (0000-00-00 00:00:00)',
      },
      searchDateType: {
        type: 'string',
        location: 'query',
        description:
          '검색일 기준 cancel_requested : 취소요청일, canceled : 취소완료일, return_accepted : 반품요청일, returned : 반품완료일, tradeend : 교환완료일, paid : 결',
      },
      limit: {
        type: 'string',
        location: 'query',
        description:
          '검색 한도 MAX : 5000 (default) 1000개 이상 조회 시 정상적으로 조회되지 않을 수 있습니다.',
      },
      page: { type: 'string', location: 'query', description: '검색할 페이지' },
      format: {
        type: 'string',
        location: 'query',
        description:
          '출력방식 (order : 주문 기준으로 출력, default : 상품 기준으로 출력)',
      },
      orderStatus: {
        type: 'array',
        location: 'query',
        description: 'A.2.1 참고',
      },
      basketStatus: {
        type: 'string',
        location: 'query',
        description: '품목 별 상태 ( A.2.2 참고. 단일조회)',
      },
      mobile: { type: 'string', location: 'query', description: '전화번호' },
      payStatus: {
        type: 'string',
        location: 'query',
        description: '결제 여부 (Y : 결제 완료, N : 결제 전, C : 결제 실패)',
      },
      ordernum: {
        type: 'string',
        location: 'query',
        description: '주문번호 (주문번호 검색 시 다른 검색 조건 무시)',
      },
      ordernums: {
        type: 'array',
        location: 'query',
        description: '다중 주문번호. 최대 200개까지 검색',
      },
      naver_pay_oid: {
        type: 'string',
        location: 'query',
        description:
          '네이버 체크아웃 주문번호 (네이버 체크아웃 주문번호 검색 시 다른 검색 조건 무시)',
      },
      userid: {
        type: 'string',
        location: 'query',
        description: '회원 ID (아이디 조회 시 검색일자 필수 무시)',
      },
      product_uid: {
        type: 'string',
        location: 'query',
        description: '상품 번호',
      },
      provider: {
        type: 'string',
        location: 'query',
        description: '공급사 (공급사 코드(provider_code) 값으로 검색)',
      },
      fields: {
        type: 'string',
        location: 'query',
        description:
          '조회필드 (서버 부하를 줄이고 API 이용 시 응답 속도 개선. ex) ordernum,num,basket_status)',
      },
    },
    responseShape: 'single',
    paginated: true,
  },
  {
    id: 'get-order_delivery',
    description: '배송 관련 정보를 조회합니다.',
    scopeType: 'read',
    method: 'GET',
    path: 'order_delivery',
    requiredFields: [],
    fields: {
      delivery_num: {
        type: 'string',
        location: 'query',
        description: '배송 번호',
      },
      delivery_nums: {
        type: 'array',
        location: 'query',
        description:
          '다중 배송 번호 (다중 배송번호는 배열로 요청. 최대 50개까지 검색)',
      },
      limit: {
        type: 'string',
        location: 'query',
        description: '검색 한도 (MAX : 5000 (default))',
      },
      page: { type: 'string', location: 'query', description: '검색할 페이지' },
    },
    responseShape: 'list',
    paginated: true,
  },
  {
    id: 'get-order_log',
    description:
      '조회 범위 내의 주문 내역을 조회합니다. 조회 범위는 1일 까지 가능합니다.',
    scopeType: 'read',
    method: 'GET',
    path: 'order_log',
    requiredFields: [],
    fields: {
      InquiryTimeFrom: {
        type: 'string',
        location: 'query',
        description: '검색 시작 일자 (0000-00-00 00:00:00)',
      },
      InquiryTimeTo: {
        type: 'string',
        location: 'query',
        description: '검색 종료 일자 (0000-00-00 00:00:00)',
      },
      limit: {
        type: 'string',
        location: 'query',
        description: '검색 한도 (MAX : 5000 (default))',
      },
      page: { type: 'string', location: 'query', description: '검색할 페이지' },
      status: {
        type: 'string',
        location: 'query',
        description: '변경된 상품 상태 ( A.2.2 참고. 단일 조회)',
      },
      ordernum: {
        type: 'string',
        location: 'query',
        description: '주문번호 (주문번호 검색 시 다른 검색 조건 무시)',
      },
      orderByType: {
        type: 'string',
        location: 'query',
        description:
          '정렬 순서 (asc : 오름차순, desc : 내림차순 (default : desc) 변경된 날짜 기준)',
      },
    },
    responseShape: 'list',
    paginated: true,
  },
  {
    id: 'get-order_memo',
    description:
      '주문서에서 관리자 메모를 조회합니다. 검색 기간은 시작 일자 기준으로 +1개월 까지 가능합니다.',
    scopeType: 'read',
    method: 'GET',
    path: 'order_memo',
    requiredFields: ['InquiryTimeFrom', 'content', 'ordernum'],
    fields: {
      limit: {
        type: 'string',
        location: 'query',
        description: '검색 한도 MAX. MAX: 5000 (default)',
      },
      page: {
        type: 'string',
        location: 'query',
        description: '검색할 페이지 (default: 1)',
      },
      InquiryTimeFrom: {
        type: 'string',
        location: 'query',
        description:
          '검색 시작 일자 (0000-00-00 00:00:00, 등록일, 특정 회원을 검색하는 경우가 아니면 필수 입력)',
      },
      InquiryTimeTo: {
        type: 'string',
        location: 'query',
        description:
          '검색 종료 일자 (0000-00-00 00:00:00, 검색 시작 일자만 있는 경우 종료 일자는 24시간이 추가된 일자로 검색)',
      },
      content: { type: 'string', location: 'query', description: '메모 내용' },
      ordernum: { type: 'string', location: 'query', description: '주문번호' },
      writer: {
        type: 'string',
        location: 'query',
        description: '메모 작성자 ("운영자" 또는 부운영자ID)',
      },
      manager: {
        type: 'string',
        location: 'query',
        description: '메모 담당자 ("운영자" 또는 부운영자ID)',
      },
      status: {
        type: 'string',
        location: 'query',
        description:
          '처리 상태. all (default) 1 : 미처리, 2 : 처리완료, 3 : 묶음, 4 : 반품완료, 5 : 수선, 6 : 배송, 7 : 반품계좌확인, 8 : 운임입금확인, 9 : 품절, 10 : 반품완료확인',
      },
      importance: {
        type: 'string',
        location: 'query',
        description: '중요도. low : 낮음, nomal : 보통, high : 높음',
      },
    },
    responseShape: 'list',
    paginated: true,
  },
  {
    id: 'get-order_return_delivery',
    description:
      '조회 범위 내의 회수 송장번호를 조회합니다. 주문 번호가 필수 검색 조건입니다.',
    scopeType: 'read',
    method: 'GET',
    path: 'order_return_delivery',
    requiredFields: ['ordernum'],
    fields: {
      ordernum: { type: 'string', location: 'query', description: '주문 번호' },
      ordernums: {
        type: 'array',
        location: 'query',
        description: '주문 번호(다중)',
      },
    },
    responseShape: 'list',
  },
  {
    id: 'get-order_return_invoice',
    description:
      '주문서 반품 처리로 인한 회수 처리 송장 번호를 통해서 주문 번호와 해당 주문 품목을 조회합니다. delinum 또는 delinums 를 통해 조회 할 회수 송장 번호가 필수 검색 조건입니다.',
    scopeType: 'read',
    method: 'GET',
    path: 'order_return_invoice',
    requiredFields: ['delinum'],
    fields: {
      delinum: {
        type: 'string',
        location: 'query',
        description: '회수 송장 번호',
      },
      delinums: {
        type: 'array',
        location: 'query',
        description: '회수 송장 번호(다중)',
      },
    },
    responseShape: 'list',
  },
  {
    id: 'get-order_search',
    description:
      '주문서 상태별로 조회합니다 검색된 주문은 주문 번호만 출력됩니다. 검색된 조건에 주문 품목이 하나라도 포함되어 있으면 조회됩니다. 검색 기간은 최대 30일까지 지원됩니다.',
    scopeType: 'read',
    method: 'GET',
    path: 'order_search',
    requiredFields: ['InquiryTimeFrom'],
    fields: {
      InquiryTimeFrom: {
        type: 'string',
        location: 'query',
        description: '검색 시작 일자 (0000-00-00 00:00:00)',
      },
      InquiryTimeTo: {
        type: 'string',
        location: 'query',
        description: '검색 종료 일자 (0000-00-00 00:00:00 최대 30일 조회 가능)',
      },
      InquiryType: {
        type: 'string',
        location: 'query',
        description:
          '검색일 종류 refund_req_date : 환불요청일 refund_end_date : 환불완료일 default : refund_end_date',
      },
      limit: {
        type: 'string',
        location: 'query',
        description: '검색 한도 (MAX : 5000 (default))',
      },
      page: { type: 'string', location: 'query', description: '검색할 페이지' },
    },
    responseShape: 'list',
    paginated: true,
  },
  {
    id: 'get-order_trade_log',
    description: '교환 상품의 품목 리스트를 조회합니다.',
    scopeType: 'read',
    method: 'GET',
    path: 'order_trade_log',
    requiredFields: ['InquiryTimeFrom'],
    fields: {
      limit: {
        type: 'string',
        location: 'query',
        description: '검색 한도. MAX: 5000 (default)',
      },
      page: {
        type: 'string',
        location: 'query',
        description: '검색할 페이지 (default: 1)',
      },
      InquiryTimeFrom: {
        type: 'string',
        location: 'query',
        description:
          '검색 시작 일자 (0000-00-00 00:00:00, 등록일, 특정 회원을 검색하는 경우가 아니면 필수 입력)',
      },
      InquiryTimeTo: {
        type: 'string',
        location: 'query',
        description:
          '검색 종료 일자 (0000-00-00 00:00:00, 검색 시작 일자만 있는 경우 종료 일자는 당일 일자로 검색)',
      },
      ordernum: { type: 'string', location: 'query', description: '주문번호' },
    },
    responseShape: 'list',
    paginated: true,
  },
  {
    id: 'get-present_order',
    description: '선물 내역을 조회합니다.',
    scopeType: 'read',
    method: 'GET',
    path: 'present_order',
    requiredFields: ['InquiryTimeFrom'],
    fields: {
      InquiryTimeFrom: {
        type: 'string',
        location: 'query',
        description:
          '검색 시작 일자 (0000-00-00 00:00:00, 등록일, 특정 회원을 검색하는 경우가 아니면 필수 입력)',
      },
      InquiryTimeTo: {
        type: 'string',
        location: 'query',
        description:
          '검색 종료 일자 (0000-00-00 00:00:00, 검색 시작 일자만 있는 경우 종료 일자는 당일 일자로 검색)',
      },
      search_date_type: {
        type: 'string',
        location: 'query',
        description:
          '검색일 타입 order_date : 주문일, accept_date : 선물 수락일, (default : order_date)',
      },
      ordernum: { type: 'string', location: 'query', description: '주문번호' },
      limit: {
        type: 'string',
        location: 'query',
        description: '검색 한도. MAX: 5000 (default)',
      },
      page: {
        type: 'string',
        location: 'query',
        description: '검색할 페이지 (default: 1)',
      },
    },
    responseShape: 'list',
    paginated: true,
  },
  {
    id: 'get-subs',
    description:
      '정기 배송 정보를 조회합니다. 통합옵션 사용 상점에서만 사용이 가능합니다.',
    scopeType: 'read',
    method: 'GET',
    path: 'subs',
    requiredFields: ['InquiryTimeFrom', 'searchType'],
    fields: {
      InquiryTimeFrom: {
        type: 'string',
        location: 'query',
        description:
          '검색 시작 일자 (0000-00-00 00:00:00,등록일, 특정 회원을 검색하는 경우가 아니면 필수 입력)',
      },
      InquiryTimeTo: {
        type: 'string',
        location: 'query',
        description:
          '검색 종료 일자 (0000-00-00 00:00:00, 검색 시작 일자만 있는 경우 종료 일자는 24시간이 추가된 일자로 검색)',
      },
      searchType: {
        type: 'string',
        location: 'query',
        description:
          '검색 타입 date : 주문일자 next : 다음 배송일자 cancel : 취소일자 (default : date)',
      },
      subs_id: {
        type: 'string',
        location: 'query',
        description: '정기배송 번호 (다른 검색조건 무시)',
      },
      cycle: { type: 'string', location: 'query', description: '배송 주기' },
      week: {
        type: 'string',
        location: 'query',
        description: '배송 요일 (Mon,Tue,Wed,Thu,Fri,Sat,Sun)',
      },
      uid: { type: 'string', location: 'query', description: '상품번호' },
      user_id: { type: 'string', location: 'query', description: '회원 ID' },
      status: {
        type: 'string',
        location: 'query',
        description: '주문 상태 (LIVE: 진행중, CANCEL: 취소, default: LIVE)',
      },
      limit: {
        type: 'string',
        location: 'query',
        description: '검색 한도 (MAX : 5000 (default))',
      },
      page: { type: 'string', location: 'query', description: '검색할 페이지' },
    },
    responseShape: 'single',
    paginated: true,
  },
  {
    id: 'post-order-basket_separated',
    description:
      '주문서의 품목의 수량을 분리하여 새로운 품목 번호를 생성합니다. 주문 품목 번호와 수량을 필수로 입력해야 합니다. 분리된 품목 번호는 응답값을 통해서 제공됩니다. 통합옵션 상점만 이용 가능합니다.',
    scopeType: 'write',
    method: 'POST',
    path: 'order/basket_separated',
    requiredFields: ['datas'],
    fields: {
      datas: { type: 'array', location: 'body', description: '전송 정보' },
    },
    responseShape: 'single',
  },
  {
    id: 'post-order-cancel_done',
    description:
      '주문번호를 필수로 입력해야합니다. 품목번호로 진행되기 떄문에 품목의 수량의 경우 주문 품목 분리를 통해서 수량을 분리해주셔야합니다. restore_coupon_type =Y 인 경우 사용된 쿠폰은 모두 복구됩니다. entire = Y (전체 취소) 가 아닌 경우 품목번호를 필수로 입력해야 합니다. entire = Y 전체 취소를 진행하는 경우 사용된 모든 할인 혜택이 복구됩니다. 통합옵션 상점만 이용 가능합니다.',
    scopeType: 'write',
    method: 'POST',
    path: 'order/cancel_done',
    requiredFields: [],
    fields: {
      datas: { type: 'array', location: 'body', description: '전송 정보' },
    },
    responseShape: 'single',
  },
  {
    id: 'post-order-cancel_request',
    description:
      '주문서 입금 완료 상태인 경우 처리가 가능합니다. datas.basket.num (상품 품목 번호)과 datas.basket.num (품목 수량) 필수로 입력하셔야 합니다. basket.num, basket.stock 은 배열로 한 주문서에서 여러개의 품목과 수량을 담을 수 있습니다. 1회에 최대 50개 주문까지 처리가 가능합니다. (한 번에 전송되는 주문서 기준) 통합옵션 상점만 이용 가능합니다.',
    scopeType: 'write',
    method: 'POST',
    path: 'order/cancel_request',
    requiredFields: ['datas'],
    fields: {
      datas: { type: 'array', location: 'body', description: '전송 정보' },
    },
    responseShape: 'single',
  },
  {
    id: 'post-order-delivery',
    description:
      '주문을 배송 상태로 변경합니다. 1회에 최대 100개 주문까지 처리가 가능합니다. (한 번에 전송되는 주문서 기준) 통합옵션 상점만 이용 가능합니다.',
    scopeType: 'write',
    method: 'POST',
    path: 'order/delivery',
    requiredFields: [],
    fields: {
      datas: { type: 'array', location: 'body', description: '전송 정보' },
    },
    responseShape: 'single',
  },
  {
    id: 'post-order-delivery_complete',
    description:
      '배송중인 주문을 배송완료 상태로 변경합니다. 배송중 상태인 경우 상태 변경 가능합니다. 1회에 최대 100개 주문까지 처리가 가능합니다. (한 번에 전송되는 주문서 기준) 통합옵션 상점만 이용 가능합니다.',
    scopeType: 'write',
    method: 'POST',
    path: 'order/delivery_complete',
    requiredFields: [],
    fields: {
      datas: { type: 'array', location: 'body' },
    },
    responseShape: 'single',
  },
  {
    id: 'post-order-done',
    description:
      '배송완료인 주문을 거래완료 상태로 변경합니다. 배송완료 상태인 경우 상태 변경 가능합니다. 1회에 최대 50개 주문까지 처리가 가능합니다. (한 번에 전송되는 주문서 기준) 통합옵션 상점만 이용 가능합니다.',
    scopeType: 'write',
    method: 'POST',
    path: 'order/done',
    requiredFields: [],
    fields: {
      datas: { type: 'array', location: 'body' },
    },
    responseShape: 'single',
  },
  {
    id: 'post-order-hold',
    description:
      '결제완료 상태의 주문서 품목을 배송보류 처리합니다. 통합옵션 상점만 이용 가능합니다.',
    scopeType: 'write',
    method: 'POST',
    path: 'order/hold',
    requiredFields: [],
    fields: {
      datas: { type: 'array', location: 'body', description: '전송 정보' },
    },
    responseShape: 'single',
  },
  {
    id: 'post-order-hold_cancel',
    description:
      '결제완료 상태의 주문서 품목을 배송보류 상태를 해지합니다. 통합옵션 상점만 이용 가능합니다.',
    scopeType: 'write',
    method: 'POST',
    path: 'order/hold_cancel',
    requiredFields: ['datas'],
    fields: {
      datas: { type: 'array', location: 'body', description: '전송 정보' },
    },
    responseShape: 'single',
  },
  {
    id: 'post-order-invoice',
    description:
      '배송 준비 상태인 주문에 송장 정보를 입력합니다. 택배사, 송장 번호가 입력된 경우 등록이 불가능합니다. 동일 택배사와 송장 번호를 입력하는 경우 배송지가 합쳐집니다. 같은 배송번호로 이루어진 상품인 경우 택배사 정보와 송장번호가 다른 경우 품목 분리가 이루어집니다. 1회에 최대 100개 주문까지 처리가 가능합니다. (한 번에 전송되는 주문서 기준) ⚠️ 통합옵션 상점만 이용 가능합니다.',
    scopeType: 'write',
    method: 'POST',
    path: 'order/invoice',
    requiredFields: ['datas'],
    fields: {
      datas: { type: 'array', location: 'body', description: '전송 정보' },
    },
    responseShape: 'single',
  },
  {
    id: 'post-order-invoice_change',
    description:
      '송장 정보를 변경합니다. 1회에 최대 100개 주문까지 처리가 가능합니다. (한 번에 전송되는 주문서 기준) 통합옵션 상점만 이용 가능합니다.',
    scopeType: 'write',
    method: 'POST',
    path: 'order/invoice_change',
    requiredFields: [],
    fields: {
      datas: { type: 'array', location: 'body', description: '전송 정보' },
    },
    responseShape: 'single',
  },
  {
    id: 'post-order-paid',
    description:
      '미결제 상태의 무통장 입금 주문 상태를 결제완료 상태로 변경합니다. 통합옵션 상점만 이용 가능합니다.',
    scopeType: 'write',
    method: 'POST',
    path: 'order/paid',
    requiredFields: ['datas'],
    fields: {
      datas: { type: 'array', location: 'body', description: '전송 정보' },
    },
    responseShape: 'single',
  },
  {
    id: 'post-order-ready',
    description:
      '결제완료 및 상품 준비중 상태인 주문을 배송준비 상태로 변경합니다. 1회에 최대 100개 주문까지 처리가 가능합니다. (한 번에 전송되는 주문서 기준) 통합옵션 상점만 이용 가능합니다.',
    scopeType: 'write',
    method: 'POST',
    path: 'order/ready',
    requiredFields: [],
    fields: {
      datas: { type: 'array', location: 'body', description: '전송 정보' },
    },
    responseShape: 'single',
  },
  {
    id: 'post-order-return_receipt',
    description:
      '반품 요청 후 접수를 진행합니다. datas.basket.num (상품 품목 번호)는 필수로 입력하셔야 합니다. 1회에 최대 50개 주문까지 처리가 가능합니다. 통합옵션 상점만 이용 가능합니다',
    scopeType: 'write',
    method: 'POST',
    path: 'order/return_receipt',
    requiredFields: [],
    fields: {
      datas: { type: 'array', location: 'body', description: '전송 정보' },
    },
    responseShape: 'single',
  },
  {
    id: 'post-order-return_receipt_refusal',
    description:
      '반품 요청 상태일때 반품 접수 거부로 상태 변경합니다. datas.basket.num (상품 품목 번호)는 필수로 입력하셔야 합니다. 1회에 최대 50개 주문까지 처리가 가능합니다. 통합옵션 상점만 이용 가능합니다',
    scopeType: 'write',
    method: 'POST',
    path: 'order/return_receipt_refusal',
    requiredFields: ['datas'],
    fields: {
      datas: { type: 'array', location: 'body', description: '전송 정보' },
    },
    responseShape: 'single',
  },
  {
    id: 'post-order-return_request',
    description:
      '배송 완료 상태에서 변경이 가능합니다. datas.basket.num (상품 품목 번호)는 필수로 입력하셔야 합니다. basket.num, basket.stock 은 배열로 한 주문서에서 여러개의 품목과 수량을 담을 수 있습니다. 1회에 최대 50개 주문까지 처리가 가능합니다. (한 번에 전송되는 주문서 기준) 통합옵션 상점만 이용 가능합니다.',
    scopeType: 'write',
    method: 'POST',
    path: 'order/return_request',
    requiredFields: [],
    fields: {
      datas: { type: 'array', location: 'body', description: '전송 정보' },
    },
    responseShape: 'single',
  },
  {
    id: 'post-order-trade_receipt',
    description:
      '교환 요청 후 접수를 진행합니다. datas.basket.num (상품 품목 번호)는 필수로 입력하셔야 합니다. 1회에 최대 50개 주문까지 처리가 가능합니다. 통합옵션 상점만 이용 가능합니다.',
    scopeType: 'write',
    method: 'POST',
    path: 'order/trade_receipt',
    requiredFields: ['datas'],
    fields: {
      datas: { type: 'array', location: 'body', description: '전송 정보' },
    },
    responseShape: 'single',
  },
  {
    id: 'post-order-trade_receipt_refusal',
    description:
      '교환 요청 상태일때 교환 접수 거부로 상태 변경합니다. datas.basket.num (상품 품목 번호)는 필수로 입력하셔야 합니다. refusal_reason(접수거부 사유)는 필수로 입력해야 합니다. 1회에 최대 50개 주문까지 처리가 가능합니다. 통합옵션 상점만 이용 가능합니다',
    scopeType: 'write',
    method: 'POST',
    path: 'order/trade_receipt_refusal',
    requiredFields: ['datas'],
    fields: {
      datas: { type: 'array', location: 'body', description: '전송 정보' },
    },
    responseShape: 'single',
  },
  {
    id: 'post-order-trade_request',
    description:
      '배송 완료 상태에서 변경이 가능합니다. datas.basket.num (상품 품목 번호)는 필수로 입력하셔야 합니다. 1회에 최대 50개 주문까지 처리가 가능합니다. (한 번에 전송되는 주문서 기준) 통합옵션 상점만 이용 가능합니다.',
    scopeType: 'write',
    method: 'POST',
    path: 'order/trade_request',
    requiredFields: ['datas'],
    fields: {
      datas: { type: 'array', location: 'body', description: '전송 정보' },
    },
    responseShape: 'single',
  },
  {
    id: 'post-order_delivery-update',
    description:
      '주문 배송 수령인 정보를 수정합니다. 입금대기, 상품준비, 배송준비 상태에서만 변경이 가능합니다.',
    scopeType: 'write',
    method: 'POST',
    path: 'order_delivery/update',
    requiredFields: ['delivery_num'],
    fields: {
      delivery_num: {
        type: 'string',
        location: 'body',
        description: '배송번호',
      },
      receiver: { type: 'string', location: 'body', description: '수령인' },
      receiver_mobile: {
        type: 'string',
        location: 'body',
        description:
          '휴대폰 (000-0000-0000 형식. 휴대폰, 연락처 둘 중 하나만 입력시 입력한 번호로 통일',
      },
      receiver_phone: {
        type: 'string',
        location: 'body',
        description: '연락처',
      },
      post: { type: 'string', location: 'body', description: '우편번호' },
      address: { type: 'string', location: 'body', description: '주소' },
      address_detail: {
        type: 'string',
        location: 'body',
        description: '상세 주소',
      },
      deli_msg: {
        type: 'string',
        location: 'body',
        description: '배송 메세지',
      },
    },
    responseShape: 'single',
  },
  {
    id: 'post-order_memo-create',
    description:
      '주문서에 관리자 메모를 등록합니다. Beta 버전으로 수정이 될 수 있습니다.',
    scopeType: 'write',
    method: 'POST',
    path: 'order_memo/create',
    requiredFields: ['ordernum', 'id', 'writer', 'manager', 'content'],
    fields: {
      ordernum: { type: 'string', location: 'body', description: '주문 번호' },
      id: { type: 'string', location: 'body', description: '메모 번호' },
      writer: {
        type: 'string',
        location: 'body',
        description: '메모 작성자 ("운영자", 부운영자 ID만 입력가능)',
      },
      manager: {
        type: 'string',
        location: 'body',
        description: '메모 담당자 ("운영자", 부운영자 ID만 입력가능)',
      },
      content: { type: 'string', location: 'body', description: '메모 내용' },
      label: {
        type: 'string',
        location: 'body',
        description: '구분 (I/B 또는 O/B)',
      },
      status: {
        type: 'string',
        location: 'body',
        description:
          '처리 구분 1 : 미처리, 2 : 처리완료, 3 : 묶음, 4 : 반품완료, 5 : 수선, 6 : 배송, 7 : 반품계좌확인, 8 : 운임입금확인, 9 : 품절, 10 : 반품완료확인',
      },
      importance: {
        type: 'string',
        location: 'body',
        description: '중요도. low : 검정색, nomal : 파란색, high : 빨간색',
      },
      delivery_memo_flag: {
        type: 'string',
        location: 'body',
        description: '물류 전달 메모 적용여부 (Y : 적용, N : 미적용)',
      },
    },
    responseShape: 'single',
  },
  {
    id: 'post-order_memo-delete',
    description:
      '주문서에 등록된 관리자 메모를 삭제합니다. Beta 버전으로 수정이 될 수 있습니다.',
    scopeType: 'write',
    method: 'POST',
    path: 'order_memo/delete',
    requiredFields: ['ordernum', 'id'],
    fields: {
      ordernum: { type: 'string', location: 'body', description: '주문 번호' },
      id: { type: 'string', location: 'body', description: '메모 번호' },
    },
    responseShape: 'single',
  },
  {
    id: 'post-order_memo-update',
    description:
      '주문서에 등록된 관리자 메모를 수정합니다. Beta 버전으로 수정이 될 수 있습니다.',
    scopeType: 'write',
    method: 'POST',
    path: 'order_memo/update',
    requiredFields: ['ordernum', 'id', 'writer', 'manager', 'content'],
    fields: {
      ordernum: { type: 'string', location: 'body', description: '주문 번호' },
      id: { type: 'string', location: 'body', description: '메모 번호' },
      writer: {
        type: 'string',
        location: 'body',
        description: '메모 작성자 ("운영자", 부운영자 ID만 입력가능)',
      },
      manager: {
        type: 'string',
        location: 'body',
        description: '메모 담당자 ("운영자", 부운영자 ID만 입력가능)',
      },
      content: { type: 'string', location: 'body', description: '메모 내용' },
      label: {
        type: 'string',
        location: 'body',
        description: '구분 (I/B 또는 O/B)',
      },
      status: {
        type: 'string',
        location: 'body',
        description:
          '처리 구분 1 : 미처리, 2 : 처리완료, 3 : 묶음, 4 : 반품완료, 5 : 수선, 6 : 배송, 7 : 반품계좌확인, 8 : 운임입금확인, 9 : 품절, 10 : 반품완료확인',
      },
      importance: { type: 'string', location: 'body', description: '중요도' },
      delivery_memo_flag: {
        type: 'string',
        location: 'body',
        description: '물류 전달 메모 적용여부',
      },
    },
    responseShape: 'single',
  },
];
