# 문서화(Documentation) 리뷰 — 2라운드 (`trigger-workflow-ref-canary-96ae33`)

1라운드(`review/code/2026/09/10/14_34_18/documentation.md`)의 지적 3건(`--impl-prep` 세션
`SUMMARY.md` 누락 · stale `_retry_state.json` · 트래커 "Warning 2" 오집계)은 모두 반영이
확인됐다. 이번 라운드는 지시된 대로 (a) `14_34_18/SUMMARY.md` · `14_34_18/RESOLUTION.md` ·
`15_23_41/SUMMARY.md` 세 문서의 집계·인용 정확성, (b) `plan/complete/trigger-workflow-ref-canary.md`
의 커밋 시점 낡음, (c) `plan/in-progress/harness-review-gate-followups.md` "현재 상태" 요약의
실제 부합 여부에 집중했다. 모든 정량 주장은 원본 리포트 8개(`14_34_18/*.md`) + 5개
(`15_23_41/*.md`) 를 직접 grep/Read 로 재계산했다.

## 검증 방법 요약

- `14_34_18/{security,side_effect,maintainability,requirement,documentation,api_contract,testing,scope}.md`
  8개 파일에서 `[CRITICAL]`/`[WARNING]`/`[INFO]` 태그(및 testing.md 의 인라인 `— **WARNING**` 형식)를
  전수 카운트해 `SUMMARY.md` 의 에이전트별 표·전체 집계(Critical 2 / Warning 16 / INFO 22)와 대조.
- `15_23_41/{cross_spec,rationale_continuity,convention_compliance,plan_coherence,naming_collision}.md`
  5개 파일에서 같은 방식으로 태그를 전수 카운트해 `SUMMARY.md` 의 집계표(Critical 0 / Warning 4 / INFO 9)와 대조.
- `git grep -c "it('[A-Z](-[0-9]+)?\. " origin/main -- 'codebase/backend/test/*.e2e-spec.ts'` 로
  "20파일/132개" 주장을 직접 재현(수치 정확히 일치, 숫자 라벨 0건도 별도 확인).
- `trigger-workflow-ref.spec.ts` 의 `it(` 개수를 세어 "8 → 12" 주장 확인(정확히 12개).
- `git log --oneline`, `git show --stat`, `git diff` 로 커밋 경계·현재 워킹트리 상태 확인.
- `plan/in-progress/harness-review-gate-followups.md` 전체(1233줄)에서 `- [ ]`(미해결 체크박스)를
  전수 grep 해 위치를 확인하고, "열려 있는 것의 성격" 4개 불릿이 그 11건 전부를 실제로 포괄하는지
  섹션 경계(`^## `)로 대조.

## 발견사항

- **[WARNING]** `review/consistency/2026/09/10/15_23_41/SUMMARY.md` 의 집계표에서
  `rationale_continuity` 의 INFO 값이 **3** 으로 적혀 있으나, 원본
  `review/consistency/2026/09/10/15_23_41/rationale_continuity.md` 에는 `[INFO]` 태그가
  **2건**(파일 24행 · 31행)뿐이다(파일 전체 태그는 `[WARNING]` 1건 + `[INFO]` 2건 = 3건 — INFO
  열이 "총 태그 수"와 "INFO 태그 수"를 혼동한 것으로 보인다). 이 오차가 "합계" 행의 INFO 총계에도
  그대로 전파돼 **9**로 적혀 있지만, 다섯 checker 원본을 각각 세면 `cross_spec`=2 ·
  `rationale_continuity`=2(3 아님) · `convention_compliance`=0 · `plan_coherence`=2 ·
  `naming_collision`=2, 합 **8**이다.
  - 위치: `review/consistency/2026/09/10/15_23_41/SUMMARY.md:18`(`| \`rationale_continuity\` | LOW | 0 | 1 | 3 |`),
    `:22`(`| **합계** | — | **0** | **4** | **9** |`) —
    대조: `review/consistency/2026/09/10/15_23_41/rationale_continuity.md:24,31`(INFO 태그 2건 전부).
  - 상세: `Warning=4` 집계(1+1+2+0+0)는 정확하고 `Critical=0` 도 정확하다 — 오차는 INFO 열 하나,
    한 셀뿐이다. 그러나 이 라운드의 임무 자체가 "저자가 개수를 다섯 번 틀렸다"는 1라운드 지적을
    받아 만든 문서이고, 이 문서 역시 **호출자(main)가 5개 리포트 원문을 파싱해 산출**했다고
    스스로 적고 있다(`SUMMARY.md:13` "5개 리포트 원문을 파싱해 산출"). 그 파싱이 정확히 이
    카테고리에서 한 번 더 어긋났다 — 같은 세션 안에서 "개수를 실측하라"는 교훈이 다음 문서에
    그대로 재발한 사례다.
  - 제안: `SUMMARY.md:18` 의 INFO 값을 3→2로, `:22` 의 합계 INFO 를 9→8로 정정. 이 파일이
    아직 `review/**`(코드 아님)라 재-freshness 트리거 없이 직접 고칠 수 있다.

