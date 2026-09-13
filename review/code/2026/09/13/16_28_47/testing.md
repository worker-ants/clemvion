# 테스트(Testing) 코드 리뷰

## 검증 방법

`codebase/frontend/src/lib/docs/__tests__/guide-identifier-existence.test.ts` ·
`guide-identifier-scan.ts` 전문을 직접 `Read` 했고, `git log`/`git show 1984d72d3`로 라운드 5
(가장 최근 코드 커밋)의 델타를 확인했다. 이 가드는 이미 5라운드의 `/ai-review`·`--impl-done`을
거치며 다수의 testing WARNING(경계 결함·합성 대조군 부재)이 뮤테이션 실측으로 고쳐진 상태다 —
직전 라운드 리포트(`review/code/2026/09/13/16_04_15/testing.md`)가 지적한 `collectSourceTokens`
합성 대조군 부재는 라운드 5 커밋에서 정확히 그 형태로 추가됐음을 diff 로 확인했다.

중복 재지적을 피하려고, 이미 처분된 항목을 다시 올리는 대신 **직접 뮤테이션을 걸어** 남은
갭이 있는지 저장소 밖 scratch 에서 검증했다(저장소 파일은 건드리지 않았다):

- `FIELD_TABLE_NAME`의 `{` 앵커를 제거/완화하는 두 가지 뮤턴트를 순수 함수 로직만 복제해
  scratch 스크립트로 실행 → 기존 "[경계] 축 1 은 줄 단위라 여러 줄로 쪼갠 행은 놓친다" 테스트가
  **의도치 않게도 이 뮤테이션을 함께 잡는다**는 것을 확인했다(그 테스트의 fixture가 `{`와
  `name:`을 다른 줄로 쪼개 놓아서, 앵커가 없으면 그 줄에서 오매칭이 발생해 `toEqual([])`가
  깨진다). 즉 코드 상단 감사표의 "`FIELD_TABLE_NAME`… 안전" 판정은 실제로 뮤테이션 검증된다 —
  처음엔 미검증으로 의심했으나 재현 결과 반증되어 이 항목은 발견사항에 올리지 않는다.
- `collectEnvDeclarations`의 compose 분기(`^\s+(UPPER_SNAKE):\s`)가 실제 저장소의
  `docker-compose.yml`/`docker-compose.e2e.yml`과 맞는 형식인지 `grep`으로 대조했다(아래
  발견사항 참조).

## 발견사항

- **[INFO]** `collectEnvDeclarations`의 compose 파싱이 **매핑 스타일만** 다루고 **리스트
  스타일**(`- KEY=value`)은 못 받으며, 이를 겨누는 테스트도 없다
  - 위치: `codebase/frontend/src/lib/docs/__tests__/guide-identifier-scan.ts` —
    `collectEnvDeclarations`의 `composeLine` 정규식(`` new RegExp(`^\\s+(${UPPER_SNAKE}):\\s`, "gm") ``)
    정의부. 테스트는 `guide-identifier-existence.test.ts`의
    `describe("collectEnvDeclarations — 분기별 대조군")` 중
    `"compose 는 **들여쓴 키**만 받는다 (최상위 키는 env 가 아니다)"`.
  - 상세: docker-compose 의 `environment:` 절은 매핑 스타일(`KEY: value`, 현재 정규식이
    다루는 형태)과 리스트 스타일(`- KEY=value`) 둘 다 유효한 문법이다. 지금 저장소의
    `docker-compose.yml`·`docker-compose.e2e.yml`은 전부 매핑 스타일이라(직접 `grep -A 8
    "environment:"` 로 확인) 오늘은 이 갭이 관측되지 않지만, 정규식은 `:` 뒤에 공백을
    요구해 `- POSTGRES_PASSWORD=secret` 같은 리스트 항목은 애초에 매치되지 않는다.
    이 함수의 JSDoc(`guide-identifier-scan.ts` 상단)은 "오늘 이 병합은 판정을 지탱하지
    않는다"는 **총량** 한계는 실측·뮤테이션으로 명시했지만, **포맷 가정**(매핑 전용)이라는
    이 별도의 한계는 어디에도 적혀 있지 않고 대조군도 없다. 이 파일이 이미 "정규식 경계
    전수 감사(라운드 5)" 표를 코드에 박아 같은 종류의 미검증 가정을 클래스 단위로 닫으려
    했던 것과 같은 결의 문제라, 감사표에 이 축이 빠진 점이 눈에 띈다.
  - 제안: 리스트 스타일 fixture(`environment:\n  - POSTGRES_PASSWORD=secret`)에 대해
    "[비대상] 또는 [경계]"로 현재 동작(못 받음)을 합성 테스트로 고정하거나, 두 스타일을 모두
    받도록 정규식을 넓힌다. 가드가 "존재 검사이지 방출 검사가 아니다"처럼 스스로 한계를
    적어 온 관례를 여기에도 적용하면 다음 사람이 "왜 이 변수가 기준집합에 없지"를 추적하는
    비용을 줄인다.

