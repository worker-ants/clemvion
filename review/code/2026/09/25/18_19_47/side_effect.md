# 부작용(Side Effect) 리뷰 — review/code/2026/09/25/18_19_47 (5라운드)

## 컨텍스트

이 changeset(`codebase/**` 30개 파일)은 1~4라운드에서 이미 Critical 0 · Warning 8건(부작용 겹침분
포함)이 조치된 `workspace-path-guard` 작업의 5라운드 재검토다. 4개 RESOLUTION.md
(`16_03_32`·`16_39_25`·`17_14_49`·`17_47_18`)를 먼저 읽어, 부작용 관점에서 이미 식별·처분된 항목
(1라운드 W1/W2 — 전역 403 코드 변경·가드+서비스 이중 조회, 1라운드 stale 주석 W — `removeMember`
docstring, 2라운드 — `auth.service.ts` 비대칭 주석, 4라운드 — `countWorkspaceIdConsumingRoutes`
개명·`ADMIN_ROLES` freeze 부재)를 재확인하고, 4라운드 이후 커밋(`1f616ef05` transferOwnership 순서
수정 · `61ca58343` 양방향 순서 테스트 · `4c6f4f033` spec 정정 · `681fd6b63` 리뷰 기록)이 남긴 **새
부작용**이 있는지에 집중했다.

## 재확인 — 이전 라운드 처분이 이번 diff 에도 유효함

- `RolesGuard` 거부 응답이 전역 `@Roles()`/`@WorkspaceId()` 라우트 전체에서 `false`(기본
  `403 FORBIDDEN`)에서 코드를 실은 `ForbiddenException`으로 바뀌는 것(`roles.guard.ts` `assertMember`·
  `checkRequestContext`) — 1·2라운드 W1 에서 이미 지적·"의도된 announce 됨"으로 처분. 이번 라운드에서
  `codebase/frontend/src` 를 다시 grep 했으나 `error.code === 'FORBIDDEN'` 류를 분기하는 코드는 여전히
  0건이라 처분이 유지된다.
- 경로 워크스페이스 15곳의 가드+서비스 이중 `getMemberRole` 조회(요청당 DB 왕복 1→2회) — 1·4라운드
  W2/W7 에서 "PK 조회 1회·저빈도 관리 라우트"로 수용. `removeMember`/`auth.service.ts` 의 stale·비대칭
  주석은 각각 1·2라운드 지적 뒤 이번 diff 에 정정된 상태로 남아 있다(`workspaces.service.ts:822-829`
  의 "~~가드 층은 이 라우트를 막지 못한다~~ (2026-09-25 정정)", `auth.service.ts` 의 `switchWorkspace`
  헬퍼 주석 "가드가 같은 멤버십을 먼저 조회해 막는다 … 의도된 중복이다").
- `countWorkspaceIdConsumingRoutes` → `countWorkspaceConsumingRoutes` 개명 + 반환 타입
  `number → {requestContext, pathParam, total}` — 4라운드에서 grep 전수 확인 완료(소비처가
  `workspace-reflection-canary.ts` 내부와 그 spec 뿐, `main.ts:192`의 `assertWorkspaceIdReflectionWorks`
  공개 시그니처는 불변). 이번 라운드에서 동일하게 재확인했다(`grep -rln countWorkspace(Id)?ConsumingRoutes
  codebase` → 두 파일만).
- `ADMIN_ROLES`(`common/constants/workspace-roles.ts`)가 `Object.freeze()` 없이 세 모듈의 공유
  싱글턴이 된 것 — 4라운드 INFO 로 기록, 소비 코드가 전부 `.has()`/스프레드뿐이라 이번 diff 에서도
  뮤테이션 경로는 없다.

## 발견사항 (5라운드에서 새로 확인)

