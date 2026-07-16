# 범위(Scope) 리뷰 — node-linker hoisted→isolated 전환 + backend phantom 의존 4개 선언

대상: `origin/main..HEAD` (commit `19252b21e`)

## 변경 파일 전수 목록 (9개, pnpm-lock.yaml 포함)

```
 .npmrc
 codebase/backend/Dockerfile
 codebase/backend/package.json
 codebase/frontend/Dockerfile
 codebase/frontend/next.config.ts
 docker-compose.e2e.yml
 plan/in-progress/pnpm-migration-followups.md
 pnpm-lock.yaml
 pnpm-workspace.yaml
```

`codebase/backend/src/**`, `codebase/frontend/src/**` 등 애플리케이션 코드는 **완전히 미변경**(diff 0). 의도된 4개 축(linker flip / phantom-dep 선언 / stale 주석 동기화 / plan §3 기록)에 정확히 대응하는 파일 집합이며 그 외 파일(CI workflow, .dockerignore, PROJECT.md, spec/** 등) 은 건드리지 않았다.

## 발견사항

- **[INFO]** pnpm-lock.yaml 의 부수 churn 두 종류가 plan §3 "변경 요약" 에 명시되지 않음
  - 위치: `pnpm-lock.yaml` (전체 diff), `plan/in-progress/pnpm-migration-followups.md` §3 "변경 요약" 항목
  - 상세: lockfile diff 는 (1) 의도된 4개 직접 의존 edge 추가, (2) `eslint-plugin-import` peer-descriptor 재전개(버전 불변, 3개 소비처 + 정의부 1개, devtooling 전용), (3) `jest-validate@30.4.1` 의 `picomatch` 고정 해소가 `4.0.4`→`4.0.5` 로 이동(patch, 두 버전 모두 기존 lockfile 에 이미 존재하던 값 — 신규 패키지 유입 아님) 세 종류로 구성된다. plan §3 은 "pnpm-lock.yaml: 위 4개 직접 의존 edge 추가(버전 churn 0)" 라고만 적어 (2)(3) 을 언급하지 않는다. 두 항목 모두 `pnpm install`/lockfile 재해소가 새 top-level 의존(`@jest/globals` 등)을 추가할 때 자동으로 동반되는 통상적 재평가 결과이고, 동일 plan 문서 §2 에서 이미 "overrides 재해소 시 benign patch bump(js-yaml/nanoid/picomatch/postcss) 동반은 pnpm 의 불가피한 특성" 이라고 선례로 기록해둔 것과 같은 부류다. 기능적 리스크는 없으나(둘 다 dev-tooling 전용, semver 범위 내 patch/peer 재계산), 기록의 완전성 관점에서 "버전 churn 0" 이라는 문구가 4개 direct edge 자체의 버전만을 뜻하는지 lockfile 전체를 뜻하는지 모호하게 읽힐 수 있다.
  - 제안: (선택) plan §3 "변경 요약" 에 "pnpm-lock.yaml: 위 4개 직접 의존 edge 추가(버전 churn 0) + 부수적 peer-descriptor 재전개(eslint-plugin-import) 및 devDep 전이 patch 재해소(jest-validate→picomatch 4.0.5) — 신규 top-level 의존 유입에 따른 통상적 lockfile 재해소, §2 선례와 동일 성격" 정도로 한 문장 보강. 블로킹 사유는 아님.

## 항목별 평가

1. **linker flip (`.npmrc`)**: `node-linker=hoisted` → `isolated` 단일 값 변경 + 주석 전면 재작성. 주석은 이전 hoisted 서술을 정확히 isolated 로 치환하고 새 사실(phantom 4개 목록, `@workflow/*` symlink 유지, `--webpack` 우회 불변)을 담아 실제 코드(`codebase/frontend/package.json` 의 `--webpack` 플래그로 확인됨)와 일치한다. 범위 이탈 없음.
2. **phantom-dep 선언 (`codebase/backend/package.json`)**: `dotenv`/`express`/`ip-address`(prod) + `@jest/globals`(dev) 4개만 추가, 기존 항목 순서·값 불변, 알파벳 정렬 위치도 기존 컨벤션 그대로 유지(재정렬성 리팩토링 없음). `src/**` 코드 변경 없음(이미 사용 중이던 import 를 declare 만 한 것과 일치).
3. **주석 동기화 (Dockerfile ×2, next.config.ts, docker-compose.e2e.yml, pnpm-workspace.yaml)**: 모든 diff hunk 가 주석/문서 블록에 한정되고 실제 RUN/COPY/설정 값 라인은 불변. 각 주석의 새 서술(`.pnpm` 가상 스토어, symlink farm, file-tracer 대상)은 isolated 모드의 실제 동작과 일치하며, hoisted 시절 서술을 걷어내되 그 외 무관 문단(예: injected deploy 설명, `pnpm deploy` 관련 서술)은 그대로 보존 — 불필요한 재작성 없음.
4. **pnpm-lock.yaml**: 4개 direct edge 추가는 의도 그대로. `eslint-plugin-import` peer-descriptor 재전개는 devDep 추가에 따른 lockfile 재해소의 통상적 부산물로, 버전 변경이 없고 devtooling 한정이라 수용 가능한 비의도적 churn. `picomatch` patch 재해소(위 INFO 항목)도 같은 성격.
5. **plan §3 기록**: "결정" 문단 + "변경 요약" + "검증" + "핵심 발견/교훈" 구조로, §3 섹션 헤딩과 그 하위 내용에만 국한. §1/§2 의 기존 완료 기록은 문자 그대로 보존(diff 미포함, 위 라인 넘버 확인). 유일하게 §3 밖에서 건드린 곳은 §4 말미의 plan 전체 상태 요약 한 줄("§4 전체 완료" → "§1~§4 전체 완료" + 잔여 후속 2건 명시)인데, 이는 §3 완료를 plan 전체 상태에 반영하는 자연스러운 연결이며 §4 개별 항목 내용은 수정하지 않았다. 과도한 범위 확장으로 보지 않음.
6. **historical 불변성**: `plan/in-progress/pnpm-migration-followups.md` §1, §2 의 완료 기록(2026-07-12/14 항목)은 diff 에 전혀 나타나지 않아 그대로 보존됨을 확인. `review/**` 산출물 diff 없음(git diff --stat 에 review/** 항목 부재).
7. **포맷팅/임포트/설정 노이즈**: 공백·줄바꿈만 바뀐 라인, 불필요한 import 추가/정리, CI/설정 파일(예: GitHub Actions, `.dockerignore`, `PROJECT.md`) 변경 없음.

## 요약

diff 는 요청된 4개 축(linker flip / backend phantom 의존 4개 선언 / stale hoisted 주석 isolated 동기화 / plan §3 기록)에 정확히 대응하며, 애플리케이션 소스 코드는 한 줄도 건드리지 않았다. 유일한 특이사항은 lockfile 재해소에 따른 두 가지 부수적 비의도 churn(`eslint-plugin-import` peer-descriptor 재전개, `jest-validate`→`picomatch` patch 이동)인데 둘 다 dev-tooling 전용·버전 리스크 없음·plan §2 에 이미 선례로 기록된 pnpm 재해소의 통상적 특성이라 수용 가능하며, plan §3 기록에 이 두 항목이 명시적으로 언급되지 않은 점만 기록 완전성 차원의 경미한 개선 여지로 남는다. 그 외 범위 이탈, 불필요한 리팩토링, 기능 확장, 무관 파일 수정은 발견되지 않았다.

## 위험도

LOW
