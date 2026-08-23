# 부작용(Side Effect) Review — masking-gate-consolidation

## 검토 범위

핵심 변경은 4개 코드 파일이다:
- `codebase/backend/src/shared/utils/redact-stored-error.ts` — 신규 헬퍼 `redactStoredFieldsForResponse`(export) · `redactNodeExecutionRow`(export, generic) · `maskIfPresent`(비-export, 내부 전용) 3개 추가
- `codebase/backend/src/modules/executions/executions.service.ts` — 기존 3-줄 손호출 3곳을 `...redactStoredFieldsForResponse(...)` / `redactNodeExecutionRow(ne)` 로 교체, 기존 private `maskIfPresent` 삭제(헬퍼 파일로 이동)
- `codebase/backend/src/modules/executions/background-runs/background-runs.service.ts` — 동일 패턴 교체
- `codebase/backend/src/shared/utils/redact-stored-error.spec.ts` — 신규 헬퍼 2개용 테스트 추가(순수 함수, 부작용 없음)

나머지(plan/*.md, review/**, spec/conventions/egress-masking.md)는 문서·산출물이며 런타임 부작용 대상이 아니다(`spec/` 직접 편집은 절차·권한 문제로 scope 리뷰 소관이지 side-effect 소관 아님 — 이번 SUMMARY WARNING #2 참조).

## 발견사항

- **[INFO]** 신규 export `redactNodeExecutionRow` 로 공개 표면이 넓어짐 — breaking change 아님
  - 위치: `codebase/backend/src/shared/utils/redact-stored-error.ts:144` (`export function redactNodeExecutionRow<T extends {...}>(row: T): T`)
  - 상세: 종전에는 이 로직(`maskIfPresent` 3회 호출 + copy-on-change 삼항)이 `executions.service.ts` 안의 **private** 인라인 코드였다. 이번 변경으로 `shared/utils` 의 **제네릭 공개 함수**로 승격되어 `executions.service.ts`/`background-runs.service.ts` 외의 어떤 모듈도 import 할 수 있게 됐다. 시그니처(`inputData`/`outputData`/`error` 를 non-null `Record<string, unknown>` 으로 요구)와 계약(부재를 `null` 로 정규화하지 않고 원본을 그대로 보존)이 이제 그 모듈 경계 밖에서도 재사용 가능한 공개 계약이 된다. docstring 에 "왜 둘인가"가 명시돼 있고 기존 두 호출부의 동작은 바이트 단위로 동일(비교 결과 로직 동일)하지만, 향후 제3의 소비처가 이 함수를 오·남용할 경우(예: 이미 마스킹된 값에 재적용하는 등) 그 위험은 export 범위가 넓어진 데서 비롯된다. 직전 라운드(`review/code/2026/08/23/14_23_44/side_effect.md`)에서도 동일 관점으로 이미 INFO 처리된 항목이며 이번 diff 로 새로 악화되지 않았다.
  - 제안: 조치 불요. 제3의 소비처가 실제로 생기면 그때 "왜 헬퍼가 둘인가" 표를 갱신하라는 기존 docstring 안내로 충분.

- **[INFO]** 기존 두 export 함수(`redactStoredDataForResponse`/`redactStoredErrorForResponse`) 시그니처는 무변경
  - 위치: `codebase/backend/src/shared/utils/redact-stored-error.ts:28`, `:66`
  - 상세: import 목록만 재배열되고(`background-runs.service.ts`, `executions.service.ts`) 두 함수의 파라미터·반환 타입·구현은 diff 대상이 아니다. 기존 호출자(있다면)에 영향 없음.
  - 제안: 조치 불요(양성 확인).

- **[INFO]** 호출부 3곳 모두 스프레드 순서가 안전 — override 순서 반전 없음
  - 위치: `codebase/backend/src/modules/executions/executions.service.ts` (`toExecutionDto` — `redactStoredFieldsForResponse` 호출부, `toResponseExecution` — 동일), `codebase/backend/src/modules/executions/background-runs/background-runs.service.ts` (`toNodeExecutionDto`)
  - 상세: 세 곳 모두 `...redactStoredFieldsForResponse(...)` 가 원본 필드를 펼친 뒤(`...rest`/`row` 의 다른 필드) 또는 객체 리터럴 안에서 **다른 `inputData`/`outputData`/`error` 키가 뒤따르지 않는 위치**에 배치되어 있어, 마스킹된 값이 항상 최종적으로 응답에 실린다. 마스킹 되돌림(원문 유출) 경로 없음을 직접 확인했다.
  - 제안: 조치 불요.

- **[INFO]** `redactNodeExecutionRow` 로직은 기존 인라인 코드와 바이트 단위로 동일 — 리팩터링 중 의미 변경 없음
  - 위치: `codebase/backend/src/shared/utils/redact-stored-error.ts:150`-`158` vs 삭제된 구 코드(`executions.service.ts` diff hunk, `maskIfPresent` 호출 3회 + 동일 삼항 비교)
  - 상세: 변수명(`ne` → `row`)만 바뀌었고 `maskIfPresent` 호출 순서·copy-on-change 비교 삼항·spread 순서 전부 동일. 함수 경계 이동(private inline → shared exported)만 발생했을 뿐 관측 가능한 런타임 동작 변경 없음.
  - 제안: 조치 불요.

- **[INFO]** 전역 상태·환경 변수·네트워크 호출·이벤트/콜백 변경 없음
  - 위치: 4개 코드 파일 전체
  - 상세: 모든 신규/변경 함수는 인자로 받은 값만 읽고 새 객체(또는 동일 참조)를 반환하는 순수 변환이다. 모듈 스코프 변수·싱글턴 상태·`process.env`·HTTP/DB 클라이언트·`EventEmitter`/WS emit 호출 어디에도 관여하지 않는다.
  - 제안: 조치 불요.

## 요약

핵심 변경은 4곳에 흩어져 있던 동일한 3-컬럼(`inputData`/`outputData`/`error`) 마스킹 호출을 두 개의 순수 헬퍼(`redactStoredFieldsForResponse`, `redactNodeExecutionRow`)로 통합한 것으로, 로직은 리팩터링 전후 바이트 단위로 동일함을 직접 대조 확인했다. 전역 상태·파일시스템·환경 변수·네트워크·이벤트 콜백에 관여하는 코드는 없다. 유일하게 언급할 만한 표면 변화는 종전 private 인라인 코드였던 `redactNodeExecutionRow` 가 `shared/utils` 의 제네릭 공개 export 로 승격된 점인데, breaking change 는 아니고 직전 리뷰 라운드에서도 같은 관점으로 이미 INFO 처리된 사항이라 이번 diff 가 새로 악화시키지 않는다. 세 호출부 모두 spread 순서가 안전해 마스킹 무력화(override) 경로가 없다.

## 위험도
NONE
