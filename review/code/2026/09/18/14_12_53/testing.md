# 테스트(Testing) 리뷰 — 삭제 연쇄 FK 인덱스 다섯 (V112~V116)

## 검토 범위

이 PR 의 실질 코드 변경은 마이그레이션 10개(파일 1~10, `.conf`+`.sql` 다섯 쌍)와 신규 e2e
`codebase/backend/test/deletion-cascade-indexes.e2e-spec.ts` (파일 11) 뿐이다. 애플리케이션 코드
변경은 없다(plan 문서 자신도 명시). 나머지(파일 12~34)는 plan/consistency 산출물과 spec 문서라
테스트 관점에서는 "그 문서가 테스트 요건을 정확히 서술하는가" 만 참고 대조 대상으로 삼았다.

실제 파일(`codebase/backend/test/deletion-cascade-indexes.e2e-spec.ts`, `codebase/backend/test/helpers/db.ts`,
선례 `codebase/backend/test/trigger-workflow-ref.e2e-spec.ts`, `codebase/backend/test/trigger-deletion-releases-resources.e2e-spec.ts`,
`codebase/backend/test/jest-e2e.json`)를 직접 `Read` 로 열어 프롬프트 게이트 번호와 대조했다 —
일치함을 확인했고 저장소에 어떤 뮤테이션도 가하지 않았다(`git status --short` 미실행 — 읽기만 했으므로 불필요).

## 발견사항

- **[INFO]** 스키마 검증만 있고 "인덱스가 실제로 FK 트리거 조회에 쓰이는가" 를 확인하는 실행 계획(`EXPLAIN`) 단언이 없다
  - 위치: `codebase/backend/test/deletion-cascade-indexes.e2e-spec.ts:55-68` (`it.each` 블록)
  - 상세: 테스트는 `indisvalid`·`pg_get_indexdef` 로 인덱스의 **존재·유효성·정의**(선두 컬럼·부분 조건)만 확인한다. 이 PR 의 핵심 주장(부모 삭제 시 자식 테이블 풀스캔이 사라진다)은 planner 가 실제로 이 인덱스를 골라 쓴다는 전제 위에 있는데, e2e 는 그 전제를 직접 검증하지 않는다. 다만 이것은 **이 PR 이 새로 만든 갭이 아니다** — 선례 V111 테스트(`trigger-deletion-releases-resources.e2e-spec.ts:199-212`)도 정확히 같은 범위(존재·유효성·정의)만 본다. 정의(선두 컬럼 + 부분 조건 일치)가 맞으면 FK 등치 조회가 그 인덱스를 후보로 삼을 조건은 충족되므로, 실측(plan 문서의 800k 규모 벤치마크)과 결합하면 실질적 위험은 낮다.
  - 제안: 조치 불요(선례와 동일 범위). 원한다면 후속 PR 에서 `EXPLAIN (FORMAT JSON)` 을 곁들인 대규모 벤치마크를 별도 성능 테스트로 분리하는 정도.

