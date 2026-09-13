# 테스트(Testing) 리뷰 — error-code-emission-axis

## 발견사항

- **[WARNING]** 신규 수집기 3종(`collectQuotedLiterals`·`collectMessagePrefixes`·`collectCatalogCodes`)에 형제 함수와 같은 급의 **합성 경계 대조군이 없다**
  - 위치: `codebase/frontend/src/lib/docs/__tests__/guide-identifier-existence.test.ts` — 파일 전체(그레핑 결과 `describe("collectQuotedLiterals…")`/`describe("collectMessagePrefixes…")`/`describe("collectCatalogCodes…")` 0건). 대응 함수 정의는 `codebase/frontend/src/lib/docs/__tests__/guide-identifier-scan.ts:344`(`collectQuotedLiterals`)·`:361`(`collectMessagePrefixes`)·`:383`(`collectCatalogCodes`)
  - 상세: 같은 파일에서 `collectSourceTokens`(343번째 줄)와 `collectEnvDeclarations`(373번째 줄)는 각각 전용 `describe` 블록으로 손으로 짠 fixture 경계 대조군을 갖는다(예: `\b` 워드 경계, `#?` 주석 분기, compose 매핑 vs 리스트 스타일 — "두 판정이 갈리는 값"을 명시적으로 고른다). 이번에 추가된 발행 축 세 함수는 이 관례를 따르지 않고, 실제 저장소 코퍼스에 대한 통계적 하한(`quotedLiterals.size > 200` 등)과 이름 있는 회귀 케이스(`MAX_ITERATIONS_EXCEEDED` vs `CONTAINER_MISSING_EMIT`) 하나로만 검증된다.
    - `QUOTED_LITERAL = new RegExp(`(['"\`])(${UPPER_SNAKE})\\1`, "g")`(guide-identifier-scan.ts:260)의 **역참조 제약**(여는/닫는 따옴표가 같아야 함, 예: `` 'TOKEN" `` 은 매치되면 안 됨)을 직접 겨눈 fixture가 없다. plan(`plan/in-progress/error-code-emission-axis.md` §체크리스트)이 "역참조 제거 뮤턴트 → RED"를 보고하지만, 그 RED는 **실제 코퍼스에 우연히 존재하는 불일치 따옴표 사례**에 의존한 것이지 결정적 fixture가 아니다 — 코퍼스가 바뀌면 이 방어가 조용히 사라질 수 있다.
    - `MESSAGE_PREFIX = new RegExp(`['"\`](${UPPER_SNAKE}):\\s`, "g")`(guide-identifier-scan.ts:263)의 "콜론+공백" 요구도 합성 fixture로 고정돼 있지 않다(콜론 없음·공백 없음 두 갈래가 갈리는 값 미검증).
    - `CATALOG_CODE`(guide-identifier-scan.ts:266)의 "백틱으로만 감싼 코드"라는 전제도 합성으로 검증되지 않는다.
  - 이 프로젝트 자신의 이력(같은 파일 JSDoc 라운드 5·7 기록)이 정확히 이 클래스의 결함 — "판별 fixture가 없어 뮤턴트가 생존" — 을 여러 번 반복해서 겪었다고 적어 두고 있다. 이번 축도 같은 패턴(실제 코퍼스 의존 검증)으로 세워져 있어 재발 위험이 있다.
  - 제안: `collectSourceTokens`/`collectEnvDeclarations`와 같은 형태로 `describe("collectQuotedLiterals/collectMessagePrefixes/collectCatalogCodes — 경계 대조군")`를 추가하고, 표에 정리된 "두 판정이 갈리는 값"(불일치 따옴표, 콜론 유무, 공백 유무, 백틱 유무)을 손으로 짠 문자열로 명시적으로 고정할 것.

- **[WARNING]** `GUIDE_NON_EMITTED_VOCABULARY`의 `where` 필드가 **검증되지 않는 프리텍스트**다 — 소스 위치가 바뀌어도 테스트가 못 잡는다
  - 위치: `codebase/frontend/src/lib/docs/__tests__/guide-identifier-scan.ts:308`~`329` (`GUIDE_NON_EMITTED_VOCABULARY` 선언, 특히 `where: "execution-engine.service.ts:7121·7125 — 템플릿 리터럴 메시지 접두"`)
  - 상세: 실측으로 확인한 바 지금은 정확하다(`codebase/backend/src/modules/execution-engine/execution-engine.service.ts:7121,7125,7130`에 해당 리터럴이 실재). 그러나 "죽은 등록 방지" 테스트(`guide-identifier-existence.test.ts` — `등록된 3종이 **실제로 접두 전용**이다`)는 `isMessagePrefixOnly(token)`만 확인할 뿐 `where` 문자열이 가리키는 파일·줄과는 무관하게 판정한다. 즉 향후 이 메시지가 다른 파일로 옮겨지거나 리팩터링돼도(발행 형태 자체는 유지한 채) 이 테스트는 계속 GREEN 이고 `where` 는 조용히 stale 해진다. 이 저장소는 정확히 같은 클래스의 문제(SoT 포인터가 실제로 존재하는지)를 `impl-anchor-existence.test.ts`(symbol grep ≥1 매치 강제)로 이미 다른 축에서는 막고 있어, 이 신규 목록만 그 관례에서 비켜나 있다.
  - 제안: `where`에서 `file:line` 형태를 파싱해 해당 줄에 토큰이 실제로 등장하는지 grep 하는 최소 검증을 추가하거나, 최소한 파일명만이라도 `fs.existsSync` + 내용 포함 여부로 확인하는 테스트를 추가.

- **[INFO]** 카탈로그 SoT 파일 read 가 다른 파일과 달리 존재 가드 없이 하드 실패한다
  - 위치: `codebase/frontend/src/lib/docs/__tests__/guide-identifier-existence.test.ts:82`~`87` (`fs.readFileSync(path.join(root, "spec/5-system/3-error-handling.md"), "utf8")`)
  - 상세: 바로 위(33~41번째 줄)의 `.env.example` 읽기는 `readIfPresent`로 부재를 허용하지만, 이 읽기는 그대로 `fs.readFileSync`를 호출해 파일이 없으면 스위트 전체가 `ENOENT`로 죽는다(테스트 실패가 아니라 설정 오류처럼 보인다). SoT 경로가 고정이라는 설계 의도상 큰 문제는 아니나, spec 문서가 재편되면(이 프로젝트에서 실제로 자주 일어나는 일) 원인 파악이 다른 파일들보다 느려진다.
  - 제안: 필수 여부에 따라 `existsSync` 체크 + 명시적 에러 메시지("SoT 파일 이동 여부 확인")를 넣거나, 최소한 주석으로 "의도적으로 하드 실패시킨다(SoT 부재는 이 가드 자체의 전제가 무너진 것)"를 남겨 다음 사람이 헷갈리지 않게 할 것.

## 요약

핵심 로직(`isMessagePrefixOnly` 합성, `GUIDE_NON_EMITTED_VOCABULARY` 등록 강제 4종, 베이스라인-0, vacuity floor)은 이 파일이 이미 확립한 강한 테스트 관례(하한 검증·이름-고정 회귀·거울상 목록 제약 교차검증)를 그대로 따르고 있고, plan 문서가 보고한 뮤테이션 4건 전부 RED 확인 절차도 이 클래스 결함 이력에 비춰 적절하다. 다만 새로 추가된 세 수집기 함수(`collectQuotedLiterals`·`collectMessagePrefixes`·`collectCatalogCodes`)는 형제 함수들과 달리 **합성 경계 대조군 없이 실제 코퍼스 통계와 이름-하나짜리 회귀 케이스로만** 검증되어, 이 파일 자신의 과거 이력이 반복해서 지적한 "판별 fixture 부재 → 뮤턴트 생존" 패턴을 재도입할 위험이 있다. 또한 `GUIDE_NON_EMITTED_VOCABULARY`의 `where`(근거 위치) 필드는 assertion으로 뒷받침되지 않는 프리텍스트라 향후 소스 이동 시 조용히 stale 해질 수 있다. 두 항목 모두 즉시 차단 사유는 아니며(현재 값은 실측으로 정확함을 확인), 후속 라운드에서 형제 함수 수준의 합성 테스트를 보강할 것을 권한다.

## 위험도
LOW
