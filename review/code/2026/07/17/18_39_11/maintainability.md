# 유지보수성(Maintainability) 리뷰 — webchat-boot-single-flight

리뷰 대상: 고정 merge-base `14bc86a53` 기준 7파일 diff. `git diff --stat 14bc86a53..HEAD`(HEAD=`1c9708ac8`)로
`CHANGELOG.md` · `widget-state.test.ts` · `widget-state.ts` · `use-widget-eager-start.test.ts` · `use-widget.ts` ·
`plan/in-progress/webchat-boot-single-flight.md` · `spec/7-channel-web-chat/2-sdk.md` 7개 일치 확인(페이로드 오염 없음).
아래 라인번호는 모두 `git show HEAD:<path>`(커밋된 스냅샷)를 기준으로 한다 — 이 워크트리는 리뷰 도중에도 다른
프로세스가 uncommitted 로 계속 수정하고 있어(§발견 A 참조), working tree 를 그대로 읽으면 라인이 밀릴 수 있다.

지시받은 5개 집중 항목을 모두 검증했고, 그 과정에서 diff 범위 안의 신규 결함 2건(A·B)을 실측으로 새로 확인했다.

---

### 발견사항

- **[WARNING] (집중 검증 2·4) `unmountedRef` — "되돌아오지 않는 종점이라 리셋 불필요" 라는 이번 라운드 JSDoc 의 새 주장이 실제로는 틀렸다**
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts` L178(`unmountedRef` 선언부 JSDoc, "되돌아오지
    않는 종점이라 별도 축이다") · L179(`const unmountedRef = useRef(false)`) · L283-286(`cannotApplyConfig` —
    `unmountedRef.current || ...`) · L976(`unmountedRef.current = true`, 커밋된 HEAD 에는 리셋 지점 없음).
    `codebase/channel-web-chat/next.config.ts` L10(`reactStrictMode: true`).
  - 상세: **네이밍 자체(item 4)는 문제없다** — `unmountedRef` 는 정확히 "이 마운트가 cleanup 을 거쳤는가"를
    말한다. 문제는 그 옆 JSDoc 이 세운 불변식이다: "언마운트는 world 무효화와 달리 되돌아오지 않는 종점이라
    리셋이 필요 없다"는 취지로 서술하는데, 이 파일이 실제로 켜 둔 React StrictMode(dev) 는 마운트 effect 를
    mount→cleanup→mount 로 1회 이중 호출한다 — `useRef` 값은 그 사이 유지되므로, 첫 시뮬레이션 cleanup 이
    `unmountedRef.current = true` 를 세팅한 뒤 **커밋된 코드 어디에도 그걸 `false` 로 되돌리는 지점이 없어**
    이후 진짜 마운트에서 오는 모든 `wc:boot` 이 `cannotApplyConfig` 의 unmounted 체크에 항상 걸려 영구
    lockout 된다. 같은 회차 `security.md` 가 이 메커니즘을 재현까지 확인해 WARNING 으로 이미 보고했다(여기선
    중복 서술을 피하고 교차 확인만 한다). 이 리뷰 고유의 관찰: (1) 이 파일의 다른 1회성 게이트 ref(`startedRef`
    L708 · `endedRef` L709 · `pendingResetRef` L856)는 전부 `resetSessionRefs`/`establishConfig` 안에 명시적
    리셋 지점이 있는데 `unmountedRef` 만 없다 — 파일 자신이 세운 관행과 어긋난다. (2) 이번에 커밋되지 않은
    작업트리 패치(review 도중 관찰, `git diff HEAD` 로 확인)가 "**제거된 `cancelledRef` 도 같은 이유로
    마운트에서 `false` 로 되돌렸었다**"고 명시한다 — 즉 이 파일은 정확히 이 문제(StrictMode 재마운트에 대비한
    리셋)를 이미 한 번 올바르게 처리한 전례(`cancelledRef`)가 있었는데, 이번 `unmountedRef` 신설이 그 전례를
    이어받지 못했다. (3) **집중 검증 2와의 연결점**: 지난 라운드 지적된 과대주장(`isStale` 축 누락 방지)은
    이번에 정확히 정정됐음을 재확인했다(아래 참조) — 그런데 정확히 같은 실패 패턴("주석이 실제로 성립하지
    않는 불변식을 단언")이 **같은 diff 안 다른 곳(`unmountedRef`)에서 새로 발생**했다는 점이 아이러니하다.
  - 제안: 마운트 effect 시작부에서 `unmountedRef.current = false;` 로 재무장(관찰된 uncommitted 패치가 이미
    이 방향). 겸사겸사 `startedRef`/`endedRef`/`pendingResetRef` 처럼 리셋 지점이 있는 게이트 ref 목록에
    `unmountedRef` 도 편입됐음을 어딘가(예: `worldGenRef` JSDoc 의 "무효화 지점" 목록류) 한 줄로 교차 참조해
    두면, 다음에 유사한 1회성 ref 를 추가할 때 같은 실수가 재발할 확률이 준다.

- **[WARNING] 언마운트 cleanup 의 `eslint-disable-next-line react-hooks/exhaustive-deps` 가 소실되어 억제되던 경고가 재발함(실측)**
  - 위치: `use-widget.ts` L970-977(언마운트 cleanup, `worldGenRef.current++` 직전). merge-base(`14bc86a53`)
    대비 diff: `- // eslint-disable-next-line react-hooks/exhaustive-deps` / `+ unmountedRef.current = true;`.
  - 상세: `git show HEAD:.../use-widget.ts` 를 격리 사본으로 떠서 `npx eslint`로 직접 실행해 확인:
    `977:19 warning react-hooks/exhaustive-deps ... 'worldGenRef.current' will likely have changed ...`.
    merge-base 스냅샷과 비교하면 이 줄 바로 위에 있던 억제 주석이 사라지고 공백만 있는 줄(L975, trailing
    whitespace)로 바뀌었다 — `unmountedRef.current = true;` 를 끼워 넣는 편집 과정의 실수로 보인다. `eslint`
    스크립트(`"lint": "eslint"`, `--max-warnings` 미설정)는 warning 만으로는 exit 0 이라 게이트를 통과하므로
    plan 의 "lint PASS" 기록과 모순되지 않지만, 실제로는 새 warning 이 조용히 유입됐다. 더 나쁜 건 바로 위
    3줄 주석("eslint 의 'ref value will likely have changed' 경고는 ... 오탐이다")이 그대로 남아 "우리는 이
    오탐을 억제한다"고 말하는데 실제 억제 지시문은 없는 자기모순 상태라는 점 — 코드를 읽는 사람은 주석만
    보고 억제됐다고 믿게 된다.
  - 제안: `worldGenRef.current++;` 바로 위에 `// eslint-disable-next-line react-hooks/exhaustive-deps` 를
    복원하고 L975 의 공백-only 줄을 정리한다. (참고: 이 리뷰 도중 관찰한 uncommitted 작업트리 패치가 이미
    이 복원을 포함하고 있었다 — 다만 그건 커밋된 diff 밖이라 본 리뷰의 검증 대상은 아니다.)

