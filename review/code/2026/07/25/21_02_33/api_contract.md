# API 계약(API Contract) 리뷰

## 발견사항

없음.

## 요약

이번 변경은 `Cafe24ApiClient`/`MakeshopApiClient` 의 `*CallOptions` 인터페이스에 선택적 필드
`signal?: AbortSignal` 을 추가하고, 각 handler(`cafe24.handler.ts`, `makeshop.handler.ts`)가
`context.abortSignal` 을 그 필드로 전달해 실행 취소(cancellation) 시 in-flight 외부 HTTP 호출을
즉시 중단(cascade)하도록 배선하는 작업이다(spec/conventions/node-cancellation.md §4/§2.2). 대응
spec 테스트(`*.client.spec.ts`, `*.handler.spec.ts`) 4종 추가와 plan 문서(`node-cancellation-*.md`,
`spec-update-node-cancellation-shutdown-classification.md`) 갱신이 동반됐다.

API 계약 관점에서 검토한 8개 관점(하위 호환성/버전관리/응답형식/에러응답/요청검증/URL 설계/
페이지네이션/인증인가) 중 실질적으로 걸리는 항목이 없다:

- `Cafe24CallOptions`/`MakeshopCallOptions` 는 이 백엔드가 **외부에 노출하는 REST API 계약이 아니라**,
  이 노드가 Cafe24/MakeShop 커머스 API 를 호출할 때 쓰는 내부 TypeScript 인터페이스다. 추가된
  `signal` 필드는 optional 이고 기존 필드 순서·타입을 건드리지 않아 기존 호출부(테스트 포함) 전부
  변경 없이 컴파일된다 — breaking change 아님.
- 실제로 Cafe24/MakeShop 에 나가는 HTTP method·URL·query·body·헤더는 이번 diff 로 전혀 바뀌지
  않는다 (fetch 호출에 `signal` 만 추가). 즉 외부 API 와의 wire contract 변화 없음.
  `AbortController.abort()` 로 인한 중단은 fetch 레벨의 `AbortError` 이며, handler 의
  `mapClientErrorToOutput()`(cafe24)/동등 로직(makeshop)이 `IntegrationError`/타입드 에러가 아닌
  나머지를 `*_TRANSPORT_FAILED` 로 흡수하는 기존 catch-all 경로를 그대로 타므로, 취소로 인한
  abort 도 기존 에러 응답 포맷(`{code, message, details}` + `statusCode:0`) 안에서 처리된다 — 새
  에러 코드나 상태 코드 체계 변경 없음.
- 이 노드 핸들러 자체의 `validate()`/`execute()` 가 받는 workflow config 스키마
  (`integrationId`/`resource`/`operation`/`fields`/`pagination`)와 반환 envelope
  (`config`/`output`/`meta`/`port`)은 이번 diff 에서 손대지 않았다. `context.abortSignal` 은
  `ExecutionContext` 에 이미 존재하는 필드를 읽기만 할 뿐 그 인터페이스를 새로 넓히지 않는다
  (diff 범위 안에서 `ExecutionContext` 정의 변경은 보이지 않음).
  페이지네이션 처리(`buildRequestParts` 의 `pagination.{limit,offset}` 로직)도 미변경.
  이 노드들에는 별도 인증/인가 게이트가 없으며(워크플로 엔진의 실행 컨텍스트 하에서 동작),
  이번 변경이 그 경계를 옮기지 않는다.
- plan 문서(`node-cancellation-residual-signal-propagation.md`,
  `spec-update-node-cancellation-shutdown-classification.md`)는 코드가 아니며, 후자는 SIGTERM/
  workflow-timeout 유발 abort 의 최종 상태(`cancelled` vs `failed`) 분류를 project-planner 결정으로
  분리해 별도 plan 으로 넘긴 것으로, 이번 diff 범위(commerce 2건 signal 배선)와는 명시적으로 분리되어
  있어 이 리뷰의 판정에 영향을 주지 않는다.

종합하면 이번 변경은 API 계약(내부 REST 표면·외부 wire contract·에러/응답 포맷·인증·페이지네이션)
어느 축에도 영향을 주지 않는 순수 취소 신호(cascade) 배선이다.

## 위험도

NONE
