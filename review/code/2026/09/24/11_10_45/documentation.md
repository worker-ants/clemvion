# 문서화(Documentation) 리뷰

## 발견사항

- **[CRITICAL]** CHANGELOG.md 미갱신 — 직전 항목의 전방 참조가 이제 거짓이 됐다
  - 위치: `CHANGELOG.md:31` (기존 항목, 이 PR 이 건드리지 않음) / 이 PR 이 추가해야 할 신규 항목 없음
  - 상세: `CHANGELOG.md:31`(커밋 `fc56873be`, 바로 앞 PR)은 *"**남는 것**: `removeMember()` 의 권한
    검사 순서 오라클은 여전히 열려 있다"* 라고 명시적으로 예고했다. 이번 PR(`member-auth-order`)이
    정확히 그 오라클을 닫는데도(§C 「비-멤버 → 항상 `403 NOT_A_MEMBER`」), `git diff --stat`
    상 `CHANGELOG.md` 는 이 PR 의 변경 파일 13개에 **포함돼 있지 않다**. 같은 파일의
    `:130`·`:173` 은 선행 항목이 후속 PR 로 닫힐 때 `~~취소선~~`/`<del>` 으로 전방 참조를
    정정하는 관례를 이미 보여 준다 — 이번 항목만 그 관례를 건너뛰었다. `plan/in-progress/member-auth-order.md`
    의 체크리스트에도 CHANGELOG 갱신 항목 자체가 없다(빠짐없이 열거된 다른 산출물들과 대조적).
  - 제안: 이 PR 에 신규 CHANGELOG 항목(요청자 role 을 대상 조회보다 먼저 확인 → 비-멤버는 항상
    `NOT_A_MEMBER`, admin 판정이 owner 판정보다 앞으로 이동)을 추가하고, `:31` 의 "남는 것" 문장을
    `:130`/`:173` 과 같은 취소선 방식으로 정정한다.

- **[WARNING]** 오래된 주석 — `wireFindOne` 헬퍼 docstring 이 제거된 `assertAdmin()` 호출을 그대로 언급
  - 위치: `codebase/backend/src/modules/workspaces/workspaces.service.spec.ts:1473-1474` (diff 로
    바뀌지 않은 기존 줄 — `Read` 로 확인)
  - 상세: *"`removeMember` 는 `findOne` 을 두 번 부른다 — 대상 멤버(`where.id`)와, `assertAdmin` 이
    부르는 요청자 멤버십(`where.userId`)이다."* 라고 돼 있는데, 이번 diff 로 `removeMember()` 는
    더 이상 `this.assertAdmin(...)` 을 호출하지 않는다(`workspaces.service.ts` 의
    `-    await this.assertAdmin(workspaceId, requesterId);` 삭제, `+ const requesterRole =
    await this.getMemberRole(...)` 로 대체). 두 번째 `findOne` 호출은 이제 `getMemberRole()` 을
    통해 직접 나가는 것이지 `assertAdmin()` 경유가 아니다. 같은 파일의 새 JSDoc
    (`throwNotAMember()` 위, `:908-912`)은 *"요청자 role 을 **직접** 읽어 재사용하는
    `removeMember`"* 라고 정확히 적어 두 서술이 서로 어긋난다.
  - 제안: `:1473-1474` 를 "`assertAdmin` 이 부르는" → "`removeMember` 가 `getMemberRole` 로 직접
    읽는" 식으로 갱신한다.

