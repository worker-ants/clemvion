---
worktree: competitive-analysis-e0569b
started: 2026-06-03
owner: 사용자 본인 (전략/기획)
---

# 경쟁력 분석 — n8n · Flowise · Dify · Langflow · Make · Zapier · Gumloop/Lindy 대비 Clemvion

> 작성일: 2026-06-03 (v2 — spec/코드 심층 정독 4건 + 외부 광범위 검색 후 전면 개정)
> 성격: 전략 리서치 산출물. 후속 액션은 §8 체크리스트.
> v1 대비: 4개 영역(실행엔진·AI/RAG·노드/통합·데이터모델/보안)을 spec+코드까지 정독해 **v1의 사실 오류 4건을 교정**하고 강·약점을 대폭 보강. 외부 경쟁사도 7종으로 확장.

---

## 0. v1 대비 핵심 교정 (사실 오류)

심층 정독으로 v1의 다음 단정이 **틀렸음**이 확인됐다. 정확한 판단을 위해 먼저 바로잡는다.

| v1 단정 | 실제 (코드 확인) |
|---|---|
| "라이선스 정의 부재 → 결정 필요" | **틀림.** `LICENSE`(AGPL v3) + `LICENSE-COMMERCIAL.md` 듀얼 라이선스 = 오픈코어 전략 이미 채택. n8n SUL·Dify와 동급 구도 |
| "토큰/비용 추적 미흡" | **부분 틀림.** `llm_usage_log` 엔티티에 `node_execution_id`·`prompt/completion/total/thinking_tokens`·`cost_usd` 보유, 통계 화면 surface. 단 임베딩 토큰 미로깅 + Dify식 "프롬프트별 토큰 디버거/eval"은 없음 |
| (언급 안 함) | **누락된 강점.** 인증/보안이 오히려 강점 — WebAuthn(Passkey)+TOTP 2FA, refresh family rotation+reuse 감지, AES-256-GCM SecretStore. n8n/Dify 커뮤니티 에디션보다 앞섬 |
| "분산 실행엔진 = 강점" (0-overview 표현 인용) | **중대 정정.** *running* 실행은 시작 인스턴스에 in-process pinned. 분산성은 *waiting→resume* 핸드오프에만 존재. worker pool·우선순위 큐·동시성/타임아웃 가드 전부 **미구현(Planned)**. 크래시 시 running 실행은 재큐 아닌 30분 후 fail |

---

## 1. 포지셔닝 — Clemvion의 진짜 정체

Clemvion은 spec 표면상 "AI 에이전트 + 노코드 워크플로우 빌더 통합 플랫폼"이지만, 심층 정독으로 드러난 실제 정체는 더 좁고 뚜렷하다:

> **"AI 챗봇/에이전트 + 노코드 워크플로 + 한국 커머스(Cafe24) 수직통합" 제품.**
> 범용 n8n/Dify의 *수평적 폭*이 아니라, **두 개의 진짜 해자(moat)** 위에 서 있다.

- **해자 A — 사람개입/대화형 워크플로의 신뢰성**: durable continuation(영속 BullMQ + DB rehydration), 상태전이 원자성(단일 트랜잭션), DB 영속 멀티턴 에이전트(`_resumeCheckpoint`). 재시작·장기대기에도 정합성 유지.
- **해자 B — 한국 커머스 도메인 깊이**: Cafe24 단일 통합을 222개 field-level 카탈로그 + ~180 endpoint로 정밀 모델링 + Internal MCP Bridge로 워크플로 노드·AI Agent 양쪽 노출 + Presentation/Form UI 노드 + 옴니채널 챗 배포.

**경쟁 지형 (2026)**:

