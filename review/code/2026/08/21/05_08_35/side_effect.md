# 부작용(Side Effect) 리뷰 — EIA §R17 마스킹 재제출 서버측 거부

## 발견사항

- **[WARNING]** Manual 실행 두 엔드포인트가 리터럴 마스크 마커 값을 이제 거부한다 — 기존 API 소비자에게는 breaking 동작 변경
  - 위치: `codebase/backend/src/modules/execution-engine/utils/reject-masked-resubmission.ts` (`resolveTriggerParametersRejectingMasked`, 56행 근처), 호출부 `codebase/backend/src/modules/executions/executions.service.ts`(`reRun` 내 `resolveTriggerParametersRejectingMasked(...)` 호출, 496-503행), `codebase/backend/src/modules/workflows/workflows.controller.ts`(`execute` 내 314행)
  - 상세: `POST /workflows/:id/execute` 와 `POST /executions/:id/rerun`(`useOriginalInput=false`) 은 이제 Manual 트리거 파라미터 값이 `'***'` / `'[REDACTED]'` / `'[REDACTED_DEPTH]'` 와 **정확히 일치**하면 400(`MASKED_VALUE_RESUBMITTED`)으로 거부한다. `workflows.controller.spec.ts` 의 신규 캐너리("legacy input.parameters 경로의 마커도 거부한다")가 확인하듯, 이 거부는 재제출 경로뿐 아니라 **직접 타이핑·legacy `input.parameters` 경로를 포함한 Manual 실행 전체**에 적용된다. 즉 과거에 그 문자열들을 실제 파라미터 값으로 정상 사용하던 워크플로/외부 API 클라이언트(curl 등, UI 를 거치지 않는 소비자)가 있었다면 그 요청은 이 변경 이후 400 을 받는다. 이는 CHANGELOG·spec·PR 본문에서 반복적으로 논의되고 라운드 다수를 거쳐 의도적으로 결정된 트레이드오프이며 정확 일치(부분 포함은 통과)로 영향 범위를 좁혔지만, "부작용" 관점에서는 여전히 **기존 공개 API 호출자에게 영향을 주는 인터페이스/동작 변경**이다. 별도 API 버전닝이나 사전 공지(deprecation window) 없이 즉시 적용된다.
  - 제안: 의도된 변경이므로 되돌릴 필요는 없으나, 외부(저장소 밖) API 소비자가 존재한다면 릴리스 노트에 breaking behavior 로 명시하는 것을 고려. (참고: 같은 PR 안에서 `Execution.inputData` 응답 의미 반전 건은 "외부 소비자 없음"을 사용자에게 직접 확인받아 `plan/in-progress/spec-sync-external-interaction-api-gaps.md` 에 근거를 남겼는데, 이번 마커 거부 자체에 대해서는 동일한 외부-소비자 확인 기록이 diff 안에서 보이지 않는다.)

- **[INFO]** `reRun` 400 응답 봉투에 `details[]` 필드가 새로 채워진다 (기존 `errors` 키는 조용히 버려지고 있었음)
  - 위치: `codebase/backend/src/modules/executions/executions.service.ts` — `reRun` 의 `catch (err)` 블록, `BadRequestException` 생성부(505-513행 부근)
  - 상세: 종전에는 `throw new BadRequestException({ code, message, errors: err.errors })` 형태였는데, `GlobalExceptionFilter`(`codebase/backend/src/common/filters/http-exception.filter.ts:73`)는 `resp.details` 만 읽으므로 `errors` 필드는 응답 바디에 실제로 실린 적이 없었다(선존 버그). 이번 변경으로 같은 위치가 `details: toTriggerParameterErrorDetails(err.errors)` 를 실어, `missing_required`/`coerce_failed`/`invalid_schema` 등 **기존 사유들도 포함해** 이제 처음으로 `error.details[]` 가 응답에 나타난다. 클라이언트 입장에서는 필드 추가(additive)라 하위 호환은 유지되지만, "이 엔드포인트의 400 응답에는 details 가 없다"고 가정한 코드가 있었다면(가능성은 낮음) 그 가정이 깨진다.
  - 제안: 의도된 수정이며 자매 호출부(`workflows.controller.ts`)와 형태를 맞췄으므로 추가 조치 불필요. 릴리스 노트에 "reRun 400 응답에 필드별 details 가 추가됨"을 한 줄 언급하면 충분.

- **[INFO]** `sanitize-error-message.ts` 의 `MASKED_MARKERS`/`isMaskedMarker` 가 module-private → export 로 승격
  - 위치: `codebase/backend/src/shared/utils/sanitize-error-message.ts` (150행 `export const MASKED_MARKERS`, 164행 `export function isMaskedMarker`)
  - 상세: 새 공개 API 표면이 생겼지만 실측 결과 새 소비처는 `reject-masked-resubmission.ts` 한 곳뿐이고(`grep` 확인), 자료구조도 `ReadonlySet`→`readonly string[]`(+`Object.freeze`)로 바뀌었으나 내부 유일한 소비 코드(`isMaskedMarker`)도 `.has()`→`.includes()` 로 함께 갱신되어 있어 불일치가 없다. `Set` 은 `Object.freeze` 로 `.add()` 를 막지 못한다는 점(내부 슬롯)을 문서화하고 실제로 배열+freeze 로 전환해 런타임 불변성을 확보한 점도 확인(캐너리 테스트로 고정).
  - 제안: 없음 — 안전하게 처리됨.

