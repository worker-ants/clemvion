# 요구사항(Requirement) 리뷰

## 발견사항

- **[WARNING]** `CHANGELOG.md` 의 blockquote 안에서 서로 다른 두 설명이 한 문장으로 이어붙어, "6개(과소 선언) 축" 설명 뒤에 실제로는 "17개(금지 조합) 축"에 대한 설명이 잘못 귀속된다. 또한 그 이어붙은 문장부터는 `>` 접두가 빠져 인용문 블록에서 벗어난다.
  - 위치: `CHANGELOG.md:81-86` (실제 파일 줄 번호, `Read`/`grep -n` 으로 확인)
  - 상세: 81~83줄은 "나머지 6개는 다른 축이다 — `consecutiveNetworkFailures`·`documentCount`·... 은 상시 존재 + non-null 인데 `Optional` 로 **과소 선언**한 것이었다" 는 내용이다. 그런데 84줄 끝에 "래칫이 무엇을 막는지가 흐려진다 (...) W3). **두 검증자 어느 쪽도 잡지 못했다** — 런타임 검증자는 값을" 이 그대로 이어붙었고, 85~86줄("보는데 이 조합은 키가 없어도 null 이어도 맞고, 정적 가드의 presence/null 축은 선언과 TS 타입이 서로 맞는지만 보는데 이 조합은 일관되게 틀려 있다")은 `>` 없이 계속된다. "키가 없어도 null 이어도 맞는" 조합은 `nullable:true`+`required:false` **금지 조합(17개)**의 특성이지, "non-null 인데 Optional 로 과소 선언"한 6개 축의 특성이 아니다(그쪽은 `nullable` 이 애초에 `true`로 선언되지 않았으므로 `null` 이 오면 별도 위반이다). 같은 설명이 `plan/in-progress/spec-draft-nullable-notation-followups.md` 의 "스윕 1차의 자기 반박" 절에는 17개 축에 정확히 붙어 있어(`두 검증자 사이의 사각지대` 문단), CHANGELOG 쪽만 잘못된 문단에 병합된 편집 사고로 보인다. `git log -S`로 보면 이 문장은 `review/code/2026/09/06/00_24_34` 라운드의 W3(CHANGELOG "23건"→"17+6" 정정) 작업 중 삽입된 것으로, 그 라운드의 RESOLUTION.md 자체는 올바른 6/17 구분만 언급하고 이 문장 병합은 언급하지 않는다 — 아직 어느 리뷰에서도 지적되지 않은 잔여 결함으로 보인다.
  - 제안: 84줄을 "...래칫이 무엇을 막는지가 흐려진다 (...) W3)." 에서 끊고, "두 검증자 어느 쪽도 잡지 못했다..." 문장을 별도 문단(blockquote 밖, 17개 축 설명 바로 뒤인 79줄 인근)으로 옮기거나 최소한 `>` 를 85~86줄에도 붙여 인용 범위를 명확히 한다. CHANGELOG 는 보안 사고 사후 감사 기록이라 축 귀속이 정확해야 한다.

- **[INFO]** 위 CHANGELOG 항목을 제외하면, 이번 diff 의 핵심 요구사항(§5.4 응답-계약 검증자 4→18개 DTO 배선, 트리거 회전 secret 2경로 유출 차단, 5개 DTO 24필드 선언 보정, §5.4 금지-조합 78건 래칫)은 spec 본문과 line-level 로 대조해 전부 일치를 확인했다. 구체적으로: `Schedule.trigger_id` NOT NULL 1:1 (`spec/1-data-model.md:280`) ↔ `SchedulesController.toResponse` 의 무분기 상시 포함 + `InternalServerErrorException`; `secret-store.md §1.1` 이 이름으로 금지한 3필드(`Trigger.config.interaction.triggerToken`·`notification_secret_v2`·`chat_channel_token_v2`) + ref 2종(`botTokenRef`/`config.notification.signing.secretRef`) ↔ `TRIGGER_RESPONSE_STRIP_COLUMNS`/`CHAT_CHANNEL_RESPONSE_STRIP_KEYS`/`NOTIFICATION_SIGNING_STRIP_KEYS`/`INTERACTION_RESPONSE_STRIP_KEYS` 전수 일치; `IntegrationDto.appUrl`/`consecutiveNetworkFailures`, `KnowledgeBaseDto` 7필드, `AlertRuleDto.createdBy`/`lastTriggeredAt` 의 nullable/기본값 선언이 각 엔티티 컬럼 정의와 정확히 일치; `spec/2-navigation/1-workflow-list.md:153` 의 "포맷 버전 협상은 미구현 (Planned)" ↔ `workflow-crud.e2e-spec.ts` 의 `allowMissing: ['formatVersion']` 및 인용 주석 일치.
  - 위치: 해당 없음 (교차 확인 결과 요약)
  - 상세: 자세한 대조는 위 요약 참고. `schedules.service.ts`(create/update 의 `saved.trigger` 대입 위치 이동), `triggers.service.ts`(`sanitizeForResponse` 4축 오케스트레이션), `response-contract.ts`(`allowMissing`/promise 메모이제이션), `swagger-dto-contract-guard.ts`(신설 `findOptionalNullableResponseFields`/`isResponseDtoFile`)는 각각의 unit·e2e 회귀(뮤턴트 확인 포함, RESOLUTION.md 기록)와 함께 배선돼 있고, edge case(트리거 미로드 시 500, `workflow` 관계 부재 시 키 생략, `interaction`/`signing` 이 `null`/미정의일 때 `&&` 가드로 안전 처리)도 코드 레벨에서 확인했다.
  - 제안: 조치 불요.

## 요약

이 PR 은 이미 9라운드에 걸친 review→fix 사이클(`review/code/2026/09/05/18_23_02` ~ `2026/09/06/00_24_34`)을 거친 상태이며, 이번 요구사항 리뷰에서 핵심 로직(트리거/스케줄 응답에서 회전 secret 스트립, §5.4 계약 검증자 배선 확대, 78건 금지-조합 래칫)을 spec(`secret-store.md §1.1`, `1-data-model.md §2.9.1`, `2-navigation/1-workflow-list.md`)과 line-level 로 대조한 결과 함수 시그니처·필드 nullable/기본값·에러 처리·엣지 케이스(트리거 부재·workflow 관계 부재·config 하위 필드 null)가 모두 spec 및 엔티티 정의와 일치했다. 유일하게 발견한 결함은 코드가 아니라 `CHANGELOG.md` 감사 기록 안에서 두 개의 서로 다른 설명(6개 과소-선언 축 vs 17개 금지-조합 축)이 최근 라운드(`00_24_34` W3)의 정정 편집 중 한 문단으로 잘못 병합된 문서 정확성 문제다 — 기능·spec 위반은 아니지만 사후 감사용 기록의 정확성을 해치므로 정정을 권장한다.

## 위험도
LOW
