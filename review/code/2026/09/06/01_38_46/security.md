# 보안(Security) 코드 리뷰

## 개요

이 PR 은 §5.4 응답-계약 검증자(`assertMatchesContract`)의 배선을 14→18개 DTO/엔드포인트로
넓히는 작업이며, 그 과정에서 실측으로 트리거 회전 secret 유출(2개 축: 조인 유출 +
`config.interaction.triggerToken` 미스트립)을 발견해 같은 커밋에서 수정했다. 즉 이 diff 의
핵심은 **보안 결함 수정**이다. 아래는 그 수정 자체의 완결성 검증과, diff 전체에 대한
표준 보안 관점(인젝션·시크릿·인가·입력검증·암호화·에러 처리) 점검 결과다.

## 발견사항

- **[INFO]** 트리거 secret 유출 수정은 4개 축(entity 컬럼 · `config.chatChannel` ·
  `config.notification.signing` · `config.interaction.triggerToken`)과 2개 노출 경로
  (`GET/POST/PATCH /api/triggers` 직접 응답, `GET/POST/PATCH /api/schedules` 의 트리거 조인)를
  모두 정합적으로 닫는다 — 교차 검증 결과 누락된 축을 찾지 못했다.
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts` `sanitizeForResponse`(약 660~755행) 및
    `TRIGGER_RESPONSE_STRIP_COLUMNS`(94~97행) · `NOTIFICATION_SIGNING_STRIP_KEYS`(74~77행) ·
    `INTERACTION_RESPONSE_STRIP_KEYS`(114행); `codebase/backend/src/modules/schedules/schedules.controller.ts` `toResponse`(71~113행)
  - 상세: `TRIGGER_RESPONSE_STRIP_COLUMNS`(`notificationSecretV2`, `chatChannelTokenV2`)는
    `as const satisfies readonly (keyof Trigger)[]` 로 컴파일 타임에 엔티티 컬럼명과 대조되므로
    오탈자로 인한 스트립 누락이 구조적으로 막혀 있다. `schedules.controller.ts` 의
    `toResponse` 는 `Schedule.trigger` 를 참조 4필드(`id`/`name`/`workflowId`/`workflow.name`)로
    좁히고, `ScheduleTriggerRefDto`/`TriggerWorkflowRefDto` DTO 선언이 정확히 그 필드셋과
    일치한다 — 좁히기 구현과 계약 선언이 어긋나지 않는다. `triggers.service.spec.ts` ·
    `schedule-trigger-ref.spec.ts` ·`schedule-trigger.e2e-spec.ts` 가 스트립을 되돌리는
    뮤테이션을 실제로 걸어 RED 를 확인한 회귀 테스트를 갖췄다(단순 존재-단언이 아니라
    되돌림 뮤턴트 기반 검증).
  - 제안: 조치 불요. 향후 트리거에 새 비밀 축이 추가될 때 `sanitizeForResponse` JSDoc 이
    스스로 경고하듯("세 번 같은 형태로 좁았다") 목록형 allow-list 대신 엔티티 데코레이터
    기반 선언적 SoT 로 옮기는 것을 다음 개선으로 고려할 만하다(이번 PR 의 범위는 아님).

- **[INFO]** 스케줄 응답 경계(`SchedulesController.toResponse`)가 `trigger` 관계 부재(정상
  데이터로는 도달 불가한 데이터 손상 케이스)를 500 으로 fail-closed 처리하며, 에러 메시지는
  `INTERNAL_ERROR` 고정 문구만 클라이언트에 보내고 진단 정보(schedule id, 원인 추정)는
  서버 로그에만 남긴다 — CWE-209(에러 메시지를 통한 정보 노출) 를 명시적으로 회피한 설계다.
  - 위치: `codebase/backend/src/modules/schedules/schedules.controller.ts:90-100`
  - 상세: 코드 주석 자체가 "종전엔 `schedule.id` 를 500 바디에 실었다"는 선행 결함
    (`review/consistency/2026/09/06/00_48_52` W1)을 인용하며 이번에 고쳤다고 설명한다. 실제
    `InternalServerErrorException` 생성자에 넘기는 것은 정적 한국어 문구뿐이고, `id`·조인
    실패 원인은 `this.logger.error(...)` 로만 나간다 — 검증 결과 일치.
  - 제안: 조치 불요. 다만 이 fail-closed 설계는 "한 행의 데이터 손상이 목록 전체 요청을
    500 으로 만든다"는 가용성 트레이드오프를 수반한다(팀도 CHANGELOG 에서 의도적 선택으로
    문서화). 정상 트래픽에서는 FK `NOT NULL` + `onDelete: CASCADE` 로 도달 불가능하다고
    주장하므로 신규 취약점으로 보지 않는다.

- **[INFO]** `TriggerDto` 에 새로 선언된 `chatChannelLastError`/`notificationLastError`
  (외부 provider 어댑터 실패 시 `err.message` 를 최대 1024자 저장)는 이 PR 이전부터 이미
  wire 로 나가고 있던 필드를 문서화(선언)한 것뿐이라 이 diff 가 새로 노출을 만든 것은
  아니다. 다만 외부 API(Slack/Discord/Telegram) 에러 문자열이 워크스페이스 멤버에게 그대로
  노출되는 경로이므로, 향후 그 에러 문자열에 업스트림이 요청 헤더·토큰 일부를 반향하는
  경우가 있는지는 이 PR 범위 밖에서 별도로 감사할 가치가 있다.
  - 위치: `codebase/backend/src/modules/triggers/dto/responses/trigger-response.dto.ts` (신규 필드 선언부),
    구현은 `codebase/backend/src/modules/triggers/triggers.service.ts` `setupChatChannel` catch 블록(약 987~996행, `message.slice(0, 1024)`)
  - 제안: 조치 불요(이번 PR 범위 밖). 백로그로만 기록 권고.

- **[INFO]** `IntegrationDto.appUrl` 이 이번에 처음 선언됐는데, 이 값은
  `${APP_URL}/api/3rd-party/<provider>/install/:installToken` 형태로 **1회성 install
  token 을 URL 에 포함**한다(`integrations.service.ts` `buildCafe24InstallUrl` 등, 이 PR
  범위 밖 기존 코드). DTO 선언 자체는 기존에 나가던 값을 문서화했을 뿐이라 신규 노출이
  아니다.
  - 위치: `codebase/backend/src/modules/integrations/dto/responses/integration-response.dto.ts:133-140`
  - 상세: 토큰이 URL 쿼리/경로에 실리면 프록시·access 로그·Referer 헤더로 새어 나갈 표면이
    생기는 것이 일반적 우려이나, 이는 이 PR 이 만든 변화가 아니라 기존 설계(설치 흐름
    자체가 그 토큰으로 동작)이므로 이번 diff 의 결함으로 분류하지 않는다.
  - 제안: 조치 불요(이번 PR 범위 밖).

- **[INFO]** 테스트 픽스처(`optional-nullable.fixture.ts`, `triggers.service.spec.ts` 신규
  테스트)에 `'wsk_live_secret'`, `'bot_plaintext_should_not_leak'`, `'itk_should_not_leak'`
  같은 문자열이 있으나, 명명 자체가 "누출되면 안 됨을 검증하는 페이크 값"임을 드러내고
  실제 시크릿 포맷(`wsk_` prefix + 실제 hex 등)과 다르다 — 하드코딩된 실 시크릿이 아니다.
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.spec.ts`,
    `codebase/backend/src/repo-guards/__tests__/fixtures/dto/responses/optional-nullable.fixture.ts`
  - 제안: 조치 불요.

