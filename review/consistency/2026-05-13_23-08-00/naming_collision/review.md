## 발견사항

---

### 발견사항 1

- **[WARNING]** `cafe24` Node.type 값이 `spec/1-data-model.md §2.6` Node.type 열거형 테이블에 추가되지 않음
  - **target 신규 식별자**: `cafe24` (Node.type 값)
  - **기존 사용처**: `spec/1-data-model.md §2.6 Node` 의 `type` 컬럼 — `integration` 카테고리 현재 값: `http_request`, `database_query`, `send_email`
  - **상세**: 스펙 드래프트의 9개 변경 파일 목록(`§spec/1`)은 `spec/1-data-model.md §2.10 Integration` 만 건드리고, `§2.6 Node.type` 열거형 테이블은 포함하지 않는다. 그러나 `4-cafe24.md` 는 `cafe24` 를 유효한 노드 타입으로 전제한다 (`Node.category = integration` 하위). `spec/1-data-model.md §2.6` 는 Node.type 의 유일 진실 공급원이므로, 이 식별자가 공식 등록되지 않으면 데이터 모델과 노드 스펙 사이에 불일치가 발생한다.
  - **제안**: 9개 변경 파일에 `spec/1-data-model.md §2.6 Node.type` 열거형 테이블 갱신을 **10번째 변경**으로 추가. `| integration | cafe24 | Cafe24 Admin API 단일 노드 (Resource × Operation 동적 폼) |` 행 삽입.

---

### 발견사항 2

- **[WARNING]** `INTEGRATION_INCOMPLETE` 에러 코드가 `spec/4-nodes/4-integration/0-common.md §4.2` 공통 에러 코드 테이블에 존재하지 않을 가능성
  - **target 신규 식별자**: `INTEGRATION_INCOMPLETE`
  - **기존 사용처**: `spec/4-nodes/4-integration/0-common.md §4.2 공통 에러 코드` — `INTEGRATION_NOT_FOUND`, `INTEGRATION_TYPE_MISMATCH`, `INTEGRATION_NOT_CONNECTED` 세 코드는 `(공통 §4.2)` 출처로 명시 참조. `INTEGRATION_INCOMPLETE` 는 같은 계열(`INTEGRATION_*` prefix)이나, 드래프트 §4 step 4 에서 `(공통 §4.2)` 참조 없이 단독 도입됨.
  - **상세**: `INTEGRATION_INCOMPLETE` 는 credentials JSONB 의 특정 필드 누락(mall_id, app_type 등)을 나타내는 코드로, Cafe24 외에 향후 다른 Integration 핸들러도 재사용 가능한 일반 credential 검증 시나리오다. `0-common.md §4.2` 에 없는 상태에서 cafe24 spec 에만 정의하면, 나중에 다른 핸들러가 동일 상황에서 다른 코드를 발명하는 코드 난립이 생긴다. 또한 현재 `0-common.md §4.2` 에 이 코드가 이미 정의되어 있다면, 의미 충돌 여부를 직접 확인해야 한다.
  - **제안**: `spec/4-nodes/4-integration/0-common.md §4.2` 를 확인하여 `INTEGRATION_INCOMPLETE` 부재 시 해당 테이블에 추가하고, `4-cafe24.md §4 step 4` 및 `§5.8` 에서 `(공통 §4.2)` 로 출처 표기를 통일. 이 경우 변경 파일이 10→11개로 늘어난다.

---

### 발견사항 3

- **[INFO]** Cafe24 `resource` enum 값 중 `application` 이 OAuth "앱(Application)" 개념과 단어 중첩
  - **target 신규 식별자**: `resource='application'` (Cafe24 Application Management API 카테고리)
  - **기존 사용처**: 드래프트 §2 §3.2 에서 `app_type: public | private` 로 Cafe24 앱 발급 형태를 이미 "app"/"application" 어휘로 사용. `spec/2-navigation/10-auth-flow.md` 도 OAuth 등록 앱 개념에 "application" 사용.
  - **상세**: `resource='application'` 은 Cafe24 Admin API 의 "앱 관리" 카테고리를 지칭하며, config 필드 경로 상에서 `Integration.credentials.app_type` 및 OAuth 흐름의 "앱" 개념과 단어가 겹친다. 직접 충돌이 아닌 독자 혼선 위험.
  - **제안**: spec `4-cafe24.md §1 설정` 의 `resource` 필드 설명 또는 `cafe24-api-metadata.md §3 예시` 에 `resource='application'`에 대한 한 줄 설명("Cafe24 앱 관리 API — OAuth 앱 등록과 무관")을 추가.

---

### 발견사항 4

- **[INFO]** `POST /api/integrations/oauth/begin` endpoint 명 — 기존 Integration OAuth 진입점 패턴과의 정합성 미확인
  - **target 신규 식별자**: `POST /api/integrations/oauth/begin` (body: `{ service, mall_id, app_type, ... }`)
  - **기존 사용처**: `spec/2-navigation/10-auth-flow.md §5.2` — 사용자 인증용 `GET /api/auth/oauth/:provider`. Integration OAuth 진입 endpoint 의 현행 경로 형식은 제공된 코퍼스에서 확인 불가.
  - **상세**: `spec/2-navigation/4-integration.md §3.2` 의 현재 Google/GitHub Integration OAuth 진입이 `GET /api/integrations/oauth/:provider` 형태라면, Cafe24 만 `POST /begin` 으로 달라진다. 반대로 이미 POST body 방식을 쓴다면 일관성 문제가 없다. 어느 쪽인지 corpus 에서 확인되지 않아 INFO 로 분류.
  - **제안**: `spec/2-navigation/4-integration.md` 의 현행 Google/GitHub OAuth begin endpoint 경로를 확인 후, 필요 시 Cafe24 도 동일 경로 패턴(`POST /api/integrations/oauth/begin?service=cafe24` 또는 `POST /api/integrations/oauth/cafe24/begin`)으로 통일.

---

## 요약

9개 spec 변경안에서 **기존 식별자와 직접 충돌하는 명칭은 발견되지 않았다**. 모든 `CAFE24_*` 에러 코드·클래스명·파일 경로·service_type 값은 코퍼스 내 기존 식별자와 겹치지 않는다. 다만 두 가지 누락 위험이 있다: (1) `cafe24` Node.type 이 `spec/1-data-model.md §2.6` 에 추가되지 않은 데이터 모델 불완전성, (2) `INTEGRATION_INCOMPLETE` 코드의 공통 테이블(`0-common.md §4.2`) 등록 여부 미확인. 두 항목 모두 spec 반영 전 해결하면 후속 consistency-check 통과에 도움이 된다.

## 위험도

**LOW**