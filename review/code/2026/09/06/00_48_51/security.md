# 보안(Security) 코드 리뷰

대상: `sweep-response-contract-5ba0ad` — §5.4 응답-계약 검증자 배선 확대(4→18 DTO) +
그 과정에서 실측으로 드러난 트리거/스케줄 회전-secret 유출 수정. `origin/main...HEAD` 전체
diff(`codebase/**` 31개 파일)와 `CHANGELOG.md`·`spec/conventions/secret-store.md`·
`Trigger` 엔티티를 직접 열어 대조했다. `review/**` 아래의 과거 라운드 산출물(RESOLUTION 등,
100여 개)은 이 세션이 검토할 "변경"이 아니라 이 PR 자신이 이미 거친 리뷰 이력이므로 참고
자료로만 썼고 별도 발견사항으로 세지 않았다.

## 발견사항

- **[WARNING]** 새로 추가된 500 에러 메시지가 내부 스키마·쿼리 구현 세부사항을 클라이언트에
  그대로 노출한다 — 이 저장소의 `GlobalExceptionFilter` 자신이 명시한 CWE-209 방지 원칙과
  충돌한다.
  - 위치: `codebase/backend/src/modules/schedules/schedules.controller.ts:82-83`
    (`SchedulesController.toResponse`)
  - 상세: 신설된 `toResponse()`가 `trigger`가 로드되지 않은 경우
    `throw new InternalServerErrorException(\`Schedule ${schedule.id} has no loaded trigger — schedule.trigger_id is NOT NULL, so this means the query forgot the join/relation (or the row is orphaned).\`)`
    를 던진다. `codebase/backend/src/common/filters/http-exception.filter.ts`(`GlobalExceptionFilter.catch`,
    52-77행)를 보면 `exception instanceof HttpException`(`InternalServerErrorException`도
    포함)인 경우 **상태 코드와 무관하게** `exceptionResponse.message`를 그대로 클라이언트
    응답의 `error.message`로 echo한다. 반대로 같은 필터의 `mapHttpErrorLike`(118-138행)와
    `else if (exception instanceof Error)` 분기(84-96행)는 "5xx·상태 부재는 null을 반환해
    호출부가 generic 500으로 마스킹(내부 메시지 누출 차단)" · "CWE-209 방지를 위해 내부
    원문을 echo하지 않고 상태 기반 고정 문구만 쓴다"고 **명시적으로 설계**돼 있다. 즉 이
    필터는 "일반 `Error`"에는 CWE-209 마스킹을 적용하면서 `HttpException`(`InternalServerErrorException`
    포함)에는 적용하지 않는 기존 구조적 간극이 있고, 이번 PR이 바로 그 간극을 통해
    "`schedule.trigger_id`가 NOT NULL이다", "쿼리가 join/relation을 빠뜨렸다"는 내부 데이터
    모델·쿼리 구현 정보를 담은 메시지를 새로 하나 더 그 경로로 흘려보낸다.
  - 참고: 코드 주석이 "정상 데이터로는 도달 불가"(`Schedule.trigger_id` NOT NULL +
    FK `onDelete: 'CASCADE'`)라고 밝히고 있어 외부 입력만으로 이 분기를 고의로 트리거하기는
    어렵다 — 그래서 심각도를 WARNING(CRITICAL 아님)으로 매겼다. 다만 데이터 정합성 버그나
    복제 지연 등 예외적 상황에서 실제로 500이 나가면, 응답 사용자는 스키마 제약조건 이름과
    쿼리 작성 힌트("forgot the join/relation")를 그대로 받는다 — 공격자에게 내부 구조를
    알려주는 정찰(reconnaissance) 정보다. 저장소에 기존 선례(`auth-oauth.service.ts`,
    `integration-oauth.service.ts`, `*-oauth.strategy.ts`의 `OAUTH_CONFIG_MISSING`)가 있어
    이 패턴 자체가 이 PR의 발명은 아니지만, 그 선례들은 "어떤 env var가 비었다"는 배포
    설정 정보를 노출하는 데 그치는 반면 이번 것은 DB 스키마 제약·쿼리 구조를 노출한다는
    점에서 노출 정보의 등급이 다르다.
  - 제안: 클라이언트에는 일반화된 메시지(예: 상태 코드 그대로 두고
    `'Schedule data is inconsistent.'` 같은 고정 문구)만 반환하고, 상세 진단 문자열은
    `this.logger.error(...)`로 서버 로그에만 남긴다. 근본적으로는 `GlobalExceptionFilter`가
    `HttpException`이어도 5xx 상태에서는 `message`를 신뢰하지 않고 로그로 리다이렉트하는
    방향(기존 `mapHttpErrorLike`가 하는 것과 동형)을 검토할 가치가 있다 — 이 PR의 범위를
    넘는 더 큰 리팩터라 이번 항목만 좁혀 고치는 것을 권한다.

