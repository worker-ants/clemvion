# 테스트(Testing) Review

대상 커밋: `410705910`(fix: `refresh_deferred` 갱신 사이클 + 미뤄 둔 스트림 재개) +
`092d784a3`(docs: 세 번째 갈래 명문화 + teardown 방어선 뮤턴트 생존 근거).
새 테스트 9개(`use-token-refresh.test.ts` 8개 + `use-widget-eager-start.test.ts` 1개 —
과제 서술의 "7개"는 `retryDelayMs`(3건)·`onRefreshed`(2건)를 그룹 단위로 셀 때의 표현으로 보이며
실제 `it()` 블록 수는 9개다. 사소한 계수 차이라 별도 항목화하지 않음)를 대상으로,
**repo 밖 scratch 사본**(`/private/tmp/.../scratchpad/webchat-mutate`, `node_modules` 는
원본으로 symlink)에서 12종의 뮤테이션을 직접 재현해 vacuous 여부를 실측했다. 실제 저장소
워킹트리는 전 과정에서 변경하지 않았다(`git status` 로 확인, mutation 전/후 clean).

## 사용자가 지목한 두 지점 — 둘 다 실측으로 vacuous 아님을 확인

### 1. 백오프 재예약 테스트의 "간격대로 끊기"가 실제로 분기를 가른다

`use-token-refresh.test.ts:210-227`("일시적 실패(네트워크) → 백오프로 재예약") 를 3가지 축으로
뮤테이션해 각각 RED 확인:

- **재예약 자체 제거**(구코드로 되돌림, `use-token-refresh.ts:170-171` 삭제) → `callTimes(2)` 단언에서
  실패(1회에서 멈춤). "재시도 없음" 버그를 잡는다.
- **`retryDelayMs` 지수 계산을 상수로 치환**(고정 5000ms 리턴) → 세 번째 `advanceTimersByTimeAsync(BASE_MS)`
  구간에서 `callTimes(2)` 단언이 실패(고정 지연이면 그 지점에서 이미 3번째 호출이 발생). "재시도는 하되
  안 자란다" 버그를 잡는다.
- **`retryDelayMs` off-by-one**(`consecutiveFailures` 를 `-1` 없이 사용) → 같은 테스트에서 즉시 RED,
  **더불어** 순수 단위 테스트(`use-token-refresh.test.ts:52-56`)도 독립적으로 RED — 두 겹 방어.

세 뮤테이션 모두 61분 한 번 점프였다면 잡지 못했을 형태(재예약 유무만 보고 지연 성장 여부는 못 봄)를
간격별 관측이 정확히 가른다는 사용자의 설계 의도가 실측으로 뒷받침된다. 안정성도 확인 —
동일 테스트를 격리 반복 실행 3회 모두 결과 동일(비-flaky).

### 2. 통합 회귀의 "1회차만 실패" fixture 가 옳다

`use-widget-eager-start.test.ts:557-598`("§R4: 미뤄 둔 스트림은…") 를 3가지 축으로 뮤테이션해 RED 확인:

- `useWidget` 의 `onRefreshed` 배선 제거(`use-widget.ts:276`) → `getEs()` 가 끝까지 `null`,
  `expect(getEs()).not.toBeNull()` 에서 RED.
- `resumeDeferredStreamRef` 내부 `openStream(session, "0")` 호출 제거(`use-widget.ts:748`) → 동일하게 RED.
- 공유 술어 `isTerminalAuthError` 의 `410` 분기 제거(`eia-client.ts:180`) → 이 통합 테스트 자체는
  영향 없음(간접 확인, §아래 갭 참고).

fixture 를 "계속 실패"로 바꿨다면(1회차만이 아니라) 미뤄 둔 스트림이 영원히 안 열리는 것이 정상이 되어
배선 유무를 구분 못 한다는 사용자의 우려도 코드로 확인된다 — 첫 실패는 `TypeError("network down")`
(1회차만, `use-widget-eager-start.test.ts:570`), 두 번째 호출부터 200 성공을 반환하도록 짜여 있어
"미뤄 둔 스트림이 실제로 열리는가"를 정확히 가른다.

## 발견사항

