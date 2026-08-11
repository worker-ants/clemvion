# 보안(Security) 리뷰 — `17_42_42` (전 라운드 WARNING 6건 처분 검증)

## 컨텍스트

전 라운드(`17_21_33`)에서 이 리뷰어가 낸 WARNING(6건) — "`@Roles()` 는 있는데
`@ApiForbiddenResponse` 가 없는 라우트" — 를 이번 diff 가 다른 두 건(3건/12건)과 합쳐
13건으로 처분했다고 주장한다. 저장소를 직접 열어(`git diff origin/main`, 독립 스캐너, 소스
직독) 4가지 확인 항목을 전수 실측했다. **저장소를 수정하지 않았다.**

## 확인 절차 및 근거

### 1. 내가 짚은 6건이 이번 13건에 전부 포함됐는가 — 포함됨, 6/6

전 라운드 `security.md` WARNING 원문의 6개 위치를 `git diff origin/main` 실측 결과와
1:1 대조했다.

| # | 전 라운드 지적 위치 | 이번 diff 새 게이트 위치 | description | 확인 |
|---|---|---|---|---|
| 1 | `workflow-assistant.controller.ts:103-107` (`create`) | `:107` | `'editor 이상 권한 필요'` | 일치 |
| 2 | `workflow-assistant.controller.ts:115-119` (`update`) | `:120` | `'editor 이상 권한 필요'` | 일치 |
| 3 | `workflow-assistant.controller.ts:128-133` (`remove`) | `:135` | `'editor 이상 권한 필요'` | 일치 |
| 4 | `workflow-assistant.controller.ts:141-154` (`sendMessage`) | `:157` | `'editor 이상 권한 필요'` | 일치 |
| 5 | `agent-memory.controller.ts:60-71` (`listScopes`) | `:71` | `'viewer 이상 권한 필요'` | 일치 |
| 6 | `agent-memory.controller.ts:87-99` (`listMemories`) | `:100` | `'viewer 이상 권한 필요'` | 일치 |

각 핸들러의 실제 `@Roles()` 값을 소스에서 직접 `grep` 해 description 문자열과도 대조했다 —
`workflow-assistant.controller.ts` 4곳 모두 `@Roles('editor')`(파일 내 실제 라인:
104/117/131/145), `agent-memory.controller.ts` 2곳 모두 `@Roles('viewer')`(파일 내 실제
라인: 61/89) — 부착된 문구가 실제 요구 역할과 정확히 일치한다. **6/6 확인.**

### 2. §5-4 술어 기준 잔여 0 — 독립 재스캔으로 확인, 잔여 0/222

plan/리뷰의 스캐너를 신뢰하지 않고, 별도로 작성한 데코레이터 블록 파서로 `codebase/backend/src`
아래 `*.controller.ts` **35개 파일** 전체(HTTP 메서드 데코레이터 기준 라우트 핸들러 **222개**,
plan 이 보고한 전체 라우트 수와 일치)를 재스캔했다. 술어: `@Public()` 이 아니고
(`@WorkspaceId()` 소비 **또는** `@Roles()` 존재)인데 `@ApiForbiddenResponse` 가 없는 라우트.

```
total route handlers scanned: 222
residual (ws or roles, no forbidden): 0
```

추가로 사각지대 두 곳을 별도 확인했다:
- **클래스 레벨 `@ApiForbiddenResponse`** — 35개 파일 전수, 첫 라우트 데코레이터 이전 구간에
  0건. (있었다면 메서드 레벨 스캔이 과소 계수했을 것.)
- **클래스 레벨 `@Public()`** — 저장소 전체 `@Public()` 사용처(`auth`/`webauthn`/`health`/
  `external-interaction`/`invitations`/`third-party-oauth`/`hooks` 등) 전수가 메서드 레벨
  들여쓰기(`  @Public()`)로만 존재, 클래스 레벨 0건 — per-route 판정이 새는 경로 없음.

이번 diff 적용 후 상태(`git diff origin/main` 추가분 포함)로 스캔했으므로, **§5-4 술어 기준
잔여 0건**은 스캐너 신뢰가 아니라 독립 재현으로 확인된 사실이다.

### 3. 부착이 런타임 가드를 바꿨는가 — 바꾸지 않음, 특히 `executions.controller.ts` 확인

