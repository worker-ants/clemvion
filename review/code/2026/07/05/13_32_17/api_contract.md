# API 계약(API Contract) 리뷰

## 스코프 판단

이번 변경은 `codebase/backend/src/nodes/integration/http-request/http-request.handler.ts` (+ 대응 spec 테스트)에서 SSRF 차단 시 `output.error.message` 를 host/IP 미노출 일반화 문구(`"Request blocked by SSRF policy."`)로 치환하고, redirect-hop SSRF 차단도 `HTTP_BLOCKED` 로 통일 라우팅하도록 하는 작업이다. 대상은 워크플로우 **노드 핸들러**(`NodeHandlerOutput.error` envelope)이며, `spec/5-system/2-api-convention.md` 가 규정하는 **REST 공개 API**(컨트롤러/DTO/`GET /api/...`)는 코드·spec 양쪽 모두 실질 변경이 없다(해당 파일의 유일한 diff는 앵커 링크 오타 수정). 다만 `NodeHandlerOutput.error` 도 워크플로우 저자·프론트엔드가 소비하는 안정된 계약이므로, 그 관점에서만 아래와 같이 점검한다.

## 발견사항

- **[INFO]** 에러 `message` 콘텐츠 변경은 하위 호환성 관점에서 문자열 매칭 클라이언트에 영향 가능
  - 위치: `codebase/backend/src/nodes/integration/http-request/http-request.handler.ts` (SSRF catch 블록, redirect 루프 내 catch)
  - 상세: `output.error.code`(`HTTP_BLOCKED`)는 불변이고 `message` 문자열만 교체된다. spec(`1-http-request.md` §8.3)이 명시하듯 "클라이언트 UI 는 `code` 로 분기하므로 UX 손실 없음"이 전제이나, 만약 워크플로우 저자가 `error.message` 원문(예: 차단된 hostname)을 파싱해 조건 분기하는 케이스가 있었다면 이번 변경으로 그 분기가 깨진다. 이는 일반적인 REST 클라이언트가 아니라 워크플로우 빌더 사용자 관점의 breaking 이며, spec 자체가 "⚠️ 운영 영향 (breaking)" 콜아웃으로 이미 인지·문서화했다.
  - 제안: 별도 조치 불필요 — spec 이 breaking 영향과 마이그레이션 경로(`ALLOW_PRIVATE_HOST_TARGETS=true`)를 이미 명시했다. `message` 필드는 애초에 "사람이 읽는 설명"이지 안정적 계약 필드가 아니라는 원칙(`spec/5-system/2-api-convention.md` §5.3 "message: 사람이 읽을 짧은 설명")과도 정합적이다.

- **[INFO]** `output.error.code` 라우팅 정정 자체는 계약 정합화(버그 수정)이며 신규 breaking 요소 아님
  - 위치: `http-request.handler.ts` redirect 루프 내 SSRF catch → `IntegrationError(HTTP_BLOCKED, ...)` 재-throw, 바깥 catch 에서 `IntegrationError` instanceof 분기로 code/message 보존
  - 상세: 기존에는 redirect hop 에서의 SSRF 차단이 바깥 일반 catch 로 떨어져 `HTTP_TRANSPORT_FAILED`(또는 유사 코드)로 오분류됐을 가능성이 있었다(consistency-check cross_spec/convention_compliance 체커가 이미 지적, WARNING). 이번 변경은 spec §4.2/§6 이 원래 약속한 "redirect 한도·대상 SSRF = `HTTP_BLOCKED`"에 코드를 맞추는 정합화다. code 값이 바뀌는 사용자가 있다면 (예: `HTTP_TRANSPORT_FAILED` 를 보고 retry 로직을 태우던 워크플로우) 동작 변화가 발생할 수 있으나, 이는 "명세와 다르게 동작하던 버그"의 수정에 해당하므로 API 계약 관점에서는 정당한 정정으로 판단한다.
  - 제안: spec-coverage/consistency 문서(File 11-13, 이미 이번 diff에 포함)에서 `2-navigation/4-integration.md`·`1-http-request.md` 갱신이 함께 이뤄져 문서-코드 정합이 유지되고 있음을 확인 — 추가 조치 불필요.

- **[INFO]** 에러 응답 스키마(필드 구조) 자체는 무변경
  - 상세: `{ error: { code, message } }` shape, `output`/`config`/`meta`/`port`/`status` 5필드 invariant 등은 이번 diff로 변경되지 않는다. `IntegrationError` 승격 경로 추가(redirect catch)도 기존 `buildPreflightErrorOutput` 헬퍼를 재사용해 envelope 일관성을 유지한다.

- **[INFO]** 인증/인가·페이지네이션·URL 설계·요청 검증 — 해당 없음
  - 이번 변경은 REST 엔드포인트·라우팅·인증가드·요청 DTO 검증·페이지네이션 어느 것도 건드리지 않는다. 노드 핸들러 내부 로직(`execute()`)의 에러 메시지 생성 경로만 변경.

## 요약

이번 변경은 공개 REST API 계약(`spec/5-system/2-api-convention.md`)에 영향이 없다 — 대상은 워크플로우 노드 핸들러의 `output.error` envelope 중 `message` 문자열 내용과 `code` 라우팅 정확도이며, `spec/5-system/2-api-convention.md` 자체의 diff는 무관한 앵커 오타 수정 1건뿐이다. 노드 에러 계약 관점에서 보더라도 `code`(`HTTP_BLOCKED`)는 불변이고 `message` 만 host/IP 미노출 일반화 문구로 교체되며, spec이 이를 "⚠️ breaking" 으로 이미 명시적으로 문서화·마이그레이션 경로(`ALLOW_PRIVATE_HOST_TARGETS`)까지 제공하고 있어 계약 관리 프로세스상 문제는 없다. redirect-hop SSRF의 `HTTP_BLOCKED` 재라우팅도 기존 spec 약속과 실제 동작 간 drift를 바로잡는 정합화로 판단된다.

## 위험도

NONE
