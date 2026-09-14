# API 계약(API Contract) 리뷰

## 검토 범위

이번 라운드(20_17_16)는 직전 라운드(`19_44_08`)가 지적한 두 CRITICAL(삭제된 트리거의 `save` 부활,
hooks hot path 뮤턴트 측정 범위 협소)을 닫은 커밋 `369852b4f` 를 포함한다. 실제 런타임 코드 변경은
이번 커밋에서 다음에 국한된다.

- `codebase/backend/src/modules/triggers/triggers.service.ts` — `update()` 창 1에 `!fresh` →
  `NotFoundException({code:'RESOURCE_NOT_FOUND'})` 추가 (신규 에러 경로)
- `codebase/backend/src/modules/triggers/trigger-config-lock.ts` — JSDoc 정정만 (5줄, 서술 정확화)

나머지(`hooks.service.spec.ts`, `trigger-config-lock.spec.ts`, `triggers.service.spec.ts`,
`trigger-transaction-mock.ts`, `CHANGELOG.md`, `plan/**`, `review/**`)는 테스트·문서·리뷰 산출물이며
API 표면과 무관하다. **컨트롤러·DTO·라우트 정의·validation pipe·pagination 로직은 이번에도 일절
건드리지 않았다** — `git diff origin/main...HEAD --stat -- '**/*.controller.ts' '**/*.dto.ts'`
결과 0건.

이전 세 라운드(`18_17_44`·`19_07_43`·`19_44_08`)의 `api_contract.md` 는 각각 NONE 으로 종결했고,
그 안의 발견(락 재읽기 workspaceId 미스코프 INFO 등)은 이번 커밋으로 변경되지 않았다. 아래는 이번
커밋이 새로 만든 표면만 다룬다.

## 발견사항

- **[WARNING]** 같은 "트리거가 그 사이 삭제됨" 조건에 대해 형제 3개 쓰기 경로가 window 1 과 다르게 응답한다 — 삭제된 리소스에 대해 200 + 조작된 audit 로그
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts:1174-1201`
    (`rotateBotToken` — `await rewriteTriggerConfigLocked(...)` 반환값 미사용, 이어서
    무조건 `recordAudit(...TRIGGER_CHAT_CHANNEL_BOT_TOKEN_ROTATED...)` 및
    `return { rotatedAt, triggerId, chatChannelHealth: 'healthy', botIdentity }`),
    `codebase/backend/src/modules/triggers/chat-channel-binder.service.ts:266`,`:303`
    (`setupChatChannel` 성공/실패 경로 — 둘 다 반환값 무시)
  - 상세: 이번 커밋이 window 1(`triggers.service.ts:592-596`)에는 `!fresh` 조건에
    `NotFoundException({code:'RESOURCE_NOT_FOUND', message:'Trigger not found'})` 를 새로
    추가해, `PATCH /api/triggers/:id` 가 `chatChannel` 을 안 실은 요청이 삭제-경합에 걸리면
    이제 404 를 정확히 돌려준다(회귀 테스트: `triggers.service.spec.ts:3799-3812`,
    `code: 'RESOURCE_NOT_FOUND'` 로 기존 `findById()` 404 계약과 동일 형태). 반면 같은 조건이
    `rewriteTriggerConfigLocked` 를 거치는 형제 3경로(`chatChannel` 을 실은
    `PATCH`/`POST` 의 setup 성공·실패 경로, `rotateBotToken`)에서는 `false` 가 돌아와도
    아무도 관측하지 않는다. `rotateBotToken` 은 그 뒤로도 그대로 진행해 (a) 감사 로그에
    `TRIGGER_CHAT_CHANNEL_BOT_TOKEN_ROTATED` 를 **실제로 아무 것도 쓰이지 않았는데도** 남기고,
    (b) HTTP 200 과 함께 `chatChannelHealth: 'healthy'` 를 포함한 "성공" 바디를 반환한다 —
    그 트리거는 이미 삭제된 상태다. `setupChatChannel` 의 두 경로도 같은 이유로 응답을 구성하는
    `create()`/`update()` 쪽 재조회(`triggerRepository.findOne`)가 `null` 을 받아도
    `if (refreshed) result = refreshed;` 로 넘어가 pre-race in-memory 스냅샷을 그대로 응답에
    싣는다. 즉 **같은 PR, 같은 근본 원인(삭제-경합)에 대해 한쪽 엔드포인트-경로는 404 로
    정직하게 실패하고, 다른 세 경로는 200 + 거짓 성공 payload + 거짓 audit 항목을 낸다.**
    이 비대칭은 이번 커밋이 window 1 만 닫으면서 새로 두드러졌다 — 수정 전에는 네 창이 모두
    같은 방식(무조건 진행)이었다. `plan/in-progress/trigger-config-lost-update.md:393`
    이 "반환값을 세 호출부가 무시" 를 후속 항목으로 이미 追跡하고 있지만, 그 서술은 관측성
    공백으로만 적혀 있고 **이번 커밋이 만든 "형제 경로와의 에러 응답 불일치"·"삭제된 리소스에
    성공 payload 반환" 이라는 API-계약 성격의 구체적 결과는 담고 있지 않다.
  - 제안: 셋 중 최소 한 곳(가장 현실적인 `rotateBotToken`)이라도 반환값을 확인해 `false` 면
    `recordAudit` 를 건너뛰고 404(같은 `RESOURCE_NOT_FOUND` 형태)를 던지도록 맞추면, 같은
    PR 안에서 "삭제 경합"이라는 하나의 조건이 API 표면에서 하나의 일관된 응답(404)으로 보인다.
    지금 배치를 막을 사유는 아니지만(극히 좁은 경합 창, 데이터 손상 없음), 이미 트래커에 있는
    항목의 우선순위를 "관측성 개선"에서 "형제 엔드포인트와의 에러 응답 일관성"으로 올려 적어
    두는 것을 권고.

- **[INFO]** `NotFoundException` 형태는 기존 `findById()` 404 계약과 정확히 일치 — 확인 완료
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts:352-357`(`findById`)
    vs `:592-596`(신규 창 1 재확인)
  - 상세: 두 자리 모두 `NotFoundException({ code: 'RESOURCE_NOT_FOUND', message: 'Trigger not found' })`
    로 동일하다. `rethrowEndpointPathConflict`(`:1402-1427`)는 `endpointPath` UNIQUE 충돌만
    `ConflictException` 으로 변환하고 그 외 에러는 `throw err` 로 그대로 전파하므로
    (`:1426`), 새 `NotFoundException` 은 왜곡 없이 그대로 HTTP 404 로 나간다. 응답 스키마·
    상태 코드 신규 위반 없음.
  - 제안: 없음.

