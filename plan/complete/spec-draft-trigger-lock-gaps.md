---
title: trigger-config advisory lock 이 남긴 planner 범위 — 락 계약 서술 · lock key 등재 · CASCADE 전수 · 각주 시제
status: complete
owner: project-planner
worktree: spec-trigger-lock-gaps-836689
started: 2026-09-17
completed: 2026-09-17
spec_impact:
  - spec/2-navigation/2-trigger-list.md
  - spec/conventions/redis-keys.md
  - spec/5-system/15-chat-channel.md
  - spec/data-flow/11-workflow.md
---

# spec draft — `trigger-config` 락이 남긴 planner 범위 6건

트래커 `plan/in-progress/spec-draft-nullable-notation-followups.md` 의 *"`trigger-config` advisory
lock 이 남긴 planner 범위"* 항목(1·2·3·4·5·5b)을 닫는다. 출처는 `#1334`
(`plan/complete/trigger-config-lost-update.md`)와 `#1341`
(`plan/complete/trigger-lock-followups.md`).

## 착수 전 실측 — 6건 중 **셋이 트래커 문면과 달랐다**

트래커 문면을 처방으로 받지 않고, 각 항목의 전제를 코드·마이그레이션으로 먼저 쟀다.

| # | 트래커 문면 | 실측 | 판정 |
|---|---|---|---|
| 1 | `15-chat-channel.md` 의 `code:` glob 이 `trigger-config-lock.ts` 를 안 문다 → glob 확장 | ① 그 파일의 소비자는 `triggers.service.ts` · `chat-channel-binder.service.ts` · `schedules.service.ts` — **chat-channel 한정이 아니다**. ② **이 락을 서술하는 spec 이 어디에도 없다**(`grep -rn advisory spec/` — Cafe24 기각 선례와 실행 엔진 §8 뿐) | **처방이 좁다.** 서술 없이 `code:` 에만 올리면 게이트는 물지만 대조할 본문이 없다. PATCH·DELETE 계약 소유자(`2-trigger-list.md`)에 **동시성 계약을 서술**하고 그 문서의 `code:` 에 올린다 |
| 2 | `redis-keys.md §4` 에 `trigger-config:<id>` · `exec-cap:<workspaceId>` 등재 | 코드의 `pg_advisory` 호출은 정확히 두 계열. 단 `exec-cap` 키는 **`exec-cap:${workspaceId ?? execution.workflowId}`** 다(`execution-engine.service.ts`) — `workspaceId` 만이 아니다. spec 에 `exec-cap` 은 **0회** | **키 모양이 좁았다** — 대체 규칙까지 적는다 |
| 3 | `15-chat-channel.md §5.4.1.1` 표와 각주가 모순 | 각주는 **과거형**이다(*"구현이 정반대**였다**… 강제**되고 있었다**"*). 현재 코드는 PATCH 에서 `inboundSigningPlaintext`·`inboundSigning` 을 거부한다(`update-trigger.dto.ts` · `chat-channel-rejection-messages.const.ts`) — **표와 일치** | **모순이 아니다.** R-CC-21 이 고친 결함의 이력을 checker 가 현재 동작으로 읽었다. 제품 결정은 필요 없고, 오독되지 않게 **시제를 명시**한다 |
| 4 | advisory lock 키 인벤토리 문서 부재 | 2 와 같은 자리에서 닫힌다 | 2 에 흡수 |
| 5 | 전역 32비트 키 공간 공유 메모 | `hashtext()` 는 int4. 두 계열이 한 공간을 쓴다 | 2 와 같은 자리에 한 문단 |
| 5b | `11-workflow.md §3.1` CASCADE 열거에 `trigger` 가 없다 | `REFERENCES workflow(id)` **전수**(마이그레이션 10건): CASCADE 9 · SET NULL 1. 다이어그램은 CASCADE **5개만** 적는다 — **빠진 것은 `trigger` 하나가 아니라 넷**: `trigger`(→ 2차 `schedule`) · `integration_usage_log` · `alert_rule` · `workflow_test_dataset`. 이후 마이그레이션이 이 FK 들을 바꾼 흔적 0건 | **문면이 좁았다** — 전수로 고친다 |