| 진영 | 대표 | 규모/특징 |
|---|---|---|
| 범용 자동화 | **n8n**(182k★, 7년, 400+통합, self-host+무제한실행), **Make**(최고 비주얼 빌더, Zapier 대비 60%↓), **Zapier**(7000+ 통합, 비개발자 최강) | 폭·생태계 압도 |
| AI 앱/LLMOps | **Dify**(131k★, 100만+ 앱 배포, 280+ 엔터프라이즈[Maersk·Novartis], RAG/MCP/멀티에이전트), **Flowise**(51k★ MIT), **Langflow**(LangGraph 멀티에이전트) | RAG·에이전트 성숙도 |
| AI-native 에이전트 빌더 (신흥) | **Gumloop**($70M 펀딩, 멀티에이전트), **Lindy**(agent-to-agent "Lindies"), **Relay.app** | 멀티에이전트 오케스트레이션 기본 탑재 |
| 한국 커머스 인접 | **채널톡**($17.1M, CS 챗봇+워크플로, Shopify앱), **Cafe24 앱스토어 마케팅 자동화 앱**(타스온/휴머스온 등) | wedge가 **비어있지 않음** — 점(point) 솔루션이 선점 |

**전략적 함의**: Clemvion의 wedge("Cafe24 상점주 자동화")는 공백이 아니다. CS는 채널톡, 마케팅은 Cafe24 앱스토어 앱들이 선점. Clemvion의 차별화는 이들이 **단일목적(point) 앱**인 반면 Clemvion은 **프로그래머블 + 에이전틱 + 옴니채널 + 깊은 API**라는 점 — 즉 "한국 커머스를 위한 n8n/Dify"이지 "또 하나의 CS 챗봇"이 아니다.

---

## 2. Clemvion 강점 (심층 정독 확인)

### 2.1 엔지니어링 — 사람개입/대화형 신뢰성 🟢
- **Durable Continuation**: `waiting_for_input` 실행을 BullMQ `execution-continuation` 큐 + DB rehydration으로 재개. 인스턴스가 죽어도 며칠 뒤 입력 도착 시 임의 인스턴스가 pick-up → snapshot/checkpoint로 컨텍스트 재구성. **무기한 보존(TTL 없음)**. 옛 Redis pub/sub(at-most-once)을 의도적 폐기. (`spec/5-system/4-execution-engine.md §7.4/7.5`) — n8n/Flowise/Langflow의 인메모리·단일노드 wait 대비 명확한 우위.
- **상태전이 원자성**: `running↔waiting_for_input`을 짝 NodeExecution 변경과 단일 DB 트랜잭션으로 묶음(`§1.1`). 멱등성 다층 가드(BullMQ jobId = Redis INCR idempotency key + 처리 전 상태 재검증).
- **분산 stuck-recovery**: 전역 Redis lock(`exec:recover:lock`, Lua 명시 release)으로 단일 인스턴스만 recovery.
- **재현성**: config(원본 expression)/output(평가결과) 직교 보존, multi-turn frozen snapshot, Re-run dry-run + chain 추적(`re_run_of`, depth 32).

### 2.2 AI/RAG 🟢
- **Graph RAG 완전 구현(P0~P2)** — entity/relation 자동추출 + recursive CTE 1~2 hop Hybrid 검색 + **3D/2D 시각화**, 추가 인프라(Neo4j) 없이 PostgreSQL+pgvector 내. (`spec/5-system/10-graph-rag.md`) Dify/Flowise 미제공 영역.
- **멀티프로바이더 통일 추상화 5종** — OpenAI/Anthropic/Google/Azure/Local(Ollama·vLLM), 전부 스트리밍+tool calling+JSON Schema, `thinkingTokens`·Gemini `thought_signature`까지 흡수, SSRF 가드. (`spec/5-system/7-llm-client.md`)
- **Agentic RAG** — KB를 `kb_<id>` tool로 LLM에 노출, "교환/반품 정책"→지식단위 분해 멀티검색. 단순 retrieve-then-read보다 진보.
- **MCP 클라이언트 + Internal Bridge** — 외부 MCP 서버 연결 + first-party 통합(Cafe24)을 in-process 도구로 노출(HTTP 없이, OAuth 자가회복).
- **Planner-first Conversational Building** — Clarify→Plan→Execute, backend ShadowWorkflow 검증 후 SSE 반영 + Undo, `verify_workflow` self-review, runtime port hint로 round-trip 제거. n8n AI Assistant보다 graph-aware.
- **DB 영속 멀티턴 에이전트** — `_resumeCheckpoint`를 JSONB 영속 → 재시작/타 인스턴스 대화 재개. Langflow 인메모리 상태보다 견고.

