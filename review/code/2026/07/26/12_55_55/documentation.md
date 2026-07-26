# 문서화(Documentation) Review — linear-cancel-mechanism (2R, W4/W5/W6 검증 라운드)

대상: `review/code/2026/07/26/11_48_55` SUMMARY 의 WARNING W4(e2e 헤더 JSDoc)·W5(CHANGELOG)·W6(planner
위임 기록) 해소 검증 + 신규 코드(`assertExecutionNotCancelled` 등)의 JSDoc/주석이 실제 구현과
일치하는지 대조. 검증은 프롬프트 diff 뿐 아니라 `git show HEAD:<path>`(안정 스냅샷 — 동일 워크트리에서
mutation 검증이 파일을 순간적으로 `// MUTATED-OUT:` 으로 바꿔치기하는 것을 관측했기 때문에 live 워킹
디렉토리 대신 커밋된 스냅샷을 근거로 삼았다)로 직접 대조했다.

## W4 / W5 / W6 재검증 결과 — 3건 모두 해소 확인

- **W4 (e2e 헤더 JSDoc)** — 해소됨. `test/node-cancellation-propagation.e2e-spec.ts` 상단 JSDoc 이
  "## ⚠ 기전은 미확인" 을 "## 기전 규명 완료(2026-07-26) — 가드가 없어서 특정되지 않았던 것이었다" 로
  교체했고, 반증된 두 후보(`abortSignal`/guarded UPDATE)를 그대로 남긴 채 "결론: 그 시점엔 보장하는
  코드가 실제로 없었다" 는 새 결론과 실제 수정 내용(`assertExecutionNotCancelled`, 3개 순회 루프,
  mutation 검증)을 정확히 서술한다. "후속 과제" 로 남아 있던 이전 버전의 오도 문구는 더 이상 없다.
  - 위치: `codebase/backend/test/node-cancellation-propagation.e2e-spec.ts` 게이트 25-44 (파일 10).
- **W5 (CHANGELOG)** — 해소됨. `CHANGELOG.md` 에 `## Unreleased — 외부 cancel(Stop) 후에도...` 항목이
  신설됐고, RESOLUTION.md 의 C1-C4/W1-W3 조치 전부(`executeInline` 흡수 수정·컨테이너/Parallel 확장·
  mutation 커버리지 0 해소·`finishedAt`/`durationMs` 보존·Background 오분류·`cancelledBy` 계약·성능)를
  1~5번 항목으로 정확히 요약했다. `SoT:`/`추적:` 각주도 실제 spec 문서·plan 문서 경로와 일치한다.
  - 위치: `CHANGELOG.md` 게이트 1-16 (파일 1).
- **W6 (planner 위임 기록)** — 해소됨. `plan/in-progress/node-cancellation-residual-signal-propagation.md`
  에 `> **후속 — review/code/2026/07/26/11_48_55 (2026-07-26)**` 인용 블록이 추가돼 "spec 갱신(§2.3/
  §5.1/§6 + code:)은 developer 권한 밖이라 project-planner 에 위임" 을 명시하고,
  `spec-update-node-cancellation-shutdown-classification.md` 의 신설
  `## 추가 위임 (2026-07-26 #6)` 절과 상호 참조된다. 그 위임 절 자체도 기존 §2.3/§5.1/§6 서술과
  신규 메커니즘의 차이를 표로 정리하고 구체적 patch 제안(bullet 4건 + `code:` frontmatter 추가)을
  담고 있어, 자매 항목(MakeShop/Cafe24/chat-channel)과 형식이 대칭이다.
  - 위치: `plan/in-progress/node-cancellation-residual-signal-propagation.md` 게이트 95-116 (파일 11),
    `plan/in-progress/spec-update-node-cancellation-shutdown-classification.md` 게이트 228-297 (파일 12).

## 발견사항

