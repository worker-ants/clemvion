# RESOLUTION — `review/code/2026/09/05/15_31_41`

전체 위험도 **LOW** · Critical **0** · WARNING **1** · INFO **7**. **조치 완료.**

## 조치 항목

| # | 카테고리 | 지적 | 조치 | 커밋 |
|---|---|---|---|---|
| W1 | api_contract | `AuditLogListItem` 이 `user` 는 좁혔는데 자매 관계 필드 `workspace` 는 엔티티 타입 그대로 — 이 쿼리는 `workspace` 를 join 하지 않아 런타임엔 항상 `undefined` 다 | **고쳤다.** `Omit<AuditLog, 'user' \| 'workspace'>` 로 둘 다 뺐다 | `5fcb5c625` |

**지적이 맞다.** join 사이트를 실측하니 `al.workspace` 는 **0곳**이다 — 타입만
`Workspace` 라고 말하고 있었다. 지금 `AuditLogDto` 가 `workspace` 를 선언하지 않아 wire
유출은 없지만, 다음 사람이 그 타입을 믿거나 join 을 추가하면 **이번에 고친 것과 같은
클래스**가 옆자리에서 재발한다.

이것은 내가 반복해서 밟는 형태다 — **지적받은 자리만 고치고 자매를 두는 것.** 직전 라운드에서
`user` 를 좁힐 때 형제 관계 필드를 함께 보지 않았다.

## INFO 처분

| # | 지적 | 처분 |
|---|---|---|
| 1 | `User` 엔티티 컬럼 방어 부재 (3라운드 연속) | **이미 등재** — 인증 경로 fail-silent 위험으로 별도 PR 유예 |
| 2 | `descend()` 의 unresolved-ref 방어 분기가 미검증 | **남긴다.** 그 분기는 "생성 문서에 없는 스키마를 가리키는 `$ref`" 인데, `contractForDto` 가 한 문서에서 스키마와 참조를 함께 만들므로 **오늘 도달 경로가 없다**. 캐너리를 세우려면 도달 불가 상태를 인위적으로 조립해야 한다 — 그건 가드가 아니라 mock 의 자기 확인이 된다. 다음에 `contractForDto` 가 여러 문서를 다루게 되면 그때가 실 도달 시점이다 |
| 3 | `assertMatchesContract` 가 `completed` 경로만 대조 — 실패 전용 필드 미실측 | **§5.4 스윕 항목에 속한다.** 그 10개가 정확히 optional+nullable drift 필드이고, 스윕이 그것을 다룬다 |
| 4 | `find → toBeDefined → assert` 3문장 반복 (3라운드 연속) | **이미 등재** |
| 5 | `response-contract.ts` 가 `code:` 미등재 (3라운드 연속) | **이미 등재** (planner 트랙) |
| 6 | `AuditLogDto.user`/`ipAddress` 의 optional+nullable | **diff 밖 선행 drift.** 이번 변경은 오히려 더 엄격한 방향 |
| 7 | §5.4 spec 본문과 JSDoc 판정표가 line-level 일치 재확인 | 확인 기록 |

## TEST 결과

| 단계 | 결과 |
|---|---|
| lint | **PASS** (`15:43:33`) |
| unit | **PASS** — 447 스위트 / 9,404 통과 (`15:44:38`) |
| build | **PASS** (`15:46:14`) |
| e2e | **PASS** — 51 스위트 / 295 통과 (`15:48:54`) |

**e2e 면제 아님** — 코드 변경이므로 수행했다.

## 보류·후속 항목

이 라운드가 새로 만든 후속은 없다. INFO#2 만 새로 판단한 유예이고, 그 근거를 위 표에 적었다
(등재하지 않는다 — "도달 경로가 생기면" 이라는 조건이 `contractForDto` 의 설계 변경과 함께
오므로, 그때 그 변경이 스스로 이 분기를 데려온다).

열려 있는 항목은 `plan/in-progress/spec-draft-nullable-notation-followups.md` 의 미체크
체크박스가 단일 진실이다.
