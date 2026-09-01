# 변경 범위(Scope) 리뷰 — retry-ie-residuals-c4a1b2

## 발견사항

- **[INFO]** 하나의 changeset 에 세 가지 독립적인 결함 처방(성공 retry `error` 잔류 정리 · 원자 consume SQL 미검증 하드닝 · 취소 마킹 실패 시 오분류 방지) + 두 건의 리팩터(`markSpawnedRowFailed` 추출, `finalizeGuarded`/`prepareSuccessTermination` JSDoc 정비) + 엔티티 타입 정정(`Execution.error`)이 함께 묶여 있다.
  - 위치: `codebase/backend/src/modules/execution-engine/retry-turn.service.ts` (`markSpawnedRowFailed` 신설부·`prepareSuccessTermination` 신설부), `codebase/backend/src/modules/execution-engine/ai-turn-orchestrator.service.ts` (409~432행 try/catch), `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` (4308~4322행 반환값 소비), `codebase/backend/src/modules/executions/entities/execution.entity.ts` (81행)
  - 상세: 각 항목은 `plan/in-progress/ie-resume-turn-boundary-cancel.md`(31~45행 "C-4 처분" 표, 533~563행 체크박스)와 `plan/in-progress/retry-turn-terminal-guard.md`(62~76행 "C-4 처분" 표, 181행·219행·242행·250행·336행·425행 체크박스)에 각각 명시적으로 등재·체크된 항목이라 "요청 범위 이탈"은 아니다. 다만 diff 표면적으로는 서로 다른 세 파일의 서로 다른 결함군이 한 커밋에 들어가 있어, 향후 revert/bisect 단위가 굵어진다는 점은 기록해 둔다.
  - 제안: 조치 불요(각 항목이 plan 체크리스트로 추적됨). 다음에 유사 disposal 라운드를 진행할 때는 기능 결함 그룹과 순수 리팩터 그룹을 별도 커밋으로 쪼개는 편이 bisect 에 유리하다는 점만 참고.

- **[INFO]** 이번 diff 는 직전 리뷰 세션 산출물 전체(`review/code/2026/09/01/17_55_50/` 하위 14개 파일 — `RESOLUTION.md`·`SUMMARY.md`·`_retry_state.json`·`meta.json`·리뷰어별 `*.md` 13종)를 새 파일로 함께 커밋한다.
  - 위치: `review/code/2026/09/01/17_55_50/*` (파일 12~25)
  - 상세: `CLAUDE.md` 의 "코드 리뷰 산출물 → `review/code/<YYYY>/<MM>/<DD>/<hh>_<mm>_<ss>/`" 규약과 일치하는 정상 보관 위치이며, `RESOLUTION.md` 가 그 라운드의 WARNING 5건에 대한 조치 근거로 직접 참조된다. 코드 변경과 무관한 별개 파일 묶음이지만 "리뷰 라운드 종결 → 다음 코드 커밋에 산출물 동봉" 은 이 저장소의 표준 워크플로이므로 무관한 수정으로 보지 않는다.
  - 제안: 조치 불요.

- **[INFO]** `plan/in-progress/ie-resume-turn-boundary-cancel.md:3`·`plan/in-progress/retry-turn-terminal-guard.md:3` 의 `worktree:` frontmatter 값을 현재 worktree 명(`retry-ie-residuals-c4a1b2`)으로 갱신했다.
  - 위치: `plan/in-progress/ie-resume-turn-boundary-cancel.md:3-6`, `plan/in-progress/retry-turn-terminal-guard.md:3-5`
  - 상세: 코드 결함 처방과 직접 관련은 없지만, 인접 주석이 "머지된 옛 worktree 값을 두면 `plan_guard` 가 이 plan 을 P1 코드 push 의 연결 plan 으로 인식하지 못해 무장 해제된다"고 명시하는 절차적 필수 변경이다. 무관한 수정이 아니라 이번 push 자체를 가능하게 하는 선행 조건.
  - 제안: 조치 불요.

## 요약
코드 변경(파일 2~9)은 전량 `plan/in-progress/ie-resume-turn-boundary-cancel.md`·`plan/in-progress/retry-turn-terminal-guard.md` 의 "C-4 처분" 표와 체크박스 항목에 1:1로 대응되며, `CHANGELOG.md` 신규 항목도 같은 세 가지 사용자-관측 가능 결함(성공 retry `error` 잔류·중복 spawn 가드 무방비·취소 오분류)만 서술한다. 임포트·포맷팅·주석의 의미 없는 변경이나 요청 범위 밖 파일 수정, 요청하지 않은 기능 확장은 발견되지 않았다. 리뷰 세션 산출물 전체 커밋과 plan frontmatter 갱신은 코드 결함 처방과 별개 축이지만 둘 다 저장소의 표준 절차(리뷰 산출물 보관 위치, plan_guard 무장 요건)에 부합해 "무관한 수정"으로 분류하지 않았다. 여러 개별 항목을 한 커밋에 번들링한 점만 참고용 INFO 로 남긴다.

## 위험도
NONE