### 2.3 노드 깊이·UX (폭이 아닌 직교 축) 🟢
- **Cafe24 운영급 깊이** — 18 카테고리 전부·~180 endpoint·**222 field-level 카탈로그**, OAuth 자동갱신·429 leaky-bucket·KST·dry-run write차단.
- **Presentation 노드 5종**(Carousel/Table/Chart/Form/Template) — 데이터 전달 + 시각 렌더 이중목적, 버튼 blocking으로 human-in-the-loop UI 출력을 1급 시민화. **n8n/Zapier에 없는 축.**
- **옴니채널 챗 배포** — 동일 워크플로를 Telegram/Slack/Discord 봇 + 임베드 웹챗 위젯(2 npm 패키지)에 배포, presentation 노드를 채널 UI로 자동 변환.
- **로직 제어 12종** — Parallel(동시성 cap 32)·Loop/Map/ForEach(emit 수집)·Background(큐 격리)·cyclic back-edge·sub-workflow.

### 2.4 보안·성숙도 🟢 (v1 누락분)
- **인증 깊이** — WebAuthn(Passkey/FIDO2)+TOTP 2FA, refresh family rotation + token reuse 감지 시 family 전체 revoke, 동시세션 제한. (`spec/5-system/1-auth.md`)
- **RBAC 코드 강제** — Owner/Admin/Editor/Viewer 4단계, `@Roles`+`@WorkspaceId` 가드 15개 모듈 적용, reveal 권한 Admin+ 분리.
- **감사로그/운영가시성** — AuditLog 8카테고리(90일)+LoginHistory(180일)+System Status API+Alert 룰+**OTel traces**.
- **DB 마이그레이션 규율** — Flyway 70개 + CI 버전충돌 가드 + NOT VALID/VALIDATE 2-step. n8n 대비 강점.
- **시크릿** — AES-256-GCM(IV+authTag, AAD) SecretStore + `secret://` URI.
- **버전 히스토리** — 저장 시 불변 jsonb 스냅샷, diff/restore.

---

## 3. Clemvion 약점·갭 (심층 정독 확인)

### 3.1 🔴 치명적 — 핵심 약속을 훼손하는 갭
- **① running 실행 분산/스케일 미구현** — 0-overview의 "분산 워커 풀 수평확장"은 *running* 단계엔 미적용. worker 모델(§4)·heartbeat(§7.1)·동시실행/타임아웃 가드(§8) 전부 Planned. **running 실행이 시작 인스턴스에 pinned**, 크래시 시 30분 후 fail(재큐 없음), 폭주 워크플로 멀티테넌트 보호장치 없음. → n8n queue mode에 명백한 열위 + 셀프호스팅 운영 리스크.
- **② AI Agent 일반 node-as-tool 연결이 현재 비활성** — `toolNodeIds`/`toolOverrides`가 config 스키마에서 **제거, 재작성 대기**(ND-AG-06/10/21). 현재 도구는 `kb_/mcp_/cond_/render_`로 한정. **"에이전트가 워크플로 노드를 도구로 호출"이라는 핵심 셀링포인트가 일시 공백.** (`spec/4-nodes/3-ai/_product-overview.md §3.2`)
- **③ 통합 폭 + 확장 메커니즘 봉쇄** — 범용 커넥터 HTTP·DB·Email 3 + Cafe24 1 = **4개뿐**. 마켓플레이스 `status: backlog`·`code:[]`, 플러그인 SDK 미착수, `custom` 노드 카테고리는 enum에조차 없음. **폭을 늘릴 자체·커뮤니티 경로가 닫혀 있음.** (n8n 커뮤니티 노드 생태계와 정반대)
- **④ spec↔code drift (31개 spec-sync plan)** — 2026-06-03 audit이 "현재형으로 약속했으나 코드 부재"인 surface를 31개 영역으로 추적 중. **"문서상 기능 ≠ 실동작" 리스크** — 셀프호스팅 평가자 신뢰 훼손.