> **트래커 항목도 «한 칸 좁게» 적혀 있었다.** 5b 는 `#1341` 의 결함이 딛고 선 `trigger` 하나만
> 지목했고, 전수로 세니 넷이었다. 그 목록을 그대로 한 칸 채웠다면 불완전한 목록을 다시
> 내보냈을 것이다.

### 5b 실측 원자료 — `REFERENCES workflow(id)`

| 테이블 | `ON DELETE` | 마이그레이션 |
|---|---|---|
| `node` | CASCADE | `V001__initial_schema.sql` |
| `edge` | CASCADE | `V001__initial_schema.sql` |
| `trigger` | CASCADE | `V001__initial_schema.sql` |
| `execution` | CASCADE | `V001__initial_schema.sql` |
| `workflow_version` | CASCADE | `V001__initial_schema.sql` |
| `integration_usage_log` | CASCADE | `V008__integration_usage_log_and_metadata.sql` |
| `llm_usage_log` | **SET NULL** | `V014__llm_usage_logs.sql` |
| `alert_rule` | CASCADE | `V016__alert_rules.sql` |
| `workflow_assistant_session` | CASCADE | `V019__workflow_assistant.sql` |
| `workflow_test_dataset` | CASCADE | `V097__workflow_test_dataset.sql` |

2차 파급 중 **`schedule`(`schedule.trigger_id` → `trigger` CASCADE, `V001`)만** 적는다 — 락 서술이
그것에 의존한다. `execution` 아래의 2차 이상은 이 draft 범위가 아니며, 표가 «직접 참조만» 임을
본문에 명시한다.

## 변경안

### A. `spec/2-navigation/2-trigger-list.md`

**A1. frontmatter `code:`** — `triggers.module.ts` 행 다음에:

```yaml
  # 시행 코드 — §3 «동시 쓰기 직렬화» 의 트리거 단위 advisory lock. 소비자가
  # chat-channel · notification · EIA · schedules 에 걸쳐 있어, 특정 채널 spec 이 아니라
  # 트리거 PATCH·DELETE 계약 소유자인 이 문서가 문다.
  - codebase/backend/src/modules/triggers/trigger-config-lock.ts
```

**A2. §3** — *"Webhook 인증 자격증명 … 마스킹"* 줄 **다음**, *"응답 형태"* blockquote **앞**에 새 blockquote:

