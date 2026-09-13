# 테스트(Testing) 리뷰 — guide-identifier-existence (round 2 fix 이후, `938060138`)

## 검증 방법

프롬프트가 diff 를 생략한 파일(`guide-identifier-existence.test.ts`, `guide-identifier-scan.ts`,
`guide-error-code-existence.test.ts`/`guide-error-code-scan.ts`(삭제))은 `Read`/`git diff
origin/main...HEAD` 로 전문·diff 를 직접 확인했다. `npx vitest run`으로 GREEN 을 재확인했고,
직전 두 라운드(`14_41_14`, `15_03_06`)의 testing WARNING 이 이번 커밋에서 실제로 해소됐는지
재검증했다. 추가로 이번 라운드에서 **새 뮤테이션 2건**을 저장소 밖 scratch 사본 대조 후
`cp` 로 원복하며 수행했다(뮤테이션 규약 준수, `git checkout`/`restore` 미사용).

```
npx vitest run guide-identifier-existence.test.ts guide-sanitized-message-parity.test.ts
  → Test Files 2 passed / Tests 31 passed (31)
```

## 이전 라운드 WARNING 해소 확인 (회귀 테스트 유효성)

- **`15_03_06` testing WARNING** (`collectEnvDeclarations` 의 `^#?` 분기가 완전히 무검증) —
  **해소 확인**. `guide-identifier-existence.test.ts:206-246` 에 `describe("collectEnvDeclarations
  — 분기별 대조군")` 5건(주석 선언·비주석 선언·compose 들여쓴 키·소문자 비대상·실제 코퍼스
  존재 확인)이 추가됐다. 직접 뮤테이션(`^#?\s*` → `^`)으로 재확인 — **RED**
  (`AssertionError: expected [] to deeply equal [ 'CORS_ORIGINS', … ]`). 원복 후
  `git status --short` 클린 확인.
- **`14_41_14` testing WARNING#6** (재작성 시 실코퍼스 이름-고정 회귀 단언이 합성 fixture 로
  전부 갈렸던 문제) — 여전히 해소 상태 유지 확인(`discord.en.mdx`/`EXECUTION_TIMEOUT`,
  `mcp-servers.mdx`/`MCP_ALLOW_INSECURE_URL`, `guide-identifier-existence.test.ts:97-110`).
- `guide-sanitized-message-parity.test.ts:16-17` 의 sibling 죽은 참조도 옛 이름 각주 병기로
  정정된 상태 유지 확인. 저장소 전체에 `guide-error-code` 잔여 참조는 의도된 역사 서술 2곳뿐
  (`guide-identifier-scan.ts:9`, `CHANGELOG.md:77`) — grep 으로 재확인, stale 없음.

## 발견사항

- **[WARNING]** `UPPER_SNAKE` 의 "밑줄 최소 1개" 설계 결정이 **어떤 테스트로도 겨눠지지 않는다** — 뮤테이션으로 확인(생존)
  - 위치: `codebase/frontend/src/lib/docs/__tests__/guide-identifier-scan.ts:89-90`
    (`/** UPPER_SNAKE — 밑줄이 **최소 하나** 있어야 한다(`LLM`·`HTTP` 같은 약어 제외). */`
    `const UPPER_SNAKE = "[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+";`)
  - 상세: 이 주석은 "약어 제외" 를 **명시적 설계 결정**으로 선언한다 — 이 상수는
    `FIELD_TABLE_NAME`·`CODE_FIELD`·`BACKTICK`·`collectSourceTokens`·`collectEnvDeclarations`
    다섯 곳에서 공유되는 축이라 파급이 크다. `(?:_[A-Z0-9]+)+` 의 `+` 를 `*` 로 바꿔(밑줄 그룹을
    0개 허용) 전체 스위트(`guide-identifier-existence.test.ts` + `guide-sanitized-message-parity.test.ts`,
    31 테스트)를 재실행했다 — **31/31 이 그대로 GREEN** 이었다. 즉 "LLM·HTTP 같은 약어를
    제외한다" 는, 코드 주석이 스스로 단 주장이 **어느 합성 fixture 로도, 어느 실제 코퍼스
    floor 로도 검증되지 않는다**. 이 프로젝트 관례(`feedback_design_rationale_must_be_mutation_tested`
    — "설계 근거는 쓰기 전에 뮤턴트로 반증해 보라")가 정확히 겨누는 형태의 갭이다.
    현재 스캐너가 이 저장소 코퍼스 기준으로는 우연히 안전할 수 있으나(바닥 밑줄-없는 대문자
    약어가 문서/소스 양쪽에서 동일 문자열로 대칭 수집되어 baseline-0 이 유지될 가능성이
    높기 때문), **그 안전성 자체가 검증되어 있지 않다** — 다음 사람이 이 정규식을 만지면
    "약어를 왜 뺐는지" 를 테스트가 아니라 주석에서만 알 수 있고, 뺀 것이 깨져도 아무 것도
    빨갛게 되지 않는다.
  - 제안: `scanIdentifierCitations — 축별 대조군` 블록에 "[비대상] 밑줄 없는 대문자 약어는
    안 집는다"(예: 백틱 `` `LLM` `` 단독)와 필요하면 `collectSourceTokens`/`collectEnvDeclarations`
    에도 대칭 케이스를 추가해 이 설계 결정을 이름 있는 fixture 로 고정한다. 판별 fixture 는
    이 파일이 이미 쓰는 패턴(compose 케이스 §)처럼 "두 판정이 갈리는 값" 이어야 한다 —
    단독 약어 토큰이면 충분하다(이미 `LLM`/`HTTP` 가 인접 문맥에서 다른 토큰 안에 쓰이고
    있으므로 재사용 가능).

