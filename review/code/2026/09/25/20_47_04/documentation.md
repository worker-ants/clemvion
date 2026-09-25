# 문서화(Documentation) 리뷰

## 발견사항

- **[INFO]** README 캐너리 절 재작성이 실제 구현과 문장 단위로 정확히 일치한다
  - 위치: `codebase/backend/README.md:50`-`63` (§«워크스페이스 reflection 캐너리»)
  - 상세: 두 판별(`@WorkspaceId()` / `@WorkspaceParam(...)`)을 합산 0 에서만 부팅을 거부한다는 서술은
    `codebase/backend/src/common/decorators/workspace-reflection-canary.ts`의
    `assertWorkspaceIdReflectionWorks`(`if (total === 0) throw ...`)와 일치하고, 부팅 로그 문구
    ("`@WorkspaceId() 소비 라우트 N건 인식 · @WorkspaceParam() 소비 라우트 M건 인식`")도 실제
    `logger.log(...)` 호출 문자열과 그대로 일치한다. "먼저 볼 곳" 지시(`handlerConsumesWorkspaceId` ·
    `workspaceParamNamesOf`)도 `WorkspaceIdReflectionBrokenError` 메시지·실제 공유 골격
    (`routeArgEntriesMatching`)과 부합한다. 판별별 실패 영향 설명(멤버십 검증 스킵 vs 역할 요구가
    헤더·토큰 워크스페이스로 오판정)도 `workspace.decorator.ts`의 JSDoc·에러 메시지 문구와 일치한다.
  - 제안: 없음 — 오래된 주석/README 불일치를 찾으려 했으나 발견하지 못했다. 이번 라운드는
    선행 라운드(`review/code/2026/09/25/20_20_00` W3)가 지적한 "과밀 문장"을 판별별 불릿 두 개로
    분리해 가독성도 개선했다.

- **[INFO]** 신규 유닛 테스트의 JSDoc이 실제 재검사 분기 조건과 일치한다
  - 위치: `codebase/backend/src/modules/workspaces/workspaces.service.spec.ts` — 신규 `it.each` 블록 상단 JSDoc
    (unified diff 게이트 1144-1149)
  - 상세: "재검사 조건의 OR 두 가지 — `role !== 'owner'` · `!requesterMembership`" 서술은
    `workspaces.service.ts`의 `transferOwnership` 트랜잭션 내부
    `if (!requesterMembership || requesterMembership.role !== 'owner') this.throwOwnerTransferRequired();`
    와 정확히 대응한다. 테스트 자체도 무락 선행(`getMemberRole`, lock 없음 → `'owner'`)과 락 재검사
    (`lock` 있음 → `lockedRole`)를 mock의 `opts.lock` 유무로 분기해 두 값(`'admin'`, `null`)을
    각각 검증하므로 주석-코드 간 괴리가 없다.
  - 제안: 없음.

- **[INFO]** CHANGELOG 미기재 판단이 저장소 기준과 일치한다
  - 위치: `plan/in-progress/canary-readme-recheck-test.md` 체크리스트 "CHANGELOG 판정 — 항목 없음"
  - 상세: `CHANGELOG.md` 상단 기준("항목을 내지 않는다 — ... 한 기능의 동작을 고정하는 테스트 추가
    (가드가 아닌 커버리지) · 문서 · spec · plan · 리뷰 산출물만의 변경")과 이번 변경 성격(README 문구
    정정 + 기존 동작을 고정하는 커버리지 테스트 추가, 동작 변화 없음, `spec_impact: none`)이 정확히
    부합한다.
  - 제안: 없음.

- **[INFO]** plan 트래커(`plan/in-progress/spec-draft-nullable-notation-followups.md`)에 등재된
  두 신규 planner 항목이 참조하는 `--impl-prep` 세션(`review/consistency/2026/09/25/20_01_21`)의
  W2·W3 내용과 문구가 일치하는지 대조했다 — 일치한다. `W3`의 "오독" 판정에 대해서도 제시된 실측
  (`@Roles('owner')` 2곳: `remove`·`transferOwnership`)이 소스와 부합하는 서술이라 문서적으로
  문제 없다.
  - 제안: 없음.

이번 diff 범위(`codebase/backend/README.md`, `workspaces.service.spec.ts`, 두 plan 파일)에서
독스트링 누락, README-코드 불일치, 오래된 주석, 미문서화 설정/API 변경, CHANGELOG 누락 등
CRITICAL·WARNING 급 문서화 결함은 발견되지 않았다. 나머지 리뷰 대상 파일(5~26번, 이전 라운드
`review/code/.../20_20_00`·`review/consistency/.../20_01_21` 산출물)은 이미 생성된 리뷰/일관성
검토 보고서 그 자체이며 이번 라운드의 변경 대상이 아니라 문서화 관점 재평가 대상에서 제외했다.

## 요약

이번 변경은 `#1399` 이후 실제 구현(두 판별 합산 캐너리)과 어긋나 있던 backend README 캐너리 절을
소스 코드·에러 메시지·로그 문구와 문장 단위로 재대조해 바로잡은 문서 정정, 그리고 `transferOwnership`
트랜잭션 내부 재검사 분기(OR 두 갈래)를 처음으로 고정하는 유닛 테스트에 정확한 JSDoc을 추가한
변경이다. 대조 결과 README 서술과 실제 코드(`workspace.decorator.ts`,
`workspace-reflection-canary.ts`) 사이, 테스트 JSDoc과 실제 서비스 로직(`workspaces.service.ts`)
사이 어디에도 불일치가 없었고, CHANGELOG 미기재 판단도 저장소 기준과 부합한다. 문서화 관점에서
지적할 결함이 없다.

## 위험도
NONE
