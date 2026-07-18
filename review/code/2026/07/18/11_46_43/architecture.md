# 아키텍처(Architecture) 리뷰

## 리뷰 범위

- `information-extractor.handler.spec.ts` — 회귀 핀 테스트 2건 추가 (신규 코드 경로 없음)
- `information-extractor.handler.ts` — `endMultiTurnConversation` 시그니처에 `_errorPayload` /
  `_failedUserMessage` / `_failedUserMessageSource` optional 3인자 추가(무시 의도 `_` prefix) +
  docblock 대폭 보강
- `node-handler.interface.ts` — `ResumableNodeHandler.endMultiTurnConversation` docblock 정정
  (기존 "핸들러는 그 값을 output.error 에 그대로 set 해야" 범용 서술 → 구현체별 소비 방식이
  다르다는 명시적 분기 서술). **타입 시그니처 자체는 무변경**, JSDoc-only.
- `plan/in-progress/ie-endmultiturn-errorpayload-contract.md` — 의사결정 근거 문서(신규)
- `review/consistency/**` — 이번 작업의 트리거가 된 선행 consistency-check 산출물(문서, 코드 아님)

behavior 변경 없음(순수 문서화 + no-op 인자 명시 + 테스트 보강). 런타임 로직·레이어·의존성 그래프에
실질적 변화가 없어 전체적으로 위험도가 낮다.

## 발견사항

- **[INFO]** 공유 인터페이스 메서드가 구현체별로 상이한 파라미터 소비 계약을 인코딩 (LSP 인접 이슈)
  - 위치: `codebase/backend/src/nodes/core/node-handler.interface.ts` `ResumableNodeHandler.endMultiTurnConversation` (errorPayload/failedUserMessage/failedUserMessageSource), `codebase/backend/src/nodes/ai/information-extractor/information-extractor.handler.ts:1180-1220`
  - 상세: 동일한 트레일링 3개 파라미터가 `AiAgentHandler`(verbatim relay + `_retryState` 생성)와 `InformationExtractorHandler`(완전 무시·self-fill)에서 근본적으로 다른 의미로 소비된다. 인터페이스 하나가 사실상 "AiAgentHandler 전용 retry-continuation 능력"을 모든 구현체의 필수 시그니처에 강제하는 형태 — ISP 관점에서 IE 는 자신이 쓰지 않는 파라미터를 계약상 받아들여야 한다. 이번 PR은 이 비대칭을 없애지 않고(런타임 동작은 기존과 동일) `_` prefix + docblock으로 "의도된 발산"임을 명시적으로 잠그는 방향을 택했다 — plan 파일(`plan/in-progress/ie-endmultiturn-errorpayload-contract.md`)의 Q1/Q2 판정에 따르면 두 구현체의 retryable 판정 축(코드 기반 vs HTTP status 기반)이 spec 상 실제로 다른 불변식이라 인위적 통합이 오히려 §5.3 위반이 된다는 근거가 있어, "고치지 않고 명시한다"는 결정 자체는 합리적이다.
  - 제안: 지금 당장 리팩터링할 필요는 없음(behavior invariant가 spec 으로 잠겨 있어 강제 통합이 더 위험). 다만 세 번째 multi-turn 핸들러가 추가되는 시점에는, `errorPayload`/`failedUserMessage`/`failedUserMessageSource` 를 `endMultiTurnConversation` 코어 시그니처에서 분리해 `SupportsRetryContinuation` 같은 선택적 mixin 인터페이스로 뽑아내는 것을 고려할 가치가 있다 — 현재는 구현체가 2개뿐이라 ROI 가 낮아 defer 해도 무방.

