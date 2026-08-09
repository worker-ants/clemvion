# Plan 정합성 검토 — `plan/in-progress/spec-draft-auth-invariants-sync.md`

## 검토 범위

- Target: `plan/in-progress/spec-draft-auth-invariants-sync.md` (spec draft, 항목 1~6)
- 직접 참조 원 plan 2건 전문 확인: `auth-guard-reflection-hardening.md`(§후속 4건),
  `backend-lint-gate-broken-on-main.md`(§후속 1건) — 프롬프트 번들 포함분.
- 번들 예산 초과로 생략된 26개 plan 중 target 의 `spec_impact` 5개 파일
  (`3-error-handling.md`/`15-chat-channel.md`/`1-auth.md`/`data-flow/12-workspace.md`/
  `conventions/secret-store.md`)과 이름·내용상 겹칠 수 있는 문서를 `Read`/`grep` 로 직접 열어 확인:
  `spec-sync-auth-gaps.md`(생략분, `1-auth.md` 대상), `spec-data-flow-structural-followups.md`
  (생략분, `data-flow/12-workspace.md` 대상). 그 외 `spec-sync-websocket-protocol-gaps.md` 는
  `3-error-handling.md §1.5`(WS 전용)만 건드려 target 의 §1.3 과 무관함을 확인.
- 대상 spec 파일 4곳(`3-error-handling.md §1.3`, `15-chat-channel.md §5.4`,
  `1-auth.md` frontmatter/§Production fail-closed 가드, `data-flow/12-workspace.md` 헤더 구조)의
  **현재 실제 내용**을 열어 target 의 diff 컨텍스트(`-` 줄)가 stale 하지 않은지 대조 — 4곳 모두
  일치, diff 적용 가능.

## 발견사항

