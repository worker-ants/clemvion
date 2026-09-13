# Plan 정합성 검토

## 검토 범위

- 검토 모드: `--impl-done`, scope=`spec/conventions/`, diff-base=`origin/main`.
- `spec/conventions/**` 자체는 이 브랜치에서 변경되지 않음(스코프 델타 0). plan
  frontmatter `spec_impact: none` 과 일치 — 정상.
- 실제 코드 델타(`git diff origin/main...HEAD -- codebase/ PROJECT.md CHANGELOG.md plan/`):
  - `codebase/frontend/src/lib/docs/__tests__/{guide-error-code-existence.test.ts,
    guide-error-code-scan.ts}` 삭제 → `{guide-identifier-existence.test.ts,
    guide-identifier-scan.ts}` 신규 (가드를 에러 코드 전용 → 식별자(에러 코드+환경변수)
    전반으로 확장 + 리네임)
  - `guide-sanitized-message-parity.test.ts` 주석 1곳(자매 가드 이름 갱신)
  - `PROJECT.md` 가드 카탈로그 1행, `CHANGELOG.md` 항목 갱신
  - `plan/in-progress/guide-identifier-existence.md` 신규(이 작업의 owner=developer plan)
  - `plan/in-progress/spec-draft-nullable-notation-followups.md`(owner=planner 트래커) 갱신
  - 이후 라운드 커밋(`69847f45f`, `938060138`)은 리뷰 라운드 fix — `guide-identifier-
    existence.test.ts`·`review/**` 산출물만 건드리며 plan/spec 정합성에 영향 없음(확인함).

## 발견사항

세 관점(미해결 결정과의 충돌 / 선행 plan 미해소 / 후속 항목 누락) 모두에서 차단 사유를
찾지 못했다.

- **주도 plan 이 자체 impl-prep 검토를 이미 거쳤고, 그 처분이 diff 에 실제로 반영돼
  있음을 실측 확인**. `plan/in-progress/guide-identifier-existence.md` §D 는
  `--impl-prep`(`review/consistency/2026/09/13/12_33_41`, BLOCK:NO·Critical 0·WARNING 4)의
  지적 4건을 전부 처분 대상으로 적었고:
  - `spec/conventions/user-guide-evidence.md §2` 미등재 문제(지적 #1·#2, developer 권한
    밖) → `spec/conventions/user-guide-evidence.md` 를 직접 grep 한 결과 실제로
    `guide-identifier-existence`/`guide-error-code-existence` 어느 이름도 §2 표에 없음을
    확인(plan 의 자기 진단과 일치). 새 planner 항목을 만들지 않고 `plan/in-progress/
    spec-draft-nullable-notation-followups.md` 의 기존 항목(§2.1 관계표 미등재, 3247번째
    줄 부근)에 **리네임 반영 + "함께 등재할 Rationale" 요구**로 합류시켰다(diff 로 확인) —
    "한 planner 턴에 표·frontmatter·Rationale 을 함께" 라는 자기 요구와 일치.
  - frontmatter `spec_impact` 누락(지적 #3) → `guide-identifier-existence.md` frontmatter 에
    `spec_impact: none` + 의미를 좁히는 주석이 실제로 있음을 확인.
  - `cafe24-api-metadata.md §4` Principle 7/0 오인용(지적 #4, 이 PR 과 무관한 선재
    결함, `spec/**`라 developer 권한 밖) → 같은 트래커 파일에 신규 planner 항목으로
    1회만 등재(중복 없음, grep 확인). "이번 plan 과 무관" 이라는 자체 판단과 실제 diff 내용
    (§4 인용 오류 자체는 이 PR 이 건드리지 않음)이 일치.
- **리네임 전방 참조 정합성**. 저장소 전체에서 `guide-error-code` 문자열이 남은 곳은
  `plan/in-progress/spec-draft-nullable-notation-followups.md`(5곳, 전부 `#1331 리네임`
  각주 동반) · `plan/in-progress/guide-identifier-existence.md`(역사 서술, 트래커 항목
  제목의 `#1330` 인용) · `guide-identifier-scan.ts`/`guide-sanitized-message-parity.test.ts`
  주석(자매 가드 옛 이름을 각주로 병기) 뿐이며, orphan 참조(각주 없이 옛 이름만 남은 곳)는
  없음(전수 grep 확인). `plan/complete/guide-error-code-truth.md` 는 완료 plan — 그 시점
  판단("허용목록 불필요")이 이 PR 의 실측으로 뒤집혔지만, `plan/complete/` 는 완료 시점의
  역사 기록이라 소급 정정 대상이 아니다(`.claude/docs/plan-lifecycle.md` 관례와 일치). 이
  번복 근거는 이 PR 이 살아있는 트래커(`spec-draft-nullable-notation-followups.md`)와 새
  plan 양쪽에 상세히 남겼으므로 "선례 근거 소급 부정"류의 결함도 아니다.
- **인접 plan 과의 충돌 없음**. `guide-error-code`/`guide-identifier`/`#1330`/`#1331` 을
  참조하는 in-progress plan 은 위 두 파일뿐(전수 grep). `chat-channel-adapter.md` 의
  `pending_plans` 4건은 이 diff 가 건드리지 않는 영역(§1.1.2 401/403 fallback 판정)이라
  무관.
- **PROJECT.md/CHANGELOG.md 의 "SoT: spec/conventions/user-guide-evidence.md §2" 표기는
  현재 사실과 어긋나지만(§2 표에 미등재) 이 PR 이 만든 새 gap 이 아니라 `#1330` 부터 있던
  선재 gap** 이고, 이미 위에서 확인했듯 developer 권한 밖으로 정확히 분류돼 트래커에 등재돼
  있다. 새로 지적할 사항 없음(INFO 수준의 기존 추적 상태 재확인).
- 남은 미완료 체크리스트(`run-test-all.sh`·`/ai-review + --impl-done` 미체크)는 워크플로
  진행 중 상태를 반영할 뿐 정합성 결함이 아니다 — 이 리뷰 자체가 그 단계 중 하나다.

## 요약

`guide-identifier-existence` 가드 리네임/확장 diff 는 이를 주도한 developer plan 이 사전
`--impl-prep` 검토에서 짚힌 SoT 미등재·frontmatter 누락·선재 결함 3건을 모두 실제로
처분했음을 diff 대조로 확인했다. developer 권한 밖(`spec/**`) 항목은 새 planner 항목을
중복 생성하지 않고 기존 planner 소유 트래커(`spec-draft-nullable-notation-followups.md`)
한 곳에 리네임·Rationale 요구를 병합해 갱신했으며, 리네임 전방 참조는 전수 각주 처리돼
orphan 이 없다. 완료 plan(`guide-error-code-truth.md`)의 예전 판단이 실측으로 뒤집힌
지점이 있으나 완료 plan 은 역사 기록이라 정정 대상이 아니고 번복 근거는 살아있는 트래커에
남아 있다. 다른 in-progress plan 의 미해결 결정과 충돌하거나 선행 조건·후속 항목을
누락시키는 지점은 발견되지 않았다.

## 위험도
NONE
