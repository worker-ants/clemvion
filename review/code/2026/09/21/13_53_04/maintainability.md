# 유지보수성(Maintainability) 리뷰 — `member-dup-remove` (3차 라운드)

## 검토 방법

이 라운드의 실질 diff(`origin/main...HEAD`)는 이전 두 라운드(`review/code/2026/09/21/12_57_05`,
`review/code/2026/09/21/13_28_12`)가 이미 상세히 검토한 코드(`workspaces.service.ts`,
`workspaces.service.spec.ts`, `member-remove-concurrency.e2e-spec.ts`)에 대해, 최신 커밋
(`6f1113a70`, "「형제 다섯은 전부 204」가 틀렸다 — 컨트롤러별로 갈린다")이 **주석·plan 문서 정정만**
추가한 상태다. `git show --stat 6f1113a70`으로 확인한 결과 코드 파일 변경은
`member-remove-concurrency.e2e-spec.ts`의 JSDoc 블록 8줄 치환뿐이며, 나머지는
`plan/in-progress/*.md`와 직전 라운드(`13_28_12`)의 리뷰 산출물이다. 실제 소스 파일
(`workspaces.service.ts`, `workspaces.service.spec.ts`, `member-remove-concurrency.e2e-spec.ts`)을
`Read`/`grep -n`으로 직접 열어 직전 라운드의 조치·유예 상태가 그대로인지 재확인했다.

## 발견사항

이번 라운드에서 신규로 지적할 유지보수성 결함은 없다. 두 차례 리뷰가 지적한 항목의 현재 상태는 아래와 같다.

- **[해소 확인]** `MEMBER_NOT_FOUND` 리터럴 3중 복제 → `throwMemberNotFound(): never`로 추출 완료
  - 위치: `codebase/backend/src/modules/workspaces/workspaces.service.ts` — 헬퍼 정의(`updateMemberRole()` 바로 아래), 호출부는 `updateMemberRole()`의 `if (!member) this.throwMemberNotFound();`와 `removeMember()`의 두 판정(`if (!member) this.throwMemberNotFound();`, `if (affected === 0) this.throwMemberNotFound();`)
  - 상세: 소스를 직접 열어 세 호출부 모두 헬퍼를 재사용함을 확인했다. JSDoc이 `transferOwnership()`의 별도 메시지("대상 멤버를 찾을 수 없습니다.")를 의도적으로 재사용하지 않는 이유까지 명시해, 향후 누군가 "왜 하나로 안 합쳤냐"고 재지적할 여지를 차단해 둔 점도 확인했다.
  - 제안: 없음.

- **[해소 확인]** 테스트 헬퍼 `getAudit()` 중복 정의 제거
  - 위치: `codebase/backend/src/modules/workspaces/workspaces.service.spec.ts` — `describe('WorkspacesService', ...)` 최상위 스코프(`function getAudit()`)
  - 상세: `grep -n "function getAudit"` 결과 정의가 파일 전체에서 1건뿐이고, `audit logging (결정4=B)`·`removeMember — 동시 제거` 두 describe 블록 모두 이 공유 정의를 참조한다. 지역 재정의가 남아 있지 않다.
  - 제안: 없음.

- **[해소 확인]** 신규 `describe` 로컬 상수 네이밍이 파일 컨벤션(camelCase)으로 통일됨
  - 위치: `codebase/backend/src/modules/workspaces/workspaces.service.spec.ts` — `describe('removeMember — 동시 제거', ...)` 블록의 `workspaceId`/`memberId`/`requesterId`
  - 상세: 이전 라운드가 지적했던 `WS`/`MEMBER_ID`/`REQUESTER`(SCREAMING_SNAKE_CASE)가 파일 다른 곳(`requesterId`, `newOwnerMemberId` 등)과 같은 camelCase로 교체돼 있다.
  - 제안: 없음.

