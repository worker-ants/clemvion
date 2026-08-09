# Plan 정합성 검토 — auth-guard-reflection-hardening (spec/5-system/, --impl-done)

## 검토 방법

- target 코드 diff(`origin/main...HEAD`): `app.module.ts`(DiscoveryModule 등록) ·
  `common/decorators/workspace-reflection-canary.ts`(신규, 부팅 캐너리) ·
  `workspace.decorator.spec.ts` · `roles.guard.spec.ts`(UUID-shaped 픽스처 전환) ·
  `common/utils/uuid.ts`(신규 `isUuidShaped`) · `common/utils/workspace-context.util.ts`
  (비-UUID `X-Workspace-Id` → 400 `VALIDATION_ERROR`) · `main.ts`(캐너리 호출).
  spec 파일 diff 는 0건(`spec_impact: none` 과 정합).
- 소유 plan `plan/in-progress/auth-guard-reflection-hardening.md` (worktree
  `auth-guard-reflection-hardening-9c31f2` — 실제 worktree 경로와 일치, drift 없음) 전문 대조.
- `plan/in-progress/**` 전체에서 `X-Workspace-Id` · `WORKSPACE_ID_REQUIRED` ·
  `isUuidShaped`/`isValidUuid` · `handlerConsumesWorkspaceId`/`캐너리`/`fail-open`/`fail-closed`
  · `DiscoveryModule` 교차 검색으로 미해결 결정과의 충돌 여부 확인.
- 선행 관계가 있는 `spec-sync-auth-gaps.md`(`1-auth.md` pending_plans) ·
  `spec-fix-swagger-forbidden-response.md`(같은 P0 상위 PR 의 자매 후속) 본문 확인.

## 발견사항

없음 — CRITICAL·WARNING 대상 발견 없음.

### 참고 (비차단)

- **[INFO] plan 자체가 "후속 (이 PR 밖)" 3건을 미해결로 남긴 채 진행 중** — target 위치:
  `auth-guard-reflection-hardening.md` "## 후속 (이 PR 밖)" (README 캐너리 문서화 · fixture
  공용 모듈화 · 메모이제이션 실측 트리거 대기). 관련 plan: 동일 문서. 상세: `plan-lifecycle.md
  §5` 이동 자가점검 기준("미해결 follow-up 0건")상 이 plan 은 이번 PR 이 머지돼도
  `complete/` 로 이동할 수 없다 — 실제로 plan 본문이 그 사실을 스스로 인지하고 있고
  (`--impl-done`·`push+PR` 체크박스도 미완), 이 저장소의 다른 `*-residual-gaps.md`/
  `*-followups.md` plan 들과 동일한 장기-잔존 패턴이라 새로운 리스크는 아니다. 제안: 조치
  불요 — plan 이 `in-progress/` 에 남는 것 자체가 규약대로 동작하는 것이므로 기록 목적으로만
  남긴다.

## 정합성 확인 근거 (충돌 없음을 뒷받침)

1. **미해결 결정과의 충돌 없음** — 이 PR 이 내린 세 결정(부트 캐너리로 fail-open 경화 ·
   메모이제이션 보류 · 비-UUID 헤더 400 `VALIDATION_ERROR`)은 전부 자신의 plan
   문서 안에서 `--impl-prep`(WARNING #1·#2) 근거를 인용해 명시적으로 확정된 것이고, 다른
   `plan/in-progress/**` 어디에도 이 세 지점(`handlerConsumesWorkspaceId` 판별 방식,
   `X-Workspace-Id` 형식 검증 코드, 캐너리 도입 여부)을 "결정 필요" 로 열어둔 항목이 없다
   (전수 grep, 매치는 대상 plan 자신과 `3-error-handling.md`/`12-workspace.md` 의 기존 확정
   서술뿐).
2. **선행 plan 미해소 없음** — 이 변경이 전제하는 `RolesGuard`/`@WorkspaceId()` 재구성은
   `auth-workspace-membership-guard`(이미 `plan/complete/`)가 제공했고, 그 완료 상태를
   `spec-sync-auth-gaps.md`("[~] 이관, 완료 판정은 그 plan 이 소유")·
   `spec-fix-swagger-forbidden-response.md`(같은 PR 의 자매 spec 정정, 이미 반영 완료)가
   양쪽에서 확인해 준다. 이 PR 이 새로 의존하는 선행 조건은 없다.
3. **후속 항목 누락 없음** — 이 diff 는 `WORKSPACE_ID_REQUIRED`(헤더·클레임 둘 다 부재)
   의미를 건드리지 않고 신규 케이스(형식 오류)만 `VALIDATION_ERROR` 로 분리했으므로,
   `3-error-handling.md §1.3`/`2-api-convention.md §5.3` 를 인용하는 다른 spec-sync 계열
   plan 의 서술을 무효화하지 않는다. `spec-fix-swagger-forbidden-response.md` 의 잔여
   ~61 라우트 `@ApiForbiddenResponse` 후속과도 겹치지 않는다(이 diff 는 컨트롤러 데코레이터를
   건드리지 않음).

## 요약

`auth-guard-reflection-hardening` 의 코드 변경(부팅 캐너리·UUID 형식 검증·관련 테스트)은
소유 plan 문서가 자신이 내린 모든 결정에 대해 이미 `--impl-prep` 근거를 갖춰 기록해 뒀고,
다른 `plan/in-progress/**` 문서 어디에도 이 결정들과 충돌하는 "결정 필요" 항목이나 이 PR 이
전제하는 미해소 선행 조건이 없다. 후속 3건("이 PR 밖")은 plan 자체가 명시적으로 범위 밖으로
분리해 문서에 남겨 뒀고 이 저장소의 기존 관행(잔여-후속 plan 장기 존속)과 일치해 별도 조치가
필요 없다. Plan 정합성 관점에서 이 target 은 깨끗하다.

## 위험도

NONE
