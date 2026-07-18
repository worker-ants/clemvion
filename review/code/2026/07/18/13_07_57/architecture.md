# 아키텍처(Architecture) 리뷰

리뷰 대상: `.claude/tools/bootstrap-session.sh`, `.claude/tests/test_bootstrap_mermaid_install.py`, `.claude/tests/README.md`
(diff base: `origin/main`. 실제 변경은 마커를 "존재만 확인하는 터치파일" → "설치된 package-lock.json 해시를 담는 콘텐츠"로 바꿔, Dependabot 이 만드는 lockfile-only 보안 픽스가 이미 부트스트랩된 체크아웃에도 전파되게 하는 하드닝.)

## 발견사항

- **[WARNING]** 마커 포맷 마이그레이션(빈 터치파일 → 해시 문자열) 경로가 회귀 테스트로 고정되지 않음
  - 위치: `.claude/tools/bootstrap-session.sh` L147-158 (`need_install` 계산), `.claude/tests/test_bootstrap_mermaid_install.py` L165-231 (신규 `test_lockfile_*`/`test_*hasher*` 그룹)
  - 상세: 이번 diff 이전 마커는 `: > "$marker"`(0바이트 빈 파일)였다. 배포 시점에 이미 부트스트랩된 모든 기존 체크아웃(개발자 로컬 + CI)은 정확히 이 "빈 콘텐츠 마커" 상태를 갖고 있어, 이 diff 가 실제로 트리거할 1차 실전 경로는 "레거시 빈 마커 + 유효한 lockfile + 해셔 존재"다. 로직을 수기로 추적하면 `cat(marker)=""` != `want_hash`(실제 해시)이므로 `need_install=1`이 되어 정확히 1회 재설치 후 정상 수렴한다 — 즉 논리적으로는 올바르다. 하지만 이 정확한 시나리오(레거시 빈 콘텐츠로 마커를 시딩한 뒤 실행)를 시딩하는 테스트가 없다: 기존 `test_lockfile_change_retriggers_install` 은 "해시 A → 해시 B" 전환만 검증하고, "빈 문자열 → 해시" 전환(실제 롤아웃 시 100% 체크아웃이 겪을 초기 상태)은 별도로 핀되어 있지 않다. 이 파일은 이미 4라운드(02_06_42/12_06_58/12_31_29/현재) 연속으로 "논리적으로는 맞아 보이지만 실제로 깨졌던" 케이스(W1/W2/W3/C1)가 반복 발견된 이력이 있어, "트레이스로는 맞다"는 확신만으로 넘기기엔 이 파일의 실측 리스크 프로파일과 맞지 않는다. 테스트 스위트 자체의 모듈 docstring 도 "honestly pin what it does NOT do"를 표방하므로, 이 diff 의 존재 이유인 골든 패스를 명시적으로 고정하는 편이 스위트의 취지와 일치한다.
  - 제안: 마커에 빈 문자열을 직접 시딩한 뒤(레거시 상태 재현) 유효한 lockfile 로 1회 실행 → npm 호출 1회 발생 + 마커가 실제 해시로 갱신됨을 단언하는 테스트 추가 (예: `test_legacy_empty_marker_migrates_once`).

- **[INFO]** `want_hash` 계산이 스크립트 자신의 "저비용 체크 우선" 단락 관례에서 벗어남
  - 위치: `.claude/tools/bootstrap-session.sh` L150 (`want_hash=$(_lock_hash)`)
  - 상세: 이번 diff 이전 설치 조건은 `[ -f "$tool_dir/package.json" ] && [ ! -f "$marker" ] && ! _install_throttled && command -v npm` 형태로, 저비용 조건(`-f package.json`)을 가장 먼저 평가해 나머지 작업을 단락시키는 관례를 따랐다. 이번 diff 는 `want_hash=$(_lock_hash)`(외부 프로세스 spawn: `shasum`/`sha256sum`)를 `[ -f "$tool_dir/package.json" ]` 체크보다 앞서 무조건 실행한다. mermaid-lint 자체가 이 저장소/체크아웃에 없는 경우(`package.json` 부재)에도 매 SessionStart 마다 해시 계산이 실행된다. lockfile 이 작아 실비용은 무시할 만하지만, 스크립트가 스스로 확립한 순서 관례와 어긋나는 국소적 일관성 저하다.
  - 제안: `want_hash=$(_lock_hash)` 를 `if [ -f "$tool_dir/package.json" ]; then` 블록 안으로 이동해 기존 단락 순서를 복원.

