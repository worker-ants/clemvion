# 보안(Security) Review

## 컨텍스트

이 PR(`sweep-response-contract`)은 응답-계약 검증자(§5.4)를 4→18개 DTO로 넓히는 작업이며,
그 과정에서 실측으로 발견한 **두 건의 실제 secret 유출**(트리거 `notificationSecretV2`
평문 서명 secret · `chatChannelTokenV2` secret store ref가 `GET/POST/PATCH /api/triggers`와
`GET/PATCH /api/schedules`에 선언 없이 실려 나감)과, 리뷰 라운드 도중 자신이 만든
**CWE-209(정보 노출) 회귀**(스케줄 `trigger` 미로드 시 500 에러 본문에 `schedule.id`·
컬럼명·조인 힌트가 그대로 실림)를 함께 고쳤다. `codebase/backend/src/modules/triggers/
triggers.service.ts`, `schedules.controller.ts`, 관련 DTO·e2e/unit 테스트를 직접 열어
현재 HEAD(`fdb9b7caf`) 기준으로 대조했다.

## 발견사항

- **[WARNING]** `TriggersService.sanitizeForResponse`의 비밀 제거가 **deny-list 4벌**
  (`CHAT_CHANNEL_RESPONSE_STRIP_KEYS` · `NOTIFICATION_SIGNING_STRIP_KEYS` ·
  `INTERACTION_RESPONSE_STRIP_KEYS` · `TRIGGER_RESPONSE_STRIP_COLUMNS`)로 구성되어 있고,
  이 방식이 **같은 리뷰 사이클 안에서 이미 세 번** 실제 누락을 냈다(엔티티 컬럼 축 →
  `notification.signing` 축 → `config.interaction.triggerToken` 축, 순차 발견).
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts` — 함수
    `sanitizeForResponse` 및 상수 `CHAT_CHANNEL_RESPONSE_STRIP_KEYS` /
    `NOTIFICATION_SIGNING_STRIP_KEYS` / `INTERACTION_RESPONSE_STRIP_KEYS` /
    `TRIGGER_RESPONSE_STRIP_COLUMNS` 선언부.
  - 상세: deny-list는 구조적으로 fail-open이다 — 새 비밀 필드가 추가될 때 어느 목록에도
    올리지 않으면 조용히 응답에 실린다. 이번 PR이 그 실패 모드를 세 번 반복 관측했다는
    사실 자체가 이 패턴의 위험성에 대한 실증이다. 다만 이 PR은 **이미 이 사실을 인지하고
    `plan/in-progress/spec-draft-nullable-notation-followups.md`에 "선언적 SoT(`@Sensitive()`
    데코레이터)로 전환" 항목을 후속으로 등재**했으며, 현재 시점에는 `secret-store.md §1.1`이
    금지한 세 필드(`AuthConfig.config` 자격증명·`Trigger.notification_secret_v2`·
    `Trigger.config.interaction.triggerToken`)와 엔티티 컬럼 2종이 전부 목록에 반영돼
    있음을 코드에서 직접 확인했다.
  - 제안: 조치 불요(이미 추적 중) — 다만 다음에 이 파일을 다시 열 때는 목록에 항목을
    더 추가하는 대신 후속 항목에 적힌 대로 리플렉션 기반 선언적 SoT 전환을 우선 검토할 것.

- **[INFO]** `TriggerDto.config`가 `@ApiProperty({ type: 'object', additionalProperties: true })`
  로 선언된 **열린 맵**이라, 정적 가드(`swagger-dto-contract-guard.ts`)와 런타임 계약
  검증자(`response-contract.ts`) 양쪽 모두 그 안으로 내려가지 못한다.
  - 위치: `codebase/backend/src/modules/triggers/dto/responses/trigger-response.dto.ts:60`
    (`config: Record<string, unknown>;` 선언), 대조 방어는
    `codebase/backend/test/chat-channel-trigger-create.e2e-spec.ts:137`·
    `codebase/backend/test/schedule-trigger.e2e-spec.ts:265-269`의 수기
    `not.toHaveProperty`/`assertMatchesContract`.
  - 상세: `config.interaction.triggerToken`·`config.notification.signing.secret` 같은
    JSONB 내부 비밀 필드의 스트립 여부는 현재 **손으로 짠 e2e 단언에만** 의존한다. 이번
    PR이 그 사각지대를 처음 문서화하고 실제 e2e로 메웠지만(뮤테이션 확인됨), 자동 이중
    안전망이 없어 다음에 같은 자리에 새 비밀 필드가 추가되면 그 사실을 기억해야만
    보호가 이어진다. 이 역시 plan에 "규약에 명시 필요" 항목으로 이미 등재돼 있다.
  - 제안: 조치 불요(이미 추적 중). planner 턴에서 `secret-store.md`/`2-api-convention.md
    §5.4`에 "열린 맵 안 비밀은 e2e `not.toHaveProperty` 필수" 규범을 명문화하는 후속을
    당길 것을 권고.

- **[INFO]** CWE-209(정보 노출) 회귀가 이번 PR 사이클 안에서 발생했다가 최신 커밋에서
  정정됐음을 확인.
  - 위치: `codebase/backend/src/modules/schedules/schedules.controller.ts` 의
    `toResponse` 메서드(트리거 미로드 시 분기), `codebase/backend/src/common/filters/
    http-exception.filter.ts` (`catch` 메서드 52-77행 — `HttpException.getResponse()`의
    `code`/`message`를 그대로 응답 바디에 싣는 동작).
  - 상세: `GlobalExceptionFilter`는 `HttpException`의 `message`를 마스킹 없이 그대로
    클라이언트 응답에 흘린다(마스킹은 매핑되지 않은 순수 `Error`에만 적용). 직전 커밋은
    `InternalServerErrorException`에 `schedule.id`·컬럼명(`trigger_id`)·조인 추론 문자열을
    그대로 넘겨 500 응답 바디로 노출시켰다. 최신 커밋(`fdb9b7caf`)이 진단을
    `this.logger.error(...)`로만 남기고, 클라이언트에는
    `{ code: 'INTERNAL_ERROR', message: '서버 오류가 발생했습니다...' }` 고정 문구만
    던지도록 정정했다. `schedules.controller.spec.ts`의 신규 유닛 테스트가 예외 직렬화
    전체(`JSON.stringify`)에 `schedule.id`·`trigger_id`·`join` 문자열이 없음을 단언하고,
    필터 구현을 직접 대조해 `code`/`message` 필드만 통과함을 확인했다 — 정정이 유효하다.
  - 제안: 조치 불요 — 이미 올바르게 수정 및 회귀 테스트로 고정됨. 참고 기록.

- **[INFO]** 감사 로그(`recordAudit`) 호출은 `resourceId`·`type`만 넘기며 트리거/스케줄
  엔티티 전체나 `config`를 넘기지 않음을 확인 — 별도 감사 로그 유출 경로 없음.
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts` 의
    `rotateNotificationSecret`(1121-1127행 부근) · `revokePerTriggerToken`(1169-1175행
    부근) · `rotateBotToken`(1313행 부근) 각 `recordAudit(...)` 호출부.
  - 제안: 조치 불요.

