# 문서화(Documentation) Review

대상: `CHANGELOG.md` · `codebase/channel-web-chat/src/lib/session-store.ts` ·
`codebase/channel-web-chat/src/widget/use-token-refresh.ts` ·
`codebase/channel-web-chat/src/widget/use-widget.ts` ·
`codebase/channel-web-chat/src/widget/use-widget-eager-start.test.ts` ·
`plan/in-progress/webchat-auth-session-status-reconcile.md` ·
`spec/7-channel-web-chat/3-auth-session.md` · `review/code/2026/08/10/{16_09_40,16_26_09}/**`
— 재로드 REST 오류 분기(§3.1-2·§R4) 3라운드 누적 diff.

직전 지적 (a)/(b) 반영 여부와, **"종료 조건이 `401`/`410` 로 좁혀진 것"(최신 커밋
`31b14aa22`)이 다른 문서를 stale 하게 만들지 않았는지**를 저장소 전체 × 용어 축(`재차 401`·
`복구불가 401`·`401/410`)으로 확인했다. 프롬프트에 diff 가 생략된 `use-widget.ts`/
`use-widget-eager-start.test.ts` 는 `Read`로 현재 HEAD(`de6a1b84b`)를 직접 열어 실제 줄
번호를 확인했다.

## 참고 (a)/(b) 확인 — 둘 다 실제로 반영됨

- **(a) "몇 명 수렴" 숫자**: `CHANGELOG.md:173`, `use-widget.ts:401`, `use-widget.ts:684` 세
  곳 모두 `security·side_effect·requirement·testing` **4명**을 이름과 함께 일관되게 적는다.
  저장소 전체를 "독립 수렴"/"명 수렴" 축으로 훑어도 이 기능 영역에 다른 숫자(3명/2명)가 남은
  곳은 없다 — `use-widget-eager-start.test.ts:95`의 "security·side_effect 가 독립 수렴"은
  총원 주장이 아니라 별개 항목(테스트 false confidence)의 두 명 구체 지명이라 문제 없다.
- **(b) JSDoc 네 자리**: `seedWaitingFromStatus`의 요약(371-374)·실패 정책(384-386)·`@returns`
  (406-415)와 `SeedOutcome`의 `"ended"` 유니언 독스트링(84-93)이 모두 새 REST 오류 분기
  서술로 갱신돼 있고, 직전 라운드가 지적한 "새 단락만 얹혀 배치됐다"는 문제는 해소됐다.

## 발견사항

