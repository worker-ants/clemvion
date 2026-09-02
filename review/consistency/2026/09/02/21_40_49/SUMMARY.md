# Consistency Check 통합 보고서

**BLOCK: YES** — Critical 1건 발견 (spec 이 아직 구현되지 않은 `changePassword` 에러 코드 분리를 이미 완료된 사실로 서술)

## 전체 위험도
**CRITICAL** — 미커밋 spec diff(`1-auth.md`·`3-error-handling.md`·`error-codes.md`·`9-user-profile.md`)가 `users.service.ts` 에 아직 반영되지 않은 `changePassword` 에러 코드 분리를 현재형("발행한다"/"갈랐다"/"은퇴했다")으로 단정하고, `status: implemented` 문서(`error-codes.md`·`3-error-handling.md`)는 이 갭을 등재할 `pending_plans` 필드조차 없어 spec-impl-evidence 컨벤션이 막으려는 "약속 vs 구현 부재" 갭을 무방비로 남긴다.

## Critical 위배 (BLOCK 사유)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | convention_compliance | spec 이 아직 구현되지 않은 `changePassword` 에러 코드 분리(`PASSWORD_REQUIRED`/`PASSWORD_INVALID`)를 이미 완료된 사실로 서술. `3-error-handling.md §1.2` 활성 카탈로그에서 `INVALID_PASSWORD` 행을 삭제했으나 실제 코드는 그 코드만 발행 중. `status: implemented`(pending_plans 없음) 문서 2건이 이 갭을 등재할 그릇이 없음 | `spec/5-system/1-auth.md` §2.3 note(`:364`)·§5 note(`:546`) / `spec/5-system/3-error-handling.md` §1.2 카탈로그 표·§1.2.1 표·근접명명 note / `spec/conventions/error-codes.md` §5 신규 행 | 실측: `codebase/backend/src/modules/users/users.service.ts:274-295` — 지금도 두 조건(passwordHash 부재·불일치) 모두 동일하게 `code: 'INVALID_PASSWORD'` 발행(JSDoc도 구서술 유지). `spec/conventions/spec-impl-evidence.md §3` lifecycle 계약(`implemented`=전량 구현 완료, 아니면 `pending_plans` 의무) | (a) 같은 커밋 안에서 developer 턴을 이어 `users.service.changePassword` 를 실제로 `PASSWORD_REQUIRED`/`PASSWORD_INVALID` 로 분리한 뒤 커밋(§1193 선례 `f65ca193c` 와 동일 패턴), 또는 (b) 4개 문서 서술을 "결정 확정·구현 예정"으로 낮추고(현재형/완료형 삭제) `error-codes.md`·`3-error-handling.md` 를 이 항목에 한해 `status: partial` + `pending_plans: [auth-change-password-oauth-only-code-split.md]` 로 전환하거나 최소 `1-auth.md`/`9-user-profile.md` 의 `pending_plans:` 에 해당 plan 을 추가 |

## planner 인계 (권한 밖 Critical)

> 해당 없음 — 위 Critical 은 `spec/**`·`plan/**` 쓰기 권한을 가진 호출자(이번 세션에서 이미 해당
> 4개 spec 파일을 직접 편집 중)가 자기 권한 안에서 직접 처리 가능한 항목이다(서술을 미완료형으로
> 낮추거나 `pending_plans` 를 등재하는 것은 spec/plan 편집이지 `codebase/` 변경이 아님). 코드
> 자체를 분리하는 옵션(a)을 택할 경우에만 developer 턴이 필요하지만, 그 경우도 "권한 밖이라
> 막힌 것"이 아니라 두 옵션(a/b) 중 택일의 문제이므로 planner 인계 표 대상이 아니다.

