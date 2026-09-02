# Consistency Check 통합 보고서

**BLOCK: YES** — Critical 발견 1건(cross_spec)이 있어 호출자가 차단해야 함

## 전체 위험도
**HIGH** — draft 의 핵심 설계 결정(서버발신 `auth.token_expired` + 60초 후 강제 `disconnect()`)이 동일 spec 문서(§6.1/§9.2)의 기존 클라이언트 재연결 계약, 그리고 그 계약을 구현한 실제 프론트엔드 코드와 충돌한다. 나머지 4개 checker(rationale_continuity/convention_compliance/plan_coherence/naming_collision)는 CRITICAL/WARNING 없이 INFO 수준 보완 제안만 남겼다.

## Critical 위배 (BLOCK 사유)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | cross_spec | `disconnect()` 후 클라이언트 자동 재연결이 실제로는 발화하지 않음 — draft 의 핵심 Rationale("끊김이 보이지 않는다")이 기존 재연결 계약·구현과 충돌. Socket.IO 는 서버발신 `disconnect()`(reason `"io server disconnect"`)에 대해 클라이언트 자동 재연결을 발화하지 않는다. `ws-client.ts` 에는 일반 `disconnect` 리스너가 없고, `auth.token_expired` 구독 코드가 프론트 전체에 0건이며, 유일한 소켓 재생성 호출부(`workflow-editor.tsx:65~70`)는 `useEffect` deps `[]`(mount 1회)라 재호출되지 않는다. `use-execution-events.ts` 는 disconnect 시 재연결 대신 10초 뒤 `duration: Infinity` 영구 toast 만 띄운다(1192~1196행 주석이 이 실패 모드를 이미 한 번 겪은 회귀로 명시) | `plan/in-progress/spec-draft-ws-socket-lifetime-binds-token.md` §결정(37~61행), §구현 메모(109~113행), 변경표(87~107행, §9.2·§6.1 미포함) | `spec/5-system/6-websocket-protocol.md` §6.1(951~962행, "재연결은 Socket.IO 클라이언트 내장 reconnection 에 위임") · §9.2(1042~1050행, `connect_error` 만 재연결 트리거로 규정) + `codebase/frontend/src/lib/websocket/ws-client.ts` + `codebase/frontend/src/lib/websocket/use-execution-events.ts` | 다음 중 하나를 target 문서에 명시하고 변경표에 반영: (1) §9.2 에 `auth.token_expired` 수신 시 60초 창 안에 REST refresh + `socket.auth.token` 교체 + 명시적 `socket.connect()` 를 수행하는 정식 클라이언트 계약 스텝 추가(구현 메모의 developer 범위에도 포함), (2) §6.1 에 "서버발신 `disconnect()`(`auth.token_expired` 포함)는 자동 재연결 대상이 아니며 클라이언트가 명시적으로 재연결해야 한다"는 예외 명문화, (3) fallback 으로 사전 통지를 놓친 경우 대비 `disconnect` 이벤트 reason 확인 후 재연결하는 경로 별도 명시 |

## planner 인계 (권한 밖 Critical)

(없음) — target 자체가 project-planner 가 작성 중인 spec draft(`plan/in-progress/spec-draft-ws-socket-lifetime-binds-token.md`)이며, 이 Critical 은 그 draft 를 spec 에 적용하기 전에 draft 본문(§9.2/§6.1 변경표)을 보완하면 해소된다. 호출자(project-planner) 권한 범위 안의 조치이므로 별도 인계 대상 없음.

## 경고 (WARNING)

