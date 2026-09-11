# 아키텍처(Architecture) 리뷰

## 컨텍스트

이 diff(`origin/main` 대비 누적, 최신 커밋 `2d0270fbd`)는 두 차례 `/ai-review` 라운드
(`review/code/2026/09/11/11_05_27`, `11_33_35`)를 이미 거친 결과물이다. 직전 라운드의
architecture WARNING 4건(canonical 상수 미재사용·거짓 헤더 주석·편도 동기화·`it.each`
fixture 중복)은 코드를 직접 읽고 재검증한 결과 전부 해소되어 있었다(`ErrorCode.INVALID_FIELD`
13/13 참조, 헤더 주석 정정, `Record<ChatChannelBlockedField, string>` 양방향 타입, 공유
`BLOCKED_FIELD_CASES` + exhaustiveness 캐너리). 아래는 그 위에서 새로 발견된 항목이다.

## 발견사항

- **[WARNING]** `assertAuthConfigInWorkspace` 가 이 서비스 자신의 기존 관례(`rethrowEndpointPathConflict`)와 **정반대** 모양으로 top-level/`details.code` 를 배치한다 — "field 있으면 code" 규칙을 자리 확인 없이 기계적으로 적용한 결과로 보인다.
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts` — 함수 `assertAuthConfigInWorkspace` (`code: 'AUTH_CONFIG_NOT_FOUND'` 및 `details: { field: 'authConfigId', code: ErrorCode.INVALID_FIELD }` 두 줄. 현재 파일 기준 1009행·1011행). 대조 대상은 같은 파일의 `rethrowEndpointPathConflict` 함수(`code: 'RESOURCE_CONFLICT'` / `details: { field: 'endpoint_path', code: 'TRIGGER_ENDPOINT_PATH_CONFLICT' }`, 현재 파일 기준 1833~1858행).
  - 상세: `2-api-convention.md` §5.3 의 "도메인 세부 사유를 어디에 싣는가" 결정표는 두 갈래를 준다 — (1) **top-level 특화 코드 교체**: 사유가 응답 그 자체이고 한 요청에 사유가 하나뿐일 때(예시: `DUPLICATE_NODE_LABEL`·`WORKFLOW_VERSION_CONFLICT`), (2) **`details[].code`**: top-level 은 상태 기본값(`VALIDATION_ERROR` 등)을 유지하고 세부 사유만 `details` 로 내림(예시: `TRIGGER_ENDPOINT_PATH_CONFLICT`). `rethrowEndpointPathConflict` 는 이 두 번째 갈래를 정확히 따른다 — top-level 은 일반화된 `RESOURCE_CONFLICT`, 도메인 세부 사유는 `details.code: 'TRIGGER_ENDPOINT_PATH_CONFLICT'` 에 싣는다(그 자리 자체에 "왜 `details.code` 로 옮겼는가"를 설명하는 8줄 주석까지 있다).
    이번 diff 가 새로 손댄 `assertAuthConfigInWorkspace` 는 **반대** 모양이다 — top-level 이 이미 도메인 특화 코드(`AUTH_CONFIG_NOT_FOUND`, 상태 기본값이 아님 — 결정표 갈래 (1)에 해당하는 "사유가 하나뿐인 응답")인데, 여기에 **또** `details.code: ErrorCode.INVALID_FIELD` 를 얹었다. `INVALID_FIELD` 는 `error-codes.ts` 자신의 선언 주석("`INVALID_FIELD`: `VALIDATION_ERROR` 응답 `details[].code` — 개별 field 검증 실패 사유")이 스스로 `VALIDATION_ERROR` 봉투에 한정한 값인데, 여기서는 top-level 이 `VALIDATION_ERROR` 가 아닌 `AUTH_CONFIG_NOT_FOUND` 인 자리에 재사용됐다 — 그 상수의 자기 선언 범위보다 넓게 쓰인 것이다.
    이 결정 자체에 대한 유일한 방어 근거는 소스 파일이 아니라 **테스트 파일의 주석**(`triggers.service.spec.ts`, `it('create — authConfigId 가 다른 워크스페이스(미존재)면 …')` 안, *"top-level 은 도메인 코드를 쓰고 details 는 어느 필드가 문제인지 + generic 사유를 싣는다 — §5.3 의 「둘을 겹쳐 쓰지 않는다」를 어기지 않는다(서로 다른 층의 서로 다른 정보다)"*)에만 있다. 이 근거는 (a) §5.3 결정표에 실재하지 않는 **세 번째(하이브리드) 갈래**를 사후에 정당화하는 것이고, (b) 그 정당화가 실제 동작이 일어나는 소스 파일(`triggers.service.ts`)이 아니라 그것을 검증하는 스펙 파일에만 적혀 있어, `triggers.service.ts` 만 읽는 다음 사람은 이 자리가 왜 `rethrowEndpointPathConflict` 와 반대 모양인지 알 방법이 없다. `consistency-check`(`review/consistency/2026/09/11/10_28_52/rationale_continuity.md`)가 "겹쳐 쓰지 않는다" 원칙의 양성 대조로 확인한 것은 "field 없는 진단 payload 6곳"과 "`rethrowEndpointPathConflict` 무조치" 뿐이고, 이 `authConfigId` 조합은 사전 검토 대상에 없었다.
    기능적으로는 additive(기존 top-level `code` 분기 소비자를 깨지 않음)라 CRITICAL 은 아니지만, "이 PR 이 스스로 정립한 규칙을 기계적으로 15자리에 배선한다"는 서술(CHANGELOG·plan)이 실제로는 그 15자리 중 최소 1곳에서 코드베이스 기존 관례를 뒤집는다는 점은 놓치기 쉬운 구조적 비일관성이다 — 나중에 §5.3 결정표만 보고 "위반"이라 오판해 이 자리를 되돌리면, 방금 뮤테이션으로 고정한 회귀 캐너리(`code: 'INVALID_FIELD'` 단언)가 근거 없이 삭제될 위험도 있다.
  - 제안: `assertAuthConfigInWorkspace` 자리에도 `rethrowEndpointPathConflict` 수준의 근거 주석을 남기거나(왜 이 자리만 top-level 도메인 코드 + details 제네릭 코드를 겹쳐 쓰는지), 더 근본적으로는 `2-api-convention.md §5.3` 결정표에 "top-level 이 이미 특화 코드인데 `field` 정보가 있어 `details.code` 를 함께 싣는" 제3의 갈래를 명시적으로 추가해 이 자리가 예외가 아니라 규칙임을 문서화한다(project-planner 턴). 코드를 되돌릴 필요는 없다 — 위치를 옮기거나 근거를 명문화하는 정도로 충분하다.

- **[INFO]** (carry-forward, 신규 아님) `TriggersService`(1850행대) 로의 provider-특화 검증 책임 누적이 이번 라운드에도 계속된다.
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts` 전체, 특히 `assertChatChannelInputSafe`/`assertPatchCarriesNoSecrets`/`assertInboundSigningPlaintextByProvider`/`assertAuthConfigInWorkspace` 군.
  - 상세: 이번 diff 는 기존 13개 throw 자리에 `code` 필드만 추가했을 뿐 새 책임을 만들지는 않았다. `plan/in-progress/impl-details-code-wiring.md` 가 "E(`TriggersService` 모듈 경계 추출)는 후속 PR" 로 명시적으로 분리했고 그 근거(`forwardRef` 순환 재발 방지)도 실측 기반이라 타당하다. 두 차례 리뷰가 이미 확인한 사항으로, 이번 라운드가 새로 만든 부채는 아니다.
  - 제안: 조치 불필요 — 후속 PR 착지만 추적.

