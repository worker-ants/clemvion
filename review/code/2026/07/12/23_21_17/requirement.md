# 요구사항(Requirement) Review

대상: `codebase/backend/Dockerfile` (prod-deps 스테이지 신설), `plan/in-progress/pnpm-migration-followups.md` (§1 완료 기록 + §2 조사 기록)

검증 방법: 정적 diff 검토 + **실제 `docker build`(로컬 `desktop-linux` 드라이버, 전량 캐시 hit)로 `prod-deps`/`runner`/`builder` 세 타깃 실측**, 컨테이너 내부 `node_modules` 실사(`du -sh`, `pnpm --filter list`, `.modules.yaml` peer 해석 확인), `node -e "require(dist/main.js)"` 로 모듈 해석 무결성 확인. `@nestjs/swagger` SchemaObject export 여부·openapi3-ts 설치 여부도 로컬 `node -e` 로 재현.

## 발견사항

- **[WARNING]** `prod-deps` 스테이지가 목표(이미지 크기·공격 표면 감소)를 부분적으로만 달성 — Next.js 프런트엔드 스택(약 400MB+, 이미지의 ~33%)이 "pruned" 백엔드 프로덕션 이미지에 그대로 잔존
  - 위치: `codebase/backend/Dockerfile:42-44` (`prod-deps` 스테이지), `plan/in-progress/pnpm-migration-followups.md:159` (완료 기록)
  - 상세: 실제 빌드한 `runner` 이미지 내부를 확인한 결과, backend 와 무관한 `next`(169MB) + `@next`(238.7MB, `@next/swc` 네이티브 컴파일러 바이너리 포함) + `webpack`(7.7MB) + `react`/`tailwindcss`/`@tailwindcss`/`postcss` 가 모두 남아 있다. `corepack pnpm --filter "backend..." list --depth -1` 로 확인하면 backend 의 실제 workspace 의존 그래프는 `backend` + 4개 내부 패키지(`chat-channel-validation`/`expression-engine`/`graph-warning-rules`/`node-summary`)뿐이고 `frontend`/`channel-web-chat`/`sdk`/`web-chat-sdk` 는 포함되지 않는다 — 즉 `next`/`react`/`webpack` 은 backend 의 의존 그래프에 논리적으로 속하지 않는데도 `node-linker=hoisted` 하에서 `--filter "backend..."` 가 이를 걸러내지 못한다(hoisted 링커는 workspace 전체 lockfile 그래프를 단일 flat `node_modules` 로 구체화하는 방식이라 필터가 다른 프로젝트의 완전한 산출물 포함을 막지 못함). **이 현상 자체는 이번 diff 로 새로 생긴 회귀가 아니다** — `builder` 타깃(이번 diff 이전부터 있던 스테이지, old runner 가 그대로 COPY 하던 대상)을 직접 빌드해 확인한 결과 `next`/`@next`/`react`/`webpack` 은 `prod-deps` 신설 이전에도 이미 포함돼 있었다(`builder` node_modules = 1.4GB). 따라서 `prod-deps` 는 그 위에서 **backend 자신의 devDependencies(jest/ts-jest/eslint/prettier/@nestjs/testing/@nestjs/cli/supertest 등, 실측으로 제거 확인됨)만** 제거해 1.4GB→1.23GB(~170MB↓)를 달성했을 뿐, "공격 표면 증가" 문제의 더 큰 부분(무관한 프런트엔드 앱 전체 + 네이티브 컴파일러 바이너리, ~400MB+)은 손대지 않았다.
  - 참고로 `typescript`(22.9MB, devDependency 로 분류)도 최종 이미지에 남아 있으나, 이는 leak 이 아니라 정당한 잔존이다 — `.modules.yaml` 확인 결과 `@nestjs/typeorm`·`@nestjs-modules/mailer`·`mjml-cli`·`cosmiconfig` 등 backend 의 **production** dependencies 가 optional peerDependency 로 `typescript@5.9.3` 을 요구해(pnpm 기본 `auto-install-peers`) 해소된 것으로, prod-deps 로직의 결함이 아니다(추가 조사로 확인, 별도 발견사항 아님).
  - 제안: (a) `plan/in-progress/pnpm-migration-followups.md` §1 완료 기록에 이 잔존 갭을 명시적으로 기재(현재 문구 "devDeps·dev 툴링 제거"는 좁은 의미로는 사실이나, §1 도입부의 "이미지 크기·공격 표면 증가" 문제 제기 전체를 해결한 것으로 오독될 소지가 있음). (b) 근본 해결은 `node-linker=hoisted` 의 workspace-wide 구체화 특성과 결부돼 있으므로, 이미 plan §3(`node-linker=hoisted → strict 전환`)과 연결해 후속 조사 항목으로 남기거나, 애초 플랜에 있던 **옵션 A**(`pnpm deploy --filter backend --prod <dir>` — 프로젝트별 격리된 deploy 디렉터리 생성이 이 cross-project 잔존 자체를 원천 차단할 가능성)를 다시 검토할 가치가 있음을 plan 에 기록. (c) 코드 자체(Dockerfile)를 되돌릴 필요는 없음 — 170MB 감축은 실질적 개선이지만, "완료" 로 마킹된 항목의 스코프 표현을 정확히 하는 것을 권장.

