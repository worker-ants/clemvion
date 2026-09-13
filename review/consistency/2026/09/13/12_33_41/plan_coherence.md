# Plan 정합성 검토 — `spec/conventions/` (--impl-prep, `guide-identifier-existence`)

## 발견사항

- **[WARNING]** `guide-error-code-existence` 가드가 소유 규약 `user-guide-evidence.md` 에
  미등재 — 지금 착수하려는 plan 이 같은 파일을 한 번 더 키운다
  - target 위치: `spec/conventions/user-guide-evidence.md` §2 "Build-time 가드 (3건)" 표 +
    frontmatter `code:` (7개 경로 열거, 3개 가드만 등재)
  - 관련 plan: `plan/in-progress/guide-identifier-existence.md`(현재 작업) ·
    `plan/in-progress/spec-draft-nullable-notation-followups.md` (2026-09-12 등재 항목,
    line 3141 근방의 `#1330` 해소 기록)
  - 상세: `#1330`(`ce454e046`)이 만든 `guide-error-code-existence.test.ts` +
    `guide-error-code-scan.ts` 는 자기 docstring 과 트래커 해소 기록 양쪽에서
    *"`user-guide-evidence.md` 의 가드 가족에 합류"* 라고 명시적으로 주장한다. 그런데 그
    커밋은 `spec/` 을 한 글자도 건드리지 않았다 — `user-guide-evidence.md` 의 §2 표는 여전히
    "3건"이고 frontmatter `code:` 에도 두 신규 파일이 없다. `grep -rn "guide-error-code"
    spec/` 은 **0건**이다. `guide-identifier-existence.md` 는 바로 이 두 파일에 넓은 축(백틱
    전수) + 방어적 허용목록을 추가하는 작업인데, 체크리스트 9개 항목 어디에도 이 spec 등재를
    반영하는 항목이 없다 — 작업이 끝나면 같은 미등재 상태가 표 안 대상만 늘어난 채 유지된다.
    같은 클래스의 선례가 이미 이 저장소에 있다(`plan/in-progress/harness-review-gate-followups.md`
    "신규 가드를 `spec-impl-evidence.md §4.2` SoT 에 등재" 항목 — 2회 유예 후 *"세 번째
    유예 시 WARNING 격상"* 규칙이 명문화돼 있다). 이번은 그 규칙이 적용되는 첫 관측이 아니라
    **아직 한 번도 등재 자체가 시도되지 않은** 사례다. 덧붙여 env-var 축은 error-codes.md
    와 대칭되는 "env var 명명 규약" 문서가 `spec/conventions/` 에 아예 없어, 확장된 가드가
    두 표면(에러 코드 · 환경변수)을 한 파일에서 검증하면서도 소유 규약은 하나(그것도
    미등재)뿐인 비대칭이 커진다.
  - 제안: 이번 plan 의 체크리스트에 *"`user-guide-evidence.md` §2 표 + frontmatter `code:`
    에 `guide-error-code-existence.test.ts`/`guide-error-code-scan.ts` 등재"* 항목을 추가한다.
    `developer` 는 `spec/` 을 직접 못 고치므로(자기-반증형 소정정 조건 불충족 — 이 문장은
    developer 가 쓴 것이 아니다) planner 턴으로 분리하거나, 이번 PR 범위가 이미 크다면
    `harness-review-gate-followups.md` 선례처럼 **유예를 명시적으로 등재**(재개 신호 포함)
    해 최소한 추적 가능하게 만든다. 침묵 유지는 선례가 경고한 패턴을 반복한다.

- **[WARNING]** `spec_impact` frontmatter 누락 — 위 등재 여부에 따라 값이 달라지는데
  아예 필드가 없다
  - target 위치: `plan/in-progress/guide-identifier-existence.md` frontmatter (1~5줄)
  - 관련 plan: 동일 파일. 대조군: `plan/in-progress/keyset-cursor-uuid-validation.md`,
    `plan/in-progress/deps-guard-hardening.md` (둘 다 `owner: developer` +
    `spec_impact: none` 을 명시)
  - 상세: 이 저장소의 Gate C 관례(`spec_impact` 는 실재 spec 경로 리스트 또는 bare `none`)를
    다른 developer-owned in-progress plan 은 모두 지키는데 이 plan 만 필드 자체가 없다.
    위 첫 항목이 제안하는 대로 `user-guide-evidence.md` 갱신을 체크리스트에 넣는다면
    `spec_impact` 는 `[spec/conventions/user-guide-evidence.md]` 여야 하고, 넣지 않기로
    확정한다면 `none` 을 명시해야 한다 — 지금처럼 필드 부재로 두면 어느 쪽 결정도 기록되지
    않는다.
  - 제안: 위 항목의 처분과 함께 `spec_impact:` 필드를 채운다.

- **[INFO]** 이 plan 의 §C 처분이 원 트래커 항목의 "처분 제안" 을 정면으로 뒤집는다 —
  뒤집혔다는 사실이 원문 쪽에는 아직 없다
  - target 위치: `plan/in-progress/guide-identifier-existence.md` §C "넓은 축을 추가하고,
    허용목록을 방어적으로 만든다"
  - 관련 plan: `plan/in-progress/spec-draft-nullable-notation-followups.md` line 3515~3527,
    아직 `- [ ]` (미해결)인 원 항목의 "처분 제안" 문단
  - 상세: 원 항목은 *"허용목록으로 덮으면 은폐가 되므로, 판정 축을 '에러 코드/환경변수
    문맥에 놓인 토큰'으로 좁히는 쪽이 맞다(백틱만 보면 안 된다)"* 라고 적어 두었다. 이번
    plan 의 §A/§B 는 정확히 그 반대(문맥을 좁히면 등재 근거였던 결함을 다시 놓친다는 실측)를
    보여 **백틱 전수 + 방어적 허용목록**으로 결론짓는다. 실측에 근거한 정당한 번복으로
    보이고 이 저장소의 "설계 근거는 실측으로" 원칙에도 부합하지만, 원문(아직 미해결 상태로
    남은 tracker item)이 여전히 반대 방향을 "맞다" 고 적은 채 열려 있다 — 지금 다른 사람이
    그 tracker 파일만 훑으면 이미 뒤집힌 제안을 살아있는 지침으로 오독한다.
  - 제안: 이번 plan 체크리스트의 "트래커 항목 종결" 단계에서 tracker item 원문의 해당
    문장을 취소선으로 남기고 번복 근거(§A/§B 실측)를 그 자리에 병기한다 — 이 파일이 이미
    여러 차례 쓴 정정 패턴(`~~원문~~` + `> 해소 —` 인용)을 그대로 따르면 된다.

## 요약

이번 --impl-prep 대상인 `spec/conventions/` 자체에서 미해결 결정과 정면 충돌하는 서술은
없다. 다만 착수하려는 `guide-identifier-existence.md` 가 손대는 두 산출물
(`guide-error-code-existence.test.ts`/`guide-error-code-scan.ts`)이 자신을 소유한다고 주장하는
규약 문서(`user-guide-evidence.md`)에 애초부터 미등재였고, 이번 확장이 그 gap 을 그대로 키운
채 끝날 위험이 체크리스트에 반영돼 있지 않다 — 이 저장소가 이미 한 번 겪고 명문화한 "신규
가드 spec 미등재" 클래스의 새 인스턴스다. 추가로 `spec_impact` frontmatter 부재, 그리고 이번
plan 이 원 tracker 항목의 아직 열려 있는 "처분 제안" 을 실측으로 뒤집으면서도 원문 쪽 정정을
계획에 명시하지 않은 점을 함께 지적한다. 셋 다 착수 자체를 막을 사유는 아니며 이번 plan 의
체크리스트에 항목을 추가하면 해소된다.

## 위험도

MEDIUM
