# 테스트(Testing) 리뷰

## 검증 방법

`origin/main..HEAD` 누적 diff(§5.4 응답 계약 검증자 신설 → `AuditLogsService.findAll` 민감정보
유출 수정 → 자기참조/`oneOf` 사각지대 수정 → `ExecutionDto` 스키마 가드 신설)를 대상으로, 저장소의
최종 코드 상태를 직접 열어 다음을 확인했다.

- `codebase/backend/src/shared/testing/response-contract.ts` / `.spec.ts` 전문
- `codebase/backend/src/modules/audit-logs/audit-logs.service.ts` / `.spec.ts` 전문
- `codebase/backend/src/modules/executions/dto/responses/execution-response.dto.spec.ts` 전문
- 4개 e2e 스펙(`audit-logs`/`session-revocation`/`workflow-crud`/`workflow-execution`)의 계약
  대조 배선 지점
- `git log --oneline`으로 `origin/main..HEAD`의 커밋 이력과, 현재 브랜치 HEAD(`6a6621ecd`)가
  이전 라운드(`review/code/2026/09/05/15_31_41`)가 리뷰한 코드 상태와 **동일**함을 대조
  (`git status --short`·`git log --oneline -3 -- codebase/` 로 그 라운드 이후 `codebase/`
  변경 커밋이 없음을 확인)
- **직접 실행**: `npx jest audit-logs.spec.ts response-contract.spec.ts
  execution-response.dto.spec.ts` → `3 suites / 75 tests 모두 통과` (`Time: 1.032s`) — 이전
  라운드의 RESOLUTION.md에 기록된 "unit 447 스위트/9,404 통과" 주장을 이번 라운드에서 좁혀
  독립 재실행으로 재확인했다.

저장소 트리에는 아무것도 쓰지 않았다(읽기 전용 `Read`/`Bash` 조회 + jest 실행만, `git status
--short` 로 무변경 확인 — 신규 리뷰 산출물 디렉터리 외 변경 없음).

## 이전 라운드 대비 상태

`codebase/**`는 `5fcb5c625`(자매 `workspace` 필드 좁히기 + `ExecutionDto` 스키마 가드) 이후
**변경이 없다** — 즉 이번 라운드가 보는 코드는 직전 테스트 리뷰(`15_31_41/testing.md`)가 이미
전문 대조한 것과 동일한 최종 상태다. 그 라운드가 낸 Critical 2건(감사 로그 26키 유출, 자기참조
DTO 검증 우회)과 WARNING 1건(`oneOf`/`anyOf` 사각지대)은 모두 해소가 커밋 이력·테스트로
확인됐고, 이번 라운드에서 다시 읽어도 회귀는 없다.

## 발견사항 (모두 기존 라운드에서 이미 실측·처분된 항목 — 재확인만)

