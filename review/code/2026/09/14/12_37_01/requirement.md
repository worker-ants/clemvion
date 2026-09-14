# 요구사항(Requirement) 리뷰 — trigger-canary-hardening

## 검토 방법

실질 코드 변경 6개 파일(파일 1~6)을 대상으로, 프롬프트에 diff 가 생략된 파일 1·2 는 저장소에서
직접 `Read` 했고, 나머지 파일 3~6 은 프롬프트 unified diff + 실제 파일 열람으로 대조했다. 핵심
함수(`readStringArrayConst`, `readAllTriggerSecretColumnLists`, `expectTriggerWorkflowRef`)는 실제
호출부(`triggers.service.ts`, `schedule-trigger-ref.ts`, `trigger-workflow-ref.ts`)와 직접 grep
대조했고, `npx jest`로 신규/변경 spec 두 벌(`trigger-secret-columns.spec.ts`,
`trigger-workflow-ref.spec.ts`)을 실행해 문서가 주장하는 GREEN 수치(11/11, 12/12)를 재현 확인했다.
plan/tracker(파일 7·8)의 수치 주장(예: "grep 13")도 grep 재실행으로 대조했다.

## 발견사항

- **[WARNING]** `readStringArrayConst` 가 "선언은 매칭됐지만 초기값이 배열 리터럴이 아닌" 분기를
  전용 테스트로 잠그지 않았다 — 실측으로 생존 뮤턴트를 확인함
  - 위치: `codebase/backend/src/repo-guards/__tests__/trigger-secret-columns-guard.ts` 의
    `readStringArrayConst` 내부 `visit` 함수, 89~101행(`const inner = unwrap(...)` 부터
    `return;` 까지) — 소비 spec 은 `codebase/backend/src/repo-guards/__tests__/trigger-secret-columns.spec.ts`.
  - 상세: 이 함수는 "선언을 찾았지만 형태가 배열이 아니면 `null`" 을 반환해야 한다는 계약을
    JSDoc(43~44행)이 명시한다(`빈 배열과 null 을 가른다`). 코드 자체는 이 계약을 정확히
    지킨다 — `ts.isArrayLiteralExpression(inner)` 가 거짓이면 `found` 를 건드리지 않고
    `return;` 하므로 `null` 이 유지된다. 그런데 spec 의 8개 `it()`(comment/satisfies/bare/
    parens/missing-name/empty/absent-file/spread) 중 **"이름은 일치하지만 값이 배열이 아닌"**
    케이스(예: `const X = 5 as const;`, `const X = 'str';`)가 없다. 이 정확한 지점에
    `found = out` 대신 `found = []`를 반환하도록 바꾸는 뮤턴트를 이 세션의 shared worktree 에서
    관측했는데(아래 절차 노트 참고), 그 뮤턴트 상태에서 `npx jest
    src/repo-guards/__tests__/trigger-secret-columns.spec.ts` 를 실제로 돌리면 **11/11 GREEN 유지**
    — 즉 이 분기는 CI 로 회귀를 못 잡는다. 실제 대상 3개 파일(정본 1 + 사본 2)이 항상 배열
    리터럴을 쓰므로 지금 당장 기능 결함은 아니지만, 이 PR 자체가 "GREEN 은 증거가 아니다" 원칙
    아래 `as`/`satisfies`/괄호 unwrap·ENOENT·spread-원소·null-vs-`[]` 모든 다른 분기를 하나하나
    대조군으로 잠갔던 것과 대비하면, 같은 클래스의 분기 하나가 아직 열려 있다.
  - 제안: `it('선언은 있지만 배열이 아니면 null', () => { const rel = write('non-array.ts',
    "const X = 5 as const;\nexport default X;"); expect(readStringArrayConst(tmp, rel,
    'X')).toBeNull(); });` 형태의 대조군 추가.

## 절차 노트 — 공유 워크트리 뮤테이션 관측 (내가 만들지 않음, 원복하지 않음)

