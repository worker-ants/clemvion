---
id: "CLE-GLOSSARY-OPEN"
title: "용어 사전 — 결정이 필요한 표기"
type: "convention"
version: 1
status: "approved"
requirements: []
basis_superseded: false
parent: "CLE-GLOSSARY"
ancestors: ["CLE-VISION", "CLE-GLOSSARY"]
area: null
content_hash: "805021ff0c4d964296b20ef5e25431b94022715f549cc5434f69bd11e085613a"
read_as: "approved_fallback"
task: "CLE-T-SJAYNM"
source_paths: []
mirror_sha256: "2c614681f3e659b6c6a10f06179c4318b305c5c42238aa2168dc1100e8511961"
etag: "sha256-fa04cdcee94a2ad482123bd17d45c9100ed6351fecc405154e93e292f2e88af6"
---
## 개요

[용어 사전](CLE-GLOSSARY.md) 의 「결정이 필요한 표기」이다. 화면 문구 · 가이드 용어집 · 코드가 서로 다르거나 표준을 아직 정하지 못한 표기다. 정해지면 해당 영역 문서로 옮긴다.

## 결정이 필요한 표기

아래 항목은 표기가 갈려 있어 이 사전이 임시 표준을 정한 것이다. 각 항목의 근거 위치와 자세한 설명은 리뷰 발견으로 올린다. 심각도 `warning` 은 뜻이 달라 구현이 어긋날 수 있는 항목이고, `info` 는 표기만 갈린 항목이다. 사람이 결정하면 이 절과 해당 용어 행을 함께 고친다.

