# 변경 범위(Scope) Review — commit `30943e8c8` + `e94230233`(1R fix) + `da3394254`(2R fix)

## 전제 확인

`git diff --stat origin/main...HEAD` 로 실제 커밋 3개(누적 42개 파일)를 프롬프트의 "리뷰 대상
파일" 목록과 전수 대조 — **정확히 일치**한다. 프롬프트 밖에 숨겨진 변경 파일은 없다.

이 diff 는 단일 plan 항목("frontend 테스트가 어떤 게이트에서도 타입체크되지 않는다",
`plan/in-progress/harness-review-gate-followups.md`)을 닫는 작업 세션 전체다 — 원 구현
(`30943e8c8`) + 그 구현에 대한 `/ai-review` 1라운드 CRITICAL/WARNING fix(`e94230233`) + 2라운드
WARNING fix(`da3394254`). 세 커밋 모두 `Co-Authored-By` 헤더로 동일 세션임이 확인되고,
`git show --stat` 대조 결과 각 fix 커밋이 건드린 파일은 그 커밋 메시지가 서술하는 발견사항과
**1:1로 정확히 대응**한다 — fix 커밋에 발견사항과 무관한 파일이 섞여 있지 않다.

이 PR 자체에 대한 scope 리뷰는 이번이 세 번째다(1R `review/code/2026/09/02/11_27_26/scope.md`,
2R 은 route 로 스킵됐는지 3R 산출물 목록에 `15_04_04/scope.md` 없음 — 실제로 2R SUMMARY 의
에이전트별 위험도 표에 `scope` 행이 없다). 1R scope 리뷰가 이미 핵심 두 쟁점(backend 공유 코어
리팩터, `jest-axe.d.ts` 수정)을 심층 분석해 "요청보다 넓어 보이지만 이 게이트가 동작하기 위한
선행조건" 으로 판정했고, 이번 3R 에서 그 판정에 영향을 줄 새로운 사실은 없다(코드 재확인 결과
동일 결론).

## 발견사항

- **[INFO]** `check-backend-typecheck-ratchet.py` 를 공유 코어(`scripts/_typecheck_ratchet.py`)로
  리팩터 — plan 항목의 직접 요구("frontend 게이트 신설")를 기술적으로 넘어선다
  - 위치: `scripts/check-backend-typecheck-ratchet.py`(199줄 삭제), `scripts/_typecheck_ratchet.py`(신규 230줄)
  - 상세: 1R scope 리뷰가 이미 지적하고 조치 불요로 판정한 항목과 동일하다. 이번 3R 에서 재확인한
    근거: `_typecheck_ratchet.py` 모듈 docstring 과 커밋 메시지 양쪽이 `plan_guard.py` ↔
    `plan-stale-audit.sh` drift 선례를 구체적으로 인용하며, backend ratchet 이 리팩터 후에도
    `199/38` 로 무회귀임을 검증(commit 메시지 명시)했다. "복사 후 갈라지는" 대안보다 방어적인
    선택이며, 신규 게이트가 요구하는 판정 규칙과 완전히 동일한 로직이라 별도 사본을 만드는 것이
    오히려 이 저장소가 반복적으로 겪은 실패 클래스를 재생산한다.
  - 제안: 조치 불요(1R 판정 유지). revert 단위 추적을 위해 plan 항목에 "backend 엔트리포인트도
    함께 리팩토링" 을 명시했으면 더 좋았을 것이라는 1R 의 제언은 여전히 유효하다.

- **[INFO]** `jest-axe.d.ts` shadowing 버그 수정(`vitest-matchers.d.ts` 분리)이 plan 항목과
  표면적으로 무관해 보이는 파일에 포함
  - 위치: `codebase/frontend/src/test/jest-axe.d.ts`(19줄 삭제), `codebase/frontend/src/test/vitest-matchers.d.ts`(신규)
  - 상세: 1R scope 리뷰의 판정을 재확인 — 이 수정 없이는 신설 ratchet 의 첫 baseline 이
    1,414건(그중 1,256건 phantom)으로 잡혀 게이트가 무의미해지므로, "게이트를 신설하기 위한
    전제조건" 이지 무관한 drive-by 가 아니다. 커밋 메시지에 뮤테이션 검증(`import "vitest"` 제거
    시 1,414 복귀)까지 남아 있다.
  - 제안: 조치 불요.

