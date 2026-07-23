# Security Review — 2026/07/23 14:47:40 세션

## 스코프 요약

본 변경은 애플리케이션 코드(`codebase/**`)가 아니라 harness/리뷰 도구 자체에 대한 변경이다:

- `.claude/agents/*-reviewer.md` (13개) — "위치" 표기 규약에 "게이트 숫자 사용" 지시 추가 (프롬프트 지시문, 순수 텍스트).
- `.claude/skills/code-review-agents/README.md`, `SKILL.md` — 문서 갱신 (`REVIEW_MAX_FILE_SIZE`/`REVIEW_MAX_PROMPT_SIZE` 기본값 조정 근거 서술).
- `.claude/skills/code-review-agents/lib/line_anchors.py` (신규) — unified diff/전체 파일 컨텍스트에 실제 소스 라인 번호 게이트를 붙이는 순수 텍스트 변환 모듈.
- `.claude/skills/code-review-agents/scripts/code_review_orchestrator.py` — 위 모듈을 리뷰 prompt 빌드 경로에 배선, 사이즈 캡 상수 조정.
- `.claude/tests/test_line_anchors.py` (신규), `.claude/tests/README.md` — 신규 테스트 스위트.

사용자 입력을 받는 웹 엔드포인트, DB 쿼리, 인증/인가 로직, 암호화 로직이 전혀 포함되지 않는다. 전부 로컬 개발자 워크플로 내부에서 실행되는 정적 텍스트 처리/오케스트레이션 도구다.

## 점검 관점별 검토

1. **인젝션 취약점**
   - `line_anchors.py` 는 정규식 기반 순수 문자열 파싱/치환만 수행(`re.compile` 앵커 패턴, `eval`/`exec`/셸 호출 없음). SQL/커맨드/LDAP/경로 조작 표면 없음.
   - `test_line_anchors.py` 의 `_git(*args)` 헬퍼는 `subprocess.run(["git", *args], ...)` 를 리스트 형태(`shell=True` 미사용)로 호출 — 인자가 테스트 코드 내 리터럴이거나 `git log --format=%h`/`git show --name-only` 의 신뢰된 로컬 git 출력이라 커맨드 인젝션 표면이 없다.
   - `test_prompt_stays_within_the_size_cap` 이 `python -c` 서브프로세스에 `f"...{str(ORCH)!r}..."` 로 경로를 주입하지만 `ORCH` 는 리포 루트 기준 고정 상수 경로이며 외부 입력이 아니다. 위험 없음.
   - 정규식(`_HUNK_RE`, `GUTTER`)은 앵커링돼 있고 중첩 정량자/재앙적 백트래킹 패턴이 없어 ReDoS 우려 없음.

2. **하드코딩된 시크릿**: 발견 없음. 새 파일들에 API 키/비밀번호/토큰/인증서 문자열 없음.

3. **인증/인가**: 해당 없음 (엔드포인트/세션 로직이 아닌 로컬 CLI 도구).

4. **입력 검증**: `line_anchors` 모듈은 명시적으로 "확신 없으면 아무 것도 방출하지 않는다"(fail-open, 원문 그대로 통과) 는 설계 원칙을 갖고 있고, hunk 헤더 파싱 실패·헤더-바디 라인 수 불일치·combined/merge diff(`@@@`) 등 비정상 입력에 대해 방어적으로 동작한다(`_hunk_is_consistent`). 이는 보안 목적이 아니라 정확성 목적이지만, 부수적으로 malformed diff 입력에 대한 견고성을 제공한다.

5. **OWASP Top 10**: 해당 코드 성격상 대부분 미해당. 굳이 연관지으면 A08(Software and Data Integrity Failures) 관점에서 diff 파싱이 신뢰 불가 diff 를 만나도 크래시 없이 안전하게 fallback 하는 점은 긍정적.

6. **암호화**: 해당 없음. 해시/암호화 알고리즘 사용 없음.

7. **에러 처리**: `line_anchors` 실패 시 예외를 던지지 않고 원문 그대로 반환 — 민감정보 노출 경로 없음. 테스트 assertion 메시지들은 로컬 git diff 스니펫만 포함(리뷰 대상 코드 자체 외 민감정보 없음).

8. **의존성 보안**: 신규 외부 패키지 없음 — `re`, `subprocess`, `sys`, `unittest`, `pathlib` 등 표준 라이브러리만 사용. `.claude/tests/README.md` 의 "harness Python 은 서드파티 의존성 0" 컨벤션과 일치하며 공급망 공격 표면을 넓히지 않는다.

## 참고 (비-보안, 정보 제공용)

- `code_review_orchestrator.py` 의 `DEBUG_LOG_FILE = "/tmp/code-review-agents-log.txt"` 는 이번 diff 의 컨텍스트 라인일 뿐 신규 변경이 아니다(사전 존재 코드). 참고로만 남긴다 — 로컬 개발자 도구의 예측 가능한 `/tmp` 경로라 멀티유저 시스템에서는 이론적으로 symlink race/정보노출 여지가 있으나 이번 변경 범위 밖이라 CRITICAL/WARNING 처리하지 않음(INFO 수준 참고사항).

### 발견사항

없음 — 위 관점 전체에서 CRITICAL/WARNING 급 발견 없음.

### 요약

이번 변경은 AI 코드 리뷰 harness 의 프롬프트 조립 로직(줄 번호 게이트 부여)과 리뷰어 지시문 텍스트에 한정되며, 사용자 데이터·네트워크 입출력·인증/인가·DB·암호화와 무관한 순수 오프라인 텍스트 변환/오케스트레이션 도구다. 신규 모듈(`line_anchors.py`)은 "확신 없으면 원문 그대로 통과"하는 fail-open 설계로 부정확한 결과를 방지하며, 신규 서드파티 의존성 도입도 없다. 테스트 코드의 `subprocess` 사용은 리스트 인자 방식으로 셸 인젝션 표면이 없고 모든 인자가 로컬 신뢰 경로/git 출력이다. 보안 관점에서 우려할 사항이 없다.

### 위험도
NONE
