# 테스트(Testing) 리뷰 — rotate-bot-token-body (2R)

## 검증 절차 메모

- 1R(`17_55_14`)의 유일한 테스트 관점 WARNING — `bodyParamDesignType` 의 두 방어적 에러 분기(`@Body()` 부재,
  `design:paramtypes` 부재)가 `swagger-probe.spec.ts` 자신의 "존재 이유는 에러 경로" 관례를 벗어나 무테스트였던
  문제 — 는 `fafc6b8ac` 로 해소됐다. 실제 파일(`codebase/backend/src/shared/testing/swagger-probe.spec.ts:75-120`)을
  직접 읽어 diff 와 일치함을 확인했고, `npm test -- swagger-probe.spec.ts`(8 passed)·`npm test -- executions-continue-body.spec.ts
  hooks-webhook-body.spec.ts triggers-rotate-bot-token-body.spec.ts swagger-probe.spec.ts`(4 suites, 19 passed) 를
  직접 실행해 실측 확인했다.
- 새로 추가된 네 케이스가 실제로 살아 있는 가드인지 스팟 뮤테이션으로 검증했다: `bodyArgs.length > 1` 조건을
  `false && bodyArgs.length > 1` 로 무력화 → `` `@Body()` 가 둘 이상이면 첫 자리를 내지 않고 던진다 `` 테스트가
  즉시 RED(`Received function did not throw`)로 죽었다 — 저장소 밖 스크래치(`mktemp -d`)에 원본을 `cp` 로
  백업해 두고 수정 → 재실행 → `cp` 로 원복했으며, 원복 후 `git status --short -- codebase/backend/src/shared/testing/swagger-probe.ts`
  는 diff 0 이었다(전체 `git status --short` 도 이 리뷰 세션 산출물 디렉터리만 남기고 깨끗함을 확인).
  1R WARNING·INFO 처방("둘 이상이면 던지도록 방어")이 문서상 주장뿐 아니라 실제로 KILL 함을 이번 라운드에서
  직접 재현했다.
- 1R INFO(`@Body()` 다중 자리 가정 미문서화)도 같은 커밋에서 `bodyArgs.length > 1` 방어 + 전용 테스트로 승격돼
  해소됐다.
- 나머지 8개 소스/DTO/컨트롤러 파일은 1R 이후 diff 가 없다(코드 변경은 `fafc6b8ac` 의 `swagger-probe.ts`/
  `swagger-probe.spec.ts` 만) — `bb1ff4d8f` 시점에 검증됐던 캐너리 11종·뮤턴트 6/6 KILLED 결론은 그대로 유효하다.

## 발견사항

없음 — 1R 에서 지적한 유일한 테스트 갭이 코드로 해소되고 뮤테이션으로 재확인됐다. 신규로 도입된 결함이나
추가로 필요한 테스트는 발견하지 못했다.

## 긍정 관찰 (참고용)

- 신규 4개 에러-경로 테스트(`no @Body()`, `>1개 @Body()`, `design:paramtypes` 부재, "파라미터 순서가 아니라
  라우트 인자 메타데이터로 찾는다"는 전제)는 각각 독립적인 스텁 컨트롤러/클래스를 그 자리에서 선언해
  공유 가변 상태가 없다 — 격리 양호.
- "전제" 테스트(`BodyProbeController.run` — 첫 파라미터가 `string`, 둘째가 `@Body()`)가 "파라미터 순서로 찾으면
  틀린 결과가 나온다"는 구현의 핵심 설계 결정(라우트 인자 메타데이터 사용)을 실제로 판별하는 입력으로 구성돼
  있어 vacuous 하지 않다 — 순서 기반 오구현이었다면 이 테스트가 `String` 을 받아 실패했을 것.
- `design:paramtypes` 부재 케이스는 데코레이터가 전혀 없는 별도 클래스(`Bare`)에 라우트 인자 메타데이터만
  손으로 얹어 "데코레이터가 없어 TS 가 `design:paramtypes` 를 emit 하지 않는" 실제 조건을 그대로 재현한다 —
  인위적으로 조건을 뒤집은 mock 이 아니라 실제 emit 규칙에 기댄 정직한 fixture.
- `Object` 단언은 JS 전역 `Object` 생성자와의 참조 동일성(`toBe`)이라 `design:paramtypes` 가 실제로 `Object`
  를 내는지(=DTO 클래스로 타입되지 않았는지)를 정확히 가른다 — 타입 이름 문자열 비교 같은 약한 단언이 아니다.

## 요약

1R 이 지적한 유일한 테스트 갭(`bodyParamDesignType` 에러 분기 무테스트)이 `fafc6b8ac` 로 해소됐고, 이번 라운드에서
직접 실행(19/19 passed)과 스팟 뮤테이션(가드 무력화 → 즉시 RED)으로 재확인했다. 나머지 3개 라우트 캐너리와
`swagger-probe.ts` 의 기존 에러 경로 테스트는 diff 없이 그대로이며 1R·`bb1ff4d8f` 시점 검증(캐너리 11종, 뮤턴트 6/6
KILLED)이 유효하다. 테스트 관점에서 추가로 필요한 조치는 없다.

## 위험도

NONE
