# Dependency Review — dep-hygiene (tailwind lockstep + next>postcss 오버라이드 하한 동기화)

## 발견사항

- **[INFO]** `tailwindcss` lockstep 스큐 해소 — 기능적 영향 없음 실측 확인
  - 위치: `codebase/frontend/package.json:66` (`"tailwindcss": "^4.2.2"` → `"^4.3.3"`)
  - 상세: 짝 패키지 `@tailwindcss/postcss` 는 이미 `^4.3.3` (`package.json:34`)이었는데 direct
    `tailwindcss` 의존만 `^4.2.2` 로 뒤처져 있었다. 실제로 설치된
    `@tailwindcss+postcss@4.3.3` 의 `package.json` 을 직접 열어 확인한 결과
    `dependencies.tailwindcss` 가 `"4.3.3"` (caret 없는 **exact pin**)으로 박혀 있다 — 즉
    CSS 컴파일 엔진은 `@tailwindcss/postcss` 가 자체적으로 물고 있는 내부 `tailwindcss` 사본을
    쓰지, top-level direct dependency 를 쓰지 않는다. `codebase/frontend/src` 전체에 bare
    `tailwindcss` import/require 가 0건이고 `postcss.config.mjs` 는 `@tailwindcss/postcss`
    플러그인만 등록함도 재확인했다. 따라서 이번 bump 는 IDE/툴링이 보는 버전과 실제 엔진
    버전을 맞추는 표현 정합화이며, 새 값 `4.3.3` 은 기존 caret(`^4.2.2` → `<5.0.0`) 범위 안에
    이미 포함돼 있던 값(직전 lockfile 해소값은 `4.3.1`)이라 reachable 버전 공간 확장도 없다.
  - 제안: 없음 — 이미 올바르게 처리됨. `tailwindcss`/`@tailwindcss/postcss` 는 앞으로도 Tailwind
    팀의 lockstep 릴리스 관례상 함께 bump 하는 관행을 유지할 것.

- **[INFO]** `next>postcss` pnpm override 하한 동기화 — 활성 취약점 아닌 "바닥 선언" 정합화
  - 위치: `pnpm-workspace.yaml:40`, `pnpm-lock.yaml:23`(overrides 블록), `scripts/check-pnpm-security-config.py:52`(`EXPECTED_OVERRIDES["next>postcss"]`)
  - 상세: 3개 파일 모두 `^8.5.14` → `^8.5.18` 로 동시 갱신되어, `#1034` 가 direct `postcss`
    의존 하한을 `^8.5.18`(GHSA-r28c-9q8g-f849 패치 하한)로 올린 것과 override 선언 하한이
    비로소 일치했다. `python3 scripts/check-pnpm-security-config.py` 를 직접 재실행해
    `OK: overrides 19건(값 포함) ... baseline 일치` 를 확인했고, `pnpm-lock.yaml` 의
    `overrides:` 블록과 `pnpm-workspace.yaml` 의 `overrides:` 블록을 YAML 파싱 후 diff 해
    완전 일치(0 diff)함도 확인했다. 워크스페이스 전체에서 실제 해소되는 `postcss` 버전은
    이번 변경 전후 모두 단일 `8.5.25` (lockfile grep 재검증, 유일한 다른 매치는
    `@tailwindcss/postcss@4.3.3` 패키지명의 부분 문자열 오탐)이므로, 이번 변경은 활성
    취약점을 새로 닫는 게 아니라 "다음 CVE·재해소 시 이 override 가 취약 버전 재유입을
    막는 바닥으로 실제 기능하게" 만드는 선언적 강화다 — plan 문서의 서술 및
    `pnpm-workspace.yaml` 자체 주석과 일치.
  - 제안: 없음. 이 2(3)-place 동시 갱신 규약이 `.github/workflows/deps-security-checks.yml`
    (line 24 path-trigger, line 55 실행 스텝)에 실제로 CI 배선돼 있음도 확인했다 — 한쪽만
    고쳤으면 이 PR 은 CI 에서 막혔을 것이다.

- **[INFO]** 신규 외부 의존성 없음 / 라이선스 이슈 없음
  - 상세: 이번 diff 는 순수 버전 하한 조정 2건뿐이며 신규 패키지 추가가 없다.
    `tailwindcss` 는 이미 기존 direct dependency였고 라이선스는 MIT(로컬 설치본
    `node_modules/.pnpm/tailwindcss@4.3.3/.../package.json` 확인) — 프로젝트와 호환.

