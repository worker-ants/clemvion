# 보안(Security) Review — trigger-config-lost-update

## 검토 범위

이번 변경의 핵심은 `trigger.config` (JSONB) 에 대한 **lost-update 취약점 수정**이다. 동시
PATCH/rotate 요청이 요청 시작 시점의 `config` 스냅샷을 통째로 재작성(`save(entity)`)하면서,
그 사이 다른 요청이 확립한 `chatChannel.inboundSigningRef` 를 되돌리는 경합이 있었다. 이
값이 사라지면 `ChatChannelInboundAuthenticator` 의 `if (!config.inboundSigningRef) return;`
가 걸려 **인입 웹훅 서명 검증이 fail-open 으로 돌아간다** — 실질적으로 인증 우회다. 본
PR 은 이를 advisory lock(`pg_advisory_xact_lock(hashtext('trigger-config:<id>'))`) +
"락 안에서 최신 행을 재읽어 서브키만 머지" 패턴으로 닫는다.

핵심 프로덕션 코드를 직접 열어 확인했다:
`codebase/backend/src/modules/triggers/trigger-config-lock.ts`(신규),
`triggers.service.ts`, `chat-channel-binder.service.ts`,
`codebase/backend/src/modules/hooks/hooks.service.ts`,
`codebase/backend/src/modules/schedules/schedules.service.ts`,
`codebase/backend/src/modules/triggers/chat-channel-input-rules.ts`,
그리고 e2e `codebase/backend/test/trigger-config-lost-update.e2e-spec.ts`.
`review/code/**`·`review/consistency/**` 하위 다수 파일은 이전 라운드들의 리뷰 산출물이며
코드가 아니라 이번 관점에서 별도 분석 대상이 아니다. `repo-guards/__tests__/**` (endpoint-path
충돌 래핑 정적 가드) 는 dev-time AST 정적분석 도구로, 사용자 입력을 다루지 않아 이번 관점의
위험 표면이 아니다.

## 발견사항

- **[INFO]** `SET LOCAL lock_timeout` 에 문자열 템플릿으로 값을 주입한다 — 현재는 안전하지만 파라미터 바인딩이 아니다
  - 위치: `codebase/backend/src/modules/triggers/trigger-config-lock.ts` — `acquireTriggerConfigLock` 내부, ``SET LOCAL lock_timeout = '${Math.trunc(options.timeoutMs)}ms'`` 줄
  - 상세: `SET LOCAL` 은 Postgres 프로토콜상 `$1` 파라미터 바인딩을 지원하지 않아 문자열 조립이 불가피하다는 점은 이해한다. 실측(`grep -rn "acquireTriggerConfigLock"`)으로 확인한 결과 이 함수를 `timeoutMs` 와 함께 호출하는 자리는 `triggers.service.ts` 의 `remove()` 단 한 곳이며, 넘기는 값은 모듈 상수 `TRIGGER_DELETE_LOCK_TIMEOUT_MS = 5_000` 뿐이다 — 사용자 입력이 이 문자열 조립에 닿는 경로는 없다. `Math.trunc()` 가 `ToNumber` 를 거치므로 설령 향후 호출부가 문자열을 넘기더라도 SQL 구문에 삽입되는 것은 숫자 리터럴 또는 `NaN` 뿐이라(따옴표·세미콜론 등 SQL 메타문자를 만들 수 없다) 인젝션으로 이어지지 않는다. 즉 오늘 시점 실질적 위험은 없다.
  - 제안: 방어적 조치는 불필요하지만, 이 함수가 향후 리팩터로 사용자 제어 가능한 타임아웃(예: 관리자 설정값)을 받게 될 경우를 대비해 JSDoc 의 "사용자 입력이 여기 닿는 경로는 없다" 라는 현재 진술 옆에 "만약 호출부가 늘어나면 이 계약(모듈 상수만 허용)을 정적으로 강제할 것" 한 줄을 추가하는 정도면 충분. Blocking 사유 아님.

