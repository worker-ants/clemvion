# Code Review 처리 (RESOLUTION)

대상: refactor 03 m-3 — integrations/new/page.tsx 1444→448줄 분할
리뷰: `review/code/2026/06/25/22_44_09/SUMMARY.md` (Risk MEDIUM, Critical 0, Warning 10)
구현 커밋: `174bd906` · review-fix 커밋: `77a04a4f`

## 요약

Critical 0. Warning 10 중 3건 반영(W1·W2·W9), 7건 보류(근거: 사전존재 verbatim 보존 / 리뷰어 후속 PR 명시 / behavior 변경 회피). MEDIUM 위험의 주원인(W1 테스트 공백)을 해소.

## Warning 처리 (10건)

### 반영 (3건)

- **W1 [Testing] ✅** `use-oauth-popup-return.test.ts` 신설 — 회귀 민감 타이밍 로직 6케이스(성공/에러 postMessage·다른 origin 무시·5분 타임아웃 + 팝업 close·popup.closed bail·unmount 리스너 제거). 추출이 만든 testable 단위를 활용 + 위임된 e2e(환경 레지스트리 아웃티지)의 보완 커버리지. MEDIUM 위험 주원인 해소.
- **W2 [Testing] ✅** `use-unsaved-changes-warning.test.ts` 신설 — 4케이스(active=false 미등록·preventDefault+returnValue·true→false 제거·unmount 제거).
- **W9 [Maintainability] ✅** `use-oauth-popup-return.ts` 매직넘버 3개를 `OAUTH_POPUP_TIMEOUT_MS`(5분)·`POPUP_CLOSED_BAIL_DELAY_MS`(1500)·`POPUP_CLOSED_POLL_INTERVAL_MS`(500) 상수화. 값 동일 — behavior 불변.

### 보류 (7건, 근거 명시)

- **W3 [Security] 보류** postMessage `event.source` 미검증 — **원본 page.tsx message handler 가 origin 만 검증하던 동작을 verbatim 보존**(behavior-preserving). `event.source !== popupRef.current` 추가는 behavior 변경이며, e2e 가 환경 아웃티지로 위임된 상태라 OAuth 팝업 실제 흐름에서의 미검증 변경을 회피. **후속 보안 PR** 대상(사전존재 — m-3 가 도입하지 않음). 정상 흐름에선 event.source===popup 이라 사실상 호환되나, 검증 불가 상태에서 "behavior-preserving 분할" PR 에 보안 변경을 섞지 않는다.
- **W4·W5 [Security] 보류** 폴링 `lastErrorMessage`·`TestStep result.message` 백엔드 원문 노출 — **두 pending step·TestStep 을 verbatim 이동**한 사전존재 동작. i18n 매핑/제네릭 대체는 표시 문자열 변경(behavior). 후속 PR. (참고: makeshop pending-polling 은 이미 statusReason→i18n 매핑이 있으나 cafe24 측 `lastErrorMessage` 는 raw — 비대칭 자체가 사전존재.)
- **W6 [Architecture] 보류** `useOauthPopupReturn` lib 레이어에서 toast·i18n 직접 처리 — 추출 시 behavior 보존을 위한 선택. 콜백 위임 리팩터는 리뷰어가 **"[후속 PR]"** 으로 명시. 본 PR 은 behavior-preserving 분할에 한정.
- **W7 [Architecture] 보류** `AuthStep` props 21개 — **원본 AuthStep 의 props 를 그대로 이동**(사전존재). 리뷰어 "후속 PR 권장".
- **W8 [Architecture] 보류** Cafe24/Makeshop pending step 98% 중복 — **원본에 이미 존재**(원본 주석 "mirror of Cafe24PrivatePendingStep")하던 의도된 미러. C-3/M-4 와 동일한 cafe24/makeshop DRY-deferral family. 리뷰어 "후속 PR 권장".
- **W10 [Maintainability] 보류** pending step `"Copy"` 하드코딩 — **사전존재**(원본 verbatim). i18n 키 도입은 별건.

### INFO (15건)

전부 보류/정합 확인. 주요: I15(scope) 포맷팅 4건은 자동 포매터 잡음(범위 이탈 아님). I4·I5(useCafe24PendingPolling 타입 캐스트·encodeURIComponent 불일치)는 본 PR 미수정 파일의 사전존재 — m-3 범위 밖. I10(clearOAuthTimeout useCallback)은 mount-only effect 의 eslint-disable 와 함께 W6 후속에서 정리 가능.

## 미완 reviewer

없음(scope·side_effect 포함 forced 전원 success, 둘 다 NONE — behavior-preserving 범위 준수·신규 부작용 0 확인).

## 검증

review-fix 후 lint·build·unit PASS. 신규 훅 테스트 10/10, 변경 관련 5 files/40 tests PASS. 전체 unit 은 무관 모듈 플래키 2건(`schedules-page` visual↔expression 왕복 타이밍, `spec-link-integrity` 부하성 5s 타임아웃)이 간헐 실패했으나 **각각 단독 재실행 통과**(schedules 3/3, spec-link 11/11) + 전체 재실행 PASS 로 확인 — 제 변경(integrations/new + 신규 훅, schedules 미import)과 인과 없음. e2e 는 환경 Docker 레지스트리 아웃티지로 다른 머신 위임.
