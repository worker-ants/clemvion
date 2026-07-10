# 문서화(Documentation) Review

대상 커밋: `c89f0ffb9` — 직전 fresh 리뷰(`review/code/2026/07/10/11_30_32`)의 Warning 2건(테스트
assertion 회귀 W1, docstring 부정확 W2)과 INFO 다수를 조치하는 후속 커밋. 실질 소스 변경은
`.claude/tests/test_report_playwright_flaky.py`(파일 1)와 `scripts/report_playwright_flaky.py`
(파일 13) 두 파일뿐이며, 나머지 파일 2~12는 직전 리뷰 라운드(11_30_32)의 산출물(SUMMARY/RESOLUTION/
각 에이전트 리포트/메타)이 이 커밋에 신규로 committed 된 것 — `review/` 는 gitignore 대상이 아니고
프로젝트 컨벤션상 리뷰 산출물도 커밋 대상이므로 이 자체는 정상.

## 발견사항

- **[INFO]** W2 docstring 정정이 실제 CI 배선과 정확히 일치함을 실측 확인 (문제 없음, 검증 기록)
  - 위치: `.claude/tests/test_report_playwright_flaky.py` 모듈 docstring vs `.github/workflows/harness-checks.yml:18-20`, `PROJECT.md` "Playwright flaky surfacing" 절
  - 상세: 직전 리뷰가 지적한 "`scripts/**` 글롭"이라는 부정확한 서술이 "harness-checks 트리거는 개별
    경로 등재(migration-check.yml 선례)"로 정정됐고, 이를 `harness-checks.yml`(`- 'scripts/report_playwright_flaky.py'` 개별 리터럴 경로 + "cf. migration-check.yml" 인라인 주석)과 대조해 실제로
    일치함을 확인했다. `RESOLUTION.md`가 주장하는 fix 내용과 diff·현재 파일 상태가 1:1 대응.
  - 제안: 조치 불필요.

- **[INFO]** `_spec()` 테스트 헬퍼 docstring 축약(파라미터 의미 설명 소실)이 이번 커밋에서도 잔존
  - 위치: `.claude/tests/test_report_playwright_flaky.py:27-28` (`_spec(title, status, *, file=..., line=10, retries=0)` → `"""Playwright JSON 리포트의 spec 노드 하나(단일 test)."""` 한 줄)
  - 상세: 직전 리뷰(11_30_32 documentation.md INFO)가 이미 지적했고, `RESOLUTION.md`도 "INFO 3 —
    저위험 관찰, 조치 불필요(사소)"로 명시적으로 미조치 처리한 항목. 이번 커밋의 W1/W2/INFO 조치
    목록에도 포함되지 않아 그대로 남아 있다 — 재발견이 아니라 이미 추적·의도적으로 defer 된 상태임을
    확인.
  - 제안: 추가 조치 불필요(이미 근거와 함께 defer 결정됨). 향후 `_spec()`을 다시 만질 일이 있으면
    `status`/`retries` 파라미터 의미 1줄 복원 고려.

- **[INFO]** `_location`/`_emit_annotations`의 `line==0` 렌더 비대칭이 여전히 코드 주석으로 설명되지 않음
  - 위치: `scripts/report_playwright_flaky.py` `_location()`(markdown 은 `line==0`이면 `:line` 생략) vs `_emit_annotations()`(`::warning:: file=...,line=0::`을 그대로 출력)
  - 상세: 원 지적(11_02_46 SUMMARY INFO 10)과 그에 대한 직전 라운드의 재검토(11_30_32 documentation.md
    INFO "RESOLUTION.md 라벨 부정확") 모두 이 비대칭을 근거리 주석으로 설명하라고 제안했으나, 이번
    커밋의 `_emit_annotations` docstring("각 flaky 를 `::warning::` 어노테이션으로 출력(값은
    `_gha_escape` 로 방어).")은 escaping만 설명하고 `line==0` 비대칭은 언급하지 않는다. `RESOLUTION.md`
    (11_30_32)도 이를 "INFO 미조치(정당)" 목록에 명시적으로 남겨둬 라벨-실제 불일치는 없음 — 즉 이미
    알고 있고 의도적으로 낮은 우선순위로 둔 잔여 갭.
  - 제안: 추가 조치 불필요(이미 추적됨). 저비용이므로 다음에 이 함수를 만질 때 1줄 주석 추가 권장.

