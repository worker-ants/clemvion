# 유지보수성(Maintainability) Review — resumeTurnRegistry 대칭 테스트 + SQL/TS 이중 정의 재검토

검토 대상: `review/code/2026/07/11/00_03_25` RESOLUTION 반영 이후 상태 (`waiting-surface-guard.ts`,
`execution-engine.service.ts::resolveWaitingNodeExecutionId`/`assertCommandMatchesWaitingSurface`,
`execution-engine.service.spec.ts`, `waiting-surface-guard.spec.ts` 등).
focus: 직전 리뷰 WARNING #3(표면 판정 로직 triplication)에 대한 이번 라운드의 대응 — (1) 신규
`resumeTurnRegistry` 대칭 테스트의 실효성, (2) 그 대응 과정에서 신설된 raw SQL JSONB COALESCE 가
동일 규칙의 4번째 사본이 되어 drift 표면을 오히려 늘렸는지, 테스트로 묶여 있는지.

## 발견사항

### [INFO] `resumeTurnRegistry` 대칭 테스트는 실효적 — 실제 프로덕션 로직을 검증한다

- 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts:2259-2307`
  (`it('resumeTurnRegistry 의 selects 와 resolveWaitingSurface 판정이 일치한다', ...)`)
- 상세: mock 이 아니라 `service as unknown as {...}` 로 **서비스 인스턴스의 실제 private getter**
  `resumeTurnRegistry` 를 그대로 읽어(`execution-engine.service.ts:1857`), 그 배열의 `selects()`
  술어를 real 코드로 호출한다. AI 분기의 `selects: (sel) => sel.isAiConversation &&
  sel.hasResumeCheckpoint && this.isCheckpointEligibleNodeType(sel.node.type)` (동 파일 1893-1896)
  중 `isCheckpointEligibleNodeType` 도 스펙 파일 어디서도 mock/spy 되어 있지 않아(grep 확인,
  `isCheckpointEligibleNodeType` 참조 3곳 — 정의·JSDoc 2곳뿐) 실 로직이 그대로 실행된다.
  이는 직전 리뷰 SUMMARY #3("`parkEntryRegistry` 하나만 교차검증하며 worker-side SoT 인
  `resumeTurnRegistry` 는 빠져 있다")를 문자 그대로 메운다 — park-entry 쪽은
  `waiting-surface-guard.spec.ts`(`buildParkEntryRegistry` 직접 생성)가, worker 쪽은 이 테스트가
  담당한다고 주석(2255-2258)도 역할을 명시한다.
- 케이스 커버리지: form(정적 blocking) · buttons(carousel+`buttons`) · ai_conversation
  (`ai_agent`+`ai_conversation`/`ai_form_render`) · `information_extractor`+`ai_conversation`
  (AI-eligible 두 번째 노드 타입) · carousel+`undefined`(무매칭) 6케이스. `hasResumeCheckpoint:
  true` 로 고정해 "publisher 가 알 수 없는 worker 전용 조건"을 의도적으로 배제한 점도
  `assertCommandMatchesWaitingSurface` JSDoc(5252-5255)의 명시적 스코프 선언과 정합.
- 사소한 잔여 갭(참고용, 차단 아님): 6케이스는 손으로 고른 대표 표본이라 exhaustive 는 아니다 —
  예를 들어 `blockingInteraction: 'form'` **과 동시에** `interactionType` 이 채워진 "form 이
  buttons/ai 를 이긴다" 우선순위 케이스는 `resolveWaitingSurface` 단독으로는
  `waiting-surface-guard.spec.ts:143-150` 가 검증하지만, 이 registry-대칭 테스트 자체에는
  없다(두 registry 모두 배열 리터럴 순서가 form→buttons→ai 로 나란히 하드코딩돼 있어 위험은
  낮음). 제안: 굳이 지금 확장할 필요는 없음 — 실질 가치는 이미 확보됨.

### [WARNING] raw SQL COALESCE 가 `readPersistedInteractionType` 규칙의 4번째(사실상 5번째) 사본이며, 그 어떤 테스트도 SQL↔TS 동치성을 검증하지 않는다

- 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:5199-5204`
  ```ts
  // structured envelope 의 `meta.interactionType` 우선, legacy flat root fallback —
  // `readPersistedInteractionType` 와 동일 규칙을 SQL 로 표현한다.
  .addSelect(
    `COALESCE(ne.output_data -> 'meta' ->> 'interactionType', ne.output_data ->> 'interactionType')`,
    'interactionType',
  )
  ```
