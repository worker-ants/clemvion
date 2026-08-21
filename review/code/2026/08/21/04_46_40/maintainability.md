# 유지보수성(Maintainability) 리뷰 — EIA §R17 마스킹 재제출 서버측 거부

## 검토 범위

실질 애플리케이션 코드 변경 8개 파일(`codebase/backend/src/modules/execution-engine/types/trigger-parameter.types.ts`,
`.../utils/reject-masked-resubmission.ts`(신규)/`.spec.ts`(신규), `.../utils/resolve-trigger-parameters.spec.ts`,
`.../modules/executions/executions.service.ts`/`executions-rerun.service.spec.ts`,
`.../modules/workflows/workflows.controller.ts`/`.spec.ts`, `.../shared/utils/sanitize-error-message.ts`/`.spec.ts`)와
신규 repo-guard 2쌍(`masked-reject-callers-guard.ts`+spec, `production-build-devdep-guard.ts`+spec),
`tsconfig.build.json`. `CHANGELOG.md`·`plan/**`·`spec/**`는 문서로 간주해 코드 관점 재검토는 하지 않았다.

`review/code/**` 하위 71개 파일(과거 리뷰 라운드 산출물이 이번 커밋에 함께 실린 것)은 이 프로젝트의
표준 워크플로 부산물이며 애플리케이션 코드가 아니므로 이번 유지보수성 관점의 대상에서 제외했다 —
각 라운드가 이미 자기 자신을 다뤘고, 이 diff 가 그 문서들의 코드 품질에 영향을 주지 않는다.

모든 핵심 소스는 diff 뿐 아니라 `Read` 로 전체 파일을 직접 열어 확인했다(프롬프트가 크기 제한으로
diff 를 생략한 `reject-masked-resubmission.ts`/`.spec.ts`, 두 repo-guard 쌍 포함).

## 발견사항

- **[INFO]** 같은 `try/catch` 블록 안에 신규 한국어 인라인 주석과 기존 영어 인라인 주석이 언어를 달리해 공존한다
  - 위치: `codebase/backend/src/modules/workflows/workflows.controller.ts` — 신규 주석(314-316행,
    `// 마스킹된 값이 그대로 재제출됐는가 ...`) 바로 아래 미변경 컨텍스트(320-322행,
    `// \`details\` so GlobalExceptionFilter surfaces the per-field breakdown ...`)
  - 상세: 이 diff 가 새로 만든 문제는 아니다(영어 줄은 컨텍스트 라인, 미변경). 이미 같은 PR 의
    앞선 리뷰 라운드(`review/code/2026/08/21/00_03_57/maintainability.md`,
    `01_38_26/documentation.md`)에서 두 차례 INFO 로 등재되고 "조치 불요"로 처분된 항목이며, 이번
    라운드에도 그대로 남아 있어 참고용으로 재확인만 한다. 이 저장소 최근 커밋들은 서술형 근거
    주석을 한국어로 쓰는 쪽으로 수렴 중이라, 다음에 이 블록을 여는 사람이 어느 언어로 이어써야
    할지 판단 근거가 없다.
  - 제안: 필수 아님(기존 처분과 동일). 다음에 이 블록을 편집할 기회가 있으면 영어 줄도 통일 검토.

- **[INFO]** `ExecutionsService.reRun` 이 이미 137줄(§420-556)로 길고, 이번 변경이 그 안의 "입력
  해석" 블록에 책임을 하나 더 얹는다
  - 위치: `codebase/backend/src/modules/executions/executions.service.ts` — `reRun` 메서드(420행
    시작, 556행 종료). 신규 마스킹 거부 호출은 496-516행
  - 상세: `reRun`은 이미 (1) 조회/404, (2) 권한 체크, (3) dry-run pre-flight, (4) chain depth
    체크, (5) 입력 해석(원본 재사용 vs `inputOverride` 검증), (6) 실행 트리거, (7) audit log
    까지 순차 수행한다. 이번 PR 은 (5) 안에서 `resolveTriggerParameters` 호출을
    `resolveTriggerParametersRejectingMasked` 로 교체하는 것이라 추가된 순증 로직 자체는 없지만
    (같은 자리를 대체), 이 구조가 계속 커지는 패턴인 것은 여전하다. 이 관찰은 이 diff 가 만든
    새 결함이 아니라 기존 구조에 대한 것이며, 이미 `00_03_57`/`01_15_47` 라운드에서 동일하게
    INFO 로 처분된 이력이 있다.
  - 제안: 이번 PR 스코프에서 강제할 사안 아님. 다음에 `reRun`을 손댈 일이 생기면 입력 해석
    블록을 `resolveRerunInput(...)` 류의 private 헬퍼로 추출하는 것을 고려.

