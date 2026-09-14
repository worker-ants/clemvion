# Security Review — trigger-config lost-update (advisory lock 도입)

## 검토 범위

`trigger.config` 동시 PATCH lost-update(웹훅 인입 서명 검증 fail-open) 수정 — 신규
`trigger-config-lock.ts`(advisory lock + 락 안 재읽기) 및 그 호출부
(`triggers.service.ts`, `chat-channel-binder.service.ts`, `hooks.service.ts`,
`schedules.service.ts`, `chat-channel-input-rules.ts`) 전체를 실제 소스 파일을 직접 `Read` 하여
diff 조각이 아닌 전체 컨텍스트로 확인했다. 나머지 변경 파일(`*.spec.ts`, e2e, repo-guard 정적
분석 스크립트, `plan/`·`review/**` 산출물)은 테스트/도구/문서로 런타임 보안 표면이 아니다.

이 PR 이 고치는 결함 자체가 보안 결함이다: 동시 `PATCH /api/triggers/:id` (또는 웹훅 인입 hot
path·bot token 회전)가 `trigger.config` 를 요청 시작 시점 스냅샷으로 통째로 되쓰면서
`chatChannel.inboundSigningRef` 를 지우고, `ChatChannelInboundAuthenticator` 의
`if (!config.inboundSigningRef) return;` 가 걸려 **서명 검증이 fail-open** 된다. 수정은
트리거 단위 `pg_advisory_xact_lock` + "락 안 재읽기·머지·컬럼 한정 쓰기" 로 이를 닫는다.

## 발견사항

- **[INFO]** `rewriteTriggerConfigLocked` 의 락 안 재읽기가 `workspaceId` 로 스코프되지 않는다
  - 위치: `codebase/backend/src/modules/triggers/trigger-config-lock.ts` — `rewriteTriggerConfigLocked` 함수, `m.findOne(Trigger, { where: { id: triggerId } })` (139번째 줄 부근, `patch` 조립 직전)
  - 상세: 이 함수는 `id` 단일 조건으로만 트리거를 재조회한다. 실제로 이 함수를 호출하는 4곳
    (`triggers.service.ts` 의 `normalizeNotificationSecretRef`·`revokePerTriggerToken`·
    `rotateBotToken`·`promoteRotatedNotificationSecrets`, 그리고 `chat-channel-binder.service.ts`
    의 `setupChatChannel` 성공/실패 경로)은 전부 이 함수를 부르기 **전에** 이미
    `findById(id, workspaceId)` 로 트리거 소유권(워크스페이스 귀속)을 확정한 뒤이므로, 현재
    코드 경로에서 다른 워크스페이스 행을 노출하는 인가 우회는 없다. 다만 헬퍼 자체의 시그니처는
    `workspaceId` 를 받지 않아 이 전제를 타입/코드로 강제하지 않는다 — 다음 사람이 이 헬퍼를
    "소유권을 아직 검증하지 않은" 새 호출부(예: 내부 배치 작업, 다른 리소스 재사용)에 그대로
    가져다 쓰면 조용히 크로스-워크스페이스 재작성이 열릴 수 있는 설계다. `triggers.service.ts`
    의 "창 1"(`update()`)의 락 안 재읽기는 대조적으로 `where: { id: trigger.id, workspaceId }`
    로 명시적으로 스코프한다 — 같은 PR 안에 두 가지 스코핑 정책이 공존한다.
  - 제안: 차단 사유는 아니다. `rewriteTriggerConfigLocked` 의 JSDoc(또는 시그니처)에 "호출부가
    triggerId 소유권을 사전에 검증했음을 전제한다(워크스페이스 필터 없음)" 를 명시하거나,
    선택적 `workspaceId` 파라미터를 받아 `where` 에 포함시키는 편이 다음 재사용자의 실수를
    구조적으로 막는다.

