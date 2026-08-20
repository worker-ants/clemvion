STATUS=success performance review complete — 0 CRITICAL, 0 WARNING, 2 INFO
===REPORT_MARKDOWN_BELOW===
# 성능 리뷰 — `inputOverride`/`parameterValues` 마스킹 마커 재제출 서버측 거부 (EIA §R17, 라운드 3)

## 검토 범위

이번 diff 는 origin/main 대비 전체 변경(3라운드 누적)이다. 실질 프로덕션 코드 변경은 5개 파일:

- `codebase/backend/src/modules/execution-engine/types/trigger-parameter.types.ts` — 에러 코드 매핑 테이블(`REASON_TO_DETAIL`) 1행 추가 (신규 `masked_value_resubmitted` → `MASKED_VALUE_RESUBMITTED`)
- `codebase/backend/src/modules/execution-engine/utils/reject-masked-resubmission.ts` (신규, 145줄) — `resolveTriggerParametersRejectingMasked`/`findMaskedResubmissions`/`hasMaskedLeaf`
- `codebase/backend/src/modules/executions/executions.service.ts` — `reRun` 경로 호출부 교체(`resolveTriggerParameters` → `resolveTriggerParametersRejectingMasked`) + 응답 봉투 `errors`→`details` 교정
- `codebase/backend/src/modules/workflows/workflows.controller.ts` — `execute` 경로 호출부 동일 교체
- `codebase/backend/src/shared/utils/sanitize-error-message.ts` — 기존 `isMaskedMarker`/`MASKED_MARKERS`(불변 `Set`, 모듈 로드시 1회 생성) `export` 승격. 신규 로직 없음, 런타임 비용 변화 없음.

`git log -- reject-masked-resubmission.ts` 확인 결과 이 파일의 로직 자체는 이전 라운드(`137a48200`, `50f799efd`)에서 이미 확정됐고, 이번 라운드(`e4a27e5d3`, `0a1e5e896`)의 추가 커밋은 spec/plan/CHANGELOG 정정과 절차 문서뿐이다 — 성능에 영향 없음. 나머지(spec/plan/review 산출물 12개 이상)는 실행 경로가 아니므로 대상에서 제외.

## 발견사항

- **[INFO]** `resolveTriggerParametersRejectingMasked` 는 성공 경로에서 트리를 최대 2회 순회한다 (raw 1회 + resolve 결과 1회)
  - 위치: `codebase/backend/src/modules/execution-engine/utils/reject-masked-resubmission.ts:62`, `:72` (함수 `resolveTriggerParametersRejectingMasked`, 56~75줄)
  - 상세: ① `findMaskedResubmissions(schema, rawSource, rawSource)` 로 raw 검사 → 통과 시 `resolveTriggerParameters` 실행 → ② `findMaskedResubmissions(schema, rawSource, resolved)` 로 재검사. 두 번째 순회는 object/array 파라미터가 JSON 문자열로 제출되는 경로(파싱 후에야 leaf 로 마커가 드러남)를 잡기 위한 의도된 트레이드오프이고 함수 docstring(34~54줄)에 근거가 명시돼 있다. 요청당 1회, 반복문 밖에서 일어나는 O(2n)(n = 스키마 필드 트리 크기)으로 실질 비용은 무시할 수준. 알고리즘적으로 불필요한 낭비가 아니라 정확성을 위한 명시적 설계다.
  - 제안: 조치 불요. `findMaskedResubmissions` 내부에서 `schema.filter().filter().map()` 3-pass(122~129줄)도 스키마 필드 수(통상 수 개~수십 개)에 대해서만 일어나 유의미하지 않다.

