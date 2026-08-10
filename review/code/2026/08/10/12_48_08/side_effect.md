# 부작용(Side Effect) Review

## 발견사항

- **[WARNING]** `openStream` JSDoc 요약문(첫 줄)이 옛 `boolean` 시그니처를 그대로 서술 — 실제로는 `StreamClaim`(문자열 union)을 반환해, 이 한 줄만 믿고 `=== false` 로 비교하면 게이트가 조용히 무력화된다
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts:365` (`* SSE 를 연다. **이미 열려 있으면 아무것도 하지 않고 \`false\`** 를 돌려준다.`)
  - 상세: 이번 리뷰 대상 diff(누적, `origin/main...HEAD`)는 두 커밋을 포함한다 — ① 게이트를 `openStream` 내부로 옮기며 반환 타입을 `void → boolean` 으로 바꾼 1차 커밋(`8f6d783f1`), ② 직전 라운드(`12_39_25`) WARNING 을 반영해 `boolean` 을 `StreamClaim`(`"opened" | "already_owned" | "no_client"`) 명명 union 으로 승격한 2차 커밋(`2d9da4f26`). 2차 커밋에서 함수 시그니처(`: StreamClaim`, 게이트 387)·본문 반환값(`"no_client"`/`"already_owned"`/`"opened"`, 게이트 389/391/408)·`@returns` 태그(게이트 383-384, `` `StreamClaim` — **`"already_owned"` 만 중단**이고 나머지는 진행 ``)는 정확히 갱신됐지만, 같은 JSDoc 블록의 **첫 문장 요약**(게이트 365)은 1차 커밋 당시의 `boolean` 서술("이미 열려 있으면 아무것도 하지 않고 `false` 를 돌려준다")을 그대로 남겼다. 실제 함수(게이트 391)는 이미 소유된 경우 `false` 가 아니라 문자열 `"already_owned"` 를 반환한다. `Read`/`grep` 으로 현재 파일을 직접 열어 확인 — 라이브 소스에도 그대로 존재한다.
    같은 파일의 다른 함수(`seedWaitingFromStatus`)의 JSDoc 에도 동일 계열의 잔재가 있다(`use-widget.ts:462`, "이미 열려 있으면 `false` 를 돌려준다" — 역시 `openStream` 의 옛 boolean 계약을 참조).
    이건 정확히 이 파일이 반복해 온 "가드/문서가 한쪽만 갱신되고 반대쪽이 stale 로 남는" 결함 클래스(plan 문서 §배경 "9번 반대편 구멍", `12_39_25` 라운드 testing WARNING "테스트 주석이 옛 구조를 서술")의 재발이며, 하필 **이번 라운드가 그 클래스를 겨냥해 게이트를 구조적으로 강제한 바로 그 diff 안에서** 발생했다. 현재는 실질적 위험이 낮다 — `openStream` 이 export 되지 않는 훅 내부 콜백이고 실제 호출부 2곳(게이트 619, 968) 모두 정확한 `=== "already_owned"` 비교를 쓰므로 런타임 동작에는 영향이 없다. 하지만 문서 자체가 계약을 오도하므로, 향후 세 번째 호출부를 추가하는 사람이 이 요약 줄만 보고 `if (!openStream(...))` 류의 boolean 비교(진리성 검사에서 `"already_owned"`/`"no_client"`/`"opened"` 문자열은 모두 truthy 이므로 게이트가 **항상 통과**해 버린다)를 재도입할 실질적 위험이 있다 — 정확히 이 파일이 `SeedOutcome`/`StreamClaim` 도입 근거로 든 "boolean 오독" 시나리오다.
  - 제안: 게이트 365 첫 줄과 게이트 462 의 서술을 `@returns` 태그(게이트 383-384)와 일치하도록 "이미 열려 있으면 아무것도 하지 않고 `\"already_owned\"` 를 돌려준다" 로 갱신.

- **[INFO]** `openStream` 시그니처 변경(`void → StreamClaim`)의 blast radius 는 파일 내부로 완전히 국한됨 — 재확인
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts:386-411` (정의), `:619`, `:968` (호출부)
  - 상세: `openStream` 은 `export` 되지 않고 `useWidget()` 의 공개 `actions` 객체에도 포함되지 않는 훅 내부 전용 `useCallback`. `grep` 결과 호출부는 `start()`(게이트 619)와 `applyConfig` 세션 복원 경로(게이트 968) 두 곳뿐이며, 둘 다 이번 diff 안에서 신 계약(`if (openStream(...) === "already_owned") return;`)으로 함께 갱신됐다. `openStream` 자체의 `useCallback` 의존성 배열(`[closeStream, handleEiaEvent]`, 게이트 410)은 변경 불필요 — 새로 읽는 `streamRef.current`/`clientRef.current` 는 ref 라 안전. 외부 모듈·테스트가 `openStream` 을 직접 참조하지 않으므로 공개 인터페이스 영향 없음.
  - 제안: 조치 불필요(확인 목적 기록).

- **[INFO]** `start()` 의 `useCallback` 의존성 배열에서 `sessionEstablished` 제거가 정확히 반영됨 — 직전 라운드 WARNING 의 실제 해소 확인
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts:630` (`}, [openStream, persist, seedWaitingFromStatus, scheduleRefresh, isStale, worldGenRef]);`)
  - 상세: `12_39_25` 라운드에서 3개 reviewer(side_effect·documentation·requirement)가 독립적으로 지적한 "`start()` 본문에서 `sessionEstablished()` 호출은 제거됐는데 의존성 배열엔 남았다"는 WARNING 이 이번 diff 에서 정확히 조치됐다. `grep -n "sessionEstablished"` 로 파일 전체를 확인한 결과 남은 참조는 (a) 정의(게이트 239) (b) `seedWaitingFromStatus` 본문·의존성 배열(게이트 511, 541 — 이 함수는 여전히 `sessionEstablished()` 를 직접 호출하므로 정당) (c) `applyConfig` 내부 `sessionEstablished()` 호출(게이트 938 — 이는 스트림 게이트와 무관한 별개 판정, "복원 대상 결정" 용도)뿐이며, `start()`(게이트 577-630 전체)·`applyConfig` 의 `openStream` 직전 분기(게이트 968 부근)엔 더 이상 `sessionEstablished` 참조가 없다 — 다른 `useCallback`/`useEffect` 의존성 배열이 이번 fix 로 인해 새로 stale 해진 곳은 없음(`grep "}, \["` 전수 확인).
  - 제안: 조치 불필요(확인 목적 기록).