- **[INFO]** 테스트 파일 조직이 기존 선례(리소스별 삭제 e2e 파일에 인덱스 검증을 얹는 패턴, V111)와 다른 새 패턴(3개 테이블을 아우르는 전용 파일)을 도입한다
  - 위치: `codebase/backend/test/deletion-cascade-indexes.e2e-spec.ts` (신규 파일 자체), 대조군 `codebase/backend/test/trigger-deletion-releases-resources.e2e-spec.ts:199-212`
  - 상세: 이 갈림은 이미 `review/consistency/2026/09/18/13_55_55/naming_collision.md`(및 그 SUMMARY 권장사항 #5)가 독립적으로 지적했고 "충돌 아님, 이 PR 은 변경 불요, 다음 유사 PR 에서 수렴 여부 판단" 으로 처분됐다. 테스트 관점에서도 동의한다 — 다섯 인덱스가 서로 다른 세 테이블·두 삭제 경로에 걸쳐 있어 어느 한 리소스 e2e 파일에 자연스럽게 속하지 않으므로 전용 파일이 합리적 선택이다. 재지적 목적이 아니라 "테스트 조직 관점에서도 이미 처분된 항목과 일치한다" 는 교차 확인으로 기록한다.
  - 제안: 조치 불요.

- **[INFO]** 정규식이 문자열 끝(`$`)만 앵커링하고 시작은 앵커링하지 않는다
  - 위치: `codebase/backend/test/deletion-cascade-indexes.e2e-spec.ts:23,27,31,35,39` (`EXPECTED` 배열의 `def` 필드)
  - 상세: `toMatch(/ON public\.<table> USING btree \(...\)$/)` 는 `CREATE INDEX ... ON public.<table> USING btree (...)` 전체가 아니라 `ON public...` 이후 접미사만 대조한다. 인덱스 이름은 이미 SQL `WHERE c.relname = $1` 로 특정했으므로 이 자체가 오탐을 만들 실질 위험은 없다(선례 V111 테스트도 동일한 접미사-only 패턴). 다만 완전성 관점에서 `^CREATE (UNIQUE )?INDEX` 부분까지 앵커링하면 "의도치 않게 UNIQUE 인덱스가 생성됐다" 같은 변형도 걸러낼 수 있다.
  - 제안: 조치 불요(선례 일치, 저위험). 원한다면 후속 강화 과제로.

- **[INFO]** 커버리지 갭은 아니지만 명시: 애플리케이션 코드(서비스 계층의 삭제 로직)는 변경되지 않았으므로 unit 테스트 추가가 필요 없다는 판단이 맞다
  - 위치: `plan/in-progress/spec-draft-deletion-cascade-indexes.md` `## 구현` 절 ("애플리케이션 코드 변경 없음")
  - 상세: 순수 인덱스 추가라 기존 unit(`*.service.spec.ts`) 스위트를 건드릴 필요가 없고 실제로 건드리지 않았다. e2e 만으로 "스키마가 의도대로 배포됐는가" 를 검증하는 것이 이 변경의 성격에 맞는 유일한 계층이다.
  - 제안: 없음(확인 사항).

## 각 관점별 요약

1. **테스트 존재**: 신규 인덱스 5개 전부에 대응하는 `it.each` 케이스가 1:1로 존재. 충분.
2. **커버리지 갭**: 스키마 존재·유효성·정의까지는 커버, planner 실사용 여부는 비커버(선례와 동일 범위, 신규 갭 아님).
3. **엣지 케이스**: `indisvalid=false`(CONCURRENTLY 실패 잔재) 케이스를 명시적으로 문는 것이 이 테스트의 핵심 가치 — 존재만 보는 단언보다 강하다. partial index 의 `WHERE` 절도 정규식에 포함해 NULL 포함 여부까지 구분. 적절.
4. **Mock 적절성**: mock 없음, 실제 Postgres 카탈로그(`pg_index`/`pg_class`)를 직접 조회 — 스키마 검증 목적에 정확히 부합, mock 이 필요 없는 종류의 테스트.
5. **테스트 격리**: 읽기 전용 카탈로그 조회만 수행(데이터 삽입/삭제 없음), `jest-e2e.json` `maxWorkers:1` 과 결합해 다른 스펙과 상호작용 없음. 독립 실행 가능.
6. **테스트 가독성**: 파일 상단 JSDoc 이 "왜 `indisvalid` 까지 보는가" 를 설명하고 `it.each` 로 5개 케이스를 테이블처럼 나열해 의도가 명확. 우수.
7. **회귀 테스트**: 기존 V111 테스트(`trigger-deletion-releases-resources.e2e-spec.ts`)를 건드리지 않았고, `jest-e2e.json` `testRegex: ".e2e-spec.ts$"` 가 새 파일을 자동으로 픽업하므로 CI 스코프 누락 없음 확인.
8. **테스트 용이성**: 마이그레이션은 DI 가 필요 없는 선언적 산출물이라 테스트 용이성 문제 자체가 없음 — 스키마 대조라는 가장 직접적인 검증 방식을 택했다.

## 요약

이 PR 의 테스트 변경은 신규 e2e 스펙 하나로, 다섯 인덱스 각각의 존재·`indisvalid`·정의(선두 컬럼+부분 조건)를 대조한다. 검증 대상이 순수 DB 마이그레이션(애플리케이션 코드 변경 없음)이라는 점에서 이 스펙이 유일하게 필요한 테스트 계층이며, 정확히 선례(V111, `trigger-deletion-releases-resources.e2e-spec.ts`)가 확립한 패턴(존재만이 아니라 invalid 잔재까지 잡는 것)을 다섯 배로 확장해 재사용했다. `it.each` 데이터 테이블 구조와 상단 JSDoc 이 의도(왜 `indisvalid`까지 보는지, 왜 partial 인지)를 명확히 전달해 가독성이 높고, 읽기 전용 카탈로그 조회만 하므로 테스트 격리도 안전하다. 발견된 사항은 모두 INFO 수준이며 그중 다수(테스트 파일 조직 이원화)는 이미 consistency 리뷰에서 독립적으로 지적·처분된 항목과 일치해 재작업을 요구하지 않는다. 유일하게 남는 아쉬운 점은 "인덱스가 planner 에 실제로 채택되는가" 를 e2e 가 직접 확인하지 않는다는 것이지만, 이는 선례가 처음부터 갖고 있던 한계이고 별도 벤치마크(plan 문서의 800k 규모 실측)로 이미 보완돼 있다.

## 위험도

LOW
