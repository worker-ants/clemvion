# 부작용(Side Effect) Review

## 특별 조사: Docker 빌드 컨텍스트(부분 복사) 에서 `--strict-peer-dependencies` 가 로컬과 다른 결과를 낼 수 있는가

**결론: 새 실패를 만들지 않는다.** 정적 분석 + 격리된 실측(실제 `docker build` 는 하지 않음) 둘 다로 확인했다.

**방법**: `codebase/backend/Dockerfile` 의 `deps` 스테이지가 실제로 복사하는 파일만 그대로 골라
(`/private/tmp/.../scratchpad/docker-sim-backend`, repo 밖 scratch 디렉터리) 재현했다 — 워크스페이스
10개 멤버의 `package.json` **전부** + "backend closure" 5개 내부 패키지(ai-end-reason·expression-engine·
node-summary·chat-channel-validation·graph-warning-rules)의 **전체 소스**만 복사하고 `sdk`·`web-chat-sdk`
는 매니페스트만 두었다(Dockerfile 과 동일한 selective COPY). 그 위에서
`pnpm install --frozen-lockfile --strict-peer-dependencies --filter "backend..." --offline` 을 실행 —
`Scope: 6 of 11 workspace projects`, 5개 내부 패키지 `prepare`(tsc) 전부 성공, **`EXIT:0`, unmet peer
0건**. (진짜 repo/node_modules 는 다른 세션과 공유되므로 건드리지 않았다 — repo 밖 scratch 사본에서만 실행.)

**왜 구조적으로도 안전한가** (실측 1회로 끝내지 않고 근거를 셋으로 좁힘):
1. 3개 Dockerfile 전부(`codebase/backend/Dockerfile:15-25`, `codebase/frontend/Dockerfile:20-31`,
   `codebase/frontend/Dockerfile.playwright-e2e:24-35`) 가 install `RUN` 줄 이전에 **워크스페이스
   10개 멤버의 `package.json` 을 예외 없이 전부** COPY 한다 — 그래서 `--frozen-lockfile` 의
   "매니페스트 vs lockfile" 정합 검사가 로컬 풀 체크아웃과 다른 결과를 낼 여지가 없다.
2. 5곳(액션·`test-stages.sh`·Dockerfile ×3) 모두 `--frozen-lockfile` 을 **함께** 쓴다 — 재해석
   (re-resolution) 이 금지되므로, 어디서 돌리든 커밋된 `pnpm-lock.yaml` 에 이미 박힌 동일한
   해소 그래프를 그대로 읽는다.
3. `--strict-peer-dependencies` 의 판정(충족/미충족)은 그 해소 그래프 안에서 **패키지 인스턴스 단위**
   속성이지, "옆에 어떤 형제 패키지가 물리적으로 존재하는가" 의 함수가 아니다. `--filter` 는 어느
   importer 를 **검사 대상에 포함시킬지**만 좁힐 뿐이라, 이미 충족된 peer 를 미충족으로 뒤집을 수
   없다 — 오히려 filter 가 걸린 Docker/액션 설치들은 `test-stages.sh` 의 전체 워크스페이스 설치가
   보는 집합의 **부분집합**만 검사한다(반대 방향: 커버리지가 좁아질 순 있어도, 전체 설치에서 안
   걸리던 것이 filter 설치에서 새로 걸릴 순 없다).

부수 확인: `codebase/frontend/Dockerfile:34`(diff 밖 컨텍스트 줄, 실제로는 unified diff 문맥에 `COPY
codebase/packages ./codebase/packages` 로 나타남)는 backend/e2e 와 달리 **`codebase/packages` 전체를
통째로** 복사하므로 이 클래스의 위험에 backend/e2e 보다도 덜 노출된다.

## 발견사항

