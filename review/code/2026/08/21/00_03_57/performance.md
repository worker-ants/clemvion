STATUS=success performance review complete — 0 CRITICAL, 0 WARNING, 2 INFO
===REPORT_MARKDOWN_BELOW===
# 성능 리뷰 — `inputOverride`/`parameterValues` 마스킹 마커 재제출 서버측 거부

## 검토 범위

실질 프로덕션 코드 변경은 4개 파일이다:

- `codebase/backend/src/modules/execution-engine/types/trigger-parameter.types.ts` — 에러 코드 매핑 테이블 1행 추가
- `codebase/backend/src/modules/execution-engine/utils/reject-masked-resubmission.ts` (신규) — `findMaskedResubmissions`/`hasMaskedLeaf`
- `codebase/backend/src/modules/executions/executions.service.ts` — `reRun` 경로 호출부
- `codebase/backend/src/modules/workflows/workflows.controller.ts` — `execute` 경로 호출부
- `codebase/backend/src/shared/utils/sanitize-error-message.ts` — 기존 `isMaskedMarker`/`MASKED_MARKERS` export 승격(신규 로직 없음)

나머지(스펙/plan/consistency 리뷰 산출물)는 코드 실행 경로가 아니므로 성능 관점 대상에서 제외했다.

## 발견사항

- **[INFO]** `hasMaskedLeaf` 의 재귀는 깊이 상한(`MAX_REDACT_DEPTH = 10`)으로 유계이지만, **폭(breadth)은 무계**다
  - 위치: `codebase/backend/src/modules/execution-engine/utils/reject-masked-resubmission.ts` (함수 `hasMaskedLeaf`, 게이트 54~66)
  - 상세: `value.some(...)` / `Object.values(value).some(...)` 는 깊이는 10 단계로 막혀 있어 스택 오버플로 위험은 없음을 테스트(`reject-masked-resubmission.spec.ts` 게이트 110~115, depth 5000 입력에서 미던짐 확인)로 확인했다. 다만 각 깊이 단계에서 배열/객체의 원소 수 자체는 제한이 없다 — 예컨대 depth 0~9 각 단계에서 수만 개 원소를 가진 배열/객체가 오면 `Object.values()` 호출마다 새 배열이 할당되고 전체 노드 수만큼 순회한다. 이는 마커가 발견되면 `.some()` 이 즉시 단락(short-circuit)하므로 최악의 경우(마커 없음)만 O(전체 노드 수)이고, 지수적 폭발은 없다. `resolved` 는 `resolveTriggerParameters` 로 스키마 검증을 거친 Manual 트리거 파라미터라 통상 소규모 폼 입력이 기대되지만, 이 함수 자체는 payload 크기에 대한 방어를 갖고 있지 않다(요청 바디 크기 제한은 이 diff 범위 밖의 일반 미들웨어 관심사).
  - 제안: 현재 호출부(re-run/`execute` 요청당 1회, 반복문 밖)를 기준으로는 실질적 위험이 낮아 즉시 조치는 불필요. 다만 향후 이 헬퍼가 더 큰 payload 를 다루는 경로(예: webhook)로 확장될 경우, 원소 수 상한(예: 노드 방문 카운터 조기 종료)을 추가로 고려할 것.

- **[INFO]** `Object.values()` 재귀 호출마다 중간 배열을 새로 할당
  - 위치: `codebase/backend/src/modules/execution-engine/utils/reject-masked-resubmission.ts` (함수 `hasMaskedLeaf`, 게이트 62~64)
  - 상세: 객체 노드를 방문할 때마다 `Object.values(value)` 로 새 배열을 만든 뒤 `.some()` 을 돌린다. `for...in` + 조기 return 조합으로 바꾸면 이 할당을 피할 수 있으나, 트리거 파라미터 폼 입력 규모(필드 수 개~수십 개, 깊이 상한 10)에서는 GC 압력이 무시할 만한 수준이다.
  - 제안: 현재 규모에서는 가독성이 우선이라 유지해도 무방. 핫패스로 승격되면(예: 매우 높은 QPS 의 execute 엔드포인트에서 대형 payload 가 흔해지면) 재검토.

## 알고리즘/호출 패턴 검토 요지

- **N+1 없음**: `findMaskedResubmissions` 는 `reRun`/`execute` 각 요청당 정확히 1회, `resolveTriggerParameters` 이후 동기 호출로 배치돼 있다 (`executions.service.ts` 게이트 495~503, `workflows.controller.ts` 게이트 313~322). 반복문 안에서 호출되지 않는다.
- **DB/외부 I/O 없음**: 두 헬퍼(`findMaskedResubmissions`, `toTriggerParameterErrorDetails`)는 순수 함수로 동기 CPU 연산만 수행하며 블로킹 I/O 를 유발하지 않는다.
- **캐싱 불필요**: 요청마다 입력이 다르므로(사용자가 매번 다른 `inputOverride`/`parameterValues` 를 보낸다) 캐싱 대상이 아니다. 무효화 이슈 없음.
- **재귀 스택 안전성**: `MAX_REDACT_DEPTH=10` 상한이 값 검사보다 뒤에 체크되므로(의도적 순서 — 마스커의 치환 지점을 놓치지 않기 위함, 게이트 55~57) 매우 깊은 입력에서도 최대 10단계에서 종료돼 `RangeError` 위험이 없다. 이는 스펙 회귀 테스트(`[회귀] 매우 깊은 입력에서도 던지지 않는다`, spec 게이트 110~115)로 고정돼 있다.
- **자료구조**: `Object.entries().filter().map()` 두 단계 순회는 최상위 필드 수(전형적으로 수 개~수십 개)에 대해서만 이뤄지며 O(n²) 누적이나 문자열 연결 패턴은 없다.
- **에러 매핑**: `toTriggerParameterErrorDetails` 는 `REASON_TO_DETAIL` 룩업 테이블(O(1) per item) 기반 `.map()` — 검증 실패 필드 수만큼만 순회, 트리거 파라미터 개수에 비례해 작다.
- **지연 로딩**: 이 diff 는 새 리소스 선행 로딩을 도입하지 않는다 — `loadTriggerParameterSchema` 는 기존 로직 그대로다.

## 요약

이번 변경은 Manual 실행 진입점(재실행/execute) 각각에 요청당 1회 실행되는 얕고 유계인(깊이 상한 10) 트리 순회 검사를 추가한 것으로, N+1 호출·블로킹 I/O·불필요한 재계산·과도한 메모리 할당 같은 성능 위험이 없다. 재귀는 값 검사를 깊이 검사보다 먼저 두는 의도된 순서를 가지며 깊이 상한으로 스택 오버플로에서 안전함이 테스트로 고정돼 있다. 유일하게 남는 이론적 여지는 각 깊이 단계에서의 폭(원소 수)이 무계라는 점과 `Object.values()` 의 반복 할당이지만, 현재 호출 맥락(스키마 검증을 통과한 소규모 Manual 트리거 폼 입력, 요청당 1회)에서는 실질적 영향이 없어 INFO 로 남긴다.

## 위험도

NONE
