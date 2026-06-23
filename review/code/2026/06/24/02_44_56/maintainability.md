# 유지보수성(Maintainability) 리뷰

## 발견사항

### [INFO] `seedDraft` 가 `useState` 초기화에서 두 번 호출됨
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/webchat-console-95fe1e/codebase/frontend/src/components/web-chat/use-appearance-draft.ts` 줄 99–105
- 상세: `useState<WebChatDraft>(() => seedDraft(...))` 와 `useState<string>(() => JSON.stringify(seedDraft(...)))` 두 곳이 각각 독립적으로 `seedDraft`를 호출한다. `seedDraft` 내부에서 `readLocalDraft`(localStorage 읽기)·`sanitizeDraft`(JSON 파싱)가 중복 실행된다. 기능적 문제는 없으나, 불필요한 연산이 두 번 발생한다.
- 제안: lazy init 에서 `const initial = seedDraft(instanceId, serverAppearance)` 로 한 번 계산한 뒤 두 `useState`에 전달하는 헬퍼 함수로 묶거나, `useReducer` 하나로 초기 상태(draft + savedJson)를 합산한다.

---

### [INFO] `useUpdateWebChatAppearance` 의 타입 파라미터가 과도하게 `unknown`
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/webchat-console-95fe1e/codebase/frontend/src/components/web-chat/use-web-chat.ts` 줄 ~143
- 상세: `useMutation<unknown, unknown, UpdateWebChatAppearanceInput>` 에서 응답 타입과 에러 타입이 모두 `unknown`이다. 응답은 `data` 키만 사용하지 않으므로 허용 가능하나, 에러 타입을 `Error | unknown`(`AxiosError` 등)으로 좁히면 `catch` 블록의 타입 안전성이 높아진다.
- 제안: 에러 타입을 `Error`로 명시하거나, 프로젝트에서 공통으로 사용하는 API 에러 타입을 적용한다.

---

### [INFO] `clamp` 유틸 함수가 로컬에 중복 정의될 여지
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/webchat-console-95fe1e/codebase/frontend/src/components/web-chat/live-preview.tsx` 줄 ~47
- 상세: `function clamp(n, min, max)` 가 `live-preview.tsx` 파일 내부에만 정의되어 있다. 프로젝트에 `@/lib/utils` 경로가 존재하고 `cn` 등 유틸이 이미 있으므로, 다른 컴포넌트에서도 범위 clamp 가 필요해질 때 중복 정의가 생길 수 있다.
- 제안: 즉각 이동이 필요한 수준은 아니나, `@/lib/utils/math.ts` 등에 공용 `clamp` 를 두는 방향을 백로그에 등록한다. 현 파일 내 배치는 단기적으로 허용 가능.

---

### [INFO] `PANEL_BOX` / `LAUNCHER_BOX` 상수가 `styles.ts` 치수와 별도 유지됨
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/webchat-console-95fe1e/codebase/channel-web-chat/src/widget/widget-app.tsx` 줄 ~15–16
- 상세: `PANEL_BOX = { width: 392, height: 572 }`, `LAUNCHER_BOX = { width: 392, height: 132 }` 가 주석으로 `styles.ts` 치수에서 유도됐다고 설명되어 있으나, 소스 파일 간 단일 출처가 아니다. `styles.ts` 수치가 바뀌면 이 상수를 수동 동기화해야 한다.
- 제안: `styles.ts`(또는 공용 레이아웃 상수 파일)에서 이 값들을 export 하고 `widget-app.tsx`가 import 하도록 바꾸면 유지보수 부담이 줄어든다. 현재는 주석으로 출처를 명시했으므로 직접적인 버그 위험은 낮지만, 향후 레이아웃 변경 시 sync 실수 위험이 있다.

---

