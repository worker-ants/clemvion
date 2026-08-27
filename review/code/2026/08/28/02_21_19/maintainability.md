# 유지보수성(Maintainability) 리뷰 — `system-error-banner` (4라운드, `02_21_19`)

## 스코프 메모

이 diff 는 이미 `/ai-review` 3라운드(`01_26_11` → `01_44_22` → `02_02_18`)를 거쳤고,
매 라운드 CRITICAL 0 · WARNING 은 전부 RESOLUTION.md 로 반영이 기록돼 있다. 이번
라운드는 `codebase/frontend/src/lib/websocket/use-execution-events.ts` ·
`__tests__/use-execution-events.test.ts` · `CHANGELOG.md` 를 직접 `Read` 로 열어
**그 반영이 실제 소스에 그대로 있는지**를 재확인하고, 새 발견사항을 찾는 데 집중했다.
`review/code/2026/08/28/{01_26_11,01_44_22,02_02_18}/*`(RESOLUTION.md·SUMMARY.md·
meta.json·`_retry_state.json`·개별 reviewer 산출물)는 harness 가 생성한 prose
리포트/상태 JSON 이라 가독성·네이밍·함수 길이 등 코드 품질 지표의 적용 대상이 아니므로
이번에도 제외한다(`02_02_18` maintainability 리뷰와 동일 기준).

## 재확인 결과 (직접 소스 대조)

- `direct` 분기는 완전히 제거됐다 — `grep -n "\bdirect\b" use-execution-events.ts` 0건.
  잔여 참조·주석 없음.
- `extractNodeErrorPayload` JSDoc(58-83행)은 `asRecord` 헬퍼(51-56행) **아래**, 함수
  (84행) **바로 위**에 위치해 문서-함수 인접성이 유지되고 있다. `§4.1-a` 인용도 정확하다.
- `handleNodeCompleted`(807-813행)와 `handleNodeFailed`(842-850행) 주석이 둘 다
  `output.output.error` 로 일치해, 자매 주석 낙후 문제는 남아있지 않다.
- 테스트 파일의 `wrapNodeHandlerOutput()` 빌더(`use-execution-events.test.ts:1987-1991`)가
  9개 호출부(2015·2057·2084·2164·2209·2249·2272·2315·2349행)에서 재사용되고 있어,
  이전 라운드가 지적한 "래퍼 shape 손복제" 문제는 단일 지점화됐다.

## 발견사항 (신규 없음 — 기존 유예 항목 재확인)

세 항목 모두 `01_26_11`/`01_44_22`/`02_02_18` 세 라운드에 걸쳐 이미 지적·유예됐고, 이번
라운드에서도 코드에 동일하게 존재함을 확인했다. 사유가 매 라운드 재검토됐고 여전히
타당하므로 새 WARNING 으로 격상하지 않는다.

- **[INFO]** `handleNodeCompleted`/`handleNodeFailed` 의 errorPayload 추출 →
  `retryable`/`retryAfterSec` 계산 → `addConversationMessage` 블록이 ~20줄 거의 동일하게
  중복
  - 위치: `codebase/frontend/src/lib/websocket/use-execution-events.ts:813-835`
    (`handleNodeCompleted`) vs `:909-931` (`handleNodeFailed`)
  - 상세: diff 이전부터 있던 중복이고, 두 핸들러는 `duration`/`status` 처리 등 인접
    블록에서 서로 다른 로직을 갖고 있어(760-806행 vs 874-902행) 무리하게 추출하면 그
    차이가 흐려질 수 있다는 사유로 3라운드 연속 defer, 각 라운드 reviewer 가 동의.
  - 제안: 현 판정 유지. 세 번째 호출부가 생기는 등 이 블록을 다시 손댈 사유가 생기면
    `appendSystemErrorIfMultiTurn(errorPayload, { nodeId, nodeLabel, nodeExecutionId,
    timestamp })` 류 헬퍼 추출을 재검토.

- **[INFO]** `asRecord(asRecord(domain)?.error)` 이중 언래핑이 한 줄에 압축돼 즉시
  읽기엔 밀도가 높음
  - 위치: `codebase/frontend/src/lib/websocket/use-execution-events.ts:89-90`
  - 상세: JSDoc(26줄, 58-83행)이 함수 본문(12줄)보다 훨씬 길어 "왜 이 shape인지"를
    이미 보완하고 있고, 중간 변수(`domain`)를 명시적으로 풀어써도 이름이 하나 늘 뿐
    가독성 이득이 크지 않다는 사유로 유예 유지.
  - 제안: 현 판정 유지.

- **[INFO]** `payload.output` 필드 타입 표기가 두 핸들러에서 다름 —
  `handleNodeCompleted` 는 `output?: Record<string, unknown>`(769행), `handleNodeFailed`
  는 `output?: unknown`(869행)으로 같은 `NodeHandlerOutput` 래퍼를 다른 폭으로 duck-type
  - 위치: `codebase/frontend/src/lib/websocket/use-execution-events.ts:769`,
    `:855-861`(`error` 필드도 여전히 객체 형태를 허용), `:869`
  - 상세: `extractNodeErrorPayload` 시그니처가 `rawOutput: unknown` 으로 통일돼 실질
    동작 차이는 없으나, "호출부마다 같은 개념을 로컬 타입으로 손으로 duck-type 한다"는
    근본 원인(공유 `NodeHandlerOutput` 타입 부재)은 남아 있다 — 이 결함이 애초에 그
    타입 불일치에서 비롯됐다는 점에서 근접한 위험이지만, 공유 타입 도입은 이 PR 과
    직교한 별건으로 3라운드 연속 defer.
  - 제안: 현 판정 유지. 공유 `NodeHandlerOutput` 타입을 도입할 때(테스트의
    `wrapNodeHandlerOutput` 반환 타입 포함) 함께 정리.

## 신규 발견사항

없음. 4라운드째 코드 자체(`use-execution-events.ts`/`.test.ts`)에 새로 지적할 유지보수성
결함이 나오지 않았다 — 네이밍(`asRecord`, `wrapNodeHandlerOutput`, `[가드]`/`[캐너리]`
접두 테스트명)이 목적을 명확히 드러내고, 함수 길이·중첩 깊이·순환 복잡도 모두 이 파일의
기존 핸들러 패턴과 일관된 범위 안에 있으며, 매직 넘버도 없다. `CHANGELOG.md` 신규 항목
(1-20행)도 기존 항목(예: 22행 이하)과 문체·깊이가 일치한다.

## 요약

이번 라운드는 이전 세 라운드가 지적한 유지보수성 결함(JSDoc-함수 분리, 자매 주석 낙후,
fixture 5곳 손복제, `direct` 분기 커버리지 0)이 소스에 실제로 반영돼 있음을 직접 재확인한
결과다. 남은 항목(핸들러 간 ~20줄 중복, 이중 언래핑 밀도, `output`/`error` 필드 타입
표기 불일치)은 전부 이전 라운드에서 근거와 함께 명시적으로 유예됐고, 이번 재확인에서도
그 사유가 여전히 유효해 새로 WARNING 으로 격상할 근거가 없다. 코드 자체의 가독성·네이밍·
복잡도·일관성은 양호하며, 신규 결함은 발견되지 않았다.

## 위험도
NONE
