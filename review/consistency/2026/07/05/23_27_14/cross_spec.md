### 발견사항

- **[WARNING]** `4-cafe24.md` 예시가 이번 PR 에서 폐기된 broken alias 필드명(`category_no`, `since`)을 여전히 인용
  - target 위치: `spec/4-nodes/4-integration/4-cafe24.md` §2 설정 UI ASCII mock (62·64행: `category_no` / `since`), §5.1 출력 구조 JSON 예시 (180행: `"since": "{{ $now.iso }}"`)
  - 충돌 대상: 같은 파일이 SoT 로 링크하는 `spec/conventions/cafe24-api-metadata.md` 및 `spec/conventions/cafe24-api-catalog/product/products.md`(공식 Cafe24 docs 미러) — 이번 diff 로 `codebase/backend/src/nodes/integration/cafe24/metadata/product.ts` 가 갱신되며 `product_list` operation 의 필드명이 `category_no`→`category`, `since`/`until`→`created_start_date`/`created_end_date` 로 교체됨 (코드 주석: "과거 비동작 alias …를 docs 명으로 교체했다")
  - 상세: 워크플로 저자가 `4-cafe24.md` 의 UI mock·JSON 예시를 그대로 따라 `category_no`/`since` 필드를 입력하면, 현재 메타데이터 스키마(`product.ts`)에 해당 키가 더 이상 존재하지 않아 프론트 동적 폼에 렌더되지 않거나(메타데이터 기반 폼이므로 임의 key 입력 경로 자체가 없음) 문서만 보고 API 응답 shape 을 오해할 위험이 있다. `cafe24-api-catalog/product/products.md`(정본)는 이미 `category`/`created_start_date` 로 정합되어 있어 `4-cafe24.md` 만 뒤처진 상태.
  - 제안: `4-cafe24.md` §2 mock 의 `category_no`→`category`, `since`→`created_start_date` 로 교체하고 §5.1 JSON 예시의 `"since"` 를 `"created_start_date"` 로 갱신. `product-planner` 후속 spec-sync 항목으로 등록 권장(코드가 이미 바뀐 필드명 기준으로 미러됐으므로 spec 쪽 수정이 맞는 방향).

### 요약
이번 diff 는 Cafe24 `product`(및 다른 리소스) 메타데이터 field-set 을 공식 docs 카탈로그와 전량 미러하는 작업으로, `spec/4-nodes/4-integration/**` 자체는 변경되지 않았고 데이터 모델·API 계약·요구사항 ID·상태 전이·RBAC·계층 책임 등 핵심 6개 관점에서 다른 영역과의 구조적 충돌은 발견되지 않았다(0-common/http-request/database-query/send-email 의 SSRF 일반화·에러코드·Usage 로그 계약은 `2-navigation/4-integration.md`·`chat-channel-adapter.md`·`1-data-model.md §2.10/2.10.1`과 모두 정합). 유일한 실질 이슈는 `4-cafe24.md` 의 UI mock·출력 예시가 이번 코드 변경으로 폐기된 구 필드명(`category_no`, `since`)을 여전히 보여줘 spec-code 간 예시 드리프트를 남긴 것으로, 구조적 CRITICAL 은 아니지만 사용자 혼선 방지를 위한 spec 갱신이 권장된다.

### 위험도
LOW
