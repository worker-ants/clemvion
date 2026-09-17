---
title: 창 1 실측 결과를 spec 에 반영 — §3 ⚠️ 교체 · 증거 e2e code 등재 · 0행 404 사유
status: in-progress
owner: project-planner
worktree: spec-window1-measured-544f4f
started: 2026-09-17
spec_impact:
  - spec/2-navigation/2-trigger-list.md
  - spec/5-system/15-chat-channel.md
---

# spec draft — 창 1 실측 결과 반영

트래커 `plan/in-progress/spec-draft-nullable-notation-followups.md` 의 planner 항목
*"창 1 실측 결과를 spec 에 반영한다"* 를 닫는다. 근거 구현은 `#1343`
(`plan/complete/trigger-save-partial-patch.md`) — `TriggersService.update()` 의 저장을 부분 객체로
좁혔고, `codebase/backend/test/trigger-update-save-window.e2e-spec.ts` 가 실제 Postgres·TypeORM 에서
그 근거를 고정한다.

## 착수 전 실측

| # | 전제 | 실측 | 판정 |
|---|---|---|---|
| 1 | §3 ⚠️ 가 «PATCH 의 기본 저장 경로(엔티티 통째 저장)» 를 전제로 ①② 를 «확인되지 않았다» 로 적는다 | `#1343` 이후 창 1 은 `m.save(Trigger, { id, ...patch })` — **부분 객체**. ① CASCADE 창: `workflow` 삭제로 실측, 롤백·부활 없음(통째 23503 / 부분 23502). ② 락 밖 컬럼: 통째 `save` 는 되돌리고 부분 객체는 보존 | ⚠️ 는 **두 겹으로 낡았다** — 전제(통째 저장)와 결론(미확인) 모두 |
| 2 | 증거 e2e 가 `code:` 에 없다 | 현재 `code:` 의 test 경로는 `trigger-workflow-ref.e2e-spec.ts` 하나. 이 문서가 스스로 적은 관례(«e2e 가 고정한다고 적으면서 그 파일을 등재하지 않으면 보장의 근거가 추적 불가») | 등재 |
| 3 | chat-channel §5.4 404 행에 «0행» 사유가 없다 | 행 문면: *"trigger 미존재 또는 워크스페이스 권한 없음 (`triggers.service.ts:122` `findById`)"* | 사유 추가 — 그리고 아래 둘 |

### 3 을 재다가 나온 둘

**(a) «0행이면 404» 는 `rotate-bot-token` 한 곳이 아니다.** `triggers.service.ts` 에서
`rewriteTriggerConfigLocked` 의 `false` 를 404 로 바꾸는 호출부는 둘이다:

| 메서드 | 엔드포인트 | 판정 |
|---|---|---|
| `rotateBotToken` | `POST /api/triggers/:id/chat-channel/rotate-bot-token` | `if (!wrote) this.throwTriggerNotFound()` |
| `revokePerTriggerToken` | `POST /api/triggers/:id/interaction/revoke-token` | `if (!wroteInteraction) this.throwTriggerNotFound()` |

`#1342` 가 §3 에 쓴 괄호 *"(`rotate-bot-token` 은 이때 404)"* 가 한 칸 좁았다. 트래커 항목도
chat-channel §5.4 만 지목했다. `revoke-token` 의 SoT(`14-external-interaction-api.md` EIA-AU-07)에는
**에러 응답 표 자체가 없어** 이 draft 는 그쪽에 표를 만들지 않는다 — §3 괄호에서 둘을 함께 적는
것으로 닫는다.

**(b) 404 행의 `triggers.service.ts:122` 는 이미 낡았다.** `findById` 는 지금 408행이다. 줄 번호
인용은 코드가 바뀔 때마다 낡으므로 **심볼만** 남긴다.

### PATCH 가 CASCADE 창에서 실패하면 무엇이 나가는가 — 코드 판독

창 1 의 `catch` 는 `rethrowEndpointPathConflict` 로, `endpoint_path` UNIQUE 위반만 409 로 바꾸고 나머지는
그대로 던진다. 전역 `GlobalExceptionFilter` 는 `HttpException` · Postgres unique 위반(23505 → 409) ·
`status`/`statusCode` 를 가진 4xx 오류만 매핑하고 나머지는 기본값 **500 `INTERNAL_ERROR`** 다.
23502·23503 `QueryFailedError` 는 `status` 가 없으므로 **500** 으로 나간다. (코드 판독이다 — HTTP 로
재현하지는 않았다. 창을 HTTP 로 여는 방법이 없는 것이 `#1343` 이 ORM 수준에서 잰 이유다.)

## 변경안

### A. `spec/2-navigation/2-trigger-list.md`

