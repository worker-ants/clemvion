# 아키텍처(Architecture) 리뷰 — cross-workspace-refs (3R)

## 발견사항

- **[WARNING]** 신설 `common/utils/reference-in-scope.ts` 가 `common/` → `nodes/` 방향의, 이 코드베이스에서 유일한 역방향 import 를 만든다 — 팀이 명시적으로 금지한 층 경계를 어긴다
  - 위치: `codebase/backend/src/common/utils/reference-in-scope.ts:3`(`import { ErrorCode } from '../../nodes/core/error-codes';`), `:28`(`code: ErrorCode.INVALID_FIELD`)
  - 상세: `codebase/backend/src/common/utils/password.util.ts:60-65` 의 주석이 이 정확한 문제를 이미 결정해 뒀다 — *"`code` 를 `ErrorCode.INVALID_FIELD` 로 안 쓰는 것은 의도다. canonical 상수는 `nodes/core/error-codes.ts` 에 있는데 **`common/` 이 `nodes/` 를 import 하는 선례가 0건**이고, 같은 층의 canonical 생산자인 `common/pipes/validation.pipe.ts` 도 리터럴을 쓴다. 층을 거슬러 올라가는 대신 리터럴을 유지한다."* 이 결정은 `plan/complete/impl-details-code-wiring.md`(W3, 2026-09-11)에 "modules/ 13곳은 canonical 상수(선례 9곳), common/ 2곳(`password.util.ts`, `validation.pipe.ts`)은 리터럴 유지 — 층을 갈라 적용" 으로 확정돼 있다. 이번 PR 이 신설한 `reference-in-scope.ts` 는 `common/utils/` 아래에 있으면서 그 결정을 따르지 않고 `nodes/core/error-codes` 를 직접 import 한다 — 실측(`grep -rn "from '\.\./\.\./nodes" common/`)으로 이 파일이 `common/` 안에서 `nodes/` 를 참조하는 유일한 자리임을 확인했다. `nodes/core/error-codes.ts` 자신의 JSDoc 도 이 enum 을 "node handlers' `output.error.code`"(노드 런타임 실행 결과 코드) 전용으로 규정하고 있어, HTTP 계층의 `VALIDATION_ERROR details[].code` 의미로 재사용하는 것은 층 경계뿐 아니라 개념적으로도 맞지 않는 재사용이다. 다만 `ErrorCode.INVALID_FIELD` 의 문자열 값 자체는 리터럴 `'INVALID_FIELD'` 와 동일해 현재 동작·테스트는 깨지지 않는다 — 순수하게 모듈 경계·의존 방향의 회귀다. 강제 가드(lint 규칙 등)가 아직 없어(같은 트래커에 "강제 가드는 여전히 없다" 로 명시) 이런 침범이 조용히 통과한다.
  - 제안: `import { ErrorCode } from '../../nodes/core/error-codes';` 를 제거하고 `password.util.ts`/`validation.pipe.ts` 와 동일하게 리터럴 `'INVALID_FIELD'` 를 쓴다(3번째 `common/` 자리로 편입). 또는 이 기회에 상수를 `common/` 으로 승격하는 트래커 작업을 앞당길지 판단 — 다만 그건 9개 모듈의 import 경로를 건드리는 별개 스코프이므로 이번 PR 범위에서는 리터럴 환원이 더 안전하다.

- **[INFO]** 여러 참조를 한 번에 검사하는 배치 패턴이 네 자리(`EdgesService.assertEndpointsInWorkflow`, `NodesService.assertPlacementInWorkflow`, `WorkflowsService.validateCanvasReferences`, `WorkflowsService.assertNewNodeIdsUnused`)에 각각 손으로 반복 구현돼 있다 — 단건 검사는 `assertReferenceInScope` 로 모았지만 배치는 추상화가 없다
  - 위치: `codebase/backend/src/modules/edges/edges.service.ts`(`assertEndpointsInWorkflow`), `codebase/backend/src/modules/nodes/nodes.service.ts`(`assertPlacementInWorkflow`), `codebase/backend/src/modules/workflows/workflows.service.ts`(`validateCanvasReferences`, `assertNewNodeIdsUnused`)
  - 상세: 이미 2R(`review/code/2026/09/27/22_11_22` W2)에서 지적됐고, `RESOLUTION.md` 가 "수렴 예외" 로 등재해 `plan/in-progress/spec-draft-nullable-notation-followups.md`(교차 워크스페이스 참조 후속, developer 불릿)에 백로그로 넘겼다. 동작 결함이 아니고 재현되는 오동작도 없어 그 처분을 뒤집을 근거는 새로 없다 — 신규 지적이 아니라 처분 확인 차원에서만 기록.
  - 제안: 추가 조치 불요(이미 트래커에 등재, 이번 라운드에서 새로 발견된 것 아님).

## 요약

전체 설계(공용 검증 유틸 `assertReferenceInScope`/`throwInvalidReferences` 로 단건 소속 검사를 8개 이상 서비스에 일관 적용, 모듈 순환 없음, Controller→Service→Repository 계층 유지, 배치 검사의 중복은 기존 라운드에서 이미 수렴 예외로 처분됨)은 1R·2R 두 차례 아키텍처 리뷰를 거치며 견고해졌고 이번 라운드에서 새로 뒤집을 사안은 없다. 다만 새로 발견한 것은, 신설 `common/utils/reference-in-scope.ts` 가 이 저장소가 2026-09-11 부터 명시적으로 지켜 온 "`common/` 은 `nodes/` 를 import 하지 않는다" 는 층 경계 규칙을 깨고 `ErrorCode` enum 을 직접 import 한 점이다 — 문자열 값이 같아 기능은 깨지지 않지만, 팀이 문서로 남긴 의도적 설계 결정을 무효화하는 방향의 회귀이므로 조치를 권한다.

## 위험도
LOW