- **[WARNING]** 오래된 주석 — 「후속 PR 예고」 테스트 docstring 이 실제로 구현된 설계와 다른 서술로 남음
  - 위치: `codebase/backend/src/modules/workspaces/workspaces.service.spec.ts:1660-1664` (diff 로
    바뀌지 않은 기존 줄)
  - 상세: *"트래커에 등재된 권한 검사 순서 결함 ... **후속 PR 이 `assertAdmin` 을 앞으로 옮길
    예정**이라 ..."* 라는 미래형 예고 문장이 그대로 남아 있다. 이번 PR 이 바로 그 후속 PR 인데,
    실제로 한 일은 "`assertAdmin` 을 앞으로 옮긴 것"이 아니라 **`assertAdmin` 은 그대로 두고
    `removeMember` 안에 `getMemberRole` + `throwAdminRequired` 직접 호출을 새로 넣은 것**이다
    (`assertAdmin()` 자체의 정의·호출부는 형제 메서드들에서 변화 없음). `plan/in-progress/member-auth-order.md:58-62`
    는 이 문구를 인용하며 "실측: 그 테스트도 이 변경에 깨지지 않는다"까지 확인했지만, 문구 자체가
    구현 결과와 다르게 기술한다는 점은 정정하지 않았다.
  - 제안: 예고 문장을 과거형·정확한 메커니즘으로 갱신한다(예: *"이 후속 PR 은 `assertAdmin` 을
    옮기지 않고, `removeMember` 에 별도 `getMemberRole`+`throwAdminRequired` 경로를 추가했다"`).
    이 파일은 `codebase/` 소속이라 developer 권한으로 즉시 고칠 수 있다(spec 이 아님).

- **[WARNING]** 설정/API 문서 — `spec/5-system/3-error-handling.md` 의 `ADMIN_REQUIRED` 카탈로그
  설명이 이제 발행처를 하나 놓친다
  - 위치: `spec/5-system/3-error-handling.md:46`
  - 상세: *"`ADMIN_REQUIRED` ... `FORBIDDEN` 의 컨텍스트 특화 코드(`WorkspacesService.assertAdmin()`
    발행)"* 라고 발행처를 `assertAdmin()` 단수로 못박고 있다. 이번 diff 이후 `removeMember()` 는
    `assertAdmin()` 을 거치지 않고 `throwAdminRequired()` 를 **직접** 호출해 같은 코드를 던진다
    (`workspaces.service.ts` 신설 `if (!ADMIN_ROLES.has(requesterRole))
    this.throwAdminRequired();`). 의미는 동일하지만 "누가 던지는가"에 대한 서술은 더 이상 완전하지
    않다. `plan/in-progress/spec-draft-nullable-notation-followups.md` 의 같은 `--impl-prep`
    라운드가 `NOT_A_MEMBER` 카탈로그의 경로 열거 누락은 planner 항목으로 이미 등재했지만
    (`- [ ] NOT_A_MEMBER 카탈로그 설명의 경로 열거에 removeMember 가 없다`), `ADMIN_REQUIRED` 행의
    "`assertAdmin()` 발행" 단수 서술 갱신은 같은 트래커에 등재돼 있지 않다.
  - 제안: 같은 planner 백로그 항목에 `ADMIN_REQUIRED` 행도 함께 묶어 등재한다(`spec/` 은 developer
    쓰기 권한 밖).

- **[INFO]** 인라인 주석 — `removeMember()` JSDoc 의 "인가(앞의 둘)" 표현이 바로 위 5단계 순서
  목록과 위치적으로 매핑되지 않아 모호하다
  - 위치: `codebase/backend/src/modules/workspaces/workspaces.service.ts:804-808`
  - 상세: *"판정 순서: 멤버십 → 대상 존재 → self 위임 → admin → 대상이 owner 인가. **인가(앞의
    둘)**를 끝내기 전에는 대상에 대해 아무것도 답하지 않는다"*. 목록은 5단계([멤버십, 대상 존재,
    self 위임, admin, owner])인데 "인가"에 해당하는 두 단계는 위치상 1·2번째(멤버십·대상 존재)가
    아니라 1·4번째(멤버십·admin)다. 실제 코드도 대상 존재 확인(`findOne`+404, 2단계)이 admin 판정
    (4단계)보다 **먼저** 일어나므로, "앞의 둘을 끝내기 전엔 대상에 대해 아무것도 답하지 않는다"를
    목록 위치 그대로 읽으면 코드와 맞지 않는다. (실제 보장의 범위는 "비-멤버는 1단계에서 끝나
    2단계 이후로 전혀 도달하지 못한다"이고, 이미 멤버인 요청자에게 2단계의 404 가 새 정보가 아니라는
    점은 plan §B `"멤버는 이미 같은 정보를 listMembers 로 안다"` 에서 별도로 논증돼 있다 — 즉 주석의
    결론 자체는 옳지만 "앞의 둘"이라는 표현이 그 논증을 코드에 압축해 옮기지 못했다.)
  - 제안: "인가(앞의 둘)"을 "인가(멤버십·admin)"처럼 이름으로 명시하거나, 보장 범위를 "비-멤버는"으로
    한정해 다시 쓴다.

## 요약

이번 diff 자체는 문서화 수준이 높다 — 새 코드(권한 순서 재배치, `throwNotAMember`/`throwAdminRequired`
추출)마다 "왜 이 순서인가"·"왜 형제와 다른가"·"동시성과 어떻게 다른가"를 짚는 JSDoc/인라인 주석이
붙어 있고, 테스트·e2e 양쪽에 뮤턴트 판별력까지 서술한 docblock 이 달려 있으며, plan 문서
(`member-auth-order.md`)는 착수 전 실측·기각 근거·관측 가능한 변화 표까지 갖춘 모범적인 형태다.
다만 이 변경이 **기존 문서 3곳을 stale 로 만들었다** — 테스트 파일 내 두 곳(제거된 `assertAdmin()`
호출을 언급하는 헬퍼 docstring, 다른 방식으로 실현된 "후속 PR 예고" 문구)과 spec 카탈로그 1곳
(`ADMIN_REQUIRED` 발행처 서술)이며, 가장 무게 있는 갭은 **CHANGELOG 미갱신**이다 — 직전 항목이
정확히 이번 PR 이 닫는 오라클을 "남는 것"으로 예고해 뒀는데 그 전방 참조를 정정하지 않았고, 같은
파일의 기존 관례(취소선 정정)를 따르지 않았다. spec 카탈로그 건은 developer 쓰기 권한 밖이라 별도
planner 백로그 등재가 필요하다.

## 위험도

MEDIUM
