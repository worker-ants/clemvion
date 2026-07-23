# 변경 범위(Scope) 리뷰

## 발견사항

- **[WARNING]** `if __name__ == "__main__": sys.exit(main())` 블록이 파일 끝에 중복으로 남음
  - 위치: `.claude/hooks/guard_review_before_push.py` 491-496행 (전체 파일 컨텍스트 게이트 기준)
  - 상세: diff 마지막 hunk 를 보면, 기존 `main()` 본문(REVIEW/PLAN 인라인 게이트)을
    `_run_gates()`+`finally: _report_fail_open(...)` 로 교체하면서 새 `if __name__ == "__main__":
    sys.exit(main())` 블록(491-492행)을 **추가**했는데, 원래 파일 끝에 이미 있던 동일한
    `if __name__ == "__main__": sys.exit(main())` 블록(495-496행, diff 상 컨텍스트 라인이라
    `-` 로 지워지지 않고 그대로 남음)을 제거하지 않아 같은 파일에 동일 guard 가 두 번
    존재하게 됐다. 실제 병합 결과 파일(`tail -30 .claude/hooks/guard_review_before_push.py`)로
    직접 확인함 — 491행과 495행에 각각 `if __name__ == "__main__":` 가 있다.
    기능적으로는 무해하다(첫 번째 블록에서 `sys.exit()` 이 `SystemExit` 을 던지며 프로세스가
    바로 종료되므로 두 번째 블록은 절대 실행되지 않는 dead code). 하지만 이번 변경(§E
    fail-open observability)의 의도된 범위에는 없는, patch 적용 과정에서 생긴 잔여물이며
    정리되지 않은 채 커밋(`ed6332650`)에 그대로 들어갔다.
  - 제안: 495-496행의 중복 guard 블록을 제거해 파일 끝에 `if __name__ == "__main__":
    sys.exit(main())` 하나만 남긴다. 동작 변화는 없으므로 기존 테스트에는 영향 없음.

## 그 외 점검 결과 (문제 없음)

- **의도 이상의 변경 / 무관한 수정**: 커밋(`ed6332650`)은 정확히 3개 파일만 건드리며, 각각
  plan(`harness-guard-followups.md` §E)이 명시한 정책 결정("fail-open 유지 + 관측 가능하게",
  "연속 N회 fail-open 시 경고")과 1:1로 대응한다. hook 파일 안에서도 diff 는 파일 하단
  (351행 이후 신규 함수 + `main()` 본문)에만 국한되고, 상단 docstring·정규식 판정 로직
  (`_GIT_PUSH`, `_redact_inert_text` 등, ② 작업 소관)은 전혀 건드리지 않음.
- **불필요한 리팩토링**: `main()` 을 `_run_gates()` 로 쪼갠 것은 리팩토링이지만, `finally` 로
  양쪽 게이트 결과를 항상 보고해야 한다는 요구사항(차단 경로에서도 보고)을 만족하려면
  게이트 실행과 반환값을 분리해야 하므로 기능 요구사항에 종속된 필수 구조 변경이다.
  임의의 코드 정리가 아님.
- **기능 확장(over-engineering)**: 에스컬레이션 임계값(`_FAILOPEN_ESCALATE_AT = 3`), 연속
  streak 파일, 정상 판정 시 리셋 — 전부 plan 의 사용자 결정 문구("3안", "연속 N회 fail-open
  시 경고")를 그대로 구현한 것이며 그 이상의 기능(예: 알림 채널 연동, 설정 가능한 임계값
  노출 등)은 추가하지 않았다.
- **포맷팅/주석/임포트/설정 변경**: 무관한 포맷팅 변경 없음. 새로 추가된 주석은 모두
  fail-open 관측 기능 자체의 설계 근거(왜 try/except 로 감싸는지, 왜 BYPASS 는 degraded 가
  아닌지)를 설명하는 것으로 기능과 결합되어 있다. 임포트 변경 없음(`json`/`os`/`traceback`
  모두 기존 임포트 재사용). 설정 파일 변경 없음 — `.claude/state/` 는 이미 `.gitignore` 에
  등재된 런타임 상태 디렉토리이며 신규 설정 항목이 아니다.
- **테스트 파일의 `CLAUDE_PROJECT_DIR` 격리 추가**: plan 의 "부수" 항목으로 명시적으로
  문서화됐고, 신규 fail-open 테스트가 실제 저장소 `.claude/state/` 를 오염시키는 것을 막기
  위해 필요한 최소 변경이다. 기존 테스트 동작에는 영향 없음(임시 디렉토리를 가리키도록
  env 변수를 추가했을 뿐).
- **plan 문서 갱신**: `plan/in-progress/harness-guard-followups.md` §E 에 사용자 결정과
  구현 요약을 기록한 것은 프로젝트 관례(plan-lifecycle)상 요구되는 동반 갱신이며, 코드
  변경 범위와 무관한 내용은 없다.

## 요약

세 파일(`guard_review_before_push.py`, `test_guard_review_before_push_main.py`,
`plan/in-progress/harness-guard-followups.md`) 모두 plan §E 가 명시한 "fail-open 유지 +
관측 가능하게" 정책을 구현하는 데 정확히 필요한 범위 안에 있다. 무관한 리팩토링·기능
확장·포맷팅 변경은 없다. 다만 hook 파일 끝에 `if __name__ == "__main__": sys.exit(main())`
블록이 새로 추가된 것과 기존 것이 제거되지 않고 함께 남아 중복된 상태로 커밋됐다 —
기능적으로는 무해한 dead code 이지만 diff 정리 미흡으로 발생한, 의도되지 않은 잔여물이므로
정리가 필요하다.

## 위험도

LOW
