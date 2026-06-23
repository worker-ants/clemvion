---
title: 웹채팅 운영 콘솔 (제품 내 데모 + 설치 스니펫)
worktree: webchat-console-95fe1e
started: 2026-06-23
owner: planner
status: complete
spec_impact:
  - spec/7-channel-web-chat/5-admin-console.md
  - spec/7-channel-web-chat/0-architecture.md
  - spec/7-channel-web-chat/2-sdk.md
  - spec/7-channel-web-chat/3-auth-session.md
  - spec/7-channel-web-chat/4-security.md
  - spec/7-channel-web-chat/_product-overview.md
  - spec/2-navigation/_layout.md
  - spec/2-navigation/_product-overview.md
  - spec/5-system/14-external-interaction-api.md
  - spec/0-overview.md
related_spec:
  - spec/7-channel-web-chat/5-admin-console.md
  - spec/2-navigation/_layout.md
  - spec/2-navigation/_product-overview.md
  - spec/7-channel-web-chat/_product-overview.md
  - spec/7-channel-web-chat/0-architecture.md
related_plans:
  - plan/in-progress/channel-web-chat-impl.md
  - plan/in-progress/channel-web-chat-followups.md
  - plan/in-progress/webchat-eager-start.md
---

# 웹채팅 운영 콘솔

운영자가 **제품 안에서** 임베드형 웹채팅 위젯의 데모를 보고 설치 스니펫을 받을 수 있는 admin 콘솔을 신설한다.
위젯 SPA 런타임(`codebase/channel-web-chat`)은 그대로 별도 유지하고, 콘솔은 위젯을 *소비*(loader.js + iframe)만 한다.

> 설계 근거·일관성 검토(BLOCK: NO)·결정 전말: `plan/in-progress/spec-draft-web-chat-console.md` +
> `review/consistency/2026/06/23/08_17_29/SUMMARY.md`.

## 핵심 결정 (요약)

- **웹채팅 인스턴스 = webhook trigger(`config.interaction.enabled=true`) + workflow** — 신규 백엔드 엔티티 없음, 기존
  `POST/GET /api/triggers` 재사용. 콘솔은 `endpointPath`/webhook 플럼빙을 추상화한 친화 레이어.
- **외형은 boot 옵션으로만 emit, 백엔드 미저장** — 기존 비목표(`_product-overview §2`) 준수. 폼 상태는 localStorage(편의).
- **설치 스니펫** = `ClemvionChat('boot', {...})` (SoT `7-channel-web-chat/2-sdk.md §4 BootConfig`). `apiBase` 는 기존
  webhook-url 로직, `<widget-cdn-base>` 는 **기본값 self-origin**(동봉), `NEXT_PUBLIC_WIDGET_CDN_BASE`(admin)는 선택 override. 복사는 `useCopyToClipboard`.
- **위젯 동봉(co-deploy) + 버전잠금** (사용자 결정 2026-06-23): 위젯을 제품과 같은 릴리스로 동봉(frontend workspace 의존 +
  `/_widget/web-chat/v1/` same-origin 서빙) → 셀프호스트·버전 다양성 대응. 외부 위젯 CDN 은 선행조건 아님.
- **라이브 미리보기** = **same-origin 동봉 위젯을 iframe** 으로 임베드. 선행조건은 위젯 동봉(Phase 1). EIA 대화 배선은 위젯 자체
  `eia-client.ts` 로 이미 완료(M2 headless 의 `@workflow/sdk` 보류와 무관).

## Phase

### Phase 0 — Spec (planner, 본 worktree)
- [x] 영향 spec 식별 + draft (`spec-draft-web-chat-console.md`)
- [x] `/consistency-check --spec` (5 checker, BLOCK: NO — Critical 0)
- [x] plan 파일 생성(본 파일, spec write 전 `pending_plans` 가드 충족)
- [x] spec 반영:
  - [x] NEW `spec/7-channel-web-chat/5-admin-console.md` (구현 후 `status: partial` + code globs 로 승격)
  - [x] EDIT `spec/2-navigation/_layout.md` §1 ASCII + §2.2 메뉴 행(Schedule 아래) 신설·번호 재정렬
  - [x] EDIT `spec/2-navigation/_product-overview.md` NAV-WC-01..06 요구사항 + 화면 설명 (구현 후 01~05 ✅)
  - [x] EDIT `spec/7-channel-web-chat/_product-overview.md` 구성요소 D + 비목표 명확화 + Rationale
  - [x] EDIT `spec/7-channel-web-chat/0-architecture.md §4` env 2건(상보) 등재
  - [x] EDIT `spec/0-overview.md §8` 문서 맵에 `5-admin-console.md` 등록
- [x] side-effect 점검 + commit (`edc233db`·`1716bc63`)
- [x] impl-prep 게이트: C-1 Critical 은 origin/main baseline drift **FALSE POSITIVE**(git 실측 반증, `review/consistency/2026/06/23/09_21_43/SUMMARY.md`). working tree Critical 0.