- **[INFO]** 새로 선언된 DTO 필드(`TriggerDto`의 `chatChannel*`/`notification*` 상태·시각
  필드, `IntegrationDto`의 `appUrl`/`mallId`/`tokenExpiresAt`/`lastRotatedAt`/
  `lastUsedAt`/`consecutiveNetworkFailures`, `KnowledgeBaseDto`의 리랭크·임베딩 설정 ID들,
  `AlertRuleDto`의 `createdBy`/`lastTriggeredAt`, `ScheduleDto`의 `trigger` 참조)는 전부
  비밀이 아닌 메타데이터/식별자이며, 정작 제거 대상인 `notificationSecretV2` ·
  `chatChannelTokenV2` · `triggerToken`은 어느 DTO에도 선언되지 않았다 — 선언 표면과
  코드의 스트립 로직이 서로 일치함을 확인.
  - 위치: `codebase/backend/src/modules/triggers/dto/responses/trigger-response.dto.ts`,
    `codebase/backend/src/modules/schedules/dto/responses/schedule-response.dto.ts`.
  - 제안: 조치 불요.

- **[INFO]** `response-contract.ts`/`swagger-dto-contract-guard.ts`는 `tsconfig.build.json`
  에서 제외되는 테스트 전용 유틸리티로, `fs.readFileSync`가 읽는 경로도 저장소 내부
  glob 산출물이라 공격자 통제 입력이 아니다 — 프로덕션 런타임 공격 표면에 해당하지 않음.
  - 제안: 조치 불요.

## 요약

이 PR은 신규 취약점을 도입하지 않는다 — 오히려 §5.4 응답-계약 검증자를 넓히는 과정에서
실측으로 드러난 두 건의 실제 secret 유출(트리거 회전용 평문 서명 secret과 secret-store
참조가 `/api/triggers`·`/api/schedules` 양쪽에서 응답 경계 없이 새어 나가던 것)을 코드
전체에서 확인 가능한 형태(축별 strip 함수 + 컨트롤러 경계에서의 참조 필드 좁히기)로
막았고, 리뷰 사이클 도중 스스로 만든 CWE-209 회귀(500 에러 바디에 내부 스키마 정보 노출)도
최신 커밋에서 올바르게 정정했다 — `GlobalExceptionFilter` 구현을 직접 대조해 정정이
유효함을 확인했다. 감사 로그·새로 선언된 DTO 필드에서 추가 유출 경로는 발견되지 않았다.
남은 리스크는 두 가지이며 둘 다 팀이 이미 인지하고 `plan/in-progress/
spec-draft-nullable-notation-followups.md`에 후속 항목으로 등재해 둔 상태다: (1) 비밀
제거 로직이 여전히 deny-list 4벌 구조라 구조적으로 fail-open이고 이미 세 번의 누락
전례가 있다는 점, (2) `TriggerDto.config`가 열린 맵이라 그 안의 신규 비밀은 자동 계약
검증기가 못 보고 수기 e2e 단언에만 의존한다는 점. 둘 다 이번 diff에서 새로 만든 문제가
아니라 기존 설계의 잔여 위험이며, 즉시 차단할 사유는 아니라고 판단해 WARNING/INFO로만
기록한다. 인젝션·하드코딩된 시크릿·인가 우회·안전하지 않은 암호화 사용은 발견되지 않았다.

## 위험도
LOW