- **[INFO]** `descend()`의 방어 분기(참조된 `$ref` 이름이 생성 문서의 `schemas`에 없는 경우)가
  어떤 테스트로도 걸리지 않는다
  - 위치: `codebase/backend/src/shared/testing/response-contract.ts` — `descend()` 함수의
    `const nested = names.map(...).filter(...)` 다음 `if (nested.length === 0) return;` (194~204행)
  - 상세: 지금 `response-contract.spec.ts`의 모든 중첩 픽스처(`NestedDto`/`CycleDto`/
    `UnionDto`+`VariantA/BDto`)는 `contractForDto()`가 **한 문서**에서 스키마와 `$ref`를 함께
    생성하므로 항상 `schemas`에 존재한다 — 이 분기가 실제로 걸리는 도달 경로가 오늘은 없다.
    이 상태는 새로운 지적이 아니라 `review/code/2026/09/05/14_39_31`(INFO#2 최초 등재)→
    `15_31_41`(RESOLUTION INFO#2 "오늘 도달 경로가 없다, `contractForDto`가 여러 문서를 다루게
    되면 그때가 실 도달 시점"으로 명시 유예)에서 이미 실측 근거와 함께 처분된 항목이다. 코드가
    그 이후 바뀌지 않았으므로 재실측해도 결론이 같다 — **재지적하지 않고 확인만 기록**한다.
  - 제안: 조치 불요. `15_31_41/RESOLUTION.md`의 유예 근거가 여전히 유효하다.

- **[INFO]** `workflow-execution.e2e-spec.ts`의 `assertMatchesContract` 배선이 "정상 완료" 응답
  1건만 대조한다 — `ExecutionDto`의 실패/미완료 전용 필드(`error`·`finishedAt`·`durationMs` 등
  optional+nullable 10개)가 "값이 실제로 채워진" 형태로는 한 번도 검증되지 않는다
  - 위치: `codebase/backend/test/workflow-execution.e2e-spec.ts` — `'B. GET
    /api/executions/workflow/:workflowId ...'` 테스트, `assertMatchesContract(mine,
    executionContract)` 호출부
  - 상세: 이 워크플로우는 실패 조건이 없는 Manual Trigger 전용이라 항상 `completed`로
    끝난다. 이 갭도 새 지적이 아니라 `15_31_41/testing.md` INFO#2 → 같은 라운드
    `RESOLUTION.md` INFO#3에서 "§5.4 drift 배치 2단계(스윕) 항목에 속한다"로 이미 위임된
    것과 동일하다 — `plan/in-progress/spec-draft-nullable-notation-followups.md`의 "§5.4 drift
    배치 — 2단계" 트래커가 이 10개 필드를 정확히 그 잔여 스윕 대상으로 잡고 있다.
  - 제안: 조치 불요(이번 PR 범위 밖, 트래커로 위임 완료).

## 좋았던 점 (직접 확인)

- 3개 스펙 파일을 독립적으로 실행해 **75/75 통과**를 직접 확인했다 — 문서상 주장이 아니라
  실측이다.
- 감사 로그 유출 회귀는 unit(`qb.leftJoin`/`addSelect` 호출 인자 정확히 대조 +
  `expect(qb).not.toHaveProperty('leftJoinAndSelect')`로 stale 목 방지)과 e2e(계약 대조 +
  `Object.keys(user).sort()` 독립 캐너리) 두 층으로 이중화되어 있어, 검증자 자체에 버그가
  있어도 unit 층이 단독으로 회귀를 잡는다.
- `response-contract.spec.ts`는 §5.4의 네 가지 선언 형태를 `ProbeDto` 한 픽스처에 모아 각
  축을 독립적으로 물고, `[전제]` 테스트로 "스키마가 실제로 그 축들을 담고 있는가"를 먼저
  확인해 vacuous-test 함정을 스스로 방어한다. 자기참조(`CycleDto`) 테스트는 과거 라운드가
  실측한 vacuous 캐너리(완전히 유효한 payload만 대조)를 실제 위반 주입 형태로 교체해 판별력을
  확보했다.
- `execution-response.dto.spec.ts`는 22개 프로퍼티를 3개 목록(required+non-nullable 11 ·
  required+nullable 1 · optional+nullable drift 10)으로 갈라 고정하고, `[전제]` 테스트로 세
  목록의 합이 전체 프로퍼티를 빠짐없이 덮는지 먼저 확인한다. plan 문서 기록상 `triggerLabel`의
  데코레이터+TS 타입을 동시에 optional로 되돌리는 뮤턴트에 RED 2건을 낸 것이 확인되어 있다 —
  "AST 가드도 tsc도 못 잡는다"고 지목됐던 바로 그 회귀 형태를 이 가드가 실제로 잡는다.
  다만 이 뮤턴트 실측 자체는 이전 커밋의 기록(plan 문서)에 의존한 것이지 내가 이번 라운드에서
  재현한 것은 아니다 — 코드가 바뀌지 않았고 3라운드 연속 같은 결론이라 재현하지 않았다.
- 4개 e2e 스펙 전부 `contractForDto()`를 `beforeAll`에서 1회 호출해 재사용하는 형태로
  통일되어 있고(반복 호출 시 매번 Nest 테스트 모듈 전체를 부트스트랩하는 비용을 피함), 기존
  `uniqueEmail`/`uniqueName` 격리 패턴을 그대로 따라 새 단언이 테스트 간 의존성을 만들지
  않는다. `session-revocation.e2e-spec.ts`의 `assertMatchesContract(sessions[0], ...)` 앞에는
  `expect(sessions.length).toBeGreaterThanOrEqual(2)`가 먼저 있어 빈 배열 인덱싱 위험이 없다.

## 요약

이번 라운드가 보는 `codebase/**` 최종 상태는 직전 테스트 리뷰(`15_31_41`)가 이미 전문 대조한
것과 **동일**하다(그 이후 `codebase/` 커밋 없음). 그 라운드가 낸 Critical 2건·WARNING 1건은
전부 실측 기반으로 해소되고 판별력 있는 회귀 테스트로 고정되어 있음을 재확인했고, 3개 핵심 스펙
파일(`audit-logs.spec.ts`/`response-contract.spec.ts`/`execution-response.dto.spec.ts`)을 이번
라운드에서 직접 실행해 75/75 통과를 독립적으로 검증했다. 남은 것은 이미 두 라운드 전에 실측
근거와 함께 명시적으로 유예된 INFO 2건(`descend()`의 도달 불가능한 `unresolved-ref` 방어
분기, `workflow-execution` e2e의 "완료" 경로 한정 커버리지)뿐이며 둘 다 §5.4 스윕
트래커(`plan/in-progress/spec-draft-nullable-notation-followups.md`)로 위임되어 있어 이번 PR
범위에서 추가 조치를 요구하지 않는다. 새로 발견한 테스트 결함은 없다.

## 위험도

LOW
