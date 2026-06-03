# Convention Compliance Review

검토 모드: 구현 착수 전 검토 (--impl-prep)
검토 범위: `spec/4-nodes/4-integration/` (0-common · 1-http-request · 2-database-query · 3-send-email · 4-cafe24 · 5-makeshop) + `spec/conventions/makeshop-api-catalog/` + `spec/conventions/makeshop-api-metadata.md`

---

## 발견사항

### [INFO] 0-common.md — "세멘틱" 오타
- target 위치: `spec/4-nodes/4-integration/0-common.md §4` 섹션 제목 "4. Handler 실행 세멘틱"
- 위반 규약: 규약 직접 위반은 아니나 한국어 맞춤법 표준에서 "시맨틱(semantic)"이 올바른 외래어 표기 ("세멘틱" 아님). 하지만 일관성 문제라 아래 별도 항목과 교차 확인 시 문서 내 혼용도 존재.
- 상세: `0-common.md` 본문 §4 제목에서 "세멘틱(semantic)" 을 사용하고, `2-database-query.md §3.2` 에서는 동일 개념을 "시맨틱"으로 표기. 동일 문서 계층 내 혼용.
- 제안: 전체 integration 문서에서 "시맨틱(semantic)" 으로 통일.

### [INFO] 0-common.md §3 — 공통 출력 구조 예시에 `port` 기본값 명시
- target 위치: `spec/4-nodes/4-integration/0-common.md §3` JSON 예시, `"port": "success"` 하드코딩
- 위반 규약: `spec/conventions/node-output.md Principle 5` — `port: undefined` 가 "기본 단일 출력(outputs 가 1개)" 을 의미함. Principle 11 — `undefined` 필드는 JSON 예시에서 생략.
- 상세: §3 공통 예시는 포트 라우팅 개요를 설명하는 목적의 개념 예시이므로 `"port": "success"` 는 의도적일 수 있으나, Principle 11 의 규칙("undefined 필드는 JSON 예시에서 생략")과 Principle 5 의 관례 측면에서 각 노드별 문서에서 port 생략 여부를 일관적으로 다루는 것이 바람직함.
- 제안: 개념 예시임을 명시하는 주석 추가 혹은 노드별 실제 예시로 유도하는 문구 보강. 큰 위반은 아님.

### [WARNING] 5-makeshop.md — `status` frontmatter 값 `spec-only` 가 spec-impl-evidence 비표준 값
- target 위치: `spec/4-nodes/4-integration/5-makeshop.md` frontmatter `status: spec-only`
- 위반 규약: `spec/conventions/spec-impl-evidence.md` — spec 문서 frontmatter 의 `status` enum 표준 값은 `implemented` / `partial` / `planned` / `archived` 가 정규 vocab. `spec-only` 는 비표준 값임.
- 상세: 같은 worktree 의 `spec/conventions/makeshop-api-metadata.md` 도 `status: spec-only` 를 사용. 이 값은 기존 표준 (`spec/conventions/spec-impl-evidence.md`) 의 enum 에 없다. `planned` 가 의미적으로 가장 가깝고, 구현 전 spec 이라는 상태를 표현하는 용도로는 `planned` 가 규약 부합.
- 제안: `status: spec-only` → `status: planned` 로 변경. 또는 `spec-impl-evidence.md` 에 `spec-only` 를 정식 enum 으로 추가하고 그 의미를 정의 (규약 갱신 필요 시 그 점 명시).

