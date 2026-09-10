# 변경 범위(Scope) 리뷰 — dependabot-pr-ci-fix-138fba

## 작업 의도 요약

`plan/in-progress/deps-audit-floor-refresh-2026-09.md` 와 `CHANGELOG.md` 신규 항목에 따르면
의도는 명확히 하나다: **main 이 이미 `pnpm audit`/override-바닥 가드에서 빨간불**이던 상태를
override 바닥 8건 상향 + 신규 override 1건(`qs`) + 직접 의존 선언 4건 상향으로 해소하고,
그 결과로 재해소된 `pnpm-lock.yaml` 을 커밋하는 것. 변경 파일 8개가 전부 이 목적에 직접
연결된다 — 애플리케이션 소스 코드(`src/**`)는 단 한 줄도 건드리지 않았다.

## 발견사항

- **[WARNING]** `pnpm-lock.yaml` 재해소 결과에 버전이 바뀌지 않은 패키지 5종(`@css-inline/*`,
  `@napi-rs/canvas-*`, `@rolldown/binding-*`, `@tailwindcss/oxide-*`, `@unrs/resolver-binding-*`)의
  `libc:` 필드가 조용히 삭제됐다 — 이번 override/직접의존 상향(fast-uri·hono·multer·nodemailer·
  sharp·svgo·js-yaml·qs·csv-parse·next) 대상에 전혀 포함되지 않은 패키지들이고, 버전 자체는
  하나도 바뀌지 않았다(`@css-inline/*@0.20.0`·`@napi-rs/canvas-*@0.1.80`·
  `@rolldown/binding-*@1.0.3`·`@tailwindcss/oxide-*@4.3.3`·`@unrs/resolver-binding-*@1.12.2` 그대로).
  - 위치: `pnpm-lock.yaml:1245`(`@css-inline/css-inline-linux-arm64-musl@0.20.0` 블록, `libc: [musl]` 줄 삭제) ·
    `pnpm-lock.yaml:2281`(`@napi-rs/canvas-linux-arm64-musl@0.1.80`) ·
    `pnpm-lock.yaml:3832`(`@rolldown/binding-linux-arm64-musl@1.0.3`) ·
    `pnpm-lock.yaml:3999`(`@tailwindcss/oxide-linux-arm64-musl@4.3.3`) ·
    `pnpm-lock.yaml:4629`(`@unrs/resolver-binding-linux-arm64-musl@1.12.2`) — 삭제된 `libc:` 줄
    자체는 diff 상 게이트 없는(`-`) 줄이라 인용 불가하므로 각 패키지 블록 헤더 줄 번호로 표기.
    이 패턴이 총 19개 블록(패키지 5종 × 플랫폼별 변형)에서 반복된다.
  - 상세: `CHANGELOG.md:69`("override 가 바뀌면 pnpm 이 트리를 재해소하므로... **중복 제거**가
    함께 실렸다")와 `plan/in-progress/deps-audit-floor-refresh-2026-09.md` 는 lockfile 부수
    변경을 "버전 하향 0건" 기준으로만 감사했다고 적었고, 실제로 열거된 부수 변경 목록
    (`@radix-ui/*` 11종 dedup · `postcss@8.5.25` 흡수 · `@radix-ui/react-use-escape-keydown@1.1.2`
    소멸)은 next/sharp 상향의 전이 그래프로 설명 가능한 것들이다. 그런데 이번 `libc:` 필드
    삭제는 **버전이 그대로인 패키지의 메타데이터**만 사라진 것이라 그 "버전 하향 0건" 감사
    항목에 애초에 걸리지 않는다 — 감사 프록시(버전 번호)가 이 변화의 종류를 볼 수 없는
    형태다. 원인은 패키지 자체 변경이 아니라 `pnpm-workspace.yaml` overrides 편집 후
    `pnpm install` 이 override 트리를 통째로 재해소하면서 무관한 서브트리의 optional-dependency
    메타데이터 표현까지 재계산한 것으로 보인다(같은 lockfileVersion 유지, diff 는
    `pnpm-lock.yaml:12` 부터 시작해 최상단 `lockfileVersion` 은 불변 — pnpm 메이저/락파일
    포맷 마이그레이션은 아니다). 각 패키지의 플랫폼별 파일명 자체가 이미 `-musl`/`-gnu` 를
    인코딩하고 있어 설치 시 실질 기능 영향은 낮아 보이지만, 이번 PR 이 표방한 "보안 override
    상향 + 그로 인한 dedup" 범위 밖의 변경이 섞여 들어갔고 문서화되지 않았다.
  - 제안: (1) `CHANGELOG.md`/plan 의 "전수 대조 결과 버전 하향은 0건" 서술에 이 `libc:` 필드
    누락 사례를 추가하거나, (2) 재현성을 위해 동일 pnpm 버전(`10.23.0`, `packageManager` 핀과
    일치 확인됨)으로 `pnpm install` 을 한 번 더 돌려 diff 가 안정적인지(non-deterministic 재작성이
    아닌지) 확인 후 그 결과를 기록. 기능 영향이 없다고 판단되면 최소한 "이 5종은 override 대상이
    아니며 재해소 부수 효과"라는 한 줄을 남겨, 다음 리뷰어가 이걸 무단 lockfile 조작으로
    오인하지 않게 한다.

## 범위 내로 확인된 항목 (참고용)

- `codebase/backend/package.json`(csv-parse·nodemailer), `codebase/channel-web-chat/package.json`
  · `codebase/frontend/package.json`(next) — 각각 plan §1(c) 표와 정확히 1:1 대응, 다른 라인
  변경 없음.
- `pnpm-workspace.yaml` 의 `overrides` 변경(fast-uri·hono·multer·nodemailer·qs 신설·svgo·sharp·
  js-yaml 키+값 2건)과 `scripts/check-pnpm-security-config.py` 의 `EXPECTED_OVERRIDES` 변경이
  정확히 같은 8+1건 집합으로 동기화되어 있다 — `PROJECT.md` 의 2-place 편집 규약을 충족.
  `scripts/check-override-floors.py`·`scripts/check-unmet-peers.py` 는 git diff 상 무변경(확인함).
- `pnpm-lock.yaml` 의 버전 변경 패키지 목록(fast-uri·hono·multer·nodemailer·sharp+`@img/sharp-*`
  전 플랫폼·svgo·js-yaml·qs·csv-parse·next+`@next/*`·`@swc/helpers`·`@radix-ui/*` dedup)을
  전수 대조한 결과, 선언되지 않은 신규 버전 상향은 없었다(위 WARNING 1건 제외).
- `plan/in-progress/deps-audit-floor-refresh-2026-09.md` 신설은 `CLAUDE.md` "진행 중 작업"
  위치 규약(`plan/in-progress/<name>.md`, frontmatter `worktree` 명시)을 충족하며 이번 작업
  자체의 추적 문서이므로 범위 이탈이 아니다.
- 애플리케이션 소스(`codebase/**/src`), 테스트, CI 워크플로 정의, 문서(spec/) 등은 전혀
  건드리지 않았다 — 리팩토링·기능 추가·주석/임포트 변경류의 스코프 이탈은 발견되지 않았다.

## 요약

변경 8개 파일 전부가 "override 바닥 침식으로 main 이 빨간불" 이라는 단일 목적에 직접
연결되며, package.json/override/baseline 3자 동기화도 정확하다. 유일한 이탈은
`pnpm-lock.yaml` 재해소 과정에서 버전이 바뀌지 않은 5개 패키지(총 19개 플랫폼 변형)의
`libc:` 메타데이터가 조용히 사라진 것으로, 이는 의도적 편집이 아니라 `pnpm install` 의
부수 효과로 보이지만 CHANGELOG/plan 의 "버전 하향 0건" 감사가 포착하지 못한 종류의 변화라
문서화 갭이 있다. 기능적 위험은 낮다고 판단되나(플랫폼 변형이 패키지명에 이미 인코딩됨),
PR 이 스스로 표방한 "전수 대조" 주장의 커버리지를 좁힌다.

## 위험도

LOW