- **[WARNING]** "status 단일 컬럼" 서술이 이번 수정 이후에도 완전히 정확하지는 않다 — 실제 select 는
  `id`+`status` 2개 컬럼이다. 직전 라운드(11_48_55)에서 database/performance/maintainability 3개
  reviewer 가 동시에 지적한 "JSDoc 은 status 단일 컬럼이라는데 구현은 6개 JSONB 포함 전체 row"
  문제(W1)는 이번 diff 로 실질적으로 해소됐지만(전체 row → 2컬럼 투영, 압도적으로 개선), 텍스트
  자체는 여전히 "실제로 status 한 컬럼만 왕복한다" 고 단언한다.
  - 위치:
    - `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` 게이트 7834-7838
      (JSDoc: `"status 단일 컬럼 ... findOne({select:{status:true}}) 로 컬럼 투영해 실제로 status 한
      컬럼만 왕복한다"`, 파일 6) — 예시로 인용한 코드 스니펫 `findOne({select:{status:true}})` 자체가
      실제 호출부와 다르다.
    - `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` 게이트 7852
      (실제 구현: `select: { id: true, status: true }`, 파일 6).
    - `CHANGELOG.md` 게이트 14 (`"status` 단일 컬럼만 투영하도록 변경"`, 파일 1) — 같은 표현을 반복.
  - 상세: `git show HEAD:.../execution-engine.service.ts` 로 확정한 committed 상태 기준, `select`
    옵션에 `id: true` 가 함께 지정돼 있어 왕복하는 컬럼은 엄밀히 2개(`id`, `status`)다. `id` 는
    PK/UUID 라 비용은 사실상 무시할 만하고(원래 문제였던 6개 JSONB 컬럼과는 차원이 다른 개선), TypeORM
    에서 PK 를 함께 select 하는 것은 흔한 관용구이므로 코드 자체를 문제 삼는 것은 아니다. 다만 이
    항목은 오케스트레이터가 명시적으로 "직전 라운드에 이 정확한 문구(status 단일 컬럼)가 코드와
    어긋난 전례가 있다" 며 대조를 요청한 지점이라, 텍스트가 "실제로 status 한 컬럼만" 이라고 100%
    문자 그대로 단언하는 것은 여전히 근소하게 부정확하다는 점을 기록해 둔다.
  - 제안: JSDoc/CHANGELOG 문구를 `"id`/`status` 2개 컬럼만 투영"으로 정정하거나, `select` 에서
    `id: true` 를 빼고 `where` 의 `id` 만으로 hydration 이 되는지 확인해 실제로 `status` 단일 컬럼만
    남기는 쪽 중 택1. 우선순위는 낮음(INFO 에 가까운 WARNING) — 성능·정확성에 실질적 영향은 없고
    텍스트 정밀도 문제다.

- **[INFO]** `assertExecutionNotCancelled` JSDoc 의 "같은 경계에서 이미 NodeExecution INSERT +
  Execution UPDATE + 이벤트 emit 이 일어나므로 상대 비용은 무시할 만하다" 서술 중 "Execution UPDATE"
  부분이 부정확하다는 지적이 직전 라운드 performance.md 에서 이미 INFO 로 남겨졌고(SUMMARY 의 필수
  조치 C/W 목록에는 포함되지 않음), 이번 diff 에서도 그대로 유지되고 있다. `updateExecutionStatus`
  는 상태 **전이** 시점(RUNNING 진입/terminal 등)에만 호출되고 매 노드 dispatch 경계마다 호출되는
  것이 아니므로(직접 확인: `execution-engine.service.ts` 내 `updateExecutionStatus` 호출부는 상태
  전이 지점에만 산재), 이 괄호 안 근거 문장은 "결론(비용 무시할 만함)" 자체는 여전히 유효하지만
  세부 서술은 다소 낙관적이다. SUMMARY 가 이를 필수 조치로 요구하지 않았으므로 이번 라운드에서
  미수정인 것 자체는 문제 삼지 않으며, 참고용으로만 재기록한다.
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` 게이트 7839
    (파일 6).

## 정합성 교차검증 (신뢰도 근거)

아래 항목들은 `git show HEAD:<path>` 로 커밋된 스냅샷을 직접 열어 diff 밖 문맥까지 대조했고, 전부
주석·JSDoc·테스트 서술과 실제 구현이 일치함을 확인했다(불일치 없음 — 참고 기록):

- `assertExecutionNotCancelled` 의 "이미 terminal 인 행은 재마킹하지 않으므로 stop 이 쓴
  `finishedAt`/`durationMs` 가 보존된다" 주장 — `updateExecutionStatus` else 분기의 guarded raw UPDATE
  (`WHERE id=$1 AND status IN ('pending','running','waiting_for_input')`)를 직접 열람해 확인. `stop()`
  이 이미 CANCELLED 로 커밋한 뒤에는 이 UPDATE 가 0행 매칭(no-op)되므로 주장이 실제로 성립한다.
- `loop-executor.ts` 의 "이 루프는 per-iteration try/catch 가 없어 `finally` 를 그대로 통과해
  재throw 불요" 주석 — 실제 코드가 `try { for (...) { await executeBody(...) } } finally { ... }`
  구조(catch 없음)임을 확인, 주석이 정확함.
  `foreach-executor.ts`/`execution-engine.service.ts` 의 "`executeContainerBody` 는 아이템 경계마다,
  `executeParallelBranchBody` 는 노드 경계마다" 구분 — 호출부(`runIter` 콜백이 아이템당 1회
  `executeContainerBody` 호출 / `executeParallelBranchBody` 내부 `for (nodeId of sortedNodeIds)` 루프
  안에 가드가 있음)를 직접 확인, 정확함.
- `ExecutionCancelledError` 의 `@internal` JSDoc 갱신("workflow.handler.ts 는 동일한 이유로 sanctioned
  예외") — 실제 `workflow.handler.ts` catch 가 `ParkReleaseSignal` 과 대칭으로
  `if (err instanceof ExecutionCancelledError) throw err;` 를 추가했음을 확인, 정확함.
- RESOLUTION.md W1 행의 "테스트 mock 은 `findOneBy` 로 위임" 주장 — `execution-engine.service.spec.ts`
  의 mock `executionRepository.findOne` 구현이 실제로 `mockExecutionRepo.findOneBy(opts?.where ?? {})`
  로 위임하고, 그 이유를 근거 주석("production 이 이 파일에서 `.findOne` 을 호출하는 유일한 지점")
  으로 남긴 것도 실측(`grep -n "executionRepository.findOne("`)과 일치함을 확인.

## 스코프 밖 항목 (참고)

- README/설정 문서 갱신 불요 — 이번 diff 는 새 환경변수·설정 플래그·CLI 옵션을 추가하지 않는다.
- API 문서 갱신 불요 — HTTP 라우트/컨트롤러/WS 이벤트 payload 계약(`cancelledBy` 등)은 변경이 아니라
  오히려 기존 계약 위반(W3)을 바로잡는 방향이라 문서와의 괴리를 늘리지 않는다.
- 작업 중 워크트리 파일이 `// MUTATED-OUT:` 상태로 순간 관측됐다(동일 워크트리에서 별도 세션/프로세스가
  RESOLUTION.md 가 서술한 mutation 검증(`cp` 스왑)을 재현하는 것으로 추정) — 이는 문서화 결함이 아니라
  concurrent 워크트리 사용에 따른 일시적 파일 상태이므로 별도 조치 요구 없이 기록만 남긴다. 이 리포트의
  모든 코드 인용은 이 순간성 상태가 아니라 `git show HEAD`(커밋된 안정 스냅샷)를 근거로 했다.

