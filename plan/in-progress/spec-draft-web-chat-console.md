---
title: 웹채팅 운영 콘솔 — spec draft
worktree: webchat-console-95fe1e
started: 2026-06-23
owner: planner
status: draft
kind: spec-draft
created: 2026-06-23
scope:
  - spec/7-channel-web-chat/5-admin-console.md   # NEW — 콘솔 product+tech spec
  - spec/7-channel-web-chat/_product-overview.md # 구성요소 D 추가 + 비목표 재정합
  - spec/2-navigation/_layout.md                 # §1 ASCII + §2.2 메뉴 행 신설
related:
  - plan/in-progress/channel-web-chat-impl.md
  - plan/in-progress/channel-web-chat-followups.md   # EIA 배선 (라이브 미리보기 선행)
  - plan/in-progress/webchat-eager-start.md
---

# 웹채팅 운영 콘솔 — spec draft

> 이 문서는 project-planner draft 다. `/consistency-check --spec` 통과 후 `spec/**` 에 반영한다.
> 구현(codebase) 은 본 단계에서 하지 않는다 — 별도 `plan/in-progress/web-chat-console.md` 가 추적.

## 0. 요구 정의 (사용자 결정)

운영자가 **제품 안에서** 임베드형 웹채팅 위젯의 **데모를 보고 설치 스크립트를 받을** 수 있게 한다.
사용자가 확정한 방향:

1. **위젯 SPA 런타임은 그대로 별도 유지** (`codebase/channel-web-chat`, CDN·iframe 격리, `/web-chat/v1/app`).
   admin 앱에 합치지 않는다. 콘솔은 위젯을 *소비*(loader.js + iframe 임베드)만 한다.
2. 사이드바에 **전용 "웹채팅" 메뉴** 신설 (Schedule 항목 바로 아래).
3. **전용 친화 콘솔**: 내부적으로 `webhook trigger + config.interaction.enabled` 위에 얹히되,
   `endpointPath`/webhook 같은 플럼빙을 추상화 → "웹채팅 만들기 → 외형/콘텐츠 설정 → 설치 스니펫 복사 → 라이브 미리보기".
4. **v1 범위 = 라이브 미리보기 포함** (콘솔에서 실제 위젯 부팅·대화까지 확인).

## 1. 핵심 설계 결정 (조사 결과 반영)

### 1.1 "웹채팅 인스턴스" = webhook trigger (신규 백엔드 엔티티 없음)
- 웹채팅 1개 = `type=webhook` + `config.interaction.enabled=true` 인 **기존 Trigger** + 연결된 workflow.
  - `config.interaction` 스키마: `{ enabled?: boolean; tokenStrategy?: 'per_execution' | 'per_trigger' }`
    (backend `interaction-config.dto.ts`, spec `5-system/14-external-interaction-api.md §4`).
  - 생성: 기존 `POST /api/triggers` 재사용 — `{ type:'webhook', workflowId(필수), name, endpointPath(클라이언트 UUID 생성), interaction:{ enabled:true, tokenStrategy:'per_execution' } }`.
  - 목록: 기존 `GET /api/triggers` 에서 `type=webhook && config.interaction.enabled` 로 필터.
- **신규 백엔드 트리거 유형·facade·in-process 우회를 추가하지 않는다** — 기존 EIA client consumer 원칙
  ([0-architecture R5](../../spec/7-channel-web-chat/0-architecture.md)) 유지.
- `trigger-detail-drawer` 에 이미 `ExternalInteractionCard`(enabled/tokenStrategy edit) + `WebhookConfigCard`(URL 복사)
  존재 → **콘솔은 이를 중복하지 않고**, 비개발자 친화 wrapper + **스니펫 빌더 + 라이브 미리보기**(현재 제품에 없는 surface)만 신설.

### 1.2 외형은 boot 옵션으로만 — 비목표와의 정합 (중요)

