# 문서화(Documentation) 리뷰 — deps-guard 10차 라운드

## 스코프 메모

router 가 넘긴 2개 파일: (1) `review/code/2026/08/01/05_36_28/testing.md` — 9차 `/ai-review`
testing 리뷰어의 산출물(리뷰 아티팩트, 신규 파일로 저장소에 편입), (2)
`scripts/check-override-floors.py` — 전체 386줄(9차 조치 커밋 `e18fc7227` 반영 후 상태). 두
파일 모두 `git log`/`git show`/`grep`으로 실제 저장소 상태와 대조해 검증했다. `.claude/tests/
test_override_floors.py`는 이번 라운드도 router 파일 목록 밖이라(`.claude/**` 제외 정책, 9개
라운드 전부 동일 판단) 정보 컨텍스트로만 참조하고 그 안의 발견사항은 만들지 않았다.

## 발견사항

- **[INFO]**(긍정 관측, 교차 검증) 신규 스크립트의 모듈 docstring·인라인 주석이 인용하는 사실관계가
  외부 문서 3곳과 여전히 일치한다.
  - 위치: `scripts/check-override-floors.py:2-38`(모듈 docstring), `PROJECT.md:48`,
    `.github/workflows/deps-security-checks.yml`(override-floors 잡)
  - 상세: 모듈 docstring 의 실측 5건 버전 표(`next>postcss ^8.5.14→>=8.5.18` 등)가
    `plan/in-progress/deps-guard-hardening.md:23-29` 표와 완전히 일치하고, "audit 이 보고한
    17건 중 4건이 묻혀 있었다"는 서술도 plan 본문과 일치한다. `PROJECT.md:48`은 본 스크립트의
    역할·2-place 편집 규약(override 값 변경 시 `check-pnpm-security-config.py`의
    `EXPECTED_*`도 함께 갱신)을 이미 상세히 설명하고 있어 이번 라운드도 README/CHANGELOG류
    갱신 필요가 없다는 8~9차의 판단을 재확인했다(형제 스크립트 `check-pnpm-security-config.py`도
    CHANGELOG.md 에 개별 항목이 없어 선례와 일치). `grep -c "_undecidable("` 로 직접 센 호출
    지점 11곳(정의부 제외)도 plan 체크리스트 9차 항목의 "fail-closed 지점 9곳 → 11곳" 서술과
    정확히 일치했다.
  - 제안: 조치 불요.

- **[INFO]**(긍정 관측) 9차 라운드 자신의 문서화 리뷰(`05_36_28/documentation.md`)가 남긴 INFO
  2건이 바로 다음 조치 커밋에서 닫혀 현재 HEAD 에는 드리프트가 남아있지 않다.
  - 위치: `scripts/check-override-floors.py:144`(`# OSError 는 main() 의 존재 확인과 이 읽기
    사이의 TOCTOU 창... 을 닫는다`), `plan/in-progress/deps-guard-hardening.md:196-199`
  - 상세: `git log -1 e18fc7227`로 커밋 메시지를 직접 대조한 결과 "INFO 4/5(주석 위치·OSError
    근거) 조치. INFO 3: plan 의 '모두 종결' 서술이 회귀 테스트보다 앞섰던 것을 사실대로
    정정"이라고 명시돼 있다. 실제로 `load_override_targets()`의 `except (yaml.YAMLError,
    UnicodeDecodeError, OSError)` 바로 위에 `OSError`의 TOCTOU 근거 주석이 붙어 있고(9차
    문서 리뷰가 지적한 INFO 5), plan 문서 196-199행은 더 이상 "모두 종결"이 아니라 "코드
    조치 완료 — 단 예외 확장은 회귀 테스트가 9차에 가서야 붙었다... '코드+테스트가 모여야
    fix' 기준에 못 미쳤다"로 조건부 정확하게 고쳐져 있다(9차 문서 리뷰의 INFO 3). 리뷰 발견
    → 같은 라운드 내 코드+plan 동시 정정이라는 이 체인의 패턴이 이번에도 유지됐다.
  - 제안: 조치 불요.

- **[INFO]**(carried, 조치 불요 유지) `main()`·`_report_widened()`·`_report_eroded()` 3개
  함수에 독립 docstring 이 없는 점은 5차 문서화 리뷰(`03_47_10/documentation.md:67-75`)가 이미
  발견해 "저장소 기존 관례(형제 스크립트 `check-pnpm-security-config.py`의 `main()`도 동일)와
  일치, 강제성 없는 선택 사항"으로 정리한 항목이다. 6~9차 문서화 리뷰 어느 라운드도 이를
  재상정하지 않았고, 이번 라운드도 동일 판단을 유지한다 — 새 근거나 새 위험이 없어 다시
  올리지 않는다.
  - 위치: `scripts/check-override-floors.py:297`(`def main`), `:345`(`_report_widened`),
    `:366`(`_report_eroded`)
  - 상세: (변경 없음, 5차 판단 유지)
  - 제안: 조치 불요.

## 요약

이번 라운드에서 검토한 두 파일 모두 문서화 관점의 신규 결함을 만들지 않았다. `scripts/
check-override-floors.py`는 모듈 docstring·6개 함수 docstring·정규식 파싱 로직에 대한 촘촘한
"왜" 주석을 갖추고 있고, 이번 라운드까지 누적된 사실관계(버전 표·PR 번호·fail-closed 지점
개수·2-place 편집 규약)를 `PROJECT.md`·`deps-security-checks.yml`·plan 문서와 직접 대조해
전부 일치함을 확인했다. `05_36_28/testing.md`(리뷰 아티팩트)도 커밋 해시(`614d72ba3`)·경로가
실제와 일치하는 시점 스냅샷이며, 그것이 지적한 WARNING(예외 확장 회귀 테스트 부재)과 9차 자체
문서화 리뷰의 INFO 2건은 모두 바로 다음 조치 커밋(`e18fc7227`)에서 코드와 plan 서술이 함께
정정됐음을 직접 확인했다. 유일하게 남아있는 관찰(`main()` 등 3개 함수의 docstring 부재)은
5차부터 "저장소 기존 관례와 일치, 선택 사항"으로 정리된 뒤 4개 라운드 연속 재상정되지 않은
항목이라 이번에도 새 근거 없이 그대로 둔다. README/CHANGELOG/설정 문서 갱신 필요성도 형제
스크립트 선례와 대조해 재확인한 결과 이번에도 대상이 없다. Critical·Warning 수준의 문서화
결함은 발견되지 않았다.

## 위험도

LOW — 병합을 차단하거나 정확성에 실질적 영향을 주는 문서화 결함 없음. 이번 라운드는 신규
발견 없이 긍정 재확인(교차 문서 일치·직전 라운드 INFO 해소 확인) 2건과 carried 판단 유지 1건만
존재한다.
