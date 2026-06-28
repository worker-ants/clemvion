# Testing Review

## 발견사항

### [INFO] `toTriggerParameterErrorDetails` 단위 테스트 — 구조 적합, 미세 중복 존재
- 위치: `/codebase/backend/src/modules/execution-engine/utils/resolve-trigger-parameters.spec.ts` L200–240
- 상세: 세 번째 케이스(`every field code is UPPER_SNAKE_CASE`)는 첫 번째 케이스(`maps internal reasons ...`)가 이미 완전히 커버한다. 첫 번째 케이스는 세 reason 모두를 toEqual 로 단정하므로 정규식 패턴 검사는 잉여다. 가독성 측면에서 의도(컨벤션 준수 단정)가 명확하긴 하나, 동일 입력으로 두 번 수행하는 중복이다.
- 제안: 세 번째 테스트를 삭제하거나, 첫 번째 테스트의 `toEqual` 을 제거하고 정규식 단정으로 대체해 역할을 분리한다. 현재 상태는 오작동을 일으키지 않으므로 차단 수준은 아님.

### [INFO] `toTriggerParameterErrorDetails` — 알 수 없는 reason 에 대한 방어 테스트 부재
- 위치: `/codebase/backend/src/modules/execution-engine/types/trigger-parameter.types.ts` L77–82
- 상세: `REASON_TO_DETAIL[e.reason]` 룩업은 TypeScript union 타입(`'missing_required' | 'coerce_failed' | 'invalid_schema'`)으로 컴파일 타임에 안전하지만, 런타임에 예상치 못한 값이 들어오면(예: 미래 reason 추가 후 맵 업데이트 누락) 언체크 `undefined.code` 참조로 터진다. 현재 테스트는 세 가지 정상 reason 만 커버하며 범위 밖 값에 대한 방어 동작(throw or undefined) 테스트가 없다.
- 제안: TypeScript union 이 exhaustive 하므로 현실적 위험은 낮지만, 안전을 위해 타입 미일치 케이스 `as any` 입력에 대한 방어 테스트 또는 헬퍼 내 런타임 가드를 추가하는 것을 고려한다.

### [WARNING] `hooks.service.spec.ts` — `TYPE_COERCION_FAILED` 경로 단위 테스트, 서비스 레이어 단에서만 검증
- 위치: `/codebase/backend/src/modules/hooks/hooks.service.spec.ts` L269–298 (변경 부분)
- 상세: `hooks.service.spec.ts` 가 `coerce_failed` → `TYPE_COERCION_FAILED` 전환을 단위 테스트로 검증하는 것은 적절하다. 그러나 이 테스트가 실제 `resolveTriggerParameters` 를 내부적으로 호출하는지 또는 mock 되어 있는지가 diff 에서 확인되지 않는다. 서비스 레이어 스펙이 `TriggerParameterValidationException` 을 직접 받아 던지도록 구성된다면, `toTriggerParameterErrorDetails` 의 실제 변환 경로는 통합 수준에서만 검증된다.
- 제안: hooks.service.spec.ts 에서 `resolveTriggerParameters` 또는 `toTriggerParameterErrorDetails` 를 mock 하고 있다면, 서비스 레이어가 변환 함수를 호출한다는 사실 자체를 단언하는 `toHaveBeenCalledWith` 스타일 검증 추가를 고려한다. 현재는 결과값만 비교하므로 중간 경로 생략 가능성이 있다.

### [INFO] `workflows.controller` — manual-trigger `INVALID_TRIGGER_PARAMETERS` 경로 단위 테스트 없음
- 위치: `/codebase/backend/src/modules/workflows/workflows.controller.ts` L302–311
- 상세: `hooks.service.spec.ts` 는 webhook 경로(`INVALID_WEBHOOK_PAYLOAD`)에 대해 업데이트된 단위 테스트를 포함하지만, `workflows.controller` 의 `INVALID_TRIGGER_PARAMETERS` 경로에 대응하는 컨트롤러 단위/통합 테스트는 이번 diff 에 포함되지 않았다. plan 문서와 spec 모두 두 경로를 동일 갭으로 처리했으나, 테스트는 webhook 쪽만 업데이트됐다.
- 제안: `workflows.controller.spec.ts`(또는 해당 통합 테스트)에 `execute()` 엔드포인트가 `TriggerParameterValidationException` 시 `{ code: 'INVALID_TRIGGER_PARAMETERS', details: [{ field, code, message }] }` 를 throw 함을 검증하는 케이스를 추가한다.

