# 문서화(Documentation) 리뷰 — deps-guard-hardening (5차 라운드)

## 전제: 라운드 스코프와 4차 리뷰 조치 재검증

이번 라운드에서 orchestrator 가 문서화 리뷰어에게 할당한 파일은 `scripts/check-override-floors.py`
1개뿐이다(325줄, 신규 파일 전체가 diff 로 제시됨). git 이력을 대조한 결과 이 파일은 4차
`/ai-review`(`review/code/2026/08/01/03_16_51`)가 지적한 WARNING 2건 — (1) `actions[]` 스키마
드리프트 fail-closed 로직 결함, (2) `.claude/tests/test_override_floors.py`/`README.md` 의 "두
번"/"세 형태" 수치 drift — 을 조치한 커밋(`652f6cc78`, "4차 리뷰 조치")의 산출물이다.

문서화 관점에서 특히 W2(수치 drift)가 실제로 해소됐는지, 그리고 W1 코드 수정이 남긴 주석이
정확한지를 직접 코드 대조로 재검증했다:

- `scripts/check-override-floors.py` 자체에서 `_undecidable(` 호출부를 실측(`grep -n`) →
  **정확히 6곳**(:154 빈 출력 / :162 파싱 실패 / :165 `actions` 키 없음 / :218 `advisories`
  하위 필드 드리프트 / :228 `actions` 하위 필드 드리프트 / :238 워크스페이스 파일 부재). 이 6이라는
  숫자는 이 파일 스코프 밖의 `.claude/tests/test_override_floors.py` 모듈 docstring("여섯")과
  `.claude/tests/README.md:39`("**Six** sites")가 주장하는 숫자이기도 한데, 코드 자체를 직접 세어
  두 문서의 주장과 정확히 일치함을 확인했다 — 4차 조치가 남긴 잔여 drift 없음(형식적으로는 이
  두 문서가 이번 라운드의 할당 스코프 밖이지만, `check-override-floors.py`에 대한 외부 문서 주장의
  사실 정확성이므로 "주석 정확성" 점검의 연장으로 확인했다).
- W1 코드 수정(`actions_with_module = [a for a in actions if a.get("module")]`을 `reported`와
  독립적으로 계산)에 동반된 새 주석(`:223-226`)이 실제 코드와 정확히 일치함을 확인했다 — "판정은
  `actions` 원소 자체로 한다"는 주장대로 `:227`의 조건문이 `reported`를 참조하지 않는다.

## 발견사항

- **[INFO]** 모듈 docstring 이 "실측 5건"을 나열한 직후 "위 4건"으로 좁혀 부르는 대목이, 어느
  1건이 왜 빠지는지를 그 문장 시점에는 밝히지 않아 순서상 잠깐 모호하다.
  - 위치: `scripts/check-override-floors.py:6-14` (특히 `:14`)
  - 상세: `:6`이 "실측 5건 (2026-07-31, `#1036`/`#1038`)"이라 선언하고 `:8-12`에 `next>postcss`
    포함 5개 패키지를 나열한다. 그런데 `:14`는 "실제로 위 4건은 audit 17건 중에 섞여 보고됐다"라고
    적어, 방금 나열한 5건 중 어느 1건(문맥상 `#1036`의 `next>postcss`)이 "17건" 통계에서 빠지는지
    이 문장만으로는 알 수 없다. 7줄 뒤 `:21`("`#1038` 이 정확히 그 상태였다 — 17건 중 4건")에
    가서야 "17건"이 `#1038` PR 고유의 audit 실행 결과였음이 밝혀져 5(전체)/4(`#1038`만) 분할의
    근거가 뒤늦게 채워진다. 사실관계 오류는 아니다 — `next>postcss`(`#1036`)와 나머지 4건(`#1038`)이
    서로 다른 PR·다른 audit 실행에서 나온 수치라는 서술은 `plan/in-progress/deps-guard-hardening.md`
    의 표(패키지별 발견 PR 컬럼)와도 일치한다. 다만 이 파일 하나만 읽는 독자 입장에서는 `:14` 시점에
    "audit 이 5건 전부를 잡는다는 근거인지, 4건만 잡고 1건은 놓쳤다는 뜻인지"가 잠깐 불분명하다 —
    이 문단의 목적 자체가 "`pnpm audit` 이 이것들을 **잡기는 한다**"(:14)는 전제를 세우는 것이라,
    5건 중 1건의 audit 포착 여부가 불명확하게 읽히면 그 전제와 살짝 긴장한다.
    참고로 이 항목은 신규 발견이 아니라 원 커밋(`6b55b0f48`)부터 존재해 온 문구이며, 1~4차 리뷰
    (문서화 관점 라운드 포함 2회)를 거치는 동안 지적된 적이 없다 — 실질적으로 낮은 우선순위임을
    시사한다.
  - 제안: `:14`를 "실제로 `#1038`의 4건은 audit 17건 중에 섞여 보고됐다"처럼 PR 번호를 즉시 명시하는
    쪽으로 바꾸면, `:21`까지 가지 않아도 5/4 분할의 근거가 그 자리에서 바로 선다. 급하지 않은
    선택적 다듬기.

## 참고 (INFO)

