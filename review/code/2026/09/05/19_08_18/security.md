# 보안(Security) 코드 리뷰

## 검증 방법

이 changeset(§5.4 응답-계약 스윕 1차 + 후속 fix 커밋들)은 이전 리뷰 라운드
(`review/code/2026/09/05/18_23_02`, `review/consistency/2026/09/05/18_23_03`)에서 이미
Critical 1건(`notification.signing.secretRef` 미스트립) · Critical 2건(§5.4 금지 조합
`@ApiPropertyOptional({nullable:true})` 재도입)이 지적됐고, 그 RESOLUTION.md 들이 "조치 완료"를
주장한다. 재검증을 위해 저장소를 뮤테이션하지 않고 `Read`/`grep` 으로 현재 워킹트리의 실제 코드를
직접 열어 그 주장을 대조했다(저장소 쓰기 없음 — `git status --short` 로 확인, 이번 세션이 만든
리뷰 산출물 디렉터리 2개 외 변경 없음).

## 발견사항

- **[INFO]** (검증됨 — 결함 아님) `TriggersService.sanitizeForResponse` 가 트리거 응답에서
  비밀이 사는 세 자리를 모두 덮는다.
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts` — `sanitizeForResponse`
    (약 570~633행), 상수 정의는 53행(`CHAT_CHANNEL_RESPONSE_STRIP_KEYS`)·88행
    (`NOTIFICATION_SIGNING_STRIP_KEYS`, 신설)·93행(`TRIGGER_RESPONSE_STRIP_COLUMNS`).
  - 상세: 이전 라운드가 지적한 `config.notification.signing.secretRef`(secret-store 참조) 미스트립
    WARNING 이 `NOTIFICATION_SIGNING_STRIP_KEYS`(`'secret'`, `'secretRef'`) 신설로 고쳐져 있음을
    직접 확인했다. 또한 이 스트립이 `cfg.chatChannel` 유무와 **무관하게** 실행되도록 배선돼
    있다(601~616행이 `if (cfg.chatChannel)` 블록 밖에 독립적으로 존재) — "chat-channel 이 아닌
    트리거는 config 정화를 거치지 않는다"는 조기 return 류 재발이 없다. 엔티티 컬럼
    (`notificationSecretV2`/`chatChannelTokenV2`) 스트립도 `overrides[column] = undefined` 로
    먼저 채우는 죽은 코드 없이 `delete` 단일 루프로 정리돼 있다(maintainability WARNING 도 함께
    해소).
  - 제안: 없음. 재확인 완료.

- **[INFO]** (검증됨 — 결함 아님) 응답 바디에서 금지된 `@ApiPropertyOptional({nullable:true})`
  + `field?: T | null` 조합이 신규 선언 필드에서 제거됐다.
  - 위치: `codebase/backend/src/modules/triggers/dto/responses/trigger-response.dto.ts:76-102`,
    `codebase/backend/src/modules/integrations/dto/responses/integration-response.dto.ts:133-161`,
    `codebase/backend/src/modules/knowledge-base/dto/responses/knowledge-base-response.dto.ts`,
    `codebase/backend/src/modules/alerts/dto/responses/alert-rule-response.dto.ts:63-69`.
  - 상세: 위 파일들을 직접 열어 확인한 결과 신규 필드 전부 `@ApiProperty({ nullable: true })`
    + `field: T | null`(non-optional) 형태다. 반대 방향 위반(`ScheduleDto.trigger` 가 순수
    키-생략 케이스인데 `nullable: true` 까지 붙었던 것)도 현재
    `schedule-response.dto.ts:91` 에서 `@ApiPropertyOptional({ type: () => ScheduleTriggerRefDto })`
    + `trigger?: ScheduleTriggerRefDto`(`| null` 없음)로 정정되어 있고, 컨트롤러
    (`schedules.controller.ts` `toResponse`)도 트리거가 없으면 `null` 이 아니라 **키 자체를
    생략**(`rest` 반환)하도록 배선돼 있음을 확인했다. `enum` 누락 지적(`chatChannelHealth` 등)도
    현재 코드에 `enum: [...]` 이 선언돼 있어 해소됐다.
  - 제안: 없음. 재확인 완료. `swagger-dto-contract-guard.ts` 의 신규 축
    (`findOptionalNullableResponseFields`)과 `EXPECTED_OPTIONAL_NULLABLE_DRIFT` 베이스라인
    (`swagger-dto-contract.spec.ts:365`)도 존재를 확인했다 — 이 조합이 다시 늘어나면 회귀
    테스트가 잡는 구조다.

- **[INFO]** 응답 정화가 엔티티 메타데이터가 아닌 서비스 레이어의 수기 allow/deny 목록(현재
  세 벌: `CHAT_CHANNEL_RESPONSE_STRIP_KEYS`, `NOTIFICATION_SIGNING_STRIP_KEYS`,
  `TRIGGER_RESPONSE_STRIP_COLUMNS`)에 의존하는 구조적 특성은 여전히 남아 있다.
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts`.
  - 상세: 이번 라운드에서 실제로 두 차례(엔티티 컬럼 축, `notification.signing` 축) 같은 병이
    재발한 것 자체가 이 구조의 위험을 실증한다. 다만 이는 이미 이전 architecture 리뷰에서
    INFO 로 기록됐고(`@Sensitive()` 데코레이터 같은 선언적 대안 제안), 이번 PR 을 막을 사유가
    아니라 향후(세 번째 재발 시) convention 승격 후보로 plan 에 남아 있다. 새로운 결함이
    아니므로 여기서는 참고 기록만 남긴다.
  - 제안: 조치 불요(추적 중). 다음에 `Trigger` 에 새 비밀 컬럼이 추가될 때 이 목록 갱신을
    누락하지 않도록 코드 리뷰 시 이 구조를 재확인할 것.

