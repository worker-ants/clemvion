# 테스트(Testing) 코드 리뷰

## 검증 방법

`git merge-base HEAD origin/main` (`ce454e046`) 기준으로 `codebase/` 델타(5개 파일,
`guide-error-code-*` 삭제 → `guide-identifier-*` 신규 + `guide-sanitized-message-parity.test.ts`
주석 1줄)를 직접 `Read` 했다. 이 diff 는 이미 3라운드(`14_41_14`→`15_03_06`→`15_24_12`→`15_42_54`)의
`/ai-review`·`--impl-done` 을 거치며 CODE_FIELD 왼쪽 경계·`collectEnvDeclarations` 분기 커버리지·
compose 판별 fixture 등 다수의 testing WARNING 이 이미 뮤테이션 실측으로 고쳐진 상태다. 중복
재지적을 피하기 위해 (1) 기존 처분이 실제로 유효한지 재검증하고 (2) 그 뮤테이션 실측 관례가 파일
전체에 **고르게** 적용됐는지를 확인했다.

뮤테이션은 저장소 파일을 직접 고쳐 재현한 뒤 **즉시 원복**했다(`cp` 로 원본을 `/tmp` 에 백업 →
`sed` 로 1줄 치환 → `vitest run` → `cp` 로 복원 → `md5sum` 대조로 원복 확인, `git status --short`
로 잔여물 없음 확인). 두 사이클 모두 원복 후 26/26 GREEN, `git status --short` 는 이 세션이 만든
`review/code/2026/09/13/16_04_15/`·`review/consistency/2026/09/13/16_04_45/` 외 잔여물 없음.

## 발견사항

