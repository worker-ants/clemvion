# 요구사항(Requirement) 리뷰

## 검증 방법

프롬프트 페이로드는 275개 파일(대부분 과거 라운드의 `review/code/**`·`review/consistency/**`
산출물)을 나열하지만, 실질 기능 변경은 파일 1~35(코드베이스 34개 + plan 1개)뿐이다. 이
275개 목록 자체가 이미 10라운드에 걸친 코드리뷰·consistency 리뷰·resolution 이력이라는
점에서, 이번 라운드가 다룰 신규 표면은 마지막 커밋(`0de16b488`, `triggers.service.ts`
`relations: ['workflow']` 7줄 + `execution-response.dto.spec.ts` 33줄 + 신규
`schedule-trigger-ref.spec.ts` 89줄 + CHANGELOG/plan 문서)으로 좁다. 이번 리뷰는 그 신규
표면과, 과거 라운드가 이미 처리했다고 주장하는 핵심 로직(`sanitizeForResponse`,
`schedules.controller.ts#toResponse`, `response-contract.ts`)을 직접 열어 spec
(`spec/5-system/2-api-convention.md §5.4`, `spec/conventions/secret-store.md §1/§1.1`,
`spec/1-data-model.md §2.9.1`, `spec/2-navigation/4-integration.md §9.1`,
`spec/2-navigation/1-workflow-list.md`, `spec/5-system/3-error-handling.md`)과 line-level
로 대조하는 방식으로 수행했다. 저장소에 뮤테이션은 만들지 않았다(`git status --short` 로
확인 — 리뷰 세션이 생성한 `review/code/2026/09/06/01_38_46/`·
`review/consistency/2026/09/06/01_38_47/` 외 변경 없음).

## 발견사항

- **[INFO]** `secret-store.md §1` 의 `Trigger.notification_secret_v2` 비대상 등재 안의
  "노출 창은 아직 설계대로 닫혀 있지 않다" 서술이 이 브랜치의 수정으로 사실과 어긋나게
  됐다 (해당 창을 정확히 이 PR 이 닫는다).
  - 위치: `spec/conventions/secret-store.md` (`> **노출 창은 아직 설계대로 닫혀 있지
    않다.**` 로 시작하는 blockquote, §1 "비대상 — `Trigger.notification_secret_v2`" 항목
    안)
  - 상세: 코드(`triggers.service.ts` `TRIGGER_RESPONSE_STRIP_COLUMNS` +
    `schedules.controller.ts#toResponse`)는 두 응답 경로 모두에서 이 컬럼을 스트립하도록
    이미 고쳤는데, spec 은 여전히 현재형으로 "노출 창이 열려 있다" 고 말한다. 이는
    코드 결함이 아니라 spec 이 뒤처진 경우다 — `developer` 는 이 문장을 직접 쓰지
    않았으므로(자기반증형 소정정 예외 대상 아님) planner 턴이 필요하다.
  - **이미 발견되어 처리 경로가 정해져 있다**: `plan/in-progress/spec-draft-nullable-notation-followups.md`
    가 정확히 이 항목을 `[ ] **secret-store.md §1 의 "노출 창이 아직 닫혀 있지 않다" 가
    낡는다** (planner, 2026-09-05 등재, review/consistency/2026/09/05/21_40_38 W2)` 로
    이미 등재해 뒀고, "이 브랜치가 머지되는 순간 현재형 서술이 거짓이 된다" 고 developer
    스스로 명시했다. 즉 새 발견이 아니라 기존 발견의 재확인이다.
  - 제안: 코드 유지. spec 반영은 `project-planner` 가 `secret-store.md §1` 해당 blockquote
    에 "이 창은 `#…`(PR 번호) 로 닫혔다" 취지의 정정 이력 문장을 추가(§7.1 이 쓴 패턴 준용).
    plan 트래커가 이미 이 작업을 담고 있으므로 별도 신규 등재는 불필요.

