# 요구사항(Requirement) Review

대상: `codebase/channel-web-chat/src/lib/session-store.ts`, `codebase/channel-web-chat/src/widget/use-token-refresh.ts`,
`codebase/channel-web-chat/src/widget/use-widget.ts`, `codebase/channel-web-chat/src/widget/use-widget-eager-start.test.ts`,
`CHANGELOG.md`, `plan/in-progress/webchat-auth-session-status-reconcile.md` — 직전 라운드(`16_09_40`)의 CRITICAL
(refresh 성공 후 호출부가 갱신 전 토큰으로 SSE 를 여는 결함) 수정 + spec `3-auth-session.md` §3.1-2·§R4 재대조.

**중요 — 리뷰 시점 유의**: 이 diff 는 `git log` 상 `deb9b6978`(feat 구현) → `4eb1be379`(CRITICAL fix) →
`54a181f0a`(6건 반영) → `b8689ec41`(전 라운드 리뷰 산출물 커밋) → `77f0786e7`(plan 문서 보강) →
**`d568aa7f1`**(401 복구를 `recoverFromExpiredToken` 헬퍼로 분리 + `plan/` 에 동시성 경합 정식 등재)까지
이어져 있다. 마지막 커밋(`d568aa7f1`)은 본 리뷰 프롬프트가 캡처한 diff 스냅샷 **이후** 커밋된 것으로,
같은 `16_26_09` 라운드의 다른 리뷰어(maintainability·side_effect) 산출물에 대한 개발자 반응으로 보인다.
프롬프트의 게이트 줄번호는 이 커밋으로 `use-widget.ts` 의 401 처리 블록이 별도 함수로 옮겨지며 더 이상
정확히 대응하지 않으므로, 아래 위치 인용은 **현재 HEAD(`d568aa7f1`)를 `Read`로 직접 열어 확인한 실제
줄번호**를 쓴다. 또한 `git status` 상 `use-widget-eager-start.test.ts` 에 **커밋되지 않은 진행 중 편집**이
있어(다른 세션이 이 워크트리를 공유 중), 그 파일의 `tsc`/vitest 결과는 일시적으로 깨져 있었다 — 이는
본 diff 의 결함이 아니라 동시 편집으로 판단해 review 대상에서 제외했다(아래 검증 항목 참고).

## 발견사항