- **[INFO]** `hasMaskedLeaf` 재귀는 깊이 상한(`MAX_REDACT_DEPTH=10`)으로 유계이지만 폭(breadth)은 무계 — 기존 `deepRedactCore`/`sanitizePayloadForWs` 와 동일한 위험 프로파일
  - 위치: `codebase/backend/src/modules/execution-engine/utils/reject-masked-resubmission.ts:132-145` (함수 `hasMaskedLeaf`)
  - 상세: `value.some(...)` / `Object.values(value).some(...)` 는 깊이 10단계에서 종료되어 스택 오버플로 위험이 없음이 회귀 테스트로 고정돼 있다(`reject-masked-resubmission.spec.ts:220-227`, depth 5000 입력 확인). 각 깊이 단계의 원소 수 자체엔 제한이 없어 이론상 노드 수가 많은 payload 는 순회 비용이 그만큼 커지지만, 마커 발견 시 `.some()` 이 즉시 단락하고 최악의 경우(마커 없음)도 지수적 증폭 없이 O(전체 노드 수)다. `Object.values()` 는 객체 노드 방문마다 중간 배열을 새로 할당하지만 폼 입력 규모(필드 수 개~수십 개, 깊이 상한 10)에서 GC 압력은 무시할 만하다. 호출 맥락은 re-run/execute 요청당 1회, 반복문 밖이라 N+1 성격도 없다.
  - 제안: 이번 PR 스코프에서 조치 불요. 향후 이 헬퍼가 body 크기가 큰 경로(webhook 등)로 확장될 가능성이 생기면(현재는 명시적으로 범위 밖 — docstring 23~32줄) 원소 수 상한을 재검토.

## 알고리즘/호출 패턴 검토 요지

- **N+1 없음**: `resolveTriggerParametersRejectingMasked` 는 `reRun`/`execute` 각 요청당 정확히 1회 동기 호출된다(`executions.service.ts` `reRun` 메서드 내 1곳, `workflows.controller.ts` `execute` 메서드 내 1곳). 반복문 안에서 호출되지 않는다.
- **DB/외부 I/O 없음**: `findMaskedResubmissions`/`hasMaskedLeaf`/`toTriggerParameterErrorDetails` 는 모두 순수 동기 CPU 함수로 블로킹 I/O 를 유발하지 않는다. `MASKED_MARKERS`(`sanitize-error-message.ts`)는 모듈 로드 시 1회 생성되는 불변 `Set` 이라 요청마다 재생성되지 않는다.
- **캐싱 불필요**: 요청마다 입력이 달라(`inputOverride`/`parameterValues`) 캐싱 대상이 아니다. 무효화 이슈 없음.
- **에러 매핑**: `toTriggerParameterErrorDetails`(`trigger-parameter.types.ts`)는 `REASON_TO_DETAIL` 룩업 테이블(`Record`, O(1) per item) 기반 `.map()` — 검증 실패 필드 수만큼만 순회하며 신규 `masked_value_resubmitted` 항목 추가로 인한 검색 비용 증가 없음(해시 조회).
- **자료구조**: 신규/변경 코드에 O(n²) 문자열 누적이나 부적절한 자료구조 사용 없음. `MASKED_MARKERS` 를 `Array`/`indexOf` 대신 `Set`(O(1) `has`) 로 쓰는 것도 적절.
- **지연 로딩**: 이번 diff 는 새 리소스 선행 로딩을 도입하지 않는다 — `loadTriggerParameterSchema` 호출 위치·시점은 두 호출부 모두 기존 그대로다.

## 요약

이번 변경은 Manual 실행 진입점(재실행/execute) 각각에 요청당 1회 실행되는 얕고 유계인(깊이 상한 10) 트리 순회 검사를 추가한 것으로, N+1 호출·블로킹 I/O·불필요한 재계산·캐시 부재로 인한 반복 비용 같은 성능 위험이 없다. 유일한 알고리즘적 특이점은 raw/resolve 두 단계 검사로 인한 최대 2회 트리 순회인데, 이는 타입별 우회(boolean coerce)를 막기 위한 의도된 설계이고 요청당 O(2n) 수준이라 무시 가능하다. 재귀 폭(breadth)이 이론상 무계라는 점과 `Object.values()` 반복 할당도 현재 호출 맥락(스키마 검증된 소규모 Manual 트리거 폼 입력)에서는 실질 영향이 없다. 이 코드 자체는 이전 라운드(`00_03_57`)에서 이미 성능 관점 NONE 으로 판정됐고, 이번 라운드에서 추가된 커밋들은 spec/plan/CHANGELOG 정정뿐이라 판정을 바꿀 변경사항이 없다.

## 위험도

NONE
