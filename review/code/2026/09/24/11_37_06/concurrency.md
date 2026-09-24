# 동시성(Concurrency) 리뷰 — `removeMember` 인가 순서 재배치

## 발견사항

- **[INFO]** 요청자 자신의 admin 권한 판정에 대한 TOCTOU 창이 소폭 넓어졌으나, 형제 메서드와 같은 패턴이다
  - 위치: `codebase/backend/src/modules/workspaces/workspaces.service.ts:831`(`requesterRole` 읽기) ·
    `:834`(대상 `findOne`, await) · `:847`(`ADMIN_ROLES.has(requesterRole)` 사용) ·
    `:877`(실제 `DELETE`)
  - 상세: 종전 코드는 `await this.assertAdmin(workspaceId, requesterId)` 가 owner 판정
    직후·DELETE 직전에 있어(`fresh getMemberRole` → 곧바로 사용) 요청자의 admin 권한을
    "읽은 시점"과 "실제 삭제 실행 시점" 사이 간극이 사실상 0에 가까웠다. 이번 diff 는
    `requesterRole` 을 함수 맨 앞(`:831`)에서 한 번만 읽고, 그 값이 실제로 판정에 쓰이는
    `:847` 까지 사이에 대상 멤버 `findOne`(`:834`, await 1회)이 끼어든다. 이론상 그 사이에
    다른 요청이 이 요청자를 admin→editor 로 강등해도, 이 실행은 강등 이전에 읽은
    `requesterRole` 값으로 `ADMIN_REQUIRED` 없이 통과해 `DELETE` 까지 도달할 수 있다 —
    요청자 자신의 권한에 대한 authorization TOCTOU 다. 다만 같은 파일의 형제
    `addMemberByEmail`(`assertAdmin` 뒤에 `findOne`·`findOne`·`save` 최소 3개 await)와
    `updateMemberRole`(`assertAdmin` 뒤에 `findOne`·`save` 2개 await)이 이미 이보다 크거나
    같은 간극을 갖고 있어, 이번 변경이 새로운 종류의 위험을 들여온 것은 아니고 기존
    컨벤션과 같은 크기 수준으로 수렴한 것이다. 대상이 owner 로 승격되는 동시성 케이스는
    `role: Not('owner')` 술어 + EvalPlanQual 재평가로 명시적으로 막혀 있는 것과 달리, 이
    "요청자 본인의 권한 실효"쪽은 이 diff 에도, 형제 메서드에도 대응 장치가 없다 — 실무
    영향은 낮다(짧은 창, 이미 유효했던 요청 하나가 강등 직후에도 완료되는 정도)고 판단해
    INFO 로 분류한다.
  - 제안: 즉시 조치는 불요(형제 컨벤션과 일치). 만약 "권한 회수는 즉시 반영돼야 한다"는
    요구사항이 생기면, `removeMember`/`updateMemberRole`/`addMemberByEmail` 세 곳을 한
    axis 로 묶어 DELETE/SAVE 직전에 admin 권한을 재확인하거나 트랜잭션 격리 수준을 올리는
    설계를 함께 검토할 것 — 이번 PR 단독으로 처리할 스코프는 아니다.

- **[INFO]** 이 메서드의 실제 동시성 안전장치(단일 원자적 `DELETE` + `affected===0` 명시
  비교 + EvalPlanQual 재평가)는 이번 diff 로 변경되지 않았다
  - 위치: `codebase/backend/src/modules/workspaces/workspaces.service.ts:877-896`
  - 상세: 이번 변경은 `findOne`/`assertAdmin`/owner-검사의 **순서**만 재배치했을 뿐,
    동시 `transferOwnership` 대 `removeMember` 경쟁을 가르는 `role: Not('owner')` 술어와
    `affected === 0` 판정, 그리고 그 재조회 로직(존재/owner 구분)은 그대로다. 재배치가
    이 부분의 원자성 보장에 부정적 영향을 준다는 근거는 찾지 못했다 — 인가 단계에서
    먼저 걸러지는 요청자 집합이 줄어들 뿐, DELETE 문 자체의 조건절·타이밍은 불변이다.
  - 제안: 없음(확인용 기록).

- **[INFO]** 신규 e2e 동시 프로브(`workspace-rbac.e2e-spec.ts`)는 서로 다른 리소스를
  대상으로 해 인터리빙 위험이 없다
  - 위치: `codebase/backend/test/workspace-rbac.e2e-spec.ts:716-720`
    (`Promise.all([probe(absentMemberId), probe(ownerMemberId), probe(editorMemberId)])`)
  - 상세: 세 병렬 요청이 같은 워크스페이스에 대해 서로 다른 `memberId` 를 대상으로 하고,
    요청자(outsider)는 비-멤버라 `NOT_A_MEMBER` 로 조회 자체 없이 끝난다(코드상
    `getMemberRole` 만 3회 동시 실행되는 읽기 전용 쿼리). 공유 가변 상태에 대한 쓰기가
    없으므로 경쟁 조건이나 assertion flakiness 위험이 없고, `Promise.all` 완료 후에야
    `db.query` 로 행 수를 확인해 순서도 올바르다.
  - 제안: 없음.

- **[INFO]** `getMemberRole` 은 인스턴스 상태를 공유하지 않는 순수 읽기 헬퍼라 서비스
  싱글턴 재사용에 따른 스레드 세이프티 문제가 없다
  - 위치: `codebase/backend/src/modules/workspaces/workspaces.service.ts:109-117`
  - 상세: 매 호출마다 새 쿼리를 던지고 인스턴스 필드에 캐싱하지 않는다. Nest 의 기본
    provider scope(singleton)에서 동시 요청 간 상태가 섞일 여지가 없다.
  - 제안: 없음.

- **[INFO]** async/await 누락 없음
  - 위치: `codebase/backend/src/modules/workspaces/workspaces.service.ts:831, 834, 877` /
    `throwNotAMember()`·`throwAdminRequired()` (동기 thrower, `:913-926`)
  - 상세: 새로 추가된 두 읽기(`getMemberRole`, `findOne`)는 모두 `await` 로 받고 있고,
    새로 뽑아낸 thrower 두 개는 항상 던지기만 하는 동기 함수(`never` 반환)라 await 대상이
    아니다. 콜백 지옥·Promise 체인 문제도 없다.
  - 제안: 없음.

## 요약

`removeMember()` 의 인가 판정 순서 재배치는 이번 diff 의 핵심이지만, 그 재배치가 건드리는 것은
"어느 예외가 언제 던져지는가"이지 실제 동시성 안전장치(단일 원자적 `DELETE` + `role:
Not('owner')` 술어 + `affected===0` 명시 비교, owner 승격 경쟁을 막는 EvalPlanQual 재평가)가
아니다 — 그 부분은 이번 diff 에서 손대지 않았고 그대로 유효하다. 유일하게 새로 눈에 띄는
동시성 관측은 요청자 자신의 admin 권한을 함수 맨 앞에서 한 번 읽어 재사용하면서 그 판정
시점과 사용 시점 사이에 대상 조회(`findOne`) 만큼의 await 이 끼어들어 TOCTOU 창이 이전보다
넓어졌다는 것인데, 같은 파일의 형제 메서드(`addMemberByEmail`·`updateMemberRole`)가 이미
이와 같거나 더 큰 창을 갖고 있어 새로운 위험 유형이 아니라 기존 컨벤션 수준으로의 수렴이다.
신규 e2e 동시 프로브도 서로 다른 리소스를 대상으로 해 안전하게 설계됐다. 실행 가능한 동시성
결함은 발견되지 않았다.

## 위험도

LOW