### [WARNING] spec/conventions/makeshop-api-catalog/_overview.md — frontmatter 없음
- target 위치: `spec/conventions/makeshop-api-catalog/_overview.md` 파일 최상단
- 위반 규약: CLAUDE.md `spec/conventions/<name>.md` 규약 파일 관례 + Cafe24 카탈로그 `_overview.md` 패턴. `spec/conventions/cafe24-api-catalog/_overview.md` 는 frontmatter 없음으로 동일하므로 **직접 규약 위반 아님**이나, 동일 디렉토리의 resource 파일들(`shop.md`, `product.md` 등)은 `id`/`status`/`code`/`pending_plans` frontmatter 를 갖추고 있어 일관성이 결여됨.
- 상세: `spec/conventions/makeshop-api-catalog/shop.md` 등 resource 파일들은 `status: spec-only` frontmatter 를 가짐. 그러나 `_overview.md` 자체는 frontmatter 없이 `# CONVENTION:` 제목으로 시작. Cafe24 `_overview.md` 도 동일 패턴이나 resource 파일들이 frontmatter 없는 것에 비해 makeshop resource 파일들은 있음.
- 제안: `_overview.md` 에도 최소 `id: makeshop-api-catalog-overview` / `status: spec-only` frontmatter 추가 (Cafe24 패턴과 정렬), 또는 resource 파일들의 frontmatter 를 제거하여 Cafe24 패턴과 동일하게 일관화.

### [WARNING] spec/conventions/makeshop-api-catalog/ resource 파일들 — `status: spec-only` 비표준 + frontmatter 불필요 패턴
- target 위치: `spec/conventions/makeshop-api-catalog/shop.md`, `product.md`, `order.md`, `member.md`, `benefit.md`, `board.md`, `cpik.md` — 7개 파일 모두
- 위반 규약: `spec/conventions/spec-impl-evidence.md` status enum + `spec/conventions/cafe24-api-catalog/application.md` 비교 패턴 (Cafe24 카탈로그 파일 참조). Cafe24 카탈로그 resource 파일들(`application.md` 등)은 `id`/`status: implemented`/`code:` frontmatter 를 가지는데, 이는 해당 파일이 구현된 메타데이터 대응임을 나타낸다. makeshop resource 파일들이 `status: spec-only` + `code: []` 를 가지는 것은 의미론적으로 일치하지 않음 — cafe24 catalog resource 파일의 `status: implemented` 는 "해당 resource 의 backend 메타데이터가 구현됨"을 나타내는데, makeshop 은 아직 구현 전이므로 cafe24 패턴을 그대로 쓰면서 `status: spec-only` 를 넣는 것이 부자연스러움.
- 상세: 더 근본적으로, makeshop catalog 는 `_overview.md §주의` 설명대로 "구현 전 단계 순수 레퍼런스"이므로, cafe24 resource 파일들처럼 backend code 와 1:1 대응되는 frontmatter 구조가 아직 의미가 없음. 순수 레퍼런스 문서로서 frontmatter 를 간소화하거나 별도 패턴을 정의할 필요.
- 제안: (a) 구현 전 catalog 파일들의 frontmatter 를 제거하거나 최소화하여 `_overview.md` 와 동일하게 정렬, (b) 또는 `status: planned` 로 통일하여 spec-impl-evidence 규약 준수. 규약 갱신이 더 적절하다면 spec-impl-evidence.md 에 `spec-only` 를 정식 enum 으로 등재할 것.

### [WARNING] 5-makeshop.md §5 출력 구조 — Principle 11 포맷 미참조
- target 위치: `spec/4-nodes/4-integration/5-makeshop.md §5` 출력 구조 서두
- 위반 규약: `spec/conventions/node-output.md Principle 11` — "각 노드 문서의 Output 섹션은 `CONVENTIONS Principle 11 포맷`" 참조를 명시. 기존 구현 파일들(`1-http-request.md §5`, `2-database-query.md §5`, `3-send-email.md §5`) 은 모두 `> CONVENTIONS Principle 11 포맷.` 주석을 섹션 서두에 둠.
- 상세: `5-makeshop.md §5` 의 서두에는 해당 주석이 없다. 내용 자체는 5필드 envelope 를 따르고 있으나, Principle 11 참조 표기가 누락됨.
- 제안: `spec/4-nodes/4-integration/5-makeshop.md §5` 서두에 `> CONVENTIONS Principle 11 포맷. JSON 예시는 undefined 필드 생략, 5필드 (config/output/meta?/port?/status?) 외 top-level 키 금지.` 주석 추가.

