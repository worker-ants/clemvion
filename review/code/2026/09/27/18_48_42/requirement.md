# 요구사항(Requirement) 리뷰 — patch-null-validation (3R, doc-only 후속 포함 누적 diff)

## 컨텍스트

이 라운드의 diff 는 1R(`17_47_49`)·2R(`18_13_53`)에서 이미 Critical 0·Warning 0 으로 수렴한 코드(43필드 `@IsOptional()` →
`@IsOptionalNonNull()`, 신규 데코레이터, 43필드 단위 테스트, 33케이스 e2e)에 doc-only 커밋 두 개(`634297632` JSDoc 3줄,
`27191021c` plan 트래커 보강)만 추가한 상태다. `codebase/` 실질 로직 변경은 이번 라운드에 0건(`git show --stat` 로 확인).
아래는 `codebase/backend/src/common/utils/optional-non-null.ts`, 14개 DTO, 신규 단위/e2e 테스트, `CustomValidationPipe`,
관련 spec 3개 문서를 직접 `Read`/`grep`/`git show` 로 재검증한 결과다. 저장소에 쓰기는 하지 않았다(`git status --short` ·
`git diff --stat HEAD` 둘 다 이 세션 산출물 외 변경 없음 확인).

## 발견사항

- **[INFO]** `IsOptionalNonNull` 구현을 프로덕션 검증 파이프와 대조 재확인 — 결함 없음
  - 위치: `codebase/backend/src/common/utils/optional-non-null.ts:20-31`, `codebase/backend/src/common/pipes/validation.pipe.ts:39-42`
  - 상세: `ValidateIf((_, value) => value !== undefined, ...)` 가 키 생략(`undefined`) 시에만 해당 프로퍼티의 모든 검증기(그 뒤에 붙는
    `IsDefined` 포함)를 건너뛰므로 부분 갱신(생략=값 불변)이 정확히 보존된다. `null` 이 오면 스킵되지 않아 `IsDefined`(항상 실패)와
    타입 검증기(`IsString` 등, `null` 은 타입이 아니므로 실패)가 함께 돌아 400 이 보장된다. 전역 `CustomValidationPipe` 가
    `{ whitelist: true, forbidNonWhitelisted: true }` 로 검증을 돌리는 것을 직접 확인했고, 이는 단위 테스트(`optional-non-null.spec.ts`,
    `patch-null-rejection.spec.ts`)의 `VALIDATE_OPTIONS` 와 정확히 같은 옵션이라 테스트가 실제 프로덕션 경로를 충실히 대표한다.
  - 제안: 없음 — 확인용.

- **[INFO]** 43필드 전수 정합 재확인 — DTO 소스 · 단위 테스트 테이블 · plan 전수표 3자 일치
  - 위치: `grep -rn "@IsOptionalNonNull()" codebase/backend/src --include='*.dto.ts' | wc -l` = 43, `codebase/backend/src/repo-guards/__tests__/patch-null-rejection.spec.ts:35-83`(`expect(CASES).toHaveLength(43)`), `plan/in-progress/patch-null-validation.md:38-64`(§전수 (A)38+(D)1~5=43)
  - 상세: (A) 38필드 표를 라우트별로 직접 합산(3+4+2+3+2+3+1+1+4+8+2+3+2=38)했고, `TABLE`(단위 테스트) 필드 리스트를 DTO 별로 합산(4+2+2+1+8+4+5+2+3+3+1+3+3+2=43)한 결과 둘 다 소스 grep 카운트(43)와 정확히 일치한다. `avatarUrl`(`update-me.dto.ts:62`) · `authConfigId`(`update-trigger.dto.ts:84`, `nullable: true` 유지) 등 (B) 그룹 필드는 의도대로 `@IsOptional()` 그대로 남아 있어 스코프 침범이 없다.
  - 제안: 없음 — 확인용.

- **[INFO]** 에러 시나리오·엣지 케이스 커버리지 재확인 — 키 생략(불변) / null(거부) / 유효 값(저장) 3분기 모두 테스트됨
  - 위치: `codebase/backend/test/patch-null-rejection.e2e-spec.ts:246-288`, `codebase/backend/src/common/utils/optional-non-null.spec.ts:27-56`
  - 상세: e2e 33케이스(각 null→400+`details[].field`) 외에 모델 설정 라우트에 한해 "유효 값 PATCH→200+데이터 일치" 와 "빈 바디 PATCH→200+값 유지"를 별도로 검증해, `IsOptionalNonNull` 이 정상 값·생략 경로를 막지 않는지까지 실제로 검증한다(다른 11라우트는 각자 기존 e2e 가 유효값 경로를 이미 커버한다고 plan 이 명시하고 근거를 남김). 단위 테스트도 "키 생략→통과", "null→거부", "값→그 값의 검증기만"을 명시적으로 나눠 검증한다. TODO/FIXME/HACK/XXX 는 이 diff 의 `codebase/` 범위 안에 0건(`git diff origin/main...HEAD -- codebase | grep -nE "TODO|FIXME|HACK|XXX"`).
  - 제안: 없음 — 확인용.

