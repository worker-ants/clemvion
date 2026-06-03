import type { MakeshopOperationMetadata } from './types.js';

export const benefitOperations: MakeshopOperationMetadata[] = [
  {
    id: 'get-coupon',
    description:
      '쿠폰 정보를 조회합니다. 검색 조건이 없는 경우 나인큐브에서 생성된 쿠폰은 조회되지 않습니다. purpose 항목을 통해서 나인큐브에서 생성된 쿠폰을 조회 할 수 있습니다.',
    scopeType: 'read',
    method: 'GET',
    path: 'coupon',
    requiredFields: [],
    fields: {
      limit: {
        type: 'string',
        location: 'query',
        description: '검색 한도. MAX : 5000 (default)',
      },
      page: { type: 'string', location: 'query', description: '검색할 페이지' },
      couponnum: {
        type: 'string',
        location: 'query',
        description: '쿠폰번호. 쿠폰번호 조회 시 다른 검색 조건 무시',
      },
      purpose: {
        type: 'string',
        location: 'query',
        description: '쿠폰 생성 업체. N_C : 나인큐브',
      },
    },
    responseShape: 'list',
    paginated: true,
  },
  {
    id: 'get-smart_coupon',
    description:
      '스마트 쿠폰 정보를 조회합니다. [통합옵션] 스마트 쿠폰 적용 상점만 조회가능합니다. 검색 조건이 없는 경우 나인큐브에서 생성된 쿠폰은 조회되지 않습니다 purpose 항목을 통해서 나인큐브에서 생성된 쿠폰을 조회 할 수 있습니다. 쿠폰 수가 많은 경우 limit 항목을 추가하여 조회가 필요합니다.',
    scopeType: 'read',
    method: 'GET',
    path: 'smart_coupon',
    requiredFields: [],
    fields: {
      InquiryTimeFrom: {
        type: 'string',
        location: 'query',
        description: '검색 시작 일자. 0000-00-00 00:00:00',
      },
      InquiryTimeTo: {
        type: 'string',
        location: 'query',
        description: '검색 종료 일자. 0000-00-00 00:00:00',
      },
      InquiryType: {
        type: 'string',
        location: 'query',
        description:
          '검색 타입. reg(생성일), mod(수정일), default : reg(생성일)',
      },
      limit: {
        type: 'string',
        location: 'query',
        description: '검색 한도. MAX : 50',
      },
      page: { type: 'string', location: 'query', description: '검색할 페이지' },
      couponnum: {
        type: 'string',
        location: 'query',
        description: '쿠폰번호. 쿠폰번호 조회 시 다른 검색 조건 무시',
      },
      issue_type: {
        type: 'string',
        location: 'query',
        description:
          '쿠폰유형. DOWN :다운로드, MANUAL : 수동발급, AUTO : 자동발급, 쿠폰유형 조회 시 다른 검색 조건 무시',
      },
      purpose: {
        type: 'string',
        location: 'query',
        description: '쿠폰 생성 업체. N_C : 나인큐브',
      },
      fields: {
        type: 'string',
        location: 'query',
        description:
          '조회필드 서버 부하를 줄이고 API 이용 시 응답 속도 개선 fields=uid,cate1,product_name',
      },
    },
    responseShape: 'list',
    paginated: true,
  },
  {
    id: 'get-smart_reserve',
    description:
      '스마트 적립금에 사용되는 적립금 항목을 조회합니다. InquiryTimeFrom으로 유효기간을 검색 할 경우 최대 30일까지 검색이 가능합니다. 검색 조건이 없는 경우 전체 항목이 출력됩니다. 통합옵션 및 스마트 적립금 사용 상점에서만 사용이 가능합니다.',
    scopeType: 'read',
    method: 'GET',
    path: 'smart_reserve',
    requiredFields: [],
    fields: {
      InquiryTimeFrom: {
        type: 'string',
        location: 'query',
        description:
          '검색 시작 일자. 0000-00-00, 유효기간 시작일과 종료일이 정해진 경우 조회 가능합니다.',
      },
      InquiryTimeTo: {
        type: 'string',
        location: 'query',
        description:
          '검색 종료 일자. 0000-00-00, 검색 시작 일자만 있는 경우 종료 일자는 당일 일자로 검색',
      },
      code: { type: 'string', location: 'query', description: '적립금 코드' },
      name: {
        type: 'string',
        location: 'query',
        description: '적립금 이름 (LIKE 검색 지원)',
      },
      use: {
        type: 'string',
        location: 'query',
        description: '사용 여부. Y : 사용 가능, N : 사용 불가',
      },
      method: {
        type: 'string',
        location: 'query',
        description:
          '적립금 지급 방식 AUTO : 자동지급, PRD : 구매혜택, DOWN : 다운로드, DIRECT : 즉시지급, REGULAR : 정기지급, MANUAL : 수기지급',
      },
      price: { type: 'string', location: 'query', description: '지급 금액' },
      unit: {
        type: 'string',
        location: 'query',
        description: '지급 금액 단위. WON : 원, Default : WON',
      },
      term_type: {
        type: 'string',
        location: 'query',
        description: '지급 기간 단위. YEAR : 년, MONTH : 개월, DAY : 일',
      },
      term: {
        type: 'string',
        location: 'query',
        description: '지급 기간. term_type 기준으로 지급 되는 기간',
      },
      limit: {
        type: 'string',
        location: 'query',
        description: '검색 한도. MAX: 1000 (default)',
      },
      page: {
        type: 'string',
        location: 'query',
        description: '검색할 페이지. default: 1',
      },
    },
    responseShape: 'list',
    paginated: true,
  },
  {
    id: 'get-user_coupon',
    description:
      '회원의 쿠폰 정보를 조회합니다. 회원별 조회시는 배열 키값이 회원, 일정으로 조회시에는 순차적으로 리턴됩니다. 조회 기간은 30일로 제한됩니다.',
    scopeType: 'read',
    method: 'GET',
    path: 'user_coupon',
    requiredFields: [],
    fields: {
      InquiryTimeFrom: {
        type: 'string',
        location: 'query',
        description: '검색 시작 일자. 0000-00-00 00:00:00',
      },
      InquiryTimeTo: {
        type: 'string',
        location: 'query',
        description: '검색 종료 일자. 0000-00-00 00:00:00 최대 31일 조회 가능',
      },
      searchType: {
        type: 'string',
        location: 'query',
        description:
          '검색 타입. register : 쿠폰 발급일, expire : 쿠폰 만료일, used : 쿠폰 사용일',
      },
      couponnum: {
        type: 'string',
        location: 'query',
        description: '쿠폰번호. 기간 검색시 필수',
      },
      limit: {
        type: 'string',
        location: 'query',
        description: '검색 한도. MAX : 5000 (default)',
      },
      page: { type: 'string', location: 'query', description: '검색할 페이지' },
      userid: { type: 'string', location: 'query', description: '조회 아이디' },
      userids: {
        type: 'array',
        location: 'query',
        description: '다중 조회 아이디. MAX : 100 (Byte 확인 필요)',
      },
      fields: {
        type: 'string',
        location: 'query',
        description:
          '조회필드 서버 부하를 줄이고 API 이용 시 응답 속도 개선. fields=uid,hname',
      },
    },
    responseShape: 'list',
    paginated: true,
  },
  {
    id: 'get-user_emoney',
    description:
      '예치금 정보를 조회합니다. 검색 기간은 시작 일자 기준으로 +1개월 까지 가능합니다.',
    scopeType: 'read',
    method: 'GET',
    path: 'user_emoney',
    requiredFields: [],
    fields: {
      limit: {
        type: 'string',
        location: 'query',
        description: '검색 한도. MAX: 5000 (default)',
      },
      page: {
        type: 'string',
        location: 'query',
        description: '검색할 페이지. default: 1',
      },
      userid: { type: 'string', location: 'query', description: '회원ID' },
      InquiryTimeFrom: {
        type: 'string',
        location: 'query',
        description:
          '검색 시작 일자. 0000-00-00 00:00:00, 등록일,특정 회원을 검색하는 경우가 아니면 필수 입력',
      },
      InquiryTimeTo: {
        type: 'string',
        location: 'query',
        description:
          '검색 종료 일자. 0000-00-00 00:00:00, 검색 시작 일자만 있는 경우 종료 일자는 24시간이 추가된 일자로 검색',
      },
      searchDateType: {
        type: 'string',
        location: 'query',
        description:
          '예치금 구분. U : 사용된 예치금, R : 지급된 예치금, 미입력 시 전체 출력',
      },
    },
    responseShape: 'list',
    paginated: true,
  },
  {
    id: 'get-user_point',
    description: '회원 포인트를 조회합니다. 조회 기간은 30일로 제한됩니다.',
    scopeType: 'read',
    method: 'GET',
    path: 'user_point',
    requiredFields: ['InquiryTimeFrom', 'InquiryTimeTo'],
    fields: {
      InquiryTimeFrom: {
        type: 'string',
        location: 'query',
        description: '검색 시작 일자. 0000-00-00 00:00:00',
      },
      InquiryTimeTo: {
        type: 'string',
        location: 'query',
        description: '검색 종료 일자. 0000-00-00 00:00:00 최대 30일 조회 가능',
      },
      userid: {
        type: 'string',
        location: 'query',
        description:
          '회원 ID. 회원 ID로 검색 시 검색일자를 포함하지 않아도 됩니다.',
      },
      status: {
        type: 'string',
        location: 'query',
        description:
          '사용 / 지급 여부. U : 포인트 사용, R : 포인트 적립 ,default : 전체',
      },
      limit: {
        type: 'string',
        location: 'query',
        description: '검색 한도. MAX : 5000 (default)',
      },
      page: { type: 'string', location: 'query', description: '검색할 페이지' },
    },
    responseShape: 'list',
    paginated: true,
  },
  {
    id: 'get-user_reserve',
    description:
      '회원의 적립금을 조회합니다. 검색 기간은 시작 일자 기준으로 +24시간 까지 가능합니다.',
    scopeType: 'read',
    method: 'GET',
    path: 'user_reserve',
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
        description: '검색할 페이지. default: 1',
      },
      userid: {
        type: 'string',
        location: 'query',
        description: '회원 ID. 회원ID 검색 시 기간 검색을 포함하지 않습니다.',
      },
      InquiryTimeFrom: {
        type: 'string',
        location: 'query',
        description:
          '검색 시작 일자. 0000-00-00 00:00:00, 등록일, 특정 회원을 검색하는 경우가 아니면 필수 입력',
      },
      InquiryTimeTo: {
        type: 'string',
        location: 'query',
        description:
          '검색 종료 일자. 0000-00-00 00:00:00, 검색 시작 일자만 있는 경우 종료 일자는 24시간이 추가된 일자로 검색',
      },
      orderByType: {
        type: 'string',
        location: 'query',
        description:
          '정렬 순서. asc : 오름차순, desc : 내림차순 (default : asc)',
      },
      purpose: {
        type: 'string',
        location: 'query',
        description:
          '적립금 타입. U : 사용된 적립금, R : 적립금 default : all(전체)',
      },
    },
    responseShape: 'list',
    paginated: true,
  },
  {
    id: 'get-user_smart_coupon',
    description:
      '스마트 쿠폰 정보를 조회합니다. 스마트 쿠폰 이용 상점만 사용 가능합니다. 회원별 조회시 배열 키값이 회원, 일정으로 조회시에는 순차적으로 리턴됩니다. 조회 기간은 30일로 제한됩니다.',
    scopeType: 'read',
    method: 'GET',
    path: 'user_smart_coupon',
    requiredFields: ['InquiryTimeFrom'],
    fields: {
      InquiryTimeFrom: {
        type: 'string',
        location: 'query',
        description: '검색 시작 일자. 0000-00-00 00:00:00',
      },
      InquiryTimeTo: {
        type: 'string',
        location: 'query',
        description: '검색 종료 일자. 0000-00-00 00:00:00 최대 30일 조회 가능',
      },
      searchType: {
        type: 'string',
        location: 'query',
        description:
          '검색 타입. 쿠폰 발급일 : register, 쿠폰 만료일 : expire, 쿠폰 사용일 : used, 기간검색 시 필수 입력',
      },
      couponnum: {
        type: 'string',
        location: 'query',
        description: '쿠폰번호. 기간검색 시 필수 입력',
      },
      limit: {
        type: 'string',
        location: 'query',
        description: '검색 한도. MAX : 5000 (default)',
      },
      page: { type: 'string', location: 'query', description: '검색할 페이지' },
      userid: {
        type: 'string',
        location: 'query',
        description: '조회 아이디. 회원아이디로 검색',
      },
      userids: {
        type: 'array',
        location: 'query',
        description: '다중 조회 아이디. MAX : 100 (Byte 확인 필요)',
      },
      used: {
        type: 'string',
        location: 'query',
        description: '쿠폰 사용 여부. Y : 사용, N : 미사용 default : 전체',
      },
      fields: {
        type: 'string',
        location: 'query',
        description:
          '조회필드 서버 부하를 줄이고 API 이용 시 응답 속도 개선. fields=uid,hname',
      },
    },
    responseShape: 'list',
    paginated: true,
  },
  {
    id: 'get-user_smart_reserve',
    description:
      '통합 옵션 이용 상점에서 사용 가능합니다. 스마트 적립금 사용 상점에서 사용 가능합니다. 등록일에 대한 검색은 최대 1일까지만 지원됩니다. 회원id 로 검색 시 use=Y 항목이 포함된 경우 기간 검색 없이 조회가 가능합니다.',
    scopeType: 'read',
    method: 'GET',
    path: 'user_smart_reserve',
    requiredFields: ['InquiryTimeFrom'],
    fields: {
      InquiryTimeFrom: {
        type: 'string',
        location: 'query',
        description:
          '검색 시작 일자. 0000-00-00 00:00:00, 등록일, 특정 회원을 검색하는 경우가 아니면 필수 입력',
      },
      InquiryTimeTo: {
        type: 'string',
        location: 'query',
        description:
          '검색 종료 일자. 0000-00-00 00:00:00, 검색 시작 일자만 있는 경우 종료 일자는 당일 일자로 검색',
      },
      expire_start_date: {
        type: 'string',
        location: 'query',
        description: '만료일 시작 일자. 0000-00-00 00:00:00',
      },
      expire_end_date: {
        type: 'string',
        location: 'query',
        description: '만료일 종료 일자. 0000-00-00 00:00:00',
      },
      reserve_code: {
        type: 'string',
        location: 'query',
        description:
          '적립금 항목 코드. 특정 회원을 검색하는 경우가 아니면 필수 입력',
      },
      userid: { type: 'string', location: 'query', description: '회원 id' },
      use: {
        type: 'string',
        location: 'query',
        description:
          '적립금 이용 가능 여부. Y : 이용 가능, N : 이용 불가. 회원 id로 조회시 use=Y이면 기간 검색 없이 조회 가능합니다.',
      },
      group_id: {
        type: 'string',
        location: 'query',
        description: '회원 그룹 id',
      },
      reserve_name: {
        type: 'string',
        location: 'query',
        description: '적립금명 (LIKE 검색 지원)',
      },
      content: {
        type: 'string',
        location: 'query',
        description: '적립금 지급 문구 (LIKE 검색 지원)',
      },
      reserve_status: {
        type: 'string',
        location: 'query',
        description:
          '지급 적립금 상태 (Y : 사용가능, U : 부분사용, F : 사용완료, N : 사용불가, E : 만료)',
      },
      receive_type: {
        type: 'string',
        location: 'query',
        description:
          '구분 (SAVE : 적립, USE : 사용, EXPIRE : 만료, RESTORE : 복구, SUB : 차감, TRANS : 승계)',
      },
      limit: {
        type: 'string',
        location: 'query',
        description: '검색 한도. MAX: 1000 (default)',
      },
      page: {
        type: 'string',
        location: 'query',
        description: '검색할 페이지. default: 1',
      },
    },
    responseShape: 'list',
    paginated: true,
  },
  {
    id: 'post-coupon-give',
    description:
      '쿠폰을 지급합니다. 1회에 최대 500개까지 쿠폰 발급이 가능합니다. SMS 전송 서비스는 제공되지 않습니다. 쿠폰은 중복 지급됩니다. 즉시발급 쿠폰에 한해 지급됩니다.',
    scopeType: 'write',
    method: 'POST',
    path: 'coupon/give',
    requiredFields: ['datas'],
    fields: {
      datas: { type: 'array', location: 'body', description: '처리 데이터' },
    },
    responseShape: 'single',
  },
  {
    id: 'post-point-give',
    description: '포인트를 지급합니다.',
    scopeType: 'write',
    method: 'POST',
    path: 'point/give',
    requiredFields: ['datas'],
    fields: {
      datas: { type: 'array', location: 'body', description: '처리 데이터' },
    },
    responseShape: 'single',
  },
  {
    id: 'post-reserve-give',
    description: '적립금을 지급합니다.',
    scopeType: 'write',
    method: 'POST',
    path: 'reserve/give',
    requiredFields: [],
    fields: {
      datas: { type: 'array', location: 'body', description: '처리 데이터' },
    },
    responseShape: 'single',
  },
  {
    id: 'post-reserve_temp-give',
    description: '적립금 지급을 요청합니다.',
    scopeType: 'write',
    method: 'POST',
    path: 'reserve_temp/give',
    requiredFields: ['datas'],
    fields: {
      datas: { type: 'array', location: 'body', description: '처리 데이터' },
    },
    responseShape: 'single',
  },
  {
    id: 'post-smart_coupon-give',
    description:
      '스마트 쿠폰을 지급합니다 1회에 최대 500개까지 쿠폰 발급이 가능합니다. 쿠폰은 중복 지급됩니다.',
    scopeType: 'write',
    method: 'POST',
    path: 'smart_coupon/give',
    requiredFields: ['datas'],
    fields: {
      datas: { type: 'array', location: 'body', description: '처리 데이터' },
    },
    responseShape: 'single',
  },
  {
    id: 'post-smart_reserve-give',
    description:
      '스마트 적립금을 지급합니다. 적립금 항목은 기본 지급과 수기 지급 항목인 경우만 가능합니다. reserve 값이 - 인 경우 금액이 차감으로 처리됩니다.',
    scopeType: 'write',
    method: 'POST',
    path: 'smart_reserve/give',
    requiredFields: ['datas'],
    fields: {
      datas: { type: 'array', location: 'body', description: '처리 데이터' },
    },
    responseShape: 'single',
  },
];
