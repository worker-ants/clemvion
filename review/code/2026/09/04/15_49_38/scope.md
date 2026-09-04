# 변경 범위(Scope) 리뷰

## 검토 방법

프롬프트가 보여준 46개 파일 diff에 더해, `git log origin/main..HEAD`(5커밋: `499675277` →
`441761478` → `145b7ddcd` → `5a2acd664` → `24c68d484`)와 각 커밋의 `--stat`, 그리고
`git diff origin/main...HEAD --stat`(net diff)를 직접 대조했다. 저장소에는 아무것도 쓰지
않았다(읽기 전용 `git log`/`git diff`/`git show`/`Read`만 사용).

## 발견사항

- **[INFO]** 세션 전체가 3라운드 되돌림(83→15→5 필드)을 거쳤지만, **origin/main 대비 최종
  net diff는 정확히 그 최종 상태(5필드)만 남긴다** — 중간에 뒤집었다 되돌린 18개 DTO 파일은
  최종 diff에 전혀 나타나지 않는다(`alert-rule-response.dto.ts` 등 18개는 net diff 0줄,
  `execution-response.dto.ts`도 15→5 라운드에서 완전히 원복돼 net diff 0줄).
  - 위치: `git diff origin/main...HEAD --stat` — 실제 코드 변경은
    `codebase/backend/.../execution-status-response.dto.ts`(20줄) +
    `execution-status-response.dto.spec.ts`(36줄) 두 파일뿐
  - 상세: 프롬프트에 나열된 22개 DTO 관련 파일 경로(`파일 3` 및 review 산출물이 언급하는
    나머지 파일들)는 **중간 라운드의 diff**이지 최종 상태가 아니다. 스코프 판단은 최종
    net diff 기준으로 해야 하며, 그 기준으로는 `ExecutionStatusDto`의 5필드 정정으로 정확히
    수렴한다. 이전 두 라운드(`14_54_36`, `15_22_06`)의 `scope.md`가 각각 NONE으로 판정한
    근거(83곳 전부 명시된 단일 목적에 수렴, 요청 DTO 배제, import 정리 조건부 정확)는 이번
    최종 상태에도 그대로 유효하고, 오히려 범위가 5필드로 더 좁아져 위험이 줄었다.
  - 제안: 조치 불요.

- **[INFO]** 이번 branch에는 이 nullable-notation 작업과 **무관한 별도 plan 문서의 상태
  전환**(`plan/in-progress/spec-draft-scope-and-anchor-drift.md` → `plan/complete/...`)이
  포함돼 있다 — 커밋 `24c68d484`
  - 위치: `plan/complete/spec-draft-scope-and-anchor-drift.md`(rename 대상),
    커밋 `24c68d484`("`chore(plan): mark spec-draft-scope-and-anchor-drift complete`")
  - 상세: `git diff -M`으로 확인한 결과 이 파일은 `git mv` + frontmatter `status: in-progress`
    → `status: complete` 단 1줄 변경뿐이다(`similarity index 99%`). 커밋 메시지는
    "`--impl-done`(`15_42_35`) BLOCK:NO·Critical 0·WARNING 0 — INFO#2 를 반영한다.
    `#1280`으로 이미 머지됐고 열린 체크박스가 0건인데 `status: in-progress`로 남아 다음
    사람이 미착수로 오독한다"는 근거를 명시했다. 이 worktree 이름
    (`plan-in-progress-items-b0c80b`)이 "in-progress 항목 정리" 세션임을 시사하므로, 이
    plan-lifecycle 정정이 세션의 더 넓은 목적 범위에 들어갈 가능성이 높고, 별도 커밋으로
    분리돼 있어(DTO 수정 커밋과 섞이지 않음) 코드 diff를 오염시키지 않는다. 다만 "§5.4 drift
    배치"라는 이번 changeset의 표면적 주제와는 직접 관련이 없는 항목이라는 점은 사실이다.
  - 제안: 조치 불요(별도 커밋으로 이미 분리돼 있고 근거가 문서화됨). PR 설명에서 이 커밋이
    "부수 포함"이 아니라 "동일 세션의 다른 in-progress 항목 정리"임을 한 줄 명시하면 리뷰어
    혼동을 줄일 수 있다.

- **[INFO]** `review/code/**`·`review/consistency/**` 산출물 다수(46개 파일 중 40개)가 이번
  diff에 포함되지만, 이는 프로젝트 컨벤션이 명시한 정상적인 프로세스 부산물이다
  - 위치: `review/code/2026/09/04/{14_54_36,15_22_06}/*`,
    `review/consistency/2026/09/04/{15_16_28,15_42_35}/*`
  - 상세: `CLAUDE.md`가 "구현 완료 후 자동 review/fix는 상시 승인된 강제 의무"이며 그 산출물
    저장 위치를 `review/code/<...>/`·`review/consistency/<...>/`로 명시한다. 각 review 라운드
    산출물은 그 라운드가 촉발한 fix 커밋에 함께 실려 있어(`441761478`이 `14_54_36`을,
    `5a2acd664`가 `15_22_06`을, `145b7ddcd`/`24c68d484`가 각 consistency 라운드를 동반) 별도
    "무관한 파일 추가"가 아니라 "리뷰→수정" 워크플로의 감사 흔적이다.
  - 제안: 조치 불요.

## 확인했으나 문제 없음

- DTO 파일(`execution-status-response.dto.ts`) 최종 diff는 `@ApiPropertyOptional`→
  `@ApiProperty` 전환 + `?` 제거뿐이며, import 줄·주석·다른 필드는 손대지 않았다(직접
  `git diff origin/main...HEAD`로 재확인).
- `CHANGELOG.md` 최종 상태는 이전 두 라운드(83곳·15곳 버전)의 잔여 텍스트 없이 단일
  "5곳" 항목으로 깔끔하게 수렴한다(중복/잔존 섹션 없음, `Read`로 직접 확인).
- `plan/in-progress/spec-draft-nullable-notation-followups.md`의 체크리스트·종결조건 표는
  실제 열린 항목(2단계 78곳/WS wire 판단/QueryExecutionDto/`idx_schedule_next_run`)과
  일치하며, 스코프 밖 항목을 새로 끌어들이지 않고 등재만 한다.

## 요약

프롬프트가 제시한 46개 파일은 5커밋(`499675277`~`24c68d484`)의 누적 diff이며, 표면적으로는
83개 필드를 뒤집었다가 두 번 되돌리는 큰 변동으로 보이지만 `origin/main` 대비 **최종 net
diff는 `ExecutionStatusDto` 5필드(코드 2파일)로 정확히 수렴**한다 — 중간 라운드에서 건드렸다
되돌린 18개 DTO 파일은 최종 diff에 전혀 남지 않는다. `CHANGELOG.md`·plan 문서 갱신은 그
최종 상태를 정확히 설명하고, `review/code`·`review/consistency` 산출물은 프로젝트가 강제하는
review-fix 워크플로의 정상 부산물이다. 유일하게 "표면 주제와 무관"이라 부를 수 있는 항목은
별도 커밋(`24c68d484`)으로 분리된 다른 plan 문서의 1줄 상태 정정(in-progress→complete)인데,
이는 자체 근거(consistency-check INFO#2)를 갖고 코드 diff와 섞이지 않아 실질적 스코프 오염은
없다. Critical/Warning 급 범위 이탈은 발견되지 않았다.

## 위험도

NONE
