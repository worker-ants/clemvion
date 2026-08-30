STATUS=success requirement review complete
===REPORT_MARKDOWN_BELOW===
### 발견사항

- **[INFO]** 4라운드째 requirement 리뷰 — 직전 라운드(`14_11_02`)의 유일한 WARNING(`ALLOWED` 3-tuple 의 선언 개수가 `discover()` 실측과 교차검증되지 않아, 오타로 부풀리면(`1`→`99`) 그 파일에 새로 생긴 미가드 지점이 조용히 통과)이 커밋 `1d606f7d0` 로 정확히 해소됐음을 코드 직접 열람으로 재확인했다.
  - 위치: `codebase/backend/src/common/utils/update-returning-rows.spec.ts:287-302` (신규 `it('허용목록의 선언 개수가 실측과 정확히 일치한다 — 부풀리면 그만큼 조용히 미검증')`, `measured.get(rel) !== declared` 로 양방향 정확 일치를 요구)
  - 상세: `findUnguarded`(`:167-182`) 자체는 여전히 `rawCount > allowedCount` 상한 검사만 하지만(의도적으로 유지 — plan `:373-377` 근거: 판정이 "미가드 지점"과 "목록이 낡음" 두 축을 한 함수·한 실패 메시지로 뭉개지 않기 위함), 신규 테스트가 그 반대 방향(선언값이 실측보다 크거나 작음)을 별도 축으로 닫는다. `ALLOWED` 목록의 4개 실제 선언값(2/2/2/1)을 대응 소스 파일과 직접 grep 대조한 결과 오늘 시점 실측과 정확히 일치한다. `npx jest src/common/__test-utils__/source-scan.spec.ts src/common/utils/update-returning-rows.spec.ts src/modules/knowledge-base/graph/kb-stats.helper.spec.ts` 를 직접 실행해 **3 suites / 48 tests 전부 GREEN** 을 재확인했다(직전 라운드 46 → 48, 신규 2건은 이 W1 fix + 멀티라인 캐너리).
  - 제안: 조치 불요 — 참고 기록.

- **[INFO]** 판정 축의 양성/음성 표본이 CHANGELOG·plan 완료 배너·실제 테스트 코드 세 곳에서 정확히 일치한다 — "양성 7·음성 8".
  - 위치: `CHANGELOG.md:21`("양성 7·음성 8"), `plan/in-progress/update-returning-tuple-shape.md:366`(동일 수치), `codebase/backend/src/common/__test-utils__/source-scan.spec.ts:69-106`(양성 `it.each` 7개: 백틱·작은따옴표·큰따옴표·DELETE·제네릭·중첩제네릭·멀티라인), `:110-159`(음성 `it.each` 8개: INSERT RETURNING·INSERT ON CONFLICT·RETURNING 없는 UPDATE·주석·QueryBuilder·`.query(sqlVar)`·2단계 중첩 제네릭·CTE 접두)
  - 상세: 이전 세 라운드가 "숫자를 세 번 틀렸다"(`plan:369-371`)고 스스로 기록한 이력이 있어 이번 라운드는 코드를 직접 세어 문서 수치와 대조했다 — 지어낸 서술이나 낡은 수치 없음.
  - 제안: 조치 불요.

- **[INFO]** `kb-stats.helper.ts` 의 타입 정정(`{...}[]` → `[{...}[], number]`)이 spec 서술과 일치함을 확인했다.
  - 위치: `codebase/backend/src/modules/knowledge-base/graph/kb-stats.helper.ts:36-49`, `spec/data-flow/6-knowledge-base.md:107`("UPDATE knowledge_base SET entity_count, relation_count (atomic recount — KbStatsHelper)"), `spec/5-system/10-graph-rag.md:145,248-249`(`entity_count`/`relation_count` 캐시 컬럼 정의)
  - 상세: spec 은 이 헬퍼가 단일 atomic UPDATE 로 캐시 컬럼을 갱신한다고만 서술하고 TypeScript 반환 타입까지는 규정하지 않는다 — 타입 정정이 spec 과 상충하지 않는다(회색지대 아님, 서술 범위 밖). SQL 본문·바인딩·호출 시그니처(`refresh(knowledgeBaseId: string): Promise<void>`)는 diff 전후 불변.
  - 제안: 조치 불요.