- **[WARNING]** plan 문서 자체의 오기록 정정이 "developer/codebase 권한 밖"으로 오분류돼 미배정
  - target 위치: `plan/in-progress/spec-draft-auth-invariants-sync.md:65-66`
    (`## ⚠️ 착수 중 발견` 절) 및 `:352-356` (§후속 "developer 범위")
  - 관련 plan: `plan/in-progress/auth-guard-reflection-hardening.md:163-165`
    (4차 `/ai-review` 체크리스트 항목, 이미 `[x]`로 완료 체크됨: "`system-status.e2e-spec.ts:147`
    이 실제로 nil UUID 를 프로브로 쓴다 → `isValidUuid` 를 썼다면 그 e2e 가 깨졌을 것이라는
    근거가 **실측으로 선다**.") 및 `:193-198` (§후속 미체크 항목의 근거 문장에서 같은 캐너리
    지목을 반복)
  - 상세: target 은 "⚠️ 착수 중 발견" 절에서 이 캐너리 지목이 **틀렸음을 실측으로 반증**한다
    (`system-status` 컨트롤러엔 `@Roles()`/`@WorkspaceId()` 가 없어 `RolesGuard` 가
    `resolveRequestWorkspaceContext` 호출 전에 `return true` 하므로, 그 e2e 는 술어에 닿지 않는다).
    그런데 이 반증을 "코드 주석 두 곳(`common/utils/uuid.ts` docstring · `plan/.../auth-guard-reflection-hardening.md`)에도 같은 부정확이 있으나 `codebase/**` 는 planner 권한 밖이다"
    라고 한 문장으로 묶어 **plan 파일 자체를 코드 취급**하고 있다. `auth-guard-reflection-hardening.md`
    는 `codebase/**` 가 아니라 `plan/**` 이며, `project-planner`(현재 역할)는 `spec/**, plan/**`
    쓰기 권한을 갖는다(CLAUDE.md Skill 체계 표) — 즉 이 plan 텍스트 정정은 developer 로 미룰
    필요 없이 **지금 이 PR 에서 직접 고칠 수 있다.** 결과적으로 §후속 "developer 범위"에는
    `uuid.ts` docstring 정정만 등재되고, `auth-guard-reflection-hardening.md` 자체가 안고 있는
    **틀린 "실측으로 선다" 단정문**(:165)과 §후속 근거 문장(:197 의 "nil-UUID e2e 프로브가
    깨지고 403 이 400 으로 뒤바뀐다")은 정정 계획이 없다. 그 plan 은 아직 `in-progress/` 에
    남아 있어(§후속 미체크 4건) 독자가 계속 그 문장을 신뢰할 수 있다 — 이 프로젝트가 반복
    학습한 "유예 근거는 실측해야 한다"/"plan 서술은 철회로 거짓이 될 수 있다" 클래스와 동일한
    위험이다.
  - 제안: target 의 같은 PR 에서 `auth-guard-reflection-hardening.md:163-165`·`:193-198` 에
    정정 각주(예: "**정정(spec-draft-auth-invariants-sync 착수 중 실측, 2026-08-09)**: 이
    e2e 는 이 술어에 닿지 않는다 — 진짜 캐너리는 `uuid.spec.ts`/`workspace-context.util.spec.ts`.
    상세: `spec/data-flow/12-workspace.md §Rationale` 캐너리 지목 정정 절.")를 추가하거나,
    최소한 target 의 §후속 문구에서 "codebase/** 는 planner 권한 밖" 이라는 사유를
    `auth-guard-reflection-hardening.md` 정정에는 적용하지 말고 이를 target(또는 별도
    planner-scope 체크리스트 항목)으로 옮길 것.

- **[INFO]** 같은 endpoint 표면을 다루는 미착수 plan 과의 무충돌 확인 (참고용 교차 기록)
  - target 위치: `plan/in-progress/spec-draft-auth-invariants-sync.md` 항목 2
    (`15-chat-channel.md §5.4`, `rotate-bot-token` 응답 표에 `VALIDATION_ERROR` 행 추가)
  - 관련 plan: `plan/in-progress/spec-sync-auth-gaps.md:56-68` (`owner: planner`,
    `worktree: (unstarted)`) — 같은 `rotate-bot-token`/`rotateNotificationSecret`/
    `revokePerTriggerToken` 엔드포인트에 대해 "트리거 시크릿/토큰 회전 3종 감사 —
    planner 선행 필요"(`1-auth.md §4.1` + `conventions/audit-actions.md` 에 `trigger.rotate*`
    액션 신설이 선행돼야 함)를 미해결 항목으로 남겨 두고 있다.
  - 상세: 두 plan 이 같은 라우트를 서로 다른 축(에러 코드 카탈로그 vs 감사 로깅)에서 건드리지만
    실제 텍스트 충돌은 없다 — target 은 `15-chat-channel.md §5.4` 응답 표와 `1-auth.md`
    frontmatter/`## Rationale` 만 건드리고, `spec-sync-auth-gaps.md` 의 미해결 항목은
    `1-auth.md §4.1`(감사 액션 카탈로그)·`conventions/audit-actions.md` 를 대상으로 해
    구역이 겹치지 않는다. 실측으로 겹침 없음을 확인했으므로 차단 사유는 아니다.
  - 제안: 조치 불요(정보 기록). 추후 `spec-sync-auth-gaps.md` 의 해당 항목이 착수되면
    `rotate-bot-token` 응답 표(§5.4)에 감사 관련 각주가 추가로 필요한지만 그때 재확인하면 된다.

## 요약

target 의 spec 반영 항목 6건은 두 원 plan(`auth-guard-reflection-hardening.md` §후속 4건,
`backend-lint-gate-broken-on-main.md` §후속 1건)의 미해결 항목과 정확히 1:1 대응하고, 새 결정을
내리지 않으며(항목 4 의 캐너리 지목 정정도 "결정"이 아니라 "사실 정정"), 대상 spec 파일 4곳의
diff 컨텍스트도 현재 파일 내용과 정확히 일치해 stale 하지 않다. `spec-data-flow-structural-followups.md`
(완료, `#1042`)로 이미 재배치된 `12-workspace.md` 섹션 번호와도 충돌하지 않고, 미착수
`spec-sync-auth-gaps.md` 의 같은-엔드포인트 감사 로깅 미해결 항목과도 실제 텍스트 겹침이 없다.
유일한 실질 갭은, target 이 스스로 실측으로 반증한 원 plan(`auth-guard-reflection-hardening.md`)의
"이미 체크된 잘못된 단정문"을 **plan 파일임에도 codebase 취급해 정정 없이 developer 백로그로만
넘긴 것**이다 — planner 가 직접 쓸 수 있는 `plan/**` 범위를 스스로 좁게 오판한 절차적 흠결이며,
그 plan 이 아직 `in-progress/` 에 남아 있어 독자를 오도할 위험이 실재한다.

## 위험도
LOW
