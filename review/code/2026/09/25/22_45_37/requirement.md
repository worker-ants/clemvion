# 요구사항(Requirement) 리뷰 — Personal 통합 소유자 강제 + Organization 변경 Admin화

## 개요

`spec/2-navigation/4-integration.md` §8 «판정 규칙» 및 Rationale «Personal 통합 소유자 강제»에 정의된 요구사항(남의
personal 통합은 404로 은닉, Organization 통합 변경은 Admin 이상, reauthorize/request_scopes 우회 입구 차단)을 코드베이스
전반(controller/service/oauth-service/assistant 도구 체인/e2e)에 매우 정확하게 line-level로 구현했다. `pickPrecheckConflict`,
`isIntegrationVisibleTo`, `assertCanModify`/`requireModifiable` 등 핵심 판정 로직을 spec 문구와 대조해 확인했고, 불일치를
찾지 못했다. 다만 **이 PR이 새로 작성한 사용자 문서(mdx) 두 파일**이 실제 구현된 권한 모델과 두 군데에서 어긋난다.

## 발견사항

- **[WARNING]** 새로 작성된 통합 관리 사용자 문서가 Viewer의 실제 권한(재인증/scope 추가 요청)을 실제보다 좁게 서술한다.
  - 위치: `codebase/frontend/src/content/docs/06-integrations-and-config/integration-management.en.mdx:27`,
    `codebase/frontend/src/content/docs/06-integrations-and-config/integration-management.mdx:38`
  - 상세: 두 문서 모두 Viewer 행에 "Cannot create, edit, delete, re-auth, or rotate credentials"
    (Ko: "재인증, 자격 증명 교체는 할 수 없어요")라고 적었다. 그러나 `IntegrationsController`의
    `reauthorize`(`codebase/backend/src/modules/integrations/integrations.controller.ts:547`)와
    `requestScopes`(같은 파일:580)에는 `@Roles('editor')` 데코레이터가 없다(같은 파일 417/445/497/634번 줄에만
    존재 — create/update/rotate/remove). `RolesGuard`는 `@Roles()`가 없으면 멤버십만 확인하고 역할 계층은 보지
    않으므로 Viewer도 두 라우트에 도달한다. 서비스 계층의 `assertCanModify`도 `scope === 'organization'`일 때만
    막고 personal(본인 것)은 어떤 역할이든 통과시킨다(`integrations.service.ts:648-658`). 즉 Viewer는 **자신의**
    Personal 통합에 대해 재인증·scope 추가 요청을 실제로 수행할 수 있다 — 이는 `spec/2-navigation/4-integration.md`
    §8 판정 규칙("Reauthorize/Scope 추가 요청 | 본인 것만")·`spec/5-system/1-auth.md` §3.2("Integration (Personal) |
    자기 것 | 자기 것 | 자기 것 | 자기 것")과 정확히 일치하는 **의도된** 동작이다. 실제로 같은 PR의
    `plan/in-progress/integration-personal-owner-followup.md`(항목 3)는 "Viewer 가 자기 personal 을 만들고 ·
    이름을 바꾸고 · rotate · 삭제하지 못한다"만 미해결 격차로 열거하고 reauthorize/request-scopes는 언급하지
    않는다 — 즉 작성자 자신도 이 둘은 이미 Viewer에게 허용된 상태로 간주하고 있다. 이 사실이 `integrations.service.spec.ts`
    의 `ownMutations`(ROLES 전체 = owner/admin/editor/viewer, reauthorize·requestScopes 포함)로 단위 테스트에는
    반영돼 있는데, 이번에 다시 쓴 사용자 문서에는 반영되지 않았다.
  - 제안: 두 mdx의 Viewer 행을 "Organization 통합과 본인 Personal 통합을 조회·테스트할 수 있고, 본인 Personal
    통합은 재인증·scope 추가 요청도 할 수 있어요(단, 새로 만들거나 편집·삭제·자격 증명 교체는 못 해요)" 식으로
    정정. spec 자체(`spec/2-navigation/4-integration.md` §8)는 이미 올바르므로 spec 수정은 불필요 — mdx만 정정.

- **[WARNING]** "Danger zone" 행이 본인 Personal 통합 삭제 요건을 "creator이면 충분"으로 과장해 실제(Editor 이상 +
  본인) 요건보다 넓게 서술한다.
  - 위치: `codebase/frontend/src/content/docs/06-integrations-and-config/integration-management.en.mdx:58`,
    `codebase/frontend/src/content/docs/06-integrations-and-config/integration-management.mdx:69`
  - 상세: "Deleting an Organization integration requires Admin or above; deleting your own Personal integration
    only requires being its creator."(Ko: "Organization 통합의 삭제는 Admin 이상만, 자신이 만든 Personal 통합의
    삭제는 만든 사람이 할 수 있고") — "only requires being its creator"라는 표현은 역할과 무관하게 생성자이기만
    하면 삭제할 수 있다는 뜻이다. 그러나 `DELETE /:id`는 `@Roles('editor')`로 게이트돼 있어(controller.ts:634)
    Viewer는 자신이 만든 Personal 통합도 라우트 단계에서 403으로 막힌다(서비스에 도달조차 못 한다). 이 정확한
    격차가 `plan/in-progress/integration-personal-owner-followup.md` 항목 3에 "Viewer 가 자기 personal 을 …
    삭제하지 못한다 … 라우트 가드(`@Roles('editor')`)가 막는다"로 명시돼 있다 — 즉 문서가 서술하는 "creator면
    충분"은 이 PR이 스스로 인정한 미해결 격차와 모순된다.
  - 제안: "삭제는 Editor 이상이면서 본인이 만든 Personal 통합이어야 해요(Viewer는 자신이 만든 것도 아직 삭제할
    수 없어요 — 후속 예정)" 식으로 정정하거나, 최소한 "creator" 앞에 역할 조건(Editor+)을 명시.

