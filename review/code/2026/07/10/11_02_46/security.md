# 보안(Security) 리뷰 — e2e flaky surfacing

대상: `.claude/tests/test_report_playwright_flaky.py`, `.github/workflows/e2e.yml`,
`codebase/frontend/playwright.config.ts`, `plan/complete/e2e-retry-visibility-followup.md`
(+ 옛 in-progress 삭제), `scripts/report_playwright_flaky.py`

## 발견사항

- **[INFO]** GitHub Actions 워크플로 커맨드(`::warning::`) 에 리포트 필드를 무검증 삽입
  - 위치: `scripts/report_playwright_flaky.py:889-894` (`main()` 의 `print(f"::warning file={f['file']},line={f['line']}::...{f['title']}")`)
  - 상세: `f['file']`/`f['title']` 는 Playwright JSON 리포트의 spec `file`/`title` 값을 가공 없이 그대로 워크플로 커맨드 문자열에 삽입한다. GitHub Actions 워크플로 커맨드는 stdout 라인 파싱 기반이라, 값에 개행(`\n`) + `::` 시퀀스가 포함되면 이론적으로 추가 어노테이션/커맨드 라인을 주입할 수 있는 class(workflow command injection, GitHub 자체가 과거 `set-env`/`add-path` 를 이 이유로 폐지)에 해당한다. 다만 이 값의 출처는 (a) 저장소에 커밋되어 PR 리뷰를 거치는 e2e 스펙의 `test.describe`/`test()` 타이틀·파일 경로이고 (b) `pull_request` 트리거로 fork PR 이 실행되더라도 기본 `GITHUB_TOKEN` 은 read-only/secrets 미접근이라, 공격자가 이 경로로 얻을 수 있는 실익은 제한적이다(추가 로그 스푸핑 정도). 신뢰 경계를 넘는 외부 입력이 아니라는 점에서 실질 위험은 낮다.
  - 제안: 방어적 하드닝으로 `title`/`file` 의 개행·`::` 시퀀스를 이스케이프/제거(`.replace("\n", " ").replace("%", "%25")` 등 GitHub 권장 percent-encoding)하면 향후 리포트 소스가 덜 신뢰되는 경로(예: 외부 도구가 JSON 을 생성)로 바뀌어도 안전.

- **[INFO]** 중첩 `suites` 재귀 순회에 깊이 제한 없음
  - 위치: `scripts/report_playwright_flaky.py:791-800` (`_iter_specs`)
  - 상세: Playwright JSON 리포트의 `suites` 트리를 제너레이터 재귀로 순회한다. 병적으로 깊게 중첩된 `suites` 구조가 주어지면 `RecursionError`(스택 오버플로) 로 스크립트가 죽을 수 있다. 다만 입력 소스가 동일 CI job 내 Playwright 자신이 생성한 리포트(외부 공격자가 직접 조작 가능한 경로 아님)이므로 실질 공격 표면은 아니며, `main()` 이 `find_flaky` 호출을 try/except 로 감싸지 않아 예외 시 이 step 이 실패하지만 `if: always()` 로 배선되어 있어 상위 e2e job 결과에는 영향 없음(가시성 저하 정도).
  - 제안: 필요시 반복(iterative, 명시 스택) 방식으로 교체하거나 깊이 상한을 두면 견고성 향상(보안 필수는 아님).

## 요약

이번 변경은 CI 전용 관측 도구(Playwright flaky 결과를 GitHub step summary/어노테이션으로 노출)로, 사용자 데이터·인증·비밀정보·네트워크 입력을 다루지 않는다. 시크릿 하드코딩, SQL/커맨드 인젝션, 인증/인가 우회, 안전하지 않은 암호화 등 전형적 취약점 클래스는 해당 사항이 없다. `subprocess`/`os.system` 미사용, 서드파티 의존성 미추가(stdlib 전용)로 커맨드 인젝션·공급망 위험도 없다. 유일하게 주목할 지점은 Playwright JSON 리포트의 `file`/`title` 값을 GitHub Actions `::warning::` 워크플로 커맨드에 그대로 삽입하는 부분인데, 값의 출처가 저장소 내부(리뷰를 거친 e2e 스펙)라 실질 익스플로잇 경로가 없어 심각도는 낮다. 예외 처리도 파일 부재/JSON 파싱 실패를 넓게 잡아 "항상 exit 0" 계약을 지키려는 의도가 명확하고, 에러 메시지에 민감정보 노출도 없다.

## 위험도
LOW