- **[INFO]** 트리거 응답 정화(`sanitizeForResponse`)가 deny-list(strip-list) 4벌로 구성돼
  있어, 신설되는 비밀 축을 매번 사람이 목록에 추가해야 막힌다 — fail-open 구조.
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts:74`
    (`NOTIFICATION_SIGNING_STRIP_KEYS`), `:94`(`TRIGGER_RESPONSE_STRIP_COLUMNS`),
    `:114`(`INTERACTION_RESPONSE_STRIP_KEYS`), `:50` 부근(`CHAT_CHANNEL_RESPONSE_STRIP_KEYS`,
    diff 밖 기존 상수)
  - 상세: 실제로 이 PR이 반영하는 CHANGELOG·주석 서사 자체가 이 패턴이 **세 번** 같은
    형태(좁은 목록 → 새 비밀 축 추가 시 다시 새는 사고)로 재발했음을 자인한다(`chat-channel`
    만 → `config.notification.signing` 누락 → `Trigger` 엔티티 컬럼 누락 → `config.interaction.triggerToken`
    누락). 코드 자신이 `sanitizeForResponse` JSDoc(약 650-680행)에 "다음 축이 생기면
    목록을 늘리지 말고 선언적 SoT(엔티티 데코레이터 등)로 옮길 것"이라고 명시적으로 남겨
    뒀고, `secret-store.md §1`도 같은 취지의 재발 경고를 담고 있다. 이미 인지·문서화된
    기술 부채라 이번 PR을 막을 사유는 아니지만, 다음에 `Trigger`나 `config`에 새 비밀
    필드가 추가될 때 이 위험이 그대로 재현될 수 있음을 리마인드로 남긴다.
  - 제안: 조치 불요(이미 다음 개발자를 향한 경고가 코드에 있음). 네 번째 비밀 축이 생기면
    그때 선언적 allow-list/데코레이터 방식으로의 전환을 우선 검토할 것.

- **[INFO]** `spec/conventions/secret-store.md §1`의 `Trigger.notification_secret_v2` 예외
  단락이 "노출 창은 아직 설계대로 닫혀 있지 않다 — 현행 구현은 `GET/POST/PATCH /api/triggers`와
  `GET /api/schedules` 응답에도 이 컬럼을 그대로 싣는다"고 적고 있는데, 이 PR이 바로 그
  창을 닫는다. `spec/`은 이 diff에서 델타 0(devleoper 권한 밖)이라 이 PR 자체는 그 문장을
  건드리지 않는다.
  - 위치: `spec/conventions/secret-store.md` §1, `Trigger.notification_secret_v2` 비대상
    단락(파일 내 `노출 창은 아직 설계대로 닫혀 있지 않다` 검색)
  - 상세: 이 서술은 머지 이후 사실과 어긋나게 되지만, **위험을 과소평가(안전한 방향)하는
    쪽**으로 낡는다 — "아직 열려 있다"는 실제보다 더 경계하라는 신호라 보안적으로 유해하지
    않다. 이미 이 워크트리의 여러 consistency-checker 라운드(`review/consistency/2026/09/05/21_40_38`
    W2 등)가 동일 지적을 planner 후속으로 `plan/in-progress/spec-draft-nullable-notation-followups.md`에
    등재해 뒀다.
  - 제안: 조치 불요(이미 추적 중, developer 권한 밖).

## 코드 확인 요약 (참고 — 발견사항 아님)

- **핵심 수정의 실질**: `TriggersService.sanitizeForResponse`(`triggers.service.ts`)가 비밀이
  사는 4개 축(config.chatChannel / config.notification.signing / config.interaction /
  `Trigger` 엔티티 컬럼 `notificationSecretV2`·`chatChannelTokenV2`)을 모두 덮도록 확장됐다.
  정화는 `Object.create(prototype) + Object.assign` 으로 만든 **새 객체**에서 수행되고
  (`deleteSecretColumns`가 그 사본만 변형), 원본 엔티티는 손대지 않으므로 DB 저장 경로에는
  영향이 없다 — 확인했다.
- `SchedulesController.toResponse`는 조인된 `Trigger` 전체를 deny-list로 지우는 대신
  `{ id, name, workflowId, workflow: { name } }` 형태로 **allow-list 방식**으로 좁혀
  반환한다 — strip 목록 누락 위험 자체가 구조적으로 없는 더 안전한 형태다.
  `Trigger.entities.ts`를 직접 열어 비밀 컬럼이 `notificationSecretV2`·`chatChannelTokenV2`
  두 개뿐임을 확인했고 둘 다 `TRIGGER_RESPONSE_STRIP_COLUMNS`에 등재돼 있다.
- 새로 선언에 편입된 필드들(`AlertRuleDto.createdBy/lastTriggeredAt`,
  `IntegrationDto.appUrl/mallId/tokenExpiresAt/lastRotatedAt/lastUsedAt/consecutiveNetworkFailures`,
  `KnowledgeBaseDto`의 7필드, `TriggerDto`의 chat-channel/notification health 7필드)은 전부
  메타데이터·상태 필드이거나 참조 ID이지 자격증명 원문이 아님을 확인했다 — 새로 노출되는
  시크릿은 없다.
- `response-contract.ts`(`contractForDto`/`assertMatchesContract`)와
  `swagger-dto-contract-guard.ts`는 `src/shared/testing/**` · `src/repo-guards/__tests__/**`
  아래 있고 `main.ts`/`app.module.ts`나 다른 production 소스에서 import되는 곳이 없음을
  grep으로 확인했다 — 테스트 전용 유틸리티라 production 공격 표면이 아니다.
- 하드코딩된 시크릿(API 키·비밀번호·인증서), SQL/커맨드 인젝션, `eval`/`child_process`류
  패턴은 diff 전체에서 발견되지 않았다. e2e 스펙에 등장하는 토큰은 모두 테스트가 그 자리에서
  발급받은 값이지 커밋에 박힌 값이 아니다.

## 요약

이 PR의 핵심은 트리거 회전-secret(평문 서명 secret `notificationSecretV2`, secret-store
ref `chatChannelTokenV2`, per-trigger bearer 토큰 `triggerToken`)이 `GET/POST/PATCH
/api/triggers`와 `GET/POST/PATCH /api/schedules`(조인 경유) 두 표면으로 새어 나가던 것을
막는 보안 수정이며, 정화 로직을 실제로 열어 확인한 결과 4개 비밀 축을 모두 덮고 원본
엔티티를 변형하지 않는 방식으로 견고하게 구현돼 있다. 새로 선언에 편입된 24개 필드는
전부 비-민감 메타데이터다. 새로 발견한 유일한 실질 이슈는 스케줄 컨트롤러에 추가된
`InternalServerErrorException`이 이 저장소 자신의 `GlobalExceptionFilter`가 다른 경로에서
명시적으로 지키는 CWE-209 원칙을 우회해 내부 스키마·쿼리 구현 정보를 클라이언트로 흘려보내는
것인데, 정상 데이터로는 도달 불가능한 방어적 분기라 심각도는 낮다. 나머지는 이미 문서화된
기술 부채(deny-list 구조)와 developer 권한 밖의 stale 문서 서술(안전한 방향으로만 낡음)로,
추가 조치를 요하지 않는다.

## 위험도

LOW