- **[INFO]** `readIfPresent`(env.example 부재 분기)는 이 저장소 조건에서 항상 존재-분기만
  실행되고, 부재 분기(`fs.existsSync` false)는 어떤 테스트로도 커버되지 않는다
  - 위치: `codebase/frontend/src/lib/docs/__tests__/guide-identifier-existence.test.ts:30-37`
  - 상세: `codebase/backend/.env.example`·`codebase/frontend/.env.example` 는 이 저장소에
    항상 존재하므로 `fs.existsSync(abs) ? [...] : []` 의 `false` 분기는 CI 에서 실질적으로
    죽은 코드에 가깝다. 다만 이 방어는 "파일이 없어도 스위트가 죽지 않게" 하려는 이식성
    목적으로 보이고, 이 가드 가족의 다른 함수들처럼 순수 함수로 분리돼 있지 않아(코드가
    `describe` 최상단에 인라인) 합성 단위 테스트를 걸기도 번거롭다. 우선순위는 낮음 — 실패
    시 영향(경로 하나가 빈 배열이 되어 기준집합이 좁아짐)도 baseline-0 에서 즉시 드러난다.
  - 제안: 조치 불요. 다음에 이 헬퍼가 조건 분기를 하나 더 얻게 되면 그때 분리·테스트를
    함께 고려한다.

- **[INFO]** (양성 확인) `collectEnvDeclarations` 의 compose 축 판별 fixture 재확인
  - 위치: `codebase/frontend/src/lib/docs/__tests__/guide-identifier-existence.test.ts:220-233`
  - 상세: 이 테스트 자체의 주석이 "첫 판본은 들여쓴 키만 넣어서 `^\s+` → `^\s*` 뮤턴트가
    생존했다" 는 과거 실패를 정직하게 기록하고, 지금 fixture(`NOT_AN_ENV_KEY: top-level` +
    들여쓴 `POSTGRES_PASSWORD`)는 실제로 두 판정이 갈리는 값이다. 별도로 재뮤테이션하진
    않았다(직전 라운드 RESOLUTION 이 이미 표로 실측 — `^\s+`→`^\s*` RED 확인됨) — 문서화된
    실측을 신뢰. 결함 아님, 참고용 기록.

## Mock 적절성 · 테스트 격리 · 용이성

- Mock 없음 — 실제 `fs.readFileSync`/`readdirSync`/`existsSync` 로 저장소를 읽는다. 자매
  가드 5개와 동일 관례이며, "가이드가 실제로 무엇을 인용하는가" 를 검증하는 이 가드의
  존재 이유상 적절하다.
- 테스트 격리: `describe` 최상단에서 `root`/`mdxFiles`/`sourceTexts`/`envTokens`/`basis`/
  `citations` 를 한 번만 계산해 여러 `it` 이 read-only 로 공유한다. 순서 의존·뮤테이션 없음.
- 테스트 용이성: `scanIdentifierCitations`/`collectSourceTokens`/`collectEnvDeclarations`
  모두 문자열/배열 입력 → `Set`/배열 출력의 순수 함수라 fs 의존이 테스트 파일로만 밀려나
  있다. 이번 라운드에 추가된 "분기별 대조군" 이 정확히 그 구조 덕에 가능했다.

## 엣지 케이스 · 커버리지 갭 요약

- 잘 커버됨: vacuity floor(코퍼스 크기·토큰 수), 축별 대조군(포착/비포착 경계, 줄-단위
  한계 명시), 허용목록 4강제, 과거 결함(#1328) 3갈래 재현, `collectEnvDeclarations` 분기별
  대조군(이번 라운드 신규).
- 새로 발견한 갭(WARNING): `UPPER_SNAKE` 의 "밑줄 최소 1개(약어 제외)" 설계 결정 — 어느
  테스트도 겨누지 않음, 뮤테이션으로 생존 확인.
- 낮은 우선순위 INFO: `readIfPresent` 부재 분기 무검증(이식성 방어, 이 저장소에서 도달
  불가), 회귀 재현 테스트가 삭제된 옛 구현 정규식의 손-복제(이전 라운드 기록, 변화 없음).

## 요약

`collectEnvDeclarations` 뮤테이션 취약점(이전 라운드 WARNING)은 대조군 5건 추가로 실제
해소됐음을 직접 뮤테이션 재실행으로 확인했고, 이전 라운드가 지적한 회귀 단언 소실·죽은
참조 문제도 유지 확인됐다. 이번 라운드에서 새로 발견한 것은 `UPPER_SNAKE` 정규식의
"약어 제외"라는, 코드 주석이 명시적으로 선언한 설계 결정이 축·소스·env 다섯 사용처
어디에서도 테스트로 겨눠지지 않는다는 점이다 — `+`→`*` 뮤테이션이 전체 스위트(31개)를
그대로 통과시켜 실측으로 확인했다. Critical 급 결함은 없다.

## 위험도

LOW
