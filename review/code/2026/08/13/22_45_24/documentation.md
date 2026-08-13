# 문서화(Documentation) 리뷰 — update-returning-tuple-shape 후속(라운드 2)

이번 diff 는 직전 라운드(`20_36_35`) 리뷰의 CRITICAL 2건 + WARNING 8건에 대한 조치판이다
(`review/code/2026/08/13/20_36_35/RESOLUTION.md`). 문서화 관점 재검토 결과는 아래와 같다.

## 발견사항

- **[WARNING]** RESOLUTION.md 가 "7곳을 `unknown` 으로 바꿨다"고 적었지만 실제로는 6곳뿐이다 — 나머지 1곳은 여전히 실제 shape 과 반대되는 타입을 주장한다
  - 위치: `codebase/backend/src/modules/knowledge-base/knowledge-base.service.ts:530` (`retryFailedDocuments` 의 `scope === 'embedding'` 분기, Read 로 실제 파일 직접 확인 — 이번 diff 는 이 줄을 건드리지 않아 프롬프트 diff 에 게이트가 없음)
  - 상세: 직전 라운드의 documentation WARNING(`20_36_35/documentation.md` WARNING 2)이 정확히 이 줄(`knowledge-base.service.ts:530`)을 포함해 7곳을 지목했고, `RESOLUTION.md` 는 `| 2 | 조치 — 거짓 제네릭/애너테이션 정정. … 7곳을 unknown 으로 바꿔 실제 shape 해석을 updateReturningRows 한 곳에 모았다 |` 라고 완료를 선언했다. 그런데 실제 코드는:
    ```ts
    const rows = await this.dataSource.query<{ id: string }[]>(
      `UPDATE document SET embedding_status = 'pending', … RETURNING id`,
      [id],
    );
    …
    const rowsOut = updateReturningRows<{ id: string }>(rows); // line 541
    ```
    이 `UPDATE … RETURNING` 쿼리의 결과 타입은 여전히 "행 배열"(`<{ id: string }[]>`)이라고 선언돼 있다 — 바로 두 줄 뒤에서 `updateReturningRows` 로 튜플을 언랩하고 있다는 사실과 모순된다. 같은 함수 안, 불과 33줄 아래의 짝인 `scope === 'graph'` 분기(line 563)는 정확히 같은 패턴의 UPDATE 인데 `const rows: unknown = await this.dataSource.query(` 로 올바르게 고쳐져 있어, 두 분기가 나란히 놓고 봐도 하나만 미수정임을 바로 알 수 있다. 이 타입 시그니처는 코드를 읽는 사람에게 사실상 문서다 — 이 PR 이 고친 결함 자체가 "타입 주장과 실제 shape 불일치를 아무도 검증하지 않아 4개월간 몰랐다"는 것인데, 그 패턴 하나가 같은 diff 안에 다시 남았고, 심지어 "고쳤다"는 문서(RESOLUTION.md)의 완료 선언이 사실과 어긋난다. 현재 런타임 동작 자체는 `updateReturningRows` 가 두 shape 모두 안전하게 처리하므로 기능 버그는 아니다.
  - 제안: `knowledge-base.service.ts:530` 의 `.query<{ id: string }[]>` 를 `: unknown` 애너테이션으로 바꿔 나머지 6곳·`updateExecutionStatus`·admission 지점과 통일한다. 그리고 `RESOLUTION.md` WARNING #2 항목의 "7곳" 서술을 정정하거나(6곳 완료 + 1곳 후속), 이번에 130 라인을 마저 고쳐 실제로 7곳을 채운다.

- **[INFO]** `admitExecutionOrDefer` 안에 같은 설명이 두 개의 인접한 주석 블록에 중복 서술돼 있다 (모순은 아님)
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:2916-2919`(신규 추가) 와 `:2931-2933`(이번 diff 이전부터 존재, 미변경)
  - 상세: 2916~2919 는 "제네릭을 달지 않는다. `EntityManager.query` 의 선언 타입은 `Promise<any>` 라 어떤 제네릭도 검증되지 않는 주장…"이라고 설명하고, 바로 쿼리 호출 뒤 2931~2933 은 "`EntityManager.query` 의 선언 타입은 `Promise<any>` 라 위 제네릭은 **주장이지 검증이 아니다**…"라고 사실상 같은 내용을 반복한다(후자는 직전 PR 에서 `assertRowArray` 도입 당시 쓰인 기존 주석으로, 이번 diff 가 손대지 않았다). 틀린 내용은 아니라서 CRITICAL 2(모순되는 옛 주석) 케이스와는 다르지만, 같은 사실을 두 번 설명해 가독성이 떨어진다.
  - 제안: 필수는 아님. 여력이 되면 두 블록을 하나로 합쳐 "왜 제네릭을 안 다는지" + "왜 throw 를 유지하는지"를 한 번에 서술하면 다음 사람이 더 빨리 읽는다.

- **[INFO]** (확인) 직전 라운드 CRITICAL 2(모순되는 옛 주석)는 실제로 완전히 제거됐다
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` (diff 파일 7, `@@ -2912,9 +2913,11` hunk)
  - 상세: "`RETURNING id` 이므로 실제 shape 은 행 배열이다" 라는 옛 문장이 삭제되고 새 주석으로 통합된 것을 diff 로 직접 확인했다 — RESOLUTION.md 의 "조치 완료" 서술과 일치한다.

