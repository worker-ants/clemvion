/** MakeShop Shop API — 상품 (Product) 섹션 (37 operations). SoT: spec/conventions/makeshop-api-catalog/product.md */

import type { MakeshopOperationMetadata } from './types.js';

export const productOperations: MakeshopOperationMetadata[] = [
  {
    id: 'get-brand',
    description: '브랜드 또는 제조사를 조회합니다.',
    scopeType: 'read',
    method: 'GET',
    path: 'brand',
    requiredFields: [],
    fields: {
      searchType: {
        type: 'string',
        location: 'query',
        description: '검색 구분 (브랜드 : BRAND, 제조사 : MAKER)',
      },
    },
    responseShape: 'list',
  },
  {
    id: 'get-brand_product',
    description: '검색한 브랜드에 해당되는 상품리스트를 조회합니다.',
    scopeType: 'read',
    method: 'GET',
    path: 'brand_product',
    requiredFields: [],
    fields: {
      product_type: {
        type: 'string',
        location: 'query',
        description:
          '상품 검색 타입. ALL - 전체상품(default), PROMOTION - 대표상품',
      },
      brand_id: {
        type: 'number',
        location: 'query',
        description: '브랜드 대분류',
      },
      brand_mid: {
        type: 'number',
        location: 'query',
        description: '브랜드 중분류',
      },
      brand_sid: {
        type: 'number',
        location: 'query',
        description: '브랜드 소분류',
      },
    },
    responseShape: 'list',
  },
  {
    id: 'get-cart_free',
    description: '카트프리 통계 정보를 조회합니다.',
    scopeType: 'read',
    method: 'GET',
    path: 'cart_free',
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
      InquiryTimeFrom: {
        type: 'string',
        location: 'query',
        description: '검색 시작 일자. 0000-00-00 00:00:00',
      },
      InquiryTimeTo: {
        type: 'string',
        location: 'query',
        description:
          '검색 종료 일자. 0000-00-00, 검색 시작 일자만 있는 경우 종료 일자는 24시간이 추가된 일자로 검색',
      },
      search_type: {
        type: 'string',
        location: 'query',
        description:
          '조회 타입. product : 상품 분석, user : 이용자 분석 (default : product)',
      },
    },
    responseShape: 'single',
    paginated: true,
  },
  {
    id: 'get-category',
    description: '카테고리 정보를 조회합니다.',
    scopeType: 'read',
    method: 'GET',
    path: 'category',
    requiredFields: [],
    fields: {
      cate1: { type: 'string', location: 'query', description: '대분류' },
      cate2: { type: 'string', location: 'query', description: '중분류' },
      cate3: { type: 'string', location: 'query', description: '소분류' },
    },
    responseShape: 'list',
  },
  {
    id: 'get-category_display_products',
    description: '분류별 진열 상품 리스트를 조회합니다.',
    scopeType: 'read',
    method: 'GET',
    path: 'category_display_products',
    requiredFields: [],
    fields: {
      virtual: {
        type: 'string',
        location: 'query',
        description: '가상 분류 여부',
      },
      cate1: { type: 'string', location: 'query', description: '대분류' },
      cate2: { type: 'string', location: 'query', description: '중분류' },
      cate3: { type: 'string', location: 'query', description: '소분류' },
      sell_accept: {
        type: 'string',
        location: 'query',
        description:
          '구매 가능 여부. Y : 판매 불가능 상품 제외, N : 판매 불가능 상품 포함, (Default : N)',
      },
      soldout: {
        type: 'string',
        location: 'query',
        description:
          '품절 여부. Y : 품절 상품 제외, N : 품절 상품 포함, (Default : N)',
      },
      display_type: {
        type: 'string',
        location: 'query',
        description:
          '노출 여부. Y : 진열 상품, N : 미진열 상품 포함, (Default : N)',
      },
      limit: {
        type: 'string',
        location: 'query',
        description: '검색 한도. MAX : 3000 (default)',
      },
      page: { type: 'string', location: 'query', description: '검색할 페이지' },
    },
    responseShape: 'list',
    paginated: true,
  },
  {
    id: 'get-delete_product',
    description: '삭제 상품 리스트를 조회합니다.',
    scopeType: 'read',
    method: 'GET',
    path: 'delete_product',
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
      uid: {
        type: 'string',
        location: 'query',
        description: '상품 번호 (상품번호 조회 시 검색일자 무시)',
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
    id: 'get-discount',
    description: '상품 기간 할인 정보를 조회합니다.',
    scopeType: 'read',
    method: 'GET',
    path: 'discount',
    requiredFields: [],
    fields: {},
    responseShape: 'list',
  },
  {
    id: 'get-icon',
    description: '상품에 등록 가능한 아이콘 리스트를 조회합니다.',
    scopeType: 'read',
    method: 'GET',
    path: 'icon',
    requiredFields: [],
    fields: {
      device_type: {
        type: 'string',
        location: 'query',
        description: '출력 위치 (WEB : PC, MOBILE : 모바일, default : 전체)',
      },
      code: { type: 'string', location: 'query', description: '아이콘 코드' },
      custom: {
        type: 'string',
        location: 'query',
        description:
          '사용사 추가 여부 (Y ; 사용자 추가, N : 기본 아이콘 default : 전체)',
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
    id: 'get-main_display',
    description: '메인 노출 상품을 조회합니다.',
    scopeType: 'read',
    method: 'GET',
    path: 'main_display',
    requiredFields: [],
    fields: {
      product_id: {
        type: 'string',
        location: 'query',
        description: '상품 번호',
      },
      code: {
        type: 'string',
        location: 'query',
        description: '메인 노출 코드',
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
    id: 'get-plan',
    description: '기획전 상품 리스트를 조회합니다.',
    scopeType: 'read',
    method: 'GET',
    path: 'plan',
    requiredFields: [],
    fields: {
      notice_id: {
        type: 'string',
        location: 'query',
        description: '분류코드. 1 : 의류',
      },
      notice_ids: {
        type: 'array',
        location: 'query',
        description: '분류코드 다중입력',
      },
    },
    responseShape: 'list',
  },
  {
    id: 'get-product',
    description:
      '상품 정보를 조회합니다. 최근 등록한 상품 순으로 정렬됩니다. 요청 전문 중 fields필드를 이용하면 불필요한 값으로 인한 검색 속도 저하를 최소화 할 수 있습니다. 상품 조회는 1,000개로 이내로 검색을 권장합니다. product_info_notice 항목은 지원 종료되며, product_info_notices로 대체됩니다.',
    scopeType: 'read',
    method: 'GET',
    path: 'product',
    requiredFields: [],
    fields: {
      limit: {
        type: 'string',
        location: 'query',
        description: '검색 한도. MAX : 1000 (default)',
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
          '검색 시작 일자. 0000-00-00 00:00:00 (등록/수정/판매일 기준 검색, InquiryType 정의 필수)',
      },
      InquiryTimeTo: {
        type: 'string',
        location: 'query',
        description:
          '검색 종료 일자. 0000-00-00 00:00:00 (등록/수정/판매일 기준 검색, InquiryType 정의 필수)',
      },
      InquiryType: {
        type: 'string',
        location: 'query',
        description:
          '등록/수정/판매일 기준 검색 reg : 등록일, nmod : 수정일, sell : 판매일, InquiryTimeFrom 정의 필수',
      },
      xcode: { type: 'string', location: 'query', description: '대분류' },
      mcode: { type: 'string', location: 'query', description: '중분류' },
      scode: { type: 'string', location: 'query', description: '소분류' },
      sellAccept: {
        type: 'string',
        location: 'query',
        description: '판매 가능 여부 (Y : 사용함, N : 사용안함)',
      },
      display: {
        type: 'string',
        location: 'query',
        description: '판매 진열 여부 (Y : 사용함, N : 사용안함)',
      },
      sortType: {
        type: 'string',
        location: 'query',
        description:
          '정렬 순서 값. modify : 수정일 순, selldate : 최근 판매일 순, (default : 등록일 순)',
      },
      orderByType: {
        type: 'string',
        location: 'query',
        description:
          '정렬 순서. asc : 오름차순, desc : 내림차순, (default : desc)',
      },
      product_name: {
        type: 'string',
        location: 'query',
        description: '상품명',
      },
      uid: {
        type: 'array',
        location: 'query',
        description: '상품 번호 (단일 상품 조회 (다른 검색 조건 무시))',
      },
      uids: {
        type: 'array',
        location: 'query',
        description:
          '다중 조회 상품 번호. (다른 검색 조건 무시) MAX : 200 (Byte 확인 필요)',
      },
      provider: {
        type: 'string',
        location: 'query',
        description: '공급사 (공급사 코드(provider_code) 값으로 검색)',
      },
      soldout: {
        type: 'string',
        location: 'query',
        description:
          '상품 품절 여부. Y : 품절, N : 재고있음, P : 재고상품(무제한 제외), A : 무제한',
      },
      fields: {
        type: 'string',
        location: 'query',
        description:
          '조회필드. (서버 부하를 줄이고 API 이용 시 응답 속도 개선 fields=uid,cate1,product_name)',
      },
    },
    responseShape: 'list',
    paginated: true,
  },
  {
    id: 'get-product_notice',
    description: '상품의 일반 공시 정보를 조회합니다.',
    scopeType: 'read',
    method: 'GET',
    path: 'product_notice',
    requiredFields: [],
    fields: {
      notice_id: {
        type: 'string',
        location: 'query',
        description:
          '분류 코드 #공통 C1 : 의류, C2 : 구두/신발, C3 : 가방, C4 : 패션잡화(모자/벨트/엑세서리), C5 : 침구류/커튼, C6 : 가구(침대/소파/싱크대/DIY제품), C7 : 영상가전(TV류), C8',
      },
      notice_ids: {
        type: 'array',
        location: 'query',
        description: '분류 코드분류 코드 (다중입력)',
      },
      notice_type: {
        type: 'string',
        location: 'query',
        description: '공시 타입 common(공통제공), user(사용자 생성)',
      },
    },
    responseShape: 'list',
  },
  {
    id: 'get-product_seo',
    description:
      '상품의 검색엔진 최적화(SEO) 정보를 조회합니다. 디자인 버전 D4 인 경우에만 제공됩니다.',
    scopeType: 'read',
    method: 'GET',
    path: 'product_seo',
    requiredFields: [],
    fields: {
      uid: { type: 'string', location: 'query', description: '상품 번호' },
      uids: {
        type: 'array',
        location: 'query',
        description: '다중 조회 상품 번호',
      },
    },
    responseShape: 'single',
  },
  {
    id: 'get-product_size_chart',
    description:
      '상품에 포함되는 사이즈 차트 항목을 조회합니다. 검색 조건이 없는 경우 전체 항목이 조회됩니다. 검색기간은 최대 하루까지 지원 됩니다. size_chart 검색 시 기간 검색은 포함되지 않습니다.',
    scopeType: 'read',
    method: 'GET',
    path: 'product_size_chart',
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
      searchType: {
        type: 'string',
        location: 'query',
        description:
          '검색 타입 (created : 생성일, modify : 수정일. default : 생성일)',
      },
      size_chart: {
        type: 'string',
        location: 'query',
        description: '사이즈 차트 ID',
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
    id: 'get-provider',
    description: '공급자 정보를 조회합니다.',
    scopeType: 'read',
    method: 'GET',
    path: 'provider',
    requiredFields: [],
    fields: {
      status: {
        type: 'string',
        location: 'query',
        description: '상태 (APPLY : 승인, STOP : 보류, NONE : 대기)',
      },
      code: { type: 'string', location: 'query', description: '공급사 코드' },
    },
    responseShape: 'list',
  },
  {
    id: 'get-provider_settlement',
    description: '공급자 정산 정보를 조회합니다.',
    scopeType: 'read',
    method: 'GET',
    path: 'provider_settlement',
    requiredFields: ['InquiryType', 'code', 'status'],
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
      InquiryType: {
        type: 'string',
        location: 'query',
        description:
          '검색 타입. deli_date : 배송중 처리일 (default), delicomplete_date : 배송완료 처리일, deliend_date : 거래완료 처리일',
      },
      code: {
        type: 'string',
        location: 'query',
        description: '공급자 코드. 본사 : none (default)',
      },
      status: {
        type: 'string',
        location: 'query',
        description:
          '정산 상태. 전체 : ALL (default), WAIT : 대기, REQUEST : 요청, DONE : 완료',
      },
      limit: {
        type: 'string',
        location: 'query',
        description: '검색 한도. MAX : 5000 (default)',
      },
      page: { type: 'string', location: 'query', description: '검색할 페이지' },
    },
    responseShape: 'single',
    paginated: true,
  },
  {
    id: 'get-stock',
    description: '상품의 재고를 조회합니다.',
    scopeType: 'read',
    method: 'GET',
    path: 'stock',
    requiredFields: ['uid'],
    fields: {
      uid: {
        type: 'string',
        location: 'query',
        description: '상품번호. 콤마(,) 구분으로 다중 검색 가능',
      },
    },
    responseShape: 'list',
  },
  {
    id: 'get-subs_product',
    description: '정기배송 상품 리스트를 조회합니다.',
    scopeType: 'read',
    method: 'GET',
    path: 'subs_product',
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
      sortType: {
        type: 'string',
        location: 'query',
        description:
          '정렬 순서 값 sellprice : 판매가격, apply_count : 신청수, cancel_count : 취소수, apply_stock_count : 신청수량, total_subs_price : 총금액 (defau',
      },
      orderByType: {
        type: 'string',
        location: 'query',
        description:
          '정렬 순서 asc : 오름차순, desc : 내림차순 (default : desc)',
      },
      product_name: {
        type: 'string',
        location: 'query',
        description: '상품명',
      },
    },
    responseShape: 'list',
    paginated: true,
  },
  {
    id: 'get-wishlist',
    description: '관심 상품 정보를 조회합니다.',
    scopeType: 'read',
    method: 'GET',
    path: 'wishlist',
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
      userid: { type: 'string', location: 'query', description: '회원 ID' },
      uid: { type: 'string', location: 'query', description: '상품번호' },
      limit: {
        type: 'string',
        location: 'query',
        description: '검색 한도 MAX : 5000 (default)',
      },
      page: { type: 'string', location: 'query', description: '검색할 페이지' },
    },
    responseShape: 'list',
    paginated: true,
  },
  {
    id: 'post-brand-create',
    description:
      '브랜드 또는 제조사를 등록합니다. Beta 버전으로 수정이 될 수 있습니다.',
    scopeType: 'write',
    method: 'POST',
    path: 'brand/create',
    requiredFields: ['type', 'name'],
    fields: {
      type: {
        type: 'string',
        location: 'body',
        description: '타입 (브랜드 : BRAND, 제조사 : MAKER)',
      },
      brand_id: { type: 'number', location: 'body', description: '대분류' },
      brand_mid: { type: 'number', location: 'body', description: '중분류' },
      brand_sid: { type: 'number', location: 'body', description: '소분류' },
      name: { type: 'string', location: 'body', description: '브랜드 명' },
      display_product_count: {
        type: 'number',
        location: 'body',
        description:
          '상품 진열 개수. 대분류 등록 시 최소6, 최대100까지 설정가능 (Default : 6)',
      },
      order_by_type: {
        type: 'string',
        location: 'body',
        description:
          '진열상품 정렬 (REG_TOP : 관리자 지정 순(최신 상단), REG_BOTTOM : 관리자 지정 순(최신 하단), VIEWCNT : 인기 상품 순, REGDATE : 최신 순, PRICE_DESC : 높은 가격',
      },
      sort_soldout: {
        type: 'string',
        location: 'body',
        description: '품절 상품 하단 노출 여부 (Y : 노출함, N : 노출안함)',
      },
      display: {
        type: 'string',
        location: 'body',
        description: '노출 여부 (Y : 노출함, N : 노출안함)',
      },
      banner: {
        type: 'string',
        location: 'body',
        description: '배너. HTML입력',
      },
      m_banner: {
        type: 'string',
        location: 'body',
        description: '모바일 배너. HTML 입력',
      },
      keyword: {
        type: 'string',
        location: 'body',
        description: '키워드. 콤마(,)구분. 최하위 단계 분류에서만 설정 가능',
      },
    },
    responseShape: 'single',
  },
  {
    id: 'post-brand-delete',
    description:
      '등록된 브랜드 또는 제조사 정보를 삭제합니다. Beta 버전으로 수정이 될 수 있습니다.',
    scopeType: 'write',
    method: 'POST',
    path: 'brand/delete',
    requiredFields: ['type', 'brand_id', 'brand_mid', 'brand_sid'],
    fields: {
      type: {
        type: 'string',
        location: 'body',
        description: '타입 (브랜드 : BRAND, 제조사 : MAKER)',
      },
      brand_id: { type: 'string', location: 'body', description: '대분류' },
      brand_mid: { type: 'string', location: 'body', description: '중분류' },
      brand_sid: { type: 'string', location: 'body', description: '소분류' },
    },
    responseShape: 'single',
  },
  {
    id: 'post-brand-update',
    description:
      '등록된 브랜드 또는 제조사 정보를 수정합니다. Beta 버전으로 수정이 될 수 있습니다.',
    scopeType: 'write',
    method: 'POST',
    path: 'brand/update',
    requiredFields: ['type', 'name'],
    fields: {
      type: {
        type: 'string',
        location: 'body',
        description: '타입 (브랜드 : BRAND, 제조사 : MAKER)',
      },
      brand_id: { type: 'number', location: 'body', description: '대분류' },
      brand_mid: { type: 'number', location: 'body', description: '중분류' },
      brand_sid: { type: 'number', location: 'body', description: '소분류' },
      name: { type: 'string', location: 'body', description: '브랜드 명' },
      display_product_count: {
        type: 'number',
        location: 'body',
        description:
          '상품 진열 개수. 대분류 등록 시 최소6, 최대100까지 설정가능 (Default : 6)',
      },
      order_by_type: {
        type: 'string',
        location: 'body',
        description:
          '진열상품 정렬 (REG_TOP : 관리자 지정 순(최신 상단), REG_BOTTOM : 관리자 지정 순(최신 하단), VIEWCNT : 인기 상품 순, REGDATE : 최신 순, PRICE_DESC : 높은 가격',
      },
      sort_soldout: {
        type: 'string',
        location: 'body',
        description: '품절 상품 하단 노출 여부 (Y : 노출함, N : 노출안함)',
      },
      display: {
        type: 'string',
        location: 'body',
        description: '노출 여부 (Y : 노출함, N : 노출안함)',
      },
      banner: {
        type: 'string',
        location: 'body',
        description: '배너. HTML입력',
      },
      m_banner: {
        type: 'string',
        location: 'body',
        description: '모바일 배너. HTML 입력',
      },
      keyword: {
        type: 'string',
        location: 'body',
        description: '키워드. 콤마(,)구분. 최하위 단계 분류에서만 설정 가능',
      },
    },
    responseShape: 'single',
  },
  {
    id: 'post-category-create',
    description:
      'cate1, cate2, cate3 의 빈 값인 경우 대분류가 생성됩니다. response 를 통해서 생성된 분류 코드가 출력됩니다.',
    scopeType: 'write',
    method: 'POST',
    path: 'category/create',
    requiredFields: ['category_name'],
    fields: {
      cate1: {
        type: 'string',
        location: 'body',
        description: '대분류. cate1 입력 시 중분류 생성',
      },
      cate2: {
        type: 'string',
        location: 'body',
        description: '중분류. cate1, cate2 입력 시 소분류 생성',
      },
      category_name: {
        type: 'string',
        location: 'body',
        description: '카테고리명',
      },
      mobile_category_name: {
        type: 'string',
        location: 'body',
        description: '모바일 카테고리 명',
      },
      use_sub_category: {
        type: 'string',
        location: 'body',
        description:
          '하위 분류 사용 여부 Y:하위 분류 생성 가능, N:하위 분류 생성 불가, 대분류 생성 시에만 적용됩니다.',
      },
      virtual: {
        type: 'string',
        location: 'body',
        description:
          '가상 분류 여부 Y:가상 분류, N:일반 분류, 대분류 생성 시에만 적용됩니다.',
      },
    },
    responseShape: 'single',
  },
  {
    id: 'post-plan-create',
    description:
      '기획전을 등록합니다. 기획전 번호( plan_id )는 요청 시 포함하지 않아야 하며, 서버에서 자동 생성됩니다. 기획전명,시작일, 종료일, 하위분류 여부는 반드시 입력해야 합니다. 하위 분류 상품진열 설정이 Y일 경우, 하위분류는 필수입니다. 하위 분류 상품진열 설정 설정하신 이후에는 변경하실 수 없습니다.',
    scopeType: 'write',
    method: 'POST',
    path: 'plan/create',
    requiredFields: [
      'plan_title',
      'plan_date_start',
      'plan_date_end',
      'plan_use_category',
    ],
    fields: {
      plan_title: {
        type: 'string',
        location: 'body',
        description: '기획전 명',
      },
      design_id: {
        type: 'string',
        location: 'body',
        description: '디자인 선택(PC). 기획전 디자인번호',
      },
      mobile_design_id: {
        type: 'string',
        location: 'body',
        description: '디자인 선택(MO). 기획전 디자인번호',
      },
      plan_date_start: {
        type: 'string',
        location: 'body',
        description: '기획전 시작일. YYYY-MM-DD 형식',
      },
      plan_date_end: {
        type: 'string',
        location: 'body',
        description: '기획전 종료일. YYYY-MM-DD 형식',
      },
      plan_expired_access: {
        type: 'string',
        location: 'body',
        description: '종료 후 노출여부. Y: 노출(기본값), N:노출안함',
      },
      plan_title_type: {
        type: 'string',
        location: 'body',
        description:
          '타이틀 이미지(PC). NONE : 사용안함(기본값), IMG : 이미지등록, HTML : HTML등록',
      },
      plan_title_image: {
        type: 'string',
        location: 'body',
        description:
          '타이틀 이미지 이미지등록. url/확장자 jpg, gif 포함/1M 이하. (plan_title_type : IMG)',
      },
      plan_title_html: {
        type: 'string',
        location: 'body',
        description: '타이틀 HTML등록 (plan_title_type : HTML)',
      },
      plan_mobile_title_type: {
        type: 'string',
        location: 'body',
        description:
          '타이틀 이미지(MO). NONE : 사용안함(기본값), IMG : 이미지등록, HTML : HTML등록',
      },
      plan_mobile_title_html: {
        type: 'string',
        location: 'body',
        description: '타이틀 HTML등록 (plan_mobile_title_type : HTML)',
      },
      plan_mobile_title_image: {
        type: 'string',
        location: 'body',
        description:
          '타이틀 이미지 이미지등록. url/확장자 jpg, gif 포함/1M 이하. (plan_mobile_title_type : IMG)',
      },
      plan_soldout: {
        type: 'string',
        location: 'body',
        description:
          '품절 상품 표시. VIEW : 노출(기본값), HIDDEN : 노출안함, BACK : 뒤로 보냄',
      },
      plan_sort: {
        type: 'string',
        location: 'body',
        description: '상품 정렬 설정. 1 : 등록순, 2 : 인기순',
      },
      plan_use_category: {
        type: 'string',
        location: 'body',
        description: '하위분류 사용 설정. N : 사용안함(기본값), Y : 사용',
      },
      plan_page_type: {
        type: 'string',
        location: 'body',
        description:
          '하위분류 상품진열 설정. ALL: 페이지 통합 진열, CATE : 페이지 분리 진열',
      },
      plan_mobile_select_category: {
        type: 'string',
        location: 'body',
        description:
          '모바일 기본화면상품 진열 설정. 0: 전체 상품 진열, 1: 첫번째 하위분류 상품 진열',
      },
      plan_category_text: {
        type: 'array',
        location: 'body',
        description:
          '하위분류 등록. plan_use_category:Y. Array(키값은 1부터 시작) plan_category_text[1]=‘하위분류1’,plan_category_text[2]=‘하위분류2’',
      },
      plan_uids: {
        type: 'array',
        location: 'body',
        description:
          '상품 리스트 설정. 콤마(,)구분. plan_uids[1] = 1148,1140, plan_uids[2] = 11487,11221',
      },
    },
    responseShape: 'single',
  },
  {
    id: 'post-plan-delete',
    description:
      '기획전을 삭제합니다. 삭제하려는 기획전 번호(plan_id) 는 반드시 존재해야 합니다. 삭제된 기획전은 복구할 수 없습니다.',
    scopeType: 'write',
    method: 'POST',
    path: 'plan/delete',
    requiredFields: ['plan_id'],
    fields: {
      plan_id: { type: 'string', location: 'body' },
    },
    responseShape: 'single',
  },
  {
    id: 'post-plan-update',
    description:
      '기획전을 수정합니다. 수정하려는 기획전 번호(plan_id)는 반드시 존재해야 합니다. plan_use_category는 등록 시에만 설정 가능하며, 설정 후에는 변경할 수 없습니다.',
    scopeType: 'write',
    method: 'POST',
    path: 'plan/update',
    requiredFields: ['plan_id', 'plan_date_start', 'plan_date_end'],
    fields: {
      plan_id: { type: 'string', location: 'body', description: '기획전 번호' },
      plan_title: {
        type: 'string',
        location: 'body',
        description: '기획전 명',
      },
      design_id: {
        type: 'string',
        location: 'body',
        description: '디자인 선택(PC). 기획전 디자인번호',
      },
      mobile_design_id: {
        type: 'string',
        location: 'body',
        description: '디자인 선택(MO). 기획전 디자인번호',
      },
      plan_date_start: {
        type: 'string',
        location: 'body',
        description: '기획전 시작일. YYYY-MM-DD 형식',
      },
      plan_date_end: {
        type: 'string',
        location: 'body',
        description: '기획전 종료일. YYYY-MM-DD 형식',
      },
      plan_expired_access: {
        type: 'string',
        location: 'body',
        description: '종료 후 노출여부. Y: 노출(기본값), N:노출안함',
      },
      plan_title_type: {
        type: 'string',
        location: 'body',
        description:
          '타이틀 이미지(PC). NONE : 사용안함(기본값), IMG : 이미지등록, HTML : HTML등록',
      },
      plan_title_image: {
        type: 'string',
        location: 'body',
        description:
          '타이틀 이미지 이미지등록. url/확장자 jpg, gif 포함/1M 이하. (plan_title_type : IMG)',
      },
      plan_title_html: {
        type: 'string',
        location: 'body',
        description: '타이틀 HTML등록 (plan_title_type : HTML)',
      },
      plan_mobile_title_type: {
        type: 'string',
        location: 'body',
        description:
          '타이틀 이미지(MO). NONE : 사용안함(기본값), IMG : 이미지등록, HTML : HTML등록',
      },
      plan_mobile_title_html: {
        type: 'string',
        location: 'body',
        description: '타이틀 HTML등록 (plan_mobile_title_type : HTML)',
      },
      plan_mobile_title_image: {
        type: 'string',
        location: 'body',
        description:
          '타이틀 이미지 이미지등록. url/확장자 jpg, gif 포함/1M 이하. (plan_mobile_title_type : IMG)',
      },
      plan_soldout: {
        type: 'string',
        location: 'body',
        description:
          '품절 상품 표시. VIEW : 노출(기본값), HIDDEN : 노출안함, BACK : 뒤로 보냄',
      },
      plan_sort: {
        type: 'string',
        location: 'body',
        description: '상품 정렬 설정. 1 : 등록순, 2 : 인기순',
      },
      plan_page_type: {
        type: 'string',
        location: 'body',
        description:
          '하위분류 상품진열 설정. ALL: 페이지 통합 진열, CATE : 페이지 분리 진열',
      },
      plan_mobile_select_category: {
        type: 'string',
        location: 'body',
        description:
          '모바일 기본화면상품 진열 설정. 0: 전체 상품 진열, 1: 첫번째 하위분류 상품 진열',
      },
      plan_category_text: {
        type: 'array',
        location: 'body',
        description:
          '하위분류 등록. plan_use_category:Y. plan_category_text[1]=‘하위분류1’,plan_category_text[2]=‘하위분류2’',
      },
      plan_uids: {
        type: 'array',
        location: 'body',
        description:
          '상품 리스트 설정. 콤마(,)구분. plan_uids[1] = 1148,1140, plan_uids[2] = 11487,11221',
      },
    },
    responseShape: 'single',
  },
  {
    id: 'post-product-create',
    description:
      '상품을 등록합니다. 1회에 하나의 상품만 등록 가능합니다. Beta 버전으로 수정이 될 수 있습니다. 통합옵션 상점만 이용 가능합니다. ※ 조합 옵션 생성 주의 사항 1. options 배열에 색상, 사이즈를 배열로 생성 2. opt_values 에 색상, 사이즈에 대한 값을 등록 (콤마로 구분함) 3. opt_price 에 가격에 대한 값을 등록 4. stocks 배열에 조합된 값을 등록 5. stocks 배열 순서는 options 배열 순서를 기준 [0] 레드, S [1] 레드, M [2] 레드, L [3] 블루, S ... 옵션 전송 가이드 : https://openapi.makeshop.co.kr/guide/option notice_type(싱품분류), notice_contents(상품일반정보) 항목은 지원 종료되었습니다.',
    scopeType: 'write',
    method: 'POST',
    path: 'product/create',
    requiredFields: ['product_name', 'sellprice'],
    fields: {
      product_name: {
        type: 'string',
        location: 'body',
        description: '상품명 (글자 수 제한 : 250)',
      },
      sellprice: { type: 'string', location: 'body', description: '판매가' },
      mobile_product_name: {
        type: 'string',
        location: 'body',
        description: '모바일 상품명 (글자 수 제한 : 250)',
      },
      eng_name: {
        type: 'string',
        location: 'body',
        description: '영문 상품명 (글자 수 제한 : 250)',
      },
      dicker: { type: 'string', location: 'body', description: '대체 문구' },
      subtitle: {
        type: 'string',
        location: 'body',
        description: '추가 상품명',
      },
      supply_product_name: {
        type: 'string',
        location: 'body',
        description: '사입/도매업체 상품명',
      },
      production: { type: 'string', location: 'body', description: '제조사' },
      origin: { type: 'string', location: 'body', description: '원산지' },
      brname: { type: 'string', location: 'body', description: '브랜드' },
      model: { type: 'string', location: 'body', description: '모델명' },
      uniqueness: {
        type: 'string',
        location: 'body',
        description: '상품 특이사항',
      },
      warning_info: {
        type: 'string',
        location: 'body',
        description: '상품 유의사항',
      },
      cate1: {
        type: 'string',
        location: 'body',
        description: '카테고리 대 (000 ~ 999)',
      },
      cate2: {
        type: 'string',
        location: 'body',
        description: '카테고리 중 (000 ~ 999)',
      },
      cate3: {
        type: 'string',
        location: 'body',
        description: '카테고리 소 (000 ~ 999)',
      },
      keyword: { type: 'string', location: 'body', description: '상품 검색어' },
      np_condition: {
        type: 'string',
        location: 'body',
        description:
          '상품 상태 new : 신상품, used : 중고, return : 반품, refurbished : 리퍼, display : 전시, scratch : 스크래치',
      },
      sell_accept: {
        type: 'string',
        location: 'body',
        description: '판매 가능 여부 (Y, N)',
      },
      display: {
        type: 'string',
        location: 'body',
        description: '상품 노출 여부 (Y, N)',
      },
      bank_only: {
        type: 'string',
        location: 'body',
        description: '현금 전용 (Y, N)',
      },
      best_product_display: {
        type: 'string',
        location: 'body',
        description: '베스트 상품 노출 여부 (Y, N)',
      },
      best_review_display: {
        type: 'string',
        location: 'body',
        description: '베스트 리뷰 노출 여부 (Y, N)',
      },
      vat: {
        type: 'string',
        location: 'body',
        description:
          '부가세 설정 (N : 부가세 상품, Y : 면세 상품, Z : 영세율 상품)',
      },
      consumerprice: {
        type: 'string',
        location: 'body',
        description: '소비자가',
      },
      buyprice: { type: 'string', location: 'body', description: '공급가' },
      reserve: {
        type: 'string',
        location: 'body',
        description:
          '적립금 % 입력시 해당 비율 만큼 입력, 단순 숫자만 입력시 원',
      },
      mobile_reserve: {
        type: 'string',
        location: 'body',
        description:
          '모바일 적립금 % 입력시 해당 비율 만큼 입력, 단순 숫자만 입력시 원',
      },
      point: {
        type: 'string',
        location: 'body',
        description: '포인트 % 입력시 해당 비율 만큼 , 단순 숫자만 입력시 원',
      },
      quantity: {
        type: 'string',
        location: 'body',
        description: '재고 미입력시 무제한, 0 : 품절, 0보다 큰 경우 재고',
      },
      min_quantity: {
        type: 'string',
        location: 'body',
        description: '구매 최소 수량',
      },
      max_quantity: {
        type: 'string',
        location: 'body',
        description: '구매 최대 수량',
      },
      provider_code: {
        type: 'string',
        location: 'body',
        description: '공급사 코드',
      },
      provider_commission: {
        type: 'string',
        location: 'body',
        description:
          '공급사 수수료 설정 -1 : 기본 지정 수수료, 0~100까지 공급사 수수료',
      },
      provider_burden: {
        type: 'string',
        location: 'body',
        description:
          '공급사 상품 할인 부담. PROVDIER : 공급사 부담(개별 설정), SHOP : 본사 부담(개별 설정), DEFAULT : 본사 부담(기본 설정)',
      },
      opendate: {
        type: 'string',
        location: 'body',
        description: '출시일. yyyy-mm-dd',
      },
      notice_type: {
        type: 'string',
        location: 'body',
        description: '상품분류 (지원 종료)',
      },
      notice_contents: {
        type: 'array',
        location: 'body',
        description: '상품 일반정보 (지원 종료)',
      },
      product_info_types: {
        type: 'array',
        location: 'body',
        description:
          '상품 일반 정보 notice_id (상품 일반 공시 조회에서 해당하는 notice_id key값이 0일 경우 생성)',
      },
      product_info_names: {
        type: 'array',
        location: 'body',
        description:
          '상품명 product_info_types 이 있는 경우 상품명은 필수로 입력해야합니다. 등록/수정하시려는 product_info_types 키값과 같아야합니다. key값이 0일 경우 생성',
      },
      product_info_items: {
        type: 'array',
        location: 'body',
        description:
          "상품 일반 정보 항목 등록/수정하시려는 product_info_types 키값과 같아야합니다. 사용자 생성인 경우 product_info_items 빈값으로 전송 product_info_types[1] = 'C1'",
      },
      delete_product_notices: {
        type: 'array',
        location: 'body',
        description:
          '상품 일반 정보 삭제 id 상품조회를 통해 product_info_notices[].id 값을 통해 해당 항목 삭제',
      },
      maximage: {
        type: 'string',
        location: 'body',
        description: '확대이미지 (url,확장자 jpg,png,gif 포함,500kb 이하)',
      },
      minimage: {
        type: 'string',
        location: 'body',
        description: '상세이미지 (url,확장자 jpg,png,gif 포함,500kb 이하)',
      },
      tinyimage: {
        type: 'string',
        location: 'body',
        description:
          '리스트/메인이미지 (url,확장자 jpg,png,gif 포함,500kb 이하)',
      },
      mobile_image: {
        type: 'string',
        location: 'body',
        description: '모바일이미지 (url,확장자 jpg,png,gif 포함,500kb 이하)',
      },
      multi_image: {
        type: 'array',
        location: 'body',
        description:
          '멀티이미지 (url,확장자 jpg,png,gif 포함, 다중 이미지를 포함하는 경우 콤마(,)로 구분 최대 10개)',
      },
      rollover_image: {
        type: 'string',
        location: 'body',
        description:
          '롤오버 설정 활성화시 사용가능. url,확장자 jpg,png,gif 포함,500kb 이하',
      },
      mobile_photo_gallery: {
        type: 'array',
        location: 'body',
        description:
          '모바일 포토 갤러리 url. 확장자 jpg,png,gif 포함 mobile_photo_gallery[0]=url mobile_photo_gallery[1]=url',
      },
      use_imagebank: {
        type: 'string',
        location: 'body',
        description: '이미지뱅크 서버 전송 (Y, N)',
      },
      product_content: {
        type: 'string',
        location: 'body',
        description: '상품상세정보',
      },
      product_m_content: {
        type: 'string',
        location: 'body',
        description: '모바일 상품상세정보',
      },
      admin_memo: {
        type: 'string',
        location: 'body',
        description: '관리자 메모',
      },
      virtual_category: {
        type: 'string',
        location: 'body',
        description:
          '가상 카테고리 가상 카테고리 [대중소] 값을 포함 하여 전달 ex)003052009 콤마(,) 구분자를 통해 다중 등록 가능',
      },
      main_display_pc: {
        type: 'string',
        location: 'body',
        description:
          '메인 노출 [PC] 메인 노출 코드 입력[상점 정보 조회를 통해 코드값 조회 콤마(,) 구분자를 통해 다중 등록 가능 단, (구)메인상품 상품 진열 관리 사용 상점은 미지원',
      },
      main_display_mobile: {
        type: 'string',
        location: 'body',
        description:
          '메인 노출 [모바일] 메인 노출 코드 입력[상점 정보 조회를 통해 코드값 조회 콤마(,) 구분자를 통해 다중 등록 가능 단, (구)메인상품 상품 진열 관리 사용 상점은 미지원',
      },
      importune: {
        type: 'string',
        location: 'body',
        description: '조르기 설정 (Y : 사용, N : 사용 안함)',
      },
      soldout: {
        type: 'string',
        location: 'body',
        description:
          '일시 품절 설정 N : 사용안함, SHORT : 일시품절, SMS : 일시품절 + 상품 재입고 알림 기능',
      },
      pc_icon: {
        type: 'string',
        location: 'body',
        description:
          'PC 아이콘. 아이콘 조회를 통해 아이콘 id 값 조회 콤마(,) 를 통해 다중 선택',
      },
      pc_user_icon: {
        type: 'string',
        location: 'body',
        description:
          'pc 사용자 추가 아이콘 아이콘 조회를 통해 custom = Y 인 아이콘 id 값 조회 콤마(,) 를 통해 다중 선택',
      },
      pc_icon_time: {
        type: 'string',
        location: 'body',
        description: 'pc 아이콘 기간 설정 (Y : 기간 노출, N : 지속적인 노출)',
      },
      pc_icon_start_date: {
        type: 'string',
        location: 'body',
        description:
          'pc 아이콘 노출 시작일 (0000-00-00 00:00, 초는 포함하지 않음)',
      },
      pc_icon_end_date: {
        type: 'string',
        location: 'body',
        description:
          'pc 아이콘 노출 종료일 (0000-00-00 00:00, 초는 포함하지 않음)',
      },
      mobile_icon: {
        type: 'string',
        location: 'body',
        description:
          '모바일 아이콘 아이콘 조회를 통해 아이콘 id 값 조회 콤마(,) 를 통해 다중 선택',
      },
      mobile_user_icon: {
        type: 'string',
        location: 'body',
        description:
          '모바일 사용자 추가 아이콘 아이콘 조회를 통해 custom = Y 인 아이콘 id 값 조회 콤마(,) 를 통해 다중 선택',
      },
      mobile_icon_time: {
        type: 'string',
        location: 'body',
        description:
          '모바일 아이콘 기간 설정 (Y : 기간 노출, N : 지속적인 노출)',
      },
      mobile_icon_start_date: {
        type: 'string',
        location: 'body',
        description:
          '모바일 아이콘 노출 시작일 (0000-00-00 00:00, 초는 포함하지 않음)',
      },
      mobile_icon_end_date: {
        type: 'string',
        location: 'body',
        description:
          '모바일 아이콘 노출 종료일 (0000-00-00 00:00, 초는 포함하지 않음)',
      },
      match_category: {
        type: 'string',
        location: 'body',
        description: '매칭카테고리',
      },
      discount_uid_ALL: {
        type: 'string',
        location: 'body',
        description:
          '전체 기간할인 전체 상품(PC, 모바일)에 적용되는 기간할인 ID를 콤마(,)로 구분하여 입력합니다.',
      },
      discount_uid_MOBILE: {
        type: 'string',
        location: 'body',
        description:
          '모바일 기간할인 모바일 상품에 적용되는 기간할인 ID를 콤마(,)로 구분하여 입력합니다.',
      },
      discount_uid_PC: {
        type: 'string',
        location: 'body',
        description:
          '웹 기간할인 웹 상품에 적용되는 기간할인 ID를 콤마(,)로 구분하여 입력합니다.',
      },
      discount_promotion_uid: {
        type: 'string',
        location: 'body',
        description:
          '대량 구매 할인 상품에 적용되는 대량 구매 할인 ID 입력합니다.',
      },
      option_display_type: {
        type: 'string',
        location: 'body',
        description:
          '옵션 출력 방식 EACH : 일체형, EVERY : 분리형 opt_mix값이 Y 일 때 stocks의 출력방식 일괄적용',
      },
      basic_option_stock_use: {
        type: 'string',
        location: 'body',
        description:
          '옵션 재고 관리 Y : 재고 사용 안함, N : 재고 사용 sto_type값이 BASIC인 항목에 일괄적용 opt_mix값이 Y 일 때 stocks 항목 중 sto_stop_stock, sto_stop_use 사용안',
      },
      addition_option_stock_use: {
        type: 'string',
        location: 'body',
        description:
          '개별 옵션 재고 관리 Y : 재고 사용 안함, N : 재고 사용 sto_type값이 ADDITION인 항목에 일괄적용 opt_mix값이 Y 일 때 stocks 항목 중 sto_stop_stock, sto_stop_u',
      },
      add_info: {
        type: 'array',
        location: 'body',
        description:
          '상품 추가정보 ex)add_info[0][name]=옵션명 add_info[0][value]=옵션값 add_info[1][name]=옵션명 add_info[1][value]=옵션값',
      },
      today_delivery: {
        type: 'string',
        location: 'body',
        description: '오늘 출발 설정 (Y : 사용, N : 사용 안함)',
      },
      options: { type: 'array', location: 'body', description: '옵션 정보' },
      stocks: {
        type: 'array',
        location: 'body',
        description: '옵션 조합 정보',
      },
      style_code: {
        type: 'string',
        location: 'body',
        description:
          '스타일 코드 최대 30자 (영문 / 숫자 / 하이픈(-) / 언더바(_)만 사용 가능)',
      },
      change_consent_action: {
        type: 'string',
        location: 'body',
        description:
          '게시글 변경 동의 Y, N(스타일 코드 등록/수정 시, 반드시 Y값 필요)',
      },
      weight: { type: 'string', location: 'body', description: '상품무게' },
      freedeli: {
        type: 'string',
        location: 'body',
        description:
          '개별 배송비 N : 기본 배송비, F : 고정추가 배송비, P : 비례추가 배송비, M : 조건 배송비, Y : 단품무료 배송비, A : 전체무료 배송비',
      },
      fd_onlyuser: {
        type: 'string',
        location: 'body',
        description:
          '무료 배송비 적용 - 회원 Y : 단품무료 배송비 - 회원 A : 전체무료 배송비 - 회원',
      },
      basic_delivery: {
        type: 'string',
        location: 'body',
        description: '비례 배송비 시작가 (freedeli가 P일 때 필수)',
      },
      add_delivery: {
        type: 'string',
        location: 'body',
        description: '비례 배송비 추가가 (freedeli가 P일 때 필수)',
      },
      basic_dan: {
        type: 'string',
        location: 'body',
        description: '비례 배송비 증가 단위 (freedeli가 P일 때 필수)',
      },
      smartpickup: {
        type: 'string',
        location: 'body',
        description: '스마트 픽업 (Y : 사용, N : 사용 안함)',
      },
    },
    responseShape: 'single',
  },
  {
    id: 'post-product-delete',
    description:
      '삭제 상품에 등록된 상품을 완전 삭제합니다. 완전 삭제할 경우 복구가 불가능합니다. 통합옵션 상점만 이용 가능합니다.',
    scopeType: 'write',
    method: 'POST',
    path: 'product/delete',
    requiredFields: ['datas'],
    fields: {
      datas: { type: 'array', location: 'body', description: '전송 정보' },
    },
    responseShape: 'single',
  },
  {
    id: 'post-product-delete_temp',
    description:
      '상품을 삭제합니다. 삭제된 상품은 삭제 상품에 저장됩니다. 완전 삭제할 경우 [상품 완전 삭제]를 추가적으로 진행해야합니다. 통합옵션 상점만 이용 가능합니다.',
    scopeType: 'write',
    method: 'POST',
    path: 'product/delete_temp',
    requiredFields: ['datas'],
    fields: {
      datas: { type: 'array', location: 'body', description: '전송 정보' },
    },
    responseShape: 'single',
  },
  {
    id: 'post-product-stock',
    description:
      '상품의 재고를 변경합니다. 1회에 최대 500개까지 변경이 가능합니다. 수량 변경으로 인해 상품 재고상태가 품절, 판매 상태로 변경될 수 있습니다. 재고 수량을 0으로 변경 시 품절상태로 변경됩니다. 통합옵션 상점만 이용 가능합니다.',
    scopeType: 'write',
    method: 'POST',
    path: 'product/stock',
    requiredFields: ['datas'],
    fields: {
      datas: { type: 'array', location: 'body', description: '전송 정보' },
    },
    responseShape: 'single',
  },
  {
    id: 'post-product-update',
    description:
      '등록된 상품 정보를 수정합니다. 옵션 수정은 불가능 하며, 옵션이 없는 경우 상품 등록과 같이 옵션을 추가 할 수 있습니다. 옵션의 경우 등록된 옵션을 option_use =N 으로 초기화 시킵니다. 1회에 하나의 상품만 수정 가능합니다. 상품 수량은 옵션이 존재하는 경우 품절처리만 가능합니다 상품 옵션 개별 수량 수정은 재고 수정 API를 이용해야 합니다. 통합옵션 상점만 이용 가능합니다. Beta 버전으로 수정이 될 수 있습니다.',
    scopeType: 'write',
    method: 'POST',
    path: 'product/update',
    requiredFields: ['product_id'],
    fields: {
      product_id: {
        type: 'string',
        location: 'body',
        description: '상품 번호',
      },
      product_name: {
        type: 'string',
        location: 'body',
        description: '상품명 (250Byte)',
      },
      sellprice: { type: 'string', location: 'body', description: '판매가' },
      mobile_product_name: {
        type: 'string',
        location: 'body',
        description: '모바일 상품명',
      },
      eng_name: {
        type: 'string',
        location: 'body',
        description: '영문 상품명',
      },
      dicker: { type: 'string', location: 'body', description: '대체 문구' },
      subtitle: {
        type: 'string',
        location: 'body',
        description: '추가 상품명',
      },
      supply_product_name: {
        type: 'string',
        location: 'body',
        description: '사입/도매업체 상품명',
      },
      production: { type: 'string', location: 'body', description: '제조사' },
      origin: { type: 'string', location: 'body', description: '원산지' },
      brname: { type: 'string', location: 'body', description: '브랜드' },
      model: { type: 'string', location: 'body', description: '모델명' },
      uniqueness: {
        type: 'string',
        location: 'body',
        description: '상품 특이사항',
      },
      warning_info: {
        type: 'string',
        location: 'body',
        description: '상품 유의사항',
      },
      cate1: {
        type: 'string',
        location: 'body',
        description: '카테고리 대 (000 ~ 999)',
      },
      cate2: {
        type: 'string',
        location: 'body',
        description: '카테고리 중 (000 ~ 999)',
      },
      cate3: {
        type: 'string',
        location: 'body',
        description: '카테고리 소 (000 ~ 999)',
      },
      keyword: { type: 'string', location: 'body', description: '상품 검색어' },
      np_condition: {
        type: 'string',
        location: 'body',
        description:
          '상품 상태 new : 신상품, used : 중고, return : 반품, refurbished : 리퍼, display : 전시, scratch : 스크래치',
      },
      sell_accept: {
        type: 'string',
        location: 'body',
        description: '판매 가능 여부 (Y, N)',
      },
      display: {
        type: 'string',
        location: 'body',
        description: '상품 노출 여부 (Y, N)',
      },
      bank_only: {
        type: 'string',
        location: 'body',
        description: '현금 전용 (Y, N)',
      },
      best_product_display: {
        type: 'string',
        location: 'body',
        description: '베스트 상품 노출 여부 (Y, N)',
      },
      best_review_display: {
        type: 'string',
        location: 'body',
        description: '베스트 리뷰 노출 여부 (Y, N)',
      },
      consumerprice: {
        type: 'string',
        location: 'body',
        description: '소비자가',
      },
      buyprice: { type: 'string', location: 'body', description: '공급가' },
      reserve: {
        type: 'string',
        location: 'body',
        description:
          '적립금 (% 입력시 해당 비율 만큼 입력, 단순 숫자만 입력시 원)',
      },
      mobile_reserve: {
        type: 'string',
        location: 'body',
        description:
          '모바일 적립금 (% 입력시 해당 비율 만큼 입력, 단순 숫자만 입력시 원)',
      },
      point: {
        type: 'string',
        location: 'body',
        description: '포인트 (% 입력시 해당 비율 만큼 , 단순 숫자만 입력시 원)',
      },
      quantity: {
        type: 'string',
        location: 'body',
        description:
          '재고 unlimited : 무제한, 0 : 품절, 0보다 큰 경우 재고, 옵션이 존재하는 경우 품철 처리만 가능하며,옵션 전체 품절 처리',
      },
      min_quantity: {
        type: 'string',
        location: 'body',
        description: '구매 최대 수량',
      },
      provider_code: {
        type: 'string',
        location: 'body',
        description: '공급사 코드',
      },
      provider_commission: {
        type: 'string',
        location: 'body',
        description:
          '공급사 수수료 설정 (-1 : 기본 지정 수수료, 0~100까지 공급사 수수료)',
      },
      provider_burden: {
        type: 'string',
        location: 'body',
        description:
          '공급사 상품 할인 부담 PROVDIER : 공급사 부담(개별 설정), SHOP : 본사 부담(개별 설정), DEFAULT : 본사 부담(기본 설정)',
      },
      opendate: {
        type: 'string',
        location: 'body',
        description: '출시일 (yyyy-mm-dd)',
      },
      product_content: {
        type: 'string',
        location: 'body',
        description: '상품상세정보',
      },
      product_m_content: {
        type: 'string',
        location: 'body',
        description: '모바일 상품상세정보',
      },
      admin_memo: {
        type: 'string',
        location: 'body',
        description: '관리자 메모',
      },
      notice_type: {
        type: 'string',
        location: 'body',
        description:
          '상품분류 1 : 의류, 2 : 구두/신발, 3 : 가방, 4 : 패션잡화(모자/벨트/엑세서리), 5 : 침구류/커튼, 6 : 가구(침대/소파/싱크대/DIY제품), 7 : 영상가전(TV류), 8 : 가정용 전기제품(냉',
      },
      notice_contents: {
        type: 'array',
        location: 'body',
        description:
          '상품 일반정보 (notice_contents[]=모델명, notice_contents[]=정보)',
      },
      product_info_types: {
        type: 'array',
        location: 'body',
        description:
          '상품 일반 정보 notice_id 상품 일반 공시 조회에서 해당하는 notice_id. key값이 0일 경우 생성',
      },
      product_info_names: {
        type: 'array',
        location: 'body',
        description:
          '상품명 product_info_types 이 있는 경우 상품명은 필수로 입력해야합니다. 등록/수정하시려는 product_info_types 키값과 같아야합니다. key값이 0일 경우 생성',
      },
      product_info_items: {
        type: 'array',
        location: 'body',
        description:
          "상품 일반 정보 항목 등록/수정하시려는 product_info_types 키값과 같아야합니다. 사용자 생성인 경우 product_info_items 빈값으로 전송 product_info_types[1] = 'C1'",
      },
      delete_product_notices: {
        type: 'array',
        location: 'body',
        description:
          '상품 일반 정보 삭제 id 상품조회를 통해 product_info_notices[].id 값을 통해 해당 항목 삭제',
      },
      maximage: {
        type: 'string',
        location: 'body',
        description: '확대이미지url 확장자 jpg,png,gif 포함,500kb 이하',
      },
      minimage: {
        type: 'string',
        location: 'body',
        description: '상세이미지url 확장자 jpg,png,gif 포함,500kb 이하',
      },
      tinyimage: {
        type: 'string',
        location: 'body',
        description: '리스트/메인이미지url 확장자 jpg,png,gif 포함,500kb 이하',
      },
      mobile_image: {
        type: 'string',
        location: 'body',
        description: '모바일이미지url 확장자 jpg,png,gif 포함,500kb 이하',
      },
      multi_image: {
        type: 'string',
        location: 'body',
        description:
          '멀티이미지url 확장자 jpg,png,gif 포함, 다중 이미지를 포함하는 경우 콤마(,)로 구분 최대 10개',
      },
      rollover_image: {
        type: 'string',
        location: 'body',
        description:
          '롤오버이미지. 롤오버 설정 활성화시 사용가능. url,확장자 jpg,png,gif 포함,500kb 이하',
      },
      mobile_photo_gallery: {
        type: 'array',
        location: 'body',
        description:
          '모바일url 확장자 jpg,png,gif 포함 mobile_photo_gallery[0]=url mobile_photo_gallery[1]=url',
      },
      virtual_category: {
        type: 'string',
        location: 'body',
        description:
          '가상 카테고리 가상 카테고리 [대중소] 값을 포함 하여 전달 ex)003052009 콤마(,) 구분자를 통해 다중 등록 가능',
      },
      main_display_pc: {
        type: 'string',
        location: 'body',
        description:
          '메인 노출 [PC] 메인 노출 코드 입력[상점 정보 조회를 통해 코드값 조회] 콤마(,) 구분자를 통해 다중 등록 가능',
      },
      main_display_mobile: {
        type: 'string',
        location: 'body',
        description:
          '메인 노출 [모바일] 메인 노출 코드 입력[상점 정보 조회를 통해 코드값 조회] 콤마(,) 구분자를 통해 다중 등록 가능 단, (구)메인상품 상품 진열 관리 사용 상점은 미지원',
      },
      importune: {
        type: 'string',
        location: 'body',
        description: '조르기 설정 (Y : 사용, N : 사용 안함)',
      },
      soldout: {
        type: 'string',
        location: 'body',
        description:
          '일시 품절 설정 (N : 사용안함 SHORT : 일시품절, SMS : 일시품절 + 상품 재입고 알림 기능)',
      },
      pc_icon: {
        type: 'string',
        location: 'body',
        description:
          'PC 아이콘 아이콘 조회를 통해 아이콘 id 값 조회. 콤마(,) 구분자를 통해 다중 선택',
      },
      pc_user_icon: {
        type: 'string',
        location: 'body',
        description:
          'pc 사용자 추가 아이콘 아이콘 조회를 통해 custom = Y 인 아이콘 id 값 조회. 콤마(,) 구분자를 통해 다중 선택',
      },
      pc_icon_time: {
        type: 'string',
        location: 'body',
        description: 'pc 아이콘 기간 설정 (Y : 기간 노출, N : 지속적인 노출)',
      },
      pc_icon_start_date: {
        type: 'string',
        location: 'body',
        description:
          'pc 아이콘 노출 시작일 (0000-00-00 00:00, 초는 포함하지 않음)',
      },
      pc_icon_end_date: {
        type: 'string',
        location: 'body',
        description:
          'pc 아이콘 노출 종료일 (0000-00-00 00:00, 초는 포함하지 않음)',
      },
      mobile_icon: {
        type: 'string',
        location: 'body',
        description:
          '모바일 아이콘 아이콘 조회를 통해 아이콘 id 값 조회. 콤마(,) 구분자를 통해 다중 선택',
      },
      mobile_user_icon: {
        type: 'string',
        location: 'body',
        description:
          '모바일 사용자 추가 아이콘 아이콘 조회를 통해 custom = Y 인 아이콘 id 값 조회. 콤마(,) 구분자를 통해 다중 선택',
      },
      mobile_icon_time: {
        type: 'string',
        location: 'body',
        description:
          '모바일 아이콘 기간 설정 (Y : 기간 노출, N : 지속적인 노출)',
      },
      mobile_icon_start_date: {
        type: 'string',
        location: 'body',
        description:
          '모바일 아이콘 노출 시작일 (0000-00-00 00:00, 초는 포함하지 않음)',
      },
      mobile_icon_end_date: {
        type: 'string',
        location: 'body',
        description:
          '모바일 아이콘 노출 종료일 (0000-00-00 00:00, 초는 포함하지 않음)',
      },
      match_category: {
        type: 'string',
        location: 'body',
        description: '매칭카테고리',
      },
      discount_uid_ALL: {
        type: 'string',
        location: 'body',
        description:
          '전체 기간할인 전체 상품(PC, 모바일)에 적용되는 기간할인 ID를 콤마(,)로 구분하여 입력합니다.특정 기간할인을 제거하려면 값을 비워서 전송합니다.',
      },
      discount_uid_MOBILE: {
        type: 'string',
        location: 'body',
        description:
          '모바일 기간할인 모바일 상품에 적용되는 기간할인 ID를 콤마(,)로 구분하여 입력합니다. 특정 기간할인을 제거하려면 값을 비워서 전송합니다.',
      },
      discount_uid_PC: {
        type: 'string',
        location: 'body',
        description:
          '웹 기간할인 웹 상품에 적용되는 기간할인 ID를 콤마(,)로 구분하여 입력합니다. 특정 기간할인을 제거하려면 값을 비워서 전송합니다.',
      },
      discount_promotion_uid: {
        type: 'string',
        location: 'body',
        description:
          '대량 구매 할인 상품에 적용되는 대구매 할인 ID를 입력합니다. 특정 기간할인을 제거하려면 값을 비워서 전송합니다.',
      },
      add_info: {
        type: 'string',
        location: 'body',
        description:
          '상품 추가정보 add_info[0][name]=옵션명, add_info[0][value]=옵션값, add_info[1][name]=옵션명, add_info[1][value]=옵션값',
      },
      today_delivery: {
        type: 'string',
        location: 'body',
        description: '오늘 출발 설정 (Y : 사용, N : 사용 안함)',
      },
      option_use: {
        type: 'string',
        location: 'body',
        description:
          '옵션 사용 여부 (Y : 사용, N : 사용 안함 (기존에 등록된 옵션정보가 초기화))',
      },
      addition_option_use: {
        type: 'string',
        location: 'body',
        description:
          '개별 옵션 사용 여부 (Y : 사용, N : 사용 안함 (기존에 등록된 개별 옵션정보가 초기화))',
      },
      option_display_type: {
        type: 'string',
        location: 'body',
        description:
          '옵션 출력 방식 option_use = Y 또는 addition_option_use = Y 인 경우 EACH : 일체형, EVERY : 분리형 opt_mix값이 Y 일 때 stocks의 출력방식 일괄적용',
      },
      basic_option_stock_use: {
        type: 'string',
        location: 'body',
        description:
          '옵션 재고 관리 option_use = Y 또는 addition_option_use = Y 인 경우 Y : 재고 사용 안함,N : 재고 사용 sto_type값이 BASIC인 항목에 일괄적용. opt_mix값이 Y 일',
      },
      addition_option_stock_use: {
        type: 'string',
        location: 'body',
        description:
          '개별 옵션 재고 관리 option_use = Y 또는 addition_option_use = Y 인 경우 Y : 재고 사용 안함,N : 재고 사용 sto_type값이 ADDITION인 항목에 일괄적용. opt_mix',
      },
      options: {
        type: 'array',
        location: 'body',
        description:
          '옵션 정보. option_use = Y 또는 addition_option_use = Y 인 경우',
      },
      stocks: {
        type: 'array',
        location: 'body',
        description: '옵션 조합 정보',
      },
      style_code: {
        type: 'string',
        location: 'body',
        description:
          '스타일 코드. 최대 30자 (영문/숫자/하이픈(-)/언더바(_)만 사용 가능)',
      },
      change_consent_action: {
        type: 'string',
        location: 'body',
        description:
          '게시글 변경 동의. Y, N(스타일 코드 등록/수정 시, 반드시 Y 값 필요)',
      },
      weight: { type: 'string', location: 'body', description: '상품무게' },
      freedeli: {
        type: 'string',
        location: 'body',
        description:
          '개별 배송비. N : 기본 배송비, F : 고정추가 배송비, P : 비례추가 배송비, M : 조건 배송비, Y : 단품무료 배송비, A : 전체무료 배송비',
      },
      fd_onlyuser: {
        type: 'string',
        location: 'body',
        description:
          '무료 배송비 적용 - 회원. Y : 단품무료 배송비 - 회원, A : 전체무료 배송비 - 회원',
      },
      basic_delivery: {
        type: 'string',
        location: 'body',
        description: '비례 배송비 시작가. freedeli가 P일 때 필수',
      },
      add_delivery: {
        type: 'string',
        location: 'body',
        description: '비례 배송비 추가가. freedeli가 P일 때 필수',
      },
      basic_dan: {
        type: 'string',
        location: 'body',
        description: '비례 배송비 증가 단위. freedeli가 P일 때 필수',
      },
      smartpickup: {
        type: 'string',
        location: 'body',
        description: '스마트 픽업. Y : 사용, N : 사용 안함',
      },
    },
    responseShape: 'single',
  },
  {
    id: 'post-product_display',
    description:
      '상품 진열을 변경합니다. 1회에 최대 50개 까지 처리가 가능합니다.',
    scopeType: 'write',
    method: 'POST',
    path: 'product_display',
    requiredFields: ['datas'],
    fields: {
      datas: { type: 'array', location: 'body', description: '처리 리스트' },
    },
    responseShape: 'single',
  },
  {
    id: 'post-product_seo-create',
    description: '상품에 검색엔진 최적화(SEO) 정보를 등록합니다.',
    scopeType: 'write',
    method: 'POST',
    path: 'product_seo/create',
    requiredFields: ['uid', 'enabled'],
    fields: {
      uid: { type: 'string', location: 'body', description: '상품 번호' },
      enabled: {
        type: 'string',
        location: 'body',
        description: '사용 여부 (Y : 사용함, N : 사용안함)',
      },
      title: { type: 'string', location: 'body', description: '제목' },
      description: { type: 'string', location: 'body', description: '설명' },
      keywords: { type: 'string', location: 'body', description: '검색어' },
      image_alt: {
        type: 'string',
        location: 'body',
        description: '이미지 alt',
      },
    },
    responseShape: 'single',
  },
  {
    id: 'post-product_seo-update',
    description: '상품에 검색엔진 최적화(SEO) 정보를 수정합니다.',
    scopeType: 'write',
    method: 'POST',
    path: 'product_seo/update',
    requiredFields: ['uid'],
    fields: {
      uid: { type: 'string', location: 'body', description: '상품 번호' },
      enabled: {
        type: 'string',
        location: 'body',
        description: '사용 여부 (Y : 사용함, N : 사용안함)',
      },
      title: { type: 'string', location: 'body', description: '제목' },
      description: { type: 'string', location: 'body', description: '설명' },
      keywords: { type: 'string', location: 'body', description: '검색어' },
      image_alt: {
        type: 'string',
        location: 'body',
        description: '이미지 alt',
      },
    },
    responseShape: 'single',
  },
  {
    id: 'post-provider-create',
    description:
      '공급자를 등록합니다. 공급자 등록 시, 배송 정책 및 권한은 기본 설정값으로 설정됩니다.',
    scopeType: 'write',
    method: 'POST',
    path: 'provider/create',
    requiredFields: [],
    fields: {
      company_name: { type: 'string', location: 'body', description: '회사명' },
      company_owner: {
        type: 'string',
        location: 'body',
        description: '대표자명',
      },
      business_number: {
        type: 'number',
        location: 'body',
        description: '사업자 등록번호',
      },
      business_type: { type: 'string', location: 'body', description: '업태' },
      business_item: { type: 'string', location: 'body', description: '종목' },
      company_post_number: {
        type: 'number',
        location: 'body',
        description: '우편번호',
      },
      company_address: {
        type: 'string',
        location: 'body',
        description: '회사주소',
      },
      provider_id: {
        type: 'string',
        location: 'body',
        description: '운영자 ID',
      },
      provider_name: {
        type: 'string',
        location: 'body',
        description: '공급자명',
      },
      password: { type: 'string', location: 'body', description: '비밀번호' },
      phone: {
        type: 'string',
        location: 'body',
        description: '휴대폰 번호 (000-0000-0000)',
      },
      tel_number: { type: 'number', location: 'body', description: '전화번호' },
      fax_number: { type: 'number', location: 'body', description: 'FAX' },
      email: { type: 'string', location: 'body', description: 'E-mail' },
      product_count: {
        type: 'number',
        location: 'body',
        description: '상품 등록 수 (10000이하 50의 배수)',
      },
      sub_admin_count: {
        type: 'number',
        location: 'body',
        description: '부운영자 수 (0~3)',
      },
      display_provide_privacy: {
        type: 'string',
        location: 'body',
        description: '개인정보 공급자 제공 노출 설정 Y,N',
      },
      discount_burden: {
        type: 'string',
        location: 'body',
        description:
          '상품 할인금 부담. SHOP : 본사 부담, PROVIDER : 공급자 부담',
      },
      delivery_burden: {
        type: 'string',
        location: 'body',
        description: '배송비 부담. SHOP : 본사 부담, PROVIDER : 공급자 부담',
      },
      bank_name: { type: 'string', location: 'body', description: '은행명' },
      accounter: { type: 'string', location: 'body', description: '예금주' },
      bank_account: {
        type: 'string',
        location: 'body',
        description: '계좌번호',
      },
      charge: {
        type: 'number',
        location: 'body',
        description: '수수료. 0~100사이 값 입력',
      },
      settlement_cycle: {
        type: 'string',
        location: 'body',
        description:
          '정산 요청 주기. MONTH : 월 1회 정산, MONTH_TWICE : 월 2회 정산, WEEK : 주 정산',
      },
      settlement_period: {
        type: 'string',
        location: 'body',
        description:
          '정산 요청 주기 조건 정산 요청 주기가 MONTH, MONTH_TWICE 일 때, 1 ~ 32 정산 요청 주기가 WEEK 일 때, MON,TUE,WED,THU,FRI,SAT,SUN',
      },
    },
    responseShape: 'single',
  },
  {
    id: 'post-provider-delete',
    description: '등록된 공급자 정보를 삭제합니다.',
    scopeType: 'write',
    method: 'POST',
    path: 'provider/delete',
    requiredFields: ['code'],
    fields: {
      code: { type: 'string', location: 'body', description: 'code' },
    },
    responseShape: 'single',
  },
  {
    id: 'post-provider-update',
    description:
      '등록된 공급자 정보를 수정합니다. 공급자 수정 시, 배송 정책 및 권한은 기존 설정값으로 유지됩니다.',
    scopeType: 'write',
    method: 'POST',
    path: 'provider/update',
    requiredFields: [],
    fields: {
      code: {
        type: 'number',
        location: 'body',
        description: 'code. 수정 시 필수입력',
      },
      company_name: { type: 'string', location: 'body', description: '회사명' },
      company_owner: {
        type: 'string',
        location: 'body',
        description: '대표자명',
      },
      business_number: {
        type: 'number',
        location: 'body',
        description: '사업자 등록번호',
      },
      business_type: { type: 'string', location: 'body', description: '업태' },
      business_item: { type: 'string', location: 'body', description: '종목' },
      company_post_number: {
        type: 'number',
        location: 'body',
        description: '우편번호',
      },
      company_address: {
        type: 'string',
        location: 'body',
        description: '회사주소',
      },
      provider_id: {
        type: 'string',
        location: 'body',
        description: '운영자 ID',
      },
      provider_name: {
        type: 'string',
        location: 'body',
        description: '공급자명',
      },
      password: { type: 'string', location: 'body', description: '비밀번호' },
      phone: {
        type: 'string',
        location: 'body',
        description: '휴대폰 번호. 000-0000-0000',
      },
      tel_number: { type: 'number', location: 'body', description: '전화번호' },
      fax_number: { type: 'number', location: 'body', description: 'FAX' },
      email: { type: 'string', location: 'body', description: 'E-mail' },
      product_count: {
        type: 'number',
        location: 'body',
        description: '상품 등록 수. 10000이하 50의 배수',
      },
      sub_admin_count: {
        type: 'number',
        location: 'body',
        description: '부운영자 수 (0~3)',
      },
      display_provide_privacy: {
        type: 'string',
        location: 'body',
        description: '개인정보 공급자 제공 노출 설정 (Y,N)',
      },
      discount_burden: {
        type: 'string',
        location: 'body',
        description:
          '상품 할인금 부담. SHOP : 본사 부담, PROVIDER : 공급자 부담',
      },
      delivery_burden: {
        type: 'string',
        location: 'body',
        description: '배송비 부담. SHOP : 본사 부담, PROVIDER : 공급자 부담',
      },
      bank_name: { type: 'string', location: 'body', description: '은행명' },
      accounter: { type: 'string', location: 'body', description: '예금주' },
      bank_account: {
        type: 'string',
        location: 'body',
        description: '계좌번호',
      },
      charge: {
        type: 'number',
        location: 'body',
        description: '수수료. 0~100사이 값 입력',
      },
      settlement_cycle: {
        type: 'string',
        location: 'body',
        description:
          '정산 요청 주기 (MONTH : 월 1회 정산, MONTH_TWICE : 월 2회 정산, WEEK : 주 정산)',
      },
      settlement_period: {
        type: 'string',
        location: 'body',
        description:
          '정산 요청 주기 조건 정산 요청 주기가 MONTH, MONTH_TWICE 일 때, 1 ~ 32 정산 요청 주기가 WEEK 일 때, MON,TUE,WED,THU,FRI,SAT,SUN',
      },
    },
    responseShape: 'single',
  },
];
