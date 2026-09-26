# 변경 범위(Scope) 리뷰 — rotate-bot-token-body

검토 대상 19개 파일(`git diff --stat origin/main...HEAD` 로 전수 확인) 전부가 plan
(`plan/in-progress/rotate-bot-token-body.md`)이 명시한 "OpenAPI 가 요청 본문을 모르던
라우트 3곳(`rotate-bot-token` · `executions/:id/continue` · `hooks/:endpointPath`)에
문서 전용 `@ApiBody` 를 붙인다, 런타임은 불변" 범위 안에 있다.

## 발견사항

(없음 — 범위 이탈 없음)

점검 관점별로 확인한 근거:

1. **의도 이상의 변경 / 무관한 수정** — 수정된 컨트롤러 3개(`triggers.controller.ts`,
   `executions.controller.ts`, `hooks.controller.ts`)의 diff hunk 는 각각 `ApiBody`
   (hooks 는 `ApiConsumes` 도) import 추가 + 해당 라우트 데코레이터 한 줄/블록 추가뿐이다.
   `@Body()` 파라미터의 타입 시그니처(`body?: { formData?: unknown }`, `newBotToken?`,
   `unknown`)는 세 곳 모두 diff 에 나타나지 않는다 — 핸들러 로직도 건드리지 않았다. plan
   이 선언한 "런타임 불변" 이 diff 로 실측된다.
2. **불필요한 리팩토링** — `swagger-probe.ts` 는 기존 함수(`buildSwaggerDocument`,
   `schemasOf`, `schemaOf`, `propertyOf`) 본문을 전혀 건드리지 않고 새 함수
   `bodyParamDesignType` 과 그에 필요한 import 3개(`Type`, `ROUTE_ARGS_METADATA`,
   `RouteParamtypes`)만 파일 끝에 추가했다. 순수 추가(append-only)이며 기존 코드 정리는
   없다.
3. **기능 확장(over-engineering)** — 신규 코드는 문서 전용 DTO 2개 + 헬퍼 함수 1개
   + 캐너리 스펙 3개로, 정확히 "라우트 3곳" 스코프에 대응한다. `bodyParamDesignType`
   은 3개 캐너리 스펙이 공유하는 최소 인프라이며(파일 자신의 헤더 주석이 "4번째 유사
   스펙이 생기면 공유 헬퍼로 추출" 조건부 처분의 연장선임을 밝힘), 스코프 밖 기능
   추가는 없다.
4. **포맷팅 변경** — `git diff --stat` 상 CHANGELOG.md·`swagger-probe.ts` 의 삭제
   라인은 각 1줄로, `import type { ModuleMetadata } from ...` →
   `import type { ModuleMetadata, Type } from ...` 한 줄 치환뿐이다. 의미 없는
   공백/줄바꿈 리포맷은 관찰되지 않는다.
5. **주석 변경** — 추가된 주석(`// 본문 스키마는 @ApiBody 로만...`)은 모두 이번에
   신설된 데코레이터 바로 위에서 "왜 DTO 로 타입하지 않았는지"를 설명하는, 그 줄과
   직접 결합된 신규 주석이다. 기존 주석의 삭제/수정은 diff 에 없다.
6. **임포트 변경** — 추가된 import(`ApiBody`, `ApiConsumes`, `ContinueExecutionRequestDto`,
   `ChatChannelRotateBotTokenRequestDto`, `Type`, `ROUTE_ARGS_METADATA`,
   `RouteParamtypes`)는 전부 같은 diff 안에서 실제로 사용된다. 미사용 import 나
   기존 import 정리는 없다.
7. **설정 변경** — `tsconfig`/`package.json`/lint 설정 등 파일은 diff 목록에
   없다.

## 참고 (범위 판단에 필요한 배경, 결함 아님)

`plan/in-progress/rotate-bot-token-body.md` 와
`review/consistency/2026/09/26/17_20_45/**`(SUMMARY.md 등 8개 파일)가 diff 에
포함된 것은 CLAUDE.md 워크플로가 요구하는 `--impl-prep` consistency-check
산출물이며 `developer` 의 정상 쓰기 권한(`plan/**`, `review/**`) 범위다 — 스코프
이탈이 아니라 이 작업 자체의 필수 workflow 부산물이다.

## 요약

19개 파일 전부가 "요청 본문 스키마가 없던 라우트 3곳에 문서 전용 `@ApiBody`" 라는
단일 의도로 수렴한다. 컨트롤러 수정은 import·데코레이터 추가에 한정돼 있고 핸들러
로직·파라미터 타입은 diff 에 나타나지 않아 "런타임 불변" 주장이 실측으로 뒷받침된다.
공유 헬퍼 확장은 3개 캐너리가 공유하는 최소 인프라로 범위 내이며, 무관한 리팩토링·
포맷팅·주석 정리·미사용 임포트·설정 변경은 발견되지 않았다.

## 위험도

NONE