- **[WARNING]** `401`/`410` 종료 조건 좁히기(`31b14aa22`)가 방금 위에서 "반영 확인"한 그 JSDoc
  네 자리 + `SeedOutcome` 독스트링 + CHANGELOG 항목을 **다시** stale 하게 만들었다 — 이 diff
  안에서 같은 형태(문서를 고치다가 인접 서술을 안 맞춘다)가 **세 번째**로 재발했다.
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts:87`(`SeedOutcome` `"ended"`
    독스트링), `:373-374`(함수 요약), `:385`(실패 정책), `:402`(REST 오류 분기 목록의
    "재차 `401`" 항목), `:408`(`@returns`) — 다섯 곳 모두 "복구불가 `401`"/"재차 `401`"로만
    적혀 있다. `CHANGELOG.md:166`(항목 제목 "복구불가 `401` REST 분기")·`:171`(본문 "재차
    `401` 이면 종료로 확정한다")도 동일.
  - 상세: 실제 코드(`use-widget.ts:499-501`, `recoverFromExpiredToken`의 `catch`)는
    ```
    const terminal =
      refreshErr instanceof EiaError &&
      (refreshErr.status === 401 || refreshErr.status === 410);
    ```
    로 `401` **또는** `410`을 종료 확정 트리거로 취급한다. 이 조건은 바로 이 최신 커밋
    (`31b14aa22`, "refresh 가 네트워크 오류로 실패해도 종료 확정하던 것" 수정)에서 도입됐고,
    그 커밋 메시지·바로 옆 인라인 주석(`:494-498`)은 정확히 "`401`/`410` 일 때만 종료로
    확정한다"고 §R4 문언을 그대로 인용한다. 그런데 이 `catch` 를 감싸는 함수 전체의 구조화된
    JSDoc 계약(요약·실패 정책·REST 오류 분기 목록·`@returns`)과, 그 계약이 설명하는 반환 타입
    `SeedOutcome` 자체의 독스트링, 그리고 CHANGELOG 항목은 전부 `401` 하나만 언급한다. 이
    JSDoc 다섯 자리는 바로 직전 라운드(`16_26_09`)에서 "새 REST 오류 분기를 반영하지 못해
    stale"이라는 WARNING을 맞고 갱신된 자리들인데, 그 갱신 **직후** 커밋된 이번 수정이 자신이
    넓힌 조건(`410` 추가)을 그 계약에 반영하지 않아 다시 원 지적과 같은 종류의 결함(코드와
    이를 감싸는 문서 계약의 불일치)을 새로 만들었다. `eia-client.ts:116`의 `refreshToken`은
    `!res.ok`이면 서버가 반환한 status 그대로 `EiaError`를 던지므로 `410`은 실제로 도달
    가능한 값이다(가상 케이스 아님).
  - 제안: 다섯 JSDoc 자리와 CHANGELOG 두 자리를 "복구불가 `401`" → "복구불가 `401`/`410`",
    "재차 `401`" → "재차 `401`/`410`"으로 정정. `SeedOutcome`의 `"ended"` 독스트링도 동일.

- **[INFO]** 아직 미해결로 남겨 둔 "refresh 동시 발화 경합" 설계 옵션 서술이 같은 이유로
  용어가 좁다
  - 위치: `plan/in-progress/webchat-auth-session-status-reconcile.md:106`
    ("`finalizeEnded` 를 \"재차 `401` 이면서 in-flight 없음\" 으로 좁힐지").
  - 상세: 이 문장은 아직 구현되지 않은 세 가지 설계 후보 중 하나를 서술하는 것이라 위 WARNING
    처럼 "코드와 어긋난다"고는 할 수 없다 — 다만 지금 baseline 자체가 이미 `401`/`410`
    양쪽을 종료 트리거로 취급하므로, 향후 이 옵션을 실제로 구현할 사람이 이 문구만 보고
    `401`만 좁혀 `410` 케이스를 빠뜨릴 위험이 있다. 이 plan 파일은 `10a2c94e0`(410 narrowing
    이전)에서 마지막으로 손댔고, 그 뒤 `31b14aa22`가 이 문서를 갱신하지 않았다(`git log
    --follow`로 확인).
  - 제안: 여유 있을 때 "재차 `401`/`410` 이면서 in-flight 없음"으로 정정 권장. 급하지 않음
    (아직 실행되지 않는 설계 메모라 즉시 오도할 위험은 낮음).

- **[INFO]** `410`을 직접 트리거하는 회귀 테스트가 없다 — 새 분기의 유일한 "동작 예시"가 코드
  자신의 인라인 주석뿐이다
  - 위치: `codebase/channel-web-chat/src/widget/use-widget-eager-start.test.ts:386`(`401` →
    refresh 도 `401` 로 실패 → 종료, 기존)·`:418`(refresh 가 순수 네트워크 오류로 실패 →
    비종료, 이번 라운드 신규) — 둘 사이에 "refresh 가 `410` 으로 실패 → 종료" 케이스가 없다.
  - 상세: 테스트 파일 관례(각 분기를 개별 `it`으로 분리해 셋을 못 섞게 함)를 감안하면, `410`
    케이스가 빠진 것은 "그 상태코드도 종료를 트리거한다"는 계약을 보여주는 살아있는 예제가
    코드베이스에 없다는 뜻이다 — 순수 문서화 문제라기보다 테스트 커버리지 문제(testing
    reviewer 영역)에 더 가까우나, 위 WARNING(문서가 `410`을 언급하지 않음)과 같은 뿌리이므로
    함께 기록한다.
  - 제안: 조치는 developer/testing 판단에 맡김. 고칠 경우 `:386` 테스트와 동형으로 `refresh
    응답만 `{ok:false, status:410}`로 바꾼 케이스를 추가하는 정도로 충분해 보인다.

