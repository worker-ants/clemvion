# Plan 정합성 검토 — swagger.md §5-4 재실행 (403 설명 ↔ 가드 거부 코드)

## 검토 대상

- target: `spec/conventions/swagger.md`(+ 번들된 `spec/data-flow/12-workspace.md` · `spec/5-system/1-auth.md`) 반영 후 상태
- 지배 plan: `plan/in-progress/forbidden-desc-codes.md`(구현, developer) · `plan/in-progress/spec-draft-swagger-forbidden-codes.md`(spec draft, project-planner)
- 모드: `--impl-prep` **재실행** — 직전 라운드(`review/consistency/2026/09/26/11_12_24`)는 BLOCK: YES (Critical 1: §5-4 문구가 `spec/data-flow/12-workspace.md` §Rationale "가드 거부의 오류 코드" 채택안과 불일치)였고, 그 뒤 planner 커밋 `f262a638e`(draft 반영) · `eb40cc802`(가드 방향을 "빠진 코드"로 좁힘)로 target 이 갱신됐다.

## 직전 라운드 발견사항의 처리 확인

실제 저장소 상태를 대조해 전부 해소를 확인했다:

- **Critical 1 (§5-4 vs data-flow 불일치)** — 해소 확인. `spec/conventions/swagger.md` §5-4 403 항목(line 521-534)이 이제 "가드가 낼 수 있는 거부 코드를 전부 싣는다 — 비멤버는 요구 역할과 무관하게 `NOT_A_MEMBER`" 로 정정돼 `spec/data-flow/12-workspace.md` §"가드 거부의 오류 코드 (2026-09-25)" 채택안 (나)와 일치한다. `codebase/backend/src/common/guards/roles.guard.ts` `assertMember`(`if (!role) throw ...NOT_A_MEMBER`가 `requiredRoles` 유무와 무관하게 먼저 실행)와 `codebase/backend/src/common/constants/workspace-roles.ts`(`ROLE_REQUIRED.viewer === NOT_A_MEMBER`)도 이 서술과 정확히 일치한다.
- **WARNING (integrations 4곳 `@Roles('editor')` 결정 대기 vs 문구 고정)** — 해소 확인. `forbidden-desc-codes.md` "검토 경고 처리" 표에서 "순서를 바꾸지 않는다 · 지금 역할에 맞는 설명이 옳다"로 처분하고, `plan/in-progress/integration-personal-owner-followup.md` 항목 3에 "(2026-09-26 보탬)" 각주로 "가드를 내리면 이 네 라우트의 설명도 손으로 바꿔야 한다 — 가드는 빠진 코드만 잡고 남은 코드는 못 잡는다"는 상호 포인터를 실제로 추가했다(두 plan 이 서로를 가리킨다). `integrations.controller.ts` 실측(4곳 `@Roles('editor')` + `FORBIDDEN_EDITOR_OR_ORG_ADMIN`)도 전제와 일치.
- **INFO (plan 내부 "요구" vs "체크리스트" 순서 불일치)** — 해소 확인. 현재 `forbidden-desc-codes.md` `## 요구`는 "1. spec draft → `--spec` → 반영 → `--impl-prep`"을 첫 항목으로 재배열해 `## 체크리스트` 순서와 일치한다.
- **INFO (트래커 63/54/4/2/20여 vs 재실측 54/53/4/14 숫자 drift)** — 해소 확인. "검토 경고 처리" 표 INFO5 에 "트래커는 부분 문자열로 세어 이미 코드를 싣던 자리를 포함했다"는 산출 방식 차이가 기록됐다.

## 발견사항

- **[INFO] `integration-personal-owner-followup.md` 의 신규 포인터가 아직 존재하지 않는 `plan/complete/` 경로를 가리킨다**
  - target 위치: 해당 없음(target 자체가 아니라 target 의 후속 조치를 반영한 인접 plan)
  - 관련 plan: `plan/in-progress/integration-personal-owner-followup.md` L44 — "(서비스가 같은 이름의 코드를 내는 자리와 구별할 수 없어서다 — `plan/complete/forbidden-desc-codes.md`)."
  - 상세: 이 각주는 이번 라운드에서 새로 추가된 상호 포인터(WARNING 처분의 일부)인데, 링크 대상 `plan/complete/forbidden-desc-codes.md` 는 실측 결과 저장소에 **존재하지 않는다**(`ls`: No such file) — 원본은 아직 `plan/in-progress/forbidden-desc-codes.md` 로, 이번 PR 은 `--impl-prep` 단계이고 구현·`--impl-done`·이동은 전부 남은 단계다. 지금 이 링크를 따라가면 404다.
  - 제안: 당장은 `plan/in-progress/forbidden-desc-codes.md` 로 고치거나(현재 실제 위치), 또는 "머지·`complete/` 이동 후 유효해질 경로"임을 한 줄 명시. `forbidden-desc-codes.md` 가 `complete/` 로 이동하는 시점(그 PR 의 마지막 단계)에 이 링크를 함께 갱신할 것을 그 plan 의 "체크리스트"에 한 줄 추가해 두면 이동 커밋에서 누락되지 않는다.

새로 발견된 미해결 결정 우회(CRITICAL) 또는 반영되지 않은 후속 항목 누락(WARNING)은 없다. 이번 target 갱신(§5-4 문구 정정)이 가정하는 선행 결정(data-flow §Rationale "가드 거부의 오류 코드" · "비멤버는 요구 역할과 무관하게 `NOT_A_MEMBER`")은 이미 확정·구현된 상태이고, target 이 그 결정을 우회하거나 재정의하지 않는다 — 오히려 그 결정을 문서-구현 갭 없이 spec 본문에 반영하는 동기화다.

## 요약

직전 `--impl-prep` 라운드(`11_12_24`)가 지적한 Critical 1건·WARNING 1건·INFO 2건은 모두 실제 파일 상태 대조로 해소가 확인됐다 — §5-4 문구는 data-flow 결정과 정합하고, integrations 4곳의 미해결 role 결정(`integration-personal-owner-followup.md`)은 순서를 바꾸지 않되 상호 포인터로 안전하게 처리됐으며, plan 내부 절 순서·트래커 숫자 drift도 정리됐다. 이번 재실행에서 새로 발견된 것은 그 해소 과정에서 추가된 각주 하나가 아직 존재하지 않는 `plan/complete/` 경로를 가리키는 사소한 forward-reference 뿐이며, 판단·구현 방향에는 영향이 없다. Plan 정합성 관점에서 target 은 구현 착수를 막을 만한 미해결 결정 충돌이나 선행 plan 미해소가 없다.

## 위험도

LOW
