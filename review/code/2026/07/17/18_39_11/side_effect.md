# 부작용(Side Effect) 리뷰 — webchat-boot-single-flight

리뷰 대상: 고정 merge-base `14bc86a53` 기준 7파일 diff(`CHANGELOG.md`, `widget-state.test.ts`, `widget-state.ts`,
`use-widget-eager-start.test.ts`, `use-widget.ts`, `plan/in-progress/webchat-boot-single-flight.md`,
`spec/7-channel-web-chat/2-sdk.md`). 지시받은 4개 집중 검증 항목을 코드 정독 + **격리 worktree(`git worktree add
--detach`)에서의 실측 재현**으로 검증했다(공유 worktree는 읽기 전용으로만 사용, mutation은 격리 worktree에서 수행 후 제거).

**결론 먼저**: 집중 검증 항목 중 **④(unmountedRef)에서 CRITICAL급 실전 버그를 실측 재현으로 확인**했다. ①(streamRef
스킵 판정)에서도 부작용 누락 경로 2건을 실측으로 확인했으나 최종 상태는 수렴한다(WARNING). ②는 ④의 CRITICAL과 동일 항목.
③(streaming-무연결 과도상태의 자가복구)은 **확인됨 — 고착 경로 없음**.

---

## 발견사항

- **[CRITICAL] `unmountedRef` 가 1회성 래치라 `reactStrictMode: true` dev 환경에서 위젯이 영구히 부팅 불가 (집중검증 ②)**
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts` L179(`const unmountedRef = useRef(false)`),
    L283-286(`cannotApplyConfig` — `unmountedRef.current || bootGenRef.current !== attempt.boot`), 마운트
    `useEffect` L864(리셋 코드 없음), L976(`unmountedRef.current = true;`, 리셋 지점 없음).
    `codebase/channel-web-chat/next.config.ts` L10(`reactStrictMode: true` — 이 저장소에 실제로 켜져 있음).
  - 상세: React(18/19) StrictMode는 dev 전용으로 `deps: []` 마운트 effect를 **mount → cleanup → mount**
    순서로 1회 이중 호출한다. 이때 컴포넌트 인스턴스와 `useRef` 값 자체는 재생성되지 않고 그대로 유지된다.
    `worldGenRef`/`bootGenRef`는 "호출 시점에 현재 값을 새로 캡처해 비교"하는 **단조증가 카운터** 패턴이라 이
    이중 호출에 안전하지만, 이번 diff가 신설한 `unmountedRef`는 **부울 원웨이 래치**다 — 한 번 `true`가 되면
    그 인스턴스 수명 동안 되돌리는 지점이 코드 어디에도 없다(grep 확인: 선언·읽기·`true` 대입 3곳뿐). 즉
    StrictMode의 시뮬레이션 cleanup이 `unmountedRef.current = true`를 세팅하면, 이어지는 시뮬레이션
    remount는 물론 **그 이후 실제 도착하는 모든 `wc:boot`**이 `cannotApplyConfig`의 boot축 검사에 도달하기도
    전에 `unmountedRef.current` 만으로 항상 `true`를 반환해 `establishConfig`를 영구히 호출하지 못한다.
    - **격리 worktree에서 실측 재현**: `renderHook(() => useWidget(), { wrapper: React.StrictMode })` 후
      `wc:boot`을 보내고 embed-config를 resolve해도 `config`가 계속 `null`, `open()` 호출 후에도
      `webhookPosts=0`·`phase="panel"`에 고착(패널만 뜨고 대화가 영원히 시작되지 않는다). StrictMode를
      제거한 대조군은 정상 통과. `unmountedRef.current ||` 절만 제거하면 두 케이스 모두 통과해 **원인을
      `unmountedRef`로 단일 확정**했다.
    - 이 파일이 이번 plan에서 반복해서 겪은 "부울 원웨이 플래그는 위험, 캡처-비교형 카운터만 안전"이라는
      원칙(`worldGenRef` JSDoc이 명시적으로 경고하는 그 패턴)을 `unmountedRef`가 정확히 재도입한 사례다.
    - **영향 범위**: production(`output: 'export'` 정적 번들)은 StrictMode 이중 호출이 없어 무관하다. 그러나
      로컬 개발(`next dev`)은 이 저장소의 실제 설정(`reactStrictMode: true`)상 예외 없이 겪는다 — "위젯이
      dev에서 아예 안 뜬다"는 형태라 즉시 눈에 띄지만, 원인을 모르면 "환경 문제"로 오인해 디버깅 시간을
      허비하기 쉽다. 기존 vitest 스위트(385→387건)는 `renderHook`을 StrictMode로 감싸지 않아 이 경로를
      전혀 커버하지 못했다.
  - **관찰 사항 (공유 worktree 상태)**: 검증 도중 공유 worktree에 **미커밋 diff**가 생겼음을 확인했다 —
    `unmountedRef.current = false;`를 마운트 effect 시작부에 추가하는 수정과, StrictMode 이중 마운트
    회귀 테스트가 이미 작업 중이며, 주석이 `(ai-review 2026-07-17 18_39_11 security WARNING)`을 인용한다 —
    같은 라운드의 security 리뷰어가 동일 근본원인을 독립적으로 찾아 이미 수정이 진행 중인 것으로 보인다.
    **본 리뷰는 이를 수정 전 diff(`prompt_file` 스냅샷)에 대한 독립 검증으로 보고**하며, 참고로 그 수정과
    **동일한 1줄 fix**(마운트 effect 시작부 `unmountedRef.current = false;`)를 격리 worktree에서 직접
    적용해 위 재현 테스트 2건 + 기존 전체 스위트(387건)가 모두 통과함을 별도로 확인했다 — 관측된 수정
    방향은 이 문제를 올바르게 닫는 것으로 보인다. **다만 커밋 전이므로, 병합 전 반드시 (a) 그 수정이
    최종 커밋에 포함됐는지, (b) StrictMode 회귀 테스트가 실제로 CI에서 실행되는지 확인할 것.**
  - 제안: 마운트 effect 본문 시작부에서 `unmountedRef.current = false;`로 재무장(관측된 진행 중인 수정과
    동일 방향). 이 파일의 다른 모든 staleness 축이 "카운터 캡처-비교"인 것과 일관되게, 향후 유사한 축을
    추가할 때도 부울 원웨이 래치 대신 카운터 패턴을 우선 고려할 것 — 최소한 "이 ref가 부울 래치인가,
    카운터인가"를 JSDoc에 명시해 StrictMode 안전성을 리뷰 체크리스트 항목으로 남길 것.

- **[WARNING] `streamRef` 스킵 판정이 `establishConfig`의 `clientRef` 무조건 재구성은 못 막는다 — 재전송 간 `apiBase`
  축만 조용히 바뀌는 상태 분기 (집중검증 ①)**
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts` `establishConfig()` L845-861(특히 L848
    `clientRef.current = new EiaClient({ apiBase: cfg.apiBase })`), 마운트 effect L896
    (`const saved = streamRef.current ? null : loadSession(cfg.triggerEndpointPath);`).
  - 상세: 이번 diff의 재전송 스킵 판정(`streamRef.current` truthy → `saved=null`)은 **복원 분기**
    (`loadSession`/`seedWaitingFromStatus`/`openStream`/`scheduleRefresh`)만 건너뛴다. 그 앞의
    `establishConfig(cfg)`는 스트림 존재 여부와 무관하게 **매번** `clientRef.current`를 새 `cfg.apiBase`로
    재구성한다. 즉 "재전송은 config만 갱신하고 세션은 안 건드린다"는 §106 계약이 실제로는 **비대칭**이다 —
    `sessionRef.current`(옛 `apiBase`가 발급한 token/endpoints)는 그대로 살아있는데, 그 세션에 대해
    `sendCommand`/`interact`/`refreshToken`을 호출하는 **`clientRef.current`만 새 apiBase로 조용히 바뀐다**.
    `session.endpoints`는 상대경로이고 실제 요청 URL은 호출 시점의 `clientRef.current`(apiBase)로 조합되므로,
    재전송 이후 사용자가 메시지를 보내거나 토큰 갱신 타이머가 발화하면 **옛 apiBase가 발급한 세션이 새
    apiBase로 라우팅**된다. 관리자 라이브 미리보기가 스테이징↔프로덕션 등으로 잘못 전환되는 시나리오에서,
    이미 진행 중인 대화의 후속 명령이 전부 (또는 은밀히) 엉뚱한 백엔드로 가는 신뢰성 문제가 된다.
    (동일 근본원인을 security 리뷰어도 credential-노출 각도에서 독립적으로 발견·WARNING 처리했다 —
    `security.md` 발견사항 1. 여기서는 **상태 일관성/부작용** 각도로 보강한다: 신뢰 가능한 host가 보낸
    config라도, "재전송=config만 갱신"이라는 이 diff의 새 계약이 `clientRef` 축을 예외로 남겨뒀다는 점이
    핵심 — 이 축은 신규 테스트 6건 중 어디서도 커버되지 않는다.)
  - 제안: `streamRef.current`(또는 `sessionRef.current`) truthy 상태에서 `cfg.apiBase !==
    configRef.current?.apiBase`인 재전송을 받으면, `clientRef.current`만 조용히 바꾸지 말고 `newChat()`
    강제 또는 최소 `console.warn` + 회귀 테스트로 이 축을 명시적으로 고정할 것.

