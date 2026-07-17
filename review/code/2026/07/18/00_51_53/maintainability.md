# 유지보수성(Maintainability) 리뷰 — webchat-boot-single-flight (00_51_53)

## 점검 초점 (orchestrator 지정)

이번 라운드는 직전(23_58_23) maintainability WARNING 처리 결과와, `start()` fix 로 `seedWaitingFromStatus`
호출부가 3종(`applyConfig`=전체 토큰, `start()`=읽기전용 스냅샷, `replay_unavailable`=생략)이 된 상태를 집중
점검했다. 결론부터: 세 호출부의 규칙 자체는 정확하게 문서화돼 있고 `start()` 의 boot 스냅샷 캡처도 이해
가능하다. `useEiaSession` 분리 이월(별도 plan)도 근거가 탄탄하다. 다만 그 문서화·이력 기록 방식에서
아래 개선 여지를 발견했다.

## 발견사항

- **[WARNING]** `beginBootAttempt` JSDoc 의 "3번 CRITICAL" 이력 카운트가 이 PR 자신이 낸 4번째 사례로 stale
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts:255-258`(`beginBootAttempt` JSDoc)
  - 상세: 해당 JSDoc 은 "이 파일이 **비대칭 가드 누락으로 3번 CRITICAL 을 냈다** — 한 호출부는 재검증하고
    다른 호출부는 빠뜨리는 형태(`02_04_13` C1 · `08_29_33` W2 · `09_36_01` W5)"라며 토큰 캡슐화 설계의
    근거로 삼는다. `git log -S` 로 확인한 결과 이 문장은 이 PR 의 첫 커밋(`d64f60243`)에서 작성된 뒤 한
    번도 갱신되지 않았다. 그런데 바로 이 PR 안에서 정확히 같은 실패 유형이 재발했다 — `seedWaitingFromStatus`
    에 `attempt` 파라미터를 도입한 `18_39_11` C2 fix(`fa1dceba5`)가 `applyConfig` 호출부만 갱신하고
    `start()` 호출부를 그대로 뒀고, 그 비대칭이 `23_58_23` CRITICAL(concurrency·requirement·side_effect
    3인 독립 재현, RESOLUTION 이 스스로 "이 클래스의 **9번째** 거울상"이라 명명)로 이어졌다. 토큰
    캡슐화 도입 이후에도, 정확히 그 캡슐화가 막으려던 축(boot)에서 재발했다는 점이 핵심이다. 즉 이
    카운트는 "왜 이 설계를 택했나"라는 근거 서술을 넘어 "이 설계가 실제로 막아낸 범위"에 대한 독자의
    기대치를 형성하는데, 그 기대치가 현재 사실보다 낙관적이다.
  - 제안: 사례 목록에 `23_58_23`(및 그 직접 원인이 된 `18_39_11`)을 추가해 카운트를 갱신할 것. 이
    JSDoc 은 향후 `seedWaitingFromStatus` 에 4번째 호출부가 추가될 때 "이 축이 몇 번이나 놓쳤었는가"를
    가늠하는 유일한 인라인 신호이므로, 과소 카운트는 재발 방지 효과를 약화시킨다.

- **[WARNING]** plan 파일이 스스로 확립한 "거울상 진행기록" 패턴이 9번째(가장 최근) 사례에서 끊김
  - 위치: `plan/in-progress/webchat-boot-single-flight.md` — 6번째 거울상(`## 진행 기록 — flicker fix …
    6번째 거울상`, L243-270), 7번째(`## 진행 기록 — 7번째 거울상: StrictMode dev 파괴`, L272-290),
    8번째(`## 후속 (18_39_11 처리)` §1 "A-6 되돌림", L306-329)는 각각 재현·원인·교정·검증을 갖춘 전용
    섹션이 있다. 반면 9번째(`start()` 무방비, `23_58_23` CRITICAL, 커밋 `7cfbf2557`)는 L303
    한 줄("이 클래스에서 거울상 9회(23_58_23 기준)가 난 자리")에만 스쳐 지나간다.
  - 상세: 이 plan 은 반복적으로 "산문으로만 두면 완료 이동 시 묻힌다"는 논리로 이월 항목을 전용
    섹션·별도 plan 으로 승격해 왔다(A-6, `useEiaSession`, `webchat-command-failure-is-not-termination`
    이 전부 이 논리로 승격됐고, 이번 라운드도 그 논리를 `useEiaSession` 항목에 다시 적용해 WARNING 을
    올바르게 해소했다 — 아래 요약 참조). 그런데 정작 이번 라운드의 CRITICAL 자체(세 리뷰어가 독립
    재현한 `start()` 되감기·이중 스트림 결함과 그 교정)는 **이월된 항목이 아니라 이 PR 안에서 완결된
    fix** 임에도, 완결된 1~8번째 거울상들이 받은 것과 같은 전용 서술을 받지 못했다. 현재 상세는
    `review/code/2026/07/17/23_58_23/RESOLUTION.md`/`SUMMARY.md` 에만 있다. 정보가 유실된 것은
    아니지만(두 문서 모두 표준 review 산출물 경로에 보존됨), plan 자신의 서사 관행을 따라가는
    독자라면 정확히 이 항목에서 흐름이 끊긴다 — 그것도 오케스트레이터가 이번 라운드 "핵심"으로 지목할
    만큼 비중 있는 사례에서.
  - 제안: 이 plan 을 `complete/` 로 옮기기 전에 `## 후속 (18_39_11 처리 — 2026-07-17)` 와 동일한 형식으로
    `## 후속 (23_58_23 처리)` 섹션을 추가해 9번째 거울상(재현·원인·교정·검증)을 본문에 남길 것.