- **[INFO]** `SET LOCAL lock_timeout` 이 파라미터 바인딩 없이 문자열 보간으로 SQL 에 들어간다
  - 위치: `codebase/backend/src/modules/triggers/trigger-config-lock.ts` — `acquireTriggerConfigLock` 함수, `` `SET LOCAL lock_timeout = '${Math.trunc(options.timeoutMs)}ms'` `` (56번째 줄 부근)
  - 상세: Postgres 의 `SET LOCAL` 구문은 파라미터 바인딩(`$1`)을 지원하지 않으므로 문자열
    보간이 불가피하다는 코드 내 설명 자체는 맞다. 현재는 (a) `Math.trunc()` 가 인자를 숫자로
    강제 변환해 비-숫자 입력(예: SQL 페이로드가 든 문자열)을 `NaN` 으로 무력화하고 (b) 실제
    호출부(`triggers.service.ts:1027-1029`, `remove()`)가 넘기는 값이 모듈 상수
    `TRIGGER_DELETE_LOCK_TIMEOUT_MS = 5_000` 하나뿐이라(grep 으로 전수 확인, 사용자 입력이
    닿는 경로 없음) 인젝션으로 이어지지 않는다. 다만 이 방어는 "지금의 유일한 호출부가
    상수만 넘긴다" 는 **호출 규율**에 의존하고 있어, 향후 다른 호출부가 `timeoutMs` 를
    사용자·설정값에서 파생시키면(타입은 `number` 하나만 요구하므로 컴파일러가 이를 막지
    않는다) 같은 함수가 인젝션 표면이 될 수 있다.
  - 제안: 차단 사유는 아니다. 여유가 있으면 `Number.isFinite(options.timeoutMs)` 가드를
    추가해 `NaN`/`Infinity` 입력 시 명시적으로 던지게 하면(현재는 Postgres 가 구문 오류로
    거부하긴 하지만) 의도를 코드로 못박아 향후 호출부 확장 시 실수를 조기에 드러낼 수 있다.

## 관점별 확인 (문제 없음 확인)

- **SQL 인젝션**: 위 `lock_timeout` 한 곳을 제외한 모든 raw SQL(`pg_advisory_xact_lock(hashtext($1))`,
  e2e 의 `SELECT`/`UPDATE ... WHERE id = $1`)이 파라미터 바인딩을 쓴다. `triggerConfigLockKey(triggerId)`
  결과값도 문자열이 아니라 **바인드 파라미터**로 전달되므로(`trigger-config-lock.ts`,
  `trigger-config-lost-update.e2e-spec.ts:160-162`), `triggerId` 자체가 임의 문자열이어도
  쿼리 구조를 바꿀 수 없다.
- **하드코딩된 시크릿**: 없음. 신규/변경 코드가 다루는 토큰은 전부
  `randomBytes(32).toString('hex')` 기반(`wsk_*`, `itk_*`, `triggers.service.ts:1082, 1135`)이거나
  `SecretResolverService` 를 통해 secret store 에 저장되는 값이다. e2e 테스트의
  `'111:e2eTelegramBotToken'`(`trigger-config-lost-update.e2e-spec.ts:146`)은 테스트 전용
  fixture 값으로 실제 자격증명이 아니다.
- **인증/인가**: 컨트롤러·DTO·라우트·인증 미들웨어는 이 PR 에서 변경되지 않았다(라우트 스캔
  결과 0건). `assertAuthConfigInWorkspace`·`findById(id, workspaceId)` 등 기존
  cross-workspace 차단 로직도 그대로 유지된다. 위 INFO#1 을 제외하면 신규 인가 우회는
  발견되지 않았다.
