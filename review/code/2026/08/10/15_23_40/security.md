# 보안(Security) Review

## 리뷰 범위

이번 라운드(`15_23_40`)는 직전 라운드(`15_11_16`)의 Critical/WARNING 반영분이다. 델타는:

- `--strict-peer-dependencies` 를 나머지 `pnpm install` 호출부 4곳에 확대 적용
  - `.claude/test-stages.sh` (`_ensure_deps()`)
  - `codebase/backend/Dockerfile`
  - `codebase/frontend/Dockerfile`
  - `codebase/frontend/Dockerfile.playwright-e2e`
- 관련 문서/주석 정정 (`.claude/tests/README.md`, `test_pnpm_workspace_action.py` docstring, `eslint-unicorn-peer.spec.ts` 주석, `pnpm-workspace.yaml` 주석, plan 체크리스트)
- 직전 라운드 산출물(`review/code/2026/08/10/15_11_16/**`)이 신규 커밋으로 편입

실행 코드가 바뀐 파일은 셸/Dockerfile/YAML 뿐이며, 전부 기존에 있던 `pnpm install --frozen-lockfile ...` 호출에 `--strict-peer-dependencies` 플래그 하나를 추가하는 동형 변경이다. 애플리케이션 런타임 코드(`codebase/backend/src`, `codebase/frontend` 등)에는 실질적 변경이 없다(`eslint-unicorn-peer.spec.ts` 는 주석만 변경).

## 발견사항

- **[INFO]** `--strict-peer-dependencies` 확대 적용은 OWASP A06(취약/오래된 컴포넌트) 방어를 다섯 호출부 전체로 완성하는 강화 조치
  - 위치: `.claude/test-stages.sh:20`, `codebase/backend/Dockerfile:41`, `codebase/frontend/Dockerfile:38`, `codebase/frontend/Dockerfile.playwright-e2e:52`
  - 상세: 직전 라운드는 `.github/actions/pnpm-workspace/action.yml` 한 곳에만 플래그를 넣고 "유일한 소재지" 라 서술해 requirement reviewer 로부터 CRITICAL 을 받았다(`RESOLUTION.md` §1). 이번 델타로 로컬 하니스(`test-stages.sh`)와 실제 CI 에서 빌드되는 backend/frontend 프로덕션 Dockerfile, e2e Dockerfile까지 동일 플래그가 적용돼, 미충족 peer dependency 가 특정 install 경로에서만 조용히 통과하는 잔여 우회로가 닫혔다. 순수하게 방어적인 변경이며 새로운 위험은 없다.
  - 제안: 해당 없음 (개선 사항으로 기록)

- **[INFO]** 4곳 모두 셸 인젝션 표면을 새로 만들지 않음
  - 위치: `.claude/test-stages.sh:20`, `codebase/backend/Dockerfile:41`, `codebase/frontend/Dockerfile:38`, `codebase/frontend/Dockerfile.playwright-e2e:52`
  - 상세: 추가된 플래그는 리터럴 문자열(`--strict-peer-dependencies`)이며 사용자/외부 입력이 개입할 여지가 없다. `test-stages.sh` 의 `_ensure_deps()` 는 인자를 받지 않고, Dockerfile 3곳의 `RUN pnpm install ...` 줄도 `--filter` 인자가 하드코딩된 문자열(`"backend..."`, `"frontend..."` 등)이라 빌드 인자(`ARG`)나 외부 값이 이 줄에 보간되지 않는다. `.github/actions/pnpm-workspace/action.yml` 의 `env:` 경유 패턴(이미 직전 라운드에서 NONE 판정)도 이번 델타로 변경되지 않았다.
  - 제안: 해당 없음 (확인 사항으로 기록)

- **[INFO]** 하드코딩된 시크릿/자격증명 없음
  - 위치: 델타 전체(10개 실질 변경 파일)
  - 상세: 추가/수정된 내용은 CLI 플래그, 주석, plan 서술, 테스트 argv 기대값뿐이며 API 키·토큰·비밀번호·인증서 패턴은 없다.
  - 제안: 해당 없음

- **[INFO]** 인증/인가, 암호화, 에러 메시지 노출 관련 변경 없음
  - 위치: 델타 전체
  - 상세: 이번 변경은 CI/로컬 의존성 설치 게이팅(빌드 타임 정적 검사)에 국한되며, 런타임 인증/인가 로직, 암호화 알고리즘, 에러 핸들러 어디에도 손대지 않았다.
  - 제안: 해당 없음

- **[INFO]** `review/code/2026/08/10/15_11_16/**` 신규 커밋 편입(11개 파일)은 실행 코드가 아닌 리뷰 산출물(SUMMARY/RESOLUTION/각 reviewer 보고서/메타데이터)이라 보안 영향 없음
  - 위치: `review/code/2026/08/10/15_11_16/RESOLUTION.md`, `SUMMARY.md`, `_retry_state.json`, `meta.json`, `documentation.md`, `maintainability.md`, `requirement.md`, `scope.md`, `security.md`, `side_effect.md`, `testing.md`
  - 상세: 전부 마크다운/JSON 텍스트로, 코드 실행 경로가 없다. 내부 절대경로(`/Volumes/project/private/clemvion/...`)가 `_retry_state.json`/`meta.json` 에 노출되지만 이는 로컬 개발 환경 경로이고 시크릿이 아니며, 이 저장소의 review 산출물 관례상 일반적으로 커밋되는 형태다(CLAUDE.md `review/` 저장 규약).
  - 제안: 해당 없음

## 요약

이번 델타는 직전 라운드에서 requirement reviewer 가 CRITICAL 로 지적한 "게이트가 install 호출부 한 곳에만 있다" 는 결함을 정확히 그 지적대로 해소한 것으로, `--strict-peer-dependencies` 를 저장소의 나머지 4개 `pnpm install` 호출부(로컬 하니스 + Dockerfile 3종)에 균일하게 확대 적용했다. 인젝션 벡터, 하드코딩 시크릿, 인증/인가, 암호화, 에러 노출 등 전형적 보안 취약점 패턴은 이번에도 발견되지 않았고, 오히려 미충족 peer dependency 가 경고로만 흘러 조용히 통과하던 공급망 취약점 클래스(`#1049` 사고)의 잔여 우회로를 닫는 순수 방어적 강화다. 각 호출부의 플래그는 리터럴이며 외부/사용자 입력이 개입하지 않아 새로운 인젝션 표면도 없다.

## 위험도

NONE
