### 발견사항

- **[WARNING]** `--impl-done` 의 diff 삽입 경로가 이번 PR 에서 새로 도입한 `_neutralize_sentinel` 경계-위조 방어를 우회한다 (PoC 로 실측 확인)
  - 위치: `.claude/skills/consistency-checker/scripts/consistency_orchestrator.py:584-598` (`collect_context`의 `--impl-done` 분기: `diff_text = _collect_code_diff(diff_base, root)` → `diff_section` → `target_doc` 조립)
  - 대조 위치(정상 적용됨): 같은 파일 `:213-226`(`_neutralize_sentinel` 정의), `:362-370`(`format_file_bundle`), `:449-467`(`extract_rationale_sections`) — 이 두 "writer" 는 `read_text_file`로 읽은 내용을 `_neutralize_sentinel()`로 감싼 뒤 `_BUNDLE_FILE_SENTINEL`(`"\n<!-- @bundle-file -->\n"`) 경계를 붙인다.
  - 상세: 이번 diff(commit 1c8f16e6f/e7bb8fb28)는 "본문이 우연히 또는 의도적으로 boundary sentinel 문자열을 그대로 쓰면 `truncate_file_bundle`이 그것을 진짜 파일 경계로 오인한다"는 취약점 클래스를 정확히 인지하고, 그 대응으로 `_neutralize_sentinel`을 추가해 두 writer 에 적용했다(커밋 메시지 자신도 "content cannot produce this marker는 포맷의 성질이 아니라 claim"이라고 명시). 그런데 같은 `target_doc`을 구성하는 세 번째 삽입 지점인 `--impl-done`의 `diff_text`(코드 변경 diff)는 정화 없이 그대로 문자열 결합된다. 아래 PoC로 직접 재현했다:
    ```
    spec_bundle = format_file_bundle([...])              # 정상 경계
    diff_section = f"...```diff\n{forged_diff_text}\n```\n"  # 정화 없음
    target_doc = _head_basis_notice(...) + spec_bundle + diff_section
    out = truncate_file_bundle(target_doc, budget)
    ```
    `forged_diff_text` 안에 sentinel 리터럴 1개 + 가짜 `#### \`FAKE/INJECTED.md\`` 헤딩을 넣은 결과, 실제 spec 파일(`real.md`, 내용에 `XYZ123` 마커 포함)은 예산 초과로 드롭되고 diff 안의 가짜 경로 `FAKE/INJECTED.md`가 "생략된 파일" 목록에 진짜 파일처럼 등재됐다(`FAKE/INJECTED.md` in out == True, `XYZ123` in out == False). 이는 이 PR 전체가 막으려던 "한 청크가 여러 조각으로 쪼개지고 진짜/가짜 경계가 뒤섞이는" 바로 그 결함 클래스가, 정화 미적용 지점을 통해 그대로 재현됨을 보여준다.
  - 실제 트리거 난이도에 대한 유보: `code_areas`(`.claude.project.json` 기준 현재 `["codebase"]`)로 범위가 제한되고, unified diff 포맷은 모든 본문 줄에 `+`/`-`/` ` 1문자 프리픽스가 붙으므로 정확히 `\n<!-- @bundle-file -->\n` (개행-텍스트-개행) 시퀀스를 표준 `git diff` 출력만으로 만들어내기는 어렵다(프리픽스 문자가 끼어들어 정확한 부분일치가 깨짐). 다만 커스텀 diff/textconv 드라이버, 특이한 파일명, 향후 `_collect_code_diff`의 옵션 변경 등으로 이 가정이 흔들릴 여지는 남아 있고, 무엇보다 "동일 PR·동일 파일에서 이미 두 지점을 고쳐놓고 세 번째를 놓쳤다"는 점에서 커버리지 갭 자체가 확정적이다.
  - 제안: `diff_text`(또는 `diff_section` 조립 직전)에도 `_neutralize_sentinel()`을 적용해 세 번째 삽입 지점을 나머지 두 writer 와 동일하게 방어한다. 예) `diff_text = _neutralize_sentinel(_collect_code_diff(diff_base, root))`. 회귀 테스트로는 `test_consistency_context_budget.py`의 `test_a_document_that_writes_the_sentinel_cannot_forge_a_boundary`와 대칭되는 케이스(`collect_context`의 `--impl-done` 경로에서 diff 안에 sentinel 이 있어도 경계가 위조되지 않음)를 추가하는 것을 권장한다 — 현재 이 경로는 두 테스트 파일 어디에서도 커버되지 않는다.

- **[INFO]** Git 서브프로세스 인자에 대한 값 검증 부재 (CWE-88, Argument Injection) — 방어심층 관점, 기존 코드(이번 diff 미변경)
  - 위치: `.claude/skills/consistency-checker/scripts/consistency_orchestrator.py:302-303`(`_branch_changed_rels`: `f"{diff_base}...HEAD"`), `:390`(`_collect_code_diff`: `f"{diff_base}...HEAD"`); `.claude/skills/code-review-agents/scripts/code_review_orchestrator.py`의 "Git helpers (unchanged from previous version)" 절 — `get_git_commit_diff`/`get_git_range_diff`/`get_git_branch_diff`/`get_file_at_commit` 등(`commit`/`range_spec`/`branch` 를 검증 없이 그대로 리스트 인자로 사용).
  - 상세: 리스트 기반 `subprocess.run`이라 셸 인젝션은 아니지만, `diff_base`/`--commit`/`--range`/`--branch` 값이 `-`로 시작하면 git 이 이를 리비전이 아닌 옵션으로 해석할 수 있다(예: `git diff` 는 `--output=<path>` 옵션으로 diff 결과를 임의 경로에 파일 기록 가능). 이 스크립트는 네트워크로 노출되는 서비스가 아니라 로컬 orchestrating agent/개발자가 호출하는 내부 CLI 이므로 직접 외부 공격 표면은 아니지만, 값 자체는 CLI 인자로 그대로 통과되어 검증이 없다.
  - 제안: ref/commit/range 인자가 `-`로 시작하면 거부하거나, `git rev-parse --verify --end-of-options <ref>` 로 먼저 검증한 뒤 사용.

