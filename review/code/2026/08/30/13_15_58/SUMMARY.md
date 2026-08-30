# Code Review 통합 보고서

## 전체 위험도
**MEDIUM** — CRITICAL 0건. WARNING 3건(전부 `requirement`/`testing`) 모두 이번 PR 이 새로 도입한 "발견형 raw UPDATE/DELETE…RETURNING 가드" 자체의 정밀도·회귀방어 갭이며, 활성 프로덕션 버그는 아니다. forced whitelist 7명(`documentation`·`maintainability`·`requirement`·`scope`·`security`·`side_effect`·`testing`) 전원 결과 확보됨 — 강제 화이트리스트 미이행 없음.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | requirement | `ALLOWED` 허용목록이 **파일 단위 전면 면제**라, 이번에 고친 "개수 기반 판정" 원칙이 이미 ALLOWED 인 파일 안에 새로 생기는 raw 지점에는 적용되지 않는다. 각 ALLOWED 항목의 사유는 "오늘 존재하는 1개 지점"에 대한 판단인데 면제는 파일 전체에 걸려, 예컨대 `kb-stats.helper.ts`에 헬퍼 없이 소비하는 두 번째 raw 지점이 생겨도 가드는 여전히 GREEN이다. | `codebase/backend/src/common/utils/update-returning-rows.spec.ts:153-171`(`ALLOWED` 정의), `:215-227`·특히 `:218`(`if (allowed.has(rel)) return false;`) | `ALLOWED`를 (파일, 사유, 사유가 유효한 raw 지점 수)로 확장해 `discovered`의 `rawCount`와 비교하거나, 최소한 docstring에 "ALLOWED 항목은 파일 전체가 면제되며 그 안에 새 raw 지점이 늘어도 이 가드는 잡지 못한다"는 한계를 명시 |
| 2 | testing | 이 PR 의 핵심 하드닝인 개수 기반 판정(`guardCount < rawCount`, 구 존재-only `=== 0` 판정 대체)을 구 판정과 실제로 가르는 **판별 입력**(부분 커버리지: raw 지점 ≥2 이면서 헬퍼가 그보다 적게 거치는 파일)이 오늘의 저장소 상태에도, 어떤 영속 테스트에도 없다. 유일한 검증은 리뷰 라운드 중 합성해 확인 직후 삭제한 수동 프로브 파일(`__raw-update-probe.ts`) 1회뿐 — 이 판정 로직이 향후 `=== 0`으로 후퇴해도 자동화 테스트가 잡지 못한다. | `codebase/backend/src/common/utils/update-returning-rows.spec.ts:215-227`(판정 로직, 별도 함수로 미추출) | 판정 로직을 `judgeUnguarded(discovered, allowed, guardCountFn)` 류 순수 함수로 추출해, 합성 입력(`[['fake/file.ts', 2]]` + guardCount=1 스텁)으로 "부분 커버리지가 unguarded 로 분류된다"를 영속 고정 |
| 3 | testing | `countRawUpdateReturning` docstring 이 스스로 명시한 두 blind spot(`.query(sqlVar)` 변수 전달, 2단계 이상 중첩 제네릭)이 문서화만 되고 캐너리 테스트로 고정되지 않았다 — 같은 파일의 `countCalls`가 이미 세운 "알려진 한계는 합성 fixture 로 RED 방향까지 고정" 관례에서 벗어난다. | `codebase/backend/src/common/__test-utils__/source-scan.ts:92,109`(docstring 서술), 대응 테스트 부재: `source-scan.spec.ts:100-125`(음성 `describe`) | `it.each` 음성 목록에 `'await db.query(sqlVar);'`류와 2단계 중첩 제네릭 케이스를 추가해 `hasRawUpdateReturning(...) === false`를 명시 고정 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | maintainability | allowlist 최소 사유 길이 `20`이 이름 없는 리터럴 (이전 라운드부터 이월, 저비용 유예 지속) | `update-returning-rows.spec.ts:239` | `MIN_REASON_LENGTH` 상수화. 우선순위 낮음 |
| 2 | maintainability | `SRC` 상수가 같은 파일 내 두 `describe` 블록에 재선언됨 (이전 라운드부터 이월) | `update-returning-rows.spec.ts:54,145` | 세 번째 `describe` 생기면 파일 상단 hoist 고려 |
| 3 | maintainability | 신설 `hasRawUpdateReturning` 이 자기 테스트 파일 외 소비자 없음 (docstring 이 "향후 소비자용 얇은 래퍼"임을 명시, 의도적) | `source-scan.ts:124`, 소비: `source-scan.spec.ts:4,95,123,134` | 조치 불요 — 두 번째 소비자 생기기 전까지 현행 유지 |
| 4 | requirement | `raw UPDATE/DELETE…RETURNING → updateReturningRows` 불변식이 `spec/conventions/`에 정식 규약으로 미문서화 (모순 아닌 부재, 이미 planner 위임으로 추적 중) | `plan/in-progress/update-returning-tuple-shape.md:409`(`[planner 위임]`) | 조치 불요 — 다음 planner 턴 대기 |
| 5 | scope | `kb-stats.helper.ts` 프로덕션 타입 정정이 "테스트 가드" 표제 범위를 기술적으로 넘음 — 단, 이전 라운드에서 이미 근거와 함께 승인됐고 이번 라운드는 범위를 넓히지 않음(mock 만 정정, SUMMARY#4 요청 범위 안) | `codebase/backend/src/modules/knowledge-base/graph/kb-stats.helper.ts` (`refresh()`) | 조치 불요 |
| 6 | documentation | `spec/conventions/node-cancellation.md` frontmatter `pending_plans:` 에 이 plan 미등재 (범위 밖, developer 권한 밖, 이미 이전 라운드/consistency-check 가 포착·추적 중) | `plan/in-progress/update-returning-tuple-shape.md:402-403` | 조치 불요 — planner 턴 대상 |
| 7 | security/side_effect | 신규 정적 스캐너(`countRawUpdateReturning`)와 `update-returning-rows.spec.ts` 의 `src/**` 전수 재귀 스캔은 읽기 전용·저장소 내부 1st-party 소스만 대상 — 인젝션·경로탐색·ReDoS 표면 아님(정규식 catastrophic-backtracking 은 scratch 환경 직접 프로브로 선형 시간 확인) | `source-scan.ts:100-121`, `update-returning-rows.spec.ts:174,196` | 조치 불요 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 시크릿/인젝션/경로탐색/ReDoS 없음 — 신규 스캐너·순회 전부 테스트 전용, 1st-party 소스만 대상. `kb-stats.helper.ts`는 타입 주석만 변경, SQL 리터럴/파라미터 바인딩 불변 |
| requirement | MEDIUM | `ALLOWED` 허용목록이 파일 단위 전면 면제라 개수 기반 판정 원칙이 그 안에서는 적용 안 됨(WARNING #1). 나머지 이전 라운드 지적 4건은 실측 재현으로 정확히 해소 확인 |
| scope | NONE | 이번 5개 커밋 전부 직전 리뷰 SUMMARY WARNING #1~#6 에 1:1 매핑, 요청받지 않은 변경·범위 이탈 없음 |
| side_effect | LOW | 신규 테스트의 `src/**` 전수 읽기 전용 스캔(설계 의도, 이전 라운드 기결). `kb-stats.helper.ts` 타입 변경은 런타임 부작용 없음 |
| maintainability | LOW | 이전 라운드 WARNING(중첩 제네릭 미탐지·`discover()` 반복호출·전용테스트 부재) 전부 해소 확인. 사소한 매직넘버/상수중복 이월 2건 |
| testing | MEDIUM | 이전 라운드 4건 해소 확인. 신규 갭 2건: 핵심 하드닝(`guardCount < rawCount`) 판별 fixture 부재(WARNING #2), docstring blind spot 캐너리 미고정(WARNING #3) |
| documentation | NONE | `CHANGELOG.md` 신규 서술·JSDoc·주석 전부 코드와 직접 대조해 일치 확인, 지어낸 서술 없음. CHANGELOG 미갱신(이전 WARNING) 해소 |

## 발견 없는 에이전트

없음 — 전 에이전트가 최소 INFO 이상 기록. 다만 `security`·`scope`·`side_effect`·`documentation` 4개 에이전트는 실질적으로 "조치 불요" 확인성 INFO만 남겼으며 위험도 NONE/LOW로 수렴.

## 권장 조치사항
1. **[testing WARNING #2 최우선]** 개수 기반 판정(`guardCount < rawCount`)을 실제로 가르는 판별 입력이 코드베이스 어디에도 영속하지 않는다 — 판정 로직을 순수 함수로 추출해 합성 스텁 입력으로 "부분 커버리지 → unguarded" 를 영속 고정한다. 이 PR 의 핵심 하드닝이 회귀해도 잡을 자동화 테스트가 현재 없다.
2. **[requirement WARNING #1]** `ALLOWED` 를 파일 단위 전면 면제에서 (파일, 사유, 유효 raw 지점 수) 단위로 좁히거나, 최소한 docstring 에 "ALLOWED 파일 내부에 새 raw 지점이 늘어도 이 가드는 잡지 못한다"는 한계를 명시한다.
3. **[testing WARNING #3]** `.query(sqlVar)`·2단계+ 중첩 제네릭 두 blind spot을 `it.each` 음성 케이스로 추가해 이 파일이 이미 세운 "알려진 한계는 RED 방향으로 고정" 관례를 완성한다.
4. (낮은 우선순위, 이월) `MIN_REASON_LENGTH` 상수화, `SRC` 상수 파일 내 중복 정리 — 급하지 않음.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security`, `requirement`, `scope`, `side_effect`, `maintainability`, `testing`, `documentation` (7명)
  - **강제 포함(router_safety)**: `documentation`, `maintainability`, `requirement`, `scope`, `security`, `side_effect`, `testing` — forced 전원 결과 확보됨(누락 없음)
  - **제외**: 아래 표 (7명)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | router 판단상 이번 diff 와 무관(범위 외) |
  | architecture | router 판단상 이번 diff 와 무관(범위 외) |
  | dependency | 의존성(패키지) 변경 없음 |
  | database | 스키마/마이그레이션 변경 없음 |
  | concurrency | 동시성 로직 변경 없음 |
  | api_contract | 공개 API 계약 변경 없음 |
  | user_guide_sync | 사용자 가이드 문서 대상 아님(내부 개발 가드 변경) |