- **[SPEC-DRIFT]** `spec/5-system/2-api-convention.md` §5.4 블록쿼트의 PATCH tri-state 서술("`null`(=초기화)")이 문면상 이번 43필드 null-거부와 글자 그대로 충돌한다
  - 위치: `spec/5-system/2-api-convention.md:278`(§5.4 첫 블록쿼트 — "PATCH 부분 업데이트는 키 생략(=값 불변) · `null`(=초기화) · 값(=설정)의 **tri-state** 가 각각 의미를 갖는 별개 계약")
  - 상세: 원문을 직접 열어 확인한 결과, 이 문장은 원래 "§5.4 의 응답 DTO 선언 규칙(`?` 제거)을 요청 DTO 에 그대로 적용하면 안 된다"는 예외 근거를 설명하려는 것이지 "모든 PATCH 필드가 null=초기화 를 지원해야 한다"는 전칭 규칙 선언이 아니다. 그러나 문장 자체는 그 구분(nullable 선언 필드에만 적용된다는 한정)을 명시하지 않아, 이 43필드(전부 OpenAPI `nullable` 미선언)의 null-거부와 글자 그대로는 부딪혀 보인다. 이는 **코드가 옳고 spec 문장이 오독 여지를 남긴** 경우다 — 실제 tri-state 대상 필드(`llmConfigId` 등 `nullable: true` 선언 필드)는 이 PR 이 건드리지 않았으므로 실제 충돌 인스턴스는 없다. 이미 같은 세션의 `--impl-prep`(`review/consistency/2026/09/27/17_14_44`)과 1R·2R 코드 리뷰 3곳이 독립적으로 이 결론에 도달해 `plan/in-progress/spec-draft-nullable-notation-followups.md` 항목 (10)에 planner 작업으로 등재돼 있음을 `Read`로 직접 확인했다(6408-6412행, "§5.4 블록쿼트의 PATCH tri-state «`null` = 초기화» 는 **nullable 로 선언된 필드**에만 적용되고 미선언 필드의 `null` 은 400 `VALIDATION_ERROR` 라는 문장이 없다 — 글자 그대로는 ... 부딪혀 보인다. 한 문장 추가").
  - 제안: 코드 유지 — spec 반영은 `project-planner` 턴에서 §5.4 블록쿼트에 "tri-state 의 `null`=초기화 분기는 `nullable: true` 로 선언된 필드에만 적용된다" 한 문장을 추가하면 해소된다. 신규 조치 불요(이미 트래커에 등재, 3회 독립 확인).

- **[SPEC-DRIFT]** `spec/2-navigation/2-trigger-list.md` §2.3.1 `endpointPath` 행·§3 註가 이번 PR 의 null-거부(400)를 아직 서술하지 않는다
  - 위치: `spec/2-navigation/2-trigger-list.md:126`(§2.3.1 `endpointPath` 행), `:194`(§3 註, PATCH 부분 갱신 키 목록)
  - 상세: 두 곳 모두 `endpointPath` PATCH 변경 시 "옛 URL 은 즉시 404" 등 기존 동작만 서술하고, 이번 PR 이 도입한 "`null` 은 400 `VALIDATION_ERROR`(종전엔 200 으로 경로가 조용히 지워짐)"는 아직 반영돼 있지 않다. `codebase/backend/src/modules/triggers/dto/update-trigger.dto.ts:58-59, 66`의 JSDoc/Swagger description 에는 이미 정확히 반영돼 있어 코드·CHANGELOG 는 옳고, spec 미러링만 지연된 상태다. `git show 27191021c`로 확인한 결과 이 갭은 이미 `plan/in-progress/spec-draft-nullable-notation-followups.md` 항목 (10)에 "(10) 의 범위 보강 ... `2-trigger-list.md` §2.3.1 필드 권한 매트릭스 `endpointPath` 행과 §3 註 ... 한 줄" 로 이번 세션(`--impl-done` W3·W4)에서 이미 등재됐다.
  - 제안: 코드 유지 — spec 반영은 같은 planner 항목 (10)에서 §5.4 문장과 함께 일괄 처리 예정. 신규 조치 불요.

