# 요구사항(Requirement) Review

## 리뷰 대상

Commit `8c5a3a54`: 웹채팅 운영 콘솔 — 인스턴스 관리·외형 빌더·설치 스니펫 (증분 1)  
파일 20개 (page, hooks, libs, i18n, tests)

관련 spec:
- `/Volumes/project/private/clemvion/.claude/worktrees/webchat-console-95fe1e/spec/7-channel-web-chat/5-admin-console.md`
- `/Volumes/project/private/clemvion/spec/7-channel-web-chat/2-sdk.md`
- `/Volumes/project/private/clemvion/spec/7-channel-web-chat/0-architecture.md`
- `/Volumes/project/private/clemvion/.claude/worktrees/webchat-console-95fe1e/plan/in-progress/web-chat-console.md`

---

## 발견사항

### [INFO] spec `5-admin-console.md` 가 worktree 에만 존재 (main 에 미반영)
- 위치: `spec/7-channel-web-chat/5-admin-console.md` (worktree 내 존재, main spec 경로에 없음)
- 상세: 코드가 참조하는 `spec 5-admin-console §4·§5·§6` 은 worktree 내 draft spec 이며 origin/main 에는 아직 없음. 이는 Phase 0 spec 반영 태스크가 미완 상태임을 의미하나(`web-chat-console.md` Phase 0 체크리스트 미완), 코드 자체의 요구사항 충족에는 영향 없음. plan lifecycle 에 따라 PR 머지 전 spec 도 함께 반영돼야 한다.
- 제안: spec Phase 0 체크리스트 완료(spec write) 후 PR 올리거나, 이 PR 과 함께 spec 커밋을 포함한다.

### [WARNING] `useCreateWebChat` — `interaction` 필드가 POST body top-level 로 전송되는지 확인 필요
- 위치: `codebase/frontend/src/components/web-chat/use-web-chat.ts` 라인 2248–2253 (파일 내 구현 기준)
- 상세: spec `5-admin-console §2` 표 「인스턴스 생성」 비고에 **"`interaction` 은 POST body top-level 필드이며 backend 가 저장 시 `config.interaction` 으로 머지"** 라고 명시되어 있다. 구현 코드는:
  ```ts
  await apiClient.post("/triggers", {
    type: "webhook",
    workflowId: input.workflowId,
    name: input.name,
    endpointPath: crypto.randomUUID(),
    interaction: { enabled: true, tokenStrategy: "per_execution" },
  });
  ```
  `interaction` 을 body top-level 에 두고 있어 spec 과 일치한다. 다만 백엔드 `CreateTriggerDto` 가 실제로 `interaction` 을 top-level 로 수용하는지 코드 외부 확인이 필요하다(백엔드 DTO 는 이번 변경 범위에 없음). 현재 코드가 spec 텍스트를 따르고 있으므로 WARNING 으로만 기록.
- 제안: 백엔드 `CreateTriggerDto` (또는 `TriggerController`) 에서 `interaction` 필드 수용 여부를 통합 테스트나 코드 조회로 확인.

### [WARNING] `WebChatPage` 로딩 중(isLoading=true) 상태에서 목록도 없는 경우 렌더 분기 미처리
- 위치: `codebase/frontend/src/app/(main)/web-chat/page.tsx` 라인 533 (`!isLoading && !isError && instances.length === 0`)
- 상세: 조건 `!isLoading && !isError && instances.length === 0` 은 정상 동작이나, `isLoading=true` 이고 `instances=[]` 인 초기 렌더에서는 `else` 브랜치(grid with `instances.map`)가 렌더된다 — `instances` 가 비어있으므로 목록은 표시되지 않고 `<nav>` 만 빈 채로 나오며, `selected`도 null 이므로 `WebChatDetail` 도 렌더되지 않는다. 사실상 로딩 중에는 빈 화면만 보이는데, 로딩 스피너/skeleton 이 없다. spec `5-admin-console §1` 화면 구조에는 이 중간 상태 처리가 명시되어 있지 않지만, 사용자 경험 관점에서 빈 화면은 혼란을 줄 수 있다. 다른 페이지 패턴(trigger-list 등)과의 일관성도 확인 필요.
- 제안: `isLoading` 시 skeleton 또는 loading indicator 를 추가 고려. INFO 수준이나 일관성 차원에서 WARNING 으로 기록.

