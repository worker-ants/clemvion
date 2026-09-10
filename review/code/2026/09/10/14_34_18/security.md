# 보안(Security) Review — `trigger-workflow-ref-canary`

대상: 신규 파일 3개(테스트 전용, 프로덕션 코드 변경 없음)
- `codebase/backend/src/shared/testing/trigger-workflow-ref.ts`
- `codebase/backend/src/shared/testing/trigger-workflow-ref.spec.ts`
- `codebase/backend/test/trigger-workflow-ref.e2e-spec.ts`

(plan/review 문서 파일은 보안 관점 대상 아님 — 확인만 하고 발견사항에서 제외)

검증 방법: 저장소를 뮤테이션하지 않고 `Read`/`Grep`으로 실제 소스(`triggers.service.ts`,
`chat-channel-config.dto.ts`, `secret-resolver.service.ts`, `secret-store.entity.ts`,
`triggers.controller.ts`, 기존 `chat-channel-trigger-create.e2e-spec.ts`)를 열어 프롬프트의
다섯 가지 점검 관점을 각각 대조했다. `git status --short`로 트리를 건드리지 않았음을 확인함
(작업 중 변경 없음).

## 발견사항

- **[INFO]** 가짜 bot token 리터럴은 기존 선례와 일치 — 실제 시크릿 유출 아님
  - 위치: `codebase/backend/test/trigger-workflow-ref.e2e-spec.ts:115`, `:191` (게이트 기준,
    `chatChannel: { provider: 'telegram', botToken: '111:e2eWfRefBotToken' }`)
  - 상세: `botToken: '111:e2eWfRefBotToken'`는 텔레그램 봇 토큰 형식(`\d+:[A-Za-z0-9_-]+`)과
    일치하지만 `e2e` 접두어가 박혀 있어 명백히 페이크다. 기존 `chat-channel-trigger-create.e2e-spec.ts`
    가 이미 `'111:e2eTelegramBotToken'`, `'111:e2eToken'`, `'111:bad'`, `'xoxb-e2e-slack-token'`,
    `'discord-e2e-bot-token'` 등 동일 패턴의 페이크 값을 다수 사용 중임을 grep 으로 확인했다 —
    새 파일이 그 관례를 그대로 따른 것이며 새로운 위험을 도입하지 않는다. 다만 이런 형태 문자열은
    자동 secret-scanner(gitleaks 류)의 오탐(false positive) 소스가 될 수 있다는 점은 기존 코드베이스
    전반에 이미 내재된 특성이라 이 PR 만의 문제는 아니다.
  - 제안: 조치 불필요. 기존 관례와 일관됨.

- **[INFO]** 실패 시 응답 바디/시크릿을 CI 로그에 노출하는 `console.log` 등은 새 파일에 없음
  - 위치: `codebase/backend/test/trigger-workflow-ref.e2e-spec.ts` 전체
  - 상세: `grep -n "console\.\|JSON.stringify"` 결과 0건. plan 문서(`trigger-workflow-ref-canary.md`)에는
    구현 중 400 원인을 진단하려고 임시로 응답 본문을 찍었다는 기록이 있으나, 커밋된 e2e 파일에는
    그 진단 로그가 남아 있지 않다 — 실측 확인함. `expectTriggerWorkflowRef`의
    `expect(record).not.toHaveProperty(column)` 계열 단언이 실패(=실제 시크릿이 샜다는 뜻)할 경우
    Jest 는 통상 발견된 속성 값을 실패 메시지에 포함하므로, 그 경우 CI 로그에 값이 한 번 노출될
    수 있다. 그러나 이는 이 파일만의 설계가 아니라 저장소 전역의 secret-not-present 단언 패턴에
    공통된 트레이드오프이고(예: 기존 `chat-channel-trigger-create.e2e-spec.ts`의
    `expect(chatChannel).not.toHaveProperty('botToken')`도 동일 구조), 이 PR 이 사용하는 값은 전부
    페이크라 실제 노출 사고로 이어지지 않는다.
  - 제안: 조치 불필요.

