---
title: rotate 가 옛 스냅샷 위에 덮어 먼저 통과한 교체를 잃는다 — 같은 모듈의 락 선례(CONC H-3)로 닫는다
status: in-progress
owner: developer
worktree: rotate-lost-update-4a1c73
started: 2026-09-20
spec_impact: none
---

# 동시 rotate 의 lost update

트래커 `plan/in-progress/spec-draft-nullable-notation-followups.md` 의 developer 항목
«동시 rotate 두 건은 나중 저장이 먼저 통과한 교체를 조용히 덮는다»
(`/ai-review` `review/code/2026/09/19/15_30_04` database WARNING 1 (a) · `16_00_06` concurrency WARNING 3)를 닫는다.

## A. 결함 — 읽은 스냅샷 위에 머지한다

`IntegrationsService.rotate()` 는 읽기 → merge → **연결 테스트** → `update` 다. 머지의 base 가 **읽은 시점의
`entity.credentials`** 이고, 그 뒤로 다시 읽지 않는다:

```ts
const baseCreds = isUnreadableCredentials(entity.credentials) ? {} : entity.credentials;
const merged = { ...baseCreds, ...body.credentials };   // ← base 가 여기서 고정된다
await this.dispatchTest(...);                            // ← 수 초 (실제 접속)
await this.integrationRepository.update({ id: entity.id }, { credentials: merged, ... });
```

그래서 A·B 가 겹치면 **둘 다 200 을 받고**, 나중에 커밋한 쪽의 옛 base 가 먼저 커밋된 값을 되돌린다 — 사용자는
자기 교체가 저장됐다고 믿는다. 창이 길어진 것은 2026-09-19 부터다(Database · HTTP 연결 테스트가 구조 검증에서
**실제 접속**으로 바뀌며 밀리초 → 수 초).

## B. 처방 — 외부 호출은 락 밖, 락 안에서 **다시 읽어** 머지

**같은 모듈에 선례가 있다.** `integration-oauth.service.ts` 의 재인증 콜백(`CONC H-3`, 2026-05-16)은 provider 토큰
교환을 마친 **뒤** `dataSource.transaction` 안에서 `lock: { mode: 'pessimistic_write' }` 로 행을 다시 읽고 쓴다.
그 주석이 근거까지 적는다 — «READ COMMITTED 에서 두 트랜잭션이 같은 row 를 동시 read → save 하면 last-write-wins 로
한쪽 토큰이 사라진다». **rotate 는 그 함수와 하는 일이 같다**(자격증명 교체). 형태도 같다 — 외부 호출이 먼저, 쓰기가 뒤.

```
[락 밖]  연결 테스트 (수 초, 실제 접속)
[락 안]  transaction + SELECT … FOR UPDATE
         자격증명을 **지금** 다시 읽는다      ← 스냅샷을 버린다
         그 위에 body.credentials 를 머지
         구조 검증(validateCredentials) 재실행 — 순수 함수
         부분 update
```

`trigger-config-lost-update.md`(2026-09-15)가 같은 처방을 «외부 호출은 락 밖, 락 안에서 재읽기» 로 일반화했다.

### `--impl-prep` 이 요구한 경계 셋 (`review/consistency/2026/09/20/16_58_56`, BLOCK: NO · W2)

- **(W1) 이것은 기각된 advisory lock 의 재도입이 아니다.** `4-integration.md` 의 Rationale 이 cafe24 토큰 갱신에서
  `pg_advisory_xact_lock` 을 기각한 사유는 «lock 보유 중 HTTP 요청을 transaction 안에 묶어야 해 DB 커넥션 점유가
  늘어난다» 였다. 여기서는 **연결 테스트가 트랜잭션 밖**이고 락은 **row-level `pessimistic_write`** 다 — 그 사유가
  적용되지 않는다. 같은 문장을 `rotate()` 의 락 블록 주석에도 적는다.
- **(W2) 이 PR 은 `INTEGRATION_TEST_FAILED` 의 상태 코드·세분성을 바꾸지 않는다** — 400 vs 422 불일치는 트래커의
  **별도 열린 planner 항목**이다. 같은 함수 안에 있다고 딸려 고치지 않는다.
- **(INFO 2) 락 대기 상한은 두지 않는다** — `CONC H-3` 과 같다. 임계 구간에 외부 호출이 없어 대기는 다른 rotate 의
  «재읽기 + 머지 + UPDATE» 만큼이고(밀리초), 타임아웃을 두면 그 자체가 새 실패 모드 · 새 에러 코드를 부른다 —
  이 PR 이 피하려던 바로 그 비용이다.

### 부분 `update` 는 유지한다

락 안에서도 `save(entity)` 가 아니라 **바꾸는 컬럼만 `update`** 한다. `logUsage` 는 이 락을 잡지 않으므로 재읽기
직후에도 `last_used_at` 을 쓸 수 있고, 전체 `save` 는 그 값을 재읽기 시점 값으로 되돌린다 — 현행 주석이 지키는
불변식이다.

### 남는 것을 정직하게 적는다 — «테스트한 조합» 과 «커밋하는 조합» 이 갈릴 수 있다

