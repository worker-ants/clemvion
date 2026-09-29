---
id: "CLE-WEBCHAT-CONSOLE"
title: "웹채팅 운영 콘솔"
type: "feature"
version: 1
status: "draft"
requirements: ["REQ-WCCON-001", "REQ-WCCON-002", "REQ-WCCON-003", "REQ-WCCON-004", "REQ-WCCON-005", "REQ-WCCON-006", "REQ-WCCON-007", "REQ-WCCON-008", "REQ-WCCON-009", "REQ-WCCON-010", "REQ-WCCON-011", "REQ-WCCON-012", "REQ-WCCON-013", "REQ-WCCON-014", "REQ-WCCON-015", "REQ-WCCON-016", "REQ-WCCON-017", "REQ-WCCON-018", "REQ-WCCON-019", "REQ-WCCON-020", "REQ-WCCON-021", "REQ-WCCON-022", "REQ-WCCON-023", "REQ-WCCON-024", "REQ-WCCON-025", "REQ-WCCON-026", "REQ-WCCON-027", "REQ-WCCON-028", "REQ-WCCON-029", "REQ-WCCON-030", "REQ-WCCON-031", "REQ-WCCON-032", "REQ-WCCON-033", "REQ-WCCON-034", "REQ-WCCON-035", "REQ-WCCON-036", "REQ-WCCON-037"]
basis_superseded: false
parent: "CLE-WEBCHAT"
ancestors: ["CLE-VISION", "CLE-IX", "CLE-WEBCHAT"]
area: "CLE-WEBCHAT"
content_hash: "ef40dfd7a0d806c55ea378e423b61400afdd7b346e92d67d7a5ddda5be5a94a1"
read_as: "approved"
task: null
source_paths: ["spec/2-navigation/_product-overview.md", "spec/7-channel-web-chat/5-admin-console.md"]
mirror_sha256: "4121e11cb63ac75fd4c6434b744c58ae42e13b485b32b4a40515c99bd6fd61c0"
etag: "sha256-b66f295596d24f5670ed9e18dad25c98d7d984f90e970b011d53931ec542fbac"
---
> 구현 상태: 구현됨 · 원문: `spec/7-channel-web-chat/5-admin-console.md`, `spec/2-navigation/_product-overview.md` (§3.14 NAV-WC-01..06) · 용어: [용어 사전](../CLE-GLOSSARY.md)

## 개요

웹채팅 운영 콘솔(admin console, `/web-chat`)은 운영자가 제품 안에서 웹채팅 위젯을 만들고 외형(appearance)을 정하고 자기 사이트에 붙일 설치 스크립트를 받고 라이브 미리보기(live preview)로 시연하는 화면이다. 위젯과 SDK 는 따로 있는 산출물이라 운영자가 위젯을 설치하고 시연할 제품 안 화면이 없었다. 이 콘솔이 그 빈틈을 채운다.

- 위젯 런타임은 따로 둔다. 콘솔은 위젯을 로더와 iframe 임베드로 소비할 뿐 관리 앱에 합치지 않는다([웹채팅 구조](CLE-WEBCHAT-ARCH.md)).
- 쉬운 추상화를 쓴다. 안쪽은 `webhook trigger + config.interaction.enabled` 위에 얹히지만 운영자에게는 "웹채팅 만들기 → 외형 설정 → 설치 스크립트 복사 → 미리보기" 흐름으로 보인다. `endpointPath` 와 웹훅 배관은 숨긴다.
- 사이드바의 "웹채팅" 메뉴(`/web-chat`, 스케줄 아래)로 들어간다. 메뉴 위치와 순서는 [레이아웃과 내비게이션](../CLE-UI/CLE-UI-LAYOUT.md)이 정한다.

설치 스크립트의 형태와 postMessage 프로토콜은 [웹채팅 SDK](CLE-WEBCHAT-SDK.md), 위젯 동작은 [웹채팅 위젯](CLE-WEBCHAT-WIDGET.md), CORS 와 임베드 검증은 [웹채팅 보안](CLE-WEBCHAT-SECURITY.md), 같은 트리거를 다루는 원래 화면은 [트리거 관리](../CLE-TRIG/CLE-TRIG-MANAGE.md)에 있다.

## 요구사항

