# 보안(Security) 코드 리뷰

## 검토 범위

이번 diff 는 이전 라운드(`review/code/2026/09/14/18_17_44`)의 security **CRITICAL#1**
("`TriggersService.update()` 의 `save(trigger)` — 창 1 — 을 통해 `inboundSigningRef`
fail-open 이 재현 가능")에 대한 수정이다. 실제 코드 변경은
`codebase/backend/src/modules/triggers/triggers.service.ts`,
`chat-channel-binder.service.ts`, 신규 `trigger-config-lock.ts` 및 관련 테스트
(`trigger-config-lock.spec.ts`, `triggers.service.spec.ts`,
`triggers.web-chat.spec.ts`, `trigger-transaction-mock.ts`, e2e
`trigger-config-lost-update.e2e-spec.ts`)와 리포지토리 저장 래핑 가드
(`endpoint-path-conflict-wrap-guard.ts` 등)에 한정된다. `CHANGELOG.md`·
`plan/in-progress/*.md`·`review/code/2026/09/14/18_17_44/**` 는 문서/이전 리뷰
산출물이라 보안 스캔 대상이 아니다(내용은 컨텍스트로만 참고).

## 발견사항

- **[INFO]** 이전 라운드 CRITICAL#1(창 1 fail-open 재현 경로)이 이번 diff 로 닫힌 것을 확인
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts` — `update()` 함수 내
    `this.triggerRepository.manager.transaction(async (m) => { ... })` 블록(advisory lock
    획득 → `m.findOne(Trigger, { where: { id: trigger.id, workspaceId } })` 재읽기 →
    `previousInboundSigningRef` 재계산 → `mergeExternalConfig` → `m.save(Trigger, trigger)`)
  - 상세: 창 1(`save(trigger)`)이 이제 `chat-channel-binder.service.ts`/`rotateBotToken` 과
    동일한 `pg_advisory_xact_lock(hashtext('trigger-config:<id>'))` 안으로 들어갔고, 락을 잡은
    뒤 행을 다시 읽어 그 위에서 `previousInboundSigningRef`·`baseConfig` 를 재계산한다.
    `chatChannel` 을 싣지 않은 PATCH(이름 변경 등)도 같은 트랜잭션 경로를 타므로, 이전
    라운드가 지적한 "요청 시작 시점 스냅샷으로 전체를 덮어써 동시 확립된 서명 키를 되돌리는"
    경로가 더 이상 존재하지 않는다. 새로 추가된 `triggers.service.spec.ts` 의
    `'TriggersService — 락 안 재읽기가 동시 확립분을 본다 (lost update)'` suite 와
    `trigger-config-lost-update.e2e-spec.ts` 가 "재읽기 없이 스냅샷으로 병합" 뮤턴트를 실측으로
    죽이는 것도 확인했다(주석에 남긴 뮤테이션 실측 근거 — 재현하지 않고 서술만 검증). 새 결함이
    아니라 이전 CRITICAL 의 해소를 기록하는 항목이다.

- **[INFO]** `rewriteTriggerConfigLocked` 의 재읽기/쓰기가 `workspaceId` 로 스코핑되지 않음 — 기존 지적 유지, 이번 diff 로 변화 없음
  - 위치: `codebase/backend/src/modules/triggers/trigger-config-lock.ts` —
    `m.findOne(Trigger, { where: { id: triggerId } })`, `m.update(Trigger, { id: triggerId }, patch)`
  - 상세: 모든 호출부(`chat-channel-binder.service.ts` 성공/실패 경로,
    `triggers.service.ts::rotateBotToken`, 그리고 이번에 새로 추가된 `update()` 내부 인라인
    트랜잭션)는 이미 `findById(id, workspaceId)` 로 워크스페이스 소속을 검증한 뒤의
    `trigger.id` 만 넘기므로, 오늘 기준 크로스 테넌트 위험은 실제로 열려 있지 않다. 이전
    라운드 INFO 와 동일 — 이번 diff 가 새로 도입한 자리(`update()` 내부)도 같은 패턴(`m.findOne`
    호출에 `workspaceId` 를 직접 넣음, 단 이는 `rewriteTriggerConfigLocked` 헬퍼가 아니라
    `update()` 자체 인라인 트랜잭션이라 `id`+`workspaceId` 이중 스코핑이 적용돼 있다)이라 새
    노출면은 아니다. 다만 헬퍼 자체(`trigger-config-lock.ts`)는 여전히 `id` 단일 스코핑이라,
    향후 다른 호출부가 워크스페이스 검증 없이 임의 `triggerId` 를 넘기면 크로스 테넌트 쓰기가
    가능한 형태로 남아 있다.
  - 제안: 변경 불요(현재 안전). 이전 리뷰가 제안한 대로, 헬퍼에 선택적 `workspaceId` 파라미터를
    받아 `WHERE id = $1 AND workspace_id = $2` 로 방어적으로 좁히는 것을 다음 호출부 추가 시점에
    고려.

- **[INFO]** `chatChannelLastError` 에 provider 원문 에러 메시지가 그대로 저장됨 — 이번 diff 범위 밖, 기존 동작 유지
  - 위치: `codebase/backend/src/modules/triggers/chat-channel-binder.service.ts` —
    `chatChannelLastError: message.slice(0, 1024)` (성공/실패 두 `rewriteTriggerConfigLocked`
    호출의 `columns` 인자)
  - 상세: 이번 diff 가 새로 만든 문제가 아니며 락 도입과 무관하게 값 자체는 그대로 전달된다.
    이전 라운드에서 이미 참고용 INFO 로 남겨진 항목의 재확인.
  - 제안: 조치 불요(이미 범위 밖으로 명시됨).

- **[INFO]** e2e/unit 테스트의 `botToken`/`*Ref` 값은 실제 시크릿이 아닌 테스트 픽스처
  - 위치: `codebase/backend/test/trigger-config-lost-update.e2e-spec.ts`
    (`botToken: '111:e2eTelegramBotToken'`, `buildSecretRef(...)` 로 생성한
    `secret://triggers/...` ref), `triggers.service.spec.ts` (`BOT_TOKEN_REF`/`SIGNING_REF`
    리터럴)
  - 상세: 형태는 실제 시크릿과 유사하지만 값 자체가 하드코딩된 더미 문자열이고, 프로덕션
    자격증명·API 키가 아니다. `buildSecretRef` 는 참조 문자열을 만드는 프로덕션 유틸이라
    이 값이 실제 secret store 에 쓰이지도 않는다. 유출 위험 없음.
  - 제안: 조치 불요.