### 3.2 🟠 중대 — 경쟁 열위 축
- **⑤ 멀티에이전트/A2A 부재** — 단일 에이전트 + 도구 라우팅만. agent-to-agent·crew·위임 1급 개념 없음. **2026 트렌드상 table stakes화** (Linux Foundation A2A 거버넌스, Dify/n8n/Gumloop/Lindy 전부 보유). MCP는 있으나 A2A 없음.
- **⑥ LLMOps 성숙도** — 전용 리랭커 없음(cosine 단독), 청킹 전략 빈약(chunk_size/overlap 2개 + metadata 항상 빈 `{}`), **eval/평가셋/프롬프트 회귀 프레임워크 전무**, 프롬프트 버전관리/라이브러리 없음, LLM 트레이싱(Langfuse식) 미연동. Dify의 노드별 토큰 디버거·annotation 대비 열위.
- **⑦ 엔터프라이즈 SSO 전무** — SAML/LDAP/AD 미구현(Planned), SCIM 언급 없음, 조직(Org) 레벨 계층/공유 부재(워크스페이스가 최상위). Dify Enterprise 핵심 차별점 대비 갭.
- **⑧ 셀프호스팅 운영성 미완** — NF-SC-08/EX-03/DP-02/DP-03/DP-06 전부 ❌. docker-compose는 로컬 dev 인프라 전용, Helm·1-command 배포·운영문서 미착수. n8n/Dify 1-command·Docker Compose 배포 대비 갭.
- **⑨ 한국 커머스인데 카카오톡 채널 미구현** — 챗 어댑터 Telegram/Slack/Discord만 supported, `kakao-talk`은 spec 미작성 future candidate. **국내 커머스 CS 핵심 채널 공백** (채널톡과 정면 경쟁하려면 필수).

### 3.3 🟡 보강 필요
- **⑩ 실시간 협업 없음** — last-write-wins + 충돌 알림만. CRDT/Yjs 부재. 워크스페이스 전환 API(`/switch`)도 미구현.
- **⑪ DB 커넥터 협소** — PostgreSQL/MySQL 2종만(MongoDB/Redis/BigQuery 부재). 임베딩: Anthropic embed 미지원.
- **⑫ Prometheus 메트릭 부재** — OTel traces-only, `/metrics`·MeterProvider 없음.
- **⑬ 보안 백로그** — `JWT_SECRET` 하드코딩 fallback(`'dev-jwt-secret'`, CWE-798, 프로덕션 부팅 강제 미적용), `ENCRYPTION_KEY` 단일 마스터키 다도메인 재사용, AuthConfig CRUD audit 부분구현, reveal 엔드포인트 rate limit 부재.
- **⑭ 브랜드·시장검증 0** — Dify 131k★·100만 앱·280 엔터프라이즈, n8n 182k★ 대비 신생.

---

## 4. 경쟁사별 정밀 대비 (요약)

