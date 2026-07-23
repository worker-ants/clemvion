# 유지보수성(Maintainability) 리뷰

## 발견사항

- **[INFO]** 스텁 `_Plan` 데이터클래스가 실제 `PlanDecision` 계약의 부분집합만 미러링
  - 위치: `.claude/tests/test_guard_review_before_push_main.py:96-118` (`_PLAN_STUB` 문자열, `_Plan` 클래스) vs `.claude/hooks/_lib/plan_guard.py:77-84` (`PlanDecision`)
  - 상세: 실제 `PlanDecision` 은 `untouched`, `complete_but_in_progress`, `reason`, `plan_path` 4개 필드를 갖지만, 테스트 스텁 `_Plan` 은 `untouched`/`reason`/`plan_path` 3개만 정의한다. 현재 `guard_review_before_push.py:main()` 이 `complete_but_in_progress` 를 전혀 읽지 않으므로 기능적으로는 문제없다. 다만 파일 상단 주석("They mimic the real return contract")이 실제로는 "main() 이 소비하는 부분집합만" 미러링한다는 사실보다 더 강하게 들려, 향후 `main()` 이 그 필드를 쓰도록 확장될 때 스텁 갱신 필요성을 놓치기 쉽다(다만 실패 시 `AttributeError` 로 fail-loud 하므로 실질 리스크는 낮음).
  - 제안: 주석을 "main() 이 실제로 읽는 필드만 미러링(`complete_but_in_progress` 는 의도적으로 생략)"으로 한 줄 보강하면 향후 계약 변경 시 어디를 봐야 하는지 명확해진다.

- **[INFO]** `_REVIEW_STUB`/`_PLAN_STUB` 두 트리플쿼트 문자열이 "import_error 가드 → dataclass 정의 → mode 분기 함수" 구조를 거의 동일하게 반복
  - 위치: `.claude/tests/test_guard_review_before_push_main.py:74-118`
  - 상세: 두 스텁이 필드 개수(2 vs 3)와 반환값만 다르고 골격(첫 줄의 `import_error` 조기 raise, `dataclass`, mode 문자열 분기)이 동일하다. 각각이 서로 다른 실제 게이트 모듈(`review_guard`/`plan_guard`)의 계약을 1:1로 대응시키는 픽스처라는 점에서 의도적 병렬 구조로 보이며, 공통 템플릿화(예: f-string 템플릿 생성 함수)는 오히려 "이 스텁이 어떤 실제 모듈을 흉내내는지" 가독성을 해칠 수 있어 지금 형태가 합리적인 트레이드오프다. 순수 정보 제공 차원의 관찰이며 수정을 권하지 않음.

## 요약

새로 추가된 `test_guard_review_before_push_main.py` 는 기존 `.claude/tests/` 컨벤션(예: `test_mermaid_lint_ready.py`, `test_reap_merged_worktrees.py`)과 동일한 "실제 훅을 임시 디렉토리에 복사 + env 구동 스텁 `_lib` 주입 + subprocess 실행" 패턴을 정확히 재사용하고 있어 일관성이 높다. 20개 테스트 메서드는 각각 2~10줄 수준으로 짧고 단일 책임(게이트 순서, bypass 격리, fail-open 3종, stdin 형태)만 검증하며 중첩·순환 복잡도 문제는 없다. `_PUSH` 상수 추출, `_run()` 의 keyword-only 파라미터, `# --- 섹션 ---` 구분 주석 등 네이밍·구조도 기존 파일들과 통일돼 있다. 실제 게이트 모듈(`review_guard.PlanDecision`/`ReviewDecision`)과 스텁 데이터클래스를 대조한 결과 `main()` 이 소비하는 필드는 정확히 일치하며, 발견된 사항은 스텁이 계약의 부분집합만 미러링한다는 점을 문서화하면 더 좋겠다는 INFO 수준 관찰 2건뿐이다. `plan/in-progress/harness-guard-followups.md` 변경은 체크박스 플립과 완료 메모 추가로 기존 plan 문서의 서술 관례를 그대로 따른다. 전반적으로 유지보수성 관점에서 우려할 사항이 없는 고품질 변경이다.

## 위험도
NONE
