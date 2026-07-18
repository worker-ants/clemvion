# 신규 식별자 충돌 검토 — spec/conventions/ (Cafe24 API Catalog field-level 확장)

## 범위 요약

target 은 `spec/conventions/cafe24-api-catalog/` 하위 문서(`_overview.md`, `application.md`/`application/*.md`, `category.md`/`category/autodisplay.md` 등)이며, 실질적으로 Cafe24 공식 Admin API 를 resource/entity 단위로 mirror 하는 **field-level 상세 카탈로그**(`<resource>/<entity_id>.md`, 총 222개 중 일부가 target 에 포함) 확장이다. 이 레이어는 §7.1 에 의해 `spec-impl-evidence.md` 의 lifecycle frontmatter(`id`/`status`) 의무에서 명시적으로 **제외**되므로, 신규 `id:` 슬러그(요구사항 ID)를 새로 발급하지 않는다 — 요구사항 ID 충돌 카테고리는 이 배치에서 원천적으로 해당 사항이 없다.

## 발견사항

- **[INFO]** frontmatter 키 `entity:` 가 기존 "Entity"(Graph RAG 개체 추출 모델) 와 이름이 겹침
  - target 신규 식별자: `spec/conventions/cafe24-api-catalog/<resource>/<entity_id>.md` frontmatter 의 `entity: <sub-resource-id>` (예: `entity: apps`, `entity: autodisplay`)
  - 기존 사용처: `spec/1-data-model.md §2.12.2 Entity` (`entities` 테이블 — Graph RAG 에서 추출된 named entity, `entity_id` 컬럼이 `Relation`/`ChunkEntity` 에서 FK 로 재사용됨, §2.12.3/§2.12.4)
  - 상세: 하나는 Cafe24 API 의 "sub-resource 식별자"(예: `apps`, `appstore-orders`)를 가리키는 YAML 메타데이터 키이고, 다른 하나는 Knowledge Base Graph RAG 파이프라인에서 LLM 이 추출한 명명 개체(person/organization/...)를 가리키는 DB 모델·컬럼명이다. 둘 다 소문자 `entity`/`entity_id` 토큰을 쓰므로 전역 grep("entity") 시 두 도메인이 섞여 나온다. 다만 파일 위치(`spec/1-data-model.md` vs `spec/conventions/cafe24-api-catalog/**`)와 문맥이 뚜렷이 분리돼 있고, cafe24 카탈로그의 `entity:` 는 스칼라 YAML 필드일 뿐 타입/인터페이스로 코드에 노출되지 않아 실질 충돌(컴파일·런타임) 가능성은 낮다.
  - 제안: 코드 영향은 없으므로 필수 조치는 아님. 문서 검색성을 높이려면 frontmatter 키를 `sub_resource:` 등으로 바꾸는 안을 고려할 수 있으나, 이미 (추정) 222개 파일에 동일 스킴이 적용돼 있어 일괄 rename 비용 대비 실익이 낮다 — 현행 유지 권장.

