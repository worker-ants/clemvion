# 유지보수성(Maintainability) Review

## 리뷰 범위

실질 검토 대상(애플리케이션/테스트 코드 + 문서):
- `codebase/backend/src/common/__test-utils__/source-scan.ts` — `countRawUpdateReturning`/`hasRawUpdateReturning` 신설
- `codebase/backend/src/common/__test-utils__/source-scan.spec.ts` — 위 두 함수의 판정 축 전용 테스트 신설
- `codebase/backend/src/common/utils/update-returning-rows.spec.ts` — 발견형 구조 가드 `describe` 신설(개수 판정 + `beforeAll` 캐싱)
- `codebase/backend/src/modules/knowledge-base/graph/kb-stats.helper.ts` / `.spec.ts` — 타입 인자 튜플 정정 + mock 정정
- `plan/in-progress/update-returning-tuple-shape.md`, `CHANGELOG.md` — 문서(보조 검토)

`review/code/2026/08/30/12_41_15/**`, `review/consistency/2026/08/30/12_17_21/**`(파일 8~28)는 이전 라운드가 생성한 워크플로 산출물(리포트 md/json)이라 애플리케이션 코드가 아니므로 본 관점 리뷰의 정밀 검토 대상에서 제외한다(이전 라운드의 동일 관점 리뷰어가 이미 같은 스코프 판단을 내렸다 — `review/code/2026/08/30/12_41_15/maintainability.md`). 다만 이 파일들이 이전 라운드에서 지적된 WARNING #1/#2/#5(중첩 제네릭 미탐지, 파일-단위 존재-only 판정, `discover()` 3회 반복 호출)가 실제로 고쳐졌는지는 `RESOLUTION.md`/`_resolution_log.md` 의 주장과 실제 코드(`source-scan.ts`/`update-returning-rows.spec.ts`)를 대조해 확인했다 — 세 항목 모두 코드에 반영돼 있다(아래 "이전 라운드 대비 변화" 참조).

뮤테이션 검증은 수행하지 않았다 — 이전 라운드(`12_41_15`)의 RESOLUTION.md 가 동일 항목에 대해 이미 예측/실측 뮤턴트 표(3건)를 남겼고, main 세션도 독립 재검증을 기록해 뒀다. 저장소 트리에는 아무것도 쓰지 않았다(`git status --short` 미변경 확인 불요 — Read 전용 조사).

## 이전 라운드(12_41_15) 대비 변화

- WARNING #5(`discover()` 3회 반복 호출) — `update-returning-rows.spec.ts:210-213` 에 `beforeAll(() => { discovered = discover(); })` 로 캐싱돼 4개 `it` 이 공유한다. 해결 확인.
- WARNING #1(중첩 제네릭 미탐지) — `source-scan.ts:111-112` 의 `CALL` 정규식이 `<(?:[^<>]|<[^<>]*>)*>` 로 한 단계 중첩까지 받도록 넓어졌고, docstring(`:105-110`)이 "2단계 이상은 여전히 못 받는다"는 잔여 한계를 명시한다. 해결 확인.
- (testing 관점이지만 유지보수성과 겹침) `hasRawUpdateReturning`/`countRawUpdateReturning` 전용 테스트 부재 — `source-scan.spec.ts:67-136` 에 양성 6·음성 5·개수 1 케이스로 신설됐다. 해결 확인.

## 발견사항

- **[INFO]** allowlist 최소 사유 길이 `20` 이 이름 없는 리터럴이다
  - 위치: `codebase/backend/src/common/utils/update-returning-rows.spec.ts:239` (`expect(ALLOWED.filter(([, why]) => why.trim().length < 20)).toEqual([]);`)
  - 상세: 이전 라운드(`review/code/2026/08/30/12_41_15/maintainability.md`)에서도 동일하게 지적됐고 "급하지 않음"으로 유예된 항목으로, 이번 라운드에서도 여전히 코드에 남아 있다. `20`이라는 임계값의 근거가 코드 어디에도 없어, 다음 사람이 이 값을 조정하려면 의도를 재구성해야 한다.
  - 제안: `const MIN_REASON_LENGTH = 20;` 로 이름을 붙이면 의도가 코드에 남는다. 우선순위는 낮음(기능적 결함 아님, 두 라운드 연속 동일 지적).

- **[INFO]** `SRC` 상수가 같은 파일 안 두 `describe` 블록에 동일하게 재선언된다
  - 위치: `codebase/backend/src/common/utils/update-returning-rows.spec.ts:54`(기존, 이번 diff 밖) 와 `:145`(이번 diff 신설) — 둘 다 `join(__dirname, '..', '..')`
  - 상세: 이전 라운드에서도 지적된 사소한 중복으로, 이번에도 미해결 상태다(자매 파일 `assert-row-array.spec.ts` 도 파일 간 동일 패턴을 쓰므로 파일 간 중복은 기존 컨벤션이지만, 이번 지적은 "같은 파일 내" 중복에 한정된다).
  - 제안: 급하지 않음. 세 번째 `describe` 가 생기면 파일 상단으로 hoist 고려.

