---
id: "CLE-WEBCHAT"
title: "웹채팅"
type: "area"
version: 1
status: "draft"
requirements: []
basis_superseded: false
parent: "CLE-IX"
ancestors: ["CLE-VISION", "CLE-IX"]
area: "CLE-IX"
content_hash: "580860e6dba720f06ee8bbb9dc532b33a56c0223da358497cf5c24a5786baf1f"
read_as: "approved"
task: null
source_paths: ["spec/7-channel-web-chat/_product-overview.md"]
mirror_sha256: "2c9814a9d1ba50c45fedcb9acd31f30d55c3febde4bde0d7c3431f06d67dd239"
etag: "sha256-38b96e263422208dbb258d21d09f54339f35c08db358ed00622d8fb6bd489c29"
---
> 구현 상태: 구현됨 · 원문: `spec/7-channel-web-chat/_product-overview.md` · 용어: [용어 사전](../CLE-GLOSSARY.md)

## 개요

웹채팅(Web Chat, `channel-web-chat`) 영역은 고객 사이트에 넣는 임베드형 채팅 위젯과 그것을 움직이는 SDK, 샘플, 제품 안 운영 콘솔을 다룬다. 이 절은 영역이 푸는 문제를 적는다.

워크플로우를 웹훅 트리거와 [External Interaction API](../CLE-IX/CLE-EIA.md)(EIA)로 밖에 열면 외부 시스템이 워크플로우를 실행하고 실행 중 인터랙션(Form·버튼·멀티턴 AI)을 REST 와 SSE 로 주고받을 수 있다. 하지만 그 클라이언트 쪽 구현은 사용자가 직접 써야 한다. EIA 사용 시나리오 가운데 "외부 SaaS 가 내장 채팅 위젯 호스팅(인바운드 전용, SSE + REST)" 이 정확히 이 영역이 채우는 빈틈이다.

이 영역은 그 클라이언트 층을 공식으로 준다. 외부 웹사이트에 `<script>` 한 줄(또는 npm import)로 넣을 수 있는 임베드형 웹채팅 위젯, 그것을 움직이는 개발자용 SDK, 샘플 프로젝트다.

**위치 관계**: [채팅 채널](../CLE-CHAT/CLE-CHAT-CORE.md)이 EIA 의 서버 쪽 소비자(Telegram·Slack 어댑터, 서버 안 내부 호출)라면 이 위젯은 EIA 의 클라이언트 쪽 소비자다. 외부 브라우저에서 순수 HTTP(웹훅 + REST + SSE)로만 EIA 표면을 부르며 새 백엔드 트리거 유형이나 서버 안 우회·중간 계층을 추가하지 않는다. 웹채팅은 채팅 채널이 아니다.

관련 문서: [External Interaction API](../CLE-IX/CLE-EIA.md) · [EIA 수신 API와 SSE](../CLE-IX/CLE-EIA-INBOUND.md) · [웹훅](../CLE-TRIG/CLE-TRIG-WEBHOOK.md) · [채팅 채널](../CLE-CHAT/CLE-CHAT-CORE.md) · [대화 스레드](../CLE-IX/CLE-IX-THREAD.md)

## 목표와 비목표

### 목표 (v1)

