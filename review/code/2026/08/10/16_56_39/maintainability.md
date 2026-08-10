# 유지보수성(Maintainability) Review

대상: `codebase/channel-web-chat/src/widget/use-widget.ts` · `use-widget-eager-start.test.ts` (미커밋 diff, `recoverFromExpiredToken` 의 non-terminal refresh 실패 처리를 `"continue"` → `"stale"` 로 정정) + `session-store.ts`/`use-token-refresh.ts`/`CHANGELOG.md`/`plan/in-progress/webchat-auth-session-status-reconcile.md` (이전 라운드에 이미 커밋된 상태, 이번 브랜치 diff 범위에 포함).

## 요청받은 두 가지 판정

**1) `seedWaitingFromStatus` JSDoc 위치 복원이 정확한가 — 정확하다(확인 완료).**
`codebase/channel-web-chat/src/widget/use-widget.ts` 를 직접 읽어 대조한 결과, `recoverFromExpiredToken` 자신의 JSDoc(371-389행, "`401` 낙관적 refresh 1회…")은 그 선언(390행 `const recoverFromExpiredToken = useCallback(`) 바로 위에 있고, `seedWaitingFromStatus` 자신의 JSDoc(451-532행, "`getStatus` REST 응답으로…")은 그 선언(533행 `const seedWaitingFromStatus = useCallback(`) 바로 위에 있다. 두 블록 사이(390-449행)에 다른 함수의 JSDoc 이 끼어 있거나, 반대로 엉뚱한 곳(예: `seedWaitingFromStatusRef` 선언부 186-194행, `sessionEstablished` 206-222행)에 잔존 블록이 남아 있는 정황은 없다 — grep 으로 파일 전체의 `/**` 개시 지점을 훑어도 이 두 함수 근방에 중복·고아 블록은 없다.

**2) `SeedOutcome` 의 `"stale"` 이 이제 두 의미를 담는 것이 타당한가 — 호출부 계약 관점에서는 정당화되지만, 그 확장을 반영해야 할 문서 3곳 중 하나는 실제로 코드와 모순되는 상태로 남아 있다.**

- **호출부 관점**: `applyConfig`/`start()` 는 `if (outcome !== "continue") return;` (예: `use-widget.ts:682`) 로 `"ended"`/`"stale"` 를 구분 없이 "중단" 한 갈래로만 취급한다. 실제로 `"stale"` 이 반환되는 지점은 이미 최소 3가지 서로 다른 사유였다(이번 diff 이전부터) — ① `isStale(gen)`(세계 세대 변경, 401-line 401/442/550/586), ② `configRef.current` 부재("부팅 전으로 되돌아감", 403행), ③ 이번 diff 로 추가된 non-terminal refresh 실패("이번 왕복만 포기", 435행). 호출부가 이유를 구분할 필요가 전혀 없으므로("아무것도 안 건드리고 멈춘다"는 행동 계약이 셋 다 동일), 네 번째 유니언 멤버를 새로 만드는 대신 기존 `"stale"` 을 재사용한 판단 자체는 방어 가능하다.
- **문서 관점 — 여기가 문제**: 타입 레벨 유니언 doc(`use-widget.ts:90`, `/** await 사이 세션이 교체·초기화됨 → 응답을 폐기함(아무 상태도 안 건드림). */`)과 함수 레벨 `@returns` 설명(`use-widget.ts:490`, `` `"stale"`(await 사이 세션 교체)은 지연 응답이 새 대화의 스트림을 옛 토큰으로 탈취하는 것을 막는다. ``) 둘 다 여전히 **"세계가 바뀌었다"는 원래 의미 하나만** 서술한다 — 이번 diff 가 추가한 "세계는 그대로인데 이번 refresh 시도만 포기한다"는 세 번째 사유는 어디에도 반영되지 않았다. 이건 단순 누락 정도지만, 아래 CRITICAL 급 인접 문제와 짝을 이룬다.

## 발견사항

