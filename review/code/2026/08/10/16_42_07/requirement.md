# 요구사항(Requirement) Review — 재판정: refresh 실패 종료조건 `EiaError && (401|410)` 좁히기

대상: `recoverFromExpiredToken`(`codebase/channel-web-chat/src/widget/use-widget.ts`)의 `catch` 분기 —
직전 라운드(`16_26_09`) WARNING("refresh 실패를 상태코드 구분 없이 종료 확정") 수정분. 이번 라운드는
그 조건이 §R4 문언과 정확히 일치하는지, 더 좁히거나 넓혀야 할 코드가 있는지 원문 대조로 재판정하는 것이
목적.

## 재판정 결론 — 조건은 §R4 와 정확히 일치, 근거를 백엔드까지 추적해 실측 확인

- 코드(`use-widget.ts:499-501`):
  ```
  const terminal =
    refreshErr instanceof EiaError &&
    (refreshErr.status === 401 || refreshErr.status === 410);
  ```
- §R4 Rationale 원문(`spec/7-channel-web-chat/3-auth-session.md:106`): "**낙관적으로 `refresh-token` 1회**
  시도해 만료면 복구하고, **재차 실패(`401`/`410`)면 종료로 확정**한다."
- 문언 대 조건 대조: "재차 실패" = `refreshToken` 호출 자체의 실패(=`catch` 진입) · "(`401`/`410`)" = 두
  상태코드 정확히. 코드의 `terminal` 판별과 1:1 대응 — 더 좁히거나 넓힐 필요 없음.
