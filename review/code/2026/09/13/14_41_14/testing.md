# 테스트(Testing) 리뷰 — guide-identifier-existence

## 검토 개요

`guide-error-code-existence.test.ts` + `guide-error-code-scan.ts` (3축: FieldTable `name` ·
`code:` · 실패-문맥 산문)를 삭제하고, `guide-identifier-existence.test.ts` +
`guide-identifier-scan.ts` (3축: FieldTable `name` · `code:` · **문맥-무관 백틱 전수**, 기준집합에
env 선언처 병합, `GUIDE_EXTERNAL_VOCABULARY` 4강제 허용목록)로 교체하는 변경이다. plan
(`plan/in-progress/guide-identifier-existence.md`)에 뮤테이션 7건(RED 6 · GREEN 1, 생존 사유
기록)이 문서화돼 있고, 과거 결함(`#1328` `MCP_INSECURE_URL_ALLOWED`)을 합성 fixture 3갈래로
재현하는 회귀 테스트가 신설됐다. 전반적으로 vacuity floor·회귀 고정·허용목록 오남용 방지라는
이 저장소의 표준 테스트 패턴을 잘 따르고 있다.

## 발견사항

- **[WARNING] 실제 코퍼스에 대한 회귀 fixture 가 신규 스위트에서 사라졌다 — 합성 입력으로만 대체**
  - 위치: 구 `guide-error-code-existence.test.ts` 의 `it("실패 설명 셀의 괄호 인용이 코퍼스에서
    실제로 걷힌다", ...)` (파일 전체가 삭제되어 gate 없음 — 대응 신규 위치는
    `guide-identifier-existence.test.ts` 전체 중 부재).
  - 상세: 구 테스트는 `citations.filter(c => c.file.endsWith("discord.en.mdx") && c.axis ===
    "prose")` 로 **실제 저장소의 특정 mdx 파일·특정 토큰**(`EXECUTION_TIMEOUT`)이 스캐너에
    실제로 걸리는지를 고정했다. 주석에 그 이유가 명시돼 있다 — "위 floor 는 총량만 본다. 문맥
    신호를 좁은 판으로 되돌리면 총량은 거의 그대로인데 **이 형태만** 사라지므로, 그 회귀를
    이름으로 고정한다." 신규 파일에는 이에 대응하는 **실제 파일 기반** 단언이 없다.
    `guide-identifier-existence.test.ts:137-168` 의 "과거 결함 (#1328)" describe 블록은
    `MCP_INSECURE_URL_ALLOWED` 회귀를 고정하지만 전부 **손으로 만든 합성 문자열**(`BROKEN`/
    `FIXED`)이고, `guide-identifier-existence.test.ts:90-96` 의 "세 축이 모두 후보를 낸다"는
    실제 코퍼스를 쓰지만 **집계 임계값**(`byAxis("backtick") > 100`)만 검사해 개별 토큰을
    특정하지 않는다. `backtick` 축이 문맥-무관(unconditional)으로 바뀌어 예전에 우려했던
    "문맥으로 좁혀서 그 형태만 조용히 빠지는" 시나리오는 구조적으로 재발하기 더 어려워졌지만,
    "스캐너가 실제 MDX 인코딩·이스케이프·줄바꿈 형태를 정확히 처리하는가"를 실증하는 **명명된
    실제 예시**가 하나도 남지 않았다는 점은 그대로 남는 갭이다. 총량 floor 는 이런 좁은 회귀를
    가릴 수 있다(개별 항목 하나가 빠져도 100 을 여전히 넘을 수 있음).
  - 제안: 최소 1개는 실제 mdx 파일 + 실제 토큰을 지정하는 회귀 단언을 유지할 것(예: 기존
    discord.en.mdx 예시를 새 axis 이름(`backtick`)으로 재작성). 합성 fixture 만으로는 실제
    코퍼스의 서식 편차(개행·이스케이프·비 ASCII 문맥)를 검증하지 못한다.

- **[INFO] `collectEnvDeclarations` 가 합성 입력으로 직접 단위 테스트되지 않는다 — 오직 실제
  `.env.example`/compose 파일을 통해서만 간접 검증됨**
  - 위치: `codebase/frontend/src/lib/docs/__tests__/guide-identifier-scan.ts:167-189`
    (`export function collectEnvDeclarations`). 테스트 측 대응: `guide-identifier-existence.test.ts:44-51`
    (`envExampleTexts`/`composeTexts` 수집)·`:76-88`(env floor 테스트) — 전부 저장소의 **실제
    파일**을 입력으로 쓰고, 이 함수를 합성 문자열로 직접 호출하는 단위 테스트는 없다.
  - 상세: 두 정규식의 경계 동작이 실측되지 않았다 — (1) `envLine`(`^#?\s*(UPPER_SNAKE)=`)은
    **주석 처리된 줄**(`#FOO_BAR=...`)도 "선언"으로 잡는다. 이게 의도인지(문서화된 예시도
    선언으로 친다) 우연인지 테스트로 고정돼 있지 않다. (2) `composeLine`(`^\s+(UPPER_SNAKE):\s`)은
    YAML 들여쓰기가 있는 **모든** 위치의 UPPER_SNAKE 키를 잡는다 — `environment:` 절 밖의 임의
    YAML 키(예: 서비스명이 우연히 UPPER_SNAKE 인 경우)도 포섭될 수 있다. 이 함수는 기준집합을
    "넓히는" 방향으로만 쓰이므로 오탐(허위 결함 신고)으로 이어지진 않지만, 기준집합이 의도보다
    넓어지는 경계가 코드로 문서화되지 않았다.
  - 제안: `collectEnvDeclarations` 를 합성 `.env.example`/`docker-compose.yml` 스니펫으로 직접
    호출하는 단위 테스트 1~2개를 추가해 위 두 경계(주석 처리 줄 포함 여부·비-environment 절
    YAML 키 포함 여부)를 명시적으로 고정할 것. `collectSourceTokens`/`scanIdentifierCitations` 는
    이미 합성 입력 단위 테스트가 충분하므로 동일 수준으로 맞추는 것을 권장.

