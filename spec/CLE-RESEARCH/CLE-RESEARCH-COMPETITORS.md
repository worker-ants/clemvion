---
id: "CLE-RESEARCH-COMPETITORS"
title: "경쟁 분석: n8n · Flowise"
type: "design"
version: 1
status: "approved"
requirements: []
basis_superseded: false
parent: "CLE-RESEARCH"
ancestors: ["CLE-VISION", "CLE-RESEARCH"]
area: "CLE-RESEARCH"
content_hash: "4414430fd2eeaf95be102f97d6d6a1f5bb57dedf95e15b66708e8194e89aa491"
read_as: "approved_fallback"
task: "CLE-T-0W7CA7"
source_paths: []
mirror_sha256: "bb1eea5a6e5e356a33b7ead0a2920923dd282b7048d3ae531e1dde240c0d4eb8"
etag: "sha256-027025d118fa990a235f736405b6a97fca83a81d742c0b9d2cc2785cf49b9d9b"
---
> 성격: 전략 리서치(2026-06-03 작성, 2026-07-16 · 2026-10-10 교정) · 원문: `plan/research/competitive-analysis-n8n-flowise.md` · 용어: [용어 사전](../CLE-GLOSSARY.md)

## 개요

제목에는 n8n · Flowise 만 있지만 실제 비교 대상은 n8n · Flowise · Dify · Langflow · Make · Zapier · Gumloop/Lindy 일곱 종이다. 이 문서는 Clemvion 을 범용 자동화 도구(n8n · Make · Zapier), AI 앱 · LLMOps 도구(Dify · Flowise · Langflow), AI 네이티브 에이전트 빌더(Gumloop · Lindy)와 비교한 전략 리서치다. 신흥 에이전트 빌더 Relay.app 과 한국 커머스 인접 제품(채널톡, Cafe24 앱스토어 마케팅 자동화 앱)도 경쟁 지형에 함께 넣었다.

v2 는 2026-06-03 에 썼다. 실행 엔진, AI · RAG, 노드와 통합, 데이터 모델과 보안 네 영역의 스펙과 코드를 정독하고 외부 자료를 넓게 조사해 v1 을 전면 개정했다. 같은 날 사용자(도메인 전문가)의 반박 세 건을 스펙 · 코드 · 규제 현실로 다시 검증해 판단을 고쳤다(v2.1 ~ v2.4). 2026-07-16 에는 후속 액션의 현재 상태를 실측해 교정했다.