- 상세: `git show 9ba336453` (RESOLUTION 반영 전, ai-review 00_03_25 이전 최초 fix 커밋)로 비교하면,
  원래 `assertCommandMatchesWaitingSurface` 는 `readPersistedInteractionType(row.outputData)` 를
  **직접 호출**했다 (TS 단일 함수, SQL 사본 없음). 이번 라운드는 직전 리뷰 WARNING #5(성능 —
  `outputData` 전체 select + `nodeRepository.findOne` 왕복 제거)를 고치기 위해
  `resolveWaitingNodeExecutionId` 를 단일 JOIN QueryBuilder 로 재작성하면서, `outputData` 컬럼
  전체 대신 JSONB path 만 투영하기로 하고 그 투영식을 raw SQL 문자열로 새로 작성했다. 그 결과:
  1. **`readPersistedInteractionType` 가 프로덕션 코드에서 더 이상 호출되지 않는다.**
     `grep -rn readPersistedInteractionType codebase/backend/src --include=*.ts | grep -v spec`
     결과는 자기 정의(`waiting-surface-guard.ts:107`)와 위 주석 한 줄뿐이다. "규칙의 SoT"라고
     JSDoc(waiting-surface-guard.ts:107 인근)이 주장하는 함수가 실제로는 dead code 이고, 진짜
     동작하는 로직은 문자열 SQL 이 됐다 — SoT 주장과 실제 런타임 경로가 어긋난다.
  2. **SQL 자체는 어떤 테스트로도 실행되지 않는다.** unit 테스트는 `getRawMany` 를 mock 해
     `waitingRawRows` 를 미리 계산된 값으로 주입한다(`execution-engine.service.spec.ts:341-344`,
     `2135-2150` `armWaitingSurface`) — QueryBuilder 체인(`select`/`addSelect`)에 대한 유일한
     검증은 "`interactionType` 문자열이 포함돼 있는지, 컬럼 전체를 select 하지 않는지"
     (`2110-2121`) 뿐이며 COALESCE 의 **의미**(우선순위 규칙)는 전혀 검증하지 않는다.
  3. **더 나아가 그 mock 값 자체도 SQL 을 흉내 내지 않고 규칙을 한 번 더 손으로 재구현한다.**
     `execution-engine.service.spec.ts:1060-1067` (`armSlowPathResume` 헬퍼)가
     `readPersistedInteractionType` 를 호출하는 대신
     `(meta?.interactionType as string) ?? (rawPersisted.interactionType as string) ?? null`
     을 인라인으로 다시 쓴다 — 이 PR 이 막으려는 "여러 사본 중 하나만 갱신되며 조용히 어긋남"
     패턴이 **테스트 코드 안에서** 재현된 것과 같다(현재는 우연히 일치하지만, 세 번째 규칙
     정의는 이 신뢰 사슬을 더 길게 만든다).
  4. **legacy flat-root fallback(COALESCE 두 번째 인자)은 실 Postgres 로도 검증되지 않는다.**
     e2e(`test/execution-park-resume.e2e-spec.ts`)의 buttons 표면 테스트(346-456)는
     `output_data -> 'meta' ->> 'interactionType' = 'buttons'` (구조화/우선 경로)만 실 DB 로
     확인한다. `output_data.interactionType` 을 `meta` 래퍼 없이 flat 하게 저장한 legacy 행을
     만들어 SQL 의 두 번째 COALESCE 인자가 실제로 값을 뽑아내는지 확인하는 e2e/integration
     테스트는 없다(`grep`으로 "legacy"/"flat" 키워드가 e2e 스펙에 전무함을 확인).
  즉 "새 blocking 노드 타입 추가 시 한쪽만 갱신하는 drift 를 여기서 hard fail 시킨다"는
  `waiting-surface-guard.spec.ts:169-170` 주석의 취지가, `readPersistedInteractionType` 규칙
  자체(구조화 우선·flat fallback)에 대해서는 SQL 사본 신설로 인해 **성립하지 않게 됐다** —
  누군가 `readPersistedInteractionType` 의 규칙(예: 우선순위 반전, 3번째 fallback 추가)을 고치고
  SQL 문자열은 못 고쳐도 어떤 테스트도 실패하지 않는다. 이는 직전 리뷰 WARNING #3 이 지적한 버그
  클래스(판정 로직 다중 정의·drift)가 이번 fix 커밋(`2244539a9`,
  "refactor: ai-review 반영 — ... 단일 JOIN 쿼리 ...")으로 **다른 매체(SQL)에서 재도입**된
  것이며, 이번 라운드의 대응(`resumeTurnRegistry` 대칭 테스트)이 커버하는 영역과 정확히
  겹치지 않는 사각지대다.
