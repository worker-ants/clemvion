# 테스트(Testing) Review

## 발견사항

- **[WARNING]** `execution-engine.service.ts` 의 신규 `sanitizeErrorMessage(message)` 적용이 unit 으로 직접 검증되지 않음
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:4494` (`dispatchExecutionFailedNotification` 내 `message: ... ${sanitizeErrorMessage(message)}`), 테스트: `codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts:620-765` (`dispatchExecutionFailedNotification` describe 블록)
  - 상세: 이번 diff 의 핵심 보안 수정은 top-level 실행 실패 알림 메시지에 `sanitizeErrorMessage`를 적용해 background 경로와 방어 심도를 통일하는 것이다(security review 22_42_32 WARNING 조치). 그러나 `dispatchExecutionFailedNotification` describe 블록의 7개 테스트 케이스는 전부 두 번째 인자로 단순 문자열 `'boom'`만 전달하고, 어떤 테스트도 `entries[0].message`(또는 `.title`) 필드 자체의 값을 단언하지 않는다(`toMatchObject`가 `workspaceId`/`resourceType`/`resourceId`/`channel`만 검증). `'boom'`은 새니타이징 전후로 동일하므로, 설령 `sanitizeErrorMessage(message)` 호출이 통째로 삭제되거나 잘못된 인자가 전달돼도 이 describe 블록의 어떤 테스트도 실패하지 않는다 — 이번 커밋이 도입한 보안 동작 자체에 대한 직접적 회귀 가드가 없다. 대조적으로 `background-execution.processor.spec.ts:157`("sanitizes error messages...")는 stack trace/connection-string/길이초과 페이로드를 실제로 주입해 `errorMessage`가 정리됐는지 단언하는 정공법 테스트가 있어 processor 경로는 커버되지만, 이번 diff 가 새로 추가한 `execution-engine.service.ts` 쪽 호출 지점은 동일 수준의 검증이 빠져 있다.
  - 제안: `dispatchExecutionFailedNotification` describe 에 processor 테스트와 대칭되는 케이스를 추가 — 예: connection string 또는 stack trace 라인을 포함한 message 를 두 번째 인자로 전달하고, `entries[0].message`가 `[REDACTED_URI]`를 포함하며 원본 URI/stack 프레임을 포함하지 않음을 단언. 이는 이번 PR의 명시적 보안 수정 목표(security review 22_42_32)에 대한 직접 회귀 가드이므로 우선순위가 높음.

- **[INFO]** `getNotificationsService()` 신규 4-branch unit 은 실제 코드 분기와 정확히 1:1 대응 — 잘 구성된 회귀 가드
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts:767-819`, 대상 코드 `execution-engine.service.ts:700-713`
  - 상세: (1) 생성자 주입 존재 → `moduleRef.get` 미호출, (2) 주입 없음 → `moduleRef.get(strict:false)` 호출 및 결과 반환, (3) `moduleRef.get`이 throw → `undefined` 반환(no-op), (4) 캐시 히트 시 재조회 안 함 — 4개 테스트가 실제 `getNotificationsService` 구현의 조건 분기(`this.notificationsService` truthy, `resolvedNotificationsService !== undefined` 캐시 체크, try/catch, cache write)를 각각 정확히 겨냥한다. `asSvc()` 타입 캐스팅으로 private 필드에 직접 접근하는 화이트박스 테스트지만, `beforeEach`로 `service`가 매번 재생성되므로 테스트 간 격리도 유지된다. describe 제목에 "버그 B 회귀 가드"라 명시해 의도도 명확.
  - 제안: 없음.

- **[INFO]** `background-monitoring.e2e-spec.ts`에 추가된 `select: false` REST 미노출 단언은 실제 API 응답 바디를 검증하는 정공법 e2e
  - 위치: `codebase/backend/test/background-monitoring.e2e-spec.ts:363-373`
  - 상세: `GET /api/notifications` 실제 REST 응답에서 `backgroundRunId` 필드 부재(`not.toHaveProperty`)와 `resourceId === workflowId`를 함께 단언해, "DB 컬럼에는 있으나 API로는 노출 안 됨" + "딥링크는 정상 노출"이라는 두 계약을 동시에 blackbox 로 검증한다. 이전 세션 SUMMARY(22_42_32) WARNING #3가 지적한 "select:false REST 미노출 e2e 미검증" 갭을 정확히 메운다. raw SQL 질의(파일 상단 부분)와 상호보완적으로 "DB엔 있음 + API엔 없음" 양쪽을 모두 검증하는 구조가 적절하다.
  - 제안: 없음.

