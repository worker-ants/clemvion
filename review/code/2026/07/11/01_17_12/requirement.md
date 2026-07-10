# 요구사항(Requirement) 코드 리뷰 — interactionType 판정 규칙 단일 SoT 화 (consolidation)

검토 대상: `waiting-surface-guard.ts::coalesceInteractionType` 신설 + `readPersistedInteractionType` 위임화,
publisher SQL(`resolveWaitingNodeExecutionId`)을 COALESCE 재현에서 순수 2-경로 추출로 변경, 관련 유닛(4파일).
직전 라운드(`review/code/2026/07/11/00_49_34/requirement.md`) WARNING "SQL COALESCE 가
`readPersistedInteractionType` 의 string-guard 를 재현 못 함" 의 해소 여부 검증에 집중했다.

## 검증 방법

- `waiting-surface-guard.ts` 전체 파일 + diff, `execution-engine.service.ts` 의
  `resolveWaitingNodeExecutionId`/`assertCommandMatchesWaitingSurface`(5169-5297행) 직접 확인
- `getInteractionType`(execution-engine.service.ts:4596-4608), `resumeFromCheckpoint` 의
  `persistedInteractionType` 계산(:1713-1721) — JSDoc 이 "동형" 이라 주장하는 두 소비처를 직접 대조
- `toRecord`/`isRecord`(utils/to-record.ts) — `resumeFromCheckpoint` 가 쓰는 타입가드 확인
- `grep -rn readPersistedInteractionType` — 프로덕션 호출측 존재 여부 확인
- `execution-engine.service.spec.ts` / `waiting-surface-guard.spec.ts` diff — 신규 유닛이 실제로
  meta-우선/flat-fallback/비-문자열-무시 3분기를 비-vacuous 하게 커버하는지 확인
- `plan/in-progress/eia-command-waiting-surface-guard.md` — 기존 SPEC-DRIFT(§7.5.1/§5.1 3번째 거부 케이스)
  체크박스 상태 재확인

## 발견사항

- **[INFO]** 확인됨 — SQL 이 더 이상 precedence 로직을 독자 재현하지 않는다 (코드 중복 drift 는 해소)
  - 위치: `execution-engine.service.ts:5199-5210` (`.addSelect('meta'->>'interactionType', 'metaInteractionType')` + `.addSelect(->>'interactionType', 'flatInteractionType')`, COALESCE 없음)
  - 상세: 직전 라운드가 지적한 "SQL 이 규칙의 4번째 사본이 됨" 문제의 근본 원인 — `COALESCE(A, B)` 라는 독자적인 precedence 표현이 SQL 에 존재했던 것 — 은 실제로 제거됐다. 지금은 두 raw 값을 각각 별도 컬럼으로 투영만 하고, precedence 결정은 오직 `assertCommandMatchesWaitingSurface` 의 `coalesceInteractionType(row.metaInteractionType, row.flatInteractionType)` 한 곳에서만 일어난다. `waiting-surface-guard.spec.ts` 에 `coalesceInteractionType` 직접 단위테스트(meta우선/flat폴백/양쪽부재/비문자열무시) 4건이 신설돼, 이전에 SQL 분기가 어떤 테스트로도 검증되지 않던 갭도 채워졌다. 이 부분은 요구된 개선을 정확히 충족한다.

