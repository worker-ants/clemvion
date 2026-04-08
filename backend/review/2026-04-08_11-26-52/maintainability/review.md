### 발견사항

---

**[WARNING] `AiAgentHandler.execute()` 메서드가 과도하게 길고 여러 책임을 가짐**
- 위치: `ai-agent.handler.ts` 전체 `execute()` 메서드
- 상세: RAG 검색, 메시지 빌드, tool 정의 빌드, LLM 호출 루프, JSON 파싱 등 5개 이상의 책임이 단일 메서드에 혼재. 순환 복잡도가 높고 테스트 시 특정 단계만 검증하기 어려움.
- 제안: `buildMessages()`, `buildTools()`, `executeWithToolLoop()`, `parseResponse()` 등 private 메서드로 분리

---

**[WARNING] `EmbeddingService.doProcess()` 메서드가 너무 길고 여러 단계를 순차적으로 처리**
- 위치: `embedding.service.ts:doProcess()`
- 상세: 다운로드 → 파싱 → 청킹 → 임베딩 → DB 저장 → 상태 업데이트까지 모두 하나의 메서드에 존재. 이벤트 emit 패턴도 산재되어 있어 수정 시 누락 위험.
- 제안: 각 단계를 private 메서드로 추출하고 상태 업데이트/이벤트 emit을 헬퍼로 통합

---

**[WARNING] 폴링 기반 동시성 제어 (`while + setTimeout`)**
- 위치: `embedding.service.ts:processDocument()` L38-41
- 상세: `while (this.activeTasks >= MAX_CONCURRENT) { await sleep(500) }` 방식은 최대 500ms 대기 낭비가 발생하고 테스트에서 타이머 목킹이 필요해 유지보수가 어려움. 클래스 상태(`activeTasks`)에 의존하므로 멀티 인스턴스 환경에서 작동하지 않음.
- 제안: `p-limit` 같은 전용 라이브러리 사용 또는 큐 기반 처리로 변경

---

**[WARNING] `AzureOpenAIClient`에서 부모 클래스 private 필드를 강제 캐스팅으로 덮어씀**
- 위치: `azure-openai.client.ts:constructor()`
- 상세: `(this as unknown as { client: OpenAI }).client = new OpenAI(...)` — 부모의 `private readonly client`를 타입 우회로 재할당. 부모 클래스 변경 시 런타임 오류 발생 가능. TypeScript의 타입 안전성을 완전히 포기한 패턴.
- 제안: `OpenAIClient` 생성자에서 `OpenAI` 인스턴스를 주입받거나 `protected` 필드로 변경

---

**[WARNING] `InformationExtractorHandler.execute()`에서 재시도 루프의 `continue` 의미 없음**
- 위치: `information-extractor.handler.ts` L100-112
- 상세: `catch` 블록에서 `continue`를 실행하면 다음 iteration이 동일한 파라미터로 LLM을 재호출하지만, 오류가 JSON 파싱 실패라면 같은 응답이 다시 나올 가능성이 높음. 재시도 시 오류 내용을 LLM에 피드백하는 로직이 없음.
- 제안: 재시도 시 "이전 응답이 유효한 JSON이 아니었습니다" 메시지를 추가하거나, `jsonSchema`를 활용한 structured output 사용으로 파싱 실패 자체를 방지

---

**[INFO] `S3Service` 생성자에 하드코딩된 기본값들이 개발용 값임**
- 위치: `s3.service.ts` L18-29
- 상세: `'http://localhost:9000'`, `'minioadmin'` 같은 개발/Minio 기본값이 fallback으로 하드코딩되어 있어 환경변수 누락 시 프로덕션에서 잘못된 엔드포인트로 연결 시도.
- 제안: 프로덕션 환경에서는 환경변수 미설정 시 명시적 오류를 던지도록 변경 (또는 `ConfigService`에서 required 설정)

---

**[INFO] `GoogleClient`에서 `any` 타입 사용**
- 위치: `google.client.ts:getModel()` L36
- 상세: `const tools: any[] = []` — `@google/generative-ai` SDK의 Tool 타입을 직접 사용하면 타입 안전성 확보 가능.
- 제안: `import { Tool } from '@google/generative-ai'`로 타입 명시

---

**[INFO] `llm.config.ts`의 단순 래퍼가 별도 파일로 분리될 필요성 불명확**
- 위치: `llm.config.ts` 전체
- 상세: `encryptionKey` 하나만을 위한 config 파일로, 기존 config/index.ts에 통합 가능. 파일 수가 늘어날수록 추적이 어려워짐.
- 제안: `src/common/config/index.ts`에 병합하거나 `appConfig` 내 `llm` 섹션으로 통합

---

**[INFO] `forceSplitAndPush` 함수의 루프 탈출 조건이 직관적이지 않음**
- 위치: `text-chunker.ts:forceSplitAndPush()` L97-100
- 상세: `if (start >= text.length - overlapChars) break` 조건이 루프 종료 이후에도 나머지 처리 블록이 있어 흐름 파악이 어려움. `while`의 종료 조건과 별도 `break`가 중복적.
- 제안: 루프 조건을 `while (start < text.length)` 대신 명확한 조건으로 단순화

---

**[INFO] `KnowledgeBaseController`에서 `POST /search`가 라우트 순서상 `:id`와 충돌 가능**
- 위치: `knowledge-base.controller.ts` L114-125
- 상세: `GET /:id` 이후 `POST /search`가 선언됐는데, NestJS는 선언 순서대로 매칭하므로 일반적으로 문제없지만, `search`를 UUID로 파싱할 때 `ParseUUIDPipe`가 없어 차별화됨. 다만 의도적으로 debug 엔드포인트를 공개 API에 포함시킨 것은 유지보수상 위험.
- 제안: 검색 엔드포인트를 `/knowledge-bases/search`가 아닌 내부 전용 또는 별도 경로로 분리하고 주석에 "debug" 의도를 더 명확히 표시

---

### 요약

전반적으로 코드 구조는 명확하고 NestJS 컨벤션을 잘 따르고 있으며, 인터페이스 분리와 단일 책임 원칙도 대체로 지켜지고 있습니다. 다만 `AiAgentHandler.execute()`와 `EmbeddingService.doProcess()` 두 메서드는 너무 많은 단계를 처리하여 수정 및 테스트 시 영향 범위 파악이 어렵습니다. `AzureOpenAIClient`의 private 필드 강제 덮어쓰기는 부모 클래스 변경에 취약한 유지보수 위험 요소이며, 폴링 기반 동시성 제어는 장기적으로 예측 불가능한 동작을 초래할 수 있습니다. 매직 넘버(embedding dimension 1536, batch size 20 등)는 상수로 추출하면 변경 시 한 곳만 수정할 수 있어 유지보수성이 높아집니다.

### 위험도

**MEDIUM**