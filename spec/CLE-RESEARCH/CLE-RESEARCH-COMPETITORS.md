---
id: "CLE-RESEARCH-COMPETITORS"
title: "경쟁 분석: n8n · Flowise"
type: "design"
version: 3
status: "approved"
requirements: []
basis_superseded: false
parent: "CLE-RESEARCH"
ancestors: ["CLE-VISION", "CLE-RESEARCH"]
area: "CLE-RESEARCH"
content_hash: "9c73a72b9d445b127b751def85bf061b1b4d9c52c751bb0d6f42cdee8d2e7cb1"
read_as: "approved_fallback"
task: "CLE-T-55J6ZX"
source_paths: []
mirror_sha256: "e22c787c8a9580f410d635573311d7b22efc92f52bd91445429fa8f27db8a2ff"
etag: "sha256-3f7bb5a93b85bdc7d44e508a023346c7912bff2b22cf8019e187a7fef549c395"
---
> 성격: 전략 리서치(2026-06-03 작성, 2026-07-16 · 2026-10-10 · 2026-10-31 교정) · 원문: `plan/research/competitive-analysis-n8n-flowise.md` · 용어: [용어 사전](../CLE-GLOSSARY.md)

## 개요

제목에는 n8n · Flowise 만 있지만 실제 비교 대상은 n8n · Flowise · Dify · Langflow · Make · Zapier · Gumloop/Lindy 일곱 종이다. 이 문서는 Clemvion 을 범용 자동화 도구(n8n · Make · Zapier), AI 앱 · LLMOps 도구(Dify · Flowise · Langflow), AI 네이티브 에이전트 빌더(Gumloop · Lindy)와 비교한 전략 리서치다. 신흥 에이전트 빌더 Relay.app 과 한국 커머스 인접 제품(채널톡, Cafe24 앱스토어 마케팅 자동화 앱)도 경쟁 지형에 함께 넣었다.

v2(2026-06-03)는 네 영역의 스펙과 코드를 정독하고 외부 자료를 조사해 v1 을 전면 개정했다. 같은 날 사용자(도메인 전문가)의 반박 세 건을 스펙 · 코드 · 규제 현실로 다시 검증해 판단을 고쳤다(v2.1 ~ v2.4). 2026-07-16 에는 후속 액션의 현재 상태를 실측해 교정했다.