- **[INFO]** 헬퍼의 시크릿 컬럼 목록은 프로덕션 SoT와 정확히 일치 — "한 칸 좁다" 가설은 기각
  - 위치: `codebase/backend/src/shared/testing/trigger-workflow-ref.ts:48-51` (`TRIGGER_SECRET_COLUMNS`)
    vs `codebase/backend/src/modules/triggers/triggers.service.ts:99-102` (`TRIGGER_RESPONSE_STRIP_COLUMNS`)
  - 상세: 두 목록 모두 정확히 `['notificationSecretV2', 'chatChannelTokenV2']` 두 항목, 같은 순서다.
    프로덕션 쪽은 `as const satisfies readonly (keyof Trigger)[]`로 엔티티 키셋과 타입 결속돼 있다.
    즉 현재 시점에서 헬퍼의 방어는 프로덕션 SoT보다 좁지 않다 — 이 리뷰가 우려한 "한 칸 좁은 정의"
    가설은 이 축에서는 실측으로 기각된다.
  - **다만 두 목록은 구조적으로 결속돼 있지 않다.** 헬퍼 쪽은 독립된 리터럴 복사본이고, 프로덕션
    쪽에 세 번째 시크릿 컬럼이 추가돼도(이 저장소는 실제로 최근 커밋들(`bfa124920`, `08fbf133d`)에서
    새 시크릿 유출 축을 반복적으로 발견해 온 이력이 있다) 이 테스트 파일이 자동으로 그 사실을
    알아채지 못한다 — 사람이 두 목록을 수동으로 동기화해야 한다. `trigger-workflow-ref.spec.ts` 의
    self-guard(92행대 `for (const secret of ['notificationSecretV2', 'chatChannelTokenV2'])`)도
    같은 하드코딩 복사본을 또 한 번 반복해 총 세 자리(프로덕션·헬퍼·self-spec)가 독립 리터럴이다.
  - 제안: 지금 당장 코드 변경이 필요한 결함은 아니다(가설 기각). 다만 후속으로 헬퍼가
    `TRIGGER_RESPONSE_STRIP_COLUMNS`를 프로덕션 모듈에서 직접 import 해 단일 리터럴로 결속시키면
    (혹은 최소한 헬퍼 docstring에 "프로덕션 목록과 수동 동기화 필요"를 명시) 향후 §5.4 스윕류
    회귀가 이 테스트를 스치지 않고 지나갈 가능성을 원천 차단할 수 있다. 이 저장소의 반복 실패
    패턴("정의를 한 칸 좁게 잡는다")과 정확히 같은 모양의 잠재 리스크이므로 WARNING 으로 기록한다.

- **[WARNING]** 헬퍼·self-spec·프로덕션 3자리에 독립 하드코딩된 시크릿 컬럼 리스트 — 위 항목과 동일 근거, 유지보수 결합 부재
  - 위치: `codebase/backend/src/shared/testing/trigger-workflow-ref.ts:48-51`,
    `codebase/backend/src/shared/testing/trigger-workflow-ref.spec.ts:93` (게이트 기준),
    `codebase/backend/src/modules/triggers/triggers.service.ts:99-102`
  - 상세: 위 INFO 항목 참고. 현재는 값이 일치하지만 세 자리가 각각 독립적으로 유지되므로 드리프트
    방지 메커니즘이 없다.
  - 제안: import 결속 또는 명시적 "수동 동기화 필요" 주석. 이 PR 을 막을 정도는 아니라 후속 개선으로 제안.

