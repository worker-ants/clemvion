# 요구사항(Requirement) 리뷰

## 재검증 지시사항에 대한 답 — 호출부는 정말 5곳뿐인가

직전 라운드 CRITICAL("게이트가 install 호출부 한 곳에만 있다")에 대한 조치가 "5곳 전부"라고
주장하는데, 그 열거를 액면가로 받지 않고 저장소 전체를 독립적으로 훑었다.

```
grep -rn "pnpm install" --include="*.yml" --include="*.yaml" --include="*.sh" \
  --include="Dockerfile*" --include="*.mjs" --include="*.js" --include="*.ts" --include="*.py" .
```
및 `find . -iname "Dockerfile*"`, docker-compose `command:` 오버라이드, `pnpm i `/`pnpm add ` 축약형
전수 검색 결과, 실제로 **실행되는** `pnpm install` 호출부는 다음 5곳이 전부임을 확인했다 — 그 이상도
이하도 아니다.

1. `.claude/test-stages.sh:20` (`_ensure_deps()`) — `cmd_lint`/`cmd_unit`/`cmd_build` 세 곳이 전부
   이 함수를 거친다(48/57/66행에서 `_ensure_deps &&` 확인). 주석이 말하는 `_ensure_web_chat_deps`
   특수처리도 이 한 함수로 수렴하고, 우회하는 별도 `pnpm install` 은 없다.
2. `.github/actions/pnpm-workspace/action.yml:87`
3. `codebase/backend/Dockerfile:41`
4. `codebase/frontend/Dockerfile:38`
5. `codebase/frontend/Dockerfile.playwright-e2e:52`

**5곳 전부에 `--strict-peer-dependencies` 가 실제로 붙어 있음을 파일을 직접 열어 확인했다** (grep
결과 각 파일에서 `--frozen-lockfile --strict-peer-dependencies` 동시 매치).

추가로 확인한 인접 사실 — 새 결함 아님, 참고용:

- `codebase/backend/migrations/Dockerfile` 은 `flyway/flyway:10-alpine` 기반이라 pnpm/node 자체가
  없음 — 6번째 호출부가 아니다.
- `docker-compose.yml`/`docker-compose.e2e.yml` 의 `command:` 오버라이드 중 `pnpm install` 을 부르는
  것은 없음(모두 `pnpm run start:dev`/`pnpm run dev`/`pnpm run test:e2e` 처럼 이미 설치된
  node_modules 를 전제로 한 런타임 커맨드).
- `.claude/tests/test_check_e2e_playwright_config.py:110` 의 `RUN pnpm install --frozen-lockfile
  --filter "frontend..."` 문자열은 **합성 fixture**(`make_repo()` 헬퍼가 만드는 가짜 임시
  Dockerfile) 다 — 그 가드(`scripts/check-e2e-playwright-config.py`)는 `pnpm install`/`RUN` 문자열
  자체를 전혀 읽지 않고 COPY 목록·base 태그만 검사한다(`grep -n "pnpm install\|RUN " scripts/check-e2e-playwright-config.py` → 0건). 실제 계약을 고정하지 않으므로 갱신 대상이 아니다 — false lead.
- `.github/workflows/deps-security-checks.yml` 은 `pnpm audit`/`pip install`/두 python 스크립트만
  실행하고 `pnpm install` 자체가 없음을 직접 확인했다 — `pnpm-workspace.yaml:126-129` 가 이제
  올바르게 `.github/actions/pnpm-workspace/action.yml` 을 소재지로 지목하는 것이 맞다(이전 라운드가
  잘못 지목했던 파일이 아님).
- 소비자 수 "9개 잡 / 5개 워크플로 파일" 도 `grep -c "uses: \./\.github/actions/pnpm-workspace"
  .github/workflows/*.yml` 로 직접 재계산해 확인 — `backend-checks.yml`×3, `web-chat-checks.yml`×3,
  `frontend-checks.yml`/`packages-checks.yml`/`spec-link-checks.yml`×1 = 9. 정확하다.
- `.claude/tests/test_pnpm_workspace_action.py` 를 직접 실행 — **12/12 OK**. `ARGC=5` (`install`,
  `--frozen-lockfile`, `--strict-peer-dependencies`, `--filter`, `<scope>`) 는 스텁이 받은 진짜
  `$#` 를 실행해 얻은 값과 일치한다(리터럴 유지 근거도 타당 — `len(argv(proc))` 유도는 자기 자신과
  비교하는 꼴이 된다는 지적이 맞다).

