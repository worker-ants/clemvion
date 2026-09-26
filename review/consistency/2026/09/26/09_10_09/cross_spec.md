# Cross-Spec 일관성 검토 — 성공 응답 코드 ↔ OpenAPI 광고 정합 (post-status-openapi)

## 발견사항

- **[WARNING] `oauthBegin` 은 Cafe24 Private/MakeShop 분기에서 실제로 리소스를 생성한다 — 「14곳 전부 액션, 자원 생성 아님」 전제가 균일하지 않음**
  - target 위치: `plan/in-progress/post-status-openapi.md` "방향 — 광고에 맞춘다(200)" 절 — "위 14곳은 자원을 만들지 않는 **액션**이다" (규약 인용: `spec/5-system/2-api-convention.md` 의 «POST = 리소스 생성, 액션 실행» 중 후자)
  - 충돌 대상: `spec/2-navigation/4-integration.md` §9 API 표, `POST /api/integrations/oauth/begin` 행 — "**Cafe24 Private**: … `{ mode:'cafe24_private_pending', integrationId, appUrl, callbackUrl }` 반환 (Integration `pending_install` **생성**, popup 없음)" · "**MakeShop**: … (Integration `pending_install` **생성**, popup 없음 …)". `spec/5-system/2-api-convention.md` §6 / `spec/conventions/swagger.md` §2-4 는 "201 Created = 생성 성공"을 명시한다.
  - 상세: `integrations.oauthBegin` 은 target 이 "14곳 전부 액션(자원 비생성)"으로 분류한 목록에 포함돼 있으나, 스펙 본문이 명시적으로 "Integration `pending_install` **생성**"이라 적은 두 분기(Cafe24 Private·MakeShop)가 있다 — 응답에 새로 생긴 행의 `integrationId` 를 싣는다는 점까지 전형적인 "생성 응답" 모양이다. 같은 엔드포인트가 분기에 따라 생성/비생성으로 갈리는 것 자체는 target 의 책임이 아니지만(기존 OpenAPI 광고가 이미 200 이라 이 PR 은 그 기존 결정을 런타임에 맞출 뿐), target 의 서술("14곳은 자원을 만들지 않는다")은 이 분기를 놓쳐 **사실과 다른 근거로 정당화**하고 있다. 다음에 이 엔드포인트를 다시 볼 사람이 이 서술만 보고 "생성 없음"으로 오판할 소지가 있다.
  - 제안: target 의 방향 절에 이 분기를 명시적으로 예외로 적거나("oauthBegin 은 이미 200 광고가 선행 결정이므로 이 PR 은 그 결정을 다투지 않는다"), 근거 문장에서 "14곳 전부 자원을 만들지 않는다"는 전칭을 "12곳은 순수 액션, oauthBegin 은 일부 분기에서 자원을 생성하지만 기존 200 광고를 그대로 따른다"로 좁힌다. spec 자체(`4-integration.md`)를 고칠 필요는 없다 — target 서술의 정확도 문제다.

- **[WARNING] `acceptInvitation` 은 WorkspaceMember 행을 새로 만든다 — 「액션=200」 분류가 §6 201 정의와 경계선에 있다**
  - target 위치: `plan/in-progress/post-status-openapi.md` "실측" 절의 14곳 목록 — `workspaces` `acceptInvitation`. 본문이 스스로 이 자리를 "«생성»으로 읽힐 여지가 있는 자리"로 지목하고 판단을 요청함.
  - 충돌 대상: `spec/2-navigation/9-user-profile.md` §6.1 부근 (`POST /api/workspaces/invitations/accept` 행) 및 인접 서술 — 초대 수락은 "사용 횟수 1회" 토큰을 소비하며, 같은 문서가 회원가입 흐름에서 "가입 성공 트랜잭션 내에서 자동 accept"라고 적어 accept 의 효과가 **워크스페이스 멤버십 행 생성**임을 시사한다. `spec/5-system/2-api-convention.md` §6 은 "201 = 생성 성공"이다.
  - 상세: 판정은 진짜 갈린다 — accept 의 1차 대상 자원은 Invitation(상태 전이: pending→accepted)이고 멤버십 생성은 부수효과로 볼 수도 있어, target 의 200 분류가 §6 을 어긴다고 단정하기는 어렵다. 다만 이 경계선은 이미 `plan/in-progress/spec-draft-nullable-notation-followups.md:5041-5047` 트래커가 "`POST /workspaces/invitations/accept` 도 같은 모양인지 확인할 것"이라고 명시적으로 위임한 질문이고, target 이 그 위임에 답해 포함시킨 것은 트래커 지시와 **정합**한다. CRITICAL 로 올리지 않는 이유는 (a) spec 어디에도 이 엔드포인트에 201 이 명시돼 있지 않고(전수 grep 0건), (b) 기존 42/42 `@HttpCode(200)` POST 선례가 "액션류는 200" 관행을 이미 굳혔기 때문이다.
  - 제안: 그대로 진행하되, `--impl-done` 리뷰에서 이 판단(accept 의 1차 자원=Invitation, 부수효과=멤버십)을 한 줄 근거로 남겨 다음 사람이 같은 질문을 반복하지 않게 한다.

