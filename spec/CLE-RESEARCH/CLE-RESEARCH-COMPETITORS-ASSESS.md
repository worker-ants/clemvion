---
id: "CLE-RESEARCH-COMPETITORS-ASSESS"
title: "경쟁 분석: n8n · Flowise — 강점과 약점"
type: "design"
version: 1
status: "approved"
requirements: []
basis_superseded: false
parent: "CLE-RESEARCH-COMPETITORS"
ancestors: ["CLE-VISION", "CLE-RESEARCH", "CLE-RESEARCH-COMPETITORS"]
area: "CLE-RESEARCH"
content_hash: "227895733a1eaee0fdf2281faa78687ee2ff5b6daa53369346d4308da272a420"
read_as: "approved_fallback"
task: "CLE-T-55J6ZX"
source_paths: []
mirror_sha256: "d54984ccfd9c052bbf88628a12ccc7d32f719438accb0baaba30e6527c00775f"
etag: "sha256-582ca8977c6cb5ec77bebf6da5d050771bf5203584bdb00cfdaaba33a3fe0553"
---
## 개요

이 문서는 [경쟁 분석: n8n · Flowise](CLE-RESEARCH-COMPETITORS.md) 의 하위 문서로 2026-06-03 정독에서 확인한 강점과 약점 · 갭을 정한다. 우선순위와 추적처는 부모의 [후속 액션의 현재 상태](CLE-RESEARCH-COMPETITORS.md#후속-액션의-현재-상태) 에 있다.

## 강점

2026-06-03 정독에서 확인한 강점이다. 수치는 그 시점 값이다.

### 사람 개입 · 대화형 실행의 신뢰성 (🟢)

- **영속 재개**: 입력 대기(`waiting_for_input`) 실행을 BullMQ `execution-continuation` 큐와 DB rehydration 으로 재개한다. 인스턴스가 죽어도 며칠 뒤 입력이 오면 아무 인스턴스나 작업을 가져가 스냅샷과 체크포인트로 컨텍스트를 다시 만든다. 기한 없이 보존한다(TTL 없음). 옛 Redis pub/sub(at-most-once)은 의도적으로 버렸다. 규칙은 [장애 복구와 안전 종료](../CLE-EXEC/CLE-EXEC-RECOVERY.md) 에 있다. n8n · Flowise · Langflow 의 인메모리 · 단일 노드 대기보다 분명히 앞선다.
- **상태 전이 원자성**: `running ↔ waiting_for_input` 전이를 짝이 되는 노드 실행 변경과 한 DB 트랜잭션으로 묶는다. 멱등성 가드가 여러 층이다(BullMQ jobId 는 Redis INCR 멱등 키, 처리 전 상태 재검증). 규칙은 [실행 상태 머신과 대기·재개](../CLE-EXEC/CLE-EXEC-STATE.md) 에 있다.
- **분산 stuck 회수**: 전역 Redis lock(`exec:recover:lock`, Lua 로 명시 해제)으로 한 인스턴스만 회수를 돌린다.
- **재현성**: 설정(원본 표현식)과 출력(평가 결과)을 따로 보존한다. 멀티턴은 frozen snapshot 을 쓴다. [재실행](../CLE-EXEC/CLE-EXEC-RERUN.md) 은 dry-run 과 체인 추적(`re_run_of`, 깊이 32)을 지원한다.

### AI · RAG (🟢)

- **Graph RAG 완전 구현(P0 ~ P2)**: entity · relation 자동 추출, recursive CTE 1 ~ 2 hop Hybrid 검색, 3D/2D 시각화를 갖췄다. Neo4j 같은 추가 인프라 없이 PostgreSQL + pgvector 안에서 돈다. Dify · Flowise 가 제공하지 않는 영역이다. 규칙은 [Graph RAG](../CLE-KB/CLE-KB-GRAPH.md) 에 있다.
- **다섯 모델 프로바이더의 통일 추상화**: OpenAI · Anthropic · Google · Azure · Local(Ollama · vLLM) 모두 스트리밍 · tool calling · JSON Schema 를 지원한다. `thinkingTokens` 와 Gemini `thought_signature` 까지 흡수하고 SSRF 가드를 둔다. 규칙은 [LLM 클라이언트](../CLE-AI/CLE-AI-LLM.md) 에 있다.
- **Agentic RAG**: 지식 저장소를 `kb_<id>` 도구로 LLM 에 노출한다. "교환/반품 정책" 같은 질의를 지식 단위로 나눠 여러 번 검색한다. 단순 retrieve-then-read 보다 앞선 방식이다. 규칙은 [RAG 검색](../CLE-KB/CLE-KB-SEARCH.md) 에 있다.
- **MCP 클라이언트와 내부 MCP 브리지**: 외부 MCP 서버를 연결하고 first-party 통합(Cafe24)을 HTTP 없이 in-process 도구로 노출한다. OAuth 는 스스로 회복한다. 규칙은 [MCP 클라이언트](../CLE-INT/CLE-INT-MCP.md) 에 있다.
- **Planner-first 대화형 워크플로우 구성**: Clarify → Plan → Execute 3단계로 진행한다. 백엔드 ShadowWorkflow 검증 뒤 SSE 로 반영하고 Undo 를 지원한다. `verify_workflow` 로 스스로 검토하고 런타임 포트 힌트로 왕복을 없앴다. n8n AI Assistant 보다 그래프 구조를 잘 이해한다. 규칙은 [워크플로우 AI 어시스턴트](../CLE-WF/CLE-WF-ASSIST.md) 와 [AI 어시스턴트 도구](../CLE-WF/CLE-WF-ASSIST-TOOLS.md) 에 있다.
- **DB 영속 멀티턴 에이전트**: `_resumeCheckpoint` 를 JSONB 로 영속해 재시작하거나 다른 인스턴스로 넘어가도 대화를 잇는다. Langflow 의 인메모리 상태보다 견고하다.
- **토큰 · 비용 추적**: `llm_usage_log` 에 `node_execution_id`, prompt · completion · total · thinking 토큰, `cost_usd` 를 쌓고 통계 화면에 보여 준다([LLM 사용량 기록](../CLE-AI/CLE-AI-USAGE.md), [통계](../CLE-OBS/CLE-OBS-STATS.md)). 한계는 두 가지다. 임베딩 토큰은 기록하지 않고 Dify 식 프롬프트별 토큰 디버거와 평가 기능은 없다.

### 노드 깊이와 UX (🟢, 폭과 다른 축)

- **Cafe24 운영급 깊이**: 18 카테고리 전부, 약 180 endpoint, 222 필드 단위 카탈로그를 갖췄다. OAuth 자동 갱신, 429 leaky-bucket, KST 처리, dry-run 쓰기 차단을 지원한다. 기준 문서는 [Cafe24 노드](../CLE-NODE-INT/CLE-NODE-CAFE24.md) 와 [Cafe24 API 카탈로그](CLE-C24-CATALOG) 다. 현재 endpoint 수는 제품 개요 기준 485 이고 같은 패턴의 [MakeShop 노드](../CLE-NODE-INT/CLE-NODE-MAKESHOP.md) 가 더해졌다.
- **Presentation 노드 5종**(Carousel · Table · Chart · Form · Template): 데이터 전달과 시각 렌더를 함께 한다. 버튼 blocking 으로 사람 개입 UI 출력을 1급으로 다룬다. n8n · Zapier 에 없는 축이다. 규칙은 [Presentation 노드](../CLE-NODE-PRES/CLE-NODE-PRES.md) 에 있다.
- **옴니채널 채팅 배포**: 같은 워크플로우를 Telegram · Slack · Discord 봇과 임베드 웹채팅 위젯(npm 패키지 2개)에 배포한다. Presentation 노드는 채널 UI 로 자동 변환된다. 규칙은 [채팅 채널](../CLE-CHAT/CLE-CHAT.md) 과 [웹채팅](../CLE-WEBCHAT/CLE-WEBCHAT.md) 에 있다.
- **로직 제어 12종**: Parallel(동시성 상한 32), Loop · Map · ForEach(emit 수집), Background(큐 격리), 순환 back-edge, 서브 워크플로우를 지원한다. 규칙은 [Logic 노드](../CLE-NODE-LOGIC/CLE-NODE-LOGIC.md) 에 있다.

### 보안과 성숙도 (🟢)

v1 이 놓친 강점이다. n8n · Dify 커뮤니티 에디션보다 앞선다.

- **인증 깊이**: WebAuthn(Passkey · FIDO2)과 TOTP 2단계 인증을 갖췄다. 같은 로그인 세션의 리프레시 토큰을 한 묶음으로 두고 토큰을 회전한다. 재사용을 감지하면 그 로그인 세션을 끊는다. 규칙은 [가입과 로그인](../CLE-ACCT/CLE-ACCT-SIGNIN.md) 과 [세션과 토큰](../CLE-ACCT/CLE-ACCT-SESSION.md) 에 있다. **현재**: 동시 로그인 세션 수 제한은 구현되지 않았다([세션과 토큰](../CLE-ACCT/CLE-ACCT-SESSION.md#미결-사항), 후속 NERV Task `CLE-T-VBQV4H`).
- **코드로 강제하는 RBAC**: 소유자 · 관리자 · 편집자 · 뷰어 4단계다. `@Roles` 와 `@WorkspaceId` 가드를 15개 모듈에 적용했고 reveal 권한은 관리자 이상으로 분리했다. 규칙은 [워크스페이스와 멤버](../CLE-ACCT/CLE-ACCT-WS.md) 에 있다.
- **감사 로그와 운영 가시성**: 감사 로그 8 카테고리(2026-06-03 기준), 로그인 이력(180일), 시스템 상태 API, 알림 규칙, OTel 트레이스를 갖췄다. 규칙은 [감사 로그](../CLE-OBS/CLE-OBS-AUDIT.md), [시스템 상태](../CLE-OBS/CLE-OBS-STATUS.md), [알림](../CLE-OBS/CLE-OBS-NOTIFY.md), [로깅과 헬스 체크](../CLE-OBS/CLE-OBS-LOGGING.md) 에 있다. **현재**: 감사 로그 보관 정리는 구현되지 않았다([감사 로그](../CLE-OBS/CLE-OBS-AUDIT.md)).
- **DB 마이그레이션 규율**: Flyway 마이그레이션 70개, CI 버전 충돌 가드, NOT VALID/VALIDATE 2단계 적용. n8n 대비 강점이다. 규칙은 [DB 마이그레이션 규약](../CLE-ENG/CLE-ENG-MIGRATION.md) 에 있다.
- **시크릿**: AES-256-GCM(IV + authTag, AAD) 시크릿 저장소와 `secret://` URI 를 쓴다. 규칙은 [시크릿 저장소](../CLE-INT/CLE-INT-SECRET.md) 에 있다.
- **버전 기록**: 저장할 때마다 불변 jsonb 스냅샷을 남기고 diff 와 복원을 지원한다. 규칙은 [버전 기록](../CLE-WF/CLE-WF-VERSION.md) 에 있다.
- **라이선스**: `LICENSE`(AGPL v3)와 `LICENSE-COMMERCIAL.md` 의 듀얼 라이선스로 오픈코어 전략을 이미 택했다. n8n SUL · Dify 와 같은 구도다.

## 약점과 갭

2026-06-03 판단이다. 동그라미 번호(①~⑭)는 원문 번호다. 그 뒤 달라진 상태는 항목 끝에 "현재" 로 적는다.

### 치명 (🔴): 핵심 약속을 훼손하는 갭

- **① 실행 엔진 신뢰성**(무조건 P0): 정확성과 장기 대기 내구성은 강했다. 그러나 실행 중 크래시 복구, 처리량과 수평 확장, backpressure, 멀티테넌트 자원 가드 네 차원이 n8n single mode 수준이었다(당시 엔진 스펙의 워커 풀 · heartbeat · 동시 실행 가드가 모두 Planned). 어떤 사용 시나리오에서도 운영 신뢰성을 채우지 못했다. 목표 아키텍처는 이미 설계돼 있어 증분으로 지을 수 있었다. 복구 · 재큐 범위와 분석은 [실행 엔진 신뢰성 분석](CLE-RESEARCH-COMPETITORS-GAPS.md#실행-엔진-신뢰성-분석) 에 있다. **현재**: 대부분 구현됐다([큐 워커와 동시 실행 제한](../CLE-EXEC/CLE-EXEC-WORKER.md), [장애 복구와 안전 종료](../CLE-EXEC/CLE-EXEC-RECOVERY.md)).
- **③ 통합 폭과 확장 경로의 봉쇄**: 범용 커넥터는 HTTP · DB · Email 3개, 여기에 Cafe24 1개로 모두 4개뿐이었다. 마켓플레이스는 `status: backlog` 에 `code: []` 였고 플러그인 SDK 는 착수하지 않았다. `custom` 노드 카테고리는 enum 에도 없었다. 폭을 늘릴 자체 경로와 커뮤니티 경로가 모두 닫혀 있었다. n8n 커뮤니티 노드 생태계와 정반대다. **현재**: 통합 노드에 MakeShop 이 더해졌다([통합 노드](../CLE-NODE-INT/CLE-NODE-INT.md)). 마켓플레이스, 플러그인 SDK, `custom` 카테고리는 여전히 미구현이다([마켓플레이스 (구상)](../CLE-UI/CLE-UI-MARKET.md), [노드 시스템 구조와 카탈로그](../CLE-NODE/CLE-NODE-ARCH.md)).
- **④ 스펙과 코드의 차이**: 2026-06-03 감사가 "현재형으로 약속했지만 코드가 없는" 표면을 31개 영역에서 찾았다. 문서상 기능과 실제 동작이 다르면 셀프 호스팅 평가자의 신뢰를 잃는다. **현재**: `spec-sync-*` 계획들로 줄여 추적한다. NERV 문서는 머리 줄의 구현 상태로 이 차이를 드러낸다.

② 노드를 도구로 쓰는 경로는 도메인 액션이 `mcp_` 도구로 살아 있어 🟡 로 내렸다([노드를 도구로 쓰는 경로](CLE-RESEARCH-COMPETITORS-GAPS.md#노드를-도구로-쓰는-경로)). 등급이 바뀐 과정은 [핵심 갭 근거 분석의 Rationale](CLE-RESEARCH-COMPETITORS-GAPS.md#rationale) 에 있다.

### 중대 (🟠): 경쟁 열위 축

- **⑤ 멀티에이전트 · A2A 부재**: 단일 에이전트와 도구 라우팅만 있다. agent-to-agent, crew, 위임 같은 1급 개념이 없다. 2026 흐름에서 이것은 기본 요건이 되고 있다. Linux Foundation 이 A2A 거버넌스를 맡았고 Dify · n8n · Gumloop · Lindy 가 모두 갖췄다. Clemvion 에는 MCP 는 있지만 A2A 는 없다. **현재**: 변화 없음.
- **⑥ LLMOps 성숙도**: 전용 리랭커가 없었다(코사인 단독). 청킹 전략이 빈약했다(`chunk_size` · overlap 두 값뿐, metadata 는 항상 빈 `{}`). 평가셋과 프롬프트 회귀 프레임워크가 전혀 없었다. 프롬프트 버전 관리와 라이브러리가 없고 LLM 트레이싱(Langfuse 식)도 연결하지 않았다. Dify 의 노드별 토큰 디버거와 annotation 에 뒤진다. **현재**: 리랭킹([RAG 검색](../CLE-KB/CLE-KB-SEARCH.md))과 검색 지표 평가 하네스([RAG 품질 평가](../CLE-KB/CLE-KB-EVAL.md))가 구현됐다. 나머지는 그대로다.
- **⑦ 엔터프라이즈 SSO 부재**: SAML · LDAP · AD 는 미구현(Planned)이고 SCIM 은 언급조차 없다. 조직(Org) 계층과 조직 단위 공유도 없다(워크스페이스가 최상위). Dify Enterprise 의 핵심 차별점에 비해 갭이다. **현재**: 변화 없음([가입과 로그인](../CLE-ACCT/CLE-ACCT-SIGNIN.md)). 조직 수준 통합 공유는 [Clemvion 제품 개요](../CLE-VISION.md) 로드맵에 있다.
- **⑧ 셀프 호스팅 운영성 미완**: NF-SC-08 · NF-EX-03 · NF-DP-02 · NF-DP-03 · NF-DP-06 이 모두 ❌ 다. docker-compose 는 로컬 개발 인프라 전용이다. Helm, 명령 한 번으로 설치하는 배포, 운영 문서는 착수하지 않았다. n8n · Dify 의 명령 한 번 · Docker Compose 배포에 비해 갭이다. **현재**: 변화 없음([비기능 요구사항](../CLE-PLAT/CLE-PLAT-NFR.md)).
- **⑨ 한국 커머스 채널 전략 부재**: 실제 갭은 알림톡 · 친구톡 대행사 통합 노드가 없고 옴니채널 이야기가 가치 낮은 채널(Telegram · Slack · Discord)에 치우친 것이다. Cafe24 주문 이벤트 → 알림톡(대행사) 조합이 이 시장의 결정타인데 구현되지 않았다. 판단 근거는 [한국 채널 전략](CLE-RESEARCH-COMPETITORS-GAPS.md#한국-채널-전략) 에 있다. **현재**: 미착지(P1-2).

### 보강 필요 (🟡)

- **⑩ 실시간 협업 없음**: CRDT · Yjs 가 없다. 원문은 저장이 last-write-wins 에 충돌 알림만 있다고 적었다. 워크스페이스 전환 API(`/switch`)도 없었다. **현재**: 워크스페이스 전환 API(`POST /api/auth/workspaces/:id/switch`)는 구현됐다([워크스페이스와 멤버](../CLE-ACCT/CLE-ACCT-WS.md)). 에디터 문서 기준으로 동시 편집 충돌 감지는 구현된 적이 없다. 저장은 수동 저장과 실행 직전 저장 두 경로뿐이다([워크플로우 에디터와 캔버스](../CLE-WF/CLE-WF-EDITOR.md)).
- **⑪ DB 커넥터가 좁다**: PostgreSQL · MySQL 두 종류뿐이다(MongoDB · Redis · BigQuery 없음). 임베딩은 Anthropic embed 를 지원하지 않는다. 기준 문서는 [Database Query 노드](../CLE-NODE-INT/CLE-NODE-DBQUERY.md) 와 [LLM 클라이언트](../CLE-AI/CLE-AI-LLM.md) 다.
- **⑫ Prometheus 메트릭 부재**: OTel 트레이스만 있었고 `/metrics` 와 MeterProvider 가 없었다. **현재**: 구현됐다. `OTEL_ENABLED=true` 이면 OTel MeterProvider 가 Prometheus `/metrics` 로 메트릭을 노출한다([비기능 요구사항](../CLE-PLAT/CLE-PLAT-NFR.md), [로깅과 헬스 체크](../CLE-OBS/CLE-OBS-LOGGING.md)).
- **⑬ 보안 백로그**: `JWT_SECRET` 하드코딩 fallback(`'dev-jwt-secret'`, CWE-798, 운영 부팅 강제 없음), `ENCRYPTION_KEY` 단일 마스터키의 여러 도메인 재사용, 인증 설정 CRUD 감사의 부분 구현, reveal 엔드포인트의 rate limit 부재. **현재**: `JWT_SECRET` 은 운영에서 없거나 기본값이면 부팅을 거부한다([세션과 토큰](../CLE-ACCT/CLE-ACCT-SESSION.md)). 인증 설정 감사는 `auth_config.create` · `update` · `delete` · `regenerate` · `reveal` 이 모두 구현됐다([감사 로그](../CLE-OBS/CLE-OBS-AUDIT.md)). 암호화 키 정리는 [시크릿 저장소 「R13. 통합 암호화 키를 마스터키와 따로 둔다」](../CLE-INT/CLE-INT-SECRET.md#r13-통합-암호화-키-integration_encryption_key-를-마스터키와-따로-두고-production-에서-키-없이-기동하지-않는다-2026-10-10) 에서 결정했다(2026-10-10). 통합 암호화 키 `INTEGRATION_ENCRYPTION_KEY` 는 마스터키 `ENCRYPTION_KEY` 와 따로 둔다. 마스터키 하나를 시크릿 저장소와 LLM API 키가 함께 쓰는 구조는 [시크릿 저장소 「R6. 마스터키를 LLM API 키와 함께 쓴다」](../CLE-INT/CLE-INT-SECRET.md#r6-마스터키를-llm-api-키와-함께-쓴다) 대로 둔다. 운영에서는 어느 키든 없거나 예시 값이면 부팅을 거부한다.
- **⑭ 브랜드 · 시장 검증 없음**: Dify(131k★, 100만 앱, 280 엔터프라이즈)와 n8n(182k★)에 비해 신생이다.

## Rationale

### 강점에서 동시 로그인 세션 제한을 뺐다 (2026-10-10)

원문은 「인증 깊이」 강점에 동시 세션 수 제한을 함께 적었다. 2026-10-10 에 코드를 확인하니 한 사용자의 로그인 세션 수를 세거나 한도를 넘는 로그인 세션을 끊는 코드가 없었다. 그래서 강점 문장에서 이 기능을 빼고 **현재** 표시로 미구현 상태를 적었다. 이 판단은 [세션과 토큰](../CLE-ACCT/CLE-ACCT-SESSION.md#미결-사항) 의 미결 사항과 [비기능 요구사항](../CLE-PLAT/CLE-PLAT-NFR.md) 의 구현 상태에 맞췄다. 구현은 후속 NERV Task `CLE-T-VBQV4H` 로 추적한다.
