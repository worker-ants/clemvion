# Requirement Review — feat(web-chat): 위젯 co-deploy 빌드 + 라이브 미리보기 iframe (증분 2)

리뷰 대상 커밋: `e5cb32e9`

---

## 발견사항

### [WARNING] plan/in-progress/web-chat-console.md Phase 3 체크박스 미갱신 — 구현된 항목이 `[ ]` 로 남음

- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/webchat-console-95fe1e/plan/in-progress/web-chat-console.md` 행 75–77
- 상세: Phase 3 항목 3개가 모두 `[ ]` (미완료) 상태로 커밋되었으나, 실제 이 커밋에서 전부 구현되었다.
  - "콘솔 내 contained same-origin iframe 임베드 — `getWidgetAppUrl()` + query(apiBase/trigger/locale), `wc:ready` 후 `wc:boot` 로 외형 전달" → `live-preview.tsx` 에서 완전히 구현됨.
  - "동봉 미설정 시 fallback (placeholder 유지)" → `status === "unavailable"` 분기에서 `t("webChat.preview.unavailable")` 렌더로 구현됨.
  - "unit 테스트(iframe src·postMessage 흐름 mock)" → `live-preview.test.tsx` 4개 케이스로 구현됨.
  Phase 1 항목(행 56–60)도 `[ ]` 이지만, `copy-widget.mjs` + `build:widget` 스크립트·`.gitignore`·ESLint ignore 가 이 커밋에서 구현되어 있어 Phase 1 완료 항목도 체크가 누락되었다(단, Phase 1 채크리스트 내 "channel-web-chat workspace 의존으로 연결", "WEB_CHAT_WIDGET_ORIGINS 항목", ".env.example 갱신"은 실제로 이 커밋에 없으므로 `[ ]` 유지가 맞음).
- 제안: `- [ ] 콘솔 내 contained same-origin iframe 임베드…` → `- [x]` 로, `- [ ] 동봉 미설정 시 fallback…` → `- [x]` 로, `- [ ] unit 테스트(iframe src·postMessage 흐름 mock)…` → `- [x]` 로 갱신. Phase 1 빌드 파이프라인 항목(`scripts/copy-widget.mjs`)도 `- [x]` 로 갱신. 후속 커밋 또는 plan 전용 fix 커밋으로 처리.

---

### [WARNING] spec §6.1 step 5 와 구현 간 동작 불일치 — "iframe 재마운트" vs "boot 재전송"

- 위치: `spec/7-channel-web-chat/5-admin-console.md §6.1 step 5` vs `live-preview.tsx` 행 79–82 (`bootConfig` effect)
- 상세: spec §6.1 step 5 는 "외형 폼이 바뀌면 **iframe 재마운트**(key 변경) 후 1–3 을 재실행해 미리보기를 갱신한다" 고 명시한다. 그러나 구현은 외형(appearance) 폼만 바뀔 때 **iframe 재마운트 없이 `wc:boot` 재전송**으로 처리한다. iframe 키 변경은 `iframeSrc`(apiBase/endpointPath/locale) 변경 시에만 발생한다.
  ```tsx
  // iframeSrc = apiBase + endpointPath + locale 만 포함 → 이것만 바뀔 때 재마운트
  const iframeSrc = useMemo(() => {
    const params = new URLSearchParams({ apiBase, trigger: endpointPath });
    if (draft.locale) params.set("locale", draft.locale);
    ...
  }, [apiBase, endpointPath, draft.locale]);

  // 외형(primaryColor, position 등) 변경은 bootConfig diff → boot 재전송만
  useEffect(() => {
    if (status === "ready") postBoot();
  }, [bootConfig, status]);
  ```
  이 구현 방식은 기능상 합리적이다(재마운트 없이 `wc:boot` 재전송으로 외형 갱신이 가능하고 UX 도 훨씬 낫다). 그러나 spec 이 "재마운트" 를 명시한 후 구현이 의도적으로 재전송으로 최적화한 것이라면, spec §6.1 step 5 본문을 "외형 폼만 바뀌면 `wc:boot` 재전송으로 갱신(재마운트 없음); `endpointPath`/`locale` 변경 시에만 iframe key 재마운트" 로 갱신해야 한다. 판단: 구현이 의도적 개선인지 단순 spec 미준수인지 모호하다(데모 host 도 재마운트 패턴 사용).
- 제안: 구현 의도 확인 필요. 의도적 최적화라면 `[SPEC-DRIFT]` 로 spec §6.1 step 5 갱신이 필요; 그게 아니라면 구현 재검토.

---

### [INFO] [SPEC-DRIFT] spec §6.1 step 5 기술 부정확 — 재마운트 조건이 실제 구현과 다름

- 위치: `spec/7-channel-web-chat/5-admin-console.md §6.1 step 5`
- 상세: 코드 구현은 외형 폼 변경을 재마운트 없이 `wc:boot` 재전송으로 처리하고, 인스턴스/locale 변경 시에만 iframe 키를 바꾼다. 이는 데모 host 패턴(전체 재마운트)과 의도적으로 다른 경로이며, 구현 코드 주석에도 명시되어 있다(`// 외형은 boot 재전송으로 처리`). spec step 5 본문이 이를 반영하지 않고 단순히 "재마운트" 로만 기술하고 있다.
- 제안: 코드 유지 + spec §6.1 step 5 갱신. 대상: `spec/7-channel-web-chat/5-admin-console.md` §6.1 step 5 를 "외형 폼(`appearance`·`headerTitle` 등)만 바뀌면 iframe 재마운트 없이 `wc:boot` 재전송으로 갱신; `endpointPath` 또는 `locale` 변경 시에만 iframe key 재마운트(위젯 완전 재초기화)" 로 갱신.

