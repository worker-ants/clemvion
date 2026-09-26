# 테스트(Testing) 리뷰

## 발견사항

- **[WARNING]** `changeSummary` 가 새로 "required + nullable" 로 광고되는데, 값이 실제로 `null` 인 런타임 응답을 계약 대조(`assertMatchesContract`)로 검증하는 테스트가 어디에도 없다.
  - 위치: `codebase/backend/test/workflow-crud.e2e-spec.ts` 테스트 `H`(`it('H. 버전 단건 조회 …')`, 587행 부근) vs 테스트 `I`(`it('I. 버전 복원 …')`, 610행 부근)
  - 상세: `assertMatchesContract(…, await contractForDto(WorkflowVersionDto|WorkflowVersionListItemDto))` 를 호출하는 곳은 테스트 `H` 하나뿐인데, `H` 는 저장 시 `changeSummary: 'v1'`(561행)을 명시해 항상 non-null 값만 계약과 대조한다. 한편 `changeSummary` 를 생략하는 저장(`buildFiveNodeGraphPayload()` — `changeSummary` 키가 없음, 테스트 `I` 623행 및 테스트 `C`)은 `WorkflowVersionsService.createVersion` 의 `changeSummary: changeSummary || undefined`(`workflow-versions.service.ts` 219행)를 거쳐 DB 에 `NULL` 로 저장될 것으로 보이지만, 그 버전을 목록/상세 엔드포인트로 조회해 `assertMatchesContract` 로 대조하는 테스트가 없다. 즉 이번 PR 이 핵심으로 삼는 "값은 `null` 이어도 된다" 축이 스키마 선언 수준(`workflow-version-response.dto.spec.ts`)에서만 고정되고, 실제 wire 값이 `null` 인 경우를 어떤 계층도 실행하지 않는다. `swagger-dto-contract` 래칫과 신규 DTO 캐너리가 커버하지 못하는 부분을 e2e 로 메운다는 이 PR 자체의 설계 원칙(`workflow-version-response.dto.spec.ts` 의 "왜 래칫·e2e 로 부족한가" 주석)에 비추어 보면, 정작 "값이 null" 이라는 케이스 자체는 어느 층도 양성으로 실행하지 않는 사각지대다.
  - 제안: 테스트 `I`(또는 새 케이스)에서 복원 후가 아니라 `changeSummary` 를 생략한 버전을 목록/상세로 조회해 `assertMatchesContract` 로 대조하거나, 최소한 `expect(detail.body.data.changeSummary).toBeNull()` 같은 양성 단언을 추가해 "키가 있고 값이 null" 경로를 실제로 실행시킬 것을 권한다. e2e 가 부담되면 `assertMatchesContract({ ...validPayload, changeSummary: null }, await contractForDto(WorkflowVersionDto))` 형태의 경량 단위 테스트로도 같은 축을 닫을 수 있다.

- **[INFO]** `changeSummary` 가 `null` 대신 빈 문자열로 저장될 수 있는 기존 분기가 새 required+nullable 계약과 상호작용한다 — 이번 diff 범위 밖.
  - 위치: `codebase/backend/src/modules/workflow-versions/workflow-versions.service.ts:219` (`changeSummary: changeSummary || undefined,`)
  - 상세: `''`(빈 문자열)를 명시적으로 보내도 falsy 판정 때문에 `undefined`(→ DB `NULL`)로 떨어진다. 이번 PR 이 손대는 자리는 아니지만, `changeSummary` 를 "항상 실리고 null 일 수 있다" 는 계약으로 승격시킨 지금, "빈 문자열 vs null" 구분이 애초에 서비스 계층에서 뭉개진다는 사실이 더 눈에 띄게 된다. 이번 PR 의 결함은 아니므로 블로킹 사유는 아니다.

## 요약

새 DTO 선언 캐너리(`workflow-version-response.dto.spec.ts`)는 플랜의 뮤턴트 표(M1~M3)로 검증된 대로 §5.4 선언 회귀(옵셔널로의 후퇴, nullable 재추가, `type` 누락)를 정확히 잡고, `swagger-dto-contract` 래칫에서 4행을 정확히 제거해 선언-타입 정합성 가드와도 어긋나지 않는다. 서비스 단위 테스트에 추가된 "목록·상세 select 는 snapshot 하나만 다르다" 대칭 단언은 `VERSION_METADATA_SELECT` 상수화 리팩터가 두 조회 중 하나만 갱신되는 결함(M4)을 실제로 잡는 형태로 잘 설계됐고, mock 은 호출 인자(`select` 옵션)만 검증하므로 반환값 형태와 무관해 적절하다. e2e 는 기존 계약 대조가 전혀 없던 목록 엔드포인트에 이름 축(`expectNoUserSecrets`)과 선언 축(`assertMatchesContract`)을 순서까지 신경 써서(이름 축을 먼저 실행해야 선언 대조가 먼저 던지는 것을 막음) 추가했고, 플랜에 기록된 뮤턴트 M5 실측(예측과 다른 축이 죽였다는 점까지 정직하게 기록)은 이 리뷰가 직접 반증할 필요가 없을 만큼 신뢰할 수 있다. 다만 이번 변경이 `changeSummary` 를 "항상 실리고 값이 null 일 수 있다"로 승격시킨 핵심임에도, 실제로 `null` 값이 wire 로 나가는 경로를 계약 대조로 실행하는 테스트가 하나도 없다는 커버리지 갭이 남아 있다(WARNING 1건). 그 외 테스트 격리(각 `beforeEach` 의 `jest.clearAllMocks()`)·가독성(모든 신규 테스트에 "왜" 를 설명하는 주석)·기존 회귀 테스트와의 정합성은 문제없다.

## 위험도

LOW
