# 보안(Security) 리뷰 — 하네스 가드 후속 A (bootstrap npm install 경쟁 + 부분 설치 영속)

## 리뷰 대상

- `.claude/tests/test_bootstrap_mermaid_install.py` (신규 테스트, 9건)
- `.claude/tools/bootstrap-session.sh` (SessionStart 부트스트랩 스크립트, mermaid-lint 설치 섹션을 완료 마커 + `mkdir` 락으로 교체)
- `.gitignore` (락 디렉토리 `.install.lock/` ignore 패턴 추가)
- `plan/in-progress/harness-guard-followups.md` (계획 문서, 실행 코드 아님)

네 파일 모두 로컬 개발자 하네스(Claude Code CLI 세션 부트스트랩) 영역이며, 네트워크에 노출되는
제품 코드(백엔드/프런트엔드)가 아니다. 사용자 입력·인증 세션·DB 접근·원격 요청 처리가 전혀
없어 OWASP Top 10 의 다수 카테고리(SQLi, XSS, 세션 관리, 인가 우회, SSRF 등)는 이 diff 의 공격
표면에 해당하지 않는다. 위협 모델도 "이미 이 저장소 워킹트리에 쓰기 권한이 있는 로컬
개발자/CI 러너"로 한정된다 — 그 권한이 있다면 이 스크립트를 거치지 않고도 임의 코드 실행이
가능하므로, 이하 발견사항은 전부 그 경계 안에서의 견고성/가용성 관점 참고사항이다.

## 발견사항

- **[INFO]** `mkdir` 락이 비-디렉토리 파일과 충돌하면 조용히 영구 skip 될 수 있음 (낮은 영향, 설계상 fail-open 과 일치)
  - 위치: `.claude/tools/bootstrap-session.sh:58-72` (`if [ -f "$tool_dir/package.json" ] ... ; if mkdir "$lock" ...`)
  - 상세: `$lock`(`$tool_dir/.install.lock`) 경로에 디렉토리가 아닌 일반 파일/심볼릭 링크가 이미
    존재하면 `[ -d "$lock" ]` 가 거짓이라 "stale lock 회수" 분기를 타지 않고, 뒤이은
    `mkdir "$lock"` 도 동일 이름의 기존 항목과 충돌해 실패한다(`2>/dev/null`로 조용히 무시).
    결과적으로 마커 파일이 생길 때까지 매 세션이 설치를 소리 없이 건너뛴다. 다만 이 경로에
    사전에 항목을 심으려면 이미 저장소 워킹트리 쓰기 권한(=신뢰 경계 내부)이 필요하고, 최악의
    결과도 "mermaid lint 가 계속 비활성 상태로 남는다"는 가용성 저하일 뿐 코드 실행·권한
    상승·데이터 유출로 이어지지 않는다. 스크립트 자체가 "bootstrap 은 세션을 절대 막지
    않는다"는 fail-open 을 명시적으로 채택하고 있어 설계 의도와도 부합한다.
  - 제안: 즉각 조치 불요. 필요하면 `mkdir` 실패 원인이 "다른 프로세스가 락 보유 중"인지
    "이름 충돌(비-디렉토리)"인지 구분해 stderr 로그를 남기는 정도의 개선만 고려.

- **[INFO]** stale-lock 탈취의 TOCTOU 윈도우 자체는 원자성 문제로 이어지지 않음 (검증됨), 단 10분
  임계값보다 설치가 더 오래 걸리면 "진행 중인" 락도 탈취될 수 있음
  - 위치: `.claude/tools/bootstrap-session.sh:59-63`
  - 상세: "stale 판정(`find -mmin -10`) → `rmdir` → `mkdir`" 사이에 여러 프로세스가 동시에
    진입할 수 있으나, 최종 락 획득은 `mkdir` 시스템콜의 원자성(POSIX `mkdir(2)` 는 `EEXIST` 로
    실패)에 의해 단 하나의 프로세스만 성공한다. 여기까지는
    `test_concurrent_sessions_install_at_most_once`(5개 동시 프로세스, 구코드에서 실패 확인된
    비-vacuous 테스트)가 실측 검증한다. 다만 이 임계값은 "락 mtime" 기준이라, 만약 `npm
    install` 자체가 (네트워크 문제 등으로) 10분을 초과해 여전히 실행 중이라면 그 락도
    "stale" 로 오판되어 다른 세션이 탈취해 두 번째 `npm install` 을 같은 트리에 동시 실행할 수
    있다 — 이번 패치가 고치려는 원 결함(동시 설치로 인한 부분/손상 `node_modules`)이 극단적
    상황에서 좁게 재발할 수 있는 여지다. 코드 주석이 "락이 영구히 wedge 되는 것이 원 결함보다
    나쁘다"는 트레이드오프를 명시적으로 선택한 결과이고, 테스트 스위트도 "죽은 홀더(활성
    프로세스 없음)" 시나리오만 실측하며 "10분 넘게 활성 상태인 설치" 케이스는 다루지 않는다.
    보안 취약점이라기보다 알려진/문서화된 견고성 트레이드오프.
  - 제안: 즉각 조치 불요. 필요하면 임계값을 넉넉히(예: 설치 실측 최대 소요시간 + 여유분)
    올리거나, 락 파일에 홀더 PID 를 기록해 "그 PID 가 여전히 살아있는지"까지 확인하는 2차
    가드를 후속 검토.