| 번호 | 항목 | 갈리는 표기 | 임시 표준 | 심각도 |
| --- | --- | --- | --- | --- |
| D01 | 실행 내역·실행 이력·실행 히스토리 표기가 갈린다 | 실행 내역 / 실행 이력 / 실행 히스토리 / 실행 기록 | 실행 내역(에디터 안 패널은 "실행 내역 패널") | info |
| D02 | 버전 기록·버전 히스토리·버전 이력 표기가 갈린다 | 버전 기록(화면·NERV 문서 제목) / 버전 히스토리(가이드 용어집) / 버전 이력(스펙) | 버전 기록 | info |
| D03 | 워크플로우와 워크플로 표기가 섞인다 | 워크플로우 / 워크플로 | 워크플로우 | info |
| D04 | 연결선과 엣지 표기가 갈린다 | 연결선 / 엣지 / 에지 / Edge | 연결선 | info |
| D05 | 지식 저장소를 컬렉션·지식 베이스로도 부른다 | 지식 저장소 / 지식 베이스 / 지식베이스 / 지식저장소 / Knowledge Base / KB / 컬렉션 | 지식 저장소(KB 는 표·식별자 안에서만) | info |
| D06 | "컬렉션(폴더)" 이 지식 저장소 안 문서 묶음 기능을 가리킨다 | 컬렉션 = 지식 저장소 자체 / 컬렉션 = 지식 저장소 안 문서 폴더 | 지식 저장소 자체는 "지식 저장소", 문서 묶음은 "문서 폴더"(구현 전) | warning |
| D07 | 통합과 연동이 섞이고, 통합이 "합침" 뜻으로도 쓰인다 | 통합(Integration) / 연동 / 통합(합침) | Integration 은 "통합", 합침 뜻은 "합침·단일화" | info |
| D08 | 인증 설정을 "통합 자격증명 vault" 로 부른다 | 인증 설정(웹훅 인바운드 인증) / 통합 자격 증명 | 인증 설정 | warning |
| D09 | 에러·오류와 에러 처리 정책 이름이 갈린다 | 오류 처리(화면) / 에러 정책(가이드 용어집) / 에러 처리 정책(스펙) / errorPolicy(컨테이너 정책) | 본문은 "에러", 노드 정책은 "에러 처리 정책", 컨테이너 정책은 "항목 에러 정책" | info |
| D10 | editor 역할의 화면 라벨이 "멤버" 다 | 편집자·Editor(스펙) / 멤버(화면 라벨) | 편집자(`editor`) | warning |
| D11 | 소유자 이양·소유권 이전·Owner 이양 표기가 갈린다 | Owner 이양(화면) / 소유권 이전(스펙) / 양도 | 소유자 이양 | info |
| D12 | 모델 설정과 LLM 설정, 프로바이더와 제공자가 섞인다 | 모델 설정 / LLM 설정 / LLM 프로바이더 설정 / Model Config · 프로바이더 / 제공자 | 모델 설정, 모델 프로바이더(모델), OAuth 제공자(통합) | info |
| D13 | "재인증" 이 세 가지 동작을 가리킨다 | 계정 재인증(비밀번호·TOTP) / 비밀번호 재확인(비밀번호만) / 통합 재인증(OAuth) / 재인가 | 계정 재인증, 비밀번호 재확인, 통합 재인증 | warning |
| D14 | "회전" 이 유예 규칙이 다른 여러 교체 동작을 가리킨다 | 토큰 회전 / 자격 증명 교체 / 시크릿 교체 / 봇 토큰 재발급 / 트리거 단위 토큰 재발급 / 제공자 토큰 교체 | 화면 문구에 맞춘 동작별 이름(교체·재발급), 리프레시 토큰만 "토큰 회전" | info |
| D15 | revoke-token 이 폐기가 아니라 재발급이다 | revoke(폐기) / 재발급 | 트리거 단위 토큰 재발급 | warning |
| D16 | "알림" 하나로 네 개념을 부른다 | 인앱 알림 / EIA 알림 웹훅 / 알림 규칙 / 알림 설정 / 알람 | 인앱 알림, EIA 알림 웹훅, 알림 규칙, 알림 설정 | info |
| D17 | 컨테이너의 범위가 문서마다 다르다 | Loop·ForEach·Map / + Parallel / + Background | 컨테이너는 Loop·ForEach·Map 세 노드. Parallel 은 "엔진 덮어쓰기 대상", Background 는 컨테이너가 아니다. | warning |
| D18 | 에러 포트가 고정 포트인지 정책 포트인지 문서마다 다르다 | 고정 에러 포트 / 에러 처리 정책으로 생기는 동적 에러 포트 | 고정 에러 포트, 동적 에러 포트 | warning |
| D19 | 설치 스크립트와 설치 스니펫 표기가 갈린다 | 설치 스크립트(화면) / 설치 스니펫·스니펫(스펙) | 설치 스크립트 | info |
| D20 | 새 대화를 다섯 이름으로 부른다 | 새 대화 / 새 세션 / resetSession / newChat / restart | 새 대화 | info |
| D21 | 웹채팅과 웹챗 표기가 섞인다 | 웹채팅 / 웹챗 / Web Chat / Channel Web Chat | 웹채팅 | info |
| D22 | 채팅 채널 화면 라벨이 영문이다 | Chat Channel(화면) / 채팅 채널(NERV 문서 제목) / 챗 채널 | 채팅 채널 | info |
| D23 | 자격 증명과 자격증명 띄어쓰기가 섞인다 | 자격 증명 / 자격증명 | 자격 증명 | info |
| D24 | scope 가 공개 범위와 권한 범위를 모두 가리켜 감사 문서가 잘못 설명한다 | 공개 범위(`Integration.scope`) / 권한 범위(`credentials.scopes`) | 공개 범위, 권한 범위 | warning |
| D25 | 서브 워크플로우 표기가 다섯 가지다 | 서브 워크플로우 / 하위 워크플로우 / 하위 워크플로 / sub-workflow / Sub-Workflow | 서브 워크플로우 | info |
| D26 | 노드 표시 이름과 문서 제목이 다르다 | Info Extractor / Information Extractor / IE · Variable / Variable Declaration · Set Variable / Variable Modification | 정보 추출기 노드, 변수 선언 노드, 변수 수정 노드(캔버스 표시 이름은 처음에 병기) | info |
| D27 | 멀티턴 표기가 네 가지다 | 멀티턴 / multi-turn / Multi-turn / Multi Turn / AI Multi Turn | 멀티턴(`multi_turn`) | info |
| D28 | "대기 중" 과 "대기" 라벨이 서로 다른 상태다 | 대기 중(`pending`) / 대기(`waiting_for_input`) / Waiting for Input(PRD) | 본문은 대기 중(`pending`), 입력 대기(`waiting_for_input`) | warning |
| D29 | 문서 임베딩 상태의 enum 과 화면 라벨 대응표가 없다 | pending·processing·completed·error·failed / Ready·Processing·Retrying·Failed / 대기·처리 중·완료·오류 | `pending`=대기 중, `processing`=처리 중, `completed`=준비됨, `error`=재시도 중, `failed`=실패 | warning |
| D30 | 통합 상태 배지는 영문 문구를 코드에 직접 적었다 | 연결됨·만료됨·오류(필터) / Connected·Expired·Error·Pending install(배지) | 연결됨, 만료됨, 오류, 설치 대기 | info |
| D31 | 실행 완료를 "완료" 와 "성공" 으로 섞어 보여 준다 | 완료 / 성공 | 완료(`completed`) | info |
| D32 | 시간대와 타임존 표기가 섞인다 | 시간대 / 타임존 / IANA 시간대 | 시간대 | info |
| D33 | 재임베딩과 재인덱싱·재색인이 섞인다 | 재임베딩 / 재인덱싱 / 재색인 | 재임베딩 | info |
| D34 | 리랭킹·리랭크·리랭커와 Graph RAG 의 rerank 가 섞인다 | 리랭킹(동작) / 리랭커(설정) / 리랭크 / Graph RAG 의 rerank(중심성 가중) | 리랭킹, 리랭커, 중심성 가중치 | info |
| D35 | Entity·엔티티가 세 개념을 가리킨다 | 데이터 모델 엔티티 / Graph RAG Entity / 에이전트 메모리 종류 entity(화면 "엔티티") | 엔티티(데이터 모델), Entity(Graph RAG), 메모리 종류 entity | info |
| D36 | 복구 코드와 백업 코드 문구가 함께 있다 | 복구 코드 / 백업 코드 | 복구 코드 | info |
| D37 | 사용자 가이드 표기가 네 가지이고 /docs 경로가 둘이다 | 사용자 가이드 / 유저 가이드 / 사용자 매뉴얼 / User Guide · /docs(가이드) / /docs(Swagger UI) | 사용자 가이드 | info |
| D38 | AI 어시스턴트 계획 카드의 화면 제목이 "실행 계획" 이다 | 실행 계획(화면) / 계획 카드 / Plan 카드 | 계획 카드 | info |
| D39 | AI PRD 가 AI 어시스턴트를 "AI 에이전트" 로 부른다 | AI 에이전트(노드) / AI 어시스턴트(에디터 기능) | AI 에이전트 노드, AI 어시스턴트 | info |
| D40 | 통합 자격 증명 암호화 키 이름이 문서마다 다르다 | ENCRYPTION_KEY / INTEGRATION_ENCRYPTION_KEY | 통합 암호화 키는 `INTEGRATION_ENCRYPTION_KEY`, 시크릿 저장소 키는 `ENCRYPTION_KEY` | warning |
| D41 | "자동 갱신" 이 서로 다른 두 판정을 가리킨다 | 자동 갱신 표시(`autoRefresh`, google 포함) / 갱신 가능 판정(`isRefreshCapable`, google 제외) | 자동 갱신 표시, 갱신 가능 통합 | warning |
| D42 | chat_channel_token_v2 가 옛 토큰인지 새 토큰인지 문서마다 다르다 | v2 = 옛 토큰 백업 / v2 = 새 토큰 | 값 설명은 CLE-CHAT-DATA 한 곳에서 정한다 | warning |
| D43 | 워크플로우 변수 루트 이름이 세 가지다 | `$var`(표현식) / `$vars`(Code 노드) / `$variables`(엔진 문서) | 표현식은 `$var`, Code 노드는 `$vars` | warning |
| D44 | 노드 출력 규약 문서를 "CONVENTIONS" 로 부른다 | CONVENTIONS / CONVENTIONS Principle N / 노드 Output 규약 | [노드 출력 규약](CLE-NODE/CLE-NODE-OUTPUT.md) 링크 | info |
| D45 | 엔드포인트 경로가 비밀인지 아닌지 문서마다 다르다 | 사실상 비밀 키(웹훅·트리거 목록) / 비밀 아님(웹채팅 SDK·운영 콘솔) | 용어는 "엔드포인트 경로" 하나로 쓰고 비밀성은 CLE-TRIG-WEBHOOK 이 정한다 | warning |
| D46 | 지식 저장소 임베딩 차원이 파생 캐시인지 실측값인지 다르다 | 모델 설정 dimension 의 파생 캐시 / 저장 청크의 실제 차원 | 모델 출력 차원(`ModelConfig.dimension`), 저장 청크 차원(`embedding_dimension`) | warning |
| D47 | 제거된 도구 영역을 현행 기능처럼 적은 문서가 있다 | 도구 영역(Tool Area) 제거됨 / 현행 기능 | 도구 영역(제거됨) | warning |
| D48 | 노드 메모를 저장하는 필드가 두 가지로 적혀 있다 | `Node.description`(데이터 모델 "메모/설명") / `config.notes`(설정 패널) | 노드 메모(`config.notes`) | warning |
| D49 | 외부 인터랙션과 외부 상호작용 표기가 갈린다 | 외부 인터랙션(화면) / 외부 상호작용(NERV 영역 제목·데이터 모델) | API 는 "External Interaction API(EIA)", 한국어 일반 표기는 "외부 인터랙션" | info |
| D50 | 파일 저장소 표기가 네 가지다 | 파일 저장소 / 객체 저장소 / Object Storage / S3·MinIO | 파일 저장소 | info |
| D51 | "관리자" 가 워크스페이스 역할과 운영자를 모두 가리킨다 | 관리자(`admin` 역할) / 운영자(제품 운영) / 관리 화면 | 관리자(역할), 운영자, 관리 화면 | info |
| D52 | 봉투(envelope)가 노드 출력과 여러 전송 형식을 함께 가리킨다 | 노드 출력 5필드 / 응답 봉투 / 에러 응답 봉투 / 이벤트 봉투 / Cafe24 요청 봉투 | 노드 출력에는 "봉투" 를 쓰지 않고, 나머지는 한정어를 붙인다 | info |
| D53 | 내부 MCP 브리지 표기가 세 가지다 | Internal MCP Bridge / Internal Bridge / MCP Bridge | 내부 MCP 브리지 | info |
| D54 | render_* 도구를 표현 도구·가상 도구로 부른다 | 표현 도구 / 가상 도구 / Presentation Tool Family | 표시 도구 | info |
| D55 | Cafe24·MakeShop 과 한국어 서비스명이 섞인다 | Cafe24 / 카페24 · MakeShop / Makeshop / 메이크샵 | Cafe24, MakeShop | info |
| D56 | Cafe24 리소스와 MakeShop 섹션을 카테고리로도 부른다 | 카테고리 / Resource / 섹션 | Cafe24 리소스, MakeShop 섹션 | info |
| D57 | "회수" 가 recall 과 reclaim 을 모두 뜻한다 | 메모리 회수(recall) / 후보 회수 / 토큰 회수 / 유휴 실행 회수 / 처리 중 문서 회수 | 메모리 회수, 후보 풀, 토큰 정리, 유휴 실행 회수, 처리 중 문서 회수 | info |
| D58 | 건강도(health) 값 집합이 표면마다 다르다 | healthy·degraded·down(큐) / healthy·unhealthy(헬스 체크) / unknown·healthy·degraded(발송·채널) | 큐 건강도, 헬스 체크, 발송 건강도, 채널 건강도 | info |
| D59 | 현재 워크스페이스를 활성 워크스페이스로도 부른다 | 현재 워크스페이스(화면) / 활성 워크스페이스 / 워크스페이스 컨텍스트 | 현재 워크스페이스 | info |
| D60 | 로그인 세션을 디바이스 세션으로도 부른다 | 로그인 세션(화면) / 디바이스 세션 / family | 로그인 세션 | info |
| D61 | 데이터 흐름 문서가 2단계 인증 전환을 "TOTP fallback" 으로 적는다 | WebAuthn 우선·TOTP fallback(data-flow) / TOTP 자동 전환 금지(1-auth) | Passkey·보안 키가 있으면 그 방식만 쓰고 TOTP 로 자동 전환하지 않는다 | warning |
| D62 | 단일 진실과 단일 기준 표기가 갈린다 | 단일 진실 / SoT / single source of truth / 단일 기준 | 단일 기준 | info |
| D63 | 없어진 Config 메뉴 이름이 남아 있다 | Config 서브메뉴 / 모델 설정 / 인증 | 모델 설정, 인증(인증 설정) | info |
| D64 | 트리거 호출 이력과 인증 설정 사용 내역이 같은 이름으로 적혀 있다 | 호출 이력(트리거) / 사용 내역(인증 설정, 화면) / 호출 이력(인증 설정, 스펙) | 트리거는 호출 이력, 인증 설정은 사용 내역 | info |
| D65 | 알림 닫기를 "모두 지우기" 로 보여 준다 | 닫기(dismiss, 숨김) / 모두 지우기(화면) | 알림 닫기 | info |
| D66 | 적립금과 포인트 번역이 서비스마다 다르다 | Cafe24 points = 적립금 / MakeShop point = 포인트(적립금과 다름) | Cafe24 points·MakeShop reserve 는 적립금, MakeShop point 는 포인트 | info |
| D67 | 상태 불일치 에러가 표면마다 코드가 다르다 | INVALID_EXECUTION_STATE(WebSocket) / INVALID_STATE(REST 422) / STATE_MISMATCH(EIA 409) | 상태 불일치 에러(코드는 표면별로 그대로) | info |

## Rationale

2026-10-02 까지 이 표는 [용어 사전](CLE-GLOSSARY.md) 한 문서의 「결정이 필요한 표기」 절이었다. 그 문서가 약 195KB 가 되어 NERV 초안 저장 한 번에 담기지 않아 영역별 문서로 나눴다. 정의는 옮기기만 했다. 표준을 고른 기준과 검토한 다른 선택은 [용어 사전](CLE-GLOSSARY.md) 의 Rationale 에 있다.