## 요약

이번 diff 는 신규 기능이 아니라 §5.3 계약(`details[].code`)의 사후 배선과 두 검증 층(DTO
class-validator / `TriggersService` 가드) 사이 메시지 리터럴 중복 제거로 구성된 구조 정리다.
직전 라운드가 지적한 4건(리터럴 미재사용·거짓 스펙 인용·편도 동기화·fixture 중복)은 모두
코드로 재검증해 온전히 해소됐음을 확인했다. 그 위에서 새로 찾은 것은 하나 — `details[].code`
를 "15자리에 기계적으로" 배선하는 과정에서 `assertAuthConfigInWorkspace` 한 자리가 같은
파일의 기존 관례(`rethrowEndpointPathConflict`: top-level 은 일반 코드, `details.code` 가
도메인 세부 사유)와 **반대** 모양(top-level 이 이미 도메인 코드인데 `details.code` 에 제네릭
`INVALID_FIELD` 를 겹쳐 쓴다)이 됐다는 점이다. 이 결정의 유일한 방어 논거가 실제 동작이
일어나는 소스가 아니라 테스트 주석에만 있고, `2-api-convention.md §5.3` 결정표에도 이
하이브리드 갈래가 반영돼 있지 않다 — 기능을 깨는 CRITICAL 은 아니지만, 이 PR 이 스스로
세운 규율(같은 원칙을 15곳에 균일하게 적용)에서 벗어난 유일한 자리이므로 근거를 코드
또는 스펙 문서 쪽으로 옮겨 명문화할 가치가 있다. `TriggersService` 의 SRP 누적은 여전히
plan 이 추적 중인 기존 사안으로 이번 라운드가 새로 만든 문제가 아니다.

## 위험도

LOW
