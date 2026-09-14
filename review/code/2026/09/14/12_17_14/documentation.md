# 문서화(Documentation) 리뷰 — trigger-canary-hardening (라운드 3 / 누적)

## 검증 방법

이번 세션은 라운드 1(`review/code/2026/09/14/11_27_40`)·라운드 2(`review/code/2026/09/14/11_52_13`)
documentation 리뷰의 후속이다. 두 라운드가 이미 낸 발견사항(헤더 축 누락·`grep '가드 [0-9]'`
수치 불명확·CHANGELOG 판단 등)이 실제로 해소됐는지 저장소를 직접 열어(수정 없음) 재검증하고,
두 라운드가 놓친 지점이 남아 있는지를 별도로 훑었다.

- `codebase/backend/src/repo-guards/__tests__/trigger-secret-columns-{guard.ts,spec.ts}`,
  `codebase/backend/src/shared/testing/trigger-workflow-ref.spec.ts`,
  `codebase/backend/test/{chat-channel-trigger-create,schedule-trigger,trigger-workflow-ref}.e2e-spec.ts`
  전문을 `Read`로 직접 열람.
- `grep -n '가드 [0-9]' trigger-workflow-ref.spec.ts` 재실행 — **총 13줄**(케이스 헤딩 3 ·
  구획주석 7 · 산문 3)로 라운드 2 documentation 리뷰의 재실측과 일치함을 재확인.
- `plan/in-progress/trigger-canary-hardening.md`(신규 270행)와 `plan/in-progress/spec-draft-
  nullable-notation-followups.md`의 이번 diff 구간(L3932~L4183)을 대조해, 두 문서가 같은
  사실(캐너리 표기 정리 수치)을 **서로 다르게** 서술하는 지점이 없는지 교차 확인 — 있었다
  (아래 WARNING).
- 저장소 파일은 전혀 수정하지 않았다. `git status --short` 로 확인.

## 발견사항

