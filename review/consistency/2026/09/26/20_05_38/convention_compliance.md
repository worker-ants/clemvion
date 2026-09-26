# 정식 규약 준수 검토 — request-body-guard

## 검토 범위

- target: `swagger.md`(§5-4 신설 항목 + 동 Rationale) · `2-api-convention.md` · `3-error-handling.md` 번들(impl-done, spec 델타 0)
- 대조 대상 구현 diff(6파일/506줄): `common/pipes/validation.pipe.ts`(+`.spec.ts`), `repo-guards/__tests__/request-body-advertised-guard.ts`(신규), `repo-guards/__tests__/request-body-advertised.spec.ts`(신규), `shared/testing/swagger-probe.ts`(+`.spec.ts`)
- 실제 worktree(`/Volumes/project/private/clemvion/.claude/worktrees/request-body-guard`)를 절대경로로 직접 열어 diff 와 대조했다.

## 발견사항

없음. 아래는 확인한 근거이며 위반으로 분류하지 않았다.

### 확인 1 — 파일·식별자 명명이 기존 repo-guards 패밀리와 일치

- `request-body-advertised-guard.ts` + `request-body-advertised.spec.ts` 쌍은 `http-status-advertised-guard.ts`/`.spec.ts`, `forbidden-response-codes-guard.ts`/`.spec.ts` 등 기존 12쌍과 동일한 `<name>-guard.ts` + `<name>.spec.ts` 명명 패턴을 그대로 따른다.
- `scanRequestBodyAdvertised` / `RequestBodyViolation` / `RequestBodyScan` 은 `scanForbiddenResponseCodes` / `ForbiddenCodeViolation` / `ForbiddenCodeScan`, `scanHttpStatusAdvertised` / `HttpStatusViolation` / `HttpStatusScan` 과 동일한 `scan<Topic>` / `<Topic>Violation` / `<Topic>Scan` 3종 세트 패턴을 그대로 따른다.
- 내부 swagger 메타데이터 키 상수 `SWAGGER_API_PARAMETERS` / `SWAGGER_EXCLUDE_ENDPOINT` / `SWAGGER_EXCLUDE_CONTROLLER` 는 직접 재사용하는 형제 파일 `forbidden-response-codes-guard.ts` 의 `SWAGGER_API_RESPONSE` / `SWAGGER_EXCLUDE_ENDPOINT` / `SWAGGER_EXCLUDE_CONTROLLER` 와 이름 규칙이 일치한다(둘 다 `_METADATA` 접미사 없음). 값을 옮겨 적은 이유·fail-closed 근거 주석("형제 가드와 같은 사정")도 동형.
- fixture 컨트롤러 명명(`BodyFixtureController` / `AlphaBodyFixtureController` / `ExcludedBodyFixtureController`)은 `ForbiddenFixtureController` / `ClassRolesFixtureController` 등 기존 `<Name>FixtureController` 패턴과 일치.
- 위반 표시 관용구 `'(없음)'`(설계 타입 미emit)은 `audit-action-binding.spec.ts` 의 `actionType ?? '(없음)'` 과 동일한 기존 관용구.

### 확인 2 — swagger.md §5-4 체크리스트·Rationale 과 구현의 1:1 대응

`swagger.md §5-4`("요청 본문을 받는 라우트(`@Body()`)는 본문 스키마를 광고한다 … `@ApiExcludeEndpoint()`·`@ApiExcludeController()` 제외")와 동 Rationale("§5-4 요청 본문 스키마 — 왜 클래스로 받게 강제하지 않고, 왜 reflection 으로 세는가")이 명시한 설계가 구현과 정확히 일치한다:

- 판정 축은 규약이 지정한 대로 파이프가 export 하는 `UNVALIDATED_METATYPES` 그 자체를 재사용(`validation.pipe.ts` → `request-body-advertised-guard.ts` import) — "가드는 파이프가 export 하는 그 목록을 그대로 쓴다" 문구와 정확히 일치.
- `@ApiExcludeEndpoint()` / `@ApiExcludeController()` 제외, "광고 존재만 센다"(DTO 정합성은 보지 않는다), `@ApiBody({ schema: {} })` 로 발신자-정의 본문(웹훅) 표현 — 모두 규약 문구 그대로 구현·fixture(`unknownDocumented`)에 반영.
- `code:` frontmatter 는 이미 `codebase/backend/src/repo-guards/__tests__/request-body-advertised*.ts` glob 을 보유하고 있어 spec-impl-evidence 상 매치 요건을 충족한다.

### 확인 3 — `validation.pipe.ts` 변경의 spec 커버리지

`common/pipes/validation.pipe.ts` 는 swagger.md 의 `code:` 목록엔 없지만, 같은 파일이 `2-api-convention.md` 와 `3-error-handling.md` 의 `code:` frontmatter 에 이미 등재돼 있어 spec-impl-evidence 컨벤션(글로브 ≥1 매치)상 문제가 없다. 이번 변경은 `toValidate()` 내부 리터럴 배열을 export 상수로 승격한 리팩터(freeze 추가)로, 동작 변경이 아니다.

### 확인 4 — 문서 구조 규약 (Overview/본문/Rationale)

이번 diff 는 `spec/**` 파일을 하나도 건드리지 않는다(스코프 델타 0, 위 프롬프트가 실측). 번들된 세 문서(`swagger.md`/`2-api-convention.md`/`3-error-handling.md`)는 이미 Overview→본문→Rationale 3섹션 구조와 `spec/conventions/<name>.md` 명명을 유지하고 있으며, 이번 PR 로 그 구조가 훼손되지 않았다.

### 확인 5 — 금지 항목(§6 레거시 패턴)

`@ApiOkResponse({ schema: { type: 'object', properties: { data: { type: 'object' } } } })` 류 빈 껍데기, double-wrap 페이지네이션 등 §6 이 명시적으로 금지한 패턴이 이번 diff 에 재도입되지 않았다.

## 요약

이번 PR 은 `spec/conventions/swagger.md` §5-4 에 직전 커밋(`f71f5df06`)으로 이미 기술된 "요청 본문 스키마 광고" 규칙을 그대로 구현한 것으로, 파일·식별자 명명, 내부 메타데이터 키 상수, 위반 판정 인터페이스(`scanX`/`XViolation`/`XScan`), fixture 명명, 정렬·카운팅 방식까지 기존 `repo-guards/__tests__/*-guard.ts` 패밀리(특히 직접 재사용하는 `forbidden-response-codes-guard.ts`)의 확립된 패턴을 정확히 답습한다. `spec/conventions/**` 관점에서 명명·출력 포맷·API 문서 데코레이터 패턴·금지 항목 어느 축에서도 위반을 찾지 못했다. 이미 `spec-draft`→`impl-prep`→2R `/ai-review`(14명, Critical 0)를 거친 변경이라는 점과도 부합한다.

## 위험도

NONE
