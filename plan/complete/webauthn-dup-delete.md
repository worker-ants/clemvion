---
title: WebAuthn credential 동시 삭제도 감사 행을 두 번 남긴다 — 아홉 번째이자 마지막 자리
status: complete
owner: developer
worktree: webauthn-dup-delete-5c9f3a
started: 2026-09-21
spec_impact: none
---

# `WebAuthnService.deleteCredential()` — 아홉 번째, 마지막 자리

트래커 `plan/in-progress/spec-draft-nullable-notation-followups.md` 의 developer 항목
«WebAuthn credential 삭제도 동시 요청에서 `user.2fa_disabled` 감사를 두 번 남긴다» 를 닫는다.

## 0. 착수 게이트 — 여덟 번째 PR(#1375)이 이 PR 에 건 선행 조건

트래커가 **착수 시점에 둘을 결정하고 그 결정을 여기 적을 것**을 요구한다. 미이행 시 착수 불가.
아래가 그 결정이며, **둘 다 실측 후에 내렸다.**

### 결정 1 — 동시성 e2e 공용 헬퍼: **추출한다. 단 이 PR 이 아니라 전용 PR 에서.**

**실측**: `codebase/backend/test/` 에 이 계열 e2e 가 **여덟 개**다(101~208줄).
여섯은 행 락(`SELECT … FOR UPDATE`), 둘은 advisory lock 을 쓰고, **여덟 전부 1.5초 공허성 가드**를
쓴다. 공통부는 `BEGIN → 락 → 두 요청 발사 → 공허성 가드 → COMMIT → 정렬 → finally ROLLBACK`
오케스트레이션이고, 갈리는 것은 락 SQL·발사 함수·단언뿐이다.

**추출해야 하는 진짜 이유는 줄 수가 아니라 공허성 가드다.** 그 가드가 빠진 테스트는 고치기 전
코드도 통과시킨다 — 즉 **없으면 조용히 거짓 초록이 되는 부분**이고, 지금은 여덟 곳에 손으로
복제돼 있어 아홉 번째를 쓰는 사람이 빠뜨릴 수 있다. 설계:

```ts
// codebase/backend/test/helpers/concurrency.ts
export async function raceUnderHeldLock<T>(
  locker: Client,
  lock: { sql: string; params: unknown[] },
  fire: () => Promise<T>,
): Promise<T[]>;   // BEGIN → 락 → [fire(), fire()] → 1.5s 공허성 가드 → COMMIT → 결과
```

**왜 이 PR 이 아닌가**: 아홉 파일을 한꺼번에 바꾸는 것은 **테스트 전용 리팩터**라 프로덕션
위험이 없고 단독으로 검토하기 쉽다. 그것을 webauthn 모듈의 버그 수정과 한 diff 에 섞으면,
이 세션 내내 리뷰어들이 반복해 지적해 온 «스코프 혼입» 이 된다. **트래커에 설계째로 등재**하고
이 PR 에서는 기존 패턴을 그대로 쓴다.

> 이것이 «또 유예» 가 아닌 이유: 앞선 유예들은 «다음에 재검토하자» 였다. 이번 결정은
> **추출한다**이고, 시그니처·범위(아홉 파일)·성격(테스트 전용)·분리 사유가 전부 정해져 있다.

### 결정 2 — `affected` 판별자 유틸(`isDeleteMiss()` 류): **추출하지 않는다.**

리뷰(`review/code/2026/09/21/17_08_12` architecture)가 «관용구가 서비스 여덟 곳에 손으로
복제돼 있다» 며 최소 추출을 제안했다. **거절하고, 그 근거는 비용이 아니다.**

**실측**: `affected === 0` 을 삭제 판별자로 쓰는 자리는 다섯이다 —
`auth-configs`·`integrations`·`model-config`·`workspaces`·`schedules`.
(`workflows` 는 `parentPresence`, `triggers` 는 락 안 재조회라 이 계열이 아니다.)
**그 다섯 전부가 «드라이버 미보고» 대조군 테스트를 이미 갖고 있다**(실측 확인).

지키려는 불변식은 «`!affected` 로 쓰지 말 것» 인데,
- `isDeleteMiss(affected)` 는 그 **비교를 호출부에서 감춘다**. 정작 위험한 것은 헬퍼 **본문**이
  `!affected` 로 구현되는 것이고, 그러면 위험이 사라지는 게 아니라 **한 곳으로 옮겨가면서
  리뷰어가 볼 수 있는 자리에서는 사라진다.**
- 실제로 이 불변식을 지킨 것은 대조군 테스트다. #1371 에서 그것이 없었을 때 `!affected`
  뮤턴트가 **32건을 통과**했고, 넣자 곧바로 RED 가 됐다.

즉 **방어는 이미 있고 그것은 헬퍼가 아니다.** 12자짜리 명시 비교를 헬퍼로 감싸면 방어가
약해진다. 이 판단을 트래커에도 남겨 다음 사람이 같은 제안을 재발명하지 않게 한다.

