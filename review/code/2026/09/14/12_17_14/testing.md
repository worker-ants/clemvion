# 테스트(Testing) 리뷰 — trigger-canary-hardening (라운드 3, `12_17_14`)

## 검증 방법

이 diff 는 이미 라운드 1(`11_27_40`)·라운드 2(`11_52_13`)를 거쳤고, 실제 코드(파일 1~6)는
그 두 라운드의 fix 커밋(`4c1a49b30`, `3f5e451b3`) 이후 **추가로 바뀐 것이 없다**
(`git log --oneline -- <6개 파일>` 로 확인 — 이번 라운드는 커밋에 review 산출물이 새로 얹힌
상태의 재검토). 과거 두 라운드가 이미 촘촘히 훑었으므로, 되풀이 대신 **뮤테이션으로 새 갭을
찾는 데** 집중했다.

- `npx jest src/repo-guards/__tests__/trigger-secret-columns.spec.ts` → **10/10 GREEN**
  (라운드 2 가 추가한 "파일 부재 → 메시지 매칭" 케이스 포함, 커밋된 상태 그대로 확인).
- `npx jest src/shared/testing/trigger-workflow-ref.spec.ts` → **12/12 GREEN**
  (이번 diff 는 이 파일에 대해 주석/표기(원문자→숫자)만 바꾸므로 로직 회귀 없음을 재확인).
- `npx tsc --noEmit -p tsconfig.json` → 이 6개 파일 관련 에러 **0건**.
- **뮤테이션(신규)**: `trigger-secret-columns-guard.ts` 의 `unwrap()` 에서
  `ts.isParenthesizedExpression` 분기(원본 73~74행)를 통째로 제거 → 저장소 파일에 직접
  적용(사본은 `mktemp -d` 밖 scratch 에 보관) 후 재실행 → **10/10 GREEN 유지**(RED 0건).
  즉시 `cp` 로 원복, `git status --short` 로 잔여물 없음 확인, 원복 후 재실행도 10/10 GREEN.

## 발견사항

- **[WARNING]** `unwrap()` 의 `ParenthesizedExpression` 언랩 분기가 **어떤 테스트로도 커버되지 않는다** — 통째로 지워도 스위트가 전부 통과한다.
  - 위치: `codebase/backend/src/repo-guards/__tests__/trigger-secret-columns-guard.ts:73-74` (`unwrap` 함수, `ts.isParenthesizedExpression(cur)` 분기)
  - 상세: 이 가드의 JSDoc(같은 파일 37~41행, "**래퍼를 «전부» 벗긴다.**")은 `as`·`satisfies`·괄호 세 가지를 언랩 대상으로 명시하고, 실제로 `unwrap()` 은 `AsExpression`/`SatisfiesExpression`/`ParenthesizedExpression` 세 분기를 갖는다. 그런데 `trigger-secret-columns.spec.ts` 의 대조군(`describe('[대조군] readStringArrayConst 가 무엇을 읽고 무엇을 거절하는가')`, 96~173행)은 `as`(132~135행 "래퍼가 없어도 읽는다")와 `as const satisfies`(124~130행)만 fixture 로 가지고 있고, **괄호로 감싼 선언**(예: `const X = (['a'] as const);`)을 다루는 케이스가 하나도 없다. 실제 정본·사본 3개 소스도 괄호로 감싸지 않는다(`triggers.service.ts:104`, `schedule-trigger-ref.ts:24`, `trigger-workflow-ref.ts:45` 직접 열람 확인) — 그래서 "세 목록이 같다" 통합 테스트도 이 분기를 우연히도 타지 않는다. 뮤테이션으로 직접 확인한 결과 이 분기를 제거해도 **10/10 GREEN** 이라 CI 는 이 회귀를 절대 못 잡는다. 이 프로젝트가 같은 파일에서 이미 한 번 겪은 패턴과 형태가 같다 — 라운드 2 WARNING#2 가 "`existsSync` 방어 분기가 추가됐지만 영구 테스트로 결속되지 않았다"를 지적했고, 이번엔 "애초부터 있던 언랩 분기 하나가 처음부터 결속된 적이 없다"는 점이 다르다. `unwrap()` 이 표방하는 "전부 벗긴다"는 설계 근거가 지금은 **2/3만 실측된 채** JSDoc 에 "전부"라고 적혀 있다.
  - 제안: `describe('[대조군] ...')` 블록에 한 케이스 추가 — 예: `write('paren.ts', "const X = (['a', 'b'] as const);\nexport default X;")` 후 `expect(readStringArrayConst(tmp, rel, 'X')).toEqual(['a', 'b'])`. 기존 `write()` 헬퍼 재사용이라 비용이 낮다. 또는 JSDoc 의 "전부 벗긴다" 주장 범위를 "as·satisfies (괄호는 현재 실측 없음)"으로 좁혀 적는 방법도 있으나, 실제로 언랩이 필요할 수 있는 형태이므로 테스트를 추가하는 편이 낫다.