> **⚠️ 2026-06-24 번복 — 이 섹션은 초기 draft 시점 기록이다.** 이후 사용자 결정으로 **per-instance 외형의 서버 저장**
> (트리거 `config.interaction.appearance`, 신규 엔티티 없음)이 v1 에 포함됐다. 아래의 "백엔드 미저장 / emit-only" 서술은
> 현행이 아니며, 최신 결정·rationale 은 [5-admin-console §4·R2](../../spec/7-channel-web-chat/5-admin-console.md) 가 SoT 다.
> (여전히 비목표인 것은 *per-workspace 테마 관리 콘솔*.) 본 draft 는 의사결정 history 로 남긴다.

- 기존 `_product-overview §2 비목표`: **"위젯 외형의 서버사이드 관리 콘솔 — 외형은 boot 옵션으로만 주입(백엔드 미저장)"**.
- 신설 콘솔은 이 비목표와 **충돌하지 않는다**. 콘솔은 *설치 스니펫 빌더*다:
  - 외형/콘텐츠(`appearance`/`headerTitle`/`welcome`/`launcher`/`disclaimer`/`locale`) 를 콘솔 폼에서 편집 →
    그 값을 **`ClemvionChat('boot', { ... })` 스니펫에 inline 으로 emit**.
  - **백엔드는 외형을 저장하지 않고, 위젯에 per-workspace 외형 JSON 을 서빙하지 않는다** (비목표 그대로 준수).
  - 폼 상태는 운영자 편의를 위해 **브라우저 localStorage** 에만 보존(선택) — 백엔드 미저장.
- 비목표 문구를 **명확화**: "백엔드가 외형을 저장·서빙하는 관리 콘솔" 은 여전히 비목표,
  "외형을 boot 옵션으로 emit 하는 **설치 스니펫 빌더 콘솔**" 은 v1 범위. (→ `_product-overview` Rationale 에 명시.)
- **연속성 노트(rationale-continuity)**: 기존 비목표는 *"백엔드 외형 저장·per-workspace 서빙"* 을 겨냥했고 스니펫 빌더
  콘솔은 그 당시 명시 검토 대상이 아니었다 → 비목표를 *번복*하는 게 아니라 **경계를 명확화**(저장·서빙형은 비목표 유지,
  emit-only 빌더는 별개 범위)하는 것. 이 사실을 `_product-overview` Rationale 에 적어 연속성 확보.
- **localStorage 선택 근거**(→ `5-admin-console §Rationale`): 폼 상태 보존은 *운영자 편의*용으로 백엔드 미저장 제약을
  지키는 클라이언트 저장만 쓴다. `localStorage`(탭 닫아도 유지, 운영자가 재방문 시 직전 외형 복원) > `sessionStorage`
  (탭 닫으면 소실) / 쿠키(매 요청 전송 불필요) / indexedDB(과한 복잡도). 백엔드 저장은 비목표라 기각.

### 1.3 설치 스니펫 생성
- 출력 형태 (SoT: `2-sdk.md §1`/§4 BootConfig):
  ```html
  <script>(function(d,s){var j=d.createElement(s);j.async=1;
    j.src="<widget-cdn-base>/web-chat/v1/loader.js";d.head.appendChild(j);})(document,"script");</script>
  <script>
    ClemvionChat('boot', {
      apiBase: '<api-base>',
      triggerEndpointPath: '<선택한 인스턴스 endpointPath>',
      locale, appearance:{primaryColor,position,zIndex}, headerTitle, welcome:{text,suggestions}, launcher:{suggestions}, disclaimer
    });
  </script>
  ```
