# 부작용(Side Effect) 리뷰 — trigger-uuid-and-guide-codes

## 검증 방법

레포지토리 파일은 뮤테이션하지 않고, 대상 파일을 `Read` 로 직접 열어 unified diff 의 게이트
줄 번호와 대조했다. 아래 두 가설은 저장소를 건드리지 않는 범위에서 기존 테스트를 그대로
실행해 확인했다(코드 변경 없음, `git status --short` 로 원상태 재확인 완료):

```
npx jest src/repo-guards/__tests__/swagger-dto-contract.spec.ts \
         src/repo-guards/__tests__/nullable-type-lie-cast.spec.ts \
         src/repo-guards/__tests__/param-uuid-pipe.spec.ts
# → 3 suites / 79 tests, 전부 pass

npx jest src/modules/triggers/triggers.controller.spec.ts \
         src/modules/auth/auth.controller.spec.ts
# → 2 suites / 33 tests, 전부 pass
```

## 발견사항

- **[INFO]** `rotateBotToken` 의 `:id` 에 `ParseUUIDPipe` 추가 — 의도된 런타임 응답 코드
  변경(500→400)
  - 위치: `codebase/backend/src/modules/triggers/triggers.controller.ts:291` (`@Param('id', ParseUUIDPipe) triggerId: string`)
  - 상세: 비-UUID `:id` 가 들어오는 경우 종전에는 파이프 없이 그대로 `TriggersService.findById`
    까지 흘러 Postgres `QueryFailedError`(SQLSTATE 22P02)가 `GlobalExceptionFilter` 의 세 분기
    (HttpException·http-error-like·unique-violation) 어디에도 걸리지 않아 `500 INTERNAL_ERROR`
    로 마스킹됐다. 이번 변경으로 `ParseUUIDPipe` 가 요청 처리 전 단계에서 `BadRequestException`
    을 던지고, `GlobalExceptionFilter.getCodeFromStatus(400)` 가 `VALIDATION_ERROR` 를 반환하는
    경로를 코드로 직접 대조해 확인했다(`codebase/backend/src/common/filters/http-exception.filter.ts`
    의 `getCodeFromStatus` case 400). 즉 **기존에 malformed `:id` 를 보내던 호출자는 응답
    status/code 가 500/INTERNAL_ERROR → 400/VALIDATION_ERROR 로 바뀐다** — 공개 API 의 관측
    가능한 동작이 변경되는 진짜 side effect다. 다만 이는 plan(`plan/in-progress/trigger-uuid-and-guide-error-codes.md`
    §A)이 사전에 근거 사슬과 함께 명시한 의도된 버그 수정이고, 형제 엔드포인트 6곳과 형태를
    맞춘 것이라 위험은 낮다.
  - 이 변경을 검증하는 것은 `param-uuid-pipe` 가드(AST 로 데코레이터 **선언 존재**만 확인)뿐이고,
    실제 HTTP 왕복으로 400 이 나가는지 보는 e2e/컨트롤러 테스트는 없다(plan 도 "rotate-bot-token
    를 타는 e2e 가 현재 0개"라고 스스로 기록). `triggers.controller.spec.ts` 는
    `new TriggersController(...)` 직접 생성이라 파이프가 실행되지 않으므로(확인: 위 테스트 실행
    결과 33/33 pass, 즉 이 변경으로 그 스펙의 어떤 케이스도 흔들리지 않음 — 파이프 미실행의
    방증) 이 behaviour 변경은 정적 선언 검증 밖에서는 사실상 무검증 상태다.
  - 제안: 낮은 우선순위 후속으로 `rotate-bot-token` 에 malformed UUID 를 실제로 보내는 e2e
    한 건을 추가해 "선언이 있다"가 아니라 "런타임이 400 을 낸다"까지 닫는 것을 고려. (plan 이
    이미 스코프 밖으로 명시했으므로 이번 PR 을 막을 사유는 아님.)

- **[INFO]** 신규 fixture `sample.controller.ts` 의 "프로덕션 스캔에 안 걸린다" 주장이 일부
  형제 가드에는 적용되지 않는다
  - 위치: `codebase/backend/src/repo-guards/__tests__/fixtures/param-uuid-pipe/sample.controller.ts:2-4`
    (헤더 주석 "프로덕션 스캔 루트는 `src/modules` 라 이 파일은 거기 걸리지 않는다")
  - 상세: 이 주장은 스캔 루트를 `src/modules` 로 좁힌 가드(`dto-class-name-collision`,
    `user-entity-exposure`, `dto-jsdoc-citation`, `audit-action-binding-guard`, 그리고 이번에
    추가된 `param-uuid-pipe` 자신)에는 맞는다. 그러나 같은 디렉터리의 형제 가드 중
    `swagger-dto-contract.spec.ts` (`collectTsFiles(SRC_ROOT)`, 파일:
    `codebase/backend/src/repo-guards/__tests__/swagger-dto-contract.spec.ts:67`)와
    `nullable-type-lie-cast.spec.ts` (`collectScanTargets()` 기본값이 `SRC_ROOT`, 파일:
    `codebase/backend/src/repo-guards/__tests__/nullable-type-lie-cast-guard.ts:39`)는 `src/`
    전체를 재귀 스캔하므로, `src/repo-guards/__tests__/fixtures/**` 아래에 있는 이 새 fixture
    파일도 그 두 가드의 입력 집합에 그대로 편입된다. 실측(`collectTsFiles` 정의,
    `codebase/backend/src/common/__test-utils__/source-scan.ts:328` 이하)으로 확인 — `.spec.ts`
    가 아닌 한 제외 규칙이 없다.
  - 실제로 위 두 가드를 `param-uuid-pipe.spec.ts` 와 함께 실행해 확인한 결과 3 suites / 79 tests
    전부 pass — 즉 **현재는 오탐이 없다.** 그러나 그 이유는 "스캔 밖에 있어서"가 아니라, 이
    fixture 가 `swagger-dto-contract` 가 찾는 `@ApiProperty` 류 property 데코레이터나
    `nullable-type-lie-cast` 가 찾는 `null as unknown as X` 캐스트 패턴을 우연히 갖고 있지
    않기 때문이다. 주석의 근거(스캔 루트)가 실제 격리 메커니즘과 다르다.
  - 제안: 코드 변경은 불필요(현재 무해). 다만 주석을 "이 fixture 는 `modules/` 를 스캔 루트로
    쓰는 가드에서만 제외된다 — `src/` 전체를 스캔하는 `swagger-dto-contract`·
    `nullable-type-lie-cast` 같은 형제 가드는 여전히 이 파일을 순회하지만 그쪽이 찾는 패턴이
    이 fixture 에 없어 통과한다"처럼 범위를 정확히 좁히면, 다음 사람이 이 fixture 에 새로운
    "위반 형태" 예시를 추가할 때 의도치 않게 다른 가드를 트리거할 가능성을 미리 알 수 있다.

- 그 외 파일(9개 MDX 문서, `backend-labels.ts`/`backend-labels.test.ts` 의 주석·배열 순서
  변경, `auth.controller.ts` 의 `@ApiParam` 문서 메타데이터 추가, `plan/**` 두 파일)은 순수
  문서·주석·Swagger 메타데이터 변경이거나(런타임 미관여) 테스트 배열의 순서만 바꾼 것으로,
  전역 상태·환경 변수·네트워크 호출·이벤트/콜백에 관측 가능한 영향이 없다. `backend-labels.test.ts`
  의 `LOCALIZED_ERROR_CODES` 재정렬은 이후 `.filter(c => !koKeys.has(c))` 로만 소비되므로
  순서 무관.

## 요약

이번 변경의 실질적 런타임 side effect 는 `rotateBotToken` 의 `:id` 에 `ParseUUIDPipe` 를
추가해 malformed UUID 입력에 대한 응답이 500/INTERNAL_ERROR 에서 400/VALIDATION_ERROR 로
바뀌는 한 곳뿐이며, 이는 `GlobalExceptionFilter` 코드를 직접 대조해 의도대로 동작함을
확인했고 plan 에 사전 근거·형제 엔드포인트 일관성이 기록된 의도된 수정이다(다만 이 동작
자체를 검증하는 e2e/behaviour 테스트는 없고 AST 선언 존재 가드만 있다는 갭은 plan 도 인지·
스코프 아웃한 상태). 새로 추가된 `param-uuid-pipe` 가드/fixture 는 순수 정적 분석 도구로
런타임에 영향이 없으며, fixture 격리 주장이 일부 형제 가드(전체 `src/` 스캔)에는 적용되지
않는다는 점을 실측으로 확인했으나 현재 오탐은 없다. 나머지 파일은 문서·주석·plan 상태
갱신뿐이라 side effect 관점에서 위험이 없다.

## 위험도

LOW
