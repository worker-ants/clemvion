# 성능(Performance) 리뷰

## 리뷰 대상
- `codebase/backend/Dockerfile` — 신규 `prod-deps` 스테이지 추가(`FROM builder AS prod-deps` + `RUN CI=true pnpm install --prod --frozen-lockfile --filter "backend..."`), `runner` 의 `COPY --from` 소스를 `builder` → `prod-deps` 로 변경.
- `plan/in-progress/pnpm-migration-followups.md` — 완료/조사 기록 추가(순수 문서, 런타임·빌드 로직 영향 없음).
- `review/code/2026/07/12/23_21_17/*.md`, `_retry_state.json`, `meta.json` — 이전 리뷰 라운드 산출물이 신규 파일로 커밋됨. 코드가 아닌 정적 markdown/JSON 문서라 알고리즘·쿼리·메모리·캐싱 등 어떤 성능 관점도 해당 없음.

## 발견사항

- **[INFO]** `prod-deps` 스테이지가 native addon 컴파일·내부 패키지 `prepare` 훅을 중복 실행 — 런타임이 아닌 CI 빌드시간 증가
  - 위치: `codebase/backend/Dockerfile` (`FROM builder AS prod-deps` / `RUN CI=true pnpm install --prod --frozen-lockfile --filter "backend..."`)
  - 상세: `deps` 스테이지에서 이미 `pnpm install --frozen-lockfile --filter "backend..."` 로 devDeps 포함 전체 설치(bcrypt/isolated-vm native 컴파일 + 내부 `@workflow/*` 패키지 `prepare` 실행)를 1회 완료한다. 신설된 `prod-deps` 는 그 위에서 `node_modules` 를 지우고 `--prod` 로 재해소하는데, 주석이 스스로 명시하듯 이 재구성이 native addon 재컴파일을 다시 트리거한다. bcrypt/isolated-vm 같은 native addon 의 node-gyp 컴파일은 이미지 빌드 단계 중 상대적으로 무거운 축에 속해, 동일 컴파일이 파이프라인당 2회 발생하는 구조적 비용이다. (내부 workspace 패키지의 `prepare` 는 `[ -d dist ] || tsc` 가드라 `dist` 존재 시 실제로는 스킵되므로 — 이 부분은 재실행 비용이 크지 않다는 점은 주석·후속 리뷰에서 이미 정정됨.)
  - 영향: 애플리케이션 런타임 성능에는 무영향. CI 파이프라인의 이미지 빌드 소요 시간(전체 파이프라인 리드타임)만 늘어난다. 캐시 미스가 없는 한 네트워크 재요청(레지스트리 fetch)은 pnpm store 재사용으로 최소화되고, 추가 비용은 순수 CPU(native 컴파일)다.
  - 제안: 필수 조치 아님(이미지 크기 1.4GB→1.23GB, e2e 무회귀로 검증된 의도된 트레이드오프). 빌드시간이 실측 병목이 되면 (a) BuildKit `--mount=type=cache` 로 pnpm store/node-gyp 캐시 디렉터리를 스테이지 간 재사용, (b) `pnpm prune --prod`(재해소 없는 순수 prune, pnpm 버전별 지원 확인 필요) 같은 대안을 검토. 다만 빌드시간 before/after 수치가 plan 문서에 없어 이 트레이드오프의 실제 크기는 미정량화 상태 — 필요 시 기록 권장(선택).

- **[INFO]** 런타임 이미지 크기 축소 — 배포 성능 관점의 순개선
  - 위치: `codebase/backend/Dockerfile` (`runner` 스테이지가 `builder` 대신 `prod-deps` 에서 `COPY --chown=node:node /app ./`)
  - 상세: devDependencies(jest/ts-jest/eslint/prettier/@nestjs/testing/@nestjs/cli/supertest 등) 제거로 최종 이미지가 약 170MB(1.4GB→1.23GB) 축소됨(plan 문서 실측 기재). 이는 이미지 pull/배포 시간, 레지스트리 저장 비용, 컨테이너 콜드스타트에 긍정적이며, Node 프로세스 자체의 힙 사용량(런타임 메모리)에는 직접 영향이 없다(파일시스템 레이어 크기 감소이지 로드되는 모듈 그래프 축소가 아님 — devDeps 는 애초 `require` 되지 않으므로 런타임 메모리 절감 효과는 없음).
  - 제안: 없음(개선 확인, 조치 불필요).

- **[INFO]** 상위 목표(이미지 크기·공격표면 축소) 대비 잔존 최적화 여지 — 이번 diff 의 회귀는 아님
  - 위치: `codebase/backend/Dockerfile` — `deps` 스테이지의 `node-linker=hoisted`(`.npmrc`) 특성상 `--filter "backend..."` 스코핑에도 불구하고 `next`(169MB)·`@next`(238MB, native SWC 포함)·webpack·react-dom 등 프런트엔드 스택 ~415MB(최종 이미지의 ~33%)와 원본 TypeScript 소스 전체가 `runner` 까지 잔존한다(`plan/in-progress/pnpm-migration-followups.md` 스코프 정직화 문단에 실측 기록됨). `prod-deps` 는 devDeps 만 제거하므로 이 잔존 덩어리를 건드리지 않는다.
  - 상세: 이 현상은 이번 diff 로 신규 도입된 것이 아니라 `node-linker=hoisted` 의 기존 특성(구 `builder` 시절부터 동일)이며, plan 문서에 이미 후속 과제(§3 `strict` 전환 또는 옵션 A `pnpm deploy`)로 명시 등재되어 있어 이번 성능 리뷰에서 새로운 차단 사유로 취급하지 않는다.
  - 제안: 이미지 크기 절감의 대부분을 좌우하는 항목이므로 plan 에 이미 기재된 대로 우선순위를 유지해 후속 PR 로 진행 권장. 이번 diff 자체에 대한 조치는 불필요.

- **[INFO]** `plan/in-progress/pnpm-migration-followups.md` 및 신규 `review/**` markdown/JSON 파일 변경분은 순수 문서 기록으로 알고리즘·쿼리·메모리·캐싱·블로킹 I/O 등 성능 관점 영향 없음.

## 요약

이번 변경은 애플리케이션 코드가 아닌 Docker 멀티스테이지 빌드 구조 변경(`prod-deps` 스테이지 신설)으로, 런타임 관점에서는 프로덕션 이미지에서 devDependencies 를 제거해 이미지 크기를 약 170MB(1.4GB→1.23GB) 줄이는 순개선이며 실제 애플리케이션 알고리즘·쿼리·캐싱·메모리 사용 패턴에는 어떤 코드 변경도 없다. 유일한 트레이드오프는 신설된 `prod-deps` 스테이지가 native addon(bcrypt/isolated-vm) 컴파일을 `deps` 스테이지 대비 한 번 더 반복해 런타임이 아닌 CI/Docker 빌드 파이프라인 소요 시간을 다소 늘린다는 점이며, 이는 plan 문서에 실측(이미지 크기, e2e 253 무회귀)으로 근거를 남긴 의도된 결정이다. 상위 목표(이미지 크기·공격표면) 대비 남아 있는 더 큰 최적화 여지(hoisted node_modules 로 인한 프런트엔드 스택 ~415MB 잔존)는 이번 diff 의 회귀가 아니라 사전부터 존재하던 조건이며 plan 에 후속 과제로 이미 등재되어 있어 이번 변경을 차단할 사유가 아니다. 함께 커밋된 review 산출물 파일들은 순수 문서라 성능 관점 대상이 아니다.

## 위험도

NONE