- **[INFO]** `review/code/2026/08/10/12_39_25/*` (RESOLUTION.md·SUMMARY.md·meta.json·`_retry_state.json`·7개 reviewer 산출물) 신규 파일 커밋 — 코드 실행 중 파일시스템 부작용이 아니라 리뷰 워크플로 산출물의 정상 커밋
  - 위치: `review/code/2026/08/10/12_39_25/` 디렉터리 전체(14개 신규 파일 중 11개)
  - 상세: 이 파일들은 애플리케이션 런타임 코드가 생성하는 것이 아니라, 직전 `/ai-review` 라운드의 산출물을 저장소에 기록한 것이다. `CLAUDE.md` 의 "코드 리뷰 산출물 → `review/code/<YYYY>/<MM>/<DD>/<hh>_<mm>_<ss>/`" 규약과 정확히 일치하는 위치이며, `code-review-agents` skill 의 쓰기 권한 범위(`review/code/**`) 안이다. 애플리케이션 동작에 영향 없음.
  - 제안: 조치 불필요.

## 점검 세부 결과 (관점별)

1. **의도치 않은 상태 변경**: `openStream` 내부 소유권 재확인(`streamRef.current !== null` → 조기 반환)은 종전 호출부가 `openStream` 직전 동기적으로 수행하던 `sessionEstablished()` 검사와 시점·순서가 동일 — 검사와 `closeStream()`/`streamRef.current` 대입 사이에 새 await 경계 없음. 새로 건드리는 ref/상태 없음.
2. **전역 변수**: 없음. `StreamClaim` 은 모듈 스코프 타입 선언(런타임 값 아님)이고, 모든 상태는 `useWidget()` 훅 내부 스코프에 한정.
3. **파일시스템 부작용**: 위 INFO 항목 참조 — 코드 실행 경로가 아닌 리뷰 워크플로 산출물 커밋뿐, 런타임 파일 I/O 변경 없음.
4. **시그니처 변경**: `openStream` 반환 타입 `void → StreamClaim`(문자열 union). 비공개 내부 콜백이라 영향 범위는 파일 내부 2개 호출부로 국한, 둘 다 이번 diff 에서 함께 갱신(위 INFO 항목 참조). 다만 JSDoc 요약문이 그 시그니처를 정확히 반영하지 못해 향후 오독 위험이 있음(위 WARNING).
5. **인터페이스 변경**: `useWidget()` 의 공개 계약(`state`, `config`, `actions.{...}`)은 변경 없음.
6. **환경 변수**: 읽기/쓰기 변경 없음.
7. **네트워크 호출**: `client.openStream(...)` 호출 조건 불변 — 오히려 이중 `EventSource` 생성을 구조적으로 차단하는 방향(개선). `client` 미확립 시 `"no_client"` 반환 후 `scheduleRefresh()` 진행이 종전 동작과 동치임을 JSDoc·코드 양쪽에서 확인.
8. **이벤트/콜백**: `onEvent: handleEiaEvent`/`onError: console.warn` 배선 불변. `dispatch`/`bridgeRef.current?.sendEvent(...)` 호출 지점·조건도 이번 diff 로 달라지지 않음.

## 요약

이번 diff 는 `openStream` 반환 타입을 `boolean` 에서 명명 union `StreamClaim` 으로 승격해 스트림 소유권 게이트를 구조적으로 강제하는 리팩터의 완성판이며, 직전 라운드(`12_39_25`)가 지적한 "`start()` 의존성 배열에 남은 `sessionEstablished` 잔재" WARNING 은 정확히 해소됐음을 `grep` 전수 확인으로 검증했다. `openStream` 은 비공개 내부 콜백이라 시그니처 변경의 blast radius 는 파일 내부 2개 호출부로 완전히 국한되고, 네트워크(SSE)·이벤트 배선·전역 상태 관점에서 새로운 부작용은 없다. 다만 `openStream` JSDoc 요약 첫 줄(게이트 365)과 `seedWaitingFromStatus` JSDoc(게이트 462)이 boolean→union 전환 이전의 "`false` 를 돌려준다" 서술을 그대로 남겨, 같은 함수의 `@returns` 태그(정확)와 상충하는 문서 drift 가 있다(WARNING) — 이 파일이 반복해 온 "가드/문서 비대칭 갱신" 결함 클래스가, 하필 그 클래스를 구조적으로 막으려던 이번 diff 자체에서 재발한 사례다. 현재 실행 경로엔 영향 없으나 향후 호출부 추가 시 오독 소지가 있어 반영을 권고한다. `review/code/2026/08/10/12_39_25/*` 신규 파일 커밋은 애플리케이션 부작용이 아니라 프로젝트 규약에 맞는 정상적인 리뷰 산출물 기록이다.

## 위험도

LOW
