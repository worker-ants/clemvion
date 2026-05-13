import type { Cafe24OperationMetadata } from './types.js';

export const translationOperations: Cafe24OperationMetadata[] = [
  {
    id: 'translation_products_list',
    label: '상품 번역 목록 조회',
    description: 'List product translations for a given language.',
    scopeType: 'read',
    method: 'GET',
    path: 'translation/products',
    requiredFields: ['shop_no', 'language_code'],
    fields: {
      shop_no: { type: 'number', location: 'query', default: 1 },
      language_code: {
        type: 'string',
        location: 'query',
        description: 'ISO 639-1 (en, ja, zh, ...)',
      },
      product_no: { type: 'number', location: 'query' },
    },
    responseShape: 'list',
    paginated: true,
  },
];
