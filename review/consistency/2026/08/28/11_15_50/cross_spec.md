# Cross-Spec 일관성 검토 — `spec/5-system/1-auth.md` · `2-api-convention.md` · `3-error-handling.md`

검토 모드: `--impl-prep` (scope=`spec/5-system/`). 프롬프트에 완전 포함된 대상은 `1-auth.md`·`2-api-convention.md`·`3-error-handling.md`(target) 와 `0-overview.md`(관련) 뿐이며, 그 외 109개 파일은 컨텍스트 예산 초과로 stub 처리되어 있었다. 판정을 위해 아래 파일들은 저장소에서 직접 `Read`/`grep` 로 열었다: `spec/1-data-model.md`, `spec/data-flow/12-workspace.md`, `spec/2-navigation/6-config.md`, `spec/2-navigation/9-user-profile.md`, `spec/2-navigation/{4-integration,5-knowledge-base,8-marketplace,7-statistics}.md`, `spec/conventions/error-codes.md`, `plan/in-progress/spec-sync-auth-gaps.md`, 및 대조를 위해 `codebase/backend/src/common/guards/roles.guard.ts`·`src/modules/auth/auth.service.ts`.

전반적으로 이 영역은 이미 다수의 회차에 걸쳐 cross-spec 정합화가 이뤄진 상태다(문서 곳곳의 "SoT" 명시, `Rationale` 절, 과거 drift 정정 이력). 아래는 그 그물을 통과한 잔여 항목이다.

## 발견사항

- **[WARNING] JWT Access Token 예시의 `role` 클레임이 실제 인가 메커니즘과 어긋난다**
  - target 위치: `spec/5-system/1-auth.md` §2.2 "Access Token Payload" — 예시 JSON 에 `"role": "editor"` 필드가 있고, 부속 설명 문단은 `activeWorkspaceId` 필드만 상세히 다루며 `role` 필드에는 어떤 설명·근거도 붙어 있지 않다.
  - 충돌 대상: `spec/data-flow/12-workspace.md` §Rationale "멤버십 검증은 가드 1곳에서 — `@Roles()` 와 무관" (2026-08-08) — "역할 문자열 자체가 DB 조회 없이는 알 수 없기 때문" 이라고 명시하며, `@Roles()` 라우트는 **매 요청 DB 에서 `getMemberRole` 로 역할을 재조회**한다고 서술한다. `spec/5-system/1-auth.md` §3.3 도 "역할이 해당 액션에 대한 권한을 가지는지 확인" 이라고만 하고 소스를 JWT 클레임으로 지정하지 않는다.
  - 상세: 코드로도 확인됨 — `auth.service.ts`(`signAccessToken`)는 로그인 시점 role 을 토큰에 서명하지만, `roles.guard.ts`(`RolesGuard.canActivate`)는 `request.user.role`(JWT 클레임)을 **전혀 읽지 않고** `workspacesService.getMemberRole(workspaceId, userId)` 로 매번 DB 를 재조회해 역할 계층을 비교한다. 즉 §2.2 의 예시가 암시하는 "토큰에 서명된 role 이 인가에 쓰인다" 는 모델과, §3.3·data-flow §12-workspace 가 명시한 "역할은 항상 DB 에서 신선하게 읽는다" 는 모델이 같은 문서군 안에서 서로 다른 서술을 하고 있다. `activeWorkspaceId` 필드는 rename·dual-read·재발급 시점까지 상세히 문서화된 반면, `role` 필드는 존재 이유(단순 표시용인지, 캐시인지, 죽은 필드인지)에 대한 어떤 근거도 없어 역할 변경이 즉시 반영되는지에 대한 오해 소지가 있다.
  - 제안: `developer`(read-only) 가 아니라 `project-planner` 턴에서 §2.2 에 각주를 추가해 "`role` 은 로그인 시점 스냅샷이며 인가에는 사용되지 않는다(실제 인가는 §3.3/`RolesGuard` 가 매 요청 DB 조회)" 를 명시하거나, 필드가 실제로 불필요하면 예시에서 제거해 인가 모델과 일치시킨다.

