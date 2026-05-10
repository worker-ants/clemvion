### 발견사항

이번 변경의 핵심은 세 가지다:
1. 각 어댑터(webhook/schedule/manual)가 실행 input 객체에 `__triggerSource` 리터럴 키를 추가
2. `ManualTriggerHandler`가 그 키를 읽어 `meta.source`를 결정하고 `output.request`를 조건부 구성
3. `detectTriggerSource`는 순수 함수, 핸들러 자체는 무상태(stateless) 클래스

**[INFO]** 기존 코드에 있던 read-modify-write 패턴 (이번 diff 외부)
- 위치: `hooks.service.ts` — `trigger.lastTriggeredAt = new Date(); await save(trigger);`
- 상세: 동일 webhook endpoint에 고동시 요청이 들어오면 두 요청이 각각 trigger 엔티티를 fetch한 뒤 execute → lastTriggeredAt 갱신 → save 순서로 처리되어 마지막 저장이 이전 것을 덮어쓸 수 있다. `lastTriggeredAt`은 단순 타임스탬프이므로 업무 정합성 영향은 없지만 낙관적 잠금(optimistic locking / `@VersionColumn`) 없이 진행된다.
- 이번 diff 변경 내용이 아니며, 이 패턴 자체는 이번에 건드리지 않음.

이번 diff로 추가된 코드 자체는 동시성 관점에서 문제가 없다:
- `{ __triggerSource: 'webhook', parameters, ...input }` — 새 객체 리터럴 생성, 공유 상태 변이 없음
- `detectTriggerSource(input)` — 순수 함수, 부작용 없음
- `ManualTriggerHandler.execute()` — 인스턴스 상태를 수정하지 않고 입력만 읽어 새 객체 반환

### 요약

이번 변경은 실행 input 객체에 `__triggerSource` 마커를 추가하고 핸들러가 이를 읽어 `meta.source`와 `output.request`를 결정하는 구조다. 모든 변경은 새 객체를 생성(immutable data construction)하거나 순수 함수로 처리되며, 공유 가변 상태를 건드리지 않는다. 비동기 흐름도 기존 `await` 체인 위에 값 하나를 추가한 것에 불과하다. 동시성 위험을 새로 도입하지 않는다.

### 위험도

**NONE**