### [INFO] e2e B3 테스트 — DB 직접 조작으로 manual_trigger config 주입
- 위치: `/codebase/backend/test/webhook-trigger.e2e-spec.ts` L1341–1355
- 상세: e2e 테스트 B3 가 `db.query(UPDATE node SET config = ...)` 로 노드 config 를 직접 패치한다. 이는 API 를 우회하므로 향후 DB 스키마 변경(컬럼명 변경, JSONB 구조 변경) 시 e2e 테스트가 조용히 깨질 수 있다. 또한 테스트 격리 측면에서 이 직접 패치가 다른 테스트의 동일 워크플로우에 영향을 줄 수 있으나, 별도 workflow(`wfId`)를 생성하여 격리는 유지하고 있다.
- 제안: 워크플로우 실행 파라미터 설정을 API 를 통해 할 수 있다면(`saveCanvas` 등) API 경로를 우선 사용하는 것을 권장한다. 단, 현재 캔버스 저장 API 로 manual_trigger 파라미터 스키마를 세팅하는 방법이 복잡하다면 현행 DB 직접 패치도 허용 가능하며, 이 경우 경고 주석을 추가한다.

### [INFO] e2e B3 — `TYPE_COERCION_FAILED` 시나리오 e2e 미포함
- 위치: `/codebase/backend/test/webhook-trigger.e2e-spec.ts` B3 케이스
- 상세: B3 e2e 는 `MISSING_REQUIRED_FIELD` 케이스만 커버한다. `TYPE_COERCION_FAILED` 케이스(예: `number` 파라미터에 coerce 불가 문자열 전송)도 spec §5.2 에 명시된 response 형식이므로 e2e 단에서 검증하는 것이 권장된다.
- 제안: B3 케이스에 number 타입 파라미터에 비숫자 값 전송 시 `TYPE_COERCION_FAILED` 가 `error.details[]` 에 포함되는지 단정하는 서브케이스를 추가한다.

### [INFO] 단위 테스트 케이스 이름 vs 실제 의도 정렬
- 위치: `/codebase/backend/src/modules/execution-engine/utils/resolve-trigger-parameters.spec.ts` L226–228
- 상세: `'preserves order and is empty for empty input'` 케이스는 두 가지 의도(순서 보존 + 빈 배열)를 하나의 케이스에 섞는다. 빈 배열 케이스는 확인되나, 순서 보존은 이 단일 테스트에서 실제로 검증되지 않는다(첫 번째 케이스가 3개 원소 순서를 검증하긴 하지만, 케이스 이름과 내용 불일치).
- 제안: 케이스 이름을 `'returns empty array for empty input'` 으로 수정하거나, 순서 보존 단정을 별도 케이스로 분리한다.

## 요약

이번 변경은 내부 `reason` 문자열을 공개 `UPPER_SNAKE_CASE` field code 로 정규화하는 `toTriggerParameterErrorDetails` 헬퍼를 신규 도입하고, webhook 경로(`hooks.service`) 및 manual-trigger 경로(`workflows.controller`) 양쪽에 적용하는 것으로, 테스트 커버리지 측면에서 전반적으로 적절하다. 단위 테스트(`resolve-trigger-parameters.spec.ts`)는 세 reason 케이스·빈 배열·UPPER_SNAKE 포맷을 검증하고, `hooks.service.spec.ts` 는 `BadRequestException` 봉투 구조 변화를 업데이트했으며, e2e(`webhook-trigger B3`)는 실제 HTTP 응답 봉투 `error.details[]` 를 end-to-end 로 검증한다. 주요 미비점은 (1) `workflows.controller` 의 `INVALID_TRIGGER_PARAMETERS` 경로에 대한 단위 테스트 부재, (2) `TYPE_COERCION_FAILED` 케이스의 e2e 미포함으로, 두 갭 모두 현재 단위 테스트가 변환 함수 자체는 커버하므로 차단 위험은 낮지만, 경로별 통합 회귀를 완성하려면 추가가 필요하다.

## 위험도

LOW