이 문서는 요구사항을 정하지 않는다. 기능별 규칙과 구현 상태의 기준은 각 영역 문서다. 강점 · 약점 판단과 수치는 2026-06-03 시점의 관찰이다. 그 뒤 달라진 상태는 항목마다 "현재" 로 표시하고 기준 문서를 링크했다. 우선순위를 판단하기 전에 [후속 액션의 현재 상태](#후속-액션의-현재-상태) 를 먼저 본다.

범위 밖: 실행 엔진의 큐 · 복구 규칙은 [큐 워커와 동시 실행 제한](../CLE-EXEC/CLE-EXEC-WORKER.md) 과 [장애 복구와 안전 종료](../CLE-EXEC/CLE-EXEC-RECOVERY.md), 제품 비전과 로드맵은 [Clemvion 제품 개요](../CLE-VISION.md) 가 정한다.

## 후속 액션의 현재 상태

원문의 후속 액션 체크리스트는 실행할 작업 목록이 아니었다. 다른 계획으로 넘기는 위임 목록이었다. 2026-07-16 에 실측해 보니 이 목록은 이미 낡아 있었다. 아래 표가 교정한 상태다. "현재 상태" 칸은 2026-07-16 교정에 NERV 문서의 구현 상태를 더해 적었다. 계획 이름은 저장소 `plan/in-progress/` 의 추적 문서다.

| 항목 | 원문 우선순위 | 내용 | 현재 상태 | 기준 문서 |
| --- | --- | --- | --- | --- |
| P0-1 실행 엔진 신뢰성 | P0 | 시작 큐와 work-stealing, 크래시 때 실행 중 세그먼트 재구동, 동시 실행 제한과 실행 시간 한도, 워커 크래시 검출 | 대부분 구현됨. 시작 큐(PR1), 동시 실행 제한(#801), 우선순위 3단계(#803), stalled 재배달(#798), 작업을 잃은 대기 중 실행 회수(#806)가 들어갔다. 워커 크래시는 별도 heartbeat 채널 대신 stalled 재배달로 잡는다. 제품 개요의 "분산 워커 풀" 서술도 실제 모델과 맞다. | [큐 워커와 동시 실행 제한](../CLE-EXEC/CLE-EXEC-WORKER.md), [장애 복구와 안전 종료](../CLE-EXEC/CLE-EXEC-RECOVERY.md), [시스템 아키텍처](../CLE-PLAT/CLE-PLAT-ARCH.md#실행-엔진-redis-큐--분산-워커-풀) |
| P0-2 스펙과 코드의 차이 31건 정리 | P0 | 현재형으로 약속했지만 코드가 없는 표면을 우선순위화 | `spec-sync-*` 계획들로 줄여 나눠 추적 중이다. | 각 영역 문서 머리 줄의 구현 상태 |
| P0-2b 범용 노드 ↔ 에이전트 도구 통합 | P0 | 임의 워크플로우 노드를 AI 에이전트 도구로 쓰는 경로 재구현(ND-AG-06/10/21) | 미구현. `ai-agent-tool-connection-rewrite` 계획이 소유한다. | [AI 에이전트 노드](../CLE-NODE-AI/CLE-NODE-AGENT.md#도구-연결-입력-경로-제거) |
| P0-3 통합 · 확장 봉쇄 완화 | P0 | 핵심 SaaS 커넥터와 MCP-first 결합 | `marketplace-and-plugin-sdk` 계획이 소유한다. 그 사이 통합 노드에 MakeShop 이 더해졌다. | [마켓플레이스 (구상)](../CLE-UI/CLE-UI-MARKET.md), [노드 시스템 구조와 카탈로그](../CLE-NODE/CLE-NODE-ARCH.md), [MakeShop 노드](../CLE-NODE-INT/CLE-NODE-MAKESHOP.md) |
| P1-1 MCP-first 포지셔닝 확정 | P1 | 제품 메시징과 랜딩의 1급 축으로 삼을지, 제품 개요 비전에 반영할지 | 미착지. 이 문서 밖에 추적처가 없다. 제품 개요 비전에는 MCP-first 서술이 없다. | [Clemvion 제품 개요](../CLE-VISION.md), [MCP 클라이언트](../CLE-INT/CLE-INT-MCP.md) |
| P1-2 알림톡 대행사 통합 노드 | P1 | 솔라피 · 비즈고 · 알리고 같은 대행사를 거쳐 알림톡을 보내는 노드, Cafe24 주문 → 알림톡, "Cafe24 상점주 AI 운영 · CS" 진입. 코어 밖의 첫 진입점으로 추진 | 미착지. 다른 계획에 집이 없다. | [통합 노드](../CLE-NODE-INT/CLE-NODE-INT.md), [Send Email 노드](../CLE-NODE-INT/CLE-NODE-EMAIL.md), [Cafe24 노드](../CLE-NODE-INT/CLE-NODE-CAFE24.md) |
| P1-3 템플릿 갤러리 MVP | P1 | 마켓플레이스 백로그에서 템플릿만 떼어 먼저 낸다 | `marketplace-and-plugin-sdk` 계획의 워크플로우 템플릿 마켓 단계가 소유한다. | [마켓플레이스 (구상)](../CLE-UI/CLE-UI-MARKET.md) |
| P2-1 LLMOps 레이어 | P2 | 리랭커 · 청킹 전략 · 평가 · 프롬프트 버전 관리 · LLM 트레이싱(Langfuse) 연결의 스펙이 필요한지 | 일부 구현됨. 리랭킹(`cross_encoder`, `cross_encoder_llm`)과 검색 지표 평가 하네스가 들어갔다. 청킹 개선과 생성 품질 평가는 `rag-quality-improvement` 계획이 소유한다. 프롬프트 버전 관리와 LLM 트레이싱 연결은 추적처가 없다. | [RAG 검색](../CLE-KB/CLE-KB-SEARCH.md), [RAG 품질 평가](../CLE-KB/CLE-KB-EVAL.md), [문서 임베딩](../CLE-KB/CLE-KB-EMBED.md) |
| P2-2 멀티에이전트 · A2A 채택 조사 | P2 | Dify · Langflow · Gumloop 벤치마크 | 미착지. 다른 계획에 집이 없다. | [AI 에이전트 노드](../CLE-NODE-AI/CLE-NODE-AGENT.md), [워크플로우 호출 노드](../CLE-NODE-FLOW/CLE-NODE-SUBWF.md) |
| P2-3 보안 백로그 | P2 | `JWT_SECRET` fallback, `ENCRYPTION_KEY` 분리, 인증 설정 감사 | 해소됨(PR #539). 운영(`NODE_ENV=production`)에서 `JWT_SECRET` 이 없거나 기본값이면 부팅을 거부한다. 인증 설정 변경 감사는 `auth_config.*` 액션으로 구현됐다. 암호화 키 두 개(`ENCRYPTION_KEY`, `INTEGRATION_ENCRYPTION_KEY`)의 정리는 시크릿 저장소 문서의 미결 사항이다. | [세션과 토큰](../CLE-ACCT/CLE-ACCT-SESSION.md), [감사 로그](../CLE-OBS/CLE-OBS-AUDIT.md), [시크릿 저장소](../CLE-INT/CLE-INT-SECRET.md) |
| P3 업마켓 전환 여부 결정 | P3 | SSO/SAML/SCIM, 조직 수준, 메트릭, Helm, 실시간 협업에 투자할 트리거 | 결정은 미착지다. 구성 요소 일부는 따로 움직였다. Prometheus 메트릭은 구현됐다. Docker Compose · Helm 배포는 `self-hosting-deployment`, LDAP/SAML 은 `spec-sync-auth-gaps` 계획이 소유한다. SCIM 과 실시간 협업은 추적처가 없다. | [비기능 요구사항](../CLE-PLAT/CLE-PLAT-NFR.md), [가입과 로그인](../CLE-ACCT/CLE-ACCT-SIGNIN.md) |

2026-07-16 교정의 결론은 이렇다. 다른 계획에 집이 없는 미착지 전략 항목은 P1-2(알림톡 대행사 노드), P2-2(멀티에이전트 · A2A 조사), P3(업마켓 전환 결정) 세 건이다. NERV 로 옮기며 다시 확인하니 P1-1(MCP-first 포지셔닝)과 P2-1 의 나머지(프롬프트 버전 관리, LLM 트레이싱)도 추적처가 없다. 이 항목들이 이 문서를 살아 있게 하는 실질 내용이다.

## 포지셔닝

Clemvion 의 기반 요건은 **AI 와 워크플로우의 범용 통합을 신뢰성 있게 실행하는 플랫폼**이다. AI 에이전트가 워크플로우의 1급 구성 요소로서 노드 · 도구 · 실행 흐름과 양방향으로 엮이고 그 실행이 대량 · 분산 · 장애 상황에서도 신뢰성을 유지해야 한다. 한국 커머스(Cafe24)와 옴니채널 채팅은 그 위에 얹는 강력한 통합 옵션이자 첫 시장 진입점이다. 제품의 정체나 기반 요건은 아니다.

이 기반 위에 진짜 해자(moat)가 둘 있다.

- **해자 A: 사람 개입 · 대화형 워크플로우의 신뢰성.** 영속 재개(durable continuation: 영속 BullMQ 큐와 DB rehydration), 한 트랜잭션 안의 상태 전이, DB 에 영속하는 멀티턴 에이전트(`_resumeCheckpoint`)가 재시작과 장기 대기에도 정합성을 지킨다.
- **해자 B: AI 네이티브 워크플로우의 깊이.** Graph RAG(3D 시각화 포함), MCP 클라이언트와 내부 MCP 브리지, Planner-first 대화형 워크플로우 구성, 워크플로우 안에 박힌 영속 멀티턴 에이전트가 여기에 속한다. Cafe24 222 필드 카탈로그, 옴니채널 채팅, Presentation 노드는 이 범용 역량을 입증하고 넓히는 통합 옵션의 모범 사례다. 해자 자체는 범용 AI · 워크플로우 통합이고 커머스는 그 적용이다.

기반 요건에서 두 가지가 바로 따라 나온다.

1. **신뢰성(분산 · 대량 · 장애 복구)** 은 사용 방식과 무관하게 무조건 P0 다. 근거는 [실행 엔진 신뢰성 분석](#실행-엔진-신뢰성-분석) 에 있다.
2. **임의 워크플로우 노드와 AI 에이전트 도구의 연결(②)** 은 "AI · 워크플로우 범용 통합" 을 글자 그대로 구현하는 일이다. 도메인 액션을 `mcp_` 도구가 덮더라도 코어 명제에 직결되는 작업이다. 주변 기능이 아니다.

### 경쟁 지형 (2026)

| 진영 | 대표 | 규모 · 특징 |
| --- | --- | --- |
| 범용 자동화 | **n8n**(182k★, 7년, 400+ 통합, self-host 와 무제한 실행), **Make**(가장 뛰어난 비주얼 빌더, Zapier 대비 60% 저렴), **Zapier**(7000+ 통합, 비개발자 접근성 최강) | 폭과 생태계가 압도적 |
| AI 앱 · LLMOps | **Dify**(131k★, 100만+ 앱 배포, 280+ 엔터프라이즈[Maersk · Novartis], RAG · MCP · 멀티에이전트), **Flowise**(51k★, MIT), **Langflow**(LangGraph 멀티에이전트) | RAG 와 에이전트 성숙도 |
| AI 네이티브 에이전트 빌더(신흥) | **Gumloop**($70M 투자, 멀티에이전트), **Lindy**(agent-to-agent "Lindies"), **Relay.app** | 멀티에이전트 오케스트레이션을 기본 탑재 |
| 한국 커머스 인접 | **채널톡**($17.1M, CS 챗봇과 워크플로우, Shopify 앱), **Cafe24 앱스토어 마케팅 자동화 앱**(타스온 · 휴머스온 등) | 진입 시장이 비어 있지 않다. 단일 목적 제품이 먼저 차지했다 |

### 전략적 함의

코어는 범용 AI · 워크플로우 통합 플랫폼이다. 한국 커머스는 그 위의 통합 옵션이자 첫 시장 진입이며 코어를 대신하지 않는다. 그 옵션 시장도 비어 있지 않다. CS 는 채널톡이, 마케팅은 Cafe24 앱스토어 앱이 먼저 차지했다. 이 시장에서 Clemvion 이 차별화되는 이유는 경쟁 제품이 단일 목적 앱인 데 비해 Clemvion 은 같은 범용 엔진(프로그래머블 워크플로우, 에이전트, 깊은 API)을 커머스에 적용하기 때문이다. 본체는 범용 AI · 워크플로우 플랫폼이고 한국 커머스 적용은 첫 진입점이다. 같은 엔진이 다른 버티컬과 범용 자동화로 넓어진다.

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

- **① 실행 엔진 신뢰성**(무조건 P0): 정확성과 장기 대기 내구성은 강했다. 그러나 실행 중 크래시 복구, 처리량과 수평 확장, backpressure, 멀티테넌트 자원 가드 네 차원이 n8n single mode 수준이었다(당시 엔진 스펙의 워커 풀 · heartbeat · 동시 실행 가드가 모두 Planned). 어떤 사용 시나리오에서도 운영 신뢰성을 채우지 못했다. 목표 아키텍처는 이미 설계돼 있어 증분으로 지을 수 있었다. 복구 · 재큐는 실행 중(`running`) 실행에만 적용하고 입력 대기 실행은 기한 없이 보존한다. 분석은 [실행 엔진 신뢰성 분석](#실행-엔진-신뢰성-분석) 에 있다. **현재**: 대부분 구현됐다([큐 워커와 동시 실행 제한](../CLE-EXEC/CLE-EXEC-WORKER.md), [장애 복구와 안전 종료](../CLE-EXEC/CLE-EXEC-RECOVERY.md)).
- **③ 통합 폭과 확장 경로의 봉쇄**: 범용 커넥터는 HTTP · DB · Email 3개, 여기에 Cafe24 1개로 모두 4개뿐이었다. 마켓플레이스는 `status: backlog` 에 `code: []` 였고 플러그인 SDK 는 착수하지 않았다. `custom` 노드 카테고리는 enum 에도 없었다. 폭을 늘릴 자체 경로와 커뮤니티 경로가 모두 닫혀 있었다. n8n 커뮤니티 노드 생태계와 정반대다. **현재**: 통합 노드에 MakeShop 이 더해졌다([통합 노드](../CLE-NODE-INT/CLE-NODE-INT.md)). 마켓플레이스, 플러그인 SDK, `custom` 카테고리는 여전히 미구현이다([마켓플레이스 (구상)](../CLE-UI/CLE-UI-MARKET.md), [노드 시스템 구조와 카탈로그](../CLE-NODE/CLE-NODE-ARCH.md)).
- **④ 스펙과 코드의 차이**: 2026-06-03 감사가 "현재형으로 약속했지만 코드가 없는" 표면을 31개 영역에서 찾았다. 문서상 기능과 실제 동작이 다르면 셀프 호스팅 평가자의 신뢰를 잃는다. **현재**: `spec-sync-*` 계획들로 줄여 추적한다. NERV 문서는 머리 줄의 구현 상태로 이 차이를 드러낸다.

② 노드를 도구로 쓰는 경로는 도메인 액션이 `mcp_` 도구로 살아 있어 🟡 로 내렸다([노드를 도구로 쓰는 경로](#노드를-도구로-쓰는-경로)). 등급이 바뀐 과정은 [Rationale](#rationale) 에 있다.

### 중대 (🟠): 경쟁 열위 축

- **⑤ 멀티에이전트 · A2A 부재**: 단일 에이전트와 도구 라우팅만 있다. agent-to-agent, crew, 위임 같은 1급 개념이 없다. 2026 흐름에서 이것은 기본 요건이 되고 있다. Linux Foundation 이 A2A 거버넌스를 맡았고 Dify · n8n · Gumloop · Lindy 가 모두 갖췄다. Clemvion 에는 MCP 는 있지만 A2A 는 없다. **현재**: 변화 없음.
- **⑥ LLMOps 성숙도**: 전용 리랭커가 없었다(코사인 단독). 청킹 전략이 빈약했다(`chunk_size` · overlap 두 값뿐, metadata 는 항상 빈 `{}`). 평가셋과 프롬프트 회귀 프레임워크가 전혀 없었다. 프롬프트 버전 관리와 라이브러리가 없고 LLM 트레이싱(Langfuse 식)도 연결하지 않았다. Dify 의 노드별 토큰 디버거와 annotation 에 뒤진다. **현재**: 리랭킹([RAG 검색](../CLE-KB/CLE-KB-SEARCH.md))과 검색 지표 평가 하네스([RAG 품질 평가](../CLE-KB/CLE-KB-EVAL.md))가 구현됐다. 나머지는 그대로다.
- **⑦ 엔터프라이즈 SSO 부재**: SAML · LDAP · AD 는 미구현(Planned)이고 SCIM 은 언급조차 없다. 조직(Org) 계층과 조직 단위 공유도 없다(워크스페이스가 최상위). Dify Enterprise 의 핵심 차별점에 비해 갭이다. **현재**: 변화 없음([가입과 로그인](../CLE-ACCT/CLE-ACCT-SIGNIN.md)). 조직 수준 통합 공유는 [Clemvion 제품 개요](../CLE-VISION.md) 로드맵에 있다.
- **⑧ 셀프 호스팅 운영성 미완**: NF-SC-08 · NF-EX-03 · NF-DP-02 · NF-DP-03 · NF-DP-06 이 모두 ❌ 다. docker-compose 는 로컬 개발 인프라 전용이다. Helm, 명령 한 번으로 설치하는 배포, 운영 문서는 착수하지 않았다. n8n · Dify 의 명령 한 번 · Docker Compose 배포에 비해 갭이다. **현재**: 변화 없음([비기능 요구사항](../CLE-PLAT/CLE-PLAT-NFR.md)).
- **⑨ 한국 커머스 채널 전략 부재**: 실제 갭은 알림톡 · 친구톡 대행사 통합 노드가 없고 옴니채널 이야기가 가치 낮은 채널(Telegram · Slack · Discord)에 치우친 것이다. Cafe24 주문 이벤트 → 알림톡(대행사) 조합이 이 시장의 결정타인데 구현되지 않았다. 판단 근거는 [한국 채널 전략](#한국-채널-전략) 에 있다. **현재**: 미착지(P1-2).

### 보강 필요 (🟡)

- **⑩ 실시간 협업 없음**: CRDT · Yjs 가 없다. 원문은 저장이 last-write-wins 에 충돌 알림만 있다고 적었다. 워크스페이스 전환 API(`/switch`)도 없었다. **현재**: 워크스페이스 전환 API(`POST /api/auth/workspaces/:id/switch`)는 구현됐다([워크스페이스와 멤버](../CLE-ACCT/CLE-ACCT-WS.md)). 에디터 문서 기준으로 동시 편집 충돌 감지는 구현된 적이 없다. 저장은 수동 저장과 실행 직전 저장 두 경로뿐이다([워크플로우 에디터와 캔버스](../CLE-WF/CLE-WF-EDITOR.md)).
- **⑪ DB 커넥터가 좁다**: PostgreSQL · MySQL 두 종류뿐이다(MongoDB · Redis · BigQuery 없음). 임베딩은 Anthropic embed 를 지원하지 않는다. 기준 문서는 [Database Query 노드](../CLE-NODE-INT/CLE-NODE-DBQUERY.md) 와 [LLM 클라이언트](../CLE-AI/CLE-AI-LLM.md) 다.
- **⑫ Prometheus 메트릭 부재**: OTel 트레이스만 있었고 `/metrics` 와 MeterProvider 가 없었다. **현재**: 구현됐다. `OTEL_ENABLED=true` 이면 OTel MeterProvider 가 Prometheus `/metrics` 로 메트릭을 노출한다([비기능 요구사항](../CLE-PLAT/CLE-PLAT-NFR.md), [로깅과 헬스 체크](../CLE-OBS/CLE-OBS-LOGGING.md)).
- **⑬ 보안 백로그**: `JWT_SECRET` 하드코딩 fallback(`'dev-jwt-secret'`, CWE-798, 운영 부팅 강제 없음), `ENCRYPTION_KEY` 단일 마스터키의 여러 도메인 재사용, 인증 설정 CRUD 감사의 부분 구현, reveal 엔드포인트의 rate limit 부재. **현재**: `JWT_SECRET` 은 운영에서 없거나 기본값이면 부팅을 거부한다(PR #539, [세션과 토큰](../CLE-ACCT/CLE-ACCT-SESSION.md)). 인증 설정 감사는 `auth_config.create` · `update` · `delete` · `regenerate` · `reveal` 이 모두 구현됐다([감사 로그](../CLE-OBS/CLE-OBS-AUDIT.md)). 암호화 키 정리는 [시크릿 저장소](../CLE-INT/CLE-INT-SECRET.md) 의 미결 사항이다.
- **⑭ 브랜드 · 시장 검증 없음**: Dify(131k★, 100만 앱, 280 엔터프라이즈)와 n8n(182k★)에 비해 신생이다.

## 실행 엔진 신뢰성 분석

① 의 근거다. 2026-06-03 판단이다. 현재 상태는 표의 "현재" 칸과 [후속 액션의 현재 상태](#후속-액션의-현재-상태) 에 있다.

### 기준선

기준은 durable execution 카테고리다.

- **Temporal**: 모든 스텝을 event history 로 영속해 워커가 죽으면 정확한 지점부터 재개한다. consistent-hashing task queue, backpressure, 자동 스케일을 갖췄다.
- **n8n queue mode 벤치마크**: queue mode 는 162 req/s 에 실패 0%, single mode 는 23 req/s 에 실패 31% 다. 처리량이 7배이고 실패가 사라진다. 큐가 없으면 버스트 때 backpressure 가 없어 생산자가 소비자를 압도한다.

### 신뢰성 차원 맵

요약하면 "대기 단계는 Temporal 급, 실행 단계는 n8n single mode 급" 이었다.

| 차원 | 2026-06-03 | 비고 | 현재 |
| --- | --- | --- | --- |
| 정확성 · 상태 일관성 | 🟢 강함 | 단일 트랜잭션 전이, jobId 멱등성, frozen snapshot, 설정과 출력의 직교 보존 | 같음 |
| 장기 대기 · 사람 개입 내구성 | 🟢 강함 | 영속 재개, rehydration, 무기한 보존 | 같음 |
| 실행 중 크래시 복구 | 🔴 취약 | 실행 중 실행을 넘겨받거나 재큐하지 않고 30분 뒤 `failed`. 재개는 `ai_agent` 한정 | stalled 재배달과 부팅 복구 스캔이 세그먼트를 재구동한다([장애 복구와 안전 종료](../CLE-EXEC/CLE-EXEC-RECOVERY.md#크래시-재구동)) |
| 처리량 · 수평 확장 | 🔴 취약 | fire-and-forget in-process, 큐 work-stealing 없음, 로드 밸런서 분산만 | 시작 큐로 work-stealing 한다([큐 워커와 동시 실행 제한](../CLE-EXEC/CLE-EXEC-WORKER.md#수평-확장)) |
| backpressure · 과부하 안전 | 🔴 부재 | 접수와 실행 사이에 큐가 없어 버스트 때 동시 실행이 무제한 | 시작 큐와 동시 실행 제한이 막는다 |
| 멀티테넌트 공정성 · 자원 가드 | 🔴 부재 | 동시 실행 가드 미구현, 폭주 워크플로우가 인스턴스를 점유 | 워크스페이스 · 워크플로우 동시 실행 제한, 실행 시간 한도, 우선순위 3단계가 들어갔다([큐 워커와 동시 실행 제한](../CLE-EXEC/CLE-EXEC-WORKER.md#동시-실행-제한)). 워크스페이스별 큐 분리와 단일 실행 최대 노드 수는 후속이다 |
| retry · DLQ · 에러 격리 | 🟡 부분 | 재개 큐 DLQ 는 있으나 비용이 커진다. 일반 노드 재시도는 한정적 | 이 문서에서 다시 확인하지 않았다 |
| 운영 관찰성 | 🟡 부분 | OTel 트레이스, DLQ 모니터, 시스템 상태. Prometheus 메트릭 없음 | Prometheus 메트릭이 구현됐다([로깅과 헬스 체크](../CLE-OBS/CLE-OBS-LOGGING.md)) |

### 실행 중 분산의 실제 모습 (v2.1)

"실행 중 실행은 분산되지 않는다" 는 v2 판단을 "스케줄러급 제어가 없다" 로 고쳤다.

- **맞는 부분**: 멀티 인스턴스 안전성은 실재했다(BIGSERIAL 실행 순서, 재개 jobId 멱등성, 전역 recovery lock). 입력 대기 재개와 Background 본문은 영속 BullMQ 큐로 아무 인스턴스가 가져가므로 진짜 분산이다. 트리거가 인스턴스마다 들어오면 각자 in-process 로 돌려 거친 수준의 처리량 확장은 된다.
- **부족한 부분**: 새 실행의 시작이 큐를 타지 않았다(fire-and-forget `runExecution`). 그래서 work-stealing, 우선순위 큐, backpressure 가 없었다. 한 실행의 노드 단위 분산도 없었다(Background 만 별도 큐). 실행별 동시 실행 · 타임아웃 가드가 없었다. 크래시 이어받기도 없었다(재시작 때 `started_at` 이 30분보다 오래된 실행을 일괄 `failed` 처리, heartbeat 아님).
- 따라서 n8n queue mode 와의 격차의 실체는 이 스케줄러급 제어(work-stealing, 우선순위, 동시 실행 · 타임아웃 가드, 크래시 이어받기)였다.

### 이미 설계된 것을 짓는 일

목표 아키텍처는 당시 엔진 스펙에 이미 있었다(BullMQ 워커 모델, heartbeat, 동시 실행 가드, 모두 Planned). 가장 어려운 조각인 rehydration, 영속 재개, 분산 recovery lock 은 이미 구현돼 있어 워커 모델이 올라설 토대가 됐다. 남은 증분은 네 가지였다.

1. 접수 큐 도입: fire-and-forget 를 큐로 바꿔 work-stealing 과 backpressure 를 얻는다.
2. 크래시 때 실행 중 실행을 체크포인트에서 재개: rehydration 을 `ai_agent` 너머 일반 노드로 넓힌다.
3. 동시 실행 상한과 실행 타임아웃 적용: 타임아웃은 실제로 실행 중인 시간 기준이며 입력 대기 시간은 넣지 않는다.
4. heartbeat 기반 재큐.

build vs adopt 판단은 이랬다. BullMQ 재개 큐를 이미 가진 상황에서 Temporal 이나 Inngest 를 밑에 까는 것은 과한 마이그레이션이다. 기존 토대 위에서 워커 모델을 완성하라고 권고했다. **현재**: 권고대로 진행됐다. 4번 heartbeat 는 별도 채널 대신 BullMQ stalled 재배달로 대신했다([장애 복구와 안전 종료](../CLE-EXEC/CLE-EXEC-RECOVERY.md#heartbeat-채널을-두지-않는다)).

### 두 종류의 멈춤을 나눈다 (v2.3)

- **(a) 실행 중(`running`) 실행의 워커 크래시**: 복구 · 재개 대상이다. 2번과 4번의 재큐는 여기에만 적용한다.
- **(b) 입력 대기(`waiting_for_input`)**: 재큐와 TTL 만료를 **금지**한다. 기한 없이 영속 보존하고 사용자 인터랙션이 도착할 때만 재개 큐로 재개한다. 당시 엔진도 이미 이렇게 동작했다(입력 대기는 30분 stale-fail 대상에서 빠지고 무기한 보존).

근거는 과거 테스트 사례다. 입력 대기 실행을 재큐하거나 만료시켰더니 사용자가 한참 뒤에 선택하려 할 때 세션이 이미 만료돼 있었다. 그래서 heartbeat · 타임아웃 메커니즘은 실행 중 상태로 좁혀 구현하고 입력 대기 상태는 절대 건드리지 않는다.

### 시장 진입점과 충돌하지 않는다

엔진 신뢰성은 커머스 진입의 전제 조건이다. Cafe24 상점주가 주문 처리와 CS 를 비즈니스 로직으로 올렸는데 버스트에 실행을 흘리거나 크래시에 진행 중 실행을 잃으면 핵심 약속이 무너진다. 커머스는 시장 진입이고 엔진 신뢰성은 기반이다. 둘 다 P0 이며 층위가 다르다.

### 제품 개요 문구의 정합성

당시 가장 위험한 정합성 갭은 제품 개요가 "분산 워커 풀 수평 확장" 을 현재형으로 광고하는데 엔진 스펙의 워커 모델은 Planned 였다는 점이다. 사용 방식과 무관하게 이 문구로 제품을 파는 것은 위험했다. 그래서 문구의 범위를 정직하게 고치고 역량도 구축해야 한다고 봤다. 신뢰성은 무조건 기반 요건이므로 본질은 역량 구축이다. **현재**: 역량이 구축돼 제품 개요 서술이 실제 모델과 맞다([시스템 아키텍처](../CLE-PLAT/CLE-PLAT-ARCH.md#실행-엔진-redis-큐--분산-워커-풀)).

## 노드를 도구로 쓰는 경로

② 의 근거다(v2.1 에서 🔴 → 🟡).

- 제거된 `toolNodeIds` 는 캔버스의 **임의 노드**를 도구로 끌어 쓰는 경로였다. 의미가 조건 도구(`cond_*`, 추론이 끝난 뒤 한 방향으로 분기)와 다르다.
- Cafe24 같은 도메인 액션은 `mcp_` 도구(내부 MCP 브리지)로 추론 도중 에이전트가 부르는 경로가 살아 있다. 조회 → 재질문 → 재조회 → 종합 같은 multi-hop 도 `mcp_` 로 된다. 규칙은 [AI 에이전트 노드](../CLE-NODE-AI/CLE-NODE-AGENT.md#도구) 와 [MCP 클라이언트](../CLE-INT/CLE-INT-MCP.md) 에 있다. 그래서 "도메인 에이전트" 약속은 깨지지 않는다.
- 남는 갭은 작다. 임의 커스텀 노드(Code · HTTP · Slack)를 도구로 쓰는 경로다. 또 대화 스레드는 다섯 source(`presentation_user`, `ai_user`, `ai_assistant`, `ai_tool`, `system`)만 공유한다. HTTP · Cafe24 일반 노드의 출력은 스레드 밖이다([대화 스레드](../CLE-IX/CLE-IX-THREAD.md)). 그래서 "뒤에 워크플로우를 연결하면 자동으로 공유된다" 는 일부만 맞다. 하류 노드에서 에이전트를 거꾸로 참조하는 것은 위상 정렬상 불가능하다. back-edge 로 우회하면 노드 재실행과 LLM 재호출 비용이 든다.
- 그래도 v2.4 에서는 이 경로를 "AI · 워크플로우 범용 통합" 의 직접 구현체로 보고 P0 에 넣었다.

**현재**: 미구현이다. `ai-agent-tool-connection-rewrite` 계획이 소유한다([AI 에이전트 노드](../CLE-NODE-AI/CLE-NODE-AGENT.md#도구-연결-입력-경로-제거)).

## 한국 채널 전략

⑨ 의 근거다(v2.1 에서 "카카오 어댑터 구현" 프레임을 철회).

- **규제 현실**: 알림톡 · 친구톡 · 브랜드메시지 API 는 카카오와 파트너 계약을 맺은 공식 대행사를 거쳐서만 보낼 수 있다. 사업자 등록과 발신 프로필 키가 필요하다. Telegram 처럼 봇 토큰으로 바로 붙는 방식은 불가능하다. 그래서 "카카오 어댑터 미구현 = 치명" 판단은 오판이었고 철회했다.
- **아웃바운드**: 알림톡 · 친구톡을 대행사 통합 노드로 만든다. 대행사 후보는 솔라피, 비즈고 · 인포뱅크, 알리고, NHN 등이다. 상점주가 자기 발신 프로필과 대행사 키를 가져오는(BYO) 방식이며 [Send Email 노드](../CLE-NODE-INT/CLE-NODE-EMAIL.md) 와 같은 패턴이다. **Cafe24 주문 이벤트 → 알림톡 노드**가 결정적인 조합이고 커머스 진입점에 정확히 맞는다.
- **인바운드 CS**: 채널톡 상담톡과 정면으로 부딪치지 않고 이미 가진 온사이트 [웹채팅](../CLE-WEBCHAT/CLE-WEBCHAT.md) 위젯으로 간다.
- **저가치 채널**: Telegram · Slack · Discord 어댑터는 한국 B2C 커머스에서 가치가 낮다(개발자 · 내부 채널). 옴니채널 이야기를 알림톡(대행사), SMS, 온사이트 웹채팅으로 옮긴다.

**현재**: 미착지(P1-2). 다른 계획에 집이 없다.

## 경쟁사별 비교

- **n8n**: 열위는 통합 폭(4 대 400+), 커뮤니티 노드 생태계, 실행 중 분산 처리량, 시장 규모다. 우위는 1급으로 설계한 AI · Graph RAG, 사람 개입 신뢰성, Cafe24 깊이, 옴니채널 채팅, 인증 보안이다.
- **Dify**: 열위는 RAG 운영 성숙도(리랭커, 청킹, 평가, 토큰 디버거), 엔터프라이즈(SSO), 시장 규모(131k★, 280 엔터프라이즈)다. 우위는 Graph RAG 와 3D 시각화, MCP 내부 브리지, 노코드 워크플로우 위의 영속 멀티턴 에이전트, 제어 흐름의 폭이다.
- **Flowise · Langflow**: 열위는 retriever · reranker · vector store 커넥터 폭과 멀티에이전트 토폴로지(Langflow LangGraph)다. 우위는 분산, 재시작 복원, 영속 대기, 관측 인프라, 노코드 빌더 UX 다.
- **Make · Zapier**: 열위는 통합 폭, 비주얼 빌더 성숙도, 비개발자 접근성이다. 우위는 AI 네이티브, 셀프 호스팅, 도메인 깊이다.
- **Gumloop · Lindy(신흥)**: 열위는 멀티에이전트 오케스트레이션과 투자 · 모멘텀이다. 우위는 셀프 호스팅, 도메인 수직 통합, 워크플로우 제어 깊이다.
- **채널톡 · Cafe24 앱스토어 앱(한국)**: 열위는 CS 특화 성숙도(채널톡), 시장 침투, 카카오 채널이다. 우위는 프로그래머블 워크플로우, 에이전트, 깊은 API, 옴니채널이다. 단일 목적 제품에 맞서는 수평 플랫폼이다.

## 종합 판단

1. **기반은 범용 AI · 워크플로우 통합을 신뢰성 있게 실행하는 것이다(v2.4).** AI 에이전트가 워크플로우의 1급 구성 요소로 엮이고 그 실행이 대량 · 분산 · 장애에도 신뢰성을 지키는 범용 플랫폼이 코어다. 한국 커머스는 그 위의 통합 옵션이자 첫 진입점이며 코어가 아니다.
2. **수평 "커넥터 폭" 경쟁은 구조적으로 진다.** 커넥터 4개, 마켓플레이스 0, 플러그인 SDK 0, `custom` 노드 enum 부재였다. n8n 식 커넥터 수 경쟁은 막혀 있으니 MCP 로 우회한다. 이것은 "통합 폭" 의 문제이고 "AI ↔ 워크플로우 통합 깊이" 라는 기반과는 다른 축이다.
3. **진짜 해자는 둘이다.** (A) 사람 개입 · 대화형 신뢰성, (B) AI 네이티브 워크플로우 깊이(Graph RAG, MCP, 대화형 워크플로우 구성, 영속 멀티턴 에이전트). 커머스 도메인 깊이는 (B)의 적용 사례다. 둘 다 코드로 실재를 확인했다.
4. **P0 재구성(v2.4)**: ① 실행 엔진 신뢰성(크래시 복구, 처리량, backpressure, 멀티테넌트 가드)은 사용 방식과 무관하게 무조건 P0 다. ② 범용 노드 ↔ 에이전트 도구 통합은 "AI · 워크플로우 범용 통합" 의 직접 구현체라 코어 명제에 직결된다. 그래서 진짜 P0 는 ① 엔진 신뢰성, ② 범용 노드 · 도구 통합, ③ 통합 · 확장 봉쇄, ④ 스펙과 코드의 차이다. ⑨ 알림톡 대행사 노드는 코어가 아닌 통합 옵션으로 P1 이다. 복구 · 재큐는 실행 중 실행에만 적용하고 입력 대기는 기한 없이 보존한다.
5. **멀티에이전트는 곧 기본 요건이 된다.** A2A 표준화와 경쟁사의 전면 채택을 볼 때 중기 필수다.
6. **엔터프라이즈(SSO, 메트릭, Org)** 는 업마켓 전환을 결정하기 전까지 후순위다. 범용 SMB 와 셀프 호스팅에는 SAML 이 필요 없다.

## 우선순위별 액션

2026-06-03 에 정한 순서다. 항목별 현재 상태는 [후속 액션의 현재 상태](#후속-액션의-현재-상태) 에 있다.

- **P0 (기반: 신뢰성 · 범용 통합 · 정합성)**
  - ① 실행 엔진 신뢰성 구축: 워커 모델 완성(접수 큐, work-stealing), 크래시 때 실행 중 실행을 체크포인트에서 재개(rehydration 을 일반 노드로 확장), 동시 실행 상한과 실행 타임아웃 적용, heartbeat 재큐. 모든 복구 · 재큐 · 타임아웃은 실행 중 실행에만 적용한다. 입력 대기는 재큐 · 만료에서 빼고 기한 없이 보존한다. 타임아웃은 실제로 실행 중인 시간 기준이다. 기존 재개 · rehydration 토대 위에서 증분으로 짓는다. 제품 개요의 "분산 워커 풀" 문구를 역량과 맞춘다. 당시 이 라운드에 구현을 시작했다.
  - ② 범용 노드 ↔ 에이전트 도구 통합 재구현(ND-AG-06/10/21 재작성). 도메인 액션은 `mcp_` 가 덮지만 임의 워크플로우 노드를 에이전트 도구로 쓰는 범용 경로가 코어다.
  - ③ 통합 · 확장 봉쇄 완화(핵심 SaaS 커넥터와 아래 MCP-first), ④ 스펙과 코드의 차이 31건 정리 로드맵.
- **P1 (통합 옵션 · MCP 포지셔닝 · 차별화)**: MCP-first 포지셔닝("422개가 아니라 MCP 서버 10,000+"), 템플릿 갤러리 MVP, Graph RAG · 대화형 워크플로우 구성 마케팅, 알림톡 대행사 통합 노드(솔라피 · 비즈고 · 알리고, Cafe24 주문 → 알림톡)와 한국 커머스 첫 시장 진입. 커머스는 코어 밖의 첫 진입점으로 추진한다.
- **P2 (차별화 격차 · 신뢰성)**: LLMOps 레이어(전용 리랭커, 청킹 전략, 평가, 프롬프트 버전 관리, Langfuse 연결), 멀티에이전트 · A2A 채택, 보안 백로그(`JWT_SECRET` fallback 등) 해소.
- **P3 (업마켓, 조건부)**: SSO/SAML/SCIM, 조직 수준, Prometheus 메트릭, Helm · 명령 한 번 배포, 실시간 협업. 엔터프라이즈 전환을 결정할 때만 한다.

## 한 줄 결론

> Clemvion 의 기반은 "AI 와 워크플로우의 범용 통합을 신뢰성 있게 실행하는 플랫폼" 이다. 한국 커머스(Cafe24)와 옴니채널 채팅은 그 위의 통합 옵션이자 첫 시장 진입이며 코어가 아니다. 진짜 자산은 _사람 개입 · 대화형 신뢰성_ 과 _AI 네이티브 워크플로우 깊이_ 두 해자다. 그러나 기반 자체(① 실행 신뢰성과 분산, ② 범용 노드 ↔ 에이전트 통합)가 아직 덜 지어져 있어 차별화 마케팅보다 기반 구축(P0)이 먼저다. 그 뒤 MCP 로 커넥터 폭을 우회한다. 커머스 옵션으로 첫 진입을 하고 LLMOps 와 멀티에이전트로 격차를 메운다.

2026-07-16 교정 기준으로 ① 은 대부분 지어졌다. ② 는 아직이다.

## 출처

**내부 근거**: 2026-06-03 당시 스펙과 코드를 네 영역으로 나눠 정독했다.

- 실행 엔진: 당시 엔진 스펙과 표현식 언어 스펙, `execution-engine.service.ts`. 현재 기준 문서는 [실행 엔진 개요와 그래프 순회](../CLE-EXEC/CLE-EXEC-ENGINE.md), [큐 워커와 동시 실행 제한](../CLE-EXEC/CLE-EXEC-WORKER.md), [장애 복구와 안전 종료](../CLE-EXEC/CLE-EXEC-RECOVERY.md), [표현식 언어](../CLE-WF/CLE-WF-EXPR.md) 다.
- AI · RAG: LLM 클라이언트, RAG 검색, Graph RAG, MCP 클라이언트 스펙과 `llm_usage_log.entity.ts`. 현재 기준 문서는 [LLM 클라이언트](../CLE-AI/CLE-AI-LLM.md), [RAG 검색](../CLE-KB/CLE-KB-SEARCH.md), [Graph RAG](../CLE-KB/CLE-KB-GRAPH.md), [MCP 클라이언트](../CLE-INT/CLE-INT-MCP.md), [LLM 사용량 기록](../CLE-AI/CLE-AI-USAGE.md) 이다.
- 노드와 통합: 노드 스펙 전체와 Cafe24 API 카탈로그 222 파일. 현재 기준 문서는 [노드](../CLE-NODE/CLE-NODE.md) 영역과 [Cafe24 API 카탈로그](CLE-C24-CATALOG) 다.
- 데이터 모델과 보안: 데이터 모델 스펙, 인증 스펙, `LICENSE`, 당시 진행 중 계획 64건. 현재 기준 문서는 [데이터 모델 개요](../CLE-PLAT/CLE-PLAT-DATA.md), [가입과 로그인](../CLE-ACCT/CLE-ACCT-SIGNIN.md), [세션과 토큰](../CLE-ACCT/CLE-ACCT-SESSION.md) 이다.

**외부 (2026-06 웹 리서치)**:

- 비교: scrapeless/oxylabs/cybernews(n8n vs Flowise) · toolhalla/bigaiagent(Dify vs Flowise vs Langflow) · digitalapplied(Zapier vs Make vs n8n) · rapidclaw(n8n vs Dify vs Flowise UX)
- 규모/생태계: GitHub stars(n8n 182k·Dify 131k·Flowise 51k), Dify 100만 앱·280 엔터프라이즈 · MCP 통계(10,000+ 서버·97M DL) · MCP vs A2A(onereach, Linux Foundation 거버넌스)
- 신흥/한국: Gumloop/Lindy/Relay(lindy.ai·relay.app·composio) · 채널톡(channel.io·tracxn·g2) · Cafe24 생태계(70% 점유·GMV 13.6조·앱스토어 마케팅 자동화 앱)
- 라이선스: docs.n8n.io/sustainable-use-license · scalevise · 관찰가능성: digitalapplied(LangSmith/Langfuse/Arize)·langfuse.com

## Rationale

### 제목과 비교 범위가 다른 이유

제목은 원문 파일 이름(`competitive-analysis-n8n-flowise`)을 따른다. v2 에서 외부 경쟁사를 일곱 종으로 넓혔지만 파일 이름은 그대로 뒀다. 그래서 개요 첫 문단에 실제 비교 범위를 적는다.

### v1 의 사실 오류 네 건을 고쳤다 (v2)

v2 는 스펙과 코드를 정독해 v1 의 단정 네 건이 틀렸음을 확인했다.

| v1 단정 | 코드로 확인한 사실 |
| --- | --- |
| 라이선스 정의가 없어 결정이 필요하다 | 틀림. `LICENSE`(AGPL v3)와 `LICENSE-COMMERCIAL.md` 듀얼 라이선스로 오픈코어 전략을 이미 택했다. n8n SUL · Dify 와 같은 구도다 |
| 토큰 · 비용 추적이 미흡하다 | 부분적으로 틀림. `llm_usage_log` 가 노드 실행 · 토큰 · 비용을 쌓고 통계 화면에 보인다. 임베딩 토큰 미기록과 프롬프트별 토큰 디버거 · 평가 부재만 맞다 |
| (언급 없음) | 누락된 강점. WebAuthn · TOTP, refresh family rotation 과 재사용 감지, AES-256-GCM 시크릿 저장소로 인증 · 보안이 오히려 강점이다 |
| 분산 실행 엔진이 강점이다(제품 개요 표현 인용) | 중대 정정. 실행 중 실행은 시작한 인스턴스에 in-process 로 묶여 있었다. 분산은 입력 대기 → 재개 인계에만 있었다. 워커 풀, 우선순위 큐, 동시 실행 · 타임아웃 가드는 모두 미구현(Planned)이었다. 크래시 때 실행 중 실행은 재큐되지 않고 30분 뒤 실패했다 |

각 사실은 본문의 [강점](#강점) 과 [실행 엔진 신뢰성 분석](#실행-엔진-신뢰성-분석) 에 옮겼다.

### 노드를 도구로 쓰는 경로를 🔴 에서 🟡 로 내렸다 (v2.1)

사용자 반박을 스펙과 코드로 다시 확인했다. Cafe24 같은 도메인 액션은 `mcp_` 도구로 추론 도중 호출과 multi-hop 이 살아 있다. 그래서 도메인 에이전트 약속은 깨지지 않았다. 남는 갭은 임의 커스텀 노드를 도구로 쓰는 경로와 대화 스레드 밖의 일반 노드 출력뿐이라 🟡 로 내렸다. v2.4 에서는 같은 경로를 범용 통합의 직접 구현체로 보고 우선순위를 P0 로 올렸다. 등급(심각도)과 우선순위(코어 명제와의 거리)는 다른 축이다.

### "실행 중 분산 안 됨" 을 "스케줄러급 제어 부재" 로 바꿨다 (v2.1)

멀티 인스턴스 안전성과 재개 · Background 분산은 실재했다. v2 의 "실행 중 실행이 묶여 있으니 열위" 라는 틀은 이 사실을 가렸다. n8n queue mode 와의 격차의 실체는 work-stealing, 우선순위, 동시 실행 · 타임아웃 가드, 크래시 이어받기 같은 스케줄러급 제어였다. 그래서 틀을 바꿨다.

### 실행 엔진 신뢰성을 무조건 P0 로 올렸다 (v2.3)

v2.1 에서 ① 을 🟠 로 내렸다. 근거는 "멀티 인스턴스에서 깨지지 않는다" 였고 사실로서는 참이다. 그러나 깨지지 않는 것과 운영 신뢰성은 다르다. 성능 · 안정성 · 대량 · 분산 처리의 신뢰성은 "비즈니스 로직 실행 플랫폼" 같은 특정 포지셔닝에 딸린 조건부 요건이 아니다. AI 채팅 에이전트, 한국 커머스 버티컬, 범용 프로세스 자동화 어느 쪽으로 쓰든 해결해야 하는 기반 요건이다. 그래서 목적과 상관없이 무조건 P0 로 확정했다. 같은 이유로 v2.1 의 "제품 개요의 마케팅 표현만 고치자" 는 권고도 철회하고 문구 정정과 역량 구축을 함께 요구했다.

### 카카오 어댑터 프레임을 철회했다 (v2.1)

v2 는 "카카오 어댑터 미구현 = 치명" 으로 봤다. 알림톡 API 는 공식 대행사를 거쳐서만 쓸 수 있고 봇 토큰 직결이 불가능하다는 규제 현실을 반영하지 못한 판단이었다. 실제 갭은 대행사 통합 노드의 부재와 옴니채널 이야기의 채널 선택이다.

### 포지셔닝을 버티컬에서 범용 통합으로 고쳤다 (v2.4)

v2.3 까지는 "한국 커머스 버티컬 수직 통합" 을 코어이자 진입점으로 과하게 앞세웠다. v2.4 에서 기반 요건을 "AI 와 워크플로우의 범용 통합을 신뢰성 있게 실행하는 플랫폼" 으로 고치고 한국 커머스는 그 위의 통합 옵션이자 첫 시장 진입으로 내렸다. 이 교정 때문에 ② 범용 노드 ↔ 에이전트 도구 통합이 코어 명제에 직결되는 P0 가 됐다. ⑨ 알림톡 대행사 노드는 P1 통합 옵션이 됐다.

### 후속 액션 목록을 현재 상태 표로 바꿨다 (2026-07-16 교정)

원문 체크리스트는 다른 계획으로 넘기는 위임 목록이었다. 2026-07-16 실측에서 P0-1 은 대부분 구현됐다. P2-3 은 해소됐다. P0-2 · P0-2b · P0-3 · P1-3 은 다른 계획이 소유하고 있었다. 체크 표시만 보고 우선순위를 판단하면 끝난 일을 다시 쫓게 된다. 그래서 목록을 현재 상태와 기준 문서가 함께 보이는 표로 바꿨다. 원문 체크리스트가 링크하던 보안 계획 파일은 실존한 적이 없는 파일이라 옮기지 않았다.

### 강점에서 동시 로그인 세션 제한을 뺐다 (2026-10-10)

원문은 「인증 깊이」 강점에 동시 세션 수 제한을 함께 적었다. 2026-10-10 에 코드를 확인하니 한 사용자의 로그인 세션 수를 세거나 한도를 넘는 로그인 세션을 끊는 코드가 없었다. 그래서 강점 문장에서 이 기능을 빼고 **현재** 표시로 미구현 상태를 적었다. 이 판단은 [세션과 토큰](../CLE-ACCT/CLE-ACCT-SESSION.md#미결-사항) 의 미결 사항과 [비기능 요구사항](../CLE-PLAT/CLE-PLAT-NFR.md) 의 구현 상태에 맞췄다. 구현은 후속 NERV Task `CLE-T-VBQV4H` 로 추적한다.