- **[INFO] compose 파일 탐색이 저장소 루트 최상위로 고정되어 있고, 그 스코프가 테스트로
  고정되지 않았다**
  - 위치: `guide-identifier-existence.test.ts:48-51`
    (`fs.readdirSync(root).filter(f => f.endsWith(".yml") || f.endsWith(".yaml"))`).
  - 상세: 하위 디렉터리의 compose 파일(있다면)은 기준집합에서 조용히 빠진다. 오늘은
    `envTokens.has("POSTGRES_PASSWORD")` 단언(`:83`)이 루트 compose 파일이 실제로 읽혔음을
    간접 보증하지만, "루트만 본다"는 설계 결정 자체를 명시하는 테스트/주석은 없다.
  - 제안: 낮은 우선순위 — 저장소에 compose 파일이 루트에만 있다는 관례가 유지된다면 문제
    없음. 관례가 바뀌면(하위 디렉터리로 이동) 이 fallback 이 조용히 깨진다는 점만 기록해 둘 것.

- **[INFO] `readIfPresent` 의 "파일 부재" 분기가 실측되지 않는다**
  - 위치: `guide-identifier-existence.test.ts:40-43`.
  - 상세: `fs.existsSync` 가드는 방어적 코드이지만, 오늘 두 `.env.example` 파일이 모두 실재하므로
    이 분기가 실행되는 경로가 테스트 스위트 내에서 한 번도 관측되지 않는다. 실제 오늘의 판정을
    지탱하지 않는 조용한 코드 경로라는 점에서 `collectEnvDeclarations` 자체가 "오늘 판정을
    지탱하지 않는다"고 스스로 문서화한 것과 같은 성격이다.
  - 제안: 우선순위 낮음 — 정적 파일 존재를 가정하는 헬퍼이므로 별도 단위 테스트 없이도 위험은
    낮다. 다만 향후 이 함수가 더 복잡해지면 첫 대상이 될 것.

- **[INFO] 회귀 테스트가 저장소의 현재 실제 소스 상태에 결합돼 있다 (house style, 심각하지 않음)**
  - 위치: `guide-identifier-existence.test.ts:154-158`
    (`it("정정된 이름은 통과한다", ...)` 의 `expect(basis.has("MCP_ALLOW_INSECURE_URL")).toBe(true)`).
  - 상세: 이 단언은 스캐너 로직이 아니라 **실제 저장소에 그 식별자가 여전히 존재하는지**에
    의존한다. 향후 누군가 이 식별자를 다시 리네임하면, 스캐너 자체는 멀쩡한데 이 회귀 테스트만
    깨진다 — 원인 추적 시 "회귀가 재발했나?" 로 오인하기 쉽다. 다만 이는 이 가드 계열
    (`*-existence.test.ts`) 전체가 의도적으로 실제 저장소를 fixture 로 쓰는 house style
    이므로(자매 파일들도 동일 패턴) 새로 만든 문제는 아니다.
  - 제안: 조치 불요 — 참고 목적으로만 기록. 만약 이 테스트가 자주 깨지기 시작하면 스캐너 로직만
    분리해 순수 합성 입력으로 테스트하는 리팩터링을 고려할 것.

## 강점 (참고)

- vacuity floor(코퍼스 미적재·축별 0건 방지)가 구 파일과 동일한 엄격도로 이식됐고, env 병합용
  floor 도 별도로 추가됐다(`:67-74`, `:76-88`).
- `GUIDE_EXTERNAL_VOCABULARY` 허용목록에 대해 "외부 시스템 명시·상한·여전히 인용됨·기준집합에
  없음" 4가지를 강제하는 메타 테스트(`:109-135`)는 허용목록이 은폐 수단으로 변질되는 것을
  구조적으로 막는 좋은 설계다.
- plan 문서가 뮤테이션 결과(RED 6·GREEN 1)와 생존 사유(env 병합이 오늘은 비-load-bearing)를
  숨기지 않고 공개해, "테스트가 실제로 무엇을 지탱하는지"가 투명하다.
- 과거 실제 결함(#1328)을 3갈래(오탐 잡음/정정 통과/구 축이었다면 놓침)로 고정한 회귀 테스트는
  이 가드의 존재 이유를 코드로 증명하는 모범적 패턴이다.

## 요약

테스트 자체의 구조·격리·가독성은 이 저장소의 높은 기준(vacuity floor, 뮤테이션 검증, 허용목록
남용 방지 메타 테스트)을 잘 따르고 있고 Critical 급 결함은 없다. 다만 구-신 전환 과정에서
"실제 코퍼스의 특정 파일·토큰을 명명해 고정하는 회귀 테스트"가 하나도 남지 않고 전부 합성
fixture 로 대체된 점(WARNING)은 총량 floor 로는 가려질 수 있는 좁은 회귀 형태를 놓칠 여지를
남긴다. 나머지는 `collectEnvDeclarations`/`readIfPresent`/compose 탐색 스코프처럼 오늘의 판정을
지탱하지 않는 방어적 코드 경로에 대한 직접 단위 테스트 부재로, 위험도는 낮다.

## 위험도

LOW