- **[INFO]** spec fidelity — raw `UPDATE/DELETE … RETURNING → updateReturningRows` 불변식이 `spec/conventions/` 에 아직 규약으로 승격되지 않았다(4라운드 전부가 독립적으로 같은 결론에 도달).
  - 위치: `spec/conventions/` 전수 grep 0건(재확인), `plan/in-progress/update-returning-tuple-shape.md:381-389`(`[planner 위임]`, 이미 착수 대기 항목으로 명시)
  - 상세: spec 부재이지 spec 과의 모순이 아니다. developer 쓰기 권한 밖이라 이 코드 PR 의 조치 대상이 아니며, plan 이 이미 planner 턴으로 명시 위임해 뒀다. 새로 발견한 gap 이 아니라 4라운드째 동일하게 확인·유지되는 상태다.
  - 제안: 조치 불요(이미 추적 중, planner 턴에서 처리).

- **[INFO]** 이번 diff(63개 파일)의 실질 코드/문서 변경 7개 파일(`CHANGELOG.md`, `source-scan.ts`, `source-scan.spec.ts`, `update-returning-rows.spec.ts`, `kb-stats.helper.ts`, `kb-stats.helper.spec.ts`, plan 문서) 전부를 직접 Read 로 열람해 세 이전 라운드(`12_41_15`→`13_15_58`→`13_46_53`→`14_11_02`)가 지적·해소한 항목이 코드에 정확히 반영돼 있음을 재확인했다. 나머지 56개 파일은 이전 4라운드 리뷰(`review/code/2026/08/30/{12_41_15,13_15_58,13_46_53,14_11_02}/**`)와 consistency-check(`review/consistency/2026/08/30/12_17_21/**`) 산출물로, 이 요구사항 관점 리뷰의 대상이 아니다(각 라운드 시점의 historical record).
  - 위치: 전체 diff
  - 상세: `git status --short` 로 이 세션 산출 디렉터리 외 저장소 잔여물이 없음을 확인했고, 저장소 트리는 뮤테이션하지 않았다(직접 Read/Grep/jest 실행만 수행).
  - 제안: 조치 불요.

### 요약

이 PR 은 5라운드째 requirement 리뷰다. 1~4라운드가 순차로 찾아 닫은 결함 클래스 — 중첩 제네릭 미탐지, 파일 단위 존재-only 판정, 허용목록 파일 단위 전면 면제, 판정 로직 검증 부재, 다중 unguarded 미보고, CTE 접두 blind spot 미공개, CHANGELOG/plan 수치 오기, 그리고 직전 라운드의 허용목록 **선언값** 자체의 미검증 — 이 전부 코드에 반영되고 영속 테스트(합성 스텁 + 뮤테이션 실측)로 고정된 상태를 직접 소스 대조와 `npx jest` 재실행(3 suites / 48 tests GREEN)으로 확인했다. `kb-stats.helper.ts` 의 타입 정정은 spec(`data-flow/6-knowledge-base.md`, `5-system/10-graph-rag.md`)의 서술과 상충하지 않는다. 이번 라운드에서 새로 발견한 요구사항 충족 관점의 CRITICAL·WARNING 은 없다. 남은 항목은 전부 이미 추적 중인 INFO(spec 규약 미승격 — planner 위임, `hasRawUpdateReturning` 단일 소비자 — 조건부 유예)뿐이며, PR 이 스스로 정의한 목표선("목록 밖 raw UPDATE/DELETE 지점을 발견하고 개수로 정밀 판정")은 완전히 충족됐다.

### 위험도

NONE
