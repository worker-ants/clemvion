# 신규 식별자 충돌 검토 — `spec/5-system/1-auth.md` · `spec/5-system/10-graph-rag.md`

## 검토 범위 및 방법

Target: `spec/5-system/1-auth.md`(status: partial), `spec/5-system/10-graph-rag.md`(status: implemented).
두 문서가 도입/사용하는 식별자(요구사항 ID, 엔티티/테이블명, API endpoint, WS/큐 이벤트명, ENV var, 파일 경로)를 추출해 payload 에 포함된 검색 대상 코퍼스(`spec/0-overview.md`, `spec/1-data-model.md`, `spec/conventions/*`, `plan/in-progress/*` 등)와 대조했다.

대조 대상:
- 요구사항 ID: `KB-GR-MD-*`, `KB-GR-EX-*`, `KB-GR-DM-*`, `KB-GR-SR-*`, `KB-GR-PA-*`, `KB-GR-UI-*`, `KB-GR-OB-*`, `NF-GR-*`
- 엔티티/테이블: `Entity`, `Relation`, `ChunkEntity` (+ 컬럼 `rag_mode`, `extraction_llm_config_id`, `max_hops`, `vector_seed_top_k`, `expanded_chunk_limit`, `entity_count`, `relation_count`, `graph_extraction_status`)
- API endpoint: `/api/knowledge-bases/:id/documents/:docId/re-extract`, `/api/knowledge-bases/:id/re-extract`, `GET /:id/graph/stats`, `/api/knowledge-bases/:id/retry-failed`, `/api/auth/*` 전체, `/api/invitations/:token`, `/api/audit-logs`
- 큐/이벤트: BullMQ `graph-extraction` 큐, WS `document:graph_started/_progress/_completed/_retry/_failed`
- ENV var: `WEBAUTHN_RP_ID`, `WEBAUTHN_RP_NAME`, `WEBAUTHN_ORIGIN`, `WEBAUTHN_ALLOW_FALLBACK`, `JWT_SECRET`, `TRUST_CF_CONNECTING_IP`, `COOKIE_SAMESITE`, `INVITATION_THROTTLE`
- 감사 액션: `auth_config.*`, `user.*`, `model_config.*`, `workspace.*`, `member.*`
- 파일 경로: `spec/5-system/10-graph-rag.md` 번호 슬롯

## 발견사항

- **[INFO]** "Entity" 용어의 도메인 간 중복 사용
  - target 신규 식별자: `spec/5-system/10-graph-rag.md` §2.3 `Entity`(그래프 RAG 데이터 모델 테이블, `id/name/type/mention_count/...`)
  - 기존 사용처: `spec/conventions/cafe24-api-catalog/_overview.md` §7 "Field-level 상세 레이어 (`<resource>/<entity>.md`)" — 여기서 "entity" 는 Cafe24 API 의 sub-resource 식별자(예: `product/products.md`)를 가리키는 컨벤션 용어
  - 상세: 두 "entity" 는 완전히 다른 문서 영역(그래프 RAG 데이터 모델 vs 외부 API 카탈로그 파일 명명 규약)에서 쓰이고, 코드 레벨 타입명·테이블명 충돌은 없다(카탈로그 쪽은 정식 코드 엔티티가 아닌 문서 파일 단위 별칭). 실질적 혼선 가능성은 낮으나 두 문서를 동시에 다루는 사람에게는 용어 재사용이 눈에 띈다.
  - 제안: 별도 조치 불요. 두 문서 모두 이미 "entity" 를 각자 맥락에서 명확히 정의(전자는 데이터 모델 §2.12.2 cross-ref, 후자는 §7.1 "파일 1개 = entity 1개")하고 있어 문서 내에서 혼동 소지는 없음.