## A. 결함 — 이 자리가 열거 축을 바꾸게 만든 자리다

`webauthn.service.ts:518-539`:

```ts
const credential = await this.credentialRepo.findOne({ where: { id: credentialUuid } });  // 무락
if (!credential || credential.userId !== userId) throw NotFound('WEBAUTHN_CREDENTIAL_NOT_FOUND');
await this.credentialRepo.delete({ id: credentialUuid });   // ← affected 를 버린다
const remaining = await this.countCredentials(userId);
if (remaining === 0) await this.usersService.update(userId, { webauthnRecoveryCodes: null });
return { remaining };
```

그리고 감사는 **서비스가 아니라 `webauthn.controller.ts:338`** 이 남긴다(`USER_2FA_DISABLED`).

**이 자리가 «마지막» 을 세 번 틀리게 만든 원인이다**: 이미 `.delete()` 를 쓰고 있어
«`remove(entity)` 를 찾자» 축으로는 안 걸리고, 감사가 컨트롤러에 있어 «서비스에서 감사를
찾자» 축으로도 안 걸린다. **«지우고 감사한다» 는 요청 단위 서술만이 잡는다.**

## B. 형제 여덟과 다른 점 — 착수 전 실측

| 확인할 것 | 실측 |
| --- | --- |
| 이미 `.delete()` 를 쓴다 | **그렇다.** 바꾸는 것은 `remove`→`delete` 가 아니라 **버려지던 `affected` 를 판정에 쓰는 것**이다 |
| 감사 위치 | **컨트롤러**(`:338`). 서비스가 던지면 컨트롤러가 감사에 도달하지 않으므로 계약은 그대로 지켜진다 |
| 반환 계약 | `{ remaining }` — 판정을 서비스에 두되 **이 형태를 바꾸지 않는다**(진 쪽은 throw) |
| 404 코드 | `WEBAUTHN_CREDENTIAL_NOT_FOUND` — 진 쪽이 조회 실패와 같은 코드를 받아야 한다 |
| 라우트 성공 코드 | **204** (`@Delete('credentials/:id')` + `@HttpCode(HttpStatus.NO_CONTENT)`) |
| DELETE 스코핑 | **`{ id }` 뿐 — `userId` 가 없다.** 소유권은 무락 `findOne` 뒤 JS 비교로만 확인한다. 형제들이 받은 «조건절에 소유자/워크스페이스를 넣는다» 강화를 여기도 적용한다 |
| 진 쪽의 부수 쓰기 | 진 쪽도 `countCredentials` 를 돌리고 `remaining === 0` 이면 `webauthnRecoveryCodes: null` 을 **한 번 더** 쓴다. 판정을 delete 직후에 두면 둘 다 건너뛴다 |

## C. 재현을 먼저 한다

e2e 는 형제들의 행 락 기법 그대로. credential 은 **SQL 로 직접 INSERT** 한다 — 이 테스트의
대상은 동시 삭제이지 WebAuthn 등록 의식이 아니고, 등록 ceremony 를 태우면 fixture 가
테스트의 주제를 가린다.

- 단언: 상태쌍 `[204, 404]`(현행 예측은 `[204, 204]`) + 진 쪽 코드 `WEBAUTHN_CREDENTIAL_NOT_FOUND`
  + `audit_log` 의 `user.2fa_disabled` **1건**.
- 공허성 가드: 락을 놓기 **전에** 둘 다 아직 안 끝났음을 관측한다.

## 체크리스트

- [x] **착수 게이트 이행** — 위 §0 의 두 결정을 실측과 함께 기록했다
- [x] 결정 1 을 트래커에 **설계째로** 등재 (시그니처·범위·분리 사유)
- [x] 결정 2 를 트래커에 등재 (다음 사람이 같은 제안을 재발명하지 않도록)
- [x] `/consistency-check --impl-prep spec/5-system` — `review/consistency/2026/09/21/17_39_06`
      **BLOCK: NO** (Critical 0 · Warning 1).
      **W1 이 내가 #1374 에 써 넣은 주석까지 끌어왔다**: `WEBAUTHN_CREDENTIAL_NOT_FOUND` 가
      카탈로그에 없고, 게다가 **한 코드가 두 status 로 나간다** —
      `webauthn.service.ts` 의 `verifyAuthentication()` 이 `UnauthorizedException`(**401**),
      `renameCredential()`·`deleteCredential()` 이 `NotFoundException`(**404**)로 같은 코드를
      던진다(직접 실측). — **줄 번호로 적지 않는다**: 처음엔 `:403`·`:497`·`:504`·`:527` 로
      적었는데, **같은 PR 의 헬퍼 추출 커밋이 그 줄들을 곧바로 밀어냈다**(리뷰 라운드 3 W2).
      즉 `3-error-handling.md` §1.11 의 «`_NOT_FOUND`≠404 는 이 저장소에서
      유일한 예외» 가 **거짓**이고, 내가 #1374 의 `throwAuthConfigNotFound()` JSDoc 에 그 문장을
      그대로 인용했다. **spec 은 권한 밖이라 planner 항목으로 등재**했고, 내 주석도 같은 턴에
      고치도록 그 항목에 묶었다.
      리뷰어는 «두 번째 예외» 라고 했지만 정확히는 더 나쁘다 — `AUTH_CONFIG_NOT_FOUND` 는
      **항상** 400 이라 «예외이되 일관» 한데, 이쪽은 한 코드가 401/404 를 오가 클라이언트가
      코드로 분기할 수 없다. 401 자리는 로그인 검증 중 존재 노출을 막으려는 **의도**로 보이므로
      처방은 «401 을 404 로» 가 아니라 **코드 분리**이고, 그 선례를 spec 자신이 인용하고 있다.
      INFO 1(스냅샷에 `1-auth.md §5` 누락)도 그 자리에서 더했다
