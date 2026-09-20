# 신규 식별자 충돌 검토 — `plan/in-progress/spec-draft-integration-error-facts.md`

## 발견사항

없음. 아래는 확인 과정과 근거.

target 이 손대는 넷(①~④)은 모두 **문서 표에 새 행/문장을 추가**하지만, 그 안에서 언급하는 식별자는
전부 코드·다른 spec 문서에 이미 존재하는 것을 그대로 인용한다. 새로 발명한 이름이 없다.

- **요구사항 ID**: 이 draft 는 신규 ID 를 부여하지 않는다(사실 정정이지 요구사항 추가가 아님).
- **엔티티/타입명**: `SsrfBlockedError` 를 처음 spec 산문에 인용하지만, `codebase/backend/src/nodes/integration/http-request/http-safety.ts:47` 에 이미 정의된 클래스이고 database-query/send-email 핸들러·테스트에서 같은 의미로 이미 쓰인다 — 새 타입 도입 아님.
- **API endpoint**: 새 endpoint 없음. `POST /api/integrations/:id/test` 등 기존 endpoint 를 그대로 참조.
- **이벤트/메시지명**: 변경 없음.
- **환경변수·설정키**: 변경 없음(`ALLOW_PRIVATE_HOST_TARGETS` 등은 기존 값 인용뿐).
- **파일 경로**: 새 spec 파일을 만들지 않는다(기존 4개 문서 in-place 수정). frontmatter `code:` 에 추가하는 `http-redirect.ts` 도 실재 기존 파일(`codebase/backend/src/nodes/integration/http-request/http-redirect.ts`, 이미 `http-redirect.spec.ts` 등에서 참조됨) — 새로 생성하는 파일이 아니다. draft 자신의 경로 `plan/in-progress/spec-draft-integration-error-facts.md` 도 기존 `spec-draft-*` 명명 컨벤션(`spec-draft-nullable-notation-followups.md`, `spec-draft-eia-62-waiting-payload.md` 등)을 그대로 따른다.

개별 코드 확인 결과 (기존 정의와 target 인용이 일치하는지):

| 식별자 | 기존 정의 위치 | target 이 부여하려는 의미 | 일치 여부 |
| --- | --- | --- | --- |
| `INTEGRATION_CALL_FAILED` | `spec/4-nodes/4-integration/0-common.md:85` "기타 일반 예외… `toLogError` fallback" | 같은 의미에 "SSRF 가드 고장도 여기로 떨어진다" 는 트리거 한 구 추가 | 일치 — 새 코드 아님 |
| `HTTP_TRANSPORT_FAILED` | `spec/4-nodes/4-integration/1-http-request.md:103,300,337` "fetch reject(전송 실패)" | 리다이렉트 홉의 가드 고장이 여기로 떨어진다는 트리거 추가 | 일치 |
| `INTEGRATION_INCOMPLETE` / `INTEGRATION_AUTH_UNSUPPORTED` | `codebase/backend/src/nodes/integration/http-request/http-credentials.ts:22` union, `spec/4-nodes/4-integration/1-http-request.md:115,321` | `2-navigation/4-integration.md` §5.3·§14.1 에 "연결 테스트에서도 같은 코드로 나온다" 추가 — 실측(`http-connection-tester.ts` 의 `return { success:false, code: resolved.code }`)과 일치. §14.1 표에 `INTEGRATION_AUTH_UNSUPPORTED` 행이 실제로 없음을 확인(현재 표엔 `INTEGRATION_INCOMPLETE` 행만 있음) — target 의 "행이 없다" 는 사실 진술이 맞다 | 일치, 신규 코드 아님 |
| `HTTP_CONNECT_FAILED` | `spec/2-navigation/4-integration.md:483,1122` + `codebase/backend/src/modules/integrations/connection-test-codes.ts:25` | §5.3 목록에 "SSRF 가드 고장 → `HTTP_CONNECT_FAILED`" 한 줄 추가 | 일치 — 기존 "연결 테스트 전용" 코드에 새 트리거 문구만 |
| `CAFE24_INSUFFICIENT_SCOPE` / `MAKESHOP_AUTH_FAILED` | 각각 4-cafe24.md·5-makeshop.md 기존 코드 | §5.9 에 "403 은 다르다" 대비 문장 추가 | 일치 |
| `SsrfBlockedError` | `codebase/backend/.../http-safety.ts:47` | `0-common.md` §4.2 문장에 처음 spec 산문 인용 | 일치 — 코드와 동일 클래스명, 다른 의미로 쓰이지 않음 |

## 요약

target 은 명시적으로 "새 코드·새 규약 — 없다" 고 선언하며, 실제로 넷 다 이미 코드·기존 spec 문서에 정의돼
있는 식별자(`INTEGRATION_CALL_FAILED`, `HTTP_TRANSPORT_FAILED`, `INTEGRATION_INCOMPLETE`,
`INTEGRATION_AUTH_UNSUPPORTED`, `HTTP_CONNECT_FAILED`, `CAFE24_INSUFFICIENT_SCOPE`,
`MAKESHOP_AUTH_FAILED`, `SsrfBlockedError`, `http-redirect.ts`)를 그대로 인용해 표·문장을 보강할 뿐이다.
각 인용을 실측 코드·기존 spec 정의와 대조한 결과 의미 차이가 없었고, 새 endpoint·이벤트·ENV·설정키·spec
파일 경로도 도입하지 않는다. 신규 식별자 충돌 관점에서 이 target 은 검토 대상이 되는 "새 식별자" 자체가
없는 순수 사실-정정 문서다.

## 위험도
NONE
