# 변경 범위(Scope) 리뷰 — codebase/frontend/package.json · pnpm-lock.yaml

## 검토 방법

`git diff origin/main...HEAD --stat` 로 실제 변경 파일이 프롬프트의 2개(파일 1·2)와 정확히 일치함을
확인했다. `plan/in-progress/postcss-lockfile-drift-fix.md` 를 직접 열어 의도(§1 조치, §2 범위 밖 —
명시)를 대조 기준으로 삼았고, 두 커밋(`8b2d378e3`, `2713834e1`)의 `git show --stat`/커밋 메시지도
확인했다. `pnpm-lock.yaml` diff 전체(unified diff 구간, 프롬프트 라인 39~1261)를 빠짐없이 읽고, 실제
저장소의 `git diff`를 재확인해 각 hunk 가 속한 importer 를 `origin/main` 스냅샷과 대조해 특정했다.

## 발견사항

- **[INFO]** `package.json` 변경은 의도와 1:1로 정확히 일치 — 범위 이탈 없음
  - 위치: `codebase/frontend/package.json:34`, `codebase/frontend/package.json:52`
  - 상세: 변경은 정확히 2줄 — `@tailwindcss/postcss` `^4.2.2→^4.3.3`, `postcss` `^8.5.14→^8.5.18`.
    plan §1 이 명시한 "되돌려진 보안 bump 복원(`postcss`)" + "동일 CVE(GHSA-r28c-9q8g-f849) 잔존
    경로 제거(`@tailwindcss/postcss`)" 와 정확히 대응한다. 키 삽입 위치도 알파벳 순서를 그대로 유지
    (`@simplewebauthn/browser` → `@tailwindcss/postcss` → `@tanstack/react-query`, `next` → `postcss`
    → `react`)하며, 5번째 줄의 `//pin` 주석·다른 의존성·`scripts`/`engines` 블록은 전혀 손대지 않았다.
    포맷팅·주석·임포트·설정 항목 어느 것도 섞이지 않은 순수 2-라인 diff.
  - 제안: 없음(조치 불요).

- **[INFO]** `pnpm-lock.yaml` 의 tailwindcss 계열 연쇄 변경은 정상적 전이 결과 — 범위 내
  - 위치: `pnpm-lock.yaml:443-444`(importer 목표 변경), `pnpm-lock.yaml:3644`(`@tailwindcss/node@4.3.3`),
    `pnpm-lock.yaml:3647-3726`(`@tailwindcss/oxide-*` 12개 플랫폼 바이너리 + 메타패키지),
    `pnpm-lock.yaml:3729-3730`(`@tailwindcss/postcss@4.3.3` resolution), `pnpm-lock.yaml:5482`
    (`enhanced-resolve@5.24.5` 신규 추가)
  - 상세: `@tailwindcss/postcss` 4.3.1→4.3.3 승격에 딸려 오는 `@tailwindcss/node`·
    `@tailwindcss/oxide`(플랫폼별 optional 바이너리 12종 포함)·`enhanced-resolve`(4.3.3 이 요구하는
    상향된 버전)·일부 `lightningcss` 플랫폼 바이너리 추가, 그리고 `postcss@8.5.15` 엔트리 삭제(더 이상
    어떤 importer 도 참조하지 않아 이미 존재하던 `postcss@8.5.25` 로 dedup)는 모두 tailwindcss 패키지가
    같은 모노레포 릴리스로 함께 배포하는 하위 패키지이거나 그 직접 의존이다. `pnpm update
    @tailwindcss/postcss --filter frontend` 커밋 메시지가 설명하는 동작과 정합한다.
  - 제안: 없음(조치 불요, 참고용 확인).