(없음)

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | cross_spec | 변경표 항목 7 의 인용 줄번호(`:23`)가 가리키는 문구("developer 권한 밖…")는 실제로 `:49` 에 있음 | `spec-draft-ws-socket-lifetime-binds-token.md:105` → `spec-sync-websocket-protocol-gaps.md:23` | `:23` 을 `:23~49`(블록 범위) 또는 문구 실제 위치 `:49` 로 정정 |
| 2 | rationale_continuity | `expiresAt` payload 필드의 wire 형식(ISO8601 vs epoch) 미명시 | `## 결정` · `### payload 를 { message } → { message, expiresAt } 로` | spec 본문 작성 시 `expiresAt: string`(ISO8601) 명시, 가능하면 6-websocket-protocol.md 의 기존 ISO8601 통일 Rationale 을 cross-ref |
| 3 | rationale_continuity | 신설 per-socket 타이머의 분산/재시작 내성에 대한 명시적 언급 부재 (이웃 spec 의 반복 관심사 R10/R15/R19 에 답하지 않음) | `## 결정` · `## 구현 메모` | "이 타이머는 소켓 프로세스에 로컬이라 재시작 시 소켓 자체가 끊기고 클라이언트가 새 handshake 로 새 타이머를 받는다 — R10/R15/R19 가 우려하는 다중 인스턴스 분산 불일치 클래스가 아니다" 한 문장 추가 |
| 4 | rationale_continuity | `spec/5-system/4-execution-engine.md`·`1-auth.md`·`data-flow/2-auth.md` Rationale 이 예산 초과로 이번 회차에서 미확인 | 문서 전체 | 별도 회차에서 `--spec` 예산을 위 파일로 좁혀 access token 재발급/세션 관리 invariant 유무 재확인 권장. BLOCK 사유 아님 |
| 5 | convention_compliance | `worktree:` frontmatter 값이 `plan-lifecycle.md §4` 문면(디렉토리 이름만)을 벗어난 `(branch …)` 복합 표기 | frontmatter `worktree:` | 기능 영향 없음(파서는 첫 공백까지만 캡처). 반복될 의도라면 `plan-lifecycle.md §4` 에 복수 draft 공유 worktree 부기 허용 규정 한 줄 추가 권장 |
| 6 | plan_coherence | 변경안 표에서 frontmatter `pending_plans:` 갱신 여부가 명시되지 않음(형제 draft 는 명시) | `## 변경안` 표, frontmatter 행 | frontmatter 행에 `pending_plans` 도 "변경 없음"으로 명시해 spec 적용 시 실수로 건드리지 않는다는 근거를 문서에 남기기 |
| 7 | naming_collision | `expiresAt` 필드가 `auth.refreshed.expiresAt`(새 토큰 만료 시각)과 `auth.token_expired.expiresAt`(연결 끊길 시각)로 의미가 다른 두 이벤트에 동일 이름으로 쓰임 — 이름 충돌 아님, 관례 준수 | §4.6 표 `auth.token_expired` 행 | 별도 조치 불필요. §4.6 표의 `expiresAt` 설명에 "이 소켓이 끊기는 시각" 임을 한 번 더 명시하면 충분 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | HIGH | 서버발신 disconnect 후 클라이언트가 자동/명시적으로 재연결하지 않아 draft 의 핵심 목표("끊김 안 보임")가 실패하고 영구 경고 toast 회귀가 발생(CRITICAL 1건) |
| rationale_continuity | LOW | INFO 3건(ISO8601 형식 미명시, 분산 내성 서술 공백, 컨텍스트 절단으로 인한 미확인 영역) — CRITICAL/WARNING 없음 |
| convention_compliance | NONE | 명명·문서 구조·frontmatter 스키마 전부 규약 준수, INFO 1건(worktree 부기 표기)만 |
| plan_coherence | NONE | 트래커 미해결 결정을 정확히 겨냥해 해소, 라인 참조 전수 실측 일치, INFO 1건(pending_plans 명시 누락)만 |
| naming_collision | NONE | 신규 식별자(`expiresAt` 필드, `R-ws-socket-lifetime-binds-token`) 모두 충돌 없이 기존 관례 준수 |

## 권장 조치사항
1. **(BLOCK 해소 우선)** `spec-draft-ws-socket-lifetime-binds-token.md` 의 변경표·구현 메모에 클라이언트 재연결 계약을 명문화 — §9.2(또는 §6.1)에 `auth.token_expired` 수신 시 사전 통지 창 안에서 REST refresh + `socket.auth.token` 교체 + 명시적 `socket.connect()` 를 수행하는 스텝을 추가하고, 이를 developer 구현 메모 범위(현재 백엔드 타이머 항목만 나열)에도 포함시킨다. fallback 으로 통지를 놓친 경우의 재연결 경로도 함께 명시할 것을 권장.
2. 변경표 항목 7 의 인용 줄번호(`:23` → `:49` 또는 `:23~49`)를 정정한다.
3. `expiresAt` 필드의 wire 형식(ISO8601)을 spec 본문에 명시한다.
4. 신설 타이머의 재시작/분산 내성에 대한 한 문장 근거를 Rationale 에 추가한다.
5. 변경표 frontmatter 행에 `pending_plans` 변경 없음을 명시한다.
6. (선택) `worktree:` frontmatter 복합 표기를 `plan-lifecycle.md §4` 에 반영하거나 표준 단일 값으로 정리한다.