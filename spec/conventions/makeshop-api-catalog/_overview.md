# CONVENTION: MakeShop API Catalog — Overview

> 관련: [MakeShop 공식 개발자센터](https://developer.makeshop.co.kr/docs/api/shop/상점-설정-정보) · 참고 패턴 [Cafe24 API Catalog](../cafe24-api-catalog/_overview.md)

본 디렉토리는 메이크샵 신형 Shop API(`/api/v1/{shopId}/…`, OAuth2 `bearerAuth`)의 **모든 endpoint** 를 섹션 단위로 enumerate 한 단일 진실(SoT)이다. 메이크샵 통합(AI agent MCP + workflow 노드) 구현에 **앞선 사전 준비 레퍼런스**로, cafe24-api-catalog 패턴을 따른다.

> **sync 승격 (Phase 0 완료)**: cafe24 catalog 와 동일하게, 본 makeshop catalog 는 backend 메타데이터(`codebase/backend/src/nodes/integration/makeshop/metadata/`)와 `catalog-sync.spec.ts` 양방향 test 로 보호된다. 섹션별 표에 `status`/`scope`/`paginated` 컬럼이 추가됐다 (§7). cafe24 와 달리 `restricted` 컬럼은 없다 — makeshop 은 별도 승인 티어가 없다 ([MakeShop 노드 §9.5](../../4-nodes/4-integration/5-makeshop.md#95-별도-승인restricted-scope-미도입)).

## 1. 추출 출처·재현 (provenance)

- **출처**: 메이크샵 개발자센터 (Docusaurus v3.9.2 + `docusaurus-theme-openapi-docs`).
- **추출일**: 2026-06-03.
- **방식**: 공개 `openapi.json` 엔드포인트는 없으나, 각 페이지의 완전한 OpenAPI 3 operation 객체가 페이지별 JS chunk 안에 `base64(zlib(JSON))` 로 임베드돼 있다. `main.js`(라우트 레지스트리)+`runtime.js`(webpack chunk 맵)으로 라우트→chunk URL 을 100% 해석 후 디코드. 인증 불필요, 브라우저 렌더링 불필요.
- **재현**: 동일 디렉토리의 [`_generator.py`](./_generator.py) 로 자동화됨 — `python3 _generator.py [--check] [--no-md]` (`--check` 는 파일을 쓰지 않고 현재 산출물과 diff 검증, `--no-md` 는 `<section>.md` 표 재생성 생략). 수동 절차(`/docs/sitemap.xml` 으로 페이지 목록 확보 → 위 2개 번들로 chunk URL 산출 → 각 chunk 의 `"api":"eJ…"` 블롭을 base64 decode + zlib inflate → JSON)는 스크립트에 코드로 고정돼 있다.

## 2. 디렉토리 구조
```
spec/conventions/makeshop-api-catalog/
  _overview.md
  _generator.py                    # 카탈로그 재생성 스크립트 (§1 추출 파이프라인을 코드로 고정)
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
| `scope` | `read`/`write` — 메타데이터 `scopeType` 과 일치 (wire scope `<scope-group>.<read\|write>`, §7) |
| `paginated` | `✓` 또는 빈칸 — 메타데이터 `paginated` 와 일치 |
| `status` | `supported`/`planned` — backend 메타데이터 row 존재 여부 (§4 status enum) |
| `docs` | 공식 문서 페이지 URL |

> REST 표 컬럼은 §7 의 sync 승격으로 위와 같이 확장됐다. webhook 표(`cpik.md`)는 `id / 라벨 (한) / event_code / docs` 컬럼을 유지한다 (trigger 후속).

> **English title 컬럼 없음** — MakeShop 공식 문서가 영문 제목을 별도 노출하지 않아 생략 (cafe24 카탈로그의 필수 `English title` 컬럼([cafe24-api-catalog `_overview.md §2`](../cafe24-api-catalog/_overview.md#2-표-컬럼-정의))과 다름).

## 4. status enum

REST 표의 `status` 컬럼이 가지는 값. cafe24 카탈로그([cafe24-api-catalog `_overview.md §3`](../cafe24-api-catalog/_overview.md#3-status-enum))의 status enum 과 동일 체계이며, makeshop 은 그중 두 값만 사용한다.

| 값 | 의미 | 백엔드 메타데이터 |
|-----|------|------|
| `supported` | 노드/MCP Bridge 에서 호출 가능 | backend 메타데이터(`codebase/backend/src/nodes/integration/makeshop/metadata/`) 에 row 존재 |
| `planned` | 카탈로그에 등재만, 미구현. UI 의 Operation 드롭다운에 **disabled + "지원 예정" 배지** 로 노출 | backend 메타데이터에 row 없음 |

- **`deprecated` 미사용**: cafe24 카탈로그는 외부 API endpoint 폐기 상태를 위한 `deprecated` 값을 두지만, makeshop 카탈로그는 이를 사용하지 않는다 (현재 폐기 endpoint 없음).
- 현재 161 REST operation 전부 `status: supported` 다 (§5 Coverage Matrix). `planned` row 의 `method`/`path`/`scope` 가 `?` 인 경우, 구현 시점에 공식 문서를 다시 검증한 뒤 `supported` 로 승격하며 정확한 값으로 갱신한다.
- §7 의 `catalog-sync.spec.ts` 양방향 테스트가 status enum 값(`supported`/`planned` 외 금지)과 메타데이터 정합을 강제한다.

## 5. Coverage Matrix

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

## 6. 신규 endpoint 등재 절차

1. MakeShop 공식 문서에서 endpoint 확인.
2. 본 카탈로그 해당 섹션 파일(`<section>.md`)에 표 row 추가:
   - 처음 등재 시 `status: planned`, `method`/`path` 는 `?` 허용.
   - 구현 PR 에서 backend 메타데이터(`codebase/backend/src/nodes/integration/makeshop/metadata/`) row 1줄 추가 + 카탈로그 row 를 `planned → supported` 로 갱신 + `method`/`path`/`scope`/`paginated` 채움.
3. `_overview.md §5` 의 Coverage Matrix 카운트도 함께 갱신.
4. `npm test --workspace backend -- catalog-sync` 통과 확인.

> 카탈로그 row 갱신과 backend 메타데이터 row 추가는 **같은 PR** 에 묶는다 (cafe24 catalog([`_overview.md §6`](../cafe24-api-catalog/_overview.md#6-신규-endpoint-등재-절차))와 동일 체계). [`spec/conventions/makeshop-api-metadata.md §6`](../makeshop-api-metadata.md#6-신규-endpoint-등재-절차) 의 신규 endpoint 추가 절차도 본 카탈로그 row 갱신을 step 으로 포함한다.

## 7. 추가 컬럼 (sync 승격 — Phase 0 에서 추가 완료)

Phase 0 에서 섹션별 카탈로그(`<section>.md`)에 아래 컬럼을 추가 완료했고, `catalog-sync.spec.ts` 양방향 테스트로 보호한다 (cafe24 catalog([cafe24-api-catalog `_overview.md §2·§3`](../cafe24-api-catalog/_overview.md))와 동일 체계). 현재 모든 161 REST op 이 `status: supported` 로 등록돼 있다.

| 추가 컬럼 | 값 | 정의 |
|----------|-----|------|
| `status` | `supported` / `planned` | §4 status enum 참조 — `supported` = backend 메타데이터에 row 존재(노드/MCP 호출 가능), `planned` = 카탈로그 등재만, 미구현(UI "지원 예정"). cafe24 의 `deprecated` 는 makeshop 미사용 |
| `scope` | `read` / `write` | `<x-scope>.read` / `.write` 의 가운데 토큰 (메타데이터 `scopeType` 과 일치) |
| `paginated` | `✓` 또는 빈칸 | 메타데이터 `paginated: boolean` 과 일치 |

> **restricted 컬럼 없음**: cafe24 와 달리 makeshop 은 per-scope/operation 별도 승인 티어가 없다 ([MakeShop 노드 §9.5](../../4-nodes/4-integration/5-makeshop.md#95-별도-승인restricted-scope-미도입)) → `restricted` 컬럼·`restrictedApproval` 메타데이터 미도입. Phase 0 에서 `MakeshopOperationMetadata` 는 cafe24 형식에서 `restrictedApproval` 을 제거한 형태 ([makeshop-api-metadata §2](../makeshop-api-metadata.md#2-operation-메타데이터-형식)).
