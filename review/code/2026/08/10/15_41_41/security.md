# 보안(Security) Review

## 리뷰 범위

이번 라운드(`15_41_41`)는 직전 라운드(`15_23_40`, security 판정 NONE)와 diff-base 가 같다.
직전 라운드 대비 실제 델타는 (오케스트레이터 안내대로) 다음뿐이다:

- 신규 정적 가드 `.claude/tests/test_install_gate_flags.py` (146줄, 전체 신규)
- `.claude/tests/test_review_guard_hardening.py` 의 카탈로그 dict 에 위 신규 가드 설명 1행 추가
- `codebase/backend/src/repo-guards/__tests__/eslint-unicorn-peer.spec.ts` 주석 문구 정정(테스트를
  남기는 이유 재서술)
- `.github/actions/pnpm-workspace/action.yml` 상단 주석에 "여기가 유일한 소재지가 아니다" 라는
  문구 보강

실행 경로가 바뀌는 코드는 없다 — 위 4곳 모두 테스트 코드/주석이다. `pnpm install
--frozen-lockfile --strict-peer-dependencies` 를 5개 소재지(`action.yml`, `test-stages.sh`,
backend/frontend/playwright-e2e 3개 Dockerfile)에 균일 적용하는 본체 변경은 직전 라운드에서
이미 검토돼 NONE 판정을 받았고 이번 라운드에서 재변경되지 않았다.

## 발견사항

- **[INFO]** 신규 가드 `test_install_gate_flags.py` 는 인젝션 표면을 만들지 않는다
  - 위치: `.claude/tests/test_install_gate_flags.py:110`(`subprocess.run(["git", "grep", ...])`), `:129`(같은 패턴 반복)
  - 상세: `subprocess.run` 을 리스트 인자(`shell=True` 아님)로만 호출하고, 인자는 전부 리터럴
    문자열(`"git"`, `"grep"`, `"-l"`, `"pnpm install"`, 고정 경로 목록)이다. 외부/사용자 입력이
    개입할 여지가 없어 커맨드 인젝션 벡터가 없다. 파일 읽기(`(REPO_ROOT / rel).read_text(...)`)도
    `rel` 이 상수 튜플 `SITES`/`git grep` 결과(저장소 내부 트래킹 파일 경로)로만 채워져 경로
    탈출 여지가 없다.
  - 제안: 해당 없음 (확인 사항으로 기록)

- **[INFO]** 신규 가드는 방어를 약화시키지 않고 커버리지를 넓히는 순수 강화
  - 위치: `.claude/tests/test_install_gate_flags.py` 전체(`KnownSitesCarryBothFlagsTest`, `TheSiteListHasNotGoneStaleTest`)
  - 상세: 직전 라운드 CRITICAL(`RESOLUTION.md` §1 — 게이트가 install 호출부 한 곳에만 있었던
    결함)의 재발을 막는 정적 대조 가드다. "등재된 5곳이 두 플래그를 다 다는가" 와 "등재 안 된
    새 install 지점이 생겼는가" 를 별도 테스트로 분리해, 목록 밖에 새 install 지점이 조용히
    생겨도 감지한다. 공급망 방어(`--strict-peer-dependencies`, `#1049` 클래스)가 우회 없이
    유지되도록 하는 회귀 가드로, 보안 관점에서 순수하게 긍정적이다.
  - 제안: 해당 없음

- **[INFO]** 문구 정정 3곳은 서술만 바뀌었고 실제 방어 로직/조건에는 영향 없음
  - 위치: `.claude/tests/test_review_guard_hardening.py`(카탈로그 dict 신규 행), `codebase/backend/src/repo-guards/__tests__/eslint-unicorn-peer.spec.ts`(주석 재서술), `.github/actions/pnpm-workspace/action.yml`(주석 보강)
  - 상세: 세 곳 모두 주석/테스트 설명 문자열 변경이며 `run:`/조건문/단언 로직은 그대로다.
    `eslint-unicorn-peer.spec.ts` 는 "게이트가 설치 시점 미충족을, 이 테스트는 매니페스트
    floor 대 설치본의 어긋남을 본다" 는 서술로, 신규 CI 게이트 도입 이후에도 이 회귀 테스트를
    유지하는 근거를 남긴 것 — 축소가 아니라 근거 보강이다.
  - 제안: 해당 없음

- **[INFO]** 하드코딩된 시크릿/자격증명 없음, 인젝션·인증/인가·암호화·에러 노출 관련 변경 없음
  - 위치: 델타 전체
  - 상세: `grep -niE "api[_-]?key|secret|password|token|BEGIN ...|Authorization: |aws_access"` 로
    프롬프트 전체를 확인한 결과, 매치는 라우팅 사유 문자열 안의 "USER·secret·port·privileged
    (security)" 카테고리 라벨 하나뿐이며 실제 시크릿 값이 아니다. 애플리케이션 런타임 코드
    (`codebase/backend/src`, `codebase/frontend`)에는 실질 변경이 없다.
  - 제안: 해당 없음

- **[INFO]** `pnpm-workspace.yaml` 의 `peerDependencyRules` 부재는 fail-closed 로 문서화됨
  - 위치: `pnpm-workspace.yaml`(peer dependency 게이트 주석 블록)
  - 상세: 착수 근거였던 `nunjucks → chokidar` optional peer 미충족이 실측(exit 0, unmet peer
    0건)으로 이미 해소된 것으로 확인되어, 억제 규칙을 넣지 않고 빈 상태로 유지했다. 주석은
    "막을 대상이 없는 억제는 죽은 설정이고 나중에 진짜 미충족을 조용히 덮는다(fail-open)"
    는 근거를 명시해, 향후 예외 추가 시에도 "왜 안전한가" 를 실측 근거로 요구하는 절차를
    남겼다. 공급망 보안(OWASP A06 취약/오래된 컴포넌트) 관점에서 바람직한 fail-closed 기본값.
  - 제안: 해당 없음

## 요약

이번 라운드는 직전 라운드에서 이미 NONE 판정을 받은 `--strict-peer-dependencies` 5곳 확대
적용 자체에는 변경이 없고, 그 회귀를 정적으로 고정하는 신규 테스트 가드(`test_install_gate_flags.py`)
와 관련 주석/카탈로그 문구 정정 3곳만 델타다. 신규 가드는 `subprocess.run` 을 리스트 인자로만
호출하고 모든 경로/명령 인자가 리터럴 상수라 인젝션 표면이 없으며, 오히려 게이트가 재차 좁아지는
것을 잡아내는 순수 방어 강화다. 하드코딩된 시크릿, 인증/인가 변경, 암호화 약화, 민감정보 노출
등 전형적 보안 취약점 패턴은 이번 델타에서도 발견되지 않았다.

## 위험도

NONE