### [INFO] 5-makeshop.md §5.1 — `output` 의 `타입` 컬럼 누락
- target 위치: `spec/4-nodes/4-integration/5-makeshop.md §5.1` 출력 필드 표
- 위반 규약: `spec/conventions/node-output.md Principle 11` — 예시 표는 `필드 | 타입 | 출처 | 설명` 컬럼 구조가 다른 Integration 노드 문서들의 표준 패턴.
- 상세: `5-makeshop.md §5.1` 의 출력 필드 표는 `필드 | 출처 | 설명` 3열로 `타입` 컬럼이 빠져 있음. `§5.3` 도 동일. 다른 노드들(`0-common.md §3`, `1-http-request.md §5.1`, `2-database-query.md §5.1`, `3-send-email.md §5.1`) 은 `타입` 컬럼 포함.
- 제안: `§5.1` 과 `§5.3` 의 필드 표에 `타입` 컬럼 추가.

### [INFO] spec/conventions/makeshop-api-catalog/ — `_overview.md` 제목 패턴이 Cafe24 와 불일치
- target 위치: `spec/conventions/makeshop-api-catalog/_overview.md` 첫 줄 `# CONVENTION: Makeshop API Catalog — Overview`
- 위반 규약: `spec/conventions/cafe24-api-catalog/_overview.md` 참조 패턴. Cafe24 는 `# CONVENTION: Cafe24 API Catalog — Overview` 이고 makeshop 은 `# CONVENTION: Makeshop API Catalog — Overview` (브랜드명 대문자 규칙 차이: "Makeshop" vs 공식 브랜드 "MakeShop").
- 상세: 브랜드 공식 표기는 "MakeShop" (대문자 M·S)이나 `_overview.md` 제목은 "Makeshop" (소문자 s). 같은 파일 안 본문에서는 "MakeShop" 으로 일관되게 쓰고 있어 제목만 불일치.
- 제안: `_overview.md` 제목을 `# CONVENTION: MakeShop API Catalog — Overview` 로 수정.

### [INFO] 5-makeshop.md §4 step 6 — `token_expires_at` 필드명 의존
- target 위치: `spec/4-nodes/4-integration/5-makeshop.md §4 step 6`
- 위반 규약: 직접 규약 위반은 아님. 참고 패턴.
- 상세: `Integration.token_expires_at` 가 data-model 컬럼으로 사용됨. `spec/1-data-model.md §2.10` Integration 엔티티에 이 컬럼이 공식 정의되어 있는지 확인 필요. Cafe24 §4 step 6 에서 동일하게 참조하므로 기존 패턴과 일관되나, makeshop spec 작성 시 data-model 명시 참조가 없음.
- 제안: `token_expires_at` 에 `([데이터 모델 §2.10](../../1-data-model.md#210-integration))` 참조 링크 추가.

### [WARNING] spec/conventions/makeshop-api-catalog/shop.md — `id` 값 패턴이 메타데이터 형식과 충돌 위험
- target 위치: `spec/conventions/makeshop-api-catalog/shop.md` 표 `id` 컬럼 값 예: `get-cart_free_config-update`, `get-crm_board_config`
- 위반 규약: `spec/conventions/makeshop-api-metadata.md §2` — operation `id` 는 "MakeShop operationId (하이픈 포함)" 이라고 정의됨. `spec/conventions/makeshop-api-catalog/_overview.md §3` — `id` 컬럼 설명: "메이크샵 operationId (예: `get-information`, `post-cart-create`). 섹션 내 unique".
- 상세: `shop.md` 의 일부 `id` 값이 하이픈과 언더스코어를 혼용함 (예: `get-cart_free_config`, `get-cart_free_config-update`, `get-crm_board_config`). 이는 MakeShop 공식 operationId 에서 비롯된 것이므로 규약 위반이라기보다는 MakeShop 공식 문서의 혼용 패턴을 그대로 반영한 것. 그러나 MCP sanitize(`get-cart_free_config` → `get_cart_free_config`) 시 언더스코어가 이미 포함된 경우 도구 이름 충돌 위험이 §8.1 에서 언급한 하이픈→언더스코어 치환과 결합하면 `get-cart_free_config` 와 `get_cart_free_config` 가 같은 이름으로 sanitize 됨.
- 제안: `5-makeshop.md §8.1` 또는 `makeshop-api-metadata.md §7` 에 언더스코어 + 하이픈 혼용 operationId의 MCP sanitize 충돌 방지 정책을 명시. 구현 착수 전 catalog 전체 operationId 의 (하이픈을 언더스코어로 치환 후) 중복 여부를 검증하는 절차 추가 필요.