- **[INFO]** (긍정 관측) 이 파일의 문서화 수준은 이례적으로 높다. 모듈 docstring(`:2-37`)이 문제
  배경·5개 실측 사례·`pnpm audit`과의 관계·분류 가치 제안·자매 스크립트와 분리한 이유·caret 버전
  범위 때문에 "바닥만 낮추면 재현된다"가 성립하지 않는다는 동작 조건·테스트 작성 시 회귀 재현
  절차까지 담아, 이 게이트를 처음 보는 사람이 "왜 존재하는가"를 코드 밖 문서 없이도 이해할 수 있다.
  `chain_segments`/`override_target`/`load_override_targets`/`_undecidable`/`run_audit`/
  `classify_vulnerable` 6개 함수 모두 docstring을 갖추고, 특히 `_undecidable`(`:126-131`)은
  `NoReturn` 반환 타입을 쓴 이유를, `run_audit`(`:139-145`)은 returncode 로 성공을 판단할 수 없는
  이유를, `classify_vulnerable`(`:174-193`)은 `ignoreCves` 전역 억제의 함정과 실측 사례
  (`brace-expansion`, override 3키 — `pnpm-workspace.yaml:52-54`와 대조해 정확함을 확인)를 각각
  근거와 함께 설명한다.
- **[INFO]** `_NAME_CHAR`/`_RANGE_SUFFIX` 정규식 앞의 인라인 주석(`:75-93`)이 이 파일에서 가장
  까다로운 파싱 로직(체인 구분자 `>` 대 레인지의 `>` 판별)의 실패 이력 2가지(예전 방식이 각각
  어떻게 틀렸는지)까지 구체적으로 기록한다. `chain_segments()`(`:96-105`)·`override_target()`
  (`:108-112`)의 실제 동작을 직접 추적해(`next>postcss`, `undici@>=7.0.0 <7.28.0`,
  `a>@scope/b>c` 케이스) 주석의 주장과 일치함을 확인했다 — 오래된 주석(변경된 코드와 불일치)
  없음.
- **[INFO]** `main()`·`_report_widened()`·`_report_eroded()` 3개 함수에는 독립 docstring이 없으나,
  형제 스크립트 `scripts/check-pnpm-security-config.py`의 `main()`도 동일하게 docstring이 없어
  (`_check_set`도 마찬가지) 저장소 기존 관례와 일치한다 — 이 3개 함수는 각각 결과 출력만 담당하거나
  (`_report_*`) `main()`의 비자명한 두 지점(위험 확대 판정 로직 `:250-251`, 위험/침식 동시 계산 후
  일괄 보고 `:274-276`)에 인라인 주석이 이미 붙어 있어 실질 정보 손실은 없다. 다만 `main()`은
  대상 로딩→audit 실행→분류→cross-reference→보고라는 5단계를 엮는 이 파일에서 가장 복잡한 제어
  흐름을 가진 함수이므로, 2~3줄짜리 요약 docstring을 얹으면(예: "override 대상과 audit 결과를
  교차해 widened/eroded 로 나누고 보고한다") 인라인 주석을 읽기 전에 전체 그림을 먼저 파악하는 데
  도움이 될 수 있다 — 강제성 없는 선택 사항.
- **[INFO]** README/CHANGELOG/설정 문서 갱신 필요성 점검: `PROJECT.md:48`(의존성 취약점 절)이
  이미 이 3번째 게이트(override-floors)를 상세히 설명하고 있고, `.github/workflows/
  deps-security-checks.yml`(헤더 주석 + `override-floors` 잡)도 이미 배선·문서화돼 있다(둘 다
  이번 라운드 diff 이전에 이미 반영됨). 루트 `README.md`는 제품 개요 문서라 개별 CI 게이트를
  다루는 성격이 아니므로 갱신 대상이 아니다. `CHANGELOG.md`는 `spec/`에 연결된 제품 기능 변경만
  다루는 저장소 관례이고 이 작업은 `plan/in-progress/deps-guard-hardening.md`의
  `spec_impact: none`으로 명시돼 있어 CHANGELOG 갱신 대상이 아니다. 새 환경변수는 도입되지 않았고,
  `EXPECTED_SUPPRESSED_PATHS`(코드 내 설정 상당물)는 갱신 절차를 설명하는 주석(`:56-61`)을 이미
  갖추고 있다. API 엔드포인트 변경 없음(CLI/CI 스크립트). 이 축들에서 누락 없음.

## 요약

`scripts/check-override-floors.py`는 4차 리뷰까지 이어진 반복 조치의 결과로 문서화 수준이 이미
매우 높다. 이번 라운드에서 직접 코드를 세어 재검증한 결과, 4차 리뷰가 지적한 문서 수치 drift
(fail-closed 지점 개수·개발 중 실패 횟수)는 `_undecidable()` 6개 호출부 실측과 정확히 일치하도록
해소돼 있고 잔여 불일치를 찾지 못했다. 이번에 새로 낸 유일한 항목은 모듈 docstring 도입부의
"5건 나열 → 4건으로 좁혀 언급" 서술 순서가 한 문장 시점에서 잠깐 모호할 수 있다는 선택적 다듬기
제안(INFO)이며, 사실관계 오류는 아니고 4개 라운드의 리뷰를 그대로 통과해 온 문구라는 점에서
우선순위는 낮다. Critical·Warning 수준의 문서화 결함은 발견되지 않았다.

## 위험도

LOW — 병합을 차단하거나 정확성에 실질적 영향을 주는 문서화 결함 없음. 선택적 다듬기 제안(INFO)
1건과 긍정 관측 다수만 존재.