- REQ-WCCON-001 WHEN 사용자가 워크스페이스에 들어가면 THE SYSTEM SHALL 사이드바의 스케줄 아래에 웹채팅 메뉴(`/web-chat`)를 표시한다. (원본: NAV-WC-01)
- REQ-WCCON-002 WHEN 웹채팅 화면을 열면 THE SYSTEM SHALL 인터랙션이 켜진 웹훅 트리거를 웹채팅 인스턴스 목록으로 보여 준다. (원본: NAV-WC-02)
- REQ-WCCON-003 WHEN 웹채팅 인스턴스 목록을 조회하면 THE SYSTEM SHALL `GET /api/triggers?type=webhook&interactionEnabled=true` 서버 필터를 쓴다.
- REQ-WCCON-004 WHEN 목록 응답을 받으면 THE SYSTEM SHALL 클라이언트에서도 `type==='webhook' && config.interaction?.enabled` 로 한 번 더 거른다.
- REQ-WCCON-005 WHEN 편집자 이상이 "웹채팅 만들기" 에서 워크플로우와 이름을 정하면 THE SYSTEM SHALL `crypto.randomUUID()` 로 `endpointPath` 를 만들고 `POST /api/triggers` 로 인터랙션이 켜진 웹훅 트리거를 만든다. (원본: NAV-WC-03)
- REQ-WCCON-006 WHEN 웹채팅 인스턴스를 만들면 THE SYSTEM SHALL 요청 본문 최상위 `interaction` 에 `{ enabled: true, tokenStrategy: 'per_execution' }` 를 싣는다.
- REQ-WCCON-007 WHEN 편집자 이상이 외형을 저장하면 THE SYSTEM SHALL `PATCH /api/triggers/:id` 로 트리거의 `config.interaction.appearance` 에 저장한다. (원본: NAV-WC-04)
- REQ-WCCON-008 WHEN 외형을 저장하면 THE SYSTEM SHALL `interaction` 에 `enabled` 와 `tokenStrategy` 를 함께 보내 보존한다.
- REQ-WCCON-009 WHILE 외형 편집이 저장되지 않은 동안 THE SYSTEM SHALL 편집 내용을 브라우저 localStorage 에 캐시한다.
- REQ-WCCON-010 WHEN 웹채팅 인스턴스를 불러오면 THE SYSTEM SHALL 서버 `appearance` → localStorage → 기본값 순서로 폼·미리보기·설치 스크립트를 채운다.
- REQ-WCCON-011 IF 외형이 저장되지 않은 채 페이지를 떠나거나 새로고침하면 THE SYSTEM SHALL `beforeunload` 경고를 띄운다.
- REQ-WCCON-012 WHEN 외형 값을 저장하거나 내보내면 THE SYSTEM SHALL 프런트(`sanitizeDraft`)와 서버(`WebChatAppearanceDto` 의 enum·hex·길이 검증) 양쪽에서 허용 목록으로 거른다.
- REQ-WCCON-013 WHEN 부팅 설정을 만들면 THE SYSTEM SHALL 추천 질문 하나의 필드를 `welcome.suggestions` 와 `launcher.suggestions` 에 똑같이 넣는다.
- REQ-WCCON-014 WHEN 사용자가 설치 스크립트의 복사를 누르면 THE SYSTEM SHALL 설치 스크립트를 클립보드에 복사한다. (원본: NAV-WC-05)
- REQ-WCCON-015 IF `NEXT_PUBLIC_WIDGET_CDN_BASE` 가 설정되지 않았으면 THE SYSTEM SHALL 배포 자신의 origin 의 동봉 경로(`/_widget/web-chat/v1/`)를 위젯 배포 주소로 쓴다. (원본: NAV-WC-05)
- REQ-WCCON-016 IF 동봉 위젯 번들이 없으면 THE SYSTEM SHALL 설치 스크립트와 미리보기 UI 를 비활성화하고 경고를 표시한다.
- REQ-WCCON-017 WHILE 동봉 위젯 번들이 없는 동안 THE SYSTEM SHALL 웹채팅 인스턴스 관리와 외형 폼은 계속 쓸 수 있게 한다.
- REQ-WCCON-018 WHEN 뷰어 이상이 웹채팅 인스턴스를 고르면 THE SYSTEM SHALL 동봉 위젯을 same-origin iframe 으로 띄워 대화까지 시연하는 라이브 미리보기를 보여 준다. (원본: NAV-WC-06)
- REQ-WCCON-019 WHEN 위젯이 `wc:resize` 를 보내면 THE SYSTEM SHALL 미리보기 높이를 320~640px 로 제한하고 너비는 미리보기 컨테이너의 100% 로 둔다.
- REQ-WCCON-020 WHEN 미리보기 iframe 이 `wc:ready` 를 보내면 THE SYSTEM SHALL `wc:boot` 로 외형 폼 값 전체를 보낸다.
- REQ-WCCON-021 WHEN 외형 폼만 바뀌면 THE SYSTEM SHALL iframe 을 다시 마운트하지 않고 `wc:boot` 를 다시 보낸다.
- REQ-WCCON-022 WHEN `endpointPath` 나 `locale` 이 바뀌면 THE SYSTEM SHALL iframe key 를 바꿔 다시 마운트한다.
- REQ-WCCON-023 WHEN 사용자가 미리보기의 "새 세션" 을 누르면 THE SYSTEM SHALL 위젯에 `wc:command resetSession` 을 보낸다.
- REQ-WCCON-024 WHILE 위젯이 ready 상태가 아닌 동안 THE SYSTEM SHALL "새 세션" 버튼을 비활성화한다.
- REQ-WCCON-025 WHEN 화면 너비가 `xl`(1280px) 이상이면 THE SYSTEM SHALL 외형 설정(왼쪽)과 sticky 라이브 미리보기(오른쪽)를 두 열로 놓는다.
- REQ-WCCON-026 WHEN 화면 너비가 `xl` 미만이면 THE SYSTEM SHALL 한 열로 세로로 쌓는다.
- REQ-WCCON-027 WHEN 편집자 이상이 이름을 바꾸면 THE SYSTEM SHALL `PATCH /api/triggers/:id { name }` 을 보낸다.
- REQ-WCCON-028 WHEN 편집자 이상이 활성 상태를 바꾸면 THE SYSTEM SHALL `PATCH /api/triggers/:id { isActive }` 를 보낸다.
- REQ-WCCON-029 WHEN 이름이나 활성 상태만 고치면 THE SYSTEM SHALL `interaction` 객체를 보내지 않아 `enabled`·`tokenStrategy`·`appearance` 를 바꾸지 않는다.
- REQ-WCCON-030 WHEN 이름·활성·외형 PATCH 가 성공하면 THE SYSTEM SHALL 그때만 캐시를 무효화한다.
- REQ-WCCON-031 WHEN 편집자 이상이 삭제를 누르면 THE SYSTEM SHALL 이름 입력 확인을 받은 뒤 `DELETE /api/triggers/:id` 를 보낸다.
- REQ-WCCON-032 WHEN 삭제가 끝나면 THE SYSTEM SHALL 운영 콘솔 캐시(`["web-chat-instances"]`)와 선택 상태를 정리하고 첫 웹채팅 인스턴스를 고른다.
- REQ-WCCON-033 WHEN 뷰어 이상이 호출 이력을 누르면 THE SYSTEM SHALL `GET /api/triggers/:id/history` 로 최근 호출과 실행을 보여 준다.
- REQ-WCCON-034 WHEN 목록 행을 그리면 THE SYSTEM SHALL 비활성 배지와 마지막 호출 시각(`lastTriggeredAt`)을 표시한다.
- REQ-WCCON-035 WHILE 외형이 한 번도 서버에 저장되지 않은 동안 THE SYSTEM SHALL 상세 위쪽에 다음 단계 안내를 표시한다.
- REQ-WCCON-036 IF 사용자가 편집자 미만이면 THE SYSTEM SHALL 웹채팅 인스턴스 생성·삭제·이름·활성·외형 편집을 허용하지 않는다.
- REQ-WCCON-037 WHEN 새 메뉴와 화면 문자열을 추가하면 THE SYSTEM SHALL ko 와 en dict 양쪽에 키를 추가한다.

