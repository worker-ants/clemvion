# 요구사항(Requirement) 리뷰 — trigger-canary-hardening (라운드 6)

## 검토 방법

`plan/in-progress/trigger-canary-hardening.md` 가 선언한 4개 항목(① 비밀 컬럼 3중 사본
repo-guard, ② `TriggerDto.workflow`(schedule) 양성 커버리지, ③ 캐너리 두 파일 주석 정리,
④ e2e teardown 근거 정정)을 기준으로 `git diff origin/main...HEAD` 전체(코드 6파일 +
plan/review 산출물 다수)를 읽고, 신규 repo-guard(`trigger-secret-columns-{guard,spec}.ts`)를
실제로 `npx jest` 로 실행, `tsc -p tsconfig.json --noEmit` / `tsc -p tsconfig.build.json
--noEmit` 로 대상 파일에 타입 오류가 없는지 직접 확인했다. 관련 spec
(`spec/2-navigation/2-trigger-list.md`, `spec/2-navigation/3-schedule.md`,
`spec/conventions/secret-store.md`)과 `TRIGGER_RESPONSE_STRIP_COLUMNS`/
`TRIGGER_SECRET_COLUMNS`/`triggers.service.ts update()`/`findById()` 구현을 대조했다. 저장소
트리에는 아무것도 쓰지 않았다(`git status --short` 로 확인 — 신규 review 산출물 디렉터리
외 변경 없음).

## 발견사항

- **[INFO]** 항목 ①(비밀 컬럼 3중 사본 repo-guard)이 기능적으로 완전하다 — 직접 실행 확인.
  - 위치: `codebase/backend/src/repo-guards/__tests__/trigger-secret-columns-guard.ts`,
    `.../trigger-secret-columns.spec.ts`
  - 상세: `TRIGGER_RESPONSE_STRIP_COLUMNS`(정본, `triggers.service.ts`) ·
    `TRIGGER_SECRET_COLUMNS`(`schedule-trigger-ref.ts` · `trigger-workflow-ref.ts`) 세 곳의
    값·순서(`['notificationSecretV2', 'chatChannelTokenV2']`)가 실제로 일치함을 직접 grep 대조로
    확인했다. `readStringArrayConst`의 `unwrap()`이 `AsExpression`/`SatisfiesExpression`/
    `ParenthesizedExpression`을 루프로 벗기는 로직은 정본의 `as const satisfies readonly
    (keyof Trigger)[]` 형태와 사본의 `as const` 형태 양쪽에서 정확히 동작함을 `npx jest
    src/repo-guards/__tests__/trigger-secret-columns.spec.ts`로 재현 확인(12/12 GREEN, 대조군
    포함). `repoRoot = path.resolve(__dirname, '../../../../..')`가 실제 저장소 루트로
    정확히 resolve됨도 직접 확인했다. 대상 파일 부재 시 raw `ENOENT` 대신 가드 자체 메시지로
    throw하는 분기, 배열 아닌 값·비-문자열 원소 혼입 시 `null` 반환(빈 배열과 구분) 등 엣지
    케이스 처리가 전부 대조군 테스트로 뒷받침된다. 결함 없음.

- **[INFO]** 항목 ②(schedule `TriggerDto.workflow` 양성 커버리지)의 구현이 spec 서술 및
  실제 서비스 로직과 정합한다.
  - 위치: `codebase/backend/test/schedule-trigger.e2e-spec.ts` C-2(목록)·G·H(PATCH) 케이스
  - 상세: `spec/2-navigation/2-trigger-list.md:182-192`는 `TriggerDto.workflow`가 "생성
    응답에만" 부재하고 "목록·상세·수정(`update()`가 `findById`로 시작한다)에는 채워진다"고
    명시한다. `triggers.service.ts:342-345`의 `findById()`가 `relations: ['workflow']`를
    포함하고, `update()`(line 462-582)가 `chatChannel`이 없는 PATCH(G·H 케이스가 바로 이
    경로)에서는 `saved = findById 결과를 in-place mutate 후 save()`한 값을 그대로
    `sanitizeForResponse`에 넘긴다는 것을 직접 코드로 추적 확인했다 — G·H가
    `expectTriggerWorkflowRef(patch.body.data, { present: true, expectedWorkflowId })`를
    기대하는 것과 정확히 일치한다. C-2(목록)도 `assertMatchesContract` 뒤에 새 단언을
    추가해 §5.4 키 생략형이 통과시키는 관계 로딩 누락을 별도로 잡는다는 plan의 주장과
    부합한다.

- **[INFO]** `[SPEC-DRIFT]` `spec/2-navigation/2-trigger-list.md`의 `code:` frontmatter가
  §3(`TriggerDto.workflow` 계약)의 시행 파일로 `trigger-workflow-ref.e2e-spec.ts`만 등재하고
  있고, 이번 PR이 `schedule-trigger.e2e-spec.ts`에도 같은 계약을 처음 시행하는 단언을 추가했다.
  - 위치: `spec/2-navigation/2-trigger-list.md:20-22` (frontmatter `code:` 목록) vs
    `codebase/backend/test/schedule-trigger.e2e-spec.ts` C-2·G·H
  - 상세: 코드 쪽 확장(스케줄 타입에도 같은 계약을 e2e로 고정)은 spec §3/§5.4 서술과 완전히
    합치하며 정당한 강화다 — 코드가 틀린 것이 아니라 spec의 evidence 등록(`code:` glob)이
    새 시행 파일을 아직 반영하지 못한 상태다. **이미 developer 권한 밖으로 인지되어
    `plan/in-progress/spec-draft-nullable-notation-followups.md:3960-3966`에 planner 턴
    대기 항목으로 정확히 등재돼 있다**(`code:` 에 `schedule-trigger.e2e-spec.ts` 추가 처분
    명시). 새로 지적할 필요 없이 기존 등재가 유효함을 확인.
  - 제안: 코드 유지. spec 반영은 `spec/2-navigation/2-trigger-list.md` frontmatter `code:`
    목록에 `codebase/backend/test/schedule-trigger.e2e-spec.ts` 추가(이미 트래커에 명시된
    처분과 동일 — 재등록 불요).

