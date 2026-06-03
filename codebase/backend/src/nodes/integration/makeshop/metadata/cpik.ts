import type { MakeshopOperationMetadata } from './types.js';

export const cpikOperations: MakeshopOperationMetadata[] = [
  {
    id: 'post-cart-create',
    description:
      '장바구니는 tempid를 기준으로 생성됩니다. 일반 상품, 세트 상품, 옵션 상품, 개별 옵션, 추가 구성 상품을 담으며, 상품 번호를 기준으로 상품 조회를 통해 출력되는 결과값을 토대로 입력합니다. tempid가 없고 회원 ID가 있는 경우에는 tempid가 새로 생성됩니다.',
    scopeType: 'write',
    method: 'POST',
    path: 'cart/create',
    requiredFields: ['datas'],
    fields: {
      datas: { type: 'array', location: 'body', description: '전송 정보' },
    },
    responseShape: 'single',
  },
  {
    id: 'post-cart-delete',
    description: '장바구니 상품 삭제 (tempid 기준)',
    scopeType: 'write',
    method: 'POST',
    path: 'cart/delete',
    requiredFields: ['datas'],
    fields: {
      datas: { type: 'array', location: 'body', description: '전송 정보' },
    },
    responseShape: 'single',
  },
  {
    id: 'post-cart-update',
    description: '장바구니 상품 수정 (tempid 기준)',
    scopeType: 'write',
    method: 'POST',
    path: 'cart/update',
    requiredFields: ['datas'],
    fields: {
      datas: { type: 'array', location: 'body', description: '전송 정보' },
    },
    responseShape: 'single',
  },
  {
    id: 'post-cpik_member-check',
    description: '크픽 회원의 메이크샵 연동 여부를 확인합니다.',
    scopeType: 'write',
    method: 'POST',
    path: 'cpik_member/check',
    requiredFields: ['cpik_user_id', 'timestamp'],
    fields: {
      cpik_user_id: {
        type: 'string',
        location: 'body',
        description: '크픽 회원 고유번호',
      },
      timestamp: {
        type: 'number',
        location: 'body',
        description: '요청 시각 (Unix timestamp, 5분 유효)',
      },
    },
    responseShape: 'single',
  },
  {
    id: 'post-cpik_member-delete',
    description: '크픽 회원의 메이크샵 연동 해제 (크픽 탈퇴시)',
    scopeType: 'write',
    method: 'POST',
    path: 'cpik_member/delete',
    requiredFields: ['cpik_user_id', 'timestamp'],
    fields: {
      cpik_user_id: {
        type: 'string',
        location: 'body',
        description: '크픽 회원 고유번호',
      },
      timestamp: {
        type: 'number',
        location: 'body',
        description: '요청 시각 (Unix timestamp (5분 유효))',
      },
    },
    responseShape: 'single',
  },
  {
    id: 'post-cpik_member-join',
    description: '크픽 회원의 메이크샵 신규 가입',
    scopeType: 'write',
    method: 'POST',
    path: 'cpik_member/join',
    requiredFields: [
      'cpik_user_id',
      'name',
      'phone',
      'address',
      'zipcode',
      'phone_agree',
      'timestamp',
    ],
    fields: {
      cpik_user_id: {
        type: 'string',
        location: 'body',
        description: '크픽 회원 고유번호',
      },
      email: { type: 'string', location: 'body', description: '이메일' },
      name: { type: 'string', location: 'body', description: '회원이름' },
      phone: { type: 'string', location: 'body', description: '핸드폰 번호' },
      address: { type: 'string', location: 'body', description: '주소' },
      address_detail: {
        type: 'string',
        location: 'body',
        description: '상세주소',
      },
      zipcode: { type: 'string', location: 'body', description: '우편번호' },
      email_agree: {
        type: 'string',
        location: 'body',
        description: '이메일 수신 동의. Y(동의) / N(미동의)',
      },
      phone_agree: {
        type: 'string',
        location: 'body',
        description: 'SMS 수신 동의. Y(동의) / N(미동의)',
      },
      timestamp: {
        type: 'number',
        location: 'body',
        description: '요청 시각. Unix timestamp (5분 유효)',
      },
    },
    responseShape: 'single',
  },
  {
    id: 'post-cpik_member-login',
    description: '회원 로그인 SSO 토큰 획득 API',
    scopeType: 'write',
    method: 'POST',
    path: 'cpik_member/login',
    requiredFields: [
      'cpik_user_id',
      'redirect_url',
      'redirect_fail_url',
      'timestamp',
    ],
    fields: {
      cpik_user_id: {
        type: 'string',
        location: 'body',
        description: '크픽 회원 고유번호',
      },
      redirect_url: {
        type: 'string',
        location: 'body',
        description: '로그인 후 이동 URL (‘/shop/basket.html’ - 장바구니)',
      },
      redirect_fail_url: {
        type: 'string',
        location: 'body',
        description: '로그인 실패시 이동 URL (‘/’)',
      },
      timestamp: {
        type: 'number',
        location: 'body',
        description: '요청 시각 (Unix timestamp (5분 유효))',
      },
    },
    responseShape: 'single',
  },
  {
    id: 'post-cpik_online_order-create',
    description: '주문 등록',
    scopeType: 'write',
    method: 'POST',
    path: 'cpik_online_order/create',
    requiredFields: ['datas'],
    fields: {
      datas: { type: 'array', location: 'body', description: '전송 정보' },
    },
    responseShape: 'single',
  },
];
