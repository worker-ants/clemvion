# 유지보수성(Maintainability) Review — linear-cancel-mechanism (6R)

## 스코프 노트

이번 라운드 프롬프트에 첨부된 "리뷰 대상 파일" 38건은 전부 `review/code/2026/07/26/{13_47_42,14_45_30,15_29_59,15_30_00}/*`
(과거 라운드의 리뷰 산출물 md/json)이며, 실제 소스 diff(`execution-engine.service.ts`)는 프롬프트
payload 에 라우팅돼 있지 않다(4R·5R 에서도 반복된 동일한 "harness diff-base 스코프 갭"). 오케스트레이터가
직접 지시한 점검 대상(W25 — `markNodeCancelled` 추출)이 정확히 이 누락된 코드 변경분이므로, `git log`/
`git show 410d913fe`로 해당 커밋을 특정하고 현재 워크트리의 실제 소스(`git status --short` 로 커밋 상태와
동일함 확인)를 `Read`/`Grep` 으로 직접 열어 검증했다.

## 중점 확인: W25(`executeNode` 두 취소 분기 ~20줄 중복) 해소 여부 — 해소 확인 (단, 신규 INFO/WARNING 2건)

**결론: 해소됨.** 커밋 `410d913fe`가 `markNodeCancelled(nodeExecution, node, context, executionId,
errorEnvelope?)` 사설 헬퍼를 추출해 `isAbortError`/`ExecutionCancelledError` 두 분기의 중복 로직(상태
마킹·`finishedAt`/`durationMs` 계산·`save`·`NODE_CANCELLED` emit)을 단일 지점으로 수렴시켰다.

### 확인한 것

- 헬퍼 정의: `markNodeCancelled` (`execution-engine.service.ts:4586`-`:4615`). 본문은 상태 대입 →
  (선택적) error 필드 대입 → `finishedAt`/`durationMs` 계산 → `save` → `emitNode(NODE_CANCELLED, ...)`
  로 단일 책임, 순환 복잡도가 낮다(`if (errorEnvelope)` 조건 2회뿐).
- 호출부 1 — `isAbortError` 분기(`:5814`-`:5828`): `await this.markNodeCancelled(nodeExecution, node,
  context, executionId, { code: 'AbortError', message: err.message }); throw err;` — 이전 ~29줄이
  ~15줄(주석 포함)로 축소.
- 호출부 2 — `ExecutionCancelledError` 분기(`:5854`-`:5860`): `await this.markNodeCancelled(nodeExecution,
  node, context, executionId); throw err;` — 이전 ~24줄이 ~7줄로 축소.
- **두 분기의 유일한 차이(`errorEnvelope` 유무)를 선택 인자로 표현**했고, `payload` 도
  `...(errorEnvelope ? { error: errorEnvelope } : {})` 조건부 spread 로 키 자체가 안 생기게 했다 —
  직전 라운드(`15_30_00/maintainability.md`)가 제안한 형태와 사실상 동일(파라미터 순서만
  `(nodeExecution, node, context, ...)` 로 `node`/`context` 위치가 제안과 뒤바뀌었으나, `executeNode`
  본문에서 `node.id`/`node.type` 이 `context.parentNodeExecutionId` 보다 먼저 쓰이는 순서와 맞춰 오히려
  더 자연스럽다 — 결함 아님).
- **`throw` 는 호출부 책임으로 남겼다** — 두 분기가 재던지는 원본 에러(`err`)가 다르므로, 헬퍼가 던지면
  "무엇을 다시 던지는가"가 호출부에서 안 보이게 된다는 이전 라운드의 논거가 실제 구현에 그대로 반영됨.
- **`finalizeCancelledExecution`(W12) 선례와의 일관성**: 두 헬퍼 모두 "상태 마킹 + 시간 필드 계산 +
  영속 + emit, throw 는 호출자 책임" 패턴을 공유한다. 네이밍만 `finalize<Status>Execution`
  (Execution 레벨, guarded UPDATE 로 종결까지 포함)과 `markNodeCancelled`(Node 레벨, 상태 대입만)로
  갈라지는데, 이는 스코프(Execution vs NodeExecution)와 동작(종결 전체 vs 마킹) 차이를 정확히 반영한
  의도적 구분으로 판단되며 컨벤션 위반이 아니다.
- 두 호출부 모두 인자 순서(`nodeExecution, node, context, executionId, errorEnvelope?`)가 시그니처와
  정확히 일치 — 타입 검사(`ExecutionContext`, `NodeExecution`, `Node`)도 `executeNode` 시그니처와
  일치함을 직접 대조. `npx eslint execution-engine.service.ts --quiet` 클린.

**W12 헬퍼 추출 선례와 비교해도 형태·책임 분리·네이밍 모두 적정하다. 재발 여지 없이 해소됨.**

## 발견사항 (신규)

