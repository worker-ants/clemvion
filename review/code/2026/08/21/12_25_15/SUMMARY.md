# Code Review 통합 보고서

## 전체 위험도
**MEDIUM** — CRITICAL 은 없으나, `resolveScanDirs` 가 `codebase/packages/**` 하위 7개 형제 워크스페이스 패키지를 마커 미러 소멸 가드 스캔에서 통째로 빠뜨리는 구조적 갭을 architecture·maintainability 두 reviewer 가 독립적으로 확인(WARNING, 동일 근본 원인).

> **⚠ forced 인데 결과 없음**: router 가 강제 포함(`router_safety`)한 `requirement` reviewer 가 `no_status` 로 종료됐고 인라인 전문·디스크 파일 모두 확보되지 않았다. 이 리뷰어가 다루는 관점(요구사항/spec 정합성)의 Critical 발견 여부를 이번 라운드는 **검증하지 못했다** — 아래 "라우터 결정" 및 "발견 없는 에이전트"에도 명시. 이 공백이 채워지기 전까지 "clean" 판정으로 읽어서는 안 된다.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 아키텍처/유지보수성 | `resolveScanDirs` 가 `codebase/` 바로 아래 1단계만 순회해 `codebase/packages/**` 하위 7개 형제 워크스페이스 패키지(`ai-end-reason`/`node-summary`/`chat-channel-validation`/`graph-warning-rules`/`expression-engine`/`sdk`/`web-chat-sdk`)의 `src` 가 마커 미러 소멸 가드 스캔에서 전부 빠짐 — SoT(`masked-markers`) 밖에서 심볼이 재선언돼도 감지 못하는 구조적 사각지대. `SOT_DIR` 자기 제외 분기(backend `:132`/frontend `:134`)는 이 때문에 현재 도달 불가능한 죽은 코드가 됨. 캐너리 테스트(`dirs.length>=3`, 파일수`>500`)도 이 축소된 스캔 범위를 그대로 GREEN 통과시켜 갭을 못 잡음. 아직 라이브 미탐(실제 재선언)은 없음(grep 확인) | backend: `codebase/backend/src/repo-guards/__tests__/masked-marker-mirror-guard.ts:44-53`(`resolveScanDirs`), `:132`(`SOT_DIR` 제외) / frontend: `codebase/frontend/src/lib/repo-guards/__tests__/masked-marker-mirror-guard.ts:39-48`, `:134` | `resolveScanDirs` 를 2단계로 확장 — `codebase/` 직속 하위는 그대로, `codebase/packages/` 는 별도로 그 하위 각 패키지의 `src` 를 순회 채택(`packages-checks.yml` matrix 방식과 대응). 캐너리에 "`codebase/packages/` 아래 SoT 아닌 다른 패키지 `src` 도 스캔 대상에 포함된다"는 직접 단언 추가 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 보안 | 이전 라운드 WARNING(재발 방지 가드의 CI 경로 게이팅 사각지대)이 이번 diff 로 해소됨 — `frontend-checks.yml` pathspec 에 `codebase/channel-web-chat/**` 추가 + `resolveScanDirs` 실측 파생으로 backend/frontend 각자 최소 하나의 워크플로가 항상 가드를 실행 | `.github/workflows/frontend-checks.yml:44-48`, 양쪽 `-guard.ts` | 조치 불요 — 확인 기록 |
| 2 | 보안 | `SOT_SYMBOLS`(감시 목록)가 손 목록에서 패키지 export 표면의 실측 파생으로 전환됐고, `SOT_SYMBOLS.length` 하한 + 핵심 심볼 포함을 단언하는 캐너리가 vacuous 경로(빈 export 시 탐지 무력화)를 막아 둠 | `masked-marker-mirror-guard.ts:35-38`(backend)/`:30-33`(frontend), 캐너리 `.spec.ts:58-67`/`.test.ts:69-78` | 조치 불요 |
| 3 | 보안/부작용 | 신규 미러 가드는 `__tests__`/`repo-guards` 전용 CI 정적분석 도구 — 경로 구성이 전부 저장소 내부 고정값(`path.resolve(__dirname,...)`)이라 경로탐색·임의파일읽기 위험 없음. 프로덕션 빌드 제외는 `production-build-devdep` 가드(직전 라운드, 36/36 GREEN)로 검증됨 | 양쪽 `-guard.ts` | 조치 불요 |
| 4 | 보안 | frontend `MASKED_MARKERS` 가 `Object.freeze` 된 배열로 바뀌어 런타임 불변성을 실제로 획득(이전 `ReadonlySet` 은 타입 레벨 readonly 뿐이라 `.add()` 로 실변형 가능했음) — 개선, 회귀 아님 | `codebase/packages/masked-markers/src/index.ts:43-47` | 조치 불요 |
| 5 | 의존성/스코프/부작용 | `pnpm-lock.yaml` 에 PR 의도(마커 SoT 추출)와 무관한 `eslint-config-next` peer-dependency 재해석(dedup) 잔존 — 버전 자체는 불변, 신규 workspace 패키지 추가로 인한 `pnpm install` 부수효과. 3라운드 연속 동일 판정 | `pnpm-lock.yaml` `eslint-config-next@16.3.0(...)` 등 snapshot 항목 | 조치 불요(불가피한 부산물) |
| 6 | 아키텍처/유지보수성 | backend/frontend 미러 가드 로직(~145줄, `resolveScanDirs`/`listSourceFiles`/`findRedeclaredSymbols`/`findMirrorRedeclarations`)이 사실상 판박이로 중복 — CI 경로 게이팅을 벗어나기 위한 의도된 트레이드오프(문서화됨)이나, 위 WARNING 처럼 **로직 자체의 결함은 두 사본에 동시에 존재**해 "탐지 로직 중복은 한쪽이 낡아도 안전하다"는 전제가 이 경우엔 성립하지 않음 | 양쪽 `-guard.ts` 전체 | 조치 불요(설계 유지). 향후 이 로직 수정 시 **두 사본을 항상 동시에 고칠 것**을 체크리스트화 |
| 7 | 테스트 | backend `deepRedactSecrets` 의 깊이 상한(`MAX_MASK_DEPTH=10`) 정밀 경계 테스트 부재 — frontend `masked-markers.test.ts` 는 `nest(10)→true`/`nest(11)→false` 로 정확히 고정하는 반면, backend `sanitize-error-message.spec.ts` 는 "언젠가 멈춘다"(`not.toThrow()`)만 확인해 값이 실수로 바뀌어도(예: 10→1) backend 스위트만으로는 감지 못함. CI 상 `codebase/packages/**` 변경이 양쪽 워크플로 모두에 relevant 라 실질 위험은 낮으나, 2라운드째 "이월"만 되고 plan 트래커에 등재되지 않음 | `codebase/backend/src/shared/utils/sanitize-error-message.spec.ts:239-244` (대조: `codebase/frontend/src/lib/utils/__tests__/masked-markers.test.ts:91-97`) | frontend 와 대칭인 `it.each` 경계 테스트 추가 + `plan/in-progress/masked-marker-shared-package.md` 후속 작업으로 한 줄 등재 |
| 8 | 테스트/유지보수성 | `findMirrorRedeclarations` 의 `SOT_DIR` 자기 제외 분기가 현재 도달 불가능한 죽은 코드 — 근본 원인은 위 WARNING(`resolveScanDirs` 가 `codebase/packages/**` 를 애초에 스캔 대상에 못 넣음)과 동일. 2라운드 전부터 "저위험·조치불요"로 판정돼 온 항목의 재확인 | `masked-marker-mirror-guard.ts:132`(backend)/`:134`(frontend) | 조치 불요(트래킹됨) — 위 WARNING 수정 시 자연히 해소될 것으로 예상 |
| 9 | 문서화 | `CHANGELOG.md` 에 이번 패키지 추출·저장소 전역 미러 가드 2건 신설에 대한 항목 없음 — 선례(`@workflow/ai-end-reason` 도입 커밋 `83b67b06b`)도 CHANGELOG 를 건드리지 않아 "동작 무변경 내부 패키지 추출"은 이 저장소 관행상 비대상으로 보임 | `CHANGELOG.md` | 조치 불요(선례 일치). 신설된 저장소 전역 가드 2건은 한 줄 남기면 재발견 비용을 줄일 수 있음(강제 아님) |
| 10 | 유지보수성 | frontend `masked-marker-mirror.test.ts` 에 backend 쌍둥이 파일에는 없는 이중 빈 줄 | `codebase/frontend/src/lib/repo-guards/__tests__/masked-marker-mirror.test.ts:62-63` | 빈 줄 하나 제거해 형식 통일 |
| 11 | 스코프 | 커밋되는 `review/consistency/**` 산출물 하나에 sub-agent 의 중간 추론 텍스트가 그대로 남음("Confirmed accurate..." 등) — target 코드 스코프와 무관, 라운드1부터 이월 | `review/consistency/2026/08/21/10_58_25/rationale_continuity.md:1,3` | 이번 PR 스코프 밖. 다음 consistency-check 실행 시 자연 정리, 지금 손대면 오히려 완결된 이력을 편집하는 새 변경이 됨 |
| 12 | 부작용 | `.github/workflows/frontend-checks.yml` pathspec 확장(`codebase/channel-web-chat/**` 추가)은 그 워크플로의 트리거 조건 자체를 넓히는 부작용이나, 의도된 것이고 방향이 안전(더 많이 실행됨) | `.github/workflows/frontend-checks.yml` | 조치 불요 |
| 13 | 부작용 | frontend `MASKED_MARKERS` 재export 타입이 `ReadonlySet<string>` → `readonly string[]` 로 변경됐으나, 실제 소비처(`dynamic-form-ui.test.tsx`, `masked-markers.test.ts`) 는 전부 스프레드만 사용하고 `.has()` 호출부는 저장소 전체에 없어 실제 파손 없음 | `codebase/frontend/src/lib/utils/masked-markers.ts:56` | 조치 불요 |
| 14 | 의존성 | 신규 외부(비-workspace) npm 패키지 0개 — `@workflow/masked-markers` 의 `devDependencies`/`scripts`/`engines`/`jest` 설정이 형제 패키지(`ai-end-reason`/`node-summary`)와 바이트 단위로 동일, resolved 버전도 기존 lockfile 재사용. `dependencies`/`devDependencies` 배치도 런타임 import 실태와 정합. 등록 표면 9곳(workspace glob·test-stages.sh·packages-checks.yml matrix/pathspec·Dockerfile 3종·package.json 2곳·lockfile) 전수 정합 확인 | `codebase/packages/masked-markers/package.json`, `codebase/backend/package.json:58`, `codebase/frontend/package.json:40`, `pnpm-lock.yaml` | 조치 불요(승인 가능) |
| 15 | 유지보수성 | `codebase/packages/masked-markers/package.json` 의 `prepare` 스크립트가 9번째로 동일 인라인 JS 문자열을 복제 — 기존 8개 내부 패키지 전부 동일 패턴, 이번 PR 이 새로 만든 갭 아님(선존, 이번 범위 밖) | `codebase/packages/masked-markers/package.json` | 이번 PR 범위 밖. 패키지가 더 늘기 전 공유 스크립트 추출을 장기적으로 검토 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 이전 라운드 WARNING(CI 경로 게이팅) 해소 확인, 신규 CRITICAL/WARNING 없음 |
| architecture | MEDIUM | `resolveScanDirs` 가 `codebase/packages/**` 미스캔(WARNING #1) |
| requirement | **재시도 필요** | `no_status`, 인라인 전문·디스크 파일 모두 미확보. forced 인데 결과 없음 |
| scope | LOW | 3라운드째 목표(공유 패키지 추출) 대비 스코프 일치, INFO 2건(무관 lockfile 노이즈, 리뷰 산출물 잔여 텍스트) |
| side_effect | LOW | 신규 부작용 없음(전부 read-only/의도된 CI 트리거 확장), INFO 4건 재확인 |
| maintainability | MEDIUM | `resolveScanDirs` 갭(WARNING #1, architecture 와 동일 근본 원인) |
| testing | LOW | 신규 결함 없음, `deepRedactSecrets` 깊이 경계 테스트 부재가 2라운드째 트래커 미등재로 이월 |
| documentation | NONE | 이전 WARNING(plan stale·spec R17) 전부 반영 확인, `CHANGELOG.md` 미기재만 INFO |
| dependency | NONE | 신규 외부 의존성 0개, 등록표면 9곳 정합 |
| user_guide_sync | NONE | doc-sync-matrix 20종 전수 대조, 매칭 0건(해당 없음) |

## 발견 없는 에이전트

- **user_guide_sync** — doc-sync-matrix 트리거 20종 전수 대조 결과 매칭 0건("해당 없음")
- **requirement** — 실행됐으나 결과 없음(`no_status`, forced 미이행). "발견 없음"이 아니라 **미검증** — 별도 항목으로 상단·아래 라우터 결정에 명시

## 권장 조치사항

1. **(WARNING #1)** `resolveScanDirs` 를 `codebase/packages/*/src` 도 포함하도록 확장하고, 캐너리에 "packages 하위 SoT 아닌 패키지도 스캔된다"는 직접 단언을 추가한다(backend·frontend 두 사본 동시 수정).
2. **requirement reviewer 재실행** — forced 화이트리스트 항목이 결과 없이 종료됐으므로, 이 관점(요구사항/spec 정합성)의 검증 공백을 메운다.
3. (선택, INFO #7) backend `deepRedactSecrets` 에 frontend 와 대칭인 깊이 경계(9/10/11) 정밀 테스트를 추가하고 plan 트래커에 등재한다.
4. (선택, INFO #10) frontend `masked-marker-mirror.test.ts` 의 이중 빈 줄을 제거해 backend 쌍둥이 파일과 형식을 맞춘다.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security`, `architecture`, `requirement`, `scope`, `side_effect`, `maintainability`, `testing`, `documentation`, `dependency`, `user_guide_sync` (10명)
  - **제외**: 표 (4명)
  - **강제 포함(router_safety)**: `dependency`, `documentation`, `maintainability`, `requirement`, `scope`, `security`, `side_effect`, `testing` (8명) — 이 중 **`requirement` 는 결과 없음(no_status, 전문·파일 모두 미확보)**, 강제 화이트리스트 미이행 상태

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | router 판단상 이번 diff 와 관련 낮음 |
  | database | router 판단상 이번 diff 와 관련 낮음 |
  | concurrency | router 판단상 이번 diff 와 관련 낮음 |
  | api_contract | router 판단상 이번 diff 와 관련 낮음 |