## 화면 구조

| 영역 | 위치 | 들어가는 요소 | 동작 |
|---|---|---|---|
| 머리글 | 맨 위 | "웹채팅" 제목, [+ 웹채팅 만들기] | 만들기 마법사를 연다(편집자 이상) |
| 웹채팅 인스턴스 목록 | 왼쪽(폭 280px) | 이름, 연결 워크플로우, 비활성 배지, 마지막 호출 시각(예: "마지막 호출 2시간 전", "호출 없음") | 행을 고르면 오른쪽 상세가 바뀐다 |
| 상세 머리글 | 상세 위 | 이름, 활성 상태 배지, [호출 이력], `⋮` 관리 메뉴(이름 변경·활성 토글·삭제) | 호출 이력은 뷰어 이상, 관리 메뉴는 편집자 이상 |
| 온보딩 안내 | 상세 위(외형 저장 전만) | 다음 단계(외형 설정 → 저장 → 설치 스크립트 복사 → 설치) | 외형을 저장하면 사라진다 |
| 외형·콘텐츠 | 상세 왼쪽 열(`xl` 이상), 한 열에서는 위 | `primaryColor`, `position`, `headerTitle`, `welcome.text`, 추천 질문, `disclaimer`, `locale` | 편집하면 미리보기에 바로 반영되고 저장하면 서버에 남는다 |
| 설치 스크립트 | 왼쪽 열 외형 아래 | 로더 스크립트 + `ClemvionChat('boot', { … })` 스크립트, [복사] | 클립보드로 복사한다 |
| 라이브 미리보기 | 상세 오른쪽 열(`xl` 이상, sticky), 한 열에서는 아래 | 위젯 런처·패널(실제 부팅과 대화), "새 세션" 버튼 | 선택한 웹채팅 인스턴스로 대화까지 시연한다 |

## 웹채팅 인스턴스 모델

웹채팅 인스턴스(web chat instance) 하나는 `type=webhook` 이고 `config.interaction.enabled=true` 인 기존 트리거와 그 연결 워크플로우다. 새 백엔드 트리거 유형·테이블·엔드포인트·중간 계층을 추가하지 않는다. [웹채팅 구조](CLE-WEBCHAT-ARCH.md)의 클라이언트 소비자 원칙을 지킨다.

| 콘솔 동작 | 매핑(기존 API) | 비고 |
|---|---|---|
| 목록 | `GET /api/triggers?type=webhook&interactionEnabled=true`(서버 JSONB 필터, `query-trigger.dto.ts`) + 클라이언트 방어 필터 `type==='webhook' && config.interaction?.enabled` | 서버 필터로 페이지네이션을 정확하게 한다. 클라이언트 필터는 캐시 오염과 응답 변형을 막으려고 남긴다(다층) |
| 생성 | `POST /api/triggers` `{ type:'webhook', workflowId, name, endpointPath(클라이언트 UUID), interaction:{ enabled:true, tokenStrategy:'per_execution' } }` | `interaction` 은 요청 본문 최상위 필드이고 백엔드가 저장할 때 `config.interaction` 으로 합친다([External Interaction API](../CLE-IX/CLE-EIA.md)의 트리거 등록 페이로드, `interaction-config.dto.ts`) |
| 외형·콘텐츠 | 서버 저장(`config.interaction.appearance`) + 설치 스크립트·미리보기로 내보냄 | 기존 트리거 설정을 재사용한다. `PATCH /api/triggers/:id { interaction:{ enabled, tokenStrategy, appearance } }` |
| 설치 스크립트 | 클라이언트 템플릿 | `endpointPath` 는 트리거의 공개 웹훅 경로 |
| 라이브 미리보기 | 위젯 임베드(Hosted iframe 모드) | 위젯이 `POST /api/hooks/:endpointPath` 와 `/api/external/*` 를 부른다 |