- **[WARNING]** 두 라운드가 이미 반증한 "9자리" 수치가, **반증된 바로 그 문장 두 줄 아래에서
  같은 단락 안에** "(실측)" 표시를 달고 그대로 재등장한다 — sibling 트래커 문서에 stale 채로
  남음.
  - 위치: `plan/in-progress/spec-draft-nullable-notation-followups.md:4143`
    (`✅ **2026-09-14 해소**` 단락, "①" 항목 — "지금은 9자리 전부 잡힌다(실측)." 문장).
    같은 파일 바로 아래 문단(4151~4152행경): "항목이 *케이스 헤딩 8개는 아라비아* 라 적었는데
    실측하면 `## 가드` 헤딩은 **3개**(아라비아 2 · 원문자 1)다. 갈렸다는 사실은 맞고 개수만
    틀렸다." — 대조 대상: `plan/in-progress/trigger-canary-hardening.md:169-179`.
  - 상세: `trigger-canary-hardening.md` §체크리스트 항목 3 은 자신이 앞서 plan 본문(§A.3)에
    적었던 "grep '가드 [0-9]' 9자리 전부 검색됨"이 틀렸다는 사실을 명시적으로 자기-반증하고
    ("«9자리» 라고 적었는데 틀렸다"), 세는 기준을 주어와 함께 재정의한 표를 싣는다 —
    총 매치 줄 **13**, 그중 `## 가드` 케이스 헤딩 **3**(종전 2 — `3·5` 가 원문자라 빠졌었다),
    `// ── 가드` 구획주석 **7**, 산문 언급 **3**. 직접 `grep -n '가드 [0-9]'` 로 재실행해도
    13(=3+7+3)이 정확히 나온다 — 이 수치가 정답이다.

    그런데 **같은 커밋에 함께 편집된** `spec-draft-nullable-notation-followups.md` 의 "✅ 해소"
    resolution 노트는 이 수정된 표를 반영하지 않고, 여전히 "지금은 9자리 전부 잡힌다(실측)."
    라고 적는다. `9` 는 이제 이 저장소의 어떤 세는 기준(총 매치 13·헤딩 3·구획주석 7·산문 3·
    아라비아 케이스 헤딩 8+1=9 도 아님— 헤딩은 3 개뿐)으로도 나오지 않는 숫자다. 더 나쁜 것은
    "(실측)" 표시다 — 이 단어는 이 프로젝트에서 "검증 가능한 방법으로 다시 재본 값"을 뜻하는데,
    실제로는 라운드 1 documentation INFO#4 가 지적한 **바로 그 미검증 "9자리" 문구를 재실측
    없이 그대로 옮겨 붙인 것**이다. 두 라운드(round1 INFO#4, round2 "해소 확인")가 이
    sibling 문서까지는 대조하지 않아 놓쳤다.

    이 트래커(`spec-draft-nullable-notation-followups.md`)는 "출처 tracker"로서 다음 세션이
    "이 항목이 진짜 닫혔는가"를 판단할 때 참조하는 문서다. 여기 남은 잘못된 "9자리(실측)"는
    다음 사람이 재검증 없이 "9개 자리가 다 잡힌다"고 믿고 넘어가거나, 반대로 `grep` 결과와
    맞지 않아 혼란을 겪게 만든다 — 이 프로젝트가 이미 기록한 "실측 주장은 검증 가능해야
    하고, 정정 후에도 옛 숫자가 살아남으면 다음 사람의 판단 기준을 바꾼다"는 실패 패턴 그대로다.
  - 제안: `spec-draft-nullable-notation-followups.md:4143` 의 "지금은 9자리 전부 잡힌다(실측)."
    문장을 `trigger-canary-hardening.md` 의 정정된 표와 동일하게 고친다 — 예:
    "`grep '가드 [0-9]'` 는 총 13줄에 매치하고, 그중 케이스 헤딩(`## 가드`) 3개 전부가 잡힌다
    (구획주석 7·산문 언급 3은 별개)." 두 문서가 같은 사실을 서로 다른 숫자로 서술하는 상태를
    남기지 않는 것이 원칙(정본 이중 서술 — 한쪽만 낡는다)과도 일치한다.

- **[INFO]** 헤더 docstring 이 케이스 헤딩 형식을 "`## 가드 N:`"(콜론)으로 예시하지만, 실제
  헤딩은 콜론과 em dash 를 혼용한다 — grep 가능성에는 영향 없음.
  - 위치: `codebase/backend/src/shared/testing/trigger-workflow-ref.spec.ts` (헤더 JSDoc,
    "이 목록과 아래 `## 가드 N:` 케이스 헤딩이 같은 번호 체계를 쓴다" 문장 — 게이트 21행 부근,
    diff 헝크 `@@ -13,23 +13,23 @@` 범위 내).
  - 상세: 실제 헤딩은 `## 가드 3·5 — \`null\` 은 부재가 아니다`(em dash, 콜론 없음)와
    `## 가드 7: \`id\` **타입**`(콜론 있음)이 섞여 있다. `grep '가드 [0-9]'` 매칭 자체는
    구두점과 무관해 통일 목적(grep 가능성)은 실제로 달성돼 있으므로 기능적 결함은 아니다.
    다만 docstring 이 예시로 든 정확한 표기(`## 가드 N:`)가 파일 안에서 일관되게 지켜지지
    않아, 다음 사람이 새 가드를 추가할 때 어느 구두점을 따라야 하는지 문서만으로는 불명확
    하다. 확신도 낮음 — 이 문장 자체가 "번호가 같은 체계"라는 것만 약속하고 구두점까지
    약속하는 것은 아니라는 해석도 가능하다.
  - 제안: 급하지 않음. 다음에 이 헤더를 만질 때 "콜론/em dash 는 자유, 숫자만 통일" 처럼
    한 구절만 보태면 모호함이 없어진다.

## 검증한 사항 (문제 없음 — 라운드 1·2 재확인 포함)

- `trigger-secret-columns-guard.ts`/`trigger-secret-columns.spec.ts`: 라운드 2 에서 추가된
  `existsSync` 방어 테스트(`대상 파일이 없으면 **가드의 메시지**로 던진다`)가 실제로 커밋돼
  있고, `.toThrow(/옮겨졌거나 이름이 바뀌었다/)` 로 메시지까지 판별해 "`.toThrow()`는 무엇이
  던졌는지 안 본다" 함정을 피했다는 라운드 2 RESOLUTION 의 서술과 코드가 일치함을 확인.
  라운드 1 WARNING#2(vacuous 삼항식)의 최종 수정(`if (value === null) throw`)과 라운드 2에서
  지적된 중첩 템플릿 리터럴(`${'…'}`) 제거도 현재 소스에 반영돼 있다(더 이상 중첩 없음).
- `readStringArrayConst`/`readAllTriggerSecretColumnLists` JSDoc: `null` vs `[]` 구분,
  AST-말고-정규식 안 쓰는 이유, `as`/`satisfies`/괄호 언랩 필요성, "`AsExpression` 하나만
  벗기면 정본에서 `null`"이라는 뮤턴트 실측 근거 모두 실제 구현과 일치.
- `schedule-trigger.e2e-spec.ts` 헤더 "검증 대상" 목록에 `TriggerDto.workflow` 축이 반영돼
  있고(라운드 1 INFO#1 해소 확인), 신규 인라인 주석 3곳(C-2·G·H)이 실제 `it()` 라벨과 정확히
  대응함을 확인.
- `trigger-workflow-ref.e2e-spec.ts` 의 `afterAll` JSDoc — "미검증"→"두 경계에서 실측"
  승격이 `secret-store.md §R4`(프로덕션 삭제 경로 규율)와 이 판단(테스트 인프라 한정)을
  명시적으로 분리해 확산 오독을 막는다. `chat-channel-trigger-create.e2e-spec.ts` 의 새
  주석이 이 파일을 "정본"으로 지목하고 같은 서술을 중복하지 않은 설계도 그대로 유지됨.
- `trigger-workflow-ref.spec.ts` 원문자→아라비아 숫자 통일: 저장소 전체에 잔존 원문자
  0건(`grep -nP '[①-⑪]'`), `grep '가드 [0-9]'` 로 13줄(헤딩 3·구획주석 7·산문 3) 전부
  탐지됨을 직접 재실행으로 확인.
- README/API 문서: 이번 변경은 API 표면·환경변수·설정을 추가하지 않고, repo-guard 목록을
  미러링하는 README/인덱스가 원래 없어(다른 기존 guard 들과 동일) 갱신 대상 아님.
- CHANGELOG: 순수 내부 테스트/가드 하드닝이고 `spec_impact: none` — 미갱신 문제 없음(라운드
  1·2 와 동일 결론).

## 요약

두 라운드에 걸쳐 이미 지적된 문서화 결함(헤더 축 누락·`grep` 수치 재정의·vacuous 주석·중첩
템플릿 잔재)은 전부 실제로 해소됐음을 코드 직접 열람으로 재확인했다. 다만 그 정정 과정에서
새로운 갭이 하나 남았다 — 캐너리 표기 정리 항목의 "9자리" 오류를 `trigger-canary-hardening.md`
는 명시적으로 자기-반증하고 13(=헤딩3+구획주석7+산문3)으로 정정했는데, **같은 배치가 함께
편집한 sibling 트래커**(`spec-draft-nullable-notation-followups.md`)의 "✅ 해소" 노트에는
그 정정이 반영되지 않고 옛 "9자리(실측)" 문장이 그대로 남아 있다. "(실측)"이라는 표시가
붙어 있어 다음 독자가 재검증 없이 신뢰할 위험이 있고, 두 문서가 같은 사실을 다른 숫자로
말하는 상태 자체가 이 프로젝트가 반복 경계해 온 "정본 이중 서술 — 한쪽만 낡는다" 패턴과
정확히 일치한다. 그 외 신규 코드의 JSDoc·인용된 선례·e2e 주석·plan 체크박스 동기화는 모두
정확했고, README/API 문서/CHANGELOG 갱신 불필요 판단도 유효하다.

## 위험도

LOW
