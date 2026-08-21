# 보안(Security) 리뷰 — EIA §R17 마스킹 재제출 서버측 거부 (Manual 실행 경로)

## 검토 범위

실제 애플리케이션 코드 변경(파일 1~9):

- `codebase/backend/src/modules/execution-engine/types/trigger-parameter.types.ts` — 신규 reason/code `masked_value_resubmitted`/`MASKED_VALUE_RESUBMITTED` 추가
- `codebase/backend/src/modules/execution-engine/utils/reject-masked-resubmission.ts` (신규) — `resolveTriggerParametersRejectingMasked`/`findMaskedResubmissions`/`hasMaskedLeaf`
- `codebase/backend/src/modules/execution-engine/utils/reject-masked-resubmission.spec.ts` (신규)
- `codebase/backend/src/modules/executions/executions.service.ts` — re-run 호출부 배선 + `errors`→`details` 교정
- `codebase/backend/src/modules/executions/executions-rerun.service.spec.ts`
- `codebase/backend/src/modules/workflows/workflows.controller.ts` — execute 호출부 배선
- `codebase/backend/src/modules/workflows/workflows.controller.spec.ts`
- `codebase/backend/src/shared/utils/sanitize-error-message.ts` — `isMaskedMarker`/`MASKED_MARKERS` export 승격(로직 변경 없음)

나머지(파일 10 이후)는 spec 문서·plan 트래커·이전 리뷰/consistency 라운드 산출물이며 실행 경로 코드가 아니다. spec 서술(파일 51~57)은 구현과 대조해 확인했고 불일치 없음.

이 브랜치는 직전 라운드(`00_03_57`)에서 **CRITICAL**로 지적된 결함(“`boolean` 파라미터가 가드를 통째로 우회한다” — `resolveTriggerParameters` 의 **coerce 결과만** 검사해 `Boolean('***') === true` 로 마커 문자열이 조용히 사라지던 문제)에 대한 수정 커밋이다. 실제 소스(`reject-masked-resubmission.ts`)를 직접 읽어 수정 여부를 확인했다.

## 발견사항

CRITICAL/WARNING 없음.

- **[INFO]** 직전 라운드 CRITICAL(boolean 우회)이 실제로 닫혔음을 코드로 확인
  - 위치: `codebase/backend/src/modules/execution-engine/utils/reject-masked-resubmission.ts` `resolveTriggerParametersRejectingMasked` (61·63·66행 — ① raw 검사 → resolve → ② resolve 후 검사)
  - 상세: 종전에는 `resolveTriggerParameters` 반환값에만 `findMaskedResubmissions` 를 적용해 `coerceToType('***','boolean')` → `Boolean('***')` → `true` 로 마커가 사라진 뒤 검사됐다. 현재는 **raw 입력을 coerce 이전에 먼저 검사**(①)하므로 `boolean`/`number` 필드에 마커가 오면 문자열이 살아있는 시점에 잡히고, `coerce_failed` 가 먼저 throw 되는 문제(잘못된 에러 코드 노출)도 함께 해소된다. object/array 를 JSON 문자열로 보내는 경로(파싱 전엔 마커가 최상위 문자열과 일치하지 않음)를 위해 resolve 후 재검사(②)도 유지한다. 두 검사 모두 대상 키 집합은 `rawSource` 에 실제로 존재하는 필드로 한정해(`hasOwnProperty`) `defaultValue` 로 채워진 미터치 필드까지 차단하는 과잉 차단도 막는다. `reject-masked-resubmission.spec.ts` 에 boolean/number/object-JSON-string/중첩/깊이 상한 경계(`MAX_REDACT_DEPTH`·`+1`)·실 마스커 왕복 통합 테스트가 캐너리로 고정돼 있어 회귀 시 즉시 RED.
  - 제안: 조치 불요 — 확인용 기록.

- **[INFO]** 에러 응답에 실제 제출 값이 echo 되지 않는다
  - 위치: `codebase/backend/src/modules/execution-engine/types/trigger-parameter.types.ts` `toTriggerParameterErrorDetails`/`REASON_TO_DETAIL`
  - 상세: `TriggerParameterErrorDetail` 은 `field`(스키마에 정의된 파라미터명)·`code`(고정 enum)·`message`(고정 문자열)만 갖고, `findMaskedResubmissions` 가 만드는 `TriggerParameterValidationError` 도 `{ field, reason }` 뿐이라 마스킹 마커든 실제 원문이든 값 자체가 클라이언트로 되돌아가지 않는다. `executions.service.ts`/`workflows.controller.ts` 두 catch 블록 모두 `err.errors` 를 그대로 던지지 않고 `toTriggerParameterErrorDetails()` 를 거친다.
  - 제안: 조치 불요.

- **[INFO]** re-run 경로의 `errors`→`details` 봉투 교정은 정보 노출을 늘리지 않는다
  - 위치: `codebase/backend/src/modules/executions/executions.service.ts` (catch 블록, `details: toTriggerParameterErrorDetails(err.errors)`)
  - 상세: 종전 `errors: err.errors` 는 내부 lowercase `reason` 원문(`{field, reason}`)을 그대로 던졌지만 `GlobalExceptionFilter` 가 `details` 키만 읽어 응답 직렬화 단계에서 조용히 버려졌다(따라서 실질적으로 클라이언트에는 노출된 적이 없었다 — UX 결함이었지 정보 노출은 아니었다). 교정 후에도 `toTriggerParameterErrorDetails` 를 거쳐 정규화된 `{field, code, message}` 만 실리므로 새로운 노출면이 생기지 않는다.
  - 제안: 조치 불요.

