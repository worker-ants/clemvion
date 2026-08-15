### 발견사항

- **[WARNING]** `durationMs` 필드가 "null 부재 표현" 전용 OpenAPI 스키마 회귀 가드에서 빠졌다 — 같은 목적의 `it.each` 가 바로 옆 형제 필드는 커버하는데 새 필드는 등재되지 않음
  - 위치: `codebase/backend/src/modules/external-interaction/dto/responses/execution-status-response.dto.spec.ts:122-128` (`it.each([['result'], ['error']])('%s 는 null 을 쓰는 형제 필드다 — nullable 이다', ...)`) — 이 diff 가 손대지 않은 기존 파일. 신규 필드는 `codebase/backend/src/modules/external-interaction/dto/responses/execution-status-response.dto.ts:130` (`durationMs?: number | null;`, `@ApiPropertyOptional({ nullable: true, ... })` 는 게이트 `123-129`).
  - 상세: `execution-status-response.dto.spec.ts` 는 실제 `SwaggerModule.createDocument` 로 생성한 OpenAPI 문서를 대상으로 "부재 표현 — null vs 키 생략 (API 규약 §5.4)" 를 정확히 이 목적으로 테스트하는 describe 를 이미 갖고 있고, `result`/`error` 두 필드에 대해 `schema.nullable === true` 를 `it.each` 로 고정한다. 신규 `durationMs` 는 DTO JSDoc·`@ApiPropertyOptional` 모두 정확히 같은 "종결 전 null(키 present)" 규약(§5.4)을 따른다고 명시하는데도, 이 파일은 이번 diff 에서 전혀 수정되지 않았다(`grep durationMs` 결과 0건). 이 describe 블록이 정확히 이런 회귀(예: 향후 실수로 `nullable` 옵션이 빠지거나 필드가 `required` 로 바뀜)를 잡기 위해 존재하는데, 새 필드가 그 안전망 밖에 남아 있다. 같은 패턴(`context`/`currentNode`)의 다른 필드들도 각각 전용 단언을 갖고 있어, `durationMs` 만 예외적으로 스키마 레벨 회귀 가드가 없는 상태다.
  - 제안: `it.each([['result'], ['error'], ['durationMs']])` 로 목록에 추가하거나, 별도 테스트로 `executionStatus.properties?.durationMs` 의 `type`(`integer`)·`nullable`(`true`) 을 함께 단언할 것.

