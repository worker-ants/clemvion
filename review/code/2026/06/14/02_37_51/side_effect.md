# 부작용(Side Effect) 리뷰 결과

## 발견사항

### [WARNING] `ServerTheme` 타입이 `'system'` 을 포함하지 않아 frontend 타입 불일치 발생
- 위치: `/Volumes/project/private/clemvion/codebase/frontend/src/lib/api/users.ts` line 3
- 상세: backend `USER_THEMES` 가 `['light', 'dark', 'system']` 으로 확장됐으나, frontend 의 `ServerTheme = "light" | "dark"` 는 그대로다. 서버가 `theme: "system"` 을 반환했을 때 TypeScript 타입 오류는 없지만 — `UserProfile.theme` 는 `string` 으로 선언되어 있어 런타임 TypeError 는 발생하지 않음 — `ProfilePreferencesCard` 가 `user: { theme: ServerTheme }` prop 을 받으므로, `profile/page.tsx` 에서 `UserProfile.theme` (`string`) 를 `ServerTheme` (`"light" | "dark"`) 에 할당할 때 실질적인 타입 불일치가 발생한다. 이 PR 범위에서 수정되지 않았다.
- 제안: `frontend/src/lib/api/users.ts` 의 `ServerTheme` 을 `"light" | "dark" | "system"` 으로 확장한다. 이는 별도 frontend PR 로 예정되어 있으나, backend 변경과 함께 동시에 처리하는 것이 타입 안전성 측면에서 바람직하다.

### [WARNING] `profile/page.tsx` 의 theme 동기화 guard 가 `'system'` 을 제외함
- 위치: `/Volumes/project/private/clemvion/codebase/frontend/src/app/(main)/profile/page.tsx` line 53
- 상세: `if (user.theme === "light" || user.theme === "dark") setTheme(user.theme);` 조건이 `'system'` 을 명시적으로 제외하고 있다. 따라서 사용자가 서버에 `theme: "system"` 을 저장했더라도, 프로필 페이지 로드 시 theme store 에 동기화되지 않고 현재 store 값(`'light'` 기본값 또는 이전 값)이 유지된다. 이는 서버 상태와 클라이언트 상태가 불일치하는 의도치 않은 부작용이다.
- 제안: `theme-store` 가 이미 `'system'` 을 지원하므로(`theme: "light" | "dark" | "system"`), 조건을 `if (["light", "dark", "system"].includes(user.theme)) setTheme(user.theme as ...)` 으로 확장하거나, `ServerTheme` 확장 후 타입 체크를 제거해야 한다. 단, frontend UI 토글에 System 옵션이 없는 현재 상태에서는 사용자가 `'system'` 을 새로 선택할 수 없으므로, 기존에 `'system'` 이 저장된 사용자만 영향받는다.

### [WARNING] `ProfilePreferencesCard` 의 `themeLabel` 함수가 `'system'` 값에 대해 fallback 으로 `'Light'` 레이블을 반환함
- 위치: `/Volumes/project/private/clemvion/codebase/frontend/src/app/(main)/profile/components/profile-preferences-card.tsx` lines 110-111, 133-134
- 상세: `themeLabel = (val: ServerTheme) => val === "dark" ? themeDark : themeLight` 는 `val === "system"` 인 경우 `themeLight` 를 반환한다. `themeReadonlyLabel` 도 동일하게 `"dark"` 가 아니면 `themeLight` 를 표시한다. DB 에 `'system'` 이 저장된 사용자가 프로필 화면을 보면 "Light" 로 표시되는 오해를 일으키는 UI 부작용이 발생한다.
- 제안: `themeLabel` 과 `themeReadonlyLabel` 에 `'system'` 분기를 추가하고, i18n 키(`profile.themeSystem`)를 도입한다. 이 역시 frontend PR 예정이지만, 서버에 `'system'` 저장 가능성이 열린 시점부터 UX 부작용이 즉시 발생한다.

### [INFO] `UserTheme` 타입 확장이 backend 내부 호출자에 미치는 영향 확인
- 위치: `/Volumes/project/private/clemvion/codebase/backend/src/modules/users/dto/update-me.dto.ts`
- 상세: `UserTheme = "light" | "dark"` 에서 `"light" | "dark" | "system"` 으로 확장됐다. backend 내 `UserTheme` 을 참조하는 코드가 `if (theme === "light" || theme === "dark")` 방식으로 exhaustive check 를 하고 있다면 `'system'` 누락이 발생할 수 있다. 현재 확인된 범위에서 backend 는 `USER_THEMES` 를 `IsIn` 유효성 검사에만 사용하고 있어 추가 분기 로직은 없으므로 직접적인 부작용은 없다. DB 컬럼 `varchar(10)` 도 `'system'` 6자를 수용한다.
- 제안: 별도 조치 불요. 현재 구현 패턴(저장·반환만)에서는 안전하다.

### [INFO] plan 문서 변경은 상태 부작용 없음
- 위치: `plan/in-progress/spec-sync-user-profile-gaps.md`, `spec/2-navigation/9-user-profile.md`
- 상세: 마크다운 문서만 수정하므로 런타임 부작용 없음. 체크박스 상태 변경과 설명 보강이 전부이며 기능 동작에 영향을 주지 않는다.

---

## 요약

이번 변경의 핵심인 `USER_THEMES` 에 `'system'` 추가는 backend DTO 범위에서는 안전하다 — DB varchar(10) 수용, migration 불요, `IsIn` 검사만 사용하므로 추가 분기 로직 영향 없음. 그러나 backend 변경이 frontend 와 동기화되지 않은 상태에서 서버가 `'system'` 을 수용하기 시작함으로써 frontend 에 즉각적인 부작용이 생긴다: `ServerTheme` 타입 불일치, `profile/page.tsx` 의 theme store 동기화 누락(`'system'` guard 제외), `ProfilePreferencesCard` 의 잘못된 레이블 표시("System" 저장 사용자에게 "Light" 표시). 이 세 가지는 모두 frontend-only 변경으로 해소 가능하며, 현재 UI 에서 사용자가 `'system'` 을 새로 선택할 방법이 없어 기존 사용자(이전에 `'system'`이 저장된 경우)만 영향받는다는 점에서 즉각적인 서비스 장애는 아니나, 타입 안전성과 UI 정합성 관점에서 조기 수정이 권장된다.

---

## 위험도

MEDIUM