- **[INFO]** 신설 `hasRawUpdateReturning` 이 자기 자신의 테스트 파일 외에는 어디서도 소비되지 않는다
  - 위치: 정의 `codebase/backend/src/common/__test-utils__/source-scan.ts:124`, 소비는 `source-scan.spec.ts:4,95,123,134` 뿐. 실제 발견형 가드(`update-returning-rows.spec.ts`)는 개수가 필요해 `countRawUpdateReturning` 을 직접 쓰고(`:5,200,217`), `hasRawUpdateReturning` 은 import 하지 않는다.
  - 상세: `grep -rn "hasRawUpdateReturning" codebase/backend/src/` 로 직접 확인했다. `{@link countRawUpdateReturning} 의 "지점이 존재하는가" 만 필요할 때 쓰는 얇은 래퍼`라는 docstring(`:123`)이 명시하듯 의도적으로 "향후 소비자를 위한" 편의 API 로 남겨둔 것이라 유해하지는 않다 — 구현이 2줄이라 유지비용도 사실상 0이다. 다만 지금 시점엔 프로덕션/가드 양쪽에 실제 소비자가 없는 export 라는 점은 기록해 둔다(YAGNI 관점의 아주 약한 신호).
  - 제안: 조치 불요. 실제 두 번째 소비자가 생기기 전까지는 현재 형태 유지가 합리적이다.

- **[INFO]** `discover()` 가 찾은 파일을 "발견된 지점은 모두..." 테스트에서 다시 `readFileSync` 한다
  - 위치: `update-returning-rows.spec.ts:196-204`(`discover()` 내부에서 `readFileSync(f, 'utf8')` 로 1차 읽기) 와 `:220`(같은 파일을 `unguarded` 판정에서 2차 읽기)
  - 상세: `discover()` 는 "raw 지점이 있는 파일"만 반환(count > 0 필터)하므로 이중 읽기 대상은 전체 800여 파일이 아니라 발견된 소수(7~9개)에 한정돼 실질 비용은 미미하다. `discover()`가 (경로, raw count) 대신 (경로, raw count, 파일 내용)까지 반환하면 피할 수 있는 중복이지만, 그러면 `discover()` 반환 타입이 이 판정 로직에 결합돼 재사용성이 떨어진다 — 현재 분리가 오히려 더 읽기 쉽다.
  - 제안: 조치 불요. 성능상 유의미하지 않고, 굳이 합치면 가독성이 떨어진다.

- **[정보 확인]** 함수 길이·중첩 깊이·순환 복잡도는 전반적으로 양호
  - `countRawUpdateReturning`(`source-scan.ts:100-121`)은 단일 for-loop + 단일 if, 중첩 2단계. `listSources`(`update-returning-rows.spec.ts:174-190`)도 재귀 + 조건 분기로 중첩 2단계를 넘지 않는다. `discover()`(`:196-204`)는 `map`→`filter`→`sort` 체이닝으로 선형이라 읽기 쉽다. `CALL` 정규식(`source-scan.ts:112`) 자체는 밀도가 높지만(중첩 제네릭 대응) 바로 위 6줄 주석이 각 부분의 의도를 설명해 대가를 상쇄한다.
  - 새 JSDoc/인라인 주석이 코드 본문보다 훨씬 긴 것(`source-scan.ts:61-99` 32줄 문서 vs 21줄 함수, `kb-stats.helper.ts:26-35` 주석 10줄 vs 변경 코드 2줄)은 이 파일이 이미 `stripComments`/`countCalls` 에서 확립한 "장문 배경 설명" 컨벤션을 그대로 따른 것이라 일관성 위반이 아니다(이전 라운드도 동일하게 판단).

## 요약

이번 diff 는 이전 라운드(`12_41_15`)에서 지적된 유지보수성 실질 WARNING(`discover()` 캐싱 없는 3회 반복 호출)과 인접 관점의 WARNING(중첩 제네릭 미탐지, 판정 축 테스트 부재)이 코드에 정확히 반영돼 해결됐음을 직접 소스 대조로 확인했다. 신규/변경 함수(`countRawUpdateReturning`, `hasRawUpdateReturning`, `listSources`, `discover()`, `kb-stats.helper.ts` 타입 정정)는 네이밍·함수 길이·중첩 깊이·순환 복잡도 모두 양호하고, 기존 파일이 확립한 "장문 JSDoc + 짧은 함수" 컨벤션과 네이밍 관례를 그대로 따라 일관성도 유지된다. 남은 항목은 전부 이전 라운드에서 이미 저비용으로 유예된 사소한 매직넘버(`20`)와 같은 파일 내 상수 재선언(`SRC`) 두 건뿐이며, 여기에 이번 라운드에서 새로 관측한 낮은 우선순위 INFO 두 건(`hasRawUpdateReturning` 의 현재 무소비, `discover()` 결과 파일의 경미한 이중 읽기)을 더했다 — 전부 기능적 결함이 아니고 급하지 않다.

## 위험도
LOW
