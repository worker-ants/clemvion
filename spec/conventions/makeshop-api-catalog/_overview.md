# CONVENTION: Makeshop API Catalog — Overview

> 관련: [Makeshop 공식 개발자센터](https://developer.makeshop.co.kr/docs/api/shop/상점-설정-정보) · 참고 패턴 [Cafe24 API Catalog](../cafe24-api-catalog/_overview.md)

본 디렉토리는 메이크샵 신형 Shop API(`/api/v1/{shopId}/…`, OAuth2 `bearerAuth`)의 **모든 endpoint** 를 섹션 단위로 enumerate 한 단일 진실(SoT)이다. 메이크샵 통합(AI agent MCP + workflow 노드) 구현에 **앞선 사전 준비 레퍼런스**로, cafe24-api-catalog 패턴을 따른다.

> **주의 — cafe24 catalog 와의 차이**: cafe24 catalog 는 백엔드 메타데이터와 양방향 sync test 로 보호되는 구현 추적 문서다. 본 makeshop catalog 는 **구현 전 단계**라 대응 백엔드 메타데이터·sync test 가 아직 없다 — 따라서 `status`/`paginated`/`restricted` 컬럼 없이 순수 외부 API 레퍼런스로 시작한다. 구현 착수 시 cafe24 와 동일한 sync 체계로 승격한다.

## 1. 추출 출처·재현 (provenance)

- **출처**: 메이크샵 개발자센터 (Docusaurus v3.9.2 + `docusaurus-theme-openapi-docs`).
- **추출일**: 2026-06-03.
- **방식**: 공개 `openapi.json` 엔드포인트는 없으나, 각 페이지의 완전한 OpenAPI 3 operation 객체가 페이지별 JS chunk 안에 `base64(zlib(JSON))` 로 임베드돼 있다. `main.js`(라우트 레지스트리)+`runtime.js`(webpack chunk 맵)으로 라우트→chunk URL 을 100% 해석 후 디코드. 인증 불필요, 브라우저 렌더링 불필요.
- **재현**: `/docs/sitemap.xml` 으로 페이지 목록 확보 → 위 2개 번들로 chunk URL 산출 → 각 chunk 의 `"api":"eJ…"` 블롭을 base64 decode + zlib inflate → JSON.

## 2. 디렉토리 구조
```
spec/conventions/makeshop-api-catalog/
  _overview.md
  openapi/<section>.openapi.json   # 섹션별 OpenAPI 3 문서 (요청/응답 필드 풀 스키마 = SoT)
  <section>.md                     # 사람 가독 카탈로그 표 (cafe24 스타일)
```

## 3. 카탈로그 표 컬럼

| 컬럼 | 설명 |
|------|------|
| `id` | 메이크샵 operationId (예: `get-information`, `post-cart-create`). 섹션 내 unique |
| `라벨 (한)` | 공식 문서 페이지 제목 |
| `method` | `GET`/`POST` (webhook 은 `EVENT`) |
| `path` | 공통 prefix `/api/v1/{shopId}/` 생략한 상대 경로 |
| `권한 (x-scope)` | 메이크샵 권한 그룹 (주문/상품/상점 설정/회원/게시판/적립금/쿠폰) |
| `docs` | 공식 문서 페이지 URL |

## 4. Coverage Matrix

| Section | REST | Webhook | 권한 그룹 |
|---------|------|---------|-----------|
| [상점 설정](./shop.md) | 39 | 0 | 상점 설정, 주문 |
| [상품](./product.md) | 37 | 0 | 상품 |
| [주문](./order.md) | 34 | 0 | 주문 |
| [회원](./member.md) | 16 | 0 | 상품, 회원 |
| [혜택](./benefit.md) | 15 | 0 | 적립금, 쿠폰, 회원 |
| [게시판](./board.md) | 12 | 0 | 게시판 |
| [CPIK](./cpik.md) | 8 | 11 | 주문, 회원 |
| **합계** | **161** | **11** | |

- **인증**: 전부 `bearerAuth`, path 전부 `/api/v1/{shopId}/` 템플릿.

- **CPIK 섹션**: 외부 연동(장바구니/회원 join·login/online_order) REST + 상품·주문·배송·카테고리 변경 **webhook 이벤트**로 구성. webhook 은 호출형 REST 가 아니라 워크플로 trigger 노드 매핑 대상이다.
