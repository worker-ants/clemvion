# 문서화(Documentation) 리뷰

## 조사 방법

이번 변경(`.claude/commands/ai-review.md`, `.claude/skills/code-review-agents/{README.md,SKILL.md,scripts/code_review_orchestrator.py}`, `.claude/tests/{README.md,test_review_prepare_single_session.py}`, `plan/in-progress/harness-review-gate-followups.md`)의 핵심은 "`--prepare` 는 세션을 하나만 만든다"는 사실을 stdout 소비 계약(`stdout 마지막 줄 = 세션 디렉토리`) 문서에 재정합시키는 것이다. 지시에 따라 이 계약을 서술하는 자리가 저장소에 더 없는지 `grep -rn` 으로 전수 조사했다(`stdout 마지막 줄`, `session_dir per stdout`, `배치.*줄씩`, `split.*session`, `batch` 축). 대상: `.claude/commands/*.md`, `.claude/skills/**/SKILL.md`, `.claude/skills/**/README.md`, `.claude/skills/**/*.py`, `.claude/docs/*.md`, `.claude/agents/*.md`, `.claude/tests/*.py`, `PROJECT.md`.

결과: 같은 문구("stdout 마지막 줄 = 세션 디렉토리")를 쓰는 곳이 `merge-coordinate.md`/`merge_coordinator_orchestrator.py`, `consistency-check.md`/`consistency_orchestrator.py`, `spec-coverage/SKILL.md`/`spec_coverage_orchestrator.py` 에도 있지만, 세 스크립트 모두 `print(session_dir)` 단일 호출뿐 배치 루프가 없어(실측: `grep -n "BATCH_SIZE\|print(session_dir)" .claude/skills/{consistency-checker,merge-coordinator,spec-coverage}/scripts/*.py` → 각 1건) 드리프트 위험이 구조적으로 없다. 반면 아래 두 곳은 **이번 changeset 의 리뷰 대상 파일 안에 있으면서도** 갱신되지 않은 실질 드리프트다.

## 발견사항

- **[WARNING]** `.claude/tests/README.md` 의 `test_review_session_dir_collision.py` 항목이 이번 changeset 이 방금 닫은 바로 그 "미해결 절반"을 여전히 열려 있다고 서술한다.
  - 위치: `.claude/tests/README.md:83` (`test_review_session_dir_collision.py` 행 마지막 문장 — "Does **not** cover the second half of the defect: `SKILL.md` contracts \"stdout's last line is the session dir\", so the first batch is still never reviewed; that is registered as an open item in `harness-review-gate-followups.md`.")
  - 상세: 이 문장은 "`--prepare` 가 배치를 나눠도 첫 배치는 영원히 리뷰되지 않는다"는 결함의 절반이 `harness-review-gate-followups.md` 에 **미해결 항목으로 등록돼 있다**고 못 박는다. 그런데 바로 이 changeset 이 (1) `code_review_orchestrator.py` 의 배치 분할 루프를 완전히 제거했고(`main()`: 이제 `prepare_session(change_infos, config)` 단일 호출, `print(session_dir)` 단일 print), (2) `plan/in-progress/harness-review-gate-followups.md` 에서 정확히 그 항목을 `- [x] **배치 2개 이상이면 첫 배치는 여전히 리뷰되지 않는다 — 처분 완료 (2026-08-10).**`로 종결시켰다(리뷰 대상 파일 7, diff 게이트 523). 즉 "registered as an open item" 라는 주장은 이제 거짓이고, "첫 배치는 여전히 리뷰되지 않는다"도 이제 거짓이다(배치 자체가 없다). 더 나쁜 점은 바로 위 줄(README.md:81, 이번 changeset 이 새로 추가한 `test_review_prepare_single_session.py` 행)이 이 결함을 정확히 고쳤다고 서술하고 있어서, 같은 파일 안에서 **인접한 두 행이 서로 모순**된다 — 81행 "픽스는 끝났다" vs 83행 "이 절반은 아직 안 끝났고 open item 이다". 이 README 는 `.claude/tests/` 의 정본 인덱스라 향후 독자가 83행만 보고 "session_dir_collision 테스트가 여전히 배치 첫 조각 미검토 갭을 안고 있다"고 오판할 수 있다. 이번 changeset 의 diff 자체가 이 파일을 건드리고 있으므로(파일 5, meta.json 포함) 이 문장을 놓친 것은 "압축 과정의 드리프트"와 동일 클래스의 재발이다.
  - 제안: 83행 마지막 문장을 갱신 — 예: "Does **not** cover the second half of the defect on its own; that half (first batch never reviewed) is now closed separately by removing the batch split entirely — see `test_review_prepare_single_session.py` above and `harness-review-gate-followups.md`(처분 완료, 2026-08-10)." 또는 그냥 그 문장을 삭제(81행 서술과 중복이 되므로).