- **[WARNING] streamRef 미확립 구간에서 겹친 부팅 시도가 `getStatus`를 중복 발사한다(수렴은 하지만 낭비 호출) (집중검증 ①)**
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts` L896(`streamRef.current ? null :
    loadSession(...)`), L906-916(`seedWaitingFromStatus` 호출 + `isAttemptStale` 재검증).
  - 상세: `streamRef.current` 판정은 "**이미 연결됨**"만 감지하고 "**형제 시도가 이미 복원을 진행 중**"은
    감지하지 못한다. 구체 경로: 1차 시도가 checkpoint1을 통과해 `loadSession`+`seedWaitingFromStatus`(GET
    getStatus)를 시작했지만 아직 `openStream` 전(스트림 미확립, `streamRef.current === null`)인 상태에서
    2차 `wc:boot`이 도착해 1차를 대체(bootGenRef 증가)하면, 2차도 **자신의** checkpoint1을 통과한 뒤
    `streamRef.current`를 검사한다 — 이 시점에도 여전히 `null`(1차가 아직 openStream을 못 불렀으므로)이라
    2차 **또한** `loadSession`+`seedWaitingFromStatus`를 호출해 **같은 세션에 대해 GET `getStatus`가 두
    번** 나간다.
    - **격리 worktree에서 실측 재현**: 위 순서를 그대로 재현한 결과 `statusResolvers.length === 2`
      (동일 `executions/e1` 엔드포인트로 GET 2회 발사) 확인. 다만 **최종 상태는 올바르게 수렴**한다 — 1차는
      자신의 seed가 resolve된 뒤 checkpoint2(`isAttemptStale`)에서 boot축 불일치로 bail하고, 2차(최신
      시도)만 `openStream`을 호출해 최종적으로 EventSource 1개만 생성됨을 확인했다(§106 "마지막 boot
      승리" 의미는 깨지지 않는다).
    - 기존 신규 테스트("§106: 대체된 시도가 연결 전에 물러나도 살아있는 시도가 연결을 세운다", 파일 4
      L966-1027)의 코드가 `if (statusResolvers.length > 1) { ... }`로 **두 번째 resolver 존재 가능성을
      이미 방어적으로 처리**하고 있어, 구현자도 이 중복 발사 가능성을 어느 정도 인지했던 것으로 보이나
      명시적으로 assert·문서화되어 있지는 않다.
    - 심각도는 낮다: mutating 하지 않는 멱등 GET 중복이고, 실사용 경로(관리자 라이브 미리보기의 undebounced
      재전송)가 주로 "이미 스트림이 확립된 이후"에 반복되므로(§106 flicker-fix 테스트가 커버하는 정상
      케이스) 이 경합 창은 **초기 마운트 직후, 저장 세션이 있는 상태에서 아주 짧은 시간에 재전송이
      겹칠 때만** 열린다.
  - 제안: 낮은 우선순위지만, (a) 위 mutation/시나리오를 명시적 회귀 테스트로 추가해 "겹침이 있어도 GET은
    1회만"을 원한다면 `restoringRef`류의 "복원 진행 중" 플래그를 `bootGenRef`와 함께 검사하도록 확장하거나,
    (b) 의도적으로 감수하는 트레이드오프라면 L896 인근에 "형제 시도의 in-flight 복원과 중복될 수 있으나
    최종 상태는 수렴한다"는 주석을 남겨 다음 라운드가 다시 "버그"로 오인해 손대지 않게 할 것.

- **[INFO] 집중검증 ③ — "streaming인데 연결 없음" 과도상태는 이제 일시적이며 자가복구된다(고착 경로 없음)**
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts` L896-919(복원 분기), 대응 테스트
    `use-widget-eager-start.test.ts` "§106: 대체된 시도가 연결 전에 물러나도 살아있는 시도가 연결을 세운다"
    (파일 4 L966-1027).
  - 상세: 대체된(superseded) 시도가 `dispatch(RESTORED)`(phase→streaming) 이후 `seedWaitingFromStatus`
    도중 물러나면, 그 순간 `phase==="streaming"`이지만 `streamRef.current===null`인 과도상태가 실재한다
    (직전 라운드에서 지적된 그대로). 이번 라운드가 `startedRef` 기반 스킵 판정에서 `streamRef` 기반으로
    교정한 결과를 코드·체크포인트 의미론으로 추적한 결과: **최신(대체되지 않은) 시도는 항상 자신의
    checkpoint1/2를 통과해 `openStream`에 도달**하므로(세계가 별도로 바뀌지 않는 한 `isAttemptStale`이
    항상 false), 위 과도상태는 "아직 살아있는 최신 시도의 openStream 호출 전까지"로 **경계가 명확한
    일시적 구간**이다 — 살아있는 시도가 진행되면 그 즉시 실제 연결이 서서 상태가 정합해진다. 정적 분석
    결과 및 기존 통과 테스트(`expect(getEs()).not.toBeNull();`로 종결)로 모두 확인했다. 유일하게 "영구
    고착"이 가능한 경로는 최신 시도의 `isEmbedAllowed` 자체가 네트워크 행업 등으로 영원히 resolve하지
    않는 경우인데, 이는 이 diff 특유의 결함이 아니라 임의 비동기 코드에 공통되는 특성이라 별도로
    다루지 않는다. **이 항목은 새 발견이 아니라 사용자 요청에 따른 명시적 확인 결과다.**

