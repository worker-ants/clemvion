# 신규 식별자 충돌 검토 결과

검토 범위: `spec/5-system/` 및 연관 diff (`spec/1-data-model.md`, `spec/5-system/7-llm-client.md`, `spec/5-system/9-rag-search.md`, `spec/2-navigation/5-knowledge-base.md`, `spec/2-navigation/6-config.md`)

diff-base: `origin/main`

---

## 발견사항

### 발견사항 없음 (NONE 등급 항목)

아래 각 점검 관점별로 충돌이 검출되지 않았음을 서술한다.

---

#### 1. 요구사항 ID 충돌

target 이 도입하는 요구사항 ID: 없음 (본 diff 는 기존 요구사항 테이블을 신규 추가하지 않는다. 변경된 `spec/5-system/9-rag-search.md` 는 §3.3 텍스트 상태 갱신("Planned" → "v1 구현됨") 이고, 새 요구사항 ID 접두사를 신설하지 않는다).

충돌: 없음.

---

#### 2. 엔티티/타입명 충돌

target 신규 식별자:
- `RerankConfig` — 데이터 모델 엔티티, TypeORM entity, NestJS 모듈/서비스/컨트롤러
- `RerankClient` — 인터페이스 (`spec/5-system/7-llm-client.md §3.6`)
- `RerankClientFactory` — 클래스 (`spec/5-system/7-llm-client.md §4.1`)
- `RerankConfigService`, `RerankConfigController`, `RerankConfigModule` — NestJS 구현체 클래스
- `TeiRerankClient`, `CohereRerankClient` — 구현체 클래스
- `rerank_mode`, `rerank_config_id`, `rerank_candidate_k`, `rerank_score_threshold`, `rerank_llm_config_id` — DB 컬럼명 (KnowledgeBase)

기존 사용처 검색 결과: 위 심볼들은 origin/main 기준 `spec/` 에 이미 `(Planned)` 레이블로 동일 의미로 선언되어 있었다 (`spec/1-data-model.md §2.16.1`, `spec/5-system/7-llm-client.md §3.6·§4.1·§5.6`). 본 diff 는 "(Planned)" 레이블 제거 + 구현 완료 표기로의 상태 갱신이다. 의미는 동일하며, 기존 선언과 충돌하는 다른 정의는 없다.

충돌: 없음.

---

#### 3. API endpoint 충돌

target 에서 실질적으로 신규 도입된 endpoint:
- `GET/POST/PATCH/DELETE /api/rerank-configs` 및 하위 경로 (`rerank-config.controller.ts @Controller('rerank-configs')`)

spec 상 endpoint 명세 현황: `spec/2-navigation/6-config.md` 는 본 diff 에서 경로 수정(상대경로 `../` → `../../`)만 있고, `/api/rerank-configs` 경로를 정의하는 spec 라인은 아직 없다. 즉 구현은 존재하나 spec(`6-config.md`) 에 endpoint 목록이 추가되지 않았다.

단, 기존 spec 에 `/api/rerank-configs` 가 **다른 의미**로 선언된 곳은 없다. 이미 정의된 `/api/llm-configs` 와 형태가 대칭이지만 path 자체가 다르며 충돌하지 않는다.

충돌: 없음.

- **[INFO]** `/api/rerank-configs` endpoint 가 구현(`rerank-config.controller.ts`)에는 존재하지만 `spec/2-navigation/6-config.md` endpoint 목록에 아직 등록되지 않음
  - target 신규 식별자: `GET/POST/PATCH/PATCH/:id/set-default/DELETE /api/rerank-configs`
  - 기존 사용처: `/api/llm-configs` 와 대칭 위치인 `spec/2-navigation/6-config.md §7 (LLMConfig API)` — RerankConfig 대응 절 미존재
  - 상세: 명명 충돌은 아니나 spec–impl 갭. `spec/2-navigation/6-config.md` 에 RerankConfig CRUD 절과 endpoint 표가 없어 spec 단일진실 원칙 위반 가능성.
  - 제안: `spec/2-navigation/6-config.md` 에 RerankConfig 섹션 + `/api/rerank-configs` endpoint 표 추가. `spec/1-data-model.md §2.16.1` 헤더의 `(Planned)` 레이블도 구현 완료 상태로 업데이트.

