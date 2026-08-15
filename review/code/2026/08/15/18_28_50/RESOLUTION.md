# RESOLUTION — `18_28_50` (+ consistency `18_29_21`)

ai-review **CRITICAL 0 / WARNING 1** (LOW) · `--impl-done` **BLOCK: NO** (WARNING 6).
**코드 변경 없음** — 전부 spec/plan/CHANGELOG 문서다.

## 가장 중요한 것 — "등재한다" 가 다섯 번째로 거짓이었다 (consistency W3·W7)

**조치 완료.** `eia-terminal-emit-facade.md` 에 `cancelledBy` 정확도 한계를 적으며
*"별도 항목으로 등재한다"* 고 **미래형으로** 썼고, **하지 않았다**(정본 트래커 grep **0건**).

체커 두 명(rationale_continuity · plan_coherence)이 각자 관점에서 지적했고,
plan_coherence 는 *"이 세션 내에서 이미 한 차례 자백한 패턴의 재발"* 이라고 적었다.

**앞선 넷**: "별건 등재됨" 3회(`11_59_09`) · 엔티티 nullability 주석(`13_58_27` W9) ·
실 DB e2e(`16_19_57` W1). **이번이 다섯 번째다.**

패턴이 분명하다 — **유예를 정당화할 때 "등재한다/했다" 를 쓰고, 그 문장을 쓰는 시점에
실제로 등재하지 않는다.** 실제로 등재하고, 그 사실 자체를 항목에 적었다. plan 의 미래형
서술도 *"처음엔 미래형으로만 써 두고 하지 않았다"* 로 정정했다.

## ai-review W1 — 영향 분석을 grep 되는 범위로만 잡았다 (api_contract)

**조치 완료.** CHANGELOG 의 "수신자 영향" 을 **저장소 내 소비자**로만 분석했다. 그런데
이 이벤트는 EIA outbound webhook(§3.3 EIA-NX-02)과 SSE 스트림(§5.2)으로 **외부 제3자
통합사**에게 같은 payload 로 간다 — 실측으로 확인(`notification-fanout.service.ts` 의
화이트리스트에 `execution.cancelled` 존재).

*"저장소 내 소비자는 방어해서 무해"* 라고 썼는데, **외부 통합사는 grep 할 수 없다.**
그 사실을 CHANGELOG 에 명시했다.

> 내가 볼 수 있는 것을 전체 집합으로 취급한 형태다.

## consistency W6 — 예고된 동시 갱신 대상 2곳이 stale (plan_coherence)

**조치 완료.** `cancelledBy` 해소를 *"동시 갱신 대상"* 으로 명시 지목한 두 plan 이
여전히 "미완료" 로 서술하고 있었다.

| plan | 조치 |
|---|---|
| `backend-lint-gate-broken-on-main.md` | 체크박스 `[x]` + 해소 경위(파사드가 컴파일 타임에 드러냄) |
| `spec-draft-eia-notification-payload-contract.md` | 표의 "구현됨(경로 1곳 누락)" → **"구현됨 (전 경로)"** + 취소선 |

## consistency W5·W8

| # | 조치 |
|---|---|
| 5 | `14-external-interaction-api.md` frontmatter `code:` 에 **emitter 등재** — §6 wire 조립을 사실상 전담하게 됐는데 evidence 사슬이 그 파일을 안 가리켰다 |
| 8 | `emitTerminalExecution` vs `emitTerminalExecutionMetrics` 명명 근접 → **등재**. 시그니처가 달라 **컴파일 타임 오용 불가**하고 체커도 "이름 변경 불요" 판정 — JSDoc 상호 참조는 codebase 편집이라 별도 PR |

## consistency W1·W2 — 선존 spec drift

둘 다 **직전 라운드 승계**이며 이번 작업이 만들지 않았다(HMAC 필드명 자기모순 ·
`notification_url_allow_pattern` SoT 미등재). 정본 트래커에 이미 있고 planner 스코프다.

## ai-review INFO 처분

| # | 처분 |
|---|---|
| 1 (`cancelledBy` 정확도) | **W3/W7 로 실제 등재** |
| 4 (`wire` 가 `Record`) | 무조치 — 테스트가 방어. 종결 필드가 늘면 조립부까지 타입 확장 |
| 5 (순환 잔존) | 무조치 — **트래커 등재됨**. 체커도 "정직하게 등재" 로 확인 |
| 6·7 (`durationMs` 분기 중복 · 테스트 스타일 혼재) | 무조치 — 값이 갈릴 위험 없음(순수함수), 다음 편집 때 |
| 8 (죽은 `emitExecution` mock) | 무조치 — 다른 테스트가 여전히 쓸 수 있어 제거는 별도 확인 필요 |
| 9 (`cancelledBy: 'system'` wire 미실측) | 무조치 — 로직이 값에 분기하지 않는다 |
| 2·3·10·11 | 기결정 / positive finding |

## 검증

- 백엔드 **425 suites / 8737 passed** · lint **0** · 타입 **199** · spec 가드 **2942**
- **TEST WORKFLOW 4스테이지 PASS** (최종 커밋 기준, e2e **276**)
- 이 라운드의 편집은 **문서뿐** — 코드 변경 0
