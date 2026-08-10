# 유지보수성(Maintainability) Review

## 발견사항

- **[WARNING]** `openStream` 반환 타입을 `boolean → StreamClaim` 로 승격하면서, 새로 작성한 JSDoc 두 곳에 **옛 `boolean` 계약("false 를 돌려준다")이 그대로 남았다** — 이번 diff 자신이 경계하던 "주석 drift" 가 같은 diff 안에서 재발
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts:365` (`openStream` JSDoc 첫 줄: `SSE 를 연다. **이미 열려 있으면 아무것도 하지 않고 \`false\`** 를 돌려준다.`), `codebase/channel-web-chat/src/widget/use-widget.ts:462` (`seedWaitingFromStatus` JSDoc: `소유권을 재확인하고 이미 열려 있으면 \`false\` 를 돌려준다.`)
  - 상세: 두 줄 모두 이번 diff에서 **새로 작성**됐다(unified diff 게이트 365, 461-462 — 둘 다 `+` 신규 라인). 그런데 실제 구현(같은 diff의 gate 391)은 `if (streamRef.current !== null) return "already_owned";` 로, `boolean` 이 아니라 `StreamClaim` 문자열 리터럴을 반환한다. 같은 함수의 `@returns` 태그(gate 383-384: `` @returns `StreamClaim` — **`"already_owned"` 만 중단**이고 나머지는 진행이다 ``)는 정확히 갱신됐고, 호출부 3곳(`start()` gate 619, `applyConfig` 복원 gate 968, 그리고 회귀 테스트 `use-widget-eager-start.test.ts:3401-3403`)도 전부 `"already_owned"` 로 정확히 갱신됐다 — 그런데 정작 함수 상단 한 줄 요약과 `seedWaitingFromStatus` 쪽 설명 문단만 옛 `false` 를 그대로 두고 지나갔다. 이 PR의 plan 체크리스트(`plan/in-progress/webchat-usewidget-extraction.md`)와 회귀 테스트 주석 자체가 "이 코드베이스는 주석 drift 로 반복 결함을 냈고, 다음에 이 테스트가 깨졌을 때 조사자가 있지도 않은 '호출부 게이트' 를 찾게 두면 안 된다" 고 명시적으로 경계했던 바로 그 실패 양상이 두 줄 규모로 재현됐다 — 그것도 `StreamClaim` 도입 자체가 "boolean 이 두 의미를 뭉갠다" 는 이전 라운드 WARNING 을 고치는 리팩터였다는 점에서 아이러니가 크다. 함수 시그니처(`: StreamClaim`)와 `@returns` 태그를 먼저 읽는 사람은 문제가 없지만, 상단 한 줄 요약만 훑거나 `seedWaitingFromStatus` JSDoc 만 읽는 사람은 여전히 `openStream` 이 `boolean` 을 반환한다고 오해할 수 있다.
  - 제안: 두 줄을 `StreamClaim` 값 이름으로 교체 — 예) 365번째 줄은 `"이미 열려 있으면 아무것도 하지 않고 \`"already_owned"\` 를 돌려준다."`, 462번째 줄은 `"...이미 열려 있으면 \`"already_owned"\` 를 돌려준다."`.

- **[INFO]** `RESOLUTION.md` 의 "컴파일러가 미처리 케이스를 잡는다" 주장이 실제 호출부 패턴과는 정확히 들어맞지 않는다
  - 위치: `review/code/2026/08/10/12_39_25/RESOLUTION.md:16` (`` "no_client" 가 중단이 아닌 것이 **주석이 아니라 타입으로** 드러나고, 세 번째 요구가 생기면 컴파일러가 미처리 케이스를 잡는다. ``), 대응 호출부: `codebase/channel-web-chat/src/widget/use-widget.ts:619`·`:968` (둘 다 `=== "already_owned"` 단순 동등 비교)
  - 상세: 같은 파일의 `SeedOutcome` 은 호출부가 `if (outcome !== "continue") return;` (gate 613) 처럼 **부정 비교**로 게이팅한다 — 새 variant 가 추가되면 기본값이 "중단"이라 안전 쪽으로 fail-closed 다. 반면 `StreamClaim` 은 호출부가 `=== "already_owned"` **긍정 비교**로 게이팅한다 — 새 variant 가 추가돼도 그 값이 "already_owned" 가 아니면 자동으로 "진행"으로 취급된다(fail-open). 즉 향후 세 번째 "중단이어야 하는" variant(예: 텔레메트리용 `"rate_limited"`)가 추가돼도, `=== "already_owned"` 는 단순 문자열 비교이지 `switch`+`never` 로 짜인 exhaustiveness 검사가 아니므로 TypeScript 는 두 호출부의 누락을 **잡아주지 않는다**. `StreamClaim` JSDoc(gate 92-103)이 명문화한 도입 근거("세 번째 요구가 생기면 그 boolean 을 다시 쪼개야 한다")는 유효하지만, RESOLUTION.md 가 주장하는 "컴파일러가 미처리 케이스를 잡는다"는 현재 호출부 관용구 하에서는 성립하지 않는다 — 정확히 `SeedOutcome` 쪽 관용구(`!== "continue"`)와 반대 방향의 안전성이다.
  - 제안: 지금 당장 고칠 필요는 없다(현재 variant 는 2개뿐이고 판단은 맞다). 다만 세 번째 variant 가 추가될 때는 호출부를 `switch` + `assertNever` 로 바꾸거나, 최소한 `SeedOutcome` 과 같은 부정 비교(`!== "opened" && !== "no_client"`) 관용구로 통일해 "컴파일러가 잡는다"는 문서 주장을 실제로 지키는 것을 고려할 것.

