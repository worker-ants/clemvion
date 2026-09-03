# 요구사항(Requirement) 코드 리뷰

## 리뷰 범위 및 방법

이 diff(`origin/main` 대비)는 3개 커밋(`69aad5d5d` → `b75e6a76b` → `80ac92668`)의 누적 결과로,
`plan/in-progress/ws-token-expired-socket-lifetime-impl.md` 가 명시한 "이월 INFO 5건"(cutoff clamp
근거 주석·`expiryTimers` non-optional 화·`MSG_AUTH_TOKEN_EXPIRING` 상수 승격·`armExpiryTimers`
선제 해제·`.unref()`)을 정리하는 하드닝이며, 두 차례의 자체 리뷰 라운드(`review/code/2026/09/03/11_57_58`,
`12_16_24`)에서 이미 JSDoc 오귀속 2건과 조기 `return` 회귀(W3)를 잡아 수정했다. 실질 코드 변경은
`codebase/backend/src/modules/websocket/{websocket-events.types.ts, websocket.gateway.ts,
websocket.gateway.spec.ts}` 3개 파일이고, 나머지는 plan 문서 갱신과 이전 라운드 리뷰 산출물이다.

검증: `Read` 로 현재 소스(`websocket.gateway.ts`, `websocket-events.types.ts`,
`websocket.gateway.spec.ts`)를 직접 열어 JSDoc 배치·로직·테스트를 확인했고, `spec/5-system/6-websocket-protocol.md`
§1.2·§4.6·§9.2·Rationale `R-ws-socket-lifetime-binds-token` 본문과 line-level 대조했다.
`npx jest src/modules/websocket/websocket.gateway.spec.ts` 를 직접 실행해 **72/72 통과**를
독립 재현했고, 핵심 회귀 지점(`armExpiryTimers` 의 선제 `clearExpiryTimers` 호출)을 실제로
주석 처리하는 뮤테이션을 걸어 **2개 테스트가 RED 로 떨어지는 것**을 직접 관측한 뒤 `cp` 로
원복했다(`git status --short` 로 원복 확인 완료, 잔여물 없음).

## 발견사항

- **[INFO]** 핵심 기능(§1.2)이 spec 과 line-level 로 일치함을 확인
  - 위치: `codebase/backend/src/modules/websocket/websocket.gateway.ts` `armExpiryTimers`/`clearExpiryTimers`/`handleDisconnect`
  - 상세: spec §1.2(`6-websocket-protocol.md:50`)의 "만료 60초 전에 `auth.token_expired` 를 1회
    emit 한 뒤 `exp` 도달 시 `disconnect()` 한다 (`handleDisconnect` 에서 타이머 해제)"가 구현과
    정확히 대응한다 — lead time 상수 60_000ms, notice/cutoff 타이머 쌍, `handleDisconnect` →
    `clearExpiryTimers` 위임. §4.6 wire shape `{ message, expiresAt }` 도 `AuthTokenExpiredPayload`
    와 일치하며, `MSG_AUTH_TOKEN_EXPIRING` 리터럴 값은 새 상수화 전후로 바이트 단위 동일해(구
    리터럴과 diff 대조 확인) wire 계약을 바꾸지 않았다. spec 은 문구 자체를 규정하지 않으므로
    상수값 자체는 spec fidelity 이슈가 아니다.
  - 제안: 없음(확인 목적 기록).

- **[INFO]** W3(조기 `return` 이 선제 해제보다 먼저 도는 회귀)의 수정이 실제로 유효함을
  독립 뮤테이션으로 재확인
  - 위치: `codebase/backend/src/modules/websocket/websocket.gateway.ts:183`(`this.clearExpiryTimers(client.id);`,
    `if (typeof expSeconds !== 'number' ...) return;` 보다 앞)
  - 상세: 이 호출을 주석 처리하는 뮤테이션을 걸었더니 `websocket.gateway.spec.ts` 의 "같은
    client.id 로 재무장하면 옛 타이머를 먼저 해제한다" 테스트(`oldEmits` 기대 0, 실측 1)와
    "exp 없는 토큰으로 재무장해도 옛 타이머는 해제된다" 테스트가 즉시 RED 로 떨어졌다(2개
    실패, 나머지 70개는 GREEN 유지) — plan/RESOLUTION 이 주장한 뮤테이션 RED 를 직접
    재현했고 vacuous 가 아님을 확인했다. 뮤테이션은 `cp` 백업 후 원복, `git status --short`
    로 잔여물 없음을 확인했다.
  - 제안: 없음.

