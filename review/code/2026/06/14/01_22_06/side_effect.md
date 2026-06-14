# 부작용(Side Effect) Review

## 발견사항

### [INFO] 파일 2: `resumeFinishedAt` 지역 변수로 `new Date()` 단일 생성 — 이전 `nodeExec.finishedAt = new Date()` 대비 의미 동일
- 위치: `execution-engine.service.ts` diff +line `resumeFinishedAt = new Date()` 및 `nodeExec.finishedAt = resumeFinishedAt`
- 상세: 기존 코드는 `nodeExec.finishedAt = new Date()` 와 `nodeExec.durationMs = nodeExec.finishedAt.getTime() - nodeExec.startedAt.getTime()` 를 순서대로 실행했다. 변경 후에는 `resumeFinishedAt` 한 변수로 두 연산을 공유한다. 캡처 시점 차이는 수십 마이크로초 수준으로 기능적으로 동일하며 부작용 없음.
- 제안: 문제 없음.

### [INFO] 파일 2: `prevMeta` null-guard 강화 — 기존 `prevStructured?.meta !== undefined` 조건 대비 동작 차이 가능성
- 위치: `execution-engine.service.ts` diff `-3:` `...(prevStructured?.meta !== undefined ? { meta: prevStructured.meta } : {})` → `...(resumedMeta !== undefined ? { meta: resumedMeta } : {})`
- 상세: 기존 코드는 `prevStructured.meta` 가 `null` 이면 `{ meta: null }` 을 spread 했다. 변경 후 `prevMeta` 계산에서 `meta !== null` 조건을 추가로 검사하므로 `meta === null` 인 경우 `prevMeta = undefined` → `resumedMeta` 는 `resumeDurationMs` 가 있으면 `{ durationMs: ... }` 만 포함, 없으면 `undefined`. 실질적으로 `meta: null` 전파를 차단하는 효과가 있다. 운영 DB에 `meta: null` 이 저장된 레거시 row 가 있다면 동작이 미묘하게 바뀌지만, `null` meta 는 schema상 유효하지 않으므로 개선으로 볼 수 있다. 단, 기존 계약을 바꾸는 사소한 의미 변화임을 인지 필요.
- 제안: 허용 범위 내. 필요하다면 주석으로 레거시 `null` 처리를 명시.

### [INFO] 파일 2: `resumeDurationMs` 가 `undefined` 일 때 DB `nodeExec.durationMs` 계산 경로 변화
- 위치: `nodeExec.durationMs = resumeDurationMs ?? resumeFinishedAt.getTime() - nodeExec.startedAt.getTime()`
- 상세: `nodeExec?.startedAt` 이 falsy(`undefined`/`null`)인 경우 `resumeDurationMs = undefined` → nullish coalescing fallback `resumeFinishedAt.getTime() - nodeExec.startedAt.getTime()` 이 실행된다. `nodeExec.startedAt` 이 실제로 `undefined` 이면 `NaN` 이 저장될 수 있다. 기존 코드도 `nodeExec.finishedAt.getTime() - nodeExec.startedAt.getTime()` 에서 동일하게 `NaN` 을 생성했으므로, 기존 대비 새로운 부작용은 아니다. 그러나 `resumeDurationMs` 계산 시 `nodeExec?.startedAt` 을 optional chaining으로 체크한 덕분에 `meta.durationMs` 는 보존되지만 DB `durationMs` 는 여전히 `NaN` 위험이 잠재한다.
- 제안: `nodeExec` 분기 내부에서 `nodeExec.startedAt` 존재 여부를 한번 더 체크하거나, 기존 코드와 동일 위험 수준임을 문서화.

### [INFO] 파일 1(테스트): `structuredOutputCache` 직접 변조 — 내부 구현 의존
- 위치: `execution-engine.service.spec.ts` 신규 테스트 +line 64–73
  ```ts
  (context as { structuredOutputCache: Record<string, unknown> }).structuredOutputCache = { ... };
  ```
- 상세: `ExecutionContextService` 의 `structuredOutputCache` 내부 필드를 타입 캐스팅으로 직접 세팅한다. 이는 서비스 내부 구현이 바뀌면 테스트가 묵묵히 깨질 수 있다(false-negative). 다른 테스트에서도 유사 패턴이 사용되는지 확인 필요. 테스트 파일의 변경이므로 프로덕션 부작용은 없다.
- 제안: 가능하다면 `contextService.setStructuredOutput(...)` 공개 API로 초기 상태를 주입하는 방식으로 리팩터링. 단기적으로는 허용.

### [INFO] 파일 3(plan md): 기능적 부작용 없음
- 위치: `plan/in-progress/spec-sync-form-gaps.md`
- 상세: 체크박스 갱신 및 진척 노트 추가만 포함. 코드/상태 변경 없음.
- 제안: 없음.

---

## 요약

이번 변경의 핵심은 `processFormResumeTurn` 내 `meta.durationMs` 를 재개 시점 경과시간으로 갱신하는 것이다. `resumeFinishedAt` 단일 변수로 structured meta 와 DB `durationMs` 계산을 공유한 점은 타임스탬프 일관성을 향상시키며 의도치 않은 상태 변경은 없다. `prevMeta` null 처리 강화로 `meta: null` 레거시 row 에 대한 동작이 미세하게 바뀌지만 운영 영향은 극소. 테스트에서 내부 필드(`structuredOutputCache`)를 직접 변조하는 패턴은 리팩터링 취약점이나 프로덕션 부작용은 아니다. 전역 변수 변경, 파일시스템 부작용, 환경 변수 읽기/쓰기, 시그니처 변경, 공개 API 변경, 의도치 않은 네트워크 호출, 이벤트/콜백 변경은 모두 없다.

## 위험도

LOW