- **[INFO]** 새 정적 가드(`findOptionalNullableResponseFields`, `swagger-dto-contract-guard.ts`)는
  `fs.readFileSync` + TS AST 파싱으로 저장소 내 파일만 읽으며, 경로는 테스트 코드가 전달하는
  고정 glob 결과이지 외부/사용자 입력이 아니다 — 경로 탐색·임의 파일 읽기 위험 없음.
  - 위치: `codebase/backend/src/repo-guards/__tests__/swagger-dto-contract-guard.ts` (`findOptionalNullableResponseFields`)
  - 제안: 조치 불요.

인젝션(SQL/XSS/커맨드/경로탐색), 인증/인가 우회, 안전하지 않은 암호화 알고리즘, 신규
의존성 도입은 이 diff 범위에서 관측되지 않았다. `schedules.controller.ts`/`triggers.service.ts`
의 기존 워크스페이스 스코핑(`workspaceId` where 절)은 이번 변경으로 훼손되지 않았다.

## 요약

이 PR 은 취약점을 만드는 diff 가 아니라 **실제 시크릿 유출(트리거 회전 secret 4곳)을
막는 diff** 다. 수정은 엔티티 컬럼·JSONB 세 축·조인 유출까지 네 지점을 정합적으로
덮고, 되돌림 뮤테이션 기반 회귀 테스트(unit + e2e)로 각 지점을 개별적으로 고정했다.
에러 처리도 CWE-209 를 의식해 클라이언트에는 고정 문구만, 진단은 서버 로그로 분리했다.
새로 선언된 DTO 필드들은 전부 "이미 wire 에 있던 값을 문서화"하는 것이라 신규 노출을
만들지 않는다. 남은 관찰(외부 provider 에러 메시지의 장기 감사 필요성, install token 이
URL 에 실리는 기존 설계)은 이 PR 범위 밖의 기존 동작이라 INFO 로만 기록한다.

## 위험도
NONE
