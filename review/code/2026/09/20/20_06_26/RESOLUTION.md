# RESOLUTION — 20_06_26

## 조치 항목

| SUMMARY # | 분류 | 조치 commit | 비고 |
|-----------|------|-------------|------|
| #1 | 코드 | `27f488d09` | `WorkspacesService.deleteWorkspace` 를 워크플로 경로와 대칭시켰다 — `lockParentAndListTriggerIds` 가 돌려주는 `parentPresence === 'absent'` 를 `assertWorkspaceDeletable` 재검사보다 먼저 검사해 404(`WORKSPACE_NOT_FOUND`)로 단락하고, `.catch` 에서 `NotFoundException` 은 거짓 로그 없이 재던진다. plan(`dup-delete-audit.md`) 의 「이미 덮인다」 문단은 취소선 처리 후 반증 실측을 붙여 정정했다 — `assertWorkspaceDeletable` 의 판정 순서가 «멤버십(권한) → 존재» 라 CASCADE 로 멤버 행까지 사라진 진 쪽은 404 대신 403 `OWNER_REQUIRED` + 거짓 「수동 정리 필요」 ERROR 를 받고 있었다. |
| #2 | 코드 | `e175489fe` | `LockedParentTriggers.parent` → `parentPresence` 리네임 — 같은 함수 안 파라미터 `parent: TriggerParent` 와의 시각적 혼동 제거. 호출부 2곳(workflows·workspaces) + 관련 스펙(3개 파일) 동반 수정. |
| #3 | 코드 | `e175489fe` | 워크플로 404 테스트에 `Logger.error` 미호출 단언 추가 — 뮤테이션으로 실측한 공백(가드를 지워도 기존 9개 단언은 GREEN, 거짓 「수동 정리 필요」 로그가 실제로 찍히며 통과)을 회귀 방지로 닫았다. |
| #4 | 문서 | `64e4e434d` | `CHANGELOG.md` `## Unreleased` 에 원인·고친 것·판별력 실측 3단 구성으로 항목 추가(선례 형식 준수). |

## TEST 결과

- lint  : 통과
- unit  : 통과 (`src/modules/workflows/`, `src/modules/workspaces/`, `src/modules/triggers/` 대상 652 passed / 1 skipped — 전체 스위트 `run-test.sh unit` 도 PASS)
- build : 통과 (backend build — import/타입 오류 없음)
- e2e   : 통과 (368/368, `_test_logs/e2e-20260920-203727.log`)

**뮤테이션 판별력 실측** (모두 `cp` 백업/원복, `git checkout` 미사용):
1. 워크스페이스 404 단락 분기(`if (locked.parentPresence === 'absent') throw ...`)를 제거 → 신규 테스트
   `잠금 뒤 워크스페이스가 사라졌으면(동시 삭제) 404 이고 거짓 로그를 남기지 않는다` 가 RED
   (`response.code` 단언이 아니라 promise 가 resolve 됨 — `assertWorkspaceDeletable` 재검사를 그대로
   통과해 워크스페이스가 실제 삭제됨).
2. 워크스페이스 `.catch` 의 `if (err instanceof NotFoundException) throw err;` 가드를 제거 → 같은 테스트의
   `expect(error).not.toHaveBeenCalled()` 가 RED(거짓 「트리거는 발화하지 않을 수 있다」 ERROR 로그가
   실제로 찍힘).
3. 워크플로 `.catch` 의 동일 가드를 제거 → 새로 추가한 `expect(error).not.toHaveBeenCalled()` 가 RED
   (거짓 「수동 정리가 필요하다」 ERROR 로그가 실제로 찍힘 — 리뷰가 지적한 공백을 그대로 재현).

세 뮤턴트 모두 원복 후 GREEN 재확인 완료.

## 보류·후속 항목

없음 — Critical 0, WARNING 4건 전부 조치 완료. INFO 항목(§1~§7)은 SUMMARY 상 자동 조치 대상 아님(비차단, 후속 project-planner/구조개편 턴 권고 사항):
- INFO #2: `spec/2-navigation/1-workflow-list.md` §2.6 에 트리거 §4.4 대칭 문구 추가 고려(후속 project-planner 턴).
- INFO #3: plan(`dup-delete-audit.md`) 이 스스로 약속한 트래커 교차 참조(`spec-draft-nullable-notation-followups.md` :4501, :4741) — `--impl-done` 통과 뒤 마무리 커밋에서 해소.
- INFO #6: `releaseExternalForParent` 중복 실행(멱등 전제) — 기존 스코프 밖 잔여, 이 PR 대상 아님.

다음 단계(plan 체크리스트 잔여 — 이 sub-agent 스코프 밖): `/ai-review` 재실행(Critical/Warning 0 확인) → `/consistency-check --impl-done spec/2-navigation` → 트래커 해소 + `plan/complete/` 이동.