> **트리거 화면과의 관계**: 웹채팅 인스턴스는 웹훅 트리거이므로 [트리거 관리](../CLE-TRIG/CLE-TRIG-MANAGE.md) 목록에도 나온다. 트리거 화면은 원래 트리거(인증·EIA 카드)를, 이 콘솔은 설치와 미리보기에 맞춘 쉬운 화면을 준다. 같은 자원의 두 표현이다. EIA 활성과 `tokenStrategy` 편집은 양쪽 모두 `ExternalInteractionCard` 와 `POST`·`PATCH /api/triggers` 한 경로를 쓴다.

### 웹채팅 인스턴스 관리

생성과 외형 편집 외에, 고른 웹채팅 인스턴스의 생애주기 관리(이름·활성 상태·삭제)와 호출 이력 조회를 콘솔 상세에서 바로 한다. 트리거 화면을 오가지 않고 콘솔 한 곳에서 끝낸다. 모두 기존 트리거 API 한 경로를 재사용한다(새 엔티티·엔드포인트 없음).

| 콘솔 동작 | 매핑(기존 API) | 권한 | 비고 |
|---|---|---|---|
| 이름 변경 | `PATCH /api/triggers/:id { name }`(트리거 단일 PATCH 경로) | 편집자 이상 | 부분 본문. 외형(`interaction`)과 `isActive` 를 싣지 않아 조용히 바뀌는 값이 없다 |
| 활성·비활성 토글 | `PATCH /api/triggers/:id { isActive }` | 편집자 이상 | 비활성 트리거는 웹훅 호출이 거부된다([웹훅](../CLE-TRIG/CLE-TRIG-WEBHOOK.md)). 목록과 상세에 비활성 배지 |
| 삭제 | `DELETE /api/triggers/:id` | 편집자 이상 | 이름 입력 확인 다이얼로그. 삭제하면 설치된 위젯이 동작을 멈춘다. 경로가 사라지지는 않는다. 삭제된 경로는 그 워크스페이스 소유로 영구 예약돼 다른 워크스페이스는 쓸 수 없고, 같은 워크스페이스가 같은 경로로 트리거를 다시 만들면 이미 설치된 위젯이 다시 동작할 수 있다([트리거 데이터와 흐름](../CLE-TRIG/CLE-TRIG-DATA.md)) |
| 호출 이력 | `GET /api/triggers/:id/history` | 뷰어 이상 | 최근 호출과 실행으로 이동. 조회 전용 |

- **UI 배치**: 상세 머리글 = 활성 상태 배지 + `[호출 이력]` 버튼(뷰어 이상) + 관리 `⋮` 메뉴(편집자 이상: 이름 변경·활성 토글·삭제).
- **목록 행 정보**: 행마다 비활성 배지와 마지막 호출 시각(`lastTriggeredAt` → `timeAgo`)을 보여 "지금 켜져 있는지, 최근에 불렸는지" 를 한눈에 알게 한다. `lastTriggeredAt` 은 `GET /api/triggers` 응답에 들어 있다.
- **컴포넌트 재사용**: 삭제와 호출 이력은 트리거 화면의 `TriggerDeleteDialog`·`TriggerHistoryDialog` 를 그대로 쓴다(같은 자원의 두 표현). 삭제 다이얼로그는 `onDeleted` 콜백으로 콘솔 전용 캐시(`["web-chat-instances"]`)와 선택 상태를 더 정리한다. 다이얼로그 자체는 `["triggers"]` 만 무효화한다. 부모는 선택을 첫 웹채팅 인스턴스로 되돌린다.
- **저장하지 않은 편집 보호**: 외형이 저장되지 않은(`isDirty`) 상태에서 페이지를 떠나거나 새로고침하면 `beforeunload` 경고로 한 번 막는다. localStorage 캐시와 함께 쓰는 다층 보호다.
- **온보딩**: 외형이 서버에 한 번도 저장되지 않은(갓 만든) 웹채팅 인스턴스는 상세 위에 다음 단계(외형 설정 → 저장 → 설치 스크립트 복사 → 설치) 안내를 보인다. 저장하면 `appearance` 가 채워져 저절로 사라진다. 따로 플래그를 두지 않고 상태에서 계산한다.
- **부분 PATCH**: 이름·활성 수정(`useUpdateWebChatMeta`)은 `name`·`isActive` 가운데 지정한 필드만 본문에 담는다(둘 다 보내도 된다). `interaction` 객체를 보내지 않으므로 `enabled`·`tokenStrategy`·`appearance` 는 바뀌지 않는다. PATCH 가 실패하면 서버는 그대로이므로 목록이 낡지 않아 `onError` 무효화가 필요 없다. `onSuccess` 에서만 캐시를 무효화하며 외형 저장도 같다.

## 웹채팅 인스턴스 만들기

"+ 웹채팅 만들기" 를 누르면 마법사가 열린다.

1. **워크플로우 선택**(필수). `Trigger.workflow_id` 가 NOT NULL 이기 때문이다([트리거 데이터와 흐름](../CLE-TRIG/CLE-TRIG-DATA.md)). 웹채팅은 이 워크플로우를 웹훅으로 실행한다.
2. **이름** 입력.
3. 콘솔이 `endpointPath` 를 `crypto.randomUUID()` 로 만들고 `POST /api/triggers` 로 웹훅 + 인터랙션 트리거를 만든다.