- **[INFO]** `tsconfig.build.json` 변경으로 `dist` 산출물 구성이 바뀐다 (`src/repo-guards/**` 제외)
  - 위치: `codebase/backend/tsconfig.build.json` (7-17행, `exclude` 배열)
  - 상세: 빌드 제외 목록에 `src/repo-guards/**` 가 추가되어 프로덕션 `dist` 에서 해당 디렉터리가 더는 나가지 않는다. `grep -rn "repo-guards"` 로 런타임 참조를 확인한 결과 `__tests__` 자기 자신 외 소비처가 없어(모두 `*.spec.ts`/가드 파일 상호 참조) 이 제외가 다른 기능을 깨뜨릴 가능성은 없음을 확인했다. devDependency(`typescript`)가 프로덕션 `dist`(`require("typescript")`)로 새는 선존 결함을 막는 의도된 부작용.
  - 제안: 없음 — 신규 가드 테스트(`production-build-devdep.spec.ts`)가 이 불변식을 합성 fixture 로 지속 검증하므로 회귀 시 CI 에서 잡힌다.

- **[INFO]** 신규 repo-guard 캐너리 테스트가 `fs.mkdtempSync(os.tmpdir())` 로 임시 디렉터리에 파일을 쓴다
  - 위치: `codebase/backend/src/repo-guards/__tests__/masked-reject-callers-guard.ts` 를 소비하는 spec(`masked-reject-callers.spec.ts`)의 "[캐너리] 허용목록 밖 위반을 실제로 탐지한다" 테스트, `production-build-devdep-guard.ts` 를 소비하는 spec(`production-build-devdep.spec.ts`)의 "[캐너리] 실제 누출을 지목한다" 테스트
  - 상세: 두 테스트 모두 `fs.mkdtempSync(path.join(os.tmpdir(), '...'))` 로 저장소 밖 OS 임시 디렉터리에 fixture 파일을 생성하고, `try { ... } finally { fs.rmSync(tmp, { recursive: true, force: true }); }` 로 정리한다. 저장소 파일시스템(`codebase/**`)에는 쓰기가 없고, 임시 디렉터리도 테스트 종료 시 항상 삭제되므로 실질적인 부작용은 없다.
  - 제안: 없음 — 격리·정리가 올바르게 되어 있음.

- **[INFO]** `TriggerParameterValidationError.reason` / `TriggerParameterErrorDetail.code` 유니온 타입에 신규 멤버 추가 (`masked_value_resubmitted` / `MASKED_VALUE_RESUBMITTED`)
  - 위치: `codebase/backend/src/modules/execution-engine/types/trigger-parameter.types.ts` (11-18행, 26-34행)
  - 상세: 기존 함수 시그니처는 그대로이고 유니온 타입에 값만 추가되는 하위 호환적(additive) 변경이다. `grep -rln "MISSING_REQUIRED_FIELD\|TYPE_COERCION_FAILED\|INVALID_SCHEMA" codebase/frontend/src` 결과 0건 — 프런트가 이 코드값에 대해 exhaustive switch 를 하지 않으므로(메시지를 그대로 표시하는 방식으로 추정) 신규 코드 추가로 인한 프런트 측 미처리 분기 문제는 없다.
  - 제안: 없음.

## 요약

핵심 변경(`resolveTriggerParametersRejectingMasked` 신설 및 두 호출부 교체)은 순수 함수 조합이고 전역 상태·환경변수·네트워크 호출·이벤트/콜백을 건드리지 않는다. 파일시스템 부작용은 신규 repo-guard 테스트들의 OS 임시 디렉터리 사용뿐이며 전부 `try/finally` 로 정리되어 저장소에는 흔적이 남지 않는다. `MASKED_MARKERS`/`isMaskedMarker` export 승격과 `TriggerParameterErrorDetail.code` 유니온 확장은 하위 호환 additive 변경으로 확인됐고, `tsconfig.build.json` 의 `repo-guards` 제외는 실측(프로덕션 소비처 0건)으로 뒷받침된 안전한 빌드 산출물 변경이다. 가장 주목할 부작용은 두 Manual 실행 엔드포인트가 마스크 마커 리터럴 값을 더는 통과시키지 않는다는 점과, `reRun` 400 응답에 `details[]` 필드가 처음으로 실린다는 점인데, 둘 다 이 PR 이 여러 리뷰 라운드를 거쳐 의도적으로 결정·문서화한 변경이며 코드 자체에 부수적·의도치 않은 상태 변경은 없다.

## 위험도

LOW
