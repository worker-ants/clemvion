---
title: 웹채팅 로더 — 명령 큐 replay 가 arguments(array-like) 를 버려 auto-boot 누락 수정
worktree: webchat-queue-replay-arguments
started: 2026-06-27
owner: developer
status: complete
spec_impact: []
related_spec:
  - spec/7-channel-web-chat/2-sdk.md
---

# 배경

#709(command-queue 스텁 추가) 후에도 고객 사이트(cafe24) 임베드 시 위젯 버튼이 안 보임 — 콘솔 에러·경고 없음.
런타임 계측으로 확정:

- 스니펫(스텁+boot 두 블록)은 원본 HTML 에 그대로 있고 **블록 2(`ClemvionChat('boot', …)`)도 실행됨**.
- 블록 2 시점 `ClemvionChat` 는 stub(`installed=undefined`) → boot 가 **큐에 정상 적재**(`q = [Arguments(2)]`).
- 로더 로드 후 `__wcInstalled=true`, `q=undefined`(= real dispatcher 로 교체) 이지만 **위젯 iframe 미생성**.
- **콘솔 수동 `ClemvionChat('boot', …)` 는 iframe 생성됨**(off-screen) — 즉 boot 경로 자체는 정상.

핵심 단서: `q = [Arguments(2)]` — 큐 항목이 진짜 Array 가 아니라 **`arguments` 객체**.

# Root cause (코드 확정)

스니펫 스텁(`QUEUE_STUB_JS`, spec 2-sdk §1·R5)은 GA 식 표준대로 `(.q…).push(arguments)` 한다 → 큐 항목의
런타임 형태는 **array-like(arguments) 객체**.

로더 `installGlobal`(`codebase/packages/web-chat-sdk/src/loader.ts`)의 replay 루프가
**`if (!Array.isArray(call) …) continue`** 로 걸러냈다. `Array.isArray(argumentsObject) === false` 이므로
**큐잉된 boot 호출이 통째로 건너뛰어져 영영 실행되지 않는다**. `continue` 가 `slice` 호출 전에 먹어
예외/경고도 안 남(`console.warn` 미발생) → 무증상.

- **수동 boot 가 되는 이유**: real dispatcher 직접 호출이라 큐/replay(Array.isArray) 경로를 안 거침.
- **#709 단위테스트가 못 잡은 이유**: 테스트 스텁이 rest 파라미터 `...a`(진짜 배열)를 push 해
  `Array.isArray===true` 로 통과 → **테스트-현실 갭**.
- spec 2-sdk §1(28행)·R5(179행)는 스텁을 `push(arguments)` 로 명시 → 로더가 arguments 를 replay 하는 것이
  **스펙 계약**. 즉 구현이 계약을 위반한 **순수 구현 버그(스펙 변경 불필요)**.

# 수정 (SDK 로더 전용, `packages/web-chat-sdk`)

1. `loader.ts` `installGlobal` replay 루프: `Array.isArray` 필터 제거 →
   **length 기반 array-like(arguments) 수용** 후 `Array.prototype.slice.call` 로 실제 Array 로 정규화해 replay.
   문자열 등 비-객체는 계속 무시(`typeof item === "object"` 가드 유지), `args[0]` 비-문자열도 skip, replay 예외 흡수 유지.
2. `loader.spec.ts`: **실제 스텁이 만드는 array-like(arguments) 큐**(함수 스텁 + `.q` 항목을 `{0,1,length}` array-like 로)를
   재현하는 회귀 테스트 추가 — 옛 코드에서 실패, 수정 후 통과 실증.

스텁(`push(arguments)`)·스니펫은 **변경하지 않음** — 표준 패턴이고, 로더는 중앙 배포라 고치면
**고객이 스니펫을 다시 붙이지 않아도 기존 배포분까지 즉시 복구**된다(스텁을 바꾸면 재-붙여넣기 필요).

# 검증

- `pnpm test` 48 pass (신규 회귀 1 포함), `pnpm lint`/`typecheck` clean, `pnpm build` → `dist/loader.js`.
- 회귀 가드 실증: fix 임시 되돌림 시 신규 테스트 FAIL → 복원 시 PASS.

# 관계

- #709(스텁 추가)가 드러낸 incompatibility 의 실제 해소. #713(iframe 코너 고정)과 함께 임베드 위젯 미표시의
  두 번째(부팅 미실행) 원인. 두 PR 모두 배포돼야 고객 사이트에서 위젯이 정상 노출됨.
