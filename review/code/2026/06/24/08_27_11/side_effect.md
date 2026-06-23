# 부작용(Side Effect) 리뷰

리뷰 대상: 웹채팅 운영 콘솔(증분 2) — spec 갱신, 일관성 검토 산출물, 구현 코드 변경

---

## 발견사항

### [INFO] `useUpdateWebChatAppearance` — interaction.enabled 하드코딩으로 인한 silent state mutation
- 위치: `codebase/frontend/src/components/web-chat/use-web-chat.ts` line 159
- 상세: `PATCH /api/triggers/:id` 시 `interaction.enabled: true`를 하드코딩한다. 백엔드 `mergeExternalConfig`는 interaction 키를 통째로 교체하므로, 만약 이 훅이 interaction이 비활성화된 인스턴스에 호출되면 `enabled`를 `true`로 조용히 변경하는 의도치 않은 상태 변경이 발생한다. 현재 이 훅은 `useWebChatInstances`의 `interactionEnabled=true` 필터를 통과한 인스턴스에만 사용되므로 실제 호출 경로에서는 문제가 없다. 단, 훅이 내부 JSDoc에 제약을 명기하고 있어 인지되어 있으나, 외부에서 재사용 시 silent mutation 위험이 잠재한다.
- 제안: 훅 JSDoc에 이미 경고가 명기되어 있어 현 상태 수용 가능. 추후 웹채팅 콘솔 외 컨텍스트에서 재사용할 경우 `enabled` 값을 파라미터로 받도록 시그니처 확장을 고려할 것.

### [INFO] `use-appearance-draft.ts` — localStorage 전역 공간에 `clemvion:web-chat:appearance:<id>` 키 도입
- 위치: `codebase/frontend/src/components/web-chat/use-appearance-draft.ts` line 35–36, 64, 111
- 상세: `KEY_PREFIX = "clemvion:web-chat:appearance:"` 형태로 인스턴스 ID별 키를 localStorage에 기록한다. 이 키 네임스페이스는 기존 코드에 없던 신규 전역 영속 상태이다. 브라우저를 공유하는 운영자 간에는 localStorage가 origin-isolated되어 있어 충돌은 없다. 단, 다른 도메인 기능이 동일 prefix를 사용하거나, 인스턴스 삭제 시 해당 키를 정리하는 로직이 없어 localStorage에 孤兒(orphaned) 엔트리가 누적될 수 있다.
- 제안: 인스턴스 삭제 흐름(trigger 삭제 성공 시)에서 `localStorage.removeItem(KEY_PREFIX + id)` 정리를 추가하면 스토리지 누출을 방지할 수 있다. 현재는 기능 결함이 아닌 점진적 누적 문제.

### [INFO] `copy-widget.mjs` — `rmSync`→`cpSync` 비원자적 파일시스템 조작
- 위치: `codebase/frontend/scripts/copy-widget.mjs` line 54–57
- 상세: `rmSync(dest, { recursive: true, force: true })` 후 `cpSync(...)`를 수행하는 비원자적 순서로, 서버가 요청을 처리 중일 때 이 스크립트가 실행되면 `/_widget/web-chat/v1/` 디렉토리가 일시적으로 비어 있는 상태가 발생할 수 있다. 스크립트 자체의 주석(`빌드타임 전용 스텝 — 앱이 서빙 중일 때 실행하지 않는다`)에서 이 제약을 명시하고 있다. 운영 환경에서 CI/CD 빌드 단계(next build 전)로만 실행되는 정상 사용 경로에서는 문제가 없다.
- 제안: 주석이 이미 제약을 명기하고 있어 현 상태 수용 가능. blue-green 배포 환경에서는 이 비원자성이 문제가 되지 않으므로 INFO로 유지.

