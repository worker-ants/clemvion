# 신규 식별자 충돌 검토

검토 모드: `--impl-prep` (구현 착수 전), scope: `spec/5-system/`

대상 변경 파일:
- `spec/5-system/9-rag-search.md`
- `spec/5-system/7-llm-client.md`
- `spec/5-system/3-error-handling.md`
- `spec/1-data-model.md`

---

## 발견사항

### 1. INFO — `EXECUTION_TIME_LIMIT_EXCEEDED` 신규 에러 코드 등록

- **target 신규 식별자**: `EXECUTION_TIME_LIMIT_EXCLUDED` → `EXECUTION_TIME_LIMIT_EXCEEDED` (`spec/5-system/3-error-handling.md` 신규 행, `spec/1-data-model.md` §2.8 Execution.error.code 서술 확장)
- **기존 사용처**: `EXECUTION_TIMEOUT` 이 `spec/5-system/3-error-handling.md:59` (main) 에 "워크플로우 또는 노드 실행 타임아웃" 으로 등록되어 있고, `codebase/backend/src/nodes/data/code/code.handler.ts:242,257,286` 에서 Code 노드 스크립트 타임아웃에 실제 emit 됨
- **상세**: target 은 `EXECUTION_TIMEOUT` 을 "Code 노드 스크립트 실행 타임아웃"으로 의미를 좁히고, 엔진 레벨 누적 실행시간 초과에는 신규 코드 `EXECUTION_TIME_LIMIT_EXCEEDED` 를 쓴다고 분리한다. 이 분리는 의미적으로 올바르며, 기존 코드와 직접 충돌하지 않는다. 단, main 의 `EXECUTION_TIMEOUT` 서술이 "워크플로우 또는 노드 실행 타임아웃" 으로 더 넓게 기술되어 있어 target 이 의미를 좁히는 변경임을 인지해야 한다.
- **제안**: 충돌 없음. 구현 시 `execution-failure-classifier.ts` 가 `EXECUTION_TIMEOUT` 만 처리하고 있으므로(`codebase/backend/src/modules/chat-channel/shared/execution-failure-classifier.ts:38`), 구현 단계에서 `EXECUTION_TIME_LIMIT_EXCEEDED` 처리 분기를 동일 파일에 추가해야 한다.

---

### 2. INFO — `WORKER_HEARTBEAT_TIMEOUT` 에러 코드 error-handling spec 에 공식 등재

- **target 신규 식별자**: `WORKER_HEARTBEAT_TIMEOUT` 을 `spec/5-system/3-error-handling.md` 에 새로 등재
- **기존 사용처**: `spec/5-system/4-execution-engine.md:746` (main) 와 `spec/1-data-model.md:454` (main) 에서 이미 언급. 구현에도 `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:2080` 에서 실제로 emit 됨
- **상세**: 기존 사용처에서는 이미 정의되어 사용 중인 코드이나, `3-error-handling.md` 의 공식 에러 코드 목록에는 없었다. target 이 이를 공식 목록에 추가하면서 의미 설명을 "부팅 시 recovery — 30분 이상 heartbeat 없는 RUNNING Execution" (기존 data-model 서술) 에서 "active 세그먼트 job 이 BullMQ stalled 재배달 attempts 소진"으로 세밀화한다. 이는 명명 충돌이 아니라 의미 정교화이다.
- **제안**: 충돌 없음. `3-error-handling.md` 등재는 기존 코드와 일치한다.

---

### 3. INFO — `builtin` provider 신규 도입 (`RerankConfig.provider`)