리뷰 도중 `git status --short` 로 확인한 결과, 위에서 지적한 바로 그 파일
(`codebase/backend/src/repo-guards/__tests__/trigger-secret-columns-guard.ts`)이 **이미
uncommitted 상태로 수정**되어 있었다 — 89~90행 부근에 `// MUTATION: pretend non-array
initializers are an empty array instead of null.` 주석과 함께 `found = []; return;` 분기가
삽입돼 있었다(diff 는 `readStringArrayConst`의 배열-아님 분기를 `null` 대신 `[]`로 바꾸는
정확히 위 WARNING과 같은 형태). **이 수정은 내가 만든 것이 아니다** — 세션 시작 직후 `Read`
로 이 파일을 열었을 때는 원본(뮤테이션 없는) 내용이었고, 이후 나는 이 파일에 `Edit`/`Write`
를 호출한 적이 없다. 같은 워킹트리를 동시에 읽는 다른 reviewer(아마도 testing 계열)가 같은
가설을 검증 중인 것으로 보인다. 규약상 `git checkout`/`git restore` 로 되돌리는 것은 금지돼
있고 이 mutation 이 내 작업도 아니므로 **그대로 두었다** — 원복하지 않았음을 명시한다. 위
WARNING 의 결론(11/11 GREEN 유지)은 이 관측된 상태를 그대로 실행해 확인한 것이며, 별도로
논리를 직접 추적해도(원본 코드의 `visit` 분기 구조상 이 경로가 `null`을 반환하는데 그 경로를
때리는 테스트가 없다는 사실은) 뮤테이션 유무와 무관하게 성립한다.

## 검증한 사항 (문제 없음)

- `CANONICAL_SOURCE`/`CANONICAL_CONST`(`TRIGGER_RESPONSE_STRIP_COLUMNS`,
  `triggers.service.ts:104`)와 `MIRROR_SOURCES`/`MIRROR_CONST`(`TRIGGER_SECRET_COLUMNS`,
  `schedule-trigger-ref.ts:24`, `trigger-workflow-ref.ts:45`)가 실제 세 파일의 상수명·
  비-`export` 여부와 정확히 일치함을 직접 grep 으로 확인.
- `readStringArrayConst`의 `as`/`satisfies`/괄호 3중 unwrap 루프, ENOENT 시 전용 에러 메시지,
  문자열 아닌 원소 거부, 빈 배열과 `null` 구분 — 모두 JSDoc 이 약속한 대로 구현돼 있고
  `trigger-secret-columns.spec.ts` 11개 `it()`(`npx jest` 실행, **11/11 GREEN** 확인)가 이
  분기들을 개별 대조군으로 잠근다. `.toThrow()` 단독이 아니라 메시지 정규식(`/옮겨졌거나
  이름이 바뀌었다/`)으로 판별해 "무엇이 던졌는지 보지 않는" 함정을 피한 것도 확인.
- `trigger-workflow-ref.spec.ts`: 헤더 docstring 의 번호 목록(1~11, 아라비아 통일)과 케이스
  헤딩/구획 주석의 번호가 어긋나지 않음을 grep 으로 전수 확인, self-spec **12/12 GREEN**
  (`npx jest`) 재현. 가드 5(=`workflow` not-null)를 독립적으로 판별 불가라 서술한 근거(다음 줄
  `workflow ?? {}` 가 키셋 검사로 항상 먼저 던진다)도 `expectTriggerWorkflowRef` 실제 구현
  (`trigger-workflow-ref.ts:113-120`)과 일치.
- `schedule-trigger.e2e-spec.ts` 의 신규 `expectTriggerWorkflowRef(row/patch.body.data, {
  present: true, expectedWorkflowId: workflowId })` 3곳(목록 C-2, PATCH cron `G`, PATCH
  재활성 `H`)이 실제로 검증 가능한 경로에 배치됐음을 서비스 코드로 확인 — `update()` 는
  `findById()`(relations:['workflow'] 포함)로 시작하고, schedule 타입은 `config`/`chatChannel`
  변경이 `disallowed`로 막혀 있어(`triggers.service.ts:473-488`) chatChannel 재조회 분기를
  타지 않는다. 즉 이 세 단언은 "그 재조회 분기의 버그(W4)"의 정확한 재현은 아니지만, 문서
  자체가 이를 인정하고("더 일반적인 회귀를 지킨다") 있으며 실제로 `findById`가 항상
  `workflow` relation 을 채우는 더 넓은 경로를 정확히 고정한다 — 의도-구현 괴리 없음.