- **[INFO]** advisory lock 대기에 상한이 없는 경로(창 1·binder·rotate 등)가 새 공유 블로킹 자원을 만든다 — 가용성 관점의 저위험 관찰
  - 위치: `codebase/backend/src/modules/triggers/trigger-config-lock.ts` — `rewriteTriggerConfigLocked`, `TriggersService.update()` 의 인라인 락 획득부
  - 상세: 같은 `triggerId` 에 대한 동시 PATCH/rotate/notification-rotate 요청은 앞선 트랜잭션이 커밋할 때까지 무기한 대기한다. 임계 구간에 외부 HTTP 호출이 없어 보유 시간이 "DB 왕복 두 번" 으로 유계라는 근거는 코드에 잘 문서화돼 있고, 이미 다른 라운드(concurrency WARNING#3)에서 지적·수용된 사안이라 신규 지적은 아니다. 다만 보안 관점에서 보면, 같은 트리거에 대해 다수의 동시 PATCH 를 의도적으로 쏘는 클라이언트가 있다면 그 트리거의 쓰기 경로를 직렬화 대기열로 묶어 지연시킬 수 있다 — 단일 트리거 단위라 워크스페이스 전체나 다른 트리거에는 영향이 없고, 임계 구간이 짧아 실질적 DoS 효과는 제한적이다.
  - 제안: 조치 불요(이미 수용된 트레이드오프, 근거가 코드에 문서화됨). 향후 임계 구간에 외부 호출이나 긴 계산이 들어가는 변경을 할 때만 `lock_timeout` 도입을 함께 고려.

- **[INFO]** advisory lock 키 공간(`hashtext` 32비트)을 `trigger-config:*` 와 `exec-cap:*` 두 네임스페이스가 공유 — 이미 별도 라운드에서 지적·수용됨, 보안 영향 없음(과직렬화만)
  - 위치: `codebase/backend/src/modules/triggers/trigger-config-lock.ts:1-18` (`TRIGGER_CONFIG_LOCK_PREFIX`)
  - 상세: 우연한 해시 충돌 시 서로 다른 자원의 쓰기가 불필요하게 직렬화될 뿐 정확성이나 인가 경계를 침해하지 않는다. `review/consistency/2026/09/14/17_10_16` naming_collision INFO#8 로 이미 등재·수용됨. 재확인 차원의 기록.
  - 제안: 조치 불요.

## 긍정적으로 확인한 점

- **SQL 인젝션**: 이번 변경에서 새로 추가된 모든 raw 쿼리(`SELECT pg_advisory_xact_lock(hashtext($1))`, e2e 의 `UPDATE trigger SET config = $2::jsonb WHERE id = $1` 등)가 파라미터 바인딩을 사용한다. 문자열 concat 은 위에서 지적한 `lock_timeout` 한 자리뿐이고, 그 값은 사용자 입력이 닿지 않는 모듈 상수다.
- **인증/인가 우회 수정 자체가 이 PR 의 목적**: 동시 PATCH 로 `chatChannel.inboundSigningRef` 가 사라져 인입 웹훅 서명 검증이 fail-open 되는 경로를, 락 안 재읽기 + presence 게이트 재계산(`survivesWithFresh`)으로 닫았다. `chat-channel-binder.service.ts:209-211` 에서 게이트가 "요청 시작 시점 값" 뿐 아니라 "락 안에서 재읽은 행의 ref 존재 여부" 도 항으로 더하는 것을 직접 확인했다 — 컨테이너만 재읽고 게이트 값을 그대로 넣으면 결함이 재발한다는 지적(다른 라운드의 rationale_continuity W1)이 실제 코드에 반영돼 있다.
- **삭제 경합 처리**: `remove()` 가 삭제도 같은 advisory lock 을 잡아, "읽었을 땐 있었는데 저장 직전에 삭제되는" TOCTOU 로 `save(entity)` 의 INSERT-on-missing 이 삭제된 트리거를 고아로 되살리는 경로를 막는다. 락 실패(5초 타임아웃 초과) 시 원본 에러를 그대로 `throw` 하지만, `GlobalExceptionFilter`(`common/filters/http-exception.filter.ts`)가 `HttpException` 이 아닌 `Error` 를 이미 일반화된 메시지(`UNHANDLED_ERROR_MESSAGE`)로 마스킹하고 원문은 `logger.error` 로만 남기므로, DB 에러 원문(락 타임아웃 SQLSTATE 등)이 클라이언트로 노출되지 않는다 — 기존 CWE-209 방지 인프라가 이번에 새로 던지는 에러에도 그대로 적용된다.
- **비밀 처리**: `notification.signing.secret`·bot token·inbound-signing plaintext 는 이번 변경 전후로 secret store 로만 이동하고 `config` JSONB 에 평문으로 남지 않는다(`normalizeNotificationSecretRef`, `rotateBotToken`, `setupChatChannel`). 응답 정화(`sanitizeForResponse`, `CHAT_CHANNEL_RESPONSE_STRIP_KEYS` 등)도 이번 diff 로 건드리지 않았고 그대로 유지된다.
- **테스트 신규 시크릿 값**: `hooks.service.spec.ts`/`triggers.service.spec.ts`/e2e 스펙에 등장하는 `x-api-key: 'k-123'`, `SLACK_SIGNING_SECRET = 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6'`, `newBotToken '111:e2eTelegramBotToken'` 등은 전부 테스트 픽스처이며 실제 자격증명이 아니다.
- **IDOR 관점**: `rewriteTriggerConfigLocked` 의 락-안 `findOne`/`update` 는 `id` 만으로 필터링하고 `workspaceId` 를 다시 걸지 않지만, 모든 호출부가 그 이전에 `findById(id, workspaceId)` 로 워크스페이스 소속을 이미 검증했고 `id` 는 전역 유일 UUID라 교차 테넌트 유출 경로가 되지 않는다.

## 참고 (절차 투명성, 이슈로 집계하지 않음)

리뷰 도중 `git status --short` 로 한 번 확인했을 때 `codebase/backend/src/modules/triggers/triggers.service.ts`
가 `M`(수정됨)으로 잡혔고, `git diff` 로 대조하니 `revokePerTriggerToken()` 의
`if (!wroteInteraction) this.throwTriggerNotFound();` 한 줄이 일시적으로 사라져 있었다 —
병렬 fan-out 리뷰 규약이 경고한 "다른 reviewer 가 같은 워킹트리를 동시에 mutate" 상황으로
보인다(내가 이 파일에 쓴 적은 없다 — Read 로만 열었다). 곧이어 재확인한 `git diff` 는
빈 출력이었고 `git status --short` 도 다시 clean 했다 — 다른 reviewer 가 자신의 뮤테이션
검증을 끝내고 `cp` 로 원복한 것으로 보인다. 이 리포트를 마무리하는 시점 기준으로 저장소에
잔여 이상 상태는 없다. 다음 라운드 리뷰어를 위해 기록만 남긴다.

## 요약

이번 변경은 동시 PATCH/rotate 요청이 `trigger.config` 를 스냅샷 기반으로 통째 덮어써 인입 웹훅
서명 검증(`inboundSigningRef`)을 fail-open 시키던 **실질적 인증 우회 경로**를 닫는 수정이다.
advisory lock 을 트랜잭션 내부로 한정하고 외부 HTTP 호출을 락 밖에 두어 이 저장소의 기각된
선례(Cafe24 advisory lock)를 정확히 학습해 반영했으며, presence 게이트를 락 안에서 재계산해
"컨테이너만 재읽고 게이트 값은 옛것" 이라는 재발 경로까지 닫았다. 새로 추가된 모든 raw SQL은
파라미터 바인딩을 쓰고, 유일한 문자열 조립(`lock_timeout`)은 사용자 입력이 닿지 않는 모듈
상수만 받으며 `Math.trunc` 로 숫자 강제까지 돼 있어 인젝션 실익이 없다. 삭제 경합·에러 노출
경로도 기존 `GlobalExceptionFilter` 의 CWE-209 마스킹이 그대로 커버한다. 발견된 항목은 모두
INFO 수준이며 대부분 이미 이전 리뷰 라운드에서 지적·수용된 트레이드오프의 재확인이다. 이
변경을 막을 신규 보안 이슈는 없다.

## 위험도

NONE