즉 이번 조치 자체는 **완전하다** — 직전 CRITICAL 은 유효하게 해소됐고, 놓친 6번째 호출부는 없다.

## 발견사항

- **[WARNING]** 5개 호출부 중 4곳(`.claude/test-stages.sh`, 3개 Dockerfile)은 `--strict-peer-dependencies`
  가 붙어 있다는 사실을 **고정하는 자동 테스트가 없다** — 오직 composite action 한 곳만
  `test_pnpm_workspace_action.py::InstallCommandTest` 가 실제 argv 를 실행 검증으로 고정한다.
  - 위치: `.claude/test-stages.sh:20`, `codebase/backend/Dockerfile:41`,
    `codebase/frontend/Dockerfile:38`, `codebase/frontend/Dockerfile.playwright-e2e:52` — 이 4개
    파일 중 어느 것도 `.claude/tests/`, `codebase/*/src/repo-guards/` 어디에도 `--strict-peer-dependencies`
    를 검색하면 매치되지 않는다(`grep -rln "strict-peer-dependencies" .claude/tests/ scripts/
    codebase/*/src/repo-guards/` → `test_pnpm_workspace_action.py`, `.claude/tests/README.md`,
    `eslint-unicorn-peer.spec.ts` 셋뿐 — 전부 composite action 또는 매니페스트 floor 관점이지 이
    4개 파일의 `RUN` 줄을 직접 겨냥하지 않는다).
  - 상세: 이 plan §1 이 존재하는 이유 자체가 "`#1049` 처럼 미충족 peer 가 **경고만 내고 조용히
    통과**하는 사고를 다시 못 나게" 다. 그런데 지금 상태는, 예를 들어 누군가 향후
    `codebase/backend/Dockerfile:41` 을 편집하다가 실수로(또는 캐시 최적화를 시도하다가)
    `--strict-peer-dependencies` 를 지워도 — 이 저장소의 CI/하니스 테스트 스위트 어디에서도 RED 가
    나지 않는다. 정확히 이 티켓이 막으려는 것과 같은 클래스의 "조용한 회귀" 다. composite action
    에 대해서는 이미 그 패턴의 가드(`test_pnpm_workspace_action.py`, YAML `run:` 블록을 파싱해 실제
    bash 로 실행하고 스텁이 받은 argv 를 비교)가 있고 이번 diff 가 정확히 그 가드를 함께 갱신했다 —
    같은 수준의 보호가 나머지 4곳에는 없다는 뜻이다. 이 갭 자체는 이번 requirement 리뷰 라운드가
    이미 반쯤 발견했었다 — `review/code/2026/08/10/15_11_16/requirement.md` 의 CRITICAL 제안란에
    "재발 방지를 원하면 `test_pnpm_workspace_action.py` 류의 '받는 쪽 인자 확인' 패턴을 각
    Dockerfile/`test-stages.sh` 에도 적용하는 가드를 별도 후속으로 고려" 라고 이미 적어 뒀는데,
    RESOLUTION.md 는 "5곳 전부 적용" 만 조치로 기록했고 이 후속 제안은 plan 체크리스트에도
    등재되지 않았다 — 제안이 채택도 명시적 defer 도 되지 않은 채 누락됐다.
  - 제안: `test_pnpm_workspace_action.py` 가 쓰는 패턴(YAML/Dockerfile 의 `RUN`/`run:` 문자열을
    파싱해 실제 셸로 실행하고 스텁이 받은 argv 를 비교)을 나머지 4곳에도 적용하는 가드를
    새로 만들거나, 최소한 `plan/in-progress/deps-peer-gating-and-eslint10.md` §1 체크리스트에
    "나머지 4곳은 argv 가드 없음 — 후속" 항목으로 명시적으로 등재해 둘 것. 지금 당장 코드 fix 를
    요구하는 성격은 아니지만(현재 5곳 전부 정확히 적용돼 있으므로 기능은 충족), 완료로 체크된
    항목이 "재발 방지" 라는 티켓의 존재 이유를 4/5 지점에서 실은 충족하지 못한다는 점은 완료
    판정 전에 알려야 한다.

