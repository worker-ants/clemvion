# 부작용(Side Effect) 리뷰 — EIA §R17 마스킹 재제출 서버측 거부

## 발견사항

- **[INFO]** Manual 실행 공개 API 두 엔드포인트의 입력 수용 범위가 좁아진다 (의도된 변경, 범위 확인용 기록)
  - 위치: `codebase/backend/src/modules/executions/executions.service.ts:499` (`resolveTriggerParametersRejectingMasked` 호출, `reRun`), `codebase/backend/src/modules/workflows/workflows.controller.ts:317` (`execute`)
  - 상세: `resolveTriggerParameters` → `resolveTriggerParametersRejectingMasked` 로 스왑되면서, `POST /api/executions/:id/re-run` 과 `POST /workflows/:id/execute` 두 엔드포인트가 Manual 파라미터 값이 `***`/`[REDACTED]`/`[REDACTED_DEPTH]` 와 **정확히 일치**하면 이제 400 을 반환한다. 이 변경은 재제출 시나리오에만 국한되지 않는다 — CHANGELOG·spec(§R17)이 스스로 명시하듯 `execute` 엔드포인트는 재제출 전용 진입점이 아니라 Manual 실행 전체의 단일 진입점이라, curl 등으로 그 세 리터럴 문자열을 **의도적으로 새로 입력**해도 이제 거부된다(예약어화). 기존에는 통과하던 요청이 이 PR 이후 400 을 받는, 실제 공개 API 계약 변경이다.
  - 근거: 이 결과 자체는 기능 목적과 일치하고, CHANGELOG·`spec/5-system/14-external-interaction-api.md`(§R17 "알려진 제약")·`reject-masked-resubmission.ts` docstring 세 곳 모두에 명시적으로 문서화·수용된 트레이드오프다. 새로운 미문서화 부작용은 아니며, 두 호출부 모두 거부가 `executionEngineService.execute(...)` 호출 및 감사 로그 기록(`auditLogsService.record`) **이전**에 일어나므로 거부 시 부분 실행이나 잔여 audit 기록 같은 2차 부작용도 없음을 확인했다(`executions.service.ts` reRun 본문, `workflows.controller.ts` execute 본문 순서 직접 대조).
  - 제안: 없음 — 위험도 판단을 위한 기록. 이미 문서화·수용된 결정이므로 추가 조치 불필요.

- **[INFO]** re-run 400 응답의 필드명이 `errors` → `details` 로 바뀐다 (버그 수정이지만 응답 envelope 변경)
  - 위치: `codebase/backend/src/modules/executions/executions.service.ts:512` (`details: toTriggerParameterErrorDetails(err.errors)`)
  - 상세: 종전 `BadRequestException({ code, message, errors: err.errors })` 가 `details: toTriggerParameterErrorDetails(err.errors)` 로 교체됐다. diff 주석이 밝히듯 `GlobalExceptionFilter` 는 `details` 만 읽으므로 종전 `errors` 값은 응답 본문에 실린 적이 없었던 선존 버그이고, 이번 변경으로 `INVALID_INPUT` 400 응답에 처음으로 필드별 내역(`details[]`)이 실제로 실린다. 즉 이 엔드포인트가 반환하는 에러 응답의 **관측 가능한 shape 가 바뀐다**(자매 호출부 `workflows.controller.ts` 는 처음부터 `details` 였으므로 이제 둘이 일치).
  - 근거: `errors` 필드가 실제로는 한 번도 클라이언트에 도달하지 않았으므로(GlobalExceptionFilter 가 걸러냄), 기존 소비자가 `errors` 존재를 전제한 코드를 가질 가능성은 낮다. `details` 가 새로 채워지는 것도 이 엔드포인트의 다른 400 경로(스키마 검증 실패 등, 동일 `toTriggerParameterErrorDetails` 사용)와 이미 일치하던 형태라 추가 위험은 제한적.
  - 제안: 없음 — 의도된 버그 수정. 릴리스 노트에 "INVALID_INPUT 400 응답에 details[] 가 새로 채워진다" 를 한 줄 언급하면 외부 API 소비자(있다면)에게 도움이 될 수 있음(필수는 아님).