- **[INFO]** 트리거 응답 비밀 스트립이 여전히 손으로 짠 `Set<string>` 4벌(deny-list)로
  구성돼 있어, 다음에 비밀 축이 하나 더 생기면 같은 유형의 누락이 재발할 구조적 위험이
  남아 있다.
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts` —
    `CHAT_CHANNEL_RESPONSE_STRIP_KEYS`·`NOTIFICATION_SIGNING_STRIP_KEYS`·
    `INTERACTION_RESPONSE_STRIP_KEYS`·`TRIGGER_RESPONSE_STRIP_COLUMNS`
  - 상세: 같은 세션 안에서 이 형태의 결함이 세 번 연속 재발했다는 사실을
    `sanitizeForResponse` JSDoc 자신이 인정하고 있고("세 번 같은 형태로 좁았다"), plan
    트래커도 이미 "트리거 비밀 스트립을 deny-list 4벌에서 선언적 SoT 로"(developer, 보안
    판단) 항목으로 등재해 뒀다. 현재 4벌은 §5.4·secret-store.md §1.1 이 요구하는 필드를
    실측상 전부 커버하는 것으로 확인했지만(아래 spec 대조 참조), "다음 필드"에 대한 구조적
    방어는 아니다.
  - 제안: 조치 불요(이미 plan 이 후속 작업으로 추적). 신규 코드 수정 요구 아님.

## Spec Fidelity 대조 (구현 vs spec 본문)

아래는 이번 diff 가 건드린 계약을 spec 본문과 직접 대조한 결과다 — 전부 **일치**를
확인했고, CRITICAL 급 불일치는 없었다.

- `ScheduleDto.trigger`(`@ApiProperty`, 상시 존재) ↔ `spec/1-data-model.md §2.9.1`
  ("Schedule.trigger_id는 NOT NULL — 반드시 Trigger와 1:1 매핑"): 일치. §5.4 의 "상시
  존재 → null-present 기본형" 규칙과도 일치.
- `TriggerDto`/`ScheduleDto` 의 §5.4 부재-표현 선언 형태 24개 필드 전부
  (`createdBy`/`lastTriggeredAt`/`appUrl`/`mallId`/`tokenExpiresAt`/`lastRotatedAt`/
  `lastUsedAt`/`consecutiveNetworkFailures`/`documentCount`/`embeddingModelConfigId`/
  `rerankMode`/`rerankCandidateK`/`rerankScoreThreshold`/`rerankConfigId`/
  `rerankLlmConfigId`/`chatChannelHealth`/`chatChannelLastError`/`chatChannelSetupAt`/
  `chatChannelRotatedAt`/`notificationHealth`/`notificationLastError`/
  `notificationRotatedAt`/`workflow?`)를 `spec/5-system/2-api-convention.md §5.4` 의
  "`null` 상시존재 → `@ApiProperty({nullable:true})` + `T|null`" / "키 생략 →
  `@ApiPropertyOptional()` + `T`(`|null` 금지)" 규칙과 하나씩 대조 — 전부 일치. 첫
  판(같은 세션의 이전 커밋)이 17개 필드를 금지 조합으로 잘못 선언했던 것은 이미 정정되어
  있다.
- `IntegrationDto.appUrl` ↔ `spec/2-navigation/4-integration.md` (§9.1 계열: "`(a)
  appUrl: string | null` … 그 외 통합은 `null`"): 일치. `IntegrationsService.toPublic` 이
  `{ appType: null, appUrl: null }` 베이스라인 위에 얹는 구조를 코드에서 직접 확인 —
  DTO 의 "상시 존재(null-present)" 선언과 일치한다.
- `workflow-crud.e2e-spec.ts` 의 `allowMissing: ['formatVersion']` ↔
  `spec/2-navigation/1-workflow-list.md:153` ("export 구현은 이 필드를 emit 하지 않고 …
  미구현 (Planned)"): 일치 — 문서화된 Planned 갭을 정확히 인용해 예외 처리했다.
- `SchedulesController#toResponse` 가 `trigger` 미로드 시 `InternalServerErrorException`
  으로 던지는 고정 문구("서버 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.") ↔
  `spec/5-system/3-error-handling.md:33` (`INTERNAL_ERROR` 행의 문구): **글자 그대로
  일치**.
- `GlobalExceptionFilter` 가 `HttpException.getResponse().message` 를 그대로 응답 바디에
  echo 한다는 코드 내부 주석의 주장 ↔ `codebase/backend/src/common/filters/http-exception.filter.ts:69-72`
  의 실제 구현: 일치 확인 — 그래서 `toResponse` 가 진단 문자열을 예외 인자로 넘기지 않고
  고정 문구만 넘기는 설계가 CWE-209 방지 목적에 정확히 부합한다.
- `secret-store.md §1.1` 이 열거한 응답 노출 금지 대상(`Trigger.config.interaction.
  triggerToken`·`Trigger.notification_secret_v2`·`Trigger.chat_channel_token_v2`·
  `config.*.botTokenRef`·`config.notification.signing.secretRef`) ↔
  `TriggersService.sanitizeForResponse` 의 4축(`CHAT_CHANNEL_RESPONSE_STRIP_KEYS`
  ⊇ `botTokenRef`·`inboundSigningRef` / `NOTIFICATION_SIGNING_STRIP_KEYS`
  = `{secret, secretRef}` / `INTERACTION_RESPONSE_STRIP_KEYS` = `{triggerToken}` /
  `TRIGGER_RESPONSE_STRIP_COLUMNS` = `{notificationSecretV2, chatChannelTokenV2}`):
  **전수 일치** — spec 이 이름으로 열거한 필드가 코드의 스트립 목록에 빠짐없이 대응한다.
- `TriggerDto.chatChannelHealth`/`notificationHealth` 의 TS 유니온 타입
  (`'unknown'|'healthy'|'degraded'`) ↔ `trigger.entity.ts` 의
  `TriggerChatChannelHealth`/`TriggerNotificationHealth` 타입 별칭: 일치.
