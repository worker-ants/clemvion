# 보안 리뷰 — sanitizeErrorMessage secret 마스킹 (HEAD 277e6d314)

대상: `codebase/backend/src/modules/execution-engine/sanitize-error-message.ts` (+ 신규 spec).
소비처 확인: `execution-engine.service.ts:dispatchExecutionFailedNotification` (line 4533),
`queues/background-execution.processor.ts:process` (line 72).

## 발견사항

- **[WARNING]** `schedule-runner.service.ts` 의 실패 알림 경로가 이번 마스킹을 우회한다
  - 위치: `codebase/backend/src/modules/schedules/schedule-runner.service.ts:196-240`
    (`process()` catch → `dispatchScheduleFailedNotification`)
  - 상세: 이번 커밋이 고친 두 경로(`ExecutionEngineService.dispatchExecutionFailedNotification`,
    `BackgroundExecutionProcessor.process`)와 정확히 같은 위협 모델(노드/트리거 실행 중 발생한
    예외가 상류 API 응답의 토큰을 echo 할 수 있음)을 가진 세 번째 실패-알림 경로가 있는데,
    이 경로만 `sanitizeErrorMessage`를 거치지 않는다:
    ```ts
    // process() catch
    await this.dispatchScheduleFailedNotification(
      scheduleId, workspaceId, workflowId,
      err instanceof Error ? err.message : String(err),   // raw, 미새니타이징
    );
    // dispatchScheduleFailedNotification 내부
    await this.notificationsService.notify({
      ...
      message: `스케줄이 워크플로우 "${workflow.name}" 실행을 시작하지 못했어요: ${message}`,
      channel: channelByUser.get(owner) ?? 'both',   // 'both' = 인앱 + 외부 SMTP 이메일
    });
    ```
    `message`는 `resolveScheduleParameters`(`resolveTriggerParameters` / expression 평가) 또는
    `executionEngineService.execute(...)` 호출에서 올라온 raw `err.message`이며, 두 경로 모두
    이번 커밋이 방어하려는 "노드/통합 예외가 echo한 Bearer/api_key/Authorization 값"을 포함할
    수 있는 동일한 소스다. 이 메시지가 그대로 인앱 알림 + (opt-out 전까지 기본값인) 이메일로
    나간다 — 이번 하드닝의 "background/top-level 양쪽 다 적용해 방어 심도가 갈리지 않게 한다"는
    커밋 메시지의 취지가 schedule 경로에는 적용되지 않은 상태.
  - 제안: `dispatchScheduleFailedNotification`의 `message` 조립부에도
    `sanitizeErrorMessage`(또는 최소한 shared `redactSecrets`)를 적용. 커밋 스코프 밖이라면
    별도 후속 커밋으로 명시적으로 남길 것을 권장 (같은 클래스의 잔여 하드닝 항목이므로 spec
    §R17 후속 목록에 추가하는 편이 적절해 보임).

- **[INFO]** shared SoT `redactSecrets`(SECRET_LEAK_PATTERNS)의 값-패턴 매칭 한계가 이번
  마스킹 경로에도 그대로 이어짐 (신규 도입 아님, 기존에 알려진 잔여 — task 지침에도 명시)
  - 위치: `codebase/backend/src/shared/utils/sanitize-error-message.ts:24-34`
    (import 경로: `sanitize-error-message.ts:18`)
  - 상세: 실측 확인 (node 로 패턴 재현):
    - 키워드 없이 노출되는 bare JWT(`eyJhbGci...`)는 `Bearer` 접두사나 `token=`류 키워드가
      없으면 전혀 마스킹되지 않는다 — 예: `"invalid token: eyJhbGciOi...5N_XgL0n3I9PlFUP0THsR8U"`
      가 원문 그대로 통과.
    - `CONNECTION_STRING_PATTERN`이 `postgres|postgresql|redis|mongodb|mysql` 스킴만 커버해
      `https://admin:supersecret@internal.example.com/...` 같은 userinfo-내장 자격증명은
      strip 단계도, 이후 `redactSecrets`의 키워드 패턴(`password=`/`secret:`류)도 매칭하지
      못해 평문 그대로 새어나간다 — 실측: `sanitize("connect to https://admin:supersecret@..." )`
      → `supersecret` 그대로 잔존.
    - 단독 `session=`/`token=`(접두사 없는 bare `token`) 형태의 쿠키/세션 값도
      `access[_-]token`류 키워드 목록에 없어 미탐.
  - 제안(우선순위 낮음, 이번 diff 밖): 상기 두 형태(bare JWT 정규식 `\bey[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b`, 일반 `scheme://user:pass@host` userinfo 패턴)를
    SoT `SECRET_LEAK_PATTERNS`에 추가하면 이 소비처를 포함한 모든 재사용처가 함께 개선됨.
    이번 diff 자체의 결함은 아니므로 정보성으로만 기록.