- **vs n8n**: 열위 = 통합 폭(4 vs 400+)·커뮤니티 노드 생태계·running 분산 처리량·시장규모. 우위 = AI/Graph RAG 1급 설계·사람개입 신뢰성·Cafe24 깊이·옴니채널 챗·인증 보안.
- **vs Dify**: 열위 = RAG 운영 성숙도(리랭커·청킹·eval·토큰 디버거)·엔터프라이즈(SSO)·시장규모(131k★/280 엔터프라이즈). 우위 = Graph RAG+3D·MCP Internal Bridge·노코드 워크플로 위 영속 멀티턴 에이전트·제어흐름 폭.
- **vs Flowise/Langflow**: 열위 = retriever/reranker/vectorstore 커넥터 폭·멀티에이전트 토폴로지(Langflow LangGraph). 우위 = 분산·재시작 복원·영속 대기·관측성 인프라·노코드 빌더 UX.
- **vs Make/Zapier**: 열위 = 통합 폭·비주얼 빌더 성숙도·비개발자 접근성. 우위 = AI 네이티브·셀프호스팅·도메인 깊이.
- **vs Gumloop/Lindy(신흥)**: 열위 = 멀티에이전트 오케스트레이션·펀딩/모멘텀. 우위 = 셀프호스팅·도메인 수직통합·워크플로 제어 깊이.
- **vs 채널톡/Cafe24 앱스토어 앱(한국)**: 열위 = CS 특화 성숙도(채널톡)·시장침투·카카오 채널. 우위 = 프로그래머블 워크플로 + 에이전트 + 깊은 API + 옴니채널(점 솔루션 대비 수평 플랫폼).

---

## 5. 종합 판단 (sharpened)

1. **수평 폭 경쟁은 구조적으로 패배** — 정독으로 확인된 사실: 커넥터 4개 + 마켓플레이스 0 + 플러그인 SDK 0 + custom 노드 enum 부재. "n8n 따라잡기"는 봉쇄돼 있다. 폭으로 싸우지 말 것.
2. **진짜 해자는 둘** — (A) 사람개입/대화형 신뢰성, (B) 한국 커머스 도메인 깊이. 둘 다 코드로 실재 확인. 여기에 자원을 집중.
3. **그러나 해자 위 핵심 약속이 현재 깨져 있음** — node-as-tool 비활성(②), 카카오 부재(⑨), running 스케일 미구현(①), spec drift(④). **차별화 투자 이전에 이 "약속 훼손" 4건을 먼저 메워야** 데모/평가에서 신뢰를 잃지 않는다.
4. **멀티에이전트는 다가오는 table stakes** — A2A 표준화 + 경쟁사 전면 채택. 중기 필수.
5. **엔터프라이즈(SSO/메트릭/Org)는 SMB 버티컬 wedge와 상충** — Cafe24 SMB 상점주는 SAML 불필요. 업마켓 전환 결정 전엔 후순위.

---

## 6. 우선순위별 액션 (재정렬)

### P0 — "약속 훼손" 복구 (차별화보다 먼저)
- node-as-tool 연결 재구현(②) / 카카오톡 채널 어댑터(⑨) / running-execution 스케일 전략 결정·구현 또는 마케팅 수정(①) / spec↔code drift 31건 수렴(④).

### P1 — 해자 심화 + MCP 포지셔닝
- MCP-first 포지셔닝("422개가 아니라 MCP 10,000+ 서버")으로 통합 폭 약점 우회 / 한국 커머스 버티컬("Cafe24 상점주 AI 운영·CS 에이전트") 공식화 / 템플릿 갤러리 MVP / Graph RAG·Conversational Building 전면 마케팅.

### P2 — 차별화 격차 + 신뢰성
- LLMOps 레이어(전용 리랭커·청킹 전략·eval·프롬프트 버전관리·Langfuse 연동) / 멀티에이전트·A2A 채택 / 보안 백로그(JWT fallback 등) 해소.

### P3 — 업마켓(조건부)
- SSO/SAML/SCIM·Org 레벨·Prometheus 메트릭·Helm/1-command 배포·실시간 협업 — 엔터프라이즈 전환을 결정할 때만.

---

## 7. 한 줄 결론

