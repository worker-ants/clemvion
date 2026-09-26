# 요구사항(Requirement) 리뷰 — request-body-guard

## 사전 고지 — 공유 워크트리 관측 이상 상태

리뷰 도중 `codebase/backend/src/common/pipes/validation.pipe.ts` 가 커밋되지 않은 상태로 수정돼 있는 것을 관측했다
(`git status --short` 에 ` M`). diff:

```
 export const UNVALIDATED_METATYPES: readonly Function[] = Object.freeze([
   String,
   Boolean,
-  Number,
   Array,
   Object,
 ]);
```

이 세션 시작 시점의 `Read` 결과에는 `Number` 가 존재했으므로, 이 수정은 본 세션이 만든 것이 아니라 **동시에 같은
워크트리를 쓰는 다른 reviewer 의 뮤테이션 검증(아마 RESOLUTION.md 의 뮤턴트 R2 재현) 작업**으로 보인다. 지시에 따라
`git checkout`/`restore` 로 되돌리지 않았고, 이하 분석은 **git 커밋 이력(HEAD, `64f0e937b`)에 있는 코드**를 기준으로
했다. 이 파일을 대상으로 하는 다른 발견사항이 나오면, 리포트 작성 시점 워크트리가 아니라 커밋된 diff와 대조해야 한다.

## 검토 범위

`git diff origin/main --stat` 기준 39개 파일. 실질 코드는 6개(`CHANGELOG.md`, `validation.pipe.{ts,spec.ts}`,
`request-body-advertised-{guard,.spec}.ts`, `swagger-probe.{ts,spec.ts}`) + spec(`swagger.md`) + plan 2건 + 이전
`/ai-review`·`consistency-check` 산출물(문서, 자기 자신은 코드 변경이 아니므로 요구사항 관점 대상에서 낮은 우선순위).

## 발견사항

