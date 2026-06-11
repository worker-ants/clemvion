# Cross-Spec 일관성 검토 결과

**검토 대상**: `plan/in-progress/spec-update-embedding-testconnection.md`
**검토 일시**: 2026-06-11

---

## 발견사항

### [WARNING] `LLMClient.testConnection()` 인터페이스 반환 타입 불일치

- **target 위치**: `spec/5-system/7-llm-client.md §3.1` 변경 제안 — `LlmService.testConnection`이 embedding 시 `{ success: true, dimension?: number }` 를 반환한다고 명세
- **충돌 대상**: `spec/5-system/7-llm-client.md §3.1` 현행 — `LLMClient` 인터페이스의 `testConnection(): Promise<boolean>` (boolean 반환으로 확정)
- **상세**: draft 는 서비스 레이어(`LlmService.testConnection`)가 `{ success: true, dimension?: number }` shape 을 반환한다고 기술한다. 그런데 현행 spec의 `LLMClient` 인터페이스는 `testConnection(): Promise<boolean>` 으로 정의되어 있다. 이 두 계층의 반환 타입이 서로 다름을 draft 가 명시하지 않는다. 서비스 레이어가 객체를 반환한다면 `LLMClient` 인터페이스의 boolean 을 서비스 레이어가 래핑·변환하는 구조인지, 혹은 인터페이스 자체도 변경해야 하는지 spec 이 명확하지 않다. §8.3 `LlmService` 서비스 레이어 서술("`기존 chat / testConnection / resolveConfig 유지`")도 이 변경을 반영하지 않아 spec 내부 정합이 깨진다.
- **제안**: draft 의 `spec/5-system/7-llm-client.md` 변경 제안에 `LLMClient.testConnection` 인터페이스(boolean 유지)와 `LlmService.testConnection` 서비스 래퍼(객체 반환)의 분리를 명시한다. `§8.3 서비스 레이어` 스니펫도 `testConnection` 시그니처 변경을 포함해 동반 갱신한다.

---

### [WARNING] `spec/5-system/7-llm-client.md §3.3` Rationale 과 embed 반환 shape 와의 잠재 충돌

- **target 위치**: draft `spec/5-system/7-llm-client.md` 변경 제안 — embedding probe 가 `client.embed(['connection test'], defaultModel)` 를 호출해 벡터 길이를 `dimension` 으로 추출
- **충돌 대상**: `spec/5-system/7-llm-client.md §3.3` 현행 — `embed()` 반환 타입 `Promise<number[][]>` (벡터 배열만, 메타데이터 없음). Rationale 에 "usage/dimensions 등 메타데이터는 반환하지 않음" 명시
- **상세**: draft 에서 "반환 벡터 길이가 `dimension` 으로 포함됨"은 `embed()` 결과 벡터 배열의 첫 요소 길이(`vectors[0].length`)를 서비스 레이어에서 계산해 파생하는 방식을 의미한다. 이 경우 `embed()` 인터페이스 자체를 변경하지 않으므로 실제 모순은 없다. 그러나 draft 서술이 "`embed()` 가 dimension 을 응답에 포함한다"는 해석으로 읽힐 여지가 있어, `LLMClient.embed()` 인터페이스 불변 + 서비스 레이어에서 `vectors[0].length` 파생임을 명시해야 오독을 방지할 수 있다.
- **제안**: draft 의 probe 설명에 "반환 벡터 배열의 첫 요소 길이(`vectors[0].length`) 로 계산" 문구를 추가하여 `LLMClient.embed()` 인터페이스 변경 없음을 확인한다.

---

### [WARNING] `spec/2-navigation/6-config.md §B.3` 현행과 충돌 — chat 전용 기술

- **target 위치**: draft `spec/2-navigation/6-config.md §B.3` 변경 제안 — kind 별 probe 전략 분기 추가
- **충돌 대상**: `spec/2-navigation/6-config.md §B.3` 현행 — "간단한 API 호출 (예: 모델 목록 조회)로 연결 확인"이라는 단일 기술로, kind 구분 없음
- **상세**: 현행 §B.3 은 `chat` 전용 probe(모델 목록 조회 등 경량 API)를 암묵적으로 전제하고 embedding 의 probe embed 호출을 전혀 기술하지 않는다. draft 는 이를 올바르게 갱신하려 하나, §B.5 의 dimension 필드 설명(현행: "선택 모델의 벡터 차원 (예: 1536/3072). ModelConfig.dimension = SoT")과 draft 의 §B.5 변경안(자동감지·read-only 추가)이 spec 내에서 같은 절에 대해 서로 다른 기술로 병존하는 상태가 된다. draft 는 §B.5 를 전면 교체 형태로 명시해야 한다.
- **제안**: draft 의 §B.5 변경 제안이 현행 §B.5 전체를 대체함을 명확히 하고, §B.3 변경과 §B.5 변경이 일관된 단일 UX 플로우를 이루는지 재검토한다.

---

### [WARNING] `POST /api/model-configs/:id/test` API 응답 shape 미반영 — `spec/2-navigation/6-config.md §3 API 표`