- **[INFO]** `hasMaskedLeaf` 재귀는 깊이만 유계(`MAX_REDACT_DEPTH=10`)이고 폭(원소 수)은 무계
  - 위치: `codebase/backend/src/modules/execution-engine/utils/reject-masked-resubmission.ts` `hasMaskedLeaf`
  - 상세: `.some()` 단락 평가로 마커 발견 시 즉시 종료하고, 값 미발견 최악의 경우도 O(트리 노드 수)로 지수적 증폭은 없다. 스택 안전성은 깊이 5,000 입력에 대해 `throw` 하지 않음을 회귀 테스트로 고정. 대상 값은 스키마 검증을 거친 Manual 트리거 폼 입력(요청당 1회, 반복문 밖 호출)이라 실질 위험은 낮다. 같은 저장소의 기존 `deepRedactCore`/`sanitizePayloadForWs` 와 동일한 위험 프로파일이며 이 diff 가 새로 만든 표면이 아니다.
  - 제안: 조치 불요 — 향후 이 헬퍼가 webhook 처럼 신뢰도 낮은 대형 payload 를 다루는 경로로 확장되면 원소 수 상한을 재검토.

- **[INFO]** webhook/schedule 경로를 거부 대상에서 제외한 설계는 문서화된 의도적 결정
  - 위치: `reject-masked-resubmission.ts` 최상단 doc comment "범위 — Manual 실행 경로 한정" + `spec/5-system/14-external-interaction-api.md` §R17 신규 표 행·캐비엇(게이트 1573~1596)
  - 상세: webhook ingestion·schedule 은 외부 시스템이 저작하는 임의 페이로드라 리터럴 `'***'` 가 정상 값일 수 있으므로, 이 판정을 `resolveTriggerParameters` 공유 함수 안에 넣지 않고 별도 wrapper(`resolveTriggerParametersRejectingMasked`)로 Manual 실행 경로 두 곳에만 적용했다. 공유 프리미티브를 넓혀 무관한 경로를 오염시키지 않겠다는 근거가 명시돼 있고, 실제로 두 호출부(`executions.service.ts`/`workflows.controller.ts`) 외에는 이 wrapper 를 쓰지 않는다(`resolveTriggerParameters` 직접 호출부는 그대로).
  - 제안: 조치 불요 — 스코프가 의도된 대로 정확히 한정돼 있음을 확인.

- **[INFO]** 프로토타입 오염(prototype pollution) 표면 없음
  - 위치: `reject-masked-resubmission.ts` `findMaskedResubmissions` (`values[def.name]` 브래킷 접근)
  - 상세: 접근 키(`def.name`)는 사용자가 아니라 워크플로 정의(노드 스키마, `loadTriggerParameterSchema`)에서 오는 신뢰된 값이라 공격자가 `__proto__`/`constructor` 같은 키를 주입할 수 없다. 값 쪽(`rawSource`/`resolved`)은 `isPlainRecord` 로 object 인지만 확인 후 순수 읽기(`Object.values`)만 하며 쓰기 연산이 없어 오염 표면 자체가 없다.
  - 제안: 조치 불요.

## 요약

이번 diff 는 Manual 트리거 파라미터 재제출 경로(re-run `inputOverride`, execute `parameterValues`)에서 egress 마스킹 마커가 실제 값으로 그대로 되돌아오는 것을 서버측 2차 방어층으로 차단하는 보안 강화이자, 직전 라운드(`00_03_57`)에서 지적된 CRITICAL(“boolean 타입이 coerce 결과만 검사하는 순서 때문에 가드를 완전 우회”)의 수정 커밋이다. 소스를 직접 읽어 확인한 결과 검사 순서가 raw(coerce 전) → resolve(coerce 후) 이중 검사로 바뀌었고, 대상 키를 raw 존재 여부로 한정해 과잉 차단도 막았으며, 이 순서·경계는 캐너리·경계·통합(실 마스커 왕복) 테스트로 고정돼 있다. 에러 응답은 필드명·고정 코드·고정 메시지만 반환해 실제 제출 값을 노출하지 않고, re-run 경로의 `errors`→`details` 봉투 교정도 새로운 정보 노출을 만들지 않는다. 인젝션·하드코딩 시크릿·인증/인가 우회·안전하지 않은 암호화·프로토타입 오염 관련 문제는 발견되지 않았다. 재귀 깊이는 기존 `MAX_REDACT_DEPTH` 상수를 재사용해 상한이 있고, 폭 방향 순회 비용은 기존 마스커와 동일한 위험 프로파일이라 새로운 DoS 증폭 벡터가 아니다. webhook/schedule 을 거부 대상에서 제외한 설계도 근거가 코드·spec 양쪽에 명시돼 있다.

## 위험도

NONE
