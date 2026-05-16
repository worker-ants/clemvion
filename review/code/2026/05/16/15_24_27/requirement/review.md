# 요구사항(Requirement) 코드 리뷰

## 발견사항

### 1. 에러 코드 이름과 실제 적용 범위의 의미 불일치
- **[WARNING]** `CAFE24_PRIVATE_APP_ALREADY_CONNECTED` 코드를 Public 흐름 및 race backstop에 재사용
  - 위치: `integration-oauth.service.ts` 공개 흐름 분기 (라인 379), `integrations.service.ts` throwIfUniqueViolation (라인 739~744)
  - 상세: 에러 코드에 `PRIVATE`이 명시되어 있으나, 실제로는 `app_type` 무관 (public/private 모두)에 사용된다. 사용자가 에러 코드를 보고 "왜 Private 에러가 Public 흐름에서 나오지?"라는 혼선이 생길 수 있다. Consistency-check Warning 8에서도 지적되었으나, 사용자 지시("호환성 유지, 메시지 문구만 일반화")에 따라 기각된 결정이다. 기각 근거가 plan에 명시되어 있어 의사결정 추적은 가능하다.
  - 제안: 외부 API 클라이언트가 이미 이 코드를 사용 중이라면 현행 유지는 타당하다. 단, Swagger doc(`integrations.controller.ts` 라인 582)에서 이미 `app_type 무관 (public/private 둘 다)`로 문구를 일반화했으므로, 해당 내용이 공식 문서에도 반영되어 있는지 확인 필요.

### 2. precheckCafe24Mall — 알 수 없는 status를 가진 row 처리 시 타입 강제 캐스팅
- **[WARNING]** 폴백 분기에서 임의 status 값을 열거형으로 강제 캐스팅
  - 위치: `integration-oauth.service.ts` `precheckCafe24Mall` 메서드, 라인 535~539
  - 상세: PRIORITY 배열에 없는 status (예: 향후 추가될 `pending_reconnect` 등 미정의 상태)가 존재할 경우, `fallback.status as 'connected' | 'pending_install' | 'expired' | 'error'`로 강제 캐스팅된다. 반환 DTO(`Cafe24PrecheckResultDto`)의 `status` 필드 열거형과 실제 값이 불일치할 수 있으며, 프론트엔드에서 예상치 못한 status 값을 받아 `conflictDescKey` 가 기본 `connected` 케이스로 fallthrough 된다.
  - 제안: 폴백 시 `status`를 `undefined`로 두거나, 알 수 없는 상태임을 명시하는 별도 처리를 추가. 혹은 현재 DB 스키마에서 이 케이스가 발생할 수 없다면 주석으로 그 보장을 명시하여 미래 독자가 혼란 없도록 할 것.

### 3. 테스트에서 error code 기대값이 함수명 의도와 불일치
- **[WARNING]** public 흐름 begin 거부 테스트의 expect 코드가 `CAFE24_PRIVATE_APP_ALREADY_CONNECTED`
  - 위치: `integration-oauth.service.cafe24.spec.ts` 라인 174, 195
  - 상세: describe 블록명이 `begin — public app duplicate prevention`으로 명확히 public 흐름을 다루고 있는데, expect 하는 에러 코드가 `CAFE24_PRIVATE_APP_ALREADY_CONNECTED`다. 테스트 설명과 기대 코드 사이의 의미 괴리는, 추후 코드를 읽는 개발자가 "이 테스트가 실패하면 public이 문제인가 private이 문제인가"를 구분하기 어렵게 만든다.
  - 제안: 테스트 내 주석으로 "public 흐름에서도 동일 코드를 반환하도록 의도된 설계 — plan의 Warning 8 기각 결정 참조"를 명시. 또는 에러 코드가 변경될 경우를 대비해 상수 참조로 테스트를 작성.

### 4. Plan 문서의 체크박스 미갱신 — 구현 완료 항목들이 미체크 상태
- **[WARNING]** 실제 구현이 완료된 백엔드/프론트엔드 작업들이 plan에서 `[ ]` 상태
  - 위치: `plan/in-progress/cafe24-mall-dup-ux.md` 진행 상태 섹션 (라인 1710~1715)
  - 상세: 변경 집합을 보면 Backend (1)(2)(3), Frontend (4)의 코드가 모두 구현되어 있으나, plan의 체크박스는 전부 `[ ]`다. 이는 "완료 항목 즉시 갱신" 규약과 불일치하며, consistency-checker도 INFO #8에서 이를 지적했다. plan을 보고 작업 상태를 판단하는 팀원이 오판할 수 있다.
  - 제안: 구현이 완료된 항목 (Backend 1~3, Frontend 4)을 `[x]`로 갱신. TEST REVIEW WORKFLOW 및 Spec 위임이 남아 있으므로 파일은 `in-progress/`에 유지.

