# 보안(Security) 리뷰

## 컨텍스트

이 diff 는 그 자체로 보안 수정 PR 이다 — §5.4 응답-계약 검증자를 14개 이상 엔드포인트로
넓히는 과정에서 트리거 회전 secret(`notificationSecretV2` 평문, `chatChannelTokenV2` secret
store ref, `triggerToken` 발급 토큰)이 4개 경로(`GET/POST/PATCH /api/triggers`,
`GET/POST/PATCH /api/schedules` 조인)로 새고 있던 것을 발견해 막는다. 아래는 그 수정
자체의 견고성과, 수정이 남긴 잔여 리스크를 검토한 결과다.

## 발견사항

- **[WARNING]** deny-list(strip-list) 기반 정화가 이번에도 "세 번째" 로 좁게 틀렸었다는
  사실이 코드 자신의 JSDoc 에 기록돼 있다 — 구조적으로 네 번째가 재발할 수 있는 설계다.
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts` — `sanitizeForResponse()`
    메서드 JSDoc (`## 왜 세 목록인가 — 이 메서드가 두 번 좁게 틀렸다` 단락, `TRIGGER_RESPONSE_STRIP_COLUMNS`
    선언부 JSDoc), `CHAT_CHANNEL_RESPONSE_STRIP_KEYS` / `NOTIFICATION_SIGNING_STRIP_KEYS` /
    `INTERACTION_RESPONSE_STRIP_KEYS` / `TRIGGER_RESPONSE_STRIP_COLUMNS` 선언부.
  - 상세: 비밀이 `config.chatChannel`(JSONB 키) · `config.notification.signing`(JSONB 키) ·
    `config.interaction`(JSONB 키) · `trigger` 엔티티 컬럼, 이렇게 **네 곳**에 흩어져 있고,
    각각을 수기 `Set<string>` 목록으로 막는다. 코드 자신이 "다음에 비밀 축이 하나 더 생기면
    목록을 늘리지 말고 선언적 SoT(엔티티 데코레이터)로 옮길 것" 이라고 적어 두었을 만큼,
    같은 형태의 좁은 방어가 세 라운드 연속(§5.4 스윕 1차 → `NOTIFICATION_SIGNING_STRIP_KEYS`
    누락 → `INTERACTION_RESPONSE_STRIP_KEYS` 누락) 재발했다. 이번 라운드는 전수 열거로
    막았지만, 새 필드(예: 향후 provider 가 추가하는 새 토큰 키)가 이 네 상수 중 어디에도
    등재되지 않으면 같은 클래스의 유출이 다시 발생한다 — 코드 리뷰나 테스트가 그 등재
    누락 자체를 강제하지 않는다.
  - 제안: 이 PR 을 막을 사유는 아니다(이미 알려진 트레이드오프고 실측 근거가 있다). 다만
    후속 항목으로, `Trigger` 엔티티 필드에 `@Sensitive()` 류 데코레이터를 붙이고
    `sanitizeForResponse` 가 리플렉션으로 그 필드들을 자동으로 걷어내는 선언적 방식으로
    옮기는 것을 고려할 것 — 코드 자신의 JSDoc 이 "세 번째면 승격" 이라고 이미 제안했다.

