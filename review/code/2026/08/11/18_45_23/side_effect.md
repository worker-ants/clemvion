# 부작용(Side Effect) Review

## 발견사항

- **[INFO]** `_named_in` 호출부는 정확히 3곳, 전부 같은 파일 안에서만 쓰인다 — 부수 피해 없음
  - 위치: `.claude/skills/consistency-checker/scripts/consistency_orchestrator.py:368`(tier 1, `branch_plan_text`), `:370`(tier 2, `plan_text`), `:575`(`_n_on_topic` 의 diff 스플라이스 경계 계산)
  - 상세: 저장소 전체에서 `grep -rn "_named_in"`을 돌려도 이 세 호출부 외 다른 소비자는 없다. `code-review-agents/scripts/` 쪽에 유사한 부분 문자열 매치 헬퍼도 없어, 이 프로젝트가 반복해서 겪은 "하드닝을 자매 함수에는 적용하지 않음" 패턴(다른 라운드에서 지적된 이력)이 이번 건에는 해당하지 않는다. 세 호출부 모두 `prioritize_bundle_files`의 티어 판정과 `_n_on_topic`의 on-topic 개수 산정이라는, 같은 "번들 우선순위" 의미 안에서 일관되게 영향을 받는다 — 의도된 전파다.
  - 제안: 없음(정보성).

- **[INFO — 핵심 실측]** 실 저장소로 옛 술어 vs 새 술어 판정 갈림을 전수 비교 — 갈린 3건 전부 정당한 오매치 제거였고, 정당한 언급이 함께 떨어진 사례는 없었다
  - 위치: `.claude/skills/consistency-checker/scripts/consistency_orchestrator.py:296`(`_named_in` 정의)
  - 상세: `branch_plan_text` = 현재 `plan/in-progress/**` 전 파일(32개, 409,815자) 연결, 비교 대상 = `spec/**` 전 파일(383개)로 옛 술어(`rel in plan_text or basename(rel) in plan_text`)와 새 술어(경계 고정)를 각 파일에 직접 실행해 대조했다. 판정이 갈린 파일은 **3개**뿐이며 전부 `old=True → new=False`(승격 취소) 방향이었다:
    - `spec/conventions/makeshop-api-catalog/shop.md` — plan 텍스트에 등장하는 것은 `5-makeshop.md`(전혀 다른 노드 spec 파일)이고, 그 안의 `shop.md` 접미부가 오매치된 것이었다. `shop.md` 자체는 어느 plan 에도 언급되지 않았다.
    - `spec/conventions/cafe24-api-catalog/order/cancellation.md` — plan 텍스트에 반복 등장하는 것은 `node-cancellation.md`(완전히 다른 컨벤션 문서, 여러 plan 에 `spec_impact` 로 등재)이고, 그 안의 `cancellation.md` 접미부가 오매치된 것이었다.
    - `spec/conventions/cafe24-api-catalog/store/currency.md` — plan 텍스트에 등장하는 것은 리뷰 산출물 경로 `review/code/.../concurrency.md`(동시성 관련 리뷰 리포트 **파일명**이지 spec 파일이 아님)이고, 그 안의 `currency.md` 접미부가 오매치된 것이었다.
    세 건 모두 `grep`으로 직접 원문을 대조해 "정당한 언급"이 아니라 부분 문자열 오매치였음을 확인했다. 즉 이번 저장소 스냅샷 기준으로는 **경계 고정으로 인해 정당한 언급까지 함께 떨어진 사례는 관측되지 않았다** — 옛 술어가 승격시켰던 3건이 전부 이 PR이 고치려던 결함 그 자체의 인스턴스였다.
  - 제안: 없음(측정 결과가 fix 의도와 일치함을 확인). 다만 이 결과는 "오늘의 저장소 스냅샷"에 한정된 실측이며, 향후 plan 문서가 늘어나면 다른 경계 케이스(예: 파일명이 정확히 다른 파일명의 접두/접미로 끝나는 새로운 조합)가 생길 수 있다는 점은 구조적으로 남아있다 — 다만 이는 이번 diff가 새로 만든 리스크가 아니라 경계 매칭 자체의 본질적 한계다.