- **[INFO]** `sanitize-error-message.ts` 의 모듈-내부 전용이던 `isMaskedMarker`/`MASKED_MARKERS` 가 공개 export 로 승격
  - 위치: `codebase/backend/src/shared/utils/sanitize-error-message.ts:150`(`export const MASKED_MARKERS`), `:164`(`export function isMaskedMarker`)
  - 상세: 두 심볼 모두 이전에는 파일 내부에서만 쓰였으나 이번 diff로 `export` 가 붙어 모듈의 공개 표면이 넓어졌다. 신규 소비처는 `reject-masked-resubmission.ts` 한 곳뿐임을 확인(`grep` 결과 다른 프로덕션 소비처 없음). 순수 판정 함수/불변 상수(`Object.freeze`)라 공유 자체의 위험은 낮다.
  - 제안: 없음 — 의도된 승격이며 docstring 에 근거(마스킹 판정 로직 이원화로 인한 fail-open 재발 방지)가 명시돼 있음.

- **[INFO]** `tsconfig.build.json` 이 프로덕션 빌드 산출물에서 `src/repo-guards/**` 를 제외 — 프로덕션 소비처 부재를 실측으로 확인
  - 위치: `codebase/backend/tsconfig.build.json` (`exclude` 배열에 `"src/repo-guards/**"` 추가)
  - 상세: 신규 가드 파일(`masked-reject-callers-guard.ts`)이 devDependency 인 `typescript` 를 import 하면서, `*spec.ts` 패턴에 안 걸리는 `*-guard.ts` 가 그동안 `dist/` 에 포함되고 있었다는 문제를 이 exclude 로 막는다. `grep -rn "repo-guards" src --include="*.ts"` 로 `src/repo-guards/` 바깥에서 그 경로를 참조하는 프로덕션 코드가 없음을 직접 확인했다 — exclude 로 인해 런타임에 깨지는 참조는 없다.
  - 제안: 없음 — 확인 완료.

- **[INFO]** 테스트 전용 파일시스템 부작용 — 임시 디렉터리 생성/삭제, 스코프 확인됨
  - 위치: `codebase/backend/src/repo-guards/__tests__/masked-reject-callers.spec.ts` (`fs.mkdtempSync(path.join(os.tmpdir(), 'masked-guard-'))` ~ `fs.rmSync(tmp, { recursive: true, force: true })`)
  - 상세: `os.tmpdir()` 하위에 임시 디렉터리를 만들어 합성 위반 파일을 쓰고 가드 함수로 스캔한 뒤 `finally` 블록에서 `recursive: true, force: true` 로 확실히 정리한다. 저장소 밖 시스템 임시 영역만 건드리고 예외 시에도 정리되므로 부작용 범위가 적절히 통제됨.
  - 제안: 없음.

## 요약

핵심 변경(`resolveTriggerParametersRejectingMasked` 신설 + 두 Manual 실행 엔드포인트 스왑)은 순수 함수(`findMaskedResubmissions`/`hasMaskedLeaf`)로 구현돼 전역 상태·파일시스템·네트워크·환경변수를 건드리지 않는다. 두 호출부 모두 거부 예외가 `executionEngineService.execute` 및 감사 로그 기록보다 앞에 위치해, 거부 시 실행 트리거나 audit 기록 같은 잔여 부작용이 남지 않음을 소스 대조로 확인했다. 실질적인 "부작용"은 코드 레벨이 아니라 **공개 API 계약 레벨**에 있다 — Manual 실행 두 엔드포인트가 이제 마스킹 마커 세 문자열을 예약어로 거부하고, re-run 400 응답의 필드가 `errors`→`details` 로 바뀐다. 두 변경 모두 CHANGELOG·spec·코드 docstring에 명시적으로 문서화된 의도된 트레이드오프이며, 새로 발견된 미문서화 부작용은 없다. `sanitize-error-message.ts` 의 export 승격과 `tsconfig.build.json` exclude 도 grep 으로 직접 확인한 결과 다른 소비처를 깨뜨리지 않는다. repo-guard 테스트의 임시 파일 생성도 `finally` 로 안전하게 정리된다.

## 위험도

LOW
