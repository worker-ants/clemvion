# RESOLUTION — 11_53_49

대상 SUMMARY: `review/code/2026/08/21/11_53_49/SUMMARY.md` (위험도 **MEDIUM**, Critical **0**, WARNING **3**, INFO 10)

**처분: WARNING 3건 전부 수정.** 셋 다 **같은 결함 클래스의 재발**이었다 — 이 PR 이 없애려던
"미러" 와 "경로 게이팅" 이 각각 한 칸 낮은 층에서 다시 나타났다.

---

## WARNING 1 — 세 번째 스택(`channel-web-chat`)이 무방비였다 (architecture) — **수정**

`SCAN_DIRS` 에 `channel-web-chat/src` 를 넣어 **커버한다고 서술**했는데, 실측하니 그 스택
단독 PR 에서는 두 가드 중 어느 것도 실행되지 않는다:

| 워크플로 | 설치 범위 | 미러 가드 실행 |
| --- | --- | --- |
| `web-chat-checks` | `channel-web-chat...` 만 | ❌ (다른 스택 가드를 못 돌린다) |
| `frontend-checks` | pathspec 에 `channel-web-chat` **없음** | ❌ 트리거 자체가 안 됨 |

직전 라운드에서 backend 사각지대를 고치면서 **세 번째 스택을 세지 않았다.** 자매를 전수로
세지 않은 것이고, 이 시리즈가 반복해 겪은 형태다.

`frontend-checks` pathspec 에 `codebase/channel-web-chat/**` 를 추가해 닫았다 — 미러 가드를
호스팅하는 잡이 그쪽 변경에도 돌게 한다. web-chat 잡에 스텝을 넣는 대안은 그 잡이
`channel-web-chat...` 만 설치해 불가능했다(실측).

> 참고: web-chat 은 **현재 마커 코드가 0곳**이다(실측). 그래도 닫은 이유는 서술이 실제보다
> 넓었기 때문이다 — 커버한다고 적었으면 커버해야 한다.

## WARNING 3 — 가드의 **감시 목록 자체가 미러**였다 (maintainability) — **수정**

`SOT_SYMBOLS`·`SCAN_DIRS` 를 두 가드 파일에 리터럴 배열로 손 복제해 뒀다. 패키지에 심볼이
늘 때 한쪽만 갱신되면 반대쪽 스택 전용 PR 이 신규 심볼 재선언을 조용히 통과시킨다 —
**이 PR 이 없애려던 실패 클래스가 가드 설정 데이터 레벨에서 재현**된 것이다.

둘 다 **파생으로 바꿔 미러를 없앴다**:

- `SOT_SYMBOLS` ← 패키지의 실제 export 표면(`Object.keys`)
- `SCAN_DIRS` ← `codebase` 하위 각 스택의 `src` 실측 (스택이 늘어도 자동 포함)

### 파생이 **새 vacuous 경로**를 만든다 — 함께 막았다

import 가 비면(`{}`) `SOT_SYMBOLS` 가 `[]` 가 되고 스캐너는 무엇도 잡지 않으며 주 단언이
조용히 통과한다. 손 목록의 미러 위험을 없앤 대가로 생긴 표면이라 캐너리로 함께 고정했다
(길이 하한 + 핵심 심볼 3종 포함).

### 그리고 파생이 **런타임에 따라 달랐다** — 캐너리가 잡았다

프런트가 RED 를 냈다: vitest(ESM interop)는 `Object.keys` 에 `default` 를 얹고 jest(CJS)는
얹지 않는다. 심볼별 캐너리가 `const default = 1` 이라는 **문법조차 아닌** 픽스처를 만들어
터진 것이다. 모듈 interop 산물(`default`·`__esModule`)과 비-식별자를 걸러 양쪽을 17건으로
맞췄다.

> 손 목록을 파생으로 바꾸는 것이 공짜가 아니라는 실례다 — 미러는 사라지지만 **런타임 의존**과
> **vacuity** 라는 새 표면이 생긴다. 둘 다 캐너리로 닫아야 이득이 남는다.

## WARNING 2 — plan 체크박스가 실제 상태를 반영하지 않았다 (scope/documentation) — **수정**

spec R17 정정을 직전 라운드 처분으로 **이미 집행해 놓고** plan 체크리스트는 `[ ]` 에
"planner 턴 필요" 로 남겨 뒀다. 체크박스는 실제 상태여야 한다. `[x]` 로 바꾸고 별도 planner
턴 대신 `--impl-done` 으로 검증하는 선택을 그 자리에 명시했다.

## 미조치 INFO (10건)

전부 리뷰어 스스로 "조치 불요·범위 밖" 판정. 대표 — `SOT_DIR` 자기 제외 분기가 도달 불가
(방어적 no-op) · 스캔 I/O 2배(의도된 트레이드오프) · 탐지 로직 중복(헤더에 근거 문서화됨) ·
backend 사본의 고정 상대경로 루트 계산 · `prepare` 스크립트 9번째 사본 · `pnpm-lock` 노이즈.

## 작업 중 인프라 사고

e2e 가 `initdb: No space left on device` 로 죽었다. Docker 빌드 캐시가 **43.97GB** 였다 —
정리 후(볼륨은 건드리지 않음) 재실행하여 통과. 코드 결함이 아니다.

## 검증

TEST WORKFLOW 4단계 PASS + ratchet —

| 단계 | 결과 |
| --- | --- |
| lint | PASS (49s) |
| unit | backend jest **431 suites / 8,913 passed**(1 skipped) · frontend **287 files** · 패키지 20 |
| build | PASS (146s) |
| 타입체크 ratchet | **199건 / 38파일 baseline 일치** |
| e2e | PASS (310s) — backend supertest **276** · playwright **51 passed (57.6s)** |

> 두 미러 가드가 **각각 17건**으로 일치한다 — 런타임 차이가 해소됐다는 직접 증거다.
