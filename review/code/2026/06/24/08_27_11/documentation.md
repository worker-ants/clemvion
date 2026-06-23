# 문서화(Documentation) 리뷰

## 발견사항

### - **[WARNING]** `spec/7-channel-web-chat/5-admin-console.md §8` i18n 파일명 불일치 — spec은 `web-chat.ts`(kebab-case), 실제 구현은 `webChat.ts`(camelCase)
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/webchat-console-95fe1e/spec/7-channel-web-chat/5-admin-console.md §8`
  - 상세: spec이 `lib/i18n/dict/{ko,en}/web-chat.ts`로 명시했으나 구현 파일은 `webChat.ts`(camelCase)이다. spec 문서를 참조하는 개발자가 파일을 찾지 못할 수 있다. 기존 i18n dict 파일 전체(32개)가 camelCase 컨벤션을 따르므로 spec이 오기재 상태다.
  - 제안: `5-admin-console.md §8`의 `web-chat.ts` 를 `webChat.ts` 로 수정해 실제 구현 관례와 일치시킨다.

### - **[WARNING]** `spec/7-channel-web-chat/5-admin-console.md §5` 표에 `getWidgetLoaderUrl()` / `getWidgetCdnBase()` SoT 미기재 — 같은 표에서 `getWebhookBaseUrl()`은 SoT가 명시되어 있어 비대칭
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/webchat-console-95fe1e/spec/7-channel-web-chat/5-admin-console.md §5` 값 출처 표, `<widget-cdn-base>` 행
  - 상세: `<api-base>` 행에는 `SoT: codebase/frontend/src/lib/utils/webhook-url.ts getWebhookBaseUrl()`이 명시되어 있으나, 신설된 `<widget-cdn-base>` 행에는 `getWidgetLoaderUrl()`/`getWidgetCdnBase()` 함수의 SoT 파일 경로가 기재되어 있지 않다. 동급 패턴의 문서화 공백이며, 후속 개발자가 코드 위치를 추적하기 어렵다.
  - 제안: `5-admin-console.md §5` 표의 `<widget-cdn-base>` 행에 `SoT: codebase/frontend/src/lib/web-chat/widget-base.ts (getWidgetLoaderUrl(), getWidgetAppUrl(), getWidgetOrigin())`를 추가한다. (현재 `5-admin-console.md §5`에 파일명만 `codebase/frontend/src/lib/web-chat/widget-base.ts`로 언급되고 있으나 함수명까지 명시하는 것이 동일 표 내 `getWebhookBaseUrl()` 패턴과 일관됨.)

### - **[INFO]** `spec/7-channel-web-chat/5-admin-console.md` frontmatter에 `status: implemented`로 작성 — consistency checker 산출물 및 다른 파일의 `status: partial`과 비교해 상이한 값 사용
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/webchat-console-95fe1e/spec/7-channel-web-chat/5-admin-console.md` frontmatter (line 3: `status: implemented`)
  - 상세: `5-admin-console.md`의 frontmatter가 `status: implemented`로 선언됐다. 동일 영역 내 다른 spec 파일들(`0-architecture.md`, `1-widget-app.md` 등)은 `status: partial`을 사용하고, consistency 검토 산출물도 처음에는 `status: partial`로 가정하며 분석했다. `spec/conventions/spec-impl-evidence.md §3` 라이프사이클에서 `implemented`가 유효한 값인지, `partial`에서 `implemented`로 승격 조건(Phase 4까지 완료)이 충족됐는지 독자에게 불명확하다. 라이브 미리보기(Phase 3 increment 2)가 placeholder 상태이므로 `implemented`가 오기재일 가능성이 있다.
  - 제안: `status: implemented` 가 spec-impl-evidence.md §3의 공식 값이고 Phase 4 e2e PASS 포함 모든 체크박스가 완료됐음이 확인된 경우 현행 유지. 그렇지 않다면 `status: partial`로 수정하고 `pending_plans`를 업데이트한다.

### - **[INFO]** `spec/7-channel-web-chat/5-admin-console.md §5` 의 `fallback` 인라인 주석에 "증분 단계 주의" 블록이 있으나, 실제로 Phase 1이 완료된 현 시점에서 해당 주석이 outdated text가 될 수 있음
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/webchat-console-95fe1e/spec/7-channel-web-chat/5-admin-console.md §5` 마지막 블록
  - 상세: "증분 단계 주의: 동봉 번들 존재 감지는 Phase 1(co-deploy 빌드 파이프라인)과 함께 도입한다. 그 전(증분 1)에는 감지 없이 self-origin loader URL 을 항상 생성"이라고 기술하는데, copy-widget.mjs co-deploy 파이프라인이 이미 이 PR에 포함되어 Phase 1이 완료됐다. 해당 주석이 구현 완료 후에도 미래 시제로 남아 오독을 초래할 수 있다.
  - 제안: Phase 1이 완료됐음이 확인되면 "증분 단계 주의" 블록을 "Phase 1 완료 후 상태: 동봉 번들 존재 감지 도입됨"으로 재기술하거나, 블록을 제거하고 현행 동작만 기술한다.

