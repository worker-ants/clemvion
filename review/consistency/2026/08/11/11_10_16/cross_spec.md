# Cross-Spec 일관성 검토 — `spec/7-channel-web-chat/3-auth-session.md` (§3.1-2·§R4 갱신, `partial`→`implemented`)

## 검토 범위·방법

target 은 `spec/7-channel-web-chat/3-auth-session.md`(§3.1-2 재로드 REST 오류 분기·§R4 추가, frontmatter
`status: partial→implemented`, `pending_plans` 제거) + `spec/0-overview.md` 미러다. diff(`origin/main...HEAD`)는
`codebase/channel-web-chat/src/{lib/eia-client.ts,lib/eia-client.test.ts,lib/session-store.ts,widget/use-widget.ts,
widget/use-widget.test.ts,widget/use-widget-eager-start.test.ts,widget/use-token-refresh.ts,
widget/use-token-refresh.test.ts}` 만 건드렸고 spec 은 `3-auth-session.md`+`0-overview.md` 외 변경이 없다.

특별 지시에 따라 `401`/`410` 종료 조건과 `refresh_deferred`(비-terminal refresh 실패 → 스트림만 유예) 서술을
`spec/5-system/14-external-interaction-api.md`(EIA, 프롬프트 번들에서는 예산 초과로 생략돼 있어 실제 파일을
절대경로로 직접 Read) 및 같은 영역의 `1-widget-app.md`/`4-security.md`와 대조했다. 코드 SoT
(`interaction.controller.ts`/`interaction.service.ts`)도 절대경로로 확인해 EIA 문서 자체의 최신성도 함께 점검했다.

## 발견사항

- **[WARNING]** target 이 인용하는 "EIA §5.5" 가 실제로는 `410` 분기를 문서화하지 않음 — 인용과 피인용 spec 본문이 어긋남
  - target 위치: `3-auth-session.md` §3.1-2 (`···· \`410\`(\`EXECUTION_TERMINATED\`)도 \`/refresh-token\` 이 실제로 내는
    분기다([EIA §5.5])···`) 및 §R4 rationale 중 동일 주장을 뒷받침하는 문단.
  - 충돌 대상: `spec/5-system/14-external-interaction-api.md` §5.5 "토큰 갱신 — `POST .../refresh-token`" 본문
    (라인 505-518). 그 응답 블록은 `200 OK` / `401 Unauthorized // execution 종료됨, 또는 expiresAt 까지 30분
    이상 남음` **두 가지만** 나열하고 `410 Gone` 은 어디에도 등장하지 않는다. §3.3 EIA-AU 표(§3.3, 89-96행)에도
    refresh-token 이 `410` 을 낼 수 있다는 요구사항 ID 가 없다.
  - 상세: 실제 구현(`codebase/backend/src/modules/external-interaction/interaction.service.ts:216-260`)은
    `refreshToken()` 에서 execution 이 이미 terminal 이면 `GoneException({ code: 'EXECUTION_TERMINATED' })`(=`410`)을
    던지고, controller 의 swagger 데코레이터(`interaction.controller.ts:149` `@ApiGoneResponse({ description:
    'EXECUTION_TERMINATED' })`)도 이를 확인한다. 즉 target 이 서술하는 "refresh-token 도 410 을 낸다" 는 **실제
    구현과는 일치**하지만, target 이 근거로 지목한 EIA §5.5 **본문 자체**는 이 사실을 담고 있지 않다 — 그 절만 읽는
    독자는 refresh-token 이 `401` 만 낸다고 오해한다. 부수적으로 §5.5 의 "401 ··· 또는 expiresAt 까지 30분 이상
    남음" 문구도 stale 하다 — 실제로 window 미도달은 `400 TOKEN_REFRESH_NOT_IN_WINDOW`(`interaction.service.ts:234`)
    이지 `401` 이 아니다. 즉 EIA §5.5 는 이번 target PR 이전부터 구현에 뒤처진 상태였고, target 이 그 절을 "실제로
    410 을 낸다" 는 근거로 인용하면서 그 간극이 처음으로 눈에 띄게 노출됐다.
  - 제안: 이 PR 의 target 서술 자체(3-auth-session.md)는 구현과 정합하므로 수정할 필요는 없다. 대신 **함께 갱신할
    spec**으로 `spec/5-system/14-external-interaction-api.md` §5.5 를 별도 후속(5-system 소유자/EIA 담당 plan)에서
    업데이트할 것을 권장한다 — 최소 `410 Gone // EXECUTION_TERMINATED (race window: token 아직 blacklist 미반영)` 한
    줄과, 가능하면 `400 TOKEN_REFRESH_NOT_IN_WINDOW` 도 응답 블록에 추가해 실제 3-분기(`400`/`401`/`410`)를 문서화한다.
    (EIA 자체는 이번 diff 범위 밖이라 이 PR 을 막을 이유는 아니다.)