- **[INFO]** "디버그 로그" 섹션이 이제는 발생하지 않는 이벤트("batch 분할")를 여전히 로깅 대상으로 나열한다.
  - 위치: `.claude/skills/code-review-agents/README.md:240` ("orchestrator 가 `/tmp/code-review-agents-log.txt` 에 prepare 단계의 이벤트(파일 수집, prompt 사이즈, batch 분할) 를 기록한다.")
  - 상세: 이 문장의 "batch 분할"은 예전 `main()` 배치 루프의 `print(f"--- Batch {batch_idx}/{len(batches)} …")`(stderr, 커밋 `193d43fc5` 이전 코드)를 가리켰던 것으로 보인다(`git show 193d43fc5^:...code_review_orchestrator.py` 로 확인). 이번 changeset 이 그 루프 자체를 제거했으므로 더 이상 "batch 분할" 이벤트가 로깅될 여지가 없다(`debug_log` 호출 전수를 grep 해도 batch 관련 호출 없음). 기능 결함은 아니고(로그 파일 경로·존재 자체는 여전히 맞음), 단지 나열된 이벤트 종류 중 하나가 사라진 기능을 계속 가리키는 사소한 텍스트 드리프트다.
  - 제안: "(파일 수집, prompt 사이즈)"로 줄이거나, "대형 changeset 안내"로 교체.

## 이번 changeset 자체의 문서화 품질 (긍정 평가)

- `code_review_orchestrator.py` 모듈 docstring(게이트 10-14), `_warn_large_changeset` docstring, `main()` 인라인 주석이 모두 "왜 배치를 없앴는가"의 근거(측정치 7→2, 원인 커밋 `3446d0d57`/`73dea0864`)를 정확히 담고 있고 코드 동작과 일치한다.
- `.claude/skills/code-review-agents/SKILL.md:40`(`REVIEW_BATCH_SIZE` 인용구 갱신), `:199`(옵션 표), `.claude/skills/code-review-agents/README.md:231`(동일 표), `.claude/commands/ai-review.md:14` 는 서로 문구까지 정합하게 갱신됐다.
- `.claude/tests/README.md:81`(`test_review_prepare_single_session.py` 신규 행)과 `.claude/tests/test_review_prepare_single_session.py` 모듈 docstring 은 결함의 두 측(디스크 소실 vs 소비 계약 유실, 증폭 경로)을 정확히 서술하며 코드(테스트 클래스 이름 `ForcedSetShrinksWithTheChangesetTest` 등)와 부합한다.
- `plan/in-progress/harness-review-gate-followups.md` 는 원문을 삭제하지 않고 `[~] _(원문 — 위 처분의 근거로 보존)_` 로 보존한 뒤 처분을 별도 블록으로 추가하는 방식을 취해, 이 저장소의 "plan 서술은 근거와 함께" 관행을 잘 따른다. CHANGELOG 파일은 이 저장소에 없고 plan 문서가 그 역할을 겸하므로 별도 CHANGELOG 갱신 필요는 없다.
- README/API 문서/예제 코드 신규 요구는 없다 — 이번 변경은 내부 harness CLI 계약 문서 정정이며 사용자 대상 기능 변경이 아니다.

## 요약

이번 changeset 은 "stdout 마지막 줄" 계약이 압축 커밋에서 드리프트한 근본 원인을 정확히 진단하고 code_review_orchestrator.py/SKILL.md/README.md/ai-review.md/plan 문서를 서로 정합하게 갱신했다. 다만 같은 계약(같은 결함)을 서술하는 자리가 저장소에 하나 더 있었다 — `.claude/tests/README.md:83` 의 `test_review_session_dir_collision.py` 항목이 "첫 배치는 여전히 리뷰되지 않으며 그 절반은 `harness-review-gate-followups.md` 에 미해결로 등록돼 있다"고 여전히 주장하는데, 이는 이번 changeset 이 방금 닫은 사실과 정면으로 모순되고, 같은 파일 바로 위 행(81행)의 새 서술과도 충돌한다. merge-coordinator/consistency-checker/spec-coverage 세 자매 오케스트레이터의 동일 문구는 배치 루프 자체가 없어 구조적으로 안전함을 확인했다. 이 WARNING 하나를 제외하면 문서-코드 정합성은 양호하다.

## 위험도

MEDIUM