- 값 출처:
  - `apiBase`: 기존 webhook-url 로직 재사용 (`NEXT_PUBLIC_WEBHOOK_BASE_URL` → `NEXT_PUBLIC_API_URL` 에서 `/api` 제거 → `window.location.origin`). `lib/utils/webhook-url.ts` 와 동일 SoT.
  - `triggerEndpointPath`: 선택한 인스턴스(trigger) 의 `endpointPath`.
  - `<widget-cdn-base>`: **신규 env `NEXT_PUBLIC_WIDGET_CDN_BASE`** (admin 프론트엔드 전용. 현재 프론트에 위젯
    cdn-base 노출 경로 없음 → 신규 필요).
  - 외형/콘텐츠: 콘솔 폼 값.
- 복사: 기존 `useCopyToClipboard()` 훅 재사용 (웹훅 URL 복사와 동일 패턴).
- **`NEXT_PUBLIC_WIDGET_CDN_BASE` 신설 근거 + 백엔드 env 상보관계**(→ `5-admin-console §Rationale` + `0-architecture §4`):
  기존 `NEXT_PUBLIC_API_URL`/`NEXT_PUBLIC_WEBHOOK_BASE_URL` 은 **API/webhook origin** 을 가리키고, 위젯 자산은
  별도 **CDN origin**(`<widget-cdn-base>`)에서 서빙되므로 별도 키가 필요하다(한 변수에 합치면 두 origin 이 다른 배포에서
  깨짐). 이 값은 백엔드 CORS allowlist env **`WEB_CHAT_WIDGET_ORIGINS`** 와 **동일한 위젯 CDN origin** 을 가리키는
  상보 관계다 — 프론트는 스니펫·iframe `src` base 로, 백엔드는 `/api/external/*` CORS 허용 origin 으로 각각 주입한다.
  두 값은 같은 배포의 위젯 CDN origin 으로 일치해야 한다. (→ `0-architecture §4` 플레이스홀더 표에 두 env 나란히 등재.)

### 1.4 라이브 미리보기 — 선행 의존성 (검증: 위젯 호스팅 하나뿐)
콘솔 화면 안에서 실제 위젯을 M1 hosted iframe 방식(loader.js + iframe)으로 부팅해 런처/패널을 렌더하고,
선택 인스턴스의 `endpointPath` 로 대화까지 시연한다.

- **선행 A — 위젯 호스팅 (유일한 실제 선행조건)**: 위젯 번들(`channel-web-chat` `out/`)이 admin 브라우저가 로드
  가능한 곳에 배포돼야 함 (`<widget-cdn-base>/web-chat/v1/`). 현재 **미배포**(플레이스홀더). 프론트 노출용
  `NEXT_PUBLIC_WIDGET_CDN_BASE` 도 신규. → plan Phase 1 prerequisite.
- **EIA 대화 배선은 이미 완료 (M1 경로)** — *정정*: 위젯 SPA(`channel-web-chat`)는 **자체 `eia-client.ts`로
  EIA HTTP/SSE 를 직접 호출**한다(`use-widget.ts` 가 `POST /api/hooks/:path`(eager start)·SSE `/api/external/*`·
  `submit_message` 배선, `channel-web-chat-impl.md` EIA 클라이언트 완료[x]). **M1 hosted iframe 대화형 미리보기는
  추가 배선 없이 동작**한다. `2-sdk.md §2`의 "미배선(계획)"은 **SDK 패키지(`@workflow/web-chat`)가 `@workflow/sdk`를
  재사용하는 M2 headless 경로** 한정이며, **콘솔이 쓰는 M1 hosted iframe 과 무관**(`channel-web-chat-followups`의
  M2 보류 항목). 따라서 **EIA 배선은 라이브 미리보기 prerequisite 가 아니다.**
- **백엔드 CORS**: 위젯 iframe(위젯 CDN origin)이 `/api/external/*` 를 호출하므로 그 origin 이 백엔드
  `WEB_CHAT_WIDGET_ORIGINS` allowlist 에 있어야 한다(기존 config, [4-security §2](../../spec/7-channel-web-chat/4-security.md)).
  데이터 측: 미리보기에 내용이 있으려면 interaction 켜진 webhook trigger + 동작하는 workflow 가 있어야 함(코드 아닌 데이터 셋업).
