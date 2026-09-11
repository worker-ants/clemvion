# 아키텍처(Architecture) 리뷰

## 컨텍스트

이 diff 는 `origin/main`(`94e19be8d`) 대비 누적이며, 최신 커밋은 `9fcce3f47`이다. 이미 3차례
`/ai-review` 아키텍처 라운드(`11_05_27`·`11_33_35`·`12_00_40`)를 거쳤고, 직전 라운드
(`12_00_40`)가 지적한 유일한 WARNING(`assertAuthConfigInWorkspace` 가 같은 파일의 기존 관례
`rethrowEndpointPathConflict` 와 반대 모양으로 top-level 특화 코드 + `details.code` 를 겹쳐
쓰면서도 그 근거가 소스가 아니라 테스트 주석에만 있던 문제)는 최신 커밋 `9fcce3f47` 이
`triggers.service.ts:1008-1019` 에 근거 주석(왜 이 자리만 다른지, §5.3 판정이 아직 planner
미결이라는 것, 추적 트래커 경로)을 추가해 **해소했다** — 제안했던 두 옵션(근거 주석 추가 /
§5.3 결정표에 제3의 갈래 명문화) 중 첫 번째를 택했고, 최종 판정은 의도적으로 planner 턴에
넘겨 `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 등재했다. 이번 라운드가
새로 검토할 실질 변경분은 `9fcce3f47` 뿐이며(citation 문구 정정 2곳 + 위 anchor 주석), 둘 다
문서/주석이라 새로운 구조적 리스크를 만들지 않는다. 아래는 그 위에서 재확인·신규 발견한 항목이다.

## 발견사항

- **[INFO]** (tracked, 미해결) `ErrorCode.INVALID_FIELD` 재사용이 "node handler 출력 코드"
  라는 그 상수의 선언 범위를 넘어 HTTP 계층(`TriggersService`)의 제네릭 필드-검증 코드로
  쓰이면서, 같은 개념값 `'INVALID_FIELD'` 의 정본이 계층별로 세 갈래로 갈라져 있다.
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts:50`(`import { ErrorCode } from '../../nodes/core/error-codes'`), 사용처 13곳(예 `:510`, `:656`) · `codebase/backend/src/common/utils/password.util.ts:60-65`(리터럴 유지 이유를 설명하는 주석) · `codebase/backend/src/common/pipes/validation.pipe.ts:13,58`(자체 리터럴 타입)
  - 상세: `nodes/core/error-codes.ts` 의 `ErrorCode` 는 자신의 JSDoc 에서 "Canonical error-code enum for node handlers' `output.error.code`"(및 엔진이 emit 하는 일부)로 스코프를 명시한다. `TriggersService.update()` 의 `chatChannel` 차단 필드 거부는 node 실행과 무관한 REST PATCH 요청의 DTO/서비스 계층 검증 실패이며, 개념적으로는 `common/pipes/validation.pipe.ts` 가 이미 만들어 내는 것과 동일한 종류의 "필드 검증 실패" 다. 그런데 이번 PR 은 `common/` 은 리터럴을 유지하고(`common/` 이 `nodes/` 를 import 하는 선례가 0건이라는 이유), `modules/triggers` 는 `nodes/core/error-codes` 의 `ErrorCode.INVALID_FIELD` 를 가져와 쓴다 — 그 근거가 "9개 모듈에 import 선례가 있다"는 **경로 편의성**이지 "이 값을 실제로 소유하는 바운디드 컨텍스트가 어디인가"라는 **의미적 소유권** 질문에 대한 답이 아니다. 결과적으로 같은 `'INVALID_FIELD'` 개념이 (a) `validation.pipe.ts` 의 자체 리터럴 타입, (b) `password.util.ts` 의 리터럴, (c) `nodes/core/error-codes.ts` 의 `ErrorCode` enum(→ `triggers.service.ts` 가 import) 세 곳에 독립적으로 존재해, 하나를 고쳐도 나머지 둘이 따라오지 않는다. 이 비대칭은 이미 `plan/in-progress/spec-draft-nullable-notation-followups.md` (line 2384, 항목 (i))에 "`common/` 리터럴 vs `modules/` canonical 상수 비대칭의 spec Rationale" 로 등재돼 있어 이번 라운드가 처음 발견한 것은 아니다 — 다만 그 트래커 항목이 "리터럴 vs 상수"라는 표기 축으로만 적혀 있어, 근본 원인이 "값의 실제 소유 계층이 node-실행 도메인이 아니다"라는 점까지는 명시하지 않고 있다.
  - 제안: 코드 변경 불요 — 이미 개발자 트래커 항목으로 등재돼 있다. 다만 그 항목을 해소할 때 "리터럴을 상수로 바꾼다"만이 아니라, `INVALID_FIELD` 를 `common/`(또는 API 계약 전용 위치, 예: `common/errors/` 신설)로 승격해 `nodes/core/error-codes.ts` 와는 별개의 "HTTP 필드-검증 코드 카탈로그"로 분리하는 방향도 함께 검토할 것을 권장 — 그래야 `modules/triggers` 가 워크플로 엔진 내부 타입에 의존하지 않게 된다.