| # | 권한 밖인 이유 | 인계 대상 | planner 가 고칠 것 (파일·섹션) | 추적 위치 |
|---|---------------|----------|------------------------------|----------|
| (없음) | | | | |

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | convention_compliance | `9-user-profile.md` 가 미구현 FE 안내 분기("OAuth-only 계정은 `PASSWORD_REQUIRED`(401)로 막히며 화면은 비밀번호 추가 경로를 안내")를 §2.2 단일 SoT 로 선언하면서 책임 plan 을 `pending_plans` 에 등재하지 않음 | `spec/2-navigation/9-user-profile.md` §2.2(`:147`) frontmatter `pending_plans:` | `spec/conventions/spec-impl-evidence.md §2.1`(pending_plans 정의) — FE 코드(`change-password/page.tsx`) grep 결과 해당 분기 미구현 확인 | frontmatter `pending_plans:` 에 `plan/in-progress/auth-change-password-oauth-only-code-split.md` 추가 |
| 2 | plan_coherence | `auth-change-password-oauth-only-code-split.md` `## 할 일` 의 spec 편집 4개 체크박스가 전부 `[ ]`(미체크)로 남아 있으나, 실제로는 target 4개 spec 파일에 그 문구가 이미 전량 반영됨(직접 대조 확인). `spec-draft-change-password-code-alignment.md` 도 완료 상태를 명시하지 않음 | `plan/in-progress/auth-change-password-oauth-only-code-split.md` `## 할 일`, `plan/in-progress/spec-draft-change-password-code-alignment.md` | 실제 반영 확인된 target: `spec/5-system/1-auth.md`·`3-error-handling.md`·`spec/conventions/error-codes.md`·`spec/2-navigation/9-user-profile.md`(4개 전부) | 4개 스펙 체크박스를 `[x]`로 전환(반영 위치·문구를 근거로 남기고), 잔여 항목은 `developer 턴` 하나뿐임을 명시. draft 문서에는 "spec 변경안(0~12) 전량 적용 완료, codebase 인계 목록만 잔존" 상태를 절 상단에 추가(단, `plan/complete/` 이동은 developer 턴 완료 후까지 보류 — 인계 목록 추적점 보존) |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | cross_spec, convention_compliance | `error-codes.md §5` "PR" 컬럼 포맷이 선례(`PR4b`/`#1193`/`#566` 등 짧은 PR/이슈 식별자)에서 이탈 — 신규 `INVALID_PASSWORD` 행은 아직 없는 PR 대신 `plan/in-progress/` 상대링크를 씀. plan 이 `plan/complete/` 로 이동하면 dangling 위험(`findBrokenPlanLinks` 가 `plan/complete/**` 제외라 못 잡을 수 있음) | `spec/conventions/error-codes.md` §5 표, `INVALID_PASSWORD` 행 4번째 컬럼 | 이미 draft(item #10)가 "PR 생성 직후 번호로 갱신" 예고. 지금 조치 불요 — 실제 PR 머지 시 셀 교체, 또는 plan 이동 커밋 체크리스트에 링크 갱신 명시 |
| 2 | cross_spec, convention_compliance | `9-user-profile.md` 표 셀 문장 경계 누락 — "…자세한 폼은 §2.2 참조 OAuth-only 계정의…" 마침표 없이 붙어 읽힘 | `spec/2-navigation/9-user-profile.md:94` | "§2.2 참조." 뒤 마침표/줄바꿈 삽입 |
| 3 | naming_collision | `PASSWORD_NOT_SET` 신규 채택 회피가 이미 올바르게 처리됨 — 채택됐다면 `login_history.failure_reason` 감사값(`auth.service.ts:330`)과 wire 코드 동명 충돌을 재생산했을 것. 결정 D(형제 코드 재사용)로 이미 회피 | `spec/conventions/error-codes.md:175`, `plan/in-progress/spec-draft-change-password-code-alignment.md:2429-2437` | 조치 불필요 — 향후 `PASSWORD_*` 근접 명명 확장 시 이 사례를 선례로 재확인 |
| 4 | naming_collision | `INVALID_PASSWORD` wire 은퇴 후 audit(`login_history.failure_reason`) 레이어 동명 잔존 — 의도된 것으로 3곳(spec)에서 일관되게 주석 처리됨. `users.service.ts` 는 아직 미전환(spec 이 codebase 보다 앞서가는 정상 --impl-prep 상태) | `spec/1-data-model.md:710`, `spec/data-flow/2-auth.md:76`, `codebase/backend/src/modules/auth/auth.service.ts:347` | 조치 불필요. developer 턴에서 `users.service.ts` 전환 시 `auth.service.ts`(로그인 흐름의 `login_history` 기록)는 건드리지 않아야 한다는 경계를 재확인 |
| 5 | naming_collision | 헤딩 앵커 슬러그 변경(`3-error-handling.md §1.2.1`) 후 `1-auth.md` 내 2개 참조 링크가 diff 안에서 신규 슬러그로 동시 갱신됨(구 슬러그 활성 `spec/` 잔존 0건, `plan/complete/` 잔존은 라이프사이클상 문제 아님) | `spec/5-system/3-error-handling.md` §1.2.1 앵커, `spec/5-system/1-auth.md` §2.3/§5 note | 조치 불필요 — 이미 동기화됨 |
| 6 | rationale_continuity | 컨텍스트 예산 초과로 생략된 `spec/5-system/` 15개 파일(과반 분량)에 대해 본문-Rationale **전수** 대조는 미수행 — 5개 파일 Rationale 헤더만 spot-check(모두 정상 사례로 확인) | `spec/5-system/4-execution-engine.md`·`6-websocket-protocol.md`·`8-embedding-pipeline.md`·`9-rag-search.md`·`10-graph-rag.md`·`12-webhook.md`·`13-replay-rerun.md`·`14-external-interaction-api.md`·`15-chat-channel.md`·`17-agent-memory.md` 등 | 다음 라운드에서 이 15개 파일을 단독 scope(`--impl-prep <file>`)로 나눠 예산 절단 없이 전수 대조 권장 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | LOW | 4개 target 파일이 데이터모델·data-flow·API 컨벤션·RBAC 어디와도 직접 모순 없음. INFO 2건(문서 형식) |
| rationale_continuity | NONE | 기각된 대안 재도입·무근거 번복 없음. 최근 drift 정정마다 실측·근거 동반. 커버리지 공백만 INFO |
| convention_compliance | HIGH | CRITICAL 1건(미구현을 완료로 서술) + WARNING 1건(pending_plans 미등재) |
| plan_coherence | LOW | 결정(D) 내용 자체는 정확 반영·다른 plan 과 충돌 없음. WARNING 1건(체크리스트가 완료 사실을 미완료로 표시) |
| naming_collision | NONE | 신규 발행 코드는 기존 형제 코드 재사용뿐, 신규 식별자 충돌 없음. INFO 3건 모두 "이미 올바르게 처리됨" 확인성 |

## 권장 조치사항

1. **(BLOCK 해소 우선)** `changePassword` 에러 코드 분리 서술 문제 해소 — 둘 중 택일:
   (a) 이 커밋에 이어 developer 턴으로 `codebase/backend/src/modules/users/users.service.ts` 를 실제로 `PASSWORD_REQUIRED`/`PASSWORD_INVALID` 분리해 반영한 뒤 커밋, 또는
   (b) `spec/5-system/1-auth.md`·`3-error-handling.md`·`spec/conventions/error-codes.md`·`spec/2-navigation/9-user-profile.md` 4개 문서의 현재형/완료형 서술을 결정 확정·구현 예정 톤으로 낮추고, `error-codes.md`·`3-error-handling.md` 를 이 항목에 한해 `status: partial` + `pending_plans: [auth-change-password-oauth-only-code-split.md]` 로 전환.
2. `spec/2-navigation/9-user-profile.md` frontmatter `pending_plans:` 에 `plan/in-progress/auth-change-password-oauth-only-code-split.md` 추가.
3. `plan/in-progress/auth-change-password-oauth-only-code-split.md` `## 할 일`의 spec 편집 4개 체크박스를 `[x]`로 전환하고 잔여는 `developer 턴` 하나뿐임을 명시. `spec-draft-change-password-code-alignment.md` 상단에 "spec 변경안 전량 적용 완료, codebase 인계 목록만 잔존" 라벨 추가(단, `plan/complete/` 이동은 developer 턴 완료 후로 보류).
4. `spec/conventions/error-codes.md §5` "PR" 컬럼 — 실제 PR 머지 시 번호로 교체(지금 조치 불요, 후속 커밋 체크리스트에 명시).
5. `spec/2-navigation/9-user-profile.md:94` "§2.2 참조." 뒤 마침표 삽입(사소, 병행 처리 가능).
6. 다음 라운드에서 `spec/5-system/` 생략된 15개 파일을 단독 scope 로 나눠 rationale_continuity 전수 대조 수행 권장.