- **[INFO]** `test_workflow_run_inputs_covered.py` 신설(2R, 135줄) — 요청 범위는 "1R CRITICAL 을
  손으로 고친 지점의 재발 방지" 인데, 결과물은 이 저장소 **모든** `changes` 잡 보유 워크플로를
  순회하는 일반 가드다
  - 위치: `.claude/tests/test_workflow_run_inputs_covered.py`(신규 파일 전체)
  - 상세: 2R 리뷰가 "1R 은 인스턴스만 고쳤다" 를 WARNING 으로 지적했고, 그 제안이 정확히
    "클래스를 닫아라" 였다 — 즉 이 확장은 리뷰어의 명시적 요청에 대한 직접 응답이며, 임의로
    확장한 기능이 아니다. 대상 워크플로를 이름으로 나열하지 않고 `changes` 잡의 존재로 판별하는
    설계도 "새 워크플로가 조용히 빠진다" 는 이 저장소의 반복된 실패 클래스(`README.md` 서술,
    `test_harness_checks_paths_coverage.py` 등)를 따른 것이라 over-engineering 이 아니라 기존
    관례의 일관된 적용이다. `.claude/tests/test_review_guard_hardening.py` 에 이 신규 테스트의
    "왜 실 저장소를 쓰는가" 등재 항목이 추가된 것도 하네스 자체의 기존 가드 요구에 부응한
    필연적 동반 변경이다(부수 발견으로 커밋 메시지에 명시).
  - 제안: 조치 불요.

- **[INFO]** 이전 두 리뷰 라운드의 전체 산출물(`review/code/2026/09/02/11_27_26/**`,
  `review/code/2026/09/02/15_04_04/**`, 총 25개 파일 — SUMMARY/RESOLUTION/agent 리포트/meta.json/
  `_retry_state.json`)이 이번 diff 안에 그대로 포함
  - 위치: `review/code/2026/09/02/11_27_26/*`, `review/code/2026/09/02/15_04_04/*`
  - 상세: `_retry_state.json` 커밋 포함까지 이 저장소의 기존 관례(`review/code/2026/08/20/**` 등
    다수 선례 확인)와 정확히 일치하고, CLAUDE.md 의 "코드 리뷰 산출물" 저장 위치 규약과도
    부합한다. 새로운 종류의 변경이 아니라 developer SKILL 이 강제하는 구현→리뷰→fix 사이클의
    표준 산출물이다.
  - 제안: 조치 불요.

포맷팅-only 변경, 미사용 임포트, 무관한 주석/설정 변경, plan 항목과 무관한 코드 영역 수정은
발견되지 않았다. 세 커밋 각각의 `git show --stat` 이 커밋 메시지가 서술하는 발견사항 목록과
파일 단위로 정확히 일치해, 리뷰 사이클 중 의도치 않은 변경이 섞여 들어갔을 가능성은 낮다.

## 요약

`30943e8c8`(원 구현) + `e94230233`(1R fix) + `da3394254`(2R fix) 3개 커밋 42개 변경 파일 전부가
plan 항목 "frontend 테스트가 어떤 게이트에서도 타입체크되지 않는다" 하나로 수렴한다. `git diff
--stat` 대조 결과 프롬프트 밖의 은닉 변경은 없고, 각 fix 커밋은 자신의 커밋 메시지가 서술하는
리뷰 발견사항과 파일 단위로 정확히 일치해 리뷰-fix 사이클 특유의 "김에 다른 것도 손대기" 가
없음을 확인했다. backend 공유 코어 리팩터·`jest-axe.d.ts` 버그 수정·`test_workflow_run_inputs_
covered.py` 신설은 표면적으로는 요청 범위보다 넓어 보이지만, 셋 다 (a) 신규 게이트가 정확히
동작하기 위한 선행조건이거나 (b) 이전 리뷰 라운드의 명시적 제안에 대한 직접 응답이며, 실측·
뮤테이션 검증이 커밋 메시지에 남아 근거가 추적 가능하다. 이전 두 리뷰 라운드 산출물이 diff 에
그대로 포함된 것은 이 저장소의 기존 관례(review 산출물 커밋)와 일치해 별도 지적 사항이 아니다.

## 위험도

NONE
