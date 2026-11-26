---
id: "CLE-GLOSSARY"
title: "용어 사전"
type: "convention"
version: 14
status: "approved"
requirements: []
basis_superseded: false
parent: "CLE-VISION"
ancestors: ["CLE-VISION"]
area: null
content_hash: "9b24464ec10a814e0bf0cf31b0c82bb28ee50ba78f0c101b4489c783149122bd"
read_as: "approved_fallback"
task: "CLE-T-F7PNB8"
source_paths: []
mirror_sha256: "487c769e361298d54ff8c696e462c7c7256fbcac82147dcb9a539b79849335c7"
etag: "sha256-9ed66601cd7934bde6a5563d4deb317a4bf62998cad589f31d7049cbe4a38821"
---
## 개요

이 문서는 Clemvion 스펙 문서 전체가 따르는 표준 용어 사전이다. 같은 개념을 모든 문서가 같은 말로 부르게 하는 것이 목적이다.

- **적용 범위**: NERV 에 올라가는 모든 스펙 문서(`CLE-*`)에 적용한다. 새 문서를 쓸 때와 옛 스펙 문서를 옮겨 쓸 때 모두 이 사전을 따른다.
- **두 가지 쓰임**: 사람이 읽는 기준이자 문서 작성 에이전트가 표기를 치환하는 기준이다. 용어 표는 [하위 문서](#문서)에만 있다.
- **사용자 가이드 용어집과의 관계**: 화면 용어는 [사용자 가이드](CLE-UI/CLE-UI-GUIDE.md) 의 용어집(`codebase/frontend/src/content/docs/_glossary.md`)과 화면 문구를 따른다(원칙 1). 차이는 [용어 사전 — 결정이 필요한 표기](CLE-GLOSSARY-OPEN.md)에 적는다.
- **이 문서가 정하지 않는 것**: 개념의 동작과 규칙은 각 표의 "기준 문서" 가 정한다. 이 사전은 이름과 한 줄 정의만 정한다.

관련 문서: [Clemvion 제품 개요](CLE-VISION.md) · [다국어와 화면 문구](CLE-UI/CLE-UI-I18N.md) · [사용자 가이드](CLE-UI/CLE-UI-GUIDE.md)

## 표기 원칙

문서를 쓰는 사람과 에이전트는 아래 규칙을 이 순서대로 적용한다.

1. **화면에 보이는 개념은 화면 문구를 따른다.** 메뉴명·화면 제목·버튼 라벨이 있는 개념은 한국어 화면 문구와 사용자 가이드 용어집의 표기를 쓴다. 예: 워크플로우, 연결선, 통합, 지식 저장소, 모델 설정, 실행 내역. 가이드 용어집과 화면 문구가 다르면 화면 문구를 쓴다. 화면 문구끼리 서로 다르면 이 사전의 표준을 쓴다. 이 원칙은 스펙 본문 표기에만 쓴다. 새 화면 문자열은 [다국어와 화면 문구](CLE-UI/CLE-UI-I18N.md) 규칙 7(가이드 용어집)을 따른다.
2. **화면에 없는 내부 개념은 코드 식별자를 기준으로 한다.** 엔진·프로토콜·데이터 개념은 한국어 표기가 널리 쓰이면 한국어로, 그렇지 않으면 영문 그대로 쓴다. 억지로 번역하지 않는다. 예: park, rehydration, dry-run, fire-and-forget, Graph RAG.
3. **코드 식별자·API 필드·enum 값·에러 코드는 원문 그대로 백틱으로 적는다.** 이것들을 본문 용어로 쓰지 않는다. "`ModelConfig` 를 저장한다" 가 아니라 "모델 설정(`ModelConfig`)을 저장한다" 로 쓴다. 이 사전 표에 용어로 등재된 이름(예: 원시 `config`)은 예외다.
4. **처음 나올 때 병기한다.** 문서에서 한 용어가 처음 나올 때는 `한국어(English, code_id)` 형식으로 쓴다. 예: 지식 저장소(Knowledge Base, `KnowledgeBase`). 그다음부터는 한국어 표준 용어만 쓴다. 영문이 표준인 용어는 `영문(code_id)` 로 쓴다. 예: Graph RAG(`rag_mode=graph`).
5. **다의어는 구분 표기를 쓴다.** 한 단어가 여러 뜻이면 [용어 사전 — 다의어 구분](CLE-GLOSSARY-POLY.md) 표의 구분 표기를 쓴다. 예: "실행" 은 워크플로우 실행(`Execution`) 전용이고, 노드 한 번 실행은 "노드 실행(`NodeExecution`)" 이다. 구분 표기가 없으면 한정어를 붙인다. 예: "알림" 대신 "인앱 알림" 또는 "EIA(External Interaction API) 알림 웹훅".
6. **같은 뜻의 다른 말은 하나만 쓴다.** 각 표의 "쓰지 않는 표기" 열에 적힌 말은 본문에 쓰지 않는다. 인용문·화면 문구를 그대로 옮길 때만 예외로 두고, 그때는 따옴표로 감싼다.
7. **역할과 권한 하한은 한국어 역할명으로 쓴다.** "관리자 이상", "편집자 이상" 처럼 쓴다. `Admin+`, `editor+`, `@Roles('editor')` 는 표 칸이나 코드 설명에서만 쓴다.
8. **"에러" 와 "오류"를 나눈다.** 본문은 "에러" 를 쓴다(에러 코드, 에러 포트, 에러 처리 정책). 화면 문구를 인용할 때만 "오류" 를 쓴다. 상태 이름이 화면에서 "오류" 인 값(통합 상태 `error`)은 원칙 1 에 따라 "오류" 로 쓴다.
9. **띄어쓰기를 고정한다.** 자격 증명, 지식 저장소, 검색 불가, 입력 대기, 실행 내역, 버전 기록처럼 이 사전의 표기대로 띄어 쓴다.
10. **작업용 레이블을 본문 용어로 쓰지 않는다.**
    - 쓰지 않는 것: `PR4`, `C-1`, `B-2`, `P1`, 한 자리 `D4` 같은 계획 · 리뷰 레이블과 NERV 전환 계획의 결정 번호(D1~D12). 뜻을 풀어 쓴다.
    - 쓸 수 있는 것: 요구사항 ID(`REQ-<접두>-<nnn>`)는 본문 어디서나 인용한다. 요구사항 줄이 아니면 줄 첫머리에 두지 않는다(요구사항 정의로 읽힌다). 같은 문서의 요구사항은 ID 만 쓴다. 다른 문서의 요구사항은 같은 문단에 그 문서 링크를 두기를 권장한다(앞에서 링크했으면 생략). 다른 문서의 Rationale 항목 번호(`R-<n>`)나 문서 안 결정 레이블은 그 문서 링크와 항목 제목을 함께 적을 때만 쓴다.
    - 결정 항목 번호: [용어 사전 — 결정이 필요한 표기](CLE-GLOSSARY-OPEN.md) 의 항목 번호(`D` 뒤에 두 자리 숫자, `D01` 부터)는 쓸 수 있다. 그 문서 링크나 「결정 항목」 이라는 말과 함께만 쓴다(Rationale 「정의 보정」).
    - 본문과 표 칸: 본문에서는 항목 이름도 함께 쓴다(예: [용어 사전 — 결정이 필요한 표기](CLE-GLOSSARY-OPEN.md) 의 「editor 역할의 화면 라벨」 항목(D10)). 이름은 그 표의 문구를 줄여 써도 되고 찾을 때는 번호로 찾는다. 표 칸에서는 「결정 항목 D10」 처럼 번호만 써도 된다.
11. **문서는 NERV 링크로 가리킨다.** `CONVENTIONS`, `PRD 9`, 저장소 경로 같은 옛 이름 대신 문서 제목을 링크 텍스트로 쓴 NERV 링크를 쓴다. 예: `CONVENTIONS` 대신 [노드 출력 규약](CLE-NODE/CLE-NODE-OUTPUT.md). 예외는 둘이다. 요구사항 줄 끝의 `(원본: …)` 은 옮겨 온 문서의 출처 표기라 옛 ID · 문서 이름을 그대로 둔다([Clemvion 제품 개요 「문서 종류」](CLE-VISION.md#문서-종류)). 문서를 고칠 때 지워도 된다. 머리 줄의 「원문:」 옛 저장소 경로는 미러 도구가 옛 경로로 키를 찾는 색인이라 지우지 않는다. 본문 · 미결 사항 · Rationale 의 옛 문서 이름은 예외가 아니다.
12. **제품명과 외부 서비스명은 영문으로 쓴다.** Clemvion, Cafe24, MakeShop, Telegram, Slack, Discord. 한국어 서비스명(카페24, 메이크샵)은 화면 문구를 인용할 때만 쓴다.
13. **노드 이름은 문서 제목 표기를 따른다.** If/Else·Switch·Loop 처럼 영문 이름이 표준인 노드는 영문으로, 변수 선언·변수 수정·AI 에이전트·텍스트 분류기·정보 추출기·수동 트리거·워크플로우 호출 노드처럼 한국어가 표준인 노드는 한국어로 쓴다. 캔버스 표시 이름이 다르면 처음 나올 때 병기한다.
14. **이 사전의 정의 칸에 기준 문서의 수치를 적지 않는다.** 기본 수치 · 한도 · 보존 기간 · 횟수는 기준 문서에서 읽는다. 용어의 뜻을 이루는 숫자(2단계 인증, HTTP 상태 코드, TOTP 의 6자리 같은 표준 규격, 이름에 든 숫자)와 코드 식 · 호출 예시 안의 숫자(PromQL `rate(…[5m])` 같은 것)는 예외다. 숫자가 아닌 기본 동작(기본 켜짐 같은 것)은 정의에 둘 수 있다.

## 문서

용어 표는 영역별 하위 문서에 있다. 표는 `표준 용어 · 영문 · 코드 식별자 · 정의 · 쓰지 않는 표기 · 기준 문서` 순서다. "쓰지 않는 표기" 에 괄호로 붙은 조건은 그 뜻일 때만 쓰지 않는다는 뜻이다.

- [용어 사전 — 제품과 워크스페이스](CLE-GLOSSARY-WS.md) (`CLE-GLOSSARY-WS`)
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

하위 문서의 개요에는 이 절을 가리키는 안내 한 줄과 그 문서에만 해당하는 주석만 둔다. 표의 열 순서와 표기 원칙은 이 문서가 정한다. 용어 사전 문서(색인과 하위 문서)에는 본문 머리 줄 `> 구현 상태:` 을 두지 않는다.

## 약어

약어는 처음 나올 때 풀어 쓴다. "쓰는 곳" 이 제한된 약어는 그 밖에서 쓰지 않는다. DB · HTTP · CI 같은 일반 기술 약어는 표에 없어도 된다.

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
| HMAC | Hash-based Message Authentication Code | 인증 설정, EIA 알림 웹훅, 설치 흐름, 채팅 채널 서명 검증(Slack) |
| i18n | internationalization(다국어) | 개발 규약. 본문에서는 "다국어" 로 쓴다. |
| IANA | Internet Assigned Numbers Authority(시간대 이름) | 시간대 |
| JWT | JSON Web Token | 액세스 토큰, 실행 단위 토큰 |
| KB | Knowledge Base | 표 칸, 코드 식별자(`kb_*`, `KbToolProvider`), 화면 문구 인용 안에서만. 본문은 "지식 저장소" 로 쓴다. |
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

enum 값은 백틱으로 적고 화면 라벨과 본문 표기는 아래 대응표대로 쓴다. 값 집합의 기준은 각 값을 정한 기준 문서이고 이 절은 화면 라벨과 본문 표기의 정본이다. 기준 문서는 실행 · 노드 실행 · 흐름 지시 상태가 [실행 상태 머신과 대기·재개](CLE-EXEC/CLE-EXEC-STATE.md), 에러 처리 정책이 [노드 에러 처리 정책](CLE-NODE/CLE-NODE-ERROR.md), 통합이 [통합 상태와 만료 알림](CLE-INT/CLE-INT-STATUS.md), 지식 저장소가 [문서 임베딩](CLE-KB/CLE-KB-EMBED.md), 관측이 [로깅과 헬스 체크](CLE-OBS/CLE-OBS-LOGGING.md)다. 하위 문서의 용어 행은 값 목록 대신 이 절을 가리킨다. 값마다 다른 동작은 용어 행에 둘 수 있고 [용어 사전 — 다의어 구분](CLE-GLOSSARY-POLY.md) 은 뜻을 가르려고 값을 함께 적는다. 화면 라벨이 문서마다 다르게 적힌 경우는 [용어 사전 — 결정이 필요한 표기](CLE-GLOSSARY-OPEN.md)에 모았다.

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
| `ended` | 대화 종료 | AI 노드가 멀티턴 대화나 단일 턴 실행을 마친다. |
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
| 같은 필드 | `expired` | 만료됨, Expired | 만료됨 |
| 같은 필드 | `error` | 오류, Error | 오류 |
| 같은 필드 | `pending_install` | Pending install(배지), 필터 없음 | 설치 대기 |
| 화면 필터 전용 | `expiring`, `attention` | 만료 임박, 주의 필요 | 만료 임박, 주의 필요 |
| `Integration.scope` | `personal`, `organization` | 개인, 조직 | 개인, 조직 |
| `status_reason`(오류) | `auth_failed`, `insufficient_scope`, `network`, `unknown_error` | 없음 | 값 그대로 |
| `status_reason`(만료) | `token_expired`, `install_timeout` | 없음 | 값 그대로 |
| `status_reason`(설치 대기) | `oauth_*` 콜백 실패 사유 | 사유별 안내 문구 | 값 그대로 |
| 응답 전용 | `credentials_unreadable` | 없음 | DB 에 없는 응답 전용 값으로 밝혀 적는다. |

통합 목록 배지는 영문 라벨을 코드에 직접 적어 두었다. 대응표는 [용어 사전 — 결정이 필요한 표기](CLE-GLOSSARY-OPEN.md) 의 「통합 상태 배지는 영문 문구를 코드에 직접 적었다」 항목(D30)에 있다.

### 지식 저장소

| 필드 | 값 | 화면 라벨 | 본문 표기 |
| --- | --- | --- | --- |
| `Document.embedding_status`, `graph_extraction_status` | `pending` | 대기 중 | 대기 중 |
| 같은 필드 | `processing` | 처리 중 | 처리 중 |
| 같은 필드 | `completed` | 준비됨 | 준비됨(처리 완료) |
| 같은 필드 | `error` | 재시도 중 | 재시도 중(일시 에러) |
| 같은 필드 | `failed` | 실패 | 실패(최종) |
| `reembed_status`, `reextract_status` | `idle`, `in_progress` | 재임베딩 중(진행 중일 때만) | 대기, 진행 중 |
| `rag_mode` | `vector`, `graph` | Vector — 유사도 검색, Graph — entity·relation 그래프 검색 | Vector RAG, Graph RAG |
| `rerank_mode` | `off`, `cross_encoder`, `cross_encoder_llm` | 사용 안 함, Cross-encoder, Cross-encoder + LLM grading | 리랭킹 끔, Cross-encoder, Cross-encoder + LLM 그레이딩 |
| KB 도구 결과 | `not_searchable`, `search_failed`, `grounding: none` | 재임베딩 필요 · 검색 불가(검색 불가만) | 검색 불가, 검색 실패, 근거 없음 |

### AI 노드와 에이전트 메모리

| 필드 | 값 | 화면 라벨 | 본문 표기 |
| --- | --- | --- | --- |
| `mode` | `single_turn`, `multi_turn` | Single Turn, Multi Turn | 단일 턴, 멀티턴 |
| `memoryStrategy` | `manual`, `summary_buffer`, `persistent` | 없음 | 값 그대로(설명은 "수동·요약 버퍼·영속"). 노드마다 쓸 수 있는 값이 다르다([AI 노드 공통 — 대화 맥락 · 메모리 · 시스템 컨텍스트](CLE-NODE-AI/CLE-NODE-AI-COMMON-CONTEXT.md)) |
| `ModelConfig.kind` | `chat`, `embedding`, `rerank` | Chat, Embedding, Rerank | 같음 |
| 에이전트 메모리 `kind` | `fact`, `preference`, `entity` | 사실, 선호, 엔티티 | 사실, 선호, 엔티티(메모리 종류) |
| 대기 표면 | `form`, `buttons`, `ai_conversation`, `ai_form_render` | 없음 | 값 그대로. EIA 경로(상태 조회 · SSE · 알림 웹훅)의 `interactionType` 값과 경로별로 나가는 값은 [인터랙션 타입 레지스트리](CLE-IX/CLE-IX-TYPES.md) 가 적는다. |
| 사용자 입력 기록 `type` | `form_submitted`, `button_click`, `button_continue`, `message_received` | 폼 제출, 버튼 클릭, 링크 이동, 없음 | 값 그대로 |
| 항목 출처 | `presentation_user`, `ai_user`, `ai_assistant`, `ai_tool`, `system`(+화면 `system_error`, `rag`) | 없음 | 값 그대로 |

### 관측

| 필드 | 값 | 화면 라벨 | 본문 표기 |
| --- | --- | --- | --- |
| 큐 건강도 `health` | `healthy`, `degraded`, `down` | 정상, 지연, 점검 필요(전체는 시스템 정상, 일부 지연, 점검 필요) | 정상, 지연, 점검 필요 |
| 헬스 체크 `status` | `healthy`, `unhealthy`(구성 요소 `redis` 는 Redis 미설정이면 `unconfigured`) | 없음 | 정상, 비정상 |
| 발송 건강도 `notification_health` | `unknown`, `healthy`, `degraded` | 확인 안 됨, 정상, 저하됨 | 확인 안 됨, 정상, 저하됨 |
| 채널 건강도 `chat_channel_health` | `unknown`, `healthy`, `degraded` | 확인 안 됨, 정상, 저하됨 | 확인 안 됨, 정상, 저하됨 |
| `Notification.channel` | `in_app`, `email`, `both` | 없음 | 인앱, 이메일, 둘 다 |
| `AlertRule.type` | `failure_rate`, `duration`, `llm_cost` | 실패율, 평균 전체 경과, LLM 비용 | 같음 |
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
| 문서 상태(`doc_status`) | `draft`, `in_review`, `approved` | 값 그대로. NERV 문서의 승인 단계다. 미러 frontmatter 의 `status` 가 이 값이다. |
| 구현 상태(본문 머리 줄) | 구현됨, 부분 구현, 미구현 | 값 그대로. 문서가 약속한 기능이 코드에 있는지 적는다. |
| 옛 스펙 상태(`status`) | `backlog`, `spec-only`, `partial`, `implemented`, `archived` | 옛 스펙 트리 frontmatter 의 값이었다(옛 트리는 지웠다). 새 문서에는 쓰지 않는다. 카탈로그 상태와 섞지 않는다. |

## Rationale

### 표준을 고른 순서

앞 단계에서 정해지면 뒤 단계는 보지 않는다.

1. **실제 화면 문구**(한국어 문구 사전, 코드에 직접 적힌 라벨 포함). 사용자가 보는 이름과 스펙 이름이 같아야 문서와 제품을 오가며 헷갈리지 않는다.
2. **사용자 가이드 용어집**. 화면 문구가 없거나, 화면 문구끼리 서로 다를 때 쓴다.
3. **NERV 문서 목록의 제목과 범위 설명**. 화면에도 가이드에도 없는 개념은 새 문서 제목의 표기를 따른다. 제목이 곧 링크 텍스트라 본문과 어긋나면 안 된다.
4. **코드 식별자**. 내부 개념은 식별자의 뜻을 살린 한국어를 쓰고, 한국어가 자리 잡지 않은 말은 영문을 그대로 쓴다.

화면 문구끼리 다른 경우(연결선과 엣지, 자격 증명과 자격증명 등)는 1단계를 적용할 수 없어 2·3단계로 정했다.

- 기각한 대안: 스펙 문서에서 가장 많이 쓴 표기를 표준으로 삼는 안. 빈도로는 "엣지", "실행 이력", "Knowledge Base" 가 앞서지만 사용자는 화면과 가이드를 본다.
- 기각한 대안: 외래어를 모두 영문으로 두는 안. 가이드 용어집이 이미 한국어 표기("연결선", "지식 저장소", "표현식")를 정했다.

### 주요 선택의 이유

- **워크플로우**: 스펙은 두 표기가 섞여 있지만 사이드바·화면 대부분과 가이드 용어집이 "워크플로우" 다. GitHub Actions 는 표기 대신 한정어를 붙여 "CI 워크플로우(GitHub Actions)" 로 가른다.
- **실행 내역**: 가이드 용어집은 "실행 이력" 이지만 메뉴와 화면 제목을 따랐다. 용어집 수정은 사람이 정한다.
- **버전 기록**: 가이드 용어집은 "버전 히스토리" 지만 에디터 화면을 따랐고 NERV 문서 제목도 맞췄다. 그 차이는 「버전 기록 · 버전 히스토리 · 버전 이력 표기」 결정 항목(D02)으로 넘겼다.
- **연결선**: 가이드 용어집이 "엣지" 를 금지어로 두고 NERV 문서 제목도 "연결선" 이다. 화면의 "엣지" 문구는 화면 쪽을 고칠 대상으로 봤다.
- **지식 저장소**: 메뉴명과 가이드 용어집이 같다. "컬렉션" 은 배열·고정 목록 응답·구현 전 문서 폴더와 겹쳐 치환 금지어로 둔다.
- **통합**: 메뉴명과 가이드 용어집이 같다. "여러 개를 하나로 합침" 뜻의 "통합" 은 검색과 기계 치환에서 Integration 과 부딪혀 "합침·단일화" 로 바꾼다.
- **에러**: 화면이 "오류" 와 "에러" 를 섞어 쓰므로 스펙과 NERV 문서 제목의 "에러" 를 본문 표준으로 뒀다. 노드 정책 이름을 가이드 용어집의 "에러 정책" 대신 "에러 처리 정책" 으로 둔 것은 컨테이너의 `config.errorPolicy`(항목 에러 정책)와 이름이 부딪히기 때문이다.
- **편집자**: 화면은 `editor` 역할과 워크스페이스 소속자 전체를 모두 "멤버" 로 부른다. "멤버 이상" 이 모호해지는 문제가 더 크다고 보고 "편집자" 를 임시 표준으로 뒀다.
- **계획 카드**: 화면 제목 "실행 계획" 은 "실행 = 워크플로우 실행" 이라는 다의어 규칙과 부딪힌다. 본문 모호성을 없애는 쪽을 택하고 화면 제목은 「계획 카드의 화면 제목」 결정 항목(D38)으로 넘겼다.
- **모델 프로바이더와 OAuth 제공자**: 화면이 모델 설정에는 "프로바이더", 통합 OAuth 에는 "제공자" 를 쓴다. 두 개념이 달라 화면 표기를 살리고 한정어를 붙인다.
- **영문으로 둔 용어**: park, rehydration, dry-run, fire-and-forget, Graph RAG, Entity, Relation, MCP, RAG, LLM 은 영문을 그대로 쓴다. 재수화 · 드라이런 같은 번역은 한두 문서에만 있어 자리 잡지 않았다. Entity 는 데이터 모델의 "엔티티" 와도 구분한다.
- **단일 기준**: 옛 "단일 진실" 대신 NERV 문서 목록의 "단일 기준" 을 따랐다.

### 한정어와 치환 목록

다의어는 새 단어 대신 한정어를 붙여 나눴다(예: 인앱 알림, EIA 알림 웹훅, 계정 재인증, 통합 재인증). 화면 문구를 바꾸지 않고 본문의 뜻을 좁혀 사용자 가이드와 어긋나지 않는다. 한정어 없이 단어만 쓰면 되는 경우는 "쓰지 않는 표기" 에 "(단독)" 을 붙여 표시했다.

치환할 표기는 "쓰지 않는 표기" 열에서 뽑는다. 문맥 없이 바꿔도 되는 것은 뜻이 하나인 표기뿐이다. 여러 뜻이면 [용어 사전 — 다의어 구분](CLE-GLOSSARY-POLY.md) 표를 보고 직접 고른다. 기계 치환은 단어 경계를 지킨다(예: "워크플로" 는 뒤에 "우" 가 없을 때만 바꾼다).

### 정의 보정

결정일: 2026-10-03

NERV Task `CLE-T-V22XN8` 의 정의 보정이다. 하위 문서마다 고친 행은 그 문서의 같은 이름 소절에 있다.

- **원칙 14(정의에 수치를 적지 않는다)**: 기준 문서가 수치를 바꾸면 사전이 뒤처지는데 사전을 읽는 가드가 없어 수치는 기준 문서 링크에 맡긴다. 값 이름 없이 개수만 적은 분류는 값이 늘면 낡아서 개수를 지웠다. 값 이름을 함께 적은 행은 값 이름이 정의의 일부라 개수를 두었다. 색인 표에 있는 enum 의 값 목록은 원칙 14 대신 「상태값과 enum 표기」 의 정본 규칙이 다룬다. 수치를 남기고 동기 가드를 두는 안은 기준 문서마다 수치를 찾는 규칙이 필요해 택하지 않았다.
- **원칙 8 예외(통합 상태 `error` 는 「오류」)**: 통합 상태 이름은 화면 라벨이 「오류」 라 원칙 1(화면 문구)이 먼저다. 결정 항목 D30(통합 상태 배지)이 정해지면 이 예외와 결정 항목 D09(에러 · 오류 이름)를 함께 고친다.
- **원칙 10(결정 항목 번호)**: 하위 문서의 「(결정 항목)」 이 어느 항목인지 알 수 없어 번호를 붙였다. NERV 전환 계획의 결정 D10~D12 는 결정 항목 D10~D12 와 글자가 같아서 결정 항목 번호는 OPEN 링크나 「결정 항목」 이라는 말과 함께만 쓰게 했다. `D` 뒤 두 자리만 허용해 한 자리 `D4` 같은 문서 안 결정 레이블과도 모양을 가른다. 다른 문서의 `R-<n>` 은 여러 스펙이 이미 서로의 Rationale 을 가리키는 데 써서 막지 않고 문서 링크 · 항목 제목과 함께 쓰게 했다.
- **상태값의 정본**: 같은 값 목록이 두 곳에 있었다. 하위 문서 행은 「상태값과 enum 표기」 를 가리킨다.
- **「문서」 절**: 제목만으로 `INT` · `IX` · `WS` 같은 키를 떠올리기 어려워 키를 함께 적었다.

### 문서를 영역별로 나눈 이유

결정일: 2026-10-02

사전이 NERV 초안 한 번에 담기지 않을 만큼 커져서 `## 용어` 의 영역 절과 「다의어 구분」 · 「결정이 필요한 표기」를 하위 문서로 옮겼다. 표기 원칙 · 약어 · 상태값 표기는 모든 문서에 걸치는 규칙이라 이 문서에 남겼다.

- 「다의어 구분」은 여러 영역에 걸친 같은 말을 한 표에서 가르려고 쪼개지 않았다.
- 한 용어는 한 문서에만 정의한다. 하위 문서는 `convention` 타입이고 부모는 이 문서다.
- 하위 문서 제목은 `용어 사전 — <영역 이름>` 이다. 영역 이름만 쓰면 노드 · 실행 · 트리거 같은 영역 문서 제목과 글자까지 같아진다. 링크 텍스트도 이 제목을 그대로 쓴다(표기 원칙 11).
- `CLE-GLOSSARY-WS` 의 `WS` 는 워크스페이스다. 키는 만든 뒤 바꿀 수 없어 그대로 두고 약어 표에 적었다.
- 다른 문서의 머리 줄은 색인인 이 문서를 가리킨다. 특정 결정이나 정의를 가리키는 본문 링크는 하위 문서로 옮긴다.

### 표와 용어를 고친 기록

- **리뷰 용어 (2026-10-01)**: 리뷰 결과가 NERV 레코드가 됐다. "리뷰 세션" 은 로컬 디렉터리로 좁히고([용어 사전 — 다의어 구분](CLE-GLOSSARY-POLY.md)) NERV 쪽 단위에 라운드 · 발견 · 처분이라는 이름을 두었다([용어 사전 — API 와 개발 규약](CLE-GLOSSARY-API.md)).
- **건강도 행 (2026-10-05)**: 「발송·채널 건강도」 행을 「발송 건강도」 · 「채널 건강도」 로 나눴다. 이유는 [용어 사전 — 다의어 구분](CLE-GLOSSARY-POLY.md) Rationale 에 있다. 두 컬럼의 DB 타입을 합칠지는 정하지 않는다.
- **HMAC 행 (2026-11-12)**: 채팅 채널의 HMAC 은 [Slack 어댑터](CLE-CHAT/CLE-CHAT-SLACK.md) 인바운드 서명 검증뿐이다. Telegram · Discord 는 다른 방식으로 검증한다.
- **평균 전체 경과 (2026-11-14)**: `AlertRule.type` 의 `duration` 라벨만 「평균 실행 시간」 에서 바꿨다(값은 완료 실행의 `duration_ms` 평균 그대로). 이름은 [용어 사전 — 관측과 운영](CLE-GLOSSARY-OBS.md) 과 [통계](CLE-OBS/CLE-OBS-STATS.md) 를 따른다.

### 요구사항 ID 를 본문에서 인용할 수 있게 했다

결정일: 2026-11-15

옛 원칙 10 은 요구사항 ID 를 표에서만 쓰게 했지만 스펙 대부분이 본문에서 인용한다. 사람이 규칙을 관행에 맞추기로 정했다(NERV Task `CLE-T-MCYDVV` 질문 답 A, 개정 Task `CLE-T-NJ8ZSK`).

소유 문서 링크가 없는 인용은 대부분 여러 문서의 ID 를 모은 대응표라 링크를 권장으로 두었다.

- 주어 제한은 두지 않았다. ID 는 바뀌지 않고 검색된다.
- 기각한 대안: 옛 규칙대로 본문 인용을 걷어 내는 안(사람 결정이 기각).

### 요구사항 줄의 `(원본: …)` 을 원칙 11 의 예외로 적었다

결정일: 2026-11-15

`(원본: _layout §2.2)` 같은 출처 표기는 제품 개요가 정한 관행이고 요구사항 줄 천여 개에 있다. 예외가 없어 consistency 검토가 같은 지적을 되풀이할 수 있었다(NERV Task `CLE-T-B35647`).

- 기각한 대안: 옛 이름을 NERV 링크로 바꾸는 안. 옛 문서는 NERV 에 없다.

### 머리 줄의 「원문:」 옛 경로를 원칙 11 의 두 번째 예외로 적었다

결정일: 2026-11-20

- `pull.py` 가 이 경로를 미러 frontmatter `source_paths` 로 옮겨 옛 경로 → NERV 키 역색인을 만든다. 저장소 쓰기 가드와 `legacy-path-ratchet.test.ts` 가 이 색인으로 키를 안내한다. 지우면 그 문서가 색인에서 빠진다.
- 기각한 대안: 고칠 때마다 지우는 안, 한 번에 지우는 안(미러 164편). 둘 다 색인을 비우는데 대신할 곳이 없다. [Slack 어댑터](CLE-CHAT/CLE-CHAT-SLACK.md) · [Telegram 어댑터](CLE-CHAT/CLE-CHAT-TELEGRAM.md) 는 이 결정 전에 지웠고 되살리지 않았다.
- 예외가 아니라던 앞 기록을 NERV Task `CLE-T-649054` 가 뒤집었다. 노드 문서의 경로를 걷으려던 `CLE-T-ZK8D9Z` 는 이 결정으로 닫았다.

### 원칙 3 예외와 흐름 지시 상태 `ended`

결정일: 2026-11-19

- **원칙 3 예외**: 배경은 [용어 사전 — 트리거](CLE-GLOSSARY-TRIG.md) Rationale 에 있다(NERV Task `CLE-T-YQMP4N`).
- **`ended`**: 단일 턴 AI 노드도 이 값으로 끝나 정의를 넓혔다(NERV Task `CLE-T-TC36RK`). 내는 노드가 없는 `requires_playwright` 는 올리지 않았다(NERV 질문 `01a1f2b8-ae38-71bd-bd4b-f4e01e99337c` 답 A).
