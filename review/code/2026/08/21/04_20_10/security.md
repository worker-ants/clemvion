# 보안 리뷰 — `inputOverride`/`parameterValues` 마스킹 마커 재제출 서버측 거부 (EIA §R17)

## 검토 범위

실질 애플리케이션 코드 변경:
- `codebase/backend/src/modules/execution-engine/types/trigger-parameter.types.ts`
- `codebase/backend/src/modules/execution-engine/utils/reject-masked-resubmission.ts` (신규)
- `codebase/backend/src/modules/execution-engine/utils/reject-masked-resubmission.spec.ts` (신규)
- `codebase/backend/src/modules/executions/executions.service.ts`
- `codebase/backend/src/modules/executions/executions-rerun.service.spec.ts`
- `codebase/backend/src/modules/workflows/workflows.controller.ts`
- `codebase/backend/src/modules/workflows/workflows.controller.spec.ts`
- `codebase/backend/src/shared/utils/sanitize-error-message.ts` / `.spec.ts`
- `codebase/backend/src/repo-guards/__tests__/masked-reject-callers-guard.ts` (신규, AST 기반)
- `codebase/backend/src/repo-guards/__tests__/masked-reject-callers.spec.ts` (신규)
- `codebase/backend/tsconfig.build.json`

나머지 파일(CHANGELOG, `plan/**`, `spec/**`, `review/code/2026/08/21/{00_03_57,00_39_27,01_15_47,02_04_38,02_29_01,02_49_22,03_14_16}/**`, `review/consistency/**`)은 이전 8라운드 리뷰가 이미 검토·처분한 산출물이거나 배경 문서다. 이번 라운드는 그 이력을 대조 확인했고(아래), 애플리케이션 코드에 대해서는 실제 HEAD(`e9b942b08`)를 직접 읽어 독립적으로 재검증했다. 하드코딩 시크릿·인젝션 표면은 발견되지 않았다.

## 이력 검증 (증거 기반)

이전 라운드들이 CRITICAL 1건(`boolean` 마커 완전 우회, `00_03_57`)과 WARNING 다수(호출부 중복, `Object.freeze(Set)` 플라시보, AST 우회 가드 4종)를 제기했고, 각 RESOLUTION 이 조치를 주장했다. 실코드 대조로 확인한 결과:

- **boolean 우회 (전 CRITICAL)**: `reject-masked-resubmission.ts:resolveTriggerParametersRejectingMasked` 가 raw 를 coerce **이전에** 먼저 검사(`findMaskedResubmissions(schema, rawSource, rawSource)`)하고, raw 에서 걸리면 즉시 `throwIfAny` 로 종료 후 resolve 를 시도하지 않는다. `Boolean('***') → true` 경로에 도달하기 전에 차단됨을 코드로 확인 — 해소.
- **`Object.freeze(Set)` 플라시보 (전 WARNING)**: `sanitize-error-message.ts:150`, `MASKED_MARKERS` 가 `ReadonlySet<string> = new Set(...)` 대신 `readonly string[] = Object.freeze([...])` 로 교체됐다. `Set` 인스턴스는 freeze 로 내부 슬롯을 보호받지 못해 `.add()` 가 그대로 성공하지만, `Object.freeze` 된 배열은 `.push` 가 strict mode 에서 `TypeError` 를 던진다 — 실제 런타임 불변성 확보. 캐너리(`sanitize-error-message.spec.ts` "MASKED_MARKERS 불변성")가 이 보장을 기계로 고정. `isMaskedMarker` 도 `MASKED_MARKERS.includes(v)` 로 동반 수정됨 — 해소.
- **AST 가드 우회 4형태(namespace/require/dynamic-import/bracket/colon-rename) (전 WARNING)**: `masked-reject-callers-guard.ts` 가 정규식에서 `typescript` AST 파서 기반으로 전면 재작성됐다. 식별자 위치의 `BASE_FN` 매칭 + element-access 문자열 인자 매칭 두 규칙으로 수렴했고, `masked-reject-callers.spec.ts` 가 7가지 우회 형태(named/as-rename/namespace/require/dynamic-import/bracket/colon-rename)를 `it.each` 캐너리로 개별 고정 — 해소.
- **devDependency `typescript` 가 프로덕션 dist 로 유출될 뻔한 파생 결함**: AST 가드가 `typescript`(devDependency)를 import 하는데 `tsconfig.build.json` 의 종전 exclude 패턴(`**/*spec.ts`)이 `*-guard.ts` 를 걸러내지 못해 `dist/repo-guards/**` 가 이미 빌드에 포함되고 있었다(선존, 이번 PR 기인 아님). `src/repo-guards/**` 를 exclude 에 추가해 차단 — 프로덕션 설치(devDependency 없음)에서 `require("typescript")` 런타임 실패 지뢰를 제거. 보안 취약점이라기보다 배포 견고성 이슈였고 적절히 닫혔다.
- **`errors` → `details` 봉투 배선 선존 버그**: `GlobalExceptionFilter`(`http-exception.filter.ts:73`)가 `resp.details`/`nested?.details` 만 읽고 `errors` 키는 읽지 않는다는 것을 직접 확인. 종전 `executions.service.ts` 의 `errors: err.errors` 는 응답에 실리지 않고 조용히 버려지고 있었다. `details: toTriggerParameterErrorDetails(err.errors)` 로 교정 — `toTriggerParameterErrorDetails` 는 `field`(스키마 정의 파라미터명)·고정 `code`·고정 `message` 만 반환하고 제출된 실제 값(마스킹 마커든 원문이든)은 어디에도 echo 되지 않아, 이 교정 자체가 새로운 정보 노출을 만들지 않는다.