- **[WARNING]** `config.*` 처럼 `additionalProperties: true` 로 열린 JSONB 맵은 런타임
  계약 검증자(`response-contract.ts`)와 정적 가드(`swagger-dto-contract-guard.ts`) **양쪽
  모두의 사각지대**이며, 그 사실이 이번 PR 로 처음 문서화됐다 — 앞으로 이 경로에 새 비밀
  필드가 추가돼도 자동 도구가 못 잡고 수기 e2e 단언에만 의존한다.
  - 위치: `codebase/backend/test/chat-channel-trigger-create.e2e-spec.ts` (`'단건 조회에서
    config.interaction 의 발급 토큰이 제거된다'` 테스트의 JSDoc, `> notification.signing.secret
    축은 여기서 못 만든다` 각주) — 근거로 인용된 `review/code/2026/09/05/22_48_39` W1.
  - 상세: `TriggerDto.config` 는 열린 맵으로 선언돼 있어(`additionalProperties: true`),
    `assertMatchesContract` 가 그 안으로 재귀하지 않는다. 정적 가드도 응답 DTO 의
    **선언된 프로퍼티**만 스캔하므로 같은 사각지대다. 그래서 `config.interaction.triggerToken`,
    `config.notification.signing.secret` 같은 필드의 스트립 여부는 오직 손으로 짠
    `expect(...).not.toHaveProperty(...)` 에만 의존한다 — 이번엔 그 수기 테스트가 존재하고
    비밀이 실제로 채워진 fixture 로 뮤테이션 검증까지 됐지만(신뢰할 만하다), **이 클래스의
    보호는 "새 열린 맵 비밀 필드마다 개발자가 그 사실을 기억하고 e2e 를 손으로 추가하는가"**
    에 전적으로 달려 있다. 자동화된 이중 안전망(계약 검증자·정적 가드)이 있는 다른 필드들과
    달리, 이 표면은 회귀가 나도 CI 가 "선언되지 않은 키" 로 잡아 주지 않는다.
  - 제안: 이 PR 을 막을 사유는 아니다 — 오히려 이 PR 이 그 사각지대를 처음으로 명시화하고
    수기 테스트로 메웠다. 다만 백로그 항목으로 "열린 config 맵 안의 신규 비밀 필드는 반드시
    e2e `not.toHaveProperty` 를 동반해야 한다" 를 규약 문서(`secret-store.md` 또는 `swagger.md`
    §5.4)에 명시적으로 남겨, 다음 사람이 같은 사각지대에서 또 새 유출을 만들지 않게 할 것.

- **[INFO]** `chatChannelLastError`/`notificationLastError` 가 이번에 `TriggerDto` 에 정식
  선언되면서, 업스트림 실패 메시지(최대 1024자, `message.slice(0, 1024)`)가 공개 계약의
  일부로 공식화됐다 — 이 diff 가 새로 만든 노출은 아니지만(이미 응답에 실려 나가고 있었고
  이번엔 선언만 실제에 맞췄다), 공식 계약이 된 지금은 "이 필드에 자격 증명·내부 URL 이
  섞여 들어갈 수 있는가" 를 별도로 감사할 가치가 있다.
  - 위치: `codebase/backend/src/modules/triggers/dto/responses/trigger-response.dto.ts:106-124`
    (선언), 값을 채우는 자리는 이 diff 밖 — `codebase/backend/src/modules/triggers/triggers.service.ts`
    의 `chatChannelLastError: message.slice(0, 1024)` (setupChannel catch 블록), `codebase/backend/src/modules/external-interaction/notification-webhook.processor.ts`
    의 `notificationLastError: truncate(reason, LAST_ERROR_MAX_LENGTH)`, `codebase/backend/src/modules/hooks/hooks.service.ts`
    의 하드코딩 rate-limit 메시지.
  - 상세: `err.message`/`reason` 을 그대로(길이만 잘라) 저장하는 패턴이라, 업스트림
    provider(텔레그램·슬랙 등)나 webhook 대상이 에러 본문에 자신의 요청 URL·헤더 일부를
    반사(echo)하면 그 값이 이 필드를 통해 워크스페이스 멤버에게 노출될 수 있다. 다만 이
    코드는 이번 diff 의 변경 범위 밖이고, 이미 오래전부터 wire 로 나가고 있던 값이라 이
    PR 이 만든 회귀가 아니다.
  - 제안: 조치 불요(이 PR 범위 밖). 별도 트래커 항목으로 "chatChannelLastError/
    notificationLastError 원문에 자격 증명이 섞일 경로가 있는지" 를 감사할 것을 권고.

- **[INFO]** 테스트 fixture 의 비밀값(`'wsk_should_not_leak'`, `'itk_should_not_leak'`,
  `'secret://triggers/trg-1/bot-token.v2'` 등)은 형태만 실제와 유사한 더미이고 실제 자격
  증명은 아님 — 하드코딩 시크릿 위반 아님. 확인 완료.

## 검증한 항목 (문제 없음)