- **[INFO]** EIA §8.4 의 "refresh-token = 명령/조회가 아닌 토큰 관리 표면" 분류와, refresh-token 이 명령과 동일한
  `EXECUTION_TERMINATED`/`410` 을 낸다는 사실 사이의 taxonomy 경계가 흐릿함
  - target 위치: `3-auth-session.md` §3.1-2 (`EIA-IN-12 의 \`410 Gone\` 은 *명령*(interact)에 대한 응답 전용이라
    상태조회에는 나타나지 않는다` 문장과, 바로 아래 refresh-token 도 `410` 을 낸다는 문장이 나란히 있음).
  - 충돌 대상: `spec/5-system/14-external-interaction-api.md` §8.4 (`/refresh-token(§5.5)은 명령/조회가 아닌 토큰
    관리 표면이라 본 per-execution rate-limit 범위 밖`, 라인 765) 와 §3.2 EIA-IN-12(`종료된 execution 에 대한
    명령은 410 Gone 반환`, 라인 82).
  - 상세: target 은 이 구분을 정확히 알고 스스로 "refresh-token 의 410 은 EIA-IN-12(명령)가 아니라 §5.5 고유
    분기" 라고 적어(§3.1-2 121-132행) 모순을 만들지는 않는다 — 다만 EIA 문서 전체로 보면 "명령"과 "토큰 관리
    표면"을 요구사항 차원(rate-limit 등)에서는 구분해 놓고, 에러 코드/상태코드 차원(`EXECUTION_TERMINATED`/`410`)
    에서는 두 표면이 우연히 동일한 값을 공유한다 — 이 사실이 EIA 어디에도 명시적으로 언급돼 있지 않다. 두 checker
    관점(요구사항 ID 충돌·API 계약 충돌)이 겹치는 자리라 이름을 붙여 둔다.
  - 제안: 위 WARNING 항목과 같은 EIA §5.5 후속 업데이트에서, "refresh-token 의 `410` 은 EIA-IN-12 와 별개
    분기이지만 같은 코드값을 재사용한다" 는 한 문장을 §5.5 또는 §8.4 각주로 남기면 향후 다른 checker/구현자가
    "명령 전용" 문구만 보고 refresh-token 을 제외 대상으로 오판하는 것을 막을 수 있다.

- **[INFO]** `1-widget-app.md` §3.1 표의 "`410 Gone` 은 *명령*(interact/cancel) 응답 전용" 문구가 target 의 신규
  refresh-token `410` 서술과 나란히 두면 예시 나열이 불완전해 보임 (하드 모순은 아님)
  - target 위치: (참고) `3-auth-session.md` §3.1-2 신규 문장 — refresh-token 도 `410` 을 낸다.
  - 충돌 대상: `spec/7-channel-web-chat/1-widget-app.md` §3.1 "토큰 만료/서버 타임아웃" 행(91번째 줄) —
    `` `410 Gone` 은 *명령*(interact/cancel) 응답 전용이라 상태조회엔 안 나타남(EIA §5.3) ``.
  - 상세: 이 문장의 논지는 "상태조회(§5.3)에는 410 이 안 나타난다" 는 대비이지 "410 을 내는 endpoint 는
    interact/cancel 뿐이다" 라는 전수 주장은 아니며, 같은 행이 "재로드 상태 분기 SoT=3-auth-session §3.1" 이라고
    명시적으로 위임하고 있어 실질적 오독 위험은 낮다. 다만 괄호 안 예시(`interact/cancel`)가 이제 refresh-token
    이라는 세 번째 소스를 빠뜨리고 있어, 이 파일만 읽는 독자에게는 목록이 완결적으로 읽힐 수 있다. `1-widget-app.md`
    는 이번 diff 대상이 아니라 CRITICAL/WARNING 으로 올리지 않는다.
  - 제안: 여유가 있으면 같은 행 괄호를 `interact/cancel, 그리고 §5.5 refresh-token(별도 분기 — §3-auth-session
    §3.1-2)` 정도로 확장해 두 문서 간 예시 목록을 동기화. 급하지 않음.