### [INFO] `CreateWebChatDialog` — `onCreated` 가 `id` 없는 응답에서 호출되지 않음 (silent 무시)
- 위치: `codebase/frontend/src/components/web-chat/create-web-chat-dialog.tsx` 라인 1385–1386
- 상세:
  ```ts
  const id = (created as { id?: string } | undefined)?.id;
  if (id) onCreated?.(id);
  ```
  백엔드 응답 형태가 `data.data` 로 래핑된 경우(`{ data: { id: ... } }`) 와 `data` 직접(`{ id: ... }`) 경우를 고려해야 한다. `normalizePagedResponse` 패턴과 달리 여기서는 `mutateAsync`가 `data` 를 unwrap 한 형태(`apiClient.post` → `{ data }` 구조분해) 반환인데, `created` 는 `data` 의 값이다. 백엔드가 `TransformInterceptor` 로 `{ data: { id } }` 형태를 반환한다면 `created.id` 는 `undefined` 가 되어 `onCreated` 가 호출되지 않는다. 이 경우 신규 생성된 인스턴스가 자동 선택되지 않는다 (첫 인스턴스로 폴백).
- 제안: 백엔드 실제 응답 구조를 확인하고 필요 시 `created?.data?.id ?? created?.id` 형태로 방어.

### [INFO] `useWebChatInstances` — API 파라미터 `type: "webhook"` 와 클라이언트 필터 이중 적용
- 위치: `codebase/frontend/src/components/web-chat/use-web-chat.ts` 라인 2203–2213
- 상세: `GET /api/triggers?type=webhook` 으로 서버에서 webhook 만 받아오고, 추가로 `.filter(t => t.type === "webhook" && t.config?.interaction?.enabled)` 를 클라이언트에서 수행한다. `type === "webhook"` 조건은 서버 필터로 이미 보장되므로 클라이언트 필터에서 중복이다 — spec `5-admin-console §2` 표의 "클라이언트 필터: `type==='webhook' && config.interaction?.enabled`" 와 일치하므로 spec fidelity 상 문제없음. 단 서버가 향후 다른 타입을 섞어 반환하는 상황에 대한 방어적 필터이므로 제거 보다는 유지가 더 안전. 주석 등으로 의도를 명시하면 혼란 방지에 좋음.
- 제안: 해당 filter 주석에 "서버 param 중복이지만 방어 필터" 이유를 간단히 추가. (선택사항)

### [INFO] `useAppearanceDraft` — 렌더 중 `setState` 패턴 (React "storing previous renders")
- 위치: `codebase/frontend/src/components/web-chat/use-appearance-draft.ts` 라인 2011–2013
- 상세: `loadedId !== instanceId` 조건에서 `setLoadedId`·`setDraftState` 를 렌더 중 직접 호출하는 패턴은 React 공식 "Storing information from previous renders" 패턴으로 올바르다. 주석에도 설명이 있다. `react-hooks/set-state-in-effect` lint 규칙 회피가 의도적임이 커밋 메시지에도 명시돼 있다. 요구사항 측면에서 문제 없음.

### [SPEC-DRIFT][WARNING] `5-admin-console.md` spec 은 `code: []` (spec-only) 인데 구현이 먼저 존재함
- 위치: spec `5-admin-console.md` frontmatter `status: spec-only`, `code: []`
- 상세: spec frontmatter 가 `code: []` 로 선언되어 있는데 실제 코드가 이미 구현되었다. plan `web-chat-console.md` Phase 0 체크리스트에 spec 반영이 아직 완료되지 않았음을 보여준다. 이는 코드가 틀린 것이 아니라 **spec 의 `status`·`code` 필드가 아직 갱신되지 않은 것**이다. PR 머지 전 spec 을 `status: partial`, `code: [codebase/frontend/src/app/(main)/web-chat/**, codebase/frontend/src/components/web-chat/**, codebase/frontend/src/lib/web-chat/**]` 로 갱신해야 한다.
- 제안: 코드 유지 + spec `5-admin-console.md` frontmatter 갱신 (`status: partial`, `code:` 경로 추가). plan Phase 0 spec-write 완료 처리.

### [INFO] `snippet.ts` — `buildWebChatSnippet` 스니펫 형태가 spec `2-sdk §1` 과 일치 확인
- 위치: `codebase/frontend/src/lib/web-chat/snippet.ts` / spec `7-channel-web-chat/2-sdk.md §1`
- 상세: spec §1 스니펫 템플릿:
  ```
  (function(d,s){var j=d.createElement(s);j.async=1;
   j.src="...loader.js"; d.head.appendChild(j);})(document,"script");
  ```
  구현 `buildWebChatSnippet` 출력:
  ```
  <script>(function(d,s){var j=d.createElement(s);j.async=1;
    j.src="<loaderSrc>";d.head.appendChild(j);})(document,"script");</script>
  ```
  구조적으로 일치. `d.head.appendChild(j)` 위치·형태·`j.async=1` 모두 동일. XSS 이스케이프(`</script>` → `<\/script>`)는 spec 에 명시되지 않은 개선이며 보안상 올바르다. (SPEC-DRIFT 로 별도 기록 불필요 — 보안 강화로 분명히 옳음.)

