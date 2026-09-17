# Plan 정합성 검토 — `spec/2-navigation/` (--impl-prep)

## 검토 범위

- target: `spec/2-navigation/` 번들 (완전 포함: `2-trigger-list.md` · `1-workflow-list.md` ·
  `3-schedule.md`. 나머지 15개 파일은 컨텍스트 예산 초과로 생략됨 — 판정에 필요한 부분은 직접
  `Read` 로 확인)
- 진행 중 plan: `plan/in-progress/trigger-save-partial-patch.md`(이 worktree 의 작업물, 신규
  untracked) + 그 트래커 `plan/in-progress/spec-draft-nullable-notation-followups.md`(4585줄,
  developer 항목 7 절 직접 확인) + `plan/in-progress/spec-sync-auth-gaps.md` (grep 히트, 확인 결과
  무관 — 아래 참고)

## 발견사항

- **[WARNING]** 창 1 수정 후 planner 후속에 새 characterization 테스트의 `code:` 등재가 빠져 있다
  - target 위치: `spec/2-navigation/2-trigger-list.md` frontmatter `code:` (35~55행) — 특히
    41행 `trigger-config-lock.ts` 주석과 49~55행 `trigger-workflow-ref.e2e-spec.ts` /
    `trigger-workflow-ref*.ts` 등재 패턴. 및 §3 ⚠️ "실측되지 않은 잔여" 문장(228~230행)
  - 관련 plan: `plan/in-progress/trigger-save-partial-patch.md`
    `## 이 PR 이 **안** 하는 것` 절 + `## 체크리스트`의
    "트래커 항목 7 `[x]` + planner 후속(⚠️ 정정) 등재 + plan → `complete/`"
  - 상세: 이 plan 은 §3 ⚠️ 문장 정정을 developer 권한 밖으로 보고 planner 턴에 명시적으로
    위임한다(역할 경계상 옳은 판단). 그런데 이번 PR 은 새 e2e 파일
    `codebase/backend/test/trigger-save-window-probe.e2e-spec.ts` 를 만들고, 검증 계획에서
    이를 "측정 spec → 특성 테스트로 전환"해 ①①b②②b③ 을 영구 고정하겠다고 명시한다. 이 저장소는
    바로 이 spec 문서 안에서 이미 같은 패턴(§3 註가 `TriggerDto.workflow` 다섯 케이스를
    "e2e 가 고정한다"고 쓰면서 `trigger-workflow-ref.e2e-spec.ts` 를 `code:` 에 등재한 선례,
    41행 주석의 "정본을 헬퍼에 등재" 관례)을 성문화해 두었다 — "e2e 가 고정한다"고 적으면서
    그 파일을 등재하지 않으면 보장의 근거가 추적 불가하다는 것이 그 comment 의 논지다. 그런데
    `trigger-save-partial-patch.md` 의 "planner 후속(⚠️ 정정) 등재" 항목은 **프로즈 정정만**
    지목하고, 새 characterization 테스트 파일을 `code:` 목록에 함께 올려야 한다는 것을 명시하지
    않는다 — 그대로 진행하면 planner 턴이 "⚠️ 문장만 바꾸고 evidence 파일은 안 올리는" 절반짜리
    후속이 될 위험이 있다(이 문서 자신이 경고해 온 바로 그 실패 형태의 재발).
  - 제안: `trigger-save-partial-patch.md` 의 `## 이 PR 이 안 하는 것` 절 또는 트래커에 등재할
    "planner 후속" 서술에 "⚠️ 문장 정정과 함께, ①①b②②b③ 을 고정하는 e2e 파일(및 그 헬퍼가
    있다면 헬퍼)을 `2-trigger-list.md` frontmatter `code:` 에 등재한다"를 명시적으로 추가한다.
    파일명이 최종적으로 `trigger-save-window-probe.e2e-spec.ts` 그대로 남는지, 다른 이름으로
    재정리되는지는 이 PR 내부에서 정해질 것이므로 planner 턴 시점의 실제 파일명 기준으로
    등재하면 된다.

## 확인했으나 문제 없음으로 판정한 항목 (참고용, 발견사항 아님)

- `plan/in-progress/spec-sync-auth-gaps.md` 가 `2-trigger-list.md:182`/`:252` 의 audit action
  오기(`trigger.delete`/`trigger.update`)를 지목한 항목은 **이미 `[x]` 완료(2026-08-06)** 로
  표시돼 있고, 현재 spec 본문(244행 `trigger.deleted`, 326행 `trigger.updated`)도 정정된
  상태와 일치한다 — stale 참조 아님, 조치 불필요.
- `plan/in-progress/harness-review-gate-followups.md` 의 `2-trigger-list.md` 언급은 청크 예산
  실측 사례(42,611자/29,416자)일 뿐 본 target 의 내용과 무관.
- 트래커 developer 항목 7 자체는 target §3 ⚠️ 문장이 "미검증"이라고 정확히 서술하고 있어 —
  이번 plan 이 그 상태를 닫으려는 중이므로 **target 과 미해결 결정이 충돌하지 않는다** (오히려
  target 이 정확히 열린 상태를 반영 중).
- `trigger-save-partial-patch.md` 의 설계(동사를 `save` 로 유지, 저장 객체만 `defined + config`
  로 좁힘)는 target §3 의 "동시 쓰기 직렬화" 일반 서술(락 안 재읽기→병합 쓰기) 및 §3 응답 형태
  註(`update()` 가 `workflow` 관계를 채워 응답한다)와 상충하지 않는다 — 오히려 응답 구성을
  "재읽은 엔티티(관계 포함) + save 반환값 덮어쓰기"로 설계해 §3 註의 기존 보장을 유지하도록
  맞춰져 있다.
- `spec_impact: none` (bare) 은 Gate C 규약에 부합하는 형식이다.

## 요약

target(`spec/2-navigation/`, 특히 `2-trigger-list.md`)은 트래커의 미해결 developer 항목 7 을
정확히 반영하고 있고, 진행 중인 `trigger-save-partial-patch.md` 는 그 항목을 닫기 위한 작업으로
role 경계(§자기-반증형 소정정)를 지켜 spec 프로즈 정정을 planner 턴으로 명시적으로 분리하는 등
전반적으로 정합적이다. 다만 이 PR 이 만드는 새 characterization e2e 증거 파일이 planner 후속의
scope 서술(`code:` frontmatter 등재)에 빠져 있어, 다음 planner 턴이 "문장만 고치고 근거 파일은
누락"되는 절반짜리 후속으로 끝날 위험이 하나 있다 — plan 문서 갱신을 권고한다. 다른 in-progress
plan(`spec-sync-auth-gaps.md`, `harness-review-gate-followups.md`)과의 교차 참조는 이미
해소됐거나 무관함을 확인했다.

## 위험도

LOW