- `AlertRuleDto.createdBy`/`lastTriggeredAt`, `KnowledgeBaseDto` 7필드
  (`documentCount`/`embeddingModelConfigId`/`rerankMode`/`rerankCandidateK`/
  `rerankScoreThreshold`/`rerankConfigId`/`rerankLlmConfigId`) ↔ 각 엔티티의 컬럼 타입:
  nullable 여부·타입 전부 일치.

## 기능 완전성 · 엣지 케이스 · 에러 시나리오 대조

- **`sanitizeForResponse` 네 축 오케스트레이션**: `create`/`update`/`findAll`/
  `findOneDetail` 네 경로 전부가 이 메서드를 거치는지 호출부를 전수 확인 — 빠짐없이
  경유한다. `config` 가 `null`/`undefined` 인 경우(`if (cfg)` 가드), `chatChannel`/
  `interaction`/`notification.signing` 각각이 없는 경우(각 `if` 가드)에 대한 분기가 모두
  존재해 `undefined` 접근으로 인한 예외 가능성이 없다.
- **`schedules.controller.ts#toResponse` 의 blast-radius 설계**: `findAll` 이 배열 전체를
  `map` 안에서 `toResponse` 호출하므로, 한 행에 트리거 관계가 비어 있으면 목록 전체가 500
  이 된다는 트레이드오프를 CHANGELOG·plan·코드 주석 3곳에 모두 명시했고, `Schedule.trigger_id`
  NOT NULL + FK CASCADE 라는 근거도 §2.9.1 과 일치해 "정상 데이터로는 도달 불가" 주장이
  검증 가능하다. 그 외 4개 컨트롤러 핸들러(`getPreview`/`previewExpression`/`runNow`/
  `remove`)는 `ScheduleDto` 형태를 반환하지 않으므로 `toResponse` 를 거치지 않는 것이
  맞다 — 누락이 아니라 범위 밖.
- **`create()` vs `update()` 의 `trigger.workflow` 부재 대칭성**: `create()` 의 chatChannel
  재조회는 `relations` 없이 하는 것이 맞다(생성 응답은 애초에 workflow 가 없는 것이 의도된
  키-생략 형태이므로). `update()` 의 동일 재조회는 이번 커밋이 `relations: ['workflow']`
  를 추가해 "생성 응답에만 없다"는 JSDoc 보장과 구현을 일치시켰다 — 두 경로를 대조해 비대칭
  버그가 없음을 확인했다.
- **`response-contract.ts` 의 판정 로직**: `present=false || value===undefined` 를 "부재"
  로 묶어 처리하는 것, `allowMissing`/`allowUndeclared` 가 정확히 이름이 맞을 때만
  면제되는 것(유닛 테스트가 대소문자·오탈자·중첩 경로 형태를 모두 문다), `oneOf`/`anyOf`
  판별자 부재 시 `required` 를 강제하지 않고 undeclared 만 잡는 완화 판정 — 모두 설계
  근거와 실제 구현이 일치한다.
- **`schedules.service.ts` 의 `saved.trigger = savedTrigger`/`trigger ?? schedule.trigger`
  위치 이동**(`if (isActive)` 블록 밖으로): `isActive: false` 로 생성/수정해도 응답에
  `trigger` 가 실리는 회귀 테스트(`schedules.service.spec.ts` 신규 2건)가 실제로 "관계를
  뺀 사본을 돌려주는" mock 으로 vacuous 하지 않게 짜여 있음을 확인했다.

## 요약

프롬프트가 나열한 275개 파일 중 실질 변경은 34개 코드 파일 + plan 1개이며, 나머지는
과거 10라운드의 리뷰 산출물 이력이다. 핵심 변경(트리거/스케줄 응답 경계에서의 비밀
컬럼·JSONB 키 스트립, `ScheduleDto.trigger`/`TriggerDto.workflow` 참조 좁히기, PATCH
`Object.assign` undefined 덮어쓰기 수정, `relations` 누락으로 인한 PATCH 응답 workflow
소실 수정, 응답-계약 검증자 배선 확대, §5.4 24필드 선언 보정)을 spec 본문
(`2-api-convention.md §5.4`, `secret-store.md §1/§1.1`, `1-data-model.md §2.9.1`,
`4-integration.md §9.1`, `1-workflow-list.md`, `3-error-handling.md`)과 line-level 로
대조한 결과, 함수 시그니처·필드 선언 형태(null-present vs 키-생략)·에러 코드·기본값·
스트립 대상 목록이 spec 이 요구하는 바와 전부 일치했다. CWE-209(진단 정보 응답 유출) 방지
설계도 `GlobalExceptionFilter` 실제 구현과 대조해 유효함을 확인했다. 새로 발견한 것은
없고, 기존에 이미 plan 트래커가 추적 중인 "spec 의 노출-창 서술이 곧 낡는다"는 사실과
"deny-list 4벌의 구조적 취약성"만 INFO 로 재확인했다 — 둘 다 developer 권한 밖(spec 수정)
이거나 이미 후속 항목으로 등재돼 있어 이번 PR 을 막을 사유가 아니다.

## 위험도

NONE
