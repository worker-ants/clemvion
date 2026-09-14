# 보안(Security) Review — trigger-config lost-update 수정

## 검토 범위

이번 변경의 핵심은 `trigger.config` JSONB 컬럼에 대한 동시 쓰기(lost update)가 인입 웹훅
서명 검증(`ChatChannelInboundAuthenticator`)을 fail-open 으로 되돌리던 취약점을 닫는
것이다. 신규 유틸 `trigger-config-lock.ts`(advisory lock + 락 안 재읽기)와 그 위에 얹힌
세 쓰기 지점(`TriggersService.update()` 창 1, `ChatChannelBinderService.setupChatChannel`
성공/실패 경로, `TriggersService.rotateBotToken`), 삭제 경로(`remove()`)의 락 동반, 그리고
`hooks.service.ts` 인입 hot path 의 `save()` → 컬럼 한정 `update()` 전환을 실제 소스
(`Read`)로 직접 대조해 확인했다. 나머지 리뷰 산출물(`review/**`)·plan 문서는 코드가
아니므로 검토 대상에서 제외했다.

## 발견사항

- **[INFO]** `SET LOCAL lock_timeout` 이 파라미터 바인딩 없이 문자열 보간으로 구성된다
  - 위치: `codebase/backend/src/modules/triggers/trigger-config-lock.ts:56-58`
    (`acquireTriggerConfigLock` — `` `SET LOCAL lock_timeout = '${Math.trunc(options.timeoutMs)}ms'` ``)
  - 상세: Postgres 의 `SET LOCAL` 문법은 플레이스홀더(`$1`) 바인딩을 지원하지 않아 값을
    문자열에 직접 넣어야 하는데, 이 자리는 `manager.query()` 로 raw SQL 을 실행하면서 그
    값을 템플릿 리터럴로 보간한다. 실제로는 안전하다 — 인자가 `Math.trunc()` 를 거치므로
    결과는 항상 유효한 숫자 리터럴(`5000`) 또는 `NaN`/`Infinity` 문자열이 될 뿐, 따옴표·
    세미콜론 등 SQL 메타문자가 섞일 수 없다. 게다가 호출부 두 곳(`triggers.service.ts:980`)
    모두 사용자 입력이 아니라 모듈 상수(`TRIGGER_DELETE_LOCK_TIMEOUT_MS = 5_000`)만 넘긴다
    — 이 경로에 사용자 입력이 닿는 지점은 현재 코드베이스에 없다. 코드 주석도 이 근거를
    명시하고 있어 인지된 트레이드오프다.
  - 제안: 지금 당장 조치할 필요는 없다(실측상 인젝션 불가능). 다만 향후 이 함수가 사용자
    입력으로부터 파생된 timeout 값을 받게 확장될 경우를 대비해, `SET LOCAL lock_timeout = '…'`
    대신 `SELECT set_config('lock_timeout', $1, true)` 형태로 바꾸면 파라미터 바인딩을 쓸 수
    있어 "값이 항상 숫자를 거친다" 는 불변식에 기대지 않고도 안전을 구조적으로 보장할 수
    있다. 방어적 리팩터 제안 수준.