- **[WARNING] "동시 세션 관리자 설정 가능" 이 Workspace 데이터 모델의 `settings` known-keys 레지스트리와 어긋난다**
  - target 위치: `spec/5-system/1-auth.md` §2.3 세션 정책 표 — `동시 세션 | 기본 5개 (관리자 설정 가능)`. Planned/미구현 표시가 없다(같은 문서의 §1.3 LDAP/SAML, §4.2 감사 로그 보존 정책은 동일 패턴에서 명시적으로 "Planned"·"미구현" 배지를 붙인다).
  - 충돌 대상: `spec/1-data-model.md` §2.2 Workspace — `settings` JSONB 의 "알려진 키" 를 `timezone`·`interactionAllowedOrigins`·`maxConcurrentExecutions` 3개로 명시적으로 못박아 두었으나 세션 한도 관련 키가 없다. `spec/2-navigation/6-config.md`·`spec/2-navigation/9-user-profile.md` 어디에도 이 값을 편집하는 UI·API 가 문서화되어 있지 않다.
  - 상세: 코드 확인 결과 `codebase/backend/src/modules/auth/` 어디에도 세션 개수 상한(5)·초과 시 자동 종료 로직·해당 설정을 읽는 코드가 없다(grep 0건). `plan/in-progress/spec-sync-auth-gaps.md`(이 spec 의 지정 추적 문서)에도 이 항목이 등재되어 있지 않아, 이미 알려진 갭으로 관리되고 있지도 않다. "관리자 설정 가능" 이라는 서술이 어느 spec 문서의 표면(설정 화면, API, 데이터 모델 키)과도 연결되지 않는다.
  - 제안: (a) 이 기능이 실제로 계획된 것이면 `1-data-model.md` §2.2 known-keys 에 항목을 추가하고 `plan/in-progress/spec-sync-auth-gaps.md` 에 미구현 항목으로 등재, (b) 계획이 아니라면 "관리자 설정 가능" 문구를 제거하거나 "고정값(비설정 가능)" 으로 정정한다. 어느 쪽이든 `project-planner` 턴 필요.

- **[INFO] `WorkspaceInvitation` 엔티티가 `spec/1-data-model.md` 에 정식 등재되어 있지 않다**
  - target 위치: `spec/5-system/1-auth.md` §1.5.1 토큰 정책 — `WorkspaceInvitation.token`(UNIQUE) 을 named entity 필드처럼 인용.
  - 충돌 대상: `spec/1-data-model.md` 전체에 `WorkspaceInvitation` 섹션이 없다(`grep` 0건 — `AuditLog`/`RefreshToken`/`LoginHistory`/`WebAuthnCredential` 등 인접 인증 엔티티는 모두 §2.x 로 정식 등재되어 있는 것과 대비). 실제 필드 집합(`workspace_id`/`email`/`role`/`token`/`invited_by`/`expires_at`/`accepted_at`/`accepted_by`)은 `spec/data-flow/12-workspace.md` §1.2~§1.4 의 mermaid 시퀀스에만 흩어져 기술되어 있고, `spec/2-navigation/9-user-profile.md` 도 부분적으로 참조한다. 세 문서 간 필드 정의 자체는 서로 모순되지 않았으나(토큰 저장 형태·만료·`accepted_at IS NULL` 원자적 소비 로직 모두 일치), 캐노니컬 앵커가 없어 향후 한쪽만 수정되면 drift 가 감지되지 않을 위험이 있다.
  - 제안: `project-planner` 턴에서 `1-data-model.md` 에 `WorkspaceInvitation` §2.x 를 신설하고 세 문서가 이를 참조하도록 정리(문서화 동기화, 즉각적 차단 사유는 아님).

## 요약

`spec/5-system/1-auth.md`·`2-api-convention.md`·`3-error-handling.md` 는 이미 여러 차례의 spec-sync 이력을 거쳐 RBAC 매트릭스·에러 코드 카탈로그·API 응답 계약 수준에서 `2-navigation/*`·`data-flow/*`·`1-data-model.md`·`conventions/*` 와 폭넓게 정합돼 있다(Auth Config/Model Config 권한 분리, invitation 에러 코드의 lowercase historical-artifact 처리, `activeWorkspaceId` dual-read, 감사 액션 카탈로그 등 모두 대조 결과 일치). 실측으로 확인된 새 이슈는 3건으로, ① JWT `role` 클레임이 문서상 함의하는 신뢰 모델이 실제 RBAC 서술(및 코드)과 어긋나는 WARNING, ② 관리자 설정 가능 동시 세션 한도가 데이터 모델/설정 화면 어디에도 대응 표면이 없는 WARNING, ③ `WorkspaceInvitation` 엔티티가 데이터 모델에 정식 등재되지 않은 INFO 다. 셋 다 구현을 즉시 막을 CRITICAL 모순은 아니며, 문서 명확화 또는 다음 planner 턴에서 정리하면 되는 수준이다.

## 위험도

LOW