- **[INFO]** 섹션 2(설치 가드)가 섹션 4(reap)와 달리 별도 스크립트로 추출되지 않은 채 계속 성장
  - 위치: `.claude/tools/bootstrap-session.sh` 섹션 2 전체(L61-174, 주석 포함 스크립트의 절반 이상)
  - 상세: 이번까지 4회 연속 리뷰 라운드에 걸쳐 섹션 2 는 헬퍼 함수 3개(`_file_mtime`/`_lock_hash`/`_install_throttled`), 다단계 무효화 조건(`need_install`), 실패 스로틀, 해시 바인딩을 갖춘 사실상 독립된 서브시스템으로 성장했다 — 복잡도가 이미 별도 스크립트+전용 테스트 파일로 추출되어 있는 섹션 4(`reap-merged-worktrees.sh` / `test_reap_merged_worktrees.py`)에 필적하거나 능가한다. 현재는 정상 동작하고 테스트도 탄탄하지만(테스트가 스크립트 전체를 subprocess 로 실행하는 블랙박스 방식이라 섹션 2만 분리해도 테스트 전략 자체가 크게 단순화되진 않음 — 이 점에서 추출의 주 이득은 테스트 용이성보다 재사용성·파일 자체의 인지 부하 감소), 향후 두 번째 "가드된 npm 설치"가 필요해지면(예: 다른 하네스 도구) 로직이 통째로 복제될 위험이 있다.
  - 제안: 지금 당장 급하지 않음. 향후 유사 요구가 생기면 섹션 2를 `.claude/tools/lib/ensure-npm-deps.sh` 류의 파라미터화된 별도 스크립트로 분리하는 것을 리팩터 후보로 고려.

## 점검 관점별 메모

- **SOLID**: 셸 스크립트라 클래스/인터페이스 기반 SOLID 는 직접 적용되지 않지만, 유사 개념(책임 분리)은 대체로 준수. 섹션 2 헬퍼 함수들이 파라미터 대신 스크립트 전역(`tool_dir`/`marker`/`fail_marker`)을 참조하는 점은 기존 스타일과 일관되며 이번 diff 가 새로 만든 문제는 아님.
- **결합도/응집도**: 마커를 쓰는 쪽(`bootstrap-session.sh`)과 읽는 쪽(`.githooks/pre-commit`, `lint_mermaid_posttooluse.py`)의 계약 경계를 `.claude/hooks/_lib/mermaid_lint_ready.py` 로 직접 확인함 — `is_ready()`는 마커의 **존재**만 확인하고(`os.path.isfile(marker_path(tool_dir))`) 내용은 전혀 읽지 않는다. 이번 diff 가 마커의 **콘텐츠 포맷**을 빈 파일에서 해시 문자열로 바꿨음에도 리더 측 계약(존재=ready)은 전혀 건드리지 않아, 3개 소비처 중 어느 것도 변경할 필요가 없었다 — 인터페이스 분리가 잘 유지된 사례.
- **레이어 책임**: 프레젠테이션/비즈니스/데이터 레이어 구분은 이 파일 종류에 해당 없음. 대신 "결정"(need_install 조건) / "행동"(npm install 실행) / "상태 영속화"(마커 read/write)가 섹션 내에서 합리적으로 구분되어 있음.
- **디자인 패턴**: 콘텐츠 해시 기반 캐시 무효화(빌드 시스템의 ETag/체크섬과 동일 패턴), 실패 쿨다운(circuit-breaker 류), 락 대신 수렴(convergence)형 멱등 부트스트랩 — 모두 이 문제 도메인에 적절한 표준 패턴이며 안티패턴 없음. 락 제거 결정의 근거(TOCTOU 재현, review 02_06_42 C1)가 주석에 명시되어 있고 이번 diff 는 그 결정과 정합적으로 확장됨.
- **순환 의존성**: 없음. 리프 스크립트이며 `reap-merged-worktrees.sh`를 단방향 호출.
- **추상화 수준**: 과도하거나 부족하지 않음. 프레임워크화 없이 문제 규모에 맞는 수준.
- **모듈 경계**: 외부 경계(리더/라이터 계약)는 명확. 내부 경계(섹션 2 vs 섹션 4의 추출 여부 비대칭)는 위 INFO 항목 참고.
- **확장성**: 무효화 트리거가 늘어날수록(현재: 마커 부재, 해시 불일치 2가지) `need_install`의 if/elif 사슬이 커질 수 있으나 현재 규모에선 문제 없음.

## 요약

이번 diff 는 mermaid-lint 설치 마커를 "존재만으로 판단하는 터치파일"에서 "설치된 lockfile 해시를 담는 콘텐츠 기반 캐시 키"로 승격시켜, Dependabot 이 만드는 lockfile-only 보안 픽스가 이미 부트스트랩된 체크아웃에도 다음 SessionStart 때 전파되도록 하는 하드닝이다. 락 제거·마커-only 수렴이라는 기존 설계 결정(02_06_42) 위에 자연스럽게 얹혀 있고, 새 콘텐츠 포맷이 리더 측(`mermaid_lint_ready.py`)의 "존재만 확인" 계약을 건드리지 않는다는 점을 코드로 직접 확인했다 — 경계 규율이 잘 지켜진 사례. 구조적 결함이나 순환 의존성, 안티패턴은 발견되지 않았고, 남은 지적은 (1) 이 diff 의 1차 실전 트리거인 "레거시 빈 마커 → 해시 마커" 마이그레이션 경로가 논리적으로는 맞지만 전용 회귀 테스트가 없다는 점(이 파일 특유의 반복된 "트레이스로는 맞았지만 실제로 깨졌던" 이력을 감안하면 보강 가치가 있음), (2)/(3) 사소한 순서 일관성·향후 모듈 추출 후보 — 모두 기능 결함이 아닌 견고성/유지보수성 개선 제안 수준이다.

## 위험도

LOW