## SQL 인젝션 / 쿼리 안전성

`trigger-config-lock.ts` 와 e2e 스펙의 raw SQL(`SELECT pg_advisory_xact_lock(hashtext($1))`,
`UPDATE trigger SET config = $2::jsonb WHERE id = $1`)은 전부 파라미터 바인딩을 사용하며
문자열 concat 이 없다. `triggerConfigLockKey`(`` `trigger-config:${triggerId}` ``)의 결과가
바인딩 파라미터로만 전달되므로 `triggerId` 에 임의 값이 들어와도 SQL 구조에 영향을 줄 수 없다.

## 요약

이번 diff 는 이전 라운드가 지적한 security CRITICAL(창 1 을 통한 `inboundSigningRef`
fail-open 재현)을 `update()` 의 `save(trigger)` 경로를 같은 advisory-lock 트랜잭션 안으로
옮기고, 락 안에서 재읽은 행으로 `previousInboundSigningRef`/`baseConfig` 를 재계산하는 방식으로
닫는다. 새 unit suite 와 e2e 스펙이 "재읽기 없이 스냅샷 병합" 형태의 회귀를 뮤테이션 실측으로
잡아내도록 배선돼 있어, 이 수정이 다시 조용히 무력화되기 어렵다. 파라미터화된 쿼리, 하드코딩된
실제 시크릿 없음, 기존 `stripInlineAuthKeys`/`stripChatChannelPlaintext` 새니타이징 경로 보존을
확인했다. 남는 항목(헬퍼의 workspace 미스코핑, provider 에러 원문 저장)은 모두 이전 라운드에서
이미 검토·수용된 INFO 이며 이번 diff 로 새로 생기거나 악화되지 않았다. 신규 CRITICAL/WARNING
없음.

## 위험도

NONE
