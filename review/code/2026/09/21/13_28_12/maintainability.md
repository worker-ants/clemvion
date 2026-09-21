# 유지보수성(Maintainability) 리뷰

## 발견사항

- **[INFO]** e2e 파일 안 두 테스트가 "락 대기 → 공허성 가드 → COMMIT → 정렬 → finally 정리" 레이스 오케스트레이션 블록을 거의 그대로 반복한다 (직전 라운드 `review/code/2026/09/21/12_57_05/maintainability.md` INFO 항목의 재확인 — 코드 변경 없음, 의도적 유예)
  - 위치: `codebase/backend/test/member-remove-concurrency.e2e-spec.ts` 첫 번째 `it('두 제거 요청이 겹쳐도 감사 행은 하나이고 진 쪽은 404 다', ...)` (게이트 61~129) 와 두 번째 `it('자가 탈퇴 갈래는 이미 닫혀 있다 — 진 쪽은 403 이고 감사가 없다', ...)` (게이트 139~204) — `BEGIN`/`FOR UPDATE`/`Promise.race` 공허성 가드/`COMMIT`/`finally` 정리 시퀀스가 거의 동일하게 두 번 나온다. 요청 빌더 `fireRemove`/`fireLeave` 도 Authorization 헤더 대상만 다르고 나머지는 동일하다.
  - 상세: 형제 다섯 개 `*-delete-concurrency.e2e-spec.ts` (`workflow-`/`workspace-`/`trigger-`/`schedule-`/`integration-delete-concurrency.e2e-spec.ts`)는 파일당 `it` 이 하나뿐이라 이 형태의 파일 내부 중복이 없다. 이 파일만 plan §C-1(자가 탈퇴 갈래 실증) 요구 때문에 같은 오케스트레이션을 가진 테스트 두 개를 갖게 됐다. `RESOLUTION.md`(`review/code/2026/09/21/12_57_05/RESOLUTION.md`)에 "INFO #7 — 형제 5파일 전체를 스코프로 하는 별도 작업으로 남긴다"는 유예 사유가 이미 기록돼 있고, 이 파일 하나만 헬퍼로 뽑으면 나머지 4개 형제 파일과 비대칭이 된다는 근거는 타당하다.
  - 제안: 현재 유예 판단을 유지해도 무방하다. 다만 여섯 번째 락-기반 동시성 e2e가 하나 더 추가되는 시점(예: owner 승격 TOCTOU 별도 PR)에는 `raceConcurrentRequests(fire)` 류 공유 헬퍼 추출을 다시 검토할 것 — 그때는 여러 파일에 걸친 중복이 아니라 반복 빈도 자체가 추출을 정당화하기 시작한다.

## 참고 (직전 라운드 WARNING 재확인 — 조치 완료 확인)

직전 라운드(`review/code/2026/09/21/12_57_05/maintainability.md`)가 지적한 WARNING 2건은 이번 diff 에서 모두 해소된 것을 코드로 직접 확인했다:

1. **`MEMBER_NOT_FOUND` 리터럴 3중 복제** → `workspaces.service.ts:342-347` `private throwMemberNotFound(): never` 로 추출, `updateMemberRole()`(:310)·`removeMember()`의 두 판정(:803, :838) 세 곳 모두 재사용. `transferOwnership()`(:756-759)의 "대상 멤버를 찾을 수 없습니다." 는 문구가 달라 의도적으로 재사용하지 않았고, 그 이유가 헬퍼 JSDoc(:339-340)에 명시돼 있다 — 형제 `throwTriggerNotFound`/`throwScheduleNotFound`/`throwIntegrationNotFound` 선례와 일관된 형태(`integrations.service.ts:765-769` 대조 확인).
2. **`getAudit()` 테스트 헬퍼 중복 정의** → `workspaces.service.spec.ts:32-41` 최상위 `describe('WorkspacesService', ...)` 스코프로 한 번만 남기고, 옛 `audit logging (결정4=B)` 블록의 지역 정의(diff 상 `-` 4줄)가 제거됐다. 신규 `removeMember — 동시 제거` 블록도 이 공유 정의를 그대로 쓴다(:1496, :1515 등).
3. **INFO — 로컬 상수 네이밍(SCREAMING_SNAKE_CASE)** → `workspaces.service.spec.ts:1460-1462` 가 `workspaceId`/`memberId`/`requesterId` camelCase 로 통일됐다. 파일 전체 컨벤션과 일치.

세 조치 모두 새로운 중복이나 회귀를 만들지 않았다 — `throwMemberNotFound()` 도입 후 `MEMBER_NOT_FOUND` 리터럴 문자열은 헬퍼 정의부(:344)와 문구가 다른 `transferOwnership()`(:757, 의도적 별도)에만 남아 있음을 grep 으로 확인했다.

## 참고 (리뷰 범위 안내)

`plan/in-progress/member-dup-remove.md`, `plan/in-progress/spec-draft-nullable-notation-followups.md`, `review/code/2026/09/21/12_57_05/**`(SUMMARY.md·RESOLUTION.md·`_resolution_log.md`·`_resolution_state.json`·`_retry_state.json`·9개 리뷰어 출력·`meta.json`), `review/consistency/2026/09/21/12_23_48/**`(SUMMARY.md·`_retry_state.json`·`meta.json`·4개 checker 출력)는 애플리케이션 코드가 아니라 계획 문서·이전 리뷰/consistency-check 실행의 산출 아티팩트다. 가독성·네이밍·함수 길이·중첩·매직넘버·중복·복잡도·일관성이라는 이번 점검 관점이 적용될 대상이 아니어서 개별 발견사항을 내지 않았다(직전 라운드와 동일한 처리).

## 검증용 뮤테이션

이번 리뷰에서는 코드를 고쳐보지 않았다 — `Read`/`grep`/`git show --stat`/`git log` 를 이용한 정적 대조 확인만 수행했다. `git status --short` 로 확인한 결과 이 세션이 저장소에 남긴 변경은 없다(이번 리뷰 산출물 디렉터리 `review/code/2026/09/21/13_28_12/` untracked 만 있음, 다른 파일 뮤테이션 없음).

## 요약

핵심 프로덕션 코드 변경(`workspaces.service.ts` `removeMember()` 의 원자적 `DELETE`+`affected` 판정 전환)은 형제 다섯 개(#1369~#1372)의 검증된 패턴·주석 스타일을 그대로 따르고 있어 읽기 쉽고 근거가 충분하다. 직전 라운드(`12_57_05`)가 지적한 두 WARNING(`MEMBER_NOT_FOUND` 리터럴 3중 복제, `getAudit()` 중복 정의)과 INFO(로컬 상수 네이밍)는 이번 diff 에서 형제 선례를 그대로 따라 깔끔하게 해소됐고, 새로 도입한 `throwMemberNotFound()` 헬퍼는 의도적으로 재사용하지 않는 자리(`transferOwnership()`)까지 JSDoc 으로 경계를 명확히 해 뒀다. 남은 것은 e2e 파일 하나 안의 오케스트레이션 중복(INFO)뿐인데, 형제 5파일과의 비대칭을 피하려는 유예 사유가 문서화돼 있고 테스트 코드 가독성에 실질적 지장이 없어 병합을 막을 사유가 아니다. 전반적으로 유지보수성 관점에서 이번 PR 은 양호하다.

## 위험도

LOW
