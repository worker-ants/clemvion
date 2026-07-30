# 유지보수성(Maintainability) Review

## 조사 방법

리뷰 페이로드가 두 파일의 "전체 파일 컨텍스트"로 주어져, 실제 변경 범위를 `git diff
origin/main...HEAD -- <두 파일>`(누적 4개 코드 커밋: `b351731f0`→`414550a1d`→
`7a05c6ec8`→`886ca9395`)로 확정한 뒤, 동일 파일에 대한 선행 유지보수성 리뷰
(`review/code/2026/07/28/20_32_57/maintainability.md` 6R, `review/code/2026/07/30/
11_41_20/maintainability.md` 7R)와 그 처분 기록(`review/code/2026/07/30/11_41_20/
RESOLUTION.md`, `plan/in-progress/retry-turn-terminal-guard.md` §코드 표)을 대조했다.
production 로직(`retry-turn.service.ts`)은 7R 이후 JSDoc 정정만 있었고(`7a05c6ec8`),
`retry-turn.service.spec.ts` 는 회귀 테스트 2건만 추가됐다(`886ca9395`) — 이 범위에서
신규로 발생한 것과, 이미 여러 라운드에 걸쳐 발견·추적·defer 확정된 것을 구분해 보고한다.

## 발견사항

- **[INFO]** 테스트 케이스 문자 라벨(`(a)`~`(f)`) 순서가 파일 내 실제 위치와 어긋난다 (이번 라운드 신규 발생).
  - 위치: `codebase/backend/src/modules/execution-engine/retry-turn.service.spec.ts`
    — `describe('applyRetryLastTurn — early-exit guards')` 블록. `(c)` 446번째 줄
    다음에 `(f)` 474번째 줄이 오고, 라벨 없는 테스트("claim 성공 후 try 진입 전
    구간에서 예외가 나면...") 505번째 줄을 거쳐 `(d)` 545번째 줄·`(e)` 567번째 줄이
    가장 마지막에 나온다.
  - 상세: 이 describe 블록은 `applyRetryLastTurn` 의 가드 순서를 문자로 추적하는
    관례를 쓴다(헤더 주석: "각 가드에서... 잠근다"). 최근 회귀 테스트 추가
    (`886ca9395`, RESOLUTION #4)가 새 케이스를 `(f)` 로 이름 붙이면서 — 기존
    `(d)`/`(e)` 를 다시 손대지 않기 위한 실용적 선택으로 보임 — 문자 순서가
    `a,a,b,b2,b3,c,f,[무라벨],d,e` 로 비단조(non-monotonic)해졌다. 실행·커버리지에는
    영향 없는 순수 스캔 가독성 이슈다.
  - 제안: 급하지 않음. 다음에 이 describe 블록을 편집할 기회가 있으면 `(f)` 를
    실제 코드 순서(`(c)` 바로 다음, `(d)`/`(e)` 이전 — 예: `(c2)`)에 맞는 라벨로
    바꾸거나, 무라벨 테스트에도 라벨을 부여해 일관성을 맞추는 것을 권장.

- **[INFO]** 테스트 query-builder mock 보일러플레이트 반복이 이번 라운드에 더
  늘었다 (기존 추적 항목의 연장, 신규 발견 아님).
  - 위치: `retry-turn.service.spec.ts` — `{ update: jest.fn().mockReturnThis(),
    set:…, where:…, andWhere:…, execute: jest.fn().mockResolvedValue({ affected: N
    }) }` 형태가 파일 전역 12곳(예: 64, 76, 392, 417, 451, 479, 528, 1067, 1118,
    1149, 1225, 1285번째 줄)에 인라인으로 반복된다.
  - 상세: 7R(`review/code/2026/07/30/11_41_20/maintainability.md`) 이 이미 9곳
    반복을 "테스트 전용 코드, 우선순위 낮음"으로 판정했다. 이번 라운드의 신규
    회귀 테스트(`(f)`, NODE_STARTED payload)가 그중 1곳을 추가로 늘렸다. 판단
    자체는 여전히 유효 — 공유 팩토리(`function mockQueryBuilder(affected, spies?)`)
    추출로 축약 가능하나 지금 조치할 정도는 아니다.
  - 제안: 조치 불요. 반복 지점이 계속 늘면 팩토리 추출을 재고.

- **[INFO]** 이미 P2/P3 로 tracked 된 백로그 항목 — 이번 diff 는 손대지 않았음 (현상 유지 확인).
  - 위치: `retry-turn.service.ts:288`-`:483` (`applyRetryLastTurn`, 약 196줄) /
    `:377`-`:388` vs `:389`-`:400` (execution/node not-found 처리 블록, 로그·에러
    메시지 문자열만 다르고 구조가 동일한 5줄 블록 반복).
  - 상세: `plan/in-progress/retry-turn-terminal-guard.md` §코드 표 #19(P3 —
    `claimAndSyncRetryState` 헬퍼로 `applyRetryLastTurn` 길이·복잡도 축소)와
    #9(P3, 1R→7R 3회 재지적 — `markSpawnedRowFailed` 헬퍼로 not-found 중복 제거)로
    이미 등재·defer 확정돼 있다. 7R 이후 두 커밋(`7a05c6ec8`, `886ca9395`)은 JSDoc
    정정과 테스트 추가만 포함하고 이 두 영역의 프로덕션 로직은 전혀 건드리지
    않았다 — 악화도 개선도 없는 현상 유지.
  - 제안: 별도 조치 불필요(이미 우선순위·후속 계획 문서화됨). 재확인 목적으로만 기재.

- **[INFO]** `claimSpawnedRetryRow` JSDoc 의 조건 서술 순서가 실제 `.andWhere()`
  체이닝 순서와 다르다 (6R·7R 에 이미 지적, 3회째 재확인 — 미변경).
  - 위치: `retry-turn.service.ts:491`-`:497`(JSDoc — `jsonb_exists` 를 먼저 서술)
    vs `:546`-`:549`(코드 — `status = :running` 을 먼저 체이닝, `jsonb_exists` 는
    다음).
  - 상세: SQL `AND` 는 교환법칙이 성립해 동작에는 영향 없다. 두 라운드 모두
    우선순위 밖으로 defer 됐고 이번 diff(JSDoc 정정 커밋 `7a05c6ec8` 포함)에서도
    이 부분은 수정되지 않았다.
  - 제안: 사소하지만, 다음에 이 함수를 편집할 기회가 있으면 서술 순서를 코드
    순서에 맞추는 것을 권장. 별도 커밋은 불필요.

- **[INFO]** 신규/확장된 JSDoc·인라인 주석 분량이 실제 로직 대비 크다 (기존
  tracked 패턴의 연장, 각 문단은 실제 결함 근거를 담고 있어 무관한 주석은 아님).
  - 위치: `claimSpawnedRetryRow` JSDoc(`:485`-`:537`, 약 53줄) vs 함수 본문(`:538`-
    `:552`, 15줄) / `applyRetryLastTurn` 의 claim 삽입 구간 주석(`:301`-`:368`,
    실행문은 그중 약 12줄뿐).
  - 상세: 각 문단은 CRITICAL #1(claim 을 손상 판정보다 먼저 실행해야 하는 이유),
    CRITICAL #2(in-memory delete 로 TypeORM jsonb 부활 차단), W2/W6/W9(백스톱 갭·
    payload 영향·버전 방어) 등 실제로 발견·수정된 결함의 근거를 정확히 지목한다.
    다만 이런 "review-round 서사"가 라운드마다 누적되면, 신규 합류자가 "지금
    유효한 계약"과 "과거 논쟁 경과"를 구분하기 점점 어려워진다.
    `plan/in-progress/retry-turn-terminal-guard.md` §코드 표 #12 가 `finalizeGuarded`
    의 유사 패턴(~40줄 회고 주석)을 "안정화 후 정리" 대상으로 이미 추적 중이며,
    이번 diff 는 그 기존 방침을 그대로 따른 것으로 보인다 — 신규 이탈이 아니다.
  - 제안: 지금 조치 불필요. 코드가 안정화되면(향후 라운드에서 CRITICAL 이 더 안
    나오면) `claimSpawnedRetryRow`/`applyRetryLastTurn` 도 §12 정리 대상에 포함해
    review-round 서사를 plan/rationale 문서로 옮기고, 코드 주석은 "현재 불변식 +
    왜"만 남기는 일괄 정리를 고려.