### - **[INFO]** `review/consistency/2026/06/23/13_38_25/cross_spec.md`의 WARNING(NAV-WC-* dead link, _layout.md §2.2 미갱신)과 `review/consistency/2026/06/24/02_34_35/SUMMARY.md`의 BLOCK:NO vs BLOCK:YES — 두 번의 consistency check 결과가 같은 repo 내에 모순되는 BLOCK 결론을 남김
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/webchat-console-95fe1e/review/consistency/2026/06/23/13_38_25/SUMMARY.md` (BLOCK: NO), `/Volumes/project/private/clemvion/.claude/worktrees/webchat-console-95fe1e/review/consistency/2026/06/24/02_34_35/SUMMARY.md` (BLOCK: YES)
  - 상세: 두 번째 consistency check(02:34)는 NAV-WC-04 "백엔드 미저장" 정의가 2026-06-24 서버 저장 결정과 직접 모순된다며 BLOCK:YES로 판정했다. 그러나 `spec/2-navigation/_product-overview.md`의 NAV-WC-04은 이 PR 변경사항(파일 24) 에서 이미 `인스턴스 단위 서버 저장 config.interaction.appearance — 결정 2026-06-24`로 갱신됐다. 즉 BLOCK 원인이 이 PR 내에서 이미 해소됐음에도 review 폴더에 BLOCK:YES 산출물이 최종 상태처럼 남아있어, 산출물만 읽는 독자에게 BLOCK이 미해소된 것처럼 오인시킬 수 있다. 이 issue는 review 산출물 내 최종 상태 표기의 문서화 문제다.
  - 제안: 코드 리뷰 SUMMARY 또는 RESOLUTION 에서 해당 BLOCK 원인이 동일 PR 내 spec 갱신으로 해소됐음을 명시한다.

### - **[INFO]** `spec/7-channel-web-chat/5-admin-console.md §R2`에 "기존 결정(채택, v1 초기)" 항목이 인라인 서술 없이 참조만 됨 — Rationale 자기완결성 미흡
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/webchat-console-95fe1e/spec/7-channel-web-chat/5-admin-console.md` Rationale §R2
  - 상세: R2가 "기존 미저장 결정의 부분 번복"을 설명하면서 기존 결정의 근거("emit-only; 복잡도 회피가 핵심 근거")를 별도 위치에서 찾아야 한다. 원본 결정이 현재 어느 spec 파일에도 독립 조항으로 남아있지 않아 R2가 유일한 맥락인데, 해당 내용이 생략됐다.
  - 제안: R2에 `**기존 결정(채택, v1 초기)**` 한 문장("emit-only; 별도 외형 관리 시스템을 만들지 않는 복잡도 회피")을 추가해 Rationale이 자기완결적이 되도록 한다.

