### 발견사항

- **[WARNING]** REST `stripAndRedact` 리팩터가 `outputData` null 경로의 널-가드 로직을 옮겼는데, 그 경로를 실제로 태우는 테스트가 없다
  - 위치: `codebase/backend/src/modules/external-interaction/interaction.service.ts` `stripAndRedact` 함수(98행), waiting 분기 `const out = stripAndRedact(nodeExec.outputData) ?? {};`(379행), terminal 분기 `result`/`error`(439-446행)
  - 상세: `Execution.outputData`/`NodeExecution.outputData` 는 둘 다 `@Column({ type: 'jsonb', nullable: true })`(`execution.entity.ts:77`, `node-execution.entity.ts:72`)라 런타임에 `null` 이 실제로 들어올 수 있다(TS 타입은 `Record<string, unknown>` 으로 non-null 처럼 보이지만 DB 스키마와 어긋난 기존 갭). 이번 diff 는 이 값을 다루던 로직을 `deepRedactSecrets(nodeExec.outputData ?? {})` / `deepRedactSecrets(execution.outputData ?? null)` 에서 `stripAndRedact(value)`(내부에서 `value === null || value === undefined` 를 별도로 가드)로 옮겼다 — null 처리 지점이 호출부 3곳에서 헬퍼 1곳(+ waiting 분기는 호출부에 `?? {}` 이중 가드까지)으로 재배치됐다. 코드를 직접 추적하면 동작은 보존된다(`stripDeep(null, 0, maxDepth)` → `value === null` 분기로 그대로 통과, throw 없음)고 확인했으나, `interaction.service.spec.ts` 의 `getStatus` 테스트 어디에도 `outputData: null`(또는 `undefined`) 을 주는 케이스가 없다 — `waiting_for_input — nodeOutput 의 raw llmCalls...`(626행)·`terminal outputData 의 raw llmCalls...`(668행 it.each)·기존 `COMPLETED result / FAILED error...`(876행) 전부 non-null fixture 만 쓴다. null-handling 로직이 이번 diff 에서 실제로 옮겨간 지점이라 회귀 위험이 가장 높은 곳인데, 그 지점을 잠그는 테스트가 없다.
  - 제안: `nodeExec.outputData: null`(waiting, `currentNode`/`context` 가 graceful 하게 빈 값으로 조립되는지) 와 `execution.outputData: null` + `status: COMPLETED`/`FAILED`(`result`/`error` 가 `null` 로 떨어지고 throw 하지 않는지) 각각 최소 1건씩 회귀 테스트로 고정할 것.

- **[INFO]** plan 체크리스트가 이미 존재하는 테스트를 "미착수"로 서술 — 커버리지 실측과 문서가 어긋난다
  - 위치: `plan/in-progress/spec-draft-eia-62-waiting-payload.md:253` (`- [ ] 배열 부분 clone-on-write 다원소 fixture (`11_02_16` testing INFO 11) — 저비용`) ↔ `codebase/backend/src/shared/utils/strip-external-only-fields.spec.ts:48`(`it('배열은 바뀐 원소만 교체하고 나머지 원소는 참조를 보존한다', ...)`)
  - 상세: `git log -S`로 확인한 결과 이 테스트는 커밋 `7fa12301c`(이번 브랜치 안)에서 이미 추가돼 통과 중이다. 그런데 같은 브랜치의 plan 체크박스는 여전히 `[ ]` 로 남아 있어, plan 만 보면 이 커버리지 갭이 아직 열려 있는 것처럼 읽힌다. 이 저장소 메모리에 "plan 서술은 철회로 거짓이 될 수 있다 + 체크리스트 두 군데 동기화" 교훈이 반복 기록돼 있는 것과 같은 패턴.
  - 제안: 테스트 관점에서는 조치 불필요(커버리지 자체는 충분) — 체크박스만 `[x]` 로 갱신할 것. (담당 도메인은 documentation/scope 이지만 테스트 존재 여부를 실측한 김에 함께 기록.)

- **[INFO]** 확인했으나 문제 없음 — 테스트 구조·격리·판별력이 이례적으로 견고하다
  - `strip-external-only-fields.spec.ts`: 참조 동일성(clone-on-write)·`__proto__` 오염 방지·깊이 경계·REST 순서(strip→redact) sweep 을 유틸 자체에서 직접 검증하고, 그 sweep 은 실제 파이프라인 순서(`stripAndRedact` 와 동일)를 그대로 태운다. `MAX_REDACT_DEPTH` 상수를 상대값으로 사용해 상수 변경 시에도 판별력이 깨지지 않는다.
  - `websocket.service.spec.ts`: `beforeEach` 마다 `WebsocketService` 신규 인스턴스 생성(테스트 간 상태 공유 없음), `nextFanoutEvent` 는 `take(1)` 로 자동 unsubscribe. 깊이 sweep(`it.each`)에 대해 뮤턴트(strip no-op화) 로 각 케이스의 실제 판별력을 실측해 JSDoc 에 표로 남겼고("판별력 없음"으로 판명된 depth 도 삭제하지 않고 사유를 명시) — 이는 이 프로젝트가 과거 여러 차례 지적한 "GREEN 은 증거가 아니다" 문제에 대한 모범적 대응이다. wire(내부 WS) vs fanout(외부) 을 매 테스트에서 대조군으로 쌍으로 검증해 "통째로 날려서 통과" 하는 거짓 양성을 차단한다.
  - `interaction.service.spec.ts` 신규 2건(waiting/terminal it.each)은 REST 스냅샷이라는 별도 출구를 fanout 과 같은 강도로 커버하며, 정상 필드 보존(control) 단언을 빠뜨리지 않았다.
  - 로컬 실행: `npx jest interaction.service.spec.ts strip-external-only-fields.spec.ts websocket.service.spec.ts` → 5 suites / 147 tests 전부 통과.

### 요약
이번 diff(`strip-external-only-fields.ts`/`.spec.ts` 신설, `interaction.service.ts` REST 스냅샷 방어 추가, `websocket.service.ts` shallow strip → 공유 deep-strip 유틸 전환)는 depth 경계 sweep·`__proto__` 오염·clone-on-write 참조 보존·wire/fanout 대조군까지 뮤테이션 실측으로 판별력을 검증한, 이 리포지토리 기준으로도 상당히 높은 완성도의 테스트 스위트를 동반한다. 회귀 테스트 관점의 유일한 실질 갭은 이번 diff 가 널-가드 로직을 재배치한 `outputData`/`nodeExec.outputData` 의 `null` 경로(DB 컬럼이 nullable) 가 어떤 스펙에서도 직접 태워지지 않는다는 점이며, 이는 현재 코드를 추적하면 안전해 보이지만 회귀를 잠그는 테스트는 없다. plan 체크리스트의 사소한 stale 항목 1건(이미 충족된 테스트를 미완료로 서술) 외에는 커버리지·격리·가독성 모두 양호하다.

### 위험도
LOW