- **410 이 실제로 도달 가능한 값인지 백엔드까지 추적해 확인했다** (스펙 문언만 보고 "혹시 죽은 코드가
  아닌가" 의심할 수 있어서): `codebase/backend/src/modules/external-interaction/interaction.controller.ts:138-149`
  의 `refreshToken` 엔드포인트에 `@ApiGoneResponse({ description: 'EXECUTION_TERMINATED' })` 가 실제로
  붙어 있고, `interaction.service.ts:252-259` 가 `execution` 이 `TERMINAL_STATUSES` 면 `GoneException`
  (410)을 던진다 — Guard 를 통과한 뒤(토큰 서명 자체는 유효) execution 이 이미 종료된 케이스를 정확히
  §R4/§3.1-2 가 말하는 "종료 후 blacklist(복구 불가)" 로 분류한다. `401`(Guard 단계, 서명·jti 무효)과
  `410`(비즈니스 단계, execution 종료 확인) 은 같은 "복구 불가" 판정의 서로 다른 도달 경로다 — 코드가
  둘 다 terminal 로 묶은 것은 실제 백엔드 동작과도 정확히 맞는다.
  `client.refreshToken` (`codebase/channel-web-chat/src/lib/eia-client.ts:116`) 은 `!res.ok` 이면 무조건
  `EiaError(status=res.status)` 를 던지므로 401/410 모두 `EiaError` 인스턴스로 정확히 올라온다. 네트워크
  reject(TypeError 등)는 `EiaError` 가 아니므로 `instanceof` 가드가 정확히 걸러낸다.
- 그 외 상태(403 `TOKEN_REFRESH_FORBIDDEN`, 400 `TOKEN_REFRESH_NOT_IN_WINDOW`)는 `!terminal` → soft-fail
  `"continue"` 로 떨어진다. per_execution(`iext`) 전용 위젯 경로에서 403 은 실질적으로 도달 불가(§R3,
  `interaction.service.ts:220-228` 는 `ctx.tokenFamily !== 'iext'` 일 때만 403)이고, "그 외는 soft-fail"
  이라는 이 함수 자신의 명시 원칙(코드 주석 494-497행, CHANGELOG §3)과도 일치 — 넓히거나 좁힐 이유 없음.

**따라서 이번 수정은 §R4 문언과 line-level 로 정확히 일치하고, 백엔드 실제 응답 코드와도 정합한다. 추가로
좁히거나 넓혀야 할 코드는 없다.**

## 발견사항

- **[WARNING]** `410` 분기가 뮤테이션 사각지대 — 회귀 테스트가 `401` 실패만 겨냥하고 `410` 실패는 아무도
  시뮬레이션하지 않는다
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts:501`(`refreshErr.status === 401 ||
    refreshErr.status === 410`) — `|| refreshErr.status === 410` 절.
  - 상세: 이번 라운드가 추가한 회귀(`use-widget-eager-start.test.ts:418-446`, "§R4: refresh 가
    네트워크 오류로 실패하면 종료로 확정하지 않는다")는 `refresh-token` 호출을 순수 `TypeError`(네트워크
    reject, `status` 없음)로 실패시켜 **`terminal` 전체가 `true` 로 넓어지는 뮤테이션**(commit 메시지가
    스스로 "조건을 `true` 로 넓힘"이라 적음)은 잡는다. 그러나 기존 회귀(`:317-` 부근 "401 → refresh 도
    실패하면 복구 불가로 확정")는 `refresh-token` 이 `status: 401` 로 실패하는 경우만 다룬다.
    `refreshToken` 이 `status: 410` 로 실패하는 시나리오를 겨냥한 테스트가 **없다** — 만약
    `|| refreshErr.status === 410` 절이 통째로 삭제되거나(§R4 문언보다 좁아지는 방향) `410` 이 다른
    숫자로 오탈자 나더라도, 현재 스위트 어느 것도 실패하지 않는다. 이 저장소가 반복 관찰한 "`??`/`||`
    는 각 항이 별도 표면" 형태의 재발이다 — `401` 항은 기존 401-재차실패 테스트가 리터럴 변조에 RED
    지만 `410` 항은 대응하는 fixture 가 없어 커버리지 매트릭스가 절반만 채워졌다.
  - 제안: `refresh-token` 응답을 `{ ok: false, status: 410 }` 으로 주는 회귀 1건을 추가해 종료 확정
    (`finalizeEnded("execution.token_revoked")` → `"ended"`)을 단언할 것. 기존 401 케이스와 거의 동일한
    fixture 복제로 충분(파라미터화 여지는 maintainability WARNING 이 이미 지적).

- **[SPEC-DRIFT]** `spec/7-channel-web-chat/3-auth-session.md` §3.1-2 의 `401` 서술이 같은 문서 §R4 보다
  좁다 — 코드는 (이미) §R4 를 따르므로 code 는 맞고 §3.1-2 body 가 낡았다
  - 위치: `spec/7-channel-web-chat/3-auth-session.md:86-89`(§3.1-2, `401` 불릿 — "재차 `401` 이면 종료로
    간주"만 언급) vs `spec/7-channel-web-chat/3-auth-session.md:104-108`(§R4 Rationale — "재차 실패
    (`401`/`410`)면 종료로 확정").
  - 상세: 같은 문서 안에서 행위 명세(§3.1-2, 번호 매긴 절차 목록)와 그 근거(§R4, Rationale)가 서로 다른
    상태코드 집합을 말한다. 이 불일치는 **이번 diff 가 만든 것이 아니다** — `git diff origin/main...HEAD`
    로 확인한 결과 §3.1-2 의 401 불릿(79-91행 구간)과 §R4 텍스트(104-108행) 모두 이번 브랜치가 건드리지
    않은 기존 문구이며, `git show origin/main:spec/7-channel-web-chat/3-auth-session.md` 에도 동일하게
    존재한다(즉 이 PR 이전부터 있던 spec 자체의 내부 불일치). 코드는 (위 재판정대로) §R4 의 더 넓은
    집합(`401`/`410`)을 정확히 구현했고, 이는 실제 백엔드 응답(§5.5 refresh-token 의 `410 Gone`
    `EXECUTION_TERMINATED`)과도 부합한다 — 즉 **낡은 쪽은 §3.1-2 body 문구이지 코드가 아니다.**
    같은 종류의 정보 갭이 링크된 EIA 문서에도 있다: `spec/5-system/14-external-interaction-api.md:505-518`
    (§5.5 토큰 갱신 응답 블록)은 `401 Unauthorized` 만 예시로 적고 `410 Gone` 을 전혀 언급하지 않는다 —
    실제 컨트롤러(`interaction.controller.ts:149` `@ApiGoneResponse`)·서비스(`interaction.service.ts:252-259`
    `GoneException`)는 이를 구현하고 있어 §5.5 본문이 실제 API 표면보다 좁다.
  - 제안: 코드를 되돌리지 말 것(코드가 옳다). `project-planner` 가 다음을 spec draft 로 반영:
    (1) `spec/7-channel-web-chat/3-auth-session.md:89` 의 "재차 `401` 이면 종료로 간주"를 "재차
    `401`/`410` 이면 종료로 간주"로 §R4 와 맞춰 정정, (2) `spec/5-system/14-external-interaction-api.md`
    §5.5 응답 예시 블록에 `410 Gone // EXECUTION_TERMINATED` 케이스 추가.

- **[INFO]** `CHANGELOG.md` 의 §2(401 항목)가 이번 narrowing 이전 문구 그대로 남아 `410`·"네트워크 오류는
  종료 아님" 세부를 담지 않음
  - 위치: `CHANGELOG.md:171`("2. `401` → 낙관적 refresh 1회: ... 재차 `401` 이면 종료로 확정한다").
  - 상세: 이번 라운드의 narrowing 수정 커밋(`31b14aa22`)은 `CHANGELOG.md` 를 건드리지 않았다. 항목 2는
    (spec §3.1-2 와 같은 어휘로) "401"만 언급하고, "네트워크 오류 등 비-401/410 실패는 여전히
    soft-fail"이라는 이번 수정의 핵심 결정을 명시하지 않는다. 바로 아래 항목 3("그 외 오류는 여전히
    soft-fail")이 일반 원칙으로 이를 포괄한다고 볼 수도 있어 오독 위험은 낮지만, 이 항목이 바로 이번
    narrowing 수정이 스스로 근거로 인용한 원칙("이 변경 자신의 CHANGELOG 가 '그 외 오류는 여전히
    soft-fail' 을 원칙으로 적어 뒀는데 refresh 왕복만 그 원칙 밖이었다")이라는 점에서, 그 결정이 실제로
    어떻게 정정됐는지까지 CHANGELOG 에 남기면 이력 추적이 더 명확해진다.
  - 제안: 조치 불요(경미) — 다음에 이 CHANGELOG 항목을 손볼 일이 있으면 "401" 뒤에 "/410"을 덧붙이거나
    "refresh 시도 자체의 실패도 401/410 이 아니면 종료로 보지 않는다"는 문구를 짧게 추가 권장.

## 점검 관점별 요약

- **기능 완전성**: 이 재판정 범위(§R4 종료조건)는 완전히 구현됨. `catch` 는 `EiaError` 인스턴스 검사 +
  정확히 두 상태코드로 분기하며 그 외는 일괄 soft-fail — 누락된 상태코드 처리 경로 없음.
- **엣지 케이스**: `401`(Guard 레벨)·`410`(비즈니스 레벨 execution 종료)·네트워크 reject(비-EiaError)·
  기타 EiaError 상태(400/403/5xx) 네 갈래 모두 코드 경로가 존재. 다만 `410` 갈래는 테스트로 겨냥되지
  않아 회귀 방지력이 없다(위 WARNING).
- **TODO/FIXME**: 없음.
- **의도-구현 괴리**: 없음 — 인라인 주석(494-498행)이 "§R4 문언이 그렇다"고 정확히 인용하고 실제로
  일치한다(첫 재판정 시도와 달리 이번엔 주석의 주장이 원문과 실측으로 확인됨).
- **에러 시나리오**: `refreshToken` 실패의 네 갈래(401/410/네트워크/기타-EiaError)가 각각 정의됨. 신규
  회귀(네트워크 reject → soft-fail)로 이전 WARNING 이 지적한 과잉 종료가 닫혔다.
- **데이터 유효성**: 해당 없음(REST 상태코드 분기가 전부).
- **비즈니스 로직**: §R4("낙관적 refresh 1회, 재차 실패 401/410 이면 종료")가 코드에 정확히 반영됨. 1회
  제한은 여전히 유지(`refreshCalls===1` 회귀로 재확인 가능).
- **반환값**: `terminal`/`!terminal` 두 경로 모두 `SeedOutcome`(`"stale"`/`"ended"`/`"continue"`) 값을
  반환 — 누락 경로 없음.
- **spec fidelity**: 코드 조건은 §R4 원문과 line-level 로 정확히 일치(백엔드 `GoneException`/
  `@ApiGoneResponse` 로 410 도달 가능성까지 실측 확인). 다만 **같은 spec 문서 §3.1-2 본문이 §R4 보다
  좁아** 문서 내부 불일치가 있다(SPEC-DRIFT, 코드 아님 — 이번 diff 이전부터 존재) — `project-planner`
  반영 권장.

## 요약

직전 라운드 WARNING("refresh 시도 자체의 실패를 상태코드 구분 없이 종료 확정")은 `EiaError instanceof`
+ `status === 401 || status === 410` 으로 정확히 좁혀졌고, 이 조건은 §R4 Rationale 원문("재차 실패
(`401`/`410`)면 종료로 확정")과 line-level 로 정확히 일치한다. 스펙 문언만으로는 "410 이 실제로 오는가"
의심할 수 있어 백엔드(`interaction.controller.ts`/`interaction.service.ts`)까지 추적했고, refresh-token
엔드포인트가 실제로 `GoneException`(410, `EXECUTION_TERMINATED`)을 던지는 것을 확인해 코드가 죽은
분기를 만든 것이 아님을 검증했다. 더 좁히거나 넓혀야 할 코드는 없다. 다만 (1) `410` 분기 자체는 신규
회귀가 겨냥하지 않아 뮤테이션 사각지대로 남아 있고, (2) 같은 spec 문서 안에서 §3.1-2 본문이 "재차
401"만 언급해 §R4("401/410")보다 좁은 기존 내부 불일치가 있다(코드 아닌 spec 쪽이 낡음 — SPEC-DRIFT).
둘 다 이번 narrowing 수정의 정확성 자체를 훼손하지 않는 후속 보강 항목이다.

## 위험도

LOW
