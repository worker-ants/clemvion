---
id: "CLE-VISION"
title: "Clemvion 제품 개요"
type: "vision"
version: 1
status: "approved"
requirements: []
basis_superseded: false
parent: null
ancestors: []
area: null
content_hash: "8f905f61811ee5253595be57f1ee807a39befd9d6c9202c85a31370522f88443"
read_as: "approved_fallback"
task: "CLE-T-52JYHM"
source_paths: ["spec/0-overview.md"]
mirror_sha256: "2485a6012572a6b34aafec95dd05fdb41eb27bab08cbeb8e7a397f81451eb3d1"
etag: "sha256-fa340c5062314bd895befc98e6f0e863f25738fb449dac2dc2c4c3d2078b2d16"
---
> 구현 상태: 부분 구현 · 원문: `spec/0-overview.md` (Overview §1~§8, §4 영역별 진입 문서) · 용어: [용어 사전](CLE-GLOSSARY.md)

## 개요

이 문서는 Clemvion 스펙 트리의 맨 위 문서다. 제품이 무엇이고 누구를 위한 것인지, 어떤 단위로 쓰고 어떻게 배포하는지, 지금 어디까지 구현했고 무엇이 남았는지를 정한다. 그리고 [문서 지도](#문서-지도) 에서 영역별 진입 문서를 안내한다.

이 트리가 제품의 단일 기준이다. 한 사실은 한 문서에만 정의하고, 다른 문서는 그 문서를 링크한다. 표준 용어는 [용어 사전](CLE-GLOSSARY.md) 이 정한다.

범위 밖: 브랜드 스토리와 시각 정체성은 [브랜드](CLE-UI/CLE-UI-BRAND.md), 시스템 구성과 배포 환경별 차이는 [시스템 아키텍처](CLE-PLAT/CLE-PLAT-ARCH.md), 품질 목표는 [비기능 요구사항](CLE-PLAT/CLE-PLAT-NFR.md) 이 정한다.

## 제품 비전

> "흐름은 설계하는 것이 아니라, 자라나야 한다." ([브랜드](CLE-UI/CLE-UI-BRAND.md))

Clemvion 은 AI 에이전트와 노코드 워크플로우 빌더를 합친 실행 플랫폼이다. 시각적 캔버스에서 노드를 이어 복잡한 비즈니스 자동화를 만든다. 워크플로우 안에 AI 에이전트 노드를 넣어, 각 단계가 단순 실행이 아니라 판단과 적응을 하게 한다.

- 개발자에게는 고급 설정과 코드 편집을 준다.
- 비개발자에게는 드래그 앤 드롭 화면과, AI 어시스턴트와 대화하며 워크플로우를 만들고 고치고 디버깅하는 편집을 준다.

## 목표

| 구분 | 목표 |
| --- | --- |
| 사용자 가치 | 반복 업무를 자동화해 생산성을 높인다. AI 에이전트로 지능형 워크플로우를 만든다 |
| 비즈니스 가치 | SaaS 와 셀프 호스팅을 함께 제공해 다양한 고객층을 확보한다. 마켓플레이스로 생태계를 만든다 |
| 기술 목표 | 확장 가능한 노드 시스템, 안정적인 워크플로우 실행 엔진, 실시간 디버깅 |

## 대상 사용자

| 사용자 | 특징 |
| --- | --- |
| 비개발자 | 마케팅·운영·CS 같은 비즈니스 부서 담당자. 반복 업무 자동화가 필요한 사람. 직관적인 화면으로 워크플로우를 구성한다 |
| 개발자 | 빠른 프로토타이핑과 자동화 파이프라인 구축. 코드 편집·커스텀 노드 개발·API 직접 호출 같은 고급 기능을 쓴다. 셀프 호스팅 환경을 운영한다 |
| 팀·조직 | 워크플로우를 공유하고 협업한다. 역할과 권한으로 접근을 관리한다. 조직 단위로 통합 설정을 공유한다 |

## 사용 단위

- **개인**: 개인 워크스페이스에서 혼자 워크플로우를 만들고 관리한다.
- **팀·조직**: 팀 워크스페이스로 워크플로우를 공유하고, 역할과 권한을 관리하고, 공통 통합 설정을 관리한다.

워크스페이스·멤버·역할의 규칙은 [워크스페이스와 멤버](CLE-ACCT/CLE-ACCT-WS.md) 가 정한다.

## 배포 방식

| 방식 | 설명 |
| --- | --- |
| SaaS | 클라우드 호스팅, 멀티 테넌트, 구독 과금 |
| 셀프 호스팅 | 온프레미스나 프라이빗 클라우드에 배포. 단일·멀티 테넌트를 고를 수 있다 |

두 방식 모두 같은 기능을 준다. 환경에 기대지 않는 설계로 설정만 바꿔 배포 방식을 전환할 수 있어야 한다. 인증·데이터 격리·스케일링·업데이트·모니터링의 환경별 차이는 [시스템 아키텍처](CLE-PLAT/CLE-PLAT-ARCH.md) 의 배포 환경 분리 절에 있다.

## 구현 현황과 로드맵

영역별 구현 상태의 기준은 각 문서 머리 줄의 구현 상태다. 이 절은 그 요약이다.

### 구현 완료

| 영역 | 기능 | 기준 문서 |
| --- | --- | --- |
| 내비게이션 화면 | 대시보드, 워크플로우 목록, 트리거 목록, 스케줄, 웹채팅 운영 콘솔(`/web-chat`), 통합, 지식 저장소, 모델 설정(`/models`), 인증 설정, 통계, 시스템 상태(`/system-status`), 에이전트 메모리(`/agent-memory`), 사용자 가이드(`/docs`), 내 프로필, 실행 내역 | [레이아웃과 내비게이션](CLE-UI/CLE-UI-LAYOUT.md) |
| 워크플로우 에디터 | 캔버스 노드 편집, 연결선, 실행과 디버깅, 버전 기록 | [워크플로우 에디터와 캔버스](CLE-WF/CLE-WF-EDITOR.md) |
| 노드 시스템 | 트리거(수동 트리거), Logic(If/Else·Switch·Loop·ForEach·Map·Filter·Split·Merge·Parallel·Background·변수 선언·변수 수정), Flow(워크플로우 호출), AI(AI 에이전트·텍스트 분류기·정보 추출기), 통합(HTTP Request·Database Query·Send Email·Cafe24·MakeShop), Data(Transform·Code), Presentation(Carousel·Chart·Form·Table·Template). Parallel 은 기본 켜짐(`PARALLEL_ENGINE=v1`)이고 끌 때는 `PARALLEL_ENGINE=off` 를 쓴다 | [노드 시스템 구조와 카탈로그](CLE-NODE/CLE-NODE-ARCH.md), [Parallel 노드](CLE-NODE-LOGIC/CLE-NODE-PARALLEL.md) |
| AI 플랫폼 | 모델 설정(채팅·임베딩·리랭크를 한 엔티티로 관리. 프로바이더 OpenAI·Anthropic·Google·Azure OpenAI·로컬 Ollama·vLLM 다섯 모두 스트리밍 지원), 지식 저장소(문서 업로드·임베딩·RAG 검색), Graph RAG(지식 저장소 검색 모드 선택, 엔티티·관계 자동 추출, Hybrid 검색, 엔티티·관계 목록과 삭제, 3D 그래프 시각화), 리랭킹(지식 저장소 단위 검색 후처리. cross-encoder, cross-encoder + LLM 채점. 리랭커 프로바이더 TEI·Cohere) | [모델 설정](CLE-AI/CLE-AI-MODELS.md), [지식 저장소 관리](CLE-KB/CLE-KB-MANAGE.md), [Graph RAG](CLE-KB/CLE-KB-GRAPH.md), [RAG 검색](CLE-KB/CLE-KB-SEARCH.md) |
| 워크플로우 AI 어시스턴트 | 에디터 안 채팅형 AI 가 자연어 요청으로 노드와 연결선을 구성한다. Clarify → Plan → Execute 3단계 대화, SSE 스트리밍, 세션 유지 | [워크플로우 AI 어시스턴트](CLE-WF/CLE-WF-ASSIST.md) |
| 팀 워크스페이스와 역할 | 개인·팀 워크스페이스, 멤버 역할, 워크스페이스 전환, 멤버 초대·역할 변경·소유자 이양. 가입하면 개인 워크스페이스가 자동으로 생기고, 서버가 `X-Workspace-Id` 를 자동으로 맞춘다 | [워크스페이스와 멤버](CLE-ACCT/CLE-ACCT-WS.md) |
| 워크스페이스 단위 통합 공유 | 통합은 워크스페이스 단위로 격리되고 팀 멤버끼리 공유한다. 모든 통합 API 가 현재 워크스페이스로 범위를 좁히고, 생성·수정·삭제·자격 증명 교체는 라우트 가드가 편집자 이상으로 막는다(NAV-IN-07). 개인·조직 공개 범위별 세부 권한은 기준 문서가 정한다. 여러 워크스페이스를 가로지르는 조직 수준 공유는 로드맵에 있다 | [통합 관리](CLE-INT/CLE-INT-MANAGE.md), [워크스페이스와 멤버](CLE-ACCT/CLE-ACCT-WS.md) |
| Cafe24 통합 | `cafe24` 단일 노드(18개 리소스 메타데이터 기반 Resource × Operation, 485 endpoint), AI 에이전트 내부 MCP 브리지로 양방향 노출, Public·Private 앱 OAuth, Cafe24 Developers "테스트 실행"·"앱으로 가기" App URL 흐름, 누수 버킷 요청 빈도 제한, BullMQ 기반 인스턴스 사이 토큰 갱신 직렬화, 7일 임계 + 6시간 주기 백그라운드 갱신(리프레시 토큰 14일 만료 전 자동 갱신). 도구 수가 AI 에이전트 도구 수 한도(`AI_AGENT_TOOL_COUNT_MAX`, 기본 128)를 늘 넘으므로 에이전트에 연결할 때 `enabledTools` 허용 목록이 사실상 필요하다 | [Cafe24 노드](CLE-NODE-INT/CLE-NODE-CAFE24.md), [AI 에이전트 노드](CLE-NODE-AI/CLE-NODE-AGENT.md) |
| MakeShop 통합 | `makeshop` 단일 노드(7개 섹션 메타데이터 기반 Resource × Operation, 161 REST operation), AI 에이전트 내부 MCP 브리지 양방향 노출(`MakeshopMcpToolProvider`), OAuth 2.1 auth-code + PKCE(`auth.makeshop.com`, 리프레시 토큰 회전), ShopStore 설치 HMAC, 전용 `makeshop-token-refresh` 큐로 인스턴스 사이 직렬화, 프론트엔드와 e2e. Cafe24 와 같은 설계다(단일 호스트 `connect.makeshop.co.kr` + `shop_uid` 경로 세그먼트, flat JSON 본문). Cafe24 와 같이 도구 수(161)가 한도(128)를 넘어 `enabledTools` 허용 목록이 사실상 필요하다 | [MakeShop 노드](CLE-NODE-INT/CLE-NODE-MAKESHOP.md), [MakeShop Shop API 카탈로그](CLE-MKS-CATALOG) |
| 시스템 | 인증과 인가(개인·팀 워크스페이스), REST API, 에러 처리, 표현식 엔진(`{{ }}`), 실행 엔진(Redis 큐 + 워커 풀, BullMQ 영속 재개 큐 기반 분산 재개와 rehydration), WebSocket 실시간 상태, 웹훅 수신, 실행 내역 | [시스템 아키텍처](CLE-PLAT/CLE-PLAT-ARCH.md), [실행 엔진 개요와 그래프 순회](CLE-EXEC/CLE-EXEC-ENGINE.md) |
| 재실행 | 기존 실행을 새 실행으로 다시 돌리기(dry-run 포함) | [재실행](CLE-EXEC/CLE-EXEC-RERUN.md) |
| MCP 클라이언트 | 외부 MCP 서버와 내부 MCP 브리지 도구를 LLM 도구로 노출 | [MCP 클라이언트](CLE-INT/CLE-INT-MCP.md) |
| 에이전트 메모리 | 대화 사이에 남는 메모리의 추출·회수·관리 화면 | [에이전트 메모리](CLE-AI/CLE-AI-MEMORY.md) |
| 임베드형 웹채팅 위젯과 SDK | 외부 사이트에 넣는 iframe 격리형 위젯 SPA(`codebase/channel-web-chat`, Next.js CSR), 개발자 SDK(설치 스크립트 로더·npm, `codebase/packages/web-chat-sdk`)와 샘플. External Interaction API 의 클라이언트 쪽 소비자다. 제품 안 운영 콘솔(인스턴스 생성·외형 빌더·설치 스크립트·라이브 미리보기)도 있다. 위젯 화면 틀의 영어 다국어화도 구현했다. 남은 품질·강화 항목은 막지 않는 백로그다 | [웹채팅](CLE-WEBCHAT/CLE-WEBCHAT.md) |

### 부분 구현

| 영역 | 상태 | 기준 문서 |
| --- | --- | --- |
| 채팅 채널 | Telegram·Slack·Discord 봇으로 워크플로우를 돌리는 서버 어댑터. v1 은 1:1 DM 을 지원한다. 남은 것은 세 가지다. 트리거 활성화·비활성화 때 채널 등록·해제(`setupChannel`·`teardownChannel`)를 자동으로 부르는 동작은 부분 구현이다. 시각형 노드(Chart·Table·Carousel)의 이미지 발송은 미구현이고 지금은 텍스트 표현으로 보낸다. Discord Gateway 와 Slack Socket Mode 는 미구현(v2 후속)이다 | [채팅 채널 영역](CLE-CHAT/CLE-CHAT.md), [채팅 채널](CLE-CHAT/CLE-CHAT-CORE.md) |
| External Interaction API | 실행 중인 워크플로우와 외부가 주고받는 공개 API(EIA 알림 웹훅, 수신 REST·SSE). 스펙 상태가 부분 구현이다 | [External Interaction API](CLE-IX/CLE-EIA.md) |

### 로드맵(미구현)

| 영역 | 내용 | 기준 문서 |
| --- | --- | --- |
| Graph RAG 후속 | 커뮤니티 검출, 전역 요약, 도메인별 엔티티 타입 사전, 지식 저장소 단위 프롬프트 재정의. 본체는 구현 완료다 | [Graph RAG](CLE-KB/CLE-KB-GRAPH.md) |
| 실행 상세의 노드를 넘는 대화 스레드 뷰 | 여러 노드의 Presentation·AI 턴을 순번·시각·출처로 섞어 다시 만든 통합 대화 뷰(파생 뷰, EH-DETAIL-12). 단일 AI 에이전트 노드의 미리보기는 구현 완료다 | [실행 내역](CLE-EXEC/CLE-EXEC-HISTORY.md), [대화 스레드](CLE-IX/CLE-IX-THREAD.md) |
| 조직 수준 통합 공유 | 워크스페이스 단위 공유는 구현 완료다. 남은 것은 여러 워크스페이스를 가로지르는 상위 조직 단위 공유다 | [통합 관리](CLE-INT/CLE-INT-MANAGE.md) |
| 마켓플레이스 | 워크플로우 템플릿·AI 에이전트 프리셋·통합 플러그인·커스텀 노드 게시와 설치 | [마켓플레이스 (구상)](CLE-UI/CLE-UI-MARKET.md) |
| 배포 자동화 확장 | 공식 Docker·Kubernetes 배포 가이드, 셀프 호스팅 번들 | [비기능 요구사항](CLE-PLAT/CLE-PLAT-NFR.md) |
| 셀프 호스팅 LDAP/SAML 인증 | 배포 환경 표의 셀프 호스팅 인증 옵션. 아직 핸들러가 없다 | [가입과 로그인](CLE-ACCT/CLE-ACCT-SIGNIN.md) |
| 확장 SDK | 노드 플러그인 SDK, 외부 커스텀 노드 개발과 게시 | [비기능 요구사항](CLE-PLAT/CLE-PLAT-NFR.md) |
| 내부 MCP 브리지 패턴 확장 | Cafe24·MakeShop(둘 다 구현 완료) 다음으로 Shopify·Naver Smartstore 같은 이커머스 통합을 같은 내부 브리지 패턴으로 넓힌다. MakeShop 의 CPIK 웹훅(이벤트 수신)도 여기에 속한다 | [MCP 클라이언트](CLE-INT/CLE-INT-MCP.md) |

## 용어

제품 용어의 정의와 표기는 [용어 사전](CLE-GLOSSARY.md) 이 정한다. 사전은 표기 원칙 · 약어 · 상태값 표기를 담은 색인과 영역별 하위 문서(`CLE-GLOSSARY-*`)로 나뉜다. 워크플로우·노드·연결선·포트·트리거·캔버스·통합·지식 저장소·Graph RAG·실행·워크스페이스·마켓플레이스·스케줄·LLM·RAG 같은 기본 용어는 하위 문서에 있다. 색인의 「문서」 절이 하위 문서 목록이다.

## 문서 지도

스펙 트리는 영역별로 묶인다. 영역 문서는 그 영역의 문서 목록과 한 줄 설명을 갖는다.

| 영역 | 다루는 것 |
| --- | --- |
| [용어 사전](CLE-GLOSSARY.md) | 모든 스펙 문서가 따르는 표기 원칙 · 약어 · 상태값 표기(색인)와 영역별 하위 문서 12개. 하위 문서는 표준 용어 · 코드 식별자 · 쓰지 않는 표기와 다의어 구분 · 결정이 필요한 표기를 담는다 |
| [플랫폼 구조](CLE-PLAT/CLE-PLAT.md) | 시스템 아키텍처, 비기능 요구사항, 데이터 모델 전반, 큐와 Redis 키, 파일 저장소처럼 여러 영역이 함께 쓰는 기반 |
| [앱 셸과 공통 화면](CLE-UI/CLE-UI.md) | 레이아웃·내비게이션·오류 화면·사용자 가이드·다국어·브랜드처럼 모든 화면이 공유하는 틀 |
| [API 공통 규약](CLE-API/CLE-API.md) | HTTP API·에러·OpenAPI·WebSocket·응답 마스킹처럼 모든 외부 표면이 따르는 규약 |
| [계정과 워크스페이스](CLE-ACCT/CLE-ACCT.md) | 사용자 신원·로그인 세션·프로필과 워크스페이스·멤버·역할 |
| [워크플로우 작성](CLE-WF/CLE-WF.md) | 워크플로우 목록·에디터·노드 설정 패널·연결선·버전 기록·표현식·AI 어시스턴트 |
| [실행](CLE-EXEC/CLE-EXEC.md) | 워크플로우 실행의 화면(에디터 실행·실행 내역·재실행)과 실행 엔진 내부 계약 |
| [노드](CLE-NODE/CLE-NODE.md) | 노드 시스템 구조·노드 출력 규약·에러 처리 정책과 카테고리별 노드 |
| [트리거](CLE-TRIG/CLE-TRIG.md) | 워크플로우를 시작시키는 트리거·스케줄·웹훅·외부 호출 인증 설정 |
| [통합](CLE-INT/CLE-INT.md) | 외부 서비스 연결의 관리·인증·상태와 시크릿 저장소·MCP·Cafe24·MakeShop |
| [외부 상호작용](CLE-IX/CLE-IX.md) | 실행 중인 워크플로우와 외부가 주고받는 표면(EIA)과 그 소비자(채팅 채널·웹채팅) |
| [AI 모델과 메모리](CLE-AI/CLE-AI.md) | LLM 클라이언트·모델 설정·사용량 기록·에이전트 메모리 |
| [지식 저장소](CLE-KB/CLE-KB.md) | 문서를 올려 임베딩하고 AI 노드가 검색하는 지식 저장소 |
| [관측과 운영](CLE-OBS/CLE-OBS.md) | 대시보드·통계·시스템 상태·감사 로그·알림·로깅 |
| [개발 규약](CLE-ENG/CLE-ENG.md) | 제품 동작이 아니라 코드·저장소·문서 운영 방식에 관한 규약 |

### 문서 종류

| 종류 | 담는 것 |
| --- | --- |
| 영역 | 그 영역이 다루는 것과 하위 문서 목록 |
| 기능 | 화면·API·동작을 정하는 문서. `## 요구사항` 절에 요구사항 ID(`REQ-<접두>-<번호>`)를 두고, 옛 요구사항 ID 는 `(원본: …)` 로 남긴다 |
| 설계 | 구조·데이터·흐름을 푸는 문서 |
| 규약 | 여러 문서가 따르는 규칙. `## 규칙` 절에 번호 목록으로 둔다 |

모든 문서는 개요, 본문, 결정 근거(Rationale) 순서로 쓴다. 풀리지 않은 정책 충돌은 그 문서의 `## 미결 사항` 에 적는다.

## Rationale

### Cafe24·MakeShop 통합을 구현 완료로 분류한 이유

Cafe24 와 MakeShop 통합은 노드·OAuth·요청 빈도 제한·토큰 갱신(Cafe24 는 반복 작업, MakeShop 은 큐)까지 모두 구현했으므로 구현 완료로 분류한다. 내부 MCP 브리지 패턴을 Shopify·Naver Smartstore 등으로 넓히는 일은 로드맵의 별도 행으로 둔다.

구현 현황 표는 "구현 상태" 와 "확장 계획" 두 축이 섞이기 쉽다. 같은 영역이 구현 완료와 로드맵에 함께 나오는 것을 명시적으로 허용해 두 축을 나눈다.

### 구현 현황을 스펙 상태에 맞춘 이유

옛 구현 현황 표는 Parallel 노드를 구현 완료 목록과 부분 구현 목록에 함께 두었다. Parallel 노드 스펙은 구현 완료이고 기본으로 켜져 있어, 구현 완료로만 둔다. 옛 표에는 에이전트 메모리·재실행·MCP 클라이언트(구현 완료)와 채팅 채널·External Interaction API(부분 구현)가 빠져 있어 이 기능들이 없는 것처럼 읽혔다. 각 스펙의 상태를 기준으로 행을 더했다. 앞으로도 영역 문서의 구현 상태가 기준이고, 이 표는 요약이다.
