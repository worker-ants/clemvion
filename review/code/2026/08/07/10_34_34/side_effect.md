STATUS=success side_effect review complete (3 files: codebase/frontend/package.json, plan/in-progress/harness-review-gate-ci-backstop.md, pnpm-lock.yaml)
===REPORT_MARKDOWN_BELOW===
# 부작용(Side Effect) 리뷰

## 발견사항

- **[WARNING]** `pnpm-lock.yaml` 이 devDependency 4개 추가와 무관하게 57줄의 `libc:` 플랫폼 메타데이터를 제거한다 (전체 61줄 중 57줄, 93%)
  - 위치: `pnpm-lock.yaml` — 대표 hunk 앵커(각 hunk 헤더 직후 첫 컨텍스트 게이트):
    - `:1206` (`@css-inline/css-inline-linux-*`)
    - `:1668` (`@img/sharp-libvips-linux-*`, `@img/sharp-linux-*`)
    - `:2148` (`@napi-rs/canvas-linux-*`)
    - `:2417` (`@next/swc-linux-*`)
    - `:3858` (`@rolldown/binding-linux-*`)
    - `:4025` (`@tailwindcss/oxide-linux-*`)
    - `:4540` (`@unrs/resolver-binding-linux-*`)
    - `:7336` (`lightningcss-linux-*`)
  - 상세: `codebase/frontend/package.json` 에는 `@types/mdast`·`github-slugger`·
    `mdast-util-from-markdown`·`mdast-util-to-string` 4개 devDependency 추가뿐인데(직접
    실측: `git diff origin/main -- pnpm-lock.yaml` → 264줄 변경, +129/-135), 그 대부분이
    이 4개와 무관한 기존 optional 네이티브 바이너리 패키지(`@css-inline`, `@img/sharp-libvips`,
    `@napi-rs/canvas`, `@next/swc`, `@rolldown/binding`, `@tailwindcss/oxide`,
    `@unrs/resolver-binding`, `lightningcss` 등)의 `libc: [glibc]`/`libc: [musl]` 라인을
    **57줄 전량 삭제**하고 0줄도 추가하지 않는다(`origin/main` 61줄 → 이 브랜치 4줄, 직접
    카운트로 확인). 버전·integrity 해시는 그대로이므로 패키지 자체는 안 바뀌었고 메타데이터만
    사라졌다. `packageManager`(`pnpm@10.23.0`)도 이 브랜치에서 불변이라 pnpm 버전 차이로
    설명되지 않는다.
    `libc` 필드는 pnpm 이 Linux 호스트에서 optional 네이티브 바이너리의 glibc/musl 변종을
    구분해 설치 여부를 정하는 데 쓰인다(`os`/`cpu` 만으로는 Linux 두 variant 를 구분 못함).
    이 필드가 사라지면 `--frozen-lockfile` 로 Linux/musl(Alpine 등) CI·Docker 환경에서
    설치할 때 pnpm 이 variant 를 정확히 골라내지 못해 불필요한 양쪽 바이너리를 모두 받거나
    (설치 시간/디스크 증가), 최악의 경우 잘못된 libc 바이너리가 선택될 가능성을 배제할 수
    없다. 이 저장소는 바로 이 plan 문서 안에서 `playwright-runner` 이미지 마운트,
    `stat -f` GNU 비호환 등 **플랫폼별 CI-only 회귀**를 이미 여러 건 겪은 이력이 있어
    (부록 표 #1~#4), 이 클래스의 side effect 는 로컬에서 재현되지 않고 CI/Docker 에서만
    드러날 위험이 있다.
  - 제안: 이 devDependency 4개 추가만으로 정말 이 정도 lockfile 재계산이 불가피한지 확인할 것.
    (1) 사용자가 원격/CI(리눅스) 환경에서 `pnpm install --frozen-lockfile` 을 재현해 동일한
    diff 가 나오는지 대조, (2) 이미 활성화된 GitHub Actions(`harness-checks`/`packages-checks`
    등, `docs: CI 백스톱`) 의 다음 PR 러닝에서 이 lockfile 로 Linux 설치가 정상 완료되는지
    확인, (3) 필요하면 `libc` 재기입을 유발하는 `pnpm install --lockfile-only` 를 리눅스에서
    한 번 더 돌려 이 손실이 재현 가능한 pnpm 정상 동작인지, 아니면 이 macOS 개발 환경에서
    돌린 `pnpm install` 의 부작용인지 구분할 것.

- **[INFO]** `pnpm-lock.yaml` 의 `ts-jest`/`jest-cli`/`jest-config`/`eslint-import-resolver-typescript`
  peer-dependency 해석 문자열이 4개 devDependency 추가와 무관하게 재구성됨
  - 위치: `pnpm-lock.yaml:330`(`ts-jest` 버전 문자열에 `esbuild@0.25.12` 신규 편입),
    `pnpm-lock.yaml:15998`/`16018`/`16045`/`16060`/`16066`/`16081`
    (`eslint-import-resolver-typescript@…` 중첩 표기 변경), `pnpm-lock.yaml:17294`~`17334`
    (`jest-cli@30.4.2(...)`/`jest-config@30.4.2(...)` peer 조합 재배치)
  - 상세: 그래프에 새 패키지가 편입되면서 pnpm 이 기존 peer 의존 해석 조합을 재정렬한 것으로
    보이는 통상적 lockfile 재계산. 기능적으로 위험하다고 볼 근거는 없으나, 4줄짜리 의도된
    변경(package.json)이 264줄짜리 lockfile diff 로 증폭돼 리뷰 표면을 넓히고 있다는 점만
    기록해 둔다 — CRITICAL/WARNING 은 아니다.

## 관찰 (참고, 발견사항 아님)

- 신규 devDependency 4개(`@types/mdast`, `github-slugger`, `mdast-util-from-markdown`,
  `mdast-util-to-string`)는 `codebase/frontend/src/lib/docs/__tests__/spec-links.ts` 및
  같은 디렉터리의 `*.test.ts` 에서만 import 됨을 직접 확인했다(`grep -rn` 으로 프로덕션
  경로 import 0건). `devDependencies` 배치가 맞고, production 빌드에 필요한 런타임 의존을
  devDependencies 로 잘못 내려 빌드 실패를 유발하는 유형의 결함은 아니다.
- 4개 패키지 모두 pnpm-lock.yaml 상 install script(`hasBin`/`requiresBuild`) 흔적 없음 —
  설치 시 임의 코드 실행 위험 없음.
- `plan/in-progress/harness-review-gate-ci-backstop.md` 변경은 순수 문서 추가(부록 섹션)이며
  코드·설정 변경이 없어 부작용 관점에서 위험 없음.
- `codebase/frontend/package.json` 자체의 diff(4줄 추가, devDependencies 섹션 내)는
  `pnpm-lock.yaml` 의 대응 항목(`:582-584`, `:609-611`, `:618-623`)과 specifier·resolved
  version 이 정확히 일치함을 확인했다 — 매니페스트/락파일 불일치 없음.

## 요약

핵심 변경(4개 devDependency 추가, 문서 부록 추가)은 시그니처·인터페이스·전역 상태·환경변수·
네트워크 호출 관점에서 위험이 없고, 신규 패키지는 테스트 전용 경로에만 쓰여 배치도 올바르다.
다만 그 4줄 변경에 딸려 온 `pnpm-lock.yaml` diff 가 필요 이상으로 넓어, 특히 무관한 optional
네이티브 바이너리 패키지들의 `libc` 플랫폼 메타데이터 57줄이 통째로 사라진 것은 이 저장소가
과거 여러 차례 겪은 "로컬에서는 안 보이고 Linux/Docker CI 에서만 드러나는" 회귀 클래스와
같은 모양이라 WARNING 으로 등재한다. 코드 자체의 부작용은 아니지만 배포/CI 재현성에 영향을
줄 수 있는 환경적 side effect 이므로 착수 전(또는 머지 전) Linux 환경에서 한 번은 실측
검증할 것을 권한다.

## 위험도

LOW