- `chat-channel-trigger-create.e2e-spec.ts`/`trigger-workflow-ref.e2e-spec.ts` 의 `afterAll`
  JSDoc 개정(고아 `secret_store` row 무해성 근거를 "미검증"에서 "두 경계 실측"으로 승격)은
  실제 `secret-store.md §R4`(프로덕션 삭제 경로 전용 규정)와 스코프를 명시적으로 갈라 놓아
  확산 오독 위험이 없음을 spec 원문 대조로 확인.
- TODO/FIXME/HACK/XXX: 6개 변경 파일 전수 grep, 0건.
- plan 문서(`trigger-canary-hardening.md`)의 정량 주장("grep '가드 [0-9]' 총 매치 13 / 케이스
  헤딩 3")을 `grep -n` 재실행으로 정확히 일치 확인.

## Spec Fidelity

관련 spec: `spec/2-navigation/2-trigger-list.md`(§3 `TriggerDto.workflow` 註),
`spec/5-system/2-api-convention.md §5.4`(부재 표현 null vs 키 생략),
`spec/conventions/secret-store.md §R4`/§2.1. 코드 구현(§5.4 판정 로직·`present`/`expectedWorkflowId`
옵션·비밀 컬럼 스트립)은 세 문서 본문과 line-level 로 일치한다. 두 개의 spec-문서측 결함
(① `2-trigger-list.md` frontmatter `code:` 가 이번에 같은 계약을 처음 시행하는
`schedule-trigger.e2e-spec.ts` 와 신규 `trigger-secret-columns-{guard,spec}.ts` 를 누락, ②
`secret-store.md §R4` 가 `TriggersService.delete()`라고 쓰지만 실제/§2.1 은 `remove()`)은
실제로 존재함을 확인했으나, **developer 권한 밖이라 spec 을 직접 고치지 않고**
`plan/in-progress/spec-draft-nullable-notation-followups.md` 에 각각 planner-owned 항목으로
등재돼 있음을 grep 으로 확인했다(약 3935·3942행 부근). 이는 CLAUDE.md 의 `spec/` 쓰기 경계를
정확히 지킨 처리이며 새로운 지적사항이 아니다 — 이미 3라운드의 `/ai-review`(11_27_40,
11_52_13, 12_17_14)에서 동일하게 확인·처분됐다.

## 요약

핵심 신규 코드(`trigger-secret-columns-guard.ts`/`.spec.ts`)는 3중 비밀 컬럼 목록 정적 정합
가드라는 의도된 기능을 정확히 구현하고, 이전 3라운드 리뷰에서 지적된 vacuous 삼항식·
`existsSync` 미영속 대조군·괄호 unwrap 미대조군 결함이 모두 실제로 고쳐져 있음을 코드와 테스트
실행으로 재확인했다. `schedule-trigger.e2e-spec.ts` 의 `expectTriggerWorkflowRef` 신규 단언
3곳도 실제 서비스 로직과 정확히 대응하는 경로를 고정한다. 유일한 신규 발견은 같은 함수 안에
남아 있는 한 개의 미대조 분기(선언은 매칭되지만 값이 배열이 아닌 경우 `null` 반환)로, 실제
대상 파일에는 영향이 없는 방어적 엣지케이스지만 이 PR 이 스스로 채택한 "모든 분기에 대조군"
원칙에서 보면 하나가 비어 있다(WARNING). spec 문서 자체의 두 결함(`code:` 누락,
`delete()`/`remove()` 오기)은 실재하지만 이미 올바르게 planner 백로그에 등재돼 있어 이번
diff 의 문제가 아니다. 리뷰 도중 별도 세션이 남긴 것으로 보이는 uncommitted 뮤테이션을
관측했으며 원복하지 않고 그대로 보고한다(위 절차 노트).

## 위험도

LOW
