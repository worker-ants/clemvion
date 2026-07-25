# 요구사항(Requirement) Review — commerce(Cafe24/MakeShop) abortSignal cascade

## 발견사항

- **[WARNING] [SPEC-DRIFT] `spec/conventions/node-cancellation.md` §4 의 cascade 코드 예시가 실제로 리스너 누수 버그를 담고 있고, 본 diff 의 구현은 (올바르게) 그 예시를 벗어난다**
  - 위치: `spec/conventions/node-cancellation.md:90-98` (§4 코드 블록, `controller.signal.addEventListener('abort', () => upstream.removeEventListener(...), { once: true })` 부분) vs 구현 `codebase/backend/src/nodes/integration/cafe24/cafe24-api.client.ts:1213-1227`, `codebase/backend/src/nodes/integration/makeshop/makeshop-api.client.ts:842-856`
  - 상세: spec §4 의 예시 코드는 upstream listener 해제를 `controller.signal` 의 `'abort'` 이벤트에 건다. 그런데 요청이 **성공**하면 `controller`(로컬 timeout 용)는 절대 abort 되지 않으므로 그 이벤트가 발화하지 않고, `upstream`(실행 전역 `context.abortSignal`) 에 등록한 리스너가 해제되지 않은 채 남는다 — 재시도(429/401)가 반복될 때마다 누적. 이 diff 의 `RESOLUTION.md`(W1)가 정확히 이 문제를 실측(mutation: 리스너 제거 삭제해도 89 passed → 재작성 후 2 failed)으로 확인했고, cafe24/makeshop 두 client 는 cleanup 을 `finally` 블록으로 옮겨 고쳤다. 그러나 **spec 본문의 코드 샘플 자체는 여전히 버그가 있는 옛 패턴**이고, 기존 `http-request.handler.ts` 는 지금도 그 spec 샘플을 문자 그대로 구현하고 있어 **같은 누수를 그대로 갖고 있음**을 직접 확인했다(`http-request.handler.ts:417-421`). 즉 이번 diff 의 코드는 spec 이 아니라 실측된 버그를 근거로 **의도적으로 spec 예시와 다르게** 작성됐고, 그 판단은 옳다 — spec 코드 샘플이 낡은 것이다.
  - 제안: 코드는 유지. `spec/conventions/node-cancellation.md` §4 의 예시 코드를 `finally` 기반 cleanup 패턴(cafe24/makeshop 구현과 동일한 모양)으로 갱신할 것을 `project-planner` 에 위임 필요. 겸사겸사 `http-request.handler.ts` 의 선재 누수(이미 plan 문서에 후속으로 언급돼 있음)도 이 spec 갱신과 짝지어 추적하면 좋다. 현재 `plan/in-progress/spec-update-node-cancellation-shutdown-classification.md` 의 `spec_impact` 에 `node-cancellation.md` 가 이미 있으나 그 위임 항목은 §6 표/​frontmatter `code:` 갱신만 다루고 있고 **§4 코드 샘플 버그는 아직 어디에도 적혀 있지 않다** — 신규로 적어둘 필요.

- **[WARNING] 주석의 메서드명이 실제 구현과 다르다 — `executeWithRetry` 는 makeshop 전용 이름, cafe24 파일의 실제 메서드는 `executeWithRateLimit`**
  - 위치: `codebase/backend/src/nodes/integration/cafe24/cafe24-api.client.ts:1216` (`// execution-wide signal — and \`executeWithRetry\` recurses on 429/401, so`)
  - 상세: 동일 주석 블록을 makeshop 구현(`makeshop-api.client.ts:845`, 실제 메서드명 `executeWithRetry`, 확인됨: `grep`으로 `private async executeWithRetry`)에서 그대로 복사해 cafe24 파일에 붙였는데, cafe24 파일에는 `executeWithRetry` 라는 메서드가 존재하지 않는다(`grep` 결과 0건) — 실제로 429/401 재귀 호출을 수행하는 메서드는 `executeWithRateLimit`(`cafe24-api.client.ts:1164`)이다. 동작에는 영향 없는 주석-only 오기재이지만, 향후 유지보수자가 이 이름으로 코드를 찾으면 실패한다.
  - 제안: `executeWithRetry` → `executeWithRateLimit` 로 정정.