- **[재확인, 미해소·의도적 유예]** e2e 파일 안 두 `it`이 "락 대기 → 공허성 가드 → COMMIT → 정렬 → finally 정리" 오케스트레이션 블록을 거의 그대로 반복
  - 위치: `codebase/backend/test/member-remove-concurrency.e2e-spec.ts` — 첫 번째 `it('두 제거 요청이 겹쳐도 감사 행은 하나이고 진 쪽은 404 다', ...)`와 두 번째 `it('자가 탈퇴 갈래는 이미 닫혀 있다 — 진 쪽은 403 이고 감사가 없다', ...)`. 두 블록 모두 `locker.query('BEGIN')` → `SELECT ... FOR UPDATE` → `Promise.all([fire*(), fire*()])` → `Promise.race`(1500ms 공허성 가드) → `COMMIT` → 정렬·단언 → `finally`의 `ROLLBACK`+`pending?.catch(...)` 시퀀스를 반복한다. 요청 빌더(`fireRemove`/`fireLeave`)도 Authorization 헤더 대상만 다르다.
  - 상세: 이 라운드의 유일한 코드 변경(JSDoc 8줄)은 이 중복 구조 자체에 손대지 않았다. 직전 두 라운드가 이미 이 항목을 INFO로 지적했고, 형제 5파일(`*-delete-concurrency.e2e-spec.ts`)은 파일당 `it`이 하나뿐이라 이 형태의 파일 내부 중복이 없다는 것, 그리고 이 파일 하나만 헬퍼로 뽑으면 나머지 4개 형제 파일과 비대칭이 된다는 유예 근거(`review/code/2026/09/21/12_57_05/RESOLUTION.md` INFO #7)가 여전히 유효하다. 새로운 회귀나 악화는 없다 — 반복 횟수(2회)·복잡도 모두 이전과 동일.
  - 제안: 유예 유지에 동의. 다만 여섯 번째(현재) 이후 락 기반 동시성 e2e가 하나 더 추가되면(예: owner 승격 TOCTOU 후속 PR) 그 시점엔 `raceConcurrentRequests(fire)` 류 공유 헬퍼 추출을 재검토할 것 — 반복 빈도 3회부터는 "형제 파일과의 비대칭" 논리보다 "같은 파일 안의 반복"이 추출을 정당화하기 시작한다.

## 참고 (리뷰 범위 안내)

`plan/in-progress/member-dup-remove.md`, `plan/in-progress/spec-draft-nullable-notation-followups.md`,
`review/code/2026/09/21/12_57_05/**`, `review/code/2026/09/21/13_28_12/**`,
`review/consistency/2026/09/21/12_23_48/**`는 애플리케이션 코드가 아니라 계획 문서·이전
리뷰/consistency-check 실행의 산출 아티팩트다(둘 다 이전 두 라운드와 동일한 처리). 이번 라운드가
유일하게 건드린 코드성 변경(`member-remove-concurrency.e2e-spec.ts`의 JSDoc 8줄)도 산문 정정일
뿐 로직·구조 변경이 아니라 가독성·네이밍·함수 길이·중첩·매직넘버·중복·복잡도·일관성 관점의 개별
발견사항 대상이 되지 않는다.

## 검증용 뮤테이션

이번 리뷰에서는 코드를 고쳐보지 않았다 — `Read`/`grep -n`/`git show --stat`으로 실제 소스 파일과
diff를 직접 대조하는 정적 검증만 수행했다. `git status --short` 확인 결과 이 세션이 저장소에 남긴
변경은 없다(사전에 존재하던 `review/code/2026/09/21/13_53_04/` 산출 디렉터리 자체 외에는 없음).

## 요약

이번 3차 라운드는 유지보수성 관점에서 실질적으로 아무것도 바꾸지 않았다 — 유일한 코드 변경은
e2e 스펙 파일 상단 JSDoc의 사실 정정(성공 코드가 "라우트별"이 아니라 "컨트롤러별"로 갈린다는
실측 반영) 8줄뿐이다. 직전 두 라운드가 지적한 WARNING 2건(`MEMBER_NOT_FOUND` 리터럴 3중 복제,
`getAudit()` 중복 정의)과 INFO(로컬 상수 네이밍)는 소스 대조로 재확인한 결과 여전히 해소된 상태를
유지하고 있고, 새로운 중복·회귀는 만들지 않았다. 유일하게 남아 있는 항목(e2e 파일 내부의 레이스
오케스트레이션 중복, INFO)도 코드가 변경되지 않았으므로 그대로다 — 형제 5파일과의 비대칭을 피하려는
기존 유예 근거가 여전히 타당하며, 병합을 막을 사유가 아니다. 종합적으로 이번 라운드는 유지보수성
관점에서 문제가 없다.

## 위험도

NONE