- **[INFO]** 캐너리가 기존 시크릿 단언(`assertMatchesContract`/`expectNoUserSecrets`)을 대체·약화하지 않음 — 확인됨
  - 위치: 신규 3개 파일 전체 + `git diff --stat` (프로덕션/기존 e2e 파일 변경 0건)
  - 상세: `grep -n "assertMatchesContract\|expectNoUserSecrets"` 결과 신규 파일에는 주석 인용 2곳
    뿐이고 실제 호출은 0건이다. `git log`(커밋 `f71aa584e`)의 diff 통계는 3개 신규 파일 추가만
    보여주며 기존 파일 수정은 없다 — `assertMatchesContract`를 호출하는 기존 자리
    (`chat-channel-trigger-create.e2e-spec.ts:131,163` 등)는 전혀 건드려지지 않았다. 이 캐너리는
    `workflow` 참조 유무라는 **한 축**만 새로 고정할 뿐, 기존 계약 검증 축을 대체하려는 시도가
    없다 — 안전.
  - 제안: 조치 불필요.

- **[WARNING]** (프로덕션 코드 사전 존재 — 이 diff 가 만든 문제는 아니지만, 저자가 명시적으로 판단을 요청함) `chatChannel` PATCH 가 bot-token single-path 정책(R-CC-10/§5.4.1)을 실질적으로 우회하고, 전용 감사 액션 없이 즉시 교체·grace 백업 없이 시크릿을 덮어쓴다
  - 위치: `codebase/backend/src/modules/triggers/dto/chat-channel-config.dto.ts:170-187`
    (`botToken: string` — `@IsOptional()` 없음, POST/PATCH 공용 DTO),
    `codebase/backend/src/modules/triggers/triggers.service.ts:915-952` (`setupChatChannel` →
    `this.secrets.rotate(botTokenRef, trigger.workspaceId, chatChannelCfg.botToken ?? '')`),
    비교 대상: `triggers.service.ts:1238-1367` (`rotateBotToken` — 1) 기존 토큰 resolve, 2) v2Ref 로
    24h grace 백업, 3) 신규 토큰 저장, 6) `chatChannelTokenV2`/`chatChannelRotatedAt` 컬럼 갱신,
    전용 감사 액션 `TRIGGER_CHAT_CHANNEL_BOT_TOKEN_ROTATED` 기록)
  - 상세: 요청하신 "읽기"를 드린다 — **PATCH 경로는 봇 토큰을 grace 윈도우 없이 교체할 수 있고,
    그 사실을 전용 감사 이벤트로 남기지 않는다.**
    - `assertChatChannelInputSafe`(`triggers.service.ts:575-604`)는 `botTokenRef`(내부 참조 필드)
      외부 입력만 400 으로 막는다 — 그 메시지 자체가 *"토큰 변경은 항상
      `POST /api/triggers/:id/chat-channel/rotate-bot-token`"*이라고 명시하는데, 정작 평문
      `botToken` 필드는 같은 가드에서 검사 대상이 아니다.
    - `ChatChannelConfigDto.botToken`은 POST/PATCH 공용이고 `@IsOptional()`이 없어 **필수**다 —
      새 e2e 파일의 주석(`:191` 게이트, "botToken 은 생략할 수 없다", 실측 400
      `chatChannel.botToken must be a string`)이 이를 실증한다. 즉 `chatChannel`을 조금이라도
      건드리는 PATCH(예: `uiMapping`만 바꾸고 싶은 경우)는 매번 평문 `botToken` 전체를 다시 보내야
      한다.
    - PATCH 의 `update()` → `setupChatChannel()`은 `this.secrets.rotate(botTokenRef, ws,
      chatChannelCfg.botToken ?? '')`을 호출한다. `SecretResolverService.rotate()`
      (`secret-resolver.service.ts:129-145`)는 기존 값 존재 여부만 확인하고 **UPSERT** —
      호출 전 기존 평문을 조회하거나 백업하지 않는다.
    - 반대로 전용 `rotateBotToken()`은 (1) 기존 토큰을 `resolve()`, (2) 존재하면 `bot-token.v2`
      ref 로 백업해 `chatChannelTokenV2` 컬럼에 기록(24h grace — 이후 스윕이 구 토큰을 provider
      측에서 명시적으로 revoke), (3) 그 다음에야 신규 토큰을 저장하고, 전용 감사 액션
      `TRIGGER_CHAT_CHANNEL_BOT_TOKEN_ROTATED`를 남긴다.
    - PATCH 경로는 이 세 가지(구 토큰 백업 → grace → 명시적 provider revoke, 전용 감사 액션)를
      전부 건너뛴다. `update()`가 남기는 감사는 범용 `TRIGGER_UPDATED`(`triggers.service.ts:521-527`)
      하나뿐이라, "이 이벤트가 봇 토큰 교체였다"는 사실이 감사 로그만으로는 구분되지 않는다.
    - 권한 모델은 동일하다(`triggers.controller.ts`: PATCH·rotate-bot-token 모두 `@Roles('editor')`)
      — 따라서 이것이 **권한 상승**은 아니다. 그러나 "같은 editor 권한이라도 의도적으로 격리된
      단일 경로(감사·grace)를 우회해 같은 효과(토큰 교체)를 낼 수 있다"는 점에서 R-CC-10 이
      선언한 계약(§5.4.1 single-path)의 실효성이 구멍나 있다. 실무적 영향: (a) 토큰 유출 대응 시
      담당자가 "PATCH 로 바꿨으니 안전"이라 오판하면 구 토큰이 provider 측에서 **영구히 미회수**로
      남을 수 있다(명시적 revoke 스윕은 `chatChannelTokenV2`가 채워진 rotate-bot-token 경로에만
      배선돼 있다), (b) 감사 로그로 "언제 봇 토큰이 바뀌었는가"를 추적하는 보안 모니터링이
      PATCH 경유 교체를 놓친다, (c) `chatChannel`의 다른 필드(`uiMapping` 등)만 바꾸려는 무해한
      PATCH 도 매번 시크릿 스토어 row 를 재암호화(`updatedAt` 갱신)하게 만들어, 감사·모니터링
      관점에서 "봇 토큰이 자주 바뀌는 것처럼" 보이는 잡음을 만든다.
  - **판정**: (b) 실제 갭이다. (a) "정책이 ref 지정 금지만 뜻한다"는 해석은 코드 주석
    자체("토큰 변경은 항상 rotate-bot-token") 및 spec 명명(single-path)과 정면으로 배치되므로
    설득력이 낮다.
  - 제안: 이는 이번 테스트 전용 PR 이 만든 결함이 아니라 사전에 존재하던 프로덕션 코드의 갭이므로
    이 PR 을 막을 사유는 아니다. 다만 저자가 트래커에 등재한 대로 별도 planner/developer 턴에서
    다음 중 하나로 닫을 것을 권고한다: ① `ChatChannelConfigDto.botToken`을 PATCH 컨텍스트에서
    `@IsEmpty()`로 막고(생성 시에만 필수), 값 교체는 오직 `rotate-bot-token`으로만 허용, 또는
    ② PATCH 의 `setupChatChannel` 호출부도 `rotateBotToken`과 동일한 백업/grace/전용 감사 로직을
    타도록 통합.

