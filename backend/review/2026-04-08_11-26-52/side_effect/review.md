## 발견사항

### **[WARNING]** EmbeddingService - 공유 상태 변수 `activeTasks` 경쟁 조건
- **위치**: `embedding.service.ts` - `processDocument()` 메서드
- **상세**: `activeTasks`는 인스턴스 변수로 비동기 경쟁 조건에 노출됨. `while` 루프로 폴링하는 방식은 Node.js 이벤트 루프를 불필요하게 점유하며, 에러 발생 시 `finally`에서 감소하더라도 `doProcess` 내부 중간 단계에서 예외가 발생할 경우 카운터 누수 가능성이 있음.
- **제안**: 세마포어 패턴이나 Bull Queue 같은 검증된 큐 라이브러리 사용 권장

---

### **[WARNING]** S3Service - 하드코딩된 자격증명 기본값
- **위치**: `s3.service.ts` - `constructor` (L22-23)
- **상세**: `minioadmin`/`minioadmin` 기본값이 소스코드에 포함됨. 환경변수 미설정 시 로컬 개발용 자격증명으로 프로덕션에 의도치 않게 연결될 위험 있음.
- **제안**: 프로덕션 환경에서는 값 부재 시 명시적 오류 발생시키거나, 환경별 설정 분리 필요

---

### **[WARNING]** LlmConfigService - `maskApiKey` 실패 시 사이드 이펙트
- **위치**: `llm-config.service.ts` - `maskApiKey()` (L~170)
- **상세**: 복호화 실패 시 `****`를 반환하지만, 암호화 키 없이 저장된 레거시 데이터나 키 교체 시 모든 API 키가 `****`로 표시되어 사용자가 키 상태를 알 수 없음. `update()` 메서드에서 `encryptionKey` 없이 `encrypt`를 호출하면 빈 키로 암호화됨 (L113).
- **제안**: `update()` 시작 시 `encryptionKey` 존재 여부 검증 추가 (`create()`처럼)

---

### **[WARNING]** AiAgentHandler - Tool 실행이 Stub 구현
- **위치**: `ai-agent.handler.ts` - tool call 루프 (L~85-100)
- **상세**: 툴 노드 실행이 플레이스홀더로 구현됨 (`Tool ${tc.name} executed`). 실제 노드 실행 없이 LLM에게 허위 결과를 반환하여 LLM이 잘못된 정보 기반으로 계속 추론함. 이는 의도치 않은 동작 부작용임.
- **제안**: 미구현 상태를 명시적으로 표시하거나, 툴 미지원 시 예외 발생

---

### **[WARNING]** RagSearchService - 워크스페이스 격리 누락 가능성
- **위치**: `rag-search.service.ts` - SQL 쿼리 (L~45-55)
- **상세**: `WHERE d.knowledge_base_id = ANY($2::uuid[])` 조건만 존재하고 `workspace_id` 직접 검증이 없음. `knowledgeBaseIds`가 다른 워크스페이스의 KB ID를 포함하더라도 필터링되지 않아 잠재적 데이터 격리 위반 가능성.
- **제안**: SQL에 `AND dc.knowledge_base_id IN (SELECT id FROM knowledge_base WHERE workspace_id = $N)` 추가

---

### **[WARNING]** KnowledgeBaseController - `POST /search` 라우트 순서 충돌
- **위치**: `knowledge-base.controller.ts` - `@Post('search')` (마지막 엔드포인트)
- **상세**: `/knowledge-bases/search`가 `/knowledge-bases/:id`와 라우트 패턴 충돌 가능. NestJS는 등록 순서에 따라 매칭하므로 `GET :id`가 먼저 등록되어도 `POST search`는 다른 메서드라 충돌하지 않지만, `search`가 UUID가 아니어서 `ParseUUIDPipe` 오류 없이 패스함. 그러나 미래 `GET search` 추가 시 위험.
- **제안**: 검색 엔드포인트를 별도 경로(`/knowledge-bases/search/vector`)로 분리하거나, 컨트롤러 최상단에 배치

---

### **[INFO]** `llm.config.ts` - 빈 암호화 키 허용
- **위치**: `llm.config.ts` (L4)
- **상세**: `ENCRYPTION_KEY || ''`로 빈 문자열을 기본값으로 허용. `create()` 메서드에서 빈 키를 체크하지만 `update()`에서는 체크하지 않음. 키 없이 시작한 후 API 키 업데이트 시 빈 키로 암호화됨.
- **제안**: 애플리케이션 시작 시점에 키 존재 여부 강제 검증

---

### **[INFO]** `forceSplitAndPush` - 마지막 청크 중복 검사 부재
- **위치**: `text-chunker.ts` - `forceSplitAndPush()` (L~110-125)
- **상세**: 마지막 `remaining` 처리 시 `chunks[chunks.length - 1]?.content`와 비교하지만, 이미 `overlapBuffer`가 포함된 내용과 비교 불일치 가능성. `pushChunk`와 직접 `push`를 혼용하여 인덱스 계산이 달라질 수 있음.
- **제안**: `forceSplitAndPush` 내부에서 일관되게 `pushChunk` 함수 사용

---

### **[INFO]** DocumentChunk 엔티티 - `embedding` 컬럼 누락
- **위치**: `document-chunk.entity.ts`
- **상세**: `embedding` 컬럼이 엔티티에 매핑되지 않아 TypeORM schema sync 시 컬럼이 생성되지 않음 (마이그레이션에는 있음). Flyway/마이그레이션을 사용하므로 실용적 문제는 없지만, 엔티티 클래스만 보면 컬럼 존재를 알 수 없어 유지보수 혼란.
- **제안**: 주석 외에 별도 문서화 또는 커스텀 데코레이터로 vector 타입 명시

---

## 요약

전반적으로 코드 구조는 양호하며 주요 로직은 의도된 설계대로 구현되어 있습니다. 가장 중요한 부작용 위험은 세 가지입니다: (1) **RagSearchService의 워크스페이스 격리 누락** - 다른 워크스페이스의 지식베이스에 접근 가능한 데이터 격리 취약점, (2) **AiAgentHandler의 툴 실행 Stub** - LLM이 허위 툴 실행 결과를 받아 잘못된 추론을 수행하는 기능적 부작용, (3) **LlmConfigService의 업데이트 시 암호화 키 검증 누락** - 환경 변수 미설정 상태에서 API 키가 빈 키로 암호화되는 보안 부작용. S3 하드코딩 자격증명과 EmbeddingService의 공유 상태 경쟁 조건도 프로덕션 환경에서 문제가 될 수 있습니다.

## 위험도

**MEDIUM** (워크스페이스 격리 취약점과 보안 관련 암호화 이슈로 인해)