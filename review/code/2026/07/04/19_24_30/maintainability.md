# 유지보수성(Maintainability) Review

## 대상 변경 요약

`ExecuteOptions.triggerType`(`'manual' | 'webhook' | 'schedule'`) 필드 신설을 통한
execution-run 큐 priority 3-tier(`manual` > `webhook` > `schedule`) threading.
변경 파일: `execution-engine.service.ts`(+spec), `hooks.service.ts`(+spec),
`schedule-runner.service.ts`(+spec). 나머지(plan/review 산출물, spec 문서)는
비코드 메타 변경.

## 사전 확인 사항

이전 리뷰(`review/code/2026/07/04/19_02_17`)에서 지적된 W1 — `execution-engine.service.ts`
~3245 라인 주석의 merge-artifact(2줄 주석 후반부만 교체되며 앞줄 끝에 매달린
`webhook` 조각 + 바로 이어지는 새 문단)가 수정되었는지 확인했다.

```ts
//    priority 3-tier(§4.3): **executedBy 우선** — 수동 실행(schedule "지금 실행" runNow 포함)은
//    `manual`. 트리거 발화(triggerId)는 호출부가 전달한 `options.triggerType`
//    (`Trigger.type`: webhook/schedule)을 쓰고, 미전달 시 `webhook` fallback(비-HTTP
//    트리거 방어). `manual`(1) > `webhook`(2) > `schedule`(3).
const triggerType: ExecutionRunTriggerType = options?.executedBy
  ? 'manual'
  : (options?.triggerType ?? 'webhook');
```

매달린 조각 없이 단일 문단으로 정리되어 있고, 대체된 로직(`options?.executedBy ? 'manual' : (options?.triggerType ?? 'webhook')`)의 우선순위 규칙·fallback 근거를 정확히 설명한다. 깨끗하게 읽힌다 — 재발 없음.

## 발견사항

없음.

### 참고 (비차단, 기록용 — 이전 세션에서 이미 판정 종결된 항목 재확인)

- **매직 넘버 없음**: `EXECUTION_RUN_PRIORITY = { manual: 1, webhook: 2, schedule: 3 }`(`execution-run.queue.ts:27-30`)는 이름 있는 상수 + BullMQ 우선순위 규약("낮은 숫자가 높은 우선순위") 설명 주석을 갖추고 있어 매직 넘버로 보지 않는다.
- **판별 유니온 확장의 가독성**: `ExecuteOptions`의 3개 분기 모두에 `triggerType` 필드(`never`/`ExecutionRunTriggerType`/`never`)를 대칭적으로 추가해 컴파일 타임 판별을 유지했다. 각 분기 옆 인라인 주석("manual 은 executedBy 로 판정", "priority 3-tier — intake 큐 우선순위 계산 입력")이 왜 이 필드가 이 분기에만 존재하는지 즉시 설명해 가독성이 좋다.
- **네이밍**: `triggerType`(우선순위 계산 입력, 3-way) vs `Execution.triggerSource`(이력 표시 파생 필드, 5-way)의 이름 유사성으로 인한 혼동 가능성을 JSDoc의 `⚠️` 경고로 명시 완화했다. 코드 자체 개선 여지는 없고 문서화로 충분히 대응됨.
- **함수 길이/복잡도**: `execute()` 메서드 내 변경분은 3-way 조건 삼항 1줄(`options?.executedBy ? 'manual' : (options?.triggerType ?? 'webhook')`)로 순환 복잡도 증가가 미미하다. 중첩 깊이 변화 없음.
- **일관성**: `hooks.service.ts`의 두 호출부(webhook, chat-channel)와 `schedule-runner.service.ts` 호출부 모두 동일한 패턴(`triggerType: 'webhook'|'schedule'` 리터럴 + "priority 3-tier(§4.3)" 태그 주석)으로 threading 되어 있어 스타일이 균일하다.
- **테스트 가독성**: `execution-engine.service.spec.ts`의 신규 테스트명에 `(PR2)`가 하드코딩되어 있으나(PR 라벨은 시간이 지나면 맥락을 잃을 수 있음) 무해한 수준이며 이미 이전 세션에서 INFO 로 기록·판정 종결된 사항이라 재기재하지 않는다.

## 요약

이번 변경은 3-tier priority threading을 판별 유니온의 각 분기에 대칭적으로, 그리고 4개 호출부(hooks 2곳, schedule-runner 1곳, execute() 내부 판정 1곳)에 동일한 패턴과 태그 주석(§4.3)으로 일관되게 적용해 가독성과 일관성이 양호하다. 지난 세션에서 지적된 유일한 유지보수성 결함(주석 merge-artifact)은 이번에 깨끗하게 수정된 것을 확인했으며, 재발하거나 새로 발견된 가독성/네이밍/함수길이/중첩/매직넘버/중복/복잡도/일관성 문제는 없다.

## 위험도

NONE

STATUS: SUCCESS
