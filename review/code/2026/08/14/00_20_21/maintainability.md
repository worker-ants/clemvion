# 유지보수성(Maintainability) 리뷰 결과

## 사전 확인

이 세션 diff(`origin/main...HEAD`)는 `20_36_35`→`22_45_24`→`23_07_11`→`23_27_48`→`23_46_00`→
`00_00_44` 6개 라운드가 이미 반복 검토한 누적 결과이며, 이번 라운드에서 실제로 추가된 코드는
직전 라운드(`00_00_44` WARNING 1 — OAuth 콜백 e2e 부재)에 대한 조치인
`codebase/backend/test/auth-oauth-callback.e2e-spec.ts` 신규 파일 하나뿐이다(그 외는 plan
문서 배너·집결 티켓 등록). 핵심 소스(`update-returning-rows.ts`, 8개 호출부, 두 구조적 회귀
가드 spec)는 `00_00_44` 이후 변경 없음을 `git show 304679959 --stat` 로 확인했다.

- `it.each` placeholder 명명 통일(`_label, value`) — 유지, 재확인.
- `unknown` 전환 8곳 전수 — 유지, 재확인.
- `detail` 인자 8개 호출부 전수 충족 — 유지, 재확인.
- `knowledge-base.service.ts`의 `updateReturningRows` 반환값 변수명 불일치(`rowsOut` 2회 —
  `:544`, `:578` — vs `resetRows` 1회 — `:751`) — **3라운드 연속 INFO, 상태 변화 없음.**
- 두 구조적 회귀 가드(`assert-row-array.spec.ts`/`update-returning-rows.spec.ts`)의
  `SRC`/정규식-카운팅 보일러플레이트 중복 — **4라운드 연속 INFO, "세 번째 유사 가드가 생기면
  추출" 유예 유지, 상태 변화 없음.**
- `auth-oauth.service.ts`의 `updateReturningRows` 호출 스타일(인라인 `await` 직접 전달)이
  나머지 7곳(변수로 받은 뒤 전달)과 다른 것 — 의도적으로 구조적 가드 주석에 기록돼 있고
  기존 라운드에서 수용됨 — 상태 변화 없음.

## 발견사항

- **[INFO]** 신규 e2e 파일(`auth-oauth-callback.e2e-spec.ts`)은 기존 e2e 스위트 컨벤션과
  일관된다 — `BASE_URL = process.env.E2E_BASE_URL ?? 'http://backend-e2e:3011'` 폴백은
  `codebase/backend/test/*.e2e-spec.ts` 20여개 파일 전부가 동일하게 쓰는 기존 패턴이며(신규
  중복 아님), `seedState`/`callback` 헬퍼로 5개 `it()` 의 arrange 를 공유해 함수 길이·중첩
  모두 낮다. JSDoc 이 "왜 e2e 가 필요한가"(mock 이 코드와 같은 오해를 공유할 수 있다)를 이
  PR 의 핵심 교훈과 연결해 명확히 서술한다. 조치 불요 — 새 유지보수성 부채 없음.

이 라운드에서 확인된 CRITICAL/WARNING 급 신규 발견 없음. 위 "사전 확인" 항목은 전부 이전
라운드(들)에서 이미 지적·유예된 저비용 스타일 흔들림이며 이번 diff 로 인해 새로 생기거나
악화되지 않았다.

## 요약

이번 라운드에서 실제로 늘어난 코드는 `auth-oauth-callback.e2e-spec.ts` 한 파일뿐이며, 헬퍼
분리·기존 e2e 컨벤션 준수·명확한 의도 서술 모두 양호해 유지보수성 관점에서 새로 지적할 사항이
없다. 핵심 헬퍼(`updateReturningRows`)와 8개 소비 지점은 `00_00_44` 라운드에서 이미 CRITICAL/
WARNING 없음으로 확인된 상태 그대로이며, 남아 있는 항목은 전부 3~4라운드 연속 INFO로 보고되고
명시적으로 유예된 저비용 항목(`knowledge-base.service.ts` 변수명 `rowsOut`/`resetRows` 비일관,
두 구조적 가드 spec 의 보일러플레이트 중복)뿐이다. 함수 길이·중첩 깊이·매직 넘버·중복 로직 등
어느 축으로도 새로운 결함은 없다.

## 위험도

LOW
