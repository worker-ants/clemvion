# 보안(Security) Review — workspace-path-guard (2026/09/25 17_47_18, 4라운드)

## 범위 요약

이번 changeset(`codebase/**` 28개 파일)의 핵심은 `RolesGuard` 가 **경로 파라미터로 받는 워크스페이스 ID**
(`@WorkspaceParam('id')`)를 인가 대상으로 인식하도록 확장한 것이다. 종전에는 `RolesGuard` 가
헤더(`X-Workspace-Id`)·토큰(`activeWorkspaceId`) 컨텍스트만 봤기 때문에, `/workspaces/:id/...` 류
15개 라우트(+ `POST /auth/workspaces/:id/switch` 1곳)에서 가드 층의 역할 판정이 실제 대상 워크스페이스가
아닌 **요청자의 현재(헤더/토큰) 워크스페이스**를 기준으로 이뤄졌다. 이 PR 은 `@WorkspaceParam` 데코레이터 +
`workspaceParamNamesOf` reflection 을 신설해 가드가 경로 값을 직접 조회·판정하게 하고, 정적 분석
repo-guard(`workspace-param-binding-guard`)로 향후 평범한 `@Param` 회귀를 CI 에서 차단한다.

이미 3라운드(`16_03_32`→`16_39_25`→`17_14_49`)가 Critical 0 · Warning 22건을 처분했다(마지막 라운드
SUMMARY: Critical 0 · Warning 6 · INFO 14, 전부 조치 완료). 아래는 4라운드 보안 관점 재검토다 — 이미
처분된 항목은 재론하지 않는다.

## 핵심 검증 — 우회 가능성 집중 점검

가드의 신규 분기(`roles.guard.ts` `canActivate`)를 다음 각도로 직접 추적했다:

1. **`isUuidShaped` (가드, 파이프 이전 원문 판정) vs `ParseUUIDPipe`(파이프, `@WorkspaceParam` 내장) 의
   accept-set 비교.** `isUuidShaped` 는 `8-4-4-4-12` hex 형태만 요구(버전·variant nibble 불문)하고,
   `new ParseUUIDPipe()`(옵션 없음)는 class-validator 의 `isUUID(v, undefined)` → `all` 패턴
   (`[1-5]` 버전 nibble + `[89ab]` variant nibble 강제)을 쓴다. 즉 `isUuidShaped` 의 accept-set 이
   `ParseUUIDPipe` 의 accept-set 을 **엄격한 상위집합**으로 포함한다 — 파이프가 통과시키는 값은 항상
   가드도 판정 대상으로 잡는다는 뜻이라, "가드가 스킵(`continue`)했는데 파이프는 통과시켜 핸들러가
   멤버십 검증 없이 실행되는" 방향의 우회는 성립하지 않는다. 역방향(가드는 판정하지만 파이프는 400)은
   nil UUID 케이스이고, 이는 `roles.guard.ts` 주석·e2e(`workspace-path-guard.e2e-spec.ts` "형식은
   맞는 nil UUID 는 조회해 403") 가 의도한 동작으로 명시·테스트돼 있다.
2. **가드 실행 순서.** NestJS 는 Guard → Interceptor(pre) → Pipe → Handler 순이므로, 가드가
   `continue`(형식 불일치)로 판정을 넘기고 `true` 를 반환해도 핸들러 실행 전에 반드시 `ParseUUIDPipe`
   가 개입해 400 을 낸다 — "가드 통과 = 핸들러 실행" 이 아니라는 전제가 실제로 지켜진다.
3. **서비스 계층 이중 검증(defense-in-depth).** `workspaces.service.ts` 의 모든 대상 메서드
   (`renameWorkspace`·`updateWorkspaceSettings`·`addMemberByEmail`·`updateMemberRole`·
   `transferOwnership`·`removeMember`·`leaveWorkspace`·`deleteWorkspace`)가 **경로로 받은
   `workspaceId` 를 직접 사용해** 독립적으로 멤버십/역할을 재검증한다(`assertMembership`/`assertAdmin`/
   인라인 role 비교). 즉 이번 PR **이전에도** 실제 인가 결정은 서비스 계층에서 올바른(경로) 워크스페이스
   기준으로 내려지고 있었다 — 가드 층의 결함은 "잘못된 워크스페이스에 대한 불필요한 사전 검사"였지,
   최종 인가를 완전히 우회시키는 결함은 아니었다(단, `transferOwnership` e2e 가 보여주듯 가드 단계에서
   불필요한 403/불필요한 통과가 있었던 것은 사실 — UX/일관성 결함이며 이번 수정으로 닫혔다). 이 이해가
   맞다는 것은 신규 e2e(`workspace-path-guard.e2e-spec.ts` "헤더에 자기 owner 워크스페이스를 실어도
   경로 워크스페이스의 owner 가 아니면 가드가 막는다" — 본문 메시지로 가드/서비스 어느 층이 막았는지까지
   구분)가 명시적으로 검증한다.
4. **멀티 path-param 케이스.** `for (const name of pathParamNames)` 루프가 각 경로 값에 대해 개별
   `assertMember` 를 순차 `await` 하므로 첫 실패에서 즉시 throw 된다 — 부분 검증 후 통과되는 경로는
   없다. `roles.guard.spec.ts` 가 "여럿이면 전부 본다 — 비멤버가 어느 자리든 거부" / "전부 멤버면 각각
   조회한 뒤 통과" 두 방향을 모두 고정한다.
5. **응답 일관성(존재 오라클 차단).** 비멤버는 대상 워크스페이스가 존재/부재/personal/team 인지와
   무관하게 항상 동일한 `403 NOT_A_MEMBER` 를 받는다 — `workspace-path-guard.e2e-spec.ts` 의
   `it.each` 가 팀·개인·부재 세 워크스페이스에 대해 답이 구분되지 않음을 직접 단언한다. 종전
   `leaveWorkspace`/`addMemberByEmail` 는 없음(404)·개인/팀(403 다른 코드)을 구분해 답해 워크스페이스
   존재·유형을 비멤버에게 흘렸는데, 이 PR 이 그 오라클을 닫는다(정보 노출 개선).
6. **정적 가드(`workspace-param-binding-guard.ts`)의 알려진 한계.** 이름 휴리스틱(`workspaceId` 또는
   `*WorkspaceId` 로 끝남)에만 의존해 `@Param('id') id: string` 처럼 규칙 밖 이름으로 워크스페이스 ID를
   받으면 못 잡는다. 이는 스캐너 코드에도, `spec/data-flow/12-workspace.md` §Rationale 에도, 3라운드
   RESOLUTION(W2)에도 이미 명시된 **의도적으로 수용된 한계**이며 이번 세션에서 재론할 근거(반증)를
   찾지 못했다 — 재지적하지 않는다.

## 발견사항

이번 라운드에서 새로 제기할 Critical/Warning 은 없다. 참고용 INFO만 남긴다.

- **[INFO]** `isUuidShaped`(가드) 와 `ParseUUIDPipe` 기본 옵션(파이프)의 accept-set 관계가 이 우회
  방지의 핵심 불변식인데, 그 관계가 코드 어디에도 "상위집합" 이라는 관계로 명시적으로 진술돼 있지 않다
  (각 파일이 자기 자신의 목적만 설명).
  - 위치: `codebase/backend/src/common/utils/uuid.ts` (`isUuidShaped`, 전체 파일 컨텍스트 L59-64) ·
    `codebase/backend/src/common/decorators/workspace.decorator.ts` (`WorkspaceParam`, 전체 파일
    컨텍스트 L114-115)
  - 상세: 현재는 두 정규식을 나란히 비교해야만(본 리뷰처럼) 우회 불가능함을 확인할 수 있다. 둘 중
    하나가 개별적으로 수정되면(예: `ParseUUIDPipe` 에 `{ version: '4' }` 를 미래에 추가) 이 불변식이
    조용히 깨질 수 있다.
  - 제안: `workspace.decorator.ts` 의 `WorkspaceParam` 문서에 "이 파이프의 accept-set 은 반드시
    `isUuidShaped` 의 accept-set 의 부분집합이어야 한다(가드가 스킵한 값을 파이프가 통과시키면 인가
    우회)" 같은 명시적 불변식 문장과, 가능하면 이를 지키는 회귀 테스트(예: fast-check 로 양쪽 정규식에
    대해 "ParseUUIDPipe 매치 ⇒ isUuidShaped 매치" 속성 테스트)를 추가하는 것을 고려. 다만 이는 선택
    사항이며 현재 상태로 실질적 위험은 없다.