- **[INFO]** (carry-forward, 라운드 2 이미 발견·의도적 유보) `readStringArrayConst` 가 동명(同名)의 비-최상위 선언과 실제 대상을 구분하지 않는 축은 여전히 테스트 0건.
  - 위치: `codebase/backend/src/repo-guards/__tests__/trigger-secret-columns-guard.ts` `visit()` 함수(81~103행), `found === null` 게이트.
  - 상세: 라운드 2 testing.md(INFO#2)·RESOLUTION.md(INFO#4)가 이미 이 축을 지적했고 "대상 3파일에 해당 없음, JSDoc 에 «최상위 하나» 가정을 적을지는 다음 접촉 시" 로 명시적으로 유보했다. 이번 라운드에서 직접 확인한바 그 유보 상태 그대로다 — `visit()`/`unwrap()` 관련 JSDoc(1~65행)에 "최상위 선언 하나만 있다고 가정한다"는 문구가 아직 추가되지 않았고(grep 0건), 대응 테스트도 없다. 재차 차단 사유로 등재하는 것은 아니다 — 이미 근거를 남기고 유보한 항목이 그대로 유지되고 있음을 확인하는 차원.
  - 제안: 이전 라운드의 제안과 동일(급하지 않음) — 다음에 이 가드 파일을 손댈 때 JSDoc 한 줄 또는 케이스 추가.

- **[INFO]** (carry-forward, 라운드 1 이미 트래커 등재) `schedule-trigger.e2e-spec.ts` 는 단건 `GET /api/triggers/:id` 케이스가 없어 `TriggerDto.workflow` 의 단건 조회 경로 양성 커버리지가 이 파일 스코프에서는 0건.
  - 위치: `plan/in-progress/trigger-canary-hardening.md:104` (파일 스코프 설명, "이 파일에 **단건 `GET /api/triggers/:id`** 는 없다")
  - 상세: plan 문서가 스스로 이 갭을 §A.2 표에서 인지하고 있고, 라운드 1 RESOLUTION 이 "등재 — 케이스 자체가 없어 «한 줄» 이 아니다"로 이미 트래커에 넣었다. 은폐가 아니라 스코프를 명시적으로 좁힌 것이므로 이번 라운드에서 새 차단 사유로 잡지 않는다 — 상태 확인 차원의 기록.

- **[INFO]** 회귀 없음 확인 — `trigger-workflow-ref.spec.ts` 의 이번 diff(원문자→아라비아 숫자 표기 통일, 리뷰 이력 문단 제거)는 주석/JSDoc 전용이고 `it()` 본문은 무편집.
  - 위치: `codebase/backend/src/shared/testing/trigger-workflow-ref.spec.ts` 전역
  - 상세: `git diff`(프롬프트 헝크 범위) 대조 결과 hunk 가 헤더 docstring 과 `## 가드 3·5` 헤딩에만 걸리고 `it(...)` 블록 코드는 그대로다. 12/12 GREEN 으로 직접 재확인.

## 관점별 평가

1. **테스트 존재 여부** — 신규 로직(AST 파서 2함수) 모두 대응 테스트 보유. 유일한 미검증 분기는 위 WARNING(괄호 언랩).
2. **커버리지 갭** — 신규 WARNING 1건(괄호 언랩) + 기존 유보 INFO 2건(동명 지역 선언, 단건 GET) — 전부 실위험은 낮지만 명시적으로 남는다.
3. **엣지 케이스** — `null` vs `[]` 구분, 주석 오탐 방지, `satisfies`/`as` 언랩, 비-문자열 원소 거절, 파일 부재(메시지 매칭)까지 대조군이 촘촘하다. 유일하게 빠진 언랩 축(괄호)이 이번 라운드의 신규 발견.
4. **Mock 적절성** — mock 없음(순수 AST 파서 + 실제 파일시스템 + 실 e2e HTTP). 문제 없음.
5. **테스트 격리** — `fs.mkdtempSync`/`afterAll` 로 tmp 디렉터리 격리·정리(`trigger-secret-columns.spec.ts:99-104`). e2e 신규 단언은 기존 `it()` 안에 줄만 추가돼 격리 특성 변화 없음.
6. **테스트 가독성** — 각 케이스가 "왜 이 fixture 인가"를 뮤테이션 근거·리뷰 이력과 함께 명시하는 패턴이 일관적이다. `.toThrow()` 단독이 아니라 메시지 정규식으로 판별하는 습관(153~163행)이 이 저장소의 "`.toThrow()`는 무엇이 던졌는지 안 본다" 교훈을 정확히 반영한다.
7. **회귀 테스트** — 기존 22개(10+12) 테스트 전부 GREEN. `trigger-workflow-ref.spec.ts` 의 주석 전용 diff 는 로직 회귀 없음.
8. **테스트 용이성** — `readStringArrayConst(repoRoot, relPath, constName)` 매개변수화가 좋아 실 대상/tmp fixture 양쪽에 재사용 가능 — 이번 WARNING 도 기존 `write()` 헬퍼로 한 줄이면 메꿔진다.

## 요약

실제 코드(파일 1~6)는 이전 두 라운드의 WARNING(vacuous 삼항식, 파일 부재 방어의 미결속)이 모두 올바르게 고쳐진 상태이며 10/10·12/12 GREEN 을 직접 재확인했다. 이번 라운드에서 뮤테이션으로 새로 찾은 것은, 가드의 `unwrap()` 이 JSDoc 상 "as·satisfies·괄호 전부 벗긴다"고 명시하면서도 **괄호(ParenthesizedExpression) 분기는 어떤 테스트로도 잠겨 있지 않다**는 점이다 — 분기를 통째로 지워도 스위트가 10/10 GREEN 을 유지한다(직접 뮤테이션·원복 확인, `git status --short` 로 잔여물 없음 확인). 실제 세 소스가 현재 괄호를 안 쓰므로 즉각적 실위험은 낮지만, 이 가드 자체가 "판별 자리를 대조군으로 전부 고정한다"는 설계 철학을 표방하고 있어 이 미검증 축을 남겨 두는 것은 그 철학과 어긋난다(WARNING). 그 외 두 건(동명 지역 선언 미구분, schedule 단건 GET 커버리지 0)은 이전 라운드가 이미 근거와 함께 유보·등재한 상태 그대로이며 새로 차단할 사유는 아니다. 프로덕션 코드 변경이 없는 테스트/가드 하드닝 PR 로서 전반적인 테스트 설계 품질은 여전히 높다.

## 위험도

LOW
