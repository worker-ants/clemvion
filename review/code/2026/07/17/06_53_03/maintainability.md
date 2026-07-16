### 발견사항

- **[WARNING]** 매직 넘버 — 기존에 export 된 명명 상수(`TOKEN_REFRESH_LEAD_MS`)를 재사용하지 않고 그 값을 인라인으로 재하드코딩
  - 위치: `codebase/channel-web-chat/src/widget/use-widget-eager-start.test.ts:221` (`new Date(Date.now() + 30 * 60 * 1000 + 6_000).toISOString()`)
  - 상세: `use-widget.ts` 는 `TOKEN_REFRESH_LEAD_MS`(`use-token-refresh.ts:9` = `30 * 60 * 1000`)를 하위호환 목적으로 재-export 하고 있고(`use-widget.ts:24`), 같은 디렉터리의 `use-token-refresh.test.ts` 는 실제로 이 상수를 import 해서 `refreshDelayMs(new Date(now + TOKEN_REFRESH_LEAD_MS)...)` 형태로 사용하는 것이 확립된 컨벤션이다(`use-token-refresh.test.ts:5,37`). 반면 이번에 추가된 테스트는 "30분(lead)"라는 주석만 남기고 `30 * 60 * 1000` 을 다시 손으로 적었다. `TOKEN_REFRESH_LEAD_MS` 값이 향후 변경되면(운영 정책 조정 등) 이 테스트는 컴파일·타입 체크로 걸러지지 않고 조용히 의미를 잃는다(주석의 "30분(lead)"라는 설명과 실제 상수가 어긋나도 아무 것도 실패하지 않음) — 이는 정확히 이 라운드의 RESOLUTION.md 가 스스로 지적한 "decorative assertion" 패턴(W6)이 형태만 바뀌어 재도입된 것이다.
  - 제안: `use-widget-eager-start.test.ts` 상단 import(`import { useWidget } from "./use-widget";`)에 `TOKEN_REFRESH_LEAD_MS` 를 추가해 `new Date(Date.now() + TOKEN_REFRESH_LEAD_MS + 6_000).toISOString()` 로 교체. 이렇게 하면 상수 drift 시 테스트가 자동으로 올바른 지연을 재계산한다.

- **[INFO]** JSDoc 불변식 서술이 실제 호출부 동작과 어긋남(이번 diff 로 새로 생긴 문제는 아니고, 인접 텍스트를 이번에 편집하면서도 정정되지 않음)
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts:285-286` ("이 반환 계약이 없던 시절 ... 세 호출부 모두 이 값으로 게이팅한다.")
  - 상세: `seedWaitingFromStatus`(또는 그 ref)의 실제 호출부는 3곳이다 — `start()`(:395-396)와 `applyConfig()`(:643-646)는 반환값(`SeedOutcome`)으로 게이팅하지만, `handleEiaEvent` 의 `execution.replay_unavailable` 분기(:226)는 `void seedWaitingFromStatusRef.current?.(...)` 로 **fire-and-forget** 호출이라 반환값을 전혀 사용하지 않는다(함수 자신의 JSDoc 도 ":295 본 함수는 fire-and-forget 으로도 불린다"라고 명시). "세 호출부 모두 게이팅한다"는 문장은 정확히는 "2 호출부가 게이팅하고, 1 호출부(replay_unavailable 폴백)는 후속 액션이 없어 게이팅이 불필요하다"로 읽혀야 한다. 바로 위 줄(`@returns`)을 이번 diff 가 `SeedOutcome` 3-state 로 새로 고쳐 쓴 김에 이 인접 서술도 함께 정정할 기회였다.
  - 제안: "세 호출부 모두 이 값으로 게이팅한다" → "`start()`/`applyConfig()` 두 호출부가 이 값으로 게이팅한다(`replay_unavailable` 폴백은 fire-and-forget 이라 후속 액션이 없어 게이팅 대상이 아니다)" 정도로 정밀화.

- **[INFO]** `start()` 내 의도적 중복 게이팅에 대한 8줄짜리 정당화 주석이 이미 긴 함수를 더 무겁게 함
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts:389-396`
  - 상세: RESOLUTION.md(W5)에 기록된 대로, 이 줄은 `startGenRef` 검사와 기능적으로 중복이며(무력화해도 회귀 없음이 mutation 테스트로 확인됨) 그럼에도 "명시적 계약을 다음 사람이 깨뜨리기 어렵게" 남긴 것이라는 근거가 인라인으로 상세히 설명돼 있다. 판단 자체는 합리적이나, 이미 590줄에 달하는 `useWidget` 훅(:121-711) 안의 이미 조밀한 `start()` 콜백에 다시 8줄의 방어적 설계 논거를 얹는 형태라 해당 함수의 "왜 이 줄이 여기 있는가"를 읽는 비용이 계속 누적된다.
  - 제안: 이 근거 설명은 `seedWaitingFromStatus` JSDoc 의 `@returns` 절(이미 이 계약을 설명하는 자리, :281-286)에 "중복 게이팅이 의도적으로 유지된다"는 한 줄 요약만 남기고, 상세 근거는 그쪽 JSDoc 또는 별도 설계 노트로 옮겨 `start()` 본문의 인라인 주석 밀도를 낮추는 편을 고려.

