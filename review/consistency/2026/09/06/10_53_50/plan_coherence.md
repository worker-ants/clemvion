# Plan 정합성 검토 — spec/5-system (impl-done)

## 전제 확인

- `spec/5-system/**` 를 포함해 이번 브랜치는 **spec/ 전체를 한 글자도 바꾸지 않았다**
  (`git diff --stat origin/main...HEAD -- spec/` 결과 0). 구현 diff 는 11개 파일 / 955줄
  (`+`) 로, `User` 엔티티 민감 컬럼 노출 방어 가드 2종(`user-entity-exposure-guard.ts`,
  `user-secret-absence.ts`) 신설 + `workflow-versions.service.ts findOne` 유출 수정 +
  `WorkspaceMemberDto.joinedAt` 선언 보강이 핵심이다.
- 이 구현은 `plan/in-progress/spec-draft-nullable-notation-followups.md` 의 "후속" 섹션에
  **"완료 (2026-09-06) — 전수 열거 후 셋째 길을 택했다"** 항목으로 정확히 서술돼 있다
  (사용자 결정 2026-09-06, `select:false`/전역 `ClassSerializerInterceptor` 대신 구조 축 +
  이름 축 검출 가드 채택). 이 결정 자체는 잘 근거가 서 있고 다른 plan 과 충돌하지 않는다
  (`select:false` 회피 근거가 `spec-draft-notification-secret-storage.md` 의 동일 결론과
  정합).

## 발견사항

- **[WARNING]** 신규 검증자 2종이 §5.4 「검증 층」과 `code:` frontmatter 어디에도 등재되지 않음
  - target 위치: `spec/5-system/2-api-convention.md` frontmatter `code:` (12개 glob) ·
    본문 `#### 검증 층 — 이 규칙을 무엇이 강제하는가` (§5.4 하위, "**두 검증자**" 로 명시)
  - 관련 plan: `plan/in-progress/spec-draft-nullable-notation-followups.md` 「후속」
    — "신규 검출 2축을 §5.4 「검증 층」과 `code:` 에 등재" (`[ ]` 미완료, owner: planner,
    2026-09-06 등재, 출처 `review/consistency/2026/09/06/10_13_23` W1 · 5개 checker 중 4개
    독립 보고)
  - 상세: 실측 확인 — `grep -rn "user-entity-exposure\|user-secret-absence" spec/` 0건.
    `2-api-convention.md` 의 `code:` 는 `repo-guards/__tests__/swagger-dto-contract*.ts` ·
    `shared/testing/response-contract*.ts` 만 등재하는데, 이번에 **같은 디렉터리**에 추가된
    `repo-guards/__tests__/user-entity-exposure-guard.ts` / `shared/testing/user-secret-absence.ts`
    는 접두사가 달라 그 glob 에 걸리지 않는다. plan 이 스스로 정본 게이트(`review_guard.
    _spec_linked_changes()`)에 물어 "신규 4파일 중 0건이 spec-linked" 임을 확인해 둔 상태다.
    본문의 "두 검증자" 표(선언↔선언 / 값↔선언)도 이제 세 번째 검증자(구조 축·이름 축)가
    생겼다는 사실을 반영하지 않는다.
  - 제안: 이 gap 은 plan 이 이미 정확히 추적 중이므로 새로 등재할 필요는 없다. 다만
    **머지 전후로 이 항목이 방치되면 안 되는 이유**를 강조한다 — 지금 상태로는 이 두 가드
    파일이 나중에 약화·삭제돼도 `--impl-done` SPEC-CONSISTENCY 게이트가 안 문다(plan 자체
    서술). project-planner 턴으로 §5.4 표에 3번째 행 추가 + `code:` 에 두 파일 패턴 추가를
    빠르게 후속시킬 것을 권고.

- **[WARNING]** `User` 민감 7컬럼의 응답 노출 금지가 아직 규약 문장이 아님
  - target 위치: `spec/1-data-model.md §2.1 User` (컬럼 표에 노출 금지 서술 없음) ·
    `spec/conventions/secret-store.md §1.1` (Trigger/AuthConfig 계열만 다룸, `User` 미포함)
  - 관련 plan: `plan/in-progress/spec-draft-nullable-notation-followups.md` 「후속」
    — "`User` 민감 7컬럼의 응답 노출 금지를 규약 문장으로" (`[ ]` 미완료, owner: planner,
    2026-09-06 등재, `review/consistency/2026/09/06/10_13_23` W2)
  - 상세: `secret-store.md §1.1`("비대상 필드도 응답 바디에는 나가지 않는다")이 이미
    `AuthConfig.config`·`Trigger.config.interaction.triggerToken`·
    `Trigger.notification_secret_v2` 등에 대해 정확히 이 패턴의 규범 문장을 세워 둔 선례가
    있다(실측 확인, `secret-store.md:86-100`). 그런데 `User` 의 7컬럼
    (`passwordHash`·`twoFactorSecret`·`totpRecoveryCodes`·`webauthnRecoveryCodes`·
    `passwordResetToken`·`emailVerifyToken`·`emailChangeToken`)에는 대응 절이 없고,
    `1-data-model.md §2.1` 컬럼 표에도 노출 금지 언급이 없다. 이 불변식의 SoT 는 지금
    **코드(`USER_SECRET_KEYS` 배열)뿐**이라고 plan 이 명시한다.
  - 제안: 이것도 plan 에 이미 등재돼 있어 신규 항목 생성은 불필요. project-planner 턴에서
    `secret-store.md §1.1` 또는 `1-data-model.md §2.1` 에 한 문단 추가 + 위 두 가드 파일을
    그 절의 `code:`/본문 링크로 연결 — 앞의 §5.4 등재 항목과 **같은 턴**에 처리하는 것이
plan 자체의 제안이다.

- **[INFO]** `1-auth.md` §1.3(LDAP/SAML), §4.1(`workflow.executed` Planned 잔류) 등 기존
  미해결 항목은 target 문서와 `spec-sync-auth-gaps.md` 사이에 충돌 없이 정합됨을 확인했다
  (둘 다 "미구현·Planned" 로 일관 서술, `pending_plans` 프론트매터 연결 정상). 이번 diff 는
  이 영역을 건드리지 않는다.

## 요약

이번 PR 은 `plan/in-progress/spec-draft-nullable-notation-followups.md` 가 상세히 추적해 온
`User` 엔티티 컬럼 노출 방어 작업을 예정대로 완료했고, 그 결정(구조 축 + 이름 축 검출 가드)은
`secret-store.md` 의 기존 선례(§1.1)와 다른 plan 의 근거(`select:false` 기피 이유)에 정합해
충돌이 없다. 다만 그 완료 항목이 스스로 남긴 **두 개의 스핀오프 후속 항목**
(§5.4 「검증 층」·`code:` frontmatter 등재, `User` 노출 금지 규약 문장화)은 아직 target
문서에 반영되지 않았고, 이는 developer 권한 밖(spec 쓰기 금지)이라 planner 턴을 기다리는
정상적인 분업 상태다 — 다만 그 상태로 오래 방치되면 신규 가드가 spec-consistency 게이트의
사각지대에 남는다는 점을 plan 자신이 명시하고 있으므로, 다음 planner 턴에서 우선 처리가
권장된다. 미해결 결정 충돌(perspective 1)이나 선행 plan 미해소(perspective 2)로 분류될
CRITICAL 사안은 발견되지 않았다.

## 위험도

MEDIUM