- **[INFO]** 같은 파일의 자매 결과-union 두 개가 "같은 이유" 라고 명시하면서도 멤버 네이밍 컨벤션이 다르다
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts:84-90` (`SeedOutcome`: `"ended"` / `"stale"` / `"continue"` — 전부 단일 단어), `codebase/channel-web-chat/src/widget/use-widget.ts:104-110` (`StreamClaim`: `"opened"` / `"already_owned"` / `"no_client"` — 뒤 둘은 snake_case 복합어)
  - 상세: `StreamClaim` JSDoc(gate 96)이 "`SeedOutcome` 과 **같은 이유로** union 이다" 라고 명시적으로 선례를 인용하는데, 정작 리터럴 값의 형태는 다르다(단일 단어 vs snake_case 복합어). 기능에는 영향 없고 사소하지만, 같은 파일·같은 패턴의 두 타입이 나란히 있으면 리더는 하나의 네이밍 규칙을 기대하게 된다.
  - 제안: 조치 불필요(사소함). 향후 세 번째 결과-union 을 추가할 때는 두 표기 중 하나로 통일하는 것을 고려.

- **[INFO]** `useWidget()` 자체의 함수 길이/응집도 문제는 이번 diff 로 해소되지 않으며 별도 plan(`webchat-usewidget-extraction.md`)에 이미 추적 중 — 오히려 이번 변경은 호출부 손-복제 3줄을 제거해 중복을 줄이는 방향이라 이 관점에서는 개선이다. 새로 지적할 필요 없음.

## 요약

이번 diff 는 직전 라운드(`12_39_25`)의 maintainability WARNING(`openStream` 이 `boolean` 으로 "열었다" 와 "열 게 없어 통과시켰다" 를 같은 `true` 로 뭉갠다)을 정확히 겨냥해 `StreamClaim` 명명 union 으로 승격하고, 호출부 3곳(`start()`·`applyConfig` 복원·회귀 테스트 주석)을 전부 `"already_owned"` 비교로 일관되게 갱신했다 — 중복 제거·구조적 강제라는 목표를 잘 달성했고 네이밍(`StreamClaim`/`"opened"`/`"already_owned"`/`"no_client"`)도 의도를 잘 드러낸다. 다만 새로 작성한 JSDoc 두 줄(`openStream` 상단 요약, `seedWaitingFromStatus` 설명 문단)이 여전히 옛 `boolean` 계약("`false` 를 돌려준다")을 서술한 채 남아, 이번 리팩터·plan 문서 스스로가 반복해서 경계한 "주석 drift" 클래스가 같은 diff 안에서 소규모로 재현됐다. 기능에는 영향이 없고 `@returns` 태그·호출부·테스트는 모두 정확하므로 차단 사유는 아니지만, 이 코드베이스의 반복 결함 이력을 고려하면 놓치기 아까운 2줄짜리 수정이다. 그 외 RESOLUTION.md 의 "컴파일러가 미처리 케이스를 잡는다" 주장이 실제 호출부의 fail-open 관용구와는 정확히 들어맞지 않는다는 점, 자매 union 타입 간 네이밍 표기 차이는 참고용 INFO 로만 남긴다.

## 위험도

LOW
