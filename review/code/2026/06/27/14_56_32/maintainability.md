### 발견사항

- **[INFO]** `panel.tsx` 내 로딩 판정 인라인 표현식 — 명명 변수 추출 고려
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/webchat-composer-loading/codebase/channel-web-chat/src/widget/components/panel.tsx` — Composer `loading` prop 라인
  - 상세: `loading={phase === "booting" || phase === "streaming"}` 가 JSX 인라인에 직접 위치. 동일 파일에 `isEnded`, `fresh` 등 의미 변수 추출 패턴이 이미 사용됨. 일관성 측면에서 `const isAiProcessing = phase === "booting" || phase === "streaming"` 추출이 자연스럽고 추후 phase 추가 시 수정 지점을 한 곳으로 집중시킬 수 있음.
  - 제안: 함수 본문 상단에 `const isAiProcessing = phase === "booting" || phase === "streaming";` 추출 후 `loading={isAiProcessing}` 로 참조. `disabled` 조건의 `phase !== "awaiting_user_message"` 와도 시각적 대칭이 형성됨.

- **[INFO]** `ComposerProps` — `loading` 만 JSDoc, `disabled`/`placeholder`/`onSend` 미문서화
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/webchat-composer-loading/codebase/channel-web-chat/src/widget/components/composer.tsx` — `ComposerProps` 인터페이스
  - 상세: 이번 PR 에서 `loading` 에 spec 참조 포함 JSDoc 을 추가했으나 기존 세 prop 은 주석 없음. 인터페이스 내 문서화 수준이 불균일해 나중에 `disabled` 의 게이팅 의미를 파악하려면 구현부 또는 호출자를 읽어야 함.
  - 제안: 최소한 `disabled?: boolean; /** 외부 강제 비활성 — §R6 게이팅(phase≠awaiting_user_message / buttons/form 표면). */` 한 줄 추가로 `loading` 과 동등 수준 맞춤. `onSend`/`placeholder` 는 이름에서 의미 자명하므로 생략 가능.

- **[INFO]** `aria-busy={loading || undefined}` 패턴 — React 관례이나 비자명
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/webchat-composer-loading/codebase/channel-web-chat/src/widget/components/composer.tsx` — button 엘리먼트
  - 상세: React 에서 `false` 대신 `undefined` 를 쓰면 해당 attribute 가 DOM 에 렌더링되지 않는다는 관례를 알아야 의도를 읽을 수 있음. `loading` 이 `false` 일 때 `aria-busy="false"` 가 아닌 attribute 미존재가 의도임을 코드만으로는 즉시 알기 어려움.
  - 제안: 인라인 주석 `{/* loading=false 시 attribute 미방출 — undefined 활용 */}` 추가하거나 `aria-busy={loading ? "true" : undefined}` 로 의도를 명시적으로 표현. 기능은 동일하나 가독성 향상.

- **[INFO]** `styles.ts` 내 브랜드 컬러 `#5B4FE9` 중복 — 기존 패턴 일관성 유지이나 리팩토링 시 단일 수정 지점 부재
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/webchat-composer-loading/codebase/channel-web-chat/src/widget/styles.ts` — `.wc-composer-send[aria-busy="true"]:disabled` 규칙
  - 상세: `#5B4FE9` 는 파일 내 이미 7+ 곳에서 사용되던 값이며 이번 PR 이 신규 도입한 문제가 아님. CSS 변수(`--wc-brand`) 또는 상수 분리가 없는 현재 구조에서 신규 규칙이 같은 패턴을 따른 것은 일관성 측면에서 올바름.
  - 제안: 이번 PR 범위 외. 향후 테마 토큰 도입 시 일괄 처리 대상. 현재 변경은 기존 스타일과 동일 컨벤션 유지로 적절.

- **[INFO]** `composer.test.tsx` — `btn.querySelector(".wc-composer-spinner")` CSS 클래스 직접 참조
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/webchat-composer-loading/codebase/channel-web-chat/src/widget/components/composer.test.tsx` — 라인 46, 102, 303 등
  - 상세: 스피너 존재 검증이 CSS 클래스 문자열에 의존. 클래스명 변경 시 테스트도 함께 수정해야 하는 결합. `role` 이나 `data-testid` 를 사용하면 구현-테스트 결합을 낮출 수 있으나, 스피너는 `aria-hidden="true"` 로 접근성 트리에서 제외되어 `getByRole` 사용 불가. 현재 jsdom 환경에서 클래스 기반 조회가 사실상 유일한 실용 방법임.
  - 제안: 현재 방식 유지(대안 없음). 장기적으로 `data-testid="wc-composer-spinner"` 추가를 고려하면 클래스 리팩토링 내성이 생김.

### 요약

이번 변경은 `Composer` 컴포넌트에 `loading` prop 을 추가하고 `Panel` 에서 phase 조건을 전달하는 집중적인 UI 확장이다. 함수 길이·중첩 깊이·순환 복잡도 모두 변경 전후 동일하게 낮고, 명명 컨벤션(`wc-` CSS prefix, `isEnded`/`fresh` 변수 패턴)과 기존 코드베이스 스타일을 일관되게 따른다. `submit` 가드에 `loading` 을 포함시켜 컴포넌트 단독 재사용 시에도 계약이 보장되며, CSS 주석으로 규칙 의도를 명시한 점도 유지보수성을 높인다. 지적 사항은 모두 INFO 수준으로 `isAiProcessing` 변수 추출, `disabled` prop JSDoc 추가, `aria-busy={loading || undefined}` 패턴 명시화 등 소규모 가독성 개선 권고이며 차단 사유는 없다.

### 위험도

NONE
