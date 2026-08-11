# Cross-Spec 일관성 검토 — `spec/5-system/14-external-interaction-api.md`

## 검토 범위 메모

이번 라운드는 직전 라운드(`16_51_08`)에서 낸 WARNING(§1.6 미러 미동기)과, 그 라운드의
`plan_coherence` 가 보너스로 잡은 §5.2 stale 서술(2026-07-17 구현 완료 항목을 "미배선(no-op)"
으로 오기)의 처분 결과를 재검증하는 것이 핵심 지시였다. 서술을 신뢰하지 않고 코드·형제 spec을
직접 읽어 판정했다.

## 검증 1 — §5.2 "클라이언트 소비" 정정 서술이 코드와 일치하는가

`spec/5-system/14-external-interaction-api.md:428`의 정정 문구:
> "서버 emit·위젯 리스너(`eia-client.ts`)·**소비 분기가 모두 구현**됐다(2026-07-17). 위젯은 이
> 신호를 받으면 `getStatus` 스냅샷(§5.3)으로 재동기화하며, 신호 자체는 종료가 아니라 스트림·
> 세션을 유지한다 — **단 스냅샷이 이미 terminal 이면** ... 종료를 확정한다"

`codebase/channel-web-chat/src/widget/use-widget.ts`를 직접 읽어 세 주장을 각각 코드로 판정:

1. **`getStatus` 재동기화** — `handleEiaEvent`(L415-463)의 `execution.replay_unavailable` 분기
   (L441-454)가 `seedWaitingFromStatusRef.current?.(client, session, { allowWhileStreaming: true })`
   를 호출하고, `seedWaitingFromStatus`(L686-)는 `client.getStatus(...)`(L694)를 실제로 호출한다.
   **참**.
2. **신호 자체는 종료가 아님** — `handleEiaEvent`의 `replay_unavailable` 분기는 `finalizeEnded`를
   직접 부르지 않는다(L457의 `TERMINAL_EVENTS.includes(name)` 분기와 별개 `else if`). **참**.
3. **스냅샷이 terminal이면 종료 확정** — `seedWaitingFromStatus` L709-712:
   `if ((TERMINAL_EVENTS as readonly string[]).includes(\`execution.${status.status}\`)) { finalizeEnded(...); return "ended"; }`
   가 `getStatus` 응답이 terminal일 때 명시적으로 종료를 확정한다. **참**.

세 주장 모두 코드로 확인됨 — §5.2 정정 서술은 정확하다.

## 검증 2 — §5.2 정정이 `1-widget-app.md §3.1`과 일치하는가

`spec/7-channel-web-chat/1-widget-app.md:99-116`(§3.1 "SSE 재연결" 단락)이 동일한 세 요소
(getStatus 재동기화 · 신호≠종료 · terminal 스냅샷이면 확정)를 같은 근거(`use-widget.ts`
`handleEiaEvent`→`seedWaitingFromStatus`)로 서술한다. 두 문서 표현이 상호 참조(§5.2→§3.1,
§3.1→§5.2/§5.3/R-replay-unavailable)하며 내용 모순 없음. **새 불일치 없음**.

## 검증 3 — §1.6 미러(`3-error-handling.md`)가 SoT(§5.1 표)와 정합하는가

`spec/5-system/3-error-handling.md` §1.6(L157-171, 현재 워크트리 상태)을 재확인:

- `TOKEN_REFRESH_NOT_IN_WINDOW`(400) · `TOKEN_REFRESH_FAILED`(400) · `TOKEN_REFRESH_FORBIDDEN`(403)
  3개 행이 모두 추가되어 있고, `EXECUTION_TERMINATED`(410) 행에 "`refresh-token`에서는 미존재
  execution도 이 코드로 합류" 캐비엇도 반영됨 — §5.1 표·§5.5 서술과 정합.
- `TOKEN_REVOKED`/`SCOPE_MISMATCH`/`AUDIENCE_MISMATCH` 행의 "모든 토큰류 실패는 단일 401" 문구가
  "**검증** 실패" 로 범위가 좁혀졌고, `TOKEN_REFRESH_FORBIDDEN` 행에 "아래 401 통일의 예외"라는
  상호 참조가 붙어 403과 401 문구가 더 이상 서로 모순하지 않는다.
- 같은 수정이 EIA 본문 R14(`14-external-interaction-api.md:1141-1155`)에도 "범위 명확화
  (2026-08-11)" 콜아웃으로 반영되어 있어, 미러(§1.6)·SoT 표(§5.1)·정본 Rationale(R14) 3자리가
  모두 같은 서술로 수렴한다.

