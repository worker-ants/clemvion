# 부작용(Side Effect) 리뷰

## 발견사항

- **[INFO]** `env = dict(os.environ)` 후 실제 하위 프로세스로 전체 상속 환경변수 전달
  - 위치: `.claude/tests/test_guard_review_before_push_main.py:144` (`_run` 메서드)
  - 상세: `subprocess.run(..., env=env)` 에 전달되는 `env` 는 `os.environ` 전체를 복사한 것이라 CI/로컬의 다른 환경변수(비밀값 포함 가능)가 하위 프로세스로 그대로 상속된다. 다만 이는 실제 harness 훅 호출(`subprocess` 로 자식 프로세스를 띄우는 것) 방식을 그대로 재현하는 의도된 설계이고, `os.environ` 자체(호출 프로세스의 실제 환경)는 변경되지 않는다(복사본만 조작). `BYPASS_REVIEW_GUARD`/`BYPASS_PLAN_GUARD` 는 명시적으로 `env.pop(...)` 후 필요할 때만 재설정해 "부모 셸의 우회 설정이 새어 들어오는 것"을 스스로 방지하는 좋은 패턴이다.
  - 제안: 조치 불필요. 의도된 격리이며 실제 프로세스 환경을 오염시키지 않는다.

- **[INFO]** `import _harness` 가 모듈 임포트 시점에 `sys.path` 를 전역으로 변경
  - 위치: `.claude/tests/_harness.py:29-30` (`sys.path.insert(0, str(HOOKS_DIR))`), 신규 파일에서 `import _harness` 로 트리거(`test_guard_review_before_push_main.py:66`)
  - 상세: `_harness` 는 이 diff 가 도입한 파일이 아니라 기존 공유 harness 모듈이며, 이미 다른 `.claude/tests/*.py` 파일들이 동일하게 사용 중인 확립된 패턴이다(`if str(HOOKS_DIR) not in sys.path` 가드로 중복 삽입 방지). 신규 테스트가 실제 gate 모듈(`review_guard`/`plan_guard`)을 이 sys.path 를 통해 로드하는 것이 아니라, 훅을 임시 디렉토리에 **복사**하고 그 옆에 **스텁 `_lib/`** 를 둔 뒤 **별도 subprocess** 로 실행하므로, `sys.modules` 캐시 충돌(다른 테스트 파일이 진짜 `review_guard`/`plan_guard` 를 이미 임포트해뒀을 경우의 이름 충돌) 우려가 없다 — 훅은 완전히 새 인터프리터 프로세스에서 실행되기 때문. 격리 설계가 견고하다.
  - 제안: 조치 불필요.

- **[INFO]** 임시 디렉토리/파일 생성은 있으나 `addCleanup` 으로 회수 보장
  - 위치: `.claude/tests/test_guard_review_before_push_main.py:125-134` (`setUp`)
  - 상세: `tempfile.mkdtemp()` 직후 바로 `self.addCleanup(shutil.rmtree, self.tmp, ignore_errors=True)` 를 등록해, 이후 `os.makedirs`/`shutil.copy`/파일 쓰기 중 예외가 나거나 개별 테스트가 실패해도 임시 트리는 회수된다. 실제 저장소 파일(`HOOK_SRC` = 진짜 훅)은 읽기만 하고 복사본만 수정하므로 원본에 대한 부작용 없음.
  - 제안: 조치 불필요.

- **[INFO]** subprocess 로 실제 `git push` 를 실행하지 않음(안전성 확인)
  - 위치: `.claude/tests/test_guard_review_before_push_main.py:120` (`_PUSH = "git push origin HEAD"`), `.claude/hooks/guard_review_before_push.py:115-148` (`main()`)
  - 상세: 실제 훅(`guard_review_before_push.py`)을 직접 읽어 확인한 결과, `main()` 은 stdin JSON 의 `command` 문자열에 대해 정규식 매칭(`_is_git_push`)만 수행하고 그 문자열을 셸에서 실행하지 않는다(PreToolUse 훅은 allow/block 판정만 반환, 실제 명령 실행은 harness 의 다른 레이어가 담당). 따라서 이 테스트가 "git push origin HEAD" 를 payload 로 주입해도 실제 네트워크 push 나 git 상태 변경은 발생하지 않는다.
  - 제안: 조치 불필요(오히려 확인 가치가 있어 기록).

- **[INFO]** `plan/in-progress/harness-guard-followups.md` 변경은 체크박스 플립 + 완료 서술 추가뿐
  - 위치: `plan/in-progress/harness-guard-followups.md:143-147` 대응 diff
  - 상세: 순수 문서 변경으로 코드 실행 경로에 영향 없음. 부작용 관점에서 검토 대상 아님.

## 요약

이번 변경은 신규 e2e 테스트 파일 1개(`test_guard_review_before_push_main.py`)와 plan 문서 갱신 1건으로 구성되며, 실 코드(훅)의 시그니처·인터페이스·전역 상태를 전혀 변경하지 않는 순수 추가(additive) 테스트다. 테스트는 실제 훅 파일을 임시 디렉토리에 복사하고 스텁 `_lib` 를 병치한 뒤 별도 subprocess 로 실행하는 방식으로 격리를 확보했고, `tempfile`/`addCleanup` 으로 파일시스템 정리도 보장되며, 환경변수는 `os.environ` 복사본만 조작해 실제 프로세스 환경에 영향을 주지 않는다. 실제 훅 소스를 직접 대조 확인한 결과 `git push` 문자열은 판정용 입력일 뿐 실행되지 않아 의도치 않은 네트워크/git 부작용 위험도 없다. 발견된 항목은 모두 INFO 수준이며 차단 사유가 될 CRITICAL/WARNING 은 없다.

## 위험도

NONE
