# 테스트(Testing) 리뷰 — `ExecutionStatusDto` 5필드 `required` false→true (최종 순 diff)

## 검토 방법

`git log origin/main..HEAD` 로 이 브랜치의 5개 커밋(83곳 flip → 15곳으로 축소 → plan 기록 →
5곳으로 재축소 → plan 완료 이동)의 **순 변경분**을 확인했다. `git diff origin/main...HEAD --stat --
codebase/` 결과 실제 코드 변경은 정확히 2개 파일(`execution-status-response.dto.ts`,
`execution-status-response.dto.spec.ts`, 43 insertions / 13 deletions)로 좁혀져 있다 —
`ExecutionDto`(`execution-response.dto.ts`) 10필드는 두 번째 축소 커밋에서 되돌려져 net diff 에
등장하지 않는다. 나머지 프롬프트 파일(4~46번)은 plan 라이프사이클 이동과 이전 코드 리뷰
(`14_54_36`, `15_22_06`)·consistency-check(`15_16_28`, `15_42_35`) 세션의 산출물 커밋이며, 실질
테스트 코드가 아니다.

`codebase/backend` 에서 대상 spec 파일을 직접 `npx jest` 로 실행해 **20/20 GREEN** 을 재확인했다.
추가로 CHANGELOG 가 주장하는 뮤테이션 결과("RED 1건")를 독립적으로 재현했다 — `currentNode` 를
`@ApiPropertyOptional`/`?:` 로 되돌린 뮤턴트를 저장소 밖 scratch 에 원본을 백업해 둔 뒤 원위치에서
직접 적용해 실행하니 **정확히 새 `required` 단언 1건만 RED, 나머지 19건은 GREEN** 이었다(실측
출력: `Received: [..., "durationMs", "context", "result", "error", ...]` — `currentNode` 만
목록에서 빠짐). 이후 `cp` 로 원본을 복원하고 `git status --short`/재실행(20/20 GREEN)으로 원복을
확인했다 — 저장소에 남은 잔여물은 이 리뷰 세션 자체의 출력 디렉터리(`review/code/.../15_49_38/`)
뿐이다.

## 발견사항

없음 (Critical/Warning 없음). 이전 두 라운드(`14_54_36`, `15_22_06`)의 testing WARNING 4건(W1:
tsc 검증이 패스스루 컨트롤러엔 미적용 · W2: 유일한 스키마 테스트가 `required` 축 미검사 · W3(공유
maintainability 지적이지만 이 파일에 해당): `it.each`/`arrayContaining` 목록 이중 하드코딩 · W4:
`ExecutionDto` 스키마 테스트 부재)는 이번 순 diff 시점 기준 전부 해소돼 있다 — 배치를 83→15→5로
좁혀 검증되지 않은 78곳(패스스루 68 + `ExecutionDto` 10)을 전부 되돌렸고, `NULL_PRESENT_FIELDS`
단일 상수로 두 단언(`nullable`/`required`)을 통합했다.

## 검증한 항목 (문제 없음 확인)

1. **회귀 가드의 실효성(뮤테이션 검증)** — 위 방법대로 독립 재현. `nullable` 만 보던 종전 방식이
   놓치던 회귀(`@ApiPropertyOptional` 로 되돌리면 `nullable` 은 유지된 채 `required` 만 빠짐)를 새
   `it('null 을 쓰는 다섯 필드는 required 이기도 하다 — 상시 존재')` 가 정확히 잡는다. 거짓 GREEN
   (vacuous test)이 아니다.
2. **필드 목록 정합성** — `NULL_PRESENT_FIELDS = ['result','error','durationMs','currentNode','context']`
   가 `execution-status-response.dto.ts` 에서 실제로 `@ApiPropertyOptional`→`@ApiProperty` 로
   전환된 5개 필드와 정확히 일치함을 소스 직접 대조로 확인. 드리프트 없음.
3. **DRY 회귀 수정 확인** — 종전엔 `it.each` 튜플 목록과 `arrayContaining` 문자열 목록이 각각
   하드코딩돼 한쪽만 갱신되는 경로가 있었다(2R maintainability W3). 지금은 두 단언 모두
   `NULL_PRESENT_FIELDS` 하나를 참조 — 향후 필드 추가 시 상수 한 곳만 갱신하면 된다.
4. **테스트 격리** — `beforeAll` 로 `buildSwaggerDocument` 를 1회 빌드해 `describe` 블록 전체가
   공유하지만, 모든 `it` 이 `executionStatus`/`schemas` 를 읽기만 하고 뮤테이션하지 않아 순서 의존성
   없음(무작위 순서 실행으로도 동일 결과일 것으로 판단, 별도 shuffle 실행은 생략).
5. **가독성** — 새 JSDoc 이 "왜 이 단언이 필요한가"(§5.4 의 두 축: nullable + required)와 "리뷰
   1R W2/2R W3 를 직접 인용"까지 남겨, 이 테스트가 왜 존재하는지 추적 가능하다.
6. **잔존 커버리지 갭(이 diff 의 결함 아님, 백로그로 정확히 등재됨)** — `ExecutionDto` 는 이번에
   되돌려져 `execution-response.dto.spec.ts` 자체가 아직 없다(스키마 레벨 테스트 0건, 프로젝트
   전체 검색으로 재확인). `plan/in-progress/spec-draft-nullable-notation-followups.md` 의 "2단계"
   항목이 이 갭을 명시하고 재개 시 `execution-status-response.dto.spec.ts` 패턴으로 신설할 것을
   요구하고 있어, 미해결이 아니라 조건부 유예로 정확히 문서화돼 있다.
7. **e2e 뒷받침** — `test/external-interaction.e2e-spec.ts` 가 실제 HTTP 응답에서
   `res.body.data.result`(null 값)·`res.body.data.currentNode`(waiting 상태) 키 존재를 이미
   단언하고 있어, `getStatus()` 조립부가 tsc 구조 체크뿐 아니라 런타임에서도 이 5필드를 항상
   포함한다는 주장에 대한 독립적 뒷받침이 있다.

## 요약

이번 순 diff(`origin/main..HEAD`)의 실질 테스트 표면은 `execution-status-response.dto.ts`(5필드
데코레이터 전환)와 그 spec 파일(회귀 가드 확장)뿐이다. 이전 두 라운드에서 지적된 testing
Critical/Warning 은 모두 이번 diff 시점에 해소돼 있으며, 핵심 주장(`required` 단언이 실제로
회귀를 잡는다, `nullable` 단언은 계속 GREEN)을 저장소 밖 백업 후 실제 뮤테이션으로 독립
재현해 정확히 일치함을 확인했다(RED 1/20, 복원 후 GREEN 20/20). `NULL_PRESENT_FIELDS` 상수
통합으로 이중 하드코딩 드리프트 경로도 닫혔다. 유일하게 남은 커버리지 갭(`ExecutionDto` 등
78곳의 스키마 레벨 테스트 부재)은 이번 diff 가 만든 것이 아니라 검증자 부재를 이유로 의도적으로
되돌리고 조건부로 유예된 것이며, 재개 조건(반환 타입 명시 또는 응답 대조 테스트)과 후속 테스트
신설 요구가 plan 문서에 정확히 남아 있다. 테스트 관점에서 조치가 필요한 신규 발견사항은 없다.

## 위험도

NONE
