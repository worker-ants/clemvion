import type { Cafe24OperationMetadata } from './types.js';

export const communityOperations: Cafe24OperationMetadata[] = [
  {
    id: 'boards_list',
    label: '게시판 목록 조회',
    description: 'List boards in the mall.',
    scopeType: 'read',
    method: 'GET',
    path: 'boards',
    requiredFields: [],
    fields: {
      shop_no: { type: 'number', location: 'query', default: 1 },
    },
    responseShape: 'list',
    paginated: true,
  },
  {
    id: 'board_articles_list',
    label: '게시판 글 목록 조회',
    description: 'List articles in a specific board.',
    scopeType: 'read',
    method: 'GET',
    path: 'boards/{board_no}/articles',
    requiredFields: ['board_no'],
    fields: {
      board_no: { type: 'number', location: 'path' },
      shop_no: { type: 'number', location: 'query', default: 1 },
    },
    responseShape: 'list',
    paginated: true,
  },
  {
    id: 'board_article_get',
    label: '게시판 글 단건 조회',
    description: 'Get a single article.',
    scopeType: 'read',
    method: 'GET',
    path: 'boards/{board_no}/articles/{article_no}',
    requiredFields: ['board_no', 'article_no'],
    fields: {
      board_no: { type: 'number', location: 'path' },
      article_no: { type: 'number', location: 'path' },
      shop_no: { type: 'number', location: 'query', default: 1 },
    },
    responseShape: 'single',
  },
];