- **`endpointPath` 검증**: 콘솔은 새 검증을 두지 않고 기존 웹훅 트리거 생성 규칙([트리거 관리](../CLE-TRIG/CLE-TRIG-MANAGE.md))의 형식·유일성 제약을 그대로 따른다. 공개 웹훅 경로이므로 경로 주입과 중복 가로채기 방지는 그 규칙과 DB unique 가 맡는다. 콘솔은 클라이언트 UUID 를 낼 뿐이다. 경로는 전역에서 유일하다([트리거 데이터와 흐름](../CLE-TRIG/CLE-TRIG-DATA.md)). 콘솔의 트리거 생성도 같은 `TriggersService` 경로라 함께 보호된다.
- 권한: 만들기는 편집자 이상이다(`RoleGate minRole="editor"`, 트리거 생성 규칙과 같다).

## 외형 빌더

[웹채팅 SDK](CLE-WEBCHAT-SDK.md)의 부팅 설정 필드를 폼으로 편집한다. `appearance{primaryColor, position}`, `headerTitle`, `welcome{text, suggestions}`, `launcher{suggestions}`, `disclaimer`, `locale` 이다.

`locale` 은 위젯 UI 언어다. 저장·설치 스크립트·미리보기로 전달되며 운영자가 `en` 을 고르면 위젯 고유 문구가 영어로 나온다([웹채팅 위젯](CLE-WEBCHAT-WIDGET.md)). 위젯이 부팅 때 한 번 정하므로 `locale` 을 바꾸면 미리보기 iframe 을 다시 마운트해 반영한다. 번역 범위는 위젯 고유 문구뿐이며 운영자 콘텐츠(`headerTitle`·`welcome`·`disclaimer`)는 입력 언어 그대로다. 콘텐츠 현지화는 [웹채팅](CLE-WEBCHAT.md)의 비목표다.

- **서버에 저장한다.** "저장" 하면 트리거의 `config.interaction.appearance` 에 남긴다(`PATCH /api/triggers/:id`, `interaction-config.dto.ts` 의 `WebChatAppearanceDto`). 새 엔티티 없이 기존 트리거 설정을 재사용한다. `mergeExternalConfig` 가 `interaction` 키를 통째로 바꾸므로 PATCH 에 `enabled`·`tokenStrategy` 를 함께 보내 보존한다. 저장된 값은 웹채팅 인스턴스를 불러올 때 폼·미리보기·설치 스크립트에 채워진다. 브라우저나 운영자가 바뀌어도 같게 나온다.
- 저장하지 않은 편집은 운영자 편의를 위해 브라우저 localStorage 에 캐시한다. 저장 전 새로고침이나 이탈로 잃지 않게 한다. 불러올 때 우선순위는 서버 `appearance` → localStorage → 기본값이다.
- 서버에 저장한 값도 결국 공개 설치 스크립트 JSON 으로 나가므로 프런트(`sanitizeDraft`)와 서버(`WebChatAppearanceDto` 의 enum·hex·길이 검증) 양쪽에서 허용 목록으로 거른다(다층 방어, [웹채팅 보안](CLE-WEBCHAT-SECURITY.md)).
- **저장 형식(평면)과 부팅 설정(중첩)의 변환**: 콘솔 폼과 서버는 평면 모양(`welcomeText`, 추천 질문 textarea 문자열 하나)으로 저장하고 클라이언트 `draftToBootInput` 이 부팅 설정(`welcome.text`, `welcome.suggestions: string[]`)으로 옮긴다. 추천 질문은 `welcome.suggestions` 와 `launcher.suggestions` 양쪽에 똑같이 넣는다. 콘솔은 공용 필드 하나로 관리한다. `appearance.zIndex` 는 콘솔이 저장하지 않으며 설치 스크립트를 직접 고칠 때만 쓴다.

## 설치 스크립트

설치 스크립트의 형태(큐 스텁 + 로더 스크립트 + `ClemvionChat('boot', { … })`)는 [웹채팅 SDK](CLE-WEBCHAT-SDK.md)가 기준이다. 큐 스텁은 반드시 넣는다. 콘솔은 그 형태의 부팅 설정에 `apiBase`·`triggerEndpointPath`·`locale`·`appearance`·`headerTitle`·`welcome`·`launcher`·`disclaimer` 를 채운다. 값의 출처는 아래와 같다.

