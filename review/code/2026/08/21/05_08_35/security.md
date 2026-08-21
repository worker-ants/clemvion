# 보안 리뷰 — 마스킹 마커 재제출 서버측 거부 (EIA §R17) + 부산물 저장소 전역 가드 2건

## 검토 범위

실제 코드 변경(파일 1~16 중 애플리케이션/가드 코드):
- `codebase/backend/src/modules/execution-engine/types/trigger-parameter.types.ts`
- `codebase/backend/src/modules/execution-engine/utils/reject-masked-resubmission.ts` (신규, 핵심 로직) + spec
- `codebase/backend/src/modules/execution-engine/utils/resolve-trigger-parameters.spec.ts`
- `codebase/backend/src/modules/executions/executions.service.ts` (`reRun`) + `executions-rerun.service.spec.ts`
- `codebase/backend/src/modules/workflows/workflows.controller.ts` (`execute`) + spec
- `codebase/backend/src/repo-guards/__tests__/masked-reject-callers-guard.ts`/`.spec.ts` (신규, CI 전용)
- `codebase/backend/src/repo-guards/__tests__/production-build-devdep-guard.ts`/`.spec.ts` (신규, CI 전용)
- `codebase/backend/src/shared/utils/sanitize-error-message.ts`(`MASKED_MARKERS`/`isMaskedMarker` export 승격) + spec
- `codebase/backend/tsconfig.build.json`

나머지(CHANGELOG.md, `plan/**`, `review/**` 하위 이전 라운드 산출물, `spec/**`)는 이번 diff 에서
문서/기록 변경이며 애플리케이션 코드가 아니다. `reject-masked-resubmission.ts` 전문·
`trigger-parameter.types.ts` 전문·`to-record.ts`·`masked-reject-callers-guard.ts`·
`production-build-devdep-guard.ts`·`executions.service.ts` auth 경로(`reRun` 워크스페이스
소유권/RBAC 체크, `isOwnerOrAdmin`)를 직접 열어 대조했다. 이 브랜치는 이미 9라운드 보안 리뷰를
거쳤고(`00_03_57`~`04_46_40`, CRITICAL 1건→0으로 수렴 후 8라운드 연속 CRITICAL/WARNING 0), 이번
라운드는 그 CRITICAL 이 해소된 상태의 핵심 로직을 독립적으로 재확인했다.

## 발견사항

발견된 CRITICAL/WARNING 없음.

- **[INFO]** `hasMaskedLeaf` 재귀는 깊이만 `MAX_REDACT_DEPTH`(10)로 제한하고 폭(객체 key 수·배열
  길이)은 제한하지 않는다. 다만 방문 노드 수는 파싱된 JSON 트리의 전체 노드 수를 넘지 않아
  `O(n)`(n = 요청 본문 크기에 비례)이고, 요청 본문 자체가 `hooks-body-parser.ts` 의
  `json({ limit: maxBytes })` 로 상한이 걸려 있어(초과 시 413 → `PAYLOAD_TOO_LARGE`) 별도 DoS
  증폭 벡터가 아니다. 기존 `deepRedactCore` 와 동일한 위험 프로파일이며 이번 PR 이 새로 만든
  표면이 아니다.
  - 위치: `codebase/backend/src/modules/execution-engine/utils/reject-masked-resubmission.ts` `hasMaskedLeaf`
- **[INFO]** 에러 응답(`TriggerParameterErrorDetail`, `TriggerParameterValidationException.message`
  포함)에는 `field`(스키마 정의 파라미터명)·고정 `code`·고정 `message` 만 실리고, 실제 제출값
  (마스킹 마커든 원문이든)은 어디에도 echo 되지 않는다. `Exception` 생성자의 내부 `message`
  문자열도 `field(reason)` 조합만 담아 값을 포함하지 않는다 — 정보 노출 없음을 재확인.
  - 위치: `codebase/backend/src/modules/execution-engine/types/trigger-parameter.types.ts`
    `TriggerParameterValidationException`, `REASON_TO_DETAIL`
- **[INFO]** 값 검사(`isMaskedMarker`) 순서가 깊이 검사보다 먼저 실행되어(`hasMaskedLeaf` 첫
  줄), `MAX_REDACT_DEPTH` 경계 지점에 놓인 치환 마커를 놓치지 않는 off-by-one 회피가 실제
  코드로 확인된다 — 이전 CRITICAL(`00_03_57`, resolve 후 검사만 해 `Boolean('***')→true` 로
  boolean 파라미터가 완전 우회되던 결함)의 근본 원인이 raw-우선 2단계 검사(①raw → ②resolve
  후 재검사)로 해소된 상태를 재확인.
  - 위치: `reject-masked-resubmission.ts` `resolveTriggerParametersRejectingMasked`, `hasMaskedLeaf`
