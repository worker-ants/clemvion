# 문서화(Documentation) 리뷰

## 배경 (4라운드 누적 — 이번 라운드는 3라운드 WARNING 4건의 조치 검증)

이 diff 는 `raw-update-guard-scope` PR 의 4번째 리뷰 라운드다. 직전 라운드(`13_46_53`)의
documentation/testing/requirement 리뷰가 낸 WARNING 4건은 커밋 `94985c55a`(`fix(backend):
3라운드 WARNING 4건 — 다중 보고·CTE 한계 고정 + 내 문서 두 곳의 사실 오류`)로 조치됐다.
`git log --oneline origin/main..HEAD` 로 커밋 이력을 확인하고, 각 WARNING 이 실제로 해소됐는지
코드/문서를 직접 열어 대조했다 — 리포트 서술을 그대로 받지 않았다.

- **W1 (`CHANGELOG.md` 판정 축 수치 오기, "음성 5" → 실제 7)**: `CHANGELOG.md:21-22` 를
  직접 읽어 확인 — 지금은 "**양성 6·음성 7**" 로 정정돼 있다. `source-scan.spec.ts` 의
  `describe('음성 — …')` 를 직접 세어 `it.each` 7개(1라운드분 5개 + 2라운드 W3 캐너리 2개)임을
  재확인했고, 저장소 전체에 `음성 5`/`음성5` 문자열이 남아 있지 않음을 grep 으로 확인했다.
  또한 CHANGELOG 항목이 이제 (1) 허용목록의 파일 단위 전면 면제 → `(파일, 사유, 지점 수)`
  3-tuple, (2) `findUnguarded` 순수 함수 추출, (3) CTE 접두를 포함한 "의도된 한계 셋" 을
  모두 언급해, 3라운드에 걸친 실질 하드닝을 빠짐없이 반영한다.
- **W2 (plan 완료 배너가 1라운드 상태만 서술)**: `plan/in-progress/update-returning-tuple-shape.md`
  의 완료 배너 하단에 `### 후속 하드닝 — 리뷰 3라운드가 가드 자신의 같은 결함을 세 겹 찾았다`
  절이 신설됐음을 확인했다. 3라운드분 표(라운드별 "가드가 막으려던 것"/"가드 자신이 가졌던 것")와
  최종 상태("양성 6·음성 7", 허용목록 3-tuple)가 정확히 최신 코드와 일치한다. 같은 항목이
  `## 체크리스트`(211행)와 `## 후속`(254행) 두 섹션에 중복 등재되지 않았음도 재확인했다 —
  체크박스는 `## 후속` 한 곳에만 있다.
- **W3 (`findUnguarded` 합성 테스트가 전부 `discovered` 원소 1개)**: `update-returning-rows.spec.ts`
  를 직접 읽어 `describe('findUnguarded — 합성 입력으로 판정 로직 자체를 고정한다')` 에 다중
  원소 케이스(`'unguarded 가 여럿이면 전부 보고한다'`)와 역방향 케이스(`'여럿 중 일부만
  unguarded 면 그 일부만 보고한다'`)가 신설됐음을 확인했다. 각 테스트 주석이 "이전엔 원소를
  하나만 써서 `break` 뮤턴트가 5개 전부 GREEN 이었다"는 경위를 정확히 남긴다.
- **W4 (CTE 접두 blind spot 이 1라운드에 지적됐으나 SUMMARY 합성에서 누락)**: `source-scan.ts`
  의 `countRawUpdateReturning` docstring "이 축이 **안** 보는 것" 절에 CTE 접두 항목이 추가돼
  QueryBuilder·`.query(sqlVar)` 두 항목과 나란히 놓였고, 그 아래 `> **이 항목은 1라운드
  리뷰가 이미 짚었는데 SUMMARY 합성에서 누락돼 두 라운드를 그냥 지나갔다**` 라는 경위 설명이
  인용 형태로 붙어 있다. `source-scan.spec.ts` 음성 `it.each` 에도 CTE 캐너리
  (`'WITH x AS (SELECT 1) UPDATE t SET a = 1 RETURNING id'`)가 추가돼 `hasRawUpdateReturning
  === false` 를 RED 방향으로 고정한다 — docstring 서술과 캐너리 입력이 정확히 대응한다.

