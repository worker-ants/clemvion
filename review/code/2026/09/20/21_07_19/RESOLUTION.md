# RESOLUTION — 동시 DELETE 감사 중복 (리뷰 3라운드 · 수렴)

2라운드 조치로 `codebase/**` 가 바뀌어 돌린 fresh 라운드. **Critical 0 · Warning 3 — 셋 다 문서·후속이고
`codebase/**` 수정은 0**이다. 착수 전 선언한 정지 규칙(«Critical·Warning 0 **또는** `codebase/**` 수정이 0 인
라운드»)에 도달했다.

## 조치 항목

| SUMMARY # | 발견 | 조치 |
|---|---|---|
| WARNING 1 (requirement) | plan 이 «트리거는 이미 §4.4 대로 동작한다» 를 **실측 없이 선례로 인용**했다. `TriggersService.remove()` 도 무락 선조회 → advisory lock → `m.remove` → 감사 형태라 같은 중복이 날 수 있다 | **읽기로 확인하고 plan 을 정정**했다(그 문장은 «spec 이 정한다» 지 «코드가 그렇게 한다» 가 아니다). 코드는 이 PR 스코프(워크플로·워크스페이스) 밖이라 **트래커에 developer 항목으로 등재** — 재현은 그 항목이 한다 |
| WARNING 2 (documentation) | 2라운드에서 고친 옛 필드명이 **한 곳 더** 남아 있었다(§«--impl-prep 이 요구한 것» 의 교차참조 문장) | `{ parentPresence, triggerIds }` 로 정정. 2라운드 RESOLUTION 이 «스니펫만» 이라 적어 부분 조치를 완전 조치로 기록한 것도 이 문서가 바로잡는다 |
| WARNING 3 (documentation) | `CHANGELOG.md` 의 판별력 문단이 워크스페이스에 대해 **단위 뮤테이션 증거만** 적고, 이후 추가한 실 DB e2e(403→404 재현)를 반영하지 않았다 | 실 DB 재현을 본문에 넣고, «단위만으로는 부족했다 — mock 이 `absent` 를 직접 주입해 403 을 만든 현실을 재현하지 못한다» 를 함께 적었다 |

INFO 10건은 조치 불요이거나 이미 추적 중이다(4단 가드 패턴 공용화 · e2e 보일러플레이트 3중 복제 ·
`workspaceId` absent 단위 테스트 · spec 대칭 문구 — 앞의 둘은 트래커의 «네 자리 공용 형태» 항목이 받는다).

## TEST 결과

- lint : 통과 · unit : 통과 · build : 통과 · e2e : **통과 369/369** (2라운드 조치 시점)
- 본 3라운드는 **`codebase/**` 를 한 줄도 고치지 않았다** — plan · CHANGELOG · 리뷰 산출물뿐이라 재실행 대상이 없다.

## 보류·후속 항목

`plan/in-progress/spec-draft-nullable-notation-followups.md` 에 이 턴에 등재했다:

- (developer) `TriggersService.remove()` 의 동시 삭제 감사 중복 — 워크플로·워크스페이스와 같은 형태.
- (planner) `1-workflow-list.md` §2.6 · `data-flow/12-workspace.md` §1.10 에 «동시 삭제 → 두 번째 404» 대칭 문구.