### [INFO] `copy-widget.mjs` — `execSync`를 통한 하위 프로세스 실행 및 환경변수 전파
- 위치: `codebase/frontend/scripts/copy-widget.mjs` line 38
- 상세: `execSync(cmd, { env: { ...process.env, ...env } })`로 현재 프로세스의 전체 환경변수를 빌드 서브프로세스에 전달한다. `cmd`는 정적 리터럴(`pnpm --filter <패키지> build`)이어서 인젝션 표면은 없다. 단, 호출 환경에 민감한 CI 시크릿이 노출된 경우 서브프로세스로 전파될 수 있다. 이는 Node.js 빌드 스크립트의 일반적인 패턴이며 명시적 위험은 아니다.
- 제안: 현 상태 수용. `env` 전달이 필요한 이유(pnpm/next 빌드가 PATH·HOME에 의존)가 주석에 명기되어 있다.

### [INFO] `live-preview.tsx` — `window.addEventListener("message", ...)` 전역 이벤트 리스너 등록
- 위치: `codebase/frontend/src/components/web-chat/live-preview.tsx` line 83–100
- 상세: `useEffect` 안에서 `window.addEventListener("message", onMessage)`를 등록하고 cleanup에서 `removeEventListener`로 정리한다. cleanup은 올바르게 구현되어 있다. 단, `onMessage`는 `e.source !== iframeRef.current?.contentWindow` 검사로 출처를 제한하고 있어, 다른 iframe의 postMessage가 혼입되는 위험은 방어된다. React Strict Mode 이중 실행 시 effect가 두 번 실행되지만 cleanup이 반드시 따라오므로 중복 등록은 없다.
- 제안: 이상 없음. 이벤트 처리 경계가 명확히 설계되어 있다.

### [INFO] `QueryTriggerDto.interactionEnabled` — Transform 변환 시 `'false'` 외 falsy 값 처리
- 위치: `codebase/backend/src/modules/triggers/dto/query-trigger.dto.ts` line 42
- 상세: `@Transform(({ value }) => value === true || value === 'true')` 변환은 `'false'`, `false`, `undefined`가 아닌 다른 값(예: `'0'`, `'no'`, `''`)을 모두 `false`로 변환한다. 현재 클라이언트(`use-web-chat.ts`)는 `interactionEnabled: true`만 전달하므로 실제 호출 경로에서는 문제없다. 단, 외부 API 호출자가 예상치 못한 값을 전달할 경우 `interactionEnabled=false`로 해석되어 의도와 다른 필터링이 일어날 수 있다.
- 제안: 현 명세 범위에서는 `true`/'true'만 의미 있는 값이므로 실질적 위험이 낮다. JSDoc에 유효 값(`'true'`/`'false'`)을 명기하면 명확성이 높아진다.

### [INFO] `triggers.service.ts` — `findAll` 시그니처에 `interactionEnabled` 파라미터 추가
- 위치: `codebase/backend/src/modules/triggers/triggers.service.ts` line 80–83
- 상세: `findAll` 메서드의 query 타입이 `PaginationQueryDto & { type?: string; status?: string; interactionEnabled?: boolean }` 로 확장됐다. 이는 인터페이스 상의 additive 변경으로, 기존 호출자(`TriggersController.findAll`)가 `interactionEnabled`를 전달하지 않으면 그냥 `undefined`로 처리되어 필터가 적용되지 않는다. 기존 트리거 화면은 이 파라미터를 전달하지 않으므로 동작이 변경되지 않는다. 하위 호환성 유지된다.
- 제안: 이상 없음.

### [INFO] `TriggerListItem` / `WebChatAppearanceConfig` — 공유 타입 신규 도입으로 기존 로컬 인터페이스와의 이중 정의 잠재
- 위치: `codebase/frontend/src/lib/types/trigger.ts`
- 상세: `TriggerListItem`은 신규로 도입된 공유 타입 파일이다. 이전에는 각 화면(트리거 목록, 웹채팅 등)이 로컬 인터페이스를 가지고 있었을 가능성이 있다. 해당 파일의 JSDoc이 "로컬 인터페이스로 중복 정의하던 것을 단일 출처로 모은다"고 명시하고 있어, 기존 로컬 인터페이스와의 혼용이 아직 남아 있다면 타입 불일치가 발생할 수 있다.
- 제안: 트리거 목록 화면(`triggers/page.tsx`) 등에서 이전 로컬 타입을 여전히 사용 중인지 확인이 필요하다. 현재 리뷰 범위의 변경으로 인한 직접적 부작용은 없다.