`git diff origin/main --stat -- codebase/`: **19개 컨트롤러 파일, +74/-2**. `grep -nE
'^-.*(@Roles|@Public)'` 전수 검색 — **0건**(삭제된 `@Roles`/`@Public` 없음). `guards?/` 로
전수 검색해 나온 유일한 매치(`workflow-assistant.controller.ts:500` 부근의
`import { Roles } from '../../common/guards/roles.guard'`)는 diff 컨텍스트 라인(앞에
`+`/`-` 없음, 기존 import 그대로)이었다 — guard 파일 자체는 diff 대상에 아예 없다
(`git diff origin/main --name-only -- codebase/` 결과 19개 전부 `*.controller.ts`).

`executions.controller.ts` 는 P0 보안 fix(`stop` 에 `@Roles('editor')`)가 만진 바로 그
파일이라 특히 정밀 대조했다 — 실제 diff:

```diff
@@ -157,6 +157,7 @@
   @ApiUnauthorizedResponse({ description: '인증 실패 또는 토큰 만료' })
+  @ApiForbiddenResponse({ description: '워크스페이스 멤버가 아님' })
   @ApiNotFoundResponse({ description: '해당 실행을 찾을 수 없음' })
@@ -217,6 +218,7 @@
   @Roles('owner')
   @ApiExcludeEndpoint()
+  @ApiForbiddenResponse({ description: 'owner 이상 권한 필요' })
   async triggerStuckRecoveryForTest() {
@@ -237,6 +239,7 @@
   @Roles('owner')
   @ApiExcludeEndpoint()
+  @ApiForbiddenResponse({ description: 'owner 이상 권한 필요' })
   async simulateExecutionRunRedeliveryForTest(
```

정확히 3줄 추가, 전부 `@ApiForbiddenResponse` — `@Roles('editor')`(157행대 `stop`),
`@Roles('owner')`(두 test hook)는 손대지 않았고, `NODE_ENV`/`E2E_TEST_HOOKS` 체크·
`verifyOwnership` 호출도 그대로다. **런타임 가드 변경 없음.**

93개 추가 라인 전수를 패턴 분류해도(51 `'워크스페이스 멤버가 아님'` + 8 `'editor 이상
권한 필요'` + 3 `'viewer 이상 권한 필요'` + 2 `'owner 이상 권한 필요'` + 6 import + 4 주석
= 74, `--stat` 과 일치) `@ApiForbiddenResponse`/import/주석 외 라인은 없다. 삭제 2줄은
`llm-model-config.controller.ts` 의 stale 주석 정정(§Rationale 참조)뿐 — 코드 로직 변경 아님.

### 4. 테스트 훅 2종의 프로덕션 노출 여부 — 코드로 판정: 노출되지 않음

`triggerStuckRecoveryForTest`/`simulateExecutionRunRedeliveryForTest` 는 이번 diff 가 만든
게 아니라(다층 방어 주석에 `ai-review security/api_contract W` 로 이미 이전 라운드에서
하드닝된 이력이 명시돼 있음) 기존 코드 그대로이고, 이번 diff 는 여기에 문서 데코레이터
1줄씩만 얹었다. 방어 계층을 소스에서 직접 추적:

1. **라우트 등록 자체는 env 와 무관** — NestJS 는 데코레이터를 컴파일 타임에 정적으로
   읽어 라우터에 등록하므로, `NODE_ENV` 값과 무관하게 두 경로(`POST
   /executions/_test/recover-stuck-executions`, `POST
   /executions/:id/_test/simulate-execution-run-redelivery`)는 항상 존재한다 — 이 자체는
   맞다.
2. 그러나 요청이 들어오면 **가드 체인**(`JwtAuthGuard` → `UserThrottlerGuard` →
   `RolesGuard`, `app.module.ts` `APP_GUARD` 전역 등록 순서)을 거치며, `RolesGuard` 가
   `@Roles('owner')` 를 강제한다 — 인증되지 않았거나 해당 워크스페이스 owner 가 아니면
   핸들러 진입 전에 401/403 으로 차단된다.
3. **핸들러 진입 후에도** 첫 줄이 `if (process.env.NODE_ENV !== 'test' ||
   process.env.E2E_TEST_HOOKS !== '1') { throw new NotFoundException(); }` — 프로덕션
   배포는 `NODE_ENV=production` 이고 `E2E_TEST_HOOKS` 는 미설정이므로, **인증된 owner
   사용자가 요청해도** 즉시 404 로 응답하고 `runStuckRecoveryScan`/
   `runExecutionFromQueue` 는 호출되지 않는다.
4. `@ApiExcludeEndpoint()` 는 Swagger 문서에서만 숨기는 것으로 런타임 보호가 아니다 —
   위 2·3 이 실제 런타임 방어이고, 이번 diff 가 추가한 `@ApiForbiddenResponse` 는 문서
   전용 데코레이터라 런타임에 아무 영향이 없다.