- **[INFO]** 단건 조회(`GET /api/triggers/:id`) 경로의 schedule `workflow` 양성 커버리지가
  이번 배치에 포함되지 않았으나, 이는 의도된 유예이며 근거가 정확하다.
  - 위치: `codebase/backend/test/schedule-trigger.e2e-spec.ts` (해당 엔드포인트를 exercise하는
    케이스 자체가 이 파일에 없음)
  - 상세: `plan/in-progress/trigger-canary-hardening.md` §A.2가 "이 파일에 단건 `GET
    /api/triggers/:id`는 없다 — 그래서 셋이다"라고 명시하고,
    `spec-draft-nullable-notation-followups.md:4002-4007`에 별도 후속 항목으로 등재했다.
    실제로 파일을 확인한 결과 `GET /api/triggers/:id`를 호출하는 `it()`가
    `schedule-trigger.e2e-spec.ts`에 없음을 확인했다 — 유예 근거가 사실과 일치한다.
    회귀 방어 구멍이 완전히 닫히지는 않았지만(단건 경로는 아직 무방비), 조용히 누락된 것이
    아니라 명시적으로 스코프 아웃되고 후속 트래커에 올라 있어 "미완성 작업"으로 오인될
    위험은 낮다.
  - 제안: 조치 불필요(이미 등재됨). 후속 세션에서 §A.2 뮤테이션 표에 준하는 뮤턴트 검증과
    함께 닫을 것.

- **[INFO]** `readStringArrayConst`가 이름이 같은 지역 변수(예: 함수 내부 스코프의 동명
  `const`)를 대상 최상위 상수보다 먼저 만나면 오판할 수 있는 이론적 여지가 있으나, 대상
  3개 파일 모두 최상위 단일 선언이라 현재는 영향이 없다.
  - 위치: `codebase/backend/src/repo-guards/__tests__/trigger-secret-columns-guard.ts` —
    `visit()` 함수 (파일 내 `const visit = (node: ts.Node): void => {`로 시작하는 블록)
  - 상세: `ts.forEachChild(node, visit)`으로 전체 AST를 순회하며 `found === null` 조건으로
    첫 매치만 채택한다. 만약 정본/사본 파일에 같은 이름의 지역 변수가 먼저 등장하면(현재는
    없음) 잘못된 배열을 읽을 수 있다. 대상 파일이 세 개로 고정되어 있고 헤더 JSDoc이 "이
    가드가 보는 것은 여기 적힌 자리뿐"이라고 스코프를 이미 명시적으로 좁혀 두었으므로,
    사소한 이론적 엣지 케이스이며 결함으로 등재할 정도는 아니다.
  - 제안: 조치 불필요(참고용 기록).

- **[INFO]** TODO/FIXME/HACK/XXX 등 미완성 표시 주석 없음. 신규/변경 파일 전체에 grep한
  결과 0건.

## 요약

이번 PR(라운드 6, 최종 상태)은 plan이 선언한 4개 항목을 모두 정확히 구현한다 — 비밀 컬럼
3중 사본 정합 repo-guard는 AST 기반으로 정본·사본의 서로 다른 wrapper 형태(`as const
satisfies …` vs `as const`)를 모두 올바르게 읽고, 대상 파일 부재·비-배열·비-문자열 원소 등
엣지 케이스를 명시적으로 갈라 처리하며 직접 실행(12/12 GREEN)으로 확인했다. schedule
`TriggerDto.workflow` 양성 커버리지 추가(C-2·G·H)는 `triggers.service.ts`의 실제 `findById`/
`update()` 흐름과 spec `2-trigger-list.md`/`3-schedule.md` 서술 양쪽과 line-level로 합치한다.
유일한 spec 불일치는 `2-trigger-list.md`의 `code:` frontmatter가 새 시행 파일
(`schedule-trigger.e2e-spec.ts`)을 아직 등재하지 못한 것인데, 이는 코드가 틀린 것이 아니라
spec의 evidence 목록 갱신이 지연된 것(SPEC-DRIFT)이며 이미 별도 트래커에 planner 턴 대기
항목으로 정확히 등재돼 있어 재조치가 불필요하다. 단건 조회 경로의 커버리지 부재도 동일하게
의도된 유예로 명시·등재돼 있다. TODO/FIXME 등 미완성 흔적은 없으며, 모든 경로에서 적절한
반환값(`string[] | null`, 명확한 `null`/빈 배열 구분)을 낸다. 5라운드에 걸친 선행 리뷰가
이미 vacuity·문서 수치 불일치 등을 촘촘히 걸러낸 상태라 이번 회차에서 새로 발견된 CRITICAL/
WARNING급 결함은 없다.

## 위험도

NONE
