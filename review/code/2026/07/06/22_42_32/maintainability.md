# 유지보수성(Maintainability) Review

## 리뷰 대상
- `codebase/backend/src/modules/execution-engine/execution-engine.service.ts`
- `codebase/backend/src/modules/execution-engine/queues/background-execution.processor.ts` (docstring만)
- `codebase/backend/src/modules/notifications/entities/notification.entity.ts`
- `codebase/backend/src/modules/notifications/notifications.service.spec.ts`
- `codebase/backend/src/modules/notifications/notifications.service.ts`
- `plan/in-progress/*.md` (계획 문서, 코드 아님 — 스킵)

(review/code/2026/07/06/21_23_13/** 는 이전 리뷰 세션의 산출물이 diff 에 포함된 것으로, 이번 변경의 리뷰 대상 코드가 아니므로 분석에서 제외함.)

## 발견사항

- **[INFO]** `getNotificationsService()` 캐시 로직의 `undefined`/`null` 삼중 상태 처리가 다소 읽기 부담
  - 위치: `execution-engine.service.ts:97-110` (`getNotificationsService`)
  - 상세: `resolvedNotificationsService`는 `undefined`(미시도) / `null`(시도했으나 실패, 캐시됨) / `NotificationsService`(성공) 세 상태를 갖는다. `if (this.resolvedNotificationsService !== undefined) return this.resolvedNotificationsService ?? undefined;` 라인은 "캐시가 존재하면(null 포함) null→undefined 로 변환해 반환"을 한 줄에 압축해 의도 파악에 약간의 인지 비용이 든다. 로직 자체는 정확하다(캐시 미스일 때만 `moduleRef.get` 재시도를 피함).
  - 제안: 필수는 아니나, 세 상태를 명시적 enum-like 캐시(`{ resolved: NotificationsService | null } | undefined`)나 별도 boolean flag(`triedResolve`)로 표현하면 `null`/`undefined` 이중 의미를 분리해 더 명확해짐. 현재도 주석("어느 경로로도 못 찾으면 undefined")이 의도를 보완하므로 시급하지 않음.

- **[INFO]** `dispatchExecutionFailedNotification` 호출부가 두 종결 경로(`runExecution` catch, `finalizeResumedExecutionOutcome`)에 중복 배치되어 있고, 그 앞의 FAILED 마킹 시퀀스(status/error 객체 조립/finishedAt/durationMs 계산/save/emitExecution) 자체도 두 곳에서 거의 동일하게 반복됨
  - 위치: `execution-engine.service.ts:4404-4436` (초기 세그먼트 catch) vs `execution-engine.service.ts:2472-2507` (`finalizeResumedExecutionOutcome`)
  - 상세: 이번 커밋은 후자에 `dispatchExecutionFailedNotification` 호출 한 줄만 추가해 버그를 고쳤으나, 그 상위 블록(`errMessage` 계산, `error` 객체의 sentinel 코드 보존 조건, `finishedAt`/`durationMs` 계산, `save` + `emitExecution` 시퀀스)이 두 위치에 사실상 동일한 코드로 존재한다. 이는 이번 diff 로 신규 도입된 중복이 아니라 선존 구조이며, 이번 fix 는 그 중복 지점 중 하나에만 dispatch 를 추가하는 방식으로 버그를 막았다 — 정확히 이런 "두 곳에 동일 로직이 있는데 한쪽만 갱신되어 놓침" 패턴이 버그 A 의 근본 원인이었다는 점에서, 향후 세 번째 종결 경로가 생기면 동일한 누락이 재발할 구조적 위험이 남아 있음.
  - 제안: 시급한 리팩터링은 아니나(이번 diff 스코프를 벗어남), 두 종결 경로의 공통 "FAILED 마킹 + dispatch" 로직을 `finalizeFailedExecution(savedExecution, error)` 같은 단일 private 헬퍼로 추출하면 향후 유사 dispatch 배선 누락을 구조적으로 예방할 수 있음. 후속 followup 항목으로 기록해둘 가치가 있음.

- **[INFO]** `finalizeResumedExecutionOutcome` 끝의 신규 주석이 다소 길고, "이유+재발방지" 설명이 코드 본문에 인라인됨
  - 위치: `execution-engine.service.ts:2503-2507`
  - 상세: 4줄 주석("초기 세그먼트와 동일하게~알림 없이 지나간다")은 버그 재발 방지 관점에서 가치 있는 정보이나, 함수 본문에 직접 박혀있어 함수의 핵심 흐름(마킹→저장→이벤트→알림)을 읽을 때 상대적으로 무거움. 커밋 메시지/plan 문서에 이미 동일 설명이 있어 다소 중복.
  - 제안: 현재 수준으로 유지 가능(이런 "선존 결함의 근인" 설명은 코드베이스 전반의 관례 — 예: 바로 위 sentinel-code 주석, `getNotificationsService` JSDoc 도 유사 밀도). 다만 매우 상세한 서사형 주석이 필요하면 함수 docstring 으로 옮기고 인라인은 한 줄 요약만 남기는 방식도 고려 가능.

- **[INFO]** `notify`/`createMany` 의 `if (entry.resourceType) row.resourceType = ...` 3줄 패턴 반복 (신규 `backgroundRunId` 라인 추가로 인한 자연스러운 확장)
  - 위치: `notifications.service.ts` `notify()` 및 `createMany()` 내부 (diff 로 각각 `if (entry.backgroundRunId) row.backgroundRunId = ...` / `if (e.backgroundRunId) row.backgroundRunId = ...` 1줄씩 추가)
  - 상세: optional 필드가 늘어날 때마다 `if (x) row.x = x` 형태가 `notify`/`createMany` 양쪽에 병렬로 늘어나는 구조. 현재는 3개 필드(`resourceType`/`resourceId`/`backgroundRunId`)로 관리 가능한 수준이나, 필드가 더 늘면 두 메서드 간 누락(한쪽만 갱신) 리스크가 생길 수 있는 패턴 — architecture 리뷰가 지적한 "엔티티 컬럼 누적" 우려와 동일 축의 유지보수성 신호.
  - 제안: 현재 스코프에서 리팩터링 불필요(YAGNI). 필드가 4-5개를 넘어서면 `Object.assign(row, pickDefined(entry, ['resourceType','resourceId','backgroundRunId']))` 류의 공통 헬퍼로 통합해 `notify`/`createMany` 양쪽의 drift 를 방지하는 것을 고려.

- **[INFO]** 네이밍·컨벤션 일관성은 양호
  - 위치: 전체 diff
  - 상세: `getNotificationsService`, `dispatchExecutionFailedNotification`, `findByBackgroundRun` 등 신규/변경 식별자가 기존 컨벤션(camelCase 메서드, `dispatch*`/`get*` prefix 의미 일치)을 그대로 따르고, `resolvedNotificationsService`(캐시 필드) 네이밍도 목적을 명확히 드러낸다. `getNotificationsService` 지연 해석 패턴이 주석에서 "NotificationsService→WebsocketService 지연해석과 동일 패턴"이라 명시해 기존 코드베이스 관례를 재사용했음을 밝힌 점도 일관성 측면에서 긍정적.
  - 제안: 없음.

- **[INFO]** 신규 unit 테스트(`notifications.service.spec.ts`)는 read/save mock 패턴이 기존 describe 블록들과 동일 스타일 유지
  - 위치: `notifications.service.spec.ts:293-480` (`findByBackgroundRun`, `backgroundRunId attribution 세팅`)
  - 상세: `repo.create.mockImplementation`/`repo.save.mockImplementation` 을 통한 저장 row 캡처 패턴이 파일 내 기존 테스트들과 동일해 가독성·일관성 문제 없음. 매직 넘버/매직 스트링(`'bg-run-1'`, `'ws-1'` 등)은 테스트 fixture 성격상 통상적 수준으로 문제 삼지 않음.
  - 제안: 없음.

- **[INFO]** 매직 넘버 없음, 중첩 깊이 적정
  - 위치: 전체 diff
  - 상세: 신규 로직(`getNotificationsService`, dispatch 호출 추가, `select: false` 옵션 추가)에 하드코딩된 의미 불명 숫자·문자열은 없다. `getNotificationsService` 의 try/catch 는 1단계 중첩으로 적절하고, `finalizeResumedExecutionOutcome`/`dispatchExecutionFailedNotification` 모두 기존 함수 길이·중첩 수준에서 벗어나지 않는 최소 diff.
  - 제안: 없음.

## 요약

이번 변경은 기존 dispatch 누락 버그(재개 세그먼트 경로에서 `execution_failed` 미발사)와 DI 타이밍 버그(`@Optional` 순환 그래프 undefined)를 최소 diff 로 수정하면서, 신규 헬퍼(`getNotificationsService`)와 JSDoc 보강을 통해 코드 의도를 명확히 문서화했다. 가독성·네이밍·일관성은 기존 코드베이스 관례(주석 밀도, `dispatch*`/`get*` 네이밍, ModuleRef 지연 해석 패턴 재사용)를 잘 따르고 있으며 신규 도입된 매직 넘버나 과도한 중첩은 없다. 다만 두 가지 구조적 신호는 계속 관찰할 가치가 있다 — (1) `runExecution` catch 와 `finalizeResumedExecutionOutcome` 이 FAILED 마킹+dispatch 시퀀스를 여전히 중복 보유하고 있어 이번과 같은 "한쪽만 갱신되어 누락" 버그가 재발할 구조적 소지가 남아 있고, (2) `notify`/`createMany` 의 optional 필드별 `if` 라인이 필드 추가마다 두 메서드에 병렬로 늘어나는 패턴이다. 둘 다 이번 diff 의 책임 범위를 넘는 선존 구조이므로 이번 fix 자체를 낮은 점수로 평가할 사유는 아니며, CRITICAL/WARNING 급 유지보수성 이슈는 없다.

## 위험도

LOW
