import type { Cafe24OperationMetadata } from './types.js';

export const productOperations: Cafe24OperationMetadata[] = [
  {
    id: 'product_list',
    description:
      'List products in the mall. Supports filtering by category, display status, date range, price range.',
    scopeType: 'read',
    method: 'GET',
    path: 'products',
    requiredFields: ['shop_no'],
    fields: {
      shop_no: {
        type: 'number',
        location: 'query',
        description: 'Multi-shop number (default 1)',
        default: 1,
      },
      category_no: {
        type: 'number',
        location: 'query',
        description: 'Filter by category number',
      },
      display: {
        type: 'enum',
        location: 'query',
        enum: ['T', 'F'],
        description: 'Display on/off (T=on, F=off)',
      },
      selling: {
        type: 'enum',
        location: 'query',
        enum: ['T', 'F'],
        description: 'Selling on/off',
      },
      since: {
        type: 'string',
        location: 'query',
        description:
          'ISO8601 datetime (KST, UTC+9) — created_after. Cafe24 interprets naive ISO as KST.',
      },
      until: {
        type: 'string',
        location: 'query',
        description:
          'ISO8601 datetime (KST, UTC+9) — created_before. Cafe24 interprets naive ISO as KST.',
      },
      product_name: {
        type: 'string',
        location: 'query',
        description: 'Filter by product name (partial match)',
      },
    },
    // cafe24 docs (Retrieve a list of products): "검색 시작일과 같이
    // 사용해야함" — since/until must be supplied together. Field names
    // differ from docs (`created_start_date`/`created_end_date`) but the
    // semantics align. Renaming to match docs is queued in G-1-remaining-16.
    constraints: [{ kind: 'allOrNone', fields: ['since', 'until'] }],
    responseShape: 'list',
    paginated: true,
  },
  {
    id: 'product_get',
    description: 'Get a single product by product_no.',
    scopeType: 'read',
    method: 'GET',
    path: 'products/{product_no}',
    requiredFields: ['product_no'],
    fields: {
      product_no: { type: 'number', location: 'path' },
      shop_no: { type: 'number', location: 'query', default: 1 },
    },
    responseShape: 'single',
  },
  {
    id: 'product_create',
    description:
      'Create a new product. Required fields vary by mall settings; refer to Cafe24 docs for the full field list.',
    scopeType: 'write',
    method: 'POST',
    path: 'products',
    requiredFields: ['product_name', 'price', 'supply_price'],
    fields: {
      shop_no: { type: 'number', location: 'body', default: 1 },
      product_name: { type: 'string', location: 'body' },
      price: {
        type: 'string',
        location: 'body',
        description: 'Decimal string (KRW)',
      },
      supply_price: { type: 'string', location: 'body' },
      display: {
        type: 'enum',
        location: 'body',
        enum: ['T', 'F'],
        default: 'T',
      },
      selling: {
        type: 'enum',
        location: 'body',
        enum: ['T', 'F'],
        default: 'T',
      },
      description: { type: 'string', location: 'body' },
      category_no: { type: 'array', location: 'body' },
    },
    responseShape: 'single',
  },
  {
    id: 'product_update',
    description:
      'Update a product (name, price, display, selling, description, ...).',
    scopeType: 'write',
    method: 'PUT',
    path: 'products/{product_no}',
    requiredFields: ['product_no'],
    fields: {
      product_no: { type: 'number', location: 'path' },
      shop_no: { type: 'number', location: 'body', default: 1 },
      product_name: { type: 'string', location: 'body' },
      price: { type: 'string', location: 'body' },
      display: { type: 'enum', location: 'body', enum: ['T', 'F'] },
      selling: { type: 'enum', location: 'body', enum: ['T', 'F'] },
      description: { type: 'string', location: 'body' },
    },
    responseShape: 'single',
  },
  {
    id: 'product_delete',
    description: 'Delete a product by product_no.',
    scopeType: 'write',
    method: 'DELETE',
    path: 'products/{product_no}',
    requiredFields: ['product_no'],
    fields: {
      product_no: { type: 'number', location: 'path' },
    },
    responseShape: 'single',
  },
  {
    id: 'product_variants_list',
    description: 'List variants (option combinations) for a product.',
    scopeType: 'read',
    method: 'GET',
    path: 'products/{product_no}/variants',
    requiredFields: ['product_no'],
    fields: {
      product_no: { type: 'number', location: 'path' },
      shop_no: { type: 'number', location: 'query', default: 1 },
    },
    responseShape: 'list',
    paginated: true,
  },
  {
    id: 'product_variants_inventory_update',
    description: 'Update inventory quantity for a specific variant.',
    scopeType: 'write',
    method: 'PUT',
    path: 'products/{product_no}/variants/{variant_code}/inventories',
    requiredFields: ['product_no', 'variant_code', 'quantity'],
    fields: {
      product_no: { type: 'number', location: 'path' },
      variant_code: { type: 'string', location: 'path' },
      shop_no: { type: 'number', location: 'body', default: 1 },
      quantity: { type: 'number', location: 'body' },
      use_inventory: {
        type: 'enum',
        location: 'body',
        enum: ['A', 'B', 'C'],
        description: 'Inventory control mode',
      },
    },
    responseShape: 'single',
  },
  {
    id: 'product_count',
    description:
      'Retrieve the total count of products matching the supplied filters. Cafe24 docs surface count-specific URL as the sibling `/count` path of the list endpoint, mirroring `order_count`.',
    scopeType: 'read',
    method: 'GET',
    path: 'products/count',
    requiredFields: [],
    fields: {
      shop_no: { type: 'number', location: 'query', default: 1 },
      category_no: {
        type: 'number',
        location: 'query',
        description: 'Filter by category number',
      },
      display: {
        type: 'enum',
        location: 'query',
        enum: ['T', 'F'],
        description: 'Display on/off (T=on, F=off)',
      },
      selling: {
        type: 'enum',
        location: 'query',
        enum: ['T', 'F'],
        description: 'Selling on/off',
      },
      product_name: {
        type: 'string',
        location: 'query',
        description: 'Filter by product name (partial match)',
      },
      since: {
        type: 'string',
        location: 'query',
        description:
          'ISO8601 datetime (KST, UTC+9) — created_after. Cafe24 interprets naive ISO as KST.',
      },
      until: {
        type: 'string',
        location: 'query',
        description:
          'ISO8601 datetime (KST, UTC+9) — created_before. Cafe24 interprets naive ISO as KST.',
      },
    },
    // Mirrors `product_list` — docs requires the since/until pair to be
    // supplied together.
    constraints: [{ kind: 'allOrNone', fields: ['since', 'until'] }],
    responseShape: 'single',
  },
  {
    id: 'product_options_list',
    description: 'List the option set defined on a product.',
    scopeType: 'read',
    method: 'GET',
    path: 'products/{product_no}/options',
    requiredFields: ['product_no'],
    fields: {
      product_no: { type: 'number', location: 'path' },
      shop_no: { type: 'number', location: 'query', default: 1 },
    },
    responseShape: 'list',
    paginated: true,
  },
  {
    id: 'product_options_create',
    description:
      'Create a new option on a product (e.g. size, color). `option_values` is the array of selectable values.',
    scopeType: 'write',
    method: 'POST',
    path: 'products/{product_no}/options',
    requiredFields: [
      'product_no',
      'option_name',
      'option_type',
      'option_values',
    ],
    fields: {
      product_no: { type: 'number', location: 'path' },
      shop_no: { type: 'number', location: 'query', default: 1 },
      option_name: { type: 'string', location: 'body' },
      option_type: {
        type: 'string',
        location: 'body',
        description: 'Option widget type (e.g. text, select)',
      },
      option_values: {
        type: 'array',
        location: 'body',
        description: 'Array of selectable option values',
      },
    },
    responseShape: 'single',
  },
  {
    id: 'product_options_update',
    description:
      'Update an existing product option identified by `option_no` (body).',
    scopeType: 'write',
    method: 'PUT',
    path: 'products/{product_no}/options',
    requiredFields: ['product_no', 'option_no'],
    fields: {
      product_no: { type: 'number', location: 'path' },
      shop_no: { type: 'number', location: 'query', default: 1 },
      option_no: { type: 'number', location: 'body' },
      option_name: { type: 'string', location: 'body' },
      option_type: { type: 'string', location: 'body' },
      option_value: { type: 'string', location: 'body' },
      use_option: {
        type: 'enum',
        location: 'body',
        enum: ['T', 'F'],
        description: 'Activation status',
      },
      required_option: {
        type: 'enum',
        location: 'body',
        enum: ['T', 'F'],
        description: 'Whether selection is mandatory',
      },
    },
    responseShape: 'single',
  },
  {
    id: 'product_options_delete',
    description:
      'Delete the entire option configuration from a product (cafe24 docs `delete-a-product-option`: removes all options).',
    scopeType: 'write',
    method: 'DELETE',
    // cafe24 docs path: `products/{product_no}/options` (no `{option_no}` —
    // the operation removes the product's option set wholesale).
    path: 'products/{product_no}/options',
    requiredFields: ['product_no'],
    fields: {
      product_no: { type: 'number', location: 'path' },
      shop_no: { type: 'number', location: 'query', default: 1 },
    },
    responseShape: 'single',
  },
  {
    id: 'product_seo_get',
    description:
      "Retrieve a product's SEO meta settings (title / description / keywords / URL path).",
    scopeType: 'read',
    method: 'GET',
    path: 'products/{product_no}/seo',
    requiredFields: ['product_no'],
    fields: {
      product_no: { type: 'number', location: 'path' },
      shop_no: { type: 'number', location: 'query', default: 1 },
    },
    responseShape: 'single',
  },
  {
    id: 'product_seo_update',
    description:
      "Update a product's SEO meta settings. All body fields are optional — provide only the ones to change.",
    scopeType: 'write',
    method: 'PUT',
    path: 'products/{product_no}/seo',
    requiredFields: ['product_no'],
    fields: {
      product_no: { type: 'number', location: 'path' },
      shop_no: { type: 'number', location: 'query', default: 1 },
      meta_title: { type: 'string', location: 'body' },
      meta_description: { type: 'string', location: 'body' },
      meta_keyword: { type: 'string', location: 'body' },
      url_path: { type: 'string', location: 'body' },
      seo_title: { type: 'string', location: 'body' },
    },
    responseShape: 'single',
  },
  // Batch 2-A — product_variants (5) · product_additionalimages (3) · product_images (2)
  {
    id: 'product_variants_get',
    description: 'Retrieve a single product variant.',
    scopeType: 'read',
    method: 'GET',
    path: 'products/{product_no}/variants/{variant_code}',
    requiredFields: ['product_no', 'variant_code'],
    fields: {
      product_no: { type: 'number', location: 'path' },
      variant_code: { type: 'string', location: 'path' },
    },
    responseShape: 'single',
  },
  {
    id: 'product_variants_update',
    description: 'Update a single product variant.',
    scopeType: 'write',
    method: 'PUT',
    path: 'products/{product_no}/variants/{variant_code}',
    requiredFields: ['product_no', 'variant_code'],
    fields: {
      product_no: { type: 'number', location: 'path' },
      variant_code: { type: 'string', location: 'path' },
    },
    responseShape: 'single',
  },
  {
    id: 'product_variants_update_multiple',
    description: 'Update multiple variants of a product in one call.',
    scopeType: 'write',
    method: 'PUT',
    path: 'products/{product_no}/variants',
    requiredFields: ['product_no'],
    fields: {
      product_no: { type: 'number', location: 'path' },
    },
    responseShape: 'list',
  },
  {
    id: 'product_variants_delete',
    description: 'Delete a product variant.',
    scopeType: 'write',
    method: 'DELETE',
    path: 'products/{product_no}/variants/{variant_code}',
    requiredFields: ['product_no', 'variant_code'],
    fields: {
      product_no: { type: 'number', location: 'path' },
      variant_code: { type: 'string', location: 'path' },
    },
    responseShape: 'empty',
  },
  {
    id: 'product_variants_inventory_get',
    description: 'Retrieve inventory details for a product variant.',
    scopeType: 'read',
    method: 'GET',
    path: 'products/{product_no}/variants/{variant_code}/inventories',
    requiredFields: ['product_no', 'variant_code'],
    fields: {
      product_no: { type: 'number', location: 'path' },
      variant_code: { type: 'string', location: 'path' },
    },
    responseShape: 'single',
  },
  {
    id: 'product_additionalimages_create',
    description: 'Register an additional product image.',
    scopeType: 'write',
    method: 'POST',
    path: 'products/{product_no}/additionalimages',
    requiredFields: ['product_no'],
    fields: {
      product_no: { type: 'number', location: 'path' },
    },
    responseShape: 'single',
  },
  {
    id: 'product_additionalimages_update',
    description: 'Update additional product images.',
    scopeType: 'write',
    method: 'PUT',
    path: 'products/{product_no}/additionalimages',
    requiredFields: ['product_no'],
    fields: {
      product_no: { type: 'number', location: 'path' },
    },
    responseShape: 'single',
  },
  {
    id: 'product_additionalimages_delete',
    description:
      'Delete all additional product images for a product (collection-level DELETE — individual image_no selector is not supported by the Cafe24 endpoint).',
    scopeType: 'write',
    method: 'DELETE',
    path: 'products/{product_no}/additionalimages',
    requiredFields: ['product_no'],
    fields: {
      product_no: { type: 'number', location: 'path' },
    },
    responseShape: 'empty',
  },
  {
    id: 'product_images_upload',
    description: 'Upload product image files.',
    scopeType: 'write',
    method: 'POST',
    path: 'products/images',
    requiredFields: [],
    fields: {
      shop_no: { type: 'number', location: 'body', default: 1 },
    },
    responseShape: 'single',
  },
  {
    id: 'product_images_delete',
    description: "Delete a product's image files (per-product scope).",
    scopeType: 'write',
    method: 'DELETE',
    // cafe24 docs path: `products/{product_no}/images` (member-scoped — old
    // seed had unmember-scoped `products/images` which docs has no match).
    path: 'products/{product_no}/images',
    requiredFields: ['product_no'],
    fields: {
      product_no: { type: 'number', location: 'path' },
      shop_no: { type: 'number', location: 'query', default: 1 },
    },
    responseShape: 'empty',
  },
  // Batch 2-B — product_approve (3) · customproperties (3) · decorationimages (4)
  {
    id: 'product_approve_get',
    description: 'Retrieve approval status for a product.',
    scopeType: 'read',
    method: 'GET',
    path: 'products/{product_no}/approve',
    requiredFields: ['product_no'],
    fields: {
      product_no: { type: 'number', location: 'path' },
    },
    responseShape: 'single',
  },
  {
    id: 'product_approve_create',
    description: 'Create an approval request for a product.',
    scopeType: 'write',
    method: 'POST',
    path: 'products/{product_no}/approve',
    requiredFields: ['product_no'],
    fields: {
      product_no: { type: 'number', location: 'path' },
    },
    responseShape: 'single',
  },
  {
    id: 'product_approve_update',
    description: 'Update the approval status of a product.',
    scopeType: 'write',
    method: 'PUT',
    path: 'products/{product_no}/approve',
    requiredFields: ['product_no'],
    fields: {
      product_no: { type: 'number', location: 'path' },
    },
    responseShape: 'single',
  },
  {
    id: 'product_customproperties_get',
    description: 'Retrieve user-defined custom properties for a product.',
    scopeType: 'read',
    method: 'GET',
    path: 'products/{product_no}/customproperties',
    requiredFields: ['product_no'],
    fields: {
      product_no: { type: 'number', location: 'path' },
    },
    responseShape: 'single',
  },
  {
    id: 'product_customproperties_update',
    description:
      'Update a specific user-defined custom property for a product.',
    scopeType: 'write',
    method: 'PUT',
    // cafe24 docs path: `products/{product_no}/customproperties/{property_no}`
    // (property_no is required path arg — pre-2026-05-22 seed had missing
    // path placeholder, would target the collection endpoint which docs
    // does not define).
    path: 'products/{product_no}/customproperties/{property_no}',
    requiredFields: ['product_no', 'property_no'],
    fields: {
      product_no: { type: 'number', location: 'path' },
      property_no: { type: 'number', location: 'path' },
      shop_no: { type: 'number', location: 'body', default: 1 },
    },
    responseShape: 'single',
  },
  {
    id: 'product_customproperties_delete',
    description:
      'Delete a specific user-defined custom property for a product.',
    scopeType: 'write',
    method: 'DELETE',
    path: 'products/{product_no}/customproperties/{property_no}',
    requiredFields: ['product_no', 'property_no'],
    fields: {
      product_no: { type: 'number', location: 'path' },
      property_no: { type: 'number', location: 'path' },
      shop_no: { type: 'number', location: 'query', default: 1 },
    },
    responseShape: 'empty',
  },
  {
    id: 'product_decorationimages_list',
    description: 'List decoration images attached to a product.',
    scopeType: 'read',
    method: 'GET',
    path: 'products/{product_no}/decorationimages',
    requiredFields: ['product_no'],
    fields: {
      product_no: { type: 'number', location: 'path' },
      offset: { type: 'number', location: 'query', default: 0 },
      limit: { type: 'number', location: 'query', default: 10 },
    },
    responseShape: 'list',
    paginated: true,
  },
  {
    id: 'product_decorationimages_set',
    description: 'Set (create) a decoration image for a product.',
    scopeType: 'write',
    method: 'POST',
    path: 'products/{product_no}/decorationimages',
    requiredFields: ['product_no'],
    fields: {
      product_no: { type: 'number', location: 'path' },
    },
    responseShape: 'single',
  },
  {
    id: 'product_decorationimages_update',
    description: 'Update a decoration image of a product.',
    scopeType: 'write',
    method: 'PUT',
    path: 'products/{product_no}/decorationimages',
    requiredFields: ['product_no'],
    fields: {
      product_no: { type: 'number', location: 'path' },
    },
    responseShape: 'single',
  },
  {
    id: 'product_decorationimages_delete',
    description:
      'Delete a specific decoration image (by code) attached to a product.',
    scopeType: 'write',
    method: 'DELETE',
    // cafe24 docs path: `products/{product_no}/decorationimages/{code}`
    // (code path placeholder added — pre-2026-05-22 seed missed it).
    path: 'products/{product_no}/decorationimages/{code}',
    requiredFields: ['product_no', 'code'],
    fields: {
      product_no: { type: 'number', location: 'path' },
      code: {
        type: 'string',
        location: 'path',
        description: 'Decoration image code.',
      },
      shop_no: { type: 'number', location: 'query', default: 1 },
    },
    responseShape: 'empty',
  },
  // Batch 2-C — product_discountprice · hits · icons (4) · memos (5)
  {
    id: 'product_discountprice_get',
    description: 'Retrieve the discounted price for a product.',
    scopeType: 'read',
    method: 'GET',
    path: 'products/{product_no}/discountprice',
    requiredFields: ['product_no'],
    fields: {
      product_no: { type: 'number', location: 'path' },
    },
    responseShape: 'single',
  },
  {
    id: 'product_hits_count',
    description: 'Retrieve view-count statistics for a product.',
    scopeType: 'read',
    method: 'GET',
    // cafe24 docs path: `products/{product_no}/hits/count` (with `/count`
    // suffix — pre-2026-05-22 seed missed it).
    path: 'products/{product_no}/hits/count',
    requiredFields: ['product_no'],
    fields: {
      product_no: { type: 'number', location: 'path' },
      shop_no: { type: 'number', location: 'query', default: 1 },
    },
    responseShape: 'single',
  },
  {
    id: 'product_icons_list',
    description: 'List icons attached to a product.',
    scopeType: 'read',
    method: 'GET',
    path: 'products/{product_no}/icons',
    requiredFields: ['product_no'],
    fields: {
      product_no: { type: 'number', location: 'path' },
      offset: { type: 'number', location: 'query', default: 0 },
      limit: { type: 'number', location: 'query', default: 10 },
    },
    responseShape: 'list',
    paginated: true,
  },
  {
    id: 'product_icons_set',
    description: 'Set (create) an icon for a product.',
    scopeType: 'write',
    method: 'POST',
    path: 'products/{product_no}/icons',
    requiredFields: ['product_no'],
    fields: {
      product_no: { type: 'number', location: 'path' },
    },
    responseShape: 'single',
  },
  {
    id: 'product_icons_update',
    description: 'Update icons of a product.',
    scopeType: 'write',
    method: 'PUT',
    path: 'products/{product_no}/icons',
    requiredFields: ['product_no'],
    fields: {
      product_no: { type: 'number', location: 'path' },
    },
    responseShape: 'single',
  },
  {
    id: 'product_icons_delete',
    description: 'Delete an icon of a product by code.',
    scopeType: 'write',
    method: 'DELETE',
    // cafe24 docs path: `products/{product_no}/icons/{code}` (path
    // placeholder is `{code}` not `{icon_no}` — pre-2026-05-22 seed had
    // wrong placeholder name).
    path: 'products/{product_no}/icons/{code}',
    requiredFields: ['product_no', 'code'],
    fields: {
      product_no: { type: 'number', location: 'path' },
      code: {
        type: 'string',
        location: 'path',
        description: 'Icon code identifier.',
      },
      shop_no: { type: 'number', location: 'query', default: 1 },
    },
    responseShape: 'empty',
  },
  {
    id: 'product_memos_list',
    description: 'List memos attached to a product.',
    scopeType: 'read',
    method: 'GET',
    path: 'products/{product_no}/memos',
    requiredFields: ['product_no'],
    fields: {
      product_no: { type: 'number', location: 'path' },
      offset: { type: 'number', location: 'query', default: 0 },
      limit: { type: 'number', location: 'query', default: 10 },
    },
    responseShape: 'list',
    paginated: true,
  },
  {
    id: 'product_memos_get',
    description: 'Retrieve a single product memo by memo_no.',
    scopeType: 'read',
    method: 'GET',
    path: 'products/{product_no}/memos/{memo_no}',
    requiredFields: ['product_no', 'memo_no'],
    fields: {
      product_no: { type: 'number', location: 'path' },
      memo_no: { type: 'number', location: 'path' },
    },
    responseShape: 'single',
  },
  {
    id: 'product_memos_create',
    description: 'Create a memo for a product.',
    scopeType: 'write',
    method: 'POST',
    path: 'products/{product_no}/memos',
    requiredFields: ['product_no'],
    fields: {
      product_no: { type: 'number', location: 'path' },
    },
    responseShape: 'single',
  },
  {
    id: 'product_memos_update',
    description: 'Update a product memo by memo_no.',
    scopeType: 'write',
    method: 'PUT',
    path: 'products/{product_no}/memos/{memo_no}',
    requiredFields: ['product_no', 'memo_no'],
    fields: {
      product_no: { type: 'number', location: 'path' },
      memo_no: { type: 'number', location: 'path' },
    },
    responseShape: 'single',
  },
  {
    id: 'product_memos_delete',
    description: 'Delete a product memo by memo_no.',
    scopeType: 'write',
    method: 'DELETE',
    path: 'products/{product_no}/memos/{memo_no}',
    requiredFields: ['product_no', 'memo_no'],
    fields: {
      product_no: { type: 'number', location: 'path' },
      memo_no: { type: 'number', location: 'path' },
    },
    responseShape: 'empty',
  },
  // Batch 2-D — product_tags (4) · bundleproducts (5) · categories_products (4)
  {
    id: 'product_tags_list',
    description: 'List tags attached to a product.',
    scopeType: 'read',
    method: 'GET',
    path: 'products/{product_no}/tags',
    requiredFields: ['product_no'],
    fields: {
      product_no: { type: 'number', location: 'path' },
      offset: { type: 'number', location: 'query', default: 0 },
      limit: { type: 'number', location: 'query', default: 10 },
    },
    responseShape: 'list',
    paginated: true,
  },
  {
    id: 'product_tags_count',
    description: 'Count tags attached to a product.',
    scopeType: 'read',
    method: 'GET',
    path: 'products/{product_no}/tags/count',
    requiredFields: ['product_no'],
    fields: {
      product_no: { type: 'number', location: 'path' },
    },
    responseShape: 'single',
  },
  {
    id: 'product_tags_create',
    description: 'Create one or more tags for a product.',
    scopeType: 'write',
    method: 'POST',
    path: 'products/{product_no}/tags',
    requiredFields: ['product_no'],
    fields: {
      product_no: { type: 'number', location: 'path' },
    },
    responseShape: 'single',
  },
  {
    id: 'product_tags_delete',
    description: 'Delete a product tag by tag value.',
    scopeType: 'write',
    method: 'DELETE',
    // cafe24 docs path: `products/{product_no}/tags/{tag}` (path placeholder
    // `{tag}` is the tag string value — pre-2026-05-22 seed had wrong
    // `{tag_no}` placeholder name).
    path: 'products/{product_no}/tags/{tag}',
    requiredFields: ['product_no', 'tag'],
    fields: {
      product_no: { type: 'number', location: 'path' },
      tag: {
        type: 'string',
        location: 'path',
        description: 'Tag string value.',
      },
      shop_no: { type: 'number', location: 'query', default: 1 },
    },
    responseShape: 'empty',
  },
  {
    id: 'bundleproducts_list',
    description: 'List bundle products.',
    scopeType: 'read',
    method: 'GET',
    path: 'bundleproducts',
    requiredFields: [],
    fields: {
      offset: { type: 'number', location: 'query', default: 0 },
      limit: { type: 'number', location: 'query', default: 10 },
    },
    responseShape: 'list',
    paginated: true,
  },
  {
    id: 'bundleproducts_get',
    description: 'Retrieve a single bundle product by product_no.',
    scopeType: 'read',
    method: 'GET',
    path: 'bundleproducts/{product_no}',
    requiredFields: ['product_no'],
    fields: {
      product_no: { type: 'number', location: 'path' },
    },
    responseShape: 'single',
  },
  {
    id: 'bundleproducts_create',
    description: 'Create a bundle product.',
    scopeType: 'write',
    method: 'POST',
    path: 'bundleproducts',
    requiredFields: [],
    fields: {},
    responseShape: 'single',
  },
  {
    id: 'bundleproducts_update',
    description: 'Update a bundle product.',
    scopeType: 'write',
    method: 'PUT',
    path: 'bundleproducts/{product_no}',
    requiredFields: ['product_no'],
    fields: {
      product_no: { type: 'number', location: 'path' },
    },
    responseShape: 'single',
  },
  {
    id: 'bundleproducts_delete',
    description: 'Delete a bundle product.',
    scopeType: 'write',
    method: 'DELETE',
    path: 'bundleproducts/{product_no}',
    requiredFields: ['product_no'],
    fields: {
      product_no: { type: 'number', location: 'path' },
    },
    responseShape: 'empty',
  },
  {
    id: 'categories_products_count',
    description: 'Count products belonging to a category.',
    scopeType: 'read',
    method: 'GET',
    path: 'categories/{category_no}/products/count',
    requiredFields: ['category_no'],
    fields: {
      category_no: { type: 'number', location: 'path' },
    },
    responseShape: 'single',
  },
  {
    id: 'categories_products_add',
    description: 'Add products to a category.',
    scopeType: 'write',
    method: 'POST',
    path: 'categories/{category_no}/products',
    requiredFields: ['category_no'],
    fields: {
      category_no: { type: 'number', location: 'path' },
    },
    responseShape: 'single',
  },
  {
    id: 'categories_products_update',
    description: 'Update products attached to a category.',
    scopeType: 'write',
    method: 'PUT',
    path: 'categories/{category_no}/products',
    requiredFields: ['category_no'],
    fields: {
      category_no: { type: 'number', location: 'path' },
    },
    responseShape: 'single',
  },
  {
    id: 'categories_products_delete',
    description: 'Delete a specific product from a category.',
    scopeType: 'write',
    method: 'DELETE',
    // cafe24 docs path: `categories/{category_no}/products/{product_no}`
    // (per-product scope — pre-2026-05-22 seed missed `{product_no}`).
    path: 'categories/{category_no}/products/{product_no}',
    requiredFields: ['category_no', 'product_no'],
    fields: {
      category_no: { type: 'number', location: 'path' },
      product_no: { type: 'number', location: 'path' },
      shop_no: { type: 'number', location: 'query', default: 1 },
    },
    responseShape: 'empty',
  },
  // Batch 2-E — mains_products (5). cafe24 docs path uses placeholder
  // `{display_group}` (not `{main_code}` — pre-2026-05-22 seed had wrong
  // placeholder name across all 5 mains_products operations). Also
  // `mains_products_update_sorting` is `PUT mains/{display_group}/products`
  // (no `/sorting` suffix — docs op is `update-fixed-sorting-of-products-
  // in-main-category` mapped to the same path as the set/delete ops with
  // PUT method).
  {
    id: 'mains_products_list',
    description: 'List products attached to a main display category.',
    scopeType: 'read',
    method: 'GET',
    path: 'mains/{display_group}/products',
    requiredFields: ['display_group'],
    fields: {
      display_group: { type: 'string', location: 'path' },
      shop_no: { type: 'number', location: 'query', default: 1 },
      offset: { type: 'number', location: 'query', default: 0 },
      limit: { type: 'number', location: 'query', default: 10 },
    },
    responseShape: 'list',
    paginated: true,
  },
  {
    id: 'mains_products_count',
    description: 'Count products attached to a main display category.',
    scopeType: 'read',
    method: 'GET',
    path: 'mains/{display_group}/products/count',
    requiredFields: ['display_group'],
    fields: {
      display_group: { type: 'string', location: 'path' },
      shop_no: { type: 'number', location: 'query', default: 1 },
    },
    responseShape: 'single',
  },
  {
    id: 'mains_products_set',
    description: 'Set products attached to a main display category.',
    scopeType: 'write',
    method: 'POST',
    path: 'mains/{display_group}/products',
    requiredFields: ['display_group'],
    fields: {
      display_group: { type: 'string', location: 'path' },
      shop_no: { type: 'number', location: 'body', default: 1 },
    },
    responseShape: 'single',
  },
  {
    id: 'mains_products_update_sorting',
    description: 'Update fixed sorting of products in a main display category.',
    scopeType: 'write',
    method: 'PUT',
    path: 'mains/{display_group}/products',
    requiredFields: ['display_group'],
    fields: {
      display_group: { type: 'string', location: 'path' },
      shop_no: { type: 'number', location: 'body', default: 1 },
    },
    responseShape: 'single',
  },
];
