# Code Review 통합 보고서

## 전체 위험도
**MEDIUM** — CRITICAL 0건. WARNING 3건 모두 기능 결함이 아니라 (1) 신규 미러 가드 자신의 CI 커버리지 갭(channel-web-chat), (2) plan 체크리스트와 실제 실행 상태의 불일치, (3) 가드 자신의 감시 목록(SOT_SYMBOLS/SCAN_DIRS) 데이터 중복 — 이 PR이 없애려던 "값 미러 발산" 패턴이 가드의 설정 데이터 레벨에서 축소 재생산된 형태다. forced(router_safety) 화이트리스트 8명 전원 결과가 확보되어 있어 은닉된 Critical/Warning은 없다.

핵심 리팩터(backend/frontend 손복제 마스킹 마커 상수·판정 로직·깊이 상한을 `@workflow/masked-markers` 공유 패키지로 추출) 자체는 순수 값 이동이며, 마커 리터럴(`'***'`/`'[REDACTED]'`/`'[REDACTED_DEPTH]'`)·`isMaskedMarker` 시그니처·깊이 상한(10)·비교 연산자 모두 이관 전후 동일함을 다수 reviewer 가 소스 대조로 확인했다. 직전 리뷰 라운드(`11_27_29`) WARNING 3건도 이번 diff(`bf0618a7d`)에서 실제로 반영됐음이 코드 대조로 확인됐다.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 아키텍처 | 미러 소멸 가드 `SCAN_DIRS` 가 `channel-web-chat/src` 를 명시적으로 포함하지만, `web-chat-checks.yml` 은 별도 vitest 스위트만 실행하고 backend/frontend 가드 어느 사본도 포함하지 않아, channel-web-chat 만 단독으로 바뀌는 PR 에서는 두 가드 중 어느 것도 CI 에서 실행되지 않는다 — 이 PR 자신이 고치려던 "가드가 한쪽에만 있어 반대쪽 변경에 무력하다" 결함이 세 번째 스택에 그대로 남음 | `codebase/backend/src/repo-guards/__tests__/masked-marker-mirror-guard.ts:31-36`, `codebase/frontend/src/lib/repo-guards/__tests__/masked-marker-mirror-guard.ts:31-36` (SCAN_DIRS); `.github/workflows/web-chat-checks.yml:40-43,111,113`(widget job 이 `pnpm --filter channel-web-chat test` 만 실행, 미러 가드 미포함); `frontend-checks.yml`/`backend-checks.yml` pathspec 에 `channel-web-chat` 부재 | `web-chat-checks.yml` widget/sdk job 에 프런트 미러 가드 스위트 실행 스텝 추가, 또는 channel-web-chat 안에 세 번째 사본 신설(기존 backend/frontend 이원화 패턴과 일관). 최소한 `SCAN_DIRS` 주석의 "두 스택" 표현부터 실제 3-dir 에 맞게 정정 |
| 2 | 문서/스코프 | `spec/5-system/14-external-interaction-api.md` R17 SoT 서술 정정이 이 changeset(`bf0618a7d`) 안에서 이미 developer 에 의해 실행됐는데도, 이 작업의 SoT 문서인 `plan/in-progress/masked-marker-shared-package.md` 체크리스트는 여전히 미체크(`[ ]`) 상태로 "planner 턴 필요"라고 서술한다 — 선언된 스코프와 실제 diff 가 어긋남 | `plan/in-progress/masked-marker-shared-package.md:127`; 실행 근거 `spec/5-system/14-external-interaction-api.md:1624-1631`(frontmatter `code:` 목록 갱신 포함), `review/code/2026/08/21/11_27_29/RESOLUTION.md` "WARNING 3" 절 | `plan/in-progress/masked-marker-shared-package.md:127` 를 `[x]` 로 갱신하고, "`RESOLUTION.md` WARNING 3 판단에 따라 `--impl-done` 검증과 함께 같은 턴에 처리(선례: `eia-context-schema-followups.md`) — 별도 planner 턴 생략"과 같은 대체 근거를 남긴다. 트래커 다른 두 항목에 적용한 것과 동일 패턴 |
| 3 | 유지보수성 | 미러 소멸 가드 자신의 감시 목록(`SOT_SYMBOLS`/`SCAN_DIRS`)이 backend/frontend 두 파일에 리터럴 배열로 손 복제돼 있고, 둘의 동기화를 강제하는 테스트가 없다 — 향후 공유 패키지에 신규 심볼이 추가될 때 한쪽 목록만 갱신되면, 그 반대쪽 스택 전용 PR 이 신규 심볼 재선언을 조용히 통과시킨다(값 미러 발산과 같은 실패 클래스가 가드 설정 데이터 레벨에서 재현) | `codebase/backend/src/repo-guards/__tests__/masked-marker-mirror-guard.ts:22-29,32-36`, `codebase/frontend/src/lib/repo-guards/__tests__/masked-marker-mirror-guard.ts:22-29,32-36` | 한쪽을 정본으로 삼아 반대쪽 spec/test 에서 두 목록이 일치하는지 검증하는 캐너리 추가, 또는 `SOT_SYMBOLS` 를 `@workflow/masked-markers` 의 실제 named export 표면에서 자동 도출 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 아키텍처/요구사항/테스트/유지보수성 | `findMirrorRedeclarations` 의 `SOT_DIR` 자기 제외 분기가 현재 `SCAN_DIRS`(3-dir) 어디에도 `codebase/packages/masked-markers` 가 포함되지 않아 도달 불가능한 죽은 코드이며, 향후 도달 가능해지더라도 경계 없는 접두 문자열 비교(`startsWith`)라 형제 디렉터리를 오배제할 수 있다(이미 직전 라운드에서 인지·의도적 보류) | `codebase/backend/.../masked-marker-mirror-guard.ts:19,115`, `codebase/frontend/.../masked-marker-mirror-guard.ts:14,122` | 조치 불요(이미 트래킹됨). 향후 `SCAN_DIRS` 확장 시 `startsWith(SOT_DIR + '/')` 로 경계 명시 |
| 2 | 성능 | 신규 backend 미러 가드 신설로 저장소 3개 소스 트리 전체를 동기 순회·전문 읽기하는 스캔이 backend·frontend 양쪽에서 각각 실행되어 CI 스캔 I/O가 사실상 2배가 됨 | `codebase/backend/.../masked-marker-mirror-guard.ts:32-36,105-122`, `codebase/frontend/.../masked-marker-mirror-guard.ts:32-36,113-133` | 조치 불요(CI 경로 게이팅 사각지대 제거를 위한 의도된·문서화된 트레이드오프, 값싼 substring 사전 필터로 비용 억제). 저장소 규모 증가 시 스캔 결과 캐시 공유 검토 |
| 3 | 유지보수성 | backend/frontend 미러 가드 탐지 로직(`listSourceFiles`/`findRedeclaredSymbols`/`findMirrorRedeclarations`, ~130줄)이 스타일(quote·import·경로 계산 방식)만 다르고 거의 동일하게 두 파일에 복제됨 — `_shared.ts` 추출 선례("파서 복제 금지")와 결이 다름 | `codebase/backend/src/repo-guards/__tests__/masked-marker-mirror-guard.ts`(전체), `codebase/frontend/src/lib/repo-guards/__tests__/masked-marker-mirror-guard.ts`(전체) | 조치 불요(헤더 코멘트로 근거 문서화된 의도적 트레이드오프 — "탐지 로직 중복은 값 미러와 달리 안전"). 다음에 로직을 고칠 때 두 파일 중 하나만 고치는 일이 생기면 그것이 공유 유틸 재추출 신호 |
| 4 | 테스트/유지보수성 | backend 신규 스펙 파일이 저장소 루트를 고정 상대경로(`path.resolve(__dirname, '../../../../..')`)로 계산 — frontend 형제 가드는 `_shared.ts` 의 marker 탐색(`pnpm-workspace.yaml` 탐색) 방식을 쓰는 것과 대조적, `__tests__` 깊이 변경 시 조용히 엉뚱한 디렉터리를 스캔할 수 있음 | `codebase/backend/src/repo-guards/__tests__/masked-marker-mirror.spec.ts:33` | 급하지 않음("스캔 대상 500개 이상" 캐너리가 완전 이탈은 백스톱). 향후 backend 사본도 marker 탐색 방식으로 통일 검토 |
| 5 | 성능/유지보수성 | 루프 불변 값(`SOT_DIR.split(path.sep).join("/")`)이 파일 순회마다 재계산됨(상수 오버헤드, 무시 가능한 수준) — backend 사본은 애초에 슬래시 리터럴로 선언해 이 재계산이 없음 | `codebase/frontend/src/lib/repo-guards/__tests__/masked-marker-mirror-guard.ts:122` | 루프 진입 전 1회만 계산해 재사용 |
| 6 | 의존성/부작용/스코프 | `pnpm-lock.yaml` 에 이 PR 의도와 무관한 `eslint-config-next`/`eslint-import-resolver-typescript` 등 peer-dependency 재해석(dedup)이 동반됨 — 버전 불변, 신규 패키지 추가에 따른 `pnpm install` 재계산 부산물, 직전 라운드에서 이미 조치 불요로 판정된 항목 | `pnpm-lock.yaml`(eslint-config-next@16.3.0 관련 snapshots 구간) | 조치 불요 |
| 7 | 유지보수성 | 신규 패키지 `package.json` 의 `prepare` 스크립트가 저장소 내 9번째로 동일한 인라인 `node -e` 스크립트를 복제(기존 `ai-end-reason` 등 8개 패키지의 선존 관행을 그대로 답습, 신규 결함 아님) | `codebase/packages/masked-markers/package.json`(`scripts.prepare`) | 이번 PR 범위 밖. 패키지가 더 늘기 전 공유 `scripts/pkg-prepare.js` 로 추출 검토(이전 라운드에서도 동일 제안) |
| 8 | 요구사항 | spec R17 신규 SoT 서술이 backtick 텍스트만 사용, 선례(`@workflow/ai-end-reason`)가 쓰는 상대경로 마크다운 링크 형식을 따르지 않음(순수 스타일 차이) | `spec/5-system/14-external-interaction-api.md:1625` vs `spec/4-nodes/3-ai/1-ai-agent.md:463` | 조치 불요(선택). 향후 편집 기회에 링크 형식 통일 |
| 9 | 부작용 | frontend `MASKED_MARKERS` 타입이 `ReadonlySet<string>` → `readonly string[]` 로 변경됐으나, 기존 소비처(`dynamic-form-ui.test.tsx`, `masked-markers.test.ts`) 전수 확인 결과 전부 스프레드만 사용해 무해함을 확인 | `codebase/frontend/src/lib/utils/masked-markers.ts:56` | 조치 불요. 향후 `.has()` 소비 코드가 추가되면 컴파일 타임에 걸려 런타임 위험 없음 |
| 10 | 보안 | 프런트 `MASKED_MARKERS` 가 `Object.freeze` 로 런타임 불변성을 실제로 획득(기존 `ReadonlySet` 은 타입 레벨 readonly 뿐이라 런타임 변형 가능했음, 개선), SoT 통합으로 크로스스택 drift→조용한 fail-open 클래스가 구조적으로 닫히고, 직전 라운드가 지적한 "미러 가드가 frontend 에만 있어 backend-only PR 에 무력" WARNING 도 backend 사본 신설로 해소됨 | `codebase/packages/masked-markers/src/index.ts:43,81`; `codebase/backend/src/repo-guards/__tests__/masked-marker-mirror-guard.ts`(신규) | 조치 불요 — 개선사항 기록 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 마스킹 로직 값/비교 이관 전후 동일 확인, freeze 불변성 개선, CI 사각지대 해소 확인(INFO만) |
| performance | NONE | hot path(deepRedactCore 등) 무변경, 미러 가드 스캔 I/O 2배(의도된 트레이드오프), 루프 불변값 재계산(INFO만) |
| architecture | MEDIUM | channel-web-chat 이 SCAN_DIRS 에 포함되나 CI 어느 워크플로도 가드를 실행하지 않음(WARNING) |
| requirement | NONE | 직전 라운드 WARNING 3건 실제 반영 확인, 기능 완전성 이상 없음(INFO만) |
| scope | MEDIUM | spec R17 편집 실행됐으나 plan 체크리스트 미갱신(WARNING) |
| side_effect | LOW | 인터페이스 변경(ReadonlySet→array) 무해 확인, fs 부작용 test-time 격리 확인(INFO만) |
| maintainability | LOW | SOT_SYMBOLS/SCAN_DIRS 데이터 중복 및 동기화 테스트 부재(WARNING) |
| testing | LOW | 직전 WARNING/INFO 해소 확인, 고정 상대경로·SOT_SYMBOLS 동기화 부재(INFO) |
| documentation | LOW | plan 체크리스트가 실제 spec R17 실행 상태를 반영하지 못함(WARNING, scope #2와 동일 사안) |
| dependency | NONE | 신규 외부 패키지 없음, 등록 표면 8곳 정합, pnpm-lock 노이즈 무해 확인(INFO만) |
| user_guide_sync | NONE | doc-sync-matrix 22행 대조 결과 매칭 없음(spec-major-change 행은 diff 내 이미 이행) |

## 발견 없는 에이전트

- **user_guide_sync** — 발견사항 없음(매트릭스 전수 대조, 매칭 행 없음)

## 권장 조치사항

1. `plan/in-progress/masked-marker-shared-package.md:127` 체크리스트를 `[x]` 로 갱신하고 spec R17 정정의 실제 실행 경로(`--impl-done` 검증 + 선례 인용)를 대체 근거로 남긴다(WARNING 2).
2. `web-chat-checks.yml` 에 미러 소멸 가드 실행 경로를 추가하거나 channel-web-chat 전용 사본을 신설해, 이 PR 이 원래 없애려던 CI 경로 게이팅 사각지대를 세 번째 스택까지 완전히 닫는다(WARNING 1).
3. backend/frontend 미러 가드의 `SOT_SYMBOLS`/`SCAN_DIRS` 를 대조하는 캐너리 테스트를 추가하거나 패키지 export 표면에서 자동 도출해, 감시 목록 자체의 drift 가능성을 제거한다(WARNING 3).
4. (선택, 저비용) 루프 불변값 재계산 제거, backend 스펙 파일의 고정 상대경로를 marker 탐색으로 통일, spec R17 마크다운 링크 형식 통일 — 여유 있을 때 일괄 반영.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security, performance, architecture, requirement, scope, side_effect, maintainability, testing, documentation, dependency, user_guide_sync` (11명)
  - **제외**: 표 (3명, 구체적 사유는 라우터 산출물에 미포함)
  - **강제 포함(router_safety)**: `dependency, documentation, maintainability, requirement, scope, security, side_effect, testing` (8명) — 전원 결과 확보됨, 은닉된 Critical/Warning 없음

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | database | 라우터 판단(구체 사유 미제공) — diff 에 DB 스키마/쿼리 변경 없음(순수 값 이관+CI 가드) |
  | concurrency | 라우터 판단(구체 사유 미제공) — diff 에 동시성/레이스 관련 변경 없음 |
  | api_contract | 라우터 판단(구체 사유 미제공) — diff 에 외부 API 계약 변경 없음(내부 패키지 추출) |