| 자리 | 출처 |
|---|---|
| `<widget-cdn-base>` | 기본값은 배포 origin 이다(위젯 동봉 배포, [웹채팅 구조](CLE-WEBCHAT-ARCH.md)). SaaS 나 별도 엣지 CDN 을 쓸 때만 `NEXT_PUBLIC_WIDGET_CDN_BASE`(프론트엔드, 선택)로 바꾼다. 코드 기준은 `codebase/frontend/src/lib/web-chat/widget-base.ts` 의 `getWidgetLoaderUrl()`·`getWidgetAppUrl()`·`getWidgetOrigin()` |
| `<api-base>` | 기존 웹훅 URL 로직과 같다. 기준 주소 규칙은 [웹훅](../CLE-TRIG/CLE-TRIG-WEBHOOK.md)(원본: WH-EP-02), 구현 기준은 `codebase/frontend/src/lib/utils/webhook-url.ts` 의 `getWebhookBaseUrl()` 이다. `NEXT_PUBLIC_WEBHOOK_BASE_URL` → `NEXT_PUBLIC_API_URL` 에서 `/api` 를 뗀 값 → `window.location.origin` 순서로 정한다. `apiBase` 정의는 [웹채팅 SDK 미결 사항](CLE-WEBCHAT-SDK.md#미결-사항) 참조 |
| `triggerEndpointPath` | 고른 웹채팅 인스턴스의 공개 웹훅 경로 |
| 외형·콘텐츠 | [외형 빌더](#외형-빌더)의 폼 값 |

- 복사는 기존 `useCopyToClipboard()` 훅을 재사용한다. 웹훅 URL 복사와 같은 방식이다.
- **대체 동작**: `NEXT_PUBLIC_WIDGET_CDN_BASE` 가 없으면 배포 자신의 origin 기본값(동봉 경로 `/_widget/web-chat/v1/`)을 쓴다. 그래서 셀프호스트도 따로 설정하지 않아도 동작한다. 동봉 번들 자체가 없을 때만 설치 스크립트와 미리보기 UI 를 끄고 경고를 보인다. 없는 `src` 를 가리키지 않게 하려는 것이다. 웹채팅 인스턴스 관리와 외형 폼은 계속 동작한다. 현재 구현의 미리보기는 `wc:ready` 가 제한 시간 안에 오지 않으면 번들이 없는 것으로 보고 안내를 표시한다(`live-preview.tsx`).

## 라이브 미리보기

콘솔 화면 안에서 위젯을 부팅해 런처와 패널을 그리고 고른 웹채팅 인스턴스의 `endpointPath` 로 대화까지 시연한다. 외형은 [외형 빌더](#외형-빌더) 폼 값을 그대로 반영한다.

- **same-origin 동봉 위젯을 iframe 으로 불러온다.** 외부 CDN 에서 받아 오지 않고 제품과 함께 동봉 배포된 위젯(`<배포 origin>/_widget/web-chat/v1/`)을 실제 `src` iframe 으로 띄운다([웹채팅 구조](CLE-WEBCHAT-ARCH.md)). 그래서 미리보기 버전이 그 배포의 백엔드·EIA 버전과 항상 같고(셀프호스트와 여러 버전 대응) 외부 의존이 없다. 위젯 CSS·JS 격리는 iframe 으로 유지한다(`srcdoc` 로 만들지 않는다). 고객 임베드(로더 + cross-origin iframe)는 다른 경로이며 바뀌지 않는다.
- **미리보기 iframe 높이 제한**: 위젯 `wc:resize` 페이로드의 `height` 는 콘솔 패널 안에 들어가도록 320~640px 로 제한한다. 최소 320 은 접힌 런처 높이를 보장하고 최대 640 은 콘솔 영역을 넘지 않게 한다. `width` 는 미리보기 컨테이너 너비 100% 로 고정하고 따로 제한하지 않는다.
- 미리보기는 위젯 동봉 배포를 전제로 한다. 외부 위젯 CDN 은 전제가 아니다(SaaS 엣지 CDN 은 선택).
- **EIA 대화 배선은 이미 되어 있다.** 위젯은 자체 `eia-client.ts` 로 `POST /api/hooks/:path`(즉시 시작), SSE `/api/external/*`, `submit_message` 를 직접 부른다([웹채팅 구조](CLE-WEBCHAT-ARCH.md)). 추가 배선이 필요 없다. 웹채팅 SDK 와 `@workflow/sdk` 의 관계는 [웹채팅 SDK 미결 사항](CLE-WEBCHAT-SDK.md#미결-사항) 참조.
- **첫 노드 보정**: 시작 직후 빠른 첫 노드의 `waiting_for_input` 을 놓치지 않게 하는 보정은 모든 임베드에 적용되는 위젯 동작이다. [웹채팅 인증과 세션](CLE-WEBCHAT-SESSION.md)의 첫 노드 보정을 따른다.
- **CORS**: 동봉 배포라 위젯 origin 이 배포 origin 과 같으면 CORS 설정이 필요 없다. 프론트엔드(위젯 동봉 origin)와 API 를 다른 도메인으로 나눠 배포하거나 엣지 CDN 을 쓰면 그 origin 을 백엔드 `WEB_CHAT_WIDGET_ORIGINS` 에 넣어야 한다. 빠지면 SSE 가 막혀 미리보기에 환영 메시지만 뜨고 대화가 진행되지 않는다. 규칙은 [웹채팅 보안](CLE-WEBCHAT-SECURITY.md)에 있다.
- **표시 전용 Presentation 노드**: 버튼 없이 넘어가는 Presentation 노드(template·carousel·table·chart)의 결과는 위젯이 표시 메시지 이벤트(`execution.message`)로 받아 말풍선으로 그린다([웹채팅 위젯](CLE-WEBCHAT-WIDGET.md)). 그래서 캐러셀 버튼 클릭 → 다음 템플릿 노드 메시지 → AI 노드처럼 노드 사이의 표시 메시지가 미리보기에 빠짐없이 나온다.
- **배치(두 열)**: 넓은 화면(`xl` 이상)에서는 외형·콘텐츠 설정(왼쪽)과 라이브 미리보기(오른쪽, sticky)를 두 열로 놓는다. 외형 변경(`wc:boot` 재전송)이 바로 반영되는 미리보기를 한 화면에서 본다. 설치 스크립트는 왼쪽 열 외형 아래에 둔다. `xl` 미만에서는 한 열로 세로로 쌓는다.
- **"새 세션" 버튼**: 미리보기 머리글의 "새 세션" 버튼은 위젯에 `wc:command resetSession`([웹채팅 SDK](CLE-WEBCHAT-SDK.md))을 보내 대화를 처음부터 다시 시작한다. 시나리오를 반복해서 시험할 수 있다. 위젯이 ready 상태일 때만 켠다.

### 부팅 설정 전달

콘솔은 위젯 iframe 을 직접 마운트하고 [웹채팅 SDK](CLE-WEBCHAT-SDK.md)의 `wc:*` postMessage 프로토콜로 부팅한다. 위젯 개발용 데모 호스트(`channel-web-chat/src/app/demo/demo-host.tsx`)와 같은 경로다.

1. iframe `src` = `<widgetBase>/web-chat/v1/app/?apiBase=<api-base>&trigger=<endpointPath>&locale=<locale>`. `<widgetBase>` 는 [설치 스크립트](#설치-스크립트)의 동봉 기준 주소(배포 자신의 origin `/_widget`, 또는 `NEXT_PUBLIC_WIDGET_CDN_BASE`)다. `apiBase`·`trigger`·`locale` 은 쿼리 파라미터로 먼저 전달하고 위젯은 `configFromQuery()` 로 부트스트랩한다.
2. iframe 이 로드되면 위젯이 호스트로 `wc:ready` 를 보낸다.
3. 콘솔은 `wc:ready` 를 받은 뒤 `wc:boot` 로 부팅 설정 전체(외형 `appearance`·`headerTitle`·`welcome`·`launcher`·`disclaimer` 등 폼 값)를 보낸다. 위젯은 `configFromQuery()` 결과와 `wc:boot` 페이로드를 합쳐 적용한다.
4. **origin 검증**: 양방향 postMessage 모두 `event.origin` 을 검증한다. 동봉 배포면 위젯 iframe origin 과 콘솔 origin 이 같다(same-origin).
5. 외형 폼만 바뀌면 다시 마운트하지 않고 `wc:boot` 를 다시 보내 미리보기를 갱신한다. 불필요한 iframe 리로드와 깜빡임을 피한다. `endpointPath` 나 `locale` 이 바뀔 때만 iframe key 를 바꿔 다시 마운트하고 1~4 를 다시 한다. `locale` 은 부팅 때 한 번 정해지므로 다시 마운트해야 새 UI 언어가 적용된다.

> **임베드 검증과의 관계**: 위젯은 부팅 때 `GET /api/hooks/:path/embed-config` 로 호스트 origin 을 허용 목록과 비교한다([웹채팅 보안](CLE-WEBCHAT-SECURITY.md), `use-widget.ts`). 동봉 same-origin 미리보기는 허용 목록이 없으면(`enforce=false`) 그대로 통과한다. 허용 목록을 설정한 웹채팅 인스턴스는 콘솔(배포) origin 도 목록에 있어야 미리보기가 그려진다.

> **구현 선택지(비규범)**: 콘솔은 위 프로토콜을 직접 구현(데모 호스트처럼 iframe + postMessage)하거나 npm `@workflow/web-chat` 의 `ClemvionChat.setWidgetBase(<widgetBase>)` + `boot()` 를 재사용할 수 있다. v1 은 미리보기를 패널 안에 가두려고 iframe + postMessage 직접 구현을 쓴다. SDK `boot()` 는 호스트 body 에 떠 있는 위젯을 넣어 패널 격리에 맞지 않는다.

## 권한

트리거 권한 규칙과 같다. 권한 매트릭스 전체는 [워크스페이스와 멤버](../CLE-ACCT/CLE-ACCT-WS.md)가 정한다.

| 동작 | 최소 역할 | 근거 |
|---|---|---|
| 목록·상세·설치 스크립트 복사·미리보기·호출 이력 조회 | 뷰어 이상 | `endpointPath` 는 외부 사이트에 그대로 들어가는 공개 값이라 웹채팅 트리거에서는 경로의 비밀성이 성립하지 않는다([웹훅 §비밀성](../CLE-TRIG/CLE-TRIG-WEBHOOK.md#비밀성)). 그래서 설치 스크립트 전체를 뷰어에게 보여도 비밀이 새지 않는다고 본다. 일반 웹훅 규칙과의 관계는 [웹채팅 인증과 세션 미결 사항](CLE-WEBCHAT-SESSION.md#미결-사항) 참조. 호출 이력도 조회 전용이라 뷰어 이상이다 |
| 생성·삭제·이름·활성·외형 편집 | 편집자 이상 | 트리거 생성·삭제 규칙([트리거 관리](../CLE-TRIG/CLE-TRIG-MANAGE.md))과 같다(`RoleGate`). 이름·활성·삭제는 `PATCH`·`DELETE /api/triggers/:id` 한 경로를 쓴다 |

## 다국어

새 메뉴와 화면 문자열은 ko·en 양쪽 dict 에 키를 더한다([다국어와 화면 문구](../CLE-UI/CLE-UI-I18N.md)).

- 메뉴 라벨 `sidebar.webChat`: `lib/i18n/dict/{ko,en}/sidebar.ts`
- 콘솔 화면 문자열: `lib/i18n/dict/{ko,en}/webChat.ts`(+ 각 `index.ts` 등록)

## 구현 위치

- `codebase/frontend/src/app/(main)/w/[slug]/web-chat/**` (콘솔 화면)
- `codebase/frontend/src/components/web-chat/**` (외형 빌더·설치 스크립트·라이브 미리보기·다이얼로그)
- `codebase/frontend/src/lib/web-chat/**` (위젯 배포 주소·설치 스크립트 생성)

## Rationale

### 트리거를 재사용한다 (새 web-chat 엔티티 기각)

웹채팅은 본질적으로 웹훅 트리거 + EIA 인터랙션이다. 새 엔티티·테이블·엔드포인트를 만들면 같은 개념이 두 곳에 있게 되고 동기화 부담이 생긴다. 콘솔은 표현 층에서만 추상화해 백엔드 변경을 줄이고(env 와 선택적 목록 필터), EIA 클라이언트 소비자 원칙([웹채팅 구조](CLE-WEBCHAT-ARCH.md))과 단일 이벤트 출구 정책을 지킨다.

### 외형을 웹채팅 인스턴스 단위로 서버에 저장한다 (결정 2026-06-24, 예전 "저장하지 않음" 결정의 부분 번복)

처음 v1 은 외형을 부팅 옵션으로 내보내기만 하고 백엔드에 저장하지 않았다. 별도 외형 관리 시스템을 만들지 않는다는 복잡도 회피가 핵심 근거였다. 운영자 입장에서 localStorage 에만 두면 브라우저·기기·운영자가 바뀔 때 외형이 사라지는 한계가 분명했다. 그래서 2026-06-24 결정으로 웹채팅 인스턴스 단위 외형의 서버 저장을 v1 에 넣었다.

범위는 일부러 최소로 잡았다. 외형을 웹채팅 인스턴스(= 트리거) 단위로 기존 `config.interaction.appearance` 에 저장한다(`WebChatAppearanceDto`). 새 엔티티·테이블·엔드포인트를 만들지 않고 `PATCH /api/triggers/:id` 를 재사용하므로 트리거 재사용과 EIA 단일 이벤트 출구 원칙에 맞는다. 여전히 비목표인 것은 워크스페이스 단위 테마·브랜딩 관리 콘솔(워크스페이스 외형 라이브러리·테마 서빙)이다([웹채팅](CLE-WEBCHAT.md)).

웹채팅 인스턴스 단위 저장은 외형 관리 시스템을 만들지 않고(기존 트리거 설정 필드 하나) 한계만 없앤다. 복잡도 근거를 지키면서 저장 범위를 좁게 넓힌 부분 번복이다. 보안 측면은 외형 빌더의 다층 허용 목록으로 흡수한다.

### localStorage 는 저장 전 편집의 캐시다 (서버가 기준)

서버(`config.interaction.appearance`)가 단일 기준이다. localStorage 는 저장 전 편집의 캐시로만 둔다(저장 전 새로고침·이탈로 잃지 않게). sessionStorage(탭을 닫으면 사라짐), 쿠키(요청마다 전송), IndexedDB(과한 복잡도)보다 알맞다. 불러올 때 우선순위가 서버 → localStorage → 기본값이라 저장된 값이 늘 먼저다.

### 라이브 미리보기에 EIA 배선은 전제 조건이 아니다

"대화까지" 미리보기에 필요한 EIA 대화 배선은 위젯 자체 `eia-client.ts` 로 이미 되어 있어 전제 조건이 아니다. 실제 전제 조건은 위젯 동봉 배포 하나다([웹채팅 구조](CLE-WEBCHAT-ARCH.md)).

### 미리보기는 same-origin 동봉 iframe 이다 (React 컴포넌트 직접 마운트 기각, 결정 2026-06-23)

위젯을 제품과 동봉 배포해 버전을 배포 단위로 잠그는 결정은 [웹채팅 구조](CLE-WEBCHAT-ARCH.md)에 있다. 미리보기는 그 same-origin 동봉 위젯을 iframe 으로 불러온다. iframe 없이 위젯 React 컴포넌트를 직접 마운트하는 방식은 위젯 app → lib 재구조화 부담이 있고 미리보기가 실제 고객 iframe 임베드와 다른 경로가 되어 충실도가 떨어져 기각했다. same-origin iframe 은 위젯을 그대로(`output:export`) 두고 격리를 유지하면서 버전 일치와 외부 의존 0 을 얻는다. cross-origin 격리 예외의 근거는 [웹채팅 구조](CLE-WEBCHAT-ARCH.md)에 있다.

### 미리보기는 `xl` 이상에서만 두 열로 놓는다 (결정 2026-06-25)

미리보기가 상세 패널 세로 쌓기의 맨 아래에 있으면 외형을 바꾼 효과를 보려고 페이지 끝까지 스크롤해야 한다. "라이브" 미리보기의 즉시성이 사라진다. 외형 변경이 `wc:boot` 재전송으로 미리보기에 바로 반영되므로 변경과 결과를 한 화면에 두려고 외형(왼쪽)과 미리보기(오른쪽, sticky)를 두 열로 놓는다. [화면 구조](#화면-구조)의 본래 의도와 같다.

`xl` 이상에서만 두 열로 나누고 그 미만은 세로로 쌓는다. 왼쪽에 이미 280px 웹채팅 인스턴스 목록이 있어 상세 패널 안을 다시 둘로 나누면 좁은 노트북(약 1280px)에서 외형 폼과 미리보기가 빽빽해진다. `xl`(≥1280px) 이상에서만 나누고 그 미만은 한 열로 접어 읽기 쉽게 한다. 미리보기는 오른쪽 열에서 `sticky` 로 고정해 왼쪽 폼을 스크롤하는 동안에도 보인다.