- 단계 분리(선택): **UI 미리보기**(런처/패널·외형 반영)와 **대화형 미리보기**(메시지 왕복) 모두 선행 A(위젯 호스팅)만
  충족되면 가능. 대화형은 추가 코드 prerequisite 없음.

### 1.5 위젯 동봉(co-deploy) + 버전잠금 + same-origin 미리보기 (사용자 결정 2026-06-23)

**문제**: 셀프호스팅이 가능하고 배포마다 버전이 다를 수 있다. 미리보기 위젯을 외부(SaaS) CDN 에서 fetch 하면
(a) 그 배포의 백엔드/EIA 버전과 어긋나고, (b) 셀프호스터가 별도 CDN 인프라를 운영해야 한다.

**결정**: 위젯을 **제품과 같은 릴리스로 co-deploy** 하고, UI 미리보기는 **same-origin 동봉 위젯을 iframe 으로** 로드한다.

- 위젯(`channel-web-chat`)을 frontend 의 **workspace 의존**으로 묶어 **버전 잠금**(같은 릴리스 = 같은 위젯 = 같은 백엔드).
- 위젯 `out/` 번들을 **배포 자신의 origin** 에서 서빙: `NEXT_PUBLIC_BASE_PATH=/_widget/web-chat/v1/app` 로 빌드 →
  `codebase/frontend/public/_widget/web-chat/v1/` 로 동봉(빌드 파이프라인이 복사). frontend `next start`/정적 서빙이
  same-origin 으로 제공.
- `<widget-cdn-base>` **기본값 = 배포 origin**(`window.location.origin` 기반). SaaS 만 원하면 엣지 CDN 으로 override
  (override 해도 같은 릴리스 버전 번들). → **`NEXT_PUBLIC_WIDGET_CDN_BASE` 는 필수 prerequisite 가 아니라 선택**
  (미설정 시 self-origin 기본값). 이전 draft 의 "미설정 시 비활성+경고" fallback 은 **self-origin 기본 동작으로 대체**
  (동봉이 없을 때만 비활성).
- **미리보기**: 위 same-origin 동봉 위젯을 **sandbox iframe** 으로 로드 — 위젯 CSS/JS 격리(§R1)는 유지하되 외부 fetch 0,
  버전 100% 일치. (옵션 A 채택 — 위젯을 app 그대로 두고 동봉. 옵션 B 직접 컴포넌트 mount 는 기각: 위젯 app→lib
  재구조화 부담 + 미리보기가 실제 iframe 임베드와 경로 갈림.)
- **고객 스니펫도 동일 이득**: `<widget-cdn-base>` 기본값이 배포 origin → 셀프호스터 스니펫은 자기 서버의 자기 버전 위젯을 임베드.

**§R8(srcdoc 기각)과의 정합**: §R8 은 *고객 사이트* 임베드에서 `srcdoc`/`about:blank` 자가 생성이 호스트 origin 을
상속해 cross-origin 격리를 깬다는 이유로 기각했다. 본 미리보기는 **실제 `src` 를 가진 same-origin 서빙 파일**을 iframe 으로
로드하는 것(자가 생성 srcdoc 아님)이며, admin 콘솔 미리보기는 cross-origin 격리가 목적이 아니라(우리 앱이 우리 위젯을
미리보는 맥락) **버전 일치·외부 의존 제거**가 목적이다. 따라서 R8 을 위반하지 않는다 — 고객 임베드 경로(loader+cross-origin
iframe)는 그대로 유지되고, 미리보기만 same-origin 동봉을 쓴다.

**버전 전략 보강**: 위젯 `/web-chat/v1/` major path 는 유지하되, 마이너/패치는 **제품 릴리스에 동봉**되어 배포 단위로 잠긴다
(floating "latest" 아님). → `0-architecture §4` 버전 전략에 co-deploy 명시.