- **[WARNING]** 그러나 직전 WARNING 이 지목한 **구체적 행동 divergence 자체는 publisher 경로에서 구조적으로 여전히 남아있다** — "SQL/TS 이중 정의" 문제가 아니라 "Postgres `->>` 의 타입 소실" 문제로 재배치됐을 뿐
  - 위치: `execution-engine.service.ts:5199-5206`(`ne.output_data -> 'meta' ->> 'interactionType'` → `metaInteractionType`), `waiting-surface-guard.ts:110-116`(`coalesceInteractionType`)
  - 상세: Postgres 의 `->>` 연산자는 대상 JSON 값이 `null` 이 아닌 한 **스칼라 타입과 무관하게 항상 텍스트로 캐스팅**한다 (`7` → `'7'`, `true` → `'true'`). 즉 `row.metaInteractionType` 은 SQL 을 거치는 순간 non-null 이면 **이미 항상 JS 문자열**이다. 이 상태에서 `coalesceInteractionType(row.metaInteractionType, row.flatInteractionType)` 을 호출하면 `typeof metaInteractionType === 'string'` 가드는 non-null 인 한 **항상 참**이 되어 사실상 무력화된다 — publisher 경로에서는 "meta 가 비-문자열이면 flat 으로 폴백" 분기가 절대 발현될 수 없다. 예: `outputData = { meta: { interactionType: 7 }, interactionType: 'ai_conversation' }` 인 손상 데이터가 있다면, `readPersistedInteractionType`(in-memory 객체를 직접 typeof 검사)은 `7` 을 거부하고 `'ai_conversation'` 을 반환하지만, publisher SQL 경로는 `row.metaInteractionType === '7'`(이미 문자열로 강제변환됨) 을 그대로 채택해 `coalesceInteractionType('7','ai_conversation') === '7'` 을 반환한다 — **정확히 이전 라운드가 지적한 것과 동일한 최종 결과(divergence)** 다. 즉 "SQL 이 규칙을 독자 재현하던 리스크"(유지보수 관점)는 해소됐지만, "SQL 로 읽은 값과 in-memory 로 읽은 값이 손상 데이터에서 다른 판정을 내릴 수 있다"(행동 동치 관점)는 이번 리팩터로 고쳐지지 않았다 — 애초에 `->>` 만으로는 SQL 레벨에서 원본 JSON 스칼라 타입을 구분할 수 없어 구조적으로 고칠 수 없다.
  - 신규 유닛(`coalesceInteractionType(7, 'buttons')` → `'buttons'`)은 이 divergence 를 검증하지 **않는다** — 이 테스트는 함수를 순수하게 (in-memory 경로처럼) genuine 비-문자열 JS 값으로 호출한 경우만 검증하고, publisher/SQL 경로가 실제로 `coalesceInteractionType` 에 넘기는 "이미 stringify 된" 입력 형태는 어떤 유닛/e2e 테스트도 재현하지 않는다. 그 결과 "이제 coalesceInteractionType 이 string-guard 를 단위테스트로 검증한다"는 사실이, 마치 publisher 경로의 이전 divergence 도 함께 닫힌 것처럼 오인될 여지가 있다.
  - 실무 영향(직전 라운드와 동일 평가 유지): 정상 handler 는 `meta.interactionType` 에 항상 유효 enum 문자열만 기록하므로 도달 경로는 손상/수동편집 데이터에 한정되고, 도달하더라도 대부분 fail-closed(`INVALID_EXECUTION_STATE` 오거부) 방향으로 수렴해 안전성 리스크(그릇된 허용)는 낮다. 신규 회귀는 아니다 — 다만 "규칙이 SQL/TS 에 이중 정의되던 drift 표면 제거" 라는 커밋 메시지의 주장은 **코드 중복(authoring) 관점에서는 정확하지만 행동 동치(behavioral parity) 관점에서는 과장**이다.
  - 제안: (a) `coalesceInteractionType`/`readPersistedInteractionType` JSDoc 에 "publisher SQL 경로는 Postgres `->>` 의 텍스트 강제변환으로 인해 비-문자열 `meta.interactionType` 판별이 불가능하다"는 한계를 명시하거나, (b) SQL 에 `jsonb_typeof(ne.output_data->'meta'->'interactionType') = 'string'` 가드를 추가해 비-문자열이면 NULL 로 투영하는 진짜 동치화를 구현. 어느 쪽이든 우선순위는 낮음(직전 라운드와 동일하게 LOW).

