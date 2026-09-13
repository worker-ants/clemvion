# RESOLUTION — `--impl-done` 라운드 4 (`review/consistency/2026/09/13/11_33_51`)

**BLOCK: YES · CRITICAL 1 · WARNING 1 · INFO 4.** CRITICAL 해소 완료.

## CRITICAL — 이 PR 이 고치려던 결함이 내가 쓴 줄에서 재발했다

`naming_collision` 이 잡았다. 14명의 code reviewer 는 **아무도 못 잡았고**, consistency
checker 하나가 잡았다.

### 실측 (체커 인용을 그대로 믿지 않고 직접 확인)

| 자리 | 실측 |
|---|---|
| `makeshop.handler.ts:435` | `` throw new Error(`MAKESHOP_UNRESOLVED_PATH_PARAM: operation '…' has unresolved path placeholder(s): …`) `` — **일반 `Error`**, 토큰은 **메시지 접두** |
| `makeshop.handler.ts:359` | `const code = err instanceof IntegrationError ? err.code : 'INTEGRATION_CALL_FAILED';` |
| `makeshop.handler.ts:355-356` 주석 | D4 pre-flight 목록에 `UNKNOWN_OPERATION`/`MISSING_FIELDS`/`INVALID_SHOP_UID` 는 있고 **`UNRESOLVED_PATH_PARAM` 은 없다** |
| 형제 3종 (`:152`·`:190`·`:222`) | `IntegrationError` 의 **첫 인자** → 실제 `.code` 가 맞다 |

즉 `#1330` 이 라운드 3 에 추가한 문장이 **넷째만 틀렸다**. 사용자는 `INTEGRATION_CALL_FAILED`
를 보게 된다.

### 처분 — 옵션 (A) 채택

가이드를 **실제 동작**으로 정정했다(`integrations{,.en}.mdx`). 전용 코드가 없다는 사실과,
어느 자리가 비었는지는 **`message` 의 접두**로 알 수 있다는 것을 `<Callout>` 으로 적었다 —
*"코드가 아니라 메시지를 봐야 한다"*.

옵션 (B)(handler 가 `IntegrationError` 를 던지도록 변경)는 **채택하지 않았다**: 동작 변경 +
`spec/4-nodes/4-integration/*` 편집이 필요해 planner 턴이고, 가이드는 *현재 동작*을 서술하는
문서다. 자매 `CAFE24_UNRESOLVED_PATH_PARAM` 과 함께 트래커에 등재했다.

### 왜 내 가드가 못 잡았나 — 그리고 왜 단순 좁히기가 답이 아닌가

술어가 *"존재"* 이지 *"방출"* 이 아니다. 토큰은 메시지 문자열 안에 실재하므로 통과한다.

체커는 술어를 `.code:`/`IntegrationError(` 위치로 좁히라고 권고했다. **프로브를 돌려 보고
기각했다** — 인용 101종 중 **8종이 새로 RED** 인데 그중 **6이 오탐**이다:

| 새로 RED | 성격 |
|---|---|
| `MCP_CALL_TIMEOUT_MS` · `MCP_MAX_RESPONSE_BYTES` · `SYSTEM_STATUS_DELAYED_THRESHOLD` · `SYSTEM_STATUS_FAILED_THRESHOLD` | **env 변수** — `process.env.X` 접근이라 리터럴이 아니다 |
| `WEBAUTHN_RP_NAME` | env 변수(주석 서술) |
| `ACTION_ROW` | 외부 어휘(Discord 컴포넌트 타입) |
| `CONTAINER_MISSING_EMIT` · `CONTAINER_MULTIPLE_EMIT` | **진짜 같은 클래스** — 선재 문장, 별도 등재 |

좁히면 허용목록이 필요해지고 그건 이 가드가 처음부터 피한 설계다. **방출 위치를 AST 로
특정하는 다른 축**이 필요하며 트래커에 등재했다. 가드 파일 상단에도 *"존재 ≠ 방출"* 한계를
못박아 다음 사람이 과신하지 않게 했다.

## WARNING

| # | 처분 |
|---|---|
| 1 | `4-cafe24.md §6`/`5-makeshop.md §6` 도메인 카탈로그가 `*_UNRESOLVED_PATH_PARAM` 누락 — `spec/**` 이라 developer 권한 밖. 기존 planner 등재 항목의 범위에 포함되도록 트래커에 명시 |

## INFO

| # | 처분 |
|---|---|
| 1 | `MAKESHOP_CALL_FAILED`(MCP 도구) vs `INTEGRATION_CALL_FAILED`(노드) 병존 — 이번 배치 필수 아님, 기록만 |
| 2 | `user-guide-evidence.md` 가드 3→5건 — 이미 등재분(frontmatter 포함) |
| 3 | DTO `nullable` 형태 정리 — pre-existing, 다음에 그 DTO 만질 때 |
| 4 | 명명 원칙 Rationale 명문화 — 이미 등재분, 유실 없음 확인 |

## 검증

CRITICAL 정정 후 frontend 문서 가드 전량 GREEN · `run-test-all.sh` 재실행 예정(라운드 5).