- **[INFO]** `sanitize-error-message.ts` 공용 util 추출 자체에는 신규 전용 unit 파일이 없으나, 기존 `background-execution.processor.spec.ts`의 새니타이징 테스트가 실질적으로 계속 커버
  - 위치: 신규 `codebase/backend/src/modules/execution-engine/sanitize-error-message.ts` (processor.ts 로컬 함수에서 추출), 커버 테스트 `background-execution.processor.spec.ts:157`
  - 상세: 함수 자체(로직 변경 없이 파일만 이동 + export)가 순수 함수라 별도 unit 스펙 없이도 processor 통합 테스트가 간접적으로 동일 회귀 가드 역할을 한다. 다만 이 함수가 이제 `execution-engine.service.ts`와 `background-execution.processor.ts` 두 곳에서 공유되는 만큼, 함수 자체의 경계 케이스(예: `err`가 `Error` 인스턴스가 아닌 임의 객체/문자열일 때 `String(err)` 분기, 정확히 500자/501자 경계, 매치 없는 정상 메시지 통과)를 독립적으로 검증하는 전용 `sanitize-error-message.spec.ts`가 없다는 점은 다소 아쉽다 — 현재는 processor 경로의 통합 테스트 1건에만 암묵적으로 의존한다.
  - 제안: 필수는 아니나, 두 소비처가 공유하는 만큼 `sanitize-error-message.spec.ts`를 신설해 함수 자체를 독립적으로(Error 아닌 값, 정확한 길이 경계, 여러 URI 스킴 등) 테스트하면 향후 어느 한쪽 소비처의 통합 테스트가 삭제/변경되어도 sanitizer 자체의 회귀 가드가 유지된다.

- **[INFO]** `describe('getNotificationsService...')`의 `Svc` 타입 캐스팅이 실제 서비스 필드명과 어긋나면 컴파일 타임에 안전하지 않게 조용히 실패할 잠재 리스크 (경미)
  - 위치: `execution-engine.service.spec.ts:39-45` (`type Svc`, `asSvc`)
  - 상세: `notificationsService`/`moduleRef`/`resolvedNotificationsService`/`getNotificationsService`라는 필드명을 별도 로컬 `Svc` 타입으로 재선언해 `service as unknown as Svc`로 캐스팅한다. 실제 서비스 클래스의 필드명이 리팩터링으로 바뀌면 이 로컬 타입은 컴파일 에러 없이(구조적 타이핑 + `unknown` 경유 캐스팅) 계속 컴파일되고, 런타임에 `undefined` 대입/읽기만 조용히 무의미해질 수 있다(다만 이 경우 곧바로 assertion 실패로 이어지므로 실질 위험은 낮음). 코드베이스 전반에 이미 존재하는 화이트박스 테스트 관용구(`as unknown as {...}`)와 일관된 패턴이라 이번 diff만의 새로운 리스크는 아니다.
  - 제안: 없음(현재 관용구 수준에서는 시급하지 않음). 참고로만 기록.

## 요약

이번 diff의 두 신규 테스트 축(`getNotificationsService` 4-branch unit, `background-monitoring.e2e-spec.ts`의 `select:false` REST 응답 검증)은 직전 리뷰 라운드(22_42_32 SUMMARY WARNING #1/#3)가 지적한 갭을 정확히 겨냥해 잘 메웠고, 실제 코드 분기·API 응답 바디를 직접 검증하는 정공법 테스트로 구성되어 있다. 다만 같은 커밋에서 함께 도입된 보안 수정 — `dispatchExecutionFailedNotification`의 알림 메시지에 `sanitizeErrorMessage`를 적용해 top-level 경로의 방어 심도를 background 경로와 통일한 것 — 은 어떤 테스트도 새니타이징 전후 메시지 내용을 단언하지 않아 직접적 회귀 가드가 없다. 기존 `dispatchExecutionFailedNotification` 테스트가 전부 `'boom'`(새니타이징에 영향받지 않는 문자열)만 사용하므로, 해당 sanitizer 호출이 우발적으로 제거되거나 잘못 배선되어도 테스트 스위트는 통과한다 — 이는 이번 PR이 명시적으로 목표한 보안 수정 자체의 커버리지 공백이라는 점에서 우선 보강 대상이다. 그 외 테스트 격리·가독성·기존 회귀 테스트 유효성은 양호하다.

## 위험도
MEDIUM
