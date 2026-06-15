# API 계약(API Contract) 리뷰

## 발견사항

해당 없음.

이번 변경은 다음 파일로만 구성된다.

- `form-mode.ts` / `form-mode.spec.ts` — 순수 함수(pure utility) 레이어: `extractFormFields`, `validateScalarField`, `validateFileField`. HTTP 엔드포인트가 아니며 API 계약에 직접 노출되지 않음.
- `types.ts` — `FormModalField` 내부 타입에 `allowedMimeTypes?`, `maxFileSize?`, `maxTotalSize?`, `maxFiles?` 추가. 모두 optional이고 외부 API 응답 스키마가 아닌 서버 내부 유효성 검사 컨텍스트 전용.
- `execution-engine.service.ts` — `assertFormSubmissionValid` 내부 분기 리팩터(scalar → file 분기). 기존 `FormValidationError` 예외 인터페이스(`field`, `message`, `code: 'VALIDATION_ERROR'`)는 변경 없음. EIA REST `400 VALIDATION_ERROR` + `details[{field, message, code:'INVALID_FIELD'}]` 응답 구조 및 WS ack `errorCode='VALIDATION_ERROR'` 매핑 모두 불변. HTTP/WS API 경로·상태코드·응답 구조 불변.
- `workflow-errors.ts` — JSDoc 텍스트 갱신만. 외부 계약 변경 없음.
- `hooks.service.ts` — 인라인 주석 추가만. 외부 계약 변경 없음.
- `dynamic-form-ui.tsx` / 관련 테스트 — 프론트엔드 클라이언트 가드(선택 즉시 reject). 서버 API 계약에 영향 없음.
- `i18n/dict/en/editor.ts`, `i18n/dict/ko/editor.ts` — UI 문자열만 추가. API 응답 필드 아님.
- `plan/`, `review/` 파일 — 작업 추적 및 이전 리뷰 산출물.

HTTP 엔드포인트 추가·제거, URL/경로 변경, API 버전 변경, 응답 스키마 변경, 인증·인가 정책 변경, 페이지네이션 변경이 전혀 없다.

## 요약

이번 변경은 `type:'file'` 필드에 대한 서버측 및 클라이언트측 유효성 검사 로직을 추가하는 내부 구현 작업으로, 공개 HTTP/WS API 계약에는 아무런 영향을 주지 않는다. API 엔드포인트, 요청·응답 스키마, HTTP 상태코드, 인증 정책, 버전 관리 모두 변동이 없으므로 API 계약 관점에서 검토할 대상이 없다.

## 위험도

NONE