- **[WARNING]** JSDoc 이 "동형" 이라 명시적으로 주장하는 두 소비처 중 하나(§7.5 rehydration 의 `persistedInteractionType`)는 실제로 `coalesceInteractionType` 을 쓰지 않고, string-guard 없이 별도로 손코딩돼 있어 규칙이 진짜로는 동형이 아니다
  - 위치: `waiting-surface-guard.ts:104-105`("엔진의 in-memory `getInteractionType`... 와 동형이며 §7.5 rehydration 의 `persistedInteractionType` 계산과 정확히 같은 규칙이다") vs `execution-engine.service.ts:1713-1721`(`resumeFromCheckpoint`)
  - 상세: `resumeFromCheckpoint` 의 실제 계산은 다음과 같다:
    ```ts
    const cachedMeta = toRecord(cachedOutput?.meta);
    const persistedInteractionType =
      (cachedMeta.interactionType as string | undefined) ??
      (cachedOutput?.interactionType as string | undefined);
    ```
    `toRecord`(utils/to-record.ts)는 `meta` 가 object 인지만 검사할 뿐 `interactionType` 필드가 문자열인지는 전혀 검사하지 않는다. `as string | undefined` 는 컴파일타임 단언일 뿐 런타임 가드가 아니고, `??` 는 `null`/`undefined` 에서만 폴백하므로 `cachedMeta.interactionType` 이 non-nullish 비-문자열(예: 숫자 `7`)이면 그 값을 **그대로** 채택한다 — `coalesceInteractionType`/`getInteractionType` 이 공유하는 `typeof x === 'string'` 가드가 이 사이트에는 없다. 반례: `outputData = { meta: { interactionType: 7 }, interactionType: 'ai_conversation' }` 이면 `coalesceInteractionType(7, 'ai_conversation')` → `'ai_conversation'`(정상 판정, `isAiConversation=true`) 인데, `resumeFromCheckpoint` 의 손코딩 계산은 `7 ?? 'ai_conversation'` → `7`(non-nullish 이므로 폴백 안 함) → `isAiConversation = (7==='ai_conversation')||(7==='ai_form_render') = false` 로 갈린다. 이는 이번 diff 가 건드리지 않은 기존 코드이므로 이번 커밋이 만든 신규 회귀는 아니지만, 이번 커밋이 재확인/강화한 JSDoc 주장("정확히 같은 규칙")은 이 소비처에 대해서는 사실이 아니며, "단일 SoT" 리팩터가 실제로 커버한 것은 3곳 중 1곳(publisher chokepoint)뿐이다. `getInteractionType`(execution-engine.service.ts:4596-4608) 은 규칙 자체는 동형(`typeof==='string'` 가드 보유)이지만 마찬가지로 `coalesceInteractionType` 을 호출하지 않고 독자 구현을 유지한다 — 이쪽은 행동상 안전(참조 무결성 있음)하지만 "단일 SoT" 라는 표현과는 별개로 코드상 3번째 사본이 여전히 존재한다.
  - 제안: (코드 되돌리기 아님, 후속 개선) `resumeFromCheckpoint` 의 `persistedInteractionType` 계산을 `readPersistedInteractionType(cachedOutput)` 호출로 교체해 실제로 SoT 에 위임하거나(가장 안전), 최소한 `typeof` 가드를 추가. `getInteractionType` 도 `coalesceInteractionType(structuredType, flatType)` 호출로 교체 가능(구조상 병합 객체가 없어 `readPersistedInteractionType` 는 재사용 불가하지만 `coalesceInteractionType` 은 두 스칼라만 받으므로 그대로 재사용 가능). 이렇게 해야 "단일 SoT" 주장이 코드 전체에서 실제로 성립한다. 이번 diff 스코프 밖이라 즉시 조치는 불요하나 후속 후보로 기록 권고.

- **[INFO]** `readPersistedInteractionType` 자체는 위임화 이후에도 프로덕션 호출측이 없다 (여전히 "미사용 export")
  - 위치: `waiting-surface-guard.ts:125-135`
  - 상세: `grep -rn readPersistedInteractionType codebase/backend/src` 결과 프로덕션 코드 중 이 함수를 호출하는 곳은 없다 (정의 파일 + 자신의 spec 뿐). 커밋 메시지의 "dead code 해소" 는 "SQL 이 이 함수의 로직을 독자 재현하던 코드 중복"이 해소됐다는 의미로는 정확하지만, 함수 자체가 프로덕션에서 호출되는 상태(진짜 "활성 코드")가 된 것은 아니다. 위 두 번째 WARNING 의 제안(② `resumeFromCheckpoint` 가 이 함수를 실제로 호출하도록 교체)이 반영되면 이 함수도 비로소 실사용된다.
  - 제안: 조치 불요(정보 제공). 위 WARNING 후속과 함께 처리 가능.

- **[INFO]** 사소한 문서 staleness — `resolveWaitingNodeExecutionId` 메서드 JSDoc 이 "문자열 하나" 라고 서술하나 실제로는 두 필드를 투영
  - 위치: `execution-engine.service.ts:5178-5180` ("표면 판정에 필요한 `interactionType` **문자열 하나**만 단일 JOIN 쿼리로 가져온다") — 이 줄은 이번 diff 로 수정되지 않았고, 실제 쿼리는 `metaInteractionType`/`flatInteractionType` 두 필드를 가져온다.
  - 상세: 이번 diff 는 `.addSelect` 바로 위의 인라인 주석(":286-289")과 `WaitingNodeRow` interface 상단 JSDoc은 갱신했지만, 메서드 최상단 JSDoc(:5178-5180)의 "문자열 하나"라는 표현은 갱신 대상에서 누락됐다. 기능에는 영향 없으나 향후 코드 리더가 "여전히 단일 컬럼"이라고 오인할 수 있다.
  - 제안: "표면 판정에 필요한 raw 값 두 개(`metaInteractionType`/`flatInteractionType`, precedence 결합은 `coalesceInteractionType`)" 정도로 정정.

