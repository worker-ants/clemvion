# Plan 정합성 검토

## 검토 범위 재확인

- target scope `spec/conventions/**` 은 이 브랜치에서 **델타 0**(실측: `git diff origin/main...HEAD -- spec/conventions` 0줄). 실제 diff 는 `codebase/frontend/src/lib/docs/__tests__/{guide-error-code-existence.test.ts→guide-identifier-existence.test.ts, guide-error-code-scan.ts→guide-identifier-scan.ts, guide-sanitized-message-parity.test.ts}` + `PROJECT.md` 1줄(6파일, git mv 포함) — harness 테스트 리네임/확장이며 `spec/**` 은 그대로다.
- 대응 plan: `plan/in-progress/guide-identifier-existence.md`(이 작업 자신의 plan, `spec_impact: none`) + `plan/in-progress/spec-draft-nullable-notation-followups.md`(그 하위 백로그, 다수 관련 planner/developer 항목 보유).

## 점검 관점별 확인

### 1. 미해결 결정과의 충돌
target(spec/conventions)이 바뀌지 않았으므로 plan 의 "결정 필요" 항목을 일방적으로 override 하는 지점은 없다. `guide-identifier-existence.md` §C 가 `#1330` 의 "허용목록 없음" 원칙을 실측으로 번복한다고 선언하지만, 그 번복의 **spec Rationale 반영은 코드에만 있고 spec 문서에는 아직 없다** — 이는 발견이 아니라 plan 스스로가 `--impl-prep` WARNING#2 로 이미 짚었고, `spec-draft-nullable-notation-followups.md:3247-3274`(2026-09-13 등재)에 "표·frontmatter·Rationale 을 한 턴에" 라는 조건과 함께 planner 항목으로 정확히 등재돼 있다. developer 권한 밖 항목을 developer 가 미리 손대지 않고 대기시킨 것은 규약대로다 — 충돌 아님.

### 2. 선행 plan 미해소
- `spec/conventions/user-guide-evidence.md` 를 직접 읽어 확인: §2 "Build-time 가드 (3건)" 표와 frontmatter `code:` 목록(7경로) 모두 신규 가드 2건(`guide-identifier-existence.test.ts`, `guide-sanitized-message-parity.test.ts`)과 3파일(`guide-identifier-scan.ts` 포함)을 아직 반영하지 않고 있다. 이 gap 은 target 이 새로 만든 게 아니라 `#1330`(선행 PR) 때부터 있던 것이고, 이번 작업이 파일명을 리네임하면서 gap 을 좁히기는커녕 넓혔다는 것을 plan 이 스스로 인지·등재(§D 지적#1)했다. 등재처(`spec-draft-nullable-notation-followups.md:3247`)의 서술도 새 파일명 기준으로 갱신돼 있어 stale 하지 않다. **선행 조건 미해소 상태는 맞지만, 방치가 아니라 정상적으로 추적 중** — WARNING 이 아니라 확인 사항으로 기록한다.
- `spec/conventions/cafe24-api-metadata.md:290` 의 "CONVENTIONS Principle 7" 오인용(실제 `node-output.md` Principle 0)도 실측으로 재확인됨 — grep 결과 여전히 "Principle 7" 로 남아 있고, `git log -S`로 2026-05-16 작성 시점부터의 선재 결함임이 이미 checker 에 의해 확인됐다. `spec-draft-nullable-notation-followups.md:3406-3414` 에 이 작업과 **무관한 선재 결함**으로 정확히 등재돼 있다 — 이 작업의 diff 범위(harness 테스트) 밖이라 처리하지 않은 것이 맞다.
- 원 트래커 항목(`spec-draft-nullable-notation-followups.md:3535`, "가이드가 적는 식별자... 가드가 없다")을 직접 확인: 체크박스 `[x]`, 처분 제안에 `~~...~~` 취소선 + 반증 근거, `#1331`(리네임 전 `guide-error-code-existence`, 현 `guide-identifier-existence`)로의 해소 기록이 실재한다 — plan 의 체크리스트 서술("취소선 + 번복 근거")과 정확히 일치.

### 3. 후속 항목 누락
- 리네임된 구 파일명(`guide-error-code-existence.test.ts`/`guide-error-code-scan.ts`)을 아직 참조하는 다른 plan/in-progress 문서가 있는지 전수 grep — **0건**. 다른 in-progress 항목이 구 이름에 의존해 깨지는 사례는 없다.
- `guide-identifier-existence.md`§D 표의 4개 지적사항(SoT 미등재 gap 확대·Rationale 승격·frontmatter `spec_impact`·cafe24-api-metadata 오인용)이 모두 체크리스트에 반영되고 그중 3건(등재 갱신·frontmatter 수정·신규 planner 항목)이 실제로 처리·등재된 상태를 확인했다. 남은 1건(SoT `user-guide-evidence.md` 자체 갱신)은 developer 권한 밖이라 등재만 하는 것이 규약에 맞다.

## 발견사항

없음 — CRITICAL/WARNING 급 불일치를 찾지 못했다. 위 §1~3 은 모두 "이미 plan 이 스스로 진단하고 올바르게 planner 백로그(`spec-draft-nullable-notation-followups.md`)에 등재·교차참조해 둔" 상태를 재확인한 것이다.

- **[INFO]** `user-guide-evidence.md` §2/§2.1 gap 은 이 PR 이후에도 여전히 열려 있다
  - target 위치: `spec/conventions/user-guide-evidence.md` §2 표, §2.1, frontmatter `code:`
  - 관련 plan: `plan/in-progress/spec-draft-nullable-notation-followups.md:3247-3274`(planner, 2026-09-13 등재, 새 파일명 반영됨)
  - 상세: 신규 가드 2건(`guide-identifier-existence.test.ts`·`guide-sanitized-message-parity.test.ts`)과 관련 파일 3종이 SoT 표·frontmatter 에 아직 없다. developer 권한 밖이라 이 PR 이 고치지 않은 것은 정책대로다.
  - 제안: 이 항목을 처리할 다음 planner 턴에서 "허용목록 없음→외부 어휘 허용목록" 원칙 번복의 Rationale 승격과 **함께** 한 번에 반영할 것(같은 등재 문구가 이미 그렇게 지시하고 있음 — 별도 조치 불필요, 향후 세션 참고용 확인).

## 요약
이번 검토 대상(`spec/conventions/**`)은 실제로 변경되지 않았고, 실 구현 diff(harness 테스트 리네임·확장 6파일)는 spec 문서가 아직 반영하지 못한 두 개의 선행 gap(user-guide-evidence.md §2 SoT 미등재, cafe24-api-metadata.md §4 Principle 오인용)을 만들거나 방치하지 않는다 — 둘 다 developer 권한 밖으로 정확히 판별돼 `plan/in-progress/spec-draft-nullable-notation-followups.md`에 최신 파일명·근거와 함께 이미 등재돼 있고, 원 트래커 항목도 취소선+반증 근거로 올바르게 종결돼 있다. plan 자기 서술(체크리스트)과 실제 저장소 상태(spec 파일 내용, git diff, grep) 사이에 불일치는 발견되지 않았다.

## 위험도
NONE
