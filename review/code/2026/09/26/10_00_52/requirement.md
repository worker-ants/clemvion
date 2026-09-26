# 요구사항(Requirement) 리뷰 — post-status-openapi

## 검증 방법

- 프롬프트에 실린 unified diff + 전체 컨텍스트를 확인하고, 프롬프트 크기 제한으로 잘린 파일(`integrations` ·
  `knowledge-base` · `schedules` · `workflows` · `workspaces` 컨트롤러, `http-status-advertised-guard.ts`)은
  `Read` 로 직접 열어 전문을 대조했다.
- 신설 가드 테스트를 실제로 실행했다: `node --experimental-vm-modules ./node_modules/jest/bin/jest.js
  src/repo-guards/__tests__/http-status-advertised.spec.ts` → **11/11 PASS** (스캔 대상 `checked > 150`,
  `violations: []`, `unresolved: []` 확인).
- `@nestjs/core/router/router-response-controller.js` 의 `getStatusByMethod` 소스를 직접 열어, 가드 · 주석이
  주장하는 "POST 만 201, 나머지 200" Nest 기본값 근거가 실제 소스와 일치함을 확인했다.
- 관련 spec(`spec/conventions/swagger.md` §2-4 · §Rationale)과 `plan/in-progress/post-status-openapi.md`
  를 대조했다.
- 리뷰 중 저장소 파일은 뮤테이션하지 않았다(`Read`/`Bash`(읽기·jest 실행)만 사용).

## 발견사항

- **[INFO]** 리뷰 도중 공유 워크트리에서 관측된 이상 상태(내가 만든 변경 아님)
  - 위치: `codebase/backend/src/modules/auth-configs/auth-configs.controller.ts` (`@Post(':id/regenerate')` 핸들러,
    `@HttpCode(HttpStatus.OK)` 줄)
  - 상세: 리뷰 종료 직전 `git status --short` 확인 결과 이 파일이 **작업 트리에서만** 수정돼 있었다 —
    `regenerate` 핸들러의 `@HttpCode(HttpStatus.OK)` 데코레이터가 **디스크상에서 제거된 상태**(`git diff` 로 확인,
    수정 시각은 확인 시점 기준 1초 전 — 진행 중인 동시 프로세스로 보인다). 이는 본 리뷰 대상 diff/프롬프트가 보여주는
    "적용 후" 상태와 반대(뮤턴트 상태)다. 본 리뷰의 판단은 프롬프트에 실린 diff·컨텍스트를 근거로 했고 이 파일을
    `Read` 로 직접 열지 않았으므로 이 이상 상태에 오염되지 않았다. 이 파일 자체를 고치거나 `git checkout`/`restore`
    로 되돌리지 않았다 — 동시에 실행 중일 다른 세션(다른 리뷰어의 뮤테이션 검증 또는 plan 의 "뮤턴트 15/15 KILLED"
    재현 작업)의 미커밋 상태를 지울 위험이 있기 때문이다.
  - 제안: 코드 결함이 아니므로 수정 불필요. orchestrator/후속 세션은 `--impl-done` 직전에 `git status --short` 로
    이 파일이 diff 그대로(= `@HttpCode(HttpStatus.OK)` 포함)인지 재확인할 것.

- **[INFO]** `DELETE /api/workspaces/:id/invitations/:invitationId` (초대 취소) e2e 커버리지 부재 — 이 PR 범위 밖의
  기존 갭
  - 위치: `codebase/backend/src/modules/workspaces/workspaces.controller.ts` `revokeInvitation()`
  - 상세: 이번 PR 은 이 라우트의 **광고**(`@ApiNoContentResponse` → `@ApiOkWrappedResponse(OkResultDto)`, 204→200)만
    고쳤고 런타임은 그대로다(의도적 — plan 에 "런타임을 204 로 바꿀지는 planner 트래커 항목의 결정" 이라고 명시돼
    있음). 이 라우트를 실 HTTP 로 때리는 e2e 는 저장소에 없다(신설 가드 unit + fixture 대조군만 있음). 이 PR 이
    만든 결함은 아니며 해당 결정도 정당하게 별 항목으로 미뤄져 있다.
  - 제안: 없음(정보성). 향후 "삭제 응답 204 통일" 트래커 항목 착수 시 함께 e2e 를 추가하면 됨.

## 점검 관점별 요약

1. **기능 완전성** — 실측한 불일치 15곳(POST 액션 14곳 201→200 · DELETE 광고 204→200) 전부가 코드에 반영됐다.
   `auth-configs.regenerate` · `integrations.{previewTest,oauthBegin,testConnection,rotate,reauthorize,requestScopes}` ·
   `knowledge-base.search` · `schedules.previewExpression` · `workflow-assistant.sendMessage` ·
   `workflows.saveCanvas` · `workspaces.{leave,transferOwnership,acceptInvitation}` 전부에
   `@HttpCode(HttpStatus.OK)` 가 정확히 추가됐고, `workspaces.revokeInvitation` 은 광고만 `ApiOkWrappedResponse
   (OkResultDto)` 로 정정됐다. 새 정적 가드(`http-status-advertised{-guard,.spec}.ts`)를 직접 실행해 저장소 전체
   기준 위반 0·미해결 0 을 확인했다(공허성 아님 — `checked` 플로어 150 초과 확인).