- **[INFO]** `useWidget` 단일 함수 비대화가 이번 diff 로도 계속 진행됨(기존에 추적 중인 이슈, 신규 위험 아님)
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts:121-711`
  - 상세: 직전 라운드(`review/code/2026/07/17/02_31_18/SUMMARY.md` INFO#3)에서 이미 "즉시 조치 불필요"로 이월된 사항과 동일하다. 이번 diff 는 `SeedOutcome` 타입·`finalizeEnded` 경유 통합 등으로 오히려 개별 종료 경로의 중복은 줄였지만(`sendCommand`/`endConversation` 이 `finalizeEnded` 를 공유하게 됨 — 긍정적 변화), 훅 자체의 책임 범위(세션 상태·SSE·토큰 갱신 스케줄링·host bridge 커맨드 라우팅·마운트 effect)는 그대로 한 함수 스코프 안에 있다.
  - 제안: 별도 조치 불필요 — 다음에 `useEiaStream` 등으로 SSE/종료 판정 로직을 분리할 때 이번에 확정된 `SeedOutcome`/`finalizeEnded` 계약을 그대로 이관 대상으로 삼을 것을 권장(이미 SUMMARY.md 에 기록된 방향과 일치).

- **[INFO]** `endConversation()` 진입부의 `state.phase === "ended"` 가드가 이제 `finalizeEnded` 자체의 `endedRef` 가드와 의미상 중복
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts:559` vs `:182` (`finalizeEnded`)
  - 상세: 이번 diff 로 `endConversation` 이 `resetSessionRefs(); finalizeEnded(reason);` 을 거치게 되면서(W4 fix), `finalizeEnded` 자체가 이미 `endedRef` 기반 1회 가드를 갖는다. 함수 최상단의 `if (state.phase === "ended") return;` (React state 기반)은 이제 `finalizeEnded` 의 ref 기반 가드와 사실상 같은 목적을 다른 메커니즘으로 중복 수행한다 — `start()` 에서 이미 한 번 인정하고 문서화한 "우연이 아니라 의도적으로 남긴 중복" 패턴과 같은 성격이지만 여기서는 그 판단이 코드에 기록돼 있지 않다.
  - 제안: 급하지 않음. 다음 정리 라운드에서 `start()` 의 W5 주석과 같은 수준으로 "왜 두 가드를 모두 유지하는지"(또는 하나로 통합 가능한지) 짧게 문서화하면 두 종료 경로(`start`/`endConversation`)의 방어적 중복 정책이 일관되게 설명된다.

### 요약
이번 diff 의 프로덕션 코드 변경(`use-widget.ts`)은 유지보수성 관점에서 전반적으로 개선에 해당한다 — boolean 을 3-state `SeedOutcome` 판별 유니온으로 승격해 "정상 시드"와 "stale 폐기"를 타입 수준에서 구분 가능하게 만들었고, `sendCommand`(410)·`endConversation` 의 독자적 종료 시퀀스를 `finalizeEnded` 공유 경로로 통합해 이전에 지적됐던 종료 로직 이원화(WARNING W4)를 해소했다. 다만 테스트 파일에 추가된 회귀 테스트 중 하나(`use-widget-eager-start.test.ts:221`)가 같은 디렉터리의 자매 테스트 파일이 이미 확립한 "명명 상수 import" 컨벤션을 따르지 않고 `TOKEN_REFRESH_LEAD_MS` 값을 인라인으로 재하드코딩해, 이번 라운드가 스스로 고친 "decorative assertion" 문제(W6)와 유사한 drift 위험을 남겼다. 이 외 발견사항은 모두 INFO 수준(기존에 추적 중인 함수 비대화, 인접 JSDoc 정밀도, 의도적 중복 가드에 대한 설명 위치)으로 즉시 조치가 필요한 수준은 아니다.

### 위험도
LOW