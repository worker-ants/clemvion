# 신규 식별자 충돌 검토 결과

검토 대상: `spec/conventions/cafe24-api-catalog/` (18 resource 카탈로그 전체)
검토 모드: 구현 착수 전 (--impl-prep)

---

### 발견사항

- **[WARNING]** `control` — 지나치게 범용적인 operation ID
  - target 신규 식별자: `control` (`spec/conventions/cafe24-api-catalog/order.md` line 549, status=`planned`)
  - 기존 사용처: `spec/conventions/cafe24-api-catalog/_overview.md` §2 에서 operation id 패턴을 `<resource>_<verb>` 또는 `<resource>_<sub>_<verb>` 로 정의. 전체 카탈로그에서 단음절·비접두 식별자는 본 row 가 유일.
  - 상세: 18 resource × 370+ row 에 걸쳐 모든 operation ID 는 `order_list`, `product_get`, `brands_create` 처럼 resource prefix 를 포함한다. `control` 은 resource prefix 가 없어 카탈로그 규약(`<resource>_<verb>`)을 위반한다. `catalog-sync.spec.ts` 의 id 유니크 검사는 "resource 내 unique" 이므로 이 row 가 다른 resource 에도 동일 이름으로 등재되면 충돌이 감지되지 않는다. 또한 `planned` 상태로 Cafe24 공식 anchor URL 이 `#order-control` 이므로 구현 시점에 `order_control` 로 rename 해야 할 가능성이 높다.
  - 제안: Cafe24 공식 문서 제목("Order control")에 맞춰 `order_control` 로 즉시 수정. `planned` 상태이므로 backend metadata 변경 없이 카탈로그만 수정하면 된다.

- **[WARNING]** `social_list` — resource prefix 없는 operation ID
  - target 신규 식별자: `social_list` (`spec/conventions/cafe24-api-catalog/customer.md`)
  - 기존 사용처: 카탈로그 규약(`_overview.md` §2) — id 패턴 `<resource>_<verb>` 또는 `<resource>_<sub>_<verb>`.
  - 상세: 같은 파일(customer.md) 의 다른 row 는 모두 `customer_*` 또는 `customers_*` prefix 를 가진다. `social_list` 만 `customer` prefix 를 생략해 resource 귀속이 불명확하다. `catalog-sync.spec.ts` 는 이 id 를 customer resource 에 대응하는 메타데이터와 매핑하므로 backend 에서 `social_list` key 를 customer 메타데이터로 등록해야 한다. 만약 향후 별도 `social` resource 카탈로그가 신설된다면 동일 id 충돌이 발생할 수 있다.
  - 제안: `customers_social_list` 로 rename (Cafe24 endpoint: `GET /social` 를 customer resource 하위로 관리한다는 의미를 명시). backend 메타데이터 key 도 함께 갱신 필요.

- **[WARNING]** `application` resource 카탈로그와 Integration `app_type` 의 잠재적 혼동
  - target 신규 식별자: `spec/conventions/cafe24-api-catalog/application.md` — resource 이름 `application`
  - 기존 사용처: `spec/1-data-model.md` §2.10 Integration.`service_type` 값 중 `cafe24` + Integration 화면 spec 의 `app_type` (`public` / `private`). `spec/0-overview.md` §6.2 에서 "Cafe24 통합 — Public/Private OAuth 앱" 으로 지칭.
  - 상세: `application.md` 의 헤더 주석("우리 서비스의 Integration `app_type` (Public/Private OAuth 앱 등록)과 무관")이 이미 이 혼동을 인지하고 경고를 달아 두었다. 카탈로그 자체의 collision 은 아니나, `Cafe24Resource.application` enum 값과 "우리 서비스의 application(app) 등록" 개념 사이의 언어적 혼동이 코드 리뷰·구현 시 반복 발생할 수 있다.
  - 제안: 현재 자체 주석으로 충분히 경고가 되어 있으므로 즉각 조치는 불필요. 다만 backend 메타데이터·UI 레이블에서 "Cafe24 Application 관리" 같은 표현보다 "Cafe24 앱스토어 관리" 처럼 도메인 맥락을 명시하는 것을 권장.