- **[WARNING]** `plan/complete/trigger-workflow-ref-canary.md` 가 "`--impl-done` 이 사후에
  요구한 13번째 코드 수정"(case E docstring 에 R-CC-10 위반 재현 경고 추가)을 어디에도 반영하지
  않는다. 같은 작업의 커밋 메시지(`c696ace07`)는 "수정 (12건 + `--impl-done` 이 요구한 1건)" 이라
  명시하고 13번째 항목을 별도 문단으로 설명하며, `review/code/2026/09/10/14_34_18/RESOLUTION.md`
  와 `review/consistency/2026/09/10/15_23_41/SUMMARY.md` 도 각각 전용 섹션("이 리뷰 뒤에 코드가
  한 번 더 바뀌었다" / "Warning 1 — 이 턴에 코드로 반영했다")으로 이를 다루는데, 정작 이 plan
  문서(이 작업의 1차 사료)는 `## /ai-review 라운드` 절과 체크리스트 양쪽에서 여전히 **"코드 수정
  12건"**만 언급하고, `--impl-done` 체크박스는 세부 설명 없는 빈 항목이다.
  - 위치: `plan/complete/trigger-workflow-ref-canary.md:255`(`코드 수정 12건을 적용했다.`),
    `:371`(`코드 수정 12건 적용 후 재검증`), `:372`(`- [x] \`--impl-done\``, 부연 설명 없음).
    대조: 같은 파일의 다른 체크리스트 항목(`:354,357,359,361,364,367,369,373`)은 전부 근거·수치를
    동반하는데 `:372` 만 예외.
  - 상세: 이 프로젝트 관례상 `plan/complete/**` 가 "무엇이 일어났는가"의 단일 사료이고
    (`.claude/docs/plan-lifecycle.md`), `review/**` 는 SoT 가 아니라는 것이 이미 기록된 교훈이다
    (`feedback_review_fix_stale_loop.md`). 그런데 지금은 반대로 `review/**` 세 문서가 13번째
    수정을 상세히 기록하고 있고 `plan/complete/**` 만 12건에 머물러 있다 — 다음 사람이 이 plan
    문서만 읽으면 case E 의 R-CC-10 참조 주석이 **왜**, **언제**, **누구의 지적**(rationale_continuity
    W1)으로 들어갔는지 추적할 방법이 없다.
  - 제안: `## /ai-review 라운드` 절 끝 또는 체크리스트 `--impl-done` 항목에 RESOLUTION.md 의
    13번째 수정 문단(요지: `rationale_continuity` W1, grep 0건이었다는 실측, 반영 내용)을
    1~2문장으로 요약해 붙이고 "코드 수정 12건"을 "코드 수정 13건(12 + `--impl-done` 1)"으로
    정정한다.

- **[INFO]** `review/code/2026/09/10/14_34_18/SUMMARY.md` 의 Warning 표(16건)는 총계 자체는
  정확하지만(8개 리포트의 raw `[WARNING]` 태그를 전수 세면 정확히 16건과 일치), 표의 구성이
  1:1 대응이 아니다 — **행 13**("maintainability INFO→적용")은 `maintainability.md` 의
  raw `[WARNING]` 태그가 아니라 `[INFO]` 태그(e2e 라벨 문자/숫자, 67행)에서 승격된 것이고,
  **행 16**("requirement W1 / security W2")은 두 리포트의 raw `[WARNING]` 태그 2건을 한 행으로
  합쳤다. 두 조정이 서로 상쇄해 표의 행 수가 우연히 "16"과 일치한다.
  - 위치: `review/code/2026/09/10/14_34_18/SUMMARY.md:45`(행13), `:49`(행16).
  - 상세: 두 태그 모두 라벨(`INFO→적용`, `(총 3명 독립)`)로 실질을 이미 밝혀 두었기 때문에
    독자를 오도하지는 않는다 — 실제로 8개 리포트를 열어 재구성해 보면 정합적이다. 다만
    "16건"이라는 표제가 "16개의 raw WARNING 태그"를 뜻하는지 "16개의 처리 단위(사안)"를
    뜻하는지가 이 조정 때문에 모호해진다. `RESOLUTION.md` 의 "12+4+2 ≠ 16" 각주가 이미 이
    비-1:1 대응을 인지하고 있으므로, 그 각주에 "행 13(INFO 승격)·행 16(2건 병합)이 그 비대칭의
    구체적 위치"라고 한 문장만 덧붙이면 다음 사람이 재구성할 필요가 없어진다.
  - 제안: 급하지 않음(INFO). `RESOLUTION.md` 의 해당 각주에 행 번호를 명시하는 정도로 충분.

- **[INFO]** (관측 사실 보고, 조치 아님) 이 리뷰를 진행하는 중 `git status --short` 가
  `codebase/backend/src/shared/testing/trigger-workflow-ref.ts` 에 **커밋되지 않은 1줄 삭제**
  (`expect(typeof ref.id).toBe('string');` 제거)를 보고했다. 이 세션은 병렬 fan-out 리뷰이고
  이 워킹트리를 다른 reviewer 들이 동시에 읽고 있다는 사전 고지가 있었으므로, 이는 **다른
  reviewer 의 뮤테이션 실험이 아직 원복되지 않은 상태**일 가능성이 높다(이 파일은 `testing`
  계열 리뷰어가 뮤테이션 검증에 쓰는 정확히 그 라인이다). 이 리뷰의 어떤 정량 검증(self-spec
  12개 카운트 등)도 이 한 줄에 의존하지 않으므로 내 결론에는 영향이 없다. 규약에 따라 나는
  이 파일을 건드리지 않았다(`git checkout`/`restore` 미사용, cp 백업도 안 함 — 내가 만든
  변경이 아니므로).
  - 위치: `codebase/backend/src/shared/testing/trigger-workflow-ref.ts`(`git diff` 상 122행
    부근, `expect(typeof ref.id).toBe('string');` 삭제).
  - 제안: 최종 커밋/push 전에 이 워킹트리의 `git status --short` 가 clean 한지 재확인할 것.
    내가 이 리포트를 쓰는 시점 기준으로는 아직 정리되지 않은 상태다.

## 검증되어 정확함을 확인한 정량 주장 (참고)

- `Warning 16 / INFO 22`(`14_34_18/SUMMARY.md`) — 8개 리포트의 raw 태그 합과 정확히 일치.
- `Critical 2`(`14_34_18/SUMMARY.md`, `api_contract.md`) — 정확.
- `코드 수정 12건`(`RESOLUTION.md` 표 1~12) — 실제 표 행 수와 일치, 세부 내용도 대응 리포트와
  하나하나 대조해 일치 확인(예: 행10 의 "20파일/132개"는 `git grep` 재현으로 정확히 일치).
- `self-spec 8 → 12`(`RESOLUTION.md`) — `trigger-workflow-ref.spec.ts` 의 `it(` 블록을 직접
  세어 정확히 12개 확인.
- `e2e 라벨 20파일·132개`(`plan/complete/trigger-workflow-ref-canary.md:130`) —
  `git grep -c "it('[A-Z](-[0-9]+)?\. " origin/main -- 'codebase/backend/test/*.e2e-spec.ts'`
  로 132건/20파일 정확히 재현, 숫자 라벨 0건도 확인.
- `plan/in-progress/harness-review-gate-followups.md` 의 "열려 있는 것의 성격" 4개 불릿(§11
  잔여 · origin 기본 브랜치 해석 4곳 · 승격은 됐는데 굶는다 · §M) — 문서 전체(1233줄)에서
  미해결 체크박스(`- [ ]`) 11건을 전수 grep 한 결과, 전부 이 네 섹션 범위 안에 위치하며
  이 네 불릿이 실제로 빠짐없이 포괄한다. "origin 기본 브랜치 해석 4곳"은 체크박스가 아닌
  prose 형태의 defer 항목이지만 그 자체가 의도된 형태로 보인다. **개수 서술을 성격 목록으로
  바꾼 이번 편집은 실제로 정확하고 완전하다** — 이전 두 차례 낡음(취소선 누락, tier 굶주림
  누락)과 달리 이번 버전은 내가 재구성한 실제 상태와 어긋나지 않는다.

## 요약

이번 라운드는 문서화 관점에서 두 종류의 문제를 남긴다. 하나는 이 세션이 스스로 "개수를 다섯 번
틀렸다"고 기록한 바로 그 패턴이 새 문서(`15_23_41/SUMMARY.md`)에서 한 칸(rationale_continuity
INFO 3→2, 합계 9→8) 다시 발생한 것이고, 다른 하나는 사후(`--impl-done`)에 발생한 13번째 코드
수정이 `review/**` 세 문서에는 상세히 기록됐으면서 정작 이 작업의 1차 사료인
`plan/complete/trigger-workflow-ref-canary.md` 에는 반영되지 않아 문서 간 권위가 역전된 것이다.
반면 요청받은 다른 모든 정량 주장(Warning 16 · INFO 22 · 코드 수정 12건 · self-spec 8→12 ·
e2e 라벨 20파일/132개)은 원본을 직접 세어 정확함을 확인했고, `harness-review-gate-followups.md`
의 "개수 서술 → 성격 목록" 전환도 완전하고 정확하다. 두 결함 모두 코드 동작이나 게이트 판정에는
영향이 없는 순수 문서 정합성 문제이며 수정 비용은 각각 한두 문장 수준이다.

## 위험도

MEDIUM — 코드·게이트에 미치는 실질 영향은 없으나(둘 다 `review/**`·`plan/**` 문서 내부
집계·완결성 문제), 이 프로젝트가 정량 서술의 정확성과 plan 문서의 완결성을 명시적 관례이자
반복 교훈으로 강조하는 만큼, 같은 세션 안에서 같은 유형의 오차가 재발했다는 점과 1차 사료가
2차 산출물(review/)보다 낡아졌다는 역전은 가볍게 볼 사안이 아니라고 판단해 LOW 대신 MEDIUM 으로
표기한다.
