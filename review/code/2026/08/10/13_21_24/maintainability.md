# 유지보수성(Maintainability) Review

## 발견사항

- **[WARNING]** `seedWaitingFromStatus` JSDoc 안에 "이중 스트림은 **호출부의** 짝 가드가 막는다" 는 옛 아키텍처 서술이 남아, 5줄 아래에서 이번 diff 가 직접 갱신한 "게이트는 `openStream` 자신 안에 있다" 서술과 같은 JSDoc 블록 안에서 정면으로 모순한다
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts:457`(`**이 seed 가드는 "표면 되감기" 만 막는다. "이중 스트림" 은 호출부의 짝 가드가 막는다.**`) 및 같은 문단 `:463`(`그 짝 가드로 낭비성 두 번째 EventSource 생성 자체를`)
  - 상세: 이번 diff 의 핵심은 SSE 소유권 재확인을 "두 호출부(`start()`·`applyConfig`)가 각자 손으로 복제한 가드"에서 "`openStream` 함수 진입부의 단일 게이트"로 옮기는 것이다. 실제로 gate `461-462`("그래서 **`openStream` 자신이** 진입에서 소유권을 재확인하고...")는 이 diff 에서 정확히 그렇게 갱신됐다. 그런데 바로 **위 문장**(gate `457`, 이번 diff 범위 밖 — 즉 미수정)은 여전히 "이중 스트림은 **호출부의** 짝 가드가 막는다"라고 적고 있다. `openStream` 을 호출하는 두 지점(`start()` gate `622-623`, `applyConfig` 복원 gate `973-974`)은 이제 `if (streamRef.current !== null) ...` 류 가드를 전혀 갖고 있지 않고 `openStream` 의 반환값(`StreamClaim`)만 확인하므로, "호출부의 짝 가드"는 코드상 더 이상 존재하지 않는다. 같은 서술을 담고 있던 **자매 위치 두 곳은 이번 diff 에서 정확히 고쳐졌다** — 회귀 테스트 주석(`use-widget-eager-start.test.ts:3401-3403`, "스트림 게이트가 `openStream()` 안에 있다"로 갱신)과 spec 문서(`spec/7-channel-web-chat/3-auth-session.md` — 옛 "호출부의 짝 가드가 막는다"를 "스트림 열기 자체가 막는다"로 갱신, 커밋 diff 상 해당 gate)이다. 즉 **동일 문장 패턴이 3곳에 있었는데 2곳(테스트·spec)만 고쳐지고 소스 JSDoc 본체(gate `457`, `463`) 1곳이 빠졌다** — 이 코드베이스가 JSDoc 25줄 이상을 들여 스스로 "주석 drift 로 반복 결함을 냈다"고 명시적으로 경계하는 바로 그 실패 클래스가, 그 경계문을 적은 이 diff 안에서 다시 한번 재발한 것이다. 다음에 이 함수의 이중 스트림 관련 결함을 조사하는 사람이 이 문장만 보고 존재하지 않는 "호출부 가드"를 찾아 헤맬 수 있다.
  - 제안: gate `457`의 "호출부의 짝 가드가 막는다"를 spec 문서가 이미 채택한 표현("스트림 열기 자체가 막는다" 또는 "`openStream` 진입의 소유권 재확인이 막는다")으로, gate `463`의 "그 짝 가드로"도 같은 방향으로 맞춰 갱신할 것.

- **[INFO]** `StreamClaim` 의 리터럴 네이밍 컨벤션이 같은 파일의 자매 union `SeedOutcome` 과 대소문자 스타일 근거가 불명확하게 갈린다
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts:104-110`(`type StreamClaim = "opened" | "already_owned" | "no_client"`) vs `:84-90`(`type SeedOutcome = "ended" | "stale" | "continue"`)
  - 상세: `SeedOutcome` 은 세 값 모두 단일 단어라 케이스 스타일이 드러나지 않는다. `StreamClaim` 은 이 파일에서 클라이언트가 직접 지어낸(와이어 프로토콜 값이 아닌) 첫 다중 단어 리터럴 유니언인데 `already_owned`/`no_client` 로 snake_case 를 택했다. 이 파일의 다른 snake_case 문자열(`waiting_for_input`, `execution.replay_unavailable` 등, gate `316-340` 근방)은 전부 SSE wire 프로토콜이 정한 값이라 그대로 옮겨 적은 것이지 이 파일이 새로 만든 명명 규칙이 아니다. 반면 TS/React 코드베이스 관례상 로컬 전용(non-wire) 식별자는 camelCase(`alreadyOwned`/`noClient`)가 더 일반적이다. 기능에는 영향 없고, 이 파일 자체에 강제 규약이 없어 규약 위반은 아니지만, 향후 세 번째 로컬 union 이 추가될 때 어느 스타일을 따라야 할지 참고할 선례가 이 diff 로 애매해진다.
  - 제안: 급하지 않음. 다음에 로컬 전용 리터럴 유니언을 추가할 일이 있으면 이번 `already_owned`/`no_client` 를 wire 프로토콜 값과 구분해 camelCase 로 통일하는 것을 고려.

## 요약

이번 diff 의 핵심 변경(`openStream` 을 `void → StreamClaim` 명명 union 으로 승격하고 스트림 소유권 재확인 가드를 두 호출부의 손 복제 코드에서 함수 내부 단일 지점으로 이동)은 유지보수성 관점에서 정확히 옳은 방향이다 — 직전 라운드(`12_39_25`)가 `boolean` 반환의 뭉개짐 문제를 WARNING 으로 잡았고, `SeedOutcome` 이 이미 세운 "명명 union으로 의미를 분리한다" 선례를 그대로 따라 해소했다. 호출부 3곳(`start()`, `applyConfig` 복원, 회귀 테스트) 모두 새 계약에 맞춰 정확히 갱신됐고, `boolean` 대신 union 을 쓴 덕에 세 번째 분기가 생겨도 컴파일러가 미처리 케이스를 잡아 준다는 이점도 실제로 확보됐다. 함수 길이·중첩 깊이·매직 넘버·순환 복잡도 관점에서는 새로 추가된 코드가 모두 단순하고(3-분기 `openStream` 본체, 부정 비교 게이팅 1줄) 문제가 없다. 다만 이 diff 가 의도적으로 갱신한 "이중 스트림 = 호출부 짝 가드" 라는 옛 서술이 자매 위치(회귀 테스트 주석·spec 문서) 두 곳에서는 정확히 고쳐졌음에도 소스 JSDoc 본문 한 곳(gate `457`/`463`)에서는 그대로 남아, 같은 함수의 JSDoc 안에서 스스로와 모순하는 문장을 만들었다(WARNING) — 이 파일이 반복해서 경계해 온 "주석 drift" 클래스의 재발 사례이므로 실제 조사 비용을 유발하기 전에 정정할 가치가 있다. 그 외 `StreamClaim` 리터럴의 snake_case 선택은 규약 위반은 아니나 자매 타입과의 스타일 근거가 약해 참고용 INFO 로만 남긴다. `plan/in-progress/*.md` 두 파일의 갱신은 실제 코드·검증 결과(테스트 409건, `tsc --noEmit` 0 errors, 뮤테이션 실측)와 정확히 일치해 지어낸 서술이 없었다.

## 위험도

LOW
