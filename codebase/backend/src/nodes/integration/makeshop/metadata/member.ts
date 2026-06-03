import type { MakeshopOperationMetadata } from './types.js';

export const memberOperations: MakeshopOperationMetadata[] = [
  {
    id: 'get-cart',
    description:
      '장바구니 정보를 조회합니다. 최근 담은 순으로 정렬됩니다. 조회 기간의 경우 1일로 권장합니다.(조회량이 많을 경우 서버부하가 생길 수 있습니다.)',
    scopeType: 'read',
    method: 'GET',
    path: 'cart',
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
      limit: {
        type: 'string',
        location: 'query',
        description: '검색 한도. MAX : 5000 (default)',
      },
      page: { type: 'string', location: 'query', description: '검색할 페이지' },
      userid: {
        type: 'string',
        location: 'query',
        description: '조회 아이디. 아이디 조회 시 검색일자 무시',
      },
      tempid: {
        type: 'string',
        location: 'query',
        description: '세션 아이디. 세션 아이디 조회 시 검색일자 무시',
      },
      uid: {
        type: 'string',
        location: 'query',
        description: '상품번호. 세션 아이디 조회 시 검색일자 무시',
      },
      fields: {
        type: 'string',
        location: 'query',
        description:
          '조회필드. 서버 부하를 줄이고 API 이용 시 응답 속도 개선. fields=uid,date,amount',
      },
    },
    responseShape: 'list',
    paginated: true,
  },
  {
    id: 'get-group',
    description:
      '회원의 그룹 정보를 조회합니다. group_id 대문자 2자리는 혜택에 따른 조건 값으로 혜택이 변경될 경우 변경됩니다. group_id 숫자 값은 변하지 않음. 예: MX11 => RP11',
    scopeType: 'read',
    method: 'GET',
    path: 'group',
    requiredFields: [],
    fields: {
      group_id: {
        type: 'string',
        location: 'query',
        description: '그룹 아이디',
      },
    },
    responseShape: 'list',
  },
  {
    id: 'get-user',
    description:
      '상점에 등록된 회원을 조회합니다. 회원 조회수는 5,000개로 제한됩니다. 최근 가입 순으로 정렬됩니다 휴면 회원은 조회되지 않습니다. 조회 기간은 30일로 제한됩니다.',
    scopeType: 'read',
    method: 'GET',
    path: 'user',
    requiredFields: [],
    fields: {
      InquiryTimeFrom: {
        type: 'string',
        location: 'query',
        description:
          '검색 시작 일자 0000-00-00 00:00:00 (searchType : dormant_wait => 0000-00-00)',
      },
      InquiryTimeTo: {
        type: 'string',
        location: 'query',
        description:
          '검색 종료 일자 0000-00-00 00:00:00 (searchType : dormant_wait => 0000-00-00) 최대 31일 조회 가능',
      },
      searchType: {
        type: 'string',
        location: 'query',
        description:
          '검색 타입 dormant_wait : 휴면전환 예정일 (default : 가입일), modify : 회원정보 변경일, login :회원 로그인, all : 전체 회원 all(전체회원)인 경우 next_userid 외',
      },
      limit: {
        type: 'string',
        location: 'query',
        description: '검색 한도. MAX : 5000 (default)',
      },
      page: { type: 'string', location: 'query', description: '검색할 페이지' },
      next_userid: {
        type: 'string',
        location: 'query',
        description:
          '전체 회원 검색 시 다음 항목 검색을 위한 회원 ID 전체 회원 조회 시 응답값을 통해서 제공 됩니다.next_userid를 기준으로 다음에 존재하는 회원 리스트를 조회합니다.',
      },
      mobile: { type: 'string', location: 'query', description: '휴대폰' },
      userid: {
        type: 'string',
        location: 'query',
        description: '조회 아이디. 조회 시 검색 조건 무시',
      },
      userids: {
        type: 'array',
        location: 'query',
        description: '다중 조회 아이디',
      },
      email: {
        type: 'string',
        location: 'query',
        description: '회원 메일 주소. 조회 시 검색 조건 무시',
      },
      memberType: {
        type: 'string',
        location: 'query',
        description:
          '회원 구분 default : 전체, PERSON : 일반회원, COMPANY : 기업회원 ##회원 여부로 검색시 시작일시를 필수 입력해야합니다.',
      },
      email_receive: {
        type: 'string',
        location: 'query',
        description: '이메일 수신여부. default : 전체, Y: 동의, N : 미동의',
      },
      sms_receive: {
        type: 'string',
        location: 'query',
        description: 'SMS 수신여부. default : 전체, Y: 동의, N : 미동의',
      },
      sort: {
        type: 'string',
        location: 'query',
        description: '정렬 여부. N : 미사용, 정렬 미사용',
      },
      privacy_uid: {
        type: 'string',
        location: 'query',
        description: '회원 약관 ID. 해당 약관에 동의한 회원 조회',
      },
      fields: {
        type: 'string',
        location: 'query',
        description:
          '조회필드. 서버 부하를 줄이고 API 이용 시 응답 속도 개선 (fields=id,hname)',
      },
    },
    responseShape: 'list',
    paginated: true,
  },
  {
    id: 'get-user_auto_group',
    description:
      '자동으로 변경된 회원 그룹 내역을 조회합니다. 조회 기간은 30일로 제한됩니다.',
    scopeType: 'read',
    method: 'GET',
    path: 'user_auto_group',
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
      userid: { type: 'string', location: 'query', description: '회원 ID' },
      group_id: {
        type: 'string',
        location: 'query',
        description: '회원그룹ID. 회원그룹 조회를 통해 group_id 필요',
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
    id: 'get-user_dormant',
    description:
      '휴면 회원으로 변경된 회원을 조회합니다. 휴면 변경일과 회원 아이디만 제공 됩니다.',
    scopeType: 'read',
    method: 'GET',
    path: 'user_dormant',
    requiredFields: ['InquiryTimeFrom'],
    fields: {
      InquiryTimeFrom: {
        type: 'string',
        location: 'query',
        description: '검색 시작 일자. 0000-00-00',
      },
      InquiryTimeTo: {
        type: 'string',
        location: 'query',
        description: '검색 종료 일자. 0000-00-00 최대 30일 조회 가능',
      },
      searchType: {
        type: 'string',
        location: 'query',
        description:
          '검색 타입. date : 탈퇴 회원 요청일, withdraw : 탈퇴 회원 승인일 (default : date)',
      },
      userid: {
        type: 'string',
        location: 'query',
        description: '조회 아이디. 아이디 조회 시 검색일자 무시',
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
    id: 'get-user_dormant_wait',
    description:
      '회원의 휴면 전환 예정일을 조회합니다. 조회는 당일부터 최대 30일까지 검색 할 수 있습니다.',
    scopeType: 'read',
    method: 'GET',
    path: 'user_dormant_wait',
    requiredFields: ['InquiryTimeFrom'],
    fields: {
      InquiryTimeFrom: {
        type: 'string',
        location: 'query',
        description: '검색 시작 일자. 0000-00-00',
      },
      InquiryTimeTo: {
        type: 'string',
        location: 'query',
        description: '검색 종료 일자. 0000-00-00 최대 30일 조회 가능',
      },
      userid: {
        type: 'string',
        location: 'query',
        description: '회원ID. 회원ID 조회 시 검색일자 무시',
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
    id: 'get-user_exit',
    description:
      '탈퇴한 회원을 조회합니다. 회원이 주문이 없거나, 상점 설정에 따라 재가입이 가능한 경우 조회 되지 않습니다. 모든 탈퇴 회원의 id를 조회하는 경우 탈퇴 회원 로그 조회 기능을 통해서 조회가 가능합니다. 탈퇴 회원이 승인처리되면 아이디를 제외한 개인정보가 삭제됩니다. 조회 기간은 30일로 제한됩니다.',
    scopeType: 'read',
    method: 'GET',
    path: 'user_exit',
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
          '검색 타입. date : 탈퇴 회원 요청일, withdraw : 탈퇴 회원 승인일 (default : date)',
      },
      limit: {
        type: 'string',
        location: 'query',
        description: '검색 한도. MAX : 5000 (default)',
      },
      page: {
        type: 'string',
        location: 'query',
        description: '검색할 페이지. 아이디 조회 시 검색일자 무시',
      },
      userid: { type: 'string', location: 'query', description: '조회 아이디' },
      fields: {
        type: 'string',
        location: 'query',
        description:
          '조회필드. 서버 부하를 줄이고 API 이용 시 응답 속도 개선 fields=id,hname',
      },
    },
    responseShape: 'list',
    paginated: true,
  },
  {
    id: 'get-user_exit_log',
    description:
      '탈퇴 처리된 회원 아이디를 조회합니다. 최대 30일까지 검색 가능합니다.',
    scopeType: 'read',
    method: 'GET',
    path: 'user_exit_log',
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
        description:
          '검색 종료 일자. 0000-00-00 00:00:00 검색 시작 일자만 있는 경우 종료 일자는 당일 일자로 검색',
      },
      userid: { type: 'string', location: 'query', description: '회원 id' },
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
    id: 'get-user_group_change_log',
    description:
      '회원 그룹 변경 내역을 조회합니다. 조회 기간은 30일로 제한됩니다.',
    scopeType: 'read',
    method: 'GET',
    path: 'user_group_change_log',
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
      userid: { type: 'string', location: 'query', description: '회원 ID' },
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
    id: 'get-user_order',
    description:
      '회원 아이디를 통해 주문 관련 통계를 조회 할 수 있습니다. userid는 필수 입력 사항입니다. last_delicomplete_date, last_deliend_date 는 주문 2.0 에서만 합니다.',
    scopeType: 'read',
    method: 'GET',
    path: 'user_order',
    requiredFields: ['userid'],
    fields: {
      userid: { type: 'string', location: 'query', description: '회원 id' },
      InquiryTimeFrom: {
        type: 'string',
        location: 'query',
        description: '검색 시작 일자. 0000-00-00, 미입력시 전체 기간',
      },
      InquiryTimeTo: {
        type: 'string',
        location: 'query',
        description:
          '검색 종료 일자. 0000-00-00 검색 시작 일자만 있는 경우 종료 일자는 당일 일자로 검색',
      },
      InquiryType: {
        type: 'string',
        location: 'query',
        description:
          '검색 타입. D : 배송완료 시점, P : 결제 완료 시점, Deafault : D',
      },
      fields: {
        type: 'string',
        location: 'query',
        description:
          '조회필드 서버 부하를 줄이고 API 이용 시 응답 속도 개선 fields=last_delicomplete_date,last_deliend_date',
      },
    },
    responseShape: 'single',
  },
  {
    id: 'post-send_sms',
    description:
      'SMS 메세지를 발송합니다. 다중 유저 발송은 불가능 합니다. SMS 충전이 필요합니다',
    scopeType: 'write',
    method: 'POST',
    path: 'send_sms',
    requiredFields: ['sms_type', 'content', 'userid', 'send_now'],
    fields: {
      sms_type: {
        type: 'string',
        location: 'body',
        description: '메세지 타입 (sms,lms)',
      },
      content: { type: 'string', location: 'body', description: '내용' },
      display_ad: {
        type: 'string',
        location: 'body',
        description: '광고 문구 노출 (Y, N)',
      },
      display_spam_number: {
        type: 'string',
        location: 'body',
        description: '수신거부 문구 노출 (Y, N)',
      },
      spam_number: {
        type: 'string',
        location: 'body',
        description: '수신거부 번호. 000-0000-0000',
      },
      sender: {
        type: 'string',
        location: 'body',
        description: '보내는 사람. 000-0000-0000',
      },
      userid: { type: 'string', location: 'body', description: '유저 ID' },
      send_now: {
        type: 'string',
        location: 'body',
        description: '즉시 발송 설정',
      },
      send_year: {
        type: 'string',
        location: 'body',
        description: '발송 년. 20XX',
      },
      send_month: {
        type: 'string',
        location: 'body',
        description: '발송 월. 1~12',
      },
      send_day: {
        type: 'string',
        location: 'body',
        description: '발송 일. 1~31',
      },
      send_hour: {
        type: 'string',
        location: 'body',
        description: '발송 시간. 9~20',
      },
      send_min: {
        type: 'string',
        location: 'body',
        description: '발송 분. 0~59',
      },
    },
    responseShape: 'single',
  },
  {
    id: 'post-user-agree',
    description: '고객의 SMS 수신 동의 여부를 수정합니다.',
    scopeType: 'write',
    method: 'POST',
    path: 'user/agree',
    requiredFields: ['datas'],
    fields: {
      datas: { type: 'array', location: 'body' },
    },
    responseShape: 'single',
  },
  {
    id: 'post-user_counsel-create',
    description: '고객 상담을 등록합니다.',
    scopeType: 'write',
    method: 'POST',
    path: 'user_counsel/create',
    requiredFields: ['id', 'status', 'condition', 'counsel_type', 'content'],
    fields: {
      id: { type: 'string', location: 'body', description: '회원ID' },
      status: {
        type: 'string',
        location: 'body',
        description: '처리여부 (N : 미처리, I : 처리중, Y : 처리완료)',
      },
      condition: {
        type: 'string',
        location: 'body',
        description:
          '고객지수 (B : 최상, D : 좋음, S : 보통, G : 낮음, W : 최하)',
      },
      counsel_type: {
        type: 'string',
        location: 'body',
        description:
          '상담분류 D00 : 기타, D01 : 주문, D02 : 결제,D03 : 배송, D04 : 상품, D05 : 오류, D06 : 반품, D07 : 환불',
      },
      ordernum: { type: 'string', location: 'body', description: '주문번호' },
      manager: {
        type: 'string',
        location: 'body',
        description: '상담자ID (운영자 또는 부운영자ID 입력)',
      },
      content: { type: 'string', location: 'body', description: '상담내용' },
    },
    responseShape: 'single',
  },
  {
    id: 'post-user_counsel-delete',
    description: '고객 상담 정보를 삭제합니다.',
    scopeType: 'write',
    method: 'POST',
    path: 'user_counsel/delete',
    requiredFields: ['id', 'date'],
    fields: {
      id: { type: 'string', location: 'body', description: '회원ID' },
      date: { type: 'string', location: 'body', description: '날짜' },
    },
    responseShape: 'single',
  },
  {
    id: 'post-user_counsel-update',
    description: '고객 상담을 정보를 수정합니다.',
    scopeType: 'write',
    method: 'POST',
    path: 'user_counsel/update',
    requiredFields: [
      '회원ID',
      'status',
      'condition',
      'counsel_type',
      'content',
      'date',
    ],
    fields: {
      회원ID: { type: 'string', location: 'body', description: 'id' },
      status: {
        type: 'string',
        location: 'body',
        description: '처리여부 (N : 미처리, I : 처리중, Y : 처리완료)',
      },
      condition: {
        type: 'string',
        location: 'body',
        description:
          '고객지수 (B : 최상, D : 좋음, S : 보통, G : 낮음, W : 최하)',
      },
      counsel_type: {
        type: 'string',
        location: 'body',
        description:
          '상담분류 D00 : 기타, D01 : 주문, D02 : 결제,D03 : 배송, D04 : 상품, D05 : 오류, D06 : 반품, D07 : 환불',
      },
      ordernum: { type: 'string', location: 'body', description: '주문번호' },
      manager: {
        type: 'string',
        location: 'body',
        description: '운영자 또는 부운영자ID 입력',
      },
      content: { type: 'string', location: 'body', description: '상담내용' },
      date: { type: 'string', location: 'body', description: '날짜' },
    },
    responseShape: 'single',
  },
  {
    id: 'post-user_group_change-update',
    description:
      '회원의 그룹을 변경합니다. Beta 버전으로 수정이 될 수 있습니다.',
    scopeType: 'write',
    method: 'POST',
    path: 'user_group_change/update',
    requiredFields: ['userid'],
    fields: {
      userid: { type: 'string', location: 'body', description: '회원 ID' },
      group_id: {
        type: 'string',
        location: 'body',
        description:
          '그룹 코드. 그룹코드 또는 그룹명 중 하나는 필수. 그룹코드가 그룹명보다 우선시 됩니다.',
      },
      group_name: {
        type: 'string',
        location: 'body',
        description: '그룹명. 그룹코드 또는 그룹명 중 하나는 필수',
      },
    },
    responseShape: 'single',
  },
];