- **[INFO]** `mains_list` / `autodisplay_list` — category resource 안의 비접두 하위 resource ID
  - target 신규 식별자: `mains_list`, `mains_add`, `mains_update`, `mains_delete`, `autodisplay_list`, `autodisplay_create`, `autodisplay_update`, `autodisplay_delete` (category.md)
  - 기존 사용처: 없음. 카탈로그 내부 식별자.
  - 상세: 이들 ID 는 `category_` prefix 없이 Cafe24 endpoint 의 resource path(`mains`, `autodisplay`)를 그대로 사용한다. `_overview.md` §2 의 공식 패턴은 `<resource>_<sub>_<verb>` (예: `product_options_create`) 인데, `mains_add` 는 `category_mains_add` 가 더 정확한 패턴이다. 현재는 category resource 파일 내에서만 존재하므로 실제 충돌은 없으나, 향후 다른 resource 에 `mains_*` 패턴의 operation 이 추가될 경우 파일 간 id 유일성이 깨진다 (카탈로그 규약상 id unique 범위가 "resource 내"이므로 기술적으로 허용은 되나 혼동 가능).
  - 제안: `_overview.md` §2 주석에 "resource path 가 resource 이름과 다른 경우 (예: category resource 의 `mains`, `autodisplay`)는 예외적으로 sub-resource path 를 prefix 로 사용한다" 는 설명을 명시해 규약과의 불일치를 문서화.

- **[INFO]** `status` 컬럼 enum 과 `Integration.status` enum 의 어휘 중복
  - target 신규 식별자: catalog 컬럼 `status` 의 값 `supported` / `planned` / `deprecated` (`_overview.md` §3)
  - 기존 사용처: `spec/1-data-model.md` §2.10 Integration.`status` enum = `connected` / `expired` / `error` / `pending_install`
  - 상세: 두 `status` enum 은 완전히 다른 도메인(카탈로그 coverage vs. OAuth 연결 상태)에서 사용되며 직접 충돌은 없다. 그러나 두 개념 모두 "cafe24" 와 연관되어 있어 코드리뷰나 문서 탐색 시 혼동될 소지가 있다.
  - 제안: 이미 각 spec 에서 독립 정의되고 있으므로 조치 불필요. 인지 사항으로 기록.

- **[INFO]** `origin_list` — `origin` path 의 단수 id
  - target 신규 식별자: `origin_list` (collection.md, `GET origin`)
  - 기존 사용처: 없음.
  - 상세: 같은 파일 내 다른 id 는 `brands_list`, `manufacturers_list` 처럼 복수 resource path 를 따르는데, `origin` 은 Cafe24 endpoint path 자체가 단수(`GET /origin`)이다. 패턴 불일치는 Cafe24 공식 API 설계에서 비롯된 것이며 카탈로그 자체 오류는 아니다.
  - 제안: 조치 불필요. Cafe24 공식 path 를 그대로 반영한 것이므로 카탈로그 규약에 단수 path 예외를 허용한다는 주석 추가 정도면 충분.

---

### 요약

`spec/conventions/cafe24-api-catalog/` 의 18 resource 카탈로그 전체를 기존 spec 및 코퍼스 대상으로 검토한 결과, CRITICAL 등급의 식별자 충돌은 발견되지 않았다. 주요 위험 요소는 두 가지다. 첫째, `order.md` 의 `control` operation ID 는 카탈로그 규약(`<resource>_<verb>`)을 위반하는 유일한 사례로, 구현 시점에 rename 이 불가피하며 지금 수정하는 것이 낫다. 둘째, `customer.md` 의 `social_list` 는 resource prefix 없이 등재되어 향후 `social` resource 카탈로그 신설 시 중복 위험이 있다. 파일 경로·API endpoint·환경변수·이벤트명 차원의 충돌은 식별되지 않았으며, `application` resource 와 서비스 자체의 `app_type` 간 혼동은 이미 파일 헤더 주석으로 선제 경고되어 있다.

### 위험도

LOW