테스트는 **락 밖**에서 옛 base 위 머지로 돌았고, 커밋은 **새 base** 위 머지다. 두 rotate 가 **서로 다른 필드**를
바꾸면(A 는 `password`, B 는 `username`) 최종 조합은 누구도 테스트하지 않은 조합이 된다. 그럼에도 이 처방을 택하는
이유:

- 지금은 그 경우 **먼저 커밋된 필드가 옛 값으로 되돌아간다** — 조용한 유실이고, 더 나쁘다.
- 같은 필드를 겹쳐 바꾸는 흔한 경우는 최종 값이 **그 요청이 테스트한 값**이다.
- 대안(충돌 감지 → 409)은 **새 에러 코드 · spec 계약 · UI 문구 · 지역화**를 요구한다. 아래 §C.

## C. 왜 «409 충돌» 이 아닌가 — planner 턴을 열었다가 접은 기록

처음엔 이것을 계약 문제로 보고 planner draft(`plan/complete/spec-draft-rotate-conflict.md`)를 썼다 —
`INTEGRATION_ROTATE_CONFLICT` (409) 신설. `/consistency-check --spec`(`review/consistency/2026/09/20/16_43_05`)이
**BLOCK: YES** 로 그 판단을 세 군데서 반증했다:

1. **(Critical)** `2-navigation/4-integration.md` 는 `status: implemented` 다 — 미구현 계약을 얹으면
   `spec-impl-evidence.md` 규약상 `status: partial` 로 낮추고 `pending_plans` 를 달아야 한다. 즉 «계약 먼저, 구현
   나중» 이 spec 상태를 되돌리는 값을 치른다.
2. **(WARNING 5)** 이 저장소는 **같은 형태를 이미 락으로 닫았다**(`trigger-config-lost-update.md`). 그 이력을 검토도
   없이 건너뛴 기각이었다.
3. **(WARNING 3)** 내가 «범용 conflict 코드가 없다» 고 적은 실측이 **과잉 일반화**였다 — `GlobalExceptionFilter` 의
   409 기본값 `RESOURCE_CONFLICT` 와 선례 `WORKFLOW_VERSION_CONFLICT`(동시 캔버스 저장 경합, 재시도 권고)를 놓쳤다.
   `code: '…'` 리터럴만 grep 해서 **필터가 만드는 층**을 못 본 것이다.

세 번째는 409 결론 자체를 뒤집지는 않는다(`api-convention.md §5.3` 상 명시 코드가 규약이다). 뒤집은 것은 **1 과 2** 다 —
코드로 닫을 수 있는 것을 계약으로 닫으면 spec 상태를 낮추고 UI·지역화까지 끌고 온다. draft 는 산출물로 남긴다.

> 그래서 이 PR 의 `spec_impact` 는 `none` 이다. rotate 의 외부 계약은 바뀌지 않는다 — 성공은 그대로 200 이고,
> 달라지는 것은 **무엇 위에 머지하는가** 뿐이다.

## D. 함께 보는 것 — 락 안에서 권한도 다시 본다

`scope === 'organization'` 이면 admin 만 회전할 수 있다(현행). 그 판정도 **옛 스냅샷**으로 한다 — 테스트가 도는 동안
`scope_changed` 로 personal → organization 이 되면 비-admin 의 교체가 통과한다. 재읽기가 이미 있으므로 그 자리에서
한 번 더 본다(한 줄).

## 체크리스트

- [x] `/consistency-check --impl-prep spec/2-navigation` — `review/consistency/2026/09/20/16_58_56` **BLOCK: NO**
  (Critical 0 · Warning 2 — 둘 다 위 §B 에 반영)
- [x] 테스트 선작성 — 단위 셋 전부 RED 확인 후 구현. 뮤턴트 셋(옛 base 로 머지 · 락 옵션 제거 · 권한 재확인 제거)이
  **각각 한 테스트만** 죽였다(표면이 겹치지 않는다)
- [x] 구현
- [x] TEST WORKFLOW — lint PASS · unit PASS(14 suite wrapper 집계) · build PASS · **e2e 367 PASS**.
  e2e 판별력은 «고치기 전» 으로 실증했다: `origin/main` 의 서비스 파일로 되돌려 이미지를 다시 빌드하니
  `key_name` 이 `X-Concurrent` → `X-Api-Key` 로 **되돌아가며 RED**, 고친 코드로는 GREEN.
  - **덤으로 main 의 red 를 고쳤다** — 직전 PR(#1367)이 `plan/complete/` 에 넣은 draft 의 `title:` 안에 `code:` 가
    들어가 YAML 이 깨져 Gate C(`spec-plan-completion.test.ts`)가 실패하고 있었다. 따옴표로 감쌌고, `plan/**` 587건을
    전수 스캔해 남은 파싱 실패 0건을 확인했다
- [ ] `/ai-review` → Critical/Warning 0
- [ ] `/consistency-check --impl-done spec/2-navigation` → BLOCK: NO
- [ ] 트래커 항목 해소 + 이 plan `plan/complete/` 로
