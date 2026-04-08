### 발견사항

---

**[CRITICAL] S3 자격증명 하드코딩**
- 위치: `s3.service.ts` — constructor
- 상세: `accessKeyId: 'minioadmin'`, `secretAccessKey: 'minioadmin'`, `endpoint: 'http://localhost:9000'` 가 fallback 기본값으로 하드코딩되어 있음. 환경변수가 미설정되면 기본값이 그대로 사용되어 프로덕션 환경에서 자격증명 노출 가능.
- 제안: fallback 기본값 제거, 환경변수 미설정 시 앱 시작 실패 처리 (startup validation)

---

**[WARNING] RAG 검색 쿼리의 knowledgeBaseIds 입력 검증 부재**
- 위치: `rag-search.service.ts` — `search()`, `knowledge-base.controller.ts` — `search()` endpoint
- 상세: `POST /knowledge-bases/search` 엔드포인트가 body의 `knowledgeBaseIds` 배열을 직접 SQL `ANY($2::uuid[])` 파라미터로 넘김. UUID 캐스팅 자체로 SQL 인젝션은 방어되나, `knowledgeBaseIds`가 해당 workspaceId 소유인지 **검증하지 않음** — 다른 워크스페이스의 knowledge base ID를 넣으면 해당 데이터를 조회 가능 (IDOR).
- 제안: 쿼리에 `JOIN knowledge_base kb ON kb.id = d.knowledge_base_id AND kb.workspace_id = $workspaceId` 조건 추가

---

**[WARNING] ENCRYPTION_KEY 검증 누락 (update 경로)**
- 위치: `llm-config.service.ts` — `update()` 메서드
- 상세: `create()`에서는 `encryptionKey` 미설정 시 예외를 던지지만, `update()`에서 apiKey 갱신 시에는 동일한 검증이 없음. `encryptionKey`가 비어있으면 `encrypt()` 호출 결과가 예측 불가능하거나 평문 저장 위험.
- 제안: `update()`에서도 `dto.apiKey` 처리 전 `encryptionKey` 존재 확인

---

**[WARNING] 암호화 키 강도 미검증**
- 위치: `llm.config.ts`, `llm-config.service.ts`
- 상세: `ENCRYPTION_KEY`가 존재하는지만 확인하고 길이/엔트로피를 검증하지 않음. 짧거나 약한 키(`"1"`, `"abc"`)도 허용됨.
- 제안: 키 길이(최소 32바이트/64 hex chars) 및 형식을 startup validation에서 검증

---

**[WARNING] 파일 업로드 — MIME 타입/매직바이트 미검증**
- 위치: `knowledge-base.service.ts` — `uploadDocument()`, `knowledge-base.controller.ts`
- 상세: 파일 확장자(`.pop()`)만으로 파일 타입을 결정. 공격자가 실행 파일을 `malware.pdf`로 업로드하면 확장자 검사를 통과함. `file.mimetype`도 클라이언트가 조작 가능.
- 제안: `file-type` 라이브러리 등으로 Buffer 매직바이트 검증 추가

---

**[WARNING] 파일명 경로 탐색(Path Traversal) 가능성**
- 위치: `knowledge-base.service.ts` — `uploadDocument()`
- 상세: `file.originalname`을 직접 S3 key에 포함: `kb/${kbId}/${docId}/${file.originalname}`. 원본 파일명에 `../` 또는 특수문자가 포함될 경우 S3 키 구조 오염 가능. S3는 실제 파일시스템 탐색은 안되나, 키 충돌·접근 범위 문제 발생 가능.
- 제안: `path.basename(file.originalname)` + sanitize(영문, 숫자, 하이픈만 허용) 처리

---

**[WARNING] 도구 호출(Tool Call) 실행 시 입력 무검증**
- 위치: `ai-agent.handler.ts` — tool use loop
- 상세: LLM이 반환한 `tc.arguments`가 JSON 파싱 없이 그대로 tool result 메시지에 포함됨. 현재는 placeholder이나 실제 tool node 실행 시 LLM이 생성한 임의 arguments가 검증 없이 실행될 수 있음 (Prompt Injection → Tool Abuse).
- 제안: tool arguments를 schema로 검증 후 실행, 허용 tool node 목록을 whitelist로 제한

---

**[WARNING] 에러 메시지의 내부 정보 노출**
- 위치: `knowledge-base.service.ts` — `remove()`, `removeDocument()`, `embedding.service.ts`
- 상세: `this.logger.warn(`Failed to delete S3 object ${doc.fileUrl}: ${err}`)` — S3 키 경로(내부 구조)와 에러 상세가 로그에 기록됨. 로그 집계 시스템이 외부에 노출되면 내부 스토리지 구조 유출 가능.
- 제안: 로그에 전체 경로 대신 documentId만 기록, err 객체는 message만 출력

---

**[WARNING] PDF 파서 require() 사용 — 보안 감사 취약**
- 위치: `pdf.parser.ts`
- 상세: `require('pdf-parse')` 를 dynamic require로 사용하며 `// eslint-disable-next-line` 주석으로 lint를 우회. `pdf-parse`는 업스트림 메인터넌스가 불활발하고 악성 PDF로 인한 파싱 폭탄(billion laughs 류)에 취약할 수 있음.
- 제안: `pdfjs-dist` 또는 적극 관리되는 라이브러리로 교체, 파싱 타임아웃/크기 제한 추가

---

**[INFO] pgvector extension 자동 활성화**
- 위치: `V005__document_chunk_pgvector.sql`
- 상세: `CREATE EXTENSION IF NOT EXISTS vector` — 프로덕션 DB에서 extension 설치는 superuser 권한 필요. 앱 DB 유저가 superuser라면 권한 과다 부여 상태.
- 제안: DB superuser로 extension을 사전 설치하고, 앱 유저는 최소 권한만 부여

---

**[INFO] LLM API 키가 응답에 부분 노출**
- 위치: `llm-config.service.ts` — `maskApiKey()`
- 상세: `${decrypted.substring(0, 4)}...${decrypted.substring(decrypted.length - 4)}` — 앞 4자리 + 뒤 4자리를 노출. OpenAI 키(`sk-...`)는 앞부분이 고정이므로 뒤 4자리만 노출로 충분.
- 제안: 앞 4자리 대신 provider prefix만 표시하거나 뒤 4자리만 노출

---

### 요약

전반적으로 SQL 파라미터 바인딩, UUID 검증, API 키 암호화 저장 등 기본 보안 설계는 잘 되어 있습니다. 그러나 **S3 자격증명 하드코딩**, **RAG 검색의 IDOR(Insecure Direct Object Reference)**, **파일 업로드 시 MIME/매직바이트 미검증**, **경로 탐색 가능한 파일명 처리** 등 실제 공격으로 이어질 수 있는 취약점이 다수 존재합니다. 특히 multi-tenant 환경에서 워크스페이스 간 데이터 격리는 핵심 보안 요구사항이므로, RAG 검색의 knowledgeBaseIds 소유권 검증 부재는 즉시 수정이 필요합니다.

### 위험도

**HIGH**