# Code Review 통합 보고서

## 전체 위험도
**LOW** — 애플리케이션 로직 변경 없이 devDependency 4건 선언 정정 + lockfile 재생성 + plan 문서 부록 추가로 구성된 변경. CRITICAL 없음. WARNING 1건(중복 제거 후)은 `pnpm-lock.yaml` 에서 신규 devDependency 4건과 무관하게 optional 네이티브 바이너리 패키지들의 `libc:` 플랫폼 메타데이터 57줄이 통째로 사라진 것 — 기능은 무해할 가능성이 높지만 Linux/Docker CI 재현성 관점에서 머지 전 확인을 권장한다. forced reviewer(`dependency`, `documentation`) 포함 14명 전원 결과 확보, 미이행 없음.

## Critical 발견사항

(없음)

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| W1 | Side Effect / Scope | `pnpm-lock.yaml` 에서 신규 devDependency 4건(`@types/mdast`, `github-slugger`, `mdast-util-from-markdown`, `mdast-util-to-string`)과 무관하게, optional 네이티브 바이너리 패키지(`@css-inline`, `@img/sharp-libvips`, `@napi-rs/canvas`, `@next/swc`, `@rolldown/binding`, `@tailwindcss/oxide`, `@unrs/resolver-binding`, `lightningcss` 등 18곳 이상)의 `libc: [glibc]`/`libc: [musl]` 필드가 57줄 전량 삭제됨(전체 264줄 diff의 약 23%). 커밋 메시지의 "[lockfile churn 해명]" 문단이 이 삭제를 설명하지 못해 부정확하며, `libc` 필드 소실은 Linux/musl(Alpine 등) CI·Docker 환경에서 `--frozen-lockfile` 설치 시 pnpm 이 glibc/musl variant 를 정확히 골라내지 못해 불필요한 중복 설치 또는(최악) 잘못된 바이너리 선택으로 이어질 위험을 배제할 수 없다. 이 저장소는 플랫폼별 CI-only 회귀를 이미 여러 차례 겪은 이력이 있다(plan 부록 #1~#4). | `pnpm-lock.yaml` 다수 위치 (예: `:1206`, `:1668`, `:2148`, `:2417`, `:3858`, `:4025`, `:4540`, `:7336`) | 머지 전 Linux 환경에서 `pnpm install --frozen-lockfile` 재현 검증(신규 GitHub Actions 러닝 확인 포함). 커밋 메시지의 churn 해명에 이 `libc` 필드 삭제분과 `@aws-sdk/core` `deprecated` 메타데이터 신규 노출을 추가로 명시하거나 정정할 것. |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| I1 | Dependency / Architecture | 신규 devDependency 4종은 `codebase/frontend/src/lib/docs/__tests__/spec-links.ts` 가 이미 import 하고 있었으나 어느 매니페스트에도 선언되지 않았던 phantom dependency(워크트리 중첩이 `node-linker=isolated` 를 로컬에서만 무력화해 CI 에서만 실패)를 정식 선언한 것 — 방향 올바름 | `codebase/frontend/package.json:79,88,91,92` | 조치 불필요(정상 처리) |
| I2 | Dependency | devDependencies 배치·caret 버전정책·라이선스(MIT/ISC, permissive)·알파벳 정렬 모두 정확, 프로덕션 번들 미포함 확인(grep) | `codebase/frontend/package.json:79,88,91,92` | 조치 불필요 |
| I3 | Testing / Requirement / Dependency | 같은 결함 클래스("import 는 있는데 매니페스트엔 없음")의 전수 조사가 이 PR 범위 밖으로 이연됨. import-vs-manifest lint/CI 가드도 아직 부재 — plan 문서가 스스로 "미확인" 이라 명시 | plan 부록 `#6` 서술부 (`plan/in-progress/harness-review-gate-ci-backstop.md:487-489`) | 이번 PR 완료 조건 아님. 후속 세션 재점검 시 위 앵커 참조 |
| I4 | Testing | 이 결함은 워크트리 중첩 구조상 로컬 테스트 통과가 매니페스트 정합성의 증거가 되지 못했다(로컬 그린이어도 CI 는 레드였음). 이 PR 이 실제로 고쳤는지의 최종 확인은 로컬 재실행이 아니라 `spec-link-checks.yml` CI 워크플로 그린 여부 | (환경 특성 — 특정 코드 줄 아님) | plan 문서 "#6 | 본 PR" 상태 갱신 시 CI 그린 확인 여부 함께 기록 권장 |
| I5 | Dependency / Performance / Maintainability | `pnpm-lock.yaml` diff 264줄 중 devDependency 4건 추가 외 나머지는 `jest`/`ts-jest`/`eslint-import-resolver-typescript` peer-dependency 조합 재구성(실질 버전 변경 없음, 직접 실측 확인) + `@aws-sdk/core@3.977.4` 에 `deprecated` 메타데이터 신규 노출(버전 불변, 이 PR 과 무관한 backend 전이 의존) | `pnpm-lock.yaml` (jest-cli/jest-config/ts-jest 블록, `:918` @aws-sdk/core) | 이 PR 을 막을 사유 아님. `@aws-sdk/client-s3` 업그레이드로 deprecation 해소는 별도 트랙 후속 검토 권장 |
| I6 | Security | `fast-uri`/`undici` override 하한 낙후가 plan 문서에 "미처분" 으로 명시 기록됐으나, 이번 diff 는 `pnpm-workspace.yaml` 의 `overrides:` 섹션 자체를 건드리지 않음(기존 상태 재확인일 뿐) | `plan/in-progress/harness-review-gate-ci-backstop.md:491-493`, `pnpm-lock.yaml:15,25`(컨텍스트) | 작성자가 이미 별도 트랙으로 분리 명시. 후속 PR 에서 override 값과 `check-pnpm-security-config.py` 동시 갱신 |
| I7 | Documentation | 신규 devDependencies 에 "테스트 전용 가드(`spec-links.ts`)가 사용하니 앱 코드에서 안 보여도 지우지 말 것"을 알리는 인라인 앵커가 없음(자동 미사용-의존성 제거 도구는 없어 즉각 위험은 낮음) | `codebase/frontend/package.json:79,88,91,92` | 기존 `"//pin"` 패턴처럼 `"//devDeps"` 류 주석 추가 고려(선택, 비필수) |
| I8 | Documentation | plan 부록 표의 항목 5("packages prepare stale dist")·항목 7("override floors")에 추적 가능한 이슈/PR 번호가 없음. 항목 5는 실제로는 별도 브랜치(`claude/packages-prepare-stale-dist`, 커밋 `1ac458d07`)에서 이미 처리 중이나 이 문서에는 반영돼 있지 않아 stale 위험 | `plan/in-progress/harness-review-gate-ci-backstop.md:469`(항목5), `:471`(항목7) | PR 번호/브랜치명 보강 또는 "다시 열 때 상태 재확인" 메모 추가 권장(선택) |
| I9 | Maintainability | plan 문서가 "이 티켓 밖" 사후조사 부록을 단일 파일(480줄+)에 계속 누적 — 장기적으로 탐색성 저하 우려(강제 위반 아님) | `plan/in-progress/harness-review-gate-ci-backstop.md` 부록 섹션 헤더 | 반복 누적 시 `plan/research/` 로 분리 이관 고려(선택) |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | devDependency 4종 저위험·개발전용, `@aws-sdk/core` deprecation 노출(비차단), override 하한 미처분 기록(별도 트랙) |
| performance | NONE | 런타임/번들 영향 없음, lockfile diff 규모 작고 무해 |
| architecture | NONE | phantom dependency → 정식 선언 전환, 모듈 경계/스코프(devDeps) 정확 |
| requirement | LOW | 실사용처·버전·CI 워크플로 정합 실측 확인, 결함 클래스 전수조사는 문서상 명시적 defer |
| scope | LOW | package.json 변경은 의도와 일치. lockfile churn 해명이 실제 diff(libc 삭제 등)를 다 설명 못함(WARNING) |
| side_effect | LOW | libc 플랫폼 메타데이터 57줄 소실 — CI/Docker 재현성 리스크(WARNING) |
| maintainability | NONE | 로직 변경 없음, lockfile 부수 churn은 자동 산출물, plan 문서 누적 구조는 참고 사항 |
| testing | LOW | 기존 테스트로 커버 확인(17 tests 통과 재실행), 자동가드 부재·로컬검증 신뢰도 한계는 이미 defer됨 |
| documentation | NONE | 경위 기록 충실, 오삭제 방지 주석·부록 추적번호 부재는 선택적 개선 여지 |
| dependency | LOW | 라이선스/버전정책/취약점 전부 정상, lockfile 노이즈는 무해 확인 |
| database | NONE | 해당 코드 변경 없음 |
| concurrency | NONE | 해당 코드 변경 없음 |
| api_contract | NONE | 해당 코드 변경 없음 |
| user_guide_sync | NONE | doc-sync-matrix 21개 trigger 매칭 0건 |

## 발견 없는 에이전트

- `database` — 데이터베이스 관련 코드 없음
- `concurrency` — 실행 로직/공유 상태 없음
- `api_contract` — API 엔드포인트/스키마 변경 없음
- `user_guide_sync` — doc-sync-matrix 매칭 0건

## 권장 조치사항
1. 머지 전(또는 다음 CI 러닝에서) `pnpm-lock.yaml` 이 Linux 환경에서 `pnpm install --frozen-lockfile` 로 정상 재현되는지 확인 — 특히 `libc:` 필드가 삭제된 optional 네이티브 바이너리 패키지들이 Docker/Alpine 계열 설치에서 문제없이 해소되는지 (W1).
2. (선택) 커밋 메시지의 lockfile churn 해명에 `libc` 필드 삭제분과 `@aws-sdk/core` deprecated 메타데이터 노출을 추가 기재해 향후 diff 판독 비용을 줄인다 (W1, I5).
3. (선택) plan 부록 표 항목 5·7에 추적 가능한 이슈/브랜치 번호를 보강 — 항목 5는 이미 별도 브랜치에서 처리 중이므로 최소한 그 사실만이라도 반영 (I8).
4. (선택) 신규 devDependencies 옆에 "테스트 전용 가드가 사용 중, 오삭제 금지" 주석 추가 검토 (I7).
5. 이번 PR 범위 밖으로 이미 명시적으로 defer 된 항목(같은 결함 클래스 전수조사, import-vs-manifest lint 가드, `fast-uri`/`undici` override 갱신)은 이번 턴에서 추가 조치 불필요 — 후속 세션에서 plan 문서 앵커를 참조해 재개.

## 라우터 결정

- `routing_status=skipped` — "라우터 미사용 — 전체 reviewer 실행."
- **강제 포함(router_safety)**: `dependency`, `documentation` — 둘 다 결과 확보됨(정상 이행, 미이행 없음).