- **[INFO]** 이번 변경은 저장소 전역 CI/로컬 install 계약을 동시에 바꾸는 **광역(blast-radius) 인터페이스 변경**
  - 위치: `.github/actions/pnpm-workspace/action.yml:87` (SoT) + `.claude/test-stages.sh:20` +
    `codebase/backend/Dockerfile:41` + `codebase/frontend/Dockerfile:38` +
    `codebase/frontend/Dockerfile.playwright-e2e:52`
  - 상세: `--strict-peer-dependencies` 가 한 번에 6개 독립 호출부(액션을 통해 9개 잡/5개 워크플로 +
    로컬 dev 스크립트 + Docker 이미지 빌드 3종)에 적용된다. 앞으로 어느 워크스페이스 패키지든
    peer 미충족을 새로 들이면, 종전에는 경고로 흘러가던 것이 이제 **동시에 여러 CI 잡 + 로컬
    `_ensure_deps` + 3개 Docker 이미지 빌드를 fail** 시킨다. 의도된 게이트(정확히 그게 목적)이고
    5개 파일 모두 그 이유를 주석으로 충분히 남겨 뒀으므로 결함은 아니다 — 다만 "부작용" 관점에서
    "한 줄 변경이 저장소 전역 빌드 계약을 바꾼다"는 사실 자체는 리뷰 기록에 남길 값어치가 있다.
  - 제안: 조치 불요(이미 plan §1 체크리스트·`pnpm-workspace.yaml` 신설 주석·`RESOLUTION.md` 에 5곳
    전부가 명시적으로 열거돼 있어 "숨은" 광역 변경이 아니다).

- **[INFO]** `test_pnpm_receives_frozen_lockfile_and_the_filter` → `test_pnpm_receives_both_gate_flags_and_the_filter` 테스트 메서드 rename
  - 위치: `.claude/tests/test_pnpm_workspace_action.py:107`
  - 상세: 외부에 공개된 API/시그니처가 아니라 내부 테스트 메서드명이라 호출자 영향은 없다. 같은
    diff 안에서 `.claude/tests/README.md:52` 카탈로그 행도 동반 갱신됐고, **현재 유효한**
    코드·문서(`.claude/tests/**`, `.github/**`, `codebase/**`)에는 옛 이름을 참조하는 잔존
    문자열이 없다 — `grep -r` 결과 남은 건 `review/code/2026/08/09/**`·`review/code/2026/08/10/15_11_16/**`
    처럼 과거 라운드의 **리뷰 감사 기록**뿐이고, 이는 그 시점 스냅샷이라 갱신 대상이 아니다.
  - 제안: 조치 불요.

- **[INFO]** 리뷰 세션 산출물(`review/code/2026/08/10/15_11_16/*.md`, `_retry_state.json`)이 diff 에
  새 파일로 포함됨
  - 위치: `review/code/2026/08/10/15_11_16/` 전체
  - 상세: `_retry_state.json` 에 이 워크트리의 **절대 로컬 경로**(`/Volumes/project/private/clemvion/...`)
    가 그대로 박혀 커밋된다. 다른 머신/워크트리에서는 의미 없는 경로가 되지만, `git log --oneline --
    'review/code/**/_retry_state.json'` 로 확인한 결과 이 저장소는 수십 개 과거 리뷰 라운드에서
    동일한 패턴(session-local 절대경로 포함 `_retry_state.json` 커밋)을 이미 반복해 왔다 — 이번
    diff 가 새로 도입한 관행이 아니라 기존 확립된 관례를 그대로 따른 것이다. `review/**` 는
    gitignore 대상이 아니며 그 자체가 감사 기록(audit trail) 의도라 파일시스템 부작용으로 보지
    않는다.
  - 제안: 조치 불요(선례와 일치).

## 이 라운드가 확인한 것 (부작용 없음)

- **의도치 않은 상태 변경 / 전역 변수**: 없음 — 순수 설정(YAML/shell 플래그)·주석·plan·테스트
  문자열 변경뿐, 런타임 전역 상태를 만지는 코드 변경이 아니다.
