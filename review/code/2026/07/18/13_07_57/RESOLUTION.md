# RESOLUTION — review/code/2026/07/18/13_07_57 (§F 최종 수렴 리뷰)

전체 위험도 **MEDIUM, Critical 0, WARNING 5.** 핵심: **코드 correctness 는 여러 reviewer 가 mutation
testing 으로 재확인**(11/11 → 이제 14/14, 전체 308). WARNING 은 전부 (W1/W2/W3) 회귀 테스트 갭 +
(W4) 문서 자기모순 + (W5) 프로세스 관찰이지 코드 결함이 아니다.

| # | 분류 | 조치 |
|---|---|---|
| W4 | 문서 fix | testing/documentation. 직전 커밋이 "once/first-install-only 4곳 정정" 이라 했으나 L93 에 `first-install-only` 를 하나 남겨 **같은 문단·같은 커밋 안 자기모순**. "rare (recurring rather than one-off)" 로 정정. 이 세션 반복 교훈(반증된 서술 남기지 말 것)이 그걸 고치는 커밋에서 재발한 사례. |
| W1 | 테스트 추가 | 머지 순간 **모든 기존 checkout 이 거치는** 1차 경로(구 빈-파일 마커 → 해시 마이그레이션) 무테스트. `test_legacy_empty_marker_migrates_once` — 빈 마커 1회 재설치 후 해시로 갱신·이후 skip. presence-only 뮤턴트로 비-vacuity(스크래치 복사본서). |
| W2 | 테스트 추가 | 해시-트리거 재설치 **실패** 시 옛 마커 방치(fail-open)·throttle 후 수렴 무테스트. `test_failed_hash_reinstall_keeps_old_marker_and_recovers`. |
| W3 | 테스트 추가 | 5-way 동시성 테스트가 lockfile 없어 해시 분기 미평가. `test_concurrent_lockfile_change_converges_to_correct_hash` — 기존 마커+lockfile 변경+동시 기동 → 마커 **content** 가 현재 해시로 수렴. |
| W5 | 프로세스(메모리) | requirement/concurrency 가 내 non-vacuity 뮤테이션이 **공유 워크트리 원본**을 변형하는 걸 목격(형제 reviewer 가 mutated 상태 관측). 코드 결함 아님. 이번 라운드 비-vacuity 는 **스크래치 복사본**(`/tmp/bs-nonvac.mut`)에서 수행해 원본 불변 확인. 교훈은 메모리 갱신. |
| I2 | 문서 fix | README/docstring 의 테스트명 glob(`test_lockfile_*` 등)이 신규 테스트와 불일치 → 산문·구체 목록으로 교체. |
| I1·I3~I12 | 무변경/defer | 코드 정확성 확인(I1)·e2e paths(I3, 이미 plan)·atomic marker write(I5, §G)·섹션2 추출(I6)·주석 성장(I7)·`"*"` semver(I11, 이미 W6/plan) 등 reviewer 가 "조치 불요"/"defer"/"이미 추적" 표기. |

## 수렴 판정

Critical 0. **코드 correctness 결함 0**(mutation-verified). 이번 라운드는 reviewer 가 요청한 회귀
테스트 3건 + 문서 정정만 추가 — 동작 무변경. 남은 것은 전부 defer/INFO/프로세스. edge-gaps 교훈
(Critical 0 + 코드 WARNING 0 이면 수렴)에 따라 수렴.

## 테스트
- harness 308 통과(신규 3건). e2e 면제(`.github/**`·`.claude/**`·`plan/**`).
