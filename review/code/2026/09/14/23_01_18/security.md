# 보안(Security) Review — trigger-config lost-update 수정 (2026-09-14 23:01 라운드)

## 검토 범위

이 라운드의 diff 는 `CHANGELOG.md` 갱신, `hooks.service.ts`/`hooks.service.spec.ts` 의
`touchLastTriggeredAt` 공용화 + 회귀 테스트, `schedules.service.ts`/`schedules.service.spec.ts`
의 컬럼 한정 `update`, `chat-channel-input-rules.ts` 의 `extractInboundSigningRef` 추출,
정적 가드(`endpoint-path-conflict-wrap-guard.ts`/`.spec.ts`/fixture) 의 `manager.save(Trigger, …)`
형태 인식 확장으로 구성된다. 이전 라운드들(`18_17_44` ~ `22_24_35`)이 이미 핵심 결함
(동시 PATCH/웹훅 인입이 `trigger.config` 를 스냅샷으로 통째로 되써 `chatChannel.inboundSigningRef`
를 유실시키고 인입 서명 검증이 fail-open 되는 CRITICAL)을 advisory lock + 락 안 재읽기로
닫아 온 시리즈의 마지막 정리 라운드다.

실제 프로덕션 소스(`trigger-config-lock.ts`, `triggers.service.ts`, `chat-channel-binder.service.ts`,
`hooks.service.ts`, `schedules.service.ts`)를 프롬프트 diff 가 아니라 `Read` 로 직접 열어
전문 대조했다 — 프롬프트가 파일 6·7·10~13 등 다수의 diff 를 크기 제한으로 생략했기 때문이다.

## 발견사항

- **[INFO]** `SET LOCAL lock_timeout` 이 파라미터 바인딩 없이 문자열 보간으로 구성된다 (기존 라운드에서 이미 지적·수용, 이번에도 변화 없음을 재확인)
  - 위치: `codebase/backend/src/modules/triggers/trigger-config-lock.ts:56-58`
    (`` `SET LOCAL lock_timeout = '${Math.trunc(options.timeoutMs)}ms'` ``)
  - 상세: Postgres `SET LOCAL` 은 플레이스홀더 바인딩을 지원하지 않아 값을 문자열에 직접
    넣는다. `Math.trunc()` 를 거치므로 결과는 항상 숫자 리터럴 또는 `NaN`/`Infinity` 문자열뿐이라
    따옴표·세미콜론 등 메타문자가 섞일 수 없고, 호출부(`triggers.service.ts:1026-1028`)는
    모듈 상수 `TRIGGER_DELETE_LOCK_TIMEOUT_MS = 5_000` 만 넘긴다 — 사용자 입력이 이 경로에
    닿는 지점은 현재 없다(`grep` 으로 `acquireTriggerConfigLock` 의 모든 호출부를 확인, 결과 2곳
    모두 상수 아니면 인자 생략).
  - 제안: 조치 불요(실측상 인젝션 불가능). 향후 timeout 값이 사용자 입력에서 파생되게
    확장될 경우를 대비해 `SELECT set_config('lock_timeout', $1, true)` 형태로 바꾸면
    "값이 항상 숫자를 거친다" 는 불변식에 기대지 않고도 구조적으로 안전해진다.

- **[INFO]** advisory lock 대기에 상한이 없어 같은 트리거를 향한 동시 요청이 서로를 무한정 블로킹할 수 있다 (삭제 경로 제외, 기존에 문서화·수용된 트레이드오프)
  - 위치: `trigger-config-lock.ts:107-117` (`rewriteTriggerConfigLocked` JSDoc), `triggers.service.ts:622`
    (`update()` 창 1의 `acquireTriggerConfigLock(m, trigger.id)` — timeoutMs 없음)
  - 상세: 임계 구간이 "재읽기 + 머지 + UPDATE" 로 짧게 유계라는 설계 근거(외부 HTTP 호출을
    락 밖으로 뺌)가 있어 실제 보유 시간은 작지만, 그 전제가 깨지는 후속 변경(임계 구간에
    느린 연산·외부 호출 추가)이 생기면 같은 트리거를 다루는 요청들이 연쇄적으로 느려지는
    self-DoS 표면이 된다. 영향 범위는 그 트리거가 속한 워크스페이스로 이미 인가된 요청자에
    한정된다(`findById`/`findByIdForUpdate` 가 `workspaceId` 로 먼저 필터링).
  - 제안: 조치 불요(설계 근거 명시, 트래킹됨). 임계 구간에 외부 호출/긴 연산이 추가되는
    후속 변경에서는 `lock_timeout` 을 함께 넣을 것.

- **[INFO]** `rewriteTriggerConfigLocked` 의 락 안 재조회가 `workspaceId` 로 필터링하지 않는다 — cross-tenant 노출은 없음 (확인 완료)
  - 위치: `trigger-config-lock.ts:151` (`m.findOne(Trigger, { where: { id: triggerId } })`)
  - 상세: 이 함수를 부르는 모든 호출부(`chat-channel-binder.service.ts:266,310`,
    `triggers.service.ts:864`(`normalizeNotificationSecretRef`), `:1142`(`revokePerTriggerToken`),
    `:1306`(`rotateBotToken`))는 직전에 `findById(id, workspaceId)` 로 해당 트리거가 요청자의
    워크스페이스 소유임을 이미 검증한 `trigger.id` 를 그대로 넘긴다 — 재조회는 이미 인가된
    그 한 행을 다시 읽는 것일 뿐, 별도의 접근 통제 우회 경로를 만들지 않는다. `update()` 창 1의
    재조회(`triggers.service.ts:629-632`)는 `workspaceId` 를 함께 걸어 더 방어적이다.
  - 제안: 조치 불요. 이 유틸이 향후 다른 엔티티로 제네릭화될 때(아키텍처 리뷰가 이미 제안),
    그 엔티티가 워크스페이스 스코프를 가지면 `where` 에 `workspaceId` 를 추가하는 편이
    "재조회는 항상 스코프를 명시한다" 불변식을 일관되게 지킨다.