## 발견사항

발견된 CRITICAL/WARNING 없음.

- **[INFO]** `findMaskedResubmissions`/`hasMaskedLeaf`(`reject-masked-resubmission.ts`)의 재귀는 `MAX_REDACT_DEPTH`(10)로 깊이만 제한하고 폭(객체 key 수·배열 길이)은 제한하지 않는다. 다만 방문 노드 수는 파싱된 JSON 트리 전체 노드 수(≈ 요청 본문 크기)를 넘지 않는 순수 `O(n)`이라 별도 지수적 증폭이 없고, 기존 `deepRedactCore`/`sanitizePayloadForWs`(같은 `MAX_REDACT_DEPTH` 상수 재사용)와 동일한 위험 프로파일이다. 입력은 이미 파싱된 JSON 값이라 순환 참조도 발생하지 않는다. 조치 불요.
  - 위치: `codebase/backend/src/modules/execution-engine/utils/reject-masked-resubmission.ts` `hasMaskedLeaf`
- **[INFO]** `TriggerParameterValidationException.message`(`trigger-parameter.types.ts:83-94`)는 `field(reason)` 형태의 분류 문자열만 담고, 제출된 실제 값은 포함하지 않는다 — 이 메시지가 로그나 예외 체인 어딘가로 흘러도 값 노출 경로가 없음을 확인.
  - 위치: `codebase/backend/src/modules/execution-engine/types/trigger-parameter.types.ts` `TriggerParameterValidationException`
- **[INFO]** re-run(`executions.service.ts`) 경로의 인가 체크(RR-PL-06, 타인의 실행은 워크스페이스 owner/admin 만)와 execute(`workflows.controller.ts`) 경로의 워크스페이스 스코프 체크(`findById(id, workspaceId)`)는 모두 신규 마스킹 거부 로직보다 **먼저** 수행되며 이번 변경으로 순서나 조건이 바뀌지 않았다 — 인가 우회 없음을 확인.
  - 위치: `codebase/backend/src/modules/executions/executions.service.ts`(RR-PL-06 블록), `codebase/backend/src/modules/workflows/workflows.controller.ts`(`execute` 상단 `findById` 호출)
- **[INFO]** `findMaskedResubmissions`(`reject-masked-resubmission.ts:124`)는 `Object.prototype.hasOwnProperty.call(rawSource, def.name)` 로 스키마 필드 존재를 확인하고, leaf 순회는 `Object.values`(키 순회 아님)를 쓴다 — `__proto__`/상속 프로퍼티 경유 프로토타입 오염 표면이 새로 생기지 않는다.
  - 위치: `codebase/backend/src/modules/execution-engine/utils/reject-masked-resubmission.ts` `findMaskedResubmissions`/`hasMaskedLeaf`

## 요약

이번 diff(HEAD `e9b942b08`)는 Manual 트리거 파라미터 재제출 경로(re-run `inputOverride`, execute `parameterValues`)에서 egress 마스킹 마커가 실제 값으로 그대로 되돌아오는 것을 서버측 2차 방어층으로 차단하는 보안 강화 변경이며, 8라운드에 걸친 리뷰 이력(CRITICAL 1건·WARNING 다수)이 실제로 해소됐음을 코드 직접 대조로 확인했다: boolean 완전 우회는 raw-우선 검사 순서로 닫혔고, `Set` freeze 플라시보는 `readonly string[] + Object.freeze` 로 실제 런타임 불변성을 얻었으며, 우회 가능한 정규식 기반 repo-guard는 AST 파서 기반으로 재작성돼 7종 우회 형태가 캐너리로 고정됐다. 인가 체크는 신규 로직보다 선행하며 순서 변경이 없고, 에러 응답은 `field`/고정 `code`/고정 `message` 만 반환해 제출값을 echo 하지 않는다. 인젝션·하드코딩 시크릿·인증/인가 우회·안전하지 않은 암호화 관련 문제는 발견되지 않았고, 재귀 기반 판정 로직의 DoS 프로파일도 기존 패턴과 동일해 신규 증폭 벡터가 없다.

## 위험도

NONE