- **[WARNING]** `resumeDeferredStreamRef` 의 "정상 경로 갱신이면 no-op" 가드가 뮤턴트에 생존한다 —
  `092d784a3` 가 문서화한 `teardownSession` 생존과 **같은 뿌리의 두 번째 사례**인데 어디에도 적혀 있지 않음
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts:743` (`if (!deferredStreamRef.current) return;`)
  - 상세: 이 줄을 제거해 "매 갱신 성공마다 무조건 `openStream` 호출"로 바꿔도 위젯 전체 스위트
    426/426 이 그대로 초록이었다(격리 실행·전체 실행 둘 다 재현). 원인은 `092d784a3` 가 이미
    `use-widget.ts:340-348` 주석에서 설명한 것과 동일한 방어 중복이다 — `deferredStreamRef.current`
    가 `false` 인 시점은 항상 "정상 경로가 이미 스트림을 열어 `streamRef.current !== null`" 인 상태이므로,
    가드를 지워도 `openStream` 내부의 `already_owned` 게이트(`use-widget.ts:457`,
    `if (streamRef.current !== null) return "already_owned";`)가 재호출을 무해하게 흡수한다.
    즉 이 가드도 "지금의 호출 순서 + 자매 게이트에만 의존해 무해한" 근-등가 뮤턴트다.
    `092d784a3` 는 정확히 이 논리로 `teardownSession` 쪽 한 곳만 주석에 남겼는데, **바로 옆
    쌍둥이 지점(같은 파일, 같은 방어망에 기대는 코드)은 실측도 기록도 안 됐다** — "한쪽만 고치는
    것이 이 브랜치의 반복 결함" 이라고 이 PR 스스로 두 번 적어 둔 바로 그 패턴이 테스트 커버리지
    기록에서도 재발했다.
  - 제안: `teardownSession` 의 것과 동일한 형식으로 "이 줄을 지우는 뮤턴트도 생존한다 — 근거: …"
    주석을 이 자리에도 남기거나, 두 survivor 를 한 곳(예: `plan/in-progress/webchat-auth-session-status-reconcile.md`)
    에 함께 등재해 향후 `already_owned` 게이트가 바뀔 때 재검토 대상이 된다는 사실을 추적 가능하게
    할 것. 코드 동작 자체는 현재 안전하므로 즉시 fix 불요.

- **[WARNING]** 새 `use-token-refresh.test.ts` 만 놓고 보면 `410` 실패의 "재시도 중단" 축이
  주기 갱신 경로에서 직접 검증되지 않는다 — 공유 함수·타 파일 커버리지에만 의존
  - 위치: `codebase/channel-web-chat/src/widget/use-token-refresh.test.ts:234-242`
    ("`401` 실패는 재시도하지 않는다") — `410` 버전이 없다.
  - 상세: `isTerminalAuthError`(`eia-client.ts:179-181`)에서 `err.status === 410` 분기만 제거하는
    뮤테이션을 넣고 전체 스위트를 돌리면, **`use-token-refresh.test.ts` 의 9개 신규 테스트는
    전부 초록으로 남고**, 대신 완전히 다른 파일의 기존(비신규) 테스트
    `use-widget-eager-start.test.ts:443` ("§R4: refresh 가 `410` 으로 실패해도 종료로 확정한다")
    가 RED 로 잡는다. `refreshToken`(`eia-client.ts:108-118`)이 실제로 `410` 을 낼 수 있다는 사실은
    이 PR 의 선행 plan 문서(`plan/complete/webchat-reload-rest-error-branches.md`)가 "구현 중
    `410` 도 `/refresh-token` 이 실제로 내는 분기임이 드러나 같은 갈래로 함께 닫았다" 고 명시한
    실제 운영 경로다. 지금은 우연히 다른 호출부의 테스트가 공유 함수를 통해 이 축을 대신
    잡아 주고 있을 뿐이며, 이 PR 의 커밋 메시지·코드 주석이 반복해서 경계하는 바로 그 결함류
    ("한쪽만 고치는 것이 이 브랜치의 반복 결함")가 재현될 경우 — 예컨대 누군가 주기 갱신 쪽에
    `isTerminalAuthError` 를 안 쓰고 `err.status === 401` 만 인라인으로 다시 박아 넣는 "빠른 수정"을
    하면 — `use-token-refresh.test.ts` 자체에는 이를 잡을 테스트가 없다.
  - 제안: `` it("`410` 실패도 재시도하지 않는다", …) `` 를 401 테스트 옆에 짝으로 추가(패턴은
    기존 401 테스트를 `new EiaError("revoked", 401)` → `new EiaError("execution terminated", 410)`
    로 바꾸기만 하면 됨, 5줄 미만).

- **[INFO]** `onRefreshed` 통지를 `scheduleRefresh()` 재예약보다 먼저 호출해야 한다는 JSDoc 상의
  순서 요구가 테스트로 강제되지 않고, 현재 구현에서는 관측 가능한 차이도 없다
  - 위치: `codebase/channel-web-chat/src/widget/use-token-refresh.ts:152-156`
    (주석: "**`scheduleRefresh()` 보다 먼저 부른다**: … 같은 tick 에 전달되어야 한다.")
  - 상세: 두 호출 순서를 뒤바꾸는 뮤테이션(스케줄 먼저, 통지 나중)을 넣고 전체 스위트(426)를
    돌려도 전부 초록이었다. 두 호출 모두 동일 동기 콜백(`.then()`) 안에서 이뤄지고
    `scheduleRefresh()` 자체는 `setTimeout` 을 예약할 뿐 콜백을 즉시 실행하지 않으므로, 현재
    구현상 순서는 실질적으로 관측 불가능한 축이다. 문서화된 불변식이 테스트로 뒷받침되지 않는
    상태이며, 이는 사소하지만 이 리뷰가 다른 두 항목에서 지적한 "문서와 테스트 커버리지의
    괴리" 패턴과 결이 같다.
  - 제안: 우선순위 낮음. 굳이 고정하려면 `onRefreshed` 콜백 안에서 `scheduleRefresh` 의 부작용
    (예: 새 타이머가 아직 안 걸렸는지)을 관측하는 call-order spy 테스트를 추가할 수 있으나,
    현재 동기 구조에서는 실익이 작다 — 주석 쪽에 "현재는 동기 실행이라 순서가 관측 불가능한
    근-등가"라는 단서를 덧붙이는 정도로 충분.

- **[INFO]** 신규 테스트 9종 전수 뮤테이션 결과 요약(양성 확인) — 아래 6개 축은 전부 의도한 대로 RED
  - 상세: (1) 재예약 제거 → 백오프 테스트 RED, (2) `401`/`410` 판정을 무력화(재시도 허용) →
    401 테스트 RED, (3) 실패 응답 도착 시 세대검사 제거 → 세대변경 테스트 RED, (4) 성공 시
    `onRefreshed` 미호출 → onRefreshed-성공 테스트 RED(길이 단언), (5) `onRefreshed` 에 갱신 전
    세션 전달 → 같은 테스트의 **값** 단언에서 별도로 RED(길이만 보는 뮤테이션과 축이 다름을 확인),
    (6) 실패 시에도 `onRefreshed` 호출 → onRefreshed-실패 테스트 RED. `retryDelayMs` 순수 함수
    3종(지수 성장·상한 클램프·0/음수 하한)도 각각 독립 RED. 사용자가 이미 돌린 6종(5 RED·1 생존)과
    합쳐 이번에 직접 재현·확장한 축은 총 12종이며, 그중 진짜 살아있는 사각지대는 위 두 WARNING
    (테스트 갭)뿐이고 코드 동작 자체의 결함은 발견되지 않았다.

- **[INFO]** `teardownSession` 플래그 해제 생존(`092d784a3` 가 이미 문서화·처분 완료) 독립 재확인
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts:349`
  - 상세: 해당 줄을 제거하고 전체 스위트를 실행하면 정확히 개발자가 적어 둔 대로 426/426 이
    그대로 통과한다(격리된 scratch 사본에서 독립 재현, 숫자까지 일치). 근거 주석(같은 파일
    340-348행)도 타당하다 — 위 신규 WARNING 두 건과 함께 "이 방어망은 자매 게이트에 의존하는
    근-등가 뮤턴트" 클래스로 한데 묶어 추적하면 재조사 비용이 줄어든다.
  - 제안: 조치 불요(이미 처분됨). 참고용 재확인.