- **[WARNING]** `markNodeCancelled` 삽입으로 기존 `finalizeCancelledExecution`의 JSDoc 이 그 함수에서
  분리돼 다른 함수 사이에 낀 "고아(orphaned)" 주석이 됐다
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:4551`-`:4570`
    (기존 `finalizeCancelledExecution` JSDoc, W12 부터 존재), `:4571`-`:4585`(신규 `markNodeCancelled`
    JSDoc), `:4586`-`:4615`(`markNodeCancelled` 본문), `:4617`(`finalizeCancelledExecution` 선언 —
    바로 위에 blank line(`:4616`) 하나만 있고 자신을 설명하는 docblock 이 없음)
  - 상세: 이번 커밋은 `markNodeCancelled`의 새 JSDoc(`:4571`-`:4585`)과 함수 본문(`:4586`-`:4615`)을
    **기존 `finalizeCancelledExecution` JSDoc(`:4551`-`:4570`)과 그 함수 선언(원래 바로 다음 줄) 사이에**
    끼워 넣었다. 그 결과 지금은 두 `/** ... */` 블록이 빈 줄 없이 연속으로 붙어 있고(`:4570` `*/` →
    `:4571` `/**`), 첫 번째 블록(`finalizeCancelledExecution`을 설명하는 "guarded UPDATE", "8줄 블록이
    복제됐다" 등 Execution 레벨 서술)은 더 이상 자신이 설명하는 함수 선언과 인접하지 않는다 — 47줄
    떨어진 곳(`:4617`)에 그 함수가 있고, 그 사이엔 전혀 다른 함수(`markNodeCancelled`)와 그 함수의
    JSDoc 이 끼어 있다. `finalizeCancelledExecution`(`:4617`) 자신은 이제 바로 위에 아무 docblock 도
    없이 선언된다.
  - 이는 IDE 관용(주석은 바로 다음 선언에 귀속)에서 "누구를 설명하는 주석인지"를 시각적으로 오독하기
    쉽게 만든다 — 위→아래로 읽으면 두 블록이 하나로 이어진 것처럼 보이지만 실제로는 서로 다른 함수를
    설명하는 별개 블록이고, 그중 첫 블록은 실제 대상과 이미 멀어져 있다. 기능적 영향은 없지만(TS
    컴파일·런타임 무관), 이 프로젝트가 이미 W1·W13 라운드에서 반복 지적한 "주석/문서가 실제 코드
    위치·내용과 어긋난다" 패턴과 같은 클래스의 문제이며, 향후 `finalizeCancelledExecution` 을
    수정·삭제하는 사람이 그 JSDoc 을 함께 옮기지 않으면 영구적으로 고아 상태가 남을 위험이 있다.
  - 제안: `finalizeCancelledExecution`의 기존 JSDoc(`:4551`-`:4570`)을 그 함수 선언(`:4617`) 바로
    위로 옮기거나, 두 함수의 선언 순서를 바꿔(`finalizeCancelledExecution` 을 먼저, `markNodeCancelled`
    를 나중에) 각 JSDoc 이 자신이 설명하는 함수와 다시 인접하도록 정리 권장. 기능 변경은 필요 없고
    블록 재배치만으로 해소된다.

- **[INFO]** `errorEnvelope?: { code: string; message: string }` 가 익명 인라인 타입으로 두 번(`:996`,
  `:4591`) 등장 — 이름 있는 타입으로 묶으면 약간 더 명확해질 여지가 있으나 우발적 결합이 없고 필드 2개
  뿐이라 강제 개선 사항은 아니다
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:996`, `:4591`
  - 상세: 두 지점 모두 `{ code: string; message: string }` 형태를 반복하지만 서로 다른 맥락(하나는
    인터페이스 필드, 하나는 헬퍼 파라미터)이라 강한 결합은 아니다. 타입을 공유 `interface
    NodeErrorEnvelope { code: string; message: string }` 로 승격하면 §5.1 봉투 계약을 코드 레벨에서
    한 곳에 고정할 수 있어 향후 필드가 늘어날 때(예: `details` 추가) drift 를 막는 데 도움이 되지만,
    현재는 2개 필드·2회 등장뿐이라 비례성 있는 리팩터는 아니다.
  - 제안: 없음(참고용 기록). 세 번째 사용처가 생기면 이름 있는 타입으로 승격 검토.

## 요약

이번 라운드의 핵심 확인 대상인 W25(`executeNode` 취소 분기 ~20줄 중복)는 `markNodeCancelled` 헬퍼
추출(`410d913fe`)로 재발 여지 없이 해소됐다. 두 분기의 유일한 차이(`errorEnvelope` 유무)를 선택 인자로
표현하고, `throw` 를 호출부 책임으로 남기고, `finalizeCancelledExecution`(W12) 선례와 동형의 패턴("상태
마킹 + 시간 필드 + 영속 + emit")을 따른 것 모두 적정한 설계 판단이다. 다만 이번 삽입 과정에서
`finalizeCancelledExecution`의 기존 JSDoc 이 새 헬퍼(`markNodeCancelled`)의 JSDoc·본문 사이에 끼여
자신의 함수 선언과 멀어진 "고아 주석" 결함이 새로 생겼다(WARNING) — 기능 영향은 없으나 이 프로젝트가
반복 지적해 온 "주석/문서가 실제 코드와 어긋난다" 패턴의 변형이라 정정을 권한다. 나머지 1건은 INFO
수준(익명 타입 반복)으로 비례성 있는 개선 사항이 아니다.

## 위험도

LOW