- **[LOW/INFO]** e2e 가 생성한 `secret_store` row(암호화된 페이크 봇 토큰)는 `afterAll`에서 정리되지 않음 — 기존 관례와 동일, 실 위험은 낮음
  - 위치: `codebase/backend/test/trigger-workflow-ref.e2e-spec.ts:123-130` (`afterAll` —
    `DELETE FROM trigger WHERE id = $1`만 수행)
  - 상세: `secret_store` 엔티티(`secret-store.entity.ts`)는 `trigger`에 대한 **FK 가 없다**
    ("application-level cascade — FK 없음, Rationale R4" 주석으로 명시). 따라서 `trigger` row 삭제는
    `setupChatChannel`이 만든 `botTokenRef`(및 조건부 `inboundSigningRef`) secret_store row 를
    cascade 삭제하지 않는다 — 암호화된 페이크 토큰 값이 DB 에 orphan 으로 남는다. 다만:
    1) 값은 실제 시크릿이 아니라 테스트 리터럴이라 노출 자체의 실질 피해가 없고,
    2) grep 결과 기존 선례 `chat-channel-trigger-create.e2e-spec.ts`의 `afterAll`도 정확히
       동일하게 `trigger`만 지우고 `secret_store`는 지우지 않는다 — 이 PR 이 새로 도입한 패턴이
       아니라 저장소 전역의 기존 관례를 그대로 따른 것이다.
    3) plan 문서가 밝히듯 e2e 환경은 실행마다 ephemeral schema 로 재생성되므로 orphan row 는
       무한히 누적되지 않는다.
  - 제안: 이 PR 단독으로 고칠 필요는 없다(기존 관례 준수). 다만 언젠가 이 클래스의 e2e 파일들이
    `secret_store` cleanup 을 표준 teardown 보일러플레이트에 포함시키는 후속 개선을 고려할 만하다
    (공유 테스트 DB 에 시크릿 스토어 row 가 누적되는 것은 프로덕션 값이 아니어도 위생상 바람직하지
    않다).