- **[INFO]** `finalizeCancelledExecution` 의 "정상 경로"(guarded UPDATE 1행 매칭, `persisted===true`) 를 이름으로 직접 고정하는 테스트가 이번 diff 의 신규 describe 안에는 없다
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts:1072-1126` (`describe('finalizeCancelledExecution — 0행 매칭의 두 의미', ...)`)
  - 상세: 신규 describe 는 (a)(b)(c) 모두 `mockExecutionRepo.query.mockResolvedValueOnce([])` 로 0행 매칭(재조회 분기)만 구성한다. 가장 흔한 케이스인 "guarded UPDATE 가 그 자리에서 1행 매칭 → 즉시 emit" 경로는 이 describe 이름으로는 검증되지 않는다. `execution-engine.service.spec.ts:6805` 의 기존 `W15` 테스트(`Sub-Workflow 노드에서 ExecutionCancelledError...`)가 `runExecution` catch 경유로 `execution.cancelled` emit 자체는 간접 확인하지만 `durationMs` 값은 `objectContaining({ status: 'cancelled' })` 로만 느슨하게 검증해 payload 완전성까지는 보증하지 않는다. 직전 라운드(`13_58_27` testing.md INFO)도 같은 지점을 "조치 불요"로 남겨 둔 상태와 동일하며, 실질 결함은 아니지만 이번 라운드에도 갭은 그대로다.
  - 제안: 여유가 있으면 같은 describe 에 `mockExecutionRepo.query.mockResolvedValueOnce([{ id: ... }])` (1행) 케이스를 추가해 자매 `finalizeFailedExecution` 처럼 양성/음성 두 분기가 모두 이름으로 고정되게 할 것.

- **[INFO]** `retry-turn.service.spec.ts` 의 `createQueryBuilder` mock 리터럴이 파일 전체 15곳 중 4곳만 이번 diff 로 `returning`/`setParameter` 를 갖췄다 — 나머지 11곳은 프로덕션이 그 체인에 새 메서드를 추가하면 개별적으로 다시 깨질 수 있는 구조
  - 위치: `codebase/backend/src/modules/execution-engine/retry-turn.service.spec.ts:1090`, `:1141`, `:1172` (FAILED/COMPLETED 멱등 분기용 override, `returning` 미보유) 대비 `:1253`, `:1319-1325`, `:1380` (CANCELLED 분기용, 이번 diff 로 `returning` 추가)
  - 상세: 실제 프로덕션 코드를 직접 대조한 결과 `returning()` 호출은 `finalizeGuarded` 의 `target === ExecutionStatus.CANCELLED` 분기(`retry-turn.service.ts:641-676`)에만 있고, FAILED/COMPLETED 멱등 분기(`:677-690`)는 별도 체인이라 `returning` 이 없어도 현재는 정상이다 — 즉 지금 당장 vacuous 위험은 없다. 다만 파일 상단 beforeEach 기본 mock 의 주석(`:76-78`)이 스스로 경고하는 "체인 메서드 하나가 늘 때마다 개별 override 가 TypeError 로 조용히 vacuous 해진다"(#1171 실제 사례) 패턴이, 이번에도 diff 가 손댄 4곳 외 11곳에는 여전히 잠재해 있다. `maintainability.md`(`13_58_27`) 가 이미 이 항목을 WARNING 으로 지목했고 plan 문서가 "관용구 16곳 헬퍼 추출 — 별도 PR" 로 명시적으로 defer 했으므로, 테스트 관점에서는 그 결정을 재론하지 않고 참고로만 남긴다.
  - 제안: 조치 불요(이미 등재·defer 됨). 후속 헬퍼 추출 PR 에서 함께 해소될 항목.

## 확인된 강점 (검증 방법 포함)

- `finalizeCancelledExecution` 신규 테스트 (a)/(b)/(c) 는 `stop()` 이 실제로 emit 을 안 쏘는 RUNNING/PENDING 경로를 정확히 겨냥한 discriminating fixture(`liveStatus: CANCELLED | FAILED | null`)를 쓰고, (a) 는 값(`durationMs: 777`)까지 DB 정본과 대조한다 — RESOLUTION.md 가 기록한 양방향 뮤테이션(`if(true)`/`if(false)` 각각 RED)과 실제 소스(`execution-engine.service.ts:4903-4929`)를 직접 대조해 일치를 확인했다.
- `retry-turn.service.spec.ts` 의 신규 테스트(`emit 은 로컬 재계산값이 아니라 COALESCE 가 보존한 DB 값을 싣는다`, `:1309-1374`)는 직전 라운드(`13_58_27` testing.md)가 WARNING 으로 지목했던 두 커버리지 갭(`.returning()` 호출 자체 미보증·`finishedAt` 되쓰기 미검증)을 정확히 닫았다 — `returningSpy` 로 `.returning(['duration_ms','finished_at'])` 인자까지 스파이 단언하고, `raw` 의 `finished_at` 을 pg 드라이버 실동작(문자열)으로 fixture 화해 `execArg.finishedAt` 되쓰기 결과를 직접 단언한다. 두 개선 모두 mock 이 "호출 여부와 무관하게 항상 같은 값을 반환"하던 이전 문제를 구조적으로 해소한다.
- `interaction.service.spec.ts` 의 `durationMs 0 을 null 로 뭉개지 않는다` 테스트는 직전 라운드 INFO(`??`↔`||` 치환 뮤턴트가 구분 안 됨)를 정확히 닫는다 — 이 저장소가 반복 지적해 온 "`??`/`||` 는 각 항이 별도 표면" 패턴에 부합.
- `toPersistedDate` 는 자매 `toFiniteNumber` 와 대칭으로 Date/문자열/null/undefined/빈문자열/공백/파싱불가/Invalid Date/숫자/객체 9가지를 `it.each` 로 표 방식 커버 — 경계값이 두텁다.
- `mockExecutionRepo`(양쪽 spec 파일 모두)는 최상위 `beforeEach` 에서 매 테스트 재생성되고, `jest.spyOn(eventEmitter, 'emitExecution')` 도 `service` 재생성 시점(파일 comment `execution-engine.service.spec.ts:726`)에 함께 새로 만들어져 테스트 간 누수가 없다 — 격리 양호.
- `STATUS_PROJECTION_COLUMNS`/`BASE_COLUMNS` 정확집합 가드(`interaction.service.spec.ts:1032-1080`, `expect(select.slice().sort()).toEqual(BASE_COLUMNS.slice().sort())`)에 `durationMs` 가 함께 추가되어, 프로젝션 누락을 별도 뮤테이션 없이도 구조적으로 잡는다.

### 요약

이번 diff 는 직전 라운드(`13_58_27`)의 testing WARNING 2건(`.returning()` 빌더 호출 미보증, `finishedAt` 되쓰기 미검증)과 INFO 1건(`durationMs===0` 경계)을 전부 스파이 단언·discriminating fixture 로 정확히 닫았고, RESOLUTION.md 가 기록한 뮤테이션 근거를 실제 소스와 대조해 일치함을 확인했다. `finalizeCancelledExecution` 신규 테스트 3종도 자매 `finalizeFailedExecution` 과 동일한 discriminating fixture 패턴을 재사용해 읽기 쉽고, 세 갈래(DB 이미 cancelled/다른 종결자 승리/행 부재)를 정확히 가른다. 다만 새로 발견한 갭이 하나 있다 — `durationMs` 가 §5.4 "null 부재 표현" 규약을 따른다고 문서화해 놓고도, 정확히 그 규약을 실제 OpenAPI 스키마로 검증하는 기존 회귀 가드(`execution-status-response.dto.spec.ts` 의 `result`/`error` 형제 `it.each`)에는 등재되지 않았다. 이 파일은 이번 diff 대상에 포함되지 않아 리뷰 스코프 밖에서 조용히 비어 있었다. 나머지는 이전 라운드에 이미 등재·defer 된 항목의 재확인(INFO)뿐이다.

### 위험도

LOW