- **[INFO]** strip → redact 순서는 이번 변경 범위(`postgres/redis/mongodb/mysql` 커넥션
  스트링)에 한해 안전함 확인
  - 위치: `sanitize-error-message.ts:27-32`
  - 상세: `CONNECTION_STRING_PATTERN`(`(postgres|postgresql|redis|mongodb|mysql):\/\/[^\s]+`)이
    스킴부터 공백 전까지 **userinfo(비밀번호 포함)를 포함한 URI 전체**를 `[REDACTED_URI]`로
    치환하므로, 이후 `redactSecrets`가 플레이스홀더만 보게 되어 순서로 인한 토큰 누락은
    발생하지 않는다 (실측 확인: `postgres://user:p@ss@db.internal:5432/app` →
    `[REDACTED_URI] failed to connect`, 비밀번호 잔존 없음). 위 INFO 항목의 스킴 커버리지
    한계와는 별개 이슈.

## 소비처 전수 점검 결과

`err.message`/`error.message`를 알림·이메일로 흘려보내는 다른 경로를 backend 전역에서
grep 했다 (`src/modules/**/*.service.ts`, `*.processor.ts` 중 `notificationsService`/
`mailService` 사용처 교차 확인):

- `execution-engine.service.ts` / `background-execution.processor.ts` — 이번 커밋으로 커버됨.
- `schedule-runner.service.ts` — 위 WARNING 참조 (미커버).
- `workspace-invitations.service.ts` (team_invite / invitation email 발송 실패) — 알림
  `message`는 정적 템플릿(`"${inviterName}님이 ... 초대했어요"`)이고, `err.message`는
  logger 로만 기록됨 (사용자 표면 미노출) — 문제 없음.
- `alerts-evaluator.service.ts` (`dispatchBreach`) — `messageFor(breach)`로 구조화된 필드
  기반 템플릿, raw error 미개입 — 문제 없음.
- `integration-expiry-scanner.service.ts` / `integration-action-required-notifier.service.ts`
  — 정적 템플릿 문자열만 사용, raw error 미개입 — 문제 없음.
- `notifications.service.ts` (`sendOneEmail`/`emitNew`) — 이미 적재된 `row.message`를 그대로
  전송/emit 할 뿐이므로 발사원(위 서비스들)에서 sanitize 여부가 결정됨; 자체적으로 raw error
  를 조립하지 않음.
- 시스템 알림 channel 은 `'in_app' | 'email' | 'both'`뿐이며 별도 "webhook" 알림 채널은
  존재하지 않음 (사용자가 워크플로우 내에 구성하는 HTTP/webhook 노드는 별개의 사용자
  제어 로직이라 본 검토 범위 밖).

## 회귀 점검

- 신규 spec 7건 실행 결과 전부 통과 (`npx jest sanitize-error-message.spec.ts` → 7 passed).
- redact → truncate(500자) 순서가 유지되어, 마스킹으로 문자열이 줄어드는 방향이라
  truncate 와 상호작용해 토큰이 잘려 일부만 노출되는 시나리오는 없음 (redact 가 먼저 전체
  토큰을 `***`로 치환한 뒤 자름).
- `redactSecrets`는 `String.prototype.replace`로 매 호출마다 `lastIndex`가 초기화되는
  stateless 사용이라, 동시 호출 간 정규식 상태 공유로 인한 오탐/누락 없음.
- 정상 메시지 과잉 손상 여부: `password: ...`처럼 키워드+구분자가 우연히 붙는 일반 에러
  문구(예: 로그인 실패 메시지)는 값이 `***`로 치환될 수 있으나, 이는 shared SoT 가 이미
  다른 소비처(conversation-thread EIA egress 등)에서 검증된 기존 동작이며 이번 diff 가
  새로 만든 회귀는 아님.

## 요약

이번 변경 자체(파일 2개, +24/-7)는 안전하게 구현됐다 — strip 후 redact 순서는 커버 대상
스킴에서 토큰 누락을 일으키지 않고, 명시된 두 소비처(top-level 실행 실패·background 본문
실패)에는 정확히 적용됐으며 신규 spec 도 핵심 케이스를 커버한다. 다만 소비처 전수 점검에서
동일한 위협 모델을 가진 **schedule 실패 알림 경로**가 이번 하드닝에서 빠졌음을 확인했다 —
커밋 메시지가 명시한 "한쪽만 적용돼 방어 심도가 갈리는 일을 막기 위해" 라는 목표가 부분적으로만
달성된 상태다. 이 외에 shared SoT 패턴 자체의 알려진 한계(bare JWT, 비-DB 스킴 URI userinfo,
접두사 없는 session/token 키)는 이번 diff 의 결함이 아니라 상위 SoT 의 기존 잔여로 기록만 남긴다.

## 위험도

MEDIUM — 이번 diff 자체는 LOW 이나, 동일 커밋 목적(실패 알림 경로의 secret 노출 방지)을
놓친 schedule 경로가 실사용 시 그대로 남아 있어 전체 취지 달성도를 MEDIUM 으로 평가.