- **[INFO]** 검토 코퍼스 범위 한계
  - target 신규 식별자: WS 이벤트 `document:graph_started/_progress/_completed/_retry/_failed`, 요구사항 ID prefix `KB-GR-*`
  - 기존 사용처: 이번 payload 코퍼스에는 `spec/5-system/8-embedding-pipeline.md`(다른 `document:*` WS 이벤트를 정의할 가능성), `spec/5-system/9-rag-search.md`, `spec/2-navigation/5-knowledge-base.md`(KB 관련 요구사항 ID 를 별도로 정의할 가능성) 의 전문이 포함되지 않아 직접 대조하지 못했다.
  - 상세: 제공된 코퍼스 내에서는 `document:` prefix WS 이벤트나 `KB-` prefix 요구사항 ID 의 중복 정의가 발견되지 않았으나, 이는 "충돌 없음 확인"이 아니라 "코퍼스에 해당 파일이 없어 대조 불가"에 가깝다.
  - 제안: 위 세 문서를 포함해 재검토하거나, 다음 impl-prep 사이클에서 함께 스캔할 것을 권장 (현재 발견 근거로는 실제 충돌 신호 없음 — 정보성 메모).

검증 결과 실제 충돌(CRITICAL/WARNING 등급)은 발견되지 않았다:

- 요구사항 ID(`KB-GR-*`, `NF-GR-*`)는 코퍼스 전체에서 유일하게 `10-graph-rag.md` 안에서만 사용되며 타 문서 재사용 없음.
- `Entity`/`Relation`/`ChunkEntity` 테이블과 그 컬럼(`entity_count`, `relation_count` 등)은 `spec/1-data-model.md` §2.12.2~2.12.4 와 정확히 동일한 정의로 cross-reference 되어 있어 정합.
- API endpoint(`re-extract`, `retry-failed`, `graph/stats` 등)는 다른 spec 문서에서 동일 path 로 재정의된 사례 없음.
- ENV var(`WEBAUTHN_*`, `JWT_SECRET`, `TRUST_CF_CONNECTING_IP`, `COOKIE_SAMESITE`, `INVITATION_THROTTLE`)는 각각 정확히 한 곳(1-auth.md 본문 + 해당 Rationale 절)에서만 정의되고 값·의미가 일관됨.
- 감사 액션(`auth_config.*`, `model_config.*`, `user.*` 등)은 `spec/conventions/audit-actions.md` 레지스트리와 `1-auth.md` §4.1 표기가 일치 (`model_config` 에 `reveal` 없음 등 세부까지 정합).
- `spec/5-system/10-graph-rag.md` 파일 경로/번호(`10-`)는 `spec/0-overview.md` §4 "영역별 진입 문서" 표에 정식 등재되어 있고, 다른 `5-system/` 문서와 번호 충돌 없음.

## 요약

`spec/5-system/1-auth.md` 와 `spec/5-system/10-graph-rag.md` 두 target 문서가 정의하는 요구사항 ID·엔티티/테이블명·API endpoint·큐/WS 이벤트명·ENV var·감사 액션·파일 경로 모두 제공된 검색 코퍼스(`0-overview.md`, `1-data-model.md`, `conventions/audit-actions.md`, cafe24 카탈로그, plan 문서 등) 안에서 다른 의미로 재사용되는 사례가 발견되지 않았다. 유일하게 눈에 띈 것은 "entity" 라는 일반 영단어가 Cafe24 API 카탈로그 컨벤션(파일 명명 단위)과 Graph RAG 데이터 모델(테이블)에서 각각 다른 의미로 쓰인다는 점인데, 두 문맥이 완전히 분리돼 있고 각자 명확히 정의돼 있어 실질적 충돌 위험은 낮다(INFO). 다만 코퍼스에 `8-embedding-pipeline.md`·`9-rag-search.md`·`2-navigation/5-knowledge-base.md` 전문이 포함되지 않아 그 문서들과의 `document:*` WS 이벤트·`KB-` 요구사항 ID 대조는 완전히 이뤄지지 못했다(정보성 한계 기록, 실제 충돌 신호는 없음).

## 위험도

NONE
