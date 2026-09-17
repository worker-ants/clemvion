# 보안(Security) 리뷰 — `trigger-save-partial-patch` (2라운드)

## 범위 요약

핵심 변경은 `codebase/backend/src/modules/triggers/triggers.service.ts` 의 `TriggersService.update()`
창 1 — advisory lock 안에서 재읽은 `Trigger` 엔티티를 **통째로** `save` 하던 것을 **이 요청이
바꾸는 필드 + `config` 만 담은 부분 객체**로 좁혔다. 나머지 파일(`triggers.service.spec.ts`,
`trigger-transaction-mock.ts`, 신규 e2e `trigger-update-save-window.e2e-spec.ts`, `jest.config.ts`,
`CHANGELOG.md`, `plan/in-progress/trigger-save-partial-patch.md`)은 이 수정의 검증·문서화 산출물이고,
`review/code/2026/09/17/13_44_39/**` · `review/consistency/2026/09/17/13_04_39/**` 는 1라운드 리뷰/
consistency 산출물이 그대로 커밋된 것(신규 코드 아님)이다.

## 발견사항

- **[INFO]** 이번 수정은 신규 취약점이 아니라 **기존의 보안 성격 lost-update 를 해소하는 방향**이다
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts:680-717` (특히 `710`~`716`,
    `const patch = { ...defined, config: mergedConfig }; const written = await m.save(Trigger, { id: target.id, ...patch }); ... if (written.updatedAt) target.updatedAt = written.updatedAt;`)
  - 상세: 종전 통째 엔티티 `save` 는 락 안 재읽기 **이후** 락 **밖**에서 커밋된 컬럼을 옛 값으로
    되돌렸다 — 그 대상에 `rotateNotificationSecret` 이 쓴 `notification_secret_v2`(24h grace 회전
    상태)와 cron 정리(`cleanupRotatedChatChannelTokens`)가 null 로 지운 `chat_channel_token_v2` 가
    포함된다. 즉 이름만 바꾸는 PATCH 가 경합하면 **회전되어 폐기된 secret 이 되살아나거나, 정리된
    토큰이 원복될 수 있었다.** 이번 PR 은 저장 대상을 `defined`(DTO 화이트리스트 필드) + `config`
    로 좁혀, 넘기지 않은 컬럼은 TypeORM 비교에서 빠지게 함으로써 이 되돌림을 막는다. 실제 Postgres
    로 재현·검증됐다(`test/trigger-update-save-window.e2e-spec.ts` ②/②b). 조치가 필요한 발견이
    아니라 방향 확인용 기록이다.
  - 제안: 없음(방향 확인).

- **[INFO]** 저장 대상 `defined` 는 검증된 DTO 필드만 담아 mass-assignment/IDOR 위험이 없다
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts:613-615`
    (`const defined = Object.fromEntries(Object.entries(rest).filter(([, v]) => v !== undefined));`),
    저장 시 `id` 는 `679`의 `assertTriggerFound(fresh)` 결과(`641`의 `m.findOne(Trigger, { where: { id: trigger.id, workspaceId }, ... })` 로 workspace 범위 검증된 재읽기)에서 온다
  - 상세: `rest` 는 `UpdateTriggerDto` 구조 분해 결과라 요청 바디의 임의 키가 아니라 DTO 선언 필드로
    제한된다. `save` payload 의 `id` 도 요청 DTO 가 아니라 workspace-scoped `findOne` 결과에서
    오므로, 좁힌 저장 대상이 다른 워크스페이스 행을 건드리거나 화이트리스트 밖 컬럼을 쓰는 경로는
    보이지 않는다. `workspaceId` 자체는 `patch` 에 포함되지 않아 소유권 컬럼도 건드리지 않는다.
    조치가 필요한 발견이 아니라 검증 기록이다.
  - 제안: 없음(검증 완료).

- **[INFO]** 신규 e2e 특성 테스트의 DB 자격증명 fallback 은 하드코딩이지만 이 저장소의 기존 e2e
  관행과 동일 — 신규 위험 아님
  - 위치: `codebase/backend/test/trigger-update-save-window.e2e-spec.ts:82`
    (`password: process.env.DB_PASSWORD ?? 'clemvion-e2e',`)
  - 상세: 이 값은 `env` 미설정 시 로컬/CI e2e 컨테이너 네트워크 안에서만 쓰이는 fallback 이고, 같은
    패턴이 저장소 전반의 다른 e2e helper 에도 이미 존재한다(1라운드 security 리뷰 `review/code/2026/09/17/13_44_39/security.md` INFO#… 및 SUMMARY INFO#13 에서도 동일하게 처분됨). 프로덕션
    자격증명이 아니고 실 비밀도 아니다.
  - 제안: 조치 불요.

- **[INFO]** 신규 e2e 의 raw SQL 은 전부 파라미터 바인딩(`$1`)을 쓴다 — SQL 인젝션 경로 없음
  - 위치: `codebase/backend/test/trigger-update-save-window.e2e-spec.ts:118`(`DELETE FROM workflow WHERE id = $1`), `:162-163`, `:173-174`, `:194-195`, `:206-207` (전부 `$1` 플레이스홀더 + 배열 인자)
  - 상세: 상수 문자열(`'v2-from-B'`, `'v2-in-db'` 등)은 컬럼 값 리터럴로만 쓰이고 사용자 입력이 SQL
    문자열에 직접 이어붙는 자리가 없다. 확인 목적의 기록이며 조치 불요.
  - 제안: 없음.

- **[INFO]** 응답 secret 스트립(`TRIGGER_RESPONSE_STRIP_COLUMNS`)은 이 PR 로 변경되지 않았고 새
  경로에서도 그대로 적용된다
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.spec.ts:3895-3897`(주석 — 응답
    회귀 단언이 `notificationSecretV2`/`chatChannelTokenV2` 대신 `endpointPath`/`lastTriggeredAt`/
    `authConfigId` 로 조여진 이유를 "그 두 컬럼은 `TRIGGER_RESPONSE_STRIP_COLUMNS` 가 응답에서
    지운다" 로 설명)
  - 상세: 저장 응답 조립 경로(`Object.assign(target, patch)` + `written.updatedAt` 보정)가 secret
    컬럼을 새로 노출하지 않는다는 것을 테스트 저자가 직접 실측해 확인한 흔적이다. 별도 조치 불요.
  - 제안: 없음.

## 요약

이번 diff 의 핵심은 `PATCH /api/triggers/:id` 내부 저장 방식을 "재읽은 엔티티 통째 `save`" 에서
"요청이 바꾸는 필드만 담은 부분 객체 `save`" 로 좁혀, 락 밖에서 커밋된 다른 컬럼 — 그중에는 회전된
알림 secret(`notification_secret_v2`)과 cron 이 정리한 챗채널 토큰(`chat_channel_token_v2`)이
포함된다 — 이 되써지는 lost-update 를 막는 수정이다. 새 SQL 은 전부 파라미터 바인딩이고, 저장
payload 는 DTO 화이트리스트 필드로만 구성되며 대상 행 `id` 는 workspace-scoped 재읽기에서 오므로
인젝션·mass-assignment·IDOR 경로가 새로 열리지 않는다. 인증/인가(`@Roles`)·요청/응답 DTO 스키마·
암호화 방식·에러 매핑은 이 PR 로 변하지 않았다. 남은 항목은 전부 INFO — 방향 확인 또는 기존 저장소
관행 재확인이며, 액션이 필요한 새 취약점은 발견되지 않았다.

## 위험도
NONE