- **[WARNING] (집중 검증 1) `cannotApplyConfig`/`isAttemptStale` 두 predicate 가 구조적으로 상호 교환 가능 — 타입 검사가 못 막음(실측)**
  - 위치: `use-widget.ts` L270-273(`beginBootAttempt`) · L283-286(`cannotApplyConfig`) · L288-291
    (`isAttemptStale`) · L874(checkpoint 1, `cannotApplyConfig` 사용) · L916(checkpoint 2, `isAttemptStale`
    사용).
  - 상세: **정정된 JSDoc 문구 자체는 정확하다** — 스크래치패드에 격리 스니펫을 만들어 `tsc --strict --noEmit`
    으로 독립 재현했다: `attempt = { world, boot }` 하나로 `cannotApplyConfig(attempt)` 와 `isAttemptStale
    (attempt)` 를 뒤바꿔 호출해도 **0 에러로 컴파일**된다(구조적 타이핑 — `{world,boot}` 이 `{boot}` 와
    `{world,boot}` 파라미터 타입 양쪽을 모두 만족). "gen(world 단독)이 스코프에 없어 `isStale(gen)` 은
    컴파일되지 않는다"는 부분도 diff 로 확인: `applyConfig` 안엔 `gen` 이라는 식별자가 아예 없다(이제
    `attempt` 로 대체). 즉 지난 라운드 정정("타입 검사가 축 누락 일반을 막아주지는 않는다")은 과장 없이
    정확하다. **다만 이는 위험이 사라졌다는 뜻이 아니다**: checkpoint 1↔2 를 실수로 바꿔 쓰면(정확히 이번
    라운드 CRITICAL C1 이 낸 클래스의 버그) 컴파일러가 잡아주지 않고, 유일한 방어선은 §A-5 mutation 테스트뿐이다
    (코드 스스로도 그렇게 결론 내렸다). 세 predicate 중 `isStale`/`isAttemptStale` 은 "Stale" 어휘를 공유해
    grep 되지만 `cannotApplyConfig` 는 그 어휘를 전혀 공유하지 않는다 — `isStale` 자신의 JSDoc(L238-241)이
    표방한 "`isStale` grep 하나로 전 지점을 셀 수 있어야 한다"는 설계 원칙을 `cannotApplyConfig` 가 무너뜨린다.
  - 제안: 현행 방어(mutation 매트릭스)는 유지하되, 여력이 되면 `cannotApplyConfig` → `isBootStale` 류로
    개명해 `isAttemptStale`(=`isBootStale ∨ world 불일치`)과 어휘 계층을 맞추거나, 최소한 `isStale` JSDoc 에
    "`cannotApplyConfig`/`isAttemptStale` 은 grep 예외 — `beginBootAttempt` JSDoc 참조" 각주를 추가해
    discoverability 갭을 문서로라도 메운다.

