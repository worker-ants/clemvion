# Testing Review

## 발견사항

### [INFO] processFormResumeTurn 의 화이트리스트 필터링 로직 미테스트
- 위치: `processFormResumeTurn` 4 branches 테스트 (케이스 a) — spec `§10.9` 화이트리스트
- 상세: 케이스 (a)는 sentinel 정상 unwrap + `nodeExec.status = COMPLETED` 저장을 검증하지만, `node.config.fields` allowedFieldNames 화이트리스트 필터(미정의 키 제거)가 실제로 동작하는지는 검증하지 않는다. `makeFormNode`는 `fields: [{ name: 'answer' }]`를 정의하며 payload도 `{ answer: 'yes' }`만 전달하므로, 허용되지 않은 키(예: `xss_payload: '<script>'`)가 `interactionData`에서 제거되는지를 검증하는 케이스가 없다. 이 경로는 security-critical(WARN #8)이다.
- 제안: 케이스 (a) 또는 별도 케이스에서 `formData: { answer: 'yes', __proto__: 'x', injected: '<script>' }`를 전달하고, `ctx.nodeOutputCache[nodeId]`의 `interaction.data`에 `injected` 키가 존재하지 않음을 assert하는 테스트 추가 권장.

### [INFO] processButtonResumeTurn 전용 4-branch 단위 테스트 부재
- 위치: 파일 전체
- 상세: 이번 diff는 `processFormResumeTurn`에 대한 4-branch 테스트(`SUMMARY W1` describe 블록, 라인 14074~)와 `driveCallStackResume`/`runExecutionFromQueue`/`rehydrateAndResume` 보완 테스트(`SUMMARY W3/W5/W6/W7`)를 추가했다. 그러나 대칭적으로 존재하는 `processButtonResumeTurn`(라인 6550)에 대한 동등한 독립 단위 테스트 describe 블록은 없다. 현재는 통합 slow-path 테스트(라인 10643)에서 mock spy로만 검증한다. `processButtonResumeTurn` 도 sentinel → `{type:'button_click', buttonId}` 검증, RUNNING 가드(status === RUNNING → nodeExec만 save), nodeExec null skip, buttonId 누락(undefined) 처리 등 동일한 4개 분기를 보유한다.
- 제안: `processFormResumeTurn — 4 branches` 와 대칭하는 `processButtonResumeTurn — 4 branches` describe 블록 추가 권장. 현재 통합 테스트로 커버는 되나, 격리된 단위 테스트 없이는 리그레션 격리가 어렵다.

### [INFO] W6 테스트에서 `rehydrateAndResume` 의 outer catch 흡수를 `resumeFromCheckpoint` mock으로만 검증
- 위치: W6 테스트 (라인 729~791)
- 상세: W6는 `resumeFromCheckpoint`를 `mockRejectedValueOnce`로 교체해 outer catch 흡수를 검증한다. 이는 `resumeFromCheckpoint` 이전 단계(예: `rehydrateContext` throw, `nodeRepository.findOneBy` → null로 인한 `RehydrationError`)를 커버하지 않는다. 실제 outer catch는 `resumeFromCheckpoint` 뿐 아니라 그 이전의 invariant 검증/graph load 실패도 도달 대상이다. `RehydrationError` throw 경로(RESUME_CHECKPOINT_MISSING)와 일반 Error throw 경로를 구분해 검증하면 완결성이 높아진다.
- 제안: W6에 추가로 `nodeRepository.findOneBy → null` 시나리오를 mock해 `markExecutionCancelled` 호출 여부를 assert하는 케이스를 권장.

### [INFO] W3 테스트의 `driveCallStackResume` 호출 인자에서 `callStack.frames`가 1개로만 고정 — 0개/2개 엣지케이스 미검증
- 위치: W3 describe 블록 (라인 466~688)
- 상세: W3 테스트는 `frames` 길이 1인 call stack만 테스트한다. `driveCallStackResume`이 실제로 frame 순회를 하는 로직(최내 frame vs. 외곽 frame 처리 분기)이 있다면, `frames.length === 0` 또는 `frames.length === 2` 시나리오에서 동작이 달라질 수 있다. 특히 `frames.length === 0`은 call stack이 없는 경우(잘못된 비null `resumeCallStack`)로, 방어 가드 테스트로 유의미하다.
- 제안: W3에 `frames: []` 케이스 추가(예외 또는 graceful 처리 검증). 기존 테스트는 정상 경로만 커버한다.

### [INFO] service2/service3의 중복 TestingModule boilerplate — 테스트 유지보수 부담
- 위치: `processFormResumeTurn — 4 branches` (라인 56~208)와 `SUMMARY W3/W5/W6/W7` (라인 495~626)
- 상세: 두 describe 블록이 거의 동일한 `Test.createTestingModule` 설정을 각각 `beforeEach`에서 반복한다(service2/service3). 공통 `buildTestModule()` 헬퍼 팩토리 함수가 없어 providers 목록이 두 번 복사됐다. 실제로 두 인스턴스의 mock 구성이 미묘하게 다르다: 예를 들어 `service2`의 `ContinuationBusService`는 `publish/subscribe/close`만 제공하고, `service3`는 `acquireLock/releaseLock`이 없다. 이 불일치가 의도적인지 실수인지 불분명하며, 향후 providers가 추가될 때 두 곳을 동시에 수정해야 하는 유지보수 비용이 있다.
- 제안: 공통 `buildMinimalTestModule(overrides?)` 팩토리를 `__test__/` 디렉터리 헬퍼로 추출하거나, 두 describe 블록이 하나의 shared `beforeAll`을 사용하도록 리팩토링. 현재 상태도 동작하므로 blocking은 아님.

### [INFO] W5 테스트에서 `executionRepository.findOneBy`를 직접 속성 할당으로 교체
- 위치: W5 테스트 (라인 702~726)
- 상세: `svc.executionRepository.findOneBy = jest.fn().mockResolvedValue(...)` 패턴으로 private 레포지토리 필드를 직접 교체한다. TypeORM Repository의 `findOneBy`가 `readonly` 또는 구성적(composition)이면 런타임에서 교체가 실패할 수 있다. 현재 동작하지만, NestJS의 mock repository가 plain object이므로 실제 TypeORM 동작과 괴리가 있다. `jest.spyOn(svc.executionRepository, 'findOneBy').mockResolvedValue(...)` 패턴이 더 안전하다.
- 제안: `svc.executionRepository.findOneBy = jest.fn()` 직접 할당을 `jest.spyOn` + `afterEach mockRestore`로 교체 권장.

### [INFO] W7에서 `logger.error` 메시지 검증 문자열이 구현 의존적
- 위치: W7 테스트 (라인 826~828)
- 상세: `expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('secondary error'))` 는 구현의 로그 메시지 문자열(`'failFirstSegmentSetup secondary error for ...'`)에 직접 의존한다. 로그 메시지가 리팩터링되면 테스트가 깨지는 brittle assertion이다. 또한 `errorSpy`가 여러 번 호출될 수 있는 환경에서 특정 호출을 정확히 지정하지 않는다.
- 제안: `expect.stringContaining` 대신 특정 call index를 지정(`errorSpy.mock.calls[0][0]`)하거나, 에러 코드/structured log field를 검증하는 방식으로 변경하면 내구성이 높아진다. 현재 LOW risk.

---

## 요약

이번 diff는 `processFormResumeTurn`의 4개 분기(sentinel unwrap / non-sentinel fallback / RUNNING 가드 / nodeExec null skip)와 `driveCallStackResume` nested AI re-park, `runExecutionFromQueue` W5/W6/W7 예외 흡수 경로를 검증하는 단위 테스트를 추가했다. 핵심 분기들이 대부분 커버되어 있고, `service2`/`service3` 각각의 `TestingModule` 설정도 상세하다. 다만 `processButtonResumeTurn`에 대한 동등한 isolated 단위 테스트 describe 블록이 없고, security-critical한 화이트리스트 필터링 로직 검증이 빠져 있으며, `driveCallStackResume`의 empty-frames 엣지케이스가 미검증이다. 두 describe 블록의 중복 boilerplate는 유지보수 부담을 높인다. 전반적으로 핵심 분기 커버는 달성됐으나 symmetry(button) 및 엣지케이스 보완 여지가 있다.

## 위험도

LOW

STATUS: SUCCESS