- **[INFO] AbortError 의 취소/타임아웃 판별은 `upstream.aborted` 스냅샷에 의존 — 인과관계가 아닌 시점 관측**
  - 위치: `codebase/backend/src/nodes/integration/cafe24/cafe24-api.client.ts:1250-1256`(및 makeshop 대응부 `makeshop-api.client.ts:875-881`)의 `if (err instanceof Error && err.name === 'AbortError' && upstream?.aborted)`
  - 상세: 로컬 `timeoutMs` 타이머가 먼저 발화해 fetch 가 reject 된 직후, catch 블록 실행 전(microtask 틈)에 upstream 도 별도 사유로 abort 되는 극히 좁은 race 에서는 실제로는 타임아웃이 원인인 실패를 취소로 오분류해 `recordNetworkFailure` 를 건너뛸 수 있다. 다만 이는 `database-query.handler.ts` 등 저장소 전반이 이미 채택한 동일한 best-effort 휴리스틱(원인 자체가 아니라 abort 시점 flag 로 구분)이며, spec §1 의 "best-effort" 원칙과 부합한다. 이번 diff 가 새로 만든 결함이 아니라 기존 패턴을 그대로 재사용한 것.
  - 제안: 블로킹 아님. 관측되면 (예: 카운터가 실제 장애를 과소 집계) `AbortSignal.any([...])`/reason 전달 등으로 인과관계를 명시화하는 별도 후속으로 고려.

- **[INFO] §6 구현 현황 표 · `frontmatter.code:` 목록 갱신은 이미 process 상 정상 위임됨**
  - 위치: `plan/in-progress/spec-update-node-cancellation-shutdown-classification.md` (파일 10) 추가 위임 섹션
  - 상세: `node-cancellation.md` §6 표의 MakeShop/Cafe24 행이 여전히 `— 미구현 (Planned)` 인 채로 구현이 완료됐으나, developer 가 `spec/` 쓰기 권한이 없어 별도 plan 문서로 project-planner 에 이미 위임돼 있다(`RESOLUTION.md` W2 와 교차 확인). 새 발견사항 아님 — 절차가 올바르게 지켜졌음을 확인.

## 요약

Cafe24/MakeShop API client 에 `context.abortSignal` → per-call timeout `AbortController` cascade(spec §4)를 배선한 변경이다. 이전 리뷰 라운드(`review/code/2026/07/25/21_02_33`)에서 지적된 두 CRITICAL(취소를 `cancelled` 대신 transport 오류로 오분류·취소가 `consecutive_network_failures` 카운터를 오염시킴)과 한 WARNING(성공 경로에서 리스너 미해제 누수)은 이번 diff 에서 모두 정정된 상태로 반영돼 있고, `upstream?.aborted` 로 로컬 timeout 과 실행 취소를 구분하는 로직은 `spec/1-data-model.md` 의 "노드 실행 시점의 자동 호출만 합산" 원칙과 정확히 일치한다. cafe24/makeshop 두 client·handler 구현은 대칭적이고, 신규 테스트(client 4쌍·handler 2쌍)는 mutation 으로 실효성이 검증돼 vacuous 하지 않다. 실질적 결함은 발견되지 않았고, 남은 것은 spec 본문 자체의 §4 예시 코드가 (이 diff 가 실측으로 고친) 리스너 누수 버그를 여전히 담고 있다는 SPEC-DRIFT 1건과, cafe24 파일에 복붙된 주석의 메서드명 오기재 1건뿐이다. 둘 다 기능에는 영향이 없다.

## 위험도

LOW