- **target 위치**: draft `spec/2-navigation/6-config.md §B.5` 말미 각주 — `POST /api/model-configs/:id/test` 가 `dimension` 을 응답에 포함한다고 기술
- **충돌 대상**: `spec/2-navigation/6-config.md §3 API 표` 현행 — `POST /api/model-configs/:id/test` 행에 응답 shape 기술 없음. 단순 "연결 테스트 (chat/embedding 만 — rerank 미제공)"만 명시
- **상세**: API 표는 endpoint 목록만 열거하고 response body shape 를 기술하지 않는 설계이지만, embedding 의 경우 `{ success: true, dimension?: number }` 라는 비대칭 응답이 추가되므로 chat 과의 응답 형태 차이가 API 소비자에게 불투명하다. draft 가 이를 §B.3 또는 §B.5 에서 기술하더라도, API 표 행에 최소한 "(embedding: dimension 포함 가능)" 수준의 주석이 없으면 API 설계자 관점에서 발견성이 낮다.
- **제안**: §3 API 표의 `POST /api/model-configs/:id/test` 행 설명란에 응답 shape 차이(`embedding: { success, dimension? }`, `chat: { success }`)를 간략히 주석으로 추가한다.

---

### [INFO] `ModelConfigService.findEntity` 설계 결정 — 의존 방향 spec 미명시 (기존 spec 과 모순 없음)

- **target 위치**: draft `spec/5-system/7-llm-client.md` 변경 제안 — `LlmService.testConnection` 이 `ModelConfigService.findEntity`(kind-agnostic)를 사용
- **충돌 대상**: 직접 모순되는 기존 spec 없음. 다만 현행 `spec/5-system/7-llm-client.md` 에는 서비스 레이어의 설정 조회 경로가 어떤 service 를 통하는지 명시가 없다
- **상세**: `LlmConfigService.findEntity`(chat 고정) 대신 `ModelConfigService.findEntity`(kind-agnostic)를 쓰는 것은 spec 미명시 영역이라 기존 spec 과의 직접 충돌은 없다. 단, `LlmModule` 이 `ModelConfigModule` 에 의존하는 모듈 의존 방향이 spec 에 등장하지 않아 향후 순환 의존(draft 가 언급한 `forwardRef` W4) 문제 해소를 위한 근거를 spec 이 보유하지 못한다.
- **제안**: draft 대로 `spec/5-system/7-llm-client.md` 에 "설정 조회는 `ModelConfigService.findEntity` 사용, forwardRef 순환 의존 해소 백로그 W4 참조" 설계 결정을 반영하면 충분하다. 현재 기술 수준으로 추가 spec 충돌 없음.

---

### [INFO] `spec/1-data-model.md §2.16 ModelConfig.dimension` 자동감지·write-back 규칙 미반영

- **target 위치**: draft 전반 — embedding testConnection 성공 시 `PATCH /api/model-configs/:id { dimension }` 으로 즉시 write-back
- **충돌 대상**: `spec/1-data-model.md §2.16` 현행 — `dimension` 필드 설명: "embedding 전용 벡터 차원 (384/512/768/1024/1536/3072). pgvector 컬럼 차원과 결합된 SoT"
- **상세**: 현행 데이터 모델 spec 에서 `dimension` 은 "사용자가 입력하는 설정값" 으로만 기술되어 있고 "연결 테스트 시 자동 감지·write-back" 동작은 명시되지 않는다. draft 는 이 동작을 `spec/2-navigation/6-config.md §B.3·§B.5` 에 반영하는 것으로 충분하다고 보고 `spec/1-data-model.md` 갱신은 포함하지 않는다. 데이터 모델 필드 설명이 "수동 입력 또는 testConnection 자동감지" 두 경로를 모두 기술하지 않으면 독자가 `dimension` 의 SoT 를 오해할 수 있다.
- **제안**: `spec/1-data-model.md §2.16` 의 `dimension` 필드 설명에 "(연결 테스트 성공 시 자동감지·자동저장 가능 — 상세 [Config §B.3](../2-navigation/6-config.md))" 주석을 1줄 추가한다. 모순은 아니지만 독자 명확성을 위해 동기화를 권장한다.

---

## 요약

target draft (`spec-update-embedding-testconnection.md`) 가 제안하는 세 spec 파일 변경은 기존 spec 의 데이터 모델(`spec/1-data-model.md §2.16`)·API 표(`spec/2-navigation/6-config.md §3`)·`LLMClient` 인터페이스(`spec/5-system/7-llm-client.md §3.1`)와 직접 모순을 일으키지는 않는다. 그러나 `LLMClient.testConnection(): Promise<boolean>` (인터페이스 레벨)과 `LlmService.testConnection` 서비스 레이어의 `{ success, dimension? }` 반환 shape 분리가 spec 에서 명확히 표현되지 않아 두 계층이 동일 반환 타입을 가진다고 오독될 여지가 있다. 이 부분이 가장 우선적으로 명확히 서술되어야 한다. 나머지 항목들은 기존 spec 과의 동기화 누락으로 인한 독자 혼란 방지 수준의 권고다.

## 위험도

LOW