- **[INFO]** `MASKED_MARKERS` 를 `ReadonlySet`(런타임 불변성 없음 — `Object.freeze(new Set(...))`
  는 `.add()` 를 막지 못함, `Set` 데이터가 own property 가 아니라 내부 슬롯이기 때문)에서
  `readonly string[]` + `Object.freeze([...])` 로 교체해 실제 런타임 불변성을 확보했고, 이
  마커 집합은 egress 마스킹(`isMaskedMarker`)과 재제출 거부(`findMaskedResubmissions`) 두
  판정기가 공유한다 — 한쪽이 변형되면 둘 다 오염되는 구조라 이 불변성 보강이 실질적이다.
  캐너리 테스트(`sanitize-error-message.spec.ts` "MASKED_MARKERS 불변성")로 `push` 시도가
  `TypeError` 를 던지는지 직접 단언되어 있음을 확인.
  - 위치: `codebase/backend/src/shared/utils/sanitize-error-message.ts` `MASKED_MARKERS`,
    `isMaskedMarker`
- **[INFO]** 신규 repo-guard 2종(`masked-reject-callers-guard.ts`, `production-build-devdep-guard.ts`)
  은 CI 정적분석 전용이며 런타임 공격 표면이 아니다 — `fs.readFileSync`/`ts.createSourceFile`
  로 저장소 자신의 소스만 읽고, 외부 입력·`exec`/`spawn`·동적 코드 실행이 없다. `require`/동적
  `import` 인자 파싱도 문자열 리터럴만 추출할 뿐 실행하지 않는다.
  - 위치: `codebase/backend/src/repo-guards/__tests__/masked-reject-callers-guard.ts`,
    `production-build-devdep-guard.ts`
- **[INFO]** `executions.service.ts::reRun`/`workflows.controller.ts::execute` 두 진입점 모두
  이번 diff 가 건드린 것은 `resolveTriggerParameters` → `resolveTriggerParametersRejectingMasked`
  치환과 에러 catch 블록뿐이다. 워크스페이스 소유권 검증(`original.workflow?.workspaceId !==
  workspaceId`)·RBAC(`isOwnerOrAdmin`)·`@Roles('editor')` 등 기존 인증/인가 경로는 diff 범위
  밖이며 변경되지 않았다 — 이번 변경이 인가 우회를 만들지 않음을 확인.
  - 위치: `codebase/backend/src/modules/executions/executions.service.ts` `reRun`
- **[INFO]** re-run 경로의 선존 결함(`errors: err.errors` 로 던져 `GlobalExceptionFilter` 가
  `details` 만 읽으므로 필드별 내역이 조용히 버려지던 문제)이 `details:
  toTriggerParameterErrorDetails(err.errors)` 로 교정됐다. 노출되는 값은 분류 정보(`field`/
  고정 `code`/고정 `message`)뿐이라 이 교정 자체가 새로운 정보 노출을 만들지 않는다.
  - 위치: `codebase/backend/src/modules/executions/executions.service.ts` (reRun catch 블록)

## 요약

이번 diff 는 Manual 트리거 파라미터 재제출 경로(re-run `inputOverride`, execute
`parameterValues`)에서 egress 마스킹 마커(`***`/`[REDACTED]`/`[REDACTED_DEPTH]`)가 실제 값으로
그대로 되돌아오는 것을 서버측 2차 방어층(`resolveTriggerParametersRejectingMasked`)으로 차단하는
보안 강화 변경이다. 핵심 로직을 직접 열어 대조한 결과, 이전 라운드에서 지적된 CRITICAL(boolean
타입 완전 우회)은 raw-우선 2단계 검사 순서로 근본 해소됐고, 정확 일치 판정·깊이 상한·값→깊이
검사 순서 등 경계 조건이 코드와 테스트 양쪽에서 확인된다. 에러 응답은 필드명·고정 코드·고정
메시지만 반환해 실제 제출 값을 echo 하지 않으므로 정보 노출 위험이 없고, 인증/인가 경로는 이번
변경의 영향을 받지 않는다. 신규 저장소 전역 CI 가드 2종은 순수 정적분석이라 런타임 공격 표면을
추가하지 않는다. 인젝션(SQL/XSS/커맨드/경로탐색)·하드코딩 시크릿·안전하지 않은 암호화 관련
문제는 발견되지 않았다.

## 위험도

NONE
