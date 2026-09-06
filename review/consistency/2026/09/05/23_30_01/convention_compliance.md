# 정식 규약 준수 검토 — convention_compliance

## 검토 범위와 방법

- target: `spec/5-system/` (impl-done, diff-base `origin/main`). `spec/5-system/` 자체는 이 브랜치에서 **델타 0** — 정상이며 그 자체로 결함이 아니다.
- 실제 변경은 코드 30개 파일 / 2068줄(`git diff origin/main...HEAD --stat`, review/plan 산출물 제외 시 핵심은 `schedules`/`triggers`/`integrations`/`knowledge-base`/`alerts` 응답 DTO + `swagger-dto-contract-guard.ts` + `response-contract.ts` + e2e/unit 테스트). 이는 `spec/5-system/2-api-convention.md §5.4`(부재 표현 규약)와 `spec/conventions/swagger.md`·`spec/conventions/review-citations.md`·`spec/conventions/secret-store.md` 가 규율하는 표면이라, 프롬프트가 예산으로 자른 이 conventions 파일들을 워킹트리에서 절대경로로 직접 열어 대조했다.
- 코드 확인은 전부 `/Volumes/project/private/clemvion/.claude/worktrees/sweep-response-contract-5ba0ad`(HEAD, `48704becd`) 기준. 오늘 같은 task 계보에서 이미 5라운드(`18_23`~`22_48`)의 convention_compliance 검토가 선행됐음을 `git log`/`review/consistency/2026/09/05/*`로 확인했고, 그 라운드들이 이미 지적·수정한 사항(클래스 JSDoc 리뷰 인용 등)은 현재 상태에서 재확인만 하고 새 커밋(`48704becd`)이 도입한 델타를 중심으로 봤다.

---

## 발견사항

### [WARNING] 새 커밋이 직전 라운드에서 고친 것과 **동일한 위반을, 같은 파일 다른 필드에 재도입**했다 — `swagger.md §3` / `review-citations.md §3`

