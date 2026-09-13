# 유지보수성(Maintainability) 코드 리뷰 — error-code-emission-axis (라운드 4)

## 검토 범위 및 방법

이 세션은 `error-code-emission-axis` 배치의 **누적 4라운드**(19_23_22 → 19_51_33 → 20_13_13 → 20_34_32)
리뷰 중 마지막 라운드다. 실질 코드 변경은 두 파일에 집중된다 —
`codebase/frontend/src/lib/docs/__tests__/guide-identifier-scan.ts`(발행 축 수집기 3종 +
`collectMatches` 공유 헬퍼 + `isMessagePrefixOnly` 정본 + `GUIDE_NON_EMITTED_VOCABULARY`)와
`codebase/frontend/src/lib/docs/__tests__/guide-identifier-existence.test.ts`(같은 축의 단언 +
`parseWhereRefs`/`staleEntries` 헬퍼 + 대조군). 나머지(`CHANGELOG.md`·`PROJECT.md`·두
`logic.mdx`·`plan/**`·`review/**`)는 문서/프로세스 산출물이라 코드 유지보수성 관점의
발견사항이 없다는 이전 세 라운드의 판단에 동의한다.

프롬프트가 두 핵심 TS 파일의 diff 를 크기 제한으로 생략했으므로, `Read` 로 두 파일 **전문**을
직접 열어 현재 상태(HEAD `5778885ce`, `git status --short` clean)를 확인했다. 또한
`git diff origin/main -- <두 파일>` 을 직접 대조해 누적 diff 전체(라운드 1~3 수정 전부 포함)를
검토했다. 저장소 파일은 건드리지 않았다(읽기 전용 조사만 수행, 뮤테이션 없음).

## 이전 라운드 대비 변화 — 라운드 3 WARNING#2 수정 확인

라운드 3 testing WARNING#2(`staleEntries` 가 두 호출부 모두 실코퍼스 베이스라인-0 으로만
검증돼 필터 방향이 뒤집혀도 우연히만 잡힌다)에 대한 수정이 `describe("staleEntries — 판별
대조군", …)`(`guide-identifier-existence.test.ts:520-540`)로 반영되었다. 세 케이스(인용 안 됨 /
인용됨 / 빈 목록)가 짧고 명확하며, 이 파일이 다른 신규 함수마다 적용해 온 "두 판정이 갈리는
값을 고정한다" 규율과 형태가 일치한다. 새로 도입된 이 블록 자체에서 새로운 유지보수성 결함은
찾지 못했다.

## 발견사항

- **[INFO]** `collectMatches` 의 capture-group 인덱스가 각 정규식 정의와 분리된 위치에서
  숫자 리터럴로 지정된다 — 회귀 시 조용히 잘못된 그룹을 뽑을 여지가 있다
  - 위치: `codebase/frontend/src/lib/docs/__tests__/guide-identifier-scan.ts:260`
    (`QUOTED_LITERAL` 정의, 그룹1=따옴표·그룹2=토큰), `:373`
    (`collectMatches(fileTexts, QUOTED_LITERAL, 2)`) / `:263`·`:385`
    (`MESSAGE_PREFIX`, 그룹1=토큰) / `:266`·`:427`(`CATALOG_CODE`, 그룹1=토큰)
  - 상세: 정규식 상수 선언부(`:260`,`:263`,`:266`)와 그 정규식을 소비하는 그룹 인덱스(`2`,
    `1`,`1`)가 서로 100줄 이상 떨어진 별도 함수(`collectQuotedLiterals`/`collectMessagePrefixes`/
    `collectCatalogCodes`)에 나뉘어 있다. 지금은 JSDoc 주석(`:372` "그룹 1 은 여는 따옴표…
    토큰은 그룹 2")이 그 짝을 설명해 주지만, 이 짝짓기 자체는 컴파일러가 강제하지 않는
    관례다 — 예컨대 누군가 `QUOTED_LITERAL` 에 새 캡처 그룹을 추가하면서 그룹 순서가 밀려도
    호출부의 `2` 는 타입 에러 없이 그대로 컴파일된다. (다행히 세 함수 모두 합성 대조군이
    실제 토큰 문자열을 단언하므로 이런 회귀는 테스트가 잡아낼 공산이 크다 — 그래서 WARNING
    이 아니라 INFO 다.)
  - 제안: 급하지 않음. 다음에 이 영역을 손댈 기회가 있으면 `QUOTED_LITERAL` 을
    `(['"\`])(?<token>${UPPER_SNAKE})\\1` 처럼 이름 있는 캡처 그룹(named capture group)으로
    바꾸고 `collectMatches` 가 `m.groups!.token` 을 읽게 하면, 정규식과 "무엇이 토큰인가"의
    짝이 같은 리터럴 안에 있게 되어 숫자 인덱스가 사라진다.

## 라운드 1~3에서 이월된 항목 (재확인, 변화 없음)

`review/code/2026/09/13/20_13_13/maintainability.md` 가 정리한 이월분을 직접 재확인했고
전부 현재 코드에 그대로 유효하다 — 조치 여부 판단도 동일하게 유지한다(재기술 대신 위치만
갱신):

- vacuity 하한 리터럴(`existence.test.ts:219`〈`>10`〉·`:220`〈`>30`〉, 형제 목록은
  `:395`〈`>2`〉·`:396`〈`>20`〉)이 이름 붙은 상수 없이 다른 값으로 존재 — 3라운드 연속
  미조치, 실질 위험 낮음.
- `matchAll`(신규, `scan.ts:281-291`) vs 수동 `lastIndex`(기존 4곳, `scan.ts:456-558`) 관용구
  공존 — 파일 상단 주석(`scan.ts:242-251`)이 명시적으로 유예를 선언한 의도적 상태.
- `GUIDE_EXTERNAL_VOCABULARY`(`scan.ts:300`)/`GUIDE_NON_EMITTED_VOCABULARY`(`scan.ts:333`)
  이름이 한 토큰만 다르고 제약이 정반대 — JSDoc 대조표(`scan.ts:315-318`)로 완화됨.
- `where` 검증(`existence.test.ts:224-260`)이 등록 항목·위치 조합마다 `walkTree` 를 재호출 —
  상한 5(`NON_EMITTED_VOCABULARY_CAP`)가 성장을 억제.
- 파일 서두 주석(`scan.ts:1-124`)이 코드 선언보다 먼저 오는 장문 구조 — "지우지 말 것" 이
  명시된 반증 이력 보존 원칙의 직접 사례.

## 요약

4라운드에 걸쳐 지적된 실질적 유지보수성 결함(수집기 근접 중복, 진리표를 겨눌 수 없는 지역
클로저, `where` 단일 매치 검증 공백, 거울상 죽은-항목 검사 중복, 그리고 그 중복 제거 헬퍼
자신의 판별 대조군 부재)이 이번 라운드 도달 시점에 전부 공유 헬퍼 추출·정본 이관·다중 매치
파서·대조군 추가로 해소되어 있음을 직접 코드를 읽어 재확인했다. 이번 라운드에서 새로 검토한
`staleEntries` 판별 대조군 블록 자체에는 새로운 결함이 없다. 독자적으로 찾은 유일한 신규
관찰은 `collectMatches` 호출부의 capture-group 인덱스가 정규식 정의와 분리된 숫자 리터럴이라는
점(INFO, 낮은 우선순위 — 기존 대조군이 사실상 이 회귀를 방어한다)이며, 나머지는 전부 이전
라운드에서 이미 문서화·이월된 항목으로 변화가 없다. 새로운 CRITICAL/WARNING 은 없다.

## 위험도
LOW