> **동시 쓰기 직렬화 — `trigger.config` 는 트리거 단위 락 안에서 다시 읽고 쓴다.** `config`
> JSONB 를 다시 쓰는 경로(PATCH · Chat Channel setup · bot token 회전 · notification secret
> 정규화·승격 · per-trigger 토큰 폐기)는 Postgres advisory lock
> `pg_advisory_xact_lock(hashtext('trigger-config:<triggerId>'))` 을 잡은 **뒤에** 행을 다시 읽고
> 그 위에 병합한다. 요청 시작 시점의 스냅샷으로 통째로 되쓰면 동시에 커밋된 키가 되돌아간다 —
> 되돌아가는 것이 `chatChannel.inboundSigningRef` 면 인입 서명 검증이 fail-open 된다.
>
> - **외부 provider 호출은 락 밖**이다 — 락 안은 재읽기와 쓰기뿐이다. Cafe24 토큰 갱신이 같은
>   락을 기각한 사유(*lock 보유 중 HTTP 요청이 DB 커넥션 점유를 늘린다*)가 이 설계의 제약이다
>   ([통합 spec §BullMQ `cafe24-token-refresh` 큐](./4-integration.md)).
> - **대기 상한은 삭제에만 있다(5초)** — [§4.4](#44-결과에러).
> - `config` 를 건드리지 않는 **컬럼 한정 갱신**(웹훅 인입의 `lastTriggeredAt`, 스케줄 편집의
>   `name`·`isActive` 동기화 등)은 이 락을 잡지 않는다.
> - **락으로 막을 수 없는 삭제 경로가 있다** — `workflow`·`workspace` 삭제의 FK CASCADE
>   ([§4.3](#43-cascade-동작)). 그래서 락 안에서도 행 부재를 판정한다: 재읽기가 비면 쓰지 않고,
>   병합 쓰기가 **0행에 매치**되면 쓰지 못한 것으로 취급한다(`rotate-bot-token` 은 이때 404).
>
> ⚠️ **실측되지 않은 잔여**: PATCH 의 기본 저장 경로(엔티티 통째 저장)는 ① 재읽기와 저장
> 사이의 CASCADE 창에서의 실패 방식, ② 락 밖 컬럼 한정 갱신과의 경합이 확인되지 않았다 —
> [트래커](../../plan/in-progress/spec-draft-nullable-notation-followups.md) developer 항목 7.

**A3. §4.3 cascade 표** — 첫 행으로:

| 연관 엔티티 | 동작 | 근거 |
|---|---|---|
| **상류** — `workflow`·`workspace` 삭제 | 트리거도 **FK CASCADE 로 함께 삭제**된다(`trigger.workflow_id` · `trigger.workspace_id` 모두 `ON DELETE CASCADE`). schedule 타입이면 아래 `schedule` 행까지 2차로 지워진다. **DB 레벨 삭제라 [§3 동시 쓰기 직렬화](#3-api)의 트리거 단위 락을 거치지 않는다** | `V001__initial_schema.sql` · [data-flow/11-workflow §3.1](../data-flow/11-workflow.md#31-workflowis_active) |

표 **위**에 한 줄(`--spec` INFO#1 — 새 행이 기존 행과 방향이 반대다):

> 이 표는 트리거 삭제의 **하류 영향**과 트리거를 지우는 **상류 원인**을 함께 담는다 — 첫 행이 상류다.

**A4. §4.4** — 마지막 불릿 뒤에:

- **락 대기 상한 5초**: 삭제는 [§3](#3-api) 의 트리거 단위 락을 잡기 **전에** 되돌릴 수 없는 정리를 끝낸다(트리거 화면 삭제는 schedule 타입이면 BullMQ job 해제 → chat channel teardown → secret 삭제, 스케줄 화면 삭제는 BullMQ job 해제). 그래서 락을 5초 안에 못 잡으면 기다리지 않고 **오류로 끝내며**, 그 트리거가 «정리는 끝났는데 행은 남은» 상태라는 사실을 서버 로그에 남긴다.

### B. `spec/conventions/redis-keys.md §4`

**B1. 표에 행 추가** (마지막 행 다음):

| 이름 | 실체 | SoT |
|---|---|---|
| `trigger-config:<triggerId>` · `exec-cap:<workspaceId>` (`workspaceId` 가 없으면 `<workflowId>`) | **Postgres advisory lock 키** — `pg_advisory_xact_lock(hashtext(<키>))` 의 입력 문자열 | [트리거 목록 §3](../2-navigation/2-trigger-list.md#3-api) · [엔진 §8](../5-system/4-execution-engine.md#8-동시-실행-제한) |

**B2. 표 아래 한 문단**:

> **advisory lock 키는 계열이 달라도 한 공간을 쓴다.** `hashtext()` 는 int4(32비트)를 내므로
> 접두어가 달라도 모든 계열이 같은 키 공간을 공유한다. 해시가 충돌해도 결과는
> **과직렬화**(무관한 두 요청이 서로를 기다림)뿐이라 정합성은 깨지지 않는다. 새 계열을 도입하면
> 이 표에 올린다 — 계열이 늘어 불필요한 대기가 관측되면 키 공간 분리를 재검토한다.

**B3. §2 끝에 한 문단** — `--spec` W1 반영:

> **이 절의 주어는 Redis 키(§3 인벤토리)다.** §4 의 Postgres advisory lock 키는 이 판단의
> 대상이 아니다 — 그리고 그중 `exec-cap:<workspaceId>` 는 예외가 아니라 위 조건(워크스페이스별
> 쿼터)에 **정확히 해당하는 사례**다. 워크스페이스 단위 동시 실행 cap 을 직렬화하는 키이기
> 때문이다.

### C. `spec/5-system/15-chat-channel.md §5.4.1.1`

**C1.** 각주 첫머리 `> **(2026-09-10 정합화 — slack/discord 축)**` →
`> **(2026-09-10 정합화 — slack/discord 축 · 해소된 결함의 이력)**`

**C2.** 같은 blockquote 끝(*"v2 회전 후보 결정(아래 불릿)은 손대지 않는다."* 뒤)에 한 문장:

> **현재 구현은 위 표와 일치한다** — PATCH 는 `inboundSigningPlaintext`·`inboundSigning` 을 400
> 으로 거부한다. 이 문단의 과거형 서술이 현재 동작으로 오독돼 «표↔각주 모순» 으로 보고된 적이
> 있어 시제를 명시한다.

원문은 한 글자도 지우지 않는다 — 이력은 이력으로 남는다.

### D. `spec/data-flow/11-workflow.md §3.1`

**D1.** 다이어그램 전이 라벨
`Active --> [*]: workflow 삭제 (CASCADE: nodes/edges/versions/executions/assistant_sessions)` →
`Active --> [*]: workflow 삭제 (FK 파급은 아래 표)`

mermaid 라벨에 긴 열거를 넣지 않는다 — 저장소에 mermaid lint 가 있고, 열거는 표가 SoT 다.

**D2.** 다이어그램 바로 아래 표 + 한 줄:

> **workflow 삭제의 FK 파급** — 마이그레이션의 `REFERENCES workflow(id)` **전수**다. 직접
> 참조만 적고, 2차 파급은 뒤따르는 락 서술이 의존하는 `trigger → schedule` 하나만 적는다.

(위 §5b 실측 원자료 표를 그대로 옮기되, `trigger` 행의 동작 칸을
*"CASCADE — 이어서 `schedule`(`schedule.trigger_id` CASCADE)까지 2차로 지워진다. **DB 레벨이라
트리거 단위 advisory lock 을 거치지 않는다** ([트리거 목록 §4.3](../2-navigation/2-trigger-list.md#43-cascade-동작))"*
로 채운다.)

> **A4 의 정리 목록은 코드 호출 순서 그대로다** — `TriggersService.remove()` 의 락 전 `await`:
> `scheduleRunner.removeJob`(schedule 타입만) → `chatChannelBinder.teardownChatChannel` →
> `secrets.deleteByPrefix`. 처음엔 기억으로 «provider teardown · secret 삭제 · BullMQ 해제» 라고
> 적었는데 **BullMQ 해제는 조건부였고 순서도 맨 앞**이었다.

## 반영 후 검증 — 결과

- **앵커**: `spec-link-integrity.test.ts` **19/19 통과**. GREEN 을 믿지 않고 새 앵커 하나
  (`#44-결과에러`)를 일부러 깨서 **RED(`[ANCHOR] … 2-trigger-list.md:196`) 확인 → 원복**.
- **mermaid**: `lint-mermaid.mjs spec/data-flow/11-workflow.md` exit 0. 라벨을 깨는 뮤턴트
  (`-->> [*]]`)도 exit 0 이었는데, 원인을 재 보니 **lint 는 정상**(flowchart 오류는 exit 1 로
  잡았다)이고 **stateDiagram 문법이 그 텍스트를 관대하게 받아들인다** — 이 문법에서는 무효
  뮤턴트였다. 실제 변경은 라벨 축약이라 파싱 위험이 낮다.
- **트래커**: planner 항목 `[x]` + 6행 완료 표시 + 재배정·실측 차이 주석.

## 반영 전 검증 계획 (원문)

- **앵커는 추측하지 않는다** — `pnpm --filter frontend test src/lib/docs/__tests__/spec-link-integrity.test.ts`
  (CI `spec-link-integrity` 와 같은 명령, 헤딩 slug 까지 검증)
- mermaid 라벨 변경 → `.claude/tools/mermaid-lint`
- 트래커 planner 항목 6행(1·2·3·4·5·5b)에 완료 표시

## Rationale

### 1 을 «glob 한 줄» 이 아니라 «계약 서술 + `code:`» 로 처리한 이유

`code:` 는 «이 spec 을 구현하는 파일» 이다. 락을 서술하는 본문이 없는 문서에 파일만 올리면
`--impl-done` 번들에는 실리지만 **checker 가 대조할 약속이 없다** — 게이트가 문 것처럼 보이지만
검사 대상이 비어 있다. 그리고 트래커가 지목한 `15-chat-channel.md` 는 소비자 셋 중 하나의
소유자일 뿐이다. 이 락은 트리거 `config` 쓰기 전반의 계약이므로 PATCH·DELETE 계약 소유자에
둔다.

**기각한 대안**: ① `15-chat-channel.md` glob 확장만(트래커 문면) — 소비자 범위보다 좁고 본문이
없다. ② 락 전용 규약 문서 신설 — 계열이 둘뿐이고 둘 다 자기 도메인 spec 이 소유자라, 규약이 될
공통 규칙(키 등재·공간 공유)은 `redis-keys.md §4` 한 문단으로 충분하다.

### 3 을 «모순 해소» 가 아니라 «시제 명시» 로 처리한 이유

표와 각주는 서로 다른 시점을 말한다 — 표는 현재 정책, 각주는 R-CC-21 이전 구현의 결함. 코드가
표와 일치함을 확인했으므로 어느 쪽을 고를 결정이 없다. 다만 checker 가 실제로 오독했다는 것은
문면이 그 오독을 허용한다는 증거이므로, 원문을 보존한 채 시제만 명시한다.

### `--spec` 처분 (`review/consistency/2026/09/17/12_25_46` — **BLOCK: NO** · W2)

| # | 처분 |
|---|---|
| W1 `exec-cap:<workspaceId>` 등재가 `redis-keys.md §2`(«워크스페이스 세그먼트를 가진 키는 없다»)·엔진 §9.2 각주와 긴장 | **수용** — B3. 다만 **SoT 인 §2 한 곳만** 고친다. 엔진 §9.2 각주는 주어가 그 절의 Redis 키이고 근거를 §2 에 위임하므로, §2 가 «주어는 Redis 키» 를 명시하면 함께 정합해진다 — 엔진 spec 을 `spec_impact` 에 넣지 않은 이유다. 그리고 `exec-cap` 은 §2 의 **예외가 아니라 §2 가 적은 조건의 사례**다 |
| W2 plan frontmatter `worktree:` 가 full-path | **수용** — bare slug 로. `plan-stale-audit.sh` 가 이중 접두로 오탐한다는 실측이 붙어 있었다. **직전 `#1341` plan 도 full-path 로 적었다** — 이미 `complete/` 로 봉인돼 이 PR 에서 고치지 않는다 |
| INFO#1 §4.3 표에 방향이 반대인 행 | **수용** — 표 위 한 줄 |
| INFO#2 `trigger-config:` ↔ `TriggerConfig` 타입명 인접 | 조치 불요 — 같은 대상 |
| INFO#3 항목 1 을 `2-trigger-list.md` 로 재배정 | 트래커 체크 시 사유 병기 |
| INFO#4 developer 항목 7 의 ⚠️ 승계 | 조치 불요 |

> **번들 누락 보정을 했다.** 이 세션 프롬프트는 `spec_impact` 4문서의 본문을 거의 싣지 않았다
> (`11-workflow.md`·`15-chat-channel.md` 는 5 checker 전부 고유 헤딩 0회). 크기가 아니라 대상
> 선택 문제라, 각 프롬프트 끝에 «대상 4문서를 절대경로로 직접 Read 하라» 는 절을 붙여 돌렸다
> (프롬프트 파일에 남아 있다). cross_spec 은 사실 관계(락 타임아웃·CASCADE 전수·PATCH 차단
> 경로)를 **코드·마이그레이션과 직접 대조해 전부 일치**로 보고했다.

### ⚠️ 잔여를 spec 에 적는 이유

«락 안에서 다시 읽고 쓴다» 만 적으면 PATCH 의 기본 저장 경로도 CASCADE 창에 대해 닫혔다고
읽힌다. `#1341` 은 그 경로의 실패 방식을 **재지 못했다**고 명시하고 등재했다. 계약 문서가
구현보다 넓게 말하지 않도록, 이 저장소가 미구현·미확인 지점에 쓰는 `⚠️` 관례로 한 줄 남긴다.
