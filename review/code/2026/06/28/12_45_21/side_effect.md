# 부작용(Side Effect) 리뷰

## 발견사항

발견된 의도치 않은 부작용 없음.

각 점검 관점별 확인 결과:

1. **의도치 않은 상태 변경**: `REASON_TO_DETAIL`은 모듈 스코프 상수(`const`)로 선언되어 있으며, 초기화 후 어떤 경로에서도 변경되지 않는다. `toTriggerParameterErrorDetails`는 순수 함수로 입력을 읽어 새 배열을 반환할 뿐 외부 상태를 건드리지 않는다.

2. **전역 변수**: 새로 도입된 `REASON_TO_DETAIL`은 모듈 레벨 `const`이며 `export`되지 않는다. 새 `export`는 `TriggerParameterErrorDetail` 인터페이스와 `toTriggerParameterErrorDetails` 함수뿐이며, 둘 다 전역 스코프를 오염시키지 않는다.

3. **파일시스템 부작용**: 변경된 소스 파일 중 파일시스템을 읽거나 쓰는 코드가 없다. e2e 테스트(`webhook-trigger.e2e-spec.ts`)의 DB `UPDATE`는 테스트 격리 수준의 셋업이며 프로덕션 코드 경로가 아니다.

4. **시그니처 변경**: `TriggerParameterValidationException` 클래스 시그니처는 변경되지 않았다. `toTriggerParameterErrorDetails`는 신규 함수 추가이므로 기존 호출자에 영향 없다. 기존 `TriggerParameterDefinition`, `TriggerParameterValidationError` 인터페이스도 그대로다.

5. **인터페이스 변경**: `hooks.service.ts`와 `workflows.controller.ts`가 `BadRequestException`에 넘기는 객체 키가 `errors`에서 `details`로 교체됐다. 이 변경은 `GlobalExceptionFilter`가 `details` 키만 전달하는 기존 동작과 정합하며, 구 `errors` 키는 필터에 의해 이미 버려지고 있었으므로 클라이언트가 의존할 수 없는 값이었다. 공개 API 봉투(`error.code`, `error.message`, `error.requestId`)는 유지된다.

6. **환경 변수**: 변경된 파일 중 `process.env` 접근이 없다.

7. **네트워크 호출**: 변경된 프로덕션 코드에서 외부 서비스를 추가로 호출하는 경로가 없다.

8. **이벤트/콜백**: 새로 추가된 코드에서 이벤트 발생 또는 콜백 등록·해제 변경이 없다.

## 요약

이번 변경은 순수 additive 성격의 리팩터링이다. `toTriggerParameterErrorDetails` 헬퍼 함수와 `TriggerParameterErrorDetail` 인터페이스가 추가됐고, `hooks.service.ts`와 `workflows.controller.ts`의 예외 throw 시 `errors` 키를 `details` 키로 교체했다. 전역 상태 변경, 파일시스템 접근, 네트워크 호출, 환경 변수 조작, 시그니처 파괴적 변경이 없으며, `details` 키 교체는 `GlobalExceptionFilter`가 이미 `details`만 전달하던 기존 동작과 정합하는 의도된 변경이다. 의도치 않은 부작용이 발견되지 않는다.

## 위험도

NONE