## 2. 반영할 spec 변경

### 2.1 NEW: `spec/7-channel-web-chat/5-admin-console.md`
frontmatter (⚠️ convention-compliance CRITICAL 반영 — `status` enum 은 `spec-only`, 코드 미존재라 `code: []`):
```
id: web-chat-admin-console
status: spec-only          # NOT 'planned' (비존재 enum — spec-frontmatter.test.ts 차단). 구현 착수 시 partial 승격.
code: []                   # spec-only 는 빈 배열 (실제 파일 생기면 등재). 미존재 경로 선언 금지(spec-code-paths.test.ts).
pending_plans:
  - plan/in-progress/web-chat-console.md   # spec write 전 이 파일이 존재해야 함(spec-pending-plan-existence 가드)
```
본문 섹션:
- **Overview**: 운영자가 제품 안에서 웹채팅을 만들고 설치 스니펫을 받아 자기 사이트에 붙이고, 콘솔에서 미리보기.
- **§1 화면 구조** (ASCII): 인스턴스 목록 / 생성 / 상세(외형 폼 + 스니펫 + 미리보기 패널).
- **§2 인스턴스 모델**: = webhook trigger(interaction.enabled) + workflow. 기존 trigger API 매핑표 (§1.1).
- **§3 인스턴스 생성(추상화)**: "웹채팅 만들기" wizard → workflow 선택 → 이름 → 자동 trigger 생성. 권한 `editor`+.
- **§4 외형/콘텐츠 빌더**: BootConfig 필드 매핑 폼 (백엔드 미저장, §1.2).
- **§5 설치 스니펫**: 출력 형태·값 출처·복사 (§1.3). `NEXT_PUBLIC_WIDGET_CDN_BASE` (admin 전용) 명시.
  **미설정 시 fallback 정책**: 위젯 cdn-base 가 비어 있으면 스니펫 생성·라이브 미리보기 UI 를 **비활성(disabled) + "위젯 호스팅
  미설정" 경고** 로 노출(잘못된 dead `src` 스니펫 발급 방지). 인스턴스 관리·외형 폼은 계속 동작.
- **§6 라이브 미리보기**: M1 hosted iframe 임베드 방식 + 선행조건 A(위젯 호스팅)만 (§1.4). EIA 대화 배선 완료 명시.
- **§7 권한**: 생성·삭제 `editor`+, 조회·스니펫 복사 가시성(viewer 포함 여부 — trigger 규약과 일치: 조회 전 역할, 변경 editor+).
- **Rationale**: 신규 엔티티 미신설(트리거 재사용)·비목표 정합·미리보기 선행조건(위젯 호스팅)·localStorage·env 신설.

> **문서 배치(잠정)**: 본 draft 는 콘솔 상세를 `7-channel-web-chat/5-admin-console.md` 에 둔다. 단, 프로젝트의
> 지배적 패턴은 *메뉴 화면 = nav-area 페이지 spec*(`2-navigation/N-*.md`, 예: `3-schedule.md`) 이다. 최종 배치
> (nav-area 페이지 spec vs 7-area 채널 spec)는 convention-compliance checker 판단을 따른다 — 어느 쪽이든
> 콘솔 단일 진실 1곳 + 메뉴 등록(`_layout §2.2`) + 요구사항 ID(`2-navigation/_product-overview` NAV-WC-*) 구조는 동일.

### 2.2 EDIT: `spec/7-channel-web-chat/_product-overview.md`
- §4 제품 구성요소 표에 **D. 운영 콘솔** 행 추가 (산출물 `codebase/frontend/src/app/(main)/web-chat/**`, 비고 "admin 메뉴, 위젯 소비자 surface").
- §2 비목표의 "위젯 외형의 서버사이드 관리 콘솔" 문구를 §1.2 대로 **명확화** (백엔드 저장·서빙 콘솔은 비목표 유지 / 스니펫 빌더 콘솔은 v1).
- Rationale 에 §1.2 정합 근거 추가.