- **[INFO]** `--spec`/`--plan`/`--impl-prep`/`--impl-done` 경로 인자에 저장소 루트 컨파인먼트 없음 — 방어심층 관점, 기존 코드(이번 diff 미변경)
  - 위치: `.claude/skills/consistency-checker/scripts/consistency_orchestrator.py:512-548` (`_require_target`)
  - 상세: 존재 여부와 파일/디렉토리 타입만 검사하고, 해석된 절대경로가 저장소 루트 하위인지는 검증하지 않는다. 이론상 `--spec /etc/passwd` 처럼 저장소 밖 파일을 읽어 checker sub-agent 프롬프트에 포함시킬 수 있다. 다만 이 도구를 호출하는 주체(로컬 harness/개발자)는 이미 동등한 파일시스템 읽기 권한을 다른 경로(예: `Read`)로도 가지므로 권한 상승 효과는 없다.
  - 제안: 필요시 `os.path.commonpath([root, path]) == root` 류의 검증을 추가해 방어심층을 강화(우선순위 낮음).

- **[INFO]** 예측 가능한 고정 경로 디버그 로그 파일 — 기존 코드(이번 diff 미변경)
  - 위치: `.claude/skills/code-review-agents/scripts/code_review_orchestrator.py:49`(`DEBUG_LOG_FILE = "/tmp/code-review-agents-log.txt"`), `.claude/skills/consistency-checker/scripts/consistency_orchestrator.py:46`(`DEBUG_LOG_FILE = "/tmp/consistency-checker-log.txt"`)
  - 상세: 다중 사용자 환경에서 `/tmp` 하위 고정 파일명은 사전 심볼릭 링크 선점이나 타 로컬 사용자에 의한 정보 노출에 취약할 수 있는 일반적인 패턴(CWE-377)이다. 단일 개발자 워크스테이션 전제라면 실질 위험은 낮다.
  - 제안: 우선순위 낮음 — 필요시 `tempfile` 모듈 기반 사용자별 경로로 전환.

- **하드코딩된 시크릿/인증정보**: 5개 대상 파일 전체를 검색했으나 API 키·비밀번호·토큰·인증서 등은 발견되지 않았다.
- **암호화/평문 전송**: 해당 파일들은 네트워크 통신이나 암호화 로직을 포함하지 않아 해당 사항 없음.
- **에러 처리**: 예외 메시지는 stderr 또는 로컬 디버그 로그로만 출력되고(`debug_log(...)`, `sys.stderr`), 외부로 노출되는 채널이 없어 민감정보 노출 위험은 낮음.
- **의존성 보안**: 5개 파일 모두 표준 라이브러리(`argparse`/`json`/`os`/`re`/`subprocess`/`sys`/`datetime`)와 저장소 내부 모듈만 사용, 신규 서드파티 의존성 없음.

### 요약

이번 diff 는 웹앱이 아닌 내부 리뷰/일관성-검사 harness 의 프롬프트 번들링 로직이라 고전적 OWASP Top 10(SQLi/XSS/인증 우회 등)의 공격 표면 자체가 크지 않다. 가장 눈여겨볼 지점은, 이 PR 이 "문서 본문이 harness 의 파일-경계 sentinel 을 위조해 번들 파싱을 오염시킬 수 있다"는 취약점 클래스를 정확히 인지하고 `_neutralize_sentinel` 로 두 writer(`format_file_bundle`, `extract_rationale_sections`)를 고쳤지만, 같은 `target_doc` 에 합류하는 세 번째 지점인 `--impl-done` 의 코드 diff 삽입은 정화 없이 남아 있다는 것이다 — PoC 로 재현한 결과, 조작된 diff 하나로 실제 spec 내용이 드롭되고 가짜 파일 경로가 "생략된 파일" 목록에 진짜처럼 등재됐다. 표준 `git diff` 출력의 줄 프리픽스 관례상 실제 트리거는 쉽지 않지만, 같은 PR·같은 파일에서 이미 두 곳을 고치고 한 곳을 놓친 명백한 커버리지 갭이며 수정 비용도 한 줄이라 반영을 권한다. 그 외에는 git 서브프로세스 인자 미검증(CWE-88)과 경로 인자의 저장소-루트 컨파인먼트 부재를 방어심층 관점의 INFO 로 남기는데, 둘 다 이번 diff 가 건드리지 않은 기존 코드이고 로컬 CLI 도구라는 신뢰 모델상 실질 위험은 낮다. 하드코딩된 시크릿, 안전하지 않은 암호화, 민감정보 노출형 에러 처리, 취약 의존성은 발견되지 않았다.

### 위험도
LOW