- **[INFO]** advisory lock 대기에 상한이 없어 같은 트리거를 향한 동시 요청이 서로를
  무한정 블로킹할 수 있다 (delete 제외)
  - 위치: `codebase/backend/src/modules/triggers/trigger-config-lock.ts:107-117`
    (`rewriteTriggerConfigLocked` JSDoc "대기에 상한이 없다"), `triggers.service.ts:590`
    (`update()` 창 1 의 `acquireTriggerConfigLock(m, trigger.id)` — timeoutMs 없음)
  - 상세: 같은 `trigger.id` 에 대한 PATCH/rotate 를 동시에 여러 번 보내면 뒤의 요청들은
    앞선 트랜잭션이 커밋할 때까지 DB 커넥션을 쥔 채 대기한다. 임계 구간이 "재읽기 + 머지
    + UPDATE" 로 짧게 유계라는 설계 근거(외부 HTTP 호출을 락 밖으로 뺌)가 있어 실제
    보유 시간은 작지만, 그 전제가 깨지는 변경(임계 구간에 느린 연산·외부 호출 추가)이
    생기면 같은 트리거를 다루는 요청들이 연쇄적으로 느려지는 self-DoS 표면이 된다. 영향
    범위는 **그 트리거가 속한 워크스페이스로 이미 인가된 요청자**에 한정되고(`findById`
    가 `workspaceId` 로 먼저 필터링하므로 cross-tenant 접근은 없음), DB 커넥션 풀 고갈을
    통해 다른 워크스페이스 요청에도 간접 영향을 줄 잠재력은 있다. 이미
    `review/code/2026/09/14/18_17_44/concurrency.md`(WARNING#3)·`database.md` 에서 별도
    관점으로 지적·수용된 항목이라 신규 발견은 아니지만, 보안(가용성) 관점에서도 같은
    결론(현재 설계 전제 하에서는 수용 가능, 전제가 깨지면 재검토 필요)임을 재확인한다.
  - 제안: 조치 불요(설계 근거가 명시돼 있고 이미 트래킹됨). 임계 구간에 외부 호출/긴 연산이
    추가되는 후속 변경에서는 반드시 `lock_timeout` 을 함께 넣을 것 — JSDoc 이 이미 이
    조건을 명시하고 있으므로 그 규율을 지키는지만 후속 리뷰에서 확인하면 된다.

- **[INFO]** advisory lock 안에서 재읽는 조회(`rewriteTriggerConfigLocked`)가 `workspaceId`
  로 필터링하지 않는다 — 그러나 cross-tenant 노출은 없음 (확인 완료, 참고용 기록)
  - 위치: `codebase/backend/src/modules/triggers/trigger-config-lock.ts:151`
    (`m.findOne(Trigger, { where: { id: triggerId } })`)
  - 상세: 이 재조회는 PK(`triggerId`) 단독으로 필터링한다. 다만 이 함수를 부르는 세 호출부
    (`chat-channel-binder.service.ts:266,310`, `triggers.service.ts:1236`) 는 모두 그
    직전에 `findById(id, workspaceId)` 로 이미 해당 트리거가 요청자의 워크스페이스 소유임을
    검증한 **같은 `triggerId`** 를 넘긴다 — 재조회는 이미 인가된 그 한 행을 다시 읽는
    것일 뿐, 별도의 접근 통제 우회 경로를 만들지 않는다. `update()` 창 1 의 재조회
    (`triggers.service.ts:597-600`)는 `workspaceId` 를 함께 건다는 점에서 더 방어적이지만,
    두 경로 모두 실질적인 인가 결함은 아니다.
  - 제안: 조치 불요. 다만 이 유틸이 향후(아키텍처 리뷰가 이미 제안한 대로) `Trigger` 이외
    엔티티로 제네릭화될 때, 그 엔티티가 워크스페이스 스코프를 갖는다면 `where` 절에
    `workspaceId` 를 추가하는 편이 "재조회는 항상 스코프를 명시한다" 는 불변식을 일관되게
    지킬 수 있어 더 안전하다.

## 확인한 긍정적 사항 (참고)

- **fail-open 취약점 자체는 실제로 닫혔다.** `chat-channel-binder.service.ts:209-211`
  (`survivesWithFresh`)이 요청 시작 시점 게이트(`inboundSigningRefSurvives`)와 락 안에서
  재읽은 행의 ref presence(`extractInboundSigningRef(freshConfig)`)를 OR 로 합쳐, 동시
  PATCH 가 그 사이 ref 를 처음 확립하는 경우도 놓치지 않는다. 성공 경로(`:266`)·실패
  경로(`:310`) 둘 다 이 게이트를 통과해 `buildChannel` 을 호출한다.
- **advisory lock 키 생성**(`triggerConfigLockKey` → `hashtext($1)`)은 파라미터 바인딩을
  쓴다 — SQL 인젝션 경로 없음 (`trigger-config-lock.ts:60-62`).
- **인입 hot path**(`hooks.service.ts:227,686` → `touchLastTriggeredAt:973`)가 `save(trigger)`
  대신 컬럼 한정 `update({id}, {lastTriggeredAt})` 로 바뀌어, 웹훅 요청마다
  `chatChannel.inboundSigningRef` 를 되돌릴 수 있던 훨씬 잦은 경로(PATCH 경합보다 빈번)가
  구조적으로 제거됐다. `hooks.service.spec.ts` 의 신규 테스트 두 개가 `update` 의 patch
  객체 키를 `['lastTriggeredAt']` 로 정확히 단언해, "config 가 다시 섞여 들어오면" 재발을
  잡는다.
- **secret 자체는 config 에 실리지 않는다.** `inboundSigningRef`/`botTokenRef` 는 secret
  store 를 가리키는 참조 문자열일 뿐이고, `extractInboundSigningRef`(신규,
  `chat-channel-input-rules.ts:247-250`)도 이 참조 문자열만 꺼낸다 — 평문 secret 은
  기존 `stripChatChannelPlaintext`/`assertPatchCarriesNoSecrets` 경계가 그대로 지킨다(이
  PR 이 그 경계를 건드리지 않음).
- **외부 HTTP 호출(`adapter.setupChannel`)이 advisory lock/트랜잭션 밖에 있다** — 이
  저장소의 기각된 선례(Cafe24 advisory lock, 트랜잭션 안에 HTTP 를 묶어 커넥션 점유가
  늘어난 사례)를 정확히 피해, 외부 provider 지연이 DB 락 보유 시간으로 전이되지 않는다.
- **신규 의존성 없음** — `package.json`/lockfile 변경 0건, 전량 기존 `typeorm` API 재사용.
- **하드코딩된 시크릿·API 키·자격증명 없음** — 신규/변경 코드(`trigger-config-lock.ts`,
  `chat-channel-binder.service.ts`, `triggers.service.ts`, `hooks.service.ts`, 테스트
  파일들) 전체에서 하드코딩된 비밀·토큰·연결 문자열을 찾지 못했다.

## 요약

이번 변경은 실재했던 보안 결함 — 동시 PATCH/웹훅 인입이 `trigger.config` 를 스냅샷으로
통째로 되써 `chatChannel.inboundSigningRef` 를 유실시키고, 그 결과 인입 웹훅 서명 검증이
`if (!config.inboundSigningRef) return;` 경로로 fail-open 되던 문제 — 를 advisory lock +
락 안 재읽기 패턴으로 구조적으로 닫는다. 네 쓰기 지점(PATCH 창 1, chat-channel 성공/실패
경로, bot token 회전) 모두 같은 패턴을 공유하도록 배선됐고, presence 게이트가 재읽은 행
기준으로 재계산되도록 정정돼 있음을 소스에서 직접 확인했다. 삭제 경로도 같은 락을 공유해
"읽었을 땐 있었는데 저장 직전에 삭제되는" 경합을 막고, 삭제만 5초 상한을 둬 되돌릴 수 없는
정리(teardown) 뒤 무한 대기로 자원이 반쯤 삭제된 상태로 굳는 것을 막는다. advisory lock
키 생성은 파라미터 바인딩을 쓰고, 유일하게 문자열 보간을 쓰는 `lock_timeout` 설정은
`Math.trunc()` 로 숫자 강제 변환을 거쳐 실질적 인젝션 경로가 없으며 호출부도 모듈 상수만
넘긴다. 신규 하드코딩 시크릿·신규 외부 의존성·인증/인가 우회·새로운 인젝션 표면은 발견되지
않았다. 남은 항목(lock_timeout 문자열 보간의 방어적 리팩터 여지, 삭제 외 경로의 무제한
대기, 재읽기 조회의 workspaceId 미필터)은 모두 실질적 위험이 낮거나 이미 다른 관점의
리뷰에서 지적·수용된 트레이드오프이며, 이번 배치를 막을 사유가 아니다.

## 위험도

LOW
