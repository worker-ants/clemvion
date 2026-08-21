# Code Review 통합 보고서

## 전체 위험도
**LOW** — Critical 0건, WARNING 3건(모두 이미 완화되었거나 팀이 의도적으로 미해결 처분한 사항의 재확인). forced 화이트리스트(8명) 전원 결과 확보됨 — 미이행 항목 없음.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Governance/Scope | spec R17 정정이 `developer`/code-review RESOLUTION 세션에 의해 CLAUDE.md 가 규정한 `spec/` read-only 권한 경계 밖에서 직접 실행됨(커밋 `bf0618a7d`). 내용 자체는 정확하고 팀이 이미 "기록만" 으로 처분(의도적 미해결)했으나 최종 diff 에도 그대로 남아 있음 | `spec/5-system/14-external-interaction-api.md:1625`, frontmatter `code:` `:16`; `plan/in-progress/masked-marker-shared-package.md:127-134` | 되돌릴 필요 없음(팀 결정 재확인). "code-review RESOLUTION 이 사소한 spec 텍스트를 직접 정정할 수 있는 예외 조건"을 CLAUDE.md 에 명시하는 것은 이 PR 과 무관한 별도 project-planner 턴으로 처리 |
| 2 | Maintainability/Architecture | frontend `findMirrorRedeclarations` 안의 로컬 `const sot`(정규화된 `SOT_DIR` 문자열)가 파일 상단 `import * as sot from "@workflow/masked-markers"`(패키지 네임스페이스)를 섀도잉. 동시에 루프-불변 값이 안쪽 `for` 루프마다 재계산됨(500+ 파일 스캔). backend 쌍둥이는 `SOT_DIR` 을 모듈 레벨 리터럴로 선언해 이 문제가 없음 — 5라운드째 반복되는 "쌍둥이 파일 divergence" 패턴의 스타일 차원 재발 | `codebase/frontend/src/lib/repo-guards/__tests__/masked-marker-mirror-guard.ts:11`(import), `:143`(지역 변수, `findMirrorRedeclarations` 내부 루프) | 지역 변수를 루프 밖으로 끌어올리고 이름을 `sotPrefix` 등으로 변경(섀도잉+재계산 동시 해소). 선택: `no-shadow` lint 규칙 도입 검토 |
| 3 | Documentation | "탐지 로직의 중복은 구멍을 만들지 않는다"는 JSDoc 절대 서술이 이 PR 자기 리뷰 역사 안에서 이미 두 차례 반증(라운드3→4 접두 경계 backend/frontend 비대칭 사고)됐는데도, 그 반증에서 얻은 정정된 이해("캐너리로 파생 일치를 강제해야만 안전")가 RESOLUTION.md 에만 남고 소스 JSDoc 4곳에는 반영되지 않음. 현재는 캐너리가 존재해 동작 영향 없음(차단 사유 아님) | `codebase/backend/src/repo-guards/__tests__/masked-marker-mirror-guard.ts:11-12`, frontend 동일 헤더, `masked-marker-mirror.spec.ts:29-30` 등 4곳 동일 문구 | 헤더 문구를 조건부 서술로 정정 — "새 파생 분기를 추가할 때마다 양쪽에 대칭 캐너리를 함께 추가해야 이 보장이 유지된다"는 취지 반영 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Testing | frontend 기존 소비 테스트(diff 밖)의 JSDoc 이 "공유 패키지 추출이 선행돼야 값싸다"고 서술하나 이번 PR 이 이미 그 추출을 완료 — stale. 직전 라운드부터 미해소 상태로 이미 추적됨 | `codebase/frontend/src/lib/utils/__tests__/masked-markers.test.ts:8-26` | JSDoc 을 "SoT 는 패키지, 여기는 로컬 캐너리"로 갱신(값싼 drive-by 편집) |
| 2 | Testing | backend `MAX_REDACT_DEPTH` 경계 테스트가 정확한 10/11 값을 고정하지 않고 "언젠가 멈춘다"만 단언 — plan 후속 트래커에 이미 등재, 실질 위험 낮음(frontend 가 10/11 양방향 고정) | `codebase/backend/src/shared/utils/sanitize-error-message.spec.ts:240` | 조치 불요(추적됨). 이후 backend `deepRedactSecrets` 직접 수정 PR 에서 경계 테스트 추가 |
| 3 | Testing/Requirement | AST 재선언 탐지기가 var/function/class 세 형태만 잡고 enum/type/interface/namespace 는 다루지 않음 — 문서화된 설계 범위와 일치, 현재 SoT 심볼(상수+함수)엔 도달 가능성 없음 | `masked-marker-mirror-guard.ts`(backend/frontend 양쪽) `visit()`/`findRedeclaredSymbols` | 조치 불요. 헤더 주석에 스코프 명시 검토 |
| 4 | Requirement | 패키지 spec 의 `MAX_MASK_DEPTH` 테스트가 정확한 값(10) 대신 "정수·양수"만 고정 — 의도적 설계("값보다 '같은 것을 본다'가 중요"), 실질 경계는 frontend 테스트가 커버 | `codebase/packages/masked-markers/src/__tests__/index.spec.ts` | 조치 불요 |
| 5 | Scope/Dependency | `pnpm-lock.yaml` 의 `eslint-config-next` peer-dependency variant dedup — 목표와 무관, 버전 불변, 4라운드 연속 동일 확인 | `pnpm-lock.yaml` (frontend importer + snapshots) | 조치 불요(불가피한 `pnpm install` 부산물) |
| 6 | Security | 신규 미러 가드가 저장소 전체 `.ts`/`.tsx` 소스를 TS 컴파일러 API 로 파싱 — 입력이 저장소 자신의 커밋된 소스(신뢰 경계 내부)이고 `__tests__`/`repo-guards` 경로라 프로덕션에 미포함 | `masked-marker-mirror-guard.ts` `findMirrorRedeclarations`/`findRedeclaredSymbols` (양쪽) | 조치 불요 |
| 7 | Security/Dependency/Side_effect | 신규 패키지 `package.json` 의 `prepare` 스크립트가 `execSync('tsc')` 실행 — 이 저장소 8개 내부 패키지와 바이트 단위 동일 관행의 9번째 복제, 신규 위험 아님 | `codebase/packages/masked-markers/package.json` (`scripts.prepare`) | 조치 불요 |
| 8 | Side_effect | `MASKED_MARKERS` 의 frontend 타입이 `ReadonlySet<string>` → `readonly string[]` 로 변경됐으나 `.has()` 직접 호출 소비처가 없어(grep 전수 확인) 영향 없음 | `codebase/frontend/src/lib/utils/masked-markers.ts:56` | 조치 불요 |
| 9 | Dependency | 신규 워크스페이스 패키지는 런타임 외부 의존 zero, devDependencies 는 선례 `@workflow/ai-end-reason` 과 버전까지 완전 동일. `license` 필드 없음도 저장소 전역 관행과 일치 | `codebase/packages/masked-markers/package.json` | 조치 불요 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 마스킹 로직(정규식/판정/깊이 상한) 이관 전후 값 불변 확인. 신규 결함 없음 |
| architecture | NONE | SRP/OCP/의존 방향 개선 확인. `sot` 섀도잉은 INFO 로 관측(maintainability 가 WARNING 으로 통합) |
| requirement | NONE | 이전 4라운드 WARNING 전부 해소 재확인, spec R17 line-level 일치 |
| scope | LOW | spec 편집 권한 경계 이탈(기존 처분 재확인) + 무관 lockfile 노이즈 |
| side_effect | NONE | 접두 경계 비대칭(직전 WARNING) 양쪽 대칭 수정 확인, 신규 부작용 없음 |
| maintainability | LOW | frontend `sot` 섀도잉 + 루프-불변 재계산 (신규 WARNING) |
| testing | LOW | 캐너리로 뮤테이션 검증 완료, 잔여는 전부 INFO(이미 추적된 항목 포함) |
| documentation | LOW | JSDoc 절대 서술이 PR 자체 이력에서 두 차례 반증됐음에도 미정정 (신규 WARNING) |
| dependency | NONE | 신규 워크스페이스 패키지, 외부 런타임 의존 0, 8곳 등록 정합 확인 |
| user_guide_sync | NONE | 매트릭스 20행 전수 대조, 사용자 가시 변경 없음(순수 내부 리팩터) |

