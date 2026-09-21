# RESOLUTION — 12_57_05

## 조치 항목

| SUMMARY # | 분류 | 조치 commit | 비고 |
|-----------|------|-------------|------|
| 경고 #1 (security, 권한 검사 순서) | 코드 | `942d14b61` (main 선처리) | 등재로 종결. `assertAdmin` 을 맨 앞으로 옮기는 처방은 자가 탈퇴(비-admin 허용)·owner 지목 시 에러 코드 계약이 바뀌어 별 PR 필요 — 본 세션에서 코드 무수정 |
| 경고 #2 (동시성/DB, owner 승격 TOCTOU) | 코드 | (main 선처리, 실측·등재·유예 완료) | 이번 PR 스코프 밖 유지. 코드 무수정 |
| 경고 #3 (유지보수성, `MEMBER_NOT_FOUND` 중복) | 코드 | `f022ae9fd` | `throwMemberNotFound(): never` 추출 — 형제 `throwTriggerNotFound`/`throwScheduleNotFound`/`throwIntegrationNotFound` 선례를 따름 |
| 경고 #4 (유지보수성/테스트, `getAudit()` 중복 정의) | 코드 | `65b082596` | 최상위 `describe('WorkspacesService', ...)` 스코프로 1회 통합, 두 지역 정의 제거 |
| 경고 #5 (테스트, `ADMIN_REQUIRED` 거부 테스트 부재) | 코드 | `65b082596` | `wireFindOne()` 을 요청자 멤버십도 오버라이드 가능하게 확장해 신규 테스트 추가. 검사 순서가 아니라 "ADMIN_REQUIRED 로 거부 + delete 미호출" 불변만 단언(WARNING 1 후속 PR 대비) |
| 경고 #6 / SPEC-DRIFT #1 (문서화, spec 미반영) | spec | (main 선처리, planner 소유 트래커 등재 완료) | `spec/` developer 권한 밖 — 코드·문서 무수정 |
| INFO #6 (문서화, JSDoc 동시성 계약 누락) | 코드 | `f022ae9fd` | `removeMember()` JSDoc 에 한 문장 추가 (형제 `transferOwnership` 수준) |
| INFO #7 (유지보수성, e2e 오케스트레이션 중복) | 보류 | — | 아래 「보류·후속 항목」 참조 |
| INFO #8 (유지보수성, 신규 describe 로컬 상수 네이밍) | 코드 | `65b082596` | `WS`/`MEMBER_ID`/`REQUESTER` → 파일 컨벤션인 camelCase(`workspaceId`/`memberId`/`requesterId`)로 통일 |
| INFO #1~5 | 없음 | — | 자동 수정 대상 아님(현행 유지 권고) — 조치 불요 |

## 뮤테이션 검증 (SUMMARY 경고 #5)

- 대상: `removeMember()` 의 `await this.assertAdmin(workspaceId, requesterId);` 호출(:815, 파일 내 유일 컨텍스트로 확인) 제거.
- 절차: `git commit` 으로 원본 확정 → `cp` 로 백업 → `sed` 로 해당 줄만 삭제(diff 로 그 1줄만 바뀐 것 확인) → 대상 스펙만 `npx jest` 실행 → `cp` 로 원복(`git checkout`/`restore` 미사용).
- 예측: 신규 테스트(「admin/owner 가 아니면 ADMIN_REQUIRED 로 거부하고 delete 를 타지 않는다」) 가 RED, 나머지는 GREEN 유지.
- 실측: `Tests: 1 failed, 74 passed, 75 total` — 정확히 그 테스트만 실패(`Resolved to value: undefined`, delete 가 호출됨). 예측과 일치, 판별력 확인.

## TEST 결과

- lint  : 통과
- unit  : 통과 (backend/frontend/web-chat/channel-web-chat/internal packages 전 스테이지, `workspaces.service.spec.ts` 단독 75/75 포함)
- build : 통과 (backend/frontend/web-chat/channel-web-chat build + 내부 패키지 + **백엔드·프론트엔드 타입체크 ratchet** 2종 + Dockerfile 빌드 검증 전부 체인 성공)
- e2e   : 통과 (374/374)

## 보류·후속 항목

- 경고 #1(security, 권한 검사 순서): main 이 `942d14b61` 로 트래커에 이미 등재. `assertAdmin` 선이동은 자가 탈퇴 허용·owner 지목 에러 코드 계약 변경을 수반해 별도 PR 필요 — 본 세션 조치 없음.
- 경고 #2(동시성, owner 승격 TOCTOU): 실측 재현·트래커 등재·유예 완료(이전 턴). `delete({..., role: Not('owner')})` + 0행 재조회 처방은 후속 PR.
- 경고 #6 / SPEC-DRIFT #1(spec 문서 미반영): planner 소유로 이미 트래커 등재. `spec/2-navigation/9-user-profile.md §6.1`, `spec/data-flow/12-workspace.md §1.6`, `spec/5-system/2-api-convention.md §3` 갱신은 planner 턴 대상 — 본 세션 무수정.
- INFO #7(e2e 두 테스트의 오케스트레이션 중복): 의도적으로 미착수. 지시에 따라, 같은 결함 클래스(락 대기→공허성 가드→COMMIT→정리)의 e2e 헬퍼 추출은 `#1369~#1372` 형제 5개 파일에 걸친 사안이라 이 PR 에서 `member-remove-concurrency.e2e-spec.ts` 한 파일만 추출하면 나머지 4개 파일과 비대칭이 된다. 헬퍼 추출은 5파일 전체를 스코프로 하는 별도 작업으로 남긴다.
