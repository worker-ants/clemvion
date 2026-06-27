# Testing 리뷰

## 발견사항

### [WARNING] Composer 컴포넌트 단위 테스트 부재
- 위치: `codebase/channel-web-chat/src/widget/components/` (컴포넌트 디렉터리 전체)
- 상세: `composer.tsx` 에 `loading` prop 이 추가되었으나, `Composer` 컴포넌트 전용 테스트 파일(`composer.test.tsx`)이 존재하지 않는다. 현재 `panel.test.tsx`, `presentations.test.tsx` 만 존재. 새로운 `loading` prop 의 동작(스피너 렌더링, `aria-busy` 어트리뷰트, `aria-label` 전환)은 `Panel` 통합 경로를 통해서만 간접 검증된다. `Panel`의 `loading` 계산 로직이 바뀌면 `Composer` 자체의 렌더링 분기는 회귀 포착이 늦어진다.
- 제안: `composer.test.tsx` 를 생성해 `loading=true` / `loading=false` / `loading=undefined` 각각에서 (1) `aria-label` 값, (2) `aria-busy` 유무, (3) 스피너 엘리먼트 존재 여부를 `Composer` 단독 렌더로 검증하는 3–5개 케이스를 추가한다.

### [WARNING] `loading=true` + `disabled=false` 조합 미검증 — 컴포넌트 API 계약 갭
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/webchat-composer-loading/codebase/channel-web-chat/src/widget/components/composer.tsx` L39, L17–18
- 상세: 버튼의 `disabled` 판정은 `disabled || !text.trim()` 이고, `submit` 핸들러 가드도 `!trimmed || disabled` 다. `loading` 은 두 가드 어디에도 포함되지 않는다. `Panel`은 항상 `loading=true` 일 때 `disabled=true` 도 함께 전달하므로 실제 경로에서는 문제없다. 그러나 `Composer` 를 독립 재사용할 경우 `loading=true, disabled=false` + 텍스트 입력 상태에서 버튼 클릭 또는 Enter 제출이 막히지 않는다. 스피너를 표시하면서 동시에 `onSend` 가 호출될 수 있는 컴포넌트 수준 버그.
- 제안: `submit` 핸들러에 `if (!trimmed || disabled || loading) return;` 를 추가하거나, 버튼 `disabled` 에 `loading` 을 포함(`disabled={disabled || loading || !text.trim()}`)해 컴포넌트 자체에서 계약을 강제한다. 이후 해당 케이스를 테스트로 보강한다.

### [INFO] booting 테스트가 streaming 테스트보다 검증 범위가 좁음
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/webchat-composer-loading/codebase/channel-web-chat/src/widget/components/panel.test.tsx` L197–207 (booting 케이스)
- 상세: `streaming` 케이스는 `aria-busy`, `disabled`, 스피너 존재, 입력 비활성까지 4항목을 확인하는 반면, `booting` 케이스는 `aria-busy` 하나만 확인한다. `booting` 상태에서도 스피너와 입력 비활성은 동일하게 기대되는 동작이므로, 두 케이스 간 일관성이 없다.
- 제안: booting 케이스에도 `btn.querySelector(".wc-composer-spinner")`, `btn.toBeDisabled()`, `getByLabelText("메시지 입력").toBeDisabled()` 를 추가해 streaming 케이스와 동등한 수준으로 검증한다.

### [INFO] BASE_ACTIONS mock 리셋 없음
- 위치: `panel.test.tsx` L239–244
- 상세: `BASE_ACTIONS` 의 `vi.fn()` 들이 테스트 간 `beforeEach(() => vi.clearAllMocks())` 없이 공유된다. 현재 새로 추가된 테스트는 mock 호출 횟수를 검사하지 않으므로 즉각적인 오류는 없다. 그러나 향후 호출 횟수나 인자를 검증하는 테스트가 추가되면 누적 호출로 false-positive/negative 가 발생할 수 있다.
- 제안: `describe` 블록 상단 또는 전역에 `beforeEach(() => { vi.clearAllMocks(); })` 를 추가한다.

### [INFO] CSS/스타일 변경(`styles.ts`) 테스트 없음
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/webchat-composer-loading/codebase/channel-web-chat/src/widget/styles.ts`
- 상세: `wc-composer-send:disabled` 의 `background` 색상 변경, `wc-composer-send[aria-busy="true"]:disabled` 규칙, `@keyframes wc-spin` 추가는 CSS-in-JS 문자열 리터럴이므로 jsdom 환경에서 실제 computed style 을 검증하기 어렵다. 현재 어떤 테스트도 이를 커버하지 않는다. 프로젝트 전반에서도 스타일 회귀 테스트 방식이 정의되어 있지 않으므로, 이 점은 이번 PR 의 독립적 문제가 아니다.
- 제안: 단기 조치 불필요. 장기적으로 시각 회귀 테스트(Chromatic/Percy 등) 또는 스타일 문자열 스냅샷 테스트 도입을 검토한다.

---

## 요약

핵심 통합 시나리오(streaming·booting·awaiting 3상태) 에 대한 회귀 테스트가 추가되어 기본 커버리지는 충족되었다. 그러나 `Composer` 컴포넌트 자체에 대한 단위 테스트 파일이 없고, `loading` prop 이 `submit` 핸들러 및 버튼 `disabled` 판정에 포함되지 않아 `loading=true, disabled=false` 조합에서 실제 전송이 가능한 API 계약 갭이 있다. Panel 이 항상 두 prop 을 함께 전달하므로 현재 런타임 경로에서는 미발현되지만, `Composer` 를 독립 사용하거나 향후 조건 분기가 변경될 때 버그로 이어질 수 있으므로 WARNING 으로 분류한다. booting 케이스 검증 미흡, mock 리셋 누락은 INFO 수준 개선 사항이다.

## 위험도

LOW