- target 위치: `codebase/backend/src/modules/schedules/dto/responses/schedule-response.dto.ts:34-47`, `ScheduleTriggerRefDto.workflow` 필드의 `/** */` JSDoc.
- 위반 규약: [`spec/conventions/swagger.md §3`](../../../../../spec/conventions/swagger.md#3-주석설명-톤) — *"정정 경위·리뷰 참조·'왜 이렇게 바꿨는지' 같은 내부 서사는 JSDoc 이 아니라 그 위의 `//` 주석에 적는다"* / [`spec/conventions/review-citations.md §3`](../../../../../spec/conventions/review-citations.md#3-적용-범위--맥락-없이-읽히는-자리) 표의 "DTO·컨트롤러의 `/** */` JSDoc" 행 — *"대상 아님 — 그 JSDoc 은 공개 OpenAPI `description` 으로 나간다. 리뷰 인용은 소비자가 읽을 문장이 아니므로 애초에 거기 쓰지 않는다."*
- 상세: 현재 파일의 `ScheduleTriggerRefDto.workflow` 필드 JSDoc 안에 다음 문장이 그대로 박혀 있다.
  ```ts
  /**
   * 연결된 워크플로우 — **키 생략형**이다 (§5.4 기준 (b): 선택적 부가 컨텍스트).
   *
   * **생성 응답에만 없다.** ...
   *
   * 종전 이 주석은 *"생성·수정 응답에는 로드되지 않는다"* 고 적었는데 **수정 쪽이
   * 틀렸다** (`review/code/2026/09/05/22_48_39` W3).
   *
   * 소비처가 부재를 정상 경로로 다룬다 — ...
   */
  @ApiPropertyOptional({ type: () => ScheduleTriggerWorkflowRefDto })
  workflow?: ScheduleTriggerWorkflowRefDto;
  ```
  `review/code/2026/09/05/22_48_39` W3 인용과 "종전 이 주석은 ... 틀렸다" 는 정정 경위 서술이며, 이는 두 규약이 명시적으로 JSDoc 밖(`//`)으로 빼라고 지시하는 바로 그 콘텐츠다.

  **이것이 새 회귀인 이유** — `git show 66a2510fd`(직전 fix 커밋, 22:48:31)는 정확히 이 문제를 `ScheduleDto.trigger` 필드에서 고쳤다:
  ```diff
  -   * 종전엔 키 생략형으로 선언했는데 §5.4 는 그 형태에 **사유 문서화**를 요구하고, 실측은
  -   * 부재 경로가 없다고 말한다 (`review/consistency/.../21_40_38` W1).
       */
  +  // 종전엔 키 생략형으로 선언했는데 §5.4 는 그 형태에 **사유 문서화**를 요구하고, 실측은
  +  // 부재 경로가 없다고 말한다 (`review/consistency/.../21_40_38` W1).
  +  // — 내부 참조라 `//` 에 둔다: 필드 JSDoc 은 `introspectComments` 로 공개 OpenAPI
  +  //   description 이 된다 (`swagger.md §3`).
  ```
  그런데 **바로 다음 커밋**(`48704becd`, 23:29:52 — 이번 diff 의 최신 HEAD)이 같은 파일의 `ScheduleTriggerRefDto.workflow` 필드에 "수정 쪽이 틀렸다 (`review/code/.../22_48_39` W3)" 라는 **새 정정 서술**을 추가하면서, 그 문장을 (직전 커밋이 스스로 세운 규칙과 반대로) `//` 가 아니라 `/** */` 안에 넣었다. 같은 커밋이 두 클래스(`TriggerWorkflowRefDto`·`ScheduleTriggerWorkflowRefDto`)의 **클래스 레벨** JSDoc 리뷰 인용은 정확히 `//` 로 옮겼음에도(`--impl-done 22_48_40` W1 반영), 새로 추가한 이 **필드 레벨** 문장에는 같은 처리를 놓쳤다.

  **이전 유사 사례(22_48_40 라운드가 지적한 클래스 레벨 위반)보다 실질적으로 더 심각하다** — 그 라운드는 `@nestjs/swagger@11.4.5` 플러그인 소스를 직접 열어 "`introspectComments` 는 `ts.isPropertyDeclaration(node)` 경로에서만 동작하고 **클래스 선언 JSDoc 은 스캔 대상이 아니다**" 라고 실측해, 그 위반은 "문면상 위반이나 실제 wire 유출은 없음" 으로 완화했다. 이번 건은 정반대다 — **필드(property) 선언의 JSDoc**이므로 `introspectComments` 스캔 대상이고(직전 fix 커밋 메시지 스스로 "필드 JSDoc 은 `introspectComments` 로 공개 OpenAPI description 이 된다" 라고 명시), 완화 요인이 없다. `PATCH /api/schedules/:id`/`GET /api/schedules` 등이 노출하는 실제 공개 OpenAPI `description` 에 내부 리뷰 세션 경로(`review/code/2026/09/05/22_48_39`)와 지적 번호(`W3`)가 그대로 실린다.
- 제안: 해당 필드 JSDoc 에서 "종전 이 주석은 ... 틀렸다 (`review/code/.../22_48_39` W3)" 문장을 삭제하고, 바로 위의 `//` 주석(현재 이 필드 위에는 없음 — 파일 상단의 공용 `//` 블록과 별개로 이 필드 전용 `//` 를 새로 달거나, 파일 하단 `ScheduleDto.trigger` 가 쓴 것과 동일 패턴대로 정정 경위만 `//` 로 내린다)으로 옮긴다. JSDoc 에는 소비자가 알아야 할 내용(언제 필드가 채워지는지·소비자가 어떻게 읽는지)만 남긴다.

### [INFO] `TriggerDto.chatChannelHealth`/`notificationHealth` 가 엔티티 타입을 그대로 import — 기존 지적 재확인, 이번 diff 특유의 이탈 아님

- target 위치: `codebase/backend/src/modules/triggers/dto/responses/trigger-response.dto.ts:2-5`, `import type { TriggerChatChannelHealth, TriggerNotificationHealth } from '../../entities/trigger.entity'`.
- 위반 규약(경향): [`spec/conventions/swagger.md §5-1`](../../../../../spec/conventions/swagger.md#5-1-응답-dto-위치) — "엔티티 enum 에서 파생하지 않는다 — DTO 레이어가 엔티티에 결합되지 않아야 한다."
- 상세: 직전 라운드(`22_48_40`)가 이미 동일 지점을 INFO 로 지적했고 현재도 미수정 상태다. 다만 그 라운드가 실측했듯 저장소 전역에 최소 6곳(`edge-response.dto.ts` 등)이 같은 패턴이라 이번 diff 고유의 신규 이탈은 아니다 — 재지적일 뿐 새 감점 요인은 아니다.
- 제안: 이번 diff 범위에서 고칠 의무는 없음. 다음에 이 두 필드를 손댈 때 `dto/responses/trigger-health.literal.ts` 로 값 집합을 추출하는 것을 고려.

---

## 준수 확인 (위반 아님 — 정합성 근거로 기록)

- **`2-api-convention.md §5.4` 선언 형태 — 신규 필드 전부 정확히 분기**: `alert-rule-response.dto.ts`(`createdBy`/`lastTriggeredAt`) · `integration-response.dto.ts`(`appUrl`/`mallId`/`tokenExpiresAt`/`lastRotatedAt`/`lastUsedAt`/`consecutiveNetworkFailures`) · `knowledge-base-response.dto.ts`(`documentCount`/`embeddingModelConfigId`/`rerankMode`/`rerankCandidateK`/`rerankScoreThreshold`/`rerankConfigId`/`rerankLlmConfigId`) 모두 "상시 존재(엔티티 컬럼)" → `@ApiProperty({ nullable: true })` + `T | null`, "키 생략형(join 관계)" → `@ApiPropertyOptional()` + `T`(`| null` 없음) 로 §5.4 기본형/예외 규칙을 정확히 따른다. `IntegrationDto.appUrl` 은 처음 키 생략형으로 오판했다가 e2e 계약 대조(`response-contract.ts`)가 반증해 §5.4 기본형으로 정정한 이력(diff 주석)까지 남아, §5.4 "검증 층" 이 스펙이 서술한 대로 실제 작동한 사례다.
- **`swagger.md §1-6` numeric wire 타입**: `consecutiveNetworkFailures`(엔티티 `type: 'int'`) · `rerankScoreThreshold`(엔티티 `type: 'double precision'`) 둘 다 `numeric`/`decimal` 이 아니므로 `number` 로 선언한 것이 맞다 — 규약이 요구하는 "패스스루=문자열, 컬럼이 numeric/decimal 이 아니면 숫자" 구분과 실측이 일치한다.
- **`secret-store.md §1.1` 세 필드 완전 스트립**: `config.interaction.triggerToken`(이번 diff `66a2510fd` 가 마저 닫음) · `Trigger.notification_secret_v2` · `Trigger.chat_channel_token_v2`(+ ref 계열) 가 `triggers.service.ts` 의 네 상수(`INTERACTION_RESPONSE_STRIP_KEYS` 등)로 전부 커버된다. 최신 커밋(`48704becd`)은 `TriggerDto.config` 가 `additionalProperties: true` 인 열린 map 이라 정적/런타임 계약 대조 양쪽 다 그 내부를 못 보는 사각지대를 e2e 수기 단언으로 보강했다 — `2-api-convention.md §5.4` "검증 층" 표가 이미 명시한 두 검증자의 한계("배선되지 않은 엔드포인트"·"선언이 양쪽 다 틀린 경우")를 정확히 이해하고 그 바깥을 메운 형태다.
- **DTO 파일 위치·명명**: 신규 `ScheduleTriggerRefDto`/`ScheduleTriggerWorkflowRefDto`/`TriggerWorkflowRefDto` 모두 `dto/responses/*-response.dto.ts` 안에 위치, `Dto` 접미 유지(`swagger.md §5-1`). nested object 는 `@ApiProperty({ type: () => X })` 패턴(`swagger.md §1-4`)을 그대로 따른다.
- **응답 wrapping**: 신규 필드들은 기존 `{ data: <Dto> }` 봉투 구조를 바꾸지 않는다 — `2-api-convention.md §5.1`/`swagger.md §2-5` 대상 표면 무변경.
- **URL·에러코드·audit action 신설 없음**: 이번 diff 는 순수 응답 DTO 선언 정합화라 `error-codes.md`·`audit-actions.md`·URL 명명 규약(`2-api-convention.md §2`) 표면을 건드리지 않는다.
- **`review-citations.md §2` 형식**: 이번 diff 가 `//` 에 남긴 리뷰 인용은 전부 `review/code|consistency/2026/09/05/HH_MM_SS [W#|Critical #]` 전체 경로 형식이며 "권장" 형태를 따른다 — 위 WARNING 은 인용 **형식**이 아니라 인용이 **놓인 자리**(필드 JSDoc)의 문제다.

---

## 요약

`spec/5-system/` 문서 자체는 변경되지 않았고, 실제 코드 변경(스케줄·트리거·연동·지식베이스·알림규칙 응답 DTO의 엔티티 패스스루 스윕 + 시크릿 스트립 e2e 보강)은 `2-api-convention.md §5.4`·`swagger.md`·`secret-store.md` 세 규약을 필드 선언 형태·numeric wire 타입·시크릿 스트립 범위 모두에서 정확히 따른다. 다만 이 라운드가 새로 발견한 흠이 하나 있다 — 최신 커밋(`48704becd`)이 직전 라운드(`22_48_40`)의 지적을 받아 `ScheduleDto.trigger`·클래스 JSDoc 두 곳의 리뷰-인용-in-JSDoc 위반은 정확히 고쳤으면서, 같은 파일·같은 커밋에서 새로 추가한 `ScheduleTriggerRefDto.workflow` 필드의 정정 서술("수정 쪽이 틀렸다")은 동일 규칙을 놓쳐 `/** */` 안에 그대로 남겼다. 직전 라운드가 완화 요인으로 인정했던 "클래스 JSDoc 은 `introspectComments` 스캔 대상이 아니다"는 필드 JSDoc 에는 적용되지 않으므로(개발자 스스로 직전 커밋 메시지에 명시), 이번 건은 실제로 공개 OpenAPI `description` 에 내부 리뷰 세션 경로가 노출된다 — 문면상 위반을 넘어 기능적으로도 유출이다. 같은 규칙을 두 곳은 고치고 한 곳은 놓친 것으로 보아 "규칙을 몰라서"가 아니라 "적용 범위를 다 훑지 못해서"인 결함이라 재발 가능성이 있다.

## 위험도

MEDIUM