### [INFO] `mockConsole` 함수의 stateful `triggers` 배열이 테스트 간 격리 미확인
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/webchat-console-95fe1e/codebase/frontend/e2e/web-chat/console.spec.ts` 줄 ~56–80
- 상세: `mockConsole(page, initial)` 내부에서 `const triggers = [...initial]` 로 복사본을 만들어 stateful하게 관리하는 설계는 각 `test` 가 독립된 `mockConsole` 호출로 시작하면 격리되므로 문제없다. 다만 함수 시그니처가 `initial: unknown[]` 에서 `initial: Record<string, unknown>[]` 로 좁혀진 것은 e2e 헬퍼에서 `WEBCHAT_INSTANCE` 와 타입이 일치하지 않을 경우 런타임 오류 없이 조용히 잘못된 데이터를 쓸 수 있다. 타입 선언이 느슨하다.
- 제안: `WEBCHAT_INSTANCE` 의 타입을 `WebChatInstance` 형태의 인터페이스로 좁히거나, `mockConsole` 파라미터 타입을 명확히 한다. 테스트 파일 내이므로 차단 수준은 아니다.

---

### [INFO] `otherProviders` 함수가 테스트 파일 최상단 단순 배열 반환으로 충분할 수 있음
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/webchat-console-95fe1e/codebase/backend/src/modules/triggers/triggers.web-chat.spec.ts` 줄 ~2–28
- 상세: `otherProviders(): Provider[]` 가 인자 없는 순수 배열 팩토리다. 함수로 분리한 이유가 없으므로 `const OTHER_PROVIDERS: Provider[]` 상수로 선언해도 동일한 효과를 얻는다. 두 `describe` 블록이 `makeService` 를 통해 간접 사용하므로 불필요한 함수 호출 계층이 추가된다.
- 제안: `const OTHER_PROVIDERS = [...] as Provider[]` 상수로 변경해 코드 의도를 명확히 한다. 변경 영향 없음.

---

### [INFO] `WebChatDraft` 와 `WebChatAppearanceConfig` 가 사실상 동일 형태이나 분리 유지
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/webchat-console-95fe1e/codebase/frontend/src/components/web-chat/use-appearance-draft.ts` + `/Volumes/project/private/clemvion/.claude/worktrees/webchat-console-95fe1e/codebase/frontend/src/lib/types/trigger.ts`
- 상세: `WebChatDraft`(프런트 폼 상태)와 `WebChatAppearanceConfig`(공유 타입)은 필드 구성이 완전히 동일하다. `WebChatDraft`는 `locale` 등 필드가 필수(`"ko" | "en"`)인 반면 `WebChatAppearanceConfig`는 전체 optional 이라는 점에서 의미적 차이가 있다. 코드 주석에 이 이유가 명시되어 있지 않아 향후 유지보수자가 혼동할 여지가 있다.
- 제안: `use-appearance-draft.ts` JSDoc에 "폼 상태는 모든 필드가 필수인 반면 서버 타입은 전체 optional" 임을 명시하면 이 두 타입의 의도적 분리가 명확해진다.

---

### [INFO] `hasServerAppearance` 판별 기준이 `""` 빈 문자열도 포함하여 의미 모호
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/webchat-console-95fe1e/codebase/frontend/src/components/web-chat/use-appearance-draft.ts` 줄 ~71
- 상세: `Object.values(a).some((v) => v !== undefined && v !== "")` 에서 빈 문자열 `""` 를 "없는 것"으로 처리한다. 운영자가 의도적으로 `headerTitle`을 공백 문자열로 저장한 경우 서버 appearance 가 없다고 오판할 수 있다. 실제로는 서버가 저장 전 validation(`@MaxLength(80)` + `@IsString()`)을 통과한 값을 보내므로 빈 문자열이 저장되는 경우가 없다면 문제없으나, 방어 로직의 의도가 코드에서 불분명하다.
- 제안: 주석에 "서버 응답에서 빈 문자열은 저장되지 않으므로 이 분기는 실질적으로 발생하지 않는다" 또는 단순히 `v !== undefined` 만으로 조건을 좁힌다.

---

## 요약

전체 변경은 유지보수성 관점에서 매우 양호하다. 공유 타입 파일(`lib/types/trigger.ts`) 신설로 여러 컴포넌트에 분산되어 있던 인라인 인터페이스 중복이 제거되었고, e2e `mockAuth` 공용 헬퍼 추출로 테스트 코드 중복도 해소되었다. `copy-widget.mjs`의 매직 문자열 상수화, `CreateWebChatButton` 컴포넌트 추출, `WebChatAppearanceDto` DTO 분리 등 각 변경이 단일 책임 원칙을 잘 따른다. 발견된 사항은 모두 INFO 수준으로, 기능적 결함이나 차단 요소 없이 코드베이스 전반의 일관성과 스타일을 잘 유지하고 있다. 다만 `seedDraft` 이중 호출, `PANEL_BOX`/`LAUNCHER_BOX` 상수의 `styles.ts` 동기화 부채, `clamp` 유틸의 단일 파일 한정 정의 등 소규모 개선 여지가 존재한다.

## 위험도

LOW
