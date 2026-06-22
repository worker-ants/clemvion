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
  webhook-url 로직, `<widget-cdn-base>` 는 신규 env `NEXT_PUBLIC_WIDGET_CDN_BASE`(admin). 복사는 `useCopyToClipboard`.
- **라이브 미리보기** = M1 hosted iframe 임베드. **유일 선행조건은 위젯 호스팅(Phase 1)** — EIA 대화 배선은 위젯 자체
  `eia-client.ts` 로 이미 완료(M2 headless 의 `@workflow/sdk` 보류와 무관).

## Phase

### Phase 0 — Spec (planner, 본 worktree)
- [x] 영향 spec 식별 + draft (`spec-draft-web-chat-console.md`)
- [x] `/consistency-check --spec` (5 checker, BLOCK: NO — Critical 0)
- [x] plan 파일 생성(본 파일, spec write 전 `pending_plans` 가드 충족)
- [ ] spec 반영:
  - [ ] NEW `spec/7-channel-web-chat/5-admin-console.md` (`status: spec-only`, `code: []`, `pending_plans: [본 파일]`)
  - [ ] EDIT `spec/2-navigation/_layout.md` §1 ASCII + §2.2 메뉴 행(Schedule 아래) 신설·번호 재정렬
  - [ ] EDIT `spec/2-navigation/_product-overview.md` NAV-WC-01..06 요구사항 + 화면 설명
  - [ ] EDIT `spec/7-channel-web-chat/_product-overview.md` 구성요소 D + 비목표 명확화 + Rationale
  - [ ] EDIT `spec/7-channel-web-chat/0-architecture.md §4` env 2건(상보) 등재
  - [ ] EDIT `spec/0-overview.md §8` 문서 맵에 `5-admin-console.md` 등록
- [ ] side-effect 점검 + commit `docs(spec): 7-channel-web-chat — 웹채팅 운영 콘솔`

### Phase 1 — 선행: 위젯 호스팅 (유일 prerequisite) [developer/infra]
- [ ] 위젯 `out/` 번들을 `<widget-cdn-base>/web-chat/v1/` 로 서빙하는 배포 경로 확정(별도 배포 계획과 조율)
- [ ] 프론트 env `NEXT_PUBLIC_WIDGET_CDN_BASE` + 백엔드 CORS env `WEB_CHAT_WIDGET_ORIGINS`(동일 origin) 주입
- [ ] `.env.example` 샘플 추가
> Phase 2(콘솔 코어)는 이 phase 없이도 착수 가능 — 스니펫 텍스트 생성·복사는 위젯 배포 전에도 가치 전달.

### Phase 2 — 콘솔 코어 [developer] (TDD)
- [ ] 사이드바 메뉴 등록 (`components/layout/sidebar.tsx` navItems, Schedule 아래) + i18n `sidebar.webChat` (ko/en)
- [ ] 라우트 `app/(main)/web-chat/page.tsx` ("use client") + `components/web-chat/**`
- [ ] 인스턴스 목록 — `GET /api/triggers` 클라이언트 필터(`type==webhook && config.interaction?.enabled`)
- [ ] "웹채팅 만들기" wizard — workflow 선택 → 이름 → `POST /api/triggers { type:'webhook', workflowId, endpointPath(uuid), interaction:{enabled:true, tokenStrategy:'per_execution'} }` (`editor`+ / `RoleGate`)
- [ ] 외형/콘텐츠 빌더 폼 (BootConfig 필드) + localStorage 보존
- [ ] 설치 스니펫 생성 + `useCopyToClipboard` 복사. cdn-base 미설정 시 disabled+경고
- [ ] i18n `web-chat` dict (ko/en) + index 등록
- [ ] unit/integration 테스트

### Phase 3 — 라이브 미리보기 [developer]
- [ ] 콘솔 내 위젯 M1 hosted iframe 임베드(loader + iframe) — 선택 인스턴스 `endpointPath` 부팅, 외형 반영
- [ ] UI 미리보기(런처/패널) + 대화형(메시지 왕복) — 선행 A(위젯 호스팅)에만 의존
- [ ] 미설정 fallback (disabled + 경고)
- [ ] e2e 시나리오 (생성 → 스니펫 → 미리보기)

### Phase 4 — 검증 [developer]
- [ ] lint/build/test (리뷰 앞)
- [ ] `/ai-review` + critical/warning fix (`resolution-applier`)
- [ ] PROJECT.md §동반 갱신 매트릭스 — 유저 가이드 페이지 신규/갱신 (`user-guide-writer`)

## 미해결/이월
- 위젯 호스팅 인프라 확정(SaaS CDN / 셀프호스팅) — Phase 1, 별도 배포 계획과 조율.
- 서버 저장형 외형 관리(per-workspace 외형 JSON 서빙) — 여전히 비목표/백로그.
- `GET /api/triggers?interactionEnabled=true` 서버 필터 — v1 클라이언트 필터로 충분, 데이터 많아지면 도입 검토.
