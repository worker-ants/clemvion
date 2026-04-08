### 발견사항

---

**[WARNING] `pdf-parse` 패키지의 require() 방식 사용**
- 위치: `pdf.parser.ts` L1-2
- 상세: `pdf-parse`는 TypeScript `import` 대신 `require()`로 로드되고 있으며, `@types/pdf-parse`는 devDependency에만 존재합니다. 이는 타입 정보가 런타임에 없음을 의미하며, `pdf-parse v2.4.5`는 최신 패키지이나 활발히 유지보수되지 않는 포크(fork) 버전입니다.
- 제안: `pdf-parse` 대신 적극적으로 유지보수되는 `pdf-parse` 원본 또는 `pdfjs-dist`로 대체하거나, ESM 호환 방식으로 import 처리

---

**[WARNING] `@google/generative-ai`에서 `any` 타입 사용**
- 위치: `google.client.ts` L42
- 상세: `const tools: any[] = []` — 의존성의 타입 정의를 우회하고 있어 타입 안전성이 훼손됩니다. 패키지가 올바른 타입을 export하고 있으나 활용하지 않고 있습니다.
- 제안: `@google/generative-ai` 패키지의 `Tool` 타입 import하여 사용

---

**[WARNING] `AzureOpenAIClient`가 private 필드를 타입 캐스팅으로 접근**
- 위치: `azure-openai.client.ts` L11
- 상세: `(this as unknown as { client: OpenAI }).client = new OpenAI(...)` — 부모 클래스의 `private` 필드를 타입 단언으로 강제 접근합니다. `openai` SDK 버전 업그레이드 시 필드명 변경으로 런타임 오류 발생 위험이 있습니다.
- 제안: `OpenAIClient`에서 `client` 필드를 `protected readonly`로 변경하거나, `AzureOpenAIClient`를 `OpenAIClient`를 상속하지 않고 독립적으로 구현

---

**[WARNING] `LlmModule`과 `LlmConfigModule` 간 순환 의존성**
- 위치: `llm.module.ts` L5, `llm-config.module.ts` L6
- 상세: 두 모듈이 서로 `forwardRef()`로 참조하고 있습니다. `LlmService`는 `LlmConfigService`에 의존하고, `LlmConfigController`는 `LlmService`에 직접 주입받고 있습니다. 이 구조는 NestJS `forwardRef`로 해결되었으나, 컨트롤러 레벨의 서비스 직접 교차 의존은 모듈 경계를 위반합니다.
- 제안: `LlmConfigController`에서 `LlmService` 직접 주입을 제거하고, `testConnection`, `listModels`를 `LlmConfigService`에 위임하거나 별도 파사드(facade) 서비스로 분리

---

**[WARNING] `EmbeddingService`의 폴링 기반 동시성 제어**
- 위치: `embedding.service.ts` L38-41
- 상세: `while (this.activeTasks >= MAX_CONCURRENT) { await new Promise(resolve => setTimeout(resolve, 500)); }` — 500ms 폴링은 비효율적이며, 이미 `bullmq`가 의존성으로 존재함에도 사용하지 않고 있습니다.
- 제안: 이미 설치된 `BullMQ`를 활용하여 문서 처리 큐를 구성하거나, 최소한 `p-limit`(이미 의존성에 존재)을 사용

---

**[INFO] `csv-parse`의 동기 API 사용**
- 위치: `csv.parser.ts` L1
- 상세: `csv-parse/sync`를 import하여 동기 파싱을 사용합니다. 대용량 CSV 파일의 경우 Node.js 이벤트 루프를 블로킹할 수 있습니다.
- 제안: 50MB 파일 업로드를 허용하는 컨트롤러 설정을 고려하면 비동기 API(`csv-parse` 스트리밍) 사용 권장

---

**[INFO] `uuid v13`과 `@types/uuid v10` 버전 불일치**
- 위치: `package.json` L60, L79
- 상세: `uuid: ^13.0.0`과 `@types/uuid: ^10.0.0`의 메이저 버전이 다릅니다. `uuid v13`은 ESM 전용 패키지로, jest 설정에 `transformIgnorePatterns`에서 uuid를 제외 처리 중이나, 타입 정의가 v10 기준으로 일부 API가 맞지 않을 수 있습니다.
- 제안: `@types/uuid` 버전을 `uuid` 메이저 버전에 맞춰 업데이트하거나, 최신 버전 확인 필요

---

**[INFO] `S3Service`가 글로벌 서비스가 아닌 `KnowledgeBaseModule`에서만 제공됨**
- 위치: `knowledge-base.module.ts` L22
- 상세: `S3Service`가 `KnowledgeBaseModule`의 `providers`에만 등록되어 있습니다. 다른 모듈에서 S3가 필요해질 경우 중복 등록이 발생합니다.
- 제안: `S3Service`를 `CommonModule` 또는 `SharedModule`로 이동하여 전역 제공자로 관리

---

**[INFO] `pgvector` 확장을 마이그레이션에서 `CREATE EXTENSION IF NOT EXISTS`로 처리**
- 위치: `V005__document_chunk_pgvector.sql` L1-2
- 상세: `CREATE EXTENSION IF NOT EXISTS vector`는 DB 슈퍼유저 권한이 필요합니다. CI/CD 환경에서 제한된 권한의 DB 사용자로 실행 시 실패할 수 있습니다.
- 제안: 배포 문서에 pgvector 확장 사전 설치 요구사항을 명시하고, 권한 오류 시 명확한 에러 메시지를 제공하는 사전 검사(pre-flight check) 추가 고려

---

### 요약

이번 변경에서 추가된 핵심 의존성(`@anthropic-ai/sdk`, `@aws-sdk/client-s3`, `@google/generative-ai`, `openai`, `csv-parse`, `pdf-parse`)은 기능 구현에 필요하고 적절하게 선택되었습니다. 그러나 `LlmModule` ↔ `LlmConfigModule`의 순환 의존성이 `forwardRef`로 해결은 되었지만 모듈 경계 위반이 발생하고 있으며, `AzureOpenAIClient`의 `private` 필드 강제 접근, 이미 설치된 `BullMQ`나 `p-limit`를 활용하지 않은 폴링 기반 동시성 제어, `uuid v13` 타입 불일치가 주요 개선 대상입니다. 전반적으로 의존성 선택은 합리적이나 내부 모듈 구조와 일부 의존성 활용 방식에서 개선이 필요합니다.

### 위험도

**MEDIUM**