- **파일시스템 부작용**: `pnpm-workspace.yaml` 은 주석만 추가됐고 `peerDependencyRules:` 같은 실제
  키는 넣지 않았다(plan 이 "죽은 억제 규칙을 안 남긴다" 고 명시한 그대로) — `grep -n
  "peerDependencyRules" pnpm-workspace.yaml` 로 확인해도 등장하지 않는다. 신규 파일 생성은 위
  리뷰 산출물뿐이고 기존 확립된 패턴과 일치.
- **시그니처/인터페이스 변경**: 유일한 "시그니처" 성격 변경은 테스트 메서드 rename(위 INFO) 뿐이고
  공개 API/함수 시그니처 변경은 없음.
- **환경 변수**: 새로 읽거나 쓰는 환경 변수 없음. `.github/actions/pnpm-workspace/action.yml` 은
  기존과 동일하게 `FILTER` 를 `env:` 로만 전달(`run:` 문자열 직접 삽입 아님 — 인젝션 방지 규율
  불변, `action.yml:85-87`).
- **네트워크 호출**: 새로 추가된 외부 서비스 호출 없음. `pnpm install` 자체는 기존에도 있던
  호출이고, 이번 diff 는 그 호출에 플래그 하나를 얹을 뿐 새 엔드포인트를 만들지 않는다.
- **이벤트/콜백**: 해당 없음(빌드 스크립트/설정 변경, 이벤트 기반 코드 없음).

## 검증

- `pnpm --version` → `10.23.0` (실측 — 로컬/Dockerfile.playwright-e2e 의 fallback pin 과 일치)
- Docker `deps` 스테이지의 정확한 COPY 패턴을 repo 밖 scratch 디렉터리에 재현 →
  `pnpm install --frozen-lockfile --strict-peer-dependencies --filter "backend..." --offline` →
  `EXIT:0`, `Scope: 6 of 11 workspace projects`, 5개 내부 패키지 prepare(tsc) 전원 성공, unmet peer
  0건 (상세는 위 "특별 조사" 절).
- `grep -rn "uses: ./.github/actions/pnpm-workspace" .github/workflows/*.yml` → 9회 등장(backend-checks
  ×3, frontend-checks ×1, web-chat-checks ×3, spec-link-checks ×1, packages-checks ×1(matrix)) —
  plan/주석이 주장하는 "9개 잡 / 5개 워크플로 파일" 과 정확히 일치.
- `pnpm-workspace.yaml` 에 `peerDependencyRules` 키가 실제로 부재함을 확인(주석에서 주장한 그대로).
- 반복된 실측이 필요한 세션 전용 파일(`_retry_state.json`)의 절대경로 관행은 `git log` 로 다수
  선례 확인 — 이번 diff 가 새로 만든 위험이 아님.

## 요약

이번 diff 는 `--strict-peer-dependencies` 게이트를 원래 소재지였던 GitHub composite action
한 곳에서 나머지 4개 install 호출부(`test-stages.sh`, Dockerfile ×3)로 확장한 후속 라운드로,
이전 라운드(`15_11_16`)의 CRITICAL/WARNING 5건이 이미 전부 반영된 상태를 리뷰 대상으로 한다.
특별히 조사가 요청된 "Docker 빌드 컨텍스트의 부분 복사가 `--strict-peer-dependencies` 로 새 실패를
만들 수 있는가" 는 정적 분석(모든 Dockerfile 이 10개 워크스페이스 manifest 를 예외 없이 먼저
복사 + `--frozen-lockfile` 로 재해석을 금지 + peer 판정이 lockfile 그래프의 패키지-단위 속성이라
형제 패키지 물리적 존재와 무관)과, repo 밖 scratch 사본에서 backend Dockerfile 의 실제 COPY 형태를
재현한 격리 실측(exit 0, unmet peer 0건) 둘 다로 부정됐다 — 새 실패를 만들지 않는다. 남은 발견은
모두 INFO 수준(의도된 광역 계약 변경의 존재 자체를 기록, 내부 테스트 rename, 확립된 리뷰 산출물
커밋 관례)이며 조치가 필요한 CRITICAL/WARNING 은 없다.

## 위험도

LOW