- [x] **e2e 로 결함 재현** — 고치기 전 `[204, 204]` 였고(공허성 가드 통과), DB 를 직접 조회해
      한 `credentialId` 에 `user.2fa_disabled` 감사가 **2건**(둘 다 `remainingCredentials: 1`)
      임을 확인했다
- [x] 단위 테스트 + 구현 — 뮤턴트 **둘**이 예측과 일치했다: (a) `=== 0` → `!affected` →
      **대조군 2건 RED**(예측 2), (b) 404 분기 제거(고유 앵커, 6줄) → **진 쪽 1건 RED**(예측 1).
      원복은 `cp` 백업으로 했다
- [x] TEST WORKFLOW — lint PASS · unit PASS · build PASS(타입체크 ratchet 포함) ·
      **e2e 377 PASS** (`_test_logs/e2e-20260921-175842.log`)
- [x] `/ai-review` → **4라운드로 수렴** (정지 규칙 첫째 절: Critical·Warning 0).
      Warning 추이 **4 → 3 → 2 → 0**, 심각도도 함께 내려갔다.
      라운드 1 `18_03_54`: CHANGELOG 누락(이 세션 **네 번째**) · `@throws` · 헬퍼 미추출 ·
      **W4 «다른 credential 동시삭제 시 `remaining` 오판»** — 앞의 셋은 조치, **W4 는 반증**했다
      (트랜잭션이 없어 각 DELETE 가 즉시 커밋되므로 나중에 커밋하는 쪽은 항상 0 을 본다).
      라운드 2 `18_31_57`: **그 반증 캐너리 자신이 과장**이라는 지적 — 공허성 가드가 없어
      우연히 직렬화되면 통과한다. **문구를 낮추라는 제안 대신 테스트를 강화**해 두 행을 모두
      잠그고 겹침을 관측하게 했다. 라운드 3 `18_58_48`: **줄 번호 인용을 걷어낸 그 커밋이
      JSDoc 에 새 줄 번호를 써 넣었다**(한 PR 안 세 번째) → 메서드명 기반으로 교체.
      라운드 4 `19_18_43` **Critical 0 · Warning 0**(`RESOLUTION.md`)
- [x] `/consistency-check --impl-done spec/5-system` → `review/consistency/2026/09/21/19_30_19`
      **BLOCK: NO · Critical 0**. Warning 1 은 `WEBAUTHN_CREDENTIAL_NOT_FOUND` 의 401/404
      이원화·카탈로그 미등재로, **이 PR 이 만든 것이 아니고 spec 은 권한 밖**이라 planner
      항목으로 등재돼 있다(재작업 불요). INFO 3(CHANGELOG 의 «계열 종료» 선언이 트래커
      체크박스보다 먼저 적혔다)은 **이 종결 커밋이 해소**한다
- [x] 트래커 항목 해소 + 이 plan `plan/complete/` 로 + **이 계열 종료 선언** — 넷을 한 커밋으로
      (체크박스 · 해소 마커 · 파일 이동 · frontmatter). 리뷰 INFO 6 이 그 넷이 한 동작이어야
      한다고 짚었고, 이 저장소가 반복해 놓친 자리다

## 이 PR 이 남긴 후속 — 셋 다 근거와 함께 등재됨

1. **동시성 e2e 공용 헬퍼 추출**(`raceUnderHeldLock()`) — §0 결정 1. 전용 PR, 아홉 파일, 테스트 전용.
2. **`deleteCredential()` 트랜잭션 래핑** — 라운드 1 W4 추적. **착수하면 이 PR 의 e2e 캐너리가
   RED 가 된다** — 캐너리의 순서 논증이 «트랜잭션이 없다» 를 전제하기 때문이다. 그 RED 는
   회귀가 아니라 **전제가 바뀌었다는 신호**다. 미리 적지 않으면 다음 사람이 회귀로 오진한다.
3. **`WEBAUTHN_CREDENTIAL_NOT_FOUND` 401/404 이원화 + §1.11 «유일한 예외» 거짓** — planner 트랙.
   내가 #1374 JSDoc 에 그 거짓 문장을 인용했으므로 **같은 턴에 그 주석도 고치도록 묶여 있다**.
