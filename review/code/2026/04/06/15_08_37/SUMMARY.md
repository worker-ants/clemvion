# Code Review 통합 보고서

## 전체 위험도
**HIGH** - 테스트 파일 완전 부재, 타임아웃 자동 액션 미실행(기능 버그), URL 미검증(보안) 등 다수 에이전트에서 공통으로 지적된 구조적·기능적 결함 존재

---

## Critical 발견사항

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Testing | `button-bar.tsx` 신규 파일임에도 대응 테스트 파일(`button-bar.test.tsx`) 전혀 없음. 타이머·상태 전이·다중 콜백 등 복잡한 로직을 포함하고 있어 커버리지 필수 | 파일 전체 | `src/components/editor/run-results/button-bar.test.tsx` 생성 |
| 2 | Testing / Requirement | 타임아웃 자동 액션 로직 자체가 미구현 — `remaining === 0` 시 UI는 "timed out" 표시하나 `onContinueClick` 또는 cancel 콜백이 실제로 호출되지 않아, 타임아웃 시나리오 테스트 작성 자체가 불가능한 기능 버그 | `useEffect`(L57-68), timeout render(L102-107) | `remaining === 0` 전환 시 `timeoutAction`에 따라 콜백을 자동 호출하는 `useEffect` 추가 후 테스트 작성 |

---

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Concurrency / Performance / Side Effect | `useEffect` 의존성 배열에 `remaining` 포함 → 매 초마다 `clearInterval` + `setInterval` 반복 호출. `setRemaining`이 이미 함수형 업데이트(`prev =>`)를 사용하므로 `remaining`은 불필요 | `useEffect` deps `[remaining, clicked]` | deps를 `[clicked]`만으로 변경 |
| 2 | Security | `btn.url`을 서버 응답에서 받아 클라이언트 검증 없이 `onLinkButtonClick`에 그대로 전달 → `javascript:` 프로토콜 인젝션 또는 피싱 리다이렉션 가능 | `handleClick` 내 `btn.type === "link"` 분기 | `isSafeUrl(url)` 검증 함수 추가, `https:` 프로토콜만 허용 |
| 3 | Architecture / Requirement | 타임아웃 만료(`remaining === 0`) 시 `timeoutAction`에 따른 콜백 미호출로 실행 흐름 중단. `timeoutAction === "cancel"` 처리를 위한 `onCancelClick` prop 자체도 부재 | `useEffect`, timeout render | `remaining === 0` 감지 `useEffect` 추가; `onCancelClick?: () => void` prop 추가 |
| 4 | Side Effect / Requirement | `timeout` prop 변경 시 `remaining` 상태 미반응 — `useState` 초기값은 최초 마운트 시에만 적용 | `useState` 초기화(L50-52) | `useEffect`로 `timeout` prop 변경 감지 후 `setRemaining` 호출, 또는 컴포넌트에 `key` prop 부여 |
| 5 | Requirement | `buttons`가 빈 배열(`[]`)일 때 `every()`가 `true` 반환 → Continue 버튼만 단독 노출되는 의도 불명확한 동작 | `hasOnlyLinkButtons` 계산(L73) | `buttons.length > 0 && buttons.every(...)` 조건 추가 |
| 6 | Requirement | `link` 타입 버튼에 `url`이 없는 경우 콜백·`setClicked` 모두 미호출 → 사용자에게 버튼 무응답으로 보임 | `handleClick`(L76-92) | `btn.type === "link" && !btn.url`인 경우 경고 로그 또는 `disabled` 처리 |
| 7 | Architecture (SRP) | 카운트다운 타이머 관리·클릭 상태 추적·버튼 렌더링·링크/포트 분기 처리 4가지 책임이 단일 컴포넌트에 혼재 | 컴포넌트 전체 | `useCountdown(timeout)`, `useButtonClickState()` 커스텀 훅으로 분리 |
| 8 | Architecture / Scope | "링크 버튼만 있으면 Continue 버튼을 자동 추가"하는 비즈니스 규칙이 UI 컴포넌트에 하드코딩 (OCP 위반). 빈 배열에서도 Continue 노출 | `hasOnlyLinkButtons`(L73), JSX(L141-150) | 부모에서 판단하여 `showContinueButton: boolean` prop으로 전달 |
| 9 | Testing | `link` vs `port` 버튼의 상이한 상태 전이 동작(`link`는 `clicked` 변경 없음)에 대한 테스트 누락 — 의도적 설계임에도 회귀 감지 불가 | `handleClick`(L73-86) | "link 클릭 후 버튼 비활성화 없음", "port 클릭 후 clicked 전환" 각각 테스트 |
| 10 | Testing | `disabled=true` + `clicked` 상태 조합별 콜백 미호출 경계값 테스트 누락 | `handleClick`(L74), `handleContinue`(L90) | 3가지 조합(`disabled=true&&clicked=null` 등) 파라미터화 테스트 |

