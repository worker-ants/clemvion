# 유지보수성(Maintainability) 리뷰

## 발견사항

- **[INFO]** `notify()` / `createMany()` 의 optional 필드 대입 패턴 3회 반복
  - 위치: `codebase/backend/src/modules/notifications/notifications.service.ts:290-292`, `:331-333`
  - 상세: `if (entry.resourceType) row.resourceType = entry.resourceType;` / `if (entry.resourceId) ...` / `if (entry.backgroundRunId) ...` 3줄 블록이 `notify()`와 `createMany()` 양쪽에 동일하게 중복된다. `backgroundRunId` 필드가 이번 변경으로 추가되며 기존 2줄 패턴에 1줄이 더 늘어 중복 폭이 커졌다. 향후 optional 필드가 하나 더 추가되면 두 곳을 모두 고쳐야 하는 누락 위험이 있다.
  - 제안: `applyOptionalFields(row, entry, ['resourceType', 'resourceId', 'backgroundRunId'])` 같은 작은 헬퍼로 추출하거나, `Object.assign(row, pick(entry, [...]))` 형태로 통합. 다만 현재 2곳·3줄 규모라 리팩터링 강제까지는 아니며, 다음 필드 추가 시점에 고려해도 무방.

- **[INFO]** `dispatchFailureNotification`의 인라인 주석이 processor 상단 JSDoc 및 서비스 계층 JSDoc과 3중 반복
  - 위치: `codebase/backend/src/modules/execution-engine/queues/background-execution.processor.ts:39-46(클래스 JSDoc)`, `:171-177(메서드 내부 주석)`; `codebase/backend/src/modules/notifications/notifications.service.ts:44-51(findByBackgroundRun JSDoc)`, `:266-268(notify JSDoc)`; migration V107 파일 헤더 주석
  - 상세: "딥링크는 workflow, attribution은 background_run_id로 분리" 라는 동일한 설명이 최소 5곳(마이그레이션 파일 헤더, entity 컬럼 주석, processor 클래스 JSDoc, processor 메서드 내부 주석, notifications.service 두 곳, background-runs.service 한 곳)에 문장 단위로 되풀이된다. 각 발생 파일 내 지역적 이해를 돕는 목적으로는 유효하지만, 향후 이 설계가 재변경되면 5~6곳을 동시에 고쳐야 하는 동기화 부담이 생긴다.
  - 제안: 단일 진실은 migration 파일 헤더 + spec(`data-flow/8-notifications.md`, spec-update draft 예정)에 두고, 코드상 나머지 위치는 "왜"를 1줄로 축약 후 spec/마이그레이션 링크만 참조하는 방식으로 압축을 고려. 현재는 각 주석이 지역 문맥에 맞게 적절히 다르게 쓰여 있어 즉각 수정이 필요한 수준은 아님(INFO).

- **[INFO]** `backgroundRunId: data.backgroundRunId || undefined` — falsy 연산자의 암묵적 의도
  - 위치: `codebase/backend/src/modules/execution-engine/queues/background-execution.processor.ts:188`
  - 상세: `||` 연산자로 빈 문자열(`''`, legacy NodeExecution)과 `undefined`/`null`을 모두 `undefined`로 정규화한다. 의도는 주석(`:176-177`)으로 설명되어 있어 읽으면 이해 가능하지만, `||` 사용은 값이 `0`이나 `false`인 경우까지 함께 걸러지는 일반적 falsy 함정을 갖고 있다(현재 타입은 string이라 실질적 위험은 없음). `?:` 명시적 삼항이나 `data.backgroundRunId ? data.backgroundRunId : undefined`가 의도를 더 명확히 드러낸다.
  - 제안: 현재 타입 안정성엔 문제 없으나, 코드 리뷰어가 반복적으로 "왜 `||`인가"를 재해석해야 하는 비용을 줄이려면 `data.backgroundRunId === '' ? undefined : data.backgroundRunId`처럼 조건을 명시하는 편이 근소하게 더 읽기 쉽다. 우선순위 낮음.

- **[INFO]** 신규 e2e 테스트 파일의 헬퍼 함수 재정의
  - 위치: `codebase/backend/test/execution-failed-notification.e2e-spec.ts` 전체 (`pollExecutionStatus`, `createWorkflow`, `triggerNode`, `failingCodeNode`, `saveCanvas`, `execute`, `pollNotifications` — 287줄)
  - 상세: 이 e2e 파일의 워크플로 생성/실행/폴링 헬퍼들은 이름과 형태가 `background-monitoring.e2e-spec.ts`의 기존 헬퍼(`createBackgroundFailingWorkflow`, `executeAndGetBackgroundRunId` 등, 파일 3 diff 문맥에서 확인)와 상당히 유사한 책임(워크플로우 생성 → 캔버스 저장 → 실행 → 폴링)을 갖는다. 리뷰 대상 diff 범위에는 기존 e2e 헬퍼 모듈(`test/helpers/*`) 재사용 여부가 드러나지 않아 확정할 수 없으나, 두 e2e 파일 간에 유사 패턴이 존재할 가능성이 있다.
  - 제안: `test/helpers/workflow.ts` 같은 공유 헬퍼로 승격할 여지가 있는지 후속 검토 권장(다만 e2e 스펙 파일은 관례상 로컬 헬퍼를 선호하는 경우도 많아 강제 사항은 아님).

- **[INFO]** 매직 넘버 자체는 이미 상수화되어 있음(참고용 긍정 관찰)
  - 위치: `codebase/backend/src/modules/execution-engine/queues/background-execution.processor.ts:16` (`ERROR_MESSAGE_MAX_LENGTH = 500`), `execution-failed-notification.e2e-spec.ts` 의 `timeoutMs`/`intervalMs` 기본값들
  - 상세: 신규/변경 코드에서 새로 도입된 하드코딩 매직 넘버는 발견되지 않았다. 기존 상수 재사용 및 명명된 파라미터 기본값(`timeoutMs = 20_000` 등) 패턴이 일관되게 유지된다.

## 요약

이번 변경은 `background_failed` 알림의 "딥링크"와 "per-run attribution"을 개념적으로 분리하는 리팩터링으로, 커밋 목적이 명확하고 마이그레이션·엔티티·서비스·프로세서·DTO·테스트 전 계층에 걸쳐 네이밍(`findByResource`→`findByBackgroundRun`, `resourceType='workflow'`)이 일관되게 갱신되어 있다. 함수 길이, 중첩 깊이, 순환 복잡도 모두 낮은 수준으로 유지되며 각 파일의 책임 분리도 뚜렷하다(마이그레이션 안전성 근거, processor 의 딥링크/attribution 분리 근거, service 의 위임 근거가 각각 해당 계층에 적절히 문서화됨). 다만 동일한 설계 배경 설명이 5개 이상 파일에 문장 단위로 반복 기술되어 있어 향후 설계가 다시 바뀔 경우 동기화 비용이 발생할 수 있고, `notify()`/`createMany()`의 optional 필드 대입 3줄 블록이 두 메서드에 중복되는 점은 사소하지만 다음 필드 추가 시 고려할 만하다. 모두 CRITICAL/WARNING 급은 아니며 코드베이스 기존 스타일(JSDoc 다중 위치 주석, falsy 단축 표현)과도 일관되어 있다.

## 위험도
LOW
