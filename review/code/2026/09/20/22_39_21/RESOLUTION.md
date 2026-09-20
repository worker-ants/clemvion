# RESOLUTION — 트리거 동시 DELETE 감사 중복 (리뷰 2라운드)

1라운드(`review/code/2026/09/20/22_07_23`)의 Warning 5건을 조치한 뒤 돌린 **fresh 라운드**.
결과: **Critical 0 · Warning 2** — 둘 다 조치했다.

## 조치 항목

| SUMMARY # | 발견 | 조치 |
|---|---|---|
| WARNING 1 (testing) | 락 안 재조회의 **`workspaceId` 스코프를 아무도 단언하지 않는다** — 그 조건이 빠지면 다른 워크스페이스의 같은 id 를 «있다» 로 읽어 인가가 새는데, 값만 보는 mock 은 그 회귀를 GREEN 으로 통과시킨다 | 공용 mock 의 `freshFindOne` 이 **호출 인자(`findOptions`)를 받도록** 고쳐 `freshFindOptions` 로 노출하고, 404 테스트에서 `where: { id, workspaceId }` 를 단언했다 |
| WARNING 2 (documentation) | plan 이 스스로 약속한 «§4.4 가 사실이 되면 트래커 planner 항목 (b) 에 그 사실을 적는다» 가 이행되지 않았다 | 트래커의 (b) 를 **취소선 + «2026-09-20 처분: caveat 불요»** 로 갱신했다(실측값 인용: 고치기 전 `[204,204]`·감사 2건 → 고친 뒤 `[204,404]`·1건). **(a)(문서 대칭)는 그대로 열어 뒀다** — 1라운드 impl-prep 이 «(b)만 집어 처분하고 (a)는 남기라» 고 권고한 그대로다 |

INFO 10건은 조치 불요이거나 이미 등재됐다 — 외부 teardown 중복(plan·CHANGELOG·트래커 3곳에 명시) ·
`SchedulesService.remove()` 잔여(1라운드에서 등재) · e2e 스캐폴드 3중 반복(공용 헬퍼 추출은 명시적 유예).

## TEST 결과

- lint : 통과 (prettier 지적 1건 수정 후)
- unit : 통과
- build : 통과
- e2e : **통과 370/370**

### 뮤테이션 검증 — 새 단언이 인가 회귀를 잡는가

락 안 재조회의 `where` 에서 `workspaceId` 를 뺀 뮤턴트(`cp` 백업, `git checkout` 미사용):

```
Tests: 1 failed, 1 skipped, 164 passed, 166 total
```

**새 단언 하나만 RED** 다 — 나머지 164건은 그 인가 누수를 못 본다. 원복 후 다시 GREEN.

> 이 PR 에서 뮤턴트 유효성을 한 번 놓쳤던 것을 기록해 둔다: 1라운드 때 `const fresh = await m.findOne(Trigger, {`
> 로 자른 첫 뮤턴트가 같은 문자열이 `update()` 에도 있어 **440줄**을 지웠고 116건이 실패했다. 그 숫자는
> 판별력이 아니었다 — 고유 앵커로 다시 만들어 180자만 지운 뒤에야 «그 테스트 하나만 죽는다» 가 나왔다.

## 보류·후속 항목

- (INFO 2) `SchedulesService.remove()` 의 같은 형태 — 1라운드에서 트래커에 등재했다.
- (INFO 1) 외부 provider teardown 중복 — 세 문서에 명시된 기존 잔여.
- (INFO 6, 선택) 404 경로에서도 teardown 이 돈다는 사실을 단위 단언으로 고정 — 새 결함이 아니라 관측 편의다.