- **[WARNING] (집중 검증 3) 이번 라운드 신규 JSDoc 다수가 plan 진행기록과 축어적으로 중복된다**
  - 위치: `use-widget.ts` `beginBootAttempt` JSDoc L256-261("타입 검사가 축 누락 일반을 막아주지는 않는다" 단락)
    vs `plan/in-progress/webchat-boot-single-flight.md` §"진행 기록 — A 완료"의 "A-0 결정" 단락. `use-widget.ts`
    `establishConfig` JSDoc L830-837("13_03_59 concurrency 리뷰는 ... 비-async 함수 안에는 await 을 쓸 수
    없다") vs plan §"진행 기록 — B 완료". `widget-state.ts` `RESTORED` case 주석 L127-134 vs plan
    §"진행 기록 — A-6 완료"의 "실패 사례" 단락.
  - 상세: 세 쌍 모두 같은 사실을 같은 인용("13_03_59"/"17_36_57 maintainability"/"내 초기 주장이 과했다" 등
    포함)으로 사실상 같은 문장을 두 곳에 서술한다(예: "저장 세션이 남고, host 가 wc:boot 을 재전송하면 ...
    복원 분기가 그 세션을 RESTORED 로 되살려 ended → streaming 으로 부활시켰다. 사용자에겐 실패해 끝난
    대화가 이유 없이 되살아나 보인다"는 두 파일에 거의 동일 문장으로 존재). CLAUDE.md 의 "정보 저장 위치
    (단일 진실 원칙)"과 어긋나는 이중 기록이고, 두 사본이 시간이 지나며 어긋날 위험이 있다(예: mutation
    매트릭스가 나중에 바뀌면 코드 JSDoc 은 안 고치고 plan 만 갱신되거나 그 반대일 수 있다). 이 파일은 이미
    주석 밀도가 매우 높다(`use-widget.ts` 전체 1005줄 중 주석성 줄 468줄 ≈ 46.6%, JSDoc 블록 28개) — 6번의
    거울상 버그 이력을 감안하면 "왜 이렇게 짜여 있는가"(현재 유효한 계약)를 코드 옆에 두는 것 자체는 정당하나,
    "누가 몇 시 라운드에 무엇을 지적/정정했다" 류 회고 서사까지 코드에 반복 적재하는 것은 다른 문제다.
  - 제안: 지금 당장 고칠 필요는 없다(둘 다 현재는 내용이 일치한다). 다만 다음 정리 라운드 후보로 표시:
    JSDoc 은 "현재 계약 + 왜 이 형태인가"만 남기고, 라운드별 지적·정정 서사는 "상세 근거·수정 이력은 plan
    §A-0/§B 참조" 식 한 줄 포인터로 축약할 것을 제안.

- **[WARNING] (집중 검증 4) `applyConfig` 의 "streamRef 기반 복원 스킵" 판정만 유일하게 이름 없는 인라인 조건**
  - 위치: `use-widget.ts` L896(`const saved = streamRef.current ? null : loadSession(cfg.triggerEndpointPath);`).
  - 상세: 이 파일은 중요한 boolean 판정에 이름을 붙이는 관행을 스스로 세웠다(`isStale`/`cannotApplyConfig`/
    `isAttemptStale` 모두 이름+JSDoc). 그런데 바로 이 판정 — `streamRef.current`(연결 존재 여부)로 복원을
    스킵할지 정하는 로직 — 은 삼항연산자에 인라인된 채 이름이 없다. 정황상 가장 명명이 아쉬운 자리이기도
    하다: plan 진행기록("내가 만든 6번째 거울상")에 따르면 이 판정을 `startedRef` 로 잘못 짰다가 재현·교정한
    것이 **이번 라운드에서 가장 최근에 발생한 버그**다. 위 10줄 주석(L891-895)이 이유를 설명하지만, 이름이
    없으면 향후 리팩터링 시 "여기가 그 6번째 버그가 났던 자리"라는 신호를 놓치기 쉽고, `isStale` 류처럼
    grep 으로 전 지점을 셀 수도 없다.
  - 제안: `const hasEstablishedConnection = streamRef.current !== null;`(또는 `useCallback` 화한
    `alreadyRestoring()`) 로 승격해 다른 guard 들과 명명 패턴을 맞출 것을 제안. 우선순위는 낮음 — 표현식
    자체는 1줄로 간단하고 주석이 이미 충분히 설명한다.

- **[WARNING] (집중 검증 5) `useWidget()` 이 계속 비대해지고 있다 — "축 1개 복원" 논증과 별개로 사고이력 자체가 분리를 앞당길 근거**
  - 위치: `use-widget.ts` L121-992(`useWidget()` 함수 전체, 872줄).
  - 상세: 정량 확인(커밋된 HEAD 기준): 함수 본문 872줄 안에 `useCallback` 26개 · `useRef` 13개 · `useEffect`
    3개가 정의된다. `applyConfig` 하나만도 얼리리턴 분기가 8개 안팎(`!cfg.apiBase` OR · `cannotApplyConfig` ·
    `!allowed` · `establishConfig()==="reset"` · `saved` 존재 · `clientRef.current` 존재 · `outcome!=="continue"`
    · `isAttemptStale`)이라 순환복잡도가 대략 9~10 수준이다. plan 의 Rationale 은 "토큰 캡슐화로 호출부가
    보는 축이 다시 1개가 되어 `useEiaSession` 분리 전제(축 1개일 때가 안전)가 복원된다"고 논증하는데, 이
    논증은 **호출부가 보는 축의 개수**에만 초점이 있고, 이 파일이 실제로 겪어온 **사고 지표**(같은 버그
    클래스 4라운드 연속(`02_04_13`·`08_29_33`·`09_36_01`·이번 C1) + 6번째 거울상 + 이번 라운드 CRITICAL 3건
    + 위 두 신규 WARNING(A·B))는 다루지 않는다. 사고 빈도 자체가 "단일 거대 훅에 계속 patch 를 쌓는" 접근의
    한계를 보여주는, 축-개수와는 독립적인 신호다.
  - 제안: `useEiaSession`(또는 동등한 분해)을 "축이 정리되면 안전한 시점"이 아니라 다음 착수 후보로
    앞당기는 것을 권고. 특히 분리 경계가 `applyConfig` 의 복원 분기(`seedWaitingFromStatus`/`openStream`/
    `scheduleRefresh` 호출부, L896-919)를 정확히 관통해야 하는데 이 지점이 지금까지 가장 사고가 잦았던
    자리이므로, 분리 시에도 §A-5 와 동등한 mutation 테스트 매트릭스를 새 경계에 대해 다시 구축한다는 전제로
    계획할 것.

- **[INFO] (집중 검증 4) `establishConfig` 이름이 함수의 두 책임(config 확립 + 대기 리셋 소비/`newChat` 트리거) 중 절반만 반영**
  - 위치: `use-widget.ts` L845-861.
  - 상세: 함수는 `configRef`/`setConfig`/`clientRef` 를 세팅하는 것 외에, `pendingResetRef` 가 서 있으면
    `apiRef.current.newChat()` 을 직접 호출하고 `"reset"` 을 반환한다 — 부수효과가 이름이 암시하는 범위보다
    크다. plan §B 가 제안했던 이름은 `establishConfigAndConsumeReset` 로 이중 책임을 명시했는데, 실제 구현은
    더 짧은 `establishConfig` 를 택했다. 다만 바로 아래 JSDoc 과 반환 타입(`"reset" | "continue"`)이 이
    이중 책임을 명확히 드러내므로 실사용 혼동 위험은 낮다.
  - 제안: 현행 유지 가능. 개명한다면 plan 이 제안한 `establishConfigAndConsumeReset`(또는
    `establishConfigAndFlushPendingReset`) 고려.

- **[INFO] `use-widget-eager-start.test.ts` 신규 §106 테스트 2곳에 `bootWithPlan` 헬퍼가 거의 동일하게 중복 정의됨**
  - 위치: `use-widget-eager-start.test.ts` L2464 · L2535(각 `it` 블록 내부 로컬 정의, 9줄씩 거의 동일).
  - 상세: 두 곳 모두 `const bootWithPlan = (plan: string) => act(() => window.dispatchEvent(new MessageEvent
    ("message", { origin: "http://host.test", data: { type: "wc:boot", payload: { ...profile: { plan } } } })))`
    를 반복한다. 이 파일은 이미 module-level 공유 헬퍼 관행(`boot()` L129, `installFetch` L40,
    `installControllableEventSource` L83, `installControllableSse` L102)을 확립해 뒀는데, 이번 추가분만
    그 관행을 따르지 않았다.
  - 제안: `boot()` 옆에 module-level `bootWithPlan(plan: string)` 을 두거나 `boot(profile?)` 로 일반화해
    두 테스트가 공유하게 한다. 프로덕션 코드가 아니라 우선순위는 낮음.

---

### 요약

이번 diff 는 스스로 세운 "가드는 규율이 아니라 구조" 원칙을 `establishConfig`(비-async 강제, `TS1308` 로 실측
확인됨)에는 성공적으로 적용했지만, 그 옆에서 신설한 `bootGenRef` 계열 predicate 3개(`isStale`/
`cannotApplyConfig`/`isAttemptStale`)와 `unmountedRef` 는 여전히 주석·테스트(규율) 에 의존한다 — 그 자체가
"틀렸다"는 뜻은 아니고 팀도 이미 §A-5 mutation 매트릭스로 의식적으로 보강했지만(재확인: `tsc --strict` 로도
막히지 않음을 직접 검증), 구조적 방어가 아니라는 점은 분명히 해 둘 가치가 있다. 지시받은 항목 중 정정된
JSDoc 주장(집중 검증 2)은 재검증 결과 정확하다 — 다만 같은 라운드에 정확히 같은 실패 패턴(주석이 실제로
성립하지 않는 불변식을 주장)이 `unmountedRef` 에서 새로 발견됐고(React StrictMode 재마운트 시 영구
lockout, `security.md` 가 재현까지 확인), 그 옆에서 이 리뷰는 `eslint-disable` 억제 주석 소실(실측: 격리
lint 실행으로 경고 재현)도 별도로 확인했다 — 둘 다 이 리뷰 도중 이미 uncommitted 로 고쳐지고 있는 것을
관찰했으나, 리뷰 대상인 커밋된 diff 자체에는 남아 있다. 그 외에는 JSDoc 이 plan 진행기록과 축어적으로
중복되는 경향(단일 진실 원칙과 배치, 아직 급하진 않음), `streamRef` 기반 스킵 판정만 이름 없이 남은 비일관,
그리고 `useWidget()` 이 872줄·`useCallback` 26개로 계속 커지는 추세(plan 의 "축 1개 복원" 논증과 별개로
사고이력 자체가 `useEiaSession` 분리를 앞당길 근거)를 확인했다. 테스트 커버리지(신규 6건 + mutation 매트릭스)
와 자기교정 이력(과대주장을 스스로 잡아 정정)은 이 파일의 유지보수성을 실질적으로 떠받치는 요소이고, 이번
회차도 그 관행을 이어갔다.

### 위험도

MEDIUM