- **[INFO]** `armExpiryTimers`/`clearExpiryTimers` JSDoc 오귀속(라운드 1 발견)이 라운드 2
  수정에서 실제로 복원됐음을 재확인 — spec-drift 아님, 코드 상태 확인
  - 위치: `codebase/backend/src/modules/websocket/websocket.gateway.ts:161-176`(§1.2 JSDoc,
    `armExpiryTimers` 바로 위), `:230-234`(`clearExpiryTimers` 자신의 JSDoc, `armExpiryTimers`
    뒤); `codebase/backend/src/modules/websocket/websocket-events.types.ts:287-305`(`AuthTokenExpiredPayload`
    JSDoc → 인터페이스 → `MSG_AUTH_TOKEN_EXPIRING` JSDoc → 상수, 순서 복원)
  - 상세: 이전 두 라운드가 지적한 "새 심볼이 기존 JSDoc 과 대상 사이에 끼어든" 문제와,
    후속으로 지적된 "복원 과정에서 생긴 신규 빈 줄"이 현재 소스에는 **둘 다 없다** — `armExpiryTimers`
    선언 바로 위에 그 설계 근거 JSDoc 이 빈 줄 없이 붙어 있고, `clearExpiryTimers` 는
    `armExpiryTimers` 뒤로 옮겨져 자신의 JSDoc 만 갖는다. `AuthTokenExpiredPayload` 도 동일.
  - 제안: 없음(확인 목적 기록).

- **[INFO]** TODO/FIXME/HACK/XXX 마커 없음, 반환값·에러 시나리오 완전성 확인
  - 위치: 변경된 3개 소스 파일 전체
  - 상세: `armExpiryTimers`(`void` 반환, 모든 경로 처리 — `exp` 부재/비정상 시 조기 return,
    정상 시 타이머 무장)·`clearExpiryTimers`(`void`, 항목 부재 시 조기 return)·`handleDisconnect`
    모두 모든 입력 조합에서 정의된 동작을 갖는다. `expSeconds` 유효성 검증(`typeof !== 'number'
    || !Number.isFinite`)이 `undefined`·`NaN`·`Infinity` 를 동일 분기로 안전하게 처리한다
    (`NaN`/`Infinity` 전용 테스트는 없으나 `undefined` 와 동일 조기 return 경로라는 것을
    코드로 확인했고, plan/SUMMARY 가 이미 "우선순위 낮음"으로 명시적으로 처분한 항목이라
    새 발견 아님).
  - 제안: 없음.

- **[INFO]** 남아 있는 미해결 plan 항목(만료 타이머 지터·`.unref()` 셧다운 트레이드오프·배포
  전환 창)은 TODO 성 누락이 아니라 명시적으로 근거·재개 신호를 적어 둔 유예 항목
  - 위치: `plan/in-progress/ws-token-expired-socket-lifetime-impl.md:159-183`
  - 상세: 세 항목 모두 (1) 왜 이번 diff 에서 안 고치는지, (2) 무엇이 관측되면 재개하는지가
    문장으로 적혀 있다. 다만 "배포 런북에 적는다" 는 문구가 실제 별도 배포 런북 문서를
    가리키지 않고(저장소 전체에서 그런 문서를 찾지 못함) 이 plan 파일 자체가 그 기록처
    역할을 한다 — 라운드 2 RESOLUTION 이 이미 "추적한다고 적으면서 추적처를 만들지 않았다"는
    자기반증으로 이 갭을 스스로 지적하고 실제 항목을 만들어 해소했으므로 새 발견은 아니다.
  - 제안: 없음(이미 처분됨, 참고 기록).

## 요약

핵심 기능(소켓 수명을 토큰 수명에 종속시키는 `auth.token_expired` 통지/종료, 이월 INFO 5건 정리)이
spec §1.2·§4.6 과 line-level 로 일치하고, 모든 코드 경로가 정의된 반환값·에러 처리를 갖는다.
가장 실질적이었던 회귀(W3: `exp` 없는 토큰 재무장 시 조기 `return` 이 선제 해제를 건너뛰는 문제)를
직접 뮤테이션으로 재현해 수정이 유효함을 검증했고, 두 차례 리뷰가 지적한 JSDoc 오귀속도 현재
소스에서 정확히 복원돼 있음을 확인했다. TODO/FIXME 류 미완성 마커는 없고, 남은 미해결 항목(타이머
지터·`unref` 셧다운 트레이드오프·배포 전환 창)은 전부 근거·재개 조건이 명시된 의도적 유예다.
독립적으로 실행한 테스트(72/72 통과)와 뮤테이션(2개 RED 재현)이 plan/RESOLUTION 의 주장과
일치해 새로운 CRITICAL/WARNING 급 결함을 발견하지 못했다.

## 위험도

NONE
