# API 계약(API Contract) 리뷰

## 발견사항

### [INFO] 413 PAYLOAD_TOO_LARGE 에러 코드 신규 도입 — 하위 호환성 양호
- 위치: `codebase/backend/src/common/filters/http-exception.filter.ts` L128, `codebase/backend/src/main.ts` Swagger setDescription
- 상세: 기존 413 응답이 `INTERNAL_ERROR`/500 으로 오매핑되던 것을 `PAYLOAD_TOO_LARGE`/413 으로 교정한 변경이다. 이전에는 413 을 클라이언트가 받을 수 없었으므로(500으로 둔갑) 이 변경은 버그 수정이며 breaking change 가 아니다. 기존 클라이언트가 500 에러 핸들링을 하던 경우 413 을 새로 받게 되지만, 이는 스펙상 올바른 동작으로의 교정이다.
- 제안: 특이사항 없음. Swagger 문서(`main.ts` setDescription) 에 `PAYLOAD_TOO_LARGE` 추가도 함께 이루어져 문서-응답 일관성 확보.

### [INFO] 에러 응답 봉투 형식 일관성 유지 확인
- 위치: `codebase/backend/src/common/filters/http-exception.filter.ts`, `codebase/backend/test/webhook-trigger.e2e-spec.ts`
- 상세: 413 본문 초과 응답이 `{ error: { code: 'PAYLOAD_TOO_LARGE', message, requestId } }` 표준 봉투를 따른다. 공개 webhook Guard 의 `PUBLIC_WEBHOOK_BODY_TOO_LARGE`(413)도 동일 봉투 형식을 사용한다(e2e K/L 검증). 두 413 경로(파서 레벨, Guard 레벨)가 모두 동일한 `{ error: { code, requestId } }` 구조를 반환하므로 클라이언트 입장에서 일관된 에러 응답 파싱이 가능하다.
- 제안: 특이사항 없음.

### [INFO] `preloadedTrigger` 파라미터 추가 — 내부 서비스 시그니처 변경
- 위치: `codebase/backend/src/modules/hooks/hooks.service.ts` L80, L95
- 상세: `HooksService.handleWebhook` 에 선택적 파라미터 `preloadedTrigger?: Trigger | null` 이 추가되었다. 이 메서드는 내부 서비스이며 외부 HTTP API 계약에 직접 노출되지 않으므로 API 하위 호환성에는 영향 없다. 기존 호출부(공개 webhook 경로 외 미전달 경우)는 `undefined` 폴백으로 기존 동작 유지.
- 제안: 특이사항 없음.

### [INFO] `/api/hooks/*` 라우트 스코프 body-parser — URL 경로 설계 영향 없음
- 위치: `codebase/backend/src/main.ts` L668, `codebase/backend/src/bootstrap/hooks-body-parser.ts`
- 상세: body-parser 를 `/api/hooks` prefix 로 스코핑하는 것은 기존 엔드포인트 URL 구조나 요청/응답 스키마를 변경하지 않는다. 클라이언트가 전송하는 요청 형식·헤더·경로는 동일하며, 허용 본문 크기만 100KB→1MB 로 확장된다. 이는 클라이언트에게 완전히 하위 호환적인 변경(더 큰 요청을 허용)이다.
- 제안: 특이사항 없음.

### [INFO] `PublicWebhookReqExtension` 타입 — 내부 req 확장, 외부 API 계약 무관
- 위치: `codebase/backend/src/modules/hooks/hooks.controller.ts` L135
- 상세: Guard-to-Controller 간 trigger 전달을 위한 `req.__publicWebhookTrigger` 필드는 서버 내부 Express req 객체 확장이며 HTTP 응답/요청 계약에 노출되지 않는다.
- 제안: 특이사항 없음.

---

## 요약

이번 변경은 `/api/hooks/*` 엔드포인트의 body-parser 크기 한도를 라우트 스코프로 분리(인증 webhook 1MB 수용)하고, 기존에 오매핑되던 413 에러를 표준 봉투 `PAYLOAD_TOO_LARGE`/413 으로 교정한 것이 핵심이다. API 계약 관점에서 모든 기존 클라이언트는 영향받지 않으며(기존 413 → 500 오매핑의 버그 교정이므로), 에러 응답 봉투 형식(`{ error: { code, message, requestId } }`)은 두 413 발생 경로(파서 레벨, Guard 레벨) 모두 일관되게 유지된다. 요청 검증은 파서 레벨(크기 초과)과 Guard 레벨(공개 32KB)의 이중 레이어로 명확히 구분되며, 인증/인가 적용 방식(공개 vs 인증 webhook 분기)은 변경 전과 동일하다. Breaking change 없음.

## 위험도

NONE

---

STATUS=success ISSUES=0