- **[INFO]** spec 자체에 `401`-only 표현과 `401`/`410` 표현이 공존 — 이번 diff 가 만든 것은
  아니지만 코드가 어느 쪽을 따랐는지 확인됨
  - 위치: `spec/7-channel-web-chat/3-auth-session.md:89`(§3.1-2, "재차 `401` 이면 종료로
    간주") vs `:106`(§R4 Rationale, "재차 실패(`401`/`410`)면 종료로 확정한다").
  - 상세: `git log -p`로 추적한 결과 `:89`의 `401`-only 표현은 `2026-06-28`
    커밋(`dcaaf36a07`, "410 정정")에서 **의도적으로** `401`/`410` → `401`로 좁혀졌다 — 근거는
    "`GET` 상태 조회는 EIA §5.3 상 `410`을 반환하지 않는다(`410`은 `interact` 명령 전용)"였다.
    그런데 그 줄이 서술하는 것은 **`refresh-token` POST 재시도의 실패 코드**이지 `GET
    status` 응답 코드가 아니다 — `refresh-token`은 별도 엔드포인트라 `410`을 반환하지 않는다는
    보장이 spec 어디에도 없고, `:106`(§R4)은 여전히 `401`/`410` 둘 다 명시한다. 이번 PR의
    코드(`use-widget.ts:499-501`)는 `:106`(§R4)을 따라 `401`/`410` 둘 다 구현했으므로 코드
    자체는 spec의 더 명시적인 조항과 일치하지만, spec 본문 두 곳(`:89`와 `:106`)이 서로 다른
    말을 하는 상태는 이번 diff 이전부터 있었고 그대로 남아 있다. `spec/`은 developer
    read-only라 이 diff 범위에서 고칠 대상은 아니지만, 이번 조사로 실제 근거가 드러났으므로
    project-planner 판단을 위해 기록한다.
  - 제안: 조치 불요(이 diff 범위 밖). 다음에 `3-auth-session.md`를 손보는 project-planner
    턴에서 `:89`를 "재차 `401`/`410`"으로 맞추거나, `:106`과 `:89`가 왜 다른지(엔드포인트가
    다르다는 사실)를 명시하는 한 구를 추가하는 것을 고려.

## 요약

직전 라운드가 지적한 두 문서 결함(리뷰 인원수 표기 불일치, JSDoc 네 자리 부분 갱신)은 이번
diff에서 실제로 완전히 반영됐다 — "4명 + 이름" 표기는 세 곳 모두 일치하고, JSDoc 네 자리는
새 REST 오류 분기를 정확히 반영한다. 그런데 바로 그 다음 커밋(`31b14aa22`, `401`/`410` 종료
조건 좁히기)이 자신이 넓힌 조건(`410` 추가)을 그 갱신된 JSDoc 다섯 자리와 `SeedOutcome`
독스트링·CHANGELOG 두 자리에 반영하지 않아 같은 종류의 문서 stale 이 **세 번째로** 재발했다.
기능에는 영향이 없다(코드 자체는 `401`/`410` 을 정확히 처리한다) — 다만 이 문서들이 지금
서술하는 계약("종료는 `401` 재실패로만 확정된다")은 실제 동작보다 좁아, 향후 이 영역을 다시
손볼 사람이 `410` 분기를 놓칠 실질적 위험을 남긴다. 미해결로 남긴 plan 의 설계 옵션 문구와,
이번 diff 이전부터 있던 spec 내부의 `401`-only vs `401`/`410` 표현 공존도 같은 용어 축에서
발견돼 함께 기록했다.

## 위험도

MEDIUM