- **[INFO]** 캐시·전역 상태·파일시스템·환경변수·네트워크에는 이 diff가 손대지 않는다
  - 위치: `.claude/skills/consistency-checker/scripts/consistency_orchestrator.py:292`-`293`(`_NAME_START`/`_NAME_END` 신설)
  - 상세: `_READ_CACHE`(라인 128 부근)는 diff 범위 밖이며 이번 변경과 무관하다. 새로 추가된 모듈 전역은 `_NAME_START`/`_NAME_END` 두 개의 불변 정규식 문자열 리터럴뿐으로, 실행 중 어디서도 재할당되지 않는다. 함수 시그니처(`_named_in(rel, plan_text)`)도 변경되지 않아 호출자 쪽 계약에 영향이 없다.
  - 제안: 없음.

- **[INFO]** 신규 테스트는 파일시스템 접근이 없고, 서브프로세스 격리 덕에 같은 파일의 다른 테스트(파일 원복 방식 프로브 포함)와 상태를 공유하지 않는다
  - 위치: `.claude/tests/test_consistency_bundle_priority.py:105`-`169`(`_SUBSTRING_TRAP` 및 `test_longer_name_does_not_promote_the_shorter_one` 외 3개)
  - 상세: 신규 테스트들은 `_prioritize()` → `run_in_orchestrator()`를 거치며, 이는 `subprocess.run([sys.executable, "-c", ...], cwd=REPO_ROOT)`로 **매 스니펫마다 새 프로세스**를 띄운다(`_harness.py:190`-`210` 확인). 신규 테스트가 넘기는 경로 문자열(`spec/conventions/cafe24-api-catalog/store.md` 등)은 `os.path.relpath` 기반 판정에만 쓰이고 실제 파일 존재를 요구하지 않으므로 디스크에 아무것도 만들거나 지우지 않는다. 같은 파일 안에 있는 `TheDocumentBeingEditedIsNeverOmittedTest`류(실제 spec 파일을 임시로 append 후 `shutil.copy`로 복원)와도 프로세스가 분리되어 있어 격리가 깨지지 않는다.
  - 제안: 없음.

## 요약

`_named_in`의 부분 문자열 매치를 경계 고정 매치로 바꾼 이번 변경의 부작용 표면은 좁고 명확하다 — 호출부는 같은 파일 안 3곳(티어 1/2 판정, `_n_on_topic` diff 스플라이스 경계)뿐이고 전부 "번들 우선순위"라는 동일 의미로 일관되게 전파되며, 다른 오케스트레이터에 대응하는 자매 함수가 없어 하드닝 누락형 부수피해 우려도 없다. 지시받은 대로 실 저장소(`spec/**` 383개, `plan/in-progress/**` 32개 전체 연결)에 옛/새 술어를 직접 실행해 대조한 결과 판정이 갈린 파일은 3개뿐이었고, 전부 `grep`으로 원문 대조해 확인한 바 정당한 언급이 아니라 다른 파일명(`5-makeshop.md`, `node-cancellation.md`, 리뷰 리포트 `concurrency.md`) 안에 우연히 포함된 접미부 오매치였다 — 즉 "정당한 언급까지 함께 떨어진" 콜래터럴 손실은 이번 스냅샷에서 관측되지 않았다. 캐시(`_READ_CACHE`)·시그니처·환경변수·파일시스템·네트워크는 diff 범위 밖이며, 신규 테스트는 서브프로세스 격리 덕에 파일 원복 방식의 다른 테스트와 상태를 공유하지 않는다.

## 위험도

LOW
STATUS: OK