## 요약

직전 라운드가 지적한 문서화 WARNING 3건(W4 e2e 헤더, W5 CHANGELOG, W6 planner 위임 기록)은 모두
실제로 해소됐고, 세 곳 모두 단순히 "존재" 하는 수준을 넘어 근거·교차참조까지 정확하다 — e2e 헤더는
반증된 옛 결론을 완전히 대체했고, CHANGELOG 는 RESOLUTION 의 C1-C4/W1-W3 를 빠짐없이 요약했으며,
planner 위임 기록은 자매 항목과 형식·내용 모두 대칭이다. 새로 추가된 JSDoc·인라인 주석(loop-executor
의 try/finally 설명, foreach/parallel 의 경계 단위 구분, `ExecutionCancelledError` 의 sanctioned
예외 설명, 테스트 mock 의 `findOne→findOneBy` 위임 근거)은 전부 실제 구현과 대조해 정확함을 확인했다.
유일한 잔여 흠은 오케스트레이터가 명시적으로 대조를 요청한 "status 단일 컬럼" 문구로, 실제로는
`id`+`status` 2컬럼을 투영해 문자 그대로는 100% 정확하지 않다 — 다만 이는 직전 라운드에 지적됐던
"전체 row(6개 JSONB) vs 단일 컬럼" 수준의 실질적 오도와는 차원이 다른, 텍스트 정밀도 문제(WARNING,
low-priority)에 그친다.

## 위험도

LOW
