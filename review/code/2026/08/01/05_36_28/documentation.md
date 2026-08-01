# 문서화(Documentation) 리뷰 — deps-guard-hardening (9차 라운드, `05_36_28`)

## 스코프 메모

이번 라운드에 넘겨진 42개 파일 중 41개는 5~8차 `/ai-review` 세션
(`review/code/2026/08/01/{03_47_10,04_09_43,04_35_33,04_58_18}/`)의 산출물(정적
markdown/JSON, harness 자동 생성, CLAUDE.md 규약이 지정한 정상 저장 위치)이고, 실질 코드는
`scripts/check-override-floors.py` 1개뿐이다(`meta.json`으로 직접 확인). 프롬프트에는 이
파일의 diff/전체 컨텍스트가 크기 제한으로 실리지 않아 `Read`/`git show 614d72ba3`로 직접
대조했다. 이번 라운드가 실제로 검토할 신규 델타는 8차 리뷰(`04_58_18`, Critical 0·Warning
2)를 조치한 커밋 `614d72ba3`("8차 리뷰 조치")이며, `scripts/check-override-floors.py`(모듈
docstring 1곳 + `load_override_targets()` 재작성), `.claude/tests/test_override_floors.py`
(64줄, router 파일 목록 밖이나 5~8차 문서화 리뷰의 기존 관례에 따라 확인),
`plan/in-progress/deps-guard-hardening.md`(19줄, 마찬가지로 목록 밖이나 확인) 세 파일에
걸쳐 있다.

## 발견사항

