# 변경 범위(Scope) 리뷰

## 작업 의도 파악

본 PR2 (impl-external-interaction-api-31801c) 의 작업 의도는 `plan/complete/external-interaction-api.md` 의 Phase P1~P10 에 정의된 External Interaction API 구현이다. 검토 대상 파일 16개는 다음 세 범주로 분류된다:

1. **Frontend i18n** (파일 1): `codebase/frontend/src/lib/i18n/dict/ko/triggers.ts` — P7 범위
2. **SDK 패키지** (파일 2~9): `codebase/packages/sdk/**` — P8 범위
3. **Plan/Review 산출물** (파일 10~16): `plan/complete/external-interaction-api.md`, `review/consistency/2026/05/21/00_08_35-impl-prep/**` — P10 및 impl-prep consistency check 결과

---

## 발견사항

### [INFO] computeNotificationSignature 함수의 공개 export — 허용 범위이나 경계 주의
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/impl-external-interaction-api-31801c/codebase/packages/sdk/src/signature.ts` + `src/index.ts`
- 상세: `computeNotificationSignature` 는 "발신측 호환 헬퍼" 로 공개 export 됨. README 에도 "backend 가 자동 서명하므로 사용 빈도는 낮지만 mock·테스트용도로 노출" 이라고 명시. Plan §3.2 (P8) 의 SDK 명세에는 `verifyNotificationSignature` 만 언급되어 있고 `computeNotificationSignature` 는 명시적으로 포함되지 않았다.
- 제안: 범위 이탈이라고 단정하기보다는 테스트 편의를 위한 합리적 추가로 볼 수 있으나, plan P8 체크리스트에 반영되지 않은 API 노출이므로 의도적임을 주석·README 로 이미 설명하고 있어 허용 수준.

### [INFO] SDK 패키지 이름 `@workflow/sdk` — plan 기술과 일치 확인 필요
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/impl-external-interaction-api-31801c/codebase/packages/sdk/package.json` line 2
- 상세: `package.json` 의 `"name": "@workflow/sdk"`. plan §3.2 원문은 `@clemvion/sdk` 로 기재되어 있으나, consistency check 결과(`review/consistency/…/naming.md`)에서 기존 scope(`@workflow`) 와 일관성 차원에서 `@workflow/sdk` 권장이 Info 로 기록됨. 실제 구현은 `@workflow/sdk` 로 확정된 것으로 보인다. 이는 plan 텍스트와 구현의 미세 불일치이나 scope 이탈이 아닌 deliberate 결정.
- 제안: plan 원문 `@clemvion/sdk` 문구를 `@workflow/sdk` 로 정정하는 commit 이 없으므로, 이미 완료 처리된 plan 파일에서도 해당 불일치가 남아 있음. 사소한 이력 관리 이슈.

### [INFO] i18n 파일에 `externalInteraction` 최상위 서브오브젝트 구조 — 기존 flat 키와 혼재
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/impl-external-interaction-api-31801c/codebase/frontend/src/lib/i18n/dict/ko/triggers.ts` 라인 131~155
- 상세: 기존 `triggers` 오브젝트는 모두 flat 키(`columnStatus`, `toggleActivate` 등)인데, 이번에 추가된 `externalInteraction` 만 중첩 오브젝트 형태로 추가됨. i18n-userguide 컨벤션이 중첩을 허용하는지 여부와 무관하게, 동일 dict 파일 내에서 구조가 혼재되어 패턴 불일치가 발생한다.
- 제안: plan P7 에서 "`triggers.ts` 에 notification / interaction 서브 키 추가" 로 명시되어 있어 의도적 선택이나, 기존 코드베이스의 i18n 사용 패턴(`dict.triggers.externalInteraction.section` vs `dict.triggers.columnStatus`)이 달라지는 점을 frontend 팀이 인식해야 함. naming consistency 관점의 경고이며 scope 이탈은 아님.

### [INFO] plan 파일이 `plan/complete/`에 위치하나 "머지 대기" 상태
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/impl-external-interaction-api-31801c/plan/complete/external-interaction-api.md` 라인 9
- 상세: 파일 상단 주석에 "PR2 (Backend + Frontend/SDK + E2E 통합) — 완료 / 머지 대기" 라고 적혀 있다. `plan/complete/` 위치는 plan-lifecycle 규약상 작업이 완전히 완료(main 머지)된 이후 이동하는 것이 원칙이나, 이번 PR 안에 `git mv` 를 포함한 것으로 보인다. 이는 plan P10 의 "plan §2/§3/§4/§5 모두 [x] → git mv complete + chore(plan): mark ... complete commit" 에 따른 의도적 선택.
- 제안: PR 머지 전에는 `plan/in-progress/` 에 있는 것이 정석이나, P10 체크박스 실행이 PR 안에 포함된 것이므로 scope 이탈이 아님. 다만 "머지 대기" 상태에서 `complete/`에 두는 패턴은 리뷰어가 혼동할 수 있으므로 인지 필요.

### [INFO] consistency review 산출물 파일 다수 포함
- 위치: `review/consistency/2026/05/21/00_08_35-impl-prep/SUMMARY.md`, `convention.md`, `cross-spec.md`, `naming.md`, `plan-coherence.md`, `rationale.md` (파일 11~16)
- 상세: 이 파일들은 impl-prep consistency check 의 산출물로, `plan/in-progress/external-interaction-api.md` 의 impl-prep check 의무 실행 결과임. `review/consistency/` 경로는 CLAUDE.md 규약상 올바른 위치이고, consistency-checker skill 의 산출물을 포함하는 것은 PR2 착수 의무 절차의 일환이다. 변경 범위 내에 포함되는 것이 맞다.
- 제안: 없음.

### [INFO] SSE 구독에서 token이 query string으로 노출
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/impl-external-interaction-api-31801c/codebase/packages/sdk/src/client.ts` 라인 1113~1114
- 상세: `subscribeToExecution` 에서 SSE URL 구성 시 `?token=${encodeURIComponent(token)}` 을 쿼리 파라미터로 전달한다. 이는 spec EIA §5.2 에서 "SSE 의 `?token=` query" 를 지원하도록 명시되어 있어 의도된 동작. scope 이탈 아님.
- 제안: 없음.

---

## 요약

16개 대상 파일 전체가 plan P7(i18n), P8(SDK), P10(plan mv, review 산출물)의 명시된 작업 범위 내에 있다. 의도하지 않은 파일 수정이나 무관한 리팩토링은 발견되지 않았다. `computeNotificationSignature` 의 추가 공개 export 는 테스트 편의를 위한 합리적 확장으로 README에 이미 설명되어 있으며, SDK 패키지 이름(`@workflow/sdk`)의 plan 텍스트와의 미세 불일치는 consistency check 산출물에서 이미 논의된 의도적 결정이다. i18n 파일의 중첩 오브젝트 패턴 도입은 plan P7의 명시적 지침에 따른 것이다. 범위를 벗어난 임의 포맷팅 변경, 불필요한 import 정리, 무관한 설정 변경은 없다.

## 위험도

NONE

STATUS=success ISSUES=0 PATH=/Volumes/project/private/clemvion/.claude/worktrees/impl-external-interaction-api-31801c/review/code/2026/05/21/12_23_04/scope.md RESET_HINT=
