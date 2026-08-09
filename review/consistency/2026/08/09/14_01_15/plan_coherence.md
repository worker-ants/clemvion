# Plan 정합성 검토 — spec/5-system/ (--impl-prep)

검토 대상: `spec/5-system/1-auth.md` · `2-api-convention.md` · `3-error-handling.md` (prompt 번들에
실제 포함된 3개 파일). 나머지 `spec/5-system/**` 15개 파일은 예산 초과로 프롬프트에서 생략됐으나,
`RolesGuard`/`WorkspaceId`/`X-Workspace-Id` 키워드 grep 상 관련 있는 유일한 다른 파일
(`15-chat-channel.md`)은 인용 수준(§3-error-handling.md 로의 canonical 참조)이라 본 검토 결론에
영향 없음. `plan/in-progress/**` 는 프롬프트에서 전량 생략됐으므로 저장소 원본을 직접 Read 했다.

## 검토 배경

이 세션의 실질 target 은 `plan/in-progress/auth-guard-reflection-hardening.md`
(worktree `auth-guard-reflection-hardening-9c31f2`, `spec_impact: none`, P2) — `RolesGuard`
reflection fail-open 경화(W1)·메모이제이션(W3)·비-UUID 워크스페이스 헤더 400(W4) 3건. 코드
레벨(`common/guards/roles.guard.ts`, `common/decorators/workspace.decorator.ts`,
`common/utils/workspace-context.util.ts`)을 직접 열어 plan 의 현황 서술(fail-open 메커니즘,
`ROUTE_ARGS_METADATA` reflection, UUID 미검증)이 실측과 **정확히 일치**함을 확인했다 — 이 plan
은 target 을 오도하지 않는다.

## 발견사항

- **[WARNING]** W4(비-UUID 워크스페이스 헤더 → 400)의 에러 코드 선택이 미확정인 채
  `spec_impact: none` 으로 선언돼 있다
  - target 위치: `spec/5-system/3-error-handling.md` §1.3 `WORKSPACE_ID_REQUIRED` 행(대상
    실측 라인 1373) — "헤더와 JWT `workspaceId` **둘 다 없음**" 으로 트리거 조건이 명시돼 있다
  - 관련 plan: `plan/in-progress/auth-guard-reflection-hardening.md` §3 (W4) — "기존
    `WORKSPACE_ID_REQUIRED` 와 같은 400 계열로 조기 거부"
  - 상세: "같은 ... 과 같은 400 계열로" 라는 문구가 (a) `WORKSPACE_ID_REQUIRED` 코드값 자체를
    재사용하는 것인지, (b) 그냥 400 상태만 같고 별도 코드를 신설하는 것인지, (c) 코드 없이 기본값
    `VALIDATION_ERROR`(§5.3 상태코드별 기본값 표, `http-exception.filter.ts:142-143` 로 실측
    확인)로 떨어뜨리는 것인지 불명확하다. (a) 를 택하면 "헤더와 토큰 둘 다 없음" 으로 좁게 문서화된
    기존 코드의 트리거 조건이 조용히 넓어져(헤더가 **있지만 형식이 틀림** 케이스 포함) 문서-구현
    불일치가 되고, (b) 를 택하면 신규 코드이므로 `3-error-handling.md` 갱신이 필요해 `spec_impact:
    none` 과 어긋난다 — `developer` 는 `spec/` read-only 라 이 경우 작업 중단 후 `project-planner`
    턴이 필요하다(CLAUDE.md 규약). (c) 만이 spec 변경 없이 `spec_impact: none` 을 유지한다
  - 제안: plan §3 체크박스를 착수 전에 (c) 로 명시(기본값 `VALIDATION_ERROR` 재사용, 코드 미지정)
    하거나, (a)/(b) 를 원한다면 `spec_impact` 를 `spec/5-system/3-error-handling.md` 로 갱신해
    planner 턴을 먼저 거칠 것

