# API 계약(API Contract) Review

## 발견사항

- **[INFO]** `create()` 메서드의 반환 타입 및 응답 형식은 변경 전후 동일하게 `PublicIntegration` 을 유지함
  - 위치: `backend/src/modules/integrations/integrations.service.ts` L117~147 (diff 기준)
  - 상세: audit log 실패가 이전에는 `throw err` 로 전파되어 HTTP 500 을 유발할 수 있었으나, 이번 변경으로 best-effort swallow 가 서비스 레이어에도 추가되었다. 클라이언트 입장에서는 `POST /integrations` 가 성공 응답을 더 일관되게 반환하게 되므로 사실상 **계약 준수도가 향상**된 변경이다. Breaking change 없음.
  - 제안: 현재 구현 유지 적절. 필요 시 audit 실패 여부를 응답 헤더(`X-Audit-Warning`) 등으로 노출하는 옵션도 있으나, best-effort 정책상 클라이언트에 노출할 의무는 없다.

- **[INFO]** 테스트 파일 변경(`integrations.service.spec.ts`, `cafe24-precheck.test.tsx`)은 API 계약과 직접 관련이 없는 내부 테스트 리팩토링임
  - 위치: `backend/src/modules/integrations/integrations.service.spec.ts`, `frontend/src/app/(main)/integrations/new/__tests__/cafe24-precheck.test.tsx`
  - 상세: 회귀 안전망 테스트 추가 및 매직 넘버 상수화(`DEBOUNCE_ADVANCE_MS`)·헬퍼 추출(`advanceDebounce`)은 테스트 유지보수성 개선이며, 엔드포인트 계약·스키마·HTTP 상태 코드 등에 영향 없음.
  - 제안: 해당 없음.

## 요약

이번 변경은 `IntegrationsService.create()` 내부의 audit log 기록 실패 처리를 별도 try/catch 블록으로 분리해 best-effort 정책을 명시적으로 구현한 리팩토링이다. API 계약 관점에서는 `POST /integrations` 의 성공 응답 형식(`PublicIntegration`)과 에러 응답 코드·HTTP 상태 코드가 모두 변경 전과 동일하게 유지되며, 오히려 audit log DB 장애 시 클라이언트에 불필요한 500이 노출되던 문제를 해소해 계약 안정성이 높아졌다. Breaking change, 하위 호환성 문제, 스키마 위반은 없다.

## 위험도

NONE