- **정화 로직의 방향성**: `TRIGGER_RESPONSE_STRIP_COLUMNS` 제거는 `undefined` 대입이 아니라
  `delete` 로 키 자체를 없앤다 — `JSON.stringify` 뿐 아니라 키 열거(`Object.keys`, 로깅
  미들웨어 등) 경로까지 막는 올바른 선택이다.
- **커버리지**: 트리거 4경로(list/detail/create/update)와 스케줄 4경로(list/detail/create/update)
  전부 `sanitizeForResponse`/`toResponse` 를 거치도록 배선됐고, unit(비밀이 채워진 fixture)·
  e2e(실 HTTP 응답에 실제 비밀 값 발급 후 부재 확인) 양쪽에서 뮤테이션 검증(스트립 되돌리기
  → RED 확인)까지 거쳤다는 서사가 `RESOLUTION.md` 들에 일관되게 기록돼 있고, diff 자체의
  테스트 코드가 그 서사와 일치한다.
- **스케줄 응답 경계**: 서비스가 아니라 컨트롤러(`SchedulesController.toResponse`)에서
  allow-list(`id`/`name`/`workflowId`/`workflow.name`)로 좁히는 설계는 deny-list 보다
  안전한 방향이다 — 새 비밀 컬럼이 `Trigger` 엔티티에 추가돼도 이 경로는 자동으로 막는다
  (반대로 트리거 자신의 4경로는 여전히 deny-list 라 위 WARNING 이 남는다).
  `schedules.service.ts` 의 `saved.trigger` 대입을 `if (isActive)` 밖으로 옮긴 변경은
  응답 형태 일관성 버그 수정이며 보안 하위 이슈는 아니다.
- **인젝션**: 새/변경된 코드에 SQL·커맨드·경로 조작 문자열 조합 없음. e2e 테스트의
  `db.query('UPDATE integration SET ... WHERE id = $1', [id])` 류는 파라미터 바인딩을
  올바르게 사용.
- **인증/인가**: 이번 diff 는 가드·역할 검증 로직을 건드리지 않는다. 응답 형태만 좁히거나
  선언을 실제에 맞추는 변경이라 인가 우회 표면이 새로 생기지 않았다.
- **하드코딩 시크릿**: 실제 자격 증명·API 키·인증서 없음 (위 INFO 참조 — 전부 더미).
- **빌드 격리**: `src/shared/testing/**`·`src/repo-guards/**` 는 `tsconfig.build.json` 에서
  기존에 이미 프로덕션 빌드 제외 대상이다(이번 diff 가 처음 만든 예외 아님) — `contractForDto`
  같은 테스트 전용 유틸이 프로덕션 dist 로 섞여 나갈 위험 없음.
- **CHANGELOG 공개**: 유출 사실·영향 범위·권고 조치(secret 로그 점검, 회전 권고)를 투명하게
  기록했고, 실제 비밀번호·토큰 원문은 CHANGELOG 어디에도 없음.

## 요약

이 diff 는 트리거 회전 secret 이 4개 응답 경로(직접·조인)로 새고 있던 실제 취약점을
발견해 막는 보안 수정이며, 수정 자체는 견고하다 — 모든 유출 경로에 정화가 배선됐고,
unit·e2e 양쪽에서 실제 비밀 형태 fixture + 뮤테이션 검증으로 회귀를 고정했으며, DTO
선언 보정(24필드)은 wire 를 바꾸지 않는 문서화일 뿐이라 새 노출을 만들지 않는다.
인젝션·하드코딩 시크릿·인가 우회 등 이 diff 자체가 새로 만든 취약점은 발견되지 않았다.
남은 리스크는 두 가지 구조적 WARNING 이다 — (1) deny-list 기반 정화가 이번까지 세 번
같은 형태로 좁게 틀렸었고 다음 비밀 축이 추가될 때 네 번째가 재발할 수 있는 설계이며,
(2) `config.*` 열린 JSONB 맵은 계약 검증자·정적 가드 양쪽의 구조적 사각지대라 그 안의
신규 비밀 필드는 수기 e2e 에만 의존해 잡힌다. 둘 다 이번 PR 을 막을 사유는 아니고, 코드
자신이 이미 그 트레이드오프를 JSDoc 에 정직하게 기록해 두었다.

## 위험도

LOW