- **[WARNING] 신설 정적 가드가 §2-4/§6 을 강제하는데도 `swagger.md`·`2-api-convention.md` 의 `code:` frontmatter 에 등재되지 않는다 — 저장소의 기존 이중등재 관례와 어긋남**
  - target 위치: `plan/in-progress/post-status-openapi.md` "요구 1" — `src/repo-guards/__tests__/http-status-advertised{-guard.ts,.spec.ts}` 신설. frontmatter `spec_impact: none`.
  - 충돌 대상: `spec/conventions/swagger.md` frontmatter `code:` (§2-4 상태 코드 응답 규칙을 소유) 및 `spec/5-system/2-api-convention.md` frontmatter `code:` (§6 HTTP 상태 코드 표를 소유). 두 문서는 이미 `swagger-dto-contract*`·`response-contract*`·`user-entity-exposure*` 등 여러 가드를 **양쪽 다** `code:` 에 등재해 두고, `2-api-convention.md` §5.4 자신이 그 이유를 적어 둔다 — *"그 검증자는 양쪽 문서의 `code:` 에 모두 등재돼 있다 — 한쪽만 등재하면 다른 축의 변경이 재검토 트리거를 못 건드린다."*
  - 상세: 신설 가드는 정확히 §2-4(광고 데코레이터 분류)·§6(실제 상태 코드 의미)을 대조하는 검증자라 두 문서의 기존 가드들과 **같은 종류의 SoT-강제 역할**을 한다. 그런데 target 은 `spec_impact: none` 으로 선언해 이 새 파일 경로를 두 문서 어디에도 추가하지 않는다 — 저장소가 반복적으로 세운 "가드 신설 시 해당 spec 의 `code:` 에 등재" 관례(예: `dto-class-name-collision*` 신설 시 `swagger.md` `code:` 갱신, §5.1 Rationale)와 어긋난다. 등재하지 않으면 다음에 §2-4/§6 을 고치는 사람이 이 가드의 존재를 spec 읽기만으로 알 방법이 없다.
  - 제안: `code:` frontmatter 갱신은 산문 변경이 아니라 등재 목록 추가이므로, developer 가 직접 두 문서의 `code:` 리스트에 새 가드 경로 2개(`-guard.ts`/`.spec.ts`)를 추가하는 것이 합리적인 최소 조치다. 다만 `spec/` 쓰기는 원칙적으로 project-planner 소관이므로, 자기-반증형 소정정 5조건에 해당하지 않는 이 케이스는 짧은 planner 턴으로 `code:` 항목만 추가하거나, `spec_impact` 를 `none` 이 아니라 두 파일의 frontmatter-only 갱신으로 명시하고 `--impl-done` 스코프에 포함시켜야 한다.

## 확인했으나 충돌 아님 (참고용)

- `spec/2-navigation/4-integration.md:843` (`:id/test` 의 `pending_install` 분기)과 `spec/5-system/11-mcp-client.md:537`(`preview-test` 실패 응답)는 이미 "HTTP 200 OK"를 명시한다 — target 의 `previewTest`/`testConnection` @HttpCode(200) 추가는 **기존에 문서화된 계약과 코드(런타임 201 기본값)의 오랜 불일치를 해소**하는 방향이며 새 충돌이 아니다.
- `spec/2-navigation/6-config.md` 의 `regenerate`(§A.4)는 기존 AuthConfig 행의 비밀값을 in-place 교체할 뿐 새 엔티티 id 를 만들지 않는다 — 200 분류에 이견 없음.
- `revokeInvitation` 의 광고 정정(204→200)은 `plan/in-progress/spec-draft-nullable-notation-followups.md:4861-4869` 의 별도 트래커 항목("`workspaces.controller.ts` 만 삭제 성공에 204 대신 `200 {ok:true}` 를 쓴다" — 런타임을 204 로 바꿀지 여부)을 선점하지 않는다. target 은 런타임을 그대로 두고 광고만 이미 200 인 런타임에 맞추므로 두 결정은 독립적이다.
- 14곳 중 어디에도 spec 본문이 명시적으로 "201"을 적어 둔 자리는 없다(대상 spec 파일 전수 grep 0건) — target 의 200 통일이 spec 텍스트와 직접 모순되는 자리는 없다.
- `POST /workflows/:id/save`(`spec/3-workflow-editor/0-canvas.md:513`)는 "마지막 저장이 서버 상태가 된다"는 overwrite 서술이라 200(수정) 분류와 정합한다.

## 요약

이번 target(성공 응답 코드 201→200 통일 + 광고 정합화)은 spec 텍스트와 직접 모순되는 자리는 없었고(전수 grep 0건), 오히려 `mcp-client.md`·`4-integration.md` 가 이미 문서화한 200 계약과 코드의 오랜 drift 를 해소하는 방향이다. 다만 target 의 정당화 서술("14곳 전부 자원을 만들지 않는 액션")이 `oauthBegin` 의 Cafe24 Private/MakeShop 생성 분기를 놓쳐 스스로 세운 규칙(§6 201=생성)과 경계에서 어긋나고, `acceptInvitation` 의 분류는 트래커가 위임한 판단대로 진행되고 있어 정당하나 근거를 남겨야 하며, 신설 정적 가드가 저장소의 기존 "가드는 강제하는 규약 문서의 `code:` 에 등재" 관례를 따르지 않고 `spec_impact: none` 으로 우회하고 있다. 세 항목 모두 즉시 작동 불가를 유발하는 CRITICAL 은 아니지만, 착수 전에 (1) oauthBegin 서술 정정, (2) acceptInvitation 판단 근거 기록, (3) 신설 가드의 `code:` 등재(짧은 planner 턴 또는 `spec_impact` 재정의) 를 결정해 두는 것이 다음 사람의 재조사를 막는다.

## 위험도

MEDIUM