**A1. frontmatter `code:`** — `trigger-workflow-ref*.ts` 헬퍼 행 다음에:

```yaml
  # §3 «동시 쓰기 직렬화» 의 저장 근거를 고정하는 특성 테스트 — PATCH 가 **부분 객체**로 저장해야
  # 하는 이유(통째 저장은 락 밖 커밋 컬럼을 되돌린다)와 재읽기 뒤 FK CASCADE 가 시끄럽게 실패함을
  # 실제 Postgres·TypeORM 에서 단언한다. 註가 "실측했다" 고 적는 근거가 이 파일이다.
  - codebase/backend/test/trigger-update-save-window.e2e-spec.ts
```

**A2. §3 불릿 괄호** — `(`rotate-bot-token` 은 이때 404)` →
`(`rotate-bot-token`·`interaction/revoke-token` 은 이때 404)`

**A3. §3 ⚠️ 문단 교체**:

> **PATCH 의 저장은 이 요청이 바꾸는 필드만 싣는다.** 엔티티를 통째로 저장하면 재읽기 **뒤에** 락
> 밖에서 커밋된 컬럼(회전 중인 `notificationSecretV2`, 웹훅 인입의 `lastTriggeredAt` 등)이 재읽기
> 시점 값으로 **되써진다** — 위 «컬럼 한정 갱신은 락을 잡지 않는다» 가 성립하려면 PATCH 가 그 컬럼을
> 싣지 않아야 한다. 재읽기 뒤 FK CASCADE 가 끼어들면 저장은 **실패하고 롤백되어 트리거가 되살아나지
> 않는다**; 전용 에러 코드는 없어 일반 500 `INTERNAL_ERROR` 로 나간다. 두 동작 모두 실제
> Postgres·TypeORM 에서 재현해 고정했다(`workflow` 삭제로 실측 — `workspace` 는 같은 FK 구조라 동일할
> 것으로 보되 따로 재지 않았다).

### B. `spec/5-system/15-chat-channel.md §5.4` 404 행

`| 404 | `RESOURCE_NOT_FOUND` | trigger 미존재 또는 워크스페이스 권한 없음 ([`triggers.service.ts:122`](../../codebase/backend/src/modules/triggers/triggers.service.ts) `findById`) |`
→
`| 404 | `RESOURCE_NOT_FOUND` | trigger 미존재 또는 워크스페이스 권한 없음 ([`triggers.service.ts`](../../codebase/backend/src/modules/triggers/triggers.service.ts) `findById`). **또는 회전 도중 트리거가 삭제돼**(`workflow`·`workspace` 삭제의 FK CASCADE 포함 — advisory lock 으로 막을 수 없다) 락 안 병합 쓰기가 0행에 매치된 경우 — [트리거 목록 §3 «동시 쓰기 직렬화»](../2-navigation/2-trigger-list.md#3-api) |`

## 반영 후 검증

- `spec-link-integrity.test.ts` — 새 앵커 하나를 일부러 깨 RED 확인 후 원복(GREEN 을 믿지 않는다)
- 트래커 planner 항목 `[x]` + 3행 완료 표시 + (a)(b) 기록

## Rationale

### ⚠️ 를 지우지 않고 «동작 서술» 로 바꾼 이유

⚠️ 는 «확인되지 않은 잔여» 를 적은 것이었고 이제 확인됐다. 그러나 확인된 내용 — **PATCH 가 왜
부분 객체로 저장해야 하는가** — 자체가 계약이다. 이 문장이 없으면 다음 사람이 창 1 을 «엔티티 통째
저장» 으로 되돌려도 spec 은 아무것도 어기지 않은 것처럼 보인다. `#1343` 이 그 되돌림을 단위 키 집합
단언과 뮤턴트로 막았으니, spec 은 그 이유를 적어 둔다.

### 500 을 «계약» 이 아니라 «현재 동작» 으로 적는 이유

CASCADE 창의 500 은 설계된 응답이 아니라 매핑이 없어서 나오는 기본값이다. 전용 코드(예: 404 또는
409)로 승격할지는 별 결정이다 — 발생 조건이 좁고(요청 처리 중 부모 워크플로·워크스페이스 삭제)
결과가 롤백이라 정합성은 지켜진다. 여기서는 «지금 무엇이 나가는가» 만 사실로 적는다.

### `revoke-token` 쪽에 에러 표를 만들지 않은 이유

`14-external-interaction-api.md` 의 EIA-AU-07 은 요구사항 행이지 응답 계약 표가 아니다. 거기에
404 사유 한 줄을 넣으려면 에러 표부터 신설해야 하고, 그것은 이 draft 의 범위(트래커 항목)를 넘는다.
§3 괄호가 두 엔드포인트를 함께 적는 것으로 «0행이면 404» 의 적용 범위는 드러난다.
