### 발견사항

- **[INFO]** `ComposerProps.loading` 옵셔널 prop 추가 — 시그니처 하위 호환
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/webchat-composer-loading/codebase/channel-web-chat/src/widget/components/composer.tsx` `ComposerProps` 인터페이스
  - 상세: `loading?: boolean` 이 옵셔널로 추가되었고 `ComposerProps` 는 `export interface` 가 아닌 내부 `interface` 로 선언되어 있음. 외부에서 타입 직접 임포트가 불가하므로 호출자에 타입 파괴 없음. 기존 호출처는 prop 생략 시 `undefined`(falsy)로 처리되어 동작이 이전과 동일하게 유지됨.
  - 제안: 변경 없음. 모노레포 내부 사용이므로 외부 패키지 영향 없음.

- **[INFO]** `@keyframes wc-spin` 전역 CSS 등록 — iframe 격리로 호스트 충돌 없음
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/webchat-composer-loading/codebase/channel-web-chat/src/widget/styles.ts` `widgetStyles` 문자열
  - 상세: `@keyframes wc-spin` 이 `widgetStyles` 상수 문자열에 추가됨. 이 스타일은 위젯 iframe 내부 `<style>` 태그에만 주입되어 호스트 페이지 CSS 네임스페이스와 완전히 격리됨. `wc-` prefix 규약도 준수함. 복수 위젯 인스턴스를 같은 iframe에 마운트하는 시나리오는 현재 설계상 존재하지 않아 keyframes 중복 정의 우려도 없음.
  - 제안: 변경 없음.

- **[INFO]** `.wc-composer-send:disabled` 스타일 변경 — 모든 disabled 상태 외형 변경(의도된 범위)
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/webchat-composer-loading/codebase/channel-web-chat/src/widget/styles.ts` `.wc-composer-send:disabled` 규칙
  - 상세: `opacity: .4` 에서 `background: #c7cad1` 으로의 변경은 loading 상태에만 국한되지 않고 빈 입력·buttons/form 표면 등 모든 disabled 상태에 적용됨. "고장처럼 보이는 흐린 반투명" 전체를 중립 회색으로 교체하는 것이 plan 의 명시된 의도이므로 의도치 않은 부작용이 아님. 다만 jsdom 환경에서 computed style 검증이 불가하므로 시각 회귀는 수동 확인이 유일한 검증 경로임.
  - 제안: 변경 없음. 장기적 시각 회귀 테스트(스냅샷 또는 Percy) 도입은 별도 과제.

- **[INFO]** `.wc-composer-send` 에 `display:inline-flex` 레이아웃 모델 추가 — 기존 렌더에 실질적 퇴행 없음
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/webchat-composer-loading/codebase/channel-web-chat/src/widget/styles.ts` `.wc-composer-send` 규칙
  - 상세: `display:inline-flex; align-items:center; justify-content:center;` 가 추가됨. 기존 버튼은 `↑` 단일 문자 텍스트 자식을 가졌는데, block 기본값에서 flex로 전환하면 미세한 수직 정렬 변화가 발생할 수 있음. 그러나 `width:36px; height:36px` 고정 크기 원형 버튼에서 단일 문자 정렬 차이는 시각적으로 무시 가능 수준이며, 스피너 `<span>` 중앙 배치를 위해 필수인 변경임.
  - 제안: 변경 없음.

- **[INFO]** `beforeEach(vi.clearAllMocks)` 추가 — 테스트 격리 강화, 기존 테스트 동작 변경 없음
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/webchat-composer-loading/codebase/channel-web-chat/src/widget/components/panel.test.tsx` 최상단
  - 상세: `BASE_ACTIONS`(모듈 스코프 `vi.fn()` 객체) 의 누적 호출 기록을 각 테스트 전에 초기화함. 현재 어떤 테스트도 `toHaveBeenCalledTimes` 등 호출 횟수를 검증하지 않으므로 기존 assertion 이 실패할 위험 없음. 오히려 향후 호출 검증 추가 시 false-positive를 방지하는 올바른 격리 강화임.
  - 제안: 변경 없음.

- **[INFO]** `aria-label` 동적 전환 — 기존 aria 선택자 의존 자동화에 잠재적 영향
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/webchat-composer-loading/codebase/channel-web-chat/src/widget/components/composer.tsx` button `aria-label`
  - 상세: `aria-label` 이 `loading` 상태에 따라 "전송" ↔ "AI 응답 중" 으로 전환됨. 외부 e2e 테스트나 접근성 자동화가 항상 "전송" 라벨로 버튼을 선택한다면 `loading=true` 구간에 선택 실패가 발생함. 현재 코드베이스의 테스트(panel.test.tsx, composer.test.tsx)는 이미 두 라벨 모두를 조건에 맞게 검증하도록 작성됨. 외부 e2e(playwright 등)가 있다면 `getByLabel("전송")` → 두 라벨을 phase 에 따라 분기하도록 조정 필요.
  - 제안: e2e 테스트가 있는 경우 phase별 라벨 선택 분기 여부 확인. 현재 단위/통합 테스트 범위에서는 정상 처리됨.

### 요약

이번 변경은 `channel-web-chat` 위젯 iframe 내부 UI 컴포넌트에만 국한된 외형·접근성 개선이다. `Composer` 컴포넌트에 옵셔널 `loading` prop 이 추가되었으나 내부 `interface` 로 선언되어 외부 타입 파괴가 없고, 기존 호출처는 prop 생략 시 동작이 그대로 유지된다. CSS 변경은 iframe 격리 환경에 주입되어 호스트 페이지와의 네임스페이스 충돌이 없으며, `@keyframes wc-spin` 도 `wc-` prefix 규약을 준수한다. 전역 변수 신설·파일시스템 부작용·네트워크 호출·환경 변수 변경은 전혀 없다. `aria-label` 동적 전환으로 인한 선택자 의존 e2e 테스트 잠재 영향이 유일한 주의 사항이나, 현재 테스트 코드는 이를 올바르게 처리하고 있어 실질 위험은 없다. 모든 발견사항은 INFO 수준이다.

### 위험도

LOW