- **[INFO]** 3개 호출부의 attempt 전달 규칙 — 내용은 정확하나 인접한 표와 스타일이 다른 산문 서술
  - 위치: `use-widget.ts:507-514`(`seedWaitingFromStatus` 의 `@param attempt`)
  - 상세: 세 호출부(`applyConfig`=`beginBootAttempt()` 가 발급한 전체 `{world, boot}` 토큰,
    `start()`=`bootGenRef.current` 를 읽기전용으로 캡처한 `{boot: bootAtStart}`, `replay_unavailable`
    폴백=생략)의 규칙이 8줄 산문 단락으로 서술돼 있다. 코드 대조 결과(L522-524 시그니처, L628 캡처,
    L651/L982 호출, L426 생략 호출) 서술은 정확하고, "왜 생략해도 되는가"(스트림이 이미 열려 있어야
    발화하므로 재전송 복원 분기의 "스트림 미확립" 전제와 상호배타)까지 근거를 남겨 재발 방지 관점에서
    충실하다. 다만 바로 위(L491-494)에 같은 함수의 "staleness 정책 2종"(종료 확정=world 만, 표면
    갱신=world+boot)을 다루는 2행 markdown 표가 있어, 문서 안에서 표 형식이 이미 검증된 관용구인데,
    그보다 한 단계 더 헷갈리기 쉬운(이미 2회 CRITICAL 을 낸) "어느 호출부가 무엇을 넘기는가" 쪽은
    표로 전환되지 않았다.
  - 제안: `@param attempt` 를 "호출부 | 넘기는 값 | 왜" 3열 표로 전환 검토. 급하지 않음 — 현재 서술도
    정확하고 근거가 충분하다.

