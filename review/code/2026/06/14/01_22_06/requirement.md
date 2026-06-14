# Requirement Review — impl-form-gaps (§5.5 durationMs)

## 발견사항

### 1. [INFO] nodeExec.durationMs 폴백에서 NaN 가능성 (방어 부재)
- 위치: `execution-engine.service.ts` 변경 후 `if (nodeExec)` 블록 (라인 4150-4152)
- 상세: `resumeDurationMs`는 `nodeExec?.startedAt` 이 falsy 일 때 `undefined`가 된다. 이 경우 폴백 `resumeFinishedAt.getTime() - nodeExec.startedAt.getTime()`은 `nodeExec.startedAt`이 null/undefined이므로 `NaN`을 생성한다 (`??`는 `null`/`undefined`를 잡지만 `NaN`은 아님). 프로덕션에서 `NodeExecution.startedAt`은 DB 컬럼 `default: () => 'NOW()'`로 항상 채워지므로 실제 프로덕션 영향은 없다. 그러나 `startedAt` 없이 mock된 테스트에서 `NaN`이 DB에 저장될 수 있다.
- 제안: `nodeExec.durationMs = resumeDurationMs ?? (nodeExec.startedAt ? resumeFinishedAt.getTime() - nodeExec.startedAt.getTime() : undefined);` 로 방어. 실제 영향 없으나 코드 일관성 개선.

### 2. [WARNING] 재수화(rehydration) 경로에서 `meta.interactionType` 손실
- 위치: `execution-engine.service.ts` 4087-4111 (prevMeta 계산 + resumedMeta 조합)
- 상세: `rehydrateContext`는 `nodeOutputCache`만 복원하고 `structuredOutputCache`는 복원하지 않는다. 서버 재시작 후 재수화 경로에서 `processFormResumeTurn`이 호출되면 `prevStructured = context.structuredOutputCache?.[node.id]`가 `undefined`다. 이 PR 이전 코드(oldcode: `...(prevStructured?.meta !== undefined ? { meta: prevStructured.meta } : {})`)는 `meta` 자체를 생략했다. 이 PR 신규 코드는 `nodeExec.startedAt`이 존재하면 `{ durationMs: X }` (interactionType 없음) 를 meta로 설정한다. 결과적으로 이 PR 이후 재수화 경로에서 `meta.interactionType: 'form'`이 누락된다. spec §5.5 (form.md 295행): `meta.interactionType: 'form'` 는 engine 책임. DB에 저장되는 NodeExecution.outputData.meta에 interactionType이 없어지며, 이를 downstream이 읽으면 form 타입 인식 실패 가능.
- 제안: `prevMeta`가 없는 경우(재수화)를 보완하기 위해 노드 타입 기반 폴백을 추가한다: 예) `const fallbackMeta = node.type === 'form' ? { interactionType: 'form' as const } : {};`, 그 후 `resumedMeta = { ...fallbackMeta, ...(prevMeta ?? {}), ...(resumeDurationMs !== undefined ? { durationMs: resumeDurationMs } : {}) }`.

### 3. [INFO] 테스트에서 `ctSvc.setStructuredOutput`을 `jest.Mock`으로 타입 단언 — 실제 구현은 mock 아님
- 위치: `execution-engine.service.spec.ts` 5452-5483
- 상세: 테스트 타입 선언에서 `setStructuredOutput: jest.Mock`으로 단언하지만 실제 `ExecutionContextService`는 mocked 되지 않고 진짜 구현이다. `jest.spyOn(ctSvc, 'setStructuredOutput')`으로 spy를 붙이므로 호출은 추적되고 기능도 동작한다. 타입 단언만 부정확할 뿐 동작에는 문제 없다.
- 제안: 타입 단언에서 `setStructuredOutput: (...args: unknown[]) => void` 정도로 완화하면 더 정확하나, 기능상 영향 없어 INFO 수준.

### 4. [INFO] spec §5.5 fidelity — durationMs 정의: "waiting 시작 ~ resumed" vs `nodeExec.startedAt`
- 위치: `execution-engine.service.ts` 4084
- 상세: 사용된 `nodeExec.startedAt`은 NodeExecution 생성 시각(실행 시작)이지 정확히 "waiting 진입 시각"은 아니다. 폼 핸들러가 실행 → WAITING 저장이 거의 즉시 이루어지므로 실용적으로는 "waiting 시작 시각"과 동등하다. 그러나 spec이 말하는 "waiting 시작"과 완전히 일치하지 않는 미묘한 괴리가 있다. 코드 주석은 `nodeExec.startedAt (대기 진입 시각)`으로 문서화하고 있어 허용 가능한 근사치로 처리.
- 제안: 무시 가능. spec과의 완전 일치를 위해서는 WAITING 전이 시각을 별도 컬럼으로 저장해야 하나, 과도한 공학이다.

### 5. [INFO] `[SPEC-DRIFT]` plan/in-progress/spec-sync-form-gaps.md — §5.5 완료 체크 정확
- 위치: `plan/in-progress/spec-sync-form-gaps.md` 변경
- 상세: §5.5 구현 완료로 체크박스를 [x]로 변경하고 구현 진척 노트를 추가했다. 나머지 항목(§4/§6.2 서버측 폼 검증, §1.5 file 클라이언트 검증, §1 file 기본값, §1 ValidationPreset)은 모두 미구현([ ]) 상태를 유지했다. 계획 문서가 코드 변경과 정합적으로 갱신됐다. SPEC-DRIFT 없음.

## 요약

이번 PR은 form 노드 resume 시 `meta.durationMs`를 대기 경과시간으로 갱신하는 §5.5 요구사항을 구현했다. 핵심 로직(`processFormResumeTurn`)은 spec의 "waiting 시작 ~ resumed 경과시간" 정의에 부합하고, DB `NodeExecution.durationMs`와 동일 시각·계산을 공유해 일관성을 유지한다. 기존 meta 필드(`interactionType` 등)를 spread로 보존하는 설계도 올바르다. 다만 서버 재시작 후 재수화(rehydration) 경로에서 `structuredOutputCache`가 복원되지 않아 `prevMeta`가 없는 경우, 새 코드가 기존에 meta 자체를 생략하던 것과 달리 `interactionType` 없이 `{ durationMs }` 만 설정하는 회귀가 있다(spec §5.5 line 295 불일치). 이는 WARNING 수준 결함이나, 재수화 경로는 form 노드에 한정되고 현재 `resumeFromCheckpoint`가 `nodeOutputCache`에서 `interactionType`을 읽으므로 runtime 동작에 미치는 영향은 제한적이다.

## 위험도

LOW
