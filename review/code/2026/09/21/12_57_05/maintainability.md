# 유지보수성(Maintainability) 리뷰

## 발견사항

- **[WARNING]** `removeMember()` 안에서 `MEMBER_NOT_FOUND` `NotFoundException` 리터럴이 두 번 중복된다 — 같은 시리즈의 형제 수정(#1371·#1372)이 이미 이 정확한 패턴을 지적받아 헬퍼로 추출한 전례가 있다
  - 위치: `codebase/backend/src/modules/workspaces/workspaces.service.ts:788`(기존 `!member` 체크)와 `:828`(신규 `affected === 0` 체크) — 둘 다 `removeMember()` 내부, 동일 메서드
  - 상세: 이번 diff 가 추가한 `if (affected === 0) { throw new NotFoundException({ code: 'MEMBER_NOT_FOUND', message: '멤버를 찾을 수 없습니다.' }); }` (:826-831) 이 같은 메서드 안에 이미 있던 동일 리터럴(:786-789)을 그대로 복제한다. 그런데 바로 이 문제(같은 not-found 리터럴이 한 메서드 안의 "두 판정" — 존재 확인 + `affected===0` — 에서 중복)는 형제 fix 인 `integrations.service.ts`(#1372) 가 **이미 겪고 고친 것**이다. `integrations.service.ts:606-616` 의 `throwIntegrationNotFound()` 바로 위 주석이 이렇게 말한다: "«없다» 를 그대로 던진다 — 형제 `triggers.service.ts` 의 `throwTriggerNotFound()` / `schedules.service.ts` 의 `throwScheduleNotFound()` 선례와 같은 이유다. 같은 리터럴이 `findById`·`update`·`remove`(두 판정)·`rotate`(두 판정)·`requireEntity` 까지 파일 전체 7곳으로 늘어 있었다 (`/ai-review` `review/code/2026/09/21/10_54_47` maintainability WARNING 2)." 즉 이 정확한 유형의 중복이 불과 한 PR 전에 maintainability 리뷰에서 WARNING 으로 지적되어 `schedules.service.ts`(`throwScheduleNotFound`, :151)·`integrations.service.ts`(`throwIntegrationNotFound`, :613) 두 형제 모두 private 헬퍼로 뽑았는데, 이번 `workspaces.service.ts` 의 `removeMember()` 는 같은 조치 없이 리터럴을 그대로 다시 복제했다.
  - 제안: `private throwMemberNotFound(): never { throw new NotFoundException({ code: 'MEMBER_NOT_FOUND', message: '멤버를 찾을 수 없습니다.' }); }` 형태로 추출해 `removeMember()` 의 두 판정(그리고 필요하면 `updateMemberRole()` 의 `:312`, 다른 메서드의 `:745` 도)에서 재사용한다. 형제 두 파일의 선례를 그대로 따르면 된다.

- **[WARNING]** 테스트 헬퍼 `getAudit()` 가 같은 파일에 두 번 동일하게 정의된다
  - 위치: `codebase/backend/src/modules/workspaces/workspaces.service.spec.ts:1458`(신규, `describe('removeMember — 동시 제거', ...)` 안) — 기존 정의는 `:1154`(`describe('audit logging (결정4=B)', ...)` 안)
  - 상세: 두 정의가 바이트 단위로 동일하다: `function getAudit(): { record: jest.Mock } { return (service as unknown as { auditLogsService: { record: jest.Mock } }).auditLogsService; }`. 두 `describe` 블록이 같은 최상위 `describe('WorkspacesService', ...)` 의 형제(sibling)라 서로의 지역 함수를 참조할 수 없어서 복제된 것으로 보이는데, 최상위 `describe` 스코프로 한 번만 끌어올리면 모든 하위 블록이 공유할 수 있다.
  - 제안: `getAudit()` 정의를 최상위 `describe('WorkspacesService', () => { ... })` 바로 아래(또는 파일 최상단 모듈 스코프)로 한 번만 옮기고, `:1154`·`:1458` 두 지역 정의를 제거해 모든 `it` 블록이 공유하게 한다.

- **[INFO]** 새 `describe` 블록의 로컬 상수 네이밍이 파일의 기존 컨벤션과 다르다
  - 위치: `codebase/backend/src/modules/workspaces/workspaces.service.spec.ts:1454-1456` (`const WS = 'ws-uuid-1'; const MEMBER_ID = 'mem-1'; const REQUESTER = 'admin-user';`)
  - 상세: 파일의 다른 곳(`:939-940` 등)에서는 같은 성격의 로컬 테스트 픽스처 상수를 `requesterId`·`newOwnerMemberId` 처럼 camelCase 로 쓴다. `WS`/`MEMBER_ID`/`REQUESTER` 만 SCREAMING_SNAKE_CASE 로 튀어, 같은 파일 안에서 "이 이름이 모듈 레벨 상수인가 지역 픽스처인가"를 헷갈리게 할 수 있다.
  - 제안: `ws`/`memberId`/`requester` 로 camelCase 통일 (기능상 문제는 아니므로 급하지 않음).

- **[INFO]** 새 e2e 파일 안에서 두 테스트가 "락 대기 → 공허성 가드 → COMMIT → 정렬 → finally 정리" 레이스 오케스트레이션 블록을 거의 그대로 반복한다
  - 위치: `codebase/backend/test/member-remove-concurrency.e2e-spec.ts:88-117`(첫 번째 `it`) 와 `:167-193`(두 번째 `it`) — 또한 요청 빌더 `fireRemove`(:78-86)와 `fireLeave`(:157-165)도 Authorization 헤더 값만 다르고 나머지는 동일
  - 상세: 형제 다섯 개의 `*-delete-concurrency.e2e-spec.ts` 는 파일당 `it` 이 하나뿐이라 이 중복이 생기지 않았는데, 이 파일은 (자가 탈퇴 갈래를 실증하라는 plan §C-1 요구 때문에) 파일 하나에 구조가 거의 동일한 테스트 두 개를 담아 처음으로 파일 내부 중복이 생겼다. `1_500`ms 타임아웃·`Promise.race` 공허성 가드·`locker` BEGIN/FOR UPDATE/COMMIT/ROLLBACK 시퀀스가 두 번 반복된다.
  - 제안: `raceConcurrentRequests(fire: () => Promise<{status,code}>)` 류의 지역 헬퍼로 뽑아 두 `it` 이 공유하면 향후 세 번째 갈래(예: owner 승격 TOCTOU 가 별도 사안으로 처리될 때)가 추가돼도 복제가 늘지 않는다. 급한 사안은 아니다(테스트 코드, 가독성엔 큰 지장 없음).

## 참고 (리뷰 범위 안내)

`plan/in-progress/member-dup-remove.md`, `plan/in-progress/spec-draft-nullable-notation-followups.md`, `review/consistency/2026/09/21/12_23_48/**` (SUMMARY.md·`_retry_state.json`·`meta.json`·4개 checker 출력)는 애플리케이션 코드가 아니라 계획 문서/이전 `consistency-check` 실행의 산출 아티팩트다. 가독성·네이밍·함수 길이·중첩·매직넘버·중복·복잡도·일관성이라는 이번 점검 관점이 적용될 대상이 아니어서 개별 발견사항을 내지 않았다.

## 검증용 뮤테이션

이번 리뷰에서는 코드를 고쳐보지 않았다 — 정적 판독(`Read`)과 `grep`/`sed -n` 을 이용한 대조 확인만 수행했다. `git status --short` 로 확인한 결과 이 세션이 저장소에 남긴 변경은 없다(사전에 존재하던 `review/code/2026/09/21/12_57_05/` untracked 디렉터리만 있음, 내가 만든 것 아님).

## 요약

핵심 프로덕션 코드 변경(`workspaces.service.ts` 의 `removeMember()` 원자적 `DELETE`+`affected` 판정 전환)은 형제 다섯 개(#1369~#1372)의 검증된 패턴을 그대로 따르고 있고, 그 자체의 로직·주석은 읽기 쉽고 근거가 충분하다. 다만 같은 메서드 안에서 `NotFoundException` 리터럴을 두 번 복제한 것은, 바로 그 문제 때문에 형제 두 파일(`schedules.service.ts`·`integrations.service.ts`)이 직전 PR 의 maintainability 리뷰에서 지적받아 `throwXNotFound()` 헬퍼로 이미 추출해 둔 선례를 이번 PR 만 따르지 않은 것이라 일관성 관점에서 되짚어볼 가치가 있다. 테스트 쪽은 새 `describe` 블록이 읽기 쉽고 각 케이스의 의도(대조군 `it.each`, 위임 경계 고정 등)를 주석으로 잘 붙들고 있으나, `getAudit()` 헬퍼 중복 정의와 새 e2e 파일 내부의 레이스 오케스트레이션 중복은 사소하지만 쉽게 정리할 수 있는 개선 여지다. 전반적으로 차단할 정도의 문제는 없다.

## 위험도

LOW