> **Clemvion은 "또 하나의 n8n"이 될 수 없고(폭 봉쇄), 되어서도 안 된다. 진짜 자산은 _사람개입/대화형 워크플로의 신뢰성_ 과 _한국 커머스(Cafe24) 도메인 깊이_ 두 해자다. 그러나 그 해자 위 핵심 약속(에이전트의 노드 도구 호출·카카오 채널·running 스케일·spec 정합성)이 지금 깨져 있어, 차별화 마케팅보다 "약속 복구(P0)"가 선행돼야 한다. 그 뒤 MCP로 폭을 우회하고, 한국 커머스 버티컬로 포지셔닝을 좁히며, LLMOps·멀티에이전트로 격차를 메운다.**

---

## 8. 후속 액션 체크리스트

- [ ] **P0-1 node-as-tool 재구현 결정·착수** (ND-AG-06/10/21 재작성) — developer 위임 전 spec 확정 필요
- [ ] **P0-2 카카오톡 채널 어댑터 spec 작성** — project-planner (`spec/4-nodes/7-trigger/providers/`)
- [ ] **P0-3 running-execution 스케일 전략 결정** — worker pool 구현 vs "분산" 마케팅 표현 수정 (`spec/0-overview.md` §2.4 + execution-engine §4)
- [ ] **P0-4 spec↔code drift 31건 수렴 로드맵** — `plan/in-progress/spec-sync-*` 우선순위화
- [ ] **P1-1 MCP-first 포지셔닝 확정** — 제품 메시징/랜딩 1급 축 + `spec/0-overview.md` 비전 반영 여부
- [ ] **P1-2 한국 커머스 버티컬 공식화** — "Cafe24 상점주 AI 운영·CS" 타겟 명문화 (채널톡·Cafe24 앱스토어 앱과의 차별화 포함)
- [ ] **P1-3 템플릿 갤러리 MVP 범위** — 마켓플레이스 backlog에서 분리
- [ ] **P2-1 LLMOps 레이어 신규 spec 필요성** — 리랭커·청킹전략·eval·프롬프트 버전관리·Langfuse 연동
- [ ] **P2-2 멀티에이전트/A2A 채택 조사** — Dify/Langflow/Gumloop 벤치마크
- [ ] **P2-3 보안 백로그 해소 우선순위** — JWT_SECRET fallback·ENCRYPTION_KEY 분리·AuthConfig audit (`plan/in-progress/security-jwt-secret-fallback.md` 등)
- [ ] **P3 업마켓 전환 여부 결정** — SSO/SAML·Org 레벨·메트릭·Helm 투자 트리거

---

## 9. 출처

**내부 근거**: spec/code 심층 정독 4건 — 실행엔진(`spec/5-system/4-execution-engine.md`·`5-expression-language.md`·`execution-engine.service.ts`), AI/RAG(`7-llm-client`·`9-rag-search`·`10-graph-rag`·`11-mcp-client`·`llm_usage_log.entity.ts`), 노드/통합(`spec/4-nodes/**`·`cafe24-api-catalog` 222파일), 데이터모델/보안(`1-data-model`·`5-system/1-auth`·`LICENSE`·`plan/in-progress/` 64건).

**외부 (2026-06 웹 리서치)**:
- 비교: scrapeless/oxylabs/cybernews(n8n vs Flowise) · toolhalla/bigaiagent(Dify vs Flowise vs Langflow) · digitalapplied(Zapier vs Make vs n8n) · rapidclaw(n8n vs Dify vs Flowise UX)
- 규모/생태계: GitHub stars(n8n 182k·Dify 131k·Flowise 51k), Dify 100만 앱·280 엔터프라이즈 · MCP 통계(10,000+ 서버·97M DL) · MCP vs A2A(onereach, Linux Foundation 거버넌스)
- 신흥/한국: Gumloop/Lindy/Relay(lindy.ai·relay.app·composio) · 채널톡(channel.io·tracxn·g2) · Cafe24 생태계(70% 점유·GMV 13.6조·앱스토어 마케팅 자동화 앱)
- 라이선스: docs.n8n.io/sustainable-use-license · scalevise · 관찰가능성: digitalapplied(LangSmith/Langfuse/Arize)·langfuse.com