- **[WARNING]** `seedWaitingFromStatus` 함수 JSDoc 의 "REST 오류 분기" 표가 지금 코드와 정면으로 모순된다 — non-terminal refresh 실패의 반환값을 여전히 `"continue"` 로 서술
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts:482-483` (서술) vs 실제 반환 지점 `codebase/channel-web-chat/src/widget/use-widget.ts:421-435`(`if (!terminal) { …; return "stale"; }`)
  - 상세: 482-483행은 "재차 `401`·`410` → `"ended"`(복구 불가 확정, §R4). 그 **외** 실패(네트워크 등)는 `"continue"` — 일시적 장애가 대화를 끝내지 않게 하는 경계다." 라고 적는다. 그러나 이번(미커밋) diff 로 `recoverFromExpiredToken` 의 `catch` 안 `!terminal` 분기(421-435행)는 `"continue"` 가 아니라 `"stale"` 을 반환하도록 바뀌었다 — 421-429행 인라인 주석 자체가 "`"continue"` 를 돌려주면 안 된다… 거부된 토큰으로 새 SSE 를 연다" 라고 그 이유까지 명시한다. 즉 같은 파일 안에서 함수 JSDoc(482-483행)과 함수 본문 주석(426-435행)이 같은 분기에 대해 서로 다른 반환값을 주장하는 상태다. 신규 테스트(`use-widget-eager-start.test.ts:487` "refresh 가 `500` 으로 실패해도…")의 단언(`getEs()` null·`phase !== "ended"`·storage 보존)도 `"stale"`(SSE 미오픈) 동작과 일치하고 `"continue"`(SSE 오픈) 동작과는 불일치한다 — 코드·테스트는 일관되게 "stale" 인데 이 한 곳의 JSDoc 문장만 옛 값을 그대로 두고 있다. 이 저장소는 "문서화된 계약이 실제 구현보다 넓거나(또는 다르거나) 하면 실제로 버그가 난다" 는 사고를 반복 겪은 이력이 있고(같은 파일의 다른 CRITICAL 들이 정확히 이 패턴), 신뢰할 수 없는 JSDoc 은 다음에 이 함수를 손보는 사람(혹은 에이전트)이 "그 외 실패는 continue 니까 손댈 필요 없다" 고 오판하게 만든다.
  - 제안: 482-483행을 "재차 `401`·`410` → `"ended"`(복구 불가 확정, §R4). 그 **외** 실패(네트워크 등)는 `"stale"` — 세션은 보존하되 이번 왕복만 포기하고, 다음 복구는 `use-token-refresh` 의 주기 갱신에 맡긴다." 식으로 정정. 바로 아래 484행("그 외는 여전히 soft-fail `"continue"`")과 나란히 두면 같은 "그 외" 라는 표현이 서로 다른 대상(refresh 자체의 그 외 실패 vs getStatus 자체의 그 외 실패)을 가리켜 혼동 소지가 있으므로, 두 "그 외"를 구분하는 짧은 절("getStatus 자체의 401/404 아닌 오류는…" 등)을 덧붙이는 것도 함께 권장.

- **[WARNING]** `SeedOutcome` 의 `"stale"` 유니언 멤버가 이제 최소 3가지 이질적 사유(세계 세대 변경·부팅 전 복귀·non-terminal refresh 실패)를 하나의 이름 아래 묶는데, 타입 레벨/함수 레벨 문서가 그 확장을 반영하지 않는다
  - 위치: 타입 유니언 doc `codebase/channel-web-chat/src/widget/use-widget.ts:90`(`/** await 사이 세션이 교체·초기화됨 → 응답을 폐기함(아무 상태도 안 건드림). */`), `@returns` 설명 `codebase/channel-web-chat/src/widget/use-widget.ts:490`. 실제 세 반환 지점: `:401`/`:442`(세대 변경), `:403`(config 부재), `:435`(이번 diff, refresh 실패)
  - 상세: 위 "요청받은 두 가지 판정" §2 참고. 호출부 행동 계약이 동일하다는 점에서 재사용 자체는 정당화 가능하지만, `"stale"` 이라는 이름은 "무언가가 오래돼 못 쓰게 됐다(교체·초기화됨)"는 의미를 강하게 내포한다 — 435행의 실제 조건은 정반대로 "아무것도 안 바뀌었고 세션은 여전히 유효한데, 이번 refresh 왕복 한 번만 포기한다"이다(435행 근처 인라인 주석이 스스로 "정확히 그 뜻이다" 라고 강조하지만, 그 강조가 필요하다는 사실 자체가 이름만으로는 의미가 안 통한다는 신호다). 지금은 타입/함수 문서가 원래 의미 하나만 서술하므로, 이 union 타입만 보고 코드를 안 읽는 독자는 435행의 반환을 "가벼운 세대 재검사 실패" 로 오독하기 쉽다.
  - 제안: 강제 리팩터링(신규 유니언 멤버 추가)까지는 불필요 — 다만 90행 doc 을 "await 사이 세션이 교체·초기화됐거나, 복구 시도 자체를 포기함(둘 다 호출부는 아무 것도 안 건드리고 멈춘다)" 처럼 넓혀 실제 사용 범위를 반영하고, 490행 `@returns` 설명에도 "refresh 시도가 비-terminal 오류로 실패해 이번 왕복을 포기한 경우도 포함" 한 문구를 추가할 것을 권장. 향후 이 두 사유를 호출부가 구분해야 하는 요구(예: "포기"만 재시도 카운터를 올린다 등)가 생기면 그때는 신규 멤버 분리가 맞다.

- **[WARNING]** 신규 `500` 리프레시 실패 테스트가 바로 위 "네트워크 오류" 테스트의 본문(assert 4줄 + `waitFor`/`act` 블록)을 거의 그대로 복제
  - 위치: `codebase/channel-web-chat/src/widget/use-widget-eager-start.test.ts:448-485`("§R4: refresh 가 **네트워크 오류**로 실패하면…") vs `:487-521`("§R4: refresh 가 `500` 으로 실패해도…")
  - 상세: 두 테스트는 `fetchMock` 안의 `/refresh-token` 응답(하나는 `Promise.reject(new TypeError(...))`, 하나는 `{ ok:false, status:500 }`)만 다르고, `sessionStorage` 시드·`boot()` 이후의 `waitFor(refresh 호출 확인)` → `act(microtask flush)` → `expect(phase).not.toBe("ended")` → `expect(getEs()).toBeNull()` → `expect(storage).not.toBeNull()` 4단 검증 시퀀스는 문자 그대로 동일하다. 이전 라운드 리뷰(`review/code/2026/08/10/16_09_40/maintainability.md`)에서 이미 이 파일의 `fetchMock` 클로저 중복을 지적했었고, 그때 SUMMARY 는 "네 케이스의 자기완결성이 이점. `410` 이 생기면 그때" 라며 채택하지 않았다. 그런데 `410` 케이스는 이미 그 이전(이번 브랜치의 더 앞선 커밋)에 추가됐고, 이번 diff 로 `network-오류`/`500` 두 케이스까지 더해져 유사 시나리오가 최소 4개(`401`-재차실패·`410`·네트워크·`500`)로 늘었다 — 유예 조건("다섯 번째")을 이미 지나쳤다.
  - 제안: `installRefreshAttemptFetch({ statusGet, refreshOutcome })` 류의 작은 헬퍼로 `fetchMock` 생성 + 공통 4단 검증(`expectRefreshAbandoned(result, getEs, storageKey)`)을 추출해 두 테스트(및 향후 `410`/추가 상태코드 케이스)가 몇 줄로 줄도록 하는 것을 권장. 강제성은 낮음(현재도 각 테스트가 자기완결적으로 읽힘) — 하지만 다음에 비슷한 케이스가 하나 더 늘면(예: refresh 가 `403` 을 주는 경우) 재고할 것.

- **[INFO]** `CHANGELOG.md` 의 §401 항목이 이번(비-terminal refresh 실패 → `"continue"`에서 `"stale"`로 변경) 정정을 반영하지 않음
  - 위치: `CHANGELOG.md:171-172`
  - 상세: 171행은 "§R4 의 결정대로 한 번 시도해 만료면 복구하고, 재차 `401`·`410` 이면 종료로 확정한다" 라고만 적고, 172행("그 외 오류는 여전히 soft-fail")은 문맥상 `getStatus` 자체의 그 외 상태코드를 가리키는 것으로 읽힌다(같은 항목의 4번째 문단이 이미 그 취지로 쓰여 있음). refresh 시도 자체가 네트워크/기타 오류로 실패했을 때 "종료도 진행도 아닌 `"stale"`(왕복 포기, 세션 보존)" 이라는 세 번째 결과가 있다는 사실은 CHANGELOG 어디에도 명시적으로 없다. 기능적으로 틀린 서술은 아니지만(직접 반박하는 문장은 없음), 이 영역의 다른 CHANGELOG 항목들이 세부 분기를 번호 매겨 촘촘히 기록해 온 관례에 비추면 이번 정정만 누락된 형태다.
  - 제안: documentation reviewer 소관과 겹칠 수 있어 강제하지 않음 — CHANGELOG 항목을 다시 다듬을 일이 있으면 "refresh 시도 자체가 실패하면(네트워크 등) 세션은 보존한 채 이번 왕복만 포기한다" 한 문장 추가를 고려.

## 요약

이번 라운드의 핵심 변경(`recoverFromExpiredToken` 의 non-terminal refresh 실패 처리를 `"continue"`→`"stale"` 로 정정)은 코드·인라인 주석·신규 테스트 세 곳 모두 일관되게 새 값을 반영하고 있어 구현 자체는 건전하다. 요청받은 첫 번째 질문("JSDoc 위치 복원이 정확한가")은 실제 파일을 열어 대조한 결과 **정확하다** — 두 함수(`recoverFromExpiredToken`, `seedWaitingFromStatus`) 모두 자기 JSDoc 이 자기 선언 바로 위에 붙어 있고 잔존/고아 블록은 없다. 두 번째 질문("`"stale"` 의 두 의미가 타당한가")은 **호출부 행동 계약 관점에서는 정당화되지만 대가가 없지 않다** — 이번 diff 가 그 확장을 만든 뒤 정작 세 군데(타입 유니언 doc, 함수 `@returns`, 그리고 결정적으로 `seedWaitingFromStatus` JSDoc 의 "REST 오류 분기" 표 한 줄)의 문서를 동기화하지 않았고, 그중 마지막 한 줄은 단순 누락이 아니라 **코드와 정반대의 값을 명시적으로 주장**하는 상태다. 이 파일 자신이 반복해서 "문서화된 계약이 구현과 어긋나면 실제 버그로 이어진다"를 근거로 남겨 온 이력을 감안하면, 이 불일치는 지금 당장 런타임 결함은 아니지만 다음 수정에서 신뢰할 수 없는 지침이 될 위험이 크다. 부수적으로 신규 `500` 리프레시 테스트가 바로 앞 테스트를 거의 그대로 복제해, 이전 라운드에 유예했던 fetchMock 파라미터화 논의를 재고할 시점이 됐다.

## 위험도

MEDIUM