## 회귀·기존 처분 재검증 (조치 불요)

- `collectSourceTokens`의 `\b` 경계 — 라운드 5가 추가한 5개 테스트(`xMY_TOKEN`/`prefixFOO_BAR`
  안쪽 부분 문자열 거부, 독립 토큰 인식, 긴 토큰 통짜 인식, 텍스트 간 중복 제거, 밑줄 없는
  약어 거부)는 scratch 에서 `\b` 제거/유지 두 버전을 실제로 실행해 판정이 갈리는 것을
  확인했다 — 유효한 판별 fixture다.
- `CODE_FIELD`의 `(?<!\w)` 경계 — 라운드 5가 추가한 `"error_code"`/`"http_code"` fixture 를
  `(?<![A-Za-z])`(라운드 4 판)와 `(?<!\w)`(현재)로 각각 손으로 대조해, `_`가
  `[A-Za-z]`엔 안 걸리고 `\w`엔 걸린다는 것을 재현했다 — 판별 fixture가 유효하다.
- `BACKTICK`·`FIELD_TABLE_NAME`의 `{` 앵커 — 위 "검증 방법"에서 재현한 대로, 기존 "[경계]"
  테스트가 부수적으로 이 앵커의 뮤테이션도 잡는다.
- 명명 회귀(`discord.en.mdx`/`EXECUTION_TIMEOUT`, `mcp-servers.mdx`/`MCP_ALLOW_INSECURE_URL`)와
  과거 결함 재현(`MCP_INSECURE_URL_ALLOWED`/`MCP_ALLOW_INSECURE_URL`) 3갈래 테스트는 실제
  코퍼스 문자열과 대조해 유효함을 확인했다.
- 테스트 격리: `root`/`mdxFiles`/`sourceTexts`/`sourceTokens`/`envTokens`/`basis`/`citations`는
  전부 `describe` 콜백 실행 시 1회 계산되는 상수이고 이후 어떤 `it`도 뮤테이션하지 않는다.
  순서 의존성·전역 부작용 없음.
- Mock 사용: 없음 — 실제 파일시스템 판독이 이 가드의 존재 목적(실재성 검사)과 정확히 부합해
  적절하다. 합성 입력이 필요한 경계 테스트는 mock 대신 순수 문자열 인자로 함수를 직접 호출해
  더 단순하고 신뢰도가 높다.

## 요약

핵심 스캐너(`scanIdentifierCitations`/`collectSourceTokens`/`collectEnvDeclarations`)는 5라운드에
걸쳐 정규식 경계마다 판별 fixture 로 뮤테이션 검증을 마쳤고, 이번 라운드에서 직접 재현한 결과
그 처분들이 유효함을 확인했다 — 특히 이전 라운드가 지적한 `collectSourceTokens` 합성 대조군
부재는 정확히 그 형태로 해소돼 있었다. 새로 찾은 유일한 갭은 `collectEnvDeclarations`의 compose
파싱이 매핑 스타일만 다루고 리스트 스타일(`- KEY=value`)은 무테스트로 놓친다는 것인데, 오늘의
실제 compose 파일이 전부 매핑 스타일이라 당장 판정을 뒤집지는 않는다(이 파일이 이미 명시한
"오늘 지탱하지 않는다"는 한계와 같은 결의 문제). Critical·Warning 급 결함은 발견하지 못했다.

## 위험도

LOW
