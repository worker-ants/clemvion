# 문서화(Documentation) 리뷰

## 발견사항

- **[WARNING]** 이름이 바뀐 private 메서드를 가리키는 주석이 다른 파일에 남았다 (오래된 주석)
  - 위치: `codebase/backend/test/chat-channel-trigger-create.e2e-spec.ts:112`
  - 상세: 이 PR 은 `codebase/backend/src/modules/triggers/triggers.service.ts` 에서 private 메서드
    `sanitizeChatChannelForResponse` 를 `sanitizeForResponse` 로 rename 했다(트리거 자신의 응답뿐
    아니라 엔티티 컬럼까지 덮도록 책임이 넓어졌으므로). 그런데 `chat-channel-trigger-create.e2e-spec.ts:112`
    의 주석 `// plaintext / ref 는 응답에 절대 없어야 함 (sanitizeChatChannelForResponse).` 는 이 PR
    의 diff 범위 밖(문맥 줄)이라 그대로 남았고, 지금 저장소 전체를 검색하면 이 한 곳만
    옛 이름을 가리킨다(`grep -rn "sanitizeChatChannelForResponse" codebase/` 로 실측 확인 — 코드
    쪽 호출부는 없고 이 주석 하나뿐). 실제 동작에는 영향 없지만, 다음에 이 메서드를 찾는 사람이
    존재하지 않는 이름으로 grep 하게 만든다.
  - 제안: 주석을 `sanitizeForResponse` 로 갱신.

- **[WARNING]** 새로 선언한 두 DTO 필드가 엔티티의 닫힌 union 을 반영하지 못해 OpenAPI 문서가
  실제보다 넓은 타입(`string`)으로 나간다
  - 위치: `codebase/backend/src/modules/triggers/dto/responses/trigger-response.dto.ts:77-78`
    (`chatChannelHealth?: string`) 및 `:93-94`(`notificationHealth?: string`),
    `codebase/backend/src/modules/knowledge-base/dto/responses/knowledge-base-response.dto.ts:108-109`
    (`rerankMode?: string`)
  - 상세: 세 필드 모두 `@ApiPropertyOptional({ example: ... })` 로만 선언해 `enum` 을 빠뜨렸다.
    그런데 엔티티 컬럼 타입은 닫힌 union 이다 — `trigger.entity.ts` 의
    `TriggerChatChannelHealth`/`TriggerNotificationHealth` 는 `'unknown' | 'healthy' | 'degraded'`,
    `knowledge-base.entity.ts` 의 `rerankMode` 는 `'off' | 'cross_encoder' | 'cross_encoder_llm'`
    이다(둘 다 `Read` 로 실측 확인). 같은 파일 안의 이웃 필드들(`TriggerDto.type` → `enum:
    ['webhook','manual','schedule']`, `KnowledgeBaseDto.reembedStatus`/`ragMode` → 각각 `enum`
    명시)은 이미 이 패턴을 따르고 있어, 이번에 추가된 세 필드만 그 관례에서 벗어났다. OpenAPI
    소비자(FE 코드젠·외부 문서)가 가능한 값 집합을 알 방법이 없다.
  - 제안: 세 필드에 `enum: ['unknown', 'healthy', 'degraded']` / `enum: ['off', 'cross_encoder',
    'cross_encoder_llm']` 을 추가.

- **[WARNING]** CHANGELOG 신규 항목의 소제목 수치가 바로 아래 표의 합계와 다르다
  - 위치: `CHANGELOG.md:41`(소제목 "### 함께 — 선언이 현실에 뒤처져 있던 **24필드**를 선언했다")
    vs `CHANGELOG.md:46-52`(표)
  - 상세: 표를 DTO 별로 직접 세면 `TriggerDto` 7 + `IntegrationDto` 6 + `KnowledgeBaseDto` 7 +
    `AlertRuleDto` 2 + `ScheduleDto` 1(`trigger`) = **23** 이다(diff 로 실제 추가된 필드명을
    하나씩 대조해 확인). 소제목은 24 라고 적어, 이 changelog 항목을 근거로 회전/노출 범위를
    감사할 다음 사람이 숫자를 맞춰 보다가 어긋난다. (참고: `plan/in-progress/spec-draft-nullable-notation-followups.md`
    의 "26건의 실제 drift" 는 보안 2건 + 이 24(23)필드로 재구성하면 자체 정합은 맞는 편이라
    거기까지 번지는 문제는 아니다 — CHANGELOG 쪽 소제목-표 정합만의 문제.)
  - 제안: 24 → 23 으로 정정하거나, `ScheduleDto` 행이 `trigger` 하나가 아니라 2개 항목(예:
    `trigger`+`workflow.name`)을 대표하는 것이라면 표에 그렇게 풀어 적어 24 를 재현 가능하게 할 것.

