# 의존성(Dependency) 리뷰 — masked-marker-contract-7d2e14 (13_14_29)

## 검토 범위

이번 diff(95개 파일, 프롬프트 상)의 실질 의존성 표면은 신규 내부 워크스페이스 패키지
`@workflow/masked-markers` 추출과 그 등록 8곳(`test-stages.sh` · `packages-checks.yml` ·
backend/frontend `Dockerfile`(×3, `Dockerfile.playwright-e2e` 포함) · backend/frontend
`package.json` · `pnpm-lock.yaml`)이다. 나머지(35곳 이상)는 이전 4개 코드 리뷰 라운드
(`11_27_29`/`11_53_49`/`12_25_15`/`12_50_37`)와 2개 consistency-check 라운드
(`10_45_52`/`10_58_25`)의 산출물 자체(md/json)와 `spec/5-system/14-external-interaction-api.md`
frontmatter 갱신이라 의존성 관점에서 중립이다. 이전 4라운드 모두 이 신규 패키지에 대해 독립적으로
위험도 NONE 판정을 내렸고, 이번 라운드에서 `git diff origin/main...HEAD -- pnpm-lock.yaml` 로
직접 실측 재검증했다.

## 발견사항

- **[INFO]** 새 내부 워크스페이스 패키지 `@workflow/masked-markers` 추가 — 런타임 외부 의존 zero, 선례와 구조적으로 동일
  - 위치: `codebase/packages/masked-markers/package.json`(신규) / 등록 표면: `.claude/test-stages.sh:33`, `.github/workflows/packages-checks.yml:49,68,83`, `codebase/backend/Dockerfile:20,35`, `codebase/frontend/Dockerfile:26`, `codebase/frontend/Dockerfile.playwright-e2e:30,45`, `codebase/backend/package.json:58`, `codebase/frontend/package.json:40`
  - 상세: `dependencies` 필드가 아예 없고 `devDependencies`만 존재한다(`@eslint/js`/`eslint` `^9.18.0`, `typescript` `^5.7.3`, `typescript-eslint` `^8.65.0`, `jest`/`@types/jest` `^30.0.0`, `ts-jest` `^29.2.5`, `globals` `^17.9.0`) — 형제 패키지 `codebase/packages/ai-end-reason/package.json`과 버전 문자열까지 완전히 동일하다(monorepo 전역에 이미 존재하는 버전이라 새로 도입되는 외부 패키지·버전이 없음). backend/frontend `package.json` 양쪽 모두 `"@workflow/masked-markers": "workspace:*"`가 `dependencies`(devDependencies 아님) 섹션에 정확히 배치돼 런타임 import 실태와 일치한다. `pnpm-lock.yaml`(`codebase/packages/masked-markers:` 신규 섹션 + workspace link 2곳)을 직접 `git diff`로 대조해 8곳 등록이 전부 정합됨을 재확인했다.
  - 제안: 조치 불요.

- **[INFO]** `pnpm-lock.yaml`에 이 PR과 무관한 `eslint-config-next` peer-dependency variant dedup이 섞여 있음 (4라운드 연속 동일 결론, 실측 재확인)
  - 위치: `pnpm-lock.yaml` — `importers` 블록 frontend `eslint-config-next` 항목(`16.3.0(@typescript-eslint/parser@8.67.0(...))(...)` → `16.3.0(...)`로 peer 축 소멸) 및 `snapshots:` 섹션의 `eslint-config-next@16.3.0(...)`/`eslint-import-resolver-typescript@...`/`eslint-plugin-import@...` variant 통합
  - 상세: `git diff origin/main...HEAD -- pnpm-lock.yaml`로 직접 확인 — `eslint-config-next` 버전 자체(`16.3.0`)는 불변이고, 새 workspace 패키지 추가로 pnpm이 peer-dependency 해석 트리를 재계산하며 이전에 두 개로 갈라져 있던 동일 결과 variant를 하나로 dedup한 것이다. 라이선스·취약점·번들 크기에 영향 없는 lockfile 표현 정리이며, 이전 4개 리뷰 라운드(`11_27_29`~`12_50_37`)가 모두 동일하게 식별·불요 판정한 항목과 같다.
  - 제안: 조치 불요.

- **[INFO]** `license` 필드가 신규 package.json에 없음 — 저장소 전역 관행과 일치(신규 결함 아님)
  - 위치: `codebase/packages/masked-markers/package.json`
  - 상세: `codebase/packages/ai-end-reason/package.json`을 포함해 monorepo의 어떤 내부 패키지에도 `license` 필드가 없음을 확인했다(private 저장소, OSS 배포 대상 아님). 신규 패키지만의 결함이 아니다.
  - 제안: 조치 불요.

## 요약

이번 diff가 도입하는 유일한 새 의존성은 순수 내부 워크스페이스 패키지 `@workflow/masked-markers`이며, 런타임 외부(비-workspace) npm 패키지는 하나도 추가되지 않았다. devDependencies는 선례 `@workflow/ai-end-reason`과 버전까지 완전히 동일해 버전 고정 정책·라이선스·취약점 관점에서 새로 검토할 표면이 없고, `workspace:*` + 8곳 등록 표면(test-stages.sh·CI matrix/pathspec·Dockerfile×3·package.json×2·lockfile)이 `git diff` 실측으로 전부 정합됨을 확인했다. `pnpm-lock.yaml`의 `eslint-config-next` peer 재해석은 이 PR과 무관한 부수 효과이며 4개 선행 리뷰 라운드와 동일하게 무해함을 재확인했다. 순환 의존 없음(단방향: backend/frontend → masked-markers), 번들/빌드 시간 영향은 무시 가능한 수준(런타임 의존 zero인 값 도메인 패키지). 의존성 관점에서 차단 사유는 없다.

## 위험도
NONE