### 2.3 EDIT: `spec/2-navigation/_layout.md`
- §1 ASCII 사이드바 다이어그램에 `Web Chat` 항목 추가 (Schedule 아래).
- §2.2 메뉴 항목 표에 **Schedule(4) 바로 아래 신규 행 "웹채팅"** 삽입 (`/web-chat`, 아이콘 후보 MessageCircle/MessagesSquare),
  이하 행 번호 재정렬. 비고: 상세는 콘솔 단일 진실 문서(§2.1 배치 결정).
- **i18n dict 의무**(convention `i18n-userguide.md` Principle 1·2): 신규 메뉴 라벨은 ko/en **양쪽** dict 에 키 추가가
  필수 — `sidebar.webChat` (`lib/i18n/dict/ko/sidebar.ts` + `en/sidebar.ts`), 콘솔 페이지 문자열은 `web-chat` dict 쌍.
  콘솔 spec 본문에 KO/EN dict 동반 갱신 의무를 명시한다.

### 2.4 EDIT: `spec/2-navigation/_product-overview.md`
- 웹채팅 메뉴 화면 요구사항 블록 신설 — prefix **`NAV-WC-*`** (NAV-WF/TR/SC 와 동일 `NAV-<영역>` 규약):
  - `NAV-WC-01` 사이드바에 웹채팅 메뉴 노출 (Schedule 아래)
  - `NAV-WC-02` 웹채팅 인스턴스 목록 표시 (= interaction 켜진 webhook trigger)
  - `NAV-WC-03` "웹채팅 만들기" — workflow 선택 → 자동 webhook trigger(interaction.enabled) 생성 (`editor`+)
  - `NAV-WC-04` 외형/콘텐츠 빌더 (BootConfig 필드, 백엔드 미저장)
  - `NAV-WC-05` 설치 스니펫 생성 + 클립보드 복사
  - `NAV-WC-06` 라이브 미리보기 (M1 hosted iframe, 위젯 호스팅 선행)
- 상태 컬럼: 모두 🚧/계획(미구현).

### 2.5 EDIT: `spec/7-channel-web-chat/0-architecture.md`
- §4 배포/도메인 플레이스홀더 표에 admin 콘솔 관련 env 2건 등재 + 상보관계 명시:
  - `NEXT_PUBLIC_WIDGET_CDN_BASE` (admin 프론트엔드 — 스니펫·iframe src base). **기본값 = 배포 origin**(미설정 시
    self-origin), SaaS override 가능 (§1.5).
  - `WEB_CHAT_WIDGET_ORIGINS` (백엔드 — `/api/external/*` CORS allowlist)
  - 두 값은 **동일 위젯 CDN origin** 을 각 앱에서 주입하며 일치해야 함 (§1.3).
- §4 버전 전략에 **co-deploy(동봉) 잠금** 명시: 위젯은 제품과 같은 릴리스로 동봉 빌드·배포되어 배포 단위로 버전 잠금
  (floating latest 아님). 셀프호스트는 별도 CDN 없이 배포 origin 에서 same-origin 서빙 (§1.5).

### 2.7 EDIT: `spec/0-overview.md`
- §8 문서 맵의 `7-channel-web-chat` 행에 `5-admin-console.md`(운영 콘솔) 등재.

### 2.8 변경 없음 (확인만)
- `spec/1-data-model.md`: 신규 엔티티 없음(Trigger 재사용). 변경 불요.
- `spec/5-system/14-external-interaction-api.md`: EIA 표면 변경 없음(콘솔은 기존 표면 소비). 변경 불요.
- `WEB_CHAT_WIDGET_ORIGINS` 는 **기존 env**(backend `main.ts`·`web-chat-cors.ts`, `4-security.md`) — 신규 아님. 동봉 same-origin 이면 미사용.

