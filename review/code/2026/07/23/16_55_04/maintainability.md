# 유지보수성(Maintainability) 리뷰

## 발견사항

- **[WARNING]** `main()` 뒤에 `if __name__ == "__main__": sys.exit(main())` 블록이 완전히 중복되어 남아 있음
  - 위치: `.claude/hooks/guard_review_before_push.py:491-496` (전체 파일 컨텍스트 기준)
  - 상세: diff 는 기존 `return 0` 자리(구 REVIEW/PLAN 인라인 게이트 코드가 있던 위치)를 `try/finally` 블록으로
    교체하면서, 그 바로 뒤에 새 `if __name__ == "__main__": sys.exit(main())` (491-492행) 를 **추가로 삽입**했다.
    그런데 파일 맨 끝에 원래 있던 동일한 `if __name__ == "__main__": sys.exit(main())` (495-496행) 는 diff 상
    변경 없는 컨텍스트 줄로 그대로 남아, 결과적으로 파일 하나에 완전히 동일한 엔트리포인트 가드가
    **두 번** 존재한다. 실제로 워크트리 파일을 직접 열어 확인함(위치 그대로 재현됨).
    런타임 동작은 무해하다 — 스크립트가 `__main__` 으로 실행되면 첫 블록의 `sys.exit(main())` 이
    `SystemExit` 을 발생시켜 프로세스가 즉시 종료되므로 두 번째 블록은 도달 불가능한 dead code 다.
    그러나 이는 명백히 diff 편집 과정의 실수(리팩터링 중 이동/삭제를 깜빡함)이며, 향후 누군가 한쪽만
    수정(예: 다른 진입 로직 추가)하고 다른 한쪽을 놓치는 drift 위험, 그리고 정적 분석 도구·리더에게
    혼란을 주는 순수 중복 코드다.
  - 제안: 495-496행(파일 끝의 구 블록) 또는 491-492행(새로 삽입된 블록) 중 하나를 제거해 `if __name__ ==
    "__main__": sys.exit(main())` 가 파일당 한 번만 존재하도록 정리. 머지 전 반드시 정리 권장.

- **[INFO]** `_run_gates()` 내 REVIEW/PLAN 두 게이트 처리 블록이 구조적으로 거의 동일하게 반복됨
  - 위치: `.claude/hooks/guard_review_before_push.py:438-451` (REVIEW) 와 `453-469` (PLAN)
  - 상세: "BYPASS 확인 → 모듈 None 체크(→ degraded.append) → try/evaluate_*()/except(→ degraded.append) →
    성공 판정 시 메시지 출력 + return 2" 라는 동일한 5단 골격이 게이트 이름·필드명(`blocked` vs
    `untouched`)·메시지 포맷만 바꿔 두 번 반복된다. 이 중복 자체는 이번 diff 가 새로 만든 것이 아니라
    (기존 `main()` 인라인 코드에 이미 있던 패턴을 `_run_gates()` 로 옮기면서 `degraded.append` 두 줄만
    대칭적으로 추가한 것) 기존 스타일을 그대로 유지한 것이라 감점 요인은 아니다. 다만 게이트 수가
    앞으로 하나라도 늘어난다면 공통 헬퍼(`_run_one_gate(name, bypass_env, evaluate_fn, is_bad_fn, msg,
    degraded)`)로 추출할 가치가 생긴다.
  - 제안: 지금 당장 추출할 필요는 없음(게이트 2개뿐이고, 이 저장소는 두 도메인이 구조적으로만 비슷하고
    의미상 다를 때 조기 추상화보다 명시적 중복을 선호하는 선례가 있음). 3번째 게이트가 추가되는
    시점에 재고 권장.

- **[INFO]** `_write_streak(streak, gates)` 의 매개변수명 `gates` 가 실제 의미(모든 게이트가 아니라 *실패
  개방된* 게이트 목록)를 정확히 드러내지 않음
  - 위치: `.claude/hooks/guard_review_before_push.py:381` (시그니처), 호출부 `404`
  - 상세: 호출 측 변수명은 일관되게 `degraded` 인데, 함수 내부 매개변수만 `gates` 로 바뀌어 "이 함수가
    전체 게이트 목록을 받는다"는 오해를 살 수 있다. 파일 전체가 `degraded` 라는 용어를 이 개념의
    SoT 로 쓰고 있어(`_run_gates`, `_report_fail_open`, `main()` 모두 `degraded` 사용) 이 지점만 명명이
    갈린다.
  - 제안: `gates` → `degraded_gates` 또는 `degraded` 로 통일.

- **[INFO]** `_report_fail_open()` 의 정상 판정 리셋 경로가 check-then-act(`os.path.exists` 후 `os.remove`)
  패턴
  - 위치: `.claude/hooks/guard_review_before_push.py:398-401`
  - 상세: `if os.path.exists(_state_path()): os.remove(_state_path())` 는 두 시스템콜 사이에 파일이
    사라지면(동시 실행) `FileNotFoundError` 를 던질 수 있는 TOCTOU 형태다. 이 함수 전체가 이미
    `try/except Exception: pass` 로 감싸여 있어(427-428행) 실제 판정에는 영향이 없고, 이 훅은 한 번의
    `git push` Bash 호출당 한 번만 동기 실행되므로 실질적 동시성 위험도 낮다. 다만 이 저장소가 그동안
    check-then-act/TOCTOU 를 반복적으로 지적·수정해온 이력(예: bootstrap mermaid 락, reaper stale-lock
    steal)을 감안하면, `try: os.remove(_state_path()) except FileNotFoundError: pass` 형태가 더 관용적이고
    일관적이다.
  - 제안: 필수는 아니나, 다음에 이 함수를 만질 때 `remove`-first 패턴으로 정리 권장.

## 요약

이번 변경은 fail-open 정책을 "조용한 폴백"에서 "관측 가능한 폴백"으로 바꾸는 리팩터링으로, `main()`
에 인라인돼 있던 REVIEW/PLAN 게이트 실행 로직을 `_run_gates()` 로 추출하고 `_report_fail_open()` /
`_read_streak()` / `_write_streak()` 로 책임을 분리해 오히려 `main()` 의 가독성과 SRP 를 개선했다.
네이밍·상수화(`_FAILOPEN_ESCALATE_AT`)·모듈 상단 정책 설명 주석·모든 관측 코드를 `try/except` 로
감싸 "관측이 관측 대상을 깨뜨리면 안 된다"는 설계 원칙을 코드로 강제한 점 등은 이 저장소의 기존
스타일(방어적 fail-open, 근거를 남기는 주석 문화)과 일관된다. 다만 diff 적용 과정에서 파일 끝에
`if __name__ == "__main__": sys.exit(main())` 가 완전히 중복 삽입된 결함이 실제 워크트리 파일에서
확인됐다 — 런타임 동작에는 영향이 없는 dead code 이지만 머지 전 정리가 필요한 diff 위생 문제다.
그 외에는 사소한 네이밍·TOCTOU 관용구 수준의 INFO 뿐이며, 새로 추가된 중복(REVIEW/PLAN 대칭 블록)도
기존 코드가 이미 갖고 있던 패턴을 그대로 옮긴 것이라 감점 요인이 아니다.

## 위험도

LOW