네 건 모두 리포트만 읽고 믿지 않고 실제 파일(`CHANGELOG.md`, `source-scan.ts`,
`source-scan.spec.ts`, `update-returning-rows.spec.ts`, plan 배너)을 열어 서술과 코드가
일치하는지 대조했다 — 지어낸 서술이나 조치 누락은 발견되지 않았다.

## 발견사항

- **[INFO]** 위 4건 모두 실측 확인 — 새 결함 없음. 이 라운드에서 새로 도입된 코드
  (`findUnguarded` 다중 원소 테스트 2건, CTE 캐너리 1건, docstring/CHANGELOG/plan 배너 정정)는
  전부 "왜" 를 함께 남기는 이 저장소의 확립된 관례를 그대로 따른다.
  - 위치: `CHANGELOG.md:1-31`, `codebase/backend/src/common/__test-utils__/source-scan.ts:86-111`,
    `codebase/backend/src/common/__test-utils__/source-scan.spec.ts:60-155`,
    `codebase/backend/src/common/utils/update-returning-rows.spec.ts:300-379`,
    `plan/in-progress/update-returning-tuple-shape.md:304,348-374`
  - 제안: 없음.

- **[INFO]** `kb-stats.helper.ts` 의 "소비할 때는 `updateReturningRows` 를 거친다" 인라인 주석은
  현재 코드가 반환값을 전혀 소비하지 않는 상태(`await this.dataSource.query<...>(...)`, 대입
  없음)를 정확히 반영해 "향후 소비 시 이렇게 하라"는 지시형으로만 쓰였다 — 현재 동작을 잘못
  서술하는 낡은 주석이 아니다. 문제 없음.
  - 위치: `codebase/backend/src/modules/knowledge-base/graph/kb-stats.helper.ts:26-38`(주석),
    `:37-51`(`refresh` 본문, 반환 미소비 확인)

- **[INFO]** (기존 채널이 이미 추적 중, 신규 아님) `spec/conventions/node-cancellation.md`
  frontmatter `pending_plans:` 에 이 plan 이 여전히 미등재 — `review/consistency/2026/08/30/
  12_17_21/**` 와 이전 두 라운드의 documentation 리뷰가 이미 포착·기록했다. spec 은
  developer 쓰기 권한 밖이라 이 코드 PR 의 조치 대상이 아니다. 중복 재발견 방지 목적의
  참고 기재만 남긴다.

- **[정보 확인 — 문제 없음]** `review/code/2026/08/30/{12_41_15,13_15_58,13_46_53}/**` 및
  `review/consistency/2026/08/30/12_17_21/**` 신규 커밋 파일은 `CLAUDE.md` 가 정한 산출물
  경로 규약과 정확히 일치하는 워크플로 표준 산출물이며, 이 라운드 문서 리뷰의 대상이 아니다
  (각 파일 자체의 서술은 그 라운드 시점의 기록이라 사후 갱신 대상이 아니다 — 예: `13_46_53/
  documentation.md` 가 "음성 5" 를 지적한 서술 자체는 그 라운드 시점엔 맞는 관측이었고,
  historical record 로 보존되는 것이 이 저장소의 관례다).

## 요약

3라운드 documentation/testing/requirement 리뷰가 지적한 CHANGELOG 수치 오기, plan 완료
배너의 낡은 서술, `findUnguarded` 다중 보고 미검증, CTE blind spot 미공개 네 건 전부가
커밋 `94985c55a` 로 정확히 조치됐음을 실제 파일 대조로 확인했다. CHANGELOG 의 "양성 6·음성 7"
은 `source-scan.spec.ts` 의 실제 `it.each` 개수와 일치하고, plan 배너의 "후속 하드닝" 절은
3라운드 전체 이력을 정확히 요약하며, `findUnguarded` 신규 테스트 2건은 이전 라운드가 실증한
"조기 종료" 뮤턴트를 정확히 겨냥한다. CTE docstring 항목은 캐너리 테스트와 1:1 대응한다.
새로 도입된 CRITICAL·WARNING 급 문서화 결함은 발견되지 않았다 — 이 PR 은 4라운드에 걸쳐
스스로 발견한 문서-코드 불일치를 매번 실측으로 닫아 왔고, 이번 라운드도 그 패턴을 유지한다.

## 위험도
NONE