- **target 신규 식별자**: `builtin` — `spec/5-system/7-llm-client.md` §2.1 리랭크 프로바이더 표, §5.6 매핑 표, `RerankClientFactory` 주석, `spec/1-data-model.md` §2.16.1 `provider` 컬럼 Planned 목록에 추가
- **기존 사용처**: `spec/` 내 `builtin` 이라는 provider 명칭은 기존에 존재하지 않는다. `LLMClientFactory` 의 provider 집합(`openai`/`anthropic`/`google`/`azure`/`local`)과도 겹치지 않는다. `RerankClientFactory` 기존 목록(`cohere`/`jina`/`voyage`/`tei`/`local`)과도 겹치지 않는다.
- **상세**: `builtin` 은 Transformers.js(onnxruntime-node) 인프로세스 추론이라 HTTP endpoint 가 없는 유일한 provider 로, 다른 provider 와 의미 충돌 없음. Planned 상태라 현재 `RerankClientFactory` switch 에 case 없이 주석으로만 예약되어 있다.
- **제안**: 충돌 없음. 다만 `spec/1-data-model.md:543` 의 `api_key` 와 `base_url` 행이 `tei`/`local` 사례를 명시하고 있는데, `builtin` 이 추가될 때 두 필드 모두 불필요함을 해당 행에 함께 명시하면 향후 혼동을 방지한다 (WARNING 수준은 아님).

---

### 4. INFO — `cross_encoder_llm` 의미 변경 (conditional escalate → always LLM grading)

- **target 신규 식별자**: 기존 `rerank_mode = 'cross_encoder_llm'` enum 값 자체는 동일하나, 동작 의미가 "escalate 조건 충족 시 LLM grading" (main) 에서 "항상 LLM grading" (target) 으로 변경됨
- **기존 사용처**: `spec/5-system/9-rag-search.md:172` (main): "escalate 조건(① cross-encoder 상위 점수 평탄/모호 ② 정책·지시 판단 KB) 충족 시 listwise LLM grading 1콜 추가". `spec/1-data-model.md:340` 의 `rerank_mode` 컬럼은 enum 값 목록만 열거하고 동작 세부 설명은 §3.3 참조로 위임.
- **상세**: 이 변경은 식별자 충돌이 아니라 기존 정의 의미 변경이다. enum 값 문자열(`cross_encoder_llm`)은 동일하게 유지되므로 저장된 데이터 포맷 호환성 문제는 없다. 구현 전(Planned)이므로 기존 코드에 이 값이 없어 하위호환 위반도 없다.
- **제안**: 충돌 없음. 단, 미래에 `ragDiagnostics.rerank.llmGradingApplied` 필드 (`spec/5-system/9-rag-search.md:250`) 는 이 모드에서 항상 `true` 가 되므로 실질적으로 정보 중복이 줄었음을 구현 주석에 명시하면 좋다.

---

### 5. INFO — `LLMClient.rerank?()` vs `RerankClient` 명칭 충돌 없음 (확인)

- **target 신규 식별자**: `RerankClient` 인터페이스 (별도 팩토리 `RerankClientFactory`) — 이미 main 의 `spec/5-system/7-llm-client.md:161-173` 에 §3.6 으로 정의됨. target 에서 실질적 변경은 없음.
- **기존 사용처**: main spec 에 `RerankClient` 와 `RerankClientFactory` 가 이미 정의되어 있음. 충돌 없음.

---

## 요약

이번 target 변경(`spec/5-system/9-rag-search.md`, `7-llm-client.md`, `3-error-handling.md`, `1-data-model.md`)이 도입하는 신규 식별자는 기존 식별자와 의미 충돌을 일으키지 않는다. 핵심 신규 도입은 `EXECUTION_TIME_LIMIT_EXCEEDED` (기존 `EXECUTION_TIMEOUT` 과 의미 분리, 코드베이스에서 사용되지 않은 신규 코드), `WORKER_HEARTBEAT_TIMEOUT` 의 `3-error-handling.md` 공식 등재(이미 구현에서 사용 중인 코드의 spec 추가), `builtin` provider 예약명(어떤 기존 provider 명과도 겹치지 않음), `cross_encoder_llm` 의 동작 의미 정교화(enum 값 문자열 불변, Planned 상태라 코드베이스 영향 없음)로 구성된다. 주의할 점은 `EXECUTION_TIMEOUT` 의 의미가 "워크플로우 또는 노드 실행 타임아웃"에서 "Code 노드 스크립트 실행 타임아웃"으로 좁아지므로, 구현 시 `execution-failure-classifier.ts` 등 이 코드를 참조하는 곳에서 인지가 필요하다.

## 위험도

LOW