- **[INFO]** (확인) `assert-row-array.spec.ts` 의 갱신된 구조 가드 주석("SELECT → `assertRowArray`, UPDATE/DELETE → `updateReturningRows`")은 실측과 정확히 일치
  - 위치: `codebase/backend/src/common/utils/assert-row-array.spec.ts:76-81`(신규 주석), 실제 소스 `grep -n assertRowArray\( execution-engine.service.ts` → 1건(`lockNonTerminalExecutionRow`, SELECT), `executions.service.ts` → 1건(`computeChainDepth`, 재귀 CTE SELECT). 두 곳 다 SELECT 문맥이라는 주석의 주장이 실측과 일치한다.
  - 상세: 참고용 — 새로 조정된 `guards: 1`(execution-engine) 카운트도 실제 파일의 `assertRowArray(` 호출 수(1건)와 일치해, 이 diff 가 만든 문서적 주장은 정확하다.

- **[INFO]** (경미, 낮은 우선순위, 직전 라운드에서 이미 선택사항으로 제안됨) `assert-row-array.ts` JSDoc 이 여전히 `updateReturningRows` 를 상호 참조하지 않는다
  - 위치: `codebase/backend/src/common/utils/assert-row-array.ts:1-14`
  - 상세: 이번 diff 로 두 헬퍼의 "SELECT vs UPDATE/DELETE" 분담이 `assert-row-array.spec.ts` 주석에는 명시됐지만, `assertRowArray` 함수 자체의 JSDoc 에는 이 분담이나 `update-returning-rows.ts` 로의 포인터가 없다. 직전 라운드 documentation INFO 가 이미 제안했던 항목으로 이번에도 반영되지 않았다 — 선택 사항이라 차단 사유는 아니다.
  - 제안: 여력이 되면 `assertRowArray` JSDoc 상단에 "UPDATE/DELETE RETURNING 결과는 `updateReturningRows` 를 쓸 것" 한 줄 추가.

- **[정보/확인]** CHANGELOG 미기재(직전 라운드 WARNING 3)는 이번 라운드에서 "넘김" 사유와 함께 `plan/in-progress/update-returning-tuple-shape.md` 의 `## 후속` 체크리스트(`- [ ] CHANGELOG Unreleased 항목 (20_36_35 WARNING 3)`)에 명시적으로 등재돼 있음을 확인했다 — 유실 아님, 추적 중.

## 요약

이번 라운드는 직전 리뷰의 documentation CRITICAL(모순되는 옛 주석)을 정확히 제거했고, 대부분(7곳 중 6곳)의 오도된 타입 애너테이션을 `unknown` 으로 바로잡았으며, 헬퍼 분담 관계를 `assert-row-array.spec.ts` 주석에 정확하게 반영했다. 다만 `knowledge-base.service.ts:530`(`retryFailedDocuments` embedding 분기) 한 곳은 여전히 "행 배열"이라 주장하는 타입 애너테이션이 실제 튜플 shape·바로 옆 `updateReturningRows` 언랩 코드와 모순된 채 남아 있고, `RESOLUTION.md` 는 이를 포함해 "7곳을 unknown 으로 바꿨다"고 완료 선언해 문서(리뷰 정리 기록) 자체의 정확성에도 흠이 생겼다. 기능적으로는 `updateReturningRows` 가 두 shape 를 모두 안전하게 처리하므로 런타임 버그는 아니지만, 이 PR 이 존재하는 이유가 바로 "타입 주장과 실제 shape 의 불일치를 아무도 검증하지 않았다"는 것이므로 같은 패턴 하나를 남겨두는 것은 이 diff 의 핵심 목적과 어긋난다. 그 외 CHANGELOG 지연은 근거와 함께 plan 에 추적되고 있어 문제 없다.

## 위험도

MEDIUM — CRITICAL 급 문서 결함은 없으나(직전 CRITICAL 은 실제로 해소됨), "7곳 전부 수정 완료"라는 명시적 완료 선언(RESOLUTION.md)이 코드와 어긋나는 지점이 1곳 남아 있어 병합 전 정정을 권고한다.