- 외부 사이트에 iframe 으로 격리한 웹채팅 위젯을 넣는다. 호스트 CSS·JS 와 완전히 격리하고 보안 경계를 확보한다.
- 두 배포 표면을 준다. (a) CDN `<script>` 설치 스크립트와 스니펫 로더(비개발자·마케터용), (b) `@workflow/web-chat` npm(개발자용).
- 두 사용 모드([웹채팅 구조](CLE-WEBCHAT-ARCH.md))를 둔다. Hosted iframe 모드(주력)와 BYO-UI 모드(개발자가 EIA 를 부르는 클라이언트로 자체 UI 를 만들고 자기 도메인에서 서빙)다. 두 모드 모두 같은 EIA 표면과 실행 단위 토큰을 쓰고 차이는 렌더링 위치와 요청 Origin 이다. BYO-UI 클라이언트를 어느 패키지가 주는지는 정의가 갈린다([웹채팅 SDK 미결 사항](CLE-WEBCHAT-SDK.md#미결-사항)).
- 위젯은 `codebase/channel-web-chat/` 의 Next.js 앱이다. CSR 전용이며 SSR 과 서버 컴포넌트를 끈다.
- EIA 인터랙션을 모두 그린다. 멀티턴 AI(`submit_message`), 버튼(`click_button`), Form(`submit_form`), `ai_form_render`, 그리고 표시물(carousel·table·chart·template)을 말풍선 안에 그린다.
- SDK 를 쓰는 샘플 프로젝트를 준다.
- 위젯 고유 문구(widget chrome)를 영어로도 낸다(`BootConfig.locale` 활성, 결정 2026-07-12). 위젯이 소유한 UI 틀 문자열을 ko·en 으로 낸다. 명시한 `locale` → 브라우저 자동 감지 → `ko` 순서로 정하고 위젯 로컬 catalog(ko·en parity)를 쓴다. 위젯 고유 문구는 [다국어와 화면 문구](../CLE-UI/CLE-UI-I18N.md)의 적용 범위상 위젯 로컬 parity 대상이다. 메인 앱 dict 기구의 구체 형식은 적용하지 않고 문체 원칙은 적용한다. 운영자 콘텐츠와 AI 생성 본문은 대상이 아니다. 방식은 [웹채팅 위젯](CLE-WEBCHAT-WIDGET.md), `locale` 계약은 [웹채팅 SDK](CLE-WEBCHAT-SDK.md)가 정한다.

### 비목표 (v1 → 백로그)

- 표시 전용 Presentation 노드 표시물의 새로고침 복원. 영속 대화 스레드에는 AI 표시 도구(`render_*`)의 표시물만 저장되므로(`turn.presentations[]` 는 `source: 'ai_assistant'` 에만 있다) 노드 표시물은 라이브 대화에서만 보인다. 넓히려면 [대화 스레드](../CLE-IX/CLE-IX-THREAD.md)의 백엔드 항목 출처 다섯 값을 늘려야 해서 v2 에서 검토한다. 라이브 렌더와 AI 표시 도구 표시물 복원은 v1 범위다([웹채팅 위젯](CLE-WEBCHAT-WIDGET.md)).
- 파일 첨부와 이모지 선택기(Form 파일 업로드와 연동할 때).
- 음성·통화, 상담원 연결, 봇이 먼저 말을 거는 프로액티브 메시지.
- 워크스페이스 단위 테마·브랜딩 관리 콘솔(워크스페이스 외형 JSON 서빙·테마 라이브러리)은 백로그다. 다만 [웹채팅 운영 콘솔](CLE-WEBCHAT-CONSOLE.md)의 웹채팅 인스턴스 단위 외형 저장(트리거 `config.interaction.appearance`)은 v1 범위다(결정 2026-06-24). 경계는 [Rationale](#rationale)에 있다.
- 호스트가 주는 사용자 식별 키(사칭을 막는 서명 포함)는 나중에 한다. v1 은 익명만 지원한다.
- 사용자별 여러 대화 목록 노출. 사용자 식별과 사용자별 실행 목록 API 가 먼저 있어야 한다. 백로그다.
- React·Vue 프레임워크 래퍼. v1 은 프레임워크와 무관한 JS API 와 타입만 준다.
- 위젯 UI 다국어의 남은 비목표. (i) 운영자가 넣은 콘텐츠(`headerTitle`·`welcome`·`launcher.suggestions`·`disclaimer`)와 백엔드가 보낸 페이로드의 언어별 현지화, (ii) 위젯을 메인 앱 dict 체계(`frontend/src/lib/i18n/dict`)에 넣는 것, (iii) 위젯 안에서 엔드유저가 언어를 바꾸는 토글. 모두 백로그다.

## 사용 시나리오

| 시나리오 | 배포·모드 | 설명 |
|---|---|---|
| 마케터가 랜딩 페이지에 AI 상담 위젯을 붙인다 | 설치 스크립트(Hosted iframe) | `<script>` 와 `ClemvionChat('boot', {...})` 한 블록 |
| 개발자가 SPA 에 위젯을 넣고 사용자 식별 정보를 넘긴다 | npm(Hosted iframe) | `profile` 을 웹훅 페이로드로 넘긴다 |
| AI FAQ 봇 | 둘 다(Hosted iframe) | 런처 추천 질문 → 패널 → 멀티턴 AI |
| 개발자가 자체 UI 를 만들어 자기 도메인에서 서빙한다 | npm headless(BYO-UI) | EIA 클라이언트로 완전한 맞춤 UI. 호출 Origin 이 고객 도메인이라 워크스페이스 단위 CORS([웹채팅 보안](CLE-WEBCHAT-SECURITY.md)) |
| 데모·문서용 임베드 예제 | 샘플 | 위 표면을 보여 주는 정적 데모 |

## 제품 구성 요소

| # | 구성 요소 | 산출물 | 비고 |
|---|---|---|---|
| A | 웹채팅 위젯 | `codebase/channel-web-chat/`(Next.js CSR 전용) | iframe 안 채팅 UI. 정적 export → CDN. [웹채팅 위젯](CLE-WEBCHAT-WIDGET.md) |
| B | 웹채팅 SDK | `codebase/packages/web-chat-sdk/` → 스니펫 로더 + `@workflow/web-chat` npm | 호스트 페이지↔iframe 브리지와 공개 JS API. 위젯과 따로인 패키지다. EIA 호출에 EIA 클라이언트 SDK(`@workflow/sdk`)를 재사용하는지는 정의가 갈린다([웹채팅 SDK 미결 사항](CLE-WEBCHAT-SDK.md#미결-사항)). [웹채팅 SDK](CLE-WEBCHAT-SDK.md) |
| C | 샘플 | SDK 패키지의 `examples/` | 설치 스크립트와 npm 두 경로를 보여 준다 |
| D | 웹채팅 운영 콘솔 | `codebase/frontend/src/app/(main)/w/[slug]/web-chat/**`(사이드바 "웹채팅" 메뉴) | 제품 안에서 위젯을 소비하는 화면. 웹채팅 인스턴스 만들기·외형 빌더·설치 스크립트·라이브 미리보기. 위젯을 합치지 않고 로더 + iframe 으로 임베드한다. [웹채팅 운영 콘솔](CLE-WEBCHAT-CONSOLE.md) |

## 문서

- [웹채팅 구조](CLE-WEBCHAT-ARCH.md): 네 레이어 구조, iframe 격리, 위젯이 쓰는 EIA 표면 매핑, 서버 쪽 구성 요소, 동봉 배포와 버전 잠금, 사용 모드.
- [웹채팅 위젯](CLE-WEBCHAT-WIDGET.md): 런처·패널 화면, 위젯 대화 상태, 대화 종료·새 대화, SSE 재연결, 가시성·차단, 위젯 고유 문구 다국어.
- [웹채팅 SDK](CLE-WEBCHAT-SDK.md): 설치 스크립트와 스니펫 로더, npm 패키지, postMessage 프로토콜, 부팅 설정, 제어 인스턴스.
- [웹채팅 인증과 세션](CLE-WEBCHAT-SESSION.md): 공개 웹훅, 실행 단위 토큰, 세션 시퀀스, 첫 노드 보정, 재로드 복원, 유휴 실행 회수.
- [웹채팅 보안](CLE-WEBCHAT-SECURITY.md): CORS, 임베드 검증, 공개 웹훅 남용 방어, sanitize, iframe sandbox, 프라이버시.
- [웹채팅 운영 콘솔](CLE-WEBCHAT-CONSOLE.md): 웹채팅 인스턴스 관리, 외형 빌더, 설치 스크립트, 라이브 미리보기, 권한.

## Rationale

### 별도 제품 영역으로 나눈다 (서버 기술 명세에 흡수 기각)

클라이언트 SDK 와 위젯은 제품 표면이 서버 기술 명세와 분명히 달라 따로 최상위 영역으로 둔다. 서버 기술 명세에 넣으면 클라이언트 산출물(SDK·npm·iframe)과 서버 명세가 섞인다.

### 운영 콘솔의 외형 저장과 비목표의 경계 (결정 2026-06-24)

비목표가 겨냥한 것은 워크스페이스 단위 외형을 관리하는 별도 테마·브랜딩 콘솔(워크스페이스 외형 JSON 서빙·테마 라이브러리)이다. 운영 콘솔의 웹채팅 인스턴스 단위 외형 저장(웹채팅 = 트리거 단위, `config.interaction.appearance`, 새 엔티티 없이 기존 트리거 설정 재사용)은 2026-06-24 결정으로 v1 범위다. 운영자가 브라우저를 바꿔도 같은 미리보기와 설치 스크립트가 나오도록 localStorage 에만 두던 한계를 없앤다. 워크스페이스 단위 테마 관리 콘솔은 여전히 백로그다. 예전 "저장하지 않음" 결정과의 관계는 [웹채팅 운영 콘솔](CLE-WEBCHAT-CONSOLE.md)에 있다.