- **[INFO]** 관련 spec draft plan 2건이 이미 target 에 전량 반영됐는데도 `plan/in-progress/` 에
  `status: in-progress` 로 남아 있다
  - target 위치: `spec/data-flow/12-workspace.md` (Overview + "멤버십 검증은 가드 1곳에서 —
    `@Roles()` 와 무관" 절), `spec/2-navigation/9-user-profile.md:158`,
    `spec/2-navigation/11-error-empty-states.md:72`, `spec/conventions/swagger.md` §5-4 —
    직접 Read 로 7개 변경안 전부가 문구 그대로 반영돼 있음을 확인
  - 관련 plan: `plan/in-progress/spec-draft-workspace-header-membership-invariant.md`
    (worktree `auth-workspace-membership-guard-2b94db`, `status: in-progress`, "완료" 언급 없음),
    `plan/in-progress/spec-fix-swagger-forbidden-response.md` (같은 worktree, 본문에 "반영 완료
    (2026-08-08, planner 턴)" 명시하면서도 frontmatter 는 여전히 `status: in-progress`)
  - 상세: target 자체와의 모순은 없다(오히려 반영이 정확함을 확인했다). 다만 이 두 plan 이
    `plan/in-progress/` 에 남아 있으면, 향후 plan-coherence 검토가 이들이 나열한 "판정 필요"·
    "developer 턴 소관" 문구를 **아직 열린 결정**으로 오판할 위험이 있다(본 검토도 실제로 코드까지
    대조하고 나서야 이미 닫힌 결정임을 확인했다) — `.claude/docs/plan-lifecycle.md` 의 in-progress
    ↔ complete 이동 규칙 대상
  - 제안: 두 plan 의 소유 worktree(`auth-workspace-membership-guard-2b94db`) 쪽에서 잔여 체크리스트
    (`/consistency-check --spec` 등)를 확인해 `plan/complete/` 로 이동. 본 worktree
    (`auth-guard-reflection-hardening-9c31f2`) 권한 밖이라 이동은 수행하지 않음

- **[INFO]** `spec/5-system/1-auth.md` §3.3 이 "멤버십 검증은 `@Roles()` 유무와 무관하게 항상"
  불변식을 아직 명문화하지 않음 — 사촌 plan 이 스스로 "판정 필요" 로 열어 둔 채 남음
  - target 위치: `spec/5-system/1-auth.md` §3.3 API 인가 흐름 (대상 실측 라인 417-421) — header-first
    서술만 있고 멤버십 검증 시점(무조건 vs `@Roles()` 조건부)을 명시하지 않는다
  - 관련 plan: `plan/in-progress/spec-draft-workspace-header-membership-invariant.md`
    "side-effect 점검 대상" — "`spec/5-system/1-auth.md` §3.3 … 본 draft 범위에 포함할지 판정
    필요 (§3.3 은 이미 '3. 요청 리소스가 …' 를 별 단계로 두어 모순은 아님)"
  - 상세: 모순이 아니라는 draft 자신의 판단은 실측과 일치한다(§3.3 은 침묵일 뿐 반대 주장을 하지
    않음) — 그래서 CRITICAL/WARNING 아님. 다만 §3 표제가 "인가 (§3) — 워크스페이스 스코프 RBAC
    매트릭스" 로 이 문서를 인가 SoT 로 선언하는데, 정작 그 무조건 멤버십 검증 불변식은
    `data-flow/12-workspace.md` 에만 있어 `1-auth.md` 만 읽는 독자는 발견할 수 없다. 이 plan 이
    사실상 완료 처리(위 INFO 참고)되면서 이 "판정 필요" 미결정 항목만 남을 위험
  - 제안: 본 auth-guard-reflection-hardening 작업과는 무관하니 착수를 막을 필요는 없음. 위 plan
    이동/정리 시 이 항목을 명시적으로 close(1-auth.md §3.3 에 한 줄 cross-reference 추가 또는
    "불요" 로 명문화)할 것을 함께 처리하도록 인계

## 요약

target(`spec/5-system/1-auth.md`·`2-api-convention.md`·`3-error-handling.md`)은 plan 이 서술하는
현재 코드 동작(`RolesGuard` fail-open reflection 메커니즘·UUID 미검증)과 실측 코드가 정확히
일치하며, `auth-guard-reflection-hardening.md` 가 미해결로 남긴 결정(W1 캐너리 vs SetMetadata,
W3 메모이제이션 유예)과 충돌하는 선제 결정을 target 이 내리고 있지 않다. 유일한 실질 리스크는 W4
(비-UUID 헤더→400)의 에러 코드 선택이 `spec_impact: none` 유지 여부를 가를 만큼 미확정이라는
점이고, 나머지는 인접 worktree 가 이미 완료했지만 아직 `plan/complete/` 로 옮기지 못한 두 plan 의
lifecycle 정리 권고(정보성)다. 착수를 막을 CRITICAL 은 없다.

## 위험도

LOW
