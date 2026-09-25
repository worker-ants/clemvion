# Plan 정합성 검토 — workspace-path-guard impl-prep

## 발견사항

- **[WARNING]** `workspace-path-guard-impl.md` 의 `spec_impact` 가 같은 PR 의 spec 커밋(`e2e257707`)이 실제로 건드린 9개 spec 파일 중 3개만 담는다
  - target 위치: impl-prep 번들(`spec/1-auth.md`·`3-error-handling.md`·`12-workspace.md`, `plan/in-progress/workspace-path-guard-impl.md` frontmatter `spec_impact`)
  - 관련 plan: `plan/in-progress/workspace-path-guard-impl.md`(developer, 구현 plan) — 체크리스트 요구 8 "swagger `@ApiForbiddenResponse` 설명(재실행 · chain · 워크스페이스 라우트)"
  - 상세: `git show e2e257707 --stat` 로 확인한 실제 변경 spec 은 9개 — `data-flow/12-workspace.md`·`5-system/1-auth.md`·`5-system/3-error-handling.md`(위 3개, `spec_impact` 등재됨) 외에
    `spec/5-system/13-replay-rerun.md`(RR-PL-06 권한 거부를 가드층 `NOT_A_MEMBER`/`EDITOR_REQUIRED` vs 서비스층 `RERUN_PERMISSION_DENIED` 로 분리 — 회귀 잠금 표까지 갱신됨),
    `spec/conventions/swagger.md`(§체크리스트: `@WorkspaceParam(...)` 소비 엔드포인트도 `@ApiForbiddenResponse` + 코드 명시 요구로 갱신됨),
    `spec/conventions/error-codes.md`(초대 `forbidden` 행 제거·`admin_required` 註 갱신),
    `spec/5-system/2-api-convention.md`(`RolesGuard` 전용 코드가 기본값이 아니라는 문장 추가),
    `spec/2-navigation/6-config.md`·`spec/2-navigation/9-user-profile.md`(403 코드 `FORBIDDEN`→`ADMIN_REQUIRED`/`NOT_A_MEMBER` 갱신) — 는 **`spec_impact` 밖**이다.
    구현 plan 자체가 "재실행 · chain · 워크스페이스 라우트" 의 swagger 설명을 손댄다고 명시하므로(요구 8), `RolesGuard` 의 "적용 범위는 전역이다"(target §"가드 거부의 오류 코드")
    라는 성질상 이 구현은 `13-replay-rerun.md`·`swagger.md` 가 이미 확정해 둔 문면(특히 rerun 라우트의 갱신된 회귀 잠금 표)을 코드로 참으로 만드는 작업까지 포함하게 되는데,
    `spec_impact`·이번 impl-prep 번들 어느 쪽에도 그 두 파일이 없어 `--impl-done` 단계에서 그 파일들과의 정합을 자동으로 재검증할 표면이 좁다.
  - 제안: `workspace-path-guard-impl.md` frontmatter `spec_impact` 에 최소 `spec/5-system/13-replay-rerun.md`·`spec/conventions/swagger.md` 를 추가하거나(구현이 그 문면을 코드로 실현하는 이상 실재 영향 목록에 들어가야 함),
    좁게 유지할 경우 `--impl-done` 을 그 두 파일이 포함되는 scope 로 별도 실행하도록 plan 체크리스트에 명시한다. (참고 실측: 기존 e2e 스위트가 `code: 'FORBIDDEN'` 을 직접 단언하는 곳은 없어 — 전수 grep — 전역 코드 부여 자체가 기존 테스트를 깨뜨릴 위험은 낮다. 이 항목은 "회귀 위험" 이 아니라 "검증 표면 누락" 이다.)

