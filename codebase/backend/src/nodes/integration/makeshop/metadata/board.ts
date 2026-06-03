import type { MakeshopOperationMetadata } from './types.js';

export const boardOperations: MakeshopOperationMetadata[] = [
  {
    id: 'get-board',
    description:
      '게시글을 조회합니다. 최근 게시글 순으로 정렬됩니다. 조회 범위는 30일 까지 가능합니다.',
    scopeType: 'read',
    method: 'GET',
    path: 'board',
    requiredFields: ['InquiryTimeFrom', 'InquiryTimeTo', 'BoardCode'],
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
      BoardCode: {
        type: 'string',
        location: 'query',
        description: '조회 게시판 코드. 예)jih_board2',
      },
      num1: { type: 'string', location: 'query', description: '글번호' },
      num2: { type: 'string', location: 'query', description: '글번호(답글)' },
      uid: { type: 'string', location: 'query', description: '상품번호' },
      userid: { type: 'string', location: 'query', description: '회원 ID' },
      lock_ok: {
        type: 'string',
        location: 'query',
        description: '비밀글. Y : 비밀글, N : 일반',
      },
      write_path: {
        type: 'string',
        location: 'query',
        description: '작성경로. WEB,MOBILE,NAVER_PAY : 네이버페이',
      },
      orderByType: {
        type: 'string',
        location: 'query',
        description:
          '정렬 순서. asc : 오름차순, desc : 내림차순 (default : desc)',
      },
      limit: {
        type: 'string',
        location: 'query',
        description: '검색 한도. MAX : 5000 (default)',
      },
      page: { type: 'string', location: 'query', description: '검색할 페이지' },
      fields: {
        type: 'string',
        location: 'query',
        description:
          '조회필드. 서버 부하를 줄이고 API 이용 시 응답 속도 개선 fields=ordernum,num,basket_status',
      },
    },
    responseShape: 'list',
    paginated: true,
  },
  {
    id: 'get-board_code',
    description: '등록 게시판 조회 합니다.',
    scopeType: 'read',
    method: 'GET',
    path: 'board_code',
    requiredFields: [],
    fields: {},
    responseShape: 'list',
  },
  {
    id: 'get-comment',
    description: '게시글의 댓글을 조회합니다.',
    scopeType: 'read',
    method: 'GET',
    path: 'comment',
    requiredFields: ['InquiryTimeFrom', 'BoardCode'],
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
      BoardCode: {
        type: 'string',
        location: 'query',
        description: '조회 게시판 코드. 예)jih_board2',
      },
      num1: {
        type: 'string',
        location: 'query',
        description: '게시글 번호1. 게시글 번호 입력시 검색일자 조건 무시',
      },
      num2: { type: 'string', location: 'query', description: '게시글 번호2' },
      lock_ok: {
        type: 'string',
        location: 'query',
        description: '비밀댓글. Y : 비밀댓글, N : 일반댓글',
      },
      orderByType: {
        type: 'string',
        location: 'query',
        description:
          '정렬 순서. asc : 오름차순, desc : 내림차순 (default : desc)',
      },
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
    },
    responseShape: 'list',
    paginated: true,
  },
  {
    id: 'get-crm_board',
    description: '1:1 게시판 정보를 조회합니다.',
    scopeType: 'read',
    method: 'GET',
    path: 'crm_board',
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
        description: '검색 종료 일자. 0000-00-00 00:00:00',
      },
      limit: {
        type: 'string',
        location: 'query',
        description: '검색 한도. MAX : 5000 (default)',
      },
      page: { type: 'string', location: 'query', description: '검색할 페이지' },
      is_member: {
        type: 'string',
        location: 'query',
        description: '회원 여부. MEMBER : 회원, GUEST : 비회원, 미입력 시 전체',
      },
      userid: { type: 'string', location: 'query', description: '회원 아이디' },
      orderByType: {
        type: 'string',
        location: 'query',
        description:
          '정렬 순서. asc : 오름차순, desc : 내림차순 (default : desc)',
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
    id: 'get-review',
    description:
      '코멘트 평점타입 후기를 조회 합니다. 최근 코멘트 평점타입 후기 순으로 정렬됩니다. 조회 범위는 30일 까지 가능합니다.',
    scopeType: 'read',
    method: 'GET',
    path: 'review',
    requiredFields: [],
    fields: {
      InquiryTimeFrom: {
        type: 'string',
        location: 'query',
        description: '검색 시작 일자. 0000-00-00',
      },
      InquiryTimeTo: {
        type: 'string',
        location: 'query',
        description: '검색 종료 일자. 0000-00-00',
      },
      limit: {
        type: 'string',
        location: 'query',
        description: '검색 한도. MAX : 5000 (default)',
      },
      page: { type: 'string', location: 'query', description: '검색할 페이지' },
      uid: { type: 'string', location: 'query', description: '상품번호' },
      userid: { type: 'string', location: 'query', description: '회원 ID' },
      fields: {
        type: 'string',
        location: 'query',
        description:
          '조회필드. 서버 부하를 줄이고 API 이용 시 응답 속도 개선 fields=ordernum,num,basket_status',
      },
    },
    responseShape: 'list',
    paginated: true,
  },
  {
    id: 'post-board-store',
    description:
      '게시글을 등록 또는 수정합니다. 게시글 삭제 시 num1, num2 값을 필수로 입력해야 합니다. 게시판 설정이 비회원 쓰기가 가능한 경우 게시글 등록시 회원ID 유무를 체크하지 않습니다. Beta 버전으로 수정이 될 수 있습니다.',
    scopeType: 'write',
    method: 'POST',
    path: 'board/store',
    requiredFields: ['save_type', 'code', 'hname', 'subject', 'content'],
    fields: {
      save_type: {
        type: 'string',
        location: 'body',
        description:
          '등록 방식. create(등록), update(수정), answer(답변), delete()',
      },
      code: { type: 'string', location: 'body', description: '게시판 코드' },
      uid: { type: 'string', location: 'body', description: '상품번호' },
      gid: { type: 'string', location: 'body', description: '스타일코드' },
      hname: { type: 'string', location: 'body', description: '작성자' },
      id: { type: 'string', location: 'body', description: '회원 아이디' },
      date: {
        type: 'string',
        location: 'body',
        description:
          '작성일 (0000-00-00 00:00:00 or 00000000000000, 미입력시 현재 시간)',
      },
      subject: { type: 'string', location: 'body', description: '제목' },
      content: { type: 'string', location: 'body', description: '내용' },
      num1: { type: 'string', location: 'body', description: '글번호' },
      num2: { type: 'string', location: 'body', description: '글번호(답글)' },
      ordernum: {
        type: 'string',
        location: 'body',
        description: '주문번호(리뷰연동)',
      },
      score_1: {
        type: 'string',
        location: 'body',
        description: '리뷰 점수 1 (1~5)',
      },
      score_2: {
        type: 'string',
        location: 'body',
        description: '리뷰 점수 2 (1~5)',
      },
      score_3: {
        type: 'string',
        location: 'body',
        description: '리뷰 점수 3 (1~5)',
      },
      score_4: {
        type: 'string',
        location: 'body',
        description: '리뷰 점수 4 (1~5)',
      },
      score_5: {
        type: 'string',
        location: 'body',
        description: '리뷰 점수 5 (1~5)',
      },
      display: {
        type: 'string',
        location: 'body',
        description: '노출 여부. Y : 노출, N : 미노출',
      },
      lock_ok: {
        type: 'string',
        location: 'body',
        description:
          '비밀글 여부. 게시판 설정이 비밀글 작성 가능한 경우. Y : 비밀글, N : 일반 default N(일반)',
      },
      file_url: {
        type: 'string',
        location: 'body',
        description:
          '첨부파일 URL file_url, file_url_2,file_url_3,file_url_4의 이미지가 하나로 합쳐서 저장 jpg,jpeg,png,gif 500kb 이하',
      },
      file_url_2: {
        type: 'string',
        location: 'body',
        description:
          '첨부파일 URI file_url, file_url_2,file_url_3,file_url_4의 이미지가 하나로 합쳐서 저장 jpg,jpeg,png,gif 500kb 이하',
      },
      file_url_3: {
        type: 'string',
        location: 'body',
        description:
          '첨부파일 URI file_url, file_url_2,file_url_3,file_url_4의 이미지가 하나로 합쳐서 저장 jpg,jpeg,png,gif 500kb 이하',
      },
      file_url_4: {
        type: 'string',
        location: 'body',
        description:
          '첨부파일 URI file_url, file_url_2,file_url_3,file_url_4의 이미지가 하나로 합쳐서 저장 jpg,jpeg,png,gif 500kb 이하',
      },
    },
    responseShape: 'single',
  },
  {
    id: 'post-comment-store',
    description:
      '게시글에 댓글을 등록, 수정, 삭제합니다. uid(댓글 Id)는 게시글 조회 API 통해 list.comments.id 값으로 사용하여야 합니다. Beta 버전으로 수정이 될 수 있습니다.',
    scopeType: 'write',
    method: 'POST',
    path: 'comment/store',
    requiredFields: ['save_type', 'code', 'uid', 'hname'],
    fields: {
      save_type: {
        type: 'string',
        location: 'body',
        description: '등록 방식. create(등록), update(수정), delete(삭제)',
      },
      code: { type: 'string', location: 'body', description: '게시판 코드' },
      uid: {
        type: 'string',
        location: 'body',
        description: '등록된 댓글 ID 댓글 수정시 사용',
      },
      date: {
        type: 'string',
        location: 'body',
        description:
          '작성일 0000-00-00 00:00:00 or 00000000000000, 미입력시 현재 시간',
      },
      hname: { type: 'string', location: 'body', description: '작성자' },
      content: { type: 'string', location: 'body', description: '내용' },
      num1: { type: 'string', location: 'body', description: '글번호' },
      num2: { type: 'string', location: 'body', description: '글번호' },
    },
    responseShape: 'single',
  },
  {
    id: 'post-crm_board-create',
    description: '1:1 게시글을 등록합니다.',
    scopeType: 'write',
    method: 'POST',
    path: 'crm_board/create',
    requiredFields: ['datas'],
    fields: {
      datas: { type: 'array', location: 'body', description: '처리 데이터' },
    },
    responseShape: 'single',
  },
  {
    id: 'post-crm_board-reply',
    description: '등록된 1:1 게시글에 답변 등록합니다.',
    scopeType: 'write',
    method: 'POST',
    path: 'crm_board/reply',
    requiredFields: ['datas'],
    fields: {
      datas: { type: 'array', location: 'body', description: '처리 데이터' },
    },
    responseShape: 'single',
  },
  {
    id: 'post-crm_board-update',
    description: '등록된 1:1 게시글을 수정합니다.',
    scopeType: 'write',
    method: 'POST',
    path: 'crm_board/update',
    requiredFields: ['datas'],
    fields: {
      datas: { type: 'array', location: 'body', description: '처리 데이터' },
    },
    responseShape: 'single',
  },
  {
    id: 'post-review-delete',
    description: '코멘트 평점타입 후기를 삭제합니다.',
    scopeType: 'write',
    method: 'POST',
    path: 'review/delete',
    requiredFields: ['reg_date'],
    fields: {
      reg_date: { type: 'string', location: 'body', description: '등록일' },
      uid: { type: 'string', location: 'body', description: '상품 아이디' },
    },
    responseShape: 'single',
  },
  {
    id: 'post-review-store',
    description:
      '코멘트 평점타입 후기를 등록합니다. 리뷰 수정 시 작성일, 상품번호를 통해 리뷰가 매칭됩니다. Beta 버전으로 수정이 될 수 있습니다.',
    scopeType: 'write',
    method: 'POST',
    path: 'review/store',
    requiredFields: ['save_type', 'hname', 'content'],
    fields: {
      save_type: {
        type: 'string',
        location: 'body',
        description: '등록 방식. create(등록), update(수정), answer(답변)',
      },
      uid: { type: 'string', location: 'body', description: '상품번호' },
      hname: { type: 'string', location: 'body', description: '작성자' },
      id: { type: 'string', location: 'body', description: '회원 아이디' },
      reg_date: {
        type: 'string',
        location: 'body',
        description:
          '작성일. 0000-00-00 00:00:00 or 00000000000000, 미입력시 현재 시간',
      },
      content: { type: 'string', location: 'body', description: '내용' },
      score_1: {
        type: 'string',
        location: 'body',
        description: '리뷰 점수 1 (1~5)',
      },
      score_2: {
        type: 'string',
        location: 'body',
        description: '리뷰 점수 2 (1~5)',
      },
      score_3: {
        type: 'string',
        location: 'body',
        description: '리뷰 점수 3 (1~5)',
      },
      score_4: {
        type: 'string',
        location: 'body',
        description: '리뷰 점수 4 (1~5)',
      },
      score_5: {
        type: 'string',
        location: 'body',
        description: '리뷰 점수 5 (1~5)',
      },
      display: {
        type: 'string',
        location: 'body',
        description: '노출 여부 (Y : 노출, N : 미노출)',
      },
      reply_content: {
        type: 'string',
        location: 'body',
        description: '답변내용',
      },
      file_url: {
        type: 'string',
        location: 'body',
        description:
          '첨부파일 URL. file_url, file_url_2,file_url_3,file_url_4의 이미지가 하나로 합쳐서 저장 jpg,jpeg,png,gif 500kb 이하',
      },
      file_url_2: {
        type: 'string',
        location: 'body',
        description:
          '첨부파일 URL. file_url, file_url_2,file_url_3,file_url_4의 이미지가 하나로 합쳐서 저장 jpg,jpeg,png,gif 500kb 이하',
      },
      file_url_3: {
        type: 'string',
        location: 'body',
        description:
          '첨부파일 URL. file_url, file_url_2,file_url_3,file_url_4의 이미지가 하나로 합쳐서 저장 jpg,jpeg,png,gif 500kb 이하',
      },
      file_url_4: {
        type: 'string',
        location: 'body',
        description:
          '첨부파일 URL. file_url, file_url_2,file_url_3,file_url_4의 이미지가 하나로 합쳐서 저장 jpg,jpeg,png,gif 500kb 이하',
      },
    },
    responseShape: 'single',
  },
];
