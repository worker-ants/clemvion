---
id: web-chat-admin-console
status: partial
code:
  - codebase/frontend/src/app/(main)/web-chat/**
  - codebase/frontend/src/components/web-chat/**
  - codebase/frontend/src/lib/web-chat/**
pending_plans:
  - plan/in-progress/web-chat-console.md
---

# Spec: Channel Web Chat — 운영 콘솔 (제품 내 설치·미리보기)

> 영역 개요: [_product-overview](./_product-overview.md). 관련: [아키텍처](./0-architecture.md) · [SDK/스니펫](./2-sdk.md) ·
> [보안/CORS](./4-security.md) · [메뉴 등록](../2-navigation/_layout.md#22-메뉴-항목) · [요구사항 NAV-WC](../2-navigation/_product-overview.md) ·
> [Trigger 화면](../2-navigation/2-trigger-list.md) · [EIA](../5-system/14-external-interaction-api.md).

---

## Overview (제품 정의)

운영자가 **제품 안에서** 웹채팅 위젯을 만들고, 외형을 정하고, 자기 사이트에 붙일 **설치 스니펫**을 받고, 콘솔에서
**라이브로 미리보기** 할 수 있게 한다. 지금까지 위젯 SPA(`codebase/channel-web-chat`)와 SDK 는 별도 산출물로 존재했지만,
운영자가 위젯을 설치·시연할 **제품 내 surface 가 없었다**. 본 콘솔이 그 간극을 채운다.

- **위젯 SPA 런타임은 그대로 별도 유지** — 콘솔은 위젯을 *소비*(loader.js + iframe 임베드)만 하고, admin 앱에 합치지 않는다
  ([0-architecture §2.1](./0-architecture.md): 위젯은 정적 cross-origin CDN 자산).
- **친화 추상화** — 내부적으로는 `webhook trigger + config.interaction.enabled` 위에 얹히지만, 운영자에게는
  "웹채팅 만들기 → 외형 설정 → 스니펫 복사 → 미리보기" 흐름으로 노출한다(`endpointPath`/webhook 플럼빙 숨김).
- 사이드바 신규 **"웹채팅"** 메뉴(`/web-chat`, Schedule 아래)로 진입. 요구사항 SoT: [`NAV-WC-01..06`](../2-navigation/_product-overview.md).

---

## 1. 화면 구조

```
┌──────────────────────────────────────────────────────────────┐
│  웹채팅                                   [+ 웹채팅 만들기]    │
│                                                              │
│  ┌─ 인스턴스 목록 ──────────────────────────────────────────┐ │
│  │ ● 고객지원 봇      → 워크플로우: FAQ Bot      [관리]     │ │
│  │ ● 가격문의 위젯    → 워크플로우: Pricing Q&A  [관리]     │ │
│  └──────────────────────────────────────────────────────────┘ │
│                                                              │
│  ── 인스턴스 상세 (선택 시) ────────────────────────────────  │
│  ┌─ 외형/콘텐츠 ───────────┐  ┌─ 라이브 미리보기 ──────────┐  │
│  │ primaryColor [#5B4FE9] │  │   ┌──────────────────┐     │  │
│  │ position  [bottom-right]│  │   │  (위젯 런처/패널)  │     │  │
│  │ headerTitle [...]      │  │   │   실제 부팅·대화   │     │  │
│  │ welcome.text [...]     │  │   └──────────────────┘     │  │
│  │ suggestions [...]      │  └────────────────────────────┘  │
│  └────────────────────────┘                                  │
│  ┌─ 설치 스니펫 ───────────────────────────────  [복사] ───┐ │
│  │ <script>…loader.js…</script>                            │ │
│  │ <script>ClemvionChat('boot', { … })</script>           │ │
│  └──────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
```

---

## 2. 웹채팅 인스턴스 모델 (= webhook trigger, 신규 엔티티 없음)

웹채팅 1개 = `type=webhook` + `config.interaction.enabled=true` 인 **기존 Trigger** + 연결된 workflow.
신규 백엔드 트리거 유형·테이블·엔드포인트·facade 를 **추가하지 않는다** ([0-architecture R5](./0-architecture.md)의 client-consumer 원칙 유지).

| 콘솔 동작 | 매핑 (기존 API) | 비고 |
|---|---|---|
| 인스턴스 목록 | `GET /api/triggers` → `type==='webhook' && config.interaction?.enabled` 클라이언트 필터 | v1 클라이언트 필터. (서버 `?interactionEnabled=true` 는 데이터 증가 시 도입 검토 — 백로그) |
| 인스턴스 생성 | `POST /api/triggers` `{ type:'webhook', workflowId, name, endpointPath(클라이언트 UUID 생성), interaction:{ enabled:true, tokenStrategy:'per_execution' } }` | `interaction` 은 POST body **top-level** 필드이며 backend 가 저장 시 `config.interaction` 으로 머지한다(EIA §4 등록 페이로드). 스키마: [EIA §4](../5-system/14-external-interaction-api.md) / `interaction-config.dto.ts` |
| 외형/콘텐츠 | (백엔드 미저장) boot 옵션으로만 — §4 | Trigger 에 저장하지 않음 |
| 설치 스니펫 | 클라이언트 템플릿팅 — §5 | endpointPath = 트리거의 공개 webhook path |
| 라이브 미리보기 | 위젯 임베드(M1 hosted iframe) — §6 | 위젯이 `POST /api/hooks/:endpointPath`·`/api/external/*` 호출 |

> **Trigger 화면과의 관계**: 같은 인스턴스는 webhook trigger 이므로 [Triggers 메뉴](../2-navigation/2-trigger-list.md)
> 목록에도 나타난다. Triggers 화면은 raw trigger(인증·EIA 카드)를, 본 콘솔은 **설치·미리보기에 특화한 친화 surface** 를
> 제공한다 — 동일 자원의 두 표현. EIA 활성/`tokenStrategy` 편집은 양쪽 모두 `ExternalInteractionCard`/`POST·PATCH /api/triggers` 단일 경로.

## 3. 인스턴스 생성 (추상화)

"+ 웹채팅 만들기" → 마법사:
1. **워크플로우 선택** (필수 — `Trigger.workflow_id` NOT NULL, [데이터 모델 §2.8](../1-data-model.md#28-trigger)). 웹채팅은 이
   워크플로우를 webhook 으로 실행한다.
2. **이름** 입력.
3. 콘솔이 `endpointPath` 를 `crypto.randomUUID()` 로 생성하고 `POST /api/triggers` 로 webhook+interaction 트리거를 만든다.
- 권한: 생성은 `editor`+ (`RoleGate minRole="editor"`, [Trigger 생성 규약](../2-navigation/2-trigger-list.md#25-트리거-생성)과 일치).

## 4. 외형/콘텐츠 빌더 (백엔드 미저장)

[BootConfig](./2-sdk.md#4-boot-config-스키마) 필드를 폼으로 편집한다 — `appearance{primaryColor,position,zIndex}` ·
`headerTitle` · `welcome{text,suggestions}` · `launcher{suggestions}` · `disclaimer` · `locale`.

- **백엔드에 저장하지 않는다** — 값은 §5 스니펫의 boot 옵션으로만 emit 된다([_product-overview §2 비목표](./_product-overview.md) 준수).
- 폼 상태는 운영자 편의를 위해 **브라우저 `localStorage`** 에만 보존(재방문 시 직전 외형 복원). 서버 동기화 없음.

## 5. 설치 스니펫

출력(SoT: [2-sdk §1](./2-sdk.md)):
```html
<script>(function(d,s){var j=d.createElement(s);j.async=1;
  j.src="<widget-cdn-base>/web-chat/v1/loader.js";d.head.appendChild(j);})(document,"script");</script>
<script>
  ClemvionChat('boot', {
    apiBase: '<api-base>',
    triggerEndpointPath: '<인스턴스 endpointPath>',
    locale, appearance, headerTitle, welcome, launcher, disclaimer
  });
</script>
```
값 출처:

| 토큰 | 출처 |
|---|---|
| `<widget-cdn-base>` | **기본값 = 배포 origin**(위젯 동봉 서빙, [0-architecture §4.1](./0-architecture.md)). SaaS·별도 엣지 CDN 운영 시에만 `NEXT_PUBLIC_WIDGET_CDN_BASE`(admin, 선택) 로 override |
| `<api-base>` | 기존 webhook-url 로직과 **동일** (SoT: `codebase/frontend/src/lib/utils/webhook-url.ts` `getWebhookBaseUrl()` — `NEXT_PUBLIC_WEBHOOK_BASE_URL` → `NEXT_PUBLIC_API_URL` 에서 `/api` 제거 → `window.location.origin`) |
| `triggerEndpointPath` | 선택 인스턴스의 공개 webhook path |
| 외형/콘텐츠 | §4 폼 값 |

- 복사: 기존 `useCopyToClipboard()` 훅 재사용(웹훅 URL 복사와 동일 패턴).
- **fallback**: `NEXT_PUBLIC_WIDGET_CDN_BASE` 미설정 시 **self-origin 기본값**(동봉 경로 `/_widget/web-chat/v1/`)을 쓴다 →
  셀프호스트도 별도 설정 없이 동작. **동봉 번들 자체가 없을 때만** 스니펫/미리보기 UI 를 비활성 + 경고로 노출(dead `src` 방지);
  인스턴스 관리·외형 폼은 계속 동작.
  - **증분 단계 주의**: 동봉 번들 **존재 감지**는 Phase 1(co-deploy 빌드 파이프라인)과 함께 도입한다. 그 전(증분 1)에는
    감지 없이 self-origin loader URL 을 항상 생성하며(`getWidgetLoaderUrl()`), 라이브 미리보기는 placeholder 로 노출한다.

## 6. 라이브 미리보기 (same-origin 동봉 iframe)

콘솔 화면 안에서 위젯을 부팅해 런처/패널을 렌더하고, 선택 인스턴스의 `endpointPath` 로 **대화까지** 시연한다. 외형은 §4 폼
값을 그대로 반영한다.

- **same-origin 동봉 위젯을 iframe 으로 로드** ([0-architecture §4.1·§R8 carve-out](./0-architecture.md)): 외부 CDN 에서 fetch
  하지 않고 **제품과 함께 동봉된(co-deploy) 위젯**(`<배포 origin>/_widget/web-chat/v1/`)을 실제 `src` iframe 으로 띄운다.
  → 미리보기 버전이 그 배포의 백엔드/EIA 버전과 **항상 일치**(셀프호스트·버전 다양성 대응), 외부 의존 0. 위젯 CSS/JS 격리는
  iframe 으로 유지(srcdoc 자가 생성 아님). 고객 임베드(loader + cross-origin iframe)는 별개 경로로 불변.
- **선행조건 = 위젯 동봉(co-deploy)** ([plan Phase 1](../../plan/in-progress/web-chat-console.md)). 외부 위젯 CDN 은 선행조건이 아니다(SaaS 엣지 CDN 은 선택).
- **EIA 대화 배선은 이미 완료** — 위젯 SPA 는 자체 `eia-client.ts` 로 `POST /api/hooks/:path`(eager start)·SSE `/api/external/*`·
  `submit_message` 를 직접 호출한다([0-architecture §3 EIA 매핑](./0-architecture.md)). 추가 배선 불필요.
  ([2-sdk §2](./2-sdk.md)의 "미배선"은 SDK 패키지가 `@workflow/sdk` 를 재사용하는 **M2 headless** 한정 — 콘솔과 무관.)
- **CORS**: 동봉이면 위젯 origin = 배포 origin 이라 same-origin (별도 CORS 불필요). 엣지 CDN override 시에는 그 origin 이
  백엔드 `WEB_CHAT_WIDGET_ORIGINS` allowlist 에 있어야 한다([4-security §2](./4-security.md)).

## 7. 권한 (RBAC — Trigger 규약과 일치)

| 동작 | 최소 역할 | 근거 |
|---|---|---|
| 인스턴스 목록·상세·스니펫 복사·미리보기 | `viewer`+ | `endpointPath` 는 외부 사이트에 그대로 박히는 **공개 UUID**(비밀 아님 — [trigger-list R-15](../2-navigation/2-trigger-list.md)). 따라서 스니펫 전체를 viewer 에게 노출해도 비밀 누출 아님 |
| 인스턴스 생성·삭제·외형 편집 | `editor`+ | [Trigger 생성/삭제 규약](../2-navigation/2-trigger-list.md)과 동일 (`RoleGate`) |

## 8. i18n (KO/EN 동반 갱신 의무)

신규 메뉴·페이지 문자열은 ko/en **양쪽** dict 에 키를 추가한다([convention i18n-userguide](../conventions/i18n-userguide.md) Principle 1·2):
- 메뉴 라벨 `sidebar.webChat` — `lib/i18n/dict/{ko,en}/sidebar.ts`
- 콘솔 페이지 문자열 — `lib/i18n/dict/{ko,en}/web-chat.ts` (+ 각 `index.ts` 등록)

---

## Rationale

### R1. 트리거 재사용 (vs 신규 web-chat 엔티티)
웹채팅은 본질적으로 webhook trigger + EIA interaction 이다. 신규 엔티티/테이블/엔드포인트를 만들면 동일 개념의 이중 진실과
동기화 부담이 생긴다. 콘솔은 **표현 레이어로만 추상화**해 backend 변경을 최소화(env + 선택적 목록 필터)하고, EIA
client-consumer 원칙([0-architecture R5](./0-architecture.md))과 단일 sink 정책을 유지한다.

### R2. 외형 백엔드 미저장 — 기존 비목표와의 경계 명확화 (번복 아님)
[_product-overview §2 비목표](./_product-overview.md)의 "위젯 외형의 서버사이드 관리 콘솔(백엔드 미저장)"은 *백엔드가
외형을 저장·per-workspace 로 서빙하는 관리 콘솔* 을 겨냥한 것이고, 그 당시 **설치 스니펫 빌더 콘솔은 명시 검토 대상이
아니었다**. 본 콘솔은 외형을 boot 옵션으로 **emit 만** 하고 백엔드에 저장·서빙하지 않으므로 비목표를 *번복*하지 않고
**경계를 명확화**한다(저장·서빙형 = 비목표 유지 / emit-only 빌더 = 본 범위). 서버 저장형 외형 관리는 여전히 백로그.

### R3. localStorage 폼 보존
폼 상태 보존은 운영자 편의용이며 백엔드 미저장 제약을 지키는 **클라이언트 저장만** 쓴다. `localStorage`(탭을 닫아도
유지 → 재방문 시 직전 외형 복원)가 `sessionStorage`(탭 닫으면 소실)·쿠키(매 요청 전송 불필요)·indexedDB(과한 복잡도)보다
적합. 백엔드 저장은 비목표라 기각.

### R4. env `NEXT_PUBLIC_WIDGET_CDN_BASE`(admin, 선택) + 기존 백엔드 `WEB_CHAT_WIDGET_ORIGINS` 상보관계
기존 `NEXT_PUBLIC_API_URL`/`NEXT_PUBLIC_WEBHOOK_BASE_URL` 은 API/webhook origin 을 가리키고 위젯 자산은 별도 origin
에서 서빙될 수 있으므로 별도 키를 둔다(한 변수로 합치면 두 origin 이 다른 배포에서 깨짐). 단 §R6 동봉으로 **기본값이
self-origin** 이라 이 키는 **선택**(SaaS 엣지 CDN override 용)이다. 백엔드 CORS env `WEB_CHAT_WIDGET_ORIGINS` 는 **기존
키**(`main.ts`·`web-chat-cors.ts`)이며, override 로 위젯 origin 이 배포 origin 과 달라질 때 그 origin 을 allowlist 에
넣어야 한다(동봉 same-origin 이면 불필요). [0-architecture §4](./0-architecture.md).

### R5. 라이브 미리보기 — EIA 배선은 선행조건 아님
"대화까지" 미리보기에서 EIA 대화 배선은 위젯 자체 `eia-client.ts` 로 이미 완료되어 prerequisite 가 아니다([2-sdk §2](./2-sdk.md)
의 "미배선"은 M2 BYO-UI 한정). 실제 선행조건은 §R6 의 위젯 동봉(co-deploy) 하나다.

### R6. 위젯 동봉(co-deploy) + same-origin 미리보기 (vs 외부 CDN fetch / 직접 컴포넌트 mount)
**문제**: 셀프호스팅 가능 + 배포마다 버전 다양 → 미리보기 위젯을 외부(SaaS) CDN 에서 fetch 하면 그 배포의 백엔드/EIA 버전과
어긋나고, 셀프호스터가 별도 CDN 을 운영해야 한다.
**결정(2026-06-23)**: 위젯을 제품과 **같은 릴리스로 동봉(co-deploy, frontend workspace 의존 + `/_widget/web-chat/v1/` 동봉
서빙)** 해 버전을 배포 단위로 잠그고, 미리보기는 그 **same-origin 동봉 위젯을 iframe** 으로 로드한다.
- vs **외부 CDN fetch**: 버전 skew·셀프호스트 CDN 운영 부담 → 기각. 동봉이면 `<widget-cdn-base>` 기본 self-origin 이라 외부
  호스팅이 선행조건에서 사라지고, 고객 스니펫도 셀프호스터 자기 버전을 가리킨다.
- vs **직접 React 컴포넌트 mount(iframe 없음)**: 위젯 app→lib 재구조화 부담 + 미리보기가 실제 고객 iframe 임베드와 경로가
  갈려 충실도 저하 → 기각. same-origin iframe 은 위젯을 그대로(output:export) 두고 격리(§R1)를 유지하면서 버전 일치·외부 의존
  0 을 달성. cross-origin 격리 carve-out 근거는 [0-architecture §R8](./0-architecture.md).
