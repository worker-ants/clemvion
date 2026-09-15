# Plan 정합성 검토 — `spec/5-system/` (--impl-prep)

## 검토 전제

이번 호출의 target 은 diff 가 아니라 `spec/5-system/` 코퍼스 전체이고, 실제 착수 예정 작업은
`plan/in-progress/trigger-lock-followups.md`(트리거 config advisory lock `#1334` 의 developer
범위 후속 5건, `owner: developer`, `spec_impact: none`)다. 이 plan 이 손대는 파일은
`trigger-config-lock.ts`(항목 ②③④) · `triggers.service.ts`(항목 ①) ·
`schedules.service.spec.ts`(항목 ⑤) 셋이다. 아래 발견은 이 다섯 항목이 `spec/5-system/` 의
frontmatter `code:` 커버리지·다른 `plan/in-progress/**` 문서와 맺는 관계를 실측한 결과다.

## 발견사항

- **[WARNING] `trigger-config-lock.ts` 는 `spec/5-system/` 어떤 `code:` glob 에도 안 걸린다 —
  이미 등록된 미해소 planner 항목과 정면으로 겹친다**
  - target 위치: `spec/5-system/15-chat-channel.md` frontmatter `code:` (실제 파일 1~19행,
    `chat-channel-*.ts` / `trigger-callback-url*.ts` / `triggers.service.ts` 는 열거하지만
    `trigger-config-lock.ts` 는 없음). `12-webhook.md`·`14-external-interaction-api.md` 도
    동일하게 미포함(실측: `grep -rn "trigger-config-lock" spec/` 0건).
  - 관련 plan: `plan/in-progress/spec-draft-nullable-notation-followups.md:4454-4471`
    (**planner 범위 5건**, 전부 `- [ ]` 미해소) 의 항목 1 — *"`spec/5-system/15-chat-channel.md`
    frontmatter `code:` glob 이 신규 `trigger-config-lock.ts` 를 안 문다"* 를 이미 명시적으로
    등재해 두었다.
  - 상세: `trigger-lock-followups.md` 의 다섯 항목 중 **②③④ 셋이 바로 이 커버리지 밖 파일**을
    수정한다(JSDoc 일반화·`timeoutMs` 검증·`affected` 확인). ⑤가 건드리는
    `schedules.service.ts` 도 `spec/5-system/` 안에서는 어디에도 `code:` 로 등재돼 있지 않다
    (`spec/2-navigation/3-schedule.md` 에만 있음, scope 밖). 즉 이번 developer PR 의 diff 5곳 중
    4곳이 diff-scoped `--impl-done` 실행 시 `spec/5-system/` 어떤 문서와도 자동으로 번들되지
    않는다 — planner 가 이미 지적한 그 gap 을, 같은 대상 파일을 재차 건드리는 이 PR 이 아무런
    언급 없이 통과하는 모양이 된다. 사용자 메모(`feedback_impl_done_spec_bundle_bug.md`)에
    등재된 "prompt grep 0건 → 오탐" 패턴과 같은 성격이라, `--impl-done` 이 이 diff 구간에서
    스스로 spec 번들을 못 찾고 BLOCK:YES 로 교착하거나 반대로 조용히 스킵할 위험이 있다.
  - 제안: (a) `trigger-lock-followups.md` 체크리스트에 "`--impl-done` 실행 시
    `trigger-config-lock.ts` 구간이 spec 번들 0건으로 나오면 known bug 로 판단해 BYPASS+근거
    기록" 을 한 줄 명시하거나, (b) 이번 PR 범위 밖이라도 `spec-draft-nullable-notation-followups.md`
    의 planner 항목 1을 이번 developer 세션과 시간적으로 묶어 함께 처리할지 사용자에게
    확인. 어느 쪽이든 "gap 을 알면서 그대로 지나간다" 상태로 두지 않는 것이 핵심.