- **[WARNING]** `store` resource 의 `privacy_*` id 접두어가 별도 `privacy` resource 와 프리픽스 충돌 (target 문서 자체가 인지·미해결로 명시)
  - target 신규 식별자: `spec/conventions/cafe24-api-catalog/store.md` 의 `privacy_*` 로 시작하는 operation `id` (target 본문에는 직접 포함되지 않았으나 `_overview.md §5` 각주에서 명시)
  - 기존 사용처: `spec/conventions/cafe24-api-catalog/privacy.md` — 별도 top-level resource `privacy` (개인정보), `Cafe24Resource` enum 의 독립 값
  - 상세: `_overview.md` §5 각주(target 본문 233행)에 "`store.md` 의 `privacy_*` id 명명 우려 (별 `privacy` resource 와 prefix 충돌) 는 별 트랙으로 follow-up 가능" 이라고 명시돼 있다. `<resource>_<verb>` 명명 규약(§2)상 `privacy_*` 접두는 `privacy` resource 소속처럼 보이지만 실제로는 `store` resource 소속 id다. `CAFE24_OPERATIONS_BY_RESOURCE[resource][id]` 처럼 resource 로 네임스페이스가 나뉘어 있어 코드 레벨 충돌(동일 키 덮어쓰기)은 없지만, id 만 보고 resource 를 추정하는 사람(구현자·리뷰어)에게는 오인 소지가 있다 — 본 checker 의 "엔티티/타입명 충돌" 관점에 정확히 해당하는 사례다.
  - 제안: target 문서가 이미 자체적으로 인지·follow-up 트랙으로 defer 한 항목이므로 본 PR 의 블로커는 아니다. 다만 `store` 의 field-level 문서(`store/privacy-*.md` 류)가 이번 배치(또는 후속 배치)에 포함된다면, 파일 헤더 주석 또는 `_overview.md §5` 각주 링크를 통해 "이 id 는 `privacy` resource 가 아니라 `store` resource 소속" 임을 명시적으로 재확인할 것을 권장.

## 긍정 확인 (충돌 예방이 이미 적절히 처리된 사례)

- `spec/conventions/cafe24-api-catalog/application.md` 상단에 "본 resource 는 Cafe24 앱 관리 API 다. 우리 서비스의 Integration `app_type`(Public/Private OAuth 앱 등록)과 무관 — naming collision 회피 참고" 라는 명시적 disambiguation 주석이 있다. 실제로 `Integration.app_type`(`oauth/begin (app_type=private)` 등, corpus `spec/1-data-model.md` Integration 섹션)은 우리 서비스의 별개 필드로 존재가 확인되며, 이름이 겹칠 수 있는 두 "application" 개념을 target 문서가 스스로 먼저 분리·주석 처리해 두었다. 이번 검토 기준으로는 모범 사례이며 추가 조치 불요.
- 신규 frontmatter 스킴(`resource`/`entity`/`cafe24_docs`/`source`)은 corpus 전체에서 다른 문서의 frontmatter 키로 재사용된 사례가 없어(grep 결과 전량 target 파일에만 출현) 스키마 레벨 충돌은 없다.
- 카탈로그가 다루는 endpoint(`GET /api/v2/admin/apps` 등)는 전부 Cafe24 vendor 소유의 외부 API 이며 `/api/v2/admin/` 접두로 명확히 네임스페이스가 분리돼 있어, 우리 자체 backend REST endpoint spec 과 겹칠 여지가 없다.
- `§7.3` 마지막 항목·plan corpus 의 "G-4 — 응답 래퍼 ↔ 요청 파라미터 이름 충돌"은 문서 자신이 이미 인지하고 generator 로직으로 회귀 방지 중인, 우리 checker 관점과 유사한 종류의(필드명) 충돌이며 별도 대응 완료/진행 중이라 추가 지적 불요.

## 요약

이번 target 은 Cafe24 공식 Admin API 를 mirror 하는 read-reference 성격의 field-level 카탈로그 확장으로, §7.1 규정에 따라 신규 spec `id:` 슬러그를 발급하지 않고, 신규 endpoint/이벤트/ENV 도 우리 시스템 소유가 아닌 외부 vendor API 라 기존 우리 spec 과 충돌할 표면이 거의 없다. 유일하게 실질적인 신규 식별자 충돌 후보는 (1) frontmatter `entity:` 키와 Graph RAG `Entity` 모델 간 용어 중복(코드 영향 없는 INFO), (2) `store` resource 의 `privacy_*` id 접두어와 별도 `privacy` resource 간 프리픽스 오인 소지(문서가 이미 인지·defer 한 WARNING)이며, 둘 다 CRITICAL 급 실사용 혼선으로 이어지지 않는다. 반대로 `application` resource ↔ `Integration.app_type` 충돌은 target 문서가 스스로 선제적으로 disambiguation 주석을 달아 처리한 모범 사례로 확인됐다.

## 위험도

LOW