- **[INFO]** (carry-forward, pre-existing — 이번 diff 가 새로 만든 문제 아님) `TriggersService` 가 chatChannel 검증 책임을 계속 흡수하며 1,881줄까지 성장했다.
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts` 전체, 특히 `assertChatChannelInputSafe`(:638)·`assertPatchCarriesNoSecrets`(:695)·`assertChatChannelAlreadySetUp`(:723)·`assertInboundSigningPlaintextByProvider`·`setupChatChannel`(:1101)·`teardownChatChannel`(:1292) 군
  - 상세: 이번 diff 는 기존 throw 자리에 `code`/메시지-상수 참조만 추가했을 뿐 새 메서드나 새 책임을 만들지 않았다. `plan/in-progress/impl-details-code-wiring.md` 가 "E(`TriggersService` 모듈 경계 추출)는 별도 PR" 로 명시적으로 분리했고, 그 이유(이동+변경이 섞이면 리뷰가 동작 델타를 못 가른다)도 타당하다 — SRP 누적을 인지하면서도 이번 PR 의 스코프를 기계적 리터럴 치환으로 좁게 유지한 것은 올바른 규율이다.
  - 제안: 조치 불요. 후속 PR(E) 착수 시점만 추적.

## 확인한 설계 결정 (문제 없음 — 근거 기록용)

- `CHAT_CHANNEL_BLOCKED_FIELD_MESSAGES: Record<ChatChannelBlockedField, string>` (`chat-channel-rejection-messages.const.ts`)은 `satisfies` 대신 `Record<>` 로 선언해 필드 배열→메시지, 메시지→필드 배열 **양방향**을 컴파일러가 검사하게 한다. 필드 하나가 늘 때 한쪽만 갱신하면 컴파일 에러가 나므로, 위 두 번째 발견사항(TriggersService SRP)과는 별개로 이 구성 요소 자체의 확장성은 견고하다.
- `ChatChannelUpdateConfigDto extends OmitType(ChatChannelConfigDto, ['botToken', 'inboundSigningPlaintext'])` (`chat-channel-config.dto.ts:394` 부근)는 단순 상속이 만들 수 있었던 LSP 위반(부모의 `@IsString()` 필수 데코레이터와 자식의 `@IsEmpty()` 가 충돌해 "어느 쪽으로도 통과 못 하는 DTO"가 되는 경우)을 `OmitType` 으로 명시적으로 회피했고, 그 이유를 소스에 남겼다 — 적절한 패턴 선택이다.
- `chat-channel-rejection-messages.const.ts` 는 `dto/`(프레젠테이션 인접 계층)와 `triggers.service.ts`(서비스 계층) 양쪽이 참조하는 순수 데이터 상수 모듈로, 두 계층보다 낮은 층에 위치해 계층 경계를 침범하지 않는다. import 방향도 단방향(양쪽 → 상수)이라 순환 의존 없음을 확인했다(`nodes/core/error-codes.ts` 도 자체 import 가 없는 leaf 모듈).

## 요약

이번 diff 는 신규 기능이 아니라 API 응답 계약(§5.3 `details[].code`)의 사후 배선과 중복
메시지 리터럴 제거로 구성된 구조 정리이며, 이미 세 라운드의 아키텍처 리뷰를 거치며 발견된
WARNING(canonical 상수 미재사용·거짓 인용·편도 동기화·fixture 중복·`assertAuthConfigInWorkspace`
비일관성)이 모두 코드/주석으로 해소됐음을 이번 라운드에서 재확인했다. 최신 커밋(`9fcce3f47`)은
citation 문구 정정과 근거 주석 추가뿐이라 새로운 구조적 리스크를 만들지 않는다. 유일하게 남은
것은 `ErrorCode.INVALID_FIELD`(node-핸들러 도메인 상수)가 `modules/triggers`(HTTP 계층)로
재사용되며 같은 개념값의 정본이 계층별로 갈라지는 비대칭인데, 이미 개발자 트래커에 등재된
기존 known-debt 항목이고 기능적 파손은 없다. `TriggersService` 의 책임 누적도 pre-existing 이며
후속 PR 로 의도적으로 스코프 아웃돼 있어 이번 PR 이 만든 문제가 아니다. `OmitType`을 통한
LSP 위반 회피, `Record<>` 를 통한 양방향 타입 안전성, 공유 상수 모듈을 통한 계층 간 SoT
통합 등 이 diff 가 새로 도입한 설계 요소들은 모두 견고하다.

## 위험도

LOW
