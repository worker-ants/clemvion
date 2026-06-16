# 신규 식별자 충돌 Check — spec/2-navigation/6-config.md

## 발견사항

### 1. 요구사항 ID 충돌

- **[INFO]** target 문서는 요구사항 ID(NAV-CF-* 등 prefix 형식)를 새로 도입하지 않는다. 모든 요구사항 참조는 기존 `spec/5-system/1-auth.md §3.2` 의 Auth Config 권한 매트릭스, `spec/5-system/12-webhook.md` WH-MG-05·WH-SC-08·WH-SC-09 등을 cross-reference 방식으로 인용하며, 신규 ID 부여는 없다. 충돌 없음.

---

### 2. 엔티티/타입명 충돌

- **[INFO]** `AuthConfig` — `spec/1-data-model.md §2.17` 에 동명 엔티티가 단일 진실로 존재하며 target 문서는 이를 참조한다. target 이 동명을 재정의하지 않으므로 충돌 없음.

- **[INFO]** `ModelConfig` — `spec/1-data-model.md §2.16` 에 동명 엔티티가 단일 진실로 존재. target §Part B 는 동일 엔티티를 참조한다. 재정의 없음, 충돌 없음.

- **[WARNING]** `ModelInfo` — 이름 혼동 가능성
  - target 신규 식별자: target 문서가 암묵적으로 사용하는 "모델 불러오기" 응답 항목 개념 (명시적 이름 없음)
  - 기존 사용처: `spec/1-data-model.md §2.16` 용어 구분 박스 — "ModelInfo = provider `listModels` 응답 항목(DTO)"
  - 상세: target 은 응답 항목에 별도 이름을 부여하지 않으나, 향후 DTO 명 선택 시 `ModelInfo` 와 충돌하지 않는지 확인 필요. `spec/5-system/7-llm-client.md §3.5` 의 `ModelInfo` 와 동일한 개념을 가리키므로 충돌 발생 시 혼선 직결.
  - 제안: 신규 DTO 를 `ModelListItem` 또는 `ProviderModelItem` 으로 명명하거나, `spec/1-data-model.md §2.16` 의 `ModelInfo` 정의를 LLM Client spec 으로 이관해 단일 진실을 확보할 것

- **[INFO]** `AuthConfigType` / `IntegrationAuthType` — `spec/1-data-model.md §2.17.3` Rationale 에서 두 TypeScript 유니온 타입을 명시적으로 분리하도록 기록되어 있다. target 문서는 이 구분을 위반하지 않는다. 충돌 없음.

---

### 3. API Endpoint 충돌

- **[INFO]** Authentication API — target §3 의 아래 엔드포인트들은 `spec/1-data-model.md §2.17` 및 `plan/in-progress/auth-config-webhook-followups.md` 에 이미 확립된 경로와 완전 일치한다. 중복 기술이나 내용 충돌 없음.
  - `GET /api/auth-configs`, `POST /api/auth-configs`, `GET /api/auth-configs/:id`, `PATCH /api/auth-configs/:id`, `POST /api/auth-configs/:id/regenerate`, `POST /api/auth-configs/:id/reveal`, `DELETE /api/auth-configs/:id`, `GET /api/auth-configs/:id/usage`

- **[INFO]** Model Config API — `/api/model-configs` 패밀리는 `spec/1-data-model.md §2.16` Rationale 의 구 alias 제거 기록(PR4 `/api/llm-configs`·`/api/rerank-configs` 삭제)과 정합한다. 현재 spec 에 이미 정착된 경로이며 충돌 없음.

- **[INFO]** `PATCH /api/model-configs/:id/set-default` — `spec/conventions/audit-actions.md §3` 의 `model_config.set_default` 감사 액션과 이름이 대응된다. 충돌 없음, 오히려 명명 정합.

---

### 4. 이벤트/메시지명 충돌

target 문서는 SSE·webhook·queue 이벤트명을 새로 도입하지 않는다. `audit_log` 에 `auth_config.reveal` 을 기록하는 흐름은 기존 `spec/conventions/audit-actions.md §3` 의 `auth_config reveal` 항목(구현됨)과 일치한다.

- 이벤트/메시지명 신규 도입 없음. 충돌 없음.

---

### 5. 환경변수·설정키 충돌

target 문서는 새로운 ENV var 또는 config key 를 도입하지 않는다. `ENCRYPTION_KEY` 등은 참조하는 기존 서비스가 이미 사용 중이며, target 이 새로 정의하지 않는다.

- 환경변수·설정키 신규 도입 없음. 충돌 없음.

---

### 6. 파일 경로 충돌

- **[INFO]** `spec/2-navigation/6-config.md` — `spec/2-navigation/` 폴더의 기존 문서 번호 체계와 일치한다. 이미 존재하는 파일에 대한 업데이트이며 신규 파일 경로 충돌 없음.

---

### 7. 추가 세부 분석 — 잠재적 혼동 지점

#### [WARNING] `source_ip` 필드의 이중 산문 기술

- target 신규 식별자: §A.3 및 §Rationale R-6 에서 `Execution.source_ip` 를 AuthConfig 사용 이력 "소스 IP" 컬럼 소스로 명시
- 기존 사용처: `spec/1-data-model.md §2.13` 의 `source_ip VARCHAR(45)? (V096)` 컬럼 정의 — `extractClientIp` 경로·비-HTTP 트리거 NULL 처리를 동일하게 서술
- 상세: 의미 충돌은 없으나 동일 정책이 두 문서에 산문으로 중복 기술되어 향후 drift 가능성
- 제안: target §A.3 의 `source_ip` 서술을 `spec/1-data-model.md §2.13` cross-reference 로 단순화

#### [WARNING] `response_code` 필드의 이중 산문 기술

- target 신규 식별자: §A.3 및 §Rationale R-6 의 `response_code` 필드 정책 (HTTP 202, 비-HTTP NULL, status enum fallback)
- 기존 사용처: `spec/1-data-model.md §2.13` 의 `response_code VARCHAR(10)? (V096)` 컬럼 정의 및 `spec/5-system/12-webhook.md WH-MG-05` 참조
- 상세: `source_ip` 와 동일하게 산문 중복 기술. 양측 내용은 일치하나 단일 진실 원칙상 data-model 이 SoT, config spec 은 UX 관점 요약만 제공하는 것이 이상적
- 제안: target §A.3 의 `response_code` 정책 서술은 `spec/1-data-model.md §2.13` + `spec/5-system/12-webhook.md WH-MG-05` cross-reference 로 대체

---

## 요약

`spec/2-navigation/6-config.md` 가 도입하는 신규 식별자(엔티티명, API 엔드포인트, 감사 액션, 필드명)는 기존 corpus 와 실질적 충돌이 없다. 모든 엔티티명(`AuthConfig`, `ModelConfig`)과 API 경로는 `spec/1-data-model.md` 및 기존 plan 에서 이미 확립된 것을 참조하는 구조이며, target 문서가 새로 부여하는 식별자는 거의 없다. 다만 `ModelInfo` DTO 명의 잠재적 혼동(WARNING — 향후 구현 시 코드 명명 시점에 주의) 과, `source_ip`·`response_code` 필드 정책의 중복 산문 기술(WARNING — 단일 진실 원칙 위반)이 발견된다. 두 WARNING 모두 의미 충돌보다는 잠재적 drift 우려이며 즉각적인 차단 사유는 아니다.

## 위험도

LOW