- **[INFO]** `IntegrationDto.consecutiveNetworkFailures` (내부 health 카운터)가 응답에 계속
  노출된다 — 프런트엔드 소비처 0곳(코드 주석·plan 트래커에 실측 기록됨).
  - 위치: `codebase/backend/src/modules/integrations/dto/responses/integration-response.dto.ts:145-152`.
  - 상세: 직접 확인 결과 CHANGELOG·`plan/in-progress/spec-draft-nullable-notation-followups.md`
    양쪽에 "제거는 wire 변경이라 별도 항목"이라고 명시적으로 스코프 밖에 둔 것으로 문서화돼
    있다. 자격 증명이나 직접적 민감 정보는 아니라(순수 카운터) 보안 심각도는 낮다.
  - 제안: 조치 불요 — 이미 추적 중인 항목.

## 요약

이 changeset 의 핵심 보안 조치 — `TriggersService` 응답 경계에서 회전 서명 secret
(`notificationSecretV2`, 평문)과 secret-store 참조(`chatChannelTokenV2`, `notification.signing.
secretRef`/`secret`)를 모두 제거하고, `GET/POST/PATCH /api/schedules` 가 조인을 타고 같은 비밀을
노출하던 경로를 컨트롤러 응답 경계에서 참조 4필드로 좁힌 것 — 는 현재 워킹트리에서 직접 코드를
열어 재검증한 결과 의도대로 정확히 구현되어 있다. 이전 라운드에서 지적된 Critical(§5.4 금지 조합
재도입 2건)과 WARNING(signing.secretRef 미스트립, 죽은 코드, enum 누락, CHANGELOG 수치 불일치)이
모두 실제 코드/문서 수정으로 해소된 상태임을 확인했으며, 새로운 인젝션·인증 우회·하드코딩 시크릿·
안전하지 않은 암호화 관련 결함은 diff 범위 내에서 발견되지 않았다. 남은 항목은 구조적 개선
여지(수기 strip 목록 방식)와 이미 추적 중인 wire-변경 후보(`consecutiveNetworkFailures`) 뿐이며,
둘 다 이번 PR 을 막을 사유가 아니다.

## 위험도

NONE