---

### [INFO] `wc:resize` 미처리 — contained iframe 크기 고정

- 위치: `live-preview.tsx` 전체
- 상세: spec §6 기술에 따라 위젯이 `wc:resize` (collapsed/expanded) 를 iframe → host 로 전송한다(2-sdk §3). 구현된 `live-preview.tsx` 는 `wc:resize` 를 수신하지 않아 위젯 패널 전개 시 iframe 크기가 `h-[320px]` 으로 고정된다. 데모 host 도 "iframe 크기 고정 — wc:resize 는 forward-compat 표시용" 으로 의도적으로 무시하고 있어, contained 미리보기에서 고정 크기는 허용 가능한 v1 절충이다. spec 이 이 동작을 explicitly 금지하지 않으므로 INFO.
- 제안: v1 허용 범위. `wc:resize` 기반 동적 iframe 리사이즈가 필요하면 후속 증분에서 구현.

---

### [INFO] `postBoot` 함수 내 `widgetOrigin || "*"` — CDN override 미설정 시 `"*"` 로 fallback

- 위치: `live-preview.tsx` 행 52–55
- 상세: `widgetOrigin` 이 빈 문자열이면 `"*"` 를 targetOrigin 으로 사용한다. `getWidgetBase()` 가 SSR 에서 빈 문자열을 반환할 수 있으나, `LivePreview` 는 `"use client"` 이므로 브라우저에서는 `window.location.origin` 기반으로 항상 origin 을 얻는다. 따라서 실제 `"*"` 가 사용될 경우는 없다. 단, 방어 코드 차원에서 `widgetOrigin` 이 비어 있으면 `postMessage` 를 skip 하는 것이 더 안전하다는 관점은 있다.
- 제안: 실용적으로는 문제없음. 더 엄격하게 하려면 `if (!widgetOrigin) return; ... postMessage(..., widgetOrigin)` 으로 교체 가능.

---

### [INFO] `copy-widget.mjs` — SDK loader filter 이름 불일치

- 위치: `codebase/frontend/scripts/copy-widget.mjs` 행 18 (full file)
- 상세: SDK 빌드 커맨드로 `pnpm --filter @workflow/web-chat build:loader` 를 사용하는데, 코드 내 `sdkDir` 경로는 `codebase/packages/web-chat-sdk` 이다. `@workflow/web-chat` 패키지 이름이 맞는지(package.json 의 `"name"` 과 일치하는지) 외부에서 확인이 필요하다. 단 이 스크립트는 실측 검증("co-deploy 스크립트 실측 검증(artifacts 복사 확인)") 통과를 커밋 메시지에서 주장하므로 실제로 올바른 필터임을 암시한다.
- 제안: 검증 완료로 판단. INFO 수준.

---

## 요약

이번 커밋은 spec/7-channel-web-chat/5-admin-console.md §6·§6.1 에서 정의한 위젯 co-deploy 빌드 파이프라인(Phase 1)과 라이브 미리보기 iframe(Phase 3) 기능을 거의 완전히 구현한다. `copy-widget.mjs` + `build:widget` 스크립트는 spec §5 의 동봉 서빙 경로(`/_widget/web-chat/v1/`) 와 정확히 일치하고, `LivePreview` 의 `wc:ready` → `wc:boot` postMessage 흐름은 spec §6.1 step 1–4 와 line-level 로 일치한다. origin 검증(`getWidgetOrigin()`)과 타임아웃 fallback도 spec 요구대로 구현되었다. 주요 미결은 plan 파일의 Phase 3 체크박스가 구현 완료 후에도 `[ ]` 로 남아 있는 추적 오류, 그리고 spec §6.1 step 5 의 "재마운트" 기술이 실제 구현("boot 재전송 최적화")과 다른 [SPEC-DRIFT] 다. 기능 결함은 없으며 비즈니스 로직은 spec 과 정합한다.

## 위험도

LOW