- **[INFO]** `README.md:149` 의 온보딩 안내(`pnpm install`, 옵션 없음)는 이번 게이트 대상에서
  빠져 있다.
  - 위치: `README.md:149`
  - 상세: 이는 개발자가 로컬에서 최초 1회 수동 실행하는 문서 안내이지, CI/하니스가 실행하는 자동
    호출부가 아니다. plan §1 이 조치 후보로 적은 "CI/로컬 게이트" 의 "로컬" 은 문맥상
    `.claude/test-stages.sh` 의 하니스 게이트를 가리키는 것으로 읽히고(실제로 그 파일이 조치
    대상에 포함됨), README 온보딩 명령까지 포함한다고 보기는 어렵다. 다만 문언 그대로 "저장소의
    모든 `pnpm install` 호출부" 라는 주장을 엄밀하게 읽으면 이 줄이 예외로 빠져 있다는 사실은
    남는다 — 이 사고 클래스(#1049)의 최초 발견도 결국 "사람이 로그를 읽다가" 였으므로, 로컬
    개발자가 이 명령으로 설치할 때도 같은 경고가 여전히 조용히 지나간다는 점은 완전한 방어를
    주장하려면 언급할 가치가 있다.
  - 제안: 조치 불요(현재 스코프 판단이 합리적) — 다만 plan 또는 README 주석에 "로컬 최초 설치
    안내는 이 게이트 대상이 아니다" 를 한 줄 명시하면 향후 "왜 여기는 빠졌나" 질문을 예방한다.

- **[INFO]** spec fidelity — `spec/` 전체에서 `strict-peer-dependencies`·`peerDependencyRules`·
  `pnpm-workspace`·`deps-guard-hardening`·`frozen-lockfile` 를 검색해도 매치가 없음을 직접
  재확인했다(`grep -rli ... spec/` → 매치 0). CI/의존성 하니스 영역은 `spec/` SoT 범위 밖이라는
  CLAUDE.md 의 정의와 일관되므로 spec 문서 부재는 결함이 아니라 단순 관할 밖(INFO) 판정이 맞다.
  직전 라운드의 같은 결론에 동의한다.

- **[INFO]** 나머지 항목(pnpm-workspace.yaml 소재지 정정, README/테스트 카탈로그 정정,
  eslint-unicorn-peer.spec.ts 주석 정정, 소비자 수 정정)은 `RESOLUTION.md` 가 조치했다고 주장하는
  대로 현재 워킹트리 파일에 실제로 반영돼 있음을 각각 직접 열어 확인했다 — 재론할 결함 없음.

## 요약

직전 라운드 CRITICAL("게이트가 install 호출부 한 곳에만 있다")에 대한 조치는 완전하다 — 저장소
전체를 독립적으로 재검색한 결과 실제 `pnpm install` 실행 호출부는 정확히 5곳이고(하니스
`_ensure_deps` · composite action · backend/frontend/e2e 세 Dockerfile), 5곳 모두 `--strict-peer-dependencies`
를 실제로 갖고 있으며, 6번째 놓친 호출부는 없다. 소비자 수(9잡/5워크플로)·게이트 소재지 정정·테스트
12/12 통과도 모두 직접 재실측해 일치를 확인했다. 다만 이 fix 가 만든 새로운 비대칭을 하나 발견했다
— 5곳 중 composite action 한 곳만 실행-검증 테스트(`test_pnpm_workspace_action.py`)로 플래그
존재가 고정돼 있고, 나머지 4곳(`test-stages.sh`, Dockerfile ×3)은 향후 누군가 그 줄을 편집하다
플래그를 실수로 지워도 어떤 테스트도 잡지 못한다 — 정확히 이 티켓이 재발을 막으려는 "조용한 통과"
클래스다. 직전 라운드 requirement 리뷰가 제안란에 이미 이 후속 가드를 언급했지만 RESOLUTION 은
채택도 명시적 defer 도 하지 않고 조용히 빠뜨렸다. 현재 기능은 정확하므로 CRITICAL 은 아니지만,
"게이트 도입 완료"라는 plan 체크리스트 서술이 재발 방지 관점에서는 4/5 지점만 절반의 보증이라는
점을 완료 판정 전에 반영할 필요가 있다.

## 위험도

LOW
