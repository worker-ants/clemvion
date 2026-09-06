# 요구사항(Requirement) 리뷰

## 검토 방법

`git diff origin/main` 으로 전체 diff(codebase/, spec/, plan/, CHANGELOG.md 32개 파일, 1568행
추가)를 직접 열람하고, 프롬프트에서 생략된 파일(`triggers.service.ts`,
`schedules.controller.ts`, `schedules.service.ts`, `response-contract.ts`,
`swagger-dto-contract-guard.ts`, `swagger-dto-contract.spec.ts`, `triggers.service.spec.ts`,
`schedule-trigger.e2e-spec.ts`, `chat-channel-trigger-create.e2e-spec.ts`, CHANGELOG.md)를
전문 Read 했다. 추가로 관련 엔티티(`trigger.entity.ts`, `schedule.entity.ts`,
`alert-rule.entity.ts`, `knowledge-base.entity.ts`, `integrations.service.ts`)와 관련 spec
문서(`spec/conventions/secret-store.md §1`, `spec/5-system/14-external-interaction-api.md
§7.1`, `spec/2-navigation/1-workflow-list.md`)를 대조했다. 저장소에 아무 것도 쓰지 않았다
(`git status --short` 로 최종 확인 — 세션 자신의 review 산출물 디렉터리 2개만 untracked).

이 PR 은 이미 **7라운드 코드 리뷰 + 5라운드 consistency 검토**를 거쳤고, 각 라운드의
`RESOLUTION.md` 가 지적사항 조치와 lint/unit/build/e2e PASS 를 기록하고 있다. 아래는 그
누적 위에서 최종 산출물(HEAD, 커밋 `48704becd`)을 원점 재검증한 결과다.

## 발견사항

- **[INFO]** 비밀 스트립 목록이 4벌(`CHAT_CHANNEL_RESPONSE_STRIP_KEYS` ·
  `NOTIFICATION_SIGNING_STRIP_KEYS` · `INTERACTION_RESPONSE_STRIP_KEYS` ·
  `TRIGGER_RESPONSE_STRIP_COLUMNS`)로 늘었고, `sanitizeForResponse` 자신의 JSDoc 이 "세 번째
  까지 좁게 틀렸다"·"다음 축이 하나 더 생기면 목록 대신 선언적 SoT 로 옮길 것" 이라고 스스로
  인정한다.
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts` — `sanitizeForResponse`
    메서드 JSDoc(`## 왜 세 목록인가` 절) 및 4개 상수 선언부.
  - 상세: 이 패턴(비밀이 사는 자리가 늘 때마다 수기 deny-list 를 하나 더 추가)은 fail-open
    이다 — 다섯 번째 비밀 필드가 새 config 축이나 새 엔티티 컬럼으로 생기면, 그 필드를 어느
    목록에도 넣지 않는 실수가 컴파일 타임에 잡히지 않는다. 실제로 이 PR 안에서 세 번 같은
    형태로 좁게 틀렸던 이력(chat-channel 만 → notification.signing 누락 → interaction 누락)이
    그 위험을 실증한다. 다만 이 위험은 **developer 스스로 JSDoc 에 명시적으로 인지·기록**했고
    ("다짐 대신 배치 규칙" 등 여러 라운드에 걸쳐 이미 다뤄진 항목), 3~4번째 재발 시 승격
    기준(`@Sensitive()` 데코레이터 등)까지 적어 두었다. 새로운 발견이 아니라 기존에 알려진
    채무이므로 CRITICAL/WARNING 으로 격상하지 않는다.
  - 제안: 조치 불요 — 이미 추적 중. 다섯 번째 비밀 축이 생기면 선언적 SoT 전환을 그 PR 의
    필수 조건으로 삼을 것.

- **[INFO]** `IntegrationDto.consecutiveNetworkFailures` 는 프런트엔드 소비가 0곳인 내부
  health 카운터인데도 응답 계약에 선언됐다.
  - 위치: `codebase/backend/src/modules/integrations/dto/responses/integration-response.dto.ts`
    (`consecutiveNetworkFailures: number;` 필드, 상단 JSDoc).
  - 상세: PR 자신의 주석과 CHANGELOG 가 "제거가 나은 후보이나 wire 변경이라 별도 항목으로
    미룬다" 고 명시적으로 인정한다. 이 PR 의 원칙("이미 나가고 있는 것을 선언에 맞춘다" —
    wire 불변)에는 부합하는 최소 개입이라 이번 스코프 밖 판단은 타당하다.
  - 제안: 조치 불요 — 별도 트래커 항목으로 이미 등재.