### - **[INFO]** `spec/7-channel-web-chat/4-security.md §1` sandbox 정책 표에 `allow-same-origin` 트레이드오프가 인라인 기술됨 — Rationale 섹션에 별도 기록 없음
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/webchat-console-95fe1e/spec/7-channel-web-chat/4-security.md §1` iframe sandbox 행
  - 상세: `allow-same-origin` 포함 이유와 트레이드오프("공급망 무결성 보장"·"외부 CDN override 시 cross-origin이라 탈출 위협 없음")가 sandbox 표 셀에 직접 기재됐다. 이 결정이 Rationale 섹션에 별도로 문서화되지 않아 향후 보안 검토 시 찾기 어렵다.
  - 제안: `4-security.md` Rationale 섹션에 "admin 미리보기 iframe allow-same-origin 포함 결정"을 한 항목으로 추가하거나, `5-admin-console.md §6` 비고에 요약을 기재한다.

### - **[INFO]** `spec/7-channel-web-chat/5-admin-console.md §4` 의 "silent deletion" 주의사항이 spec 본문에 기술됐으나 외부 API 호출자를 위한 `spec/5-system/14-external-interaction-api.md §4`에도 주의사항이 추가됨 — 이중 기술
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/webchat-console-95fe1e/spec/5-system/14-external-interaction-api.md §4` (새로 추가된 주의 블록)
  - 상세: EIA §4에 추가된 `interaction` 통째 교체 + silent deletion 주의가 5-admin-console §4 본문과 동일 내용을 중복 기술한다. 두 위치 중 하나만 갱신될 경우 향후 drift가 발생할 수 있다.
  - 제안: EIA §4의 주의 블록에 `상세는 [5-admin-console §4](../7-channel-web-chat/5-admin-console.md)` cross-ref를 추가해 SoT를 명확히 하거나, 한쪽을 요약 + 링크 형태로 정리한다.

### - **[INFO]** `codebase/frontend/README.md`에 co-deploy 빌드 파이프라인(`build:widget`, `copy-widget.mjs`) 설명이 추가됐는지 확인 불가 — consistency 검토에서 `frontend/README.md` co-deploy 설명이 포함됐다고 언급
  - 위치: consistency review `plan_coherence.md`의 diff 언급 `frontend/README.md`
  - 상세: consistency 검토 산출물에서 "구현 diff에 `frontend/README.md` co-deploy 설명이 포함되어 있다"고 언급하나, 해당 README 변경이 실제 리뷰 payload에는 포함되지 않아 직접 확인이 불가했다. `NEXT_PUBLIC_WIDGET_CDN_BASE` 환경변수와 `build:widget` 명령어에 대한 운영 절차가 README에 문서화되어 있는지 확인이 필요하다.
  - 제안: `codebase/frontend/README.md`에 `build:widget` 명령어 실행 절차, `NEXT_PUBLIC_WIDGET_CDN_BASE` 선택 env 설명, co-deploy 후 `public/_widget/` 생성 구조가 기술됐는지 확인한다.

---

## 요약

이번 변경에서 문서화 품질은 전반적으로 높다. `spec/7-channel-web-chat/5-admin-console.md`는 화면 구조, API 매핑, Rationale까지 상세히 기술됐고 `spec/5-system/14-external-interaction-api.md`에 `appearance` 옵셔널 필드와 silent deletion 주의사항이 추가됐으며, `spec/2-navigation/_layout.md`·`_product-overview.md`·`spec/0-overview.md`의 동기화도 이루어졌다. 그러나 두 가지 경미한 WARNING이 있다. 첫째, spec §8의 i18n 파일명이 실제 구현 파일명(`webChat.ts`)과 다르게 `web-chat.ts`로 기재되어 있어 참조 오류를 유발할 수 있고, 둘째로 신설 함수 `getWidgetLoaderUrl()`의 코드 SoT가 같은 표의 `getWebhookBaseUrl()` 대비 명시되지 않아 문서 비대칭이 발생한다. INFO 수준으로는 Rationale 자기완결성 미흡(R2), sandbox allow-same-origin 결정의 Rationale 위치 누락, silent deletion 주의의 이중 기술, review 폴더에 BLOCK:YES 산출물이 해소 표기 없이 잔류하는 점이 있다.

---

## 위험도

LOW