### [INFO] `BootConfig` 필드 완전성 — `profile` 필드 누락 (의도적)
- 위치: `codebase/frontend/src/lib/web-chat/snippet.ts` `WebChatBootInput` / spec `2-sdk.md §4 BootConfig`
- 상세: spec §4 `BootConfig` 에는 `profile?: Record<string, unknown>` 필드가 있다. `WebChatBootInput` 에는 `profile` 이 없다. 이는 콘솔 스니펫 빌더가 **운영자 편의 외형 빌더**이며 `profile`(사용자 식별 정보)은 호스트 사이트 개발자가 직접 주입하는 동적 값이므로 콘솔 UI 에서 편집 대상이 아니다. 의도적 누락. 코드 버그 아님.

### [SPEC-DRIFT][WARNING] `5-admin-console.md §5` fallback 정책 — "동봉 번들 없을 때만 비활성" 이지만 구현은 항상 스니펫 렌더
- 위치: `spec/7-channel-web-chat/5-admin-console.md §5` vs `codebase/frontend/src/components/web-chat/install-snippet-box.tsx`
- 상세: spec §5 fallback: **"동봉 번들 자체가 없을 때만 스니펫/미리보기 UI 를 비활성 + 경고로 노출"**. 증분 1 구현은 `isWidgetHostingConfigured()` 체크 없이 항상 스니펫을 렌더한다 (`InstallSnippetBox` 는 조건 없이 렌더됨). `getWidgetLoaderUrl()` 가 SSR 시 빈 문자열을 반환하는 경우 스니펫의 loader URL 이 빈 문자열이 되는 경로가 존재한다. 단, 이 컴포넌트는 `"use client"` 이므로 SSR 에서 렌더되지 않으며, 브라우저 환경에서는 `getWidgetBase()` 가 self-origin 을 반환해 항상 유효한 URL 이 생성된다. 즉 브라우저에서는 dead URL 이 생성되지 않는다. **현재 증분 1 에서는 동봉 번들 존재 여부 확인이 불가능**(Phase 1 미완)하므로 이 fallback 을 구현할 수 없는 상태가 맞다. 따라서 코드가 틀린 것은 아니나, spec 이 증분 2(Phase 1 완료) 전까지의 동작을 기술하지 않고 있다. 코드 유지 + spec §5 에 "Phase 1(동봉 빌드) 완료 전까지는 fallback 체크 없이 self-origin URL 생성" 을 명시 필요.
- 제안: 코드 유지 + spec `5-admin-console.md §5 fallback` 에 Phase 1 전 동작 명시. (project-planner 위임)

### [INFO] `WebChatPage` — `isLoading=true` 일 때 빈 목록으로 else 브랜치 진입 시 NavItems 렌더 버그 없음
- 위치: `page.tsx` 라인 533 `!isLoading && !isError && instances.length === 0`
- 상세: 로딩 중 `instances = []`, `isLoading = true` → 조건 false → else(`<div className="grid...">`) 렌더 → `instances.map` 은 빈 배열이라 아무 것도 렌더하지 않음 → `selected = null` 이라 `WebChatDetail` 도 렌더 안 됨. 빈 grid div 만 렌더되어 시각적으로는 빈 화면. 기능적 버그는 아니나 UX 개선 여지.

---

## 요약

증분 1 코드는 plan `web-chat-console.md §증분 전략` 에서 정의한 Phase 2 콘솔 코어 + Phase 1 env 유틸 범위를 완전히 구현하고 있다. spec `5-admin-console.md §2~§5·§7·§8` 과 `2-sdk.md §4 BootConfig` 의 핵심 요구사항 — 인스턴스 필터링(`interaction.enabled` webhook), 생성(`crypto.randomUUID` endpointPath, `POST /api/triggers` top-level `interaction`), 외형 빌더(BootConfig 필드, localStorage 보존), 스니펫 생성(`ClemvionChat('boot', ...)`), 복사(useCopyToClipboard), RBAC(viewer 조회/복사, editor+ 생성), i18n(ko/en parity), XSS 이스케이프 — 모두 spec 과 line-level 로 일치한다. 테스트도 interaction 필터, RBAC, 스니펫 endpointPath 포함, XSS 이스케이프를 직접 검증한다. 두 가지 SPEC-DRIFT(spec frontmatter `code:[]` 미갱신, fallback 정책 Phase 1 전 동작 미기술)는 코드가 옳고 spec 이 낡은 것이며 code fix 대상이 아니다. 유일한 기능적 주의 사항은 `onCreated` 콜백에서 백엔드 응답 래핑 형태 미확인(WARNING)과 로딩 중 skeleton 부재(UX, WARNING)다.

---

## 위험도

LOW
