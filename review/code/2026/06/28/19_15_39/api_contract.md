# API 계약(API Contract) Review

## 발견사항

해당 없음.

이번 변경 세트는 다음으로 구성된다:

- `http-exception.filter.ts`: 매직 문자열 2종을 named 상수(`UNKNOWN_ERROR_MESSAGE`, `UNHANDLED_ERROR_MESSAGE`)로 추출 — 동작 보존, 외부 API 응답 형식 불변.
- `http-exception.filter.spec.ts`: `afterEach(jest.restoreAllMocks)` 통일, 비-Error throw 경로 테스트 추가 — 테스트 전용 변경.
- `client-ip.spec.ts`: env 스냅샷 복원 패턴 개선 — 테스트 전용 변경.
- `hooks.service.ts`: 로컬 래퍼 함수 `extractClientIp` 제거 후 `extractClientIpFromHeaders(...) ?? undefined` 직접 호출 — 동작 동일, 클라이언트 노출 API 없음.
- `public-webhook-throttle.guard.ts`: 인라인 익명 타입 → named interface `PublicWebhookReqShape` 추출 — 내부 타입 정리, 외부 계약 불변.
- `public-webhook-throttle.guard.spec.ts`: 타입 참조 정리 및 테스트 격리 강화 — 테스트 전용 변경.
- plan/review 문서 파일 — 비코드 산출물.

변경된 코드 중 엔드포인트 경로, 요청/응답 스키마, HTTP 상태 코드, 버전 헤더, 인증/인가 적용, 페이지네이션 등 API 계약에 영향을 주는 항목이 전혀 없다. 이전 `api_contract` 라우터도 동일 판단("공개 API 계약 변경 없음")으로 본 reviewer를 제외했다.

## 요약

이번 변경은 코드 정리(래퍼 제거·상수화·타입 추출)와 테스트 격리 강화가 전부이며, 공개 API 엔드포인트·요청 검증·응답 형식·에러 응답·버전 관리·인증 적용 등 API 계약에 해당하는 변경이 없다. 검토 대상 8개 관점 모두 해당 없음.

## 위험도

NONE