### Phase 1 — 위젯 동봉(co-deploy) + 버전잠금 [developer] (증분 2) — ✅ 완료 (커밋 `e5cb32e9`)
- [x] 위젯 빌드+복사 파이프라인 — `scripts/copy-widget.mjs` + `build:widget` 스크립트: `channel-web-chat` 을
      `NEXT_PUBLIC_BASE_PATH=/_widget/web-chat/v1/app` 로 빌드 + SDK loader 빌드 → `frontend/public/_widget/web-chat/v1/` 복사.
      pnpm `--filter` 로 같은 릴리스 버전 잠금(formal dep 대신 빌드 스텝). 실측 검증(artifacts 복사 확인).
- [x] `NEXT_PUBLIC_WIDGET_CDN_BASE` 기본값 self-origin 해석(`getWidgetBase`/`getWidgetOrigin`, 미설정 시 `<origin>/_widget`) + 선택 override
- [x] 백엔드 `WEB_CHAT_WIDGET_ORIGINS`(기존 env) — same-origin 동봉이면 불필요(엣지 CDN override 시에만). 문서화
- [x] `.env.example`(frontend) + README Deployment 절 갱신, `public/_widget` gitignore·eslint ignore
> 외부 위젯 CDN 호스팅은 선행조건 아님(동봉으로 대체).
> **배포 wiring (검증 완료)**: 배포/CI 가 `docker build` 전에 `pnpm --filter frontend build:widget` 만 실행하면 된다.
> `.dockerignore` 는 `**/node_modules`·`**/.next` 만 제외하므로 `public/_widget` 은 frontend Dockerfile 의
> `COPY codebase/frontend`(builder)→`COPY .../public`(runner) 경로로 이미지에 그대로 포함된다 — Dockerfile 변경 불필요.

### Phase 2 — 콘솔 코어 [developer] (TDD) — ✅ 증분 1 완료 (커밋 `8c5a3a54` + REVIEW fix)
- [x] 사이드바 메뉴 등록 (`components/layout/sidebar.tsx` navItems, Schedule 아래) + i18n `sidebar.webChat` (ko/en)
- [x] 라우트 `app/(main)/web-chat/page.tsx` ("use client") + `components/web-chat/**`
- [x] 인스턴스 목록 — `GET /api/triggers` 클라이언트 필터(`type==webhook && config.interaction?.enabled`)
- [x] "웹채팅 만들기" wizard — workflow 선택 → 이름 → `POST /api/triggers { ..., interaction:{enabled:true} }` (`editor`+ / `RoleGate`)
- [x] 외형/콘텐츠 빌더 폼 (BootConfig 필드) + localStorage 보존(sanitize 포함)
- [x] 설치 스니펫 생성 + `useCopyToClipboard` 복사 (lib/web-chat/snippet, `</script>`·U+2028 XSS 이스케이프)
- [x] i18n `web-chat` dict (ko/en) + index 등록
- [x] unit 테스트 (widget-base·snippet·snippet-input·page; 27 케이스)

### Phase 3 — 라이브 미리보기 [developer] (증분 2) — ✅ 완료 (커밋 `e5cb32e9` + REVIEW fix)
- [x] **spec 선결 해소**: `5-admin-console §6.1` 에 boot config 전달 메커니즘(iframe query param + `wc:boot` postMessage, 2-sdk §3) 명시
- [x] 콘솔 내 contained same-origin iframe 임베드 — `getWidgetAppUrl()` + query(apiBase/trigger/locale), `wc:ready` 후 `wc:boot` 로 외형 전달, 외형만 변경 시 boot 재전송·instance/locale 변경 시 재마운트
- [x] 동봉 미설정(wc:ready 타임아웃) 시 fallback (안내 오버레이)
- [x] unit 테스트(iframe src·wc:boot·origin 무시·타임아웃·외형 재전송). e2e 는 docker/풀스택 의존 — 환경 차단(DeadlineExceeded) 으로 보류

### Phase 4 — 검증 [developer]
- [x] lint/unit 통과. frontend `next build` 통과(`/web-chat` 라우트 생성)
- [x] **e2e 통과** — 재시도 시 PASS (214 tests, `_test_logs/e2e-20260624-011500.log`). 직전 `DeadlineExceeded` 는
      transient docker 빌드 타임아웃이었고 이미지 캐시 후 정상 실행. (backend supertest — frontend-only 변경의 무회귀 확인)
- [x] `/ai-review` (코드 스코프 ×2 증분) + WARNING fix — Critical 0, RESOLUTION 작성. `/consistency-check --impl-done` ×2 BLOCK: NO
- [x] **(증분 2)** user guide 작성 (`user-guide-writer`): 콘솔 가이드 `web-chat.mdx`(KO/EN) + SDK 개발자 가이드 `web-chat-sdk.mdx`(KO/EN, 콘솔 교체로 사라졌던 내용 별 페이지 복원) + 상호링크. docs 가드 2312 통과, documentation 리뷰 Critical 0.

