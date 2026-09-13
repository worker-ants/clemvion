# 테스트(Testing) 코드 리뷰

## 검증 방법

`guide-identifier-existence.test.ts`/`guide-identifier-scan.ts`(신규, 프롬프트에서 diff 생략된
파일 5·6)를 `Read` 로 직접 열어 전문을 확인했고, `pnpm vitest run
src/lib/docs/__tests__/guide-identifier-existence.test.ts` 로 현재 25/25 GREEN 을 재확인했다.
각 축의 정규식 경계는 node 인라인 스크립트(저장소 밖)와, 필요한 한 곳은 저장소 파일을 직접
뮤테이션(원본을 `mktemp -d` 로 받은 scratch 로 `cp` 해 둔 뒤 수정 → 재실행 → 즉시 `cp` 로 원복)해서
검증했다. **뮤테이션 직후 원복까지 완료**했으며 `git status --short` 로 `guide-identifier-scan.ts`
가 클린함을 확인했다(세션 시작 시점부터 있던 `review/code/2026/09/13/15_42_54/`·
`review/consistency/2026/09/13/15_43_24/` untracked 산출물 외 변경 없음). 삭제된
`guide-error-code-scan.ts`(`git show ce454e046:...`)와 대조해 아래 발견사항이 이번 diff 의 신규
로직인지 이어받은 기존 로직인지도 구분했다.

## 발견사항

- **[WARNING]** `code-field` 축(`CODE_FIELD`)의 키 이름 왼쪽 경계가 뮤테이션으로도 안 잡힌다 —
  이 파일이 다른 두 축에 적용한 "판별 fixture" 관례가 이 축에만 빠졌다
  - 위치: `codebase/frontend/src/lib/docs/__tests__/guide-identifier-scan.ts:105`
    (`const CODE_FIELD = new RegExp(`"?code"?\s*:\s*"(${UPPER_SNAKE})"`, "g");`) · 해당 축 테스트는
    `codebase/frontend/src/lib/docs/__tests__/guide-identifier-existence.test.ts:274-281`
    (`"축 2 — 봉투 예시의 code 값을 집는다 (따옴표 유무 무관)"`)
  - 상세: `CODE_FIELD` 는 리터럴 `code` 앞에 아무 경계도 요구하지 않는다. 실측(node):
    `"statuscode": "MADE_UP_CODE"`, `"errorcode": "MADE_UP_CODE"`, `"mycode": "MADE_UP_CODE"` 모두
    `MADE_UP_CODE` 를 `code-field` 축으로 오매칭한다 — "code" 로 **끝나는** 임의의 키가 전부
    후보가 된다. 이 파일은 정확히 같은 클래스의 경계를 **다른 두 축**에 대해서는 명시적으로
    겨눴다 — `field-table` 축의 "줄 단위라 여러 줄로 쪼갠 행은 놓친다"(existence.test.ts:268-272)
    와 `backtick` 축의 "밑줄 없는 대문자 약어는 안 집는다, `LLM`/`LLM_TIMEOUT` 두 판정이 갈리는
    값으로"(existence.test.ts:299-309, 이전 라운드 WARNING 으로 뮤테이션까지 확인된 것). 같은
    방법론이 `code-field` 축의 "키가 정확히 `code` 여야 하는가, `code` 로 끝나기만 하면 되는가"
    경계에는 적용되지 않았다.
    직접 뮤테이션으로 확인했다: `CODE_FIELD` 에 `(?<![A-Za-z])` 네거티브 lookbehind 를 추가해
    (키를 정확히 `code` 로만 좁히는 방향) 재실행해도 **25/25 GREEN** — 스위트가 이 경계를 어느
    방향으로도 겨누지 않는다는 뜻이다(좁혀도, 원래대로 넓어도 통과). 오늘 실제 MDX 코퍼스에는
    "code" 로 끝나는 다른 키가 없어(`grep -rnE` 확인) 당장 오탐으로 이어지진 않지만, 이 규칙
    자체는 삭제된 `guide-error-code-scan.ts:84`(`git show ce454e046`)에서 그대로 이어받은 것이라
    "이번 PR 이 새로 만든 버그"는 아니다 — 다만 이번 PR 이 **같은 파일을 통째로 재작성**하며
    다른 두 축에는 판별 fixture 를 새로 추가했으므로, 정확히 이 축만 그 일관성에서 빠졌다.
  - 제안: `"statusCode": "X"`(또는 `"mycode"`) 처럼 "code" 로 끝나지만 정확히 `code` 가 아닌 키는
    `code-field` 축으로 잡히지 않는다는 것을 고정하는 음성 판별 fixture 테스트 1개 추가. 필요하면
    정규식에도 왼쪽 경계(`(?<![A-Za-z])` 류)를 추가해 실제 동작을 그 기대와 맞춘다.