## 검증해 확인한 것 (충돌 없음)

- `401` 판정 근거(EIA §8.3 jti blacklist, EIA-AU-04 즉시 invalidate, EIA-AU-05 30분 이내 refresh 권장) — target 의
  §3.1-2/§R4 서술과 EIA 본문이 정확히 일치.
- `410` 이 상태조회(§5.3)에는 나타나지 않는다는 target 의 주장 — EIA §5.3 응답 스키마에 `410` 없음, 확인됨.
- `refresh_deferred`(네트워크·5xx → 세션 유지 + SSE 만 유예 + 주기 refresh 로 복구)는 순수 클라이언트 정책이며
  EIA 는 클라이언트 재시도 전략을 규정하지 않으므로 EIA 와 상충할 여지가 구조적으로 없음. diff 코드
  (`use-widget.ts` `recoverFromExpiredToken`/`SeedOutcome`, `use-token-refresh.ts`)도 서술과 정확히 일치.
- `EIA-RL-07`(idle-wait backstop)과 target 의 storage 정리 책임(§3.1-3) 사이 역할 분담 — 클라이언트 잔존 정리 vs
  서버측 execution 회수로 명확히 분리돼 있어 충돌 없음.
- frontmatter `status: implemented` 승격 — 영역 6개 spec 파일이 모두 `status: implemented` 이고, `spec/0-overview.md`
  의 "6문서가 모두 implemented" 서술 및 `plan/complete/webchat-reload-rest-error-branches.md` 참조가 실제로 존재.
  `0-overview.md` 안에 채널-웹챗 관련 stale `partial` 잔존 언급 없음.
- diff 로 변경된 8개 코드 파일이 frontmatter `code:` 목록(session-store.ts/api-base.ts/eia-client.ts/use-widget.ts/
  use-session-generations.ts/use-token-refresh.ts)에 모두 포함돼 있음 — 누락 없음.
- RBAC·데이터 모델·계층 책임 축에서는 이번 target 변경이 새 엔티티·권한·서버-클라이언트 책임 분할을 도입하지
  않아 해당 관점의 충돌 없음.

## 요약

target(`3-auth-session.md` §3.1-2·§R4 + `implemented` 승격)이 서술하는 `401`/`410` 종료 조건과 `refresh_deferred`
유예 정책은 EIA 본문(§5.3·§8.3·EIA-IN-12·EIA-AU-04/05)과 실제 백엔드 구현(`interaction.service.ts`/
`interaction.controller.ts`) 양쪽 모두와 실질적으로 정합한다 — 직접적 모순은 없다. 다만 target 이 근거로 인용한
"EIA §5.5" 절 자체는 `410`(및 `400`) 분기를 문서화하지 않은 채 이번 PR 이전부터 stale 한 상태였고, target 의 새
서술이 그 간극을 처음으로 드러낸다. 이는 target 문서의 결함이 아니라 EIA(§5-system, 이번 diff 범위 밖) 쪽의
후속 동기화가 필요한 지점이며, 그 외 `1-widget-app.md`·`4-security.md`·`0-overview.md` 와의 교차 참조는 모두
일관됐다.

## 위험도

LOW
