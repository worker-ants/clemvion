# 보안(Security) 리뷰

## 발견사항

- **[INFO]** `git diff <ref>...HEAD` 구성 시 ref 문자열에 대한 형태 검증 없이 커맨드라인 인자로 그대로 전달 (git argument injection 방어 부재, defense-in-depth 관점)
  - 위치: `.claude/_shared/git_probe.py:248` (`branch_diff_files`) — `["diff", "--no-renames", "--name-only", f"{base_ref}...HEAD"]`
  - 위치: `.claude/skills/consistency-checker/scripts/consistency_orchestrator.py:400` (`_collect_code_diff`) — `cmd = ["git", "diff", f"{diff_base}...HEAD", "--"]`
  - 상세: `subprocess.run(...)` 을 리스트 인자로 호출해 `shell=True` 를 쓰지 않으므로 셸 인젝션은 없다. 다만 `base_ref`/`diff_base` 가 `-` 로 시작하는 값이면 git 이 이를 별도 옵션으로 해석할 수 있는 "argument injection" 여지가 이론적으로 남는다 (예: `-O<orderfile>` 류 옵션은 임의 파일을 읽어 diff 순서 지정에 사용). `git_probe.py:400` 쪽은 뒤에 `"--"` 를 붙여 pathspec 경계는 구분하지만, ref 문자열 자체는 `"--"` 이전에 위치해 여전히 옵션으로 해석될 수 있다. 현재 두 값 모두 CLI 인자(`--diff-base`)로 개발자/에이전트 자신이 넘기는 값이라 외부 공격자가 직접 통제하는 입력 경로는 확인되지 않아 실공격 가능성은 낮다.
  - 제안: ref 인자 앞에 `--` 를 두어 옵션 해석을 원천 차단(`["diff", "--no-renames", "--name-only", "--", f"{base_ref}...HEAD"]` 형태는 `...` 구문과 충돌하므로, 대신 `re.fullmatch(r"[A-Za-z0-9._/-]+", base_ref)` 같은 형태 검증을 진입점에서 한 번 거는 방식을 권장) — 필수는 아니나 harness 가 외부에서 받은 브랜치/ref 이름을 다루는 경로가 늘어날 경우를 대비한 방어 강화.

- **[INFO]** 예측 가능한 공유 임시 디렉터리 경로에 디버그 로그 고정
  - 위치: `.claude/skills/consistency-checker/scripts/consistency_orchestrator.py:55` — `DEBUG_LOG_FILE = "/tmp/consistency-checker-log.txt"`
  - 상세: `session.make_debug_logger` (`.claude/skills/code-review-agents/lib/session.py:14-26`) 는 `open(log_file_path, "a")` 로 append-open 하며 심볼릭 링크 여부를 확인하지 않는다. `/tmp` 는 통상 world-writable 공유 디렉터리이므로, 다중 사용자 환경에서 공격자가 이 경로에 사전에 심볼릭 링크를 심어두면 로그 쓰기가 의도치 않은 대상 파일에 append 되는 고전적 CWE-377(Insecure Temporary File) 패턴에 해당한다. 다만 이 harness 는 통상 단일 사용자 로컬 환경/1회성 CI 컨테이너에서 실행되므로 실질 위험도는 낮다.
  - 제안: 로그 경로를 사용자별로 구분(`tempfile.gettempdir()` + 사용자 식별자 조합)하거나, `os.open(path, os.O_APPEND | os.O_CREAT | os.O_WRONLY | os.O_NOFOLLOW, 0o600)` 로 열어 심볼릭 링크를 따라가지 않도록 강화. 급하지 않은 hardening 항목.

이 외에 검토한 항목 중 특이사항 없음:
- `git_probe.py` 의 모든 `subprocess.run` 호출은 리스트 인자 + `shell=True` 미사용으로 셸 인젝션 없음. `_run_git_raw` 의 예외 처리(`except (subprocess.TimeoutExpired, FileNotFoundError, OSError)`)는 의도적으로 좁게 유지되어 있고, 이는 docstring 이 설명하듯 guard 계층이 프로그래밍 오류를 "git 실패"로 오인해 fail-open/false-BLOCK 하는 것을 막기 위한 정당한 설계다.
- `_neutralize_sentinel` (`consistency_orchestrator.py:163-176`) 은 문서 본문이 내부 경계 sentinel 을 위조해 파일 경계를 조작(prompt-injection 유사 공격면)하는 것을 막는 방어 로직으로, 오히려 긍정적인 하드닝이다.
- `codebase/frontend/src/lib/docs/__tests__/spec-links.ts` 는 `fs.existsSync`/`fs.readFileSync` 로 저장소 내부 markdown 링크만 검사하는 빌드·테스트 시점 전용 유틸리티이며(운영 코드에서 import 되지 않음을 `grep` 으로 확인), 외부 입력을 받지 않아 경로 탐색·XSS 등 공격면이 없다. `decodeURIComponent` 는 try/catch 로 안전하게 감싸져 있다.
- `spec-plan-completion.test.ts` 의 `gray-matter` 사용은 저장소 내부 markdown frontmatter 파싱에 한정되며, 외부 입력을 처리하지 않는다.
- 세션/테스트 관련 파일(`session.py`, `test_*.py`, `plan-link-integrity.test.ts`) 에서 하드코딩된 시크릿, 인증/인가 로직, 암호화 로직은 발견되지 않았다(해당 관심사가 아닌 순수 개발 도구/테스트 코드).
- 에러 메시지는 모두 로컬 디버그 로그·stdout 으로만 노출되며, 외부에 응답으로 반환되는 API 성격의 코드가 아니므로 민감정보 노출 경로가 없다.

## 요약

이번 변경분은 프로덕션 애플리케이션 코드가 아니라 `.claude/` 내부 리뷰·일관성 검사 하네스(git probe 공용화, 세션 디렉터리 충돌 방지, 컨텍스트 예산·우선순위 로직)와 그에 대한 단위 테스트, 그리고 `codebase/frontend` 의 문서 링크 무결성 검사 테스트/유틸리티로 구성된다. SQL/XSS/커맨드 인젝션·인증 우회·하드코딩 시크릿·안전하지 않은 암호화 등 전형적인 OWASP Top 10 범주의 실질적 취약점은 발견되지 않았다. 유일하게 언급할 만한 항목은 (1) git ref 문자열을 별도 형태 검증 없이 `git diff` 커맨드라인 인자로 넘기는 부분과 (2) 공유 `/tmp` 경로에 고정된 디버그 로그 파일인데, 둘 다 신뢰 경계를 넘는 외부 공격자 입력 경로가 현재는 확인되지 않아 실질 익스플로잇 가능성은 낮은 defense-in-depth 성격의 지적이다.

## 위험도

LOW