- **[WARNING]** `collectSourceTokens` 만 유일하게 **합성 입력 대조군이 없다** — `\b` 경계 뮤턴트가
  생존한다(직접 재현)
  - 위치: `codebase/frontend/src/lib/docs/__tests__/guide-identifier-scan.ts:175-186`
    (`collectSourceTokens` 정의, 특히 `:176` 의 `` new RegExp(`\\b(${UPPER_SNAKE})\\b`, "g") ``)
  - 상세: 이 가드 가족의 세 exported 함수 중 나머지 둘은 이번 PR 이 라운드를 거치며 **합성 입력
    으로 자기 경계를 직접 겨누는 describe 블록**을 얻었다 — `scanIdentifierCitations` 는
    `guide-identifier-existence.test.ts:254-330`(`scanIdentifierCitations — 축별 대조군`, `CODE_FIELD`
    왼쪽 경계까지 라운드 4 에서 추가), `collectEnvDeclarations` 는 `:206-246`(`collectEnvDeclarations
    — 분기별 대조군`, 라운드 2 에서 추가 — RESOLUTION `15_03_06` 이 정확히 "코퍼스 의존 단언만으로는
    영원히 못 겨눈다" 는 이유로 신설했다). 그런데 `collectSourceTokens` 는 실제 저장소 코퍼스를 통한
    간접 검증(`:74-81` vacuity floor — `size > 800`, `MODEL_CONFIG_NOT_FOUND`/`EXPR_SYNTAX_ERROR`
    두 토큰 멤버십)만 있고, 자신만의 대조군 테스트가 없다.
    직접 재현했다 — `\\b(${UPPER_SNAKE})\\b` 를 `(${UPPER_SNAKE})`(양쪽 word-boundary 제거)로
    바꿔도 **26/26 GREEN 이 그대로 유지된다**(사이드이펙트 없이 원복 완료, md5 일치 확인). 코퍼스가
    커서 boundary 를 없애도 `size` 하한(800)과 두 멤버십 단언이 전부 살아남기 때문이다 —
    boundary 제거는 토큰 집합을 **넓히기만** 하므로 최소값 단언은 원리적으로 이 방향의 회귀를
    못 잡는다.
    이 boundary 는 방어적 장식이 아니다 — `basis`(기준집합)를 부풀리는 방향이므로, 없으면
    실재하지 않는 식별자의 **부분 문자열**이 우연히 소스의 다른 식별자 안에 포함돼 있을 때
    "실재한다" 는 오판(거짓 PASS)을 유발할 수 있다. 이 PR 이 그 문서 상단에 명시한 존재-검사
    가드의 핵심 계약(basis 가 정확해야 baseline-0 이 의미 있다)과 정확히 같은 축이며, 같은 파일
    안에서 형제 두 함수가 이미 이 종류의 뮤테이션에 걸리도록 라운드를 거쳐 강화된 것과 대비된다.
    (참고: 이 boundary 자체는 이번 PR 이 새로 만든 것이 아니라 삭제된 `guide-error-code-scan.ts:174`
    에서 그대로 이어받은 것이다 — `git show ce454e046:...guide-error-code-scan.ts` 로 확인. 즉
    이번 diff 의 신규 결함은 아니지만, 이 PR 자체가 "형제 함수들엔 있는 합성 대조군이 없다" 는
    바로 이 클래스의 결함을 세 라운드에 걸쳐 두 함수에서 찾아 고쳤으면서 세 번째 함수에는
    적용하지 않은 **불균등 처리**다.)
  - 제안: `collectEnvDeclarations — 분기별 대조군` 과 같은 패턴으로 `collectSourceTokens` 에도
    합성 대조군을 추가한다 — 예: 경계 안쪽에 포함된 형태(`xMY_TOKEN`)가 안 걸리는지, 밑줄로
    이어진 문자열(`FOO_BAR_BAZ`) 안에서 부분 문자열(`BAR_BAZ`)이 안 걸리는지, 여러 파일에 걸친
    동일 토큰이 `Set` 으로 중복 제거되는지.

## 회귀·처분 재검증 (조치 불요 — 실측으로 유효성 확인)

- **CODE_FIELD 왼쪽 경계** (`guide-identifier-scan.ts:115-118`, 테스트
  `guide-identifier-existence.test.ts:283-295`): `(?<![A-Za-z])` 를 제거하는 뮤테이션을 직접
  걸어 재현 — `[비대상] code 로 끝나는 다른 키는 안 집는다` 가 **RED**(`NOT_A_CODE_FIELD` 오매칭)
  로 정확히 실패함을 확인했고, 즉시 원복(md5 일치)했다. 커밋 로그(`6b4c03af6`)가 주장한 실측과
  일치한다.
- 나머지 축(`field-table` 줄 단위 한계, `collectEnvDeclarations` 의 compose 판별 fixture,
  외부 어휘 허용목록 4강제, 과거 결함 재현 `MCP_INSECURE_URL_ALLOWED`/`MCP_ALLOW_INSECURE_URL`,
  명명 회귀 `discord.en.mdx`/`EXECUTION_TIMEOUT` · `mcp-servers.mdx`/`MCP_ALLOW_INSECURE_URL`)는
  소스를 직접 열어 실제 MDX 파일에 해당 문자열이 그대로 존재함을 `grep` 으로 확인했다 — 합성
  fixture 가 아니라 실제 회귀 형태를 이름으로 고정한다는 주석 그대로다.
- `<FieldTable>` 의 `name` 이 객체 리터럴의 **첫 키**여야 매치된다는 제약(`FIELD_TABLE_NAME`
  정규식 구조)은 삭제된 `guide-error-code-scan.ts` 에서 문자 그대로 이어받은 것이라(비교 확인)
  이번 diff 의 신규 갭이 아니다 — 별도 지적하지 않는다.

## 요약

핵심 스캐너 로직은 세 exported 함수(`scanIdentifierCitations`/`collectEnvDeclarations`/
`collectSourceTokens`) 중 둘에 대해 라운드 2~4 를 거치며 "코퍼스 의존 단언만으로는 못 겨눈다" 는
교훈에 따라 합성 입력 대조군을 뮤테이션 검증까지 마쳤고, 실제 재현으로 그 처분이 유효함을
확인했다. 다만 같은 교훈이 세 번째 함수(`collectSourceTokens`)에는 적용되지 않아 `\b` 경계
제거 뮤턴트가 26/26 GREEN 을 유지하는 것을 직접 재현했다 — 이 함수가 만드는 `basis` 는 baseline-0
판정의 절반을 이루므로, 그 정확성을 지키는 유일한 방어선(단어 경계)이 지금은 어떤 테스트로도
겨눠지지 않는다. 이번 diff 가 새로 만든 결함은 아니지만, 이 PR 자체가 정확히 이 클래스의 결함을
찾아 두 형제 함수에서 고친 이력이 있어 세 번째 함수의 누락이 눈에 띈다. 그 외 테스트 격리(순수
함수 synchronous 호출, 모듈 스코프 1회 계산)·가독성(축별 한국어 주석·실측 수치 병기)·Mock
사용(없음 — 실제 파일시스템을 직접 읽는 것이 가드의 목적과 부합)에는 지적 사항이 없다.

## 위험도

LOW