- **[INFO]** (긍정 관측, 검증 완료) 이번 델타가 4~5개 라운드에 걸쳐 이월돼 온 문서화 INFO
  2건을 정확히 해소했다.
  - 위치: `scripts/check-override-floors.py:6,14-15`(모듈 docstring),
    `:138-143`(`load_override_targets()` 내 `key=str` 설명 주석 위치)
  - 상세: (1) 5차 라운드(`review/code/2026/08/01/03_47_10/documentation.md`)부터
    8차(`04_58_18`)까지 4개 라운드 연속 지적된 "실측 5건 나열 → 위 4건으로 좁혀 언급"
    서술의 순서 모호성이, `:14-15`("위 5건 중 `#1038`에서 나온 4건은 그때 audit 이 보고한
    17건 안에 섞여 있었다(`next>postcss`는 앞선 `#1036`건이라 그 목록 밖)")로 PR 번호를
    즉시 명시해 해소됐다. `git show 40026ad5c`/`7a3bff5c9`로 실제 커밋 이력을 대조한 결과
    이 귀속(`next>postcss`=`#1036`, 나머지 4건=`#1038`)은 사실과 정확히 일치한다
    (`7a3bff5c9` 커밋 메시지: "4건(liquidjs·protobufjs·fast-uri·hono)은 ... #1036 의
    next>postcss 와 정확히 같은 클래스다"). (2) 8차 라운드(`04_58_18/maintainability.md`)가
    지적한 "설명 주석이 두 f-string 리터럴의 암묵적 연결 지점 한가운데 낀다"는 문제도, 그
    주석이 `_undecidable(` 호출(`:143`) 바로 앞으로 옮겨져 이 함수의 기존 관례("주석은 호출
    직전")와 다시 일치하게 됐다. 둘 다 직접 `Read`로 재확인했다.
  - 제안: 조치 완료 확인. 추가 조치 불요.

- **[INFO]** `plan/in-progress/deps-guard-hardening.md`가 라운드 7 완료 직후 명시적으로
  예고했던 "RESOLUTION" 체크리스트 항목이, 라운드 8이 실제로 비-clean(Warning 2건)으로
  끝났음에도 근거 설명 없이 사라졌다.
  - 위치: `plan/in-progress/deps-guard-hardening.md:185-198`. `git log -p`로 대조한 이전
    상태: 라운드 7 완료 시점에 추가된 플레이스홀더는 `- [ ] /ai-review 8차 · RESOLUTION ·
    push + PR`였다(라운드 3~7의 플레이스홀더에는 "RESOLUTION" 단어가 없었고, 라운드 7이
    비-clean 으로 끝나 실제로 `review/code/2026/08/01/04_35_33/RESOLUTION.md`가 필요해진
    뒤에야 라운드 8 플레이스홀더에 처음 등장했다).
  - 상세: 라운드 8이 실행되자(`04_58_18`, Critical 0·Warning 2) 그 플레이스홀더는
    `:185`(`TEST WORKFLOW (8차)`)·`:187-197`(`/ai-review 8차` 서술, "모두 종결"로
    마무리)·`:198`(`TEST WORKFLOW (9차) · /ai-review 9차 · push + PR`) 세 줄로 갈렸는데,
    어디에도 "RESOLUTION"이 남지 않았고 실제로 `review/code/2026/08/01/04_58_18/RESOLUTION.md`도
    생성되지 않았다(확인: 해당 디렉터리에는 SUMMARY.md·`_retry_state.json`·meta.json·
    리뷰어별 `.md` 7종만 존재). developer SKILL.md(§REVIEW WORKFLOW 5번, §완료 정의)는
    "SUMMARY 의 Critical/Warning 0 (... 또는 fix + RESOLUTION.md)"·"RESOLUTION.md 가
    있어야 push 가드가 '해결됨'으로 인정한다"고 명시하며, 이 브랜치 자신의 관례
    (`RESOLUTION.md`의 "보류·후속 항목" 절)는 의도적으로 미루는 모든 항목에 근거를 남기는
    패턴을 지켜왔다 — 이번처럼 예고된 항목이 근거 없이 조용히 빠진 사례는 그 관례에서
    벗어난다. 다만 이 브랜치의 실제 관례(`f46c560e9`, 라운드 1~7을 한 번에 소급 통합)를
    보면 RESOLUTION.md는 매 라운드가 아니라 리뷰-조치 사이클이 종결되는 시점(push 직전)에
    한 번 작성돼 왔으므로, 즉각적인 결함이라기보다는 "누락되면 안 되는 미결 항목"에 가깝다.
    이번 라운드(9차, 본 세션)의 testing 리뷰어가 별도로 Warning 1건
    (`UnicodeDecodeError`/`OSError` 회귀 테스트 부재)을 발견해 사이클이 9차에서도 끝나지
    않을 가능성이 있으므로, 라운드 8의 Warning 2건 + 조치(`614d72ba3`)가 다음에 작성될
    RESOLUTION.md에서 누락되지 않도록 함께 기록할 필요가 있다 — 현재는 커밋 메시지와 plan
    서술에만 남아 있고 RESOLUTION 스키마(`## 조치 항목` 표, SUMMARY # ↔ commit 매핑)에는
    없다.
  - 제안: 이번 리뷰-조치 사이클이 최종적으로 종결될 때(push 직전) 작성/갱신할
    RESOLUTION.md에 라운드 8의 Warning 2건(`614d72ba3`)도 라운드 1~7과 같은 표 형식으로
    포함시킬 것을 권장. 지금 당장 별도 파일을 새로 만들 필요는 없다(이 브랜치의 기존
    소급-통합 관례와 일치).

- **[INFO]** `plan/in-progress/deps-guard-hardening.md:196-197`의 "모두 종결" 표현이,
  같은 문장이 가리키는 INFO 1(`read_text`/`UnicodeDecodeError`/`OSError` 예외 처리 확장)에
  대해서는 이번 라운드 testing 리뷰어의 실측(뮤턴트)이 보여주는 근거보다 다소 앞서 있다.
  - 위치: `plan/in-progress/deps-guard-hardening.md:196-197`("INFO 1(...) · INFO 4(...) ·
    INFO 6(...) 모두 종결"), 대상 코드 `scripts/check-override-floors.py:128-135`
  - 상세: INFO 4(주석 위치)·INFO 6(5건→4건 서술)는 순수 문서/주석 수정이라 "종결"이
    정확하다(위 첫 항목에서 직접 재확인). 그러나 INFO 1은 프로덕션 코드 분기
    (`except (yaml.YAMLError, UnicodeDecodeError, OSError)`) 추가이고, 이번 라운드 testing
    리뷰어가 뮤턴트로 확인한 바(원래의 `except yaml.YAMLError` 로 되돌려도
    `.claude/tests/test_override_floors.py` 41개 전부 GREEN 유지, 되돌린 상태를 실제로
    잘못된 UTF-8 파일로 실행하면 이 스크립트가 막으려는 것과 같은 급인 "exit 1 + raw
    traceback" 오분류가 재현됨)에 따르면 이 fix를 지키는 회귀 테스트가 하나도 없다. 이
    리뷰 체인은 5·6·7·8차 각각에서 "프로덕션 수정 + 회귀 테스트 부재"를 예외 없이
    WARNING으로 판정해 왔고(returncode 불변식, `TimeoutExpired` 분기, `sorted()`
    TypeError 등), 그 판정 기준에 따르면 INFO 1은 아직 "종결"이라기보다 "코드는
    고쳐졌으나 회귀 고정이 없는" 중간 상태에 더 가깝다. 코드 수정 자체가 틀렸다는 뜻은
    아니다 — fail-closed 방향의 개선은 사실이며, 실패해도 조용한 성공이 아니라 항상 비-0
    종료로 끝나 핵심 안전 불변식은 깨지지 않는다.
  - 제안: 이번 라운드 testing 리뷰어가 제안한 회귀 테스트(`load_override_targets()`를
    직접 호출하는 in-process 테스트)가 추가되면 이 문구는 그대로 정확해진다. 그 전까지는
    plan 서술을 "코드 수정 완료, 회귀 테스트는 후속 라운드에서 보강 예정"처럼 살짝
    조건부로 다듬으면 이 브랜치가 스스로 지켜온 "fix = 코드+테스트" 기준과 다시 일치한다.

- **[INFO]** 신규 예외 튜플(`yaml.YAMLError, UnicodeDecodeError, OSError`) 중 `OSError`를
  추가한 근거가 인접 주석에 명시적으로 설명되지 않는다.
  - 위치: `scripts/check-override-floors.py:129-132`
  - 상세: `:129-130` 주석은 "`read_text` 도 같은 블록 안이다 — 유효하지 않은 UTF-8 이면
    `UnicodeDecodeError` 가 그대로 전파되어..."라고 `UnicodeDecodeError`의 필요성만
    설명한다. `yaml.YAMLError`는 `:133-134`의 기존 주석("안 잡으면 traceback 과 함께 exit
    1 로 죽는다...")이 암묵적으로 커버하지만, 세 번째로 추가된 `OSError`(예: `main()`의
    `WORKSPACE_YAML.exists()` 검사와 이 함수의 `read_text()` 호출 사이의 TOCTOU 경합으로
    인한 파일 삭제, 권한 오류 등)가 왜 같은 튜플에 들어갔는지는 코드만 봐서는 추론해야
    한다. 이 파일은 다른 모든 `_undecidable()` 분기에서 "왜"를 상세히 설명하는 관례를 매우
    일관되게 지켜왔기 때문에(예: `:57-62`의 `EXPECTED_SUPPRESSED_PATHS`, `:80-94`의
    정규식 실패 이력), 이 자리만 한 항목의 근거가 암묵적으로 남은 것은 사소하지만 파일
    전체의 문서화 밀도에 비해 눈에 띄는 격차다.
  - 제안: 급하지 않음. 여유가 있으면 `:129-130` 주석에 "`OSError`는 `main()`의 존재
    확인과 이 호출 사이의 경합(파일 삭제·권한 변경)을 같은 방식으로 닫는다" 정도의 한
    문장을 추가.

- **[INFO]** README/CHANGELOG/설정 문서 갱신 필요성 재점검 — 이번 델타 범위에서 추가 갱신
  대상 없음(9차 연속 동일 판단).
  - 위치: `PROJECT.md:48`, `CHANGELOG.md`, `plan/in-progress/deps-guard-hardening.md`
    (frontmatter `spec_impact: none`)
  - 상세: 이번 델타(예외 처리 확장, docstring 서술 정리, 주석 재배치)는 `PROJECT.md:48`이
    이미 다루는 게이트 존재·목적·2-place 편집 규약 수준 아래의 구현 세부다. 신규
    환경변수·API 엔드포인트 변경 없음. `spec/` 전체에 `override-floors`/
    `check-override-floors` 매칭 0건 재확인(`spec_impact: none`과 일치).
  - 제안: 조치 불요.

## 요약

이번 9차 라운드가 실제로 검토하는 신규 델타(커밋 `614d72ba3`, `scripts/check-override-floors.py`의
모듈 docstring 1곳 + `load_override_targets()` 재작성)는 4~5개 라운드에 걸쳐 이월돼 온
문서화 INFO 2건(docstring 서술 순서, 주석 배치)을 정확히 해소하는 순수 개선이며, 직접
코드·커밋 이력 대조로 정확성을 재확인했다. 새로 짚은 항목은 전부 INFO 수준이다: (1) plan
체크리스트가 라운드 7 직후 명시적으로 예고했던 "RESOLUTION" 항목이 라운드 8(Warning 2건,
비-clean)이 끝난 뒤 근거 없이 사라졌다 — 이 브랜치가 소급 통합(라운드 1~7 → `f46c560e9`)
관례를 갖고 있어 당장의 결함은 아니지만, 이번 라운드(9차)도 testing 리뷰어의 Warning
1건으로 사이클이 끝나지 않을 수 있어 다음 RESOLUTION.md 작성 시 라운드 8이 누락되지 않도록
표시해 둔다. (2) plan의 "모두 종결" 표현이 INFO 1(예외 처리 확장)에 대해서는 이번 라운드
testing 리뷰어가 실측한 회귀 테스트 부재보다 다소 앞서 있다 — 이 브랜치가 5~8차에서
일관되게 적용한 "코드+테스트가 모여야 fix"라는 기준에 따르면 조건부 표현이 더 정확하다.
(3) 신규 `OSError` 예외 처리 추가의 근거가 인접 주석에 명시되지 않는다(매우 사소함). 이 셋
모두 사실관계 오류는 아니며 병합을 막을 사안이 아니다. README/CHANGELOG/설정 문서는 9차
연속으로 갱신 대상이 없다는 판단이 유지된다. Critical·Warning 수준의 문서화 결함은
발견되지 않았다.

## 위험도

LOW — 병합을 차단하거나 정확성에 실질적 영향을 주는 문서화 결함 없음. 긍정 재확인 1건과
forward-looking 성격의 INFO 4건(RESOLUTION 추적 누락, "종결" 표현의 조건부 정확성,
`OSError` 주석 근거 부재, 상시 재확인 항목)만 존재.