- **[WARNING] 반증된 전제가 살아있는 트래커 한 곳에 아직 정정되지 않았다**
  - target 위치: `plan/in-progress/trigger-lock-followups.md` §"④ — Trigger 행을 지우는 경로는
    둘이 아니라 셋이다" (반증 선언 + 정정 범위 명시: "CHANGELOG 는 루트라 자유,
    `codebase/**` JSDoc 은 ②와 함께").
  - 관련 plan: `plan/in-progress/spec-draft-nullable-notation-followups.md:4487` — 항목 5 설명이
    지금도 *"삭제 경로 둘이 **같은 락을 공유**해 실무적으로 닫혀 있고, 계약을 코드로 드러내는
    일이 남았다"* 라고 적혀 있다. 이 문장은 `trigger-lock-followups.md` 자신이 실측으로
    반증한 바로 그 전제("Workflow/Workspace 삭제의 FK `onDelete: CASCADE` 는 advisory lock 을
    거치지 않는 세 번째 삭제 경로")다.
  - 상세: `trigger-lock-followups.md` 는 정정 대상으로 루트 `CHANGELOG.md` 와 `codebase/**`
    JSDoc 만 적어 두었고, 같은 문장이 그대로 남아 있는 **살아 있는 plan 트래커**
    (`spec-draft-nullable-notation-followups.md`)는 정정 목록에서 빠졌다. 공교롭게도 그 트래커
    문서 자신이 몇 줄 위(4468-4471)에서 *"조건부·후속 처분은 봉인되는 `complete/` 말고 살아
    있는 트래커에 적는다"* 는 원칙을 스스로 세워 둔 자리라, 그 원칙이 이번엔 반대 방향
    (틀린 서술의 존치)으로 어겨지는 모양이다. `plan/complete/trigger-config-lost-update.md:686`
    도 같은 문장을 담고 있으나 그쪽은 봉인 문서라 이력으로 남기는 것이 정합적이다 — 문제는
    아직 열려 있는 트래커 쪽이다.
  - 제안: item ④ 커밋(또는 트래커 항목 `[x]` 처리 시점)에
    `spec-draft-nullable-notation-followups.md:4487` 의 설명 문구도 "삭제 경로는 셋이며 FK
    CASCADE 경로는 advisory lock 을 거치지 않는다 — `#XXXX` 에서 좁은 실결함으로 재분류"
    로 함께 정정할 것.

- **[INFO] 나머지 네 항목은 `spec/5-system/` 의 결정·미해결 사안과 충돌하지 않는다**
  - target 위치: `spec/5-system/1-auth.md` · `2-api-convention.md` · `3-error-handling.md`
    (전문 번들 확인) — 세 문서 모두 advisory lock·`trigger-config-lock`·
    `findByIdForUpdate`·`TRIGGER_DELETE_LOCK_TIMEOUT_MS` 언급 0건.
  - 관련 plan: `plan/in-progress/spec-sync-auth-gaps.md`(1-auth.md 의 유일한 `pending_plans`) —
    열람 결과 미해결 항목(§1.3 LDAP/SAML, `workflow.executed`, 감사 mutation 잔여 등)이
    트리거 lock 작업과 겹치지 않음을 확인.
  - 상세: 항목 ①(`findByIdForUpdate` 개명)·⑤(falsy 분기 테스트)는 순수 코드 내부 이름·테스트
    보강이라 spec 표면에 영향이 없고, 항목 ①이 대조 대상으로 삼는 SQL `FOR UPDATE` 관용구
    7파일 중 spec/5-system 코드 목록에 있는 것들도 이름 변경 대상과 무관(호출 스타일이
    아니라 식별자만 바뀜). `spec_impact: none` 판단은 이 넷에 한해 타당하다.
  - 제안: 없음(확인 기록).

## 요약

`trigger-lock-followups.md` 의 다섯 항목 자체는 `spec/5-system/` 이 이미 내린 결정과 충돌하지
않고 `spec_impact: none` 판단도 대체로 타당하다. 다만 이 PR 이 반복해서 손대는
`trigger-config-lock.ts`(항목 ②③④)와 `schedules.service.ts`(항목 ⑤)가 `spec/5-system/` 어떤
`code:` frontmatter 에도 걸리지 않는다는 점은 `plan/in-progress/spec-draft-nullable-notation-followups.md`
가 이미 planner 범위로 등재해 둔 미해소 gap 과 정확히 겹치므로, `--impl-done` 실행 시
스스로 spec 번들을 못 찾는 이미 알려진 실패 패턴을 재현할 위험이 있다. 또한 이번 세션이
실측으로 반증한 "삭제 경로 2곳이 같은 락을 공유해 닫혀 있다"는 옛 전제가, 정정 대상으로
선언되지 않은 살아있는 트래커 한 줄(`spec-draft-nullable-notation-followups.md:4487`)에
그대로 남아 다음 사람을 오도할 소지가 있다. 두 항목 모두 구현 착수를 막을 정도는 아니지만,
plan 갱신(체크리스트 문구 추가 또는 트래커 문구 정정)이 필요하다.

## 위험도

MEDIUM