- **[INFO]** (diff 범위 밖, 참고) `mermaid-lint/package.json` 의 미고정 버전(`"jsdom": "*"`,
  `"mermaid": "*"`) + 기존 `npm install --no-audit` 조합
  - 위치: `.claude/tools/mermaid-lint/package.json`(이번 diff 에 포함되지 않음), 참고:
    `.claude/tools/bootstrap-session.sh:65`(`npm install --no-fund --no-audit --silent` —
    `--no-audit` 플래그는 diff 이전부터 존재, 이번 변경이 추가/제거하지 않음)
  - 상세: 두 요소가 겹치면 향후 `npm install` 실행 시 상위 버전에 알려진 취약점이 포함돼도
    설치 단계에서 감지되지 않는다. 다만 같은 디렉토리에 `package-lock.json`(lockfileVersion 3,
    resolved/integrity 포함)이 실제로 존재함을 확인했고, `npm install`(인자 없는 형태)은
    lockfile 을 우선 존중하므로 즉시 임의 최신 버전이 당겨지는 것은 아니다. 다만 이번 PR 이
    설치 성공률을 높이는 결함(경쟁·부분 설치 영속)을 고쳐 해당 npm install 경로가 더 자주
    실제로 실행되게 된 만큼, 별도 후속으로 버전 고정(`^`/정확 버전) 또는 주기적
    `npm audit`/Dependabot 류 점검을 고려할 가치는 있다. 이번 diff 가 새로 만든 문제는
    아니므로 이 PR 을 막을 사유는 아니다.

- 하드코딩된 시크릿, 인젝션(커맨드/경로 탐색 포함), 인증/인가 우회, 안전하지 않은 암호화,
  민감정보 에러 노출 — **해당 없음**. 신규 bash 라인의 변수 확장(`$tool_dir`, `$marker`,
  `$lock`)은 모두 큰따옴표로 정확히 인용되어 word-splitting/glob 인젝션 위험이 없고,
  `eval`·간접 실행·사용자 입력 반영이 전혀 없다. `$main_root` 는 `git rev-parse
  --path-format=absolute --git-common-dir` 로 산출되는 신뢰된 로컬 값이며 이번 diff 가 건드리지
  않는다. 실패 메시지("bootstrap: mermaid-lint install failed (lint will fail open)")도 경로나
  환경 세부정보를 노출하지 않는 정적 문자열이다. 테스트 파일도 `subprocess.run` 을 리스트
  인자로만 호출(`shell=True` 없음)하고, `tempfile.mkdtemp()`(기본 0700 권한)로 격리된 임시
  디렉토리 안에서만 동작해 npm 스텁·로그 파일이 다른 사용자/프로세스에 노출되지 않는다.
  `.gitignore` 항목과 plan 문서에도 시크릿·자격증명 유사 문자열은 없다(plan 문서의
  `BYPASS_*` 언급은 다른 파일에 그런 이름의 환경변수가 "존재한다"는 서술일 뿐 실제 값이나
  신규 우회 로직이 아니다).

## 요약

이번 변경은 Claude Code 세션 부트스트랩 스크립트의 mermaid-lint npm install 을 완료 마커 +
`mkdir` 원자적 락으로 감싸 경쟁 조건과 부분 설치 영속 문제를 고치는 로컬 개발 도구성 패치다.
사용자 입력·네트워크 요청·인증/세션·DB 를 다루지 않아 전형적인 OWASP Top 10 공격 표면과
무관하며, 신규로 추가된 셸 변수는 모두 올바르게 인용돼 있고 락 메커니즘도 `mkdir` 원자성에
기반해 안전하다(동시 5-프로세스 테스트로 구코드 대비 회귀 실증). 하드코딩 시크릿·인젝션·인가
우회·안전하지 않은 암호화·민감정보 노출 등 실질적 취약점은 발견되지 않았다. 언급할 가치가
있는 것은 두 가지 낮은 영향의 견고성 엣지케이스(비-디렉토리 이름 충돌 시 영구 skip, 10분
초과 설치의 락 탈취 재경합 가능성)와 diff 범위 밖의 기존 `package.json` 와일드카드 버전 +
`--no-audit` 조합인데, 셋 다 이번 PR 이 새로 만든 문제가 아니거나(마지막 항목) 이미 설계상
의도된 트레이드오프이며(앞의 두 항목) 즉각적 위험도 낮아 참고 수준의 기록으로 남긴다.

## 위험도

LOW
