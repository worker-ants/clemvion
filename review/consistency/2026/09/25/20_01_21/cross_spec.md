# Cross-Spec 일관성 검토 — `spec/2-navigation/9-user-profile.md` (--impl-prep)

## 검토 범위 및 방법

- Target: `spec/2-navigation/9-user-profile.md` (전문 포함)
- 함께 전문 포함된 관련 spec: `spec/5-system/1-auth.md`, `spec/data-flow/12-workspace.md`, `spec/0-overview.md`
- 그 외 `spec/**` 116개 파일 중 **112개가 컨텍스트 예산 초과로 본문 생략** (`spec/1-data-model.md`, `spec/5-system/2-api-convention.md`, `spec/5-system/3-error-handling.md`, `spec/conventions/error-codes.md`·`audit-actions.md`, `spec/data-flow/1-audit.md`·`4-file-storage.md`·`8-notifications.md`·`9-observability.md`, `spec/7-channel-web-chat/4-security.md`, `spec/2-navigation/6-config.md`·`_layout.md` 등 target 이 직접 SoT 로 인용하는 문서 다수 포함)
- 검증 보강을 위해 실제 코드(`codebase/backend/src/modules/workspaces/workspaces.controller.ts`, `auth.controller.ts`)를 직접 대조해, target·data-flow/12-workspace.md 간 서술이 실제 `@Roles()`/`@WorkspaceParam` 배선과 일치하는지 확인했다.

이번 turn 은 직전 merge(`#1399`·`#1400`, 경로 파라미터 워크스페이스 RolesGuard·403 코드)와 target(9-user-profile.md)이 여전히 정합한지가 핵심 질문이다.

---

## 발견사항

- **[WARNING]** Cross-spec 검토 근거 자체가 컨텍스트 예산으로 절단됨
  - target 위치: 프롬프트 조립 결과 전체(`_prompts/cross_spec.md`)
  - 충돌 대상: `spec/1-data-model.md`, `spec/5-system/2-api-convention.md`, `spec/5-system/3-error-handling.md`, `spec/conventions/error-codes.md`·`audit-actions.md`, `spec/data-flow/1-audit.md`·`4-file-storage.md`·`8-notifications.md`·`9-observability.md`, `spec/7-channel-web-chat/4-security.md`, `spec/2-navigation/6-config.md` 등 112개 파일
  - 상세: target 문서가 SoT 로 직접 링크·인용하는 문서 대부분이 "본문 생략됨 — 컨텍스트 예산 초과"로 빠져 있다. 예: §6.1 아바타 정책이 인용하는 `data-flow/4-file-storage.md §2.3`, §6.3 이 인용하는 `1-data-model.md §2.25 AlertRule`·`data-flow/9-observability.md §1.3`, §4.3 이 인용하는 `7-channel-web-chat/4-security.md §2·§3`, §5.1 이 인용하는 `data-flow/8-notifications.md`, 응답 형식(`{ data: { items } }`) 규약의 SoT `5-system/2-api-convention.md §5.2` 등이 모두 미검증 상태다. 이는 이 저장소에서 반복 확인된 기존 한계(consistency `--spec` 예산이 관련 spec 을 통째로 떨어뜨리는 문제)와 동일한 양상이다.
  - 제안: 본 리포트의 "위험도"는 **검증 가능했던 4개 문서(target + 1-auth.md + data-flow/12-workspace.md + 0-overview.md) 범위 내에서의 결론**으로 한정해서 읽어야 한다. 위 인용 대상 파일들을 타겟팅한 재실행(파일 목록을 좁혀 예산 내로) 또는 수동 대조를 권고한다. 이번 작업(`canary-readme-recheck-test`, README·테스트 전용, `spec_impact: none`)의 코드 스코프(`workspaces.controller.ts`/`workspaces.service.spec.ts`)에 한정하면 이 갭이 실제 차단 사유는 아니다 — 하지만 다음에 `9-user-profile.md` 자체를 수정하는 작업(예 `spec-sync-user-profile-gaps.md`)에서는 이 갭을 반드시 좁혀야 한다.

