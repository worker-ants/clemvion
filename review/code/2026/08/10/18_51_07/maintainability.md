# Maintainability Review — `18_51_07`

이번 라운드는 명시적 요청 두 가지를 받았다: (1) 직전 라운드(`18_23_54`) 내 자신의 W3 WARNING("`start()`/`applyConfig()` 꼬리 블록 중복" → "다섯 번째 갈래 추가 시" 조건부 defer)가 `plan/in-progress/webchat-auth-session-status-reconcile.md` 에 등재됐는데, **그 등재가 실제로 그 시점에 발견될 자리인지** 판정. (2) 새로 추가된 테스트 모듈 스코프 상태(`throwOnce`, `PHASE_SCHEDULE_MS`/`PHASE_ADVANCE_MS`)와 `redactToken` 의 위치(`lib/eia-client`)가 적절한지 평가. 두 사안 모두 실제 소스 파일(`use-widget.ts`, `use-widget-eager-start.test.ts`, `eia-client.ts`, `use-token-refresh.ts`, `webchat-auth-session-status-reconcile.md`)을 직접 열어 대조했다.

## 발견사항

- **[WARNING]** W3(꼬리 블록 중복) 조건부 defer 등재가 트리거 시점에 발견될 경로가 없다 — 코드 쪽에 아무 pointer 도 없고, plan 문서 제목도 무관한 주제다
  - 위치: `plan/in-progress/webchat-auth-session-status-reconcile.md:245-262`(등재 본문), `codebase/channel-web-chat/src/widget/use-widget.ts:113-132`(`shouldAbortAfterSeed` 정의부·JSDoc — "다섯 번째 갈래" 트리거가 실제로 발동하는 최초 접점)
  - 상세: 등재 자체는 잘 쓰였다 — "언젠가 검토" 가 아니라 "다섯 번째 갈래 추가 시" 로 구체적 트리거를 명시했고 체크리스트 항목(`- [ ] 다섯 번째 갈래 추가 시 — 부분 추출 검토 후 진행`)도 있다. 문제는 **발견 가능성**이다.
    1. `SeedOutcome` 은 `type SeedOutcome = "ended" | "stale" | "continue" | "refresh_deferred"` 로 닫힌 union 이고, `shouldAbortAfterSeed`(`:130-132`) 는 화이트리스트 비교로 그 union 을 소비한다. 다섯 번째 갈래를 추가하는 개발자가 실제로 손댈 자리는 바로 이 함수와 그 JSDoc이다 — TypeScript 가 강제하지는 않지만(화이트리스트라 새 값이 자동으로 "중단" 취급되어 컴파일은 통과한다), JSDoc 자체가 "5번째 갈래가 'continue 처럼 진행해야 하는' 의미로 추가되면 두 곳을 함께 고쳐야 한다"(`:119-123`)고 명시적으로 경고하며 "다섯 번째 갈래가 생겼을 때 어느 쪽으로 기우는가"(`:127`)까지 언급한다. **바로 이 지점에 정확히 같은 트리거 문구("다섯 번째 갈래")가 있는데도 `webchat-auth-session-status-reconcile.md` 로의 pointer 가 없다** — mutation-testing 함의(ai-review `17_15_33_2`→`17_25_34_2`)만 인용하고, 꼬리 블록 추출 검토(이번 W3)는 언급하지 않는다.
    2. 이 파일의 다른 defer 항목은 정확히 이 패턴(코드 쪽 breadcrumb)을 이미 쓰고 있다 — `use-widget.ts:547` `// 추적: plan/in-progress/webchat-auth-session-status-reconcile.md.`("catch 분기 세대 재검사 미검증" 항목). 같은 plan, 같은 파일 안에서 한 항목은 코드에서 역참조되고 다른 항목(W3)은 안 된다 — 일관성이 깨져 있고, 아무 코드 주석도 없는 W3 쪽이 실질적으로 더 발견되기 어렵다.
    3. plan 문서 자체의 표제는 `# \`3-auth-session.md\` frontmatter 재판정 — 두 PR 이 같은 자리를 반대 방향으로 만진다` 이고, 상단 요약 문단도 그 주제(PR 머지 순서 조율)만 설명한다. `SeedOutcome`/`use-widget.ts` 관련 항목 4개(꼬리 블록 중복 포함)는 그 문서 뒤쪽 절반에 부수적으로 쌓여 있다. `use-widget.ts` 를 편집하는 개발자가 "frontmatter 재판정" 이라는 제목의 plan 을 열어볼 이유가 코드 쪽에서 전혀 주어지지 않는다 — 이미 `16_26_09` scope 리뷰가 같은 문서의 다른 항목 쌍에 대해 "표제가 첫 항목만 가리켜 두 번째 항목의 가시성이 낮다" 고 지적한 바로 그 위험이, 이번엔 pointer 부재라는 더 강한 형태로 W3 에도 실제로 나타나 있다.
    4. 자동 가드(`consistency-check --impl-prep` 등)가 이 gap 을 대신 메워줄 것이라고 기대할 근거도 없다 — 그 게이트는 spec/plan 정합성을 보되, "이 소스 파일을 건드리면 이 plan 항목을 재판정하라" 는 코드-라인 단위 연결을 만들어내지 않는다.
    - 결론: 이대로면 "다섯 번째 갈래" 가 실제로 추가되는 시점에 이 defer 를 다시 마주칠 확률은 낮다 — **등재됐지만 발견되지 않으면 등재하지 않은 것과 실질적으로 같다**(이 세션이 반복 확인한 "review/plan 은 SoT 지만 pointer 없이 묻히면 사라진다" 패턴의 변형).
  - 제안: `shouldAbortAfterSeed`(`use-widget.ts:113-132`) JSDoc 에 한 줄만 추가 — 같은 파일 `:547` 이 쓴 형식 그대로 `// 추적: plan/in-progress/webchat-auth-session-status-reconcile.md §꼬리 블록 중복.` 을 붙이면, 다섯 번째 갈래를 추가하려고 이 함수를 열어보는 바로 그 순간 발견된다. 비용은 한 줄이고, 이 파일이 이미 같은 plan 의 다른 항목에 쓰고 있는 정확히 같은 관례라 일관성도 회복된다.

