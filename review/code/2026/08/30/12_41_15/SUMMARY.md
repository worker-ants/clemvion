# Code Review 통합 보고서

## 전체 위험도
**MEDIUM** — Critical 없음. 다만 이 PR 이 방지하려는 "새 raw UPDATE/DELETE...RETURNING 지점이 조용히 미가드로 남는 것"이라는 결함 클래스와 정확히 같은 형태의 blind spot 이 신설 가드 자체에 3개 독립 리뷰어(requirement·testing·maintainability)로부터 수렴 확인됐다(중첩 제네릭 정규식 미스매치, 파일-단위 존재-only 판정, 미검증 blind spot). 오늘 활성 버그는 아니나 회귀 방지 설계 목표를 정면으로 겨냥하는 gap 이라 LOW 가 아닌 MEDIUM 으로 판정.

## Critical 발견사항

(없음)

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | testing/requirement | `hasRawUpdateReturning` 의 `CALL` 정규식이 중첩 제네릭 타입 인자(`.query<Array<{...}>>(`)를 만나면 매치가 통째로 실패한다. 저장소에 이미 이 스타일이 5곳 존재(`scripts/eval-retrieval.ts:162` 등, 현재는 전부 SELECT라 무해). SQL 이 변수에 담겨 `.query(sqlVar)` 로 전달되는 경우도 탐지 못함(scratch 프로브로 실측 확인, `false` 반환) — docstring 의 "안 보는 것" 절에 미기재 | `codebase/backend/src/common/__test-utils__/source-scan.ts:97`(`CALL` 정규식), `:86-91`(docstring) | 정규식을 `<(?:[^<>]|<[^<>]*>)*>` 류로 한 단계 넓히거나 최소한 docstring 에 이 두 blind spot(중첩 제네릭·비-리터럴 SQL 변수) 명시. 고정 테스트도 추가 |
| 2 | requirement/testing | discover 기반 신설 가드가 **파일 단위 존재/부재**만 판정(`countCalls(..., 'updateReturningRows') === 0`) — 한 파일에 raw 지점이 2곳이고 헬퍼 호출이 1곳뿐이면 "가드됨"으로 오판. `EXPECTED` 기존 구가드는 정확한 개수 튜플로 이를 피하는데 신규 가드는 그 정밀도가 없음. 현재 발견되는 7개 파일은 전부 EXPECTED/ALLOWED 로 이미 정밀 커버되어 활성 버그 아님(4개 스위트 24 테스트 GREEN 확인) | `codebase/backend/src/common/utils/update-returning-rows.spec.ts:184-203` | `discover()` 를 (파일, 매치 개수) 튜플로 바꾸고 `unguarded` 판정을 `countCalls(...) >= rawCount` 로 강화하거나 최소 docstring 에 이 한계 명시 |
| 3 | testing | 신설 함수 `hasRawUpdateReturning` 자체에 전용 단위 테스트가 없다 — 자매 함수 `countCalls` 는 `source-scan.spec.ts` 에 6개 전용 테스트가 있는데 이 함수는 0개. 정규식 판정 축(오탐 배제 포함) 전체가 "오늘의 실제 소스가 우연히 그 형태를 담고 있는가"에만 의존해, 관련 파일이 리팩터되면 회귀 방어가 조용히 사라질 수 있음 | `codebase/backend/src/common/__test-utils__/source-scan.ts:93`, `source-scan.spec.ts`(해당 `describe` 부재) | `source-scan.spec.ts` 에 `hasRawUpdateReturning` 전용 `describe` 추가, 합성 문자열로 각 판정 축 직접 고정 |
| 4 | testing | (diff 범위 밖, 회귀 위험) `kb-stats.helper.spec.ts` 의 기존 mock 이 이번 diff 가 정정한 튜플 shape 와 여전히 어긋난 행 배열을 반환한다. 오늘은 `refresh()` 가 반환값을 소비하지 않아 무해하나, 이 PR 이 첨부한 plan 이 "mock 이 틀린 현실을 인코딩"을 원 결함의 근본 원인으로 명시 — 향후 소비자 추가 시 같은 결함 클래스 재발 토대 | `codebase/backend/src/modules/knowledge-base/graph/kb-stats.helper.spec.ts:19` | mock 을 `[[{ entity_count: 12, relation_count: 34 }], 1]` 로 갱신하거나 "반환 미사용" 주석 명시 |
| 5 | maintainability | `discover()`(약 813개 소스 파일 재귀 스캔)가 같은 스펙 파일 안에서 캐시 없이 3회(`it` 세 곳) 반복 호출됨. 실측 결과 현재는 24 테스트 0.97s 로 성능 문제 아니나 저장소 성장 시 선형 증가 | `codebase/backend/src/common/utils/update-returning-rows.spec.ts:193,208,220` | `beforeAll(() => { discovered = discover(); })` 로 1회만 계산해 공유 |
| 6 | documentation | `CHANGELOG.md` 가 이번 diff 의 두 실질 변경(발견형 구조 가드로 확장, `kb-stats.helper.ts` 잠재 타입 오류 정정)을 반영하지 않음 — 이 저장소는 "수정 시점 즉시 작성" 관행이 실측 확인된 곳이고, 기존 `:559` 항목("8곳" 목록)이 이번 9번째 후보 발견으로 갱신 필요 | `CHANGELOG.md:559`(관련 기존 항목, 이번 diff 미포함) | Unreleased 신규 항목 또는 `:559` 항목에 후속 각주 추가. 또는 plan 완료 이동 시점까지 미룰 경우 plan 체크리스트에 "CHANGELOG 갱신 대기" 명시 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | security | 신규 정적 스캐너(`hasRawUpdateReturning`)와 재귀 파일 탐색은 저장소 자체 `src/**` 만 대상으로 하는 테스트 전용 코드 — 외부 입력 개입 여지 없어 경로탐색/ReDoS 표면 아님. 프로덕션 번들 미포함 | `source-scan.ts:93`, `update-returning-rows.spec.ts:165,184` | 조치 불요 |
| 2 | security | `kb-stats.helper.ts` 변경은 `.query<>()` 제네릭 타입 인자뿐 — SQL 은 이미 파라미터화(`$1`+배열)돼 있고 반환값도 소비되지 않아 런타임 동작·SQL 인젝션 경로 불변 | `kb-stats.helper.ts:36` | 조치 불요 |
| 3 | requirement | 관련 규약(`raw UPDATE/DELETE...RETURNING → updateReturningRows` 불변식)이 `spec/conventions/` 에 아직 미문서화 — spec 부재이지 위반 아님. plan 에 이미 planner 위임으로 명시, consistency-check 도 독립적으로 동일 결론 | `plan/in-progress/update-returning-tuple-shape.md:409-412` | 조치 불요(추적 중) |
| 4 | scope | production 파일(`kb-stats.helper.ts`) 수정이 "테스트 가드 신설" 표제 범위를 기술적으로 넘음 — 다만 가드가 찾아낸 결함이 이 PR 이 방지하려는 클래스의 실례이고, allowlist 로 덮는 대안을 명시적으로 기각했으며 diff 가 최소침습적(타입 주석 1줄+설명 주석)이라 위험 낮음 | `kb-stats.helper.ts:26-37` | 조치 불요. 커밋 표제에 `fix` prefix 병기 고려 |
| 5 | side_effect | 신설 테스트가 실행 시점에 `src/**` 전체를 재귀 스캔하는 새로운 형태의 side effect 도입 — diff 의 명시된 설계 의도(손으로 고른 목록 대신 전수 발견)이자 plan 의 뮤테이션 실측으로 정당화됨, 결함 아님 | `update-returning-rows.spec.ts:164,184` | 조치 불요(설계 의도) |
| 6 | side_effect | `hasRawUpdateReturning` 은 순수 함수(전역 상태·파일시스템·네트워크 접근 없음), 공개 API/함수 시그니처 변경 없음, `review/consistency/**` 8개 신규 파일은 규약 경로와 정확히 일치하는 예상된 워크플로 산출물 | 전체 diff | 조치 불요 |
| 7 | maintainability | `SRC` 상수가 같은 파일 두 `describe` 블록에 재선언(사소한 중복), allowlist 사유 최소 길이 `20` 이 이름 없는 리터럴 | `update-returning-rows.spec.ts:54,136,215` | 급하지 않음 — `MIN_REASON_LENGTH` 명명, 세 번째 describe 생기면 상수 hoist 고려 |
| 8 | maintainability | 신규 JSDoc/인라인 주석이 코드 본문보다 훨씬 김 — 기존 파일이 이미 확립한 "장문 배경 설명" 컨벤션을 그대로 따른 것이라 일관성 위반 아님 | `source-scan.ts:61-92`, `kb-stats.helper.ts:29-35` | 조치 불요(기존 컨벤션 준수) |
| 9 | documentation | `spec/conventions/node-cancellation.md` frontmatter `pending_plans:` 에 이 plan 미등재 — 이미 별도 채널(consistency-check SUMMARY WARNING #4)이 포착한 사실과 중복 | `plan/in-progress/update-returning-tuple-shape.md:402-403` | 조치 불요(이미 추적 중, 중복 방지 목적 기록) |
| 10 | documentation | 신규 함수/블록의 JSDoc 은 "왜 필요한가"·"판정 축"·"안 보는 것(의도)"을 명시하고 오탐 사례를 표로 문서화 — 코드와 직접 대조 검증해 서술-동작 일치 확인. `kb-stats.helper.ts` 신규 주석도 기존 주석을 지우지 않고 옆에 정정 맥락을 덧붙이는 좋은 관례 | `source-scan.ts:93`, `update-returning-rows.spec.ts:135`, `kb-stats.helper.ts:29-35` | 문제 없음 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 신뢰된 1st-party 소스만 다루는 테스트 전용 코드, SQL 은 기존에 이미 파라미터화 — 인젝션/ReDoS/시크릿 노출 없음 |
| requirement | LOW | 핵심 로직은 의도대로 동작(23개 신규 테스트 GREEN 실측). 다만 스캐너 정밀도에 2개 실증 gap(중첩 제네릭, 파일-단위 존재-only 판정) — 오늘은 비활성이나 이 PR 의 설계 목표를 정면으로 겨냥하는 미래 회귀 경로 |
| scope | LOW | production 파일(`kb-stats.helper.ts`) 수정이 "테스트 가드" 표제 범위를 기술적으로 넘지만 근거가 충분히 기록됨. 나머지는 정상 워크플로 산출물 |
| side_effect | LOW | 신설 filesystem 스캔은 의도된 설계, `kb-stats.helper.ts` 는 순수 타입 변경, 공개 API 변경 없음 |
| maintainability | LOW | `discover()` 캐시 없이 3회 반복 호출(성능/중복), 소소한 상수 재선언·매직넘버 — 기능 문제 없음 |
| testing | MEDIUM | `hasRawUpdateReturning` 전용 단위 테스트 부재, 미문서화된 blind spot(변수 SQL), 파일-단위 존재-only 판정, diff 밖이지만 관련된 `kb-stats.helper.spec.ts` mock shape 불일치(회귀 토대) |
| documentation | LOW | `CHANGELOG.md` 미갱신(관행 이탈)이 유일한 실질 gap. 그 외 JSDoc/plan 문서화 수준 높음 |

## 발견 없는 에이전트

(없음 — 전 7개 reviewer 모두 최소 1건 이상의 발견 또는 명시적 확인 기록을 반환함)

## 권장 조치사항
1. `hasRawUpdateReturning` 에 전용 단위 테스트를 추가하고, 중첩 제네릭(`.query<Array<{...}>>(`)·비-리터럴 SQL 변수(`.query(sqlVar)`) 두 blind spot 을 최소한 docstring 에 명시 (testing WARNING #1·#3, requirement WARNING #1)
2. discover 기반 가드를 파일-단위 존재 판정에서 매치 개수 비교로 강화하거나, 최소한 이 한계를 docstring 에 명시 (requirement WARNING #2, testing WARNING #3 일부)
3. `kb-stats.helper.spec.ts` 의 mock 을 이번 diff 가 정정한 튜플 shape(`[rows, count]`)에 맞게 갱신 — 향후 반환값 소비 추가 시 같은 결함 클래스 재발 방지 (testing WARNING #4)
4. `CHANGELOG.md` 에 이번 발견형 가드 확장 + `kb-stats.helper.ts` 정정을 반영 (documentation WARNING #6)
5. (선택, 낮은 우선순위) `discover()` 를 `beforeAll` 로 캐싱해 3회 반복 스캔 제거 (maintainability WARNING #5)

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security`, `requirement`, `scope`, `side_effect`, `maintainability`, `testing`, `documentation` (7명)
  - **제외**: 아래 표 (7명)
  - **강제 포함(router_safety)**: `documentation`, `maintainability`, `requirement`, `scope`, `security`, `side_effect`, `testing` — 전원 결과 확보됨(누락 없음)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | router 판단(성능 관련 변경 아님으로 분류) |
  | architecture | router 판단 |
  | dependency | router 판단 |
  | database | router 판단 |
  | concurrency | router 판단 |
  | api_contract | router 판단 |
  | user_guide_sync | router 판단 |

  (제외 사유 상세는 prompt 에 개별 명시되지 않아 router 판단으로만 기재)