- **입력 검증**: `chat-channel-input-rules.ts` 의 `assertChatChannelInputSafe`/
  `assertPatchCarriesNoSecrets`/`assertChatChannelAlreadySetUp` 는 이번 PR 이 새로 만든 것이
  아니라 재사용/리팩터(`extractInboundSigningRef` 추출)뿐이며, 내부 필드(botTokenRef,
  inboundSigningRef, inboundSigning) 차단·PATCH 비밀 금지 로직에 변화가 없다. `mergeIntoFreshSubKey`/
  `rewriteTriggerConfigLocked` 의 머지는 스프레드 리터럴(`{ ...base, ...patch }`)만 쓰고
  사용자 JSON 을 `JSON.parse` 후 그대로 재귀 병합(`_.merge` 류)하지 않으므로 prototype
  pollution(`__proto__` 주입) 표면도 새로 생기지 않는다.
- **암호화**: `randomBytes(32)` (256-bit CSPRNG) 사용, 평문 토큰은 secret store 로만
  이동하고 `stripChatChannelPlaintext`/`SS-SE-01` 규율에 따라 `config` JSONB 에 잔류하지
  않는다. 이번 PR 은 이 규율을 깨지 않고 그대로 보존한다.
- **에러 처리**: `rotateBotToken`/`setupChatChannel` 의 adapter 실패는 원문을 서버 로그에만
  남기고(`this.logger.warn`) 클라이언트에는 `translateSetupChannelError`(`chat-channel-input-rules.ts:342-361`)가
  변환한 일반화된 메시지("Bot token was rejected by the provider." / "Chat channel setup
  failed after rotation.")만 반환한다. `TriggersService.remove()` 의 락 타임아웃 실패
  (`55P03`)도 `this.logger.error` 로 원문을 남긴 뒤 `throw err` 하는데, 전역
  `GlobalExceptionFilter`(`common/filters/http-exception.filter.ts`)가 매핑되지 않은 `Error`
  를 CWE-209 방지 문구("An unexpected error occurred...")로 마스킹하므로 DB/락 관련 내부
  정보가 클라이언트로 노출되지 않는다(기존 방어, 이번 PR 로 인한 회귀 없음).
- **의존성 보안**: `package.json`/lockfile 변경 없음. 신규 import 는 기존 의존성
  (`typeorm`, `pg`, `supertest`, `@jest/globals`, `node:crypto`)과 프로젝트 내부 모듈뿐이다.

## 요약

이 PR 은 그 자체가 실재하는 보안 결함(동시 PATCH/웹훅 hot path 가 `trigger.config` 를
스냅샷으로 통째로 되써 `chatChannel.inboundSigningRef` 를 지우고 인입 웹훅 서명 검증을
fail-open 시키는 lost-update)을 닫는 수정이며, 소스를 직접 추적한 결과 advisory lock +
락 안 재읽기·머지 + 컬럼 한정 갱신 패턴이 CHANGELOG 가 주장하는 11개 자리(창 1~4 및 후속
7곳) 전부에 일관되게 적용되어 있음을 확인했다. SQL 은 `lock_timeout` 문자열 보간 한 곳을
제외하면 전부 파라미터 바인딩을 쓰고, 그 한 곳도 현재는 모듈 상수만 소비하고 `Math.trunc` 로
비-숫자 입력을 무력화해 인젝션으로 이어지지 않는다(INFO, 방어적 코딩 관점의 개선 여지만
있음). 토큰 생성은 CSPRNG 를 쓰고, 비밀은 secret store 로만 옮겨지며 config JSONB 에 평문이
남지 않는다. 에러 응답은 기존 전역 필터가 내부 정보를 계속 마스킹한다. 유일하게 짚을 점은
새 헬퍼 `rewriteTriggerConfigLocked` 가 `workspaceId` 스코프 없이 `id` 단일 조건으로 재조회한다는
것인데, 현재 4개 호출부 모두 사전에 워크스페이스 소유권을 검증한 뒤라 실질적 인가 우회는
없고, 향후 재사용 시의 방어적 문서화 개선 여지(INFO)로만 남긴다. 두 INFO 항목 모두 이번
변경을 막을 사유가 아니다.

## 위험도

LOW