### [INFO] `getWidgetBase()` — SSR 환경에서 빈 문자열 반환 및 후속 URL 무결성
- 위치: `codebase/frontend/src/lib/web-chat/widget-base.ts` line 29–38
- 상세: SSR 컨텍스트(`typeof window === "undefined"`)이고 `NEXT_PUBLIC_WIDGET_CDN_BASE`가 미설정인 경우 빈 문자열을 반환한다. 이를 사용하는 `getWidgetLoaderUrl()`은 `/web-chat/v1/loader.js`처럼 origin 없는 경로를 반환해 클라이언트 환경에서 상대 URL로 동작할 수 있다. `isWidgetHostingConfigured()`가 SSR+미설정 케이스를 false로 반환하므로, 이 케이스에서 스니펫/미리보기 UI가 비활성화되어 실제 잘못된 URL이 사용자에게 노출될 위험은 낮다.
- 제안: `isWidgetHostingConfigured()` 가드가 올바르게 활용되는지 UI 레이어에서 확인 권장. 현재는 이상 없음.

### [INFO] `sidebar.tsx` — 전역 네비게이션 항목 순서 변경이 사이드바 상태(collapse 등)에 미치는 영향
- 위치: `codebase/frontend/src/components/layout/sidebar.tsx` (MessageCircle/Web Chat 항목 추가)
- 상세: 사이드바 `navItems` 배열에 Web Chat 항목을 Position 5로 추가(Schedule 다음)하면서 이하 항목의 배열 인덱스가 밀린다. `useSidebarStore`가 상태를 항목 인덱스가 아닌 pathname 기반으로 관리한다면 문제없다. 만약 localStorage 등에 인덱스 기반으로 collapse 상태를 캐시하고 있다면 기존 사용자의 사이드바 상태가 의도치 않게 변경될 수 있다.
- 제안: `useSidebarStore`의 상태 키가 pathname 기반인지 인덱스 기반인지 확인이 권장된다. 일반적으로 pathname 기반이므로 낮은 위험으로 판단.

---

## 요약

이번 변경은 spec 문서(`review/consistency/`, `spec/`), 일관성 검토 산출물, 그리고 웹채팅 운영 콘솔 구현 코드(프론트엔드 컴포넌트·백엔드 DTO·빌드 스크립트)로 구성된다. 부작용 관점에서 심각한 의도치 않은 상태 변경은 발견되지 않았다. 가장 주목할 만한 사항은 (1) `useUpdateWebChatAppearance`가 `interaction.enabled: true`를 하드코딩해 웹채팅 콘솔 외 컨텍스트에서 재사용될 경우 silent mutation 위험이 있으나 현재 호출 경로는 안전하게 제한되어 있고, (2) `use-appearance-draft.ts`가 localStorage에 인스턴스별 키를 영속화하지만 인스턴스 삭제 시 정리 로직이 없어 orphaned 엔트리가 누적될 수 있다는 점이다. 공개 API 변경(`QueryTriggerDto.interactionEnabled` 추가, `findAll` 시그니처 확장)은 모두 additive하며 기존 호출자 동작을 변경하지 않는다. 이벤트 리스너(`window.addEventListener("message", ...)`)는 cleanup이 올바르게 구현되어 있다. 파일시스템 부작용(`copy-widget.mjs`의 rmSync→cpSync)은 빌드타임 전용 제약이 주석으로 명기되어 있어 운영 환경에서는 문제가 없다.

---

## 위험도

LOW

STATUS: OK
