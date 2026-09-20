---
title: 트리거 동시 DELETE 도 감사 행을 두 번 남긴다 — 락 안에서 행이 아직 있는지 본다
status: in-progress
owner: developer
worktree: trigger-dup-delete-3f7a92
started: 2026-09-20
spec_impact: none
---

# `TriggersService.remove()` — 트리거·워크플로·워크스페이스 세 자리 중 마지막

트래커 `plan/in-progress/spec-draft-nullable-notation-followups.md` 의 developer 항목
«`TriggersService.remove()` 도 동시 삭제에서 감사 행을 두 번 남길 수 있다» (2026-09-20 등재 ·
`/ai-review` `review/code/2026/09/20/21_07_19` requirement WARNING 1)를 닫는다.

**이 항목이 생긴 경위가 중요하다.** 직전 PR(`plan/complete/dup-delete-audit.md`)이 워크플로·워크스페이스를
고치며 «트리거는 이미 spec §4.4 대로 두 번째 요청에 404 를 준다» 를 **선례로 인용**했는데, 리뷰가 그것이
**spec 서술이지 코드 실측이 아님**을 짚었다. 읽어 보니 같은 형태였다 — 이 PR 이 그 인용을 사실로 만든다.

> **정정 (`/ai-review` `review/code/2026/09/20/22_07_23` requirement WARNING 2)**: 위 제목과
> 커밋 메시지가 «네 삭제 경로 중 마지막 한 자리 / 네 자리 완결» 이라 적었던 것은 **틀렸다**.
> 네 번째 자리인 `SchedulesService.remove()` 자신의 스케줄 행 삭제(`this.scheduleRepository.remove(schedule)`,
> `schedules.service.ts:345`)는 advisory lock 도 재조회(`!fresh`) 가드도 거치지 않고 트랜잭션
> **밖**에서 불린다 — 동시 삭제 시 `SCHEDULE_DELETED` 감사가 이 PR 이 트리거에서 고친 것과 같은
> 형태로 두 번 남을 수 있다(코드를 직접 읽어 확인, 재현 e2e 는 아직 없음). 실제로 이 PR 이 닫는 것은
> **트리거·워크플로·워크스페이스 세 자리**뿐이다. 스케줄 자신의 잔여는
> 트래커의 새 developer 항목(«`SchedulesService.remove()` 도 동시 삭제에서 감사 행을 두 번 남길 수
> 있다»)으로 등재했다.

## A. 결함 — advisory lock 은 줄을 세우지만, 줄 앞에서 «아직 있나» 를 묻지 않는다

`TriggersService.remove()` 의 순서:

1. `findById(id, workspaceId)` — **잠금 없음**. 동시 두 요청이 모두 통과한다.
2. `resourceReleaser.releaseExternal(trigger)` — schedule job · provider teardown · listener 해제
   (트랜잭션 밖, 되돌릴 수 없다).
3. 트랜잭션: `acquireTriggerConfigLock(m, id, { timeoutMs: TRIGGER_DELETE_LOCK_TIMEOUT_MS })` →
   `m.remove(trigger)`.
4. `releaseSecretsAfterCommit([id])` → `recordAudit(TRIGGER_DELETED)`.

3의 락은 `pg_advisory_xact_lock(hashtext('trigger-config:<id>'))` 이라 **두 요청을 직렬화하기는 한다**.
그러나 락을 얻은 뒤 **행이 아직 있는지 보지 않는다** — `m.remove(trigger)` 는 이미 없는 PK 에 0행이어도
던지지 않으므로, 진 쪽도 성공으로 끝나며 `trigger.deleted` 를 한 번 더 남긴다.

> 워크플로·워크스페이스와 **다른 점 하나**: 그쪽은 `pessimistic_write` 행 락이라 «잠그며 읽는» 조회가
> 이미 있었고 그 결과를 돌려주기만 하면 됐다. 여기는 advisory lock 이라 행을 읽지 않는다 — **명시적인
> 재조회 한 번**이 필요하다.

## B. 처방 — 락 뒤에 재조회, 없으면 404

```
[락 밖]  외부 자원 해제 (되돌릴 수 없다)
[락 안]  advisory lock (trigger-config:<id>)
         행이 아직 있는지 **다시 읽는다**   ← 새로 넣는 것
         없으면 404(RESOURCE_NOT_FOUND) — 트랜잭션 롤백, 감사·비밀 정리 없음
         있으면 remove
```

- `m.remove(trigger)` 는 그대로 둔다 — `m.delete()` 로 바꾸면 `affected` 로 판정할 수 있지만 TypeORM 의
  엔티티 제거 경로가 달라진다. 직전 PR 이 세운 형태(«재조회 → 404»)와 같게 두는 편이 네 자리의 공용 형태
  설계에 유리하다.
