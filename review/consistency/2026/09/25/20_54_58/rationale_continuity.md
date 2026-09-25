# Rationale 연속성 검토 보고서 (--impl-done)

검토 대상: `git diff origin/main...HEAD -- code_areas` — `codebase/backend/README.md`(11줄) ·
`codebase/backend/src/modules/workspaces/workspaces.service.spec.ts`(54줄, 신규 테스트 1블록).
spec 델타는 0(이 브랜치는 `spec/**` 을 바꾸지 않았다 — 정상). 대조 대상 Rationale:
`spec/5-system/1-auth.md` §Rationale "부트 캐너리 — `@WorkspaceId()` reflection 자가검증"과
`spec/data-flow/12-workspace.md` §Rationale "경로 파라미터 워크스페이스도 가드가 본다(2026-09-25)".

## 확인한 사실

1. **README diff**는 부트 캐너리 문단을 "`@WorkspaceId()` 단일 판별" 서술에서 "`@WorkspaceId()` ·
   `@WorkspaceParam(...)` 두 판별 합계" 서술로 바꾸고, 부팅 로그가 두 개수를 따로 남긴다고 적는다.
   이것은 **이미 기록된 Rationale의 재도입/번복이 아니라 그 Rationale이 이미 서술한 상태를 문서에
   뒤늦게 반영**한 것이다 — `1-auth.md` §Rationale "부트 캐너리" (a)가 "2026-09-25 부터는 같은
   방식으로 `@WorkspaceParam(...)` 소비도 판별한다"고 이미 명시하고 있고, 실제 소스
   (`workspace-reflection-canary.ts` 상단 주석 + `logger.log('@WorkspaceId() 소비 라우트
   ${requestContext}건 인식 · @WorkspaceParam() 소비 라우트 ${pathParam}건 인식 ...')`)가 두 값을
   합산해 0 이면 throw, 로그는 별도로 남기는 실제 동작과 문자 그대로 일치한다. README 쪽이 뒤늦게
   따라잡은 것이지 새 결정이 아니다.
2. **테스트 diff**는 `transferOwnership`의 트랜잭션 내 락 재검사 분기에 대해 `it.each`로 두 갈래
   (강등 `role !== 'owner'` / 멤버십 소멸 `!requesterMembership`)를 고정한다. 이는
   `data-flow/12-workspace.md` §Rationale "경로 파라미터 워크스페이스도 가드가 본다"의 문장 —
   "트랜잭션 안에서 락을 잡고 재검사하는 자리(`leaveWorkspace` · `transferOwnership`)는 그 재검사를
   남기고, 앞에 무락 인가 선행을 둔다" 및 재검사 조건의 OR 두 가지 — 를 **그대로 커버리지로
   실현**한 것이며, 실제 프로덕션 코드(`workspaces.service.ts` `transferOwnership`,
   `if (!requesterMembership || requesterMembership.role !== 'owner') this.throwOwnerTransferRequired();`)
   와도 정확히 대응한다. 새 설계 결정이 아니라 기존 결정의 기존 미고정 분기를 뒤늦게 잠근 것이다.
3. 두 변경 모두 프로덕션 동작(`workspaces.service.ts`, `workspace-reflection-canary.ts`,
   `workspace.decorator.ts`)은 **건드리지 않는다** — 순수 문서 정정 + 테스트 보강. 따라서
   "기각된 대안 재도입", "합의 원칙 위반", "무근거 번복", "invariant 우회" 네 관점 중 어느 것도
   해당하는 변경 형태가 아니다.
4. `data-flow/12-workspace.md` §Rationale "부트 캐너리" (b)가 명시적으로 기각한 "라우트별
   `SetMetadata`/`Reflector` opt-in 마커" 패턴을 이번 diff가 다시 쓰는지도 확인했다 — README·테스트
   어디에도 opt-in 마커 도입은 없다. 무관.

## 그 외 확인한 항목 (문제 없음 — 참고용, 범위 밖)

- `spec/data-flow/12-workspace.md` §Rationale "경로 파라미터 워크스페이스도 가드가 본다" /
  "가드 거부의 오류 코드" 사이의 "Owner 요구 라우트 수"(2곳/2곳/1곳) 산술 불일치는 **이전 라운드**
  (`review/consistency/2026/09/25/20_01_21`, WARNING)에서 이미 지적됐고, 같은 세션 plan
  (`plan/in-progress/canary-readme-recheck-test.md` W3 처분)이 "checker 오독 — 실측 결과 `remove`가
  새로 `@Roles('owner')`를 얻은 것이 맞고, `transferOwnership`은 이미 owner 였다"로 재확인해
  트래커 planner 항목으로 등재했다. 이 diff(README·test)는 그 수치나 그 절을 건드리지 않으므로
  본 라운드의 재발 항목이 아니다 — 이미 트래킹 중인 별도 spec-쓰기 후속으로 남겨 둔다.

## 발견사항

없음.

## 요약

이번 diff(`codebase/backend/README.md`, `workspaces.service.spec.ts`)는 새로운 설계 결정을 담지
않는다 — 둘 다 `spec/5-system/1-auth.md`·`spec/data-flow/12-workspace.md`의 2026-09-25 Rationale이
이미 명시한 결정(두 판별 합계로 부트 캐너리 판정·로그 분리, `transferOwnership` 락 재검사의 OR
두 갈래)을 문서·테스트 레벨에서 뒤늦게 정합화한 것이며, 실제 소스(`workspace-reflection-canary.ts`
로그 문구, `workspaces.service.ts`의 재검사 조건문)와 문자 그대로 일치함을 확인했다. 기각된
대안의 재도입, 합의 원칙 위반, 무근거 번복, invariant 우회 중 어느 것도 발견되지 않았다. 인접
Rationale 절의 기존 산술 불일치(owner 라우트 수)는 이전 라운드에서 이미 확인·처분되었고 이번
diff의 스코프 밖이다.

## 위험도

NONE
