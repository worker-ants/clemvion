---
title: removeMember 의 권한 검사가 대상 조회보다 뒤에 있어 존재 오라클이 된다
status: complete
owner: developer
worktree: member-auth-order-8c4d1f
spec_impact: none
started: 2026-09-24
completed: 2026-09-24
---

# 인가보다 조회가 먼저라, 인가받지 못한 사람도 답을 세 갈래로 받는다

트래커 `plan/in-progress/spec-draft-nullable-notation-followups.md` 의 developer 항목
«`removeMember()` 의 권한 검사가 대상 조회·owner 판정보다 뒤에 있어 존재 오라클이 된다»
(중간)를 닫는다. `/ai-review` 가 **세 라운드 연속**(#1384 의 1·2·3라운드) 재확인한 항목이다.

현재 순서는 `findOne` → 404 → self 위임 → owner 403 → `assertAdmin` 이다. 그래서
`(workspaceId, memberId)` 쌍에 대해 **세 갈래로 구분되는 응답**이 나간다:

| 대상 상태 | 응답 |
| --- | --- |
| 없음 | `404 MEMBER_NOT_FOUND` |
| 있고 owner | `403 CANNOT_REMOVE_OWNER` |
| 있고 비-owner | `403 ADMIN_REQUIRED` |

**받는 사람에 제한이 없다.** `RolesGuard` 는 전역 `APP_GUARD` 지만 `@Roles()` 가 없고
`handlerConsumesWorkspaceId` 가 false 면 단락하는데(`roles.guard.ts:116`), 이 핸들러는
`@WorkspaceId()` 가 아니라 `@Param('id')` 를 쓴다 → **유효 JWT 만 있으면 비-멤버도 도달한다.**

## A. 착수 전 실측

| 확인 | 실측 |
| --- | --- |
| 형제 Admin+ 메서드는 어떻게 하나 | **둘 다 대상 조회 전에 인가한다** — `addMemberByEmail` 은 `assertWorkspaceType` → `assertAdmin` (`:256-257`), `updateMemberRole` 은 `assertAdmin` 이 **첫 await** (`:306`) 뒤에 `findOne`(`:307`). `removeMember` 만 예외다 |
| 현재 동작을 고정하는 테스트가 있나 | **0건.** `ADMIN_REQUIRED`·`NOT_A_MEMBER` 단언은 있지만 전부 `updateWorkspaceSettings`·다른 경로용이고, `workspace-rbac.e2e-spec.ts` 의 멤버 경로 단언은 **owner 가 PATCH** 하는 자리다 |
| `NOT_A_MEMBER` 가 정식 코드인가 | 있다 — `3-error-handling.md:49` 에 **403** 으로 등재. 설명이 열거하는 경로는 «전환·탈퇴·멤버십 확인» 이라 이 자리가 새 발행처가 된다(§E) |
| spec 이 비-멤버 응답을 규정하나 | **안 한다** — `data-flow/12-workspace.md:141` 은 권한을 «owner / admin» 으로만 적는다 → `spec_impact: none` |

> **`spec_impact: none` 이 «spec drift 0» 을 뜻하지는 않는다.** 이 필드가 묻는 것은 «이 작업이
> `spec/` 파일을 바꾸는가» 이고, 답은 **하나도 안 바꾼다** 이다. 리팩터가 남긴 낡은 서술 셋(§E)은
> developer 권한 밖이라 planner 로 넘겼는데, 그 이관이 이 필드를 `none` 이 아니게 만들지는
> 않는다. 같은 모양의 선례: `plan/in-progress/auth-guard-reflection-hardening.md`
> (`spec_impact: none` · developer 소유 · spec 정정은 planner 위임).
> `--impl-done` `11_50_40` INFO#5 가 이 대조를 남겨 두라고 했다 — 선례 위치는 `complete/` 가
> 아니라 `in-progress/` 다(인용 전에 확인했다).

## B. 처방 — `assertAdmin` 을 앞으로 옮길 수는 없다

형제처럼 `assertAdmin` 을 첫 줄에 두면 **자가 탈퇴가 깨진다.** 비-admin 멤버도 자기 자신은
제거할 수 있어야 하고(그 갈래는 `leaveWorkspace` 로 위임된다), 자기 자신인지는 **대상을 읽어야**
안다. 그래서 인가를 두 단으로 나눈다:

```
requesterRole = getMemberRole(...)        ← 한 번 읽는다
  없으면 403 NOT_A_MEMBER                  ← 비-멤버는 여기서 끝난다
findOne(대상) → 404
  self 면 leaveWorkspace 위임              ← 비-admin 도 여기까지는 온다
  admin 아니면 403 ADMIN_REQUIRED          ← 위에서 읽은 role 을 재사용
  대상이 owner 면 403 CANNOT_REMOVE_OWNER  ← 인가가 끝난 **뒤**의 대상 조건
```

**admin 판정이 owner 판정보다 앞이다.** 순서를 뒤집으면(= 현행) 비-admin 멤버가 owner 를
지목했을 때 `CANNOT_REMOVE_OWNER` 를 받는데, 그 메시지는 **«대상이 owner 만 아니면 가능하다»
는 거짓 함의**를 준다 — editor 는 누구도 제거할 수 없다. 인가를 먼저 끝내고 대상 조건을 나중에
보는 것이 형제 둘(`addMemberByEmail`·`updateMemberRole`)의 순서와도 같다.

> **이 전환은 예고돼 있었다.** `workspaces.service.spec.ts:1651-1656` 의 註가
> *"후속 PR 이 `assertAdmin` 을 앞으로 옮길 예정이라 «어느 단계에서 거부되는가» 가 아니라
> «`ADMIN_REQUIRED` 로 거부되고 `delete` 가 호출되지 않는다» 는 불변만 본다"* 라고 적고
> 테스트를 **순서-독립으로** 써 뒀다. 실측: 그 테스트도, `owner 는 지우지 않는다`(요청자가
> owner 라 admin 판정을 통과한다)도 이 변경에 깨지지 않는다.

**왜 이것이 완전한 차단인가 — 실측이 근거다.** 멤버로 좁히면 «멤버는 여전히 세 갈래를 본다»
가 남는데, **그 멤버는 이미 같은 정보를 가지고 있다**:

> `listMembers` 는 `assertMembership` 만 요구하고(`:218`) 워크스페이스의 **모든 멤버**에 대해
> `id` · `userId` · `email` · `name` · `role` · `joinedAt` 를 돌려준다(`:245` 부근 매핑).
> 즉 멤버는 `(workspaceId, memberId)` 의 존재 여부와 owner 여부를 **정상 API 로 이미 안다.**
> 따라서 오라클을 멤버로 좁히는 것은 «노출 대상을 줄이는 완화» 가 아니라 **새로 얻는 정보를
> 0 으로 만드는 것**이다.

**조회를 두 번 돌리지 않는다.** `assertMembership` 과 `assertAdmin` 은 **둘 다**
`getMemberRole` 을 부른다(`:889`, `:902`) — 앞에 `assertMembership` 을 그냥 끼우면 같은 쿼리가
두 번 돈다. 요청자 role 을 한 번 읽어 두 판정에 쓰고, 두 예외의 리터럴은
`throwNotAMember()` · `throwAdminRequired()` 로 뽑아 기존 두 assert 도 그것을 쓰게 한다
(같은 코드가 다른 메시지를 내는 것을 막는다 — `throwMemberNotFound()` 선례).

## B-2. 「두 번 기각된 수동-체크 패턴의 재도입」이라는 지적에 답한다

`--impl-prep` `10_22_24` 의 `rationale_continuity` **WARNING 1**: 이 처방이 저장소가 두 번
근거를 남기며 기각한 opt-in/수동-체크 계열과 같은데 plan 이 그 Rationale 을 인용·반박하지
않는다. 읽어 보고 답한다 — **같은 계열이 아니다**, 근거 셋:

1. **기각된 것은 «가드 갭을 라우트별 마커로 메우는 체계적 처방»이다.**
   `spec/data-flow/12-workspace.md` §«멤버십 검증은 가드 1곳에서»(2026-08-08)가 기각한 대안은
   *"73개 라우트에 `@Roles('viewer')` 부착 — opt-in 모델의 연장이라 **74번째 라우트에서 같은
   누락이 재발**한다"* 다. 이 PR 은 그 체계적 처방을 자처하지 않는다 — 13-라우트 축을 **명시적으로
   분리**하고(§E), 그 항목에 «구조적 해법 우선» 조건을 박는다.

2. **그 결정의 «적용 범위» 가 이 라우트를 담은 적이 없다.** 같은 절이 대상을
   *"워크스페이스 컨텍스트를 소비하는 인증된 라우트"* 로 적고, 모집단을 `@WorkspaceId()` 소비로
   **연산적으로** 정의했다(`handlerConsumesWorkspaceId`). 이 핸들러는 `@Param('id')` 를 쓰므로
   그 모집단 밖이었다 — **안전해서가 아니라 세는 방법 때문에.** 따르지 않는 것이 아니라
   따를 대상이 아니었고, 그 구멍 자체가 §E 의 축이다.

3. **이것은 새 인가 층이 아니라 이미 있는 인가의 재배치다 — 실측.**
   `assertAdmin` 은 `if (!role || !ADMIN_ROLES.has(role))` 라 **비-멤버를 이미 거부한다**
   (`:903`). 즉 비-멤버는 전에도 거부됐고, 다만 **대상을 드러낸 뒤**였다. 바뀌는 것은
   «언제·어느 코드로» 뿐이다.

부수 근거: `NOT_A_MEMBER` 를 서비스 계층에서 던지는 것은 신규 관행이 아니다 —
`/switch` 와 `leaveWorkspace` 가 같은 술어에 같은 코드를 쓴다(`3-error-handling.md:49` 이
그 경로들을 열거한다).

## C. 관측 가능한 변화

| 요청자 | 전 | 후 |
| --- | --- | --- |
| 비-멤버 | `404` / `403 CANNOT_REMOVE_OWNER` / `403 ADMIN_REQUIRED` (**대상에 따라 갈림**) | **`403 NOT_A_MEMBER`** (구분 불가) |
| 멤버(비-admin), 대상이 owner | `403 CANNOT_REMOVE_OWNER` | **`403 ADMIN_REQUIRED`** |
| 멤버(비-admin), 그 외 | `404` / `403 ADMIN_REQUIRED` | 그대로 |
| admin / owner | 변화 없음 | 변화 없음 |

비-멤버는 애초에 인가받지 못한 호출자이고, 그 동작을 고정하는 테스트·spec 서술이 **0건**이다.

> **둘째 행이 트래커 캐비트가 예고한 «에러 코드 계약 변경» 이다.** `--impl-prep` `10_22_24` 의
> `plan_coherence` W2 는 그 캐비트를 stale 이라 봤는데, 그것은 **개정 전 §C**(admin 판정을
> owner 판정 뒤에 두는 안)를 읽은 것이다. 위 §B 에서 순서를 뒤집었으므로 **캐비트는 유효하고**,
> 그것이 요구한 «`3-error-handling.md` 기준의 자체 consistency 라운드» 가 바로 이
> `--impl-prep spec/5-system` 이다(`naming_collision` 이 *"재사용 에러 코드는 기존 의미와 동일"*
> 로 직접 판정했다). `--impl-done` 에서 실제 diff 기준으로 한 번 더 확인한다.
>
> 관련 spec 서술은 깨지지 않는다 — `1-auth.md:377` 은 *"**Admin** 의 멤버 삭제는 대상이 Owner 인
> 경우 거부된다(`CANNOT_REMOVE_OWNER`)"* 로 **admin 을 주어로** 적고, admin 경로는 불변이다.

## D. TDD

- [x] **먼저 RED** — 실측 **`Expected 1, Received 3`** (집합 크기). 세 탐침이 서로 다른 답을 줬다.
- [x] 고친 뒤 셋 다 `403 NOT_A_MEMBER` — 집합 크기 **1**.
- [x] **비-admin 멤버 갈래도 고정** — «비-admin 이 owner 를 지목하면 `CANNOT_REMOVE_OWNER` 가
      아니라 `ADMIN_REQUIRED` 다» 단위 블록.
- [x] 뮤턴트 4종 — 아래 표(전부 예측=실측).

> **헤더를 붙이지 않는 것이 e2e 의 핵심이다.** `X-Workspace-Id` 를 주면 `RolesGuard` 가
> header-first 멤버십 검증으로 막아 **고치기 전에도 초록**이 된다. 누수는 경로 파라미터로만
> 워크스페이스를 받는 라우트에서 열린다.

> **단언을 «세 값이 다르다» 로 쓴다.** 각 값을 따로 단언하면 고친 뒤 셋을 전부 바꿔야 하고,
> 그러면 «구분 불가» 라는 **성질**이 아니라 값 세 개를 고정하게 된다. 성질을 직접 단언하면
> 그 성질이 깨질 때만 RED 다.

## E. 하지 않는 것 — 13개 라우트 축은 이 PR 이 닫지 않는다

트래커 항목의 註가 더 큰 축을 적어 뒀다: 같은 컨트롤러에서 경로 `:id` 를 워크스페이스로 쓰면서
`@WorkspaceId()` 도 `@Roles()` 도 없는 라우트가 **17개 중 13개**이고, 전부 가드 층에서 아무
보호를 받지 못한다. 처방이 «가드가 경로 파라미터 워크스페이스도 보게 할 것인가» 라는 **설계
결정**이라 이 PR 의 스코프가 아니다.

**그 축을 별 항목으로 갈라 등재한다** — 지금은 이 항목 안의 註로만 있어서, 이 항목을 닫으면
註까지 함께 닫힌 것처럼 보인다. 계약이 다르다(이 PR: 한 메서드의 검사 순서 / 그 축: 가드의
커버리지 모델).

> **그 항목 스코프에 조건을 박는다**: *«구조적 해법(가드가 경로 파라미터 워크스페이스도 보게
> 하기 / reflection 확장)을 **먼저** 검토하고, 불가할 때에만 라우트별 수동 체크를 표준 패턴으로
> 승인한다.»* 이 조건이 없으면 이 PR 이 13개 라우트에 같은 패치를 복제하는 선례로 읽힌다 —
> 정확히 2026-08-08 결정이 *"74번째 라우트에서 재발한다"* 며 기각한 모양이다
> (`--impl-prep` `10_22_24` `rationale_continuity` W1 의 요구).

또 하지 않는 것: `NOT_A_MEMBER` 카탈로그 설명의 경로 열거에 이 자리를 추가하는 것 —
`spec/` 은 developer 권한 밖이라 planner 항목으로 등재한다.

## 체크리스트

- [x] `/consistency-check --impl-prep spec/5-system` → **BLOCK: NO · Critical 0 · Warning 2**
      (`review/consistency/2026/09/24/10_22_24`). W1(두 번 기각된 수동-체크 계열 재도입)은
      §B-2 에서 Rationale 을 읽고 근거 셋으로 답했고, **그 과정에서 설계를 바꿨다**(admin 판정을
      owner 판정 앞으로 — §B). W2 는 개정 전 §C 를 읽은 것이라 §C 의 註로 답했다.
- [x] e2e 로 오라클 재현 — **실측 RED: `Expected 1, Received 3`**
      (`_test_logs/e2e-20260924-103421.log` 이전 라운드). 고친 뒤 집합 크기 **1**.

### 뮤턴트 — 예측과 대조

| 뮤턴트 | 예측 | 실측 | 죽은 테스트 |
| --- | --- | --- | --- |
| **M1**: 멤버십 검사 제거 | — | **무효(컴파일 실패)** | `TS2345` — `ADMIN_ROLES.has(requesterRole)` 가 그 검사의 null-좁히기에 기댄다 |
| **M1′**: 검사 제거 + `as string` | unit 1 · e2e 1 | **1 · 1** | 단위 «비-멤버는 대상을 조회하기 전에…» · e2e 오라클(**`Received: 2`**) |
| **M2**: admin/owner 순서 원복 | unit 1 | **1** | «비-admin 이 owner 를 지목하면 … ADMIN_REQUIRED» |
| **M3**: 대상 **조회만** 앞으로(판정 순서 유지) | unit 1 · **e2e 0** | **1 · 0** | 단위만. e2e 380 PASS |

**M1 이 무효였다는 것 자체가 결과다** — 이 검사는 타입 수준에서 지지대다. 빼면 admin 판정의
인자가 `string | null` 이 돼 컴파일이 멈춘다. 다만 «타입이 막아 주니 됐다» 로 끝내지 않고
캐스트를 넣어 **행동**까지 쟀다(M1′).

**M1′ 의 `Received: 2` 가 두 변경의 분업을 보여 준다.** 3 이 아니다 — admin 판정을 owner
판정 앞으로 옮긴 것만으로 owner/비-owner 구분이 이미 사라졌고, 멤버십 검사가 남은 «존재»
한 갈래를 닫는다. 둘 중 하나만 해서는 오라클이 남는다.

**M3 이 단위 단언의 존재 이유다.** 대상을 읽되 판정 순서를 유지하면 응답이 같아 **e2e 는
잡지 못한다**(380 PASS). «대상 조회가 없었다» 를 단위에서 직접 보지 않으면, 코드만 고치고
조회를 남겨 둔 편집이 통과한다.
- [x] 구현 (단일 읽기 + thrower 추출)
- [x] 뮤턴트 4종 — **전부 예측=실측** (M1 은 무효 판정 자체가 결과)
- [x] TEST WORKFLOW — lint PASS(`lint-20260924-104600.log`) · backend unit **472스위트/9945**
      (`unit-20260924-104655.log`, 신규 2) · build PASS 타입체크 ratchet 포함
      (`build-20260924-104815.log`) · **e2e 380 PASS**(`e2e-20260924-105109.log`, 379 → 380)
- [x] 13-라우트 축 별 항목 등재(스코프 조건 포함) + spec stale 서술 **셋**을 planner 항목
      하나로 묶어 등재(`3-error-handling.md:46`·`:49` · `1-auth.md:551`)
- [x] `/ai-review` → **2라운드 수렴** (Critical 1/Warning 5 → Critical 0/Warning 1,
      마지막 라운드 `codebase/**` 수정 0건)
      - [x] 1라운드 `review/code/2026/09/24/11_10_45` — **Critical 1 · Warning 5**, 전부 조치
            (`RESOLUTION.md`). Critical 은 **CHANGELOG 미갱신** — 직전 PR 에서 같은 지적을
            받고 «사실을 뒤집었으면 그 자리를 전부 훑어라» 고 써 놓고 또 놓쳤다.
            W1 은 실질 갭이었다: 기존 self 테스트가 요청자 owner 라 «self 위임이 admin 판정
            앞» 계약을 못 갈랐고, 뮤턴트 M4 로 그 지적이 맞음을 확인했다(1/1).
      - [x] 2라운드 `review/code/2026/09/24/11_37_06` — **Critical 0 · Warning 1 → 수렴**.
            W1 은 트래커가 아직 없는 `plan/complete/…` 경로를 인용한 것 — «곧 참이 될 것을
            지금 참인 것처럼 쓴» 형태를 **세 번째** 밟았다(#1377 각주 · #1384 CHANGELOG ·
            이번 트래커). 시제를 문장에 명시하는 것으로 고쳤다.
            그 라운드의 `codebase/**` 수정 **0건**이라 정지 규칙을 충족한다.
            INFO 두 칸(판정 순서 커버리지)은 수렴 예외 (a)~(d)로 트래커 등재.
- [x] `/consistency-check --impl-done spec/5-system` → **BLOCK: NO · Critical 0 · Warning 0**
      (`review/consistency/2026/09/24/11_50_40`). INFO 5건 전부 «조치 불요» 또는 이미 등재.
      `rationale_continuity` 가 *"직전 impl-prep WARNING(기각된 opt-in 패턴 재도입 우려)이
      plan §B-2 의 3단 반박으로 **실측상 해소**"* 로 종결했다.
- [x] 트래커 항목 해소 + plan `complete/` 로 (**한 커밋으로**)