## 요약

프로덕션 로직(`retry-turn.service.ts`)은 직전 유지보수성 라운드(7R,
`review/code/2026/07/30/11_41_20`) 이후 JSDoc 정정만 있었을 뿐 구조 변경이
없었고, 그 라운드 자체가 이미 "LOW" 위험도로 수렴 판정했던 상태다. `RETRY_STATE_KEY`
상수 도입은 과거 WARNING(리터럴 4곳 drift 위험)을 정확히 해소했고, `claimSpawnedRetryRow`
는 단일 책임의 작고 테스트하기 쉬운 헬퍼로 잘 추출돼 있으며, guard-clause/early-return
스타일 덕분에 `applyRetryLastTurn` 은 길이에 비해 중첩은 얕게 유지된다. 네이밍은
기존 관례(`finalizeGuarded`/`completeRetryExecution` 등)와 일관되고, 신규 회귀
테스트 2건도 기존 테스트 스타일(`makeSpawnedRow`/`expectGraphNotDriven` 재사용)을
그대로 따른다. 남은 항목은 전부 INFO 수준이며 그중 다수(`applyRetryLastTurn`
길이·not-found 블록 중복·JSDoc 조건 순서·주석 분량)는 이미 6R/7R 에서 발견돼
`plan/in-progress/retry-turn-terminal-guard.md` 에 P2/P3 로 defer 확정된 항목의
재확인이고, 이번 라운드에서 유일하게 새로 관찰되는 것은 테스트 케이스 문자 라벨의
비단조 순서와 mock 보일러플레이트 개수 증가 정도로, 둘 다 낮은 우선순위의 스캔
가독성 이슈다.

## 위험도

LOW
