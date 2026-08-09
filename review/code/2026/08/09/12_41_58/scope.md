# 변경 범위(Scope) 리뷰

## 발견사항

- **[INFO]** PR 의 1차 목적(required-check skip-job 패턴 전환: `deps-security-checks.yml`/`frontend-checks.yml` + 회귀 가드)과 별개로, **의존성 보안 패치**(`nanoid` override 신설, `dompurify` 3.4.12→3.4.13)가 같은 PR 에 번들돼 있다.
  - 위치: `pnpm-workspace.yaml:62`(nanoid override), `codebase/channel-web-chat/package.json:15`, `codebase/frontend/package.json:47`, `scripts/check-pnpm-security-config.py:54`
  - 상세: 두 관심사(CI 배선 리팩터 vs 보안 패치)가 한 diff 에 섞여 있다. 다만 `plan/in-progress/ci-required-check-skip-jobs.md` §"부수" 절이 사유를 명시한다 — 이 PR 이 `audit` 잡을 처음으로 실제 실행시켰고, 그 결과 main 에 이미 있던 취약점이 드러났으며, "이 체크를 통과시켜 required 로 만드는 것"이 PR 목적이라 같은 PR 에서 해소하지 않으면 목적을 달성할 수 없다는 논리다. 인과관계가 실측(`#1106` 로그)으로 뒷받침돼 자의적 끼워넣기는 아니다.
  - 제안: 정당화 자체는 타당하나, 커밋 메시지/PR 설명에 "핵심 변경 + 부수 패치"로 명확히 구분해 리뷰어가 두 diff 를 분리해 읽을 수 있게 하면 좋다(이미 plan 문서와 RESOLUTION.md 에 그렇게 구분돼 있어 실질적으로는 충족됨).

- **[INFO]** `plan/in-progress/deps-guard-hardening.md` 에 이 PR 과 무관한 후속 항목(lockfile `libc:` 필드 진동 문제)이 새 절로 추가됐다.
  - 위치: `plan/in-progress/deps-guard-hardening.md:384`(`### 후속 — lockfile libc: 필드가 커밋마다 진동한다`)
  - 상세: `pnpm-lock.yaml` 재생성 시 `libc: [glibc|musl]` 57줄이 사라지는 현상을 이 PR 작업 중 우연히 발견해 기록한 것으로, 본문 스스로 "본 변경과 무관"이라 명시한다. 이 PR 의 직접 대상은 아니지만, 신규 plan 파일을 따로 만드는 대신 관련성이 가장 높은 기존 in-progress plan(`deps-guard-hardening.md`, 의존성 보안 가드 관련)에 후속으로 얹은 것은 이 저장소의 "1회성 문서 신규 생성 금지" 관례와 정합적이다. 코드 변경은 없고 plan 문서 갱신뿐이라 실질적 스코프 리스크는 낮다.
  - 제안: 조치 불요 — 문서 자체가 무관함을 이미 공지하고 있어 오인 소지가 낮다.

- **[INFO]** `pnpm-lock.yaml` diff 에 실질 변경(`dompurify`/`nanoid` 버전·override)과 무관한 `libc: [glibc|musl]` 라인 약 57줄 삭제가 섞여 있다.
  - 위치: `pnpm-lock.yaml:1208-1229`(예시 구간, 전체는 diff 전역에 산재)
  - 상세: `pnpm install` 재생성의 부수 효과로, 핀된 `pnpm@10.23.0` 이 npm 레지스트리의 abbreviated packument 를 사용해 `libc` 필드를 못 읽는 것이 원인이라고 실측·문서화돼 있다(`plan/in-progress/ci-required-check-skip-jobs.md:109-121`, `deps-guard-hardening.md:386-405`). 사람이 손으로 넣은 변경이 아니라 lockfile 도구의 기계적 산출물이며, 저장소가 이미 반복 겪고 있는 "진동" 현상으로 별도 백로그(§후속)에 등재됐다.
  - 제안: 조치 불요. lockfile 재생성 diff 에 자동 포함되는 노이즈이며 대안(부분 편집)이 없고, 이미 원인·이력·후속 계획이 문서화돼 있다.

- **[INFO]** `.github/workflows/harness-checks.yml` 의 `paths:` 목록에 `scripts/ci-paths-changed.sh` 한 줄이 추가됐다 — 이 PR 의 직접 산출물(신규 스크립트)이 자기 자신의 커버리지 가드에 등재되는 것으로, 저장소가 반복 겪은 "paths 커버리지 갭" 클래스를 스스로 예방하는 목적상 정확히 스코프 내 변경이다.
  - 위치: `.github/workflows/harness-checks.yml:68`
  - 상세: 별도 파일 수정이지만 신규 스크립트의 필연적 배선이라 무관한 수정으로 보기 어렵다.
  - 제안: 조치 불요.

`review/code/2026/08/09/11_40_34/*` (RESOLUTION.md·SUMMARY.md·`_retry_state.json`·`meta.json`·14개 reviewer `*.md`) 는 직전 라운드 `/ai-review` 산출물이며, 이 저장소 관례상 `review/` 는 git 추적 대상이라 같은 작업의 이력으로 커밋되는 것이 정상이다 — 무관한 파일 혼입이 아니다.

## 요약

핵심 변경(6개 워크플로/테스트/스크립트 파일)은 "required-check skip-job 패턴 전환"이라는 단일 의도에 정확히 종속돼 있고, 불필요한 리팩터링·기능 확장·무관한 포맷팅·주석·임포트 변경은 발견되지 않았다. 유일하게 스코프 경계에 걸치는 것은 의존성 보안 패치(nanoid/dompurify) 번들인데, 이는 이 PR 이 처음으로 활성화시킨 `audit` 잡이 드러낸 기존 취약점을 "체크를 통과시켜야 required 로 등록할 수 있다"는 목적상 같은 PR 에서 해소한 것으로, plan 문서에 원인·근거가 실측 기반으로 명시돼 있어 임의의 끼워넣기가 아니다. `deps-guard-hardening.md` 의 후속 절 추가와 lockfile `libc:` 라인 소멸도 각각 문서화된 부수효과일 뿐 은폐된 변경이 아니다. `review/code/2026/08/09/11_40_34/**` 는 직전 리뷰 라운드의 정당한 산출물이다.

## 위험도
LOW
