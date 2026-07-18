# RESOLUTION — review/code/2026/07/18/12_31_29 (§F 수렴 리뷰: 마커-해시 결속)

전체 위험도 **MEDIUM, Critical 0, WARNING 6.** 마커-해시 결속(직전 W1 fix)이 만든 새 표면 2건이
핵심 — 둘 다 내가 도입했으니 고친다.

| # | 분류 | 조치 |
|---|---|---|
| W1 | 문서 정정 | 5 reviewer 수렴. 마커-해시 결속으로 동시-설치 창이 "최초 설치만" 이 아니라 **lockfile 변경마다**(정기 Dependabot 머지 포함) 재개방되는데, 설계 노트·파일헤더·섹션헤더·런타임 echo 의 "once"/"one-time" 서술이 이를 못 따라감. **4곳 전부 정직하게 정정**(창이 recurring 임을 명시, §G 재평가 조건 기록). 이 세션 반복 교훈(반증된 안전 서술을 남기지 말 것)의 또 한 사례. |
| W2 | 코드 fix | side_effect/testing/requirement. `want_hash` 를 install **전** 캡처해 같은 값을 마커에 기록 → npm 이 install 중 lockfile 재작성 시 마커≠실제 → 무한 재설치(testing 이 스텁으로 재현; side_effect 는 실 npm 10.9.2 서 미재현=저확률). **install 성공 후 `_lock_hash` 재계산해 기록** = 자기 교정. 테스트 `test_npm_rewriting_lockfile_still_converges`(pre-install 해시 뮤턴트로 비-vacuity). |
| W3 | 테스트 추가 | 해셔(shasum·sha256sum) 둘 다 부재 폴백 무테스트. PATH-shadow exit-127 스텁으로 "최초 설치는 되나 lockfile 변경 미감지(presence-only 열화)" 를 pin(`test_missing_hasher_degrades_to_presence_only`). |
| W4 | 문서 fix | README 표 + 모듈 docstring 이 헤드라인 동작(마커-해시 결속)·신규 테스트 미요약 = 이 PR 이 고치는 실패의 문서판. 둘 다 갱신. |
| W5 | defer | 커버리지 매트릭스 무결성 가드 부재(미래 두 번째 out-of-workspace 트리 등록 누락 방지). 대상 1개라 실 drift 0. plan §F 잔여 등록. |
| W6 | defer | `jsdom`·`mermaid` `"*"` range(선재, PR #410~) → Dependabot 활성화로 major bump 가 lockfile-only 로 옴. caret 로 좁히기, diff 밖. plan §F 잔여 등록. |
| I1~I5 | 무변경/확인 | CVE 해소 실측 재현·마커 content 변경이 reader 3곳 무영향(4 reviewer 수렴)·성능 미미 등. |

## 핵심 — 내가 만든 표면을 내가 닫는다

W1 fix(마커-해시 결속)가 F 의 propagation 갭을 닫으면서 동시-설치 창을 recurring 으로 넓혔고(W1),
해시 캡처 타이밍 갭을 만들었다(W2). 리뷰가 둘 다 잡았다. W2 는 실 correctness fix(post-install
재계산), W1 은 정직성 문서 정정. 수용한 트레이드오프(rare 동시-설치)는 유지하되 이제 정확히 서술된다.

## 테스트
- harness 305 통과(신규 2건). plan-frontmatter 통과. e2e 면제.

## 수렴 판정

Critical 0. W1(문서)·W2(코드+테스트)·W3(테스트)·W4(문서) 이번 라운드 처리. W5·W6 은 선재/가설적
→ plan defer. 이 change 스코프 내 조치필요 코드결함 0 → 다음 리뷰가 Critical 0 + 코드 WARNING 0 이면 수렴.