- **[INFO]** `pnpm-lock.yaml` 잡음(jest/ts-jest/ts-node/eslint-import-resolver-typescript
  peer-key 재구조화)은 override 변경에 따른 pnpm 재해소 부산물 — 실제 버전 불변
  - 위치: `pnpm-lock.yaml` 의 `jest-cli@…`/`jest-config@…`/`ts-jest@…`/
    `eslint-import-resolver-typescript@…` snapshot 재정렬 hunk 다수
    (예: 시작 라인 `pnpm-lock.yaml:16652`, `:16690`, `:20459` 부근)
  - 상세: 워크스페이스 전역 override(`next>postcss`) 변경이 촉발한 pnpm 의존성 그래프
    재계산으로, 위 패키지들의 peer-dependency 인코딩 키가 재배열됐다. 실제 게시 버전
    (`jest@30.4.2`, `ts-jest@29.4.11`, `ts-node@10.9.2`, `typescript@5.9.3`,
    `eslint-import-resolver-typescript@3.10.1` 등)은 diff 전후로 스팟체크한 모든 지점에서
    불변임을 확인했다 — 취약점·호환성 영향 없음. plan 문서가 이를 "pnpm 재계산 부산물"로
    명시 disclose 하고 있어 투명성은 양호하나, 향후 리뷰에서 이런 대량 재정렬 잡음 속에
    실제 버전 변경이 섞여 들어가면 눈에 띄기 어렵다는 점은 일반적 주의사항으로 남긴다
    (이번 PR 자체에 대한 조치 요구는 아님).
  - 제안: 없음(참고용). 대규모 override 변경을 동반하는 향후 PR 에서는 `pnpm why <pkg>` 등으로
    스팟체크하는 습관을 권장.

- **[INFO]** 범위 밖으로 명시된 잔여 `pnpm audit` 실패 17건 — 이 PR 의 결함 아님
  - 위치: `plan/in-progress/dep-hygiene-tailwind-postcss.md` `## 2-1. 범위 밖 — 명시` 섹션
  - 상세: `pnpm audit --audit-level=moderate` 게이트는 이 PR 로도 통과하지 않으며, 잔여
    17건(`brace-expansion`·`js-yaml`·`sharp`·`liquidjs`·`hono`·`fast-uri`·`svgo`·`typeorm`·
    `protobufjs`·`linkify-it`·`@opentelemetry/propagator-jaeger`·`@hono/node-server`)은
    대부분 backend 의 전이 의존이라 직접 상향이 불가하고 건별 판단이 필요하다. 문서가
    이를 별도 PR 스코프로 명시적으로 defer 하고 있어 이번 PR 의 결함으로 볼 수 없다.
  - 제안: 별도 plan 항목으로 후속 추적 유지(이미 명시됨, 이번 PR 에서 추가 조치 불요).

## 요약

신규 외부 의존성 추가 없이 기존 두 패키지의 버전 **하한만** 올리는 순수 위생(hygiene) PR 이다.
(1) `tailwindcss` `^4.2.2→^4.3.3` 는 이미 `^4.3.3` 인 `@tailwindcss/postcss` 와의 lockstep
스큐를 없애는 변경으로, 실측 결과 `@tailwindcss/postcss` 가 내부에 `tailwindcss@4.3.3` 를
exact-pin 으로 자체 소지하고 있어(그리고 frontend 소스에 bare `tailwindcss` import 가
0건이라) 런타임 영향은 전혀 없고 툴링 일관성 개선에 그친다. (2) `next>postcss` pnpm override
하한 `^8.5.14→^8.5.18` 는 `pnpm-workspace.yaml`/`pnpm-lock.yaml`/
`scripts/check-pnpm-security-config.py` 3자리를 모두 동기화해, 앞서 `#1034` 가 올린 direct
`postcss` 하한과 override 선언 하한을 일치시켰다 — CI 가드(`deps-security-checks.yml`)가 이
2-place 규약을 실제로 강제함을 확인했고, `pnpm install --frozen-lockfile` 재실행·
`check-pnpm-security-config.py` 재실행·overrides 블록 완전 일치를 모두 직접 재현해 검증했다.
버전 고정 방식(caret)은 기존 프로젝트 관례와 일치하고, 새 라이선스 이슈·순환/충돌 의존성도
없다. 대량으로 보이는 `pnpm-lock.yaml` diff 는 워크스페이스 전역 override 변경에 따른
pnpm 재해소 부산물(jest/ts-jest/ts-node 계열 peer-key 재정렬)로, 스팟체크 결과 실제 게시
버전은 불변임을 확인했다. 범위 밖으로 명시된 잔여 audit 17건은 별도 PR 로 적절히 defer
되어 있다.

## 위험도

LOW