## 확인했으나 문제 없음

- 인젝션(SQL/XSS/커맨드/경로탐색): `afterAll`의 `DELETE FROM trigger WHERE id = $1`는 파라미터
  바인딩(`pg` 드라이버, `$1`)을 사용해 SQL 인젝션 벡터 없음. 나머지 두 파일은 순수 단언 로직이라
  인젝션 표면이 없다.
- 인증/인가: 신규 e2e 는 `registerAndLogin`/`createTeamWorkspace` 기존 헬퍼로 정상 인증 토큰을
  발급받아 사용하며, 권한 우회 시도 없음.
- 암호화: 신규 파일은 암호화 로직을 다루지 않음(시크릿 저장/암호화는 기존 `SecretResolverService`
  경유, 이 PR 범위 밖).
- 의존성: 신규 파일은 기존 의존성(`@jest/globals`, `pg`, `supertest`, `node:crypto`)만 사용, 신규
  패키지 추가 없음.

## 요약

세 신규 테스트 파일 자체는 보안 관점에서 안전하다 — 페이크 봇 토큰 리터럴은 기존 관례를 따르고,
헬퍼가 검사하는 시크릿 컬럼 목록은 프로덕션 SoT(`TRIGGER_RESPONSE_STRIP_COLUMNS`)와 실측상
정확히 일치하며(다만 구조적으로 결속돼 있지 않아 향후 드리프트 위험은 남음), 기존
`assertMatchesContract`/`expectNoUserSecrets` 계열 단언을 대체·약화한 흔적도 없다. e2e 의
`secret_store` 잔존은 기존 파일과 동일한 관례이고 값이 페이크라 실질 위험은 낮다. 다만 이번
캐너리 구현 중 저자가 실측으로 드러낸 프로덕션 쪽 사실 — `chatChannel` PATCH 가 §5.4.1/R-CC-10
single-path 정책의 취지(봇 토큰 교체는 오직 `rotate-bot-token`으로만)를 우회해, grace 백업·구 토큰
provider revoke·전용 감사 액션 없이 평문 `botToken`을 즉시 덮어쓸 수 있다는 점 — 은 이 PR 이 만든
결함은 아니지만 진짜 보안 설계 갭으로 판단되며, 별도 턴에서의 후속 조치가 필요하다.

## 위험도

LOW (이 diff 자체는 테스트 전용이며 신규 취약점을 도입하지 않음). 단, 이번 작업 중 드러난
프로덕션 코드의 bot-token PATCH 우회 갭은 **MEDIUM** 수준으로 별도 트래킹·수정이 필요하다.