- **[WARNING]** `9-user-profile.md §4.2` 역할 매트릭스가 `1-auth.md §3.2`·자기 자신의 §6.1 API 표와 다른 접근 범위를 암시
  - target 위치: `spec/2-navigation/9-user-profile.md` §4.2 "역할 권한 매트릭스" (`워크스페이스 설정`·`멤버 관리` 행, Editor/Viewer = ❌)
  - 충돌 대상: `spec/5-system/1-auth.md` §3.2 리소스별 권한 매트릭스(`Workspace 설정`: Editor=R, Viewer=R · `멤버 관리`: Editor=R, Viewer=R) / target 자신의 §6.1 API 표(`GET /api/workspaces/:id/settings` — "멤버 read, viewer 포함" · `GET /api/workspaces/:id/members` — 역할 제한 서술 없음)
  - 상세: §4.2 는 Owner/Admin 외 전 역할에 ✅/❌ 이진 표기를 쓰고 "워크스페이스 설정"·"멤버 관리"를 Editor/Viewer 모두 ❌ 로 적는다. 문자 그대로 읽으면 "접근 자체 불가"로 해석되지만, 같은 리소스에 대해 §3.2 는 Editor/Viewer 에게 명시적으로 `R`(읽기)을 부여하고, target 자신의 §6.1 도 viewer 를 포함한 멤버의 읽기(GET)를 허용한다고 적는다. `data-flow/12-workspace.md §4` 의 유사 표는 "본 표는 **데이터 변경 권한 관점**의 요약이다"라는 명시적 스코프 문구를 달아 이 혼동을 피했지만, §4.2 에는 그런 스코프 한정 문구가 없다 — 표 제목이 "역할 권한 매트릭스"라 canonical RBAC 표(1-auth §3.2)와 동일한 것으로 오독될 여지가 있다.
  - 제안: §4.2 표 상단에 "본 표는 [워크스페이스 관리 화면]에서의 **편집/관리 액션** 기준이며, 읽기는 §6.1·1-auth §3.2 를 따른다"는 한 줄을 추가하거나, `data-flow/12-workspace.md §4` 와 동일한 스코프 disclaimer 를 붙여 1-auth.md §3.2 (canonical) 와의 관계를 명시할 것을 권한다. (기능 동작 자체의 모순은 아니며, 문서 간 표기 범위 불일치에 한정된다.)

---

## 검증 완료 — 충돌 없음으로 확인된 항목 (참고용)

이번 merge(`#1399`·`#1400`)가 도입한 경로 파라미터 워크스페이스 RolesGuard 모델과 target 의 서술을 실제 코드(`workspaces.controller.ts`, `auth.controller.ts`)까지 대조해 확인한 결과, 다음은 **정합**했다:

- target §3(워크스페이스 전환)의 "경로 파라미터 워크스페이스 라우트는 header/token 이 아니라 경로 값이 인가 대상" 서술은 `data-flow/12-workspace.md` §Rationale "경로 파라미터 워크스페이스도 가드가 본다 (2026-09-25)"와 문구·범위가 일치.
- target §6.1 의 `GET /api/workspaces/:id/settings` "비-멤버 403 `NOT_A_MEMBER`"는 `data-flow/12-workspace.md` §Rationale "가드 거부의 오류 코드"의 비멤버=`NOT_A_MEMBER` 규칙과 일치.
- 경로 파라미터 워크스페이스 라우트 15곳(`workspaces.controller.ts` 14 + `auth.controller.ts` switch 1)의 역할 분포(코드 실측: `@Roles('admin')` 8 · `@Roles('owner')` 2 · 무역할 5)는 target §6.1 API 표에 나열된 각 라우트의 권한 표기(Admin+/Owner/무표기)와 정확히 대응한다 — 처음엔 target 표기상 "(Admin+)" 태그가 9곳으로 보여 1건 불일치를 의심했으나, 실제로는 `DELETE /api/workspaces/:id/members/:memberId`가 가드 레벨에서는 무역할(멤버면 통과)이고 Admin 판정은 서비스 계층(`assertAdmin`)에서 수행되는 것으로 코드 확인 — target 의 "(Admin+)" 표기는 최종 동작 기준으로는 틀리지 않는다.

---

## 요약

검증 가능했던 4개 문서(target·1-auth.md·data-flow/12-workspace.md·0-overview.md) 범위에서는 직전 merge(#1399·#1400)의 경로 파라미터 워크스페이스 가드 변경과 target(`9-user-profile.md`)의 서술·RBAC 표기·에러 코드가 실제 코드까지 대조해 정합함을 확인했으며 CRITICAL 은 없다. 다만 (1) `spec/**` 112개 파일이 컨텍스트 예산으로 생략되어 target 이 직접 인용하는 다수 SoT 문서(데이터 모델·API 컨벤션·에러 코드 카탈로그·notifications/observability/file-storage 등)를 이번 실행에서 검증하지 못했고, (2) `9-user-profile.md §4.2` 의 역할 매트릭스가 `1-auth.md §3.2`·target 자신의 §6.1 대비 스코프 disclaimer 없이 더 좁은 접근으로 읽힐 여지가 있다. 둘 다 즉시 구현을 막을 사안은 아니나(특히 이번 작업은 README·테스트 전용, `spec_impact: none`), spec 본문을 직접 수정하는 다음 작업에서는 해소가 필요하다.

## 위험도

LOW