- **[INFO]** 재확인 — spec §7.5.1/§5.1 SPEC-DRIFT(3번째 거부 케이스 미등재)는 이번 diff 와 무관, 여전히 미해소·의도적으로 이연됨
  - 위치: `plan/in-progress/eia-command-waiting-surface-guard.md:78`(`- [ ] spec 동기`)
  - 상세: 이전 두 라운드가 이미 지적·추적한 SPEC-DRIFT 항목이며, 이번 diff 는 그 표면(§7.5.1 표 / §5.1 `STATE_MISMATCH` 예시)을 전혀 건드리지 않는다. plan 체크박스도 여전히 미완료로, project-planner 위임이 명시적으로 대기 중이다 — 새로운 이슈가 아니라 상태 불변 재확인.
  - 제안: (기존과 동일) 코드 조치 불요, project-planner 가 반영.

- **[INFO]** 확인됨 — 신규 유닛은 legacy flat-root 경로를 처음으로 end-to-end 커버
  - 위치: `execution-engine.service.spec.ts:2243-2262`("buttons 대기 (legacy flat root interactionType) + end_conversation → 거부" / "... + click_button → 통과"), `waiting-surface-guard.spec.ts:367-385`(`coalesceInteractionType` 4건)
  - 상세: `armWaitingSurface(interactionType, nodeType, via)` 의 `via: 'flat'` 옵션으로 `metaInteractionType: null, flatInteractionType: interactionType` 조합을 무장해, `coalesceInteractionType` 의 flat-fallback 분기를 표면 매트릭스 가드 통합 테스트 레벨까지 비-vacuous 하게 실증한다. 이전 라운드까지는 이 분기가 어떤 레벨에서도 테스트되지 않았다 — 순수 개선.
  - 제안: 조치 불요.

## 요약

핵심 질문("직전 WARNING 이 이번 consolidation 으로 해소됐는가")에 대한 답은 **부분적으로만 그렇다**. SQL 이 더 이상 precedence 로직을 독자적으로 재현하지 않고 `coalesceInteractionType` 한 곳으로 위임한 것은 사실이며, 이는 "규칙이 SQL 과 TS 에 이중으로 authored 되어 향후 편집 시 서로 다르게 바뀔 수 있는" 유지보수 리스크를 정확히 제거했고, 이전에 전무했던 `coalesceInteractionType`/flat-fallback 경로 테스트도 신설됐다 — 이 부분은 커밋 목표를 정확히 충족한다. 그러나 직전 WARNING 이 실제로 지목한 **행동 divergence**(비-문자열 `meta.interactionType` 손상 데이터에서 SQL 경로와 in-memory 경로가 다른 표면을 판정)는 구조적으로 남아 있다 — Postgres `->>` 가 모든 non-null JSON 스칼라를 텍스트로 강제변환하므로, publisher 경로에서 `coalesceInteractionType` 에 도달하는 `metaInteractionType` 은 non-null 이면 이미 항상 문자열이라 string-guard 가 무력화된다. 신규 단위테스트는 이 정확한 시나리오를 재현하지 않는다. 또한 "규칙이 §7.5 rehydration `persistedInteractionType`·엔진 `getInteractionType` 과 동형" 이라는 JSDoc 의 강한 재확인 주장은, 실제로 확인해보니 `resumeFromCheckpoint` 의 rehydration 계산이 `coalesceInteractionType` 을 호출하지 않고 string-guard 없이 별도 손코딩돼 있어 성립하지 않는다(반례로 실증) — 다만 이는 이번 diff 가 손대지 않은 기존 코드라 신규 회귀는 아니다. 두 divergence 모두 손상/비정상 데이터에서만 발현되고 대체로 fail-closed 방향으로 수렴해 실무 리스크는 낮으며(직전 라운드와 동일 평가), 신규 CRITICAL 은 없다. 다만 "단일 SoT"·"동형" 이라는 표현이 커밋/JSDoc 이 주장하는 만큼 코드 전체에서 완전히 성립하지는 않으므로, 문서 정정 또는 나머지 두 소비처(특히 `resumeFromCheckpoint`)를 실제로 `coalesceInteractionType`/`readPersistedInteractionType` 에 위임하는 후속 조치를 권고한다.

## 위험도

LOW — 신규 CRITICAL 없음. 발견된 두 divergence 는 모두 (a) 이 저장소 정상 코드 경로에서는 도달 불가능한 손상 데이터 시나리오에 한정되고 (b) 도달해도 fail-closed(오거부) 방향으로 수렴해 안전성(그릇된 허용) 리스크가 없으며 (c) 이번 diff 로 새로 생긴 회귀가 아니라 기존에 있던(또는 구조적으로 불가피한) 한계가 재확인된 것이다. 병합을 막을 사유는 아니나, "단일 SoT"/"동형" 문서 주장의 정확성과 나머지 두 소비처 위임은 후속 정리 대상으로 남긴다.
