# API 계약(API Contract) 리뷰

## 발견사항

### [INFO] errors → details 키 변경: 하위 호환성 (breaking change 여부)
- 위치: `hooks.service.ts` line ~542, `workflows.controller.ts` line ~302
- 상세: 기존 `BadRequestException` payload 에서 `errors: [{ field, reason }]` 를 던지던 구조를 `details: [{ field, code, message }]` 로 교체했다. `GlobalExceptionFilter` 가 `errors` 키를 무시하고 `details` 키만 공식 봉투로 전달하는 구조였기 때문에, 변경 전에 클라이언트는 `error.details[]` 를 받지 못했다(필드 목록 없음). 즉 클라이언트 입장에서 `error.details[]` 는 기존에 존재하지 않던 필드이고, 이번 변경으로 새롭게 추가된다. **추가(additive) 변경**이므로 하위 호환성을 깨지 않는다.
- 제안: 이상 없음. e2e 테스트(B3)에서 구 flat 형식(`errors[].reason`)이 응답에 남아 있지 않음을 `toBeUndefined()` 로 명시적으로 단정하고 있어 의도가 명확하다.

### [INFO] 에러 응답 형식 일관성 — webhook vs manual 경로
- 위치: `hooks.service.ts` (`INVALID_WEBHOOK_PAYLOAD`) / `workflows.controller.ts` (`INVALID_TRIGGER_PARAMETERS`)
- 상세: 두 경로 모두 `{ code, message, details: [...] }` 구조로 throw 하여 `GlobalExceptionFilter` 가 `error.details[]` 로 전달하는 패턴이 대칭을 이룬다. field code 형식도 모두 `UPPER_SNAKE_CASE` 로 통일됐다. spec §5.2·manual-trigger §6 와 일치한다.
- 제안: 이상 없음.

### [INFO] 에러 코드 안정성 — `INVALID_WEBHOOK_PAYLOAD` / `INVALID_TRIGGER_PARAMETERS` 유지
- 위치: 두 throw 지점 모두
- 상세: 최상위 `code` 값을 그대로 유지하면서 내부 `errors` 키를 `details` 로 교체했다. error-codes 규약 §2 의 "안정성·rename 정책"을 준수한다.
- 제안: 이상 없음.

### [INFO] 필드 코드 매핑 완전성
- 위치: `trigger-parameter.types.ts` `REASON_TO_DETAIL` 상수
- 상세: 내부 reason 3종(`missing_required`, `coerce_failed`, `invalid_schema`)이 전부 매핑됐다. `REASON_TO_DETAIL` 은 TypeScript `Record<TriggerParameterValidationError['reason'], ...>` 타입이므로 향후 reason 이 추가될 경우 컴파일 오류로 누락이 즉시 감지된다.
- 제안: 이상 없음.

### [INFO] HTTP 상태 코드
- 위치: 두 throw 지점 모두 (`BadRequestException` = 400)
- 상세: 필수 파라미터 누락·타입 coerce 실패에 400을 사용하는 것은 RESTful 관례상 적절하다.
- 제안: 이상 없음.

### [INFO] 공식 봉투 `requestId` 노출
- 위치: `webhook-trigger.e2e-spec.ts` B3 테스트
- 상세: `expect(res.body.error.requestId).toBeDefined()` 로 requestId 포함을 단정하고 있다. GlobalExceptionFilter 가 이를 주입하는 것으로 보이며 기존 봉투 구조와 일치한다.
- 제안: 이상 없음.

---

## 요약

이번 변경은 트리거 파라미터 검증 실패 시 에러 응답 내부 상세 정보를 기존에 버려지던 `errors` 키에서 GlobalExceptionFilter 가 실제로 전달하는 `details` 키로 교체해 spec §5.2 의 `error.details[]` 노출 약속을 이행한 것이다. 내부 분류 문자열을 공용 헬퍼(`toTriggerParameterErrorDetails`)를 통해 UPPER_SNAKE_CASE field code 로 정규화해 API 계약 표면에서의 일관성을 확보했다. 최상위 `code` 값은 유지해 existing client 의 분기 로직을 보호했으며, `error.details[]` 추가는 additive 변경이므로 breaking change 가 없다. 두 진입 경로(webhook / manual)의 에러 형식이 대칭을 이루고, TypeScript Record 타입으로 매핑 완전성이 컴파일 시점에 보장된다. API 계약 관점에서 개선이며 지적 사항이 없다.

## 위험도

NONE

STATUS=success ISSUES=0
