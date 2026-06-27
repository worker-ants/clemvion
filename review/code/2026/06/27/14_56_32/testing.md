### 발견사항

- **[INFO]** `loading=true, disabled=false` 조합에서 입력 필드가 비활성화되지 않음 — 단위 테스트 미검증
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/webchat-composer-loading/codebase/channel-web-chat/src/widget/components/composer.test.tsx` 테스트 2
  - 상세: `loading=true` 단독 시 `<input>` 의 `disabled` 속성은 false 유지(`disabled` prop 이 별도). 제출은 submit 가드로 차단되지만 사용자는 여전히 타이핑 가능. Panel 은 항상 `loading=true` 와 `disabled=true` 를 동시에 전달하므로 런타임 미발현이나, `Composer` 를 독립 재사용 시 입력 가능 + 전송 차단 비대칭이 예상 밖 UX 로 이어질 수 있음. 현재 테스트 2는 `onSend` 미호출만 검증하고 input disabled 여부는 검증하지 않음.
  - 제안: 테스트 2 또는 별도 케이스에 `expect(screen.getByLabelText("메시지 입력")).not.toBeDisabled()` 를 명시적으로 추가해 현재 계약을 문서화하거나, `loading=true` 시 input 도 비활성화 할지 여부를 API 설계로 결정한 뒤 테스트에 반영.

- **[INFO]** `loading=true + disabled=true` 동시 적용 케이스가 `Composer` 단위 테스트에 없음
  - 위치: `codebase/channel-web-chat/src/widget/components/composer.test.tsx` 전체
  - 상세: 실제 Panel 런타임(booting/streaming 시)은 항상 `loading=true, disabled=true` 를 동시에 전달한다. 단위 테스트는 두 prop 을 각각 개별로만 검증해 aria-label 이 `loading` 우선인지(disabled 가 영향을 안 주는지) 단독 확인이 불가. Panel 통합 테스트가 이를 커버하지만 단위 테스트 레벨의 회귀 망이 없음.
  - 제안: `render(<Composer loading disabled onSend={vi.fn()} />)` 케이스를 추가해 "스피너·aria-label='AI 응답 중'·aria-busy·input disabled 모두 성립" 을 확인. 복잡도 대비 명확성 이점이 있음.

- **[INFO]** `fireEvent` 대신 `@testing-library/user-event` 권장
  - 위치: `codebase/channel-web-chat/src/widget/components/composer.test.tsx` L52–55, L65–67
  - 상세: `fireEvent.change` 와 `fireEvent.submit` 은 합성 이벤트를 직접 발행하여 실제 브라우저 이벤트 체인(포커스·입력·keypress·before/input 등)을 생략한다. 현재 컴포넌트는 단순 onChange 핸들러이므로 즉각 오류 없으나, 이후 IME 처리·복합 입력·composition 이벤트 의존 로직 추가 시 기존 `fireEvent` 기반 테스트가 오검증 통과 가능.
  - 제안: 신규 테스트부터 `import userEvent from '@testing-library/user-event'` 를 사용. 기존 panel.test.tsx 도 동일하게 마이그레이션하면 일관성 확보.

- **[INFO]** `.wc-composer-spinner` CSS 클래스명 직접 조회 — 리팩터링 취약
  - 위치: `codebase/channel-web-chat/src/widget/components/composer.test.tsx` L46, panel.test.tsx L303, L319
  - 상세: `btn.querySelector(".wc-composer-spinner")` 는 구현 세부(CSS 클래스명)에 결합됨. 클래스명 변경 시 테스트만 깨지고 렌더 자체는 정상이어서 false-negative 위험. `aria-hidden="true"` 로 접근성 트리에서 제외된 요소를 조회하므로 역할/레이블 기반 조회는 불가 — 클래스 조회가 현재 상황에서 최선의 접근이기는 하나 `data-testid="spinner"` 추가를 고려할 수 있음.
  - 제안: 단기 조치 없어도 무방. 장기적으로 `<span data-testid="wc-composer-spinner" className="wc-composer-spinner" aria-hidden="true" />` 형태로 `data-testid` 추가 후 테스트를 `getByTestId("wc-composer-spinner")` 로 교체하면 내부 클래스명 변경에 무관한 테스트 가능.

- **[INFO]** `styles.ts` CSS 변경(disabled 색상·spinner 애니메이션·keyframes)이 jsdom 환경에서 검증 불가
  - 위치: `codebase/channel-web-chat/src/widget/styles.ts`
  - 상세: `opacity:.4` → 중립 회색 `#c7cad1` 전환, `[aria-busy="true"]:disabled` 브랜드 컬러 유지, `@keyframes wc-spin` 은 jsdom computed style 미지원으로 현재 테스트 스위트에서 커버되지 않음. 스타일 문자열 내 오타·선택자 오류가 빌드 시점에 미발견될 수 있음.
  - 제안: 단기 조치 없음(이 PR 독립 문제 아님). 장기적으로 `widgetStyles` 문자열에 대한 스냅샷 테스트(`expect(widgetStyles).toMatchSnapshot()`)를 추가하면 의도치 않은 CSS 변경 감지 가능. 시각 회귀 테스트(Chromatic/Percy) 도입은 별도 태스크로 검토.

- **[INFO]** 이전 `panel.test.tsx` disabled 게이팅 케이스에서 `beforeEach` 추가로 `BASE_ACTIONS` 초기화가 모든 describe 블록에 적용됨 — 양호
  - 위치: `codebase/channel-web-chat/src/widget/components/panel.test.tsx` L348–351
  - 상세: 파일 최상단에 `beforeEach(() => { vi.clearAllMocks(); })` 가 추가되어 모든 테스트 전 BASE_ACTIONS vi.fn() 호출 횟수가 초기화됨. 이전 리뷰(14_43_25 INFO-5)에서 지적된 누적 호출 위험이 해소됨.
  - 제안: 변경 없음.

### 요약

이번 변경은 이전 리뷰(14_43_25)에서 지적된 WARNING 2건(composer.test.tsx 부재, submit 가드 누락)과 INFO 2건(booting 케이스 커버리지, clearAllMocks 누락)을 모두 적절히 해소하였다. `composer.test.tsx` 신설 5케이스는 loading prop 의 핵심 계약(aria-label 전환, aria-busy, 스피너 존재, 전송 차단, disabled 독립성)을 Composer 단독으로 검증하고, panel.test.tsx 추가 3케이스는 booting/streaming 통합 경로를 완전히 커버한다. 잔여 발견사항은 모두 INFO 수준으로, `loading=true, disabled=false` 조합의 input 활성 상태 미문서화, CSS 스타일 무검증, `fireEvent` 대신 `userEvent` 권장이 해당한다. 테스트 격리는 `beforeEach(clearAllMocks)` 및 각 케이스 독립 render 로 양호하며, 테스트 가독성도 한국어 설명과 spec 참조로 의도가 명확히 표현되어 있다.

### 위험도
LOW
