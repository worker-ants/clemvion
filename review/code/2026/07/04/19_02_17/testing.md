# 테스트(Testing) Review — priority 3-tier (triggerType threading)

## 발견사항

- **[INFO]** chat-channel `handleWebhook` 두 번째 호출부(hooks.service.ts:615, "새 execution 시작" 재사용 XFF 테스트)에서 `triggerType: 'webhook'` regression 어서션 누락
  - 위치: `codebase/backend/src/modules/hooks/hooks.service.spec.ts:690-698` (`'헤더에 X-Forwarded-For 포함...'` it 블록, `expect(engine.execute).toHaveBeenCalledWith(... expect.objectContaining({ triggerId, sourceIp, responseCode }))`)
  - 상세: 같은 파일의 line 622 테스트("conversation 없음 → 새 execution 시작")는 diff 로 `triggerType: 'webhook'` 을 명시적으로 검증하도록 갱신됐지만(prompt 파일 diff L203, "chat-channel 도 webhook 발화" 주석과 짝), 같은 호출부를 재검증하는 line 680 근방의 XFF IP 추출 테스트는 `objectContaining` 목록에 `triggerType` 을 포함하지 않는다. `objectContaining` 은 나열되지 않은 필드를 검사하지 않으므로, 이 테스트는 향후 누군가 실수로 `triggerType: 'webhook'` 를 이 호출부에서 제거해도 실패하지 않는다 — 해당 호출부 자체의 회귀 방지력이 그 한 테스트에만 의존.
  - 제안: 일관성을 위해 해당 어서션에도 `triggerType: 'webhook'` 을 추가(1줄 변경, 낮은 비용). 다만 리스크가 낮은 이유: (1) 값이 상수 리터럴이라 변경 시 근처 테스트(line 650)가 이미 실패 신호를 준다, (2) 이 필드는 순수 priority 계산 입력이라 실행 결과에 영향이 없다.

- **[INFO]** `execute()` 내부 fallback(`options?.triggerType ?? 'webhook'`)과 `resolveExecutionRunPriority` 내부 fallback(`undefined` → `schedule`)의 불일치가 테스트로 명시되지 않음
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:3250-3252` vs `codebase/backend/src/modules/execution-engine/queues/execution-run.queue.ts:39-46`
  - 상세: `execute()` 는 `triggerType` 미지정 시 문자열 `'webhook'` 으로 정규화한 뒤 `resolveExecutionRunPriority('webhook')` 을 호출하므로 실행 경로상 `resolveExecutionRunPriority(undefined)` 분기(스스로 `'schedule'` 기본값 처리)는 이 콜러에서는 절대 타지 않는다. 두 함수의 "모른다" 시 기본값이 서로 다르다는 사실(webhook vs schedule)은 `execution-run.queue.spec.ts` 의 `'미상/누락은 가장 낮은 우선순위(schedule)로 보수 처리'` 테스트와 `execution-engine.service.spec.ts` 의 새 테스트가 서로 다른 값을 검증하고 있어 각각은 정확하지만, 이 설계상 이원화(비대칭 fallback 정책)를 명시적으로 언급하는 테스트/주석이 없어 향후 리팩터링 시 "두 fallback을 통일해야 한다"는 오인 가능성이 있음.
  - 제안: 코드 자체는 정상(다른 계층에서 다른 보수적 기본값을 갖는 것은 의도적 방어). 테스트 추가는 필수는 아니며 INFO 로 기록.

## 요약
새로 추가된 `execution-engine.service.spec.ts` 의 "triggerType threading — manual>webhook>schedule 3-tier + fallback" 테스트가 3-tier 전체(webhook/schedule/미지정→webhook fallback)와 순서 불변식(`manual < webhook < schedule`)을 명확하고 읽기 쉽게 커버하며, `hooks.service.spec.ts`/`schedule-runner.service.spec.ts` 갱신도 실제 프로덕션 호출부(webhook, chat-channel, schedule cron) 3곳 모두에 대응하는 회귀 테스트를 남겼다. `schedules.service.spec.ts` 의 기존 `runNow` 테스트(`{ executedBy: 'user-1' }`, `triggerType` 없음)는 변경 없이 그대로 유지되어 "수동 실행은 manual 유지" 불변식의 회귀 가드 역할을 계속 수행한다. 프로덕션 `execute()` 호출부 7곳(webhook·chat-channel·schedule cron·schedules.runNow·workflows.controller x2·executions.service 재실행) 전수를 확인한 결과 `executedBy` variant 4곳은 타입 시스템이 `triggerType?: never` 로 원천 차단하고, `triggerId` variant 3곳(webhook/chat-channel/schedule)은 모두 이번 diff 에서 값이 채워지고 테스트도 갱신되어 커버리지 갭이 실질적으로 없다. `resolveExecutionRunPriority`/`EXECUTION_RUN_PRIORITY` 자체의 순수 함수 단위 테스트는 선재(pre-existing)해 mock 없이 실제 로직을 검증하는 좋은 구조다. 발견된 두 항목은 모두 INFO 수준으로, 하나는 objectContaining 사용으로 인한 미세한 회귀 방지력 저하(같은 호출부의 다른 테스트가 이미 커버), 다른 하나는 설계 의도(비대칭 fallback) 명시 부족이며 기능적 결함은 아니다.

## 위험도
LOW