- `.catch` 의 «반쯤 삭제된 상태다 · 수동 정리가 필요하다» error 로그에서 `NotFoundException` 을 가른다 —
  동시 삭제로 행이 사라진 것은 그런 상태가 아니다(먼저 커밋한 요청이 행도 자원도 정리했다). 직전 PR 이
  두 경로에 넣은 것과 같은 한 줄이다.

## C. 재현을 먼저 한다 — 읽기로 얻은 결론이므로

이 결함은 **읽어서** 찾았다. 트래커 항목 자체가 «재현은 그 항목이 한다» 고 적었으므로, **고치기 전에
e2e 로 먼저 재현**한다(RED 를 보고 나서 고친다).

겹침은 테스트가 만든다 — 직전 두 PR 과 같은 기법이되 **행 락이 아니라 같은 advisory lock** 을 쥔다:

```sql
BEGIN;
SELECT pg_advisory_xact_lock(hashtext('trigger-config:<triggerId>'));
-- DELETE 두 건 발사 → 둘 다 3에서 대기
COMMIT;  -- 1.5초 안에 (삭제 경로의 lock_timeout 이 5초다)
```

- **대기 상한이 판정에 끼어든다**: 락을 5초 넘게 쥐면 두 요청 모두 lock timeout 으로 실패해 fixture 가
  «겹침» 이 아니라 «둘 다 실패» 를 본다. 공허성 가드의 대기는 1.5초로 둔다.
- 단언: 상태쌍 `[204, 404]`(현행은 `[204, 204]`) + `audit_log` 의 `trigger.deleted` 가 **1건**.

## 이 PR 이 하지 않는 것

- **외부 해제 중복**(2번)은 그대로 둔다 — 두 요청 모두 락 밖에서 부르므로 teardown 이 두 번 돈다.
  멱등 전제는 직전 PR 들과 같고, 고치려면 해제를 락 안으로 옮겨야 하는데 그러면 외부 호출이 락 안에
  들어간다(`trigger-config-lock.ts` JSDoc 이 금지한 형태). 신규 e2e 는 chatChannel 없는 webhook
  트리거만 써서 이 경로(provider teardown 중복)를 **의도적으로 피해** 커버하지 않는다 — 트래커의
  «트리거 자원 정리의 사후 정리(sweeper) 필요 여부 재판단» 항목이 이 중복을 새 불릿으로 받는다
  (`/ai-review` `review/code/2026/09/20/22_07_23` side_effect·concurrency WARNING 1).
- **네 자리 공용 헬퍼 추출**은 하지 않는다 — 트래커의 «네 자리 공용 형태» 설계 항목이 그 자리다.
  이 PR 은 네 번째 자리를 **같은 형태로 맞추는 것**까지만 한다(그 설계의 입력이 된다).
- `spec/2-navigation/2-trigger-list.md` §4.4 의 «구현 검증 대기» caveat 은 planner 몫이다 — 이 PR 이
  §4.4 를 사실로 만들면 그 caveat 자체가 불필요해진다. 트래커의 planner 항목에 그 사실을 적는다.

## 체크리스트

- [x] `/consistency-check --impl-prep spec/2-navigation` — `review/consistency/2026/09/20/21_43_47` **BLOCK: NO**
  (Critical 0 · Warning 0 · INFO 3). INFO 1(세 checker 수렴)은 «§4.4 가 caveat 없이 단정하는데 코드가 아직
  그렇지 않다» 로, **이 PR 이 닫으면 자연 해소**된다. 종결 시 트래커의 그 planner 항목에서 (b) 만 집어
  «실측 완료 — caveat 불요» 로 처분하고 (a)(문서 대칭)는 남기라는 권고도 따른다
- [x] **e2e 로 결함 재현** — `[204, 204]` 로 RED 였고, 그 상태의 DB 를 직접 조회해 `trigger.deleted` 가
  **한 `resource_id` 에 2건**임을 확인했다. 읽기로 찾은 결론을 값으로 본 것이다
- [x] 단위 테스트 + 구현 — 락 안 재조회 + `.catch` 의 404 분리. 뮤턴트 둘이 **각각 그 테스트만** 죽인다
  - **첫 뮤턴트는 무효였다**: `const fresh = await m.findOne(Trigger, {` 로 잘랐더니 같은 문자열이
    `update()` 에도 있어 **440줄이 통째로** 지워졌고 116건이 실패했다. 그 숫자를 «판별력» 으로 읽었으면
    거짓 확신이 됐다 — 고유 주석을 앵커로 다시 만들어 **180자만** 지운 유효 뮤턴트로 재측정했다
- [x] TEST WORKFLOW — lint PASS · unit PASS · build PASS · **e2e 370 PASS**
- [ ] `/ai-review` → 수렴
- [ ] `/consistency-check --impl-done spec/2-navigation` → BLOCK: NO
- [ ] 트래커 항목 해소 + 이 plan `plan/complete/` 로