(참고: 이 확인 과정에서 워크트리 밖 경로(`/Volumes/project/private/clemvion/spec/...`, main
checkout)를 잘못 읽어 구버전 내용을 본 적이 있었으나, 워크트리 경로
(`.../worktrees/eia-410-gone/spec/...`)로 재확인해 정정 반영을 확인했다 — 파일 자체는 변경되지
않았고 도구 호출 실수였다.)

**§1.6 미러는 SoT와 정합한다.**

## 검증 4 — 같은 클래스("미구현/미배선/계획" stale 서술)가 더 있는가

문서 전체를 대상으로 "미구현/Planned/향후/추후/미배선/no-op/미지원/잔여" 계열 서술을 전수 추출해
각 후보를 코드로 대조:

| 위치 | 서술 | 코드 대조 | 판정 |
|---|---|---|---|
| L1094-1095, L889 | `NotificationFanout`/SSE 어댑터의 다중 인스턴스 Redis pub/sub fan-out "미구현 (Planned)" | `notification-fanout.service.ts`·`sse-adapter.service.ts`에 Redis pub/sub 관련 코드 없음, 주석도 "v1 은 single-instance in-memory — 분산 SSE fan-out 은 follow-up" 그대로 | **여전히 정확** |
| L1254-1256 | `nodeOutput` 일반 키 allowlist "미구현·잔여" | `interaction.service.ts:272` 주석 "`outputData`/`nodeOutput` 키-allowlist 는 별개 잔여 항목" — 실제 allowlist 필터 코드 없음 | **여전히 정확** |
| L632/655 | `expectedCommands` "현재 미구현 문서 필드" | `grep -rn expectedCommands codebase/` 결과 0건(백엔드·채널 코드 어디에도 없음) | **여전히 정확** |
| L734 | `interaction.triggerToken` "현재 JSONB 평문 (향후 secret store 통합 검토)" | `triggers.service.ts`가 `config.interaction.triggerToken`에 직접 값을 저장, `SecretResolver`/`secretRef` 경유 없음(notification.signing.secretRef와 대비) | **여전히 정확** |
| L1302 | 5분 SSE 버퍼 "known limitation (v1 single-instance)" — 재시작 시 in-memory 소실 | 버퍼가 여전히 in-memory(Redis 등 영속화 없음) — 위 fan-out 미구현과 동일 근거 | **여전히 정확** |
| §11 표 L936-938 | `execution.stop`/`execution.start`/`execution.continue`/`execution.step` 외부 미지원(`force` 옵션 포함) | 설계상 won't-do 항목(§4.2 참조) — "아직 안 됨"이 아니라 "의도적으로 안 함"이라 다른 성격 | 해당 클래스 아님 |

`spec/data-flow/15-external-interaction.md`도 함께 grep했으나 §5.2/§5.5류의 stale 미러는
발견되지 않았다.

**추가로 같은 클래스의 stale 서술은 발견되지 않았다.**

---

### 발견사항

이번 라운드에서 신규 CRITICAL/WARNING/INFO 발견 없음. 직전 라운드에서 지적된 §1.6 미러 미동기
WARNING과 §5.2 stale "미배선" 서술은 모두 코드·형제 문서와 대조해 실제로 정정되었음을 확인했다.

### 요약

`spec/5-system/14-external-interaction-api.md`의 §5.2 재동기화 서술(getStatus 재동기화·신호≠
종료·terminal 스냅샷 시 종료 확정) 세 주장을 `use-widget.ts`의 `handleEiaEvent`/
`seedWaitingFromStatus` 구현과 직접 대조한 결과 모두 정확했고, 형제 문서 `1-widget-app.md §3.1`과도
모순 없이 정합했다. `3-error-handling.md §1.6` 미러 카탈로그는 §5.5 refresh 전용 코드 3종
(`TOKEN_REFRESH_NOT_IN_WINDOW`/`TOKEN_REFRESH_FAILED`/`TOKEN_REFRESH_FORBIDDEN`)을 모두 반영했고
401 통일 문구도 검증-실패 범위로 좁혀져 403 예외와 더 이상 충돌하지 않으며, 정본 Rationale
R14에도 같은 범위 명확화가 반영되어 미러·SoT·Rationale 세 자리가 수렴한다. 문서 전체를 "미구현/
Planned/미배선" 계열 키워드로 재훑어 5개 후보(다중 인스턴스 Redis pub/sub fan-out 2곳,
nodeOutput allowlist, expectedCommands 필드, triggerToken 평문 보관, in-memory 버퍼 known
limitation)를 코드로 대조했으나 전부 현재도 실제로 미구현 상태였다 — §5.2/§5.5와 같은 클래스의
추가 drift는 발견되지 않았다. Cross-Spec 일관성 관점에서 이 target 문서는 현재 안정 상태다.

### 위험도
NONE

BLOCK: NO
STATUS: OK