- **[INFO]** 직전 CRITICAL 재확인 — **수정 확인됨, 두 호출부 모두 정확히 고쳐짐**
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts:657-659`(`start()`), `:1010-1011`(`applyConfig()`)
  - 상세: `start()`는 `const live = sessionRef.current; if (!live) return; openStream(live, "0");`,
    `applyConfig()`는 `const live = sessionRef.current ?? saved; openStream(live, "0");` 로 바뀌어, 401 낙관적
    refresh 성공 시 `recoverFromExpiredToken`(구 `seedWaitingFromStatus` 인라인)이 `sessionRef.current` 를
    새 토큰으로 교체한 뒤 호출부가 **그 최신 ref** 를 읽고 `openStream` 한다. 캡처해 둔 지역 변수
    (`saved`/`session`, 옛 토큰)를 더 이상 쓰지 않는다. 회귀 테스트(`use-widget-eager-start.test.ts` 의
    `installControllableEventSource` 가 `getUrl()` 로 URL 을 이제 캡처)도 `expect(getUrl()).toContain("iext_fresh")`
    / `not.toContain("iext_stale")` 로 직접 단언하며, `npx vitest run src/widget/use-widget-eager-start.test.ts
    src/lib/session-store.test.ts src/widget/use-token-refresh.test.ts` 로 재실행해 89건 전부 통과 확인했다
    (git 커밋 상태 기준, 동시편집 파일 제외). `applyConfig` 만 되돌린 뮤턴트는 RED 라는 RESOLUTION 의 주장도
    코드 구조와 일치한다(단 `start()` 쪽 401 경로는 회귀가 없다는 사실도 `plan/in-progress/
    webchat-auth-session-status-reconcile.md` 에 투명하게 남아 있음 — 아래 참고, 새 결함 아님).
  - 제안: 조치 불요(확인용).

- **[WARNING]** `401` 낙관적 refresh **시도 자체의 실패**(네트워크 오류 등 `401`/`410` 이 아닌 예외 포함)를
  `401`/`410` 재실패와 구분 없이 "복구 불가 확정"으로 처리한다 — §R4 Rationale 문언보다 넓고, **이전 라운드에서
  이미 지적됐으나 반영도 명시적 보류도 없이 조용히 누락된 항목**이 이번 라운드에도 그대로 남아 있다.
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts:462-489`(`recoverFromExpiredToken`, 특히
    `484-489`의 `catch { if (isStale(gen)) return "stale"; finalizeEnded("execution.token_revoked"); return "ended"; }`)
  - 상세: `client.refreshToken(...)` 이 던지는 예외는 (a) 서버가 명시적으로 `401`/`410` 을 반환한
    `EiaError`(`eia-client.ts` `if (!res.ok) throw new EiaError(...)`), (b) `fetch` 자체의 네트워크 reject(순수
    `Error`/`TypeError`, `status` 없음) 둘 다일 수 있다. 그런데 `catch`(매개변수조차 받지 않는 bare catch)는
    원인을 전혀 구분하지 않고 무조건 `finalizeEnded("execution.token_revoked")` 로 귀결한다. 반면 spec 은
    상태코드를 명시적으로 한정한다 — `3-auth-session.md:89`("재차 `401` 이면 종료로 간주"), Rationale
    `3-auth-session.md:106`("재차 실패(`401`/`410`)면 종료로 확정한다"). 이 diff 자신의 `CHANGELOG.md:172`
    도 "**그 외 오류는 여전히 soft-fail**: 일시적 장애가 대화를 끝내지 않게 하는 경계다... `webchat-boot-
    single-flight` 이 '에러도 종료다' 로 해석했다가 **살아있는 대화를 영구 유실**시킨 사고가 있었다" 고
    명시한다 — 그런데 바로 그 원칙이 401-refresh 시도 자체의 네트워크성 실패에는 적용되지 않고, 오히려
    "종료"로 확정된다. 재로드 시점(`getStatus` 401)에 이 낙관적 refresh POST 왕복 하나가 일시적 네트워크
    hiccup(막 붙은 연결·DNS·모바일 전환 등, 페이지 새로고침 직후라 확률이 낮지 않은 시점)으로 실패하면,
    실제로는 여전히 살아있는 정당한 세션이 `execution.token_revoked` 라는(사실과 다른) 사유로 영구 종료된다.
    이 지적은 직전 라운드(`review/code/2026/08/10/16_09_40/requirement.md` WARNING)에서 동일 근거로 이미
    제기됐으나, `SUMMARY.md`의 "WARNING 1-8" 표에도 "채택하지 않은 것" 표에도 실리지 않고 `RESOLUTION.md`
    에도 언급이 없다 — 즉 **반영도 명시적 기각도 없이 그냥 사라졌다**. (참고: `side_effect.md` 가 지적한
    "주기 갱신 × opportunistic refresh 동시 발화" WARNING도 같은 라운드에서 함께 누락됐었는데, 그 항목은
    최신 커밋 `d568aa7f1`(`plan/in-progress/webchat-auth-session-status-reconcile.md` "refresh 동시 발화 경합"
    절)에서 재현 조건·설계 후보와 함께 정식으로 추적 등재돼 처리됐다 — 이 WARNING만 두 라운드 연속 놓쳤다.)
  - 제안: `catch (refreshErr)` 로 받아 `refreshErr instanceof EiaError && (refreshErr.status === 401 ||
    refreshErr.status === 410)` 인 경우에만 `finalizeEnded`, 그 외(네트워크 오류 등)는 기존 soft-fail
    (`"continue"`, 옛 세션 유지 — SSE 는 hard expiry 까지, 다음 `sendCommand` 의 401 이 최종 처리)로 폴백하는
    쪽을 권장. 지금 바로 못 고치면 최소한 `plan/in-progress/webchat-auth-session-status-reconcile.md` 에
    "refresh 동시 발화 경합" 항목과 동형으로 명시 등재해 세 번째로 흘리지 않을 것.

- **[INFO]** spec 본문 자체의 근소한 표현 불일치 (§3.1-2 vs §R4) — 위 WARNING 수정 시 함께 통일 권장
  - 위치: `spec/7-channel-web-chat/3-auth-session.md:89`("재차 `401` 이면 종료로 간주") vs `:106`("재차
    실패(`401`/`410`)면 종료로 확정한다")
  - 상세: §3.1-2 절차 본문은 `401` 만 언급하고 Rationale §R4 는 `401`/`410` 을 언급한다. 이 diff 가 만든
    불일치는 아니고(두 텍스트 다 이번 diff 범위 밖, `git blame` 상 기존 서술), 현재 코드는 위 WARNING 대로
    상태코드 구분이 아예 없어 이 두 텍스트 중 어느 쪽과도 정확히 일치하지 않는다. project-planner 소관.
  - 제안: 코드 수정 시 `401`/`410` 로 통일하고 spec 본문도 같은 값으로 맞추는 편이 향후 재대조 비용을 줄인다.

- **[INFO]** side_effect 가 두 라운드 연속 지적한 "주기 갱신 타이머 × 401 opportunistic refresh 동시 발화" 경합은
  이번 라운드에서 정식으로 추적 등재됨 — 반영은 아니지만 "흘림"은 해소됨
  - 위치: `plan/in-progress/webchat-auth-session-status-reconcile.md`("refresh 동시 발화 경합 (2026-08-10,
    두 라운드 연속 지적)" 절, 최신 커밋 `d568aa7f1`)
  - 상세: `execution.replay_unavailable` SSE 폴백이 스트림이 열린 채(주기 타이머 활성 상태에서) `401`
    opportunistic refresh 를 fire-and-forget 으로 트리거할 수 있어, 두 독립 refresh 요청이 동시에 나갈 수
    있다는 side_effect reviewer 의 지적을 코드 fix 대신 "재현하지 않았다 + 처방이 설계 선택" 이라는 구체적
    근거와 함께 plan 에 명시 이관했다. 이 저장소의 "유예 근거는 실측해야 한다" 관례에 맞게 "측정했다"는
    허위 주장 없이 "미측정이라 지금은 손대지 않는다"를 정직하게 적어 뒀다 — 적절한 처리.
  - 제안: 조치 불요. 위 WARNING(401-refresh 자체 실패 처리)도 같은 방식으로 plan 에 명시 이관하거나 직접
    수정할 것.

- **[INFO]** `session-store.ts` `applyRefreshedToken` 자체를 직접 겨냥하는 unit 테스트는 없음 — 문제 아님
  - 위치: `codebase/channel-web-chat/src/lib/session-store.ts:110-133`
  - 상세: `session-store.test.ts` 에는 `applyRefreshedToken` 전용 케이스가 없지만, 두 호출부
    (`use-token-refresh.ts`, `use-widget.ts`)의 기존 테스트가 각각 갱신된 `token`/`expiresAt`/storage 반영을
    단언하므로 간접 커버리지는 있다(RESOLUTION.md 의 "뮤테이션 RED 2건"과 정합). 함수 자체가 4줄의 순수
    스프레드+저장이라 리스크가 낮다.
  - 제안: 조치 불요(참고용).

## 점검 관점별 요약

- **기능 완전성**: §3.1-2/§R4 의 `404`/`401`-성공/`401`-재실패/기타 4갈래가 모두 구현되고 개별 회귀 테스트로
  고정됐다. 전 라운드 CRITICAL(성공 시 stale 토큰으로 SSE 재오픈)은 두 호출부 모두 수정 확인. 다만 401-refresh
  **시도 자체의 실패**(네트워크 등) 처리가 spec 문언보다 넓어(위 WARNING) 완전히 충족됐다고 보기 어렵다.
- **엣지 케이스**: `isStale(gen)` 재검사가 refresh 왕복 전/후 모두 있고(신규 회귀 "왕복 중 세계가 바뀌면"
  테스트로 고정), `configRef.current` 부재 가드도 있다. `start()` 경로의 401 도달 가능성은 미확인 상태로
  plan 에 투명하게 남아 있다(뮤테이션 실측: `applyConfig` 만 되돌리면 RED, `start()` 만 되돌리면 초록).
- **TODO/FIXME**: 코드에 TODO/FIXME 주석은 없으나, `plan/in-progress/webchat-auth-session-status-reconcile.md`
  가 그 역할을 대신하는 3개 미확인 항목(frontmatter 재판정, `start()` 401 갭, refresh 동시 발화 경합)을 갖고
  있다 — 모두 "왜 지금 안 고치는지" 근거가 있어 임의 방치와 다르다.
- **의도-구현 괴리**: `recoverFromExpiredToken` JSDoc(`use-widget.ts:444-461`)은 "만료인지 blacklist 인지
  사전 판별 불가" 를 정확히 설명하지만, 그 catch 블록 자체는 refresh **실패의 원인**을 구분하지 않아 주석의
  정밀도만큼 구현이 따라가지 못한다(위 WARNING).
- **에러 시나리오**: `404`/`401`-성공/`401`-재실패/기타 4갈래는 각각 정의돼 있다. 다만 "401-재실패" 갈래가
  실제로는 "refresh 호출의 모든 실패"를 포괄해 스펙보다 넓은 에러 시나리오를 만든다.
- **데이터 유효성**: REST 응답 status 코드 분기가 입력 검증의 전부이며, `EiaError.status` 존재 여부로
  `EiaError` vs 순수 `Error` 를 구분하는 지점(`err instanceof EiaError && err.status === 404/401`)은 정확하다.
  다만 refresh 실패 시 이 구분을 재사용하지 않는 것이 위 WARNING 의 근본 원인.
- **비즈니스 로직**: "낙관적 refresh 정확히 1회" 는 성공/실패 양쪽 테스트(`refreshCalls === 1`)로 견고하게
  고정됐다 — 무한 재시도로 번지지 않는다는 핵심 규칙은 충족.
- **반환값**: `SeedOutcome`(`"ended"`/`"stale"`/`"continue"`) 모든 경로에서 값 반환, 누락 없음.
  `applyRefreshedToken` 도 항상 갱신된 `PersistedSession` 을 반환한다.
- **spec fidelity**: (a) `404` → `finalizeEnded("execution.not_found")` + storage 정리 + SSE 미오픈 — §3.1-2
  일치. (b) `401` 낙관적 refresh 정확히 1회 — §R4 일치. (c) 성공 시 `sessionRef.current` 갱신 후 호출부가
  그 최신 값으로 SSE 재오픈 — "성공 시 SSE 재연결로 복원"(§3.1-2/§R4) 을 이제 실제로 충족(전 라운드 CRITICAL
  해소 확인). (d) 재차 실패 시 종료 확정 — §3.1-2/§R4 의 "401" 자체는 일치하나, 코드가 그 조건을 401/410으로
  좁히지 않고 모든 예외로 넓혀 spec 문언보다 넓다(WARNING). (e) 그 외 오류는 여전히 `console.warn` 후
  soft-fail — §3.1-2/CHANGELOG 원칙과 일치, 신규 500 테스트로 경계 고정. spec 문서(`3-auth-session.md`)
  §3.1 배너의 "구현됐다(2026-08-10)" 서술은 (a)~(c)/(e) 기준으로는 정확하고, (d)의 좁은 의미(문자 그대로
  "401"만)로도 기술적으로는 거짓이 아니지만, 실제 코드 동작(모든 예외를 종료로 취급)까지 포함해 완전한
  진실이라 보긴 어렵다.

## 요약

전 라운드 CRITICAL(401 refresh 성공 후 stale 토큰으로 SSE 를 재오픈하던 결함)은 `start()`/`applyConfig()`
양쪽에서 `sessionRef.current` 를 다시 읽도록 정확히 수정됐고, 새 회귀 테스트가 실제 SSE URL 의 토큰 값을
직접 단언해 재발을 막는다 — 재확인 완료. §3.1-2/§R4 의 `404`/`401`-성공/그 외-soft-fail 3갈래도 spec 본문과
line-level 로 정확히 일치한다. 다만 `401`-재실패 갈래는 spec Rationale 이 명시적으로 "`401`/`410`" 으로
한정한 조건을 코드가 상태코드 구분 없는 모든 예외로 넓혀 적용하고 있고, 이는 이 diff 가 명시적으로 지키려는
"일시적 장애가 대화를 끝내지 않는다"는 자기 원칙(`CHANGELOG.md`)과도 충돌한다 — 재로드 직후 발생 가능한
네트워크 hiccup 하나로 정당한 세션이 영구 종료될 수 있다. 이 지적은 직전 라운드에서 이미 한 번 제기됐다가
`SUMMARY`/`RESOLUTION` 집계 과정에서 반영도 기각도 없이 누락된 이력이 있다(같은 라운드의 다른 WARNING —
동시 refresh 경합 — 은 최신 커밋에서 plan 에 정식 등재돼 처리됐으나 이 항목만 두 번째로 놓쳤다). 세 번째로
흘리지 않도록 이번엔 코드 수정 또는 최소한 plan 명시 이관이 필요하다.

## 위험도

LOW