이 문서는 요구사항을 정하지 않는다. 기능별 규칙과 구현 상태의 기준은 각 영역 문서다. 강점 · 약점 판단과 수치는 2026-06-03 시점의 관찰이다. 그 뒤 달라진 상태는 항목마다 "현재" 로 표시하고 기준 문서를 링크했다. 우선순위를 판단하기 전에 [후속 액션의 현재 상태](#후속-액션의-현재-상태) 를 먼저 본다.

범위 밖: 실행 엔진의 큐 · 복구 규칙은 [큐 워커와 동시 실행 제한](../CLE-EXEC/CLE-EXEC-WORKER.md) 과 [장애 복구와 안전 종료](../CLE-EXEC/CLE-EXEC-RECOVERY.md), 제품 비전과 로드맵은 [Clemvion 제품 개요](../CLE-VISION.md) 가 정한다.

## 후속 액션의 현재 상태

원문의 후속 액션 체크리스트는 다른 계획으로 넘기는 위임 목록이었고 2026-07-16 실측 때 이미 낡아 있었다. 아래 표가 교정한 상태다. "현재 상태" 칸은 2026-07-16 교정에 NERV 문서의 구현 상태를 더해 적었다. 계획 이름은 저장소 `plan/in-progress/` 의 추적 문서다.

| 항목 | 원문 우선순위 | 내용 | 현재 상태 | 기준 문서 |
| --- | --- | --- | --- | --- |
| P0-1 실행 엔진 신뢰성 | P0 | 시작 큐와 work-stealing, 크래시 때 실행 중 세그먼트 재구동, 동시 실행 제한과 실행 시간 한도, 워커 크래시 검출 | 대부분 구현됨. 시작 큐, 동시 실행 제한, 우선순위 3단계, stalled 재배달, 작업을 잃은 대기 중 실행 회수가 들어갔다. 워커 크래시는 별도 heartbeat 채널 대신 stalled 재배달로 잡는다. 제품 개요의 "분산 워커 풀" 서술도 실제 모델과 맞다. | [큐 워커와 동시 실행 제한](../CLE-EXEC/CLE-EXEC-WORKER.md), [장애 복구와 안전 종료](../CLE-EXEC/CLE-EXEC-RECOVERY.md), [시스템 아키텍처](../CLE-PLAT/CLE-PLAT-ARCH.md#실행-엔진-redis-큐--분산-워커-풀) |
| P0-2 스펙과 코드의 차이 31건 정리 | P0 | 현재형으로 약속했지만 코드가 없는 표면을 우선순위화 | `spec-sync-*` 계획들로 줄여 나눠 추적 중이다. | 각 영역 문서 머리 줄의 구현 상태 |
| P0-2b 범용 노드 ↔ 에이전트 도구 통합 | P0 | 임의 워크플로우 노드를 AI 에이전트 도구로 쓰는 경로 재구현(ND-AG-06/10/21) | 미구현. `ai-agent-tool-connection-rewrite` 계획이 소유한다. | [AI 에이전트 노드](../CLE-NODE-AI/CLE-NODE-AGENT.md#도구-연결-입력-경로-제거) |
| P0-3 통합 · 확장 봉쇄 완화 | P0 | 핵심 SaaS 커넥터와 MCP-first 결합 | `marketplace-and-plugin-sdk` 계획이 소유한다. 그 사이 통합 노드에 MakeShop 이 더해졌다. | [마켓플레이스 (구상)](../CLE-UI/CLE-UI-MARKET.md), [노드 시스템 구조와 카탈로그](../CLE-NODE/CLE-NODE-ARCH.md), [MakeShop 노드](../CLE-NODE-INT/CLE-NODE-MAKESHOP.md) |
| P1-1 MCP-first 포지셔닝 확정 | P1 | 제품 메시징과 랜딩의 1급 축으로 삼을지, 제품 개요 비전에 반영할지 | 미착지. 이 문서 밖에 추적처가 없다. 제품 개요 비전에는 MCP-first 서술이 없다. | [Clemvion 제품 개요](../CLE-VISION.md), [MCP 클라이언트](../CLE-INT/CLE-INT-MCP.md) |
| P1-2 알림톡 대행사 통합 노드 | P1 | 솔라피 · 비즈고 · 알리고 같은 대행사를 거쳐 알림톡을 보내는 노드, Cafe24 주문 → 알림톡, "Cafe24 상점주 AI 운영 · CS" 진입. 코어 밖의 첫 진입점으로 추진 | 미착지. 다른 계획에 집이 없다. | [통합 노드](../CLE-NODE-INT/CLE-NODE-INT.md), [Send Email 노드](../CLE-NODE-INT/CLE-NODE-EMAIL.md), [Cafe24 노드](../CLE-NODE-INT/CLE-NODE-CAFE24.md) |
| P1-3 템플릿 갤러리 MVP | P1 | 마켓플레이스 백로그에서 템플릿만 떼어 먼저 낸다 | `marketplace-and-plugin-sdk` 계획의 워크플로우 템플릿 마켓 단계가 소유한다. | [마켓플레이스 (구상)](../CLE-UI/CLE-UI-MARKET.md) |
| P2-1 LLMOps 레이어 | P2 | 리랭커 · 청킹 전략 · 평가 · 프롬프트 버전 관리 · LLM 트레이싱(Langfuse) 연결의 스펙이 필요한지 | 일부 구현됨. 리랭킹(`cross_encoder`, `cross_encoder_llm`)과 검색 지표 평가 하네스가 들어갔다. 청킹 개선과 생성 품질 평가는 `rag-quality-improvement` 계획이 소유한다. 프롬프트 버전 관리와 LLM 트레이싱 연결은 추적처가 없다. | [RAG 검색](../CLE-KB/CLE-KB-SEARCH.md), [RAG 품질 평가](../CLE-KB/CLE-KB-EVAL.md), [문서 임베딩](../CLE-KB/CLE-KB-EMBED.md) |
| P2-2 멀티에이전트 · A2A 채택 조사 | P2 | Dify · Langflow · Gumloop 벤치마크 | 미착지. 다른 계획에 집이 없다. | [AI 에이전트 노드](../CLE-NODE-AI/CLE-NODE-AGENT.md), [워크플로우 호출 노드](../CLE-NODE-FLOW/CLE-NODE-SUBWF.md) |
| P2-3 보안 백로그 | P2 | `JWT_SECRET` fallback, `ENCRYPTION_KEY` 분리, 인증 설정 감사 | 해소됨. 운영(`NODE_ENV=production`)에서 `JWT_SECRET` 이 없거나 기본값이면 부팅을 거부한다. 인증 설정 변경 감사는 `auth_config.*` 액션으로 구현됐다. 암호화 키 두 개의 정리는 시크릿 저장소 R13 에서 결정했고(2026-10-10) 마스터키를 LLM API 키와 함께 쓰는 구조는 R6 대로 둔다. 상세는 [강점과 약점](CLE-RESEARCH-COMPETITORS-ASSESS.md#약점과-갭) 의 ⑬ 보안 백로그에 있다. | [세션과 토큰](../CLE-ACCT/CLE-ACCT-SESSION.md), [감사 로그](../CLE-OBS/CLE-OBS-AUDIT.md), [시크릿 저장소](../CLE-INT/CLE-INT-SECRET.md) |
| P3 업마켓 전환 여부 결정 | P3 | SSO/SAML/SCIM, 조직 수준, 메트릭, Helm, 실시간 협업에 투자할 트리거 | 결정은 미착지다. 구성 요소 일부는 따로 움직였다. Prometheus 메트릭은 구현됐다. Docker Compose · Helm 배포는 `self-hosting-deployment`, LDAP/SAML 은 `spec-sync-auth-gaps` 계획이 소유한다. SCIM 과 실시간 협업은 추적처가 없다. | [비기능 요구사항](../CLE-PLAT/CLE-PLAT-NFR.md), [가입과 로그인](../CLE-ACCT/CLE-ACCT-SIGNIN.md) |

2026-07-16 교정의 결론은 이렇다. 다른 계획에 집이 없는 미착지 전략 항목은 P1-2(알림톡 대행사 노드), P2-2(멀티에이전트 · A2A 조사), P3(업마켓 전환 결정) 세 건이다. NERV 로 옮기며 다시 확인하니 P1-1(MCP-first 포지셔닝)과 P2-1 의 나머지(프롬프트 버전 관리, LLM 트레이싱)도 추적처가 없다. 이 항목들이 이 문서를 살아 있게 하는 실질 내용이다.

## 포지셔닝

Clemvion 의 기반 요건은 **AI 와 워크플로우의 범용 통합을 신뢰성 있게 실행하는 플랫폼**이다. AI 에이전트가 워크플로우의 1급 구성 요소로서 노드 · 도구 · 실행 흐름과 양방향으로 엮이고 그 실행이 대량 · 분산 · 장애 상황에서도 신뢰성을 유지해야 한다. 한국 커머스(Cafe24)와 옴니채널 채팅은 그 위에 얹는 강력한 통합 옵션이자 첫 시장 진입점이다. 제품의 정체나 기반 요건은 아니다.

이 기반 위에 진짜 해자(moat)가 둘 있다.

- **해자 A: 사람 개입 · 대화형 워크플로우의 신뢰성.** 영속 재개(durable continuation: 영속 BullMQ 큐와 DB rehydration), 한 트랜잭션 안의 상태 전이, DB 에 영속하는 멀티턴 에이전트(`_resumeCheckpoint`)가 재시작과 장기 대기에도 정합성을 지킨다.
- **해자 B: AI 네이티브 워크플로우의 깊이.** Graph RAG(3D 시각화 포함), MCP 클라이언트와 내부 MCP 브리지, Planner-first 대화형 워크플로우 구성, 워크플로우 안에 박힌 영속 멀티턴 에이전트가 여기에 속한다. Cafe24 222 필드 카탈로그, 옴니채널 채팅, Presentation 노드는 이 범용 역량을 입증하고 넓히는 통합 옵션의 모범 사례다. 해자 자체는 범용 AI · 워크플로우 통합이고 커머스는 그 적용이다.

기반 요건에서 두 가지가 바로 따라 나온다.

1. **신뢰성(분산 · 대량 · 장애 복구)** 은 사용 방식과 무관하게 무조건 P0 다. 근거는 [실행 엔진 신뢰성 분석](CLE-RESEARCH-COMPETITORS-GAPS.md#실행-엔진-신뢰성-분석) 에 있다.
2. **임의 워크플로우 노드와 AI 에이전트 도구의 연결(②)** 은 "AI · 워크플로우 범용 통합" 을 글자 그대로 구현하는 일이다. 도메인 액션을 `mcp_` 도구가 덮더라도 코어 명제에 직결되는 작업이다. 주변 기능이 아니다.

### 경쟁 지형 (2026)

| 진영 | 대표 | 규모 · 특징 |
| --- | --- | --- |
| 범용 자동화 | **n8n**(182k★, 7년, 400+ 통합, self-host 와 무제한 실행), **Make**(가장 뛰어난 비주얼 빌더, Zapier 대비 60% 저렴), **Zapier**(7000+ 통합, 비개발자 접근성 최강) | 폭과 생태계가 압도적 |
| AI 앱 · LLMOps | **Dify**(131k★, 100만+ 앱 배포, 280+ 엔터프라이즈[Maersk · Novartis], RAG · MCP · 멀티에이전트), **Flowise**(51k★, MIT), **Langflow**(LangGraph 멀티에이전트) | RAG 와 에이전트 성숙도 |
| AI 네이티브 에이전트 빌더(신흥) | **Gumloop**($70M 투자, 멀티에이전트), **Lindy**(agent-to-agent "Lindies"), **Relay.app** | 멀티에이전트 오케스트레이션을 기본 탑재 |
| 한국 커머스 인접 | **채널톡**($17.1M, CS 챗봇과 워크플로우, Shopify 앱), **Cafe24 앱스토어 마케팅 자동화 앱**(타스온 · 휴머스온 등) | 진입 시장이 비어 있지 않다. 단일 목적 제품이 먼저 차지했다 |

### 전략적 함의

코어는 범용 AI · 워크플로우 통합 플랫폼이다. 한국 커머스는 그 위의 통합 옵션이자 첫 시장 진입이며 코어를 대신하지 않는다. 그 옵션 시장도 비어 있지 않다. CS 는 채널톡이, 마케팅은 Cafe24 앱스토어 앱이 먼저 차지했다. 이 시장에서 Clemvion 이 차별화되는 이유는 경쟁 제품이 단일 목적 앱인 데 비해 Clemvion 은 같은 범용 엔진(프로그래머블 워크플로우, 에이전트, 깊은 API)을 커머스에 적용하기 때문이다. 같은 엔진이 다른 버티컬과 범용 자동화로 넓어진다.

## 하위 문서

두 문서 모두 요구사항을 맡지 않는다.

- [경쟁 분석: n8n · Flowise — 강점과 약점](CLE-RESEARCH-COMPETITORS-ASSESS.md): 강점(🟢)과 약점 · 갭 ①~⑭ 와 항목별 현재 상태.
- [경쟁 분석: n8n · Flowise — 핵심 갭 근거 분석](CLE-RESEARCH-COMPETITORS-GAPS.md): ① 실행 엔진 신뢰성 분석, ② 노드를 도구로 쓰는 경로, ⑨ 한국 채널 전략의 근거와 판단 변경의 Rationale.

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
4. **P0 재구성(v2.4)**: ① 실행 엔진 신뢰성(크래시 복구, 처리량, backpressure, 멀티테넌트 가드)은 사용 방식과 무관하게 무조건 P0 다. ② 범용 노드 ↔ 에이전트 도구 통합은 "AI · 워크플로우 범용 통합" 의 직접 구현체라 코어 명제에 직결된다. 그래서 진짜 P0 는 ① 엔진 신뢰성, ② 범용 노드 · 도구 통합, ③ 통합 · 확장 봉쇄, ④ 스펙과 코드의 차이다. ⑨ 알림톡 대행사 노드는 코어가 아닌 통합 옵션으로 P1 이다.
5. **멀티에이전트는 곧 기본 요건이 된다.** A2A 표준화와 경쟁사의 전면 채택을 볼 때 중기 필수다.
6. **엔터프라이즈(SSO, 메트릭, Org)** 는 업마켓 전환을 결정하기 전까지 후순위다. 범용 SMB 와 셀프 호스팅에는 SAML 이 필요 없다.

## 우선순위별 액션

2026-06-03 에 정한 순서다. 항목별 현재 상태는 [후속 액션의 현재 상태](#후속-액션의-현재-상태) 에 있다.

- **P0 (기반: 신뢰성 · 범용 통합 · 정합성)**
  - ① 실행 엔진 신뢰성 구축: 워커 모델 완성(접수 큐, work-stealing), 크래시 때 실행 중 실행을 체크포인트에서 재개(rehydration 을 일반 노드로 확장), 동시 실행 상한과 실행 타임아웃 적용, heartbeat 재큐. 모든 복구 · 재큐 · 타임아웃은 실행 중 실행에만 적용한다. 입력 대기는 재큐 · 만료에서 빼고 기한 없이 보존한다. 타임아웃은 실제로 실행 중인 시간 기준이다(근거는 [핵심 갭 근거 분석 「이미 설계된 것을 짓는 일」](CLE-RESEARCH-COMPETITORS-GAPS.md#이미-설계된-것을-짓는-일)). 기존 재개 · rehydration 토대 위에서 증분으로 짓는다. 제품 개요의 "분산 워커 풀" 문구를 역량과 맞춘다.
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

각 사실은 본문의 [강점](CLE-RESEARCH-COMPETITORS-ASSESS.md#강점) 과 [실행 엔진 신뢰성 분석](CLE-RESEARCH-COMPETITORS-GAPS.md#실행-엔진-신뢰성-분석) 에 옮겼다.

### 포지셔닝을 버티컬에서 범용 통합으로 고쳤다 (v2.4)

v2.3 까지는 "한국 커머스 버티컬 수직 통합" 을 코어이자 진입점으로 과하게 앞세웠다. v2.4 에서 기반 요건을 "AI 와 워크플로우의 범용 통합을 신뢰성 있게 실행하는 플랫폼" 으로 고치고 한국 커머스는 그 위의 통합 옵션이자 첫 시장 진입으로 내렸다. 이 교정 때문에 ② 범용 노드 ↔ 에이전트 도구 통합이 코어 명제에 직결되는 P0 가 됐다. ⑨ 알림톡 대행사 노드는 P1 통합 옵션이 됐다.

### 후속 액션 목록을 현재 상태 표로 바꿨다 (2026-07-16 교정)

원문 체크리스트는 다른 계획으로 넘기는 위임 목록이었다. 2026-07-16 실측에서 P0-1 은 대부분 구현됐다. P2-3 은 해소됐다. P0-2 · P0-2b · P0-3 · P1-3 은 다른 계획이 소유하고 있었다. 체크 표시만 보고 우선순위를 판단하면 끝난 일을 다시 쫓게 된다. 그래서 목록을 현재 상태와 기준 문서가 함께 보이는 표로 바꿨다. 원문 체크리스트가 링크하던 보안 계획 파일은 실존한 적이 없는 파일이라 옮기지 않았다.

### 암호화 키 정리를 미결에서 결정으로 고쳤다 (2026-10-31)

P2-3 행과 ⑬ 은 암호화 키 두 개의 정리를 시크릿 저장소의 미결 사항으로 적었다. 이 사항은 2026-10-10 에 [시크릿 저장소 「R13. 통합 암호화 키를 마스터키와 따로 둔다」](../CLE-INT/CLE-INT-SECRET.md#r13-통합-암호화-키-integration_encryption_key-를-마스터키와-따로-두고-production-에서-키-없이-기동하지-않는다-2026-10-10) 에서 결정됐으므로 두 곳을 결정 내용으로 고쳤다(NERV Task `CLE-T-KQ37NJ`).

R13 은 통합 암호화 키를 마스터키와 따로 두는 일만 정했다. ⑬ 의 원래 항목인 "`ENCRYPTION_KEY` 단일 마스터키의 여러 도메인 재사용" 가운데 마스터키 하나를 시크릿 저장소와 LLM API 키가 함께 쓰는 부분은 그대로 남는다. 이 구조는 [시크릿 저장소 「R6. 마스터키를 LLM API 키와 함께 쓴다」](../CLE-INT/CLE-INT-SECRET.md#r6-마스터키를-llm-api-키와-함께-쓴다) 가 정한 대로다. 결정 문장만 적으면 이 부분까지 R13 이 닫은 것으로 읽힌다. 그래서 P2-3 행과 ⑬ 두 곳에 R6 도 함께 적었다. 분리한 뒤로 ⑬ 은 하위 문서 [강점과 약점](CLE-RESEARCH-COMPETITORS-ASSESS.md#약점과-갭) 에 있다. 전문은 ⑬ 에 두고 P2-3 행은 요약과 링크만 둔다.
