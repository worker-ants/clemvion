# 문서화(Documentation) Review — linear-cancel-mechanism (6R, `markNodeCancelled` JSDoc 실체 대조)

## 스코프 노트

이번 라운드 프롬프트(`_prompts/documentation.md`)에 첨부된 38개 파일은 전부
`review/code/2026/07/26/{13_47_42,14_45_30,15_29_59,15_30_00}/*` 리뷰 산출물이며,
정작 검증 대상인 실제 소스 diff(`execution-engine.service.ts`)는 payload 에
포함돼 있지 않다. 이는 5R `SUMMARY.md`(`review/code/2026/07/26/15_30_00/SUMMARY.md`)
가 이미 "harness diff-list 갭"으로 5명(testing·documentation·maintainability·
side_effect·scope)이 지적하고 별도 harness 백로그로 분리해 둔 것과 동일한
반복 현상이다 — 이미 해소 확인/트리아지된 항목이므로 재론하지 않는다. 대신
지시대로 `git show`로 커밋 `410d913fe`("refactor(engine): 5R W25 — 노드 취소
종결 중복을 markNodeCancelled 로 추출")를 직접 열어 실제 코드를 대조했다.

## 중점 검증 — `markNodeCancelled` JSDoc이 실제 동작과 일치하는가

오케스트레이터가 지목한 세 주장을 코드로 하나씩 대조했다
(`codebase/backend/src/modules/execution-engine/execution-engine.service.ts`).

JSDoc 본문(4571-4585행):

```
/**
 * ai-review 5R (maintainability) — 노드 단위 취소 종결. `executeNode` catch 의 두
 * 분기(`isAbortError` / `ExecutionCancelledError`)가 상태 마킹·`finishedAt`/
 * `durationMs` 계산·`save`·`NODE_CANCELLED` emit 20여 줄을 문자 그대로 복제하고
 * 있었다. Execution 레벨의 같은 중복을 {@link finalizeCancelledExecution} 으로
 * 추출한 선례(W12)와 동일한 처리다.
 *
 * **두 호출부의 유일한 차이는 `errorEnvelope` 유무**다 — ...
 * throw 는 호출부 책임으로 남긴다 — ...
 */
private async markNodeCancelled(
  nodeExecution: NodeExecution,
  node: Node,
  context: ExecutionContext,
  executionId: string,
  errorEnvelope?: { code: string; message: string },
): Promise<void> { ... }
```

호출부 대조(`executeNode` catch, 5814-5860행):

- `isAbortError` 분기(5817-5827행): `await this.markNodeCancelled(nodeExecution, node, context, executionId, { code: 'AbortError', message: err.message }); throw err;`
- `ExecutionCancelledError` 분기(5858-5859행): `await this.markNodeCancelled(nodeExecution, node, context, executionId); throw err;`

**대조 결과 — 세 주장 전부 사실로 확인됨:**

1. **"두 호출부의 유일한 차이는 `errorEnvelope` 유무"** — 참. 두 호출 모두 동일한
   `nodeExecution`/`node`/`context`/`executionId` 식별자(같은 `executeNode` 스코프에서
   선언된 동일 변수)를 넘기고, 다섯 번째 인자(`errorEnvelope`)의 유무만 다르다.
2. **"throw 는 호출부 책임으로 남긴다"** — 참. 헬퍼 본문(4592-4615행) 어디에도
   `throw`가 없고, 두 호출부 모두 `await this.markNodeCancelled(...)` 직후 별도로
   `throw err;`를 실행한다.
3. **"W12 선례와 동일한 처리"** — 타당한 비유. `finalizeCancelledExecution`(W12,
   4617-4630행)도 필드 대입 + `save`/`update` + emit 로 구성된 반복 블록을 "호출자마다
   달랐던 유일한 값(logContext)"만 인자로 뽑아 헬퍼화한 동일 패턴이다.

즉 오케스트레이터가 우려한 "인용·서술이 실체와 어긋난다" 패턴의 **5번째 재발은
없다** — `markNodeCancelled` JSDoc의 텍스트 내용 자체는 실제 코드와 정확히 일치한다.

## 신규 발견 — JSDoc 이 잘못된 선언에 붙는 배치 결함 (내용이 아니라 구조)

- **[WARNING]** 신규 `markNodeCancelled` JSDoc/함수가 **기존 `finalizeCancelledExecution`
  JSDoc 블록과 그 함수 선언 사이에** 끼어 들어가, `finalizeCancelledExecution`이
  자신의 W12 JSDoc과 더 이상 인접하지 않게 됐다
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:4551`-`:4617`
    (구체적으로 4551-4570행 = `finalizeCancelledExecution`의 기존 W12 JSDoc, 4571-4585행 =
    신규 `markNodeCancelled` JSDoc, 4586-4615행 = `markNodeCancelled` 함수 본문,
    4617행 = `private async finalizeCancelledExecution(` 선언)
  - 상세: `git show 410d913fe`로 확인한 diff 는 새 헬퍼를 `finalizeCancelledExecution`의
    **기존 JSDoc 블록 바로 뒤, 함수 선언 바로 앞**에 삽입했다(`@@ -4568,6 +4568,52 @@`
    hunk 위치). 그 결과 실제 파일 순서는 다음과 같다: (1) `finalizeCancelledExecution`을
    설명하는 원래 JSDoc(`@param logContext ...`로 끝남, 4570행 `*/`), (2) 사이에
    빈 줄/코드 없이 바로 이어지는 `markNodeCancelled`의 신규 JSDoc(4571행 `/**` ~
    4585행 `*/`), (3) `markNodeCancelled` 함수 전체(4586-4615행), (4) 빈 줄 하나,
    (5) `finalizeCancelledExecution` 선언(4617행). 두 코멘트 블록 사이에 코드나 빈 줄이
    없어 둘 다 `markNodeCancelled` 선언의 leading trivia 로 묶이고, 정작
    `finalizeCancelledExecution` 선언 바로 위에는 **코멘트가 하나도 남지 않는다**
    (4615행 함수 종료 `}` → 4616행 빈 줄 → 4617행 선언). IDE hover(Quick Info)나
    TypeDoc 같은 문서 생성기는 통상 선언에 **가장 가까운** 리딩 코멘트를 그 선언의
    문서로 채택하므로, `finalizeCancelledExecution`에 마우스를 올리면 원래 W12
    JSDoc(이 함수가 무엇을 하는지, `@param logContext`가 왜 필요한지 설명하는 내용)이
    더 이상 뜨지 않을 가능성이 높고, `markNodeCancelled` 쪽은 위아래로 서로 무관한 두
    함수를 설명하는 코멘트 두 덩이가 나란히 붙어 있어 사람이 읽어도 "이 코멘트가 어느
    함수를 설명하는가"가 시각적으로 헷갈린다. 런타임 동작에는 영향이 없다(코멘트이므로
    빌드는 그대로 통과) — 순수하게 문서 발견성(discoverability)/정확한 귀속 문제다.
  - 제안: `markNodeCancelled` 함수 전체(JSDoc + 본문, 4571-4615행)를
    `finalizeCancelledExecution`의 기존 JSDoc **앞**(4551행 이전)으로 옮기거나,
    `finalizeCancelledExecution` 함수 전체가 끝나는 지점(4630행) **뒤**로 옮긴다.
    어느 쪽이든 각 JSDoc 블록과 그 블록이 바로 아래에서 서술하는 함수 선언 사이에
    다른 함수가 끼지 않게만 하면 된다.

## 그 외 항목 (확인만, 재론 아님)

- **CHANGELOG 미갱신은 결함 아님** — `CHANGELOG.md`에 이번 W25 리팩터(`markNodeCancelled`
  추출) 관련 항목이 없다. 그러나 동일 전례인 W12(`finalizeCancelledExecution` 추출)도
  CHANGELOG 에 항목이 없다(`grep -n "W12\|finalizeCancelledExecution" CHANGELOG.md` 0건).
  두 경우 모두 동작 보존(behavior-preserving) 순수 리팩터라 이 프로젝트의 CHANGELOG 관용구상
  누락이 아니라 일관된 선택으로 판단한다.
- **plan SoT 미갱신도 결함 아님** — `plan/in-progress/node-cancellation-residual-signal-propagation.md`
  에 W25/`markNodeCancelled` 언급이 없으나, 그 문서의 "잔여 항목"/"트레이드오프" 절은
  spec 레벨 판단이 필요했던 항목(W10 스로틀 등)만 다루며 ai-review WARNING 각각을
  전수 추적하지 않는다 — W19/W20 등 앞선 라운드 WARNING들도 이 문서에 개별 반영되지
  않은 것과 동일한 패턴.
- **인라인 주석 정확성** — `executeNode` catch 블록의 기존 인라인 주석(5808-5813,
  5815-5816, 5840-5853, 5855-5857행)은 리팩터 이후에도 여전히 실제 동작(취소 시
  `cancelled` 마킹 + `NODE_CANCELLED` 발행 + 재throw, `errorEnvelope` 유무 차이)과
  정확히 일치한다 — stale 코멘트 없음.
- 타입(`Node`, `ExecutionContext`)은 파일 상단 기존 import(`Node`는 22행에서
  `../nodes/entities/node.entity`)와 다른 호출부(예: `executeNode` 자신의 시그니처,
  5551-5560행)의 동일 타입 사용과 일관된다 — 시그니처 자체의 문서 정합성 문제 없음.

## 요약

오케스트레이터가 지목한 `markNodeCancelled` JSDoc의 세 핵심 주장 — "두 호출부의
유일한 차이는 `errorEnvelope` 유무", "throw는 호출부 책임", "W12 선례와 동일한
처리" — 은 커밋 `410d913fe`의 실제 코드(호출부 5814-5860행, 헬퍼 본문 4586-4615행)와
전부 문자 그대로 일치했다. 이 브랜치가 4회(W1·W13·3R INFO·W21) 재발시킨 "인용·서술이
실체와 어긋난다" 패턴의 5번째 재발은 **없다**. 다만 검증 과정에서 별도의 신규
문서화 결함을 하나 발견했다 — 새 헬퍼가 `finalizeCancelledExecution`의 기존 JSDoc과
그 함수 선언 사이에 삽입되면서, `finalizeCancelledExecution`이 자신의 W12 JSDoc과
더 이상 인접하지 않게 됐다(구조적 오귀속). 내용이 틀린 게 아니라 배치가 틀린
문제라 런타임 영향은 없지만, IDE hover/문서 생성기가 엉뚱한 함수에 JSDoc을
귀속시킬 수 있어 WARNING으로 기록한다. CHANGELOG·plan SoT 미갱신은 W12 전례와
동일한 프로젝트 관용구(순수 리팩터는 기록 안 함)라 결함이 아니다.

## 위험도

LOW
