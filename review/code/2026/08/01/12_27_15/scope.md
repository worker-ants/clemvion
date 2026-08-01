# 변경 범위(Scope) 리뷰

## 발견사항

없음.

- **[INFO]** `.github/dependabot.yml` 의 `eslint-plugin-unicorn` ignore 블록에 붙은 주석(17줄)이 실제 YAML 변경(2줄)에 비해 길다.
  - 위치: `.github/dependabot.yml:75-89` (`- dependency-name: "eslint-plugin-unicorn"` 항목)
  - 상세: 다만 바로 위에 이미 존재하던 `typescript` major ignore 항목(`.github/dependabot.yml:48-71`)이 동일하게 사고 경위·registry 실측·재발 조건을 상세히 남기는 스타일이라, 이번 추가는 기존 파일 컨벤션을 그대로 따른 것이다. 범위 이탈이 아니라 일관성 유지로 판단.
  - 제안: 조치 불필요.

## 파일별 판단

- `.github/dependabot.yml` — `eslint-plugin-unicorn` major ignore 항목만 추가. 기존 `typescript` ignore 항목·포맷은 손대지 않음. plan 의 "조치" 목록과 1:1 대응.
- `codebase/backend/eslint.config.mjs:16-26` — `unicorn` 플러그인 등록 블록의 주석만 교체(코드 로직 변경 없음). registry 실측표·dependabot #1049 경위·`.github/dependabot.yml` 과의 결속을 기록해 pin 근거를 최신화. 룰 목록(`rules: {...}`)·플러그인 등록 자체는 무변경.
- `codebase/backend/package.json:119` — `eslint-plugin-unicorn` 한 줄만 `^72.0.0` → `^56.0.1` 로 원복. 다른 dependency 항목은 전혀 손대지 않음.
- `plan/in-progress/eslint-unicorn-peer-restore.md` — 신규 plan 문서. 프로젝트 컨벤션(`plan/in-progress/<name>.md`, frontmatter `worktree` 포함)을 그대로 따름. 본문이 조치 항목(package.json/eslint.config.mjs/dependabot.yml)과 정확히 일치하고, `--strict-peer-dependencies` 도입이나 eslint 10 상향처럼 범위를 넘는 후속 작업은 "후속 검토 (이 PR 범위 밖)" 절로 명시적으로 분리해 이번 변경에 섞지 않았다 — over-engineering 을 스스로 배제한 흔적.
- `pnpm-lock.yaml` — 검사한 diff 전체가 `eslint-plugin-unicorn@72.0.0` → `56.0.1` 전환에 따른 transitive 의존성 그래프 재계산(추가/삭제된 패키지, `optional` 플래그·중첩 peer 해시 표기 변경 등)이다. `importers:` 섹션에서도 `eslint-plugin-unicorn` 한 줄 외 다른 워크스페이스·다른 패키지의 `specifier` 변경은 없다. `pnpm install` 이 기계적으로 생성하는 산출물이며 손으로 편집된 흔적이 없어 범위 이탈로 볼 수 없다.

포맷팅 잡음(공백·줄바꿈만 바뀐 hunk), 사용하지 않는 import 추가, 관련 없는 리팩토링, 요청 밖 기능 추가는 5개 파일 어디에서도 발견되지 않았다.

## 요약

이번 변경은 dependabot(#1049)이 backend 의 의도적 pin(`eslint-plugin-unicorn ^56`, peer 계약 근거)을 모르고 16-major bump 를 머지해 발생한 unmet peer 를 되돌리는 단일 목적 작업이다. 5개 파일(`package.json` 버전 복원, `eslint.config.mjs` 주석 최신화, `dependabot.yml` 재발 방지 ignore 추가, plan 문서, 기계적으로 재생성된 `pnpm-lock.yaml`) 모두 이 목적에 직접 결속되어 있고, plan 문서에 명시된 "조치" 항목과 실제 diff 가 정확히 1:1 대응한다. 범위를 넘는 후속 개선(`--strict-peer-dependencies` 도입, eslint 10 상향)은 실행하지 않고 plan 의 "후속 검토" 절로만 분리해 두었다. 스코프 이탈·불필요한 리팩토링·기능 확장·무관한 수정·의미 없는 포맷팅·불필요한 주석/임포트 변경 어느 항목도 관측되지 않았다.

## 위험도
NONE
