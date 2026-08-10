# 유지보수성(Maintainability) Review

## 발견사항

- **[INFO]** 검증 완료 — 직전 라운드(`13_21_24`) WARNING("`seedWaitingFromStatus` JSDoc `:457`/`:463`이 같은 블록 안에서 자기모순")이 정확히 정정됐고, 같은 클래스의 잔재를 파일 전체에서 전수로 재확인해도 더는 없음
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts:457`, `:463`
  - 상세: 현재 소스를 직접 `Read`로 확인한 결과 `:457`은 `"이 seed 가드는 "표면 되감기" 만 막는다. "이중 스트림" 은 `openStream` 진입 가드가 막는다."`, `:463`은 `"그 진입 가드로 낭비성 두 번째 EventSource 생성 자체를"`로 갱신돼 있다. 같은 JSDoc 블록의 `:461-462`("**`openStream` 자신이** 진입에서 소유권을 재확인")·`:466-468`("게이트를 `openStream` 안으로 옮겨 **구조적으로 강제**한다")과 더는 충돌하지 않는다. 나아가 오더가 요청한 "전수 확인"을 위해 `use-widget.ts`·`use-widget-eager-start.test.ts` 전체를 `grep`으로 훑어 "호출부의 짝 가드"·"두 호출부가 각자"·"양쪽에 있다"류 옛 아키텍처 서술의 잔재가 있는지 확인했으나 0건이었다. 자매 위치였던 회귀 테스트 주석(`use-widget-eager-start.test.ts:3401-3408`, `git blame` 확인 결과 `84765cc96`에서 이미 "게이트가 `openStream()` 안"으로 갱신)과 `sessionEstablished()` 자체(여전히 `:239`에 정의돼 `seedWaitingFromStatus`의 **표면(seed) 가드**로만 쓰이며 — 스트림 가드와는 축이 다른 정당한 참조 — `:511`에서 호출됨)도 함께 대조해, "옛 구조 서술"과 "현재도 유효한 `sessionEstablished` 참조"를 혼동하지 않았음을 확인했다. `start()`의 `useCallback` 의존성 배열(`:634`)도 `sessionEstablished` 없이 `[openStream, persist, seedWaitingFromStatus, scheduleRefresh, isStale, worldGenRef]`로 정정된 상태를 유지하고 있다.
  - 제안: 조치 불요. 이 항목은 완전히 해소됐다.

- **[INFO]** 이전 라운드의 반증된 "컴파일러가 세 번째 variant 를 잡는다" 주장이 현재 소스 주석에는 재현되지 않고, 실제 방어선(부정 비교/fail-closed)만 정확히 서술돼 있음을 확인
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts:619-623`(`start()`), `:972-974`(`applyConfig` 복원 경로)
  - 상세: `13_21_24` RESOLUTION이 프로브로 실측한 대로 — `StreamClaim` 은 호출부에서 단순 문자열 비교(`claim !== "opened" && claim !== "no_client"`)로만 소비되므로 TypeScript exhaustiveness 검사가 적용되지 않고, 세 번째 variant 가 추가돼도 `tsc`는 이를 잡지 못한다. 현재 코드의 인라인 주석(`:619-621` "**부정 비교**다 — 형제 `SeedOutcome` 의 `!== "continue"` 와 같은 방향(fail-closed). `=== "already_owned"` 로 쓰면 향후 "중단이어야 하는" variant 가 늘 때 그 값이 자동으로 "진행" 으로 취급된다(fail-open, ai-review `12_48_08` maintainability)")는 이 실측을 정확히 반영해, "컴파일러가 잡아준다"는 반증된 주장을 재현하지 않는다. `applyConfig` 쪽 주석(`:972`)도 "위 `start()` 와 같은 부정 비교(fail-closed) — 근거는 그쪽 주석"으로 중복 서술 대신 단일 출처를 가리켜 drift 위험도 낮췄다. 이 항목을 이번 리뷰의 판정 전제로 삼았다 — 실제 보호는 fail-closed 비교 관용구이지 union 타입 자체의 exhaustiveness 가 아니다.
  - 제안: 없음. 현재 서술이 정확하므로 유지.

- **[INFO]** (carry-over, 조치 불요) `StreamClaim` 리터럴이 자매 union `SeedOutcome` 과 케이스 스타일(snake_case vs 단일 단어)이 갈리는 점은 `13_21_24` 라운드에서 이미 INFO로 판정된 사안이며 이번 라운드에서 변경 없음
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts:104-110`(`StreamClaim`) vs `:78-90`(`SeedOutcome`)
  - 상세: 규약 위반은 아니고 급하지 않음이라는 기존 판정을 재확인만 했다. 새로운 정보 없음.
  - 제안: 다음에 로컬 전용(non-wire) 리터럴 유니언을 추가할 때만 참고.

## 요약

이번 라운드의 delta는 코드 자체의 신규 변경이라기보다 직전 라운드(`13_21_24`)가 지적한 마지막 주석 drift(JSDoc 블록 자기모순, `use-widget.ts:457`/`:463`)의 조치와 그 이전 두 라운드(`12_39_25`/`13_21_24`)의 리뷰 산출물을 저장소에 편입하는 작업이다. 오더가 요청한 두 가지를 직접 소스에서 재확인했다 — (1) "호출부의 짝 가드" 류 옛 아키텍처 서술의 잔재는 `use-widget.ts`·회귀 테스트 파일 전체를 전수로 훑어도 더는 없고, 이 티켓에서 다섯 번 반복됐던 주석 drift 클래스가 이번엔 완전히 닫혔다. (2) "union 덕에 컴파일러가 미처리 케이스를 잡는다"는 앞서 반증된 주장은 현재 소스 주석 어디에도 재현돼 있지 않으며, 실제 방어선인 부정 비교(fail-closed) 관용구만 정확히 서술돼 있다 — 이 사실을 본 리뷰의 판정 전제로 삼았다. `openStream` JSDoc 은 `@param`/`@returns` 태그도 갖춰(이전 documentation INFO 반영) 파일의 기존 JSDoc 컨벤션과 일관된다. 새로 발견된 CRITICAL/WARNING 은 없다.

## 위험도

NONE