- **[INFO]** `CI=true` 의 근거("비대화형 빌드라 removal 확인 프롬프트를 넘기려")가 실측으로 검증되지 않음 — 무해하지만 부정확할 수 있는 주석
  - 위치: `codebase/backend/Dockerfile:40`, `:44`
  - 상세: `pnpm install --prod --frozen-lockfile` 실행 자체는 로컬 실측(본 리뷰의 docker build)에서 정상 완료됐고 `CI=true` 유무에 따른 차이를 별도로 대조하지는 않았다. `pnpm install --help` 상으로는 `--frozen-lockfile` 이 CI 환경에서 기본 on 이 되는 것과 관련된 설명만 확인되고, "제거 확인 프롬프트"에 대한 문서상 근거는 찾지 못했다. Docker `RUN` 은 애초 non-TTY 라 인터랙티브 프롬프트가 있어도 일반적으로 자동 실패/스킵되므로 `CI=true` 는 안전망으로 유해하지 않다.
  - 제안: 기능상 문제는 없음(빌드 실측 성공). 주석의 "confirm 프롬프트" 근거를 실제 pnpm 동작(예: `approve-builds` 관련 경고)으로 좁혀 쓰거나, 근거가 불확실하면 "안전을 위한 방어적 설정"으로 표현을 완화 권장.

- **[INFO]** 관련 spec 문서 부재 (spec fidelity 대상 아님)
  - 위치: `spec/` 전체
  - 상세: `spec/` 하위에 Docker 멀티스테이지 빌드·devDependencies pruning 정책을 정의한 문서가 없다(`spec/0-overview.md` 는 Flyway migration 이미지만 언급, 백엔드 런타임 이미지 구성은 spec 대상이 아니라 `PROJECT.md`/`plan/` 이 다루는 인프라 관심사). 따라서 line-level spec fidelity 점검은 해당 없음(회색지대, spec 침묵 영역).
  - 제안: 없음(정보성).

- **[INFO]** plan §2 "조사(defer)" 항목의 사실 관계는 실측으로 확인됨
  - 위치: `plan/in-progress/pnpm-migration-followups.md:168`
  - 상세: 로컬 `node -e "console.log('SchemaObject' in require('@nestjs/swagger'))"` → `false`, `node -e "require.resolve('openapi3-ts')"` → `MODULE_NOT_FOUND` — 문서에 적힌 두 실측 주장과 정확히 일치. 이 부분은 결함 없음.

## 기능 완전성 / 엣지 케이스 / 에러 시나리오 / 반환값 (Dockerfile 특성상 해당 사항 요약)

- 실제 `docker build` 로 `deps`→`builder`→`prod-deps`→`runner` 전 스테이지 빌드 성공 확인(전량 캐시 hit, 이전 빌드 산출물과 동일).
- `node -e "require('/app/codebase/backend/dist/main.js')"` 로 부팅 경로를 실행한 결과 **모듈 해석 오류(`MODULE_NOT_FOUND`) 없이** production fail-closed 가드(`JWT_SECRET` 미설정)에서 정상적으로 멈춤 — under-pruning(필요한 런타임 의존성 과다 제거) 은 없음을 확인. 이 가드 자체는 이번 diff 와 무관한 기존 로직.
- `builder`(구 동작) 와 `prod-deps`(신규) 를 나란히 실측 비교해 devDependencies(jest/ts-jest/eslint/prettier/@nestjs/testing/@nestjs/cli/supertest 등) 제거는 실제로 동작함을 확인.
- TODO/FIXME/HACK/XXX 주석 없음.
- 함수명·주석과 구현의 괴리: Dockerfile 주석 자체(“backend subtree 의 devDeps 를 제거한다”)는 스코프를 정확히 좁혀 서술하고 있어 과장이 없음 — 괴리는 Dockerfile 주석이 아니라 plan 의 상위 문제 제기(“공격 표면 증가”) 대비 완료 기록의 스코프 표현에 있음(위 WARNING 참조).

## 요약

`prod-deps` 스테이지 신설은 의도한 기능(backend 자신의 devDependencies 제거)을 실측으로 정확히 수행하며 문서화된 메커니즘(native 재빌드, dist 보존, hoisted layout 유지)도 코드와 일치한다. 다만 실제 컨테이너를 빌드해 내부를 검사한 결과, 이 최적화가 겨냥한 상위 문제("이미지 크기·공격 표면 증가")의 상당 부분(next.js 프런트엔드 스택 전체 + 네이티브 컴파일러 바이너리, 약 400MB, 최종 이미지의 1/3)이 `node-linker=hoisted` 특성으로 인해 여전히 잔존하며, 이는 이번 diff 이전부터 있던 조건이지만 plan 의 "완료" 기록에서 그 잔존 사실이 드러나지 않는다. 회귀나 기능 결함은 아니지만(모듈 해석 무결성·devDeps 제거 자체는 검증됨), "완료" 라벨의 정확성과 후속 조치(옵션 A `pnpm deploy` 재검토 또는 §3 node-linker 전환과의 연계) 관점에서 WARNING 으로 기록한다. plan §2 의 실측 조사 내용은 재현 검증되어 정확하다.

## 위험도
MEDIUM