- **[INFO]** `throwOnce` 모듈 스코프 가변 플래그 — 같은 헬퍼 안의 `latest`/`latestUrl` 캡슐화 패턴과 불일치하지만 실질 위험은 낮다
  - 위치: `codebase/channel-web-chat/src/widget/use-widget-eager-start.test.ts:99-118`(`installControllableEventSource` — `latest`/`latestUrl` 은 함수 로컬 클로저), `:125`(`let throwOnce = false;` — 모듈 스코프), `:231`(`beforeEach` 리셋), `:671`(테스트 본문에서 직접 대입)
  - 상세: `installControllableEventSource()` 내부의 `latest`/`latestUrl` 은 함수가 호출될 때마다 새로 만들어지는 로컬 클로저 변수이고, 외부에는 `getEs()`/`getUrl()` 게터로만 노출된다 — 캡슐화가 잘 되어 있다. 반면 `throwOnce` 는 그 바로 옆(:99-118 함수 정의 직전·직후)에 있으면서도 모듈 최상위 `let` 이고, 테스트 본문이 `throwOnce = true;` 로 **직접 대입**해 제어한다(`:671`). 두 상태(스텁 생성자가 참조하는 값들)가 나란히 있는데 캡슐화 수준이 다르다. 현재는 `beforeEach`(`:231`)가 매 테스트 시작 전에 리셋하고 vitest 는 파일 내 테스트를 순차 실행하므로 실질적 누수 위험은 낮지만, 이 코드 자신이 "켠 테스트 밖으로 새지 않게 매번 끈다" 는 주석을 굳이 남긴 것 자체가 이 설계의 취약함을 저자도 인지하고 있었다는 신호다.
  - 제안: 필수는 아니지만, `installControllableEventSource()` 반환 객체에 `throwNextConstructorOnce: () => void` 같은 세터를 추가해 플래그를 함수 클로저 안으로 옮기면 `latest`/`latestUrl` 과 동일한 캡슐화 수준이 되고, `beforeEach` 리셋 의존도 사라진다(매 `installControllableEventSource()` 호출이 항상 `false` 로 시작). 지금 형태를 유지해도 회귀 위험이 크지 않으므로 INFO 로 남긴다.