- **[INFO]** 인터페이스(추상화 계층) 문서가 구체 클래스 이름을 직접 나열
  - 위치: `codebase/backend/src/nodes/core/node-handler.interface.ts:806-820`, `:1286-1300`
  - 상세: `ResumableNodeHandler` 인터페이스의 JSDoc이 이제 `AiAgentHandler`/`InformationExtractorHandler` 구체 클래스명과 각각의 spec 섹션(§7.9/§10, §5.3)을 직접 인용한다. 컴파일 타임 결합은 없고(주석뿐), "상세 SoT는 각 핸들러 자신의 docblock"이라는 위임 구조가 이미 명시돼 있어 중복 유지보수 부담은 낮게 관리되고 있다. 다만 구현체가 늘어날 때마다 이 인터페이스 파일의 docblock도 함께 갱신해야 하는 성장 패턴이므로, 인터페이스가 알아야 할 것(계약이 구현체별로 다르다는 사실)과 각 구현체가 알아야 할 것(그 이유)의 경계가 다소 흐려질 여지가 있다.
  - 제안: 현 규모(2개 구현체)에서는 문제 없음. 조치 불필요, 향후 구현체 증가 시 재검토.

- **[INFO]** 변경이 순수 additive/문서화로 OCP·계층 경계를 해치지 않음 (positive)
  - 위치: 전체 diff
  - 상세: 신규 파라미터 3개가 모두 optional 이고 기존 호출부(엔진의 `handleAiTurnError`, 기존 IE 호출자)는 무수정으로 계속 동작한다. `node-handler.interface.ts` 의 실제 타입 시그니처는 변경되지 않았고(이미 5-arity 로 선언돼 있었음, 이번엔 docblock만 정정), IE 핸들러가 그 선언과 실제 구현 arity 를 맞추는 방향으로 정합화됐다. 레이어(presentation/business/data) 경계, 순환 의존성, 모듈 경계 어느 것도 이번 diff로 영향받지 않는다 — 전부 `nodes/` 도메인 계층 내부에 국한.
  - 제안: 없음.

- **[INFO]** 테스트 아키텍처 — 회귀 핀이 적절한 경계에서 격리됨
  - 위치: `information-extractor.handler.spec.ts:1296-1420`
  - 상세: 신규 테스트는 엔진 오케스트레이션 전체를 우회하고 `handler.endMultiTurnConversation` 을 직접 호출해 계약 경계에서만 검증한다. 기존 파일의 `asNodeHandlerOutput`/`getResult`/`getError` 헬퍼를 재사용해 새 테스트 구조를 추가로 만들지 않았다 — 테스트 응집도가 좋다.
  - 제안: 없음.

- **[INFO]** 동봉된 consistency-check 산출물(`review/consistency/2026/07/18/11_19_02/**`)은 이번 changeset 의 코드가 아니라 이 작업을 트리거한 선행 판정 문서
  - 상세: SUMMARY.md 가 지적하는 CRITICAL 3건(AI Agent multi-turn `out` 포트 spec 자기모순, 단일턴 `error` 포트 미구현 미문서화, IE `resumed` 스냅샷 status 오기재)은 plan 파일에 "out-of-scope, 사용자 승인 bypass"로 명시적으로 위임돼 있으며 이번 diff(코드 3파일)의 아키텍처와는 무관한 별도 spec-drift 트랙이다. 본 리뷰의 채점 대상에서 제외.
  - 제안: 없음 (이미 별도 plan 으로 추적 중).

## 요약

이번 변경은 `ResumableNodeHandler.endMultiTurnConversation` 트레일링 3개 파라미터에 대해 `InformationExtractorHandler` 가 의도적으로 self-fill 하며 무시한다는 기존 암묵적 동작을 명시적 계약(`_` prefix + docblock + 회귀 핀 테스트)으로 승격한 순수 문서화·no-op 파라미터 정합화 PR이다. 런타임 로직·레이어 경계·의존성 그래프에 실질 변화가 없고, 기존 프로젝트 관례(`_options` no-op prefix)와 일치한다. 유일하게 짚을 만한 구조적 논점은 공유 인터페이스 메서드가 한 구현체(AiAgentHandler)의 필요를 모든 구현체(IE 포함)의 시그니처에 강제하는 ISP 인접 긴장인데, 이는 이번 PR이 새로 만든 것이 아니라 기존 설계이며 plan 문서의 Q1/Q2 판정이 "통합보다 발산을 문서화하는 편이 spec 불변식을 지킨다"는 근거를 제시하고 있어 현재 선택은 합리적이다. Critical/Warning 급 아키텍처 결함은 발견되지 않았다.

## 위험도
LOW