## 요약

사용자가 특히 우려한 두 지점 — 백오프 테스트의 간격별 관측, 통합 회귀의 1회차-실패 fixture —
는 repo 밖 scratch 사본에서 직접 뮤테이션을 재현한 결과 **둘 다 vacuous 가 아니며 설계 의도대로
분기를 가른다**(각각 3종의 서로 다른 뮤테이션으로 검증, 백오프 테스트는 반복 실행으로 비-flaky
확인). 신규 테스트 9개 전체에 대해 총 12종의 뮤테이션(사용자가 돌린 6종을 독립 재현 + 신규 6종
추가)을 적용한 결과, 코드 자체의 살아있는 결함은 없었으나 **테스트 커버리지의 사각지대 2건**을
새로 찾았다 — (1) `resumeDeferredStreamRef` 가드가 이미 문서화된 `teardownSession` 생존과 같은
뿌리의 두 번째 근-등가 survivor인데 기록이 안 됐고, (2) 신규 `use-token-refresh.test.ts` 는 `401`
만 직접 테스트하고 `410`(이 PR 자신의 plan 문서가 "실제로 refresh-token 이 내는 분기"라 명시한
값)은 다른 파일의 기존 테스트에만 의존한다 — 두 축 모두 이 PR이 반복해서 스스로 경계한 "호출부
비대칭/한쪽만 고침" 결함류가 테스트 계층에서 재현된 형태라 별도로 문서화·보강할 가치가 있다.
그 외 순서-의존 JSDoc 하나는 현재 구조상 관측 불가능한 근-등가라 우선순위가 낮다.

## 위험도

LOW — 코드 동작 결함은 없음(신규 테스트 자체는 유효). 발견한 두 WARNING 은 향후 회귀 발생 시
탐지가 늦어질 수 있는 테스트 커버리지 갭으로, 기능 동작을 즉시 위협하지 않는다.