## 발견 없는 에이전트

없음(전원 최소 INFO 이상 관측 보고, user_guide_sync 는 "해당 없음" 결론이나 전수 대조 과정 기록).

## 권장 조치사항

1. (documentation WARNING 3) 4곳의 JSDoc "탐지 로직 중복은 구멍을 만들지 않는다" 절대 서술을 조건부 서술로 정정 — "새 파생 분기 추가 시 양쪽에 대칭 캐너리 필수"라는, 이미 RESOLUTION.md 에 남은 정정된 이해를 소스로 옮긴다.
2. (maintainability WARNING 2) frontend `masked-marker-mirror-guard.ts` 의 지역 변수 `sot` 를 `sotPrefix` 로 개명하고 루프 밖으로 끌어올려 섀도잉과 루프-불변 재계산을 동시 해소.
3. (scope WARNING 1) spec R17 정정 자체는 되돌리지 않되, "code-review RESOLUTION 의 spec 직접 정정 예외 조건"을 CLAUDE.md 에 명시하는 별도 project-planner 턴을 이 PR 과 무관하게 진행할지 검토.
4. INFO 9건은 전부 조치 불요이거나 이미 plan 트래커에 등재된 저위험 항목 — 이번 PR 을 막을 사유 없음.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security, architecture, requirement, scope, side_effect, maintainability, testing, documentation, dependency, user_guide_sync` (10명)
  - **제외**: 표 (4명)
  - **강제 포함(router_safety)**: `dependency, documentation, maintainability, requirement, scope, security, side_effect, testing` (8명, 전원 결과 확보됨 — 화이트리스트 미이행 없음)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | router 판단상 해당 diff 와 낮은 관련도(순수 값 도메인 리팩터, 성능 영향 없음) |
  | database | DB 스키마/쿼리 변경 없음 |
  | concurrency | 동시성 로직 변경 없음(값 상수 이관) |
  | api_contract | API 계약(엔드포인트/DTO) 변경 없음 |