- **[INFO]** `advertisesBody()` 는 핸들러 단위로만 `@ApiBody` 유무를 본다 — 한 핸들러에 키 지정 `@Body('a')`/`@Body('b')`
  처럼 자리가 여럿이면 그중 하나만 `@ApiBody` 로 광고돼도 나머지 자리까지 "광고됨"으로 통과한다.
  - 위치: `codebase/backend/src/repo-guards/__tests__/request-body-advertised-guard.ts` 함수 `advertisesBody`(약 59~64행),
    `scanRequestBodyAdvertised` 의 `if (advertisesBody(route)) continue;`(92행)
  - 상세: OpenAPI `requestBody` 자체가 라우트(핸들러)당 하나이므로 스펙 요구("요청 본문을 받는 라우트는 본문 스키마를
    광고한다", `swagger.md:517`)가 애초에 라우트 단위 요구이지 파라미터 단위 요구가 아니다 — 의도-구현 괴리가 아니라
    scope 가 정확히 일치한다. 다만 대조군(`request-body-advertised.spec.ts`)이 "여러 키 지정 본문 중 하나만 광고" 케이스를
    직접 exercising 하지 않아, 이 스코프 경계 자체가 회귀에 안전한지는 캐너리로 고정돼 있지 않다. 저장소에 다중 키 지정
    `@Body()` 라우트가 현재 0곳이라는 점도 실측·RESOLUTION.md 에 이미 기록돼 있다.
  - 제안: 조치 불요(이미 전 라운드 SUMMARY INFO2 로 식별, RESOLUTION.md 에서 "저장소에 0곳"으로 스코프 확정). 재확인
    목적으로만 기재.

- **[INFO]** `isExcluded()` 는 `@ApiExcludeEndpoint(false)`/`@ApiExcludeController(false)` 처럼 명시적으로 "제외 안 함"을
  선언해도 메타데이터 존재 여부(`!== undefined`)만 보므로 "제외됨"으로 오판할 수 있다.
  - 위치: `codebase/backend/src/repo-guards/__tests__/request-body-advertised-guard.ts` 함수 `isExcluded`(약 49~57행)
  - 상세: `@nestjs/swagger` 의 `ApiExcludeEndpoint(disable=true)`/`ApiExcludeController(disable=true)` 는 인자 값과 무관하게
    메타데이터 자체는 항상 기록한다(`createMethodDecorator(KEY, { disable })` / `createClassDecorator(KEY, [disable])`) —
    값이 아니라 키 존재로 판정하면 `disable: false` 호출을 구별하지 못한다. 다만 이 판정 패턴은 형제 가드
    `forbidden-response-codes-guard.ts` 와 동일(신규 결함 아님)이고, 저장소 전체에 `ApiExcludeEndpoint(false)`/
    `ApiExcludeController(false)` 호출이 0건(`grep` 확인)이라 현재는 관측 가능한 영향이 없다.
  - 제안: 이번 PR 범위 밖(기존 패턴 재사용). 실제 `disable:false` 사용 사례가 생기면 재검토.

- **[INFO]** `plan/in-progress/request-body-guard.md` 체크리스트의 `/ai-review`·`--impl-done` 항목이 아직 미체크다.
  - 위치: `plan/in-progress/request-body-guard.md` 체크리스트 마지막 3행
  - 상세: 실제로는 1R `/ai-review`(`review/code/2026/09/26/19_32_47`, Critical 0 · Warning 2)가 이미 돌았고 조치
    커밋(`8bc7e8f19`, `64f0e937b`)까지 있다. 다만 plan 안에 이미 여러 항목이 "마무리 커밋에서 처리"라고 명시돼 있어,
    체크박스·plan 이동을 최종 wrap-up 커밋 하나로 모으는 것이 이 저장소의 기존 관행이다. 지금 실행 중인 이 2R 리뷰가
    끝나야 그 마무리 커밋이 발생하므로, 현재 미체크 상태는 스테일이 아니라 정상적인 진행 중 상태로 판단한다.
  - 제안: 조치 불요 — 관찰 기록용. 2R 이 Critical/Warning 0 으로 수렴하면 마무리 커밋에서 체크·`complete/` 이동을 잊지
    말 것.

- **[INFO]** spec fidelity 대조 — `spec/conventions/swagger.md` §5-4 신규 불릿(517~522행)·Rationale 신설 절
  (`### §5-4 요청 본문 스키마 …`, 750행 이하)과 구현을 라인 단위로 대조한 결과 불일치 없음.
  - `@ApiExcludeEndpoint()`/`@ApiExcludeController()` 제외 문구 ↔ `isExcluded()` 구현 일치.
  - "설계 타입이 클래스가 아니면" ↔ `UNVALIDATED_METATYPES`(`String`·`Boolean`·`Number`·`Array`·`Object`) + `undefined`
    처리(`isUnschematized`) 일치.
  - "모든 라우트에서" (소급 적용) ↔ 별도 베이스라인/freeze 없이 `src/modules` 전체 스캔, 실측 78/74/4/0 수치가
    plan·spec Rationale·CHANGELOG 세 곳에서 동일하게 반복돼 정합.
  - `@ApiBody({ schema: {} })` 로 "형태를 발신자가 정하는 본문" 을 광고하는 경로 ↔ 대조군 `unknownDocumented` 핸들러
    (`request-body-advertised.spec.ts:115~117`)로 실제 검증됨.
  - `@nestjs/swagger` 실제 설치 패키지(`node_modules/@nestjs/swagger/dist/constants.js`)의
    `DECORATORS.API_PARAMETERS`/`API_EXCLUDE_ENDPOINT`/`API_EXCLUDE_CONTROLLER` 값과 가드가 하드코딩한 문자열
    (`swagger/apiParameters` 등)을 직접 대조 — 일치. `ApiBody()` 소스(`api-body.decorator.js`)가 실제로
    `{ in: 'body', ... }` 를 심는 것도 확인 — `advertisesBody()` 의 `p.in === 'body'` 판정과 일치.

- **기능 완전성 / 엣지 케이스 / 반환값**: `scanRequestBodyAdvertised` 는 빈 라우트 배열에도 `{violations: [], checked: 0,
  unschematized: 0}` 을 안전하게 반환하고(순회 없음), 설계 타입이 emit 되지 않은 자리(`undefined`)·다중 `@Body()` 자리·
  제외 컨트롤러/핸들러·키 지정 본문(`@Body('a')`) 전부 대조군으로 직접 고정돼 있다(`request-body-advertised.spec.ts`
  전체, 특히 210~239행의 "설계 타입이 emit 되지 않은 자리" 케이스). 이전 라운드 WARNING(전역 가변 배열·Number/Boolean/
  Array 미관측·정렬 미검증)은 `8bc7e8f19` 에서 `Object.freeze` + 전용 대조군(`numberBody`/`booleanBody`/`arrayBody`) +
  정렬 단위 테스트(`bodyArgIndexes` 오름차순, `swagger-probe.spec.ts:100~106`)로 실측 커버됐고, 뮤턴트 표(plan 체크리스트
  G1~G8, RESOLUTION.md R1~R6)로 KILLED 확인까지 돼 있어 "테스트가 있다고 주장하지만 실제로 그 분기를 exercise 하지
  않는" 종류의 공허성은 발견되지 않았다.

- **TODO/FIXME/HACK/XXX**: `git diff origin/main -- 'codebase/backend/**'` 전수 grep 결과 0건.

## 요약

신설 가드(`request-body-advertised`)는 `spec/conventions/swagger.md` §5-4 신규 규칙을 line-level 로 정확히 구현하며,
전역 파이프의 비검증 타입 목록(`UNVALIDATED_METATYPES`)을 가드가 "그대로" 참조하는 단일 소스 설계로 파이프·가드
드리프트를 원천 차단했다. 직전 `/ai-review` 라운드의 Warning 2건(전역 가변 배열, Number/Boolean/Array 관측 공백)은
freeze + 전용 대조군으로 확실히 해소됐고, 뮤테이션 검증(8/8 + 후속 R1~R6)이 실제로 판정 분기를 도는지 뒷받침한다.
CRITICAL 급 결함은 발견하지 못했다. 남은 항목은 전부 이미 전 라운드에서 식별·수용된 스코프 경계(다중 키 본문 —
저장소 0곳, `ApiExcludeXxx(false)` 미사용 — 저장소 0곳) 또는 프로세스상 정상적인 진행 중 상태(plan 체크박스는 마무리
커밋에서 일괄 반영 예정)로, 코드 fix 를 요구하지 않는다. 별도로, 리뷰 도중 공유 워크트리에서 커밋되지 않은 동시
뮤테이션(`validation.pipe.ts` 의 `Number` 제거)을 관측했으며 본 리뷰는 이를 반영하지 않고 커밋된 HEAD 기준으로
작성했다.

## 위험도

LOW