- **[INFO] `streamRef` 스킵 판정 인근에 "재전송이 endpoint를 바꾸지 않는다" 불변식 재언급 누락 (문서 대칭성)**
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts` L896, 대비 L208-215(`pendingResetRef`
    JSDoc "불변식 의존 주의" 문단).
  - 상세: `pendingResetRef` JSDoc은 "재전송 호출부가 마운트를 유지한 채 `triggerEndpointPath`를 바꾸지
    않는다"는 불변식과, 그것이 깨질 경우의 위험("X 시절 요청이 Y의 세션을 초기화")을 명시하고 재검토를
    당부한다. **동일한 불변식이 새로 추가된 `streamRef.current ? null : loadSession(cfg.triggerEndpointPath)`
    판정에도 그대로 필요하다** — 만약 이 불변식이 깨지면(리마운트 없이 endpoint 전환), `streamRef.current`
    truthy 판정이 **다른 endpoint의 살아있는 스트림**을 이유로 새 endpoint의 정당한 복원을 스킵할 수 있다.
    현재는 실제로 도달 불가능(같은 이유로 안전)하지만, 이 경고가 `pendingResetRef`에만 있고 `streamRef`
    판정 옆에는 없어 향후 그 불변식을 깨는 변경이 생겼을 때 이 지점을 놓치기 쉽다 — 이 파일이 "가드
    누락은 비대칭에서 온다"는 교훈을 반복 학습해 온 만큼, 새 판정 지점도 같은 경고를 공유해 두는 편이
    이 파일의 자체 원칙과 일관된다.
  - 제안: L896 인근에 "이 판정도 `pendingResetRef` JSDoc(§불변식 의존 주의)과 같은 endpoint-불변 전제에
    기댄다"는 1줄 상호 참조 주석 추가(선택적, 낮은 우선순위).

- **[INFO] 그 외 체크리스트 항목(전역 변수·파일시스템·시그니처·인터페이스·환경 변수) — 이상 없음 확인**
  - 상세: (2) 전역 변수 신설 없음 — `unmountedRef`/`bootGenRef`/`beginBootAttempt`/`cannotApplyConfig`/
    `isAttemptStale`/`establishConfig` 모두 훅 스코프 `useRef`/`useCallback`. (3) 파일시스템 부작용 없음 —
    `sessionStorage`(브라우저)만 사용, `plan/`·`spec/` 문서 변경은 리뷰 정적 산출물이지 런타임 부작용
    아님. (4) 시그니처 변경 — `seedWaitingFromStatus`는 포맷팅만 바뀌고 파라미터/반환 타입 불변, 신규
    헬퍼들은 전부 내부 전용(외부 호출자 없음)이라 하위호환 이슈 없음. (5) 공개 인터페이스(`ChatInstance`,
    `wc:*` 프로토콜) 불변 — `2-sdk.md` 변경은 `code:` frontmatter 증거 추가뿐. (6) 환경 변수 읽기/쓰기
    해당 없음. (8) 이벤트/콜백 — `sendCommand`의 ERROR 경로에 추가된 `teardownSession()`은
    `bridgeRef.current?.sendEvent("conversationEnded", ...)`를 호출하지 않는(`finalizeEnded`를 의도적으로
    우회) 기존 동작을 그대로 보존한다는 주석과 실제 코드가 일치함을 확인했다 — host 콜백 발생 패턴에
    변경 없음.

---

## 요약

이번 라운드(재전송 flicker fix + checkpoint1 boot축 전용 재편)는 지시받은 CRITICAL 2건("world·boot OR
결합"·"리듀서 가드가 부작용을 못 막음")을 근본적으로 해소했고, 직전 라운드가 남긴 WARNING("streaming인데
연결 없음" 과도상태)도 이제 일시적·자가복구됨을 정적 분석과 기존 테스트로 확인했다(집중검증 ③, 문제 없음).
그러나 이번에 신설된 `unmountedRef`가 정확히 이 파일이 반복 경계해 온 "부울 원웨이 래치" 안티패턴을
재도입했고, 그 결과 이 저장소가 실제로 켜 둔 `reactStrictMode: true` dev 환경에서 위젯이 영구히 부팅하지
못하는 CRITICAL급 결함을 격리 worktree에서 실측 재현으로 확인했다(집중검증 ②·④). 검증 도중 같은 라운드의
security 리뷰어가 동일 근본원인을 이미 찾아 수정이 진행 중인 정황(미커밋 diff)을 관측했고, 그 방향의 1줄
수정을 독립적으로 재현·검증해 정확함을 확인했다 — 병합 전 그 수정이 최종 커밋에 포함되는지만 확인하면
된다. 그 외 `streamRef` 스킵 판정은 복원 분기(getStatus/SSE/토큰갱신)는 정확히 게이팅하지만
`establishConfig`의 `clientRef`(apiBase) 재구성은 게이팅하지 못해 재전송 간 세션-클라이언트 축 분리
가능성을 열어두며(WARNING, security 리뷰와 교차 확인), 겹친 부팅에서 `getStatus` 중복 발사(WARNING, 실측
재현·최종 상태는 수렴)도 발견했다 — 둘 다 데이터 손상이나 고착으로 이어지지는 않는 낮은-중간 위험이다.

## 위험도

HIGH — 개별 항목 중 하나(`unmountedRef` StrictMode 영구 락아웃)는 CRITICAL 등급이며 프로덕션에는 영향이
없으나 로컬 개발을 완전히 차단하는 실전 결함이다. 다만 확인 시점 기준 이미 정확한 방향의 수정이 진행
중으로 보여(커밋 확정 여부만 병합 전 재확인하면 됨) 즉시 차단(CRITICAL)보다는 "병합 전 반드시 확인"에
해당하는 HIGH로 평가한다. 나머지 WARNING 2건은 낮은-중간 위험이며 즉시 차단 사유는 아니다.

STATUS=success ISSUES=6 PATH=/Volumes/project/private/clemvion/.claude/worktrees/webchat-boot-single-flight-8c92b4/review/code/2026/07/17/18_39_11/side_effect.md RESET_HINT=