---

#### 4. 이벤트/메시지명 충돌

target 이 새로 도입하는 WebSocket 이벤트, 큐 이벤트, SSE 이벤트: 없음.

리랭크 기능은 검색 후처리이며 WebSocket 이벤트 채널을 신설하지 않는다. 기존 `document:graph_*`, `document:embedding_*` 네임스페이스와 교집합 없다.

충돌: 없음.

---

#### 5. 환경변수·설정키 충돌

target 이 도입하는 ENV var / config key: 없음.

`spec/5-system/9-rag-search.md` 및 `spec/5-system/7-llm-client.md` diff 에서 신규 환경변수는 없다. RerankConfig 는 DB 엔티티 기반 설정이며 별도 ENV var 를 도입하지 않는다.

기존 `WEBAUTHN_RP_ID`, `MCP_ALLOW_INSECURE_URL`, `MCP_MAX_CONCURRENT_CONNECTIONS` 등과 겹치는 키 없음.

충돌: 없음.

---

#### 6. 파일 경로 충돌

target diff 는 기존 spec 파일을 수정하며 신규 spec 파일을 추가하지 않는다.
수정된 파일: `spec/5-system/9-rag-search.md`, `spec/5-system/7-llm-client.md`, `spec/1-data-model.md`, `spec/2-navigation/5-knowledge-base.md`, `spec/2-navigation/6-config.md`.

기존 `spec/5-system/` 파일 목록과 prefix 규칙(`N-name.md`) 준수 여부: 신규 파일 없음이므로 충돌 없음. 경로 변경 없음.

충돌: 없음.

---

### 추가 발견사항

- **[INFO]** `spec/1-data-model.md §2.16.1` 의 헤더가 여전히 `RerankConfig (Planned)` 로 표기됨
  - target 신규 식별자: `RerankConfig` (구현 완료 상태)
  - 기존 사용처: `spec/1-data-model.md:533` — `### 2.16.1 RerankConfig (Planned)`
  - 상세: `spec/5-system/7-llm-client.md §3.6·§4.1·§5.6` 의 `(Planned)` 레이블은 본 diff 에서 제거됐으나, `spec/1-data-model.md §2.16.1` 헤더는 여전히 `(Planned)` 를 유지한다. 이는 의미 충돌이 아니라 일관성 결여다.
  - 제안: `### 2.16.1 RerankConfig (Planned)` → `### 2.16.1 RerankConfig` 로 업데이트.

---

## 요약

검토 대상 diff (`spec/5-system/9-rag-search.md`, `spec/5-system/7-llm-client.md`, `spec/1-data-model.md` 등)는 기존 `(Planned)` 레이블로 이미 선언되어 있던 `RerankConfig`, `RerankClient`, `RerankClientFactory`, `rerank_mode/config_id/candidate_k/score_threshold/llm_config_id` 식별자의 상태를 구현 완료로 갱신한 것이다. 새 식별자가 기존의 다른 의미와 충돌하는 케이스는 없으며, 이름·endpoint·이벤트·ENV var 관점 모두 충돌이 없다. 다만 `spec/1-data-model.md §2.16.1` 헤더의 `(Planned)` 표기 잔존, 그리고 구현체가 사용하는 `/api/rerank-configs` endpoint 가 `spec/2-navigation/6-config.md` 에 미등록된 spec–impl 갭 두 건이 INFO 로 기록된다. 두 건 모두 식별자 충돌이 아닌 spec 문서 완결성 이슈다.

---

## 위험도

NONE