- **[INFO]** `transferOwnership` 이 4라운드 수정(W3, 커밋 `1f616ef05`)으로 **요청자 멤버십을 3회**
  조회하게 됐다 — 기존 "가드+서비스 이중 조회" 패턴의 연장이지만 이 라우트만 세 번째 조회가 추가된
  자리라 명시적으로 기록한다.
  - 위치: `codebase/backend/src/modules/workspaces/workspaces.service.ts` `transferOwnership`
    (무락 사전판정 725~727행) + 같은 메서드의 트랜잭션 내부 락 재검사(750~756행). 여기에 더해
    `RolesGuard.assertMember`(`common/guards/roles.guard.ts`, 경로 분기)가 같은 `(workspaceId,
    requesterId)` 쌍을 요청당 한 번 더 조회한다.
  - 상세: 순서는 ① 가드가 `getMemberRole` 무락 조회(경로 워크스페이스 인가) → ② 서비스가 트랜잭션
    **밖**에서 같은 쌍을 `getMemberRole` 로 다시 무락 조회(존재·유형 오라클을 닫기 위한 이번 라운드
    수정) → ③ 트랜잭션 **안**에서 `pessimistic_write` 락으로 세 번째 조회(동시 owner 변경 경합 차단).
    ①·②는 완전히 같은 SQL(같은 PK 인덱스 SELECT)을 무락으로 두 번 연속 실행한다 — ②가 막는 존재·유형
    오라클은 사실 ①이 이미 닫아 두었으므로(가드가 비멤버를 먼저 403 으로 차단), ②의 실질적 방어
    가치는 "가드 인식이 깨졌을 때의 두 번째 선"뿐이고 그 의도는 주석(722~724행)에 명시돼 있다. 저빈도
    admin 전용 라우트(owner 이양)라는 점에서 이전 라운드들이 수용한 "PK 조회 비용은 무시할 수준"
    판단의 연장선에 있고, 뮤텐트/락 테스트(`workspaces.service.spec.ts` 게이트 1125~1134)가 "첫 조회는
    무락, 트랜잭션 안은 전부 락"을 이미 고정하고 있어 회귀 방지도 돼 있다. 다만 요청당 동일 SELECT 가
    3회로 늘어난 사실 자체는 이전 라운드 INFO 목록에 명시적으로 등재되지 않았던 항목이라 기록한다.
  - 제안: 조치 불필요(LOW) — 이미 확립된 "가드+서비스 이중 조회는 두 번째 선"이라는 저장소 관례의
    자연스러운 연장이며 새 결함이 아니다. 다만 향후 성능이 문제되면 가드가 조회한 role 을
    request-scoped 로 서비스에 전달하는 리팩터를 별도 트래킹(1라운드 제안과 동일한 결의 후속).

- **[INFO]** `leaveWorkspace` 도 같은 모양(가드 조회 + 트랜잭션 밖 `assertMembership` + 트랜잭션 안
  락 재검사)이라 요청당 동일 SELECT 3회다 — `transferOwnership` 과 같은 성격이라 위 항목에 병기한다.
  - 위치: `codebase/backend/src/modules/workspaces/workspaces.service.ts:650`(`assertMembership`
    호출) + 트랜잭션 내부 락 조회(667행 부근, 이번 diff 에서 `this.throwNotAMember()` 헬퍼로 축약).
  - 상세: `assertMembership` 자체는 3라운드에서 이미 "재확인만 하고 재-flag 하지 않음" 처리됐으나,
    그 항목은 "존재 오라클 폐쇄"라는 정확성 관점으로만 다뤄졌고 "가드 조회까지 합치면 3회"라는
    조회-횟수 관점은 명시되지 않았었다. transferOwnership 항목과 같은 결론(LOW, 조치 불요)이다.
  - 제안: 조치 불필요.

## 요약

이번 5라운드 diff 의 핵심 부작용(전역 403 코드 계약 변경, 가드·서비스 이중 조회, `countWorkspace*`
시그니처 변경)은 1~4라운드에서 이미 발견·처분됐고, 그 처분을 뒤집을 새 근거는 찾지 못했다 —
frontend 재확인(grep)과 소비처 전수 확인 결과 모두 이전 판단과 동일했다. 4라운드에서 커밋된 W3 수정
(`transferOwnership` 인가 선행)은 동작 결함을 올바르게 고쳤지만, 그 대가로 요청자 멤버십 조회가
가드 1회 + 서비스 무락 1회 + 트랜잭션 락 1회, 총 **3회**로 늘었다는 조회-횟수 증가가 이번 라운드에서
새로 드러난 유일한 부작용이다(`leaveWorkspace` 도 같은 모양). 둘 다 PK 인덱스 조회이고 저빈도
admin/owner 전용 라우트라는 이전 라운드들의 "이중 조회 수용" 근거가 그대로 확장 적용되므로 Critical/
Warning 급은 아니라고 판단한다. 그 외 전역 변수 신설, 파일시스템 쓰기, 환경변수 read/write, 의도치
않은 네트워크 호출, 이벤트/콜백 변경은 이번 diff 에서 관측되지 않았다.

## 위험도

LOW