### 5. 프론트엔드 — precheck 로딩 중 Connect 버튼 비활성화 누락
- **[WARNING]** `cafe24PrecheckLoading=true` 상태에서 Connect 버튼이 활성화 상태로 유지됨
  - 위치: `frontend/src/app/(main)/integrations/new/page.tsx` Connect 버튼 `disabled` 조건 (라인 1414~1418)
  - 상세: 버튼의 `disabled` 조건은 `connecting || oauthWaiting || cafe24Conflict?.conflict === true`다. 그러나 precheck 응답 수신 전 `cafe24PrecheckLoading=true` 구간에서는 conflict 여부가 미확정이므로 버튼이 활성 상태다. 이 구간에 클릭하면 conflict가 있어도 OAuth 흐름이 시작될 수 있다. backend 가드가 backstop으로 존재하므로 보안상 문제는 없지만, 요구사항인 "inline 경고 배너 + Connect 버튼 disabled"가 로딩 구간에서 완전히 충족되지 않는다.
  - 제안: `disabled` 조건에 `cafe24PrecheckLoading`을 추가하거나, 최소한 해당 UX 트레이드오프를 주석으로 명시. 예: `// precheck 응답 전 짧은 로딩 구간은 backend guard가 backstop — UX 단순화 의도.`

### 6. e2e 테스트 — throttle 한도(분당 60회) 도달 시 동작 미검증
- **[INFO]** `@Throttle({ default: { limit: 60, ttl: 60_000 } })` 제한 초과 케이스 e2e 테스트 없음
  - 위치: `backend/test/integration-cafe24-precheck.e2e-spec.ts`
  - 상세: 컨트롤러에 throttle이 선언되어 있고, Swagger에도 `ApiTooManyRequestsResponse`가 문서화되어 있지만, e2e 테스트에서 429 응답을 검증하는 케이스가 없다. debounce 정상 동작을 검증하는 프론트엔드 단위 테스트도 throttle 개념은 포함하지 않는다.
  - 제안: e2e 테스트에 60회 초과 시 429를 반환하는 케이스 추가를 고려. 단, e2e 환경에서 throttle guard가 활성화되어 있는지 확인 필요 (테스트 환경에서는 비활성화하는 패턴도 있음).

### 7. 프론트엔드 — "checking…" 하드코딩된 영문 문자열
- **[INFO]** 로딩 표시 문자열 `checking…`이 i18n 처리 없이 하드코딩
  - 위치: `frontend/src/app/(main)/integrations/new/page.tsx` 라인 1507
  - 상세: `cafe24DuplicateMallTitle` 등 배너의 모든 문구는 `ko/en` 양쪽에 i18n 처리되어 있으나, precheck 로딩 중 표시되는 `checking…` 문자열만 하드코딩 영문이다. 한국어 로케일 사용자에게 혼재된 언어가 표시된다.
  - 제안: i18n 키(`integrations.cafe24PrecheckingLabel` 등)로 추출하거나, 시각적으로 아이콘만 표시하도록 변경.

### 8. 프론트엔드 — conflict 클리어 조건에 `isCafe24OAuth` 전환 처리 누락
- **[INFO]** 서비스 타입이 cafe24 → 다른 서비스로 변경될 때 conflict 상태 클리어 동작 확인 필요
  - 위치: `frontend/src/app/(main)/integrations/new/page.tsx` useEffect (라인 1268~1297)
  - 상세: `isCafe24OAuth`가 `false`가 되면 `setCafe24Conflict(null)`을 호출한다. 그러나 `cafe24PrecheckLoading`은 클리어하지 않는다. 사용자가 타이핑 중 서비스를 전환하면 `cafe24PrecheckLoading=true`가 남아 있는 채로 로딩 스피너가 표시될 수 있다 (cancelled=true로 실제 API 호출은 중단되지만 상태가 남는다).
  - 제안: `isCafe24OAuth`가 false일 때 `setCafe24PrecheckLoading(false)`도 함께 호출.

---

## 요약

이번 변경은 Cafe24 mall_id 중복 등록 UX 결함(사용자가 OAuth 동의 완료 후에야 충돌을 알게 되는 문제)을 계층별로 해소하는 구현으로, 요구사항에 명시된 핵심 기능(Public 흐름 begin 사전 가드, race backstop 409 변환, precheck 엔드포인트, 프론트엔드 inline 배너 + 버튼 비활성화, i18n 한국어 toast)이 전반적으로 충실히 구현되어 있다. 비즈니스 로직(connected row만 begin 거부, pending/expired/error는 finalize backstop 통과, precheck의 우선순위 정렬)도 코드와 테스트에 정확히 반영되어 있다. 다만 요구사항 관점에서 개선 여지가 있는 사항으로는, precheck 로딩 구간의 Connect 버튼 비활성화 누락(스펙의 "Connect 버튼 disabled" 요건과 미세한 불일치), plan 문서의 체크박스 미갱신, 그리고 폴백 분기의 알 수 없는 status 강제 캐스팅이 있으며 이는 향후 DB 스키마 확장 시 소리 없는 버그로 이어질 수 있다.

---

## 위험도

MEDIUM