- **[INFO]** `useWidget()` 지속 성장 — 이번 PR만으로 함수 본문 +27%, 분리 이월 자체는 근거가 탄탄
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts`(파일 전체), `plan/in-progress/webchat-usewidget-extraction.md`(신설)
  - 상세: merge-base(`29aa918a6`) 대비 파일 전체 877→1080줄, `useWidget()` 함수 본문(L121-864→L121-1067)
    744→947줄(+203줄, +27%). `useCallback` 27개·`useRef` 13개(실측 재확인 — 제네릭 타입 인자가 있는
    선언까지 포함), `max-lines`/`complexity` eslint 가드 없음. 분리 이월 plan
    (`webchat-usewidget-extraction.md`)은 "규모가 아니라 세션 라이프사이클 로직의 응집도 부족이 반복
    결함(9회 거울상)의 온상"이라는 근거를 명확히 제시하고, 착수 전 확인할 설계 축(토큰 캡슐화가
    호출부 관점의 축 수를 1개로 되돌리는지)과 JSDoc 인접성 취약성의 lint/test 가드 전환까지 미리
    식별해 뒀다 — 이월 자체는 결함이 아니라 적절히 추적된 기술 부채로 판단한다.
  - 제안: 없음(범위 내 판단). 다만 추출 전에 10번째 거울상이 또 발생하면 "지금은 이른 시점이 아니다"
    라는 신호이므로 그때는 우선순위를 재검토할 것.

- **[INFO]** 테스트 파일의 fetch-mock/응답빌더 보일러플레이트 중복이 이번 라운드에도 누적
  - 위치: `codebase/channel-web-chat/src/widget/use-widget-eager-start.test.ts`(3304줄, `it()` 57개,
    `vi.stubGlobal("fetch", …)` 48회)
  - 상세: `allow()`/`waitingAt()`/`running()`/`completed()`/`terminal()` 같은 응답 빌더 클로저가 거의
    동일한 형태로 여러 `it()` 블록에 지역 재정의된다(예: `waitingAt` 3곳 — L3068/3130/3265).
    `bootWithPlan` 중복(L2503/L2577)은 `18_39_11` 라운드 maintainability 리뷰가 이미 INFO 로 지적했으나
    ("프로덕션 코드가 아니라 우선순위는 낮음") 아직 미해소이고, 이번 라운드(`start()` fix 의 재현
    테스트)가 같은 패턴의 새 클로저를 추가로 얹었다. 파일이 이미 `boot()`/`installFetch`/
    `installControllableEventSource` 같은 module-level 공유 헬퍼 관행을 갖고 있어 이 중복은 그 관행에서
    벗어난다.
  - 제안: 이번 병합을 막을 사안은 아니다. `webchat-usewidget-extraction.md` 가 예정한 "훅 단위 테스트
    신설" 작업에 응답빌더 공유 fixture(module-level `allow`/`waitingAt` 등) 정리를 함께 묶는 것을 권고.

## 확인한 양호 사항 (참고)

- `widget-state.ts`/`widget-state.test.ts` 의 `RESTORED`/`BOOTED` `ended` 가드 되돌림은 "한때 다르게
  판단했던 이유 → 반증 → 현재 방향" 서사가 명확하고, `it.each` 회귀 테스트로 정확히 그 방향을 고정해
  가독성·근거·테스트가 삼위일체로 갖춰진 모범 사례다.
- `start()` 의 boot 스냅샷 캡처(`const bootAtStart = bootGenRef.current;`, L628)는 변수명 자체가
  "무엇의 어느 시점 값인지"를 드러내고, 바로 위 6줄 주석이 "왜 `beginBootAttempt()` 로 세대를 올리지
  않는가"(올리면 `applyConfig` 의 supersede 카운팅이 오염됨)까지 선제적으로 답해 별도 설명 없이도
  코드만으로 이해 가능하다.
- 직전 라운드(`23_58_23`) 의 maintainability WARNING("`useEiaSession` 분리 이월이 산문으로만 남아
  묻힐 위험") 은 이번 라운드에서 `webchat-usewidget-extraction.md` 분리로 정확히 해소됐다 — 다만 그
  해소 방식이 만든 선례(별도 plan 승격)가 정작 이번 라운드 자신의 9번째 거울상에는 적용되지 않은 것이
  위 WARNING 이다.

## 요약

이번 diff 는 이미 여러 라운드의 리뷰를 거쳐 성숙한 상태이며, 코드 레벨 문서화는 전반적으로 정확하고
근거가 충실하다 — `seedWaitingFromStatus` 3개 호출부의 attempt 전달 규칙, `start()` 의 boot 스냅샷
캡처, `widget-state.ts` 의 가드 되돌림 서사 모두 실측 대조 결과 코드와 일치했고 새로운 복잡도·중첩·매직
넘버 문제는 발견되지 않았다(가드절 중심의 얕은 중첩이 일관되게 유지됨). `useEiaSession` 분리를 별도
plan 으로 승격한 처리도 직전 WARNING 을 정확히 해소했다. 다만 두 가지 문서 정합성 결함을 찾았다 —
①`beginBootAttempt` JSDoc 의 "3번 CRITICAL" 이력이 이 PR 자신이 낸 4번째(사실상 9번째 거울상) 사례를
반영하지 못해 stale 하고, ②plan 파일이 스스로 확립한 "거울상 진행기록" 전용 섹션 관행이 정작 이번
라운드의 핵심 CRITICAL(9번째 거울상)에는 적용되지 않았다. 둘 다 코드 동작이나 안전성에는 영향이 없고
정보 자체가 유실된 것도 아니지만(RESOLUTION.md/SUMMARY.md 에 상세 존재), 이 파일이 반복적으로
"같은 실패 유형을 몇 번이나 겪었는가"를 인라인 카운트로 추적해 재발을 막아온 관행 자체의 신뢰도를
갉아먹으므로 병합 전 보정을 권장한다. `useWidget()` 지속 성장과 테스트 파일 보일러플레이트 중복은
이미 다른 plan/이전 라운드가 인지·추적 중인 기존 추세로, 이번 diff 가 새로 만든 문제가 아니다.

## 위험도

LOW