- **[INFO]** 정적 가드 두 개(`param-uuid-pipe-guard.ts`, `workspace-param-binding-guard.ts`) 는 모두
  `decoratorCallName` 의 텍스트 비교(`ts.isCallExpression(expr) ? expr.expression.getText(sf) : null`)
  에 의존해 `Param`/`WorkspaceParam` 식별자를 식별한다. 별칭 import(`import { Param as P }`)가 생기면
  두 가드 모두 미탐이 된다 — 이는 파일 자체 문서(`param-uuid-pipe-guard.ts` L196-201,
  `workspace-param-binding-guard.ts` L109-110)에 이미 명시된 알려진 한계이고 저장소 실측상 별칭
  0건이라 현재는 안전하다. 새로 발견한 문제는 아니며 기록만 남긴다.

## 요약

`RolesGuard` 가 경로 파라미터 워크스페이스를 인식하지 못했던 구조적 갭을 `@WorkspaceParam` +
`workspaceParamNamesOf` reflection 으로 닫는 변경이다. 가드 판정 원문(`isUuidShaped`)이 파이프
판정(`ParseUUIDPipe`)의 엄격한 상위집합이라 "가드 스킵 → 파이프는 통과 → 핸들러가 미검증 상태로 실행"
방향의 우회는 성립하지 않음을 직접 정규식 비교로 확인했고, 가드가 인식하지 못하는 상황에 대비한
서비스 계층의 독립적 재검증(defense-in-depth), 부트 타임 fail-closed 캐너리
(`workspace-reflection-canary.ts`, 두 팩토리 합계가 0이면 기동 자체를 막음), 15개 대상 라우트의
바인딩·역할 요구를 고정하는 회귀 가드(`workspace-roles-attachment.spec.ts`), CI 정적 스캐너
(`workspace-param-binding-guard.ts`, 허용목록 없는 fail-closed)까지 다층 방어가 갖춰져 있다. 비멤버
응답이 워크스페이스의 존재/유형과 무관하게 균일한 `403 NOT_A_MEMBER` 로 통일돼 종전에 있던 존재
오라클(부재 404 · 개인/팀 구분 403)도 함께 닫혔다. SQL 은 전부 파라미터 바인딩(`$1`), 하드코딩된
시크릿·취약 암호화·평문 전송 등 다른 OWASP Top 10 항목에 해당하는 새 이슈는 발견되지 않았다. 이미
3라운드가 Critical 0 · Warning 22건을 처분한 상태이고, 이번 4라운드에서 추가로 제기할 Critical/Warning
은 없다.

## 위험도

NONE
