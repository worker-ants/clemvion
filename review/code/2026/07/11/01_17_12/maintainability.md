# 유지보수성(Maintainability) Review

검토 대상: `coalesceInteractionType` 단일 SoT 신설 + `readPersistedInteractionType` 위임 리팩터
(commit `74ef033b1`, 직전 리뷰 `review/code/2026/07/11/00_49_34` WARNING — "SQL COALESCE 가
`interactionType` 판정 규칙의 4번째 사본" — 에 대한 후속 fix).

## 검증 방법

- 4개 diff(`execution-engine.service.ts`/`.spec.ts`, `waiting-surface-guard.ts`/`.spec.ts`) 정독.
- `grep -rn readPersistedInteractionType / coalesceInteractionType codebase/backend/src` 로 실제
  프로덕션 호출부 전수 확인.
- `execution-engine.service.spec.ts` 의 `waitingRawRows = [...]` 8개 지점 전수 확인 — 구
  `interactionType:` 필드가 신 `metaInteractionType`/`flatInteractionType` 로 빠짐없이
  마이그레이션됐는지(스텁 누락 시 조용히 `undefined` 로 무너지는 회귀 클래스).
- `getInteractionType`(execution-engine.service.ts:4596, in-memory cache 기반) 과
  `resumeFromCheckpoint`(1713-1721, §7.5 rehydration) 의 "동형" 서술이 실제로 `coalesceInteractionType`
  을 재사용하는지, 아니면 규칙을 손으로 재구현한 별도 사본인지 `git blame` 으로 도입 시점까지 대조.

## 발견사항

- **[WARNING]** "단일 SoT" 라벨을 단 이 커밋 자체가 인지하고 문서화한 세 번째 사본
  (`resumeFromCheckpoint`, §7.5 rehydration)이 여전히 `coalesceInteractionType`/
  `readPersistedInteractionType` 를 호출하지 않고 규칙을 손으로 재구현한다
  - 위치: `execution-engine.service.ts:1713-1721` (`resumeFromCheckpoint`) vs
    `waiting-surface-guard.ts:99-113`(`coalesceInteractionType`)/`:117-136`
    (`readPersistedInteractionType`)
  - 상세: 이번 diff 가 `waiting-surface-guard.ts` 에 유지한(무변경 컨텍스트 라인) JSDoc 은
    "엔진의 in-memory `getInteractionType`(structured cache → flat cache)와 동형이며 §7.5
    rehydration 의 `persistedInteractionType` 계산과 정확히 같은 규칙이다"라고 명시적으로
    `resumeFromCheckpoint` 를 지목한다. 그런데 실제 `resumeFromCheckpoint` (git blame 상
    2026-05-25 도입, 이번 PR 계열보다 훨씬 이전이라 pre-existing) 는:
    ```ts
    const cachedOutput = context.nodeOutputCache[opts.node.id] as
      | Record<string, unknown>
      | undefined;
    const cachedMeta = toRecord(cachedOutput?.meta);
    const persistedInteractionType =
      (cachedMeta.interactionType as string | undefined) ??
      (cachedOutput?.interactionType as string | undefined);
    ```
    이며, `cachedOutput` 은 정확히 `readPersistedInteractionType(outputData: unknown)` 이 받는
    것과 같은 shape(`{ meta?: {...}, interactionType?: ... }`)의 객체다. 즉
    `readPersistedInteractionType(cachedOutput)` 한 줄로 그대로 치환 가능한데, 여전히
    `cachedMeta.interactionType as string | undefined` 라는 **런타임 검증 없는 타입 단언**으로
    값을 취한다 — `coalesceInteractionType` 의 명시적 `typeof === 'string'` string-guard 와
    분기 결과가 다를 수 있다(예: `meta.interactionType` 이 비-문자열이면 `??` 는 `null`/`undefined`
    만 걸러내므로 flat fallback 을 시도하지 않고 그 비-문자열 값을 그대로 채택한다 — 직전
    database 리뷰가 옛 SQL COALESCE 에서 지적한 것과 정확히 같은 divergence 클래스).
    이 지점은 이번 diff 의 변경 라인에는 없지만(pre-existing), 이번 diff 가 새로 단 "**단일
    SoT**" 라벨(`waiting-surface-guard.ts` JSDoc 개정분: "영속된 interactionType 판정 규칙의
    **단일 SoT**")과 나란히 남아 있는 미완결 사각지대라 이번 커밋의 핵심 주장("규칙이 SQL/TS 에
    이중 정의되던 drift 표면 제거")을 코드베이스 전체로 보면 부분적으로만 참이 되게 만든다.
    functional 위험은 낮다(엔진이 실제로 `meta.interactionType` 에 문자열 외 값을 기록하는
    경로는 없음 — 이전 database 리뷰가 SQL COALESCE 에 대해 내린 것과 동일한 "안전한 방향의
    divergence" 결론이 여기도 적용됨) — 이것을 낮은 심각도(WARNING, CRITICAL 아님)로 매기는
    근거다. 그러나 유지보수성 관점에서는, "규칙을 한 곳에 두자"는 이 리팩터 시리즈 전체의
    목적을 놓고 볼 때 실질적 잔여 갭이다.
  - 제안: `resumeFromCheckpoint` 의 3줄을
    `const persistedInteractionType = readPersistedInteractionType(cachedOutput);` 로 교체
    (`cachedMeta`/`toRecord` 호출도 함께 제거 가능 — `readPersistedInteractionType` 내부가 이미
    `isRecord` 상당의 가드를 한다). 이렇게 하면 (a) `readPersistedInteractionType` 의 JSDoc이
    주장하는 "in-memory 캐시(객체)를 가진 소비처"가 실제로 생기고, (b) 코드베이스 전체에서
    precedence·string-guard 규칙의 진짜 단일 정의가 달성되며, (c) `readPersistedInteractionType`
    자체의 "dead code" 지위(아래 INFO)도 함께 해소된다. 지금 당장 이 파일을 건드리는 것이
    스코프 밖이라면, 최소한 후속 followup 으로 plan 등록 권장.

- **[INFO]** `readPersistedInteractionType` 은 이번 fix 이후에도 프로덕션 호출부가 0개 —
  "dead code 해소" 주장은 "중복 규칙 정의" 축에서만 참이고 "실제 호출 여부" 축에서는 아직 미완
  - 위치: `waiting-surface-guard.ts:117-136`
  - 상세: `grep -rn readPersistedInteractionType codebase/backend/src --include=*.ts`
    결과는 자기 정의(`waiting-surface-guard.ts:125`)와 테스트(`waiting-surface-guard.spec.ts`)
    뿐이다. 커밋 메시지의 "readPersistedInteractionType 는 이를 위임한다 (dead code 해소)"는
    "이 함수가 스스로 규칙을 재구현하던 상태"를 "공용 함수에 위임하는 상태"로 바꿔 **함수 내부의
    이중 정의**는 해소했지만, 함수 자체가 프로덕션에서 호출되지 않는다는 원래의 "SoT 라고 주장하는
    함수가 실제로는 dead code" 문제(직전 maintainability 리뷰 WARNING #1)는 그대로 남아 있다.
    이는 위 WARNING(`resumeFromCheckpoint` 미마이그레이션)과 동전의 양면 — 위 제안을 적용하면
    이 INFO 도 자동으로 해소된다.
  - 제안: 별도 조치 불필요(위 WARNING 처리 시 자연 해소). 지금 이대로 두더라도 함수가
    export 되어 있고 유닛 테스트가 규칙을 고정하므로 실질적 위험은 낮다.

- **[INFO]** 이번 diff 자체가 다루는 두 소비처(SQL 투영 경로 · 테스트 mock 경로)의 통합은
  깔끔하고 완전함 — 확인됨
  - 위치: `execution-engine.service.ts:5283`(`coalesceInteractionType(row.metaInteractionType,
    row.flatInteractionType)`), `waiting-surface-guard.ts:111-115`(`coalesceInteractionType`
    구현: `typeof === 'string'` 가드 2회 + `undefined` fallback, 순환복잡도 3 수준의 단순 함수)
  - 상세: SQL 은 `meta ->> 'interactionType'` / `->> 'interactionType'` 두 raw 값만 추출하고
    (`.addSelect` 2회, 우선순위 로직 없음), 결합은 오직 `coalesceInteractionType` 한 곳에서만
    일어난다. `execution-engine.service.spec.ts` 의 `waitingRawRows` 리터럴 8개 지점을 전수
    확인한 결과, 구 `interactionType:` 필드가 남아 있는 스텁 없이 모두
    `metaInteractionType`/`flatInteractionType` 로 일관되게 마이그레이션됐다(비어 있는 `[]`
    지점 3곳은 필드 자체가 없어 해당 없음). 필드명이 SQL 별칭(`'metaInteractionType'`,
    `'flatInteractionType'`) · TS 인터페이스(`WaitingNodeRow`) · 테스트 mock 전부에서 동일하게
    사용돼 이름 불일치로 인한 혼동 여지가 없다.
  - 신규 유닛 테스트(`waiting-surface-guard.spec.ts` `describe('coalesceInteractionType')`
    4케이스: meta 우선/flat fallback(null·undefined 둘 다)/둘 다 부재/비-문자열 무시)가
    구현의 두 `if` 분기와 최종 `undefined` fallback을 1:1로 커버해 회귀 감지력이 높다.
  - 제안: 조치 불요 — 이 부분은 직전 리뷰 WARNING 을 정확히 겨냥해 해소했다.

## 요약

이번 커밋은 직전 리뷰가 지적한 "SQL COALESCE 가 규칙의 4번째 사본이 되어 `readPersistedInteractionType`
를 dead code 로 만든다"는 문제를, 그 리뷰가 제안한 방식(정확히: raw 두 값만 SQL 로 투영하고 결합은
TS 단일 함수로) 그대로 정밀하게 구현했다 — SQL 투영 경로와 테스트 mock 경로 두 곳은 이제
`coalesceInteractionType` 하나로 정확히 같은 규칙을 보장하며, 필드명·테스트 커버리지 모두
일관되고 꼼꼼하다. 다만 "단일 SoT" 라는 라벨을 코드베이스 전체로 확장해서 보면 아직 완전하지
않다 — 이번 diff 가 그대로 남긴(그리고 명시적으로 cross-reference 하는) `resumeFromCheckpoint`
(§7.5 rehydration, pre-existing 코드)가 여전히 같은 precedence 규칙을 손으로 재구현하고 있고,
그 결과 `readPersistedInteractionType` 는 여전히 프로덕션에서 호출되지 않는 상태로 남는다.
functional 위험은 낮지만(엔진이 실제로 비-문자열 interactionType 을 기록하지 않음), "규칙이
여러 곳에 정의되면 조용히 drift 한다"는 이 리팩터 시리즈 전체의 문제의식을 놓고 보면 실질적
잔여 갭이며, 한 줄 치환(`readPersistedInteractionType(cachedOutput)`)으로 저비용에 완전히 닫을
수 있는 후속 작업이다.

## 위험도

LOW