- **[INFO]** `nestjs-v12-coordinated-upgrade.md` §C 의 고정 기준값(부트 캐너리 소비 라우트 수 "142건")이 이 구현으로 곧 stale 해진다 — 갱신 책임은 이미 이 plan 요구 1에 있다
  - target 위치: target §"경로 파라미터 워크스페이스도 가드가 본다" 및 `workspace-path-guard-impl.md` 요구 1 "부트 캐너리가 경로 소비자도 센다 ... `nestjs-v12-coordinated-upgrade.md` §C 캐너리 기준값(142) 재실측 · 갱신"
  - 관련 plan: `plan/in-progress/nestjs-v12-coordinated-upgrade.md` §C (현재 "상류 미대응으로 보류" 상태, `worktree: (unstarted)`, 업그레이드 자체는 미착수)
  - 상세: 그 plan 은 "부트 캐너리의 «소비 라우트 수»를 업그레이드 전/후로 **같은 값인지** 비교" 하는 것을 재개 조건으로 못박아 두었고, 기준값 142 를 표로 고정해 뒀다.
    `@WorkspaceParam` 소비를 캐너리 집합에 더하면(이 plan 요구 1) 그 카운트가 바뀌므로 142 는 더는 유효한 사전 기준선이 아니다. 이 plan 이 이미 "재실측 · 갱신" 을 자기 체크리스트("구현 1~5·8")에
    담아 뒀으므로 결정 충돌은 아니지만, `nestjs-v12-coordinated-upgrade.md` 는 업그레이드가 보류 중이라 그 파일 자체에는 아직 "이 값이 곧 바뀐다" 는 forward-pointer 가 없다.
  - 제안: `workspace-path-guard-impl.md` 착지 시 `nestjs-v12-coordinated-upgrade.md` §C 표의 142 를 실측치로 갱신하는 것을 실제로 수행 — 잊으면 그 plan 재개 시점에 잘못된 기준선으로 "같은 값인지" 를 오판정하게 된다.

## 확인됨 — 충돌 없음 (참고용)

- `plan/in-progress/spec-draft-nullable-notation-followups.md` 의 트래커 항목 "경로 파라미터로 워크스페이스를 받는 라우트 13개가 가드 층 보호를 전혀 못 받는다" 는
  이 target 의 설계 결정(§"경로 파라미터 워크스페이스도 가드가 본다")으로 정식으로 닫혔다 — 실측(15곳)·기각안 2건이 사용자에게 제시되고 "가드 확장 + 코드 부여" 를
  명시적으로 선택한 기록이 `plan/complete/spec-draft-workspace-path-guard.md` 에 있다. 미해결 결정을 우회한 것이 아니라 정식으로 해소한 사례다.
  같은 followup 문서의 "`req.user.workspaceId` 직접 읽는 라우트는 정적 가드가 없다"(2026-09-25 신규, 낮음·착수 조건부 defer)도 target §Rationale
  "비대칭은 남는다"(4곳, 워크스페이스 자원 미접근)와 정확히 일치 — 고아 항목이 아니다.
- `plan/in-progress/auth-guard-reflection-hardening.md` 는 사실상 전 항목 해소(잔여 1건은 "메모이제이션은 실측 트리거 생기면" 으로 무관한 defer) — 충돌 없음.
- `plan/in-progress/spec-sync-auth-gaps.md` (LDAP/SAML·감사 로그 커버리지 갭)는 이 target 변경과 겹치는 표면이 없다.

## 요약

target(auth/error-handling/workspace 3-file 번들)은 사용자 의사결정을 거쳐 `plan/complete/spec-draft-workspace-path-guard.md` 로 정식 종결된 설계를 반영하며, 그 결정이 우회하거나 무시한 진행 중 plan 의 미해결 결정은 발견되지 않았다. 다만 같은 커밋이 실제로 갱신한 9개 spec 파일 중 6개(`13-replay-rerun.md`·`swagger.md`·`error-codes.md`·`2-api-convention.md`·`6-config.md`·`9-user-profile.md`)가 구현 plan의 `spec_impact`·이번 impl-prep 번들에서 빠져 있어, `RolesGuard` 의 전역 성격(모든 `@Roles()` 라우트에 코드 부여)이 만드는 검증 표면 중 일부(특히 이미 문면이 갱신된 `13-replay-rerun.md` 회귀 잠금 표)가 `--impl-done` 자동 재검증 밖에 남을 위험이 있다. 별도로 `nestjs-v12-coordinated-upgrade.md` 의 고정 캐너리 기준값(142)이 이 구현으로 stale 해지는데 갱신 책임은 이미 이 plan에 있어 결정 충돌은 아니고 이행 여부만 확인하면 된다.

## 위험도

LOW