- **[INFO]** `production-build-devdep.spec.ts`의 vacuous-방지 하한값 `500`이 매직 넘버다
  - 위치: `codebase/backend/src/repo-guards/__tests__/production-build-devdep.spec.ts` — `it('[캐너리]
    빌드 대상 파일 목록이 비어 있지 않다', ...)`, `expect(files.length).toBeGreaterThan(500)`
  - 상세: 이 하한 자체의 존재 이유("설정 경로가 틀리거나 파싱이 실패해 파일 목록이 비면 아래
    단언이 vacuous 하게 통과한다")는 주석에 명시돼 있어 의도는 명확하다. 다만 `500`이라는 구체
    숫자가 실제 빌드 대상 파일 수 대비 얼마나 여유가 있는지, 왜 그 값으로 골랐는지는 근거가
    남아있지 않다 — 이 저장소가 다른 곳에서 실측 기반 크기 산정을 관행으로 삼는 점과 비교하면
    사소한 편차다. 실질 위험은 낮다(값이 0보다 크다는 것만 확인하는 캐너리이므로 실패 방향이
    fail-closed 다 — 파일 수가 실제로 줄면 테스트가 깨져 알려준다).
  - 제안: 필수 아님. 값을 고를 당시 실측한 파일 수를 주석에 한 줄 남기면 다음 사람이 임계값
    조정 여부를 판단하기 쉬워진다.

## 요약

핵심 신규 구현(`reject-masked-resubmission.ts`)은 작고(67줄, 함수 4개) 단일 책임을 지키며, 순환
복잡도가 낮고(중첩 최대 2단), 매직 넘버 없이 기존 `MAX_REDACT_DEPTH` 상수를 재사용한다. 함수/변수
네이밍(`resolveTriggerParametersRejectingMasked`, `findMaskedResubmissions`, `hasMaskedLeaf`,
`throwIfAny`)은 길지만 각각의 의도를 정확히 드러내고, 기존 `resolveTriggerParameters`와의 관계·검사
시점(raw 우선 → resolve 후 재검사)의 이유가 함수 상단 JSDoc 에 표로 근거와 함께 남아 있어 다음
사람이 순서를 되돌릴 위험을 크게 줄인다. `trigger-parameter.types.ts`의 신규 enum 값·매핑 추가는
기존 3항목과 동일한 포맷·네이밍 컨벤션(`snake_case` reason ↔ `UPPER_SNAKE_CASE` code)을 따르고,
`coerce_failed`를 재사용하지 않기로 한 결정 근거를 doc comment 로 남겨 향후 오분기를 예방했다.

신규 repo-guard 2쌍(`masked-reject-callers-guard.ts`, `production-build-devdep-guard.ts`)은 각각
파서(순수 로직)와 소비 spec 을 분리하는 이 저장소의 기존 가드 패턴(`eslint-unicorn-peer-guard.ts`
등)을 그대로 따르고, 자기 문서화가 특히 두텁다 — 정규식에서 AST 로 전환한 이유, 우회 형태별 회귀
테스트, "위반이 없다"만 확인하는 테스트의 무보증 함정을 합성 fixture 로 닫은 이유가 모두 코드
옆에 근거로 남아 있다. 두 가드가 유사한 "TS AST 순회" 골격을 공유하지만 실제로 순회하는 대상(전체
소스 트리 vs tsconfig 가 해석한 빌드 대상 파일 목록)이 달라 진짜 중복은 아니다.

두 호출부(`executions.service.ts`/`workflows.controller.ts`)의 `try/catch` 형태가 여전히 유사하지만,
이번 PR 자체가 만든 새 중복은 아니다(이 구조는 이 PR 이전부터 있었고, 이 PR 은 그 안의 함수
호출 대상만 `resolveTriggerParametersRejectingMasked`로 교체했다) — 오히려 이전 라운드에서 지적됐던
"find+length체크+throw"의 실질 중복은 이번 함수 캡슐화로 이미 해소된 상태다. 응답 최상위
`error.code`가 두 엔드포인트에서 다른 점(`INVALID_INPUT` vs `INVALID_TRIGGER_PARAMETERS`)은 선존
drift 로 이 PR 의 스코프 밖이며 이미 앞선 라운드에서 근거와 함께 명시적으로 유예됐다.

이번 diff 는 이미 5회 이상의 리뷰 라운드(`00_03_57`~`02_04_38` 및 그 이후로 커밋 메시지에서 언급된
추가 라운드)를 거치며 Critical 1건(boolean 완전 우회)과 다수 Warning(호출부 중복·가드 오탐 3종·
`Object.freeze(Set)` 플라시보 등)을 순차로 해소해 CRITICAL 0 / WARNING 0 으로 수렴한 상태다. 독립
검토 결과 그 수렴은 실코드와 일치하며, 새로 지적할 만한 CRITICAL·WARNING 급 유지보수성 결함은
발견하지 못했다. 위 INFO 3건은 전부 이번 PR 이 만든 새 문제가 아니거나(주석 언어 혼재·`reRun`
길이) 실질 위험이 낮은 사소한 편차(매직 넘버 하한값)다.

## 위험도

LOW
