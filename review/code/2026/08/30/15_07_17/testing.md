# 테스트(Testing) Review — `15_07_17`

## 스코프 확인

`git log`/`git diff origin/main..HEAD` 로 실측한 결과, 이 라운드가 검토해야 할 **순증분**은
직전 라운드(`14_33_52`, Critical 0·Warning 0·risk LOW 로 이미 수렴) 이후 커밋
`e5b237377` 하나뿐이다 — `kb-stats.helper.spec.ts` 의 인라인 주석 2개를 영어에서
한국어로 번역한 것이 전부(코드/단언/mock 값 변경 없음). 나머지 파일(`source-scan.ts`,
`source-scan.spec.ts`, `update-returning-rows.spec.ts`, `kb-stats.helper.ts`,
`CHANGELOG.md`, plan 문서, `review/**` 산출물)은 프롬프트가 누적 diff(`origin/main` 기준)
전체를 다시 실어 준 것이라, 이미 1~5라운드에서 검토·수정·재검증된 내용과 동일하다.
아래는 (a) 이번 순증분에 대한 독립 확인과 (b) 누적 diff 전체에 대한 testing 관점 재확인을
함께 담는다 — 재확인에서 새로 발견한 것은 없다.

## 검증

- `git diff origin/main..HEAD -- codebase/backend/src/modules/knowledge-base/graph/kb-stats.helper.spec.ts`
  로 이번 순증분이 `//` 주석 2줄의 텍스트 치환뿐임을 직접 확인 — 문자열 리터럴(`toMatch`
  정규식, mock 값)은 손대지 않았다. 번역 전후 의미 대조 결과 정보 손실 없음(4개월 결함의
  근거·shape 설명·"거짓 shape 를 물려받는다" 경고가 그대로 보존됨).
- `npx jest kb-stats.helper.spec.ts source-scan.spec.ts update-returning-rows.spec.ts` 를
  로컬에서 직접 실행 — **3 suites / 48 tests 전부 GREEN** (0.445s). 저장소 트리는 건드리지
  않았다(순수 실행, `git status --short` 로 사전 확인해 세션 산출물 외 변경 없음을 재확인).
- `CHANGELOG.md` 의 "양성 7 · 음성 8" 수치를 `source-scan.spec.ts` 의 `it.each` 배열
  원소를 직접 세어 대조 — 정확히 일치(양성 7개: 백틱/작은따옴표/큰따옴표/DELETE/제네릭/중첩
  제네릭/멀티라인, 음성 8개: INSERT/ON CONFLICT/RETURNING없음/주석/QueryBuilder/변수SQL/2단계
  중첩/CTE). 과거 라운드에서 이 수치가 세 번 낡았던 이력(`01_12_26`→`13_46_53`→`14_11_02`)이
  있어 별도로 재검증했고, 이번엔 정확하다.
- `hasRawUpdateReturning` 이 실제 가드(`discover()`)에서는 쓰이지 않고 자기 테스트 파일에서만
  호출되는 것을 확인했으나, 이는 `13_46_53`/`14_33_52` 라운드에서 이미 "2번째 소비자가
  생기기 전까지 현행 유지"로 명시 유예된 항목이라 새로 지적하지 않는다.

## 발견사항

새로 보고할 Critical/Warning 없음. 누적 diff 전체를 대상으로 8개 점검 관점(존재 여부·
커버리지 갭·엣지 케이스·Mock 적절성·격리·가독성·회귀 유효성·테스트 용이성)을 다시 훑었고,
아래는 이미 이전 라운드들이 발견·수정·검증까지 마친 항목이라 참고로만 남긴다(조치 불요):

- **[INFO]** `update-returning-rows.spec.ts` 의 발견형 가드(`discover()`)는 저장소
  `src/**` 실 파일에 결합된 통합 테스트라, 이 PR 과 무관한 다른 PR 이 새 raw
  `UPDATE…RETURNING` 지점을 추가하면 이 스펙이 실패할 수 있다. 설계 의도(입력 집합 자체를
  커버리지로 삼아 "목록 밖 지점"을 잡는다)가 docstring 과 plan 에 명시돼 있고, `findUnguarded`
  의 판정 로직 자체는 별도 `describe`(`:327-400`)에서 파일시스템과 무관한 합성 입력으로
  격리 검증되므로 — 실제 소스 결합은 의도된 특성이지 테스트 격리 결함이 아니다.
- **[INFO]** `kb-stats.helper.spec.ts` 의 mock shape(`[[{...}], 1]` / `[[], 0]`) 은
  TypeORM 의 raw `UPDATE…RETURNING` 실제 반환 계약(`[rows, affectedCount]`)과 일치하도록
  이번 PR 이 직접 정정한 것이다 — 이 저장소가 4개월 앓은 결함이 "mock 이 틀린 현실을
  가르쳐 줬다"는 원인 분석에 정확히 대응하는 수정이라 Mock 적절성 관점에서 모범적이다.
- **[INFO]** `findUnguarded` 순수 함수 추출 + 합성 스텁 7종(부분/완전/초과 커버리지,
  허용목록 초과/이내, 다중 unguarded 전건 보고, 통과 항목이 순회를 끊지 않음)은 이 PR 이
  스스로 진단한 "가드의 가드가 없다"는 결함을 정확히 겨냥해 닫은 것이며, RESOLUTION 문서에
  뮤턴트 예측/실측(예: `break` 뮤턴트 → RED 1개만, 나머지 GREEN)까지 기록돼 있어 판별력이
  실증됐다.
- **[INFO]** `ALLOWED` 허용목록의 "선언 개수가 `discover()` 실측과 정확히 일치"하는지 보는
  테스트가 `findUnguarded`(상한 검사만 함)의 반대 방향(과다 선언으로 조용히 통과하는 경로)을
  닫는다 — 4라운드에 걸쳐 두 방향(경로 존재·개수 상한/하한)을 순차적으로 조인 이력이 plan
  에 예측/실측 표로 남아 있고, 뮤테이션(선언 `1`→`99`)으로 실제 판별력을 확인했다.

## 요약

이번 라운드(`15_07_17`)의 실질 순증분은 `kb-stats.helper.spec.ts` 주석 2줄의 언어 번역
뿐이며, 문자열 리터럴·단언·mock 값에는 손대지 않아 테스트 관점에서 위험이 없다(로컬
재실행으로 48/48 GREEN 확인). 이 PR 이 누적으로 담고 있는 테스트 설계(발견형 회귀 가드,
`findUnguarded` 순수 함수 추출과 합성 스텁, mock shape 정정)는 이미 5라운드에 걸쳐
Critical/Warning 을 전량 흡수했고 각 수정이 예측→실측 뮤테이션 표로 뒷받침돼 있어, 이번
라운드에서 독립적으로 재검토해도 테스트 존재 여부·커버리지 갭·엣지 케이스·Mock 적절성·
격리·가독성·회귀 유효성·테스트 용이성 8개 관점 모두에서 추가로 지적할 새 결함을 찾지
못했다. 유일하게 남아 있는 항목(`hasRawUpdateReturning` 미사용, `ALLOWED`
docstring/테스트주석 설명 중복, `CONSUMING` 정규식 자매 중복)은 전부 이전 라운드가 이미
발견해 근거와 함께 plan 에 명시적으로 유예해 둔 것이라 재지적하지 않는다.

## 위험도

NONE