- **[INFO]** `field-table` 축(`FIELD_TABLE_NAME`)도 `name` 이 객체 리터럴의 **첫 프로퍼티**일 때만
  잡는다 — 같은 클래스의 경계지만 기존 로직이라 이번 diff 의 신규 결함 아님
  - 위치: `codebase/frontend/src/lib/docs/__tests__/guide-identifier-scan.ts:102`
    (`` const FIELD_TABLE_NAME = new RegExp(`\{\s*name:\s*"(${UPPER_SNAKE})"`, "g"); ``)
  - 상세: 정규식이 `{` 바로 뒤에 `name:` 을 요구하므로 `{ type: "string", name: "MADE_UP_CODE" }`
    처럼 `name` 이 첫 프로퍼티가 아니면 매치가 없다(node 로 확인). 값이 큰따옴표라 `backtick`
    축에도 안 걸려 완전히 무검출이 된다. 이 파일은 "줄 단위 분리" 경계는 명시적으로
    테스트하지만(existence.test.ts:268-272) "속성 순서" 경계는 테스트하지 않는다. 실측 코퍼스는
    전부 `name` 이 첫 프로퍼티라(grep 확인) 오늘은 문제가 없고, 이 정규식은 삭제된
    `guide-error-code-scan.ts:81` 에서 이어받은 것이라 이번 PR 의 신규 결함이 아니다.
  - 제안: 즉시 조치 불요. 다음에 이 축을 다시 손볼 때 위 `code-field` 발견과 함께 "이 스캐너는
    특정 객체-리터럴 프로퍼티 순서에 결합돼 있다"는 한계를 스캐너 상단 한계 주석(53~76행)에
    추가할 가치가 있다.

## 긍정적으로 확인된 점

- **Mock 없음, 실제 파일시스템 대상 순수 검증** — `scanIdentifierCitations`/`collectSourceTokens`/
  `collectEnvDeclarations` 는 인자로 받은 문자열만 다루는 순수 함수이고, I/O(`fs.readFileSync` 등)는
  전부 `guide-identifier-existence.test.ts` 쪽에 있다. 이 폴더 관례와 일치하며 mock 이 실제 동작과
  괴리될 여지가 없다.
- **판별 fixture 관례가 대부분 축에 적용됨** — `field-table` 의 줄-단위 경계, `backtick` 의
  LLM/HTTP 약어 제외(3라운드째 뮤테이션 검증), `collectEnvDeclarations` 의 compose 최상위-키 제외
  (2라운드째 뮤테이션 검증, 첫 fixture 오판을 스스로 교정한 이력까지 코드에 남아 있음)까지 "두
  판정이 갈리는 값" 원칙이 잘 지켜진다 — 위 WARNING 은 그 관례가 한 축에서만 예외였다는 지적이다.
- **총량 floor 의 vacuous 함정을 스스로 교정** — 이전 라운드 WARNING(합성 fixture 로 전면 교체되며
  실제 코퍼스 이름 회귀 단언이 사라짐)에 대응해 `discord.en.mdx`/`EXECUTION_TIMEOUT`,
  `mcp-servers.mdx`/`MCP_ALLOW_INSECURE_URL` 두 개의 파일·토큰 이름 고정 단언이 복원돼 있다
  (existence.test.ts:97-110) — 총량만 보는 단언의 맹점을 정확히 이해한 수정이다.
- **테스트 격리 양호** — `root`/`mdxFiles`/`sourceTexts`/`basis`/`citations` 등은 `describe` 콜백
  본문에서 1회만 계산되는 읽기 전용 값이라 `it()` 블록 간 상태 공유·순서 의존이 없다. 실제
  `.env.example` 주석 개수에 의존하는 테스트(existence.test.ts:239-245)는 코퍼스 결합을 의도적으로
  선택한 것으로 그 이유가 인접 주석에 명시돼 있다.
- **회귀 테스트 유효성** — 자매 파일 `guide-sanitized-message-parity.test.ts:16` 의 상호참조가 이번
  라운드 diff 에서 신·구 이름 병기로 이미 갱신돼 있어(파일 7), 리네임에 따른 죽은 참조가 남아있지
  않다.

## 요약

핵심 판정 로직(`scanIdentifierCitations`/`collectSourceTokens`/`collectEnvDeclarations`)은 mock 없는
순수 함수 + 파일시스템 I/O 분리 구조를 유지하고, 세 축 중 둘(`field-table`의 줄 단위 경계,
`backtick`의 약어 제외)과 `collectEnvDeclarations`의 분기별 대조군은 이 프로젝트가 3라운드에 걸쳐
확립한 "판별 fixture"(두 판정이 갈리는 값) 원칙을 정확히 따른다. 유일한 실질적 갭은 `code-field`
축의 키-이름 왼쪽 경계다 — `CODE_FIELD` 정규식이 "code"로 끝나는 임의의 키를 전부 오매칭하는데,
이번 PR이 재작성한 같은 파일에서 다른 두 축에는 적용한 판별-fixture 방법론이 이 축에는 적용되지
않았다. 뮤테이션(축을 정확한 `code`로 좁히는 방향)으로 직접 확인한 결과 25/25 GREEN — 스위트가 그
경계를 전혀 겨누지 않는다. 오늘 코퍼스에는 해당 오매칭을 유발하는 키가 없어 당장 회귀는 아니고
이 정규식 자체는 삭제된 구 파일에서 이어받은 기존 로직이라 이번 diff의 신규 버그도 아니지만,
"같은 파일 안에서 같은 방법론이 한 축만 비켜갔다"는 일관성 결함으로 WARNING 처리한다. `field-table`
축의 속성-순서 경계는 같은 클래스이나 기존 로직이라 INFO로 낮춰 기록한다. 둘 다 CRITICAL 급은
아니며, 나머지 격리·가독성·회귀 테스트 유효성·테스트 용이성 항목은 모두 양호하다.

## 위험도

LOW
