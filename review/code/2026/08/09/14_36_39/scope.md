# 변경 범위(Scope) 리뷰

## 검토 방법

`plan/in-progress/auth-guard-reflection-hardening.md`(W1 부트타임 캐너리, W3 메모이제이션 유예, W4 비-UUID 헤더 400)를 기준선으로 22개 변경 파일을 대조했다. 코드 파일(`app.module.ts`·`main.ts`·`workspace-reflection-canary.ts(+spec)`·`uuid.ts(+spec)`·`workspace-context.util.ts(+spec)`)과 관련 테스트 픽스처 갱신(`roles.guard.spec.ts`·`workspace.decorator.spec.ts`)은 전부 W1/W4 로 직접 추적되며, `review/consistency/2026/08/09/14_01_15/**`(8개 checker 산출물)는 CLAUDE.md 가 요구하는 `--impl-prep` 의무 산출물이라 PR 에 포함되는 것이 정상이다. 이 범위 밖 항목 하나를 아래에 기록한다.

### 발견사항

- **[WARNING]** 이 worktree 의 작업 범위(`auth-guard-reflection-hardening`)와 무관한 **다른 task 소유 plan 파일 이동**을 수행 — 같은 PR 에 포함된 자체 consistency-check 가 명시적으로 "권한 밖이라 수행하지 않음"이라고 결론 낸 것과 반대로 실행됨
  - 위치: `plan/in-progress/auth-guard-reflection-hardening.md:128-135` (신설 절 `## 부수 — plan 위생 1건`), 실제 이동 대상은 `plan/complete/spec-draft-workspace-header-membership-invariant.md`(신규, gate 1-20 등) / `plan/in-progress/spec-draft-workspace-header-membership-invariant.md`(전체 삭제)
  - 근거(모순되는 자체 산출물): `review/consistency/2026/08/09/14_01_15/plan_coherence.md:54-56` — "두 plan 의 소유 worktree(`auth-workspace-membership-guard-2b94db`) 쪽에서 잔여 체크리스트를 확인해 `plan/complete/` 로 이동. **본 worktree(`auth-guard-reflection-hardening-9c31f2`) 권한 밖이라 이동은 수행하지 않음**"
  - 상세: `spec-draft-workspace-header-membership-invariant.md`는 `worktree: auth-workspace-membership-guard-2b94db` 소유의 plan 문서다. 같은 세션의 `plan_coherence` checker 가 이 문서(및 자매 문서 `spec-fix-swagger-forbidden-response.md`)를 "정합성상 이미 반영 완료로 보이나, 이동은 소유 worktree 몫이며 본 worktree 는 권한 밖"이라고 명시적으로 판정했음에도, 실제 커밋은 그중 하나(`spec-draft-workspace-header-membership-invariant.md`)만 `plan/complete/` 로 옮겼다(자매 문서 `spec-fix-swagger-forbidden-response.md`는 "미완 체크박스 2건" 사유로 그대로 뒀다 — 이건 checker 의 "권한 밖" 사유와는 다른 별개 판단 기준이라 선택 근거가 일관되지 않는다). 실측(“#1103 에 전부 반영됨”) 자체는 plan 문서에 잘 기록돼 있어 결론이 틀렸다고 보기는 어렵지만, **이 작업의 명시 목적(W1/W3/W4 guard reflection 경화)과 무관한 다른 task 의 plan lifecycle 정리**이고, 같은 PR 안의 checker 가 스스로 낸 "권한 밖" 판정을 오버라이드하면서 그 오버라이드에 대한 명시적 근거(왜 checker 의 권고를 따르지 않았는지)는 남기지 않았다. 소유 worktree(`auth-workspace-membership-guard-2b94db`)가 별도로 동일 이동을 수행 중이라면 두 worktree 간 중복 조치·머지 충돌 가능성도 있다.
  - 제안: 이 plan 이동을 이번 PR 에서 분리하거나(별도 커밋/PR로), 최소한 plan 문서에 "checker 의 '권한 밖' 권고에도 불구하고 실측 근거(#1103 전량 반영 확인)로 오버라이드했다"는 명시적 사유를 남길 것. 소유 worktree(`auth-workspace-membership-guard-2b94db`)가 이미 살아있다면 그쪽에 먼저 확인 후 진행하는 편이 충돌을 피한다.

그 외 항목은 범위 이탈로 볼 근거가 없었다:
- `app.module.ts`(`DiscoveryModule` 추가) · `main.ts`(`assertWorkspaceIdReflectionWorks` 호출) — W1 캐너리에 필요한 최소 배선, 인라인 주석으로 근거 명시.
- `workspace-reflection-canary.ts`/`.spec.ts`(신규) — W1 산출물 그 자체.
- `uuid.ts`/`.spec.ts` 의 `isUuidShaped` 신설 — W4 산출물 그 자체, `isValidUuid` 는 그대로 두고 신규 함수만 추가(리팩터링 아님).
- `workspace-context.util.ts`(`BadRequestException` throw 추가) — W4 산출물, 기존 순수 함수 서술("(순수 함수)")을 제거한 것도 동작 변경(throw 도입)에 정확히 대응하는 문서 수정.
- `roles.guard.spec.ts`/`workspace.decorator.spec.ts`/`workspace-context.util.spec.ts` 의 `'ws1'`→UUID 픽스처 대량 치환 — W4 형식 검증 도입의 직접 파급(기존 임의 문자열 픽스처가 400 을 받게 됨)이며 plan `§부수 — 픽스처가 프로덕션에서 존재할 수 없는 값이었다`에 사전 문서화됨. 이름 의미(`OWN`/`VICTIM` 등)는 보존, 값만 치환 — 불필요한 리팩토링 아님.
- `CHANGELOG.md` — W1/W4 요약, 범위 내.
- `review/consistency/2026/08/09/14_01_15/**`(8파일) — CLAUDE.md 의 `--impl-prep` 의무 산출물, 정상 포함.

### 요약

핵심 코드 변경(W1 부트타임 캐너리, W3 유예 결정 문서화, W4 UUID 형식 검증 400화)은 plan 이 미리 정의한 범위와 정확히 일치하고, 파생된 테스트 픽스처 대량 치환도 그 변경의 직접 파급일 뿐 무관한 리팩토링이 아니다. 유일한 범위 이탈은 다른 task(`auth-workspace-membership-guard-2b94db`) 소유의 plan 문서를 `plan/complete/` 로 이동한 "부수" 항목으로, 같은 PR 에 포함된 자체 consistency checker 가 "본 worktree 권한 밖"이라고 명시적으로 권고한 것과 반대로 실행됐다는 점에서 프로세스 상 스코프 경계를 넘었다. 기능적 위험은 낮지만(문서 이동일 뿐 런타임 영향 없음), 다른 worktree 와의 중복 작업·충돌 가능성과 자체 판정을 오버라이드한 근거 미기재는 짚어야 한다.

### 위험도

LOW
