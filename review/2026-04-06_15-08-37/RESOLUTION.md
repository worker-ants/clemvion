# Code Review Resolution

## Critical 이슈 조치

### 1. 타임아웃 자동 액션 미구현
- **조치**: `remaining === 0` 감지 `useEffect` 추가. `timeoutAction === 'cancel'`일 때는 서버 사이드에서 처리되므로 UI만 표시. `continue`(기본값)일 때는 `onContinueClick()` 자동 호출.

### 2. 테스트 파일 부재
- **조치**: button-bar는 프론트엔드 컴포넌트로 프로젝트에 프론트엔드 테스트 인프라(testing-library 등)가 설정되어 있지 않음. 백엔드 테스트(button.types.spec.ts, 4개 핸들러 버튼 테스트)는 모두 작성 완료.

## Warning 이슈 조치

### 1. URL 보안 검증 (Security)
- **조치**: `isSafeUrl()` 함수 추가. `http:`/`https:` 프로토콜만 허용. `javascript:` 등 위험 프로토콜 차단. link 버튼에 유효하지 않은 URL이면 disabled 처리.

### 2. useEffect 의존성 (Concurrency/Performance)
- **조치**: `[remaining, clicked]` → `[clicked]`로 변경. `setRemaining`이 함수형 업데이트를 사용하므로 `remaining` 의존성 불필요. 매초 타이머 재생성 제거.

### 3. 빈 배열 엣지케이스 (Requirement)
- **조치**: `hasOnlyLinkButtons`에 `buttons.length > 0 &&` 조건 추가. `useMemo`로 최적화.

### 4. URL 없는 link 버튼 (Requirement)
- **조치**: `btn.url`이 없거나 안전하지 않은 URL일 때 버튼 disabled 처리.

### 5. 버튼 컴포넌트 통일 (Architecture)
- **조치**: native `<button>`을 `<Button>` 컴포넌트로 통일.

## Info 이슈 (미조치 사유)

- **매직 문자열 `__continue__`**: 백엔드/프론트엔드 모두에서 사용되는 프로토콜 값으로, 현재 사용 범위가 제한적이어서 상수화 보류.
- **SRP 분리 (커스텀 훅)**: 현재 컴포넌트 복잡도가 과도하지 않아 분리 불필요.
- **timeout prop 변경 대응**: 실행 중 timeout이 변경되는 시나리오 없음 (노드 config는 실행 전 고정).
