# Code Review 통합 보고서

## 전체 위험도
**CRITICAL** — `boolean` 타입 Manual 트리거 파라미터는 이번 PR 이 막으려는 마스킹 마커 재제출 검사를 완전히 우회한다(타입 강제변환이 검사보다 먼저 실행됨). `testing`·`api_contract`·`requirement` 세 reviewer 가 독립적으로 코드 실행/역추적으로 확인했다. forced whitelist(`documentation`, `maintainability`, `requirement`, `scope`, `security`, `side_effect`, `testing`) 전원 결과 확보됨 — 누락 없음.

## Critical 발견사항

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | api_contract / testing / requirement | `resolveTriggerParameters` 의 타입 강제변환(`coerceToType`)이 `findMaskedResubmissions` 검사보다 먼저 실행돼, **`boolean` 타입 트리거 파라미터는 마스킹 마커(`'***'` 등)가 재제출돼도 조용히 통과한다**. `coerceToType('***', 'boolean')` → `Boolean('***')` → `true` 로 캐스팅되고 `isCoerceFailure` 도 boolean 에 대해 항상 실패를 선언하지 않아, 검사 시점엔 이미 원본 마커 문자열이 사라지고 `isMaskedMarker(true)` 는 `typeof v === 'string'` 조건에서 즉시 `false`. 크리덴셜 마스킹은 필드 **이름** 패턴(`CREDENTIAL_KEY_PATTERN`)으로 트리거되고 값의 선언 타입과 무관하게 wholesale 치환하므로, `boolean` 타입 크리덴셜류 필드(예: `apiKeyEnabled`)가 있으면 이 시나리오는 이론적 엣지케이스가 아니라 실제 도달 가능. 실측(jest probe)으로 우회 확인됨(3벌 신규 테스트 모두 `string`/object-nested-string 타입만 사용, `boolean`/`number`/`array` 케이스 전무). | `codebase/backend/src/modules/executions/executions.service.ts:495-503`, `codebase/backend/src/modules/workflows/workflows.controller.ts:314-322` (호출부) / 근본 원인: `codebase/backend/src/modules/execution-engine/utils/coerce-type.ts` `case 'boolean'` | `findMaskedResubmissions` 를 coerce **이전** raw 입력(`dto.inputOverride`/`rawValues`)에 적용하거나, `resolveTriggerParameters` 내부에서 coerce 직전에 `isMaskedMarker` 를 먼저 검사하도록 순서 변경. `type: 'boolean'` 필드에 마커를 재제출하는 회귀 테스트를 두 호출부 spec 에 추가. |

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | api_contract | 위 CRITICAL 과 동일 원인: `number`/`array`/`object` 타입 필드는 마커 재제출이 거부되긴 하지만, `resolveTriggerParameters` 의 `isCoerceFailure` 가 마스킹 검사보다 먼저 `coerce_failed`(`TYPE_COERCION_FAILED`)를 던져 사용자가 잘못된(일반 타입 오류) 에러 코드/메시지를 받는다 — 의도한 `MASKED_VALUE_RESUBMITTED` 안내가 아님. | `executions.service.ts:497-503`, `workflows.controller.ts:315-322` | CRITICAL #1 과 동일 수정(검사 순서를 마스킹→coerce 로 변경)으로 함께 해소됨. |
| 2 | requirement | 가드가 `resolveTriggerParameters` 의 **완전 resolve 된**(기본값 채움 포함) 출력을 검사해, optional 필드의 `defaultValue` 가 마스킹 마커 리터럴과 우연히 일치하면 **사용자가 손대지 않은 필드도** 매 실행마다 400 으로 거부된다(과잉 차단, spec 이 이 케이스를 배제하지 않음). | `codebase/backend/src/modules/execution-engine/utils/resolve-trigger-parameters.ts:122-128` (defaultValue 채움) → 두 호출부 | 검사를 raw override 에 실제로 존재하는 키에만 적용하거나, 스키마 저장 시점에 `defaultValue` 가 마커 리터럴과 일치하면 `invalid_schema` 로 차단. |
| 3 | architecture | 마스커(`deepRedactCore`, `sanitize-error-message.ts`)와 판정기(`hasMaskedLeaf`, `reject-masked-resubmission.ts`)가 `MAX_REDACT_DEPTH` 상수는 공유하지만 **재귀 순회 알고리즘 자체는 각자 독립 구현**이고, 이를 교차 검증하는 라운드트립(통합) 테스트가 없다. 역추적 결과 현재는 "값 검사 우선" 순서 덕에 1단계 여유 마진으로 우연히 정상 동작하나, 마스커의 캡 처리 순서가 바뀌면 조용히 깨질 수 있다. (testing 리뷰의 depth-offset 발견과 동일 근본 원인 — 항목 9 참고) | `codebase/backend/src/modules/execution-engine/utils/reject-masked-resubmission.ts` `hasMaskedLeaf`, `codebase/backend/src/shared/utils/sanitize-error-message.ts` `deepRedactCore`/`deepRedactObject` | `deepRedactSecrets` 실제 출력을 `findMaskedResubmissions` 에 통과시키는 캐너리 테스트 최소 1개 추가(테스트 항목 9 와 통합 가능). 여력 되면 두 파일이 공유하는 generic tree-walk 헬퍼로 재귀 자체를 일원화. |
| 4 | architecture / maintainability | 동일한 "판정(`findMaskedResubmissions`) 후 length 체크 후 throw" 4줄이 두 호출부에 문자 그대로 중복돼 있다. 이 PR 자체가 이전 라운드에서 두 호출부 사이 에러 봉투(`errors` vs `details`) 드리프트를 겪은 이력이 있어(같은 클래스의 재발 소지), 향후 세 번째 호출부(예: 노드 단위 실행)가 생기면 가드 누락 실수가 나기 쉽다. | `codebase/backend/src/modules/executions/executions.service.ts:498-503`, `codebase/backend/src/modules/workflows/workflows.controller.ts:316-322` | `rejectMaskedResubmission(parameters): void` 같은 헬퍼로 "판정+throw" 만 추출(에러 봉투 조립은 호출부에 유지). |
| 5 | requirement | 트래커 항목(`plan/in-progress/spec-sync-external-interaction-api-gaps.md:328`, W6 "`inputOverride` 서버측 마커 리터럴 거부")이 **이 PR 이 곧 그 구현**임에도 체크박스가 `[ ]` 로 남아 있다. 같은 항목 본문이 "구현이 머지될 때 닫는다"고 스스로 명시했고, 바로 아래 W5 는 같은 세션에서 `[x]` 로 갱신됨. | `plan/in-progress/spec-sync-external-interaction-api-gaps.md:328` | 같은 커밋에서 W6 을 `[x]` 로 갱신, 이 구현 커밋을 종결 근거로 인용(W5 와 동형). |
| 6 | side_effect | `POST /workflows/:id/execute` 의 거부 범위가 "재제출 방지"를 넘어 **신규(fresh) 입력**에도 적용되도록 넓어졌다 — 값이 히스토리 재적재인지 방금 타이핑인지 구분 없이, 마커 세 문자열과 정확히 일치하면 무조건 거부된다. 이미 spec(§R17 "가드의 범위" 캐비엇)이 의도된 트레이드오프로 명문화했고 같은 세션 consistency-check 도 독립적으로 지적한 사항이라 인지·수용된 결정이지만, "공개 엔드포인트가 과거 통과시키던 입력 부분집합을 거부로 전환"하는 사실 자체는 side-effect 관점에서 별도 등재. | `codebase/backend/src/modules/workflows/workflows.controller.ts:313-323` | 신규 조치 불요(이미 결정·문서화). 배포 시점에 마커 리터럴을 직접 입력하는 기존 자동화 존재 여부 재확인 권장. |
| 7 | documentation | EIA §R17 "닫는 조건" 표의 신규 행 라벨(`서버 (재제출 API)`, "재제출 경로 두 곳")이, 바로 아래 블록쿼트("가드의 범위 — Manual 실행 경로 전체다, 재제출만이 아니다")가 스스로 정정한 프레이밍과 다른 그림을 그린다. 정정의 출발점이었던 표 행 자체는 갱신에서 빠졌다. | `spec/5-system/14-external-interaction-api.md:1573` (표 행), 캐비엇은 `:1575-1580` | 표 행 라벨을 `서버 (Manual 실행 경로)` 등으로, 설명 문구도 "Manual 실행 경로 두 곳(재제출 포함, fresh 입력도 대상)"으로 정정. |
| 8 | documentation | `CHANGELOG.md` 에 이번 변경 항목이 없다 — 같은 마스킹 시리즈 직전 5개 커밋 전부가 항목을 남겼고, 특히 직접 선행 커밋(#1188)의 CHANGELOG 항목이 "서버측 거부는 트래커 항목으로 남겼다"고 이번 PR 이 닫을 작업을 예고까지 해 두었다. | `CHANGELOG.md` (이 diff 에 미포함) | `## Unreleased` 항목 추가, 선행 항목(#1188)이 예고한 후속 작업을 이 PR 이 닫는다는 연결고리 명시. |
| 9 | testing | 실제 마스커(`deepRedactSecrets`)와 `findMaskedResubmissions` 를 **함께** 실행하는 통합 테스트가 없다. 실측(jest probe) 결과 실제 흐름(`redactStoredDataForResponse` 가 `inputData` 루트에서 depth 0 으로 호출)과 판정기의 depth 기준 사이에 오프셋이 있고, 실제 절단은 상대 depth ~7 에서 발생하는데 코드가 쓰는 `MAX_REDACT_DEPTH=10` 은 더 관대한(안전한) 방향이라 fail-open 은 아니지만, 신규 유틸 doc 주석의 "정확히 그 지점" 주장은 실측과 어긋나며 이를 잡아줄 테스트가 없다. | `codebase/backend/src/modules/execution-engine/utils/reject-masked-resubmission.spec.ts:73-103` (자체 모델 `nestObj`/`nestArr` 기반, 실제 마스커 미사용) | `deepRedactSecrets`/`redactStoredDataForResponse` 를 실제 `{ __triggerSource, parameters }` 형태 입력에 돌린 결과를 `findMaskedResubmissions` 에 넣는 E2E characterization 테스트 최소 1개 추가(WARNING #3 의 architecture 제안과 통합 가능). |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | security | `hasMaskedLeaf` 재귀는 깊이만 제한(폭 무제한)이나, 방문 노드 수는 결국 요청 본문 크기에 선형(O(n))이라 지수적 증폭 없음. 기존 `deepRedactCore` 와 동일 위험 프로파일. | `reject-masked-resubmission.ts` `hasMaskedLeaf` | 조치 불요. |
| 2 | security | 에러 응답(`TriggerParameterErrorDetail`)에 실제 제출 값이 echo 되지 않음(field/code/message 고정 문자열만) — 정보 노출 안전 확인. | `trigger-parameter.types.ts` `toTriggerParameterErrorDetails` | 조치 불요. |
| 3 | performance | `Object.values()` 재귀 호출마다 중간 배열 재할당되나, 폼 입력 규모(필드 수 개~수십, 깊이 상한 10)에서 GC 압력 무시할 수준. | `reject-masked-resubmission.ts` `hasMaskedLeaf` | 핫패스로 승격되면 재검토. |
| 4 | architecture | 신규 에러코드 확장이 닫힌 union + exhaustive `Record` 매핑(Open/Closed 준수) 패턴을 잘 따름 — 확인용, 지적 아님. | `trigger-parameter.types.ts` `REASON_TO_DETAIL` | 조치 불요. |
| 5 | architecture | Manual 트리거 파라미터 검증이 컨트롤러/서비스 레이어에 인라인된 구조는 이 PR 이전부터의 기존 패턴 연장(신규 위반 아님). | `workflows.controller.ts`/`executions.service.ts` | 세 번째 소비처 생기면 파이프라인 함수로 묶는 것 고려. |
| 6 | scope | `errors`→`details` 배선 교정은 요청 범위를 넘는 듯 보이나, 새 코드가 두 호출부 모두에서 동작하기 위한 필수 선결 수정 — 스코프 이탈 아님. | `executions.service.ts:509` | 조치 불요. |
| 7 | scope | `review/consistency/**` 산출물(1477줄)이 기능 diff(427줄)보다 크지만 CLAUDE.md 가 의무화한 게이트 통과 기록 — 무관한 파일 아님. | `review/consistency/2026/08/20/**` | 조치 불요. |
| 8 | side_effect | `errors`→`details` 필드 변경은 `GlobalExceptionFilter` 가 애초 `errors` 를 읽지 않았음을 코드로 확인 — 실질 회귀 없는 순수 버그 수정. | `executions.service.ts:495-514` | 조치 불요. |
| 9 | side_effect | `reason`/`code` 유니온 4번째 값 추가는 유일 소비처가 `Record<>` 로 exhaustive 강제되어 미매핑 누락 위험 없음. | `trigger-parameter.types.ts` | 조치 불요. |
| 10 | maintainability | `ExecutionsService.reRun` 이 이미 137줄로 길고 이번 변경이 책임을 하나 더 얹음(기존 구조, 신규 로직 자체는 4줄). | `executions.service.ts` (`reRun`, §421-557) | 다음 확장 시 입력 해석 블록 헬퍼 추출 고려. |
| 11 | maintainability | 신규 한국어 인라인 주석과 인접 기존 영어 주석이 같은 블록에 공존(이번 diff 가 만든 문제 아님). | `workflows.controller.ts:316-327` | 필수 아님, 편집 기회 있을 때 통일 검토. |
| 12 | testing | webhook/schedule 경로가 가드 밖이라는 설계 결정(§R17 명시)에 대한 경계 캐너리(정상 처리 확인 테스트)가 없음. | `hooks.service.ts:183` (미호출), `hooks.service.spec.ts` (대응 테스트 없음) | `hooks.service.spec.ts` 에 "webhook body 에 `'***'` 리터럴이 있어도 정상 처리" 캐너리 추가. |
| 13 | testing | `KEY_MASK_MARKER`/`DEPTH_MASK_MARKER` 스칼라 테스트가 검증하는 시나리오는 현재 `Execution.inputData` 마스킹 경로(`deepRedactSecrets`, `VALUE_MASK_MARKER` 만 생산)에서는 발생 불가 — 방어적 커버리지, 오독 여지만 있음. | `reject-masked-resubmission.spec.ts:24-31` | 필수 수정 아님. |
| 14 | documentation | `trigger-parameter.types.ts` 의 기존 JSDoc 이 `reason` 값 예시를 두 개(`missing_required`/`coerce_failed`)만 들지만 이제 4종. | `trigger-parameter.types.ts:68` | 필수 아님, 예시 일반화 또는 4종 전부 나열. |
| 15 | api_contract | 요청 계약 하위 호환성 좁힘(마커 리터럴이 이제 예약어) — 이미 spec 에 "알려진 제약"으로 문서화, 외부 소비자 부재 확인됨. | `spec/5-system/14-external-interaction-api.md` §R17 | 조치 불요, 사후 신고 시 재검토. |
| 16 | user_guide_sync | `workflows.controller.ts` 가 "백엔드 API 추가·변경" trigger 에 매칭되나 swagger jsdoc/유저가이드 미갱신 — 정상 GUI 경로로는 이 400 에 사실상 도달 불가(선행 PR 이 UI 단에서 이미 차단)라 실사용 영향 낮음. | `workflows.controller.ts` (`execute` 핸들러) | 조치 불요, 실사용 사례 생기면 캐비엇 추가 검토. |
| 17 | user_guide_sync | 신규 `MASKED_VALUE_RESUBMITTED` 가 `backend-labels.ts` `ERROR_KO` 미매핑이나, 이는 `error-codes.ts` `ErrorCode`(노드 실행 실패 taxonomy)와 다른 taxonomy(`TriggerParameterErrorDetail`)라 매트릭스 trigger 범위 밖이고 형제 코드 3종과 동일하게 기존부터 미매핑. | `trigger-parameter.types.ts` `REASON_TO_DETAIL` | 조치 불요(매트릭스 gate 밖). 별도 매핑 정책 필요시 planner 턴에서 검토. |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 인젝션/시크릿 노출 없음, 방어 강화 확인. 폭 방향 순회는 O(n) 안전 |
| performance | NONE | N+1/블로킹 I/O 없음, 재귀 깊이 유계, 폭 무계는 이론적 여지만 |
| architecture | LOW | 마스커-판정기 재귀 이중구현+교차검증 부재(WARNING), 판정+throw 중복(WARNING) |
| requirement | MEDIUM | boolean 타입 우회(WARNING, CRITICAL 과 동일 원인), defaultValue 우연 일치 과잉차단(WARNING), W6 체크박스 미갱신(WARNING) |
| scope | NONE | 스코프 이탈 없음, errors→details 는 필수 선결 수정으로 판단 |
| side_effect | LOW | execute 가 신규 입력까지 거부 대상 확장(WARNING, 이미 문서화된 결정) |
| maintainability | LOW | 판정+throw 중복(WARNING), reRun 비대화·주석 언어 혼재(INFO) |
| testing | CRITICAL | **boolean 타입 마스킹 마커 완전 우회를 jest 로 실측 확인(CRITICAL)**, 마스커-판정기 depth 정합성 통합 테스트 부재(WARNING) |
| documentation | MEDIUM | §R17 표 행 라벨 vs 캐비엇 불일치(WARNING), CHANGELOG 누락(WARNING) |
| api_contract | HIGH | boolean 타입 우회(CRITICAL, testing 과 동일 근본원인), number/array/object 타입 잘못된 에러코드(WARNING) |
| user_guide_sync | NONE | frontend 변경 없음, swagger/라벨 미갱신은 매트릭스 gate 밖이거나 실사용 영향 없음 |

## 발견 없는 에이전트

없음 — 11개 reviewer 전원이 최소 1건 이상(CRITICAL/WARNING/INFO)의 관찰을 남겼다. NONE 위험도로 판정한 reviewer(security, performance, scope, user_guide_sync)도 확인용 INFO 를 기록했다.

## 권장 조치사항

1. **[최우선/CRITICAL]** `findMaskedResubmissions` 검사를 타입 강제변환(`coerceToType`) **이전**의 raw 입력에 대해 수행하도록 순서를 변경한다 — `boolean` 타입 트리거 파라미터가 마스킹 마커를 완전히 우회하는 결함을 닫는다. 동일 수정으로 `number`/`array`/`object` 타입의 잘못된 에러 코드(WARNING #1) 문제도 함께 해소된다. `type: 'boolean'`/`'number'`/`'array'` 필드에 대한 회귀 테스트를 두 호출부 spec 에 추가.
2. **[WARNING]** `resolveTriggerParameters` 의 `defaultValue` 채움 결과가 아니라 사용자가 실제로 제출한 raw override 키에만 마스킹 검사를 적용해, optional 필드의 우연한 defaultValue-마커 일치로 인한 과잉 차단을 막는다.
3. **[WARNING]** 마스커(`deepRedactCore`)와 판정기(`hasMaskedLeaf`)의 depth 기준이 실제로 정합하는지 검증하는 E2E characterization 테스트를 최소 1개 추가한다(`deepRedactSecrets` 실제 출력 → `findMaskedResubmissions` 라운드트립).
4. **[WARNING]** 두 호출부의 중복된 "판정+throw" 4줄을 `rejectMaskedResubmission()` 헬퍼로 추출해 향후 세 번째 호출부 누락 위험을 줄인다.
5. **[WARNING]** `plan/in-progress/spec-sync-external-interaction-api-gaps.md` W6 체크박스를 `[x]` 로 갱신하고, EIA §R17 "닫는 조건" 표의 서버 가드 행 라벨을 캐비엇과 일치하도록 정정하며, `CHANGELOG.md` 에 이번 변경 항목을 추가한다(문서 위생, 저비용).
6. **[INFO/선택]** webhook 경계 캐너리(`hooks.service.spec.ts`) 추가로 "webhook 은 가드 밖" 설계 결정을 회귀로부터 보호.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security`, `performance`, `architecture`, `requirement`, `scope`, `side_effect`, `maintainability`, `testing`, `documentation`, `api_contract`, `user_guide_sync` (11명)
  - **제외**: 아래 표 (3명)
  - **강제 포함(router_safety)**: `documentation`, `maintainability`, `requirement`, `scope`, `security`, `side_effect`, `testing` — 전원 결과 확보됨(누락 없음)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | dependency | router 판단 — diff 에 신규/변경 의존성 패키지 없음 |
  | database | router 판단 — 스키마/쿼리 변경 없음, 순수 함수+예외 던지기만 추가 |
  | concurrency | router 판단 — 동시성 관련 코드 경로 변경 없음 |