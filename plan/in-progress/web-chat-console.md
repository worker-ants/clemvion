---
title: 웹채팅 운영 콘솔 (제품 내 데모 + 설치 스니펫)
worktree: webchat-console-95fe1e
started: 2026-06-23
owner: planner
status: in-progress
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

### Phase 1 — 위젯 동봉(co-deploy) + 버전잠금 [developer]
- [ ] `channel-web-chat` 을 frontend workspace 의존으로 연결 (버전 잠금)
- [ ] 위젯을 `NEXT_PUBLIC_BASE_PATH=/_widget/web-chat/v1/app` 로 빌드 → `frontend/public/_widget/web-chat/v1/` 동봉하는 빌드 파이프라인(복사 스크립트)
- [ ] `NEXT_PUBLIC_WIDGET_CDN_BASE` 기본값 self-origin 해석 로직(미설정 시 `window.location.origin`) + 선택 override
- [ ] 백엔드 `WEB_CHAT_WIDGET_ORIGINS`(기존 env) — same-origin 동봉이면 불필요, 엣지 CDN override 시에만 추가
- [ ] `.env.example`(frontend) 샘플 갱신
> 외부 위젯 CDN 호스팅은 선행조건 아님(동봉으로 대체). Phase 2 스니펫 빌더는 Phase 1 전에도 텍스트 생성·복사로 가치 전달 가능.

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

### Phase 4 — 검증 [developer] — 증분 1 부분
- [x] lint/unit 통과 (리뷰 앞). frontend `next build` 통과(`/web-chat` 라우트 생성)
- [ ] docker 이미지 빌드 + e2e: **환경 차단**(`DeadlineExceeded`, 실측 확인 `review/code/.../RESOLUTION.md`). frontend-only·대응 e2e 부재
- [x] `/ai-review` (코드 스코프) + WARNING fix — Critical 0, RESOLUTION 작성 (`review/code/2026/06/23/10_07_47/`)
- [x] **(증분 2)** user guide 작성 (`user-guide-writer`): 콘솔 가이드 `web-chat.mdx`(KO/EN) + SDK 개발자 가이드 `web-chat-sdk.mdx`(KO/EN, 콘솔 교체로 사라졌던 내용 별 페이지 복원) + 상호링크. docs 가드 2312 통과, documentation 리뷰 Critical 0.

## 미해결/이월
- 서버 저장형 외형 관리(per-workspace 외형 JSON 서빙) — 여전히 비목표/백로그.
- `GET /api/triggers?interactionEnabled=true` 서버 필터 — v1 클라이언트 필터로 충분, 데이터 많아지면 도입 검토.
- **(선재 spec 갭, project-planner 후속)** 위젯 부팅 `GET /api/hooks/:path/embed-config` allowlist 조회 단계가
  `spec/7-channel-web-chat/3-auth-session.md §3`·`4-security.md §3` 에 미문서화 (impl-prep W-2). 기존 위젯 동작
  (`use-widget.ts:31`)인데 spec 누락된 선재 갭 → console 구현과 독립. 별도 planner 턴에서 보강.

## 증분 전략 (2026-06-23)
- **증분 1 (현재 PR)**: Phase 2 콘솔 코어(메뉴·라우트·인스턴스 목록/생성·외형 빌더·스니펫 생성·복사) + Phase 1 env 유틸
  (`<widget-cdn-base>` self-origin 기본 해석). 핵심 "설치 스크립트" 가치, unit 검증 가능.
- **증분 2 (후속 PR)**: Phase 1 위젯 동봉 빌드 파이프라인(workspace dep + `out/` 복사) + Phase 3 라이브 미리보기
  (same-origin iframe). 인프라성 — 별 PR. 그때까지 미리보기 UI 는 cdn-base 미해석 시 disabled+안내.
