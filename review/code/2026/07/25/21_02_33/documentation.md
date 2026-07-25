# 문서화(Documentation) Review

## 발견사항

- **[WARNING]** `spec/conventions/node-cancellation.md` §6 구현 현황 표가 이번 변경으로 stale 해짐 — MakeShop/Cafe24 두 행이 여전히 "미구현 (Planned)" 로 남아 있다
  - 위치: `spec/conventions/node-cancellation.md:138`, `spec/conventions/node-cancellation.md:139` (실제 소스 파일 줄 번호, `Read`/`grep` 으로 확인)
  - 상세: 본 diff(파일 2/4/6/8)는 `Cafe24CallOptions.signal`/`MakeshopCallOptions.signal` 을 신설하고 handler → client cascade 를 구현해, `plan/in-progress/node-cancellation-residual-signal-propagation.md` 의 "MakeShop 노드 signal 전파" · "Cafe24 노드 signal 전파" 두 항목을 `[x]` 완료로 마킹했다(파일 9). 그런데 이 잔여 plan 이 추적하는 **SoT 인 `spec/conventions/node-cancellation.md` §6 표**는 여전히 두 행 모두 `— | 미구현 (Planned) — ... AbortController 만 사용, cascade(§4)·사전 체크(§2.2) 모두 없음` 으로 남아 있다(grep 으로 실측: `codebase/backend/src` 어디에도 이 표를 갱신한 변경이 diff 에 없음). 이 저장소는 정확히 이 종류의 drift(라벨/상태표와 본문 불일치)를 과거 3명의 리뷰어가 이미 지적한 이력이 있다 — `node-cancellation-residual-signal-propagation.md` 자체의 Overview 가 "review/code/2026/07/24/20_36_21 WARNING 2 — 3명이 중복 지적" 이라고 명시한다. 또한 직접 선례도 있다: DB 노드 in-flight 취소를 구현한 커밋(`640531901`)은 같은 PR 안에서 `spec/conventions/node-cancellation.md` §2.1/§6 을 함께 갱신했다(`git show 640531901 -- spec/conventions/node-cancellation.md` 로 확인, `code:` frontmatter 목록에 `database-query.handler.ts` 추가 + §6 표 행 갱신). 이번 변경은 그 선례를 따르지 않아 같은 실패 유형이 재발할 위험을 남긴다.
  - 제안: `developer` 는 `spec/` 쓰기 권한이 없으므로(CLAUDE.md), 이 §6 표의 두 행을 `✓` (구현됨, `cafe24-api.client.ts`/`makeshop-api.client.ts` §4 cascade 참조)로 갱신하는 후속 조치를 `project-planner` 에게 명시적으로 위임하거나 — 만약 이 저장소가 §6 표 같은 상태-표 동기화를 developer 의 예외 허용 범위로 취급한다면(과거 `640531901` 선례처럼) 이번 PR 안에서 직접 갱신할 것.

- **[WARNING]** 새로 추가된 주석/테스트 설명이 인용하는 `§2.2` 가 실제로 그 동작을 규정하는 절이 아니다 (근거 없는 spec 인용)
  - 위치: `codebase/backend/src/nodes/integration/cafe24/cafe24-api.client.spec.ts:89`, `:139` / `codebase/backend/src/nodes/integration/cafe24/cafe24-api.client.ts:1210` / `codebase/backend/src/nodes/integration/makeshop/makeshop-api.client.spec.ts:88`, `:138` / `codebase/backend/src/nodes/integration/makeshop/makeshop-api.client.ts:839` (모두 diff 게이트 숫자, new-file 기준)
  - 상세: 새 주석들은 "이미 aborted 인 upstream 은 즉시 abort" 동작의 근거로 `§2.2 (pre-check)` 를 반복 인용한다(예: `// spec/conventions/node-cancellation.md §4 (cascade) + §2.2 (pre-check).`, `§2.2: check on the way in, so a cancelled execution does not spend a network round trip.`). 그러나 `spec/conventions/node-cancellation.md` 를 직접 열어 확인하면 §2.2 의 표제는 **"CPU 바운드 / 즉시 완료 노드"** 이고 본문은 "signal 미지원 — best-effort... 시작 직전 `aborted` 체크는 권장(시작 전 cancel 된 경우 **즉시 종료**)" 이다 — 이는 Cafe24/MakeShop 클라이언트가 속하는 §2.1(외부 I/O 노드, fetch cascade)과는 다른 카테고리이고, "즉시 종료(early return)" 를 권고하는데 반해 이번 코드/테스트 주석은 명시적으로 "The fetch still runs (the client has no early return)" 라고 스스로 반대되는 설명을 붙였다. "이미 aborted 인 signal 을 controller 에 전파해 즉시 reject 시키는" 동작은 이미 §4 의 예시 코드(줄 87-88: `if (upstream.aborted) { controller.abort(); }`)에 그대로 포함돼 있어 §4 인용만으로 충분하다. `grep -rn "§2.2" codebase/backend/src` 로 확인한 결과 이 `node-cancellation.md §2.2` 인용은 이번 diff 의 4개 신규 파일에서만 등장하며, 기존 `http-request.handler.ts`(동일 cascade 패턴의 원조)의 주석은 §2.2 를 인용하지 않는다 — 즉 기존 관례를 따른 인용이 아니라 이번에 새로 도입된, 근거가 맞지 않는 인용이다. 이후 spec-impl-evidence 류 감사에서 §2.2 구현 위치를 이 파일들로 오추적할 위험이 있다.
  - 제안: 두 client·spec 파일 4곳의 "§2.2" 언급을 제거하거나 "§4 의 already-aborted 분기" 로 정정. 실제로 §2.2 를 만족시키려는 의도였다면(즉 이 코드가 "signal 미지원 CPU 바운드 노드" 의 사전 체크 요구도 겸해서 충족한다는 취지) 그 논리를 명시적으로 풀어써야 인용이 성립한다.