## 긍정적으로 확인된 부분 (참고)

- `RESOLUTION.md`(파일 2)가 나열한 조치 항목(W1 assertion 복원, W2 docstring 정정, INFO 7~10/12/13)이
  실제 diff(파일 1, 13)와 정확히 1:1 대응함을 라인 단위로 대조 확인 — 조치 문서의 정확성 자체가 높다.
- `# noqa: BLE001`(저장소에 배선되지 않은 Ruff 전용 규칙 참조, 직전 유지보수성 리뷰 INFO 12)이
  일반 주석("# 의도적 broad except — 관측 스크립트라 어떤 예외도 CI 를 깨면 안 됨")으로 정확히
  교체됨 — 다음 유지보수자가 "이 repo 가 ruff 를 쓰나?" 오해할 소지가 해소됨.
  `typing.Iterator → collections.abc.Iterator`(INFO 13)도 정확히 반영.
- `test_unexpected_schema_does_not_crash`의 갱신된 주석("예외가 render/write 전에 발생 → summary
  오염 없음")이 실제 실행 경로(`find_flaky` 내부에서 `AttributeError` 발생 → `main()`의 blanket
  except 로 흡수 → `_write_step_summary` 자체가 호출된 적이 없어 파일 미생성 → `written == ""`)와
  정확히 일치함.
- `test_flaky_table_lists_each`에 복원된 `self.assertIn("테스트 2", md)`에 붙은 주석("다건 렌더 —
  두 번째 이후 행 누락 회귀 가드")이 해당 단언의 목적을 명확히 설명.
- 새로 추가된 `test_emit_annotations_escapes_title`(INFO 7 조치)이 `_emit_annotations`의
  `::warning::` 포맷·개행 escape 동작을 직접 검증하며, `GhaEscapeTest`의 `\r` 케이스(INFO 9)도
  실제 `_gha_escape` 구현(`%0D` 치환)과 정확히 일치.
- CHANGELOG.md 미갱신은 이번 변경(spec_impact: none, CI 인프라 전용)에 대해 기존 관례(#872/#873 류
  안정화 커밋도 CHANGELOG 미등재)와 일치하므로 누락이 아님. README/API 문서 대상 변경 없음(신규
  엔드포인트·환경변수·설정 옵션 없음).
- `review/code/2026/07/10/11_30_32/*` 산출물(SUMMARY/RESOLUTION/각 에이전트 리포트/`meta.json`/
  `_retry_state.json`)이 이 커밋으로 함께 committed 된 것은 "plan 체크박스=실제 상태" 및 "review/
  는 gitignore 대상 아님" 컨벤션과 일치하는 정상적인 감사 추적(audit trail) 보존.

## 요약

이번 커밋은 직전 fresh 리뷰가 지적한 두 Warning(다건 렌더 assertion 회귀, harness-checks 트리거
서술 부정확)을 정확히 조치했고, `RESOLUTION.md`에 기록된 조치 내역이 실제 diff·현재 파일 상태와
라인 단위로 정확히 대응한다. `harness-checks.yml`/`PROJECT.md` 등 실제 CI 배선과 새 docstring을
직접 대조한 결과 정정된 서술이 사실과 일치함을 확인했다. 남은 것은 이전 라운드에서 이미 발견되고
`RESOLUTION.md`가 근거와 함께 명시적으로 defer 하기로 결정한 두 건의 저위험 INFO(`_spec()` 헬퍼
docstring 축약, `line==0` 렌더 비대칭 미설명)뿐이며, 둘 다 이번 커밋의 조치 범위 밖임이 문서상
분명하다. CHANGELOG·README·API 문서·설정 문서 갱신 필요성도 없음(CI 관측 전용, spec_impact: none,
신규 사용자 대면 기능·엔드포인트·환경변수 없음). CRITICAL/신규 WARNING 없음.

## 위험도
LOW
