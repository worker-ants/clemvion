STATUS=success ISSUES=3
===REPORT_MARKDOWN_BELOW===
# 부작용(Side Effect) 리뷰 — EIA §R17 마스킹 재제출 서버측 거부 (`02_49_22`)

## 검토 범위

실제 프로덕션/테스트 코드 변경(`git diff --stat` 확인, 12파일 +987/-11):

- `codebase/backend/src/modules/execution-engine/types/trigger-parameter.types.ts`
- `codebase/backend/src/modules/execution-engine/utils/reject-masked-resubmission.ts` (신규)
- `codebase/backend/src/modules/execution-engine/utils/reject-masked-resubmission.spec.ts` (신규)
- `codebase/backend/src/modules/execution-engine/utils/resolve-trigger-parameters.spec.ts`
- `codebase/backend/src/modules/executions/executions-rerun.service.spec.ts`
- `codebase/backend/src/modules/executions/executions.service.ts`
- `codebase/backend/src/modules/workflows/workflows.controller.spec.ts`
- `codebase/backend/src/modules/workflows/workflows.controller.ts`
- `codebase/backend/src/repo-guards/__tests__/masked-reject-callers-guard.ts` (신규)
- `codebase/backend/src/repo-guards/__tests__/masked-reject-callers.spec.ts` (신규)
- `codebase/backend/src/shared/utils/sanitize-error-message.spec.ts`
- `codebase/backend/src/shared/utils/sanitize-error-message.ts`

나머지(CHANGELOG, `plan/**`, `review/code/2026/08/21/{00_03_57,00_39_27,01_15_47,01_38_26,02_04_38,02_29_01}/**`,
`review/consistency/**`, `spec/**`)는 이번 diff 에 그대로 실린 이전 라운드 산출물·spec 문서로, 실행 코드가
아니므로 부작용 관점 대상에서 제외했다. 각 실코드 파일은 저장소에서 현재 최종본을 직접 읽어(git diff 요약이
아니라) 확인했다.

## 발견사항

- **[INFO]** 두 공개 엔드포인트(`POST /workflows/:id/execute`, `POST /executions/:id/re-run`)의 요청 유효값
  집합이 좁아지는 인터페이스 동작 변경 — 이전엔 마스킹 마커 세 문자열(`'***'`/`'[REDACTED]'`/
  `'[REDACTED_DEPTH]'`)과 정확히 일치하는 값도 정상 입력으로 수락됐으나, 이제 400
  (`MASKED_VALUE_RESUBMITTED`)으로 거부된다.
  - 위치: `codebase/backend/src/modules/execution-engine/utils/reject-masked-resubmission.ts`
    함수 `resolveTriggerParametersRejectingMasked` (56~75행) — 호출부는
    `codebase/backend/src/modules/executions/executions.service.ts:499`,
    `codebase/backend/src/modules/workflows/workflows.controller.ts:317`
  - 상세: 시그니처(`(schema, rawSource) => Record<string, unknown>`)는 기존 `resolveTriggerParameters`
    와 동일해 drop-in 교체지만, 값 도메인이 축소되는 breaking 변경이다. 저장소 밖 소비자(QA/운영
    자동화 등) 존재 여부는 `plan/in-progress/spec-sync-external-interaction-api-gaps.md`(저장소 소유자
    확인, "없음")로 이미 확인됐고, spec(`5-system/14-external-interaction-api.md`)에도 문서화됐다.
    코드 자체의 결함은 아니고 의도된 보안 하드닝이나, "부작용" 관점에서는 기존 통합 테스트/외부
    클라이언트가 리터럴 `'***'` 를 유효값으로 쓰고 있었다면 그 경로가 깨진다는 사실은 등재해 둔다.
  - 제안: 조치 불요(이미 확인·문서화 완료). 참고 등재만.

- **[INFO]** `POST /executions/:id/re-run` 400 응답 봉투에 처음으로 `details[]` 가 채워짐 — 종전엔
  `errors` 키로 던져 `GlobalExceptionFilter` 가 조용히 버리고 있었다
  - 위치: `codebase/backend/src/modules/executions/executions.service.ts:512`
    (`details: toTriggerParameterErrorDetails(err.errors)`) — 필터 근거는
    `codebase/backend/src/common/filters/http-exception.filter.ts:73`
    (`details = resp.details ?? nested?.details;`, `resp.errors` 는 어디서도 읽지 않음, 직접 확인)
  - 상세: 변경 전은 `throw new BadRequestException({ code, message, errors: err.errors })` 였는데
    필터가 `errors` 키를 전혀 읽지 않아 필드별 내역이 응답 바디에 실린 적이 없었다(선존 버그). 이번
    변경으로 그 필드가 처음 채워지므로, `error.details` 부재를 전제로 파싱하던 기존 소비자가 있었다면
    응답 바디 형태가 넓어진다(필드 추가, 기존 필드 제거 아님 — 하위호환 방향). 자매 호출부
    (`workflows.controller.ts`)는 이미 이 형태였으므로 두 진입점이 동일해진다.
  - 제안: 조치 불요. 응답 바디에 필드가 **추가**되는 방향이라 기존 클라이언트를 깨뜨릴 가능성은
    낮지만, 봉투 형태 변경이라는 사실 자체는 기록해 둔다.