- **[INFO]** 테스트 제목이 실제 동작과 살짝 어긋나 보일 수 있음(문서적 명확성)
  - 위치: `codebase/backend/src/nodes/integration/cafe24/cafe24-api.client.spec.ts:138`, `codebase/backend/src/nodes/integration/makeshop/makeshop-api.client.spec.ts:137` — `it('aborts before issuing the request when the signal is ALREADY aborted', ...)`
  - 상세: 제목만 보면 "요청을 내보내기 전에 client 가 abort 한다(조기 반환)" 로 읽히기 쉬우나, 바로 아래 주석은 "The fetch still runs (the client has no early return) but must carry an already-aborted signal" 이라고 명시해 실제로는 fetch 호출 자체는 그대로 이루어지고 signal 만 이미 aborted 상태로 전달됨을 설명한다. 주석이 있어 실질적 오해 위험은 낮지만, 테스트 제목만 훑는 독자에게는 모순으로 보일 수 있다.
  - 제안: 제목을 예컨대 `'carries an already-aborted signal into the fetch call when the upstream signal is aborted before the call starts'` 식으로 조정하면 주석과의 긴장이 사라진다. (사소, 필수 아님)

- **[INFO]** CHANGELOG.md 미갱신 — 저장소 선례상 문제 없어 보임
  - 위치: `CHANGELOG.md` (변경 없음)
  - 상세: 이번 변경은 사용자-가시적 동작 변화가 아니라 내부 견고성(신뢰성) 보강이라 `CHANGELOG.md` "Unreleased" 절에 항목이 없다. 과거 동일 클래스 작업(DB 노드 in-flight 취소, HTTP 노드 cascade 최초 도입)도 `CHANGELOG.md` 에 전용 항목을 추가하지 않은 선례가 확인돼(`grep`), 이번 누락이 규약 위반은 아닌 것으로 판단된다. 참고로만 남긴다.

- **[INFO]** JSDoc/인라인 주석 자체의 정확성은 양호
  - 위치: `codebase/backend/src/nodes/integration/cafe24/cafe24-api.client.ts:68-73`(신설 `signal?: AbortSignal` JSDoc), `codebase/backend/src/nodes/integration/makeshop/makeshop-api.client.ts:62-67`(동일), `codebase/backend/src/nodes/integration/cafe24/cafe24.handler.ts:258-260`, `codebase/backend/src/nodes/integration/makeshop/makeshop.handler.ts:245-247`
  - 상세: "Absent for callers outside a node run (connection tests, token refresh) — the timeout still applies" 라는 JSDoc 주장은 실제 코드로 검증됨 — `rawPing()`/`refreshTokenViaQueue()`/`ensureFreshToken` 경로 어디에도 `opts.signal` 이 전달되지 않고, `executeWithRetry()`(노드 실행 경로) 에만 전달된다(grep 확인). handler 쪽 주석("let a cancelled execution stop the in-flight HTTP call instead of waiting out the per-call timeout")도 실제 배선과 일치. "Identical to `http-request.handler.ts`" 주장도 해당 파일의 cascade 블록(줄 400-423)과 로직이 동일함을 확인했다 — 이 부분은 문서-코드 정합성이 잘 유지되어 있다.

## 요약

핵심 배선(§4 cascade, JSDoc, handler 주석)은 코드와 정확히 일치하고 잘 문서화되어 있으나, 두 가지 문서 정합성 문제가 있다. (1) 이번에 완료된 MakeShop/Cafe24 signal 전파가 `spec/conventions/node-cancellation.md` §6 SoT 표에는 반영되지 않아, 이 저장소가 과거 3명의 리뷰어에게 이미 지적받았던 "라벨(plan 완료 표시) vs 본문(spec 상태표) 불일치" 패턴이 재발할 위험을 남긴다 — 특히 동일 컨벤션 문서를 같은 PR 안에서 갱신한 직접 선례(`640531901`)가 있어 이번 누락이 두드러진다. (2) 신규 주석·테스트 설명 4곳이 실제로 다른 카테고리의 노드를 규정하는 `§2.2` 를 근거 없이 인용하고 있어, 향후 spec-impl 추적 시 혼선을 줄 수 있다. 둘 다 기능적 결함은 아니며 CRITICAL 은 아니지만, 이 저장소가 반복적으로 문서 drift 에 민감하게 반응해온 이력을 고려하면 병합 전 정정을 권장한다.

## 위험도

MEDIUM