---

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Maintainability | `"__continue__"` 매직 문자열 하드코딩 | `handleContinue`(L95) | `const CONTINUE_BUTTON_ID = "__continue__"` 상수 추출 |
| 2 | Maintainability / Dependency | `<Button>` 컴포넌트(Continue)와 native `<button>`(port 버튼) 혼용으로 스타일 일관성 유지 어려움 | L117-143 | 하나로 통일 (`Button` 컴포넌트 권장) |
| 3 | Performance | `buttons.every()` 매 렌더마다 재계산 | L70 `hasOnlyLinkButtons` | `useMemo(() => buttons.every(...), [buttons])` |
| 4 | Security | `timeout` 값에 클라이언트 상한 없음 — 서버에서 매우 큰 값 전달 시 사실상 영구 타이머 | `useState` 초기화 | `Math.min(timeout, MAX_TIMEOUT)` 적용 (MAX_TIMEOUT = 3600) |
| 5 | Performance | `at` 필드를 ISO 문자열로 저장 후 렌더 시마다 `new Date(clicked.at).toLocaleTimeString()` 재파싱 | L80, L98 | 저장 시점에 `toLocaleTimeString()` 포맷 적용 |
| 6 | Documentation | `ButtonDef`, `ButtonBarProps` 공개 인터페이스에 JSDoc 없음 — `type: "port"` 의미, `timeout` 단위, `onContinueClick` 호출 조건 불명확 | L8-23 | JSDoc 추가 |
| 7 | Documentation | `hasOnlyLinkButtons` 파생 시 Continue 버튼 자동 삽입 정책 설명 없음 | L73 | 인라인 주석 추가 |
| 8 | Side Effect | `clicked` 상태가 부모 prop 변경(실행 재시작 등)에도 초기화되지 않아 stale 상태 잔존 | `useState`(L55-59) | 실행 ID 기반 `key` prop 또는 `buttons` 변경 감지 후 `clicked` 리셋 |

---

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| Testing | **HIGH** | 테스트 파일 전무, 타임아웃 자동 액션 미구현으로 테스트 시나리오 자체 불완전 |
| Concurrency | **MEDIUM** | `remaining` deps로 인한 타이머 매초 재생성, 타임아웃 만료 시 콜백 미호출 |
| Security | **MEDIUM** | 미검증 외부 URL 직접 사용 (`javascript:` 인젝션 가능) |
| Side Effect | **MEDIUM** | 타임아웃 만료 시 UI·콜백 불일치, `timeout` prop 변경 미반응, stale `clicked` 상태 |
| Architecture | **MEDIUM** | 타임아웃 자동 액션 누락(핵심 비즈니스 로직), SRP/OCP 위반 |
| Requirement | **MEDIUM** | 타임아웃 자동 액션 미실행, `onCancelClick` 부재, 빈 배열·URL 없는 link 버튼 엣지케이스 미처리 |
| Performance | **LOW** | `useEffect` deps `remaining` 포함으로 타이머 매초 재생성 |
| Maintainability | **LOW** | `useEffect` deps 최적화, 매직 문자열, 컴포넌트 혼용 |
| Documentation | **LOW** | 공개 인터페이스 JSDoc 부재, 정책 주석 누락 |
| Scope | **LOW** | 암묵적 Continue 버튼 자동 추가 스펙 미확인, interval 재생성 버그 |
| Dependency | **NONE** | 신규 외부 패키지 없음, 기존 의존성만 사용 |
| API Contract | **NONE** | 해당 없음 (순수 UI 컴포넌트) |
| Database | **NONE** | 해당 없음 (DB 관련 코드 없음) |

---

## 발견 없는 에이전트

| 에이전트 | 사유 |
|----------|------|
| **Database** | 순수 UI 컴포넌트로 DB 관련 코드 없음 |
| **API Contract** | HTTP 요청/응답, 엔드포인트 설계 없음 |

---

## 권장 조치사항

1. **[CRITICAL] 타임아웃 자동 액션 구현** — `remaining === 0` 시 `timeoutAction`에 따라 `onContinueClick()` 또는 `onCancelClick()`을 자동 호출하는 `useEffect` 추가. `onCancelClick?: () => void` prop도 함께 추가
2. **[CRITICAL] 테스트 파일 작성** — `button-bar.test.tsx` 생성. 타이머 카운트다운, 클릭 상태 전이(link vs port), disabled 조합, 타임아웃 자동 액션, 빈 배열 엣지케이스 포함
3. **[WARNING] URL 보안 검증 추가** — `onLinkButtonClick` 호출 전 `https:` 프로토콜 화이트리스트 검증 적용
4. **[WARNING] `useEffect` 의존성 수정** — `[remaining, clicked]` → `[clicked]`로 변경하여 타이머 매초 재생성 제거
5. **[WARNING] 빈 배열 및 URL 없는 링크 버튼 엣지케이스 처리** — `buttons.length > 0 &&` 조건 추가, `btn.url` 없는 link 버튼 disabled 처리
6. **[WARNING] `timeout` prop 변경 대응** — `useEffect`로 `timeout` 변경 감지 후 `setRemaining` 동기화, 또는 `key` prop으로 강제 재마운트 정책 명시
7. **[INFO] 매직 문자열 상수화** — `"__continue__"` → `CONTINUE_BUTTON_ID` 상수 추출
8. **[INFO] 버튼 컴포넌트 통일** — native `<button>`과 `<Button>` 혼용 제거, 하나로 통일
9. **[INFO] `hasOnlyLinkButtons` 비즈니스 규칙 외부화 또는 명시화** — `showContinueButton` prop으로 부모에서 제어하거나, 인라인 주석으로 정책 문서화