- **[INFO]** `PHASE_SCHEDULE_MS`/`PHASE_ADVANCE_MS` — 배치·문서화 적절, `NINETY_MIN_MS` 와 값이 우연히 겹치지만 문제 아님
  - 위치: `codebase/channel-web-chat/src/widget/use-widget-eager-start.test.ts:12`(기존 `NINETY_MIN_MS = 90 * 60 * 1000`), `:127-140`(신규 `PHASE_SCHEDULE_MS`/`PHASE_ADVANCE_MS`, 도입 이유를 설명하는 JSDoc)
  - 상세: 두 상수 모두 이 파일의 기존 관례(모든 `describe` 이전, 다른 시간 상수들과 같은 구역)를 따라 배치됐다. JSDoc(`:128-138`)이 왜 90분·91분이라는 구체적 크기가 필요한지(실경과시간 드리프트가 6초 스케줄·10·20초 검증 창과 같은 자릿수라 콜드 캐시에서 4/4 FAIL 이 났던 실측 사고, `18_23_54` testing CRITICAL)를 인용까지 포함해 촘촘히 설명하므로 "매직 넘버" 문제는 없다. `PHASE_SCHEDULE_MS` 가 우연히 `NINETY_MIN_MS` 와 같은 값(90분)을 갖지만 역할이 다르다 — 전자는 "정확히 1회의 갱신 주기를 담는 단계 길이"로 계산에 쓰이고, 후자는 여러 테스트에서 "충분히 먼 만료 시각" placeholder 로만 쓰인다. 두 이름을 하나로 합치면 오히려 "먼 미래" 의미와 "정밀한 단계 경계" 의미가 뒤섞여 향후 값 조정 시 실수를 유발할 수 있어, 분리 유지가 맞는 선택이다.
  - 제안: 없음(확인용).

- **[INFO]** `redactToken` 의 `lib/eia-client.ts` 배치는 적절 — 이 파일이 유일한 token-URL 생성처다
  - 위치: `codebase/channel-web-chat/src/lib/eia-client.ts:120-133`(`EiaClient.openStream` — `url.searchParams.set("token", token)`, 코드베이스 전체에서 쿼리에 `token=` 을 심는 유일한 지점), `:183-195`(`redactToken` 정의), 호출부 `codebase/channel-web-chat/src/widget/use-token-refresh.ts:4`(import), `:172-175`(`onRefreshed` 콜백이 던진 예외를 `console.warn` 하기 전 redact)
  - 상세: `redactToken` 자체는 `EiaClient`/`EiaError` 어디에도 의존하지 않는 순수 문자열 유틸이라, 표면적으로는 별도 `lib/log-redact.ts` 등으로 뽑을 수도 있어 보인다. 그러나 `grep "token="` 로 코드베이스 전체를 확인한 결과 `?token=` 쿼리 파라미터를 만드는 곳은 `openStream`(`:131`) 단 한 곳뿐이다 — `redactToken` 이 알아야 하는 "정확히 무엇을 지울지"(`token` 이라는 파라미터 이름)는 이 파일이 소유한 지식이다. 같은 파일에 두면 향후 그 파라미터 이름이 바뀔 때 두 코드가 한 diff 안에서 함께 눈에 들어오지만, 분리해 두면 이름이 바뀌어도 redaction 정규식이 조용히 낡을 위험이 생긴다. 실제 호출부(`use-token-refresh.ts:172-175`)는 EIA 도메인 밖(임의 소비자 콜백이 던진 에러)까지 redact 하므로 "EiaClient 전용" 이라는 이름이 약간 넓게 쓰이긴 하지만, 그 콜백이 결국 `openStream` 을 트리거하는 경로(§R4 문서화됨)이므로 관련성은 유지된다. 같은 파일에 이미 `isTerminalAuthError`(마찬가지로 두 호출부가 공유하는 판정 헬퍼, `EiaError` 와 직결)가 같은 방식으로 배치돼 있어 이번 배치와 일관적이다.
  - 제안: 없음 — 현 위치 유지 권장.

## 요약

지시받은 두 축 모두 확인했다. (1) W3 꼬리 블록 중복 defer 는 등재 문구·트리거 조건 자체는 훌륭하지만, **코드 쪽에 아무 역참조가 없고** 같은 plan 의 다른 항목(`:547` 세대 재검사 항목)은 정확히 그 pattern 을 이미 쓰고 있어 비일관적이다. `shouldAbortAfterSeed` JSDoc 이 이미 "다섯 번째 갈래" 를 명시적으로 논하는 바로 그 자리에 pointer 한 줄이 빠져 있어, 트리거가 실제로 발동할 때 이 defer 를 다시 마주칠 경로가 사실상 없다 — 등재가 유실과 실질적으로 같아질 위험이 있으므로 WARNING 으로 판정한다. (2) 신규 테스트 모듈 상태 중 `throwOnce` 는 같은 헬퍼 안의 다른 상태(`latest`/`latestUrl`)보다 캡슐화가 약하지만 `beforeEach` 리셋으로 실질 위험은 낮다(INFO). `PHASE_SCHEDULE_MS`/`PHASE_ADVANCE_MS` 는 충분히 문서화됐고 기존 관례를 따른다(INFO). `redactToken` 의 `lib/eia-client` 배치는 그 파일이 token-URL 을 만드는 유일한 지점이라는 사실과 기존 `isTerminalAuthError` 배치 선례에 비춰 적절하다(INFO).

## 위험도

LOW