- **[INFO]** Viewer의 "본인 Personal 재인증/scope 추가 요청 성공" 경로가 e2e로 실제 HTTP 파이프라인(guard 포함)까지
  검증되지 않는다.
  - 위치: `codebase/backend/test/integration-personal-owner.e2e-spec.ts` (전체) /
    `codebase/backend/src/modules/integrations/integrations.controller.owner.spec.ts:257-303`
  - 상세: 위 WARNING에서 확인한 "Viewer가 본인 Personal을 reauthorize/request-scopes 할 수 있다"는 사실은
    `integrations.service.spec.ts`의 서비스 유닛 테스트로는 커버되지만, e2e 스펙(`integration-personal-owner.e2e-spec.ts`)의
    액터는 owner/admin/editor/viewer이나 personal 생성자는 항상 `editor`이고 viewer가 자기 personal을 만들어
    reauthorize를 시도하는 케이스는 없다. `integrations.controller.owner.spec.ts`도 컨트롤러를 직접 인스턴스화해
    호출하므로 `@Roles()` 데코레이터(NestJS 가드 체인)를 실제로 통과시키지 않는다 — 따라서 "reauthorize/
    request-scopes 라우트에 `@Roles('editor')`가 실수로 추가되어 Viewer가 막히는" 회귀를 잡을 e2e/가드-포함
    테스트가 현재 스위트에 없다. 보안 방향(과다 허용)이 아니라 과소 허용 방향의 회귀라 위험도는 낮지만, 이번
    PR이 명시적으로 의도한 "Viewer도 본인 것은 재인증 가능"이라는 동작을 지키는 안전망은 비어 있다.
  - 제안: 필수는 아니나, e2e에 "Viewer가 만든 personal → 본인이 reauthorize/request-scopes 시도 → 200/성공 경로
    진입" 케이스 1개를 추가하면 이 의도가 라우트 가드 변경에도 보존된다.

## 요약

핵심 보안 수정(Personal 통합 소유자 강제, Organization 통합 변경 Admin 승격, `oauth/begin` 우회 차단, precheck 식별자
은닉)은 `spec/2-navigation/4-integration.md` §8·§9.2·Rationale, `spec/5-system/1-auth.md` §3.2, `spec/5-system/3-error-handling.md`
§1.2와 함수 시그니처·에러 코드·판정 순서·엣지 케이스(락 재검사, fallback status omit, transitional status 등) 수준까지
정확히 일치하며, 테스트(unit/e2e)도 매트릭스 형태로 역할×스코프×액션 조합을 빠짐없이 고정해 대단히 꼼꼼하다. 유일한
결함은 이번 PR이 새로 작성한 두 언어(en/ko) 사용자 문서가 Viewer의 실제 권한(재인증·scope 요청은 가능, 삭제는 여전히
Editor+ 필요)을 정확히 반영하지 못한 것으로, 코드가 아니라 문서 텍스트 두 군데(각 언어 2곳, 총 4곳)의 정정 사항이다.

## 위험도

LOW