## 3. 구현 plan 개요 (별도 파일 `plan/in-progress/web-chat-console.md`)

> **순서 주의(plan-lifecycle 가드)**: `5-admin-console`(또는 nav 페이지 spec) frontmatter 의 `pending_plans:` 에
> `plan/in-progress/web-chat-console.md` 를 등재하므로, **spec write 전에 그 plan 파일을 먼저 생성**해야
> `spec-pending-plan-existence` 가드에 걸리지 않는다. (Phase 0 안에서 plan 파일 생성 → spec write 순서.)

- **Phase 0 — Spec**: plan 파일 생성 → 본 draft 반영 (planner). spec write 전 `/consistency-check --spec` (완료).
- **Phase 1 — 위젯 동봉(co-deploy) + 버전잠금 (§1.5)**: `channel-web-chat` 을 frontend workspace 의존으로 묶고,
  위젯을 `NEXT_PUBLIC_BASE_PATH=/_widget/web-chat/v1/app` 로 빌드해 `frontend/public/_widget/web-chat/v1/` 로 동봉하는
  빌드 파이프라인. `NEXT_PUBLIC_WIDGET_CDN_BASE` 기본값 = self-origin(선택 override) + `WEB_CHAT_WIDGET_ORIGINS`
  (백엔드 CORS, self-origin 포함). `.env.example` 갱신. → **외부 CDN 선행 불필요**(이전 draft 의 "외부 호스팅
  prerequisite" 철회). 셀프호스트 same-origin 기본 동작.
- **Phase 2 — 콘솔 코어**: 사이드바 메뉴 + 라우트 `(main)/web-chat` + i18n(ko/en sidebar + web-chat dict) +
  인스턴스 목록/생성(기존 trigger API) + 외형 빌더 + 스니펫 생성·복사. (TDD)
- **Phase 3 — 라이브 미리보기**: 동봉 위젯을 **same-origin sandbox iframe** 으로 임베드(UI + 대화형, §1.5). EIA 대화
  배선 완료(§1.4)·동봉(Phase 1) 위에서 동작.
- **Phase 4 — 검증**: unit/integration/e2e + `/ai-review` + critical/warning fix.

> 외부 위젯 CDN 선행조건 없음 (§1.5 co-deploy 로 대체). Phase 1(동봉)·Phase 2(콘솔)·Phase 3(미리보기) 순차 진행하되
> Phase 2 의 스니펫 빌더는 Phase 1 전에도 텍스트 생성·복사로 가치 전달 가능.

## Rationale (draft 결정 근거)

- **트리거 재사용 (vs 신규 web-chat 엔티티)**: 웹채팅은 본질적으로 webhook trigger + interaction 이다. 신규 엔티티/테이블/
  엔드포인트는 중복·이중 진실을 만든다. 콘솔은 표현 레이어로만 추상화 → backend 변경 최소(env + 선택적 목록 필터),
  EIA client-consumer 원칙(0-architecture R5) 유지.
- **외형 백엔드 미저장 유지**: 기존 비목표를 뒤집지 않는다. 콘솔은 스니펫에 외형을 emit 할 뿐 backend 저장·서빙 안 함.
  (서버 저장형 외형 관리·per-workspace 외형 JSON 서빙은 여전히 백로그.)
- **라이브 미리보기 선행 의존 명시**: "대화까지" 미리보기의 유일한 실제 선행조건은 **위젯 호스팅(미배포)** 이다.
  EIA 대화 배선은 M1 hosted iframe 경로에서 이미 완료(§1.4 검증)라 prerequisite 아니다. 이를 숨기지 않고 plan
  Phase 1(위젯 호스팅) prerequisite 로 노출 — 스니펫 빌더(Phase 2)는 선행 없이 먼저 전달.