- **[WARNING]** `pnpm-lock.yaml` diff 가 `--filter frontend` 범위를 넘어 8개 무관 importer +
  ~40개 무관 패키지의 메타데이터까지 재작성 — 기능 영향은 없어 보이나 문서화 갭
  - 위치: `pnpm-lock.yaml:320`(`codebase/backend` 의 `ts-jest` peer-key), `pnpm-lock.yaml:625,628`
    (`codebase/packages/ai-end-reason` 의 `jest`/`ts-jest`), 동일 패턴이
    `pnpm-lock.yaml:652,655`(`chat-channel-validation`) · `pnpm-lock.yaml:683,686`
    (`expression-engine`) · `pnpm-lock.yaml:710,713`(`graph-warning-rules`) ·
    `pnpm-lock.yaml:737,740`(`node-summary`) · `pnpm-lock.yaml:767,770`(`sdk`) ·
    `pnpm-lock.yaml:800,806`(`web-chat-sdk`) 에도 반복. 추가로 `@css-inline/css-inline-*`·
    `@img/sharp-*`·`@napi-rs/canvas-*`·`@next/swc-*`·`@rolldown/binding-*`·
    `@unrs/resolver-binding-*` 패키지 블록(전부 삭제 전용 라인이라 신규 파일 게이트 없음 — 패키지명으로
    특정, 예: `@img/sharp-linux-x64@0.34.5`, `@rolldown/binding-linux-x64-gnu@1.0.3`,
    `@unrs/resolver-binding-linux-x64-gnu@1.12.2`)의 `libc:` 필드 삭제, `eslint-import-resolver-typescript`
    peer-key 포맷 변경(`pnpm-lock.yaml:15368` 등 4곳)
  - 상세: 커밋 메시지가 밝힌 명령은 `pnpm update @tailwindcss/postcss --filter frontend` 로
    frontend 워크스페이스 한정이지만, 실제 diff 는 `codebase/backend` 전부와 `codebase/packages/*`
    7개 워크스페이스 중 6개(ai-end-reason·chat-channel-validation·expression-engine·
    graph-warning-rules·node-summary·sdk·web-chat-sdk)의 `jest`/`ts-jest` 해석 키에
    `(ts-node@10.9.2(...))` 접미사를 새로 붙이고, tailwindcss/postcss 와 무관한 이미지 처리(sharp)·
    캔버스(napi-rs/canvas)·이메일 인라이너(css-inline)·번들러(rolldown)·Next SWC 컴파일러·oxc
    리졸버 바인딩 등 다수 패키지의 `libc:` 필드까지 정리했다. 8곳 전부 `specifier:` 값 자체는
    **무변화**이고 `lockfileVersion`(9.0)도 그대로라, 수기 편집이 아니라 pnpm 이 단일 워크스페이스
    lockfile 을 전역 재해석하며 발생하는 peer-key 재직렬화/중복 필드 정리로 보인다(기능적 리스크
    낮음, plan 의 TEST WORKFLOW 가 backend 412 suites·e2e 260/260 을 포함해 이미 검증). 다만 plan
    §1 "실측 검증" 절은 `frozen-lockfile` 통과와 audit 감소만 언급할 뿐 이 넓은 blast radius 는
    설명하지 않아, 커밋 로그만 보는 후속 리뷰어가 "postcss 보안 수정"이 왜 sharp/canvas/rolldown/
    next-swc 항목까지 건드렸는지 의아해할 소지가 있다.
  - 제안: 코드/lockfile 수정은 불필요. plan 또는 커밋 메시지에 "lockfile 전역 재계산으로 backend·
    packages/* 의 jest/ts-jest peer-key 표기와 무관 패키지의 중복 `libc:` 필드가 함께 정리됨 —
    `specifier:` 불변, TEST WORKFLOW 전체 통과로 기능 영향 없음 확인" 한 줄을 남겨 투명성을 확보할
    것을 권장(non-blocking).

- **[INFO]** plan §2 "범위 밖 — 명시" 2건이 실제로 diff 밖에 있음을 확인 — 계획대로 정확히 지켜짐
  - 위치: `codebase/frontend/package.json:66`(`"tailwindcss": "^4.2.2"`, 무변경 확인),
    `pnpm-lock.yaml:23`(`next>postcss: ^8.5.14` override, 무변경 확인)
  - 상세: plan 이 "(a) `tailwindcss` 직접 의존(`^4.2.2`)과 `@tailwindcss/postcss` 엔진(`4.3.3`)
    lockstep 스큐", "(b) `pnpm-workspace.yaml`/`pnpm-lock.yaml` 의 `next>postcss` 오버라이드 하한
    (`^8.5.14`)" 둘 다 후속으로 명시 이연했는데, 실제로 `tailwindcss` bare 의존(`^4.2.2`/해석
    `4.3.1`)과 `next>postcss` 오버라이드는 이번 diff 에서 전혀 건드리지 않았다. `pnpm-workspace.yaml`,
    `scripts/check-pnpm-security-config.py` 파일 자체도 `git diff --stat` 상 변경 파일 목록(2개)에
    없다. 의도적 경계와 실제 diff 가 정확히 일치한다.
  - 제안: 없음(조치 불요, 계획 준수 확인).

포맷팅 전용 변경, 주석 추가/삭제, 사용하지 않는 임포트, 의도하지 않은 설정 변경(예: `overrides:`,
`settings:`, `engines:` 블록)은 이번 diff 어디에도 없었다.

## 요약

`codebase/frontend/package.json` 은 plan 이 명시한 두 CVE 관련 패키지(`postcss`, `@tailwindcss/postcss`)
만 정확히 건드리는 순수 2-라인 diff로 범위 이탈이 없다. `pnpm-lock.yaml` 은 겉보기엔 ~400줄의 큰 diff지만
대부분(tailwindcss 계열 하위 패키지·enhanced-resolve·postcss dedup)은 해당 버전 업그레이드의 정상적
전이 결과다. 다만 backend 및 `packages/*` 6~7개 워크스페이스의 jest/ts-jest peer-key 재작성과 tailwindcss와
무관한 다수 플랫폼 바이너리의 `libc:` 필드 정리가 섞여 있어, 서술된 `--filter frontend` 범위보다 실제
blast radius 가 넓다 — `specifier:` 불변·TEST WORKFLOW 전체 통과로 기능적 위험은 낮아 보이지만, 문서화
누락이라는 점에서 WARNING 1건을 남긴다. plan 이 명시적으로 이연한 두 항목(bare `tailwindcss` 의존,
`next>postcss` 오버라이드)은 실제로도 diff 밖에 있어 계획된 경계가 정확히 지켜졌다.

## 위험도
LOW