- **[INFO]** 신규 필드 주석에 박힌 "FE 참조 수" 가 향후 쉽게 stale 해질 수 있는 형태다
  - 위치: `codebase/backend/src/modules/alerts/dto/responses/alert-rule-response.dto.ts:58`,
    `codebase/backend/src/modules/integrations/dto/responses/integration-response.dto.ts:121-122`,
    `codebase/backend/src/modules/knowledge-base/dto/responses/knowledge-base-response.dto.ts:96-97`,
    `codebase/backend/src/modules/triggers/dto/responses/trigger-response.dto.ts:68-70`
  - 상세: "createdBy 14", "appUrl 10 · lastRotatedAt 9 · ..." 처럼 특정 시점의 grep 결과를
    영구 코드 주석에 못 박았다. 독립적으로 `grep -rn` 으로 재현을 시도했을 때(개발자와 동일한
    기준인지는 불명확하지만) `appUrl` 은 6~45(패턴에 따라), `createdBy` 는 1~16(패턴에 따라) 로
    편차가 커서, 정확한 재현 기준이 코드에 남아 있지 않다. 다만 `consecutiveNetworkFailures 0`
    은 정확히 재현됐다(FE 참조 0곳, `TriggerDto`/`ScheduleDto` 의 "FE 소비처 네 곳" 주장도
    `schedules/page.tsx` 대조로 정확히 재현됨). 즉 개발자의 방법론 자체는 신뢰할 만하지만,
    "그 필드를 지워도 되는가" 를 좌우하는 숫자가 **주석에는 재현 불가능한 형태로만** 남아
    있다는 점이 위험 — 프런트엔드가 바뀌어도 이 숫자는 조용히 stale 해지고, 아무도 다시
    세어보지 않으면 잘못된 근거로 "안전하게 제거 가능"/"제거 위험" 판단을 내리게 된다.
  - 제안: (필수 아님) 정확한 카운트는 PR 설명이나 `plan/` 트래커에 남기고, 코드 주석 쪽은
    "다수 참조" 처럼 정성적 표현으로 낮추거나, 카운트 재현에 쓴 정확한 grep 커맨드를 함께
    적어 향후 재검증 가능하게 할 것.

## 요약

이번 변경의 문서화 수준은 전반적으로 높다 — CHANGELOG 항목이 원인·영향·수정 근거를 상세히
서술하고, 새 DTO 필드마다 JSDoc + "이미 나가고 있었다"는 배경 주석을 남겼으며, 여러 인용
(`schedules/page.tsx` 소비처 4곳, `spec/2-navigation/1-workflow-list.md` 의 `formatVersion`
Planned 인용, `notification_secret_v2` 엔티티 주석 인용, `contractForDto` 메모이제이션 JSDoc)
을 직접 대조해 본 결과 모두 정확했다. 다만 (1) rename 된 private 메서드를 가리키는 주석 하나가
다른 파일에 stale 하게 남았고, (2) 새로 선언한 닫힌-union 필드 3개가 `enum` 을 빠뜨려 같은
파일의 이웃 필드들과 관례가 어긋나며, (3) CHANGELOG 소제목의 필드 수치가 바로 아래 표의 합계와
1개 어긋난다. 셋 다 기능 회귀는 아니지만, 보안-회귀 방지를 위해 쓰인 이 changelog/DTO 문서가
스스로의 근거로 재검증하기 어려운 상태라는 점에서 워닝으로 기록한다.

## 위험도

LOW
