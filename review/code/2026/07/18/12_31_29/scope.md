### 발견사항

- **[INFO]** `bootstrap-session.sh`/테스트/`PROJECT.md`/`dependabot.yml` 에 걸친 "마커를 lockfile 해시에 결속" 변경은 원 태스크명("mermaid-lint-undici-vuln", 두 CVE 픽스 + Dependabot 편입)보다 넓지만, 인과적으로 정당화된 확장이다
  - 위치: `.claude/tools/bootstrap-session.sh` (`_lock_hash()` 신설 + `need_install` 분기), `.claude/tests/test_bootstrap_mermaid_install.py` (`test_lockfile_change_retriggers_install`/`test_unchanged_lockfile_does_not_reinstall`), `.github/dependabot.yml` (주석 정밀화), `PROJECT.md` (거버넌스 절 1문장 추가)
  - 상세: 커밋 `c5fdd1bb8`(`fix(harness): 보안 픽스가 기존 설치에 전파되도록 마커를 lockfile 해시에 결속 (§F 리뷰 W1)`)는 직전 리뷰 라운드(`review/code/2026/07/18/12_06_58`)의 W1 발견사항을 처리한 것이다. 근거: bootstrap 설치완료 마커가 존재 여부만 검사해, 이미 부트스트랩된 checkout 은 이번 diff(커밋 `02d69e324`)가 lockfile 에 반영한 undici/dompurify 픽스가 머지돼도 재설치가 안 돼 취약 버전이 잔존하고, 방금 켠 Dependabot npm 경로의 향후 모든 보안 PR 도 lockfile-only 라 같은 갭이 매번 재발한다. 즉 이 확장이 없으면 같은 diff 가 추가한 Dependabot 등록 자체가 기존 checkout 에 대해 무의미해진다 — 별개 기능이 아니라 원 수정이 실제로 동작하기 위한 전제조건이다. CLAUDE.md 의 "구현 완료 후 자동 review/fix 는 상시 승인된 강제 의무" 규약과도 부합(직전 라운드 Warning 은 같은 turn 반영 대상)
  - 근거(부수 확인): `plan/in-progress/harness-guard-followups.md` 자체가 "A 의 주제와 무관하다. 같이 넣으면 scope 오염이고 scope-reviewer 가 정당하게 지적한다" 라고 §F 절 서두에 명시 — 작성자가 scope 경계를 이미 의식적으로 관리한 흔적. 같은 리뷰에서 발견된 I3(`e2e.yml` `paths-ignore` 누락)는 "선재 결함, 이 PR diff 밖" 으로 명시적으로 defer 되어 plan 잔여 항목으로만 등록되고 이번 diff 에는 포함되지 않음 — 인접 결함을 발견해도 전부 흡수하지 않고 선별적으로 경계를 그은 정황
  - 제안: 조치 불요(정보성). 다만 커밋 메시지·plan 양쪽에 이미 "§F 리뷰 W1/W2/I2" 근거가 명시돼 있어 추적성은 충분하다

### 점검 상세 (근거)

리뷰 대상 5개 파일의 실제 diff(병합 기준 `22cc48ef3`→`HEAD`, `git diff --numstat`)를 직접 확인했다 — 프롬프트에 첨부된 "전체 파일 컨텍스트"는 파일 4(`package-lock.json`, 2000줄+ dependency tree)처럼 diff 가 아닌 변경 후 전체 파일이라 diff 크기를 오판할 수 있어, 아래는 `git diff` 로 재확인한 실측이다.

| 파일 | +/- | 내용 |
|---|---|---|
| `.claude/tools/bootstrap-session.sh` | +31/-3 | `_lock_hash()` 신설, install 조건을 `need_install` 변수 기반 2-way(마커 부재 OR 해시 불일치)로 재구성, 설계주석 보강. 섹션 3(GC)·섹션 4(reaper) 등 파일의 다른 부분은 무변경 |
| `.claude/tests/test_bootstrap_mermaid_install.py` | +32/-0 | 순수 추가 — 신규 헬퍼 `_write_lock` + 테스트 2건. 기존 테스트 무변경 |
| `.github/dependabot.yml` | +14/-0(누적) | `npm` ecosystem 엔트리 1건 신설(커밋1) + 주석 정밀화(커밋2, "security update"→"version-update" 스키마 구분). 기존 `github-actions` 엔트리 무변경 |
| `.claude/tools/mermaid-lint/package-lock.json` | +6/-6 | `dompurify` 3.4.7→3.4.12, `undici` 7.27.0→7.28.0 딱 2개 패키지만. `package.json` 의 semver range 는 무변경, 다른 transitive dep 변경 없음 — 커밋 메시지가 명시한 두 CVE 와 1:1 대응 |
| `PROJECT.md` | +1/-1 | 기존 "의존성 취약점 audit·핀 거버넌스" 불릿에 pnpm 워크스페이스 밖 npm 트리는 Dependabot 이 커버한다는 1문장만 추가. 주변 구조·다른 절 무변경 |

포맷팅 전용 변경, 무관 리팩토링, 미사용 임포트, drive-by 주석 삭제/수정은 발견되지 않았다. 모든 신규 주석은 같은 diff 가 도입한 동작을 직접 설명하며, 프로젝트의 기존 컨벤션(파일 내 이미 존재하던 장문 설계주석 스타일, `_file_mtime()` 의 BSD/GNU 크로스플랫폼 폴백과 동일 패턴을 따르는 `_lock_hash()`)과 일관된다. `PROJECT.md`/`dependabot.yml` 문서 갱신은 "사후 보정 PR 패턴 금지 — 같은 turn 원칙" 컨벤션을 준수해 같은 커밋에 반영됐다.

전체 diff(`git diff --stat`, 16 파일)에는 위 5개 외에 `plan/in-progress/harness-guard-followups.md`(체크박스 실제 상태 갱신)와 `review/code/2026/07/18/12_06_58/**`(직전 리뷰 라운드 산출물 커밋)가 포함되지만, 이번 리뷰 라운드(`meta.json`)가 5개 파일만 명시적으로 배정했고 두 카테고리 모두 이 리뷰의 "코드" 스코프가 아닌 정상 워크플로 부산물(plan 갱신·리뷰 산출물 커밋은 프로젝트 컨벤션상 의무)이라 스코프 위반 대상이 아니다.

### 요약

리뷰 대상 5개 파일의 diff 는 두 개의 인과적으로 연결된 목표 — ① `mermaid-lint` npm 트리의 undici HIGH·dompurify moderate 취약점 해소 + Dependabot 편입, ② 그 보안 픽스가 이미 부트스트랩된 checkout 에 실제로 전파되도록 설치완료 마커를 lockfile 해시에 결속 — 에 정확히 대응하며, 각 파일의 변경분이 커밋 메시지·plan 문서가 서술하는 의도를 벗어나지 않는다. ②는 원 태스크명보다 범위가 넓어 보이지만 직전 리뷰 라운드(W1)가 실측한 "픽스가 무의미해지는" 결함을 같은 PR 안에서 처리한 것으로, 프로젝트의 "리뷰 Warning 은 같은 턴에 반영" 규약과 부합하는 정당한 확장이다. 불필요한 리팩토링·포맷팅 잡음·무관한 파일 수정·기능 과잉설계는 발견되지 않았다.

### 위험도
NONE