## 확인한 긍정적 사항 (참고)

- **fail-open 취약점 자체가 실제로 닫혔다.** `chat-channel-binder.service.ts:209-211`
  (`survivesWithFresh`)이 요청 시작 시점 게이트와 락 안에서 재읽은 행의 ref presence 를
  OR 로 합쳐, 동시 PATCH 가 그 사이 ref 를 처음 확립하는 경우도 놓치지 않는다. `update()` 의
  "창 1"도 이번 라운드까지 포함해 최종적으로 같은 락(`acquireTriggerConfigLock`) 안에서
  재읽기 후 병합하도록 닫혀 있다 — `18_17_44` 라운드가 지적한 CRITICAL(창 1 미해결)이
  후속 라운드에서 해소된 상태를 코드에서 직접 확인했다.
- **인입 hot path**(`hooks.service.ts` `handleWebhook`/`handleChatChannelWebhook` →
  `touchLastTriggeredAt`)가 `save(trigger)` 대신 컬럼 한정 `update({id}, {lastTriggeredAt})`
  로 통일돼 있고, 이번 라운드가 그 회귀 테스트를 두 호출부(webhook 성공 경로, chat-channel
  경로) 모두에 대칭으로 갖췄다(`patches` 배열의 키를 `['lastTriggeredAt']` 로 단언).
- **`schedules.service.ts` 의 trigger 동기화**(`name`/`isActive`)도 `save(trigger)` 대신
  `Partial<Pick<Trigger, 'name'|'isActive'>>` 컬럼 한정 `update` 로 바뀌어 같은 결함 클래스가
  재발할 표면이 없다. `config` 를 건드리지 않으므로 락도 필요 없다 — 스코프가 정확하다.
- **secret 자체는 config 에 실리지 않는다.** `inboundSigningRef`/`botTokenRef` 는 secret
  store 참조 문자열일 뿐이고, `extractInboundSigningRef`(신규, `chat-channel-input-rules.ts:247-250`)
  도 이 참조 문자열만 꺼낸다 — 평문 secret 은 기존 `stripChatChannelPlaintext`/
  `assertPatchCarriesNoSecrets` 경계가 그대로 지킨다.
- **advisory lock 키 생성**은 파라미터 바인딩을 쓴다(`pg_advisory_xact_lock(hashtext($1))`,
  `trigger-config-lock.ts:60-62`) — SQL 인젝션 경로 없음. e2e 테스트의 raw 쿼리도 전부
  `$1`/`$2` 파라미터 바인딩이다.
- **하드코딩된 시크릿·API 키·자격증명 없음.** e2e 테스트의 `'111:e2eTelegramBotToken'` 은
  Telegram 봇 토큰 형식(`<id>:<token>`)을 흉내 낸 합성 테스트 픽스처이며 실 자격증명이 아니다.
- **인가 검증 누락 없음.** 이번 라운드가 건드린 모든 쓰기 경로(`update`/`remove`/
  `rotateBotToken`/`revokePerTriggerToken`/`rotateNotificationSecret`/schedules `update`)는
  전부 `findById(id, workspaceId)` 로 워크스페이스 소유를 먼저 검증한 뒤에만 `trigger.id` 를
  후속 함수로 넘긴다.
- **정적 가드 변경**(`endpoint-path-conflict-wrap-guard.ts` 의 `manager.save(Trigger, …)`
  형태 인식, `TRIGGER_ENTITY` 상수)은 CI 전용 AST 스캔 로직이라 런타임 보안 표면과 무관하다.
  다만 그 가드가 지키는 불변식(모든 `Trigger` 저장 자리가 `endpointPath` UNIQUE 충돌을
  적절히 처리하거나 목록에 등재됨)은 간접적으로 가용성/데이터 무결성에 기여한다.

## 요약

이번 라운드는 `trigger.config` lost-update → 인입 웹훅 서명 검증 fail-open 이라는 실재
CRITICAL 취약점을 닫는 시리즈의 마무리로, PATCH 창 1(`update()`)·chat-channel 성공/실패
경로·`rotateBotToken`·삭제(`remove()`)·notification/interaction 토큰 회전·승격 cron 까지
`config` 를 다시 쓰는 모든 자리가 advisory lock(`pg_advisory_xact_lock`) + 락 안 재읽기 또는
컬럼 한정 `update` 로 전환됐음을 소스에서 직접 확인했다. 이번 라운드 자체의 diff(hooks 회귀
테스트 대칭화, schedules 컬럼 한정 update, `extractInboundSigningRef` 추출, 정적 가드
확장)는 신규 인젝션·인가 우회·시크릿 노출·암호화 약화를 만들지 않으며, 오히려 마지막 남은
비대칭(chat-channel 인입 경로에만 회귀 테스트가 있고 webhook 경로엔 없던 것)을 닫아 방어를
강화한다. 남은 세 항목(lock_timeout 문자열 보간, 무제한 락 대기, 재읽기 조회의 workspaceId
미필터)은 모두 여러 라운드에 걸쳐 반복 검증된 INFO 수준이며, 실측상 착취 불가능하거나
이미 인가된 요청자 범위로 한정된다. 이번 배치를 막을 CRITICAL/WARNING 급 보안 이슈는
발견되지 않았다.

## 위험도

LOW