즉 "`@Roles('owner')` 로 문서화했으니 프로덕션에 노출된다"는 우려는 코드상 성립하지
않는다 — **역할 게이트가 뚫리더라도(예: RBAC 로직 결함) env 게이트가 독립적인 2차
방어선**으로 작동하도록 이미 설계돼 있고, 이번 diff 는 그 로직을 전혀 건드리지 않았다.
새 보안 결함이 아니다.

## 발견사항

- **[INFO]** `executions.controller.ts` 의 두 test-hook 핸들러(`:220`, `:241` 부근)는
  `@ApiExcludeEndpoint()` 가 이미 붙어 있어 Swagger 생성 문서에서 완전히 제외된다 — 이번에
  추가한 `@ApiForbiddenResponse({ description: 'owner 이상 권한 필요' })`(`:221`, `:242`)는
  `@nestjs/swagger` 동작상 실제 생성 문서에 반영되지 않는 죽은 문서화다.
  - 위치: `codebase/backend/src/modules/executions/executions.controller.ts:221`, `:242`
  - 상세: 기능·보안에는 영향이 없다(문서 생성 자체가 스킵되므로 오히려 "과다 노출" 방향의
    문제도 아니다). §5-4 술어를 기계적으로 적용한 결과로 보인다.
  - 제안: 조치 불요 — 굳이 정리한다면 `@ApiExcludeEndpoint()` 라우트는 §5-4 대상에서
    제외하도록 스캐너 술어를 다듬는 것을 후속 정리 항목으로만 남길 만하다.

- **[INFO]** 검증 결과 확인 — 전 라운드 WARNING 6건 전부 이번 13건에 포함(6/6), §5-4 술어
  기준 독립 재스캔 잔여 0/222, `codebase/` diff 74줄 추가 전수가 `@ApiForbiddenResponse`
  데코레이터(64)·import(6)·주석 정정(4)으로만 구성되어 런타임 가드(`@Roles`/`@Public`/
  `RolesGuard`/`app.module.ts`) 변경 0건, 테스트 훅 2종은 역할 게이트와 독립적인
  env-플래그 게이트로 프로덕션에서 기능이 비활성화됨을 소스로 확인. 새로운 보안 결함
  없음.

## 요약

전 라운드에서 이 리뷰어가 낸 WARNING 6건(workflow-assistant.controller.ts `create`/
`update`/`remove`/`sendMessage`, agent-memory.controller.ts `listScopes`/`listMemories`)은
이번 13건 부착에 정확히 포함됐고, description 문자열도 실제 `@Roles()` 값과 전수
일치한다. §5-4 술어("`@Roles()` 있거나 `@WorkspaceId()` 소비")를 기준으로 별도 작성한
독립 파서로 35개 컨트롤러·222개 라우트 전체를 재스캔한 결과 잔여 0건이며, 클래스 레벨
예외(`@ApiForbiddenResponse`/`@Public()`)도 0건으로 스캔 방법론 자체의 사각지대가 없음을
확인했다. `codebase/` diff 는 19개 컨트롤러에 +74/-2 로, 추가분 전부가 `@ApiForbiddenResponse`
데코레이터·import·주석 정정이고 삭제 2줄도 stale 주석 정정뿐이다 — `@Roles`·`@Public`·
`RolesGuard`·가드 등록 순서 등 런타임 인가 로직은 어디에도 손대지 않았다. P0 보안 fix 가
만진 `executions.controller.ts` 를 특히 정밀 대조했고, `stop` 의 `@Roles('editor')` 및
두 test-hook 의 `@Roles('owner')` + `NODE_ENV`/`E2E_TEST_HOOKS` 이중 게이트는 원래
상태 그대로다. 이 게이트 조합을 코드로 직접 추적한 결과 테스트 훅은 역할 검증이 뚫려도
env 플래그가 독립적인 2차 방어선으로 작동해 프로덕션에서 기능이 발동하지 않는다 —
"`@Roles('owner')` 로 문서화했으니 노출"이라는 우려는 성립하지 않으며, 이 상태는 이번
diff 이전부터 있던 기존 하드닝이라 새 결함이 아니다. 억지 발견은 만들지 않았다 —
유일한 INFO 는 `@ApiExcludeEndpoint()` 라우트에 붙은 `@ApiForbiddenResponse` 가 문서
생성상 죽은 코드라는 조치 불요 수준의 관찰뿐이다.

## 위험도

NONE

STATUS: OK