- **[INFO]** CHANGELOG 의 일반화된 서술("행이 그 사이 삭제됐으면 쓰지 않는다")이 window 1 의
  실제 동작(무행위가 아니라 에러 발생)과 형제 3창의 동작(무행위, 무에러)을 구분하지 않는다
  - 위치: `CHANGELOG.md:14-15`
  - 상세: 이 문장은 "네 자리 전부"를 한 문장으로 묶어 "쓰지 않는다"고만 적는다. 실제로는
    window 1 은 쓰지 않는 대신 **404 를 던지는** 반면, 나머지 세 곳은 조용히 쓰지 않고
    호출자에게는 아무 신호도 주지 않는다(위 WARNING 참조). 독자가 이 문장만 보면 네 경로가
    API 관점에서 동일하게 반응한다고 오해할 수 있다.
  - 제안: 위 WARNING 을 해소하며 함께 정정하거나, 최소한 "창 1 은 404 로 드러나고 나머지
    셋은 조용히 skip 한다"로 한 줄 분리.

## 요약

이번 라운드의 유일한 런타임 변경은 `PATCH /api/triggers/:id` 의 "창 1"(chatChannel 을 안 실은
PATCH)이 락 안 재읽기에서 트리거 소멸을 감지하면 기존 `findById()` 와 동일한 형태
(`code: 'RESOURCE_NOT_FOUND'`)의 404 를 던지도록 한 것이다 — 응답 스키마·에러 봉투 형식·
UNIQUE 충돌 변환 경로는 그대로이고 회귀 테스트로 고정됐다. 컨트롤러·DTO·라우트·validation
pipe·pagination 은 여전히 미변경이라 하위 호환성·버전 관리·URL 설계 관점은 해당 없음이다.
다만 이 수정이 같은 삭제-경합 조건에 대해 **형제 3개 쓰기 경로(chatChannel setup 성공/실패,
rotateBotToken)와 다르게 반응하는 비대칭을 새로 만들었다** — 그 세 경로는 여전히 반환값을
무시하고 진행해, 삭제된 트리거에 대해 200 + 조작된 audit 항목 + 거짓 성공 payload 를 낸다.
데이터 손상은 없고 경합 창도 매우 좁아 이번 배치를 막을 사유는 아니지만, "에러 응답 일관성"
관점에서 실제로 관찰 가능한 결함이라 WARNING 으로 기록한다. plan 이 이미 "반환값 미관측"을
추적 중이므로 신규 트래킹 항목을 만들 필요는 없고, 그 항목의 서술에 이 API-표면 비대칭을
추가하는 것으로 충분하다.

## 위험도

LOW