- **[INFO]** `masked-reject-callers.spec.ts` 의 합성 fixture 테스트가 `os.tmpdir()` 하위에 임시 디렉터리를
  만들고 파일을 쓴다 — 정상적으로 `finally` 에서 정리됨을 확인
  - 위치: `codebase/backend/src/repo-guards/__tests__/masked-reject-callers.spec.ts:61-84`
    (`fs.mkdtempSync` → `fs.writeFileSync` ×2 → `finally { fs.rmSync(tmp, { recursive: true, force: true }) }`)
  - 상세: 저장소 트리 밖(`os.tmpdir()`)에만 쓰고, `try/finally` 로 테스트 성공·실패 양쪽 경로 모두
    정리한다. 저장소 코드/설정 파일을 건드리지 않으며 다른 병렬 테스트와 경로가 충돌할 여지도 없다
    (mkdtemp 가 고유 디렉터리를 만든다). 부작용 관점에서 문제 없음 — 등재만.
  - 제안: 조치 불요.

## 그 외 확인한 항목 (발견사항 아님)

- `sanitize-error-message.ts` 의 `MASKED_MARKERS`(`ReadonlySet` → `readonly string[]` + `Object.freeze`)와
  `isMaskedMarker`(`.has()` → `.includes()`) 전환: 변경 전 `MASKED_MARKERS` 는 export 되지 않았으므로
  (`grep` 확인, 정의 파일 밖에서 참조하는 곳 0건) 기존 소비자에 대한 시그니처/인터페이스 파손은 없다.
  export 승격은 순수 가시성 확장이고, 두 함수형 API(`isMaskedMarker(v)`)는 동일 동작을 유지한다.
- `resolveTriggerParametersRejectingMasked`/`findMaskedResubmissions`/`hasMaskedLeaf` 는 모두 인자를
  변형하지 않는 순수 함수다(`Object.values()`/`.some()`/`.map()`/`.filter()` 만 사용, in-place mutation
  없음). 전역 변수 신규 도입·기존 전역 변수 변경 없음. 네트워크·환경변수·파일시스템 접근 없음
  (`masked-reject-callers-guard.ts`/`.spec.ts` 는 CI/테스트 전용 정적 스캐너로, 프로덕션 런타임 경로가
  아니다).
- `trigger-parameter.types.ts` 의 `reason`/`code` 유니언에 값 1개 추가는 열린 방향 확장이다. 이 파일
  안에서 두 유니언을 소비하는 곳(`REASON_TO_DETAIL` 매핑, `TriggerParameterValidationException`)은
  모두 diff 에 포함돼 갱신됐고, 저장소 안에 이 유니언에 대해 exhaustive switch(미갱신 시 컴파일 에러
  없이 런타임 누락이 나는 패턴)를 도는 다른 소비처는 없음을 확인했다(`grep -rn "reason ===" `/`case '...'`
  형태 없음).
- `webhook`/`schedule` 경로(`hooks.service.ts`, `schedule-runner.service.ts`)는 계속 base
  `resolveTriggerParameters` 를 직접 호출하며 이번 변경의 영향을 받지 않는다(의도된 스코프 경계,
  `masked-reject-callers-guard.ts` 허용목록으로 고정됨) — 이 경로의 동작은 diff 전후 동일하다.

## 요약

핵심 진입점 두 곳(`executions.service.ts` re-run / `workflows.controller.ts` execute)이 기존
`resolveTriggerParameters` 호출을 시그니처 동일한 래퍼 `resolveTriggerParametersRejectingMasked` 로
치환한 방식은 drop-in 이고, 신설 헬퍼(`reject-masked-resubmission.ts`)는 순수 함수라 예상 밖의 상태
변경·전역 변수·파일시스템/네트워크/환경변수 부작용이 없다. `sanitize-error-message.ts` 의 상수·함수
export 승격은 기존 소비자가 없어 파손 없는 순수 확장이다. 남는 두 항목 — (a) 두 엔드포인트의 유효값
집합이 마커 세 문자열만큼 좁아지는 인터페이스 변경, (b) re-run 400 응답 봉투에 `details[]` 가 처음
채워지는 변경 — 은 둘 다 문서화·근거 확인이 끝난 **의도된** 동작 변경이며, 코드(`GlobalExceptionFilter`
실제 구현, 저장소 밖 소비자 부재 확인)로 재검증했다. 새로 추가된 repo-guard 테스트의 임시 디렉터리
생성은 `os.tmpdir()` 안에서만 이뤄지고 `finally` 로 확실히 정리된다. 신규 CRITICAL/WARNING 없음.

## 위험도

LOW