- **[INFO]** spec fidelity 대조 결과 — 이번 diff 가 참조하는 spec 본문(`secret-store.md §1·
  §1.1`, `14-external-interaction-api.md §7.1`, `1-workflow-list.md` §formatVersion)은 모두
  코드와 line-level 로 일치한다.
  - 상세: (1) `notification_secret_v2` 가 rotation grace 24h 동안 평문이라는 코드의 주석은
    `14-external-interaction-api.md:924-941` 의 "정정 이력 (2026-09-05)" 절과 정확히 일치한다
    — 이전 라운드(consistency `19_08_19`)가 지적한 spec-코드 모순(Critical)은 이미 planner
    턴으로 spec 이 정정되어 해소됐다. (2) `secret-store.md:42,52` 가 `triggerToken` ·
    `notification_secret_v2` 를 이름으로 명시한 "비대상" 예외 목록과, §1.1(:86-90)의 "비대상도
    응답 바디에는 나가지 않는다" 요구가 `INTERACTION_RESPONSE_STRIP_KEYS` /
    `TRIGGER_RESPONSE_STRIP_COLUMNS` 구현과 정확히 대응한다. (3)
    `workflow-crud.e2e-spec.ts` 의 `allowMissing: ['formatVersion']` 은
    `spec/2-navigation/1-workflow-list.md:153` 의 "포맷 버전 협상은 미구현 (Planned)" 명시적
    갭 서술과 일치한다 — 발견사항이 아니라 검증 확인 기록.
  - 제안: 조치 불요.

- **[INFO]** 필드 레벨 정합성 재검증 — 5개 응답 DTO 에 추가된 24개 필드(`createdBy` ·
  `lastTriggeredAt` · `appUrl` · `mallId` · `tokenExpiresAt` · `lastRotatedAt` · `lastUsedAt` ·
  `consecutiveNetworkFailures` · `documentCount` · `embeddingModelConfigId` · `rerankMode` ·
  `rerankCandidateK` · `rerankScoreThreshold` · `rerankConfigId` · `rerankLlmConfigId` ·
  `chatChannelHealth` 등 7개 · `trigger`)을 각 엔티티 컬럼 정의(`alert-rule.entity.ts` ·
  `knowledge-base.entity.ts` · `trigger.entity.ts` · `schedule.entity.ts` ·
  `integrations.service.ts.toPublic`)와 1:1 대조했다. nullable 여부·타입·enum 값이 모두
  일치한다 (`chatChannelHealth`/`notificationHealth` 의 `'unknown'|'healthy'|'degraded'` 는
  entity 의 `TriggerChatChannelHealth`/`TriggerNotificationHealth` 타입 alias 와 정확히
  동일). `EXPECTED_OPTIONAL_NULLABLE_DRIFT` 배열의 실제 항목 수(78) 와 CHANGELOG 의 "78건"
  서술도 실측 카운트로 일치를 확인했다.
  - 제안: 조치 불요 — 검증 확인 기록.

- **[INFO]** `Schedule.trigger`/`Trigger.workflow` 의 "네 경로 모두 채운다"/"생성에만 없다"
  는 서술을 `schedules.service.ts`·`schedules.controller.ts` 실제 코드 경로로 재확인했다.
  `findAll`(leftJoinAndSelect) · `findById`(relations) · `create`(`saved.trigger =
  savedTrigger` 가 `if(isActive)` 밖으로 이동) · `update`(`saved.trigger = trigger ??
  schedule.trigger` 가 마찬가지로 조건 밖) 네 경로 모두 실제로 `trigger` 를 채우며, `create()`
  만 `workflow` relation 이 로드되지 않는다(방금 저장한 엔티티에는 관계가 attach 되지 않음)는
  claim 도 코드로 확인된다. `ScheduleTriggerRefDto.workflow` 를 `@ApiPropertyOptional`(키
  생략형)로 선언한 것과 `ScheduleDto.trigger` 를 `@ApiProperty`(상시 존재)로 선언한 것이
  실제 다다름 여부와 정확히 일치한다.
  - 제안: 조치 불요 — 검증 확인 기록.

## 요약

`sweep-response-contract` 워크트리의 최종 상태를 원점(entity 정의 · spec 본문 · import
해석)까지 재검증한 결과, 이번 diff 는 요구사항을 충족한다. 핵심 보안 수정(트리거 회전
secret 2종 + interaction 토큰의 응답 유출을 4개 경로/2개 엔드포인트에서 차단)은 unit(fixture
에 실제 비밀 값을 채운 뮤테이션 테스트)과 e2e(실제 HTTP 응답에서 부재를 단언하되 발급을
먼저 시켜 vacuous 를 막음) 양쪽에서 뮤턴트 RED 로 검증됐고, 24개 신규 DTO 필드 선언은 엔티티
컬럼/서비스 기본값과 nullable·타입·enum 이 전부 일치한다. 응답-계약 검증자 배선(14개 e2e,
4→18 DTO)과 §5.4 금지 조합 래칫(78건 고정, 자기 검증용 양성 대조군 포함)은 스캔 범위·판별력이
실측으로 확인돼 있다. spec 본문(secret-store.md, external-interaction-api.md,
1-workflow-list.md) 과의 line-level 대조에서도 불일치를 발견하지 못했다 — 이전 라운드가
찾은 spec-코드 모순(Critical, notification_secret_v2 의 "ref 만 보관" 서술)은 이미 별도
planner 턴으로 spec 이 정정되어 해소된 상태다. 남은 항목은 전부 이미 문서화·추적 중인
의도적 유예(deny-list 4벌의 구조적 한계, `consecutiveNetworkFailures` 제거 검토)로, 이번
diff 의 완전성을 해치지 않는다.

## 위험도

NONE