### [CRITICAL] spec/conventions/makeshop-api-catalog/ — `status` 컬럼 없는 catalog 표가 catalog-sync 테스트 체계와 연결 불명확
- target 위치: `spec/conventions/makeshop-api-catalog/_overview.md` 전체 + `spec/conventions/makeshop-api-metadata.md §5`
- 위반 규약: `spec/conventions/cafe24-api-catalog/_overview.md §4 동기 정책 (Sync Contract)` — cafe24 catalog 의 핵심 보호는 `status` 컬럼 기반 catalog-sync 테스트. makeshop catalog 는 이 보호 없이 `구현 전 레퍼런스`로만 존재.
- 상세: 이 자체는 의도된 설계이고 `_overview.md` 에서 명시적으로 설명하고 있다("구현 전 단계라 대응 백엔드 메타데이터·sync test 가 아직 없다"). **그러나** 구현 착수 시 catalog 에 `status` 컬럼을 추가해야 한다는 **구체적 절차**가 `makeshop-api-metadata.md §5` 에 있는 반면, catalog `_overview.md` 자체에는 "구현 착수 시 sync 체계로 승격한다"는 언급만 있고 `status` 컬럼 enum 값(`supported`/`planned`) 이나 추가 컬럼 (`paginated`) 에 대한 사전 정의가 없어, 구현 PR 시 담당자가 Cafe24 카탈로그를 독립적으로 참조해야 함. 이는 spec 내 정보 분산으로 단일 진실 원칙 위반.
- 제안: `makeshop-api-catalog/_overview.md` 에 "구현 착수 시 추가할 컬럼" 섹션을 두어 `status` enum(`supported`/`planned`), `paginated`, `restricted` 여부(미도입)를 미리 정의하고, cafe24 `_overview.md §3` 에 대응하는 컬럼 정의를 pre-emptive 하게 문서화. 이렇게 하면 구현 PR 에서 담당자가 catalog 에만 의존해 작업 가능.

---

## 요약

`spec/4-nodes/4-integration/` 의 기존 구현 파일들 (`0-common.md`·`1-http-request.md`·`2-database-query.md`·`3-send-email.md`·`4-cafe24.md`) 은 `spec/conventions/node-output.md` 의 5필드 invariant·Principle 7 config echo·Principle 3.2 에러 envelope·Principle 11 문서화 포맷을 잘 준수하고 있다. 신규 작성된 `5-makeshop.md` 와 `spec/conventions/makeshop-api-catalog/`·`makeshop-api-metadata.md` 는 Cafe24 패턴을 구조적으로 잘 따르고 있으나, frontmatter `status: spec-only` 가 `spec-impl-evidence.md` 규약의 비표준 값이고, catalog `_overview.md` 에 구현 착수 시 필요한 컬럼 정의가 분산되어 있어 단일 진실 원칙 관점에서 보완이 필요하다. MCP operationId 하이픈·언더스코어 혼용으로 인한 sanitize 충돌 위험도 구현 전에 명확히 해두어야 한다.

---

## 위험도

MEDIUM