- 제안: SQL 에서 우선순위 판단(비즈니스 규칙)을 걷어내고, **JSONB path 추출(기계적 연산)만**
  SQL 에 남긴 뒤 우선순위 결합은 TS 쪽 단일 함수가 맡도록 재구성 권장:
  ```ts
  .addSelect(`ne.output_data -> 'meta' ->> 'interactionType'`, 'structuredInteractionType')
  .addSelect(`ne.output_data ->> 'interactionType'`, 'flatInteractionType')
  ```
  이후 `assertCommandMatchesWaitingSurface` 에서
  `row.structuredInteractionType ?? row.flatInteractionType`(또는
  `readPersistedInteractionType`을 이 두 필드만 담은 얕은 객체에 재사용)로 결합하면, 컬럼 전체를
  싣지 않는 성능 이점은 유지하면서 "구조화 우선" 규칙의 SoT 는 다시 TS 함수 하나로 되돌아가고,
  기존 `readPersistedInteractionType` unit 테스트가 실질적으로 프로덕션 로직을 보증하게 된다.
  최소한 이 리팩터를 당장 하지 않더라도, SQL 상수 COALESCE 식과 `readPersistedInteractionType`
  의 대표 입력(구조화 meta / legacy flat / 둘 다 / 둘 다 없음)에 대한 출력이 실 Postgres 에서
  일치하는지 확인하는 좁은 integration 테스트 하나를 추가해 drift 를 hard-fail 로 가드할 것 —
  지금은 comment 한 줄("동일 규칙을 SQL 로 표현한다")만이 두 사본의 동치성을 주장한다.

### [INFO] `armSlowPathResume` 테스트 헬퍼의 규칙 재구현은 별도 조치 불요하나 인지 필요

- 위치: `execution-engine.service.spec.ts:1060-1067`
- 상세: 위 WARNING 의 세부 사실(#3)로 이미 다뤘음 — 별도 항목으로 분리하지 않고 참고용으로만
  기록. `readPersistedInteractionType` 를 import 해 호출하도록 바꾸면 이 헬퍼 자체의 사본 수도
  줄고, 실수로 이 헬퍼만 갱신되고 프로덕션 함수는 안 바뀌는(또는 반대) 시나리오를 원천 차단한다.

## 요약

직전 리뷰가 지적한 "표면 판정 로직 다중 정의(triplication)" 중 `resumeTurnRegistry` 축은 이번
라운드에서 실효적으로 메워졌다 — 신규 대칭 테스트가 mock 이 아닌 실제 서비스 인스턴스의
`resumeTurnRegistry` getter 와 그 내부 `selects()` 술어(AI 분기의 `isCheckpointEligibleNodeType`
포함)를 직접 호출해 `resolveWaitingSurface` 와 비교하므로, 두 SoT 가 어긋나면 hard fail 하는
실질적 drift 가드다. 그러나 같은 라운드에서 (직전 리뷰의 별도 WARNING #5, 성능 이슈를 고치는
과정에) `resolveWaitingNodeExecutionId` 의 raw SQL `COALESCE` 가 신설되며 정확히 같은 규칙
("meta.interactionType 우선, legacy flat fallback")의 4번째 사본이 추가됐고, 그 신설로 인해
기존 SoT 함수 `readPersistedInteractionType` 가 프로덕션 경로에서 더 이상 호출되지 않는 dead
code 로 전락했다. 이 SQL 사본은 어떤 테스트로도 검증되지 않는다 — unit 은 `getRawMany` 를
mock 하며 그 mock 값조차 규칙을 또 한 번 손으로 재구현하고, e2e 는 구조화(`meta`) 경로 한
가지만 실 Postgres 로 확인할 뿐 legacy flat fallback 분기는 전혀 실증되지 않는다. 결과적으로
이번 PR 은 한 axis(레지스트리 대칭)의 drift 위험은 줄였지만 다른 axis(SQL↔TS 판정 규칙
동치성)에서 같은 클래스의 위험을 새로 만들어냈고, 그 위험은 아직 어떤 테스트에도 묶여 있지
않다.

## 위험도

MEDIUM
