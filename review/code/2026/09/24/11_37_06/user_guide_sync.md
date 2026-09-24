# 유저 가이드 동반 갱신(User Guide Sync) 리뷰

## 검토 절차 요약

`.claude/config/doc-sync-matrix.json` (rows 20개) 을 Read 하고 `PROJECT.md` §변경 유형 → 갱신 위치 매핑 본문을 보조로 대조했다. 변경 파일 목록(orchestrator prompt 기준):

- `CHANGELOG.md`
- `codebase/backend/src/modules/workspaces/workspaces.service.ts`
- `codebase/backend/src/modules/workspaces/workspaces.service.spec.ts`
- `codebase/backend/test/workspace-rbac.e2e-spec.ts`
- `plan/in-progress/member-auth-order.md`
- `plan/in-progress/spec-draft-nullable-notation-followups.md` (트래커 갱신)
- `review/code/2026/09/24/11_10_45/**`, `review/consistency/2026/09/24/10_22_24/**` (이전 라운드 리뷰 산출물 — doc-sync 매트릭스 target 이 아님, 스킵)

`git status --short` 확인 결과 워킹트리는 `review/code/2026/09/24/11_37_06/`(본 리뷰 산출물 자체) 외 untracked/staged 파일이 없다 — 변경분은 이미 커밋됐다(`f6c49c5f2` · `7b851df3f` · `23a2d1f39` · `3fcc19e2c` · `da5112f3f`). 저장소에 뮤테이션을 가하지 않았다.

## 매칭된 trigger

| trigger id | change_type | 판정 |
| --- | --- | --- |
| `auth-session-flow-change` | 인증·권한·세션 흐름 변경 | **매칭** (semantic) — `workspaces.service.ts::removeMember` 의 인가 판정 순서 변경 |
| `new-node`, `node-schema-change`, `new-ui-string`, `integration-provider-change`, `new-userguide-section-dir`, `backend-api-change`, `new-warning-code`, `new-error-code`, `expression-language-change`, `run-debug-flow-change` 등 | — | 불일치 (frontend `.tsx`/`docs/`/`nodes/`/`expression-engine`/`controller.ts`/`dto/` 변경 없음, 신규 코드 없음) |

`auth-session-flow-change` 의 trigger glob 은 `codebase/backend/src/modules/auth/**` 로 등재돼 있으나 `match: "semantic"` 이라 glob 은 힌트일 뿐이다. `workspaces.service.ts` 는 물리적으로 `modules/auth/` 밖이지만, 변경 내용은 워크스페이스 멤버 제거의 **권한 검사 순서** 자체이므로 change_type "인증·권한·세션 흐름 변경" 의 의미 범위에 해당한다. PROJECT.md §자주 누락되는 항목 은 이 정확한 패턴을 "인증·권한·세션 흐름 변경 vs 워크스페이스 가이드(`07-workspace-and-team/`) 미갱신 — 흐름 변경 + 가이드 갱신 + e2e 가 한 묶음" 이라고 명시해 재확인했다.

## 발견사항

- **[INFO]** `auth-session-flow-change` trigger 매칭 — 동반 갱신 target 점검 결과 실질 gap 없음
  - 변경 파일: `codebase/backend/src/modules/workspaces/workspaces.service.ts` (`removeMember()` 인가 순서: 멤버십 → 대상 존재 → self 위임 → admin → owner)
  - 매트릭스 항목: `auth-session-flow-change` — target "`codebase/frontend/src/content/docs/07-workspace-and-team/` 의 관련 페이지 + e2e", verify `make e2e-test`
  - 확인한 두 target:
    1. **e2e** — `codebase/backend/test/workspace-rbac.e2e-spec.ts` 에 `비-멤버는 대상 상태를 구분할 수 없다 — 존재·owner 오라클` 테스트가 같은 커밋 세트에 추가됨. target 충족.
    2. **가이드 페이지** — `codebase/frontend/src/content/docs/07-workspace-and-team/workspaces-and-members.mdx` §역할(RBAC) 은 이미 "Admin: 멤버 초대/제거", "Editor: 워크플로우·트리거·스케줄 CRUD + 실행(멤버 관리 권한 없음)" 이라고 **정확히** 기술하고 있었다. 이번 PR 은 그 문서화된 권한 모델을 어기던 구현 결함(비-admin/비-멤버가 응답 코드 차이로 대상의 존재·owner 여부를 알아낼 수 있던 정보 노출, 그리고 비-admin 이 owner 를 지목했을 때 `CANNOT_REMOVE_OWNER`(거짓 함의)를 받던 것)을 **구현을 문서에 맞춰 고친 것**이다. 문서가 서술하는 사용자 가시 권한 모델 자체는 변경 전후 동일하므로 MDX 갱신 대상이 없다.
  - 상세: `CANNOT_REMOVE_OWNER` → `ADMIN_REQUIRED` 로 바뀐 wire 코드는 실제로는 도달 불가능한 경로다 — CHANGELOG 가 명시하듯 프런트는 그 제거 버튼을 `RoleGate minRole="admin"` 으로 이미 가려서 비-admin 은 정상 UI 로는 그 API 를 호출할 자리에 도달하지 않는다(직접 API 호출로만 관측 가능한 순수 보안 경화). 두 에러 메시지(`owner는 제거할 수 없습니다.` / `Admin 이상의 권한이 필요합니다.`)는 backend 가 이미 한국어로 직접 발행하며 `backend-labels.ts` 의 `WARNING_KO`/`ERROR_KO`(영문 SoT 스킴, `codebase/backend/src/nodes/core/error-codes.ts` 전용) 매핑 대상이 아니다 — `NOT_A_MEMBER`/`ADMIN_REQUIRED`/`CANNOT_REMOVE_OWNER` 는 그 표에 없고 있을 필요도 없다(확인: `grep`, 매치 0건이지만 이는 원래부터 이 세 코드가 다른 i18n 체계에 속하기 때문).
  - 제안: 조치 불필요. 참고로만 남긴다 — 향후 유사 PR 에서 "07-workspace-and-team/ 미갱신"을 기계적으로 WARNING 처리하기 전에, 문서가 서술하는 권한 모델 자체가 바뀌었는지(신규 role capability, 신규 사용자 가시 문구)와 순수 내부 강제 순서 버그 수정을 구분할 것.

## 요약

매트릭스 20개 trigger 중 `auth-session-flow-change` 1건만 의미적으로 매칭됐다(workspaces 멤버 제거 권한 검사 순서 변경). 그 target 둘(e2e 보강 / `07-workspace-and-team/` 가이드) 을 확인한 결과 e2e 는 같은 커밋 세트에 추가돼 있고, 가이드는 이미 문서화된 권한 모델과 이번 수정 후 구현이 일치하므로(버그 수정이 문서를 실제로 반증하지 않음) 갱신 누락이 없다. i18n(`WARNING_KO`/`ERROR_KO`)·swagger jsdoc·다른 doc-sync target 은 모두 불일치(non-match) — 신규 노드·신규 UI 문자열·신규 코드·docs 디렉토리·표현식 엔진 변경이 이번 변경 set 에 없다. CRITICAL/WARNING 없음, INFO 1건(매칭 확인·gap 없음 기록).

## 위험도

NONE