2. **엣지 케이스** — 가드 구현이 `@HttpCode(<계산식>)`(값 불명) · `@ApiResponse` status 누락 · 표에 없는
   `Api*Response` 이름 · 광고 0건 핸들러 · `@ApiExcludeEndpoint()` · `@Res()` 핸들러를 각각 분기 처리하며,
   대조군 fixture(`sample.controller.ts`)가 이 분기들을 실제로 가른다는 것을 테스트로 고정했다. `@Res()` 핸들러가
   Nest 기본 상태를 그대로 받는다는 전제는 실제 Nest 소스(`router-execution-context.js` 호출 경로)와 근거 캐너리
   (실제 HTTP 요청, `res-default`/`res-http-code`)로 이중 검증돼 있다.
3. **TODO/FIXME** — 대상 파일 10곳 전수 grep, TODO/FIXME/HACK/XXX 없음.
4. **의도와 구현 간 괴리** — `@ApiOperation.description` · 라우트 요약과 실제 동작(액션 vs 자원 생성) 판단이
   `plan/in-progress/post-status-openapi.md` 에 근거와 함께 기록돼 있고(`oauthBegin`·`acceptInvitation` 이 부수적으로
   행을 만드는데도 200 을 유지한 이유), 그 판단이 코드에 그대로 반영됐다.
5. **에러 시나리오** — 이번 diff 는 성공 코드만 건드리고 4xx/5xx 분기는 변경하지 않았다. 별도로 알려진 스펙 불일치
   (integration rotate 실제 400 vs spec 422)는 이 PR 이 만든 것이 아니고, e2e 주석에 "트래커에서 정한다" 로 명시돼
   범위 밖임이 분명하다.
6. **데이터 유효성** — 해당 없음(입력 검증 로직 변경 없음, 상태 코드/응답 스키마 메타데이터만 변경).
7. **비즈니스 로직** — `spec/conventions/swagger.md` §2-4("광고한 성공 코드는 실제 성공 코드를 담는다")가 이 코드
   변경보다 **먼저 커밋**됐다(`4b88bcf74` → `5e1f6ab36`), SDD 순서가 올바르게 지켜졌다. 코드는 spec 문구·표와
   line-level 로 일치한다.
8. **반환값** — `revokeInvitation` 은 여전히 `{ data: { ok: true } }` 를 반환하고 광고 DTO(`OkResultDto { ok: boolean
   }`)와 정확히 일치한다. 나머지 변경은 데코레이터(`@HttpCode`)만 추가했을 뿐 반환문 자체는 건드리지 않아 반환값
   경로에 회귀가 없다.
9. **spec fidelity** — `spec/conventions/swagger.md` §2-4 규칙 문단 + §Rationale(2026-09-26 항목, 실측 수치·근거
   포함)이 이번 코드 변경과 **완전히 일치**한다. `code:` frontmatter 에도 신설 가드 파일들이 이미 등재돼 있다
   (`4b88bcf74`). SPEC-DRIFT 없음 — spec 이 코드보다 먼저 갱신된, 교과서적인 SDD 사례.

## 부가 확인 — 회귀 방지 근거의 견고성

`plan/in-progress/post-status-openapi.md` 의 뮤턴트 표(G1~G11, C1, P1~P3, 15/15 KILLED)와 TEST WORKFLOW 통과 기록,
CHANGELOG 두 항목(제품 동작 변경 + 가드 신설)이 모두 실재하며 diff 내용과 부합함을 확인했다. e2e 쪽도 `[200, 201]`
이중 허용으로 불일치를 가리던 지점(22곳 + 이양 1곳 + 저장 성공 4곳)이 모두 `200` 단일 기대값으로 조여졌고, 1차
전수에서 놓쳤던 3파일(RED)의 원인(grep 을 `head -30` 으로 잘라 봄)과 재수정 과정도 plan/CHANGELOG 에 정직하게
기록돼 있다.

## 요약

이번 변경은 OpenAPI 로 광고한 성공 코드와 Nest 가 실제로 내는 성공 코드 사이의 불일치 15곳(POST 액션 14곳
201→200, DELETE 광고 1곳 204→200)을 spec(`swagger.md` §2-4)에 맞춰 정확히 닫았고, 그 정합을 저장소 전역에서
영구적으로 강제하는 AST 기반 정적 가드를 신설했다. 가드를 직접 실행해 11/11 PASS·위반 0·미해결 0을 확인했으며,
Nest 기본값·`@Res()` 핸들러 동작에 대한 코드의 전제도 실제 프레임워크 소스로 재확인했다. spec 문서가 코드보다
먼저 갱신된 정석적인 SDD 흐름이고, e2e·CHANGELOG·plan 체크리스트·뮤턴트 검증까지 모두 상호 일치한다. 기능
완전성·spec 일치·반환값·에러 시나리오 어느 관점에서도 결함을 찾지 못했다. 유일하게 보고할 사항은 리뷰 중 관측된
공유 워크트리의 일시적 이상 상태(다른 동시 세션이 `auth-configs.controller.ts` 의 `@HttpCode` 를 되돌린 것으로
보이는 미커밋 변경)이며, 이는 본 리뷰가 근거로 삼은 diff/프롬프트 내용과 무관하고 코드 결함이 아니다.

## 위험도

NONE