- **[INFO]** `Workflow.settings.maxConcurrentExecutions`(워크플로·워크스페이스 양쪽)의 `null` 이 여전히 `@IsOptional()` 을 통과해 저장되며, 이는 `spec/2-navigation/1-workflow-list.md:162`의 "미지 키·비양수·비정수는 400 `VALIDATION_ERROR`" hard-fail 서술과 문면상 어긋난다 — 단, 이 PR 의 스코프 밖(회귀 아님)
  - 위치: `codebase/backend/src/modules/workflows/dto/workflow-settings.dto.ts:28`, `codebase/backend/src/modules/workspaces/dto/update-workspace-settings.dto.ts:61`(둘 다 이번 diff 에서 미변경)
  - 상세: `plan/in-progress/patch-null-validation.md:81-83`(§범위 "넘긴다")가 이 필드를 처음부터 스코프 밖으로 명시했고, `spec/2-navigation/1-workflow-list.md` §3.2 는 원래 **import JSON** 의 nested `WorkflowSettingsDto` strict 검증(및 "`UpdateWorkflowDto.settings`(patch)와 동일 정책")을 서술한 것이라 이번 PR 이 새로 어긋나게 만든 것이 아니라 기존부터 있던 gap 이다. `git show 27191021c`로 직접 확인한 결과 이 관찰(`--impl-done` W2)도 이미 `spec-draft-nullable-notation-followups.md`의 "PATCH null 후속" 트래커 항목에 "`maxConcurrentExecutions` 는 spec 서술과도 어긋난다 ... 거부로 정하면 서술은 그대로 맞고, 계약으로 정하면 그 두 문단이 planner 몫" 으로 등재돼 있다.
  - 제안: 조치 불요 — 이 diff 의 회귀가 아니고 이미 후속 트래커에 등재됨.

- **[INFO]** `null` 이 `IsDefined`·타입 검증기 양쪽을 동시에 위반할 때 `details[]` 에 같은 `field` 값이 두 번 실린다 — 계약 위반 아님
  - 위치: `codebase/backend/src/common/pipes/validation.pipe.ts:71-80`(`flattenErrors` — 제약당 한 엔트리)
  - 상세: 예를 들어 `name: null` 은 `error.constraints = { isDefined, isString }` 두 개를 가져 `details` 에 `field: 'name'` 항목이 두 번 나온다. e2e/단위 테스트 모두 `fields.toContain(field)` 형태로만 단언해 이 중복 자체를 API 계약 위반으로 보지 않으며, `CustomValidationPipe` 는 이 PR 이전부터 있던 필드 단위 매핑 방식이라 이번 diff 가 만든 문제가 아니다.
  - 제안: 조치 불요.

## 요약

이번 라운드의 실질 `codebase/` 변경은 0건(JSDoc 3줄 doc-only)이라 1R·2R 이 이미 Critical 0·Warning 0 으로 수렴시킨 핵심 구현을
독립적으로 재검증하는 데 집중했다 — `IsOptionalNonNull`(`ValidateIf(v!==undefined)` + `IsDefined`)의 의미론을 전역
`CustomValidationPipe`(`whitelist+forbidNonWhitelisted`)와 직접 대조해 프로덕션 경로와 테스트가 정확히 일치함을 확인했고,
43필드 카운트를 DTO 소스·단위 테스트 테이블·plan 전수표 3곳에서 각각 재계산해 모두 일치함을 확인했다. 키 생략(불변)·null(거부)·
유효 값(저장) 세 분기 모두 단위+e2e 로 실제로 밟히며, `codebase/` diff 안에 TODO/FIXME 류는 0건이다. spec 쪽에서는 §5.4
tri-state 문장과 트리거 `endpointPath`/§5.4 검증 층 표에 이번 동작이 아직 미러링되지 않은 두 건을 발견했으나, 둘 다 코드가 아니라
spec 문서가 뒤처진 SPEC-DRIFT 이고 이미 `plan/in-progress/spec-draft-nullable-notation-followups.md` 항목 (10)에 planner 작업으로
등재돼 있음을 `Read`/`git show` 로 직접 재확인했다(신규 발견 아님, 중복 조치 불요). `settings.maxConcurrentExecutions` 의 null 관용은
이 PR 의 회귀가 아니라 처음부터 스코프 밖으로 선언된 기존 gap이며 역시 같은 트래커에 등재돼 있다. Critical·신규 Warning 은
발견하지 못했다. 리뷰 중 저장소 파일 뮤테이션은 하지 않았다(`git status --short`/`git diff --stat HEAD` 로 확인).

## 위험도

LOW