## Follow-up 13건 일괄 처리 (2026-06-24, 사용자 goal "1~13 진행")

이전 "미해결/이월·테스트 follow-up" 으로 적어둔 항목 + 배포 wiring·UX·코드품질·선재 항목을 전부 이 브랜치에서 처리했다.

**A. 배포 wiring**
- [x] (1) `build:widget` → docker build 앞단계 wiring. Dockerfile 헤더에 전제 주석 + `k8s/README.md` 로컬/staging/prod
  build 커맨드에 `pnpm --filter frontend build:widget` 선행 단계 명문화. (builder 가 channel-web-chat 소스를 COPY 안 하고
  `--filter "frontend..."` 로만 설치 → 이미지 내부 위젯 빌드 불가가 의도된 설계임을 문서화.)

**B. 백엔드 (비목표 부분 번복 — 결정 2026-06-24)**
- [x] (2) per-instance 외형 **서버 저장** — `config.interaction.appearance` (`WebChatAppearanceDto`, 신규 엔티티 없음).
  `5-admin-console §4`·R2/R3·`_product-overview §2` 비목표 갱신(번복 전말·rationale 명시). 프런트: 콘솔 "저장" 버튼 +
  서버 시드(서버→localStorage→기본값) + `useUpdateWebChatAppearance` (PATCH, interaction 전체 재전송으로 enabled·tokenStrategy 보존).
- [x] (3) `GET /api/triggers?interactionEnabled=true` 서버 JSONB 필터 (`QueryTriggerDto`+findAll). 프런트가 사용 + 클라 방어필터 유지.

**C. 테스트 커버리지 (코드리뷰 INFO)**
- [x] (4) 콘솔 e2e 확장: 생성 happy-path(stateful mock: 입력→submit→목록 갱신→신규 endpointPath 스니펫)·viewer role 분기. (3/3 PASS)
- [x] (5) `mockAuth` 공용 헬퍼 `e2e/helpers/mock-auth.ts` 추출 + console·workflows/list 마이그레이션(role 파라미터화).
- [x] (6) `CreateWebChatDialog` 독립 unit (no-workflows·제출 게이팅·성공/실패 토스트).
- [x] (7) 설치 스니펫 `data-testid="web-chat-install-snippet"` + e2e 셀렉터 전환.

**D. UX enhancement**
- [x] (8) `wc:resize` 동적 미리보기 높이 — 위젯이 collapsed/expanded 박스 크기를 emit(host-bridge `sendResize`, widget-app effect;
  실제 loader 도 적용 — 기존 emit 누락 보완) + LivePreview 가 수신해 iframe 높이 clamp(320~640). `2-sdk §3` 멱등 재전송 + resize 명문화.

**E. 코드 품질**
- [x] (9) `web-chat/page.tsx` `CreateWebChatButton` 컴포넌트 추출(헤더·EmptyState 재사용).
- [x] (10) 공유 trigger 도메인 타입 `lib/types/trigger.ts` 신설 → `use-web-chat.ts` 전면 사용 + triggers/page·detail-drawer 의 type/interaction 서브타입 채택(중복 제거).
- [x] (11) `copy-widget.mjs` 패키지/경로 매직 문자열 상수화(WIDGET_PACKAGE·SDK_PACKAGE·CODEPLOY_DIR·VERSION_SEGMENT).

**F. 선재/무관 + spec**
- [x] (12) `schedules-page.test` 전체-스위트 flake 안정화 — top-level `afterEach(cleanup)` (마지막 렌더 누수 제거).
- [x] (13) `2-sdk §3` `wc:boot` 멱등 재전송 시맨틱 + wc:resize host 처리 명문화.

> 검증: lint(0 err)·frontend unit 4630·channel-web-chat 193·backend triggers 61·builds(be/cwc/fe)·e2e(console+workflows 6/6) 통과.

## 해소된 후속 (직전 작업, 유지)
- [x] **embed-config spec 갭 해소**: `3-auth-session §3 step 0` + `4-security §3-①` 문서화(allow-all degrade·max-age=300·fail-open).
- [x] **콘솔 playwright e2e** `e2e/web-chat/console.spec.ts` (위 (4) 에서 확장).

## 증분 전략 (2026-06-23)
- **증분 1 (현재 PR)**: Phase 2 콘솔 코어(메뉴·라우트·인스턴스 목록/생성·외형 빌더·스니펫 생성·복사) + Phase 1 env 유틸
  (`<widget-cdn-base>` self-origin 기본 해석). 핵심 "설치 스크립트" 가치, unit 검증 가능.
- **증분 2 (후속 PR)**: Phase 1 위젯 동봉 빌드 파이프라인(workspace dep + `out/` 복사) + Phase 3 라이브 미리보기
  (same-origin iframe). 인프라성 — 별 PR. 그때까지 미리보기 UI 는 cdn-base 미해석 시 disabled+안내.
