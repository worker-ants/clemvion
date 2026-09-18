---
title: 트리거 삭제 자원 정리(#1346)가 남긴 stale 주석·이름 정리
status: in-progress
owner: developer
worktree: trigger-stale-comments-7c41e9
started: 2026-09-18
spec_impact: none
---

# 트리거 삭제 자원 정리가 남긴 stale 주석·이름

트래커 `plan/in-progress/spec-draft-nullable-notation-followups.md` 의 developer 항목
«트리거 자원 정리 구현이 남긴 stale 주석·이름 네 곳»(2026-09-17 등재, `plan/complete/trigger-deletion-release.md`
리뷰 수렴 예외로 등재)을 닫는다. **동작은 바꾸지 않는다** — 주석과 메서드 이름 하나.

## 실측 — 트래커 네 곳 + 같은 클래스 전수

트래커는 네 곳을 적었다. 같은 결함 클래스(«삭제가 비밀을 락·행 삭제 **전에** 지운다» / «정리는 `TriggersService.remove()`
하나가 한다» / 소비자 목록)를 `codebase/backend/{src,test}` 에서 grep 으로 다시 훑었다(`secret 삭제`·`비밀 삭제`·
`deleteByPrefix`·`한 곳뿐`).

| # | 자리 | 현재 문면 | 사실 (`origin/main` e63a5bc5d) | 출처 |
|---|---|---|---|---|
| 1 | `secret-store/secret-resolver.service.ts` `deleteByPrefix` JSDoc | «현재 프로덕션 호출부는 `triggers.service.ts` 한 곳뿐» | 직접 호출부는 `trigger-resource-release.ts` 의 `deleteTriggerSecretsAfterCommit` **한 곳**(grep). 네 삭제 경로와 쓰기 보상이 그 함수를 지난다 | 트래커 |
| 2 | `triggers/trigger-config-lock.ts` `TRIGGER_DELETE_LOCK_TIMEOUT_MS` JSDoc | «`TriggersService.remove()` 는 provider teardown · **secret 삭제** · listener 해제까지, `SchedulesService.remove()` 는 BullMQ job 해제만» | 목록이 낡았을 뿐 아니라 **틀렸다** — 비밀은 이제 락 **전**이 아니라 행 삭제 커밋 **뒤**에 지운다. 소비자는 셋(트리거 · 스케줄 · 부모 삭제의 `lockParentAndListTriggerIds`) | 트래커 + 이번 실측(«틀림» 은 트래커에 없던 것) |
| 3 | `workspaces/workspaces.service.spec.ts` «선검사 뒤 역할 변경» 테스트 주석 | `/ai-review` 18_45_09 WARNING#2·#4 (bare 시각) | `review/code/2026/09/17/18_45_09` | 트래커 |
| 4 | `triggers/chat-channel-binder.service.ts` `teardownChannelConfig`(정의 + 내부 호출 2) · `trigger-resource-releaser.service.ts`(호출 1) · `trigger-resource-releaser.service.spec.ts`(mock 1 · 이벤트 라벨) | `teardownChatChannel` 과 어순만 다르다 | → `teardownRegisteredChannel` (저장소·spec 0건 확인) | 트래커 · 호출부 둘은 `--impl-prep` INFO 2 |
| 5 | `triggers/triggers.service.ts` `update()` 의 «행이 사라졌으면 저장하지 않는다» 주석 | «`remove()` 는 이미 `teardownChatChannel`·`secrets.deleteByPrefix`·BullMQ 해제·CASCADE 삭제를 마쳤으므로» | 락 안 재읽기가 비는 시점은 행 삭제 커밋 직후다 — 비밀은 커밋 **뒤**에 지우므로 아직 안 지웠을 수 있다 | 이번 실측 |
| 6 | `triggers/triggers.service.spec.ts` 같은 내용의 테스트 주석 | «`remove()` 가 이미 teardown·secret 삭제·BullMQ 해제까지 마친» | 5 와 같다 | 이번 실측 |
| 7 | `test/trigger-workflow-ref.e2e-spec.ts` teardown JSDoc | «그 정리는 `TriggersService.remove()` 의 `deleteByPrefix` 만 하고» · «그 경로(`remove()` → `deleteByPrefix`)» | 네 삭제 경로(트리거·스케줄·워크플로·워크스페이스)가 모두 커밋 뒤 정리한다 | 이번 실측 |
| 8 | `triggers/chat-channel-binder.service.ts` degraded 경로 주석 | «SUMMARY#24: … `remove()` 시 deleteByPrefix 로 정리» | 거짓은 아니나 경로 하나만 말한다 — 4 로 여는 파일이라 같이 맞춘다. 그 자리를 건드리므로 세션 없는 인용 `SUMMARY#24` 도 해소한다(`review-citations.md §4`): 이 주석을 처음 넣은 `ad0ea7cdb`(#264)와 함께 커밋된 `review/code/2026/05/22/11_24_03` SUMMARY #24 *«`setupChatChannel` 실패 시 botTokenRef DB 기록 후 경고 로그 없음»* — 워킹트리에선 정리됐고 이력에 있다 | 이번 실측 |

## 비대상

| 자리 | 판정 |
|---|---|
| `trigger-config-lock.ts` `acquireTriggerConfigLock` 의 «두 자리 모두 `TRIGGER_DELETE_LOCK_TIMEOUT_MS`» | **참이다** — 그 문장의 주어는 `acquireTriggerConfigLock` 에 `timeoutMs` 를 넘기는 호출부(트리거·스케줄 삭제) 둘이다. 부모 삭제는 `setLocalLockTimeout` 을 직접 부른다 |
| `rewriteTriggerConfigLocked` 의 «`Trigger` 행을 지우는 경로는 셋» | **참이다** — 셋째(FK CASCADE)가 advisory lock 을 못 잡는다는 서술은 부모 삭제가 부모 **행** 잠금을 더한 뒤에도 그대로다 |
| 저장소 전체의 bare 리뷰 인용(100개 파일 · 428곳, 이번 grep) | `spec/conventions/review-citations.md §4` — 기존 bare 인용은 **그 자리를 다음에 건드릴 때** 맞춘다. 이 PR 이 여는 자리만 고친다(#3). `triggers.service.spec.ts` 의 3건은 트래커에 따로 있다 |
| spec 문서 | 이미 현재형(#1347) — 이 PR 은 `codebase/**` 만 |

## 체크리스트

- [x] `--impl-prep spec/2-navigation/` — `review/consistency/2026/09/18/11_26_25` **BLOCK: NO** (INFO 6 — 2 는 표 4 행에 반영, 3·4·5 는 spec 표기·기존 부채라 이 PR 밖, 1·6 조치 불요)
- [ ] 1~8 적용
- [ ] lint · unit · build · e2e
- [ ] `/ai-review`
- [ ] `--impl-done`
- [ ] 트래커 항목 종결 표시 · 이 plan `complete/` 이동
