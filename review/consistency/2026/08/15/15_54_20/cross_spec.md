# Cross-Spec 일관성 검토 — `spec/5-system/` (--impl-prep)

## 검토 방법

프롬프트 번들에는 `spec/5-system/1-auth.md`·`2-api-convention.md`·`3-error-handling.md` 세 파일만 전문이 포함되고 나머지(4-execution-engine·6-websocket-protocol·14-external-interaction-api·1-data-model·2-navigation/9-user-profile 등)는 "컨텍스트 예산 초과로 절단"돼 본문이 비어 있었다. 이 상태로는 target(`1-auth.md`)과 다른 영역의 실제 정합성을 판단할 수 없으므로, 저장소의 실제 `spec/**` 파일을 직접 열어 다음 교차 지점을 대조했다:

- RBAC 매트릭스 §3.2 vs `spec/data-flow/12-workspace.md` §3.2
- User/WebAuthnCredential/LoginHistory 필드 vs `spec/1-data-model.md` §2.1·§2.18.2·§2.21
- 감사 액션 카탈로그 vs `spec/conventions/audit-actions.md`
- 에러 코드 historical-artifact 레지스트리(초대 흐름 lowercase) vs `spec/conventions/error-codes.md`
- 세션·로그인이력·이메일변경·초대 엔드포인트 vs `spec/2-navigation/9-user-profile.md` §6.1
- AuthConfig CRUD·Reveal 권한 vs `spec/2-navigation/6-config.md` §A.4
- System Status RBAC 예외 vs `spec/5-system/16-system-status-api.md` §4
- 워크스페이스 클레임(`activeWorkspaceId`) vs `spec/5-system/2-api-convention.md` §2.3, `3-error-handling.md`

target 파일(`spec/5-system/1-auth.md`, HEAD 기준 uncommitted diff 없음)은 `git diff` 결과 워킹 트리에 변경사항이 없어, 이번 검토는 **기존 spec 상태 자체**에 대한 impl-prep 사전 점검으로 수행했다.

## 발견사항

- **[INFO]** `WORKSPACE_ID_REQUIRED` 설명이 rename 이전 클레임명(`workspaceId`)을 그대로 씀
  - target 위치: `spec/5-system/1-auth.md` §2.2 (활성 워크스페이스 클레임은 `activeWorkspaceId` 로 rename, dual-read `activeWorkspaceId ?? workspaceId`)
  - 충돌 대상: `spec/5-system/3-error-handling.md` §1.3, `WORKSPACE_ID_REQUIRED` 행 — "`X-Workspace-Id` 헤더와 JWT `workspaceId` 둘 다 없음"
  - 상세: `1-auth.md` §2.2 은 `activeWorkspaceId` 를 wire 상의 write 필드로, `workspaceId` 는 legacy dual-read 전용으로 명시한다. 반면 `3-error-handling.md` 의 해당 행은 여전히 "JWT `workspaceId`" 라는 옛 이름으로만 지칭해, rename 이후 처음 읽는 사람에게 두 문서가 서로 다른 클레임을 말하는 것처럼 보일 수 있다. 기능적으로는 dual-read 라 트리거 조건(둘 다 부재) 자체는 동일해 동작 모순은 아니다.
  - 제안: `3-error-handling.md` §1.3 의 문구를 "`X-Workspace-Id` 헤더와 JWT `activeWorkspaceId`(legacy `workspaceId` dual-read) 둘 다 없음" 등으로 동기화. 낮은 우선순위 — 동작 회귀는 없음.

이 외에 위에 나열한 교차 지점(RBAC 매트릭스, User/WebAuthnCredential/LoginHistory 데이터 모델, 감사 액션 카탈로그, 에러 코드 historical-artifact 레지스트리, 세션·이메일변경·초대 엔드포인트, AuthConfig CRUD/Reveal 권한, System Status RBAC 예외)에서는 CRITICAL/WARNING 급 모순을 찾지 못했다. 특히 §3.2 "멤버 관리" Admin=CRUD 항목은 `data-flow/12-workspace.md` §3.2(`admin ✓ (owner 제외)`)와 정확히 일치하며, target 문서 자체의 Rationale 이 이 정합화 이력(2026-07-28)을 이미 기록하고 있다.

## 요약

`spec/5-system/1-auth.md` 는 다른 영역(데이터 모델·워크스페이스 RBAC·감사 액션·에러 코드 레지스트리·사용자 프로필 엔드포인트·설정 spec)과 광범위하고 정확하게 상호 참조돼 있으며, 이번 검토에서 실제 계약을 어긋나게 할 CRITICAL·WARNING 급 모순은 발견되지 않았다. 유일한 발견은 워크스페이스 JWT 클레임 rename(`workspaceId`→`activeWorkspaceId`) 이후 `3-error-handling.md` 한 곳에 남은 옛 이름 표기로, 동작에는 영향 없는 INFO 급 문서 동기화 항목이다. 다만 이번 검토는 프롬프트 번들이 컨텍스트 예산으로 대부분 파일(`4-execution-engine.md`·`6-websocket-protocol.md`·`14-external-interaction-api.md`·`1-data-model.md` 등)을 절단해, 실제 저장소 파일을 직접 열어 대조한 결과다 — 번들만으로는 이 판정이 불가능했다는 점을 다음 impl-prep 실행 시 참고할 것.

## 위험도

LOW
