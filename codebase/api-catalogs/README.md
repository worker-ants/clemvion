# API 카탈로그 (Cafe24 · MakeShop)

외부 쇼핑몰 API 의 endpoint 전수 카탈로그다. backend 노드 메타데이터와 frontend 라벨 사전은 이 표에 맞춰 동기를 유지하고, 테스트가 표를 직접 파싱해 어긋남을 잡는다.

| 디렉터리 | 내용 | 형식 · 절차 |
| --- | --- | --- |
| [`cafe24/`](cafe24/_overview.md) | Cafe24 Admin API. resource 별 색인 `<resource>.md`, 필드 단위 `<resource>/<entity>.md`, 생성기 `_generator.py` | `cafe24/_overview.md` |
| [`makeshop/`](makeshop/_overview.md) | MakeShop Shop API. 섹션 별 색인 `<section>.md`, `openapi/<section>.openapi.json`, 생성기 `_generator.py` | `makeshop/_overview.md` |

## 정본과 NERV 사본

- 이 디렉터리가 정본이다. 스펙의 정본은 NERV 지만 카탈로그는 예외로 둔다. 생성기와 OpenAPI JSON 은 NERV 문서에 담을 수 없고, 대조 테스트가 이 파일들을 직접 읽기 때문이다. 근거는 각 `_overview.md` 의 Rationale 에 있다.
- 2026-10-02 `spec/conventions/<vendor>-api-catalog/` 에서 이 자리로 옮겼다(NERV Task `CLE-T-BD48J3`). 카탈로그 데이터(표 · 필드 · OpenAPI JSON)는 그대로 두고 위치 표기와 링크를 고쳤다. 두 `_overview.md` 에는 NERV 사본을 고치는 절차와 정본 위치의 근거를 더했다.
- NERV 의 `CLE-C24-CATALOG` · `CLE-MKS-CATALOG` 와 그 아래 문서(2026-10-02 기준 272편)는 이 디렉터리의 사본이다. 저장소 `spec/` 미러에는 넣지 않는다(`.claude/tools/nerv-mirror/pull.py` 의 `EXCLUDED_AREAS`).
- 사본 문서에 적힌 옛 경로(머리의 `원문:` 줄, MakeShop 섹션 문서의 `상위:` 줄 등)는 옮기기 전 경로다. `spec/conventions/<vendor>-api-catalog/` 를 `codebase/api-catalogs/<vendor>/` 로 바꿔 읽는다. 두 루트 문서는 머리에 `원문:` 과 함께 `정본:` 을 적는다.
- 사본이 정본과 어긋났는지 확인하는 자동 검사는 없다. 어긋나면 이 디렉터리가 이긴다.

## 카탈로그를 바꿀 때

1. 생성기를 다시 돌리거나 행을 고친다. 형식과 절차는 각 `_overview.md` 를 따른다.
2. 같은 PR 에서 backend 메타데이터와 frontend 라벨 사전을 맞춘다. 대조 테스트는 backend `catalog-sync` · `catalog-docs-drift` · `catalog-required-fields` · `api-catalog-index-frontmatter`(색인의 `id` · `status` · `code:`), frontend `cafe24-catalog-sync` · `makeshop-catalog-sync` 다. 이 디렉터리만 바꿔도 `backend-checks` · `frontend-checks` · `spec-link-checks` 가 돈다.
3. 바뀐 파일의 NERV 사본도 같은 작업에서 고친다. main 세션이 `/nerv:spec edit <KEY>` 로 초안을 쓰고 승인은 사람이 한다. 파일과 키는 이렇게 대응한다.
   - Cafe24 색인 `<resource>.md` → `CLE-C24-<RESOURCE>` (예: `customer.md` → `CLE-C24-CUSTOMER`)
   - Cafe24 필드 파일 `<resource>/<entity>.md` → `CLE-C24-<RESOURCE>-<ENTITY>`. 대문자로 쓰고 `__` 는 `--` 로 바꾼다(예: `customer/customers__memos.md` → `CLE-C24-CUSTOMER-CUSTOMERS--MEMOS`).
   - Cafe24 `_overview.md` → `CLE-C24-CATALOG`, MakeShop `_overview.md` → `CLE-MKS-CATALOG`
   - MakeShop 색인 `<section>.md` → `CLE-MKS-<SECTION>` (예: `benefit.md` → `CLE-MKS-BENEFIT`)
   - MakeShop 필드 문서는 `openapi/<section>.openapi.json` 의 태그마다 하나다. 문서 머리 `원문:` 줄에 태그가 적혀 있으니 `nerv_spec_search` 로 찾는다(예: 태그 `쿠폰` → `CLE-MKS-BENEFIT-COUPON`).

## 링크

- 카탈로그 본문에서 카탈로그 밖으로 가는 링크는 NERV 키 링크(`[글](<키>#앵커)`)로 적는다. NERV 사본과 같은 표기라서 사본을 고칠 때 링크를 따로 바꾸지 않는다. 전환 단계 5(NERV Task `CLE-T-7M4C4X`)에서 옛 `spec/<영역>/` 트리를 지우며 그 트리로 가던 링크를 사본의 키 링크로 바꿨다.
- 미러에 넣지 않는 카탈로그 영역의 키(`CLE-C24-META` · `CLE-C24-SCOPES` · `CLE-MKS-META`)도 같은 표기로 쓴다. 저장소에서는 그 문서를 열 수 없고 NERV 에서 읽는다.
- 링크 검사 가드(`spec-link-integrity`)는 이 디렉터리를 훑지 않는다. 링크로 감싼 키도 `spec-key-mentions` 가 미러에 있는지 본다. 미러하지 않는 카탈로그 영역의 키는 건너뛴다.
