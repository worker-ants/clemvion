---
id: "CLE-GLOSSARY"
title: "용어 사전"
type: "convention"
version: 3
status: "approved"
requirements: []
basis_superseded: false
parent: "CLE-VISION"
ancestors: ["CLE-VISION"]
area: null
content_hash: "b3f34ecd644ab4bf6e9606479d64d3aa66cfa36f98428585d5ba80a35c2c83cc"
read_as: "approved_fallback"
task: "CLE-T-V22XN8"
source_paths: []
mirror_sha256: "fc7ece6036d8feaf2d0a44bb6f1fda7af497fc832a9e9569be83014e75e6ee3a"
etag: "sha256-5769d4361cef9c4b53ae1f88c46422e5651ebe77a7fae5e1303c1af92f1a3026"
---
## 개요

이 문서는 Clemvion 스펙 문서 전체가 따르는 표준 용어 사전이다. 같은 개념을 모든 문서가 같은 말로 부르게 하는 것이 목적이다.

- **적용 범위**: NERV 에 올라가는 모든 스펙 문서(`CLE-*`)에 적용한다. 새 문서를 쓸 때와 옛 스펙 문서를 옮겨 쓸 때 모두 이 사전을 따른다.
- **두 가지 쓰임**: 사람이 읽는 기준이면서, 문서 작성 에이전트가 표기를 치환할 때 쓰는 기준이다. 치환용 목록은 이 사전(이 문서와 [하위 문서](#문서))의 표에서 뽑는다. 용어 표는 하위 문서에만 있다. 이 문서만 읽으면 표기 원칙 · 약어 · 상태값 표기만 얻으므로, 용어를 찾을 때는 하위 문서를 함께 읽는다.
- **사용자 가이드 용어집과의 관계**: 화면에 보이는 용어는 사용자 가이드 용어집([사용자 가이드](CLE-UI/CLE-UI-GUIDE.md) 의 `/docs` 용어 사전)과 실제 화면 문구를 따른다. 둘이 다르면 화면 문구를 따르고, 그 차이는 [용어 사전 — 결정이 필요한 표기](CLE-GLOSSARY-OPEN.md)에 적는다.
- **이 문서가 정하지 않는 것**: 개념의 동작과 규칙은 각 표의 "기준 문서" 가 정한다. 이 사전은 이름과 한 줄 정의만 정한다.

관련 문서: [Clemvion 제품 개요](CLE-VISION.md) · [다국어와 화면 문구](CLE-UI/CLE-UI-I18N.md) · [사용자 가이드](CLE-UI/CLE-UI-GUIDE.md)

## 표기 원칙

문서를 쓰는 사람과 에이전트는 아래 규칙을 이 순서대로 적용한다.

1. **화면에 보이는 개념은 화면 문구를 따른다.** 메뉴명·화면 제목·버튼 라벨이 있는 개념은 한국어 화면 문구와 사용자 가이드 용어집의 표기를 쓴다. 예: 워크플로우, 연결선, 통합, 지식 저장소, 모델 설정, 실행 내역. 가이드 용어집과 화면 문구가 다르면 화면 문구를 쓴다. 화면 문구끼리 서로 다르면 이 사전의 표준을 쓴다.
2. **화면에 없는 내부 개념은 코드 식별자를 기준으로 한다.** 엔진·프로토콜·데이터 개념은 한국어 표기가 널리 쓰이면 한국어로, 그렇지 않으면 영문 그대로 쓴다. 억지로 번역하지 않는다. 예: park, rehydration, dry-run, fire-and-forget, Graph RAG.
3. **코드 식별자·API 필드·enum 값·에러 코드는 원문 그대로 백틱으로 적는다.** 이것들을 본문 용어로 쓰지 않는다. "`ModelConfig` 를 저장한다" 가 아니라 "모델 설정(`ModelConfig`)을 저장한다" 로 쓴다.
4. **처음 나올 때 병기한다.** 문서에서 한 용어가 처음 나올 때는 `한국어(English, code_id)` 형식으로 쓴다. 예: 지식 저장소(Knowledge Base, `KnowledgeBase`). 그다음부터는 한국어 표준 용어만 쓴다. 영문이 표준인 용어는 `영문(code_id)` 로 쓴다. 예: Graph RAG(`rag_mode=graph`).
5. **다의어는 구분 표기를 쓴다.** 한 단어가 여러 뜻이면 [용어 사전 — 다의어 구분](CLE-GLOSSARY-POLY.md) 표의 구분 표기를 쓴다. 예: "실행" 은 워크플로우 실행(`Execution`) 전용이고, 노드 한 번 실행은 "노드 실행(`NodeExecution`)" 이다. 구분 표기가 없으면 한정어를 붙인다. 예: "알림" 대신 "인앱 알림" 또는 "EIA 알림 웹훅".
6. **같은 뜻의 다른 말은 하나만 쓴다.** 각 표의 "쓰지 않는 표기" 열에 적힌 말은 본문에 쓰지 않는다. 인용문·화면 문구를 그대로 옮길 때만 예외로 두고, 그때는 따옴표로 감싼다.
7. **역할과 권한 하한은 한국어 역할명으로 쓴다.** "관리자 이상", "편집자 이상" 처럼 쓴다. `Admin+`, `editor+`, `@Roles('editor')` 는 표 셀이나 코드 설명에서만 쓴다.
8. **"에러" 와 "오류"를 나눈다.** 본문은 "에러" 를 쓴다(에러 코드, 에러 포트, 에러 처리 정책). 화면 문구를 인용할 때만 "오류" 를 쓴다. 상태 이름이 화면에서 "오류" 인 값(통합 상태 `error`)은 원칙 1 에 따라 "오류" 로 쓴다.
9. **띄어쓰기를 고정한다.** 자격 증명, 지식 저장소, 검색 불가, 입력 대기, 실행 내역, 버전 기록처럼 이 사전의 표기대로 띄어 쓴다.
10. **작업용 레이블을 본문 용어로 쓰지 않는다.** `PR4`, `C-1`, `B-2`, `P1`, 한 자리 `D4` 같은 계획 · 리뷰 레이블과 NERV 전환 계획의 결정 번호(D1~D12)는 뜻을 풀어 쓴다. 요구사항 ID(`EIA-AU-07` 등)는 요구사항 표에서만 쓴다. 다른 문서의 Rationale 항목 번호(`R-<n>`)나 문서 안 결정 레이블은 그 문서 링크와 항목 제목을 함께 적을 때만 쓴다. 예외는 [용어 사전 — 결정이 필요한 표기](CLE-GLOSSARY-OPEN.md) 의 항목 번호다. 영 채움 두 자리 번호(`D01` 부터)만 이 예외에 든다. 이 번호는 그 문서 링크나 「결정 항목」 이라는 말과 함께만 쓴다. D10~D12 는 전환 계획의 결정 번호와 글자가 같아서 이 조건으로 둘을 가른다. 본문에서는 항목 이름도 함께 쓴다(예: [용어 사전 — 결정이 필요한 표기](CLE-GLOSSARY-OPEN.md) 의 「editor 역할의 화면 라벨」 항목(D10)). 이름은 그 표의 문구를 줄여 써도 되고 찾을 때는 번호로 찾는다. 표 칸에서는 「결정 항목 D10」 처럼 번호만 써도 된다.
11. **문서는 NERV 링크로 가리킨다.** `CONVENTIONS`, `PRD 9`, 저장소 경로 같은 옛 이름 대신 문서 제목을 링크 텍스트로 쓴 NERV 링크를 쓴다. 예: `CONVENTIONS` 대신 [노드 출력 규약](CLE-NODE/CLE-NODE-OUTPUT.md).
12. **제품명과 외부 서비스명은 영문으로 쓴다.** Clemvion, Cafe24, MakeShop, Telegram, Slack, Discord. 한국어 서비스명(카페24, 메이크샵)은 화면 문구를 인용할 때만 쓴다.
13. **노드 이름은 문서 제목 표기를 따른다.** If/Else·Switch·Loop 처럼 영문 이름이 표준인 노드는 영문으로, 변수 선언·변수 수정·AI 에이전트·텍스트 분류기·정보 추출기·수동 트리거·워크플로우 호출 노드처럼 한국어가 표준인 노드는 한국어로 쓴다. 캔버스 표시 이름이 다르면 처음 나올 때 병기한다.
14. **이 사전의 정의 칸에 기준 문서의 수치를 적지 않는다.** 기본 수치 · 한도 · 보존 기간 · 횟수는 기준 문서에서 읽는다. 사전에 옮겨 적으면 기준 문서가 바뀔 때 뒤처지고 그것을 잡는 가드가 없다. 용어의 뜻을 이루는 숫자(2단계 인증, HTTP 상태 코드, TOTP 의 6자리 같은 표준 규격, 이름에 든 숫자)는 예외다. 숫자가 아닌 기본 동작(기본 켜짐 같은 것)은 정의에 둘 수 있다.

## 문서

용어 표는 영역별 하위 문서에 있다. 표는 `표준 용어 · 영문과 코드 식별자 · 정의 · 쓰지 않는 표기 · 기준 문서` 순서다. "쓰지 않는 표기" 에 괄호로 붙은 조건은 그 뜻일 때만 쓰지 않는다는 뜻이다.

- [용어 사전 — 제품과 작업 공간](CLE-GLOSSARY-WS.md) (`CLE-GLOSSARY-WS`)
- [용어 사전 — 워크플로우 작성](CLE-GLOSSARY-WF.md) (`CLE-GLOSSARY-WF`)
- [용어 사전 — 노드](CLE-GLOSSARY-NODE.md) (`CLE-GLOSSARY-NODE`)
- [용어 사전 — 실행](CLE-GLOSSARY-EXEC.md) (`CLE-GLOSSARY-EXEC`)
- [용어 사전 — 트리거](CLE-GLOSSARY-TRIG.md) (`CLE-GLOSSARY-TRIG`)
- [용어 사전 — 통합](CLE-GLOSSARY-INT.md) (`CLE-GLOSSARY-INT`)
- [용어 사전 — 외부 상호작용과 채널](CLE-GLOSSARY-IX.md) (`CLE-GLOSSARY-IX`)
- [용어 사전 — AI 와 지식 저장소](CLE-GLOSSARY-AI.md) (`CLE-GLOSSARY-AI`)
- [용어 사전 — 관측과 운영](CLE-GLOSSARY-OBS.md) (`CLE-GLOSSARY-OBS`)
- [용어 사전 — API 와 개발 규약](CLE-GLOSSARY-API.md) (`CLE-GLOSSARY-API`)

- [용어 사전 — 다의어 구분](CLE-GLOSSARY-POLY.md) (`CLE-GLOSSARY-POLY`): 여러 영역에 걸친 같은 말의 구분 표기
- [용어 사전 — 결정이 필요한 표기](CLE-GLOSSARY-OPEN.md) (`CLE-GLOSSARY-OPEN`): 표준을 아직 정하지 못한 표기

하위 문서의 개요에는 이 절을 가리키는 안내 한 줄과 그 문서에만 해당하는 주석만 둔다. 표의 열 순서와 표기 원칙은 이 문서가 정한다.

## 약어

약어는 처음 나올 때 풀어 쓴다. "쓰는 곳" 이 제한된 약어는 그 밖에서 쓰지 않는다.

| 약어 | 풀이 | 쓰는 곳 |
| --- | --- | --- |
| API | Application Programming Interface | 어디서나 |
| CDN | Content Delivery Network | 위젯 배포 주소를 설명할 때. 기본 배포에는 CDN 이 없다는 점을 함께 적는다. |
| CIDR | Classless Inter-Domain Routing | IP 화이트리스트 |
| CORS | Cross-Origin Resource Sharing | 임베드 허용 도메인, EIA |
| CPIK | MakeShop 외부 연동 섹션 이름 | MakeShop 섹션 이름으로만. 뜻풀이가 공식 문서에 없다. |
| DLQ | Dead-Letter Queue | 큐 복구 설명 |
| DTO | Data Transfer Object | API 규약·OpenAPI |
| e2e | end-to-end 테스트 | 개발 규약 |
| EIA | External Interaction API | 처음에 "External Interaction API(EIA)" 로 쓴 뒤 어디서나 |
| FK·PK | Foreign Key·Primary Key | 데이터 모델 |
| HMAC | Hash-based Message Authentication Code | 인증 설정, EIA 알림 웹훅, 설치 흐름 |
| i18n | internationalization(다국어) | 개발 규약. 본문에서는 "다국어" 로 쓴다. |
| IANA | Internet Assigned Numbers Authority(시간대 이름) | 시간대 |
| JWT | JSON Web Token | 액세스 토큰, 실행 단위 토큰 |
| KB | Knowledge Base | 표 셀, 코드 식별자(`kb_*`, `KbToolProvider`), 화면 문구 인용 안에서만. 본문은 "지식 저장소" 로 쓴다. |
| LLM | Large Language Model | 어디서나 |
| MCP | Model Context Protocol | 어디서나 |
| OTel | OpenTelemetry | 관측 |
| PAT | Personal Access Token | GitHub 통합 설명 |
| RAG | Retrieval-Augmented Generation | 어디서나 |
| RBAC | Role-Based Access Control | 권한 매트릭스 설명 |
| SDK | Software Development Kit | 웹채팅 SDK, EIA 클라이언트 SDK 처럼 한정어와 함께 |
| SPA | Single Page Application | 웹채팅 위젯 구조 |
| SSE | Server-Sent Events | 어디서나 |
| SSRF | Server-Side Request Forgery | 사설망 차단 설명 |
| TEI | Text-Embeddings-Inference | 리랭커 프로바이더 |
| TOTP | Time-based One-Time Password | 2단계 인증 |
| TTL | Time To Live | 보존·만료 기간 |
| UUID | Universally Unique Identifier | 식별자 설명 |
| WS | WebSocket | 표와 코드 설명에서만. 본문은 "WebSocket" 으로 쓴다. 문서 키의 `WS` 는 이 약어가 아니다(`CLE-ACCT-WS` · `CLE-GLOSSARY-WS` 는 워크스페이스, `CLE-API-WS` 는 WebSocket). |
| 2FA | Two-Factor Authentication | 표와 코드 설명에서만. 본문은 "2단계 인증" 으로 쓴다. |

쓰지 않는 약어: `IE`(정보 추출기), `WFI`(입력 대기), `SoT`(단일 기준), `BYO`(단독), `AgentMem`, `SysStatus`. 모두 풀어 쓴다.

## 상태값과 enum 표기

enum 값은 백틱으로 적는다. 화면에 보이는 라벨과 본문 표기는 아래 대응표대로 쓴다. 이 절에 있는 enum 은 이 절이 값 목록의 정본이다. 하위 문서의 용어 행은 그 값 목록을 되풀이하지 않고 이 절을 가리킨다. 값마다 동작이 다르면 그 동작 설명은 용어 행에 둘 수 있다. [용어 사전 — 다의어 구분](CLE-GLOSSARY-POLY.md) 은 뜻을 가르려고 값을 함께 적는다. 화면 라벨이 문서마다 다르게 적힌 경우는 [용어 사전 — 결정이 필요한 표기](CLE-GLOSSARY-OPEN.md)에 모았다.

### 실행 상태 (`Execution.status`)

| enum | 화면 라벨 | 본문 표기 | 비고 |
| --- | --- | --- | --- |
| `pending` | 대기 중 | 대기 중 | 실행 내역 필터에는 없다. |
| `running` | 실행 중 | 실행 중 | 없음 |
| `waiting_for_input` | 대기 | 입력 대기 | 화면 라벨이 "대기 중" 과 헷갈린다(결정 항목 D28). |
| `completed` | 완료 | 완료 | 통계 범례는 "성공" 이다(결정 항목 D31). |
| `failed` | 실패 | 실패 | 없음 |
| `cancelled` | 취소됨 | 취소됨 | 사용자 중지와 시스템 취소를 모두 포함한다. |

### 노드 실행 상태 (`NodeExecution.status`)

실행 상태 여섯 값에 `skipped` 가 더해진다.

| enum | 캔버스 표시 | 본문 표기 |
| --- | --- | --- |
| `pending` | 변화 없음 | 대기 중 |
| `running` | 실행 중(파란 테두리) | 실행 중 |
| `waiting_for_input` | 입력 대기 중 | 입력 대기 |
| `completed` | 성공(초록 체크) | 완료 |
| `failed` | 실패(빨간 테두리) | 실패 |
| `cancelled` | 없음 | 취소됨 |
| `skipped` | 건너뜀(회색) | 건너뜀 |

### 흐름 지시 상태 (`NodeHandlerOutput.status`)

| 값 | 본문 표기 | 뜻 |
| --- | --- | --- |
| 없음(`undefined`) | 일반 완료 | 다음 노드로 넘어간다. |
| `waiting_for_input` | 입력 대기 | 엔진이 park 한다. |
| `resumed` | 재개 출력 | 입력을 받은 직후 한 번 보이는 상태. |
| `ended` | 대화 종료 | 멀티턴 대화를 마친다. |
| `requires_integration` | 통합 필요 | 통합 서비스를 쓸 수 없을 때. |

### 에러 처리 정책 (`config.errorHandling.policy`)

| enum | 화면 라벨 | 본문 표기 |
| --- | --- | --- |
| `stop_workflow` | 워크플로우 중단 | 워크플로우 중단(기본) |
| `skip_node` | 노드 건너뛰기 | 노드 건너뛰기 |
| `use_default_output` | 기본 출력 사용 | 기본 출력 사용 |
| `retry` | 재시도 | 노드 재시도 |
| `route_to_error_port` | 에러 포트로 라우팅 | 에러 포트로 라우팅 |

항목 에러 정책(`config.errorPolicy`)은 ForEach·Map 이 `stop`·`skip`·`continue`, Parallel 이 `stop`·`continue`·`cancel-others-on-fail` 을 쓴다. 본문에는 값을 그대로 적는다.

### 트리거와 실행 출처

| 필드 | 값 | 화면 라벨 | 본문 표기 |
| --- | --- | --- | --- |
| `Trigger.type` | `webhook`, `schedule`, `manual` | 웹훅, 스케줄, 수동 | 웹훅 트리거, 스케줄 트리거, 수동 트리거 |
| `triggerSource`(실행 출처) | `subworkflow`, `manual`, `schedule`, `webhook`, `unknown` | 서브 워크플로우, 수동 실행, 스케줄, Webhook, — | 서브 워크플로우, 수동 실행, 스케줄, 웹훅, 알 수 없음 |
| `__triggerSource`(엔진 마커) | `manual`, `webhook`, `schedule` | 없음 | 진입 경로 마커 |
| `triggerType`(큐 우선순위) | `manual`, `webhook`, `schedule` | 없음 | 우선순위 입력 |
| `result.cancelledBy` | `user`, `system`, `timeout` | 없음 | 사용자, 시스템, 시간 초과 |

### 워크스페이스와 계정

| 필드 | 값 | 화면 라벨 | 본문 표기 |
| --- | --- | --- | --- |
| `Workspace.type` | `personal`, `team` | 개인 워크스페이스, 팀 워크스페이스 | 같음 |
| `WorkspaceMember.role` | `owner`, `admin`, `editor`, `viewer` | 소유자, 관리자, 멤버, 뷰어 | 소유자, 관리자, 편집자, 뷰어(`editor` 화면 라벨은 결정 항목 D10) |
| `LoginHistory.event` | `login_success`, `login_failed`, `totp_failed`, `webauthn_failed`, `logout`, `session_revoked`, `token_reuse_detected` | 로그인 성공, 로그인 실패, 2FA 실패, 없음, 로그아웃, 세션 강제 종료, 토큰 재사용 감지 | 화면 라벨과 같게 쓴다. `webauthn_failed` 는 "Passkey 인증 실패" 로 쓴다. |

### 통합

| 필드 | 값 | 화면 라벨 | 본문 표기 |
| --- | --- | --- | --- |
| `Integration.status` | `connected` | 연결됨(필터), Connected(목록 배지) | 연결됨 |
| 〃 | `expired` | 만료됨, Expired | 만료됨 |
| 〃 | `error` | 오류, Error | 오류 |
| 〃 | `pending_install` | Pending install(배지), 필터 없음 | 설치 대기 |
| 화면 필터 전용 | `expiring`, `attention` | 만료 임박, 주의 필요 | 만료 임박, 주의 필요 |
| `Integration.scope` | `personal`, `organization` | 개인, 조직 | 개인, 조직 |
| `status_reason`(오류) | `auth_failed`, `insufficient_scope`, `network`, `unknown_error` | 없음 | 값 그대로 |
| `status_reason`(만료) | `token_expired`, `install_timeout` | 없음 | 값 그대로 |
| `status_reason`(설치 대기) | `oauth_*` 콜백 실패 사유, `hmac_verification_failed` | 사유별 안내 문구 | 값 그대로 |
| 응답 전용 | `credentials_unreadable` | 없음 | DB 에 없는 응답 전용 값으로 밝혀 적는다. |

통합 목록 배지는 영문 라벨을 코드에 직접 적어 두었다. 대응표는 [용어 사전 — 결정이 필요한 표기](CLE-GLOSSARY-OPEN.md) 의 「통합 상태 배지는 영문 문구를 코드에 직접 적었다」 항목(D30)에 있다.

### 지식 저장소

| 필드 | 값 | 화면 라벨 | 본문 표기 |
| --- | --- | --- | --- |
| `Document.embedding_status`, `graph_extraction_status` | `pending` | 대기 중 | 대기 중 |
| 〃 | `processing` | 처리 중 | 처리 중 |
| 〃 | `completed` | 준비됨 | 준비됨(처리 완료) |
| 〃 | `error` | 재시도 중 | 재시도 중(일시 에러) |
| 〃 | `failed` | 실패 | 실패(최종) |
| `reembed_status`, `reextract_status` | `idle`, `in_progress` | 재임베딩 중(진행 중일 때만) | 대기, 진행 중 |
| `rag_mode` | `vector`, `graph` | Vector — 유사도 검색, Graph — entity·relation 그래프 검색 | Vector RAG, Graph RAG |
| `rerank_mode` | `off`, `cross_encoder`, `cross_encoder_llm` | 사용 안 함, Cross-encoder, Cross-encoder + LLM grading | 리랭킹 끔, Cross-encoder, Cross-encoder + LLM 그레이딩 |
| KB 도구 결과 | `not_searchable`, `search_failed`, `grounding: none` | 재임베딩 필요 · 검색 불가(검색 불가만) | 검색 불가, 검색 실패, 근거 없음 |

### AI 노드와 에이전트 메모리

| 필드 | 값 | 화면 라벨 | 본문 표기 |
| --- | --- | --- | --- |
| `mode` | `single_turn`, `multi_turn` | Single Turn, Multi Turn | 단일 턴, 멀티턴 |
| `memoryStrategy` | `manual`, `summary_buffer`, `persistent` | 없음 | 값 그대로(설명은 "수동·요약 버퍼·영속") |
| `ModelConfig.kind` | `chat`, `embedding`, `rerank` | Chat, Embedding, Rerank | 같음 |
| 에이전트 메모리 `kind` | `fact`, `preference`, `entity` | 사실, 선호, 엔티티 | 사실, 선호, 엔티티(메모리 종류) |
| 대기 표면 | `form`, `buttons`, `ai_conversation`, `ai_form_render` | 없음 | 값 그대로. 상태 조회 응답 · SSE 이벤트 · EIA 알림 웹훅의 `interactionType` 필드에 쓸 수 있는 값은 EIA 문서([EIA 수신 API와 SSE](CLE-IX/CLE-EIA-INBOUND.md) · [EIA 알림 웹훅](CLE-IX/CLE-EIA-NOTIFY.md))가 정한다. 경로마다 실제로 나가는 값은 [인터랙션 타입 레지스트리](CLE-IX/CLE-IX-TYPES.md#미결-사항) 에 있다. 채팅 채널은 네 값을 받는다. |
| 사용자 입력 기록 `type` | `form_submitted`, `button_click`, `button_continue`, `message_received` | 폼 제출, 버튼 클릭, 링크 이동, 없음 | 값 그대로 |
| 항목 출처 | `presentation_user`, `ai_user`, `ai_assistant`, `ai_tool`, `system`(+화면 `system_error`, `rag`) | 없음 | 값 그대로 |

### 관측

| 필드 | 값 | 화면 라벨 | 본문 표기 |
| --- | --- | --- | --- |
| 큐 건강도 `health` | `healthy`, `degraded`, `down` | 정상, 지연, 점검 필요(전체는 시스템 정상, 일부 지연, 점검 필요) | 정상, 지연, 점검 필요 |
| 헬스 체크 `status` | `healthy`, `unhealthy`(Redis 미설정 `unconfigured`) | 없음 | 정상, 비정상 |
| 발송·채널 건강도 | `unknown`, `healthy`, `degraded` | 확인 안 됨, 정상, 저하됨 | 확인 안 됨, 정상, 저하됨 |
| `Notification.channel` | `in_app`, `email`, `both` | 없음 | 인앱, 이메일, 둘 다 |
| `AlertRule.type` | `failure_rate`, `duration`, `llm_cost` | 실패율, 평균 실행 시간, LLM 비용 | 같음 |
| `AlertRule.channel` | `in_app`, `email` | 없음(화면 사전에 "이메일"·"웹훅" 문구가 있지만 쓰는 화면이 없다) | 인앱, 이메일 |

### 외부 상호작용과 채널

| 필드 | 값 | 화면 라벨 | 본문 표기 |
| --- | --- | --- | --- |
| `tokenStrategy` | `per_execution`, `per_trigger` | Per Execution, Per Trigger | 실행 단위, 트리거 단위 |
| 채널 `provider` | `telegram`, `slack`, `discord` | Telegram, Slack, Discord | 같음 |
| `uiMapping.formMode` | `auto`, `native_modal`, `multi_step` | 자동, 네이티브 모달, multi_step | 자동, 네이티브 모달, 다단계 질문 |
| `uiMapping.visualNode` | `auto`, `text`, `photo` | auto, text, photo | 값 그대로 |

### 카탈로그와 스펙 문서

| 필드 | 값 | 본문 표기 |
| --- | --- | --- |
| 카탈로그 상태 | `supported`, `planned`, `deprecated` | 지원, 지원 예정, 폐기 |
| 문서 상태(`doc_status`) | `draft`, `in_review`, `approved` | 값 그대로. NERV 문서의 승인 단계다. |
| 구현 상태(본문 머리 줄) | 구현됨, 부분 구현, 미구현 | 값 그대로. 문서가 약속한 기능이 코드에 있는지 적는다. |
| 옛 스펙 상태(`status`) | `backlog`, `spec-only`, `partial`, `implemented`, `archived` | 옛 스펙 트리 frontmatter 의 값이었다. 옛 트리는 전환 단계 5 에서 지웠다(git 이력). 새 문서에는 쓰지 않는다. 카탈로그 상태와 섞지 않는다. |

## Rationale

### 표준을 고른 순서

표준 표기는 아래 순서로 골랐다. 앞 단계에서 정해지면 뒤 단계는 보지 않는다.

1. **실제 화면 문구**(한국어 문구 사전, 코드에 직접 적힌 라벨 포함). 사용자가 보는 이름과 스펙 이름이 같아야 문서와 제품을 오가며 헷갈리지 않는다.
2. **사용자 가이드 용어집**. 화면 문구가 없거나, 화면 문구끼리 서로 다를 때 쓴다.
3. **NERV 문서 목록의 제목과 범위 설명**. 화면에도 가이드에도 없는 개념은 새 문서 제목의 표기를 따른다. 제목이 곧 링크 텍스트라 본문과 어긋나면 안 된다.
4. **코드 식별자**. 내부 개념은 식별자의 뜻을 살린 한국어를 쓰고, 한국어가 자리 잡지 않은 말은 영문을 그대로 쓴다.

화면 문구끼리 다른 경우가 적지 않았다. 연결선(어시스턴트)과 엣지(버전 비교), 오류 처리(절 이름)와 에러 포트로 라우팅(옵션), 자격 증명(통합)과 자격증명(재실행)이 그 예다. 이때는 1단계를 적용할 수 없어 2·3단계로 정했고, 화면에 남은 다른 표기는 [용어 사전 — 결정이 필요한 표기](CLE-GLOSSARY-OPEN.md)에 코드 수정 대상으로 적었다.

### 주요 선택의 이유

- **워크플로우**: 스펙은 두 표기가 85:48 파일로 섞여 있지만 사이드바·화면 대부분과 가이드 용어집이 "워크플로우" 다. GitHub Actions 를 가리킬 때만 "CI 워크플로우(GitHub Actions)" 로 한정해 표기로 뜻을 가르지 않고 한정어로 가른다.
- **실행 내역**: 가이드 용어집은 "실행 이력" 이지만 메뉴와 화면 제목이 "실행 내역" 이므로 화면을 따랐다. 가이드 용어집 쪽 수정은 사람이 정한다.
- **버전 기록**: 가이드 용어집은 "버전 히스토리" 인데 에디터 화면은 "버전 기록" 이다. 원칙대로 화면을 따랐고 NERV 문서 제목도 "버전 기록" 으로 맞췄다. 가이드 용어집과의 차이는 「버전 기록 · 버전 히스토리 · 버전 이력 표기」 결정 항목(D02)으로 넘겼다.
- **연결선**: 가이드 용어집이 "엣지" 를 금지어로 두고 NERV 문서 제목도 "연결선" 이다. 화면의 "엣지" 문구는 화면 쪽을 고칠 대상으로 봤다.
- **지식 저장소**: 메뉴명과 가이드 용어집이 같다. "컬렉션" 은 배열·고정 목록 응답·구현 전 문서 폴더와 겹쳐 치환 금지어로 둔다.
- **통합**: 메뉴명과 가이드 용어집이 같다. "여러 개를 하나로 합침" 뜻의 "통합" 은 검색과 기계 치환에서 Integration 과 부딪혀 "합침·단일화" 로 바꾼다.
- **에러**: 화면이 "오류" 와 "에러" 를 섞어 쓰므로 스펙과 NERV 문서 제목의 "에러" 를 본문 표준으로 뒀다. 노드 정책 이름을 가이드 용어집의 "에러 정책" 대신 "에러 처리 정책" 으로 둔 것은 컨테이너의 `config.errorPolicy`(항목 에러 정책)와 이름이 부딪히기 때문이다. 통합 상태 이름은 예외다(「정의 보정」 소절의 원칙 8 예외).
- **편집자**: 화면은 `editor` 역할을 "멤버" 로 보여 주지만, 같은 화면이 워크스페이스 소속자 전체도 "멤버" 로 부른다. "멤버 이상" 이 모호해지는 문제가 화면 우선 원칙보다 크다고 보고 "편집자" 를 임시 표준으로 뒀다.
- **계획 카드**: 화면 제목 "실행 계획" 은 "실행 = 워크플로우 실행" 이라는 다의어 규칙과 부딪힌다. 본문 모호성을 없애는 쪽을 택하고 화면 제목은 「계획 카드의 화면 제목」 결정 항목(D38)으로 넘겼다.
- **모델 프로바이더와 OAuth 제공자**: 화면이 모델 설정에는 "프로바이더", 통합 OAuth 에는 "제공자" 를 쓴다. 두 개념이 실제로 다르므로 각 화면 표기를 그대로 살려 한정어와 함께 쓴다.
- **영문으로 둔 용어**: park, rehydration, dry-run, fire-and-forget, Graph RAG, Entity, Relation, MCP, RAG, LLM 은 영문을 그대로 쓴다. 한국어 번역(재수화, 드라이런 등)은 한두 문서에만 있어 자리 잡지 않았다. Entity 는 데이터 모델의 "엔티티" 와 구분하려는 목적도 있다.
- **단일 기준**: 옛 스펙의 "단일 진실" 대신 NERV 문서 목록이 쓰는 "단일 기준" 을 따랐다.

### 한정어를 붙이는 방식을 택한 이유

다의어는 단어를 새로 만들기보다 한정어를 붙여 나눴다(예: 인앱 알림, EIA 알림 웹훅, 계정 재인증, 통합 재인증). 화면 문구를 바꾸지 않고도 본문의 뜻을 하나로 좁힐 수 있고, 사용자 가이드와 표기가 어긋나지 않는다. 한정어 없이 단어만 쓰면 되는 경우는 "쓰지 않는 표기" 에 "(단독)" 을 붙여 표시했다.

### 치환 목록과의 관계

치환할 표기는 이 사전 표의 "쓰지 않는 표기" 열에서 뽑는다. 문맥을 보지 않고 바꿔도 되는 것은 뜻이 하나인 표기뿐이다. 한 단어가 여러 뜻이면 [용어 사전 — 다의어 구분](CLE-GLOSSARY-POLY.md) 표를 보고 직접 고른다. 뽑아 둔 치환 목록 파일은 저장소에 없다(2026-10-03 확인). 처음 이 절은 그런 파일(`term_map.json`)이 있는 것처럼 적었다. 기계 치환은 단어 경계를 지켜야 한다. 예를 들어 "워크플로" 는 뒤에 "우" 가 붙지 않을 때만 바꾼다.

### 미러 반영 리뷰 뒤 고친 행 (2026-10-04)

- 「대기 표면」 행의 본문 표기: 2026-10-03 정의 보정 때 이 칸을 「EIA HTTP 응답과 알림은 `ai_form_render` 를 `ai_conversation` 에 합친 세 값만 내보낸다」 로 고쳤고 정의 보정 소절에는 적지 않았다. [인터랙션 타입 레지스트리](CLE-IX/CLE-IX-TYPES.md#미결-사항) 는 경로마다 다르다고 적고 이것을 미결 사항으로 둔다. 그래서 EIA 문서가 `interactionType` 필드로 적는 계약 값과 경로마다 실제로 나가는 값을 갈라 적었다. 실제 값은 그 미결 사항을 가리킨다. 사전 밖의 같은 서술(인터랙션 타입 레지스트리 · 웹채팅 구조 문서)은 따로 고친다(NERV Task `CLE-T-4H77EB`). 인터랙션 타입 레지스트리의 미결 사항이 정해지면 이 칸과 앵커를 함께 고친다.

### 정의 보정 (2026-10-03)

NERV Task `CLE-T-V22XN8` 가 정한 정의 보정을 반영했다. 하위 문서마다 고친 행은 그 문서의 같은 이름 소절에 있다.

- **원칙 14(정의에 수치를 적지 않는다)**: 정의 589행 가운데 87행에 숫자가 있었다. 기준 문서가 기본값이나 한도를 바꾸면 사전이 뒤처지는데 저장소에는 용어 사전을 읽는 가드가 없다(2026-10-03 실측). 그래서 수치는 기준 문서 링크에 맡기고 뜻을 이루는 숫자만 남긴다. 값 이름 없이 개수만 적은 분류(Cafe24 리소스 18개, 노드 카테고리 일곱 가지 같은 것)는 기준 문서가 값을 늘리면 낡아서 개수를 지웠다. 값 이름을 함께 적은 행의 개수는 값 이름이 정의의 일부라 두었다. 색인 표에 있는 enum 의 값 목록은 원칙 14 대신 「상태값과 enum 표기」 의 정본 규칙이 다룬다. 수치를 남기고 동기 가드를 만드는 안도 따졌다(이 작업을 설계하며 따졌다. 따로 제안된 이력은 없다). 가드에 기준 문서마다 수치를 찾는 규칙이 있어야 해서 택하지 않았다.
- **원칙 8 예외(통합 상태 `error` 는 「오류」)**: 「주요 선택의 이유」 의 「에러」 항목은 본문 표준을 「에러」 로 둔다. 다만 통합 상태 이름은 화면 라벨이 「오류」 라 원칙 1(화면 문구)이 먼저다. 결정 항목 D30(통합 상태 배지)이 정해지면 이 예외와 결정 항목 D09(에러 · 오류 이름)를 함께 고친다.
- **원칙 10(결정 항목 번호)**: 하위 문서의 「(결정 항목)」 이 어느 항목인지 알 수 없어 결정이 나면 문구로 검색해 짝을 맞춰야 했다. 그래서 번호를 붙인다. 번호 모양만으로는 다른 체계와 갈리지 않는다. NERV 전환 계획의 결정 D10~D12 는 결정 항목 D10~D12 와 글자가 같다. 그래서 결정 항목 번호는 OPEN 링크나 「결정 항목」 이라는 말과 함께만 쓰게 했다. 영 채움 두 자리만 허용해 한 자리 `D4` 같은 문서 안 결정 레이블과도 모양을 가른다. 다른 문서의 `R-<n>` 항목 번호는 막지 않는다. 여러 스펙이 이미 그 번호로 서로의 Rationale 을 가리키므로 문서 링크와 항목 제목을 함께 적게 했다.
- **상태값의 정본**: 상태값 표와 하위 문서가 같은 값 목록을 두 곳에 적었다. 화면 라벨 · 본문 표기까지 함께 적는 이 문서의 「상태값과 enum 표기」 를 정본으로 두고 하위 문서 행은 그 절을 가리킨다.
- **「문서」 절**: 하위 문서 키를 함께 적었다. INT · IX 와 워크스페이스 WS 처럼 제목만으로 키를 떠올리기 어려웠다. 하위 문서 열 곳에 복사돼 있던 열 순서 안내는 이 절 하나로 모았다.

### 검토한 다른 선택

- **스펙 문서에서 가장 많이 쓴 표기를 표준으로 삼기**: 빈도만 보면 "엣지", "실행 이력", "Knowledge Base" 가 앞선다. 하지만 사용자는 화면과 가이드를 보므로 문서 빈도보다 화면 표기를 앞에 뒀다.
- **외래어를 모두 영문으로 두기**: 문서 작성은 쉬워지지만 가이드 용어집이 이미 "연결선", "지식 저장소", "표현식" 같은 한국어 표기를 정했으므로 따르지 않았다.

### 문서를 영역별로 나눈 이유 (2026-10-02)

이 사전은 처음에 한 문서였다. 2026-10-02 에 리뷰 용어를 고친 초안이 195,408 바이트 · 표 행 1,035개가 되어 NERV 초안 저장 한 번에 담기지 않았고, 그 작은 수정도 저장하지 못했다. 그래서 `## 용어` 의 영역 절 10개와 「다의어 구분」 · 「결정이 필요한 표기」를 하위 문서로 옮겼다. 표기 원칙 · 약어 · 상태값 표기는 모든 문서에 걸치는 규칙이라 이 문서에 남겼다.

- 「다의어 구분」은 영역별로 쪼개지 않았다. 여러 영역에 걸친 같은 말을 한 표에서 가르는 것이 그 표의 목적이다.
- 한 용어는 한 문서에만 정의한다. 나누기 전에도 영역 절끼리 같은 표준 용어가 겹치지 않았다.
- 옮기면서 정의는 바꾸지 않았다. 예외는 리뷰 용어다. 「리뷰 산출물 인용」 · 「세션」(리뷰 세션) 행을 고치고 「리뷰 라운드」 · 「리뷰 발견」 · 「처분」 행을 더한 것은 아래 「리뷰 용어를 NERV 레코드 기준으로 고친 이유」 의 수정이고, 저장하지 못한 그 초안에 담겨 함께 옮겨졌다. 분할한 초안의 일관성 검토에서 고친 행은 각 하위 문서의 Rationale 에 적었다.
- 하위 문서는 이 문서처럼 `convention` 타입이고 부모는 이 문서다. 이 문서가 영역(`area`) 밖에 있어 하위 문서도 영역이 없다. 그래서 미러에서는 `spec/CLE-GLOSSARY-*.md` 로 `spec/` 바로 아래에 놓인다.
- 하위 문서 제목은 `용어 사전 — <영역 이름>` 이다. 영역 이름만 쓰면 노드 · 실행 · 트리거 · 통합 · 워크플로우 작성 · 관측과 운영이 영역 문서 제목과 글자까지 같아진다. 링크 텍스트도 이 제목을 그대로 쓴다(표기 원칙 11).
- `CLE-GLOSSARY-WS` 의 `WS` 는 워크스페이스다. 약어 표의 `WS`(WebSocket)와 뜻이 다르다는 것은 문서를 만든 뒤 검토에서 알았다. 키는 만든 뒤 바꿀 수 없어 그대로 두고 약어 표에 적었다.
- 다른 문서의 머리 줄은 이 문서를 가리킨다. 이 문서가 색인으로 남으므로 그 링크는 고치지 않았다. 본문에서 특정 결정이나 정의를 가리키는 문장은 하위 문서로 링크를 옮겨야 한다. 지금 옮기면 아직 승인되지 않은 문서를 가리키게 되므로 분할이 승인된 뒤 NERV Task `CLE-T-52JYHM` 에서 고친다. 이 사전을 한 문서로 소개하는 [Clemvion 제품 개요](CLE-VISION.md) 문구와 기획자 안내도 같은 Task 가 맞춘다.

### 리뷰 용어를 NERV 레코드 기준으로 고친 이유 (2026-10-01)

이 사전은 처음에 "리뷰 세션" 을 커밋되는 리뷰 산출물 디렉터리(`review/<종류>/<날짜>/<시각>/`)로 정의했다. 전환 단계 2 부터 리뷰 결과는 NERV 리뷰 레코드(라운드 · 발견 · 처분)이고 로컬 산출물 `.review/**` 는 커밋하지 않는다. 옛 `review/` 는 단계 3 에서 작업 트리에서 지웠다. 그래서 "리뷰 세션" 은 로컬 디렉터리로 좁히고([용어 사전 — 다의어 구분](CLE-GLOSSARY-POLY.md)), NERV 쪽 단위에는 라운드 · 발견 · 처분이라는 이름을 따로 두었다([용어 사전 — API 와 개발 규약](CLE-GLOSSARY-API.md)). 둘을 같은 말로 부르면 "세션을 다시 제출한다" 같은 문장이 로컬 디렉터리인지 NERV 라운드인지 갈리지 않는다. 단계 2 일관성 검토가 이 정의를 낡은 것으로 지적했다(finding 01a0f6c1-82f0-77f7-b1a6-250f05f555d8).
