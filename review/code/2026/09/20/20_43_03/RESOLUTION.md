# RESOLUTION — 동시 DELETE 감사 중복 (리뷰 2라운드)

1라운드(`review/code/2026/09/20/20_06_26`) 의 Warning 4건을 조치한 뒤 돌린 **fresh 라운드**.
결과: **Critical 0 · Warning 2** — 둘 다 조치했다.

## 조치 항목

| SUMMARY # | 발견 | 조치 | 커밋 |
|---|---|---|---|
| WARNING 1 | 워크스페이스 경로의 동시성 수정이 **실 DB 로 검증되지 않았다** — 단위 mock 은 `parentPresence: 'absent'` 를 직접 주입하므로 «이긴 쪽이 멤버 행까지 지운다» 는 현실을 재현하지 못한다 | `test/workspace-delete-concurrency.e2e-spec.ts` 신설 — 워크플로 짝과 같은 기법(별도 커넥션이 `SELECT … FOR UPDATE` 로 행을 쥐고 DELETE 두 건을 겹친 뒤 COMMIT, 공허성 가드 포함). 상태쌍 `[200, 404]` 과 **코드 `WORKSPACE_NOT_FOUND`**, 그리고 연관 행(workspace·member·invitation) 전부 0 을 단언 | 아래 커밋 |
| WARNING 2 | `plan/in-progress/dup-delete-audit.md` §B 의 설계 스니펫이 리네임 이전 이름 `parent` 를 남겨 둬, 트래커로 옮겨 적으면 옛 이름이 두 번째 문서로 퍼진다 | 스니펫을 `parentPresence` 로 고치고, **왜 그 이름인지**(파라미터 `parent` 와 한 자리에서 두 의미로 읽혔다)를 한 줄로 남겼다 | 같은 커밋 |

INFO 8건은 조치 불요이거나 이미 추적 중이다 — 특히 INFO 4(`absent` 단락에서 `releaseSecretsAfterCommit` 미호출)는
이긴 쪽이 전체 `triggerIds` 로 이미 정리하므로 잔존 위험이 없고, plan 이 스코프 밖으로 명시한 기존 항목이다.
INFO 8(`_resolution_log.md` untracked)은 이 커밋에 포함한다.

## TEST 결과

- lint : 통과
- unit : 통과
- build : 통과
- e2e : **통과 369/369** (신규 `workspace-delete-concurrency` 포함)

### 뮤테이션 검증 — 새 e2e 가 분기를 가르는가

`workspaces.service.ts` 의 `parentPresence === 'absent'` 단락을 통째로 지우고(`cp` 백업, `git checkout` 미사용)
e2e 이미지를 다시 빌드해 그 스펙만 돌렸다:

```
Array [
    200,
-   404,
+   403,
]
```

**리뷰어가 읽기로 지적한 403 이 값으로 재현됐다.** 원복 후 다시 GREEN.

> 이 한 건이 2라운드에서 가장 값졌다 — 1라운드가 읽기로 찾아낸 비대칭을, 2라운드가 «mock 으로만 닫혔다» 고
> 지적했고, 그 지적대로 실 DB 에 붙이자 **주장이 그대로 재현**됐다. 단위 mock 은 이 결함을 구조적으로 못 본다.

## 보류·후속 항목

- (INFO 1) «잠금 → absent → 404 → catch 구분» 이 두 서비스에 복제돼 있다. 이 PR 안에서 실제로 한 번 어긋났다가
  (워크스페이스 쪽 누락) 리뷰로 잡혔다 — 트래커의 «네 자리 공용 형태» 설계 항목이 그 자리다.
- (INFO 7) `spec/2-navigation/1-workflow-list.md` §2.6 에 트리거 §4.4 대칭 문구가 없다 — planner 후속(비차단,
  `--impl-prep` 부터 세 번 비차단으로 처분됐다).
