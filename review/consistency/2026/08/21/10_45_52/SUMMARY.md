# Consistency Check 통합 보고서

**BLOCK: YES** — Critical 1건 발견 (convention_compliance: plan frontmatter 필수 필드 누락, build guard 실측 RED)

## 전체 위험도
**HIGH** — frontmatter 필수 필드 누락으로 build guard(`plan-frontmatter.test.ts`)가 현재 실측 RED. 수정 자체는 기계적(2필드 추가)이나 방치 시 build 를 막는다. 그 외 발견은 전부 "이관 후 문서가 stale 해진다" 류의 동기화 누락(WARNING/INFO)이며 아키텍처·결정 자체의 충돌은 없음.

## Critical 위배 (BLOCK 사유)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | convention_compliance | plan frontmatter 필수 3필드(`worktree`/`started`/`owner`) 중 `started`·`owner` 누락. 직접 실행(`pnpm vitest run src/lib/docs/__tests__/plan-frontmatter.test.ts`)으로 2건 FAIL 실측 확인 | `plan/in-progress/masked-marker-shared-package.md` frontmatter (최상단) | `spec/conventions/spec-impl-evidence.md` §4 및 `.claude/docs/plan-lifecycle.md §4` (line 75) — 3필드 필수, build guard 강제 | frontmatter 에 `started: 2026-08-21`(ISO), `owner: <역할/이름>` 추가. `worktree:` 는 이미 존재하므로 두 필드만 보강하면 guard 통과 |

## planner 인계 (권한 밖 Critical)

(없음) — 위 Critical 은 plan 문서 frontmatter 보강으로, `plan/**` 쓰기 권한 내에서 즉시 해소 가능. spec drift 등 권한 밖 사안이 아님.

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | cross_spec / rationale_continuity / plan_coherence (중복 통합) | 이관 완료 후 spec R17 "마커 집합은 backend `sanitize-error-message.ts` 가 SoT · 프런트가 미러 · 어긋나면 가드가 뚫린다" 서술이 사실과 어긋나게 되는데(SoT 는 공유 패키지로 이동), target 의 "작업" 체크리스트에 이 spec 문장을 갱신하는 항목이 없음. `spec_impact` 에 문서는 이미 등재돼 있으나 구체 지시 부재 | `plan/in-progress/masked-marker-shared-package.md` "무엇을 옮기나" 절 / `## 작업` 체크리스트(L80-90) | `spec/5-system/14-external-interaction-api.md:1624-1625`(R17) — frontmatter `code:` 목록도 `codebase/packages/masked-markers/**` 미등재 | 작업 체크리스트에 "R17 SoT 문장을 `SoT 는 @workflow/masked-markers` 로 갱신 + frontmatter `code:` 에 패키지 경로 추가" 항목 명시 추가. 정본 선례: `spec/conventions/interaction-type-registry.md:121` 등 `@workflow/ai-end-reason` 이관 시 동일 패턴 정정 사례 |
| 2 | plan_coherence / rationale_continuity (중복 통합) | target 이 스스로 "PR #1189 의 이월 항목"이라 밝힌 정본 트래커 항목(마커 미러 계약 테스트)을 어디에서도 인용하지 않고, 완료 시 그 항목을 닫거나("계약 테스트→추출+캐너리 대체"로 정정)하는 절차가 체크리스트에 없음 | 문서 전체(서두 + `## 작업` 체크리스트) | `plan/in-progress/spec-sync-external-interaction-api-gaps.md:373-382`, `:757-760` (아직 `[ ]`) | "다른 plan 과의 관계" 절 추가해 트래커 라인 명시 + 작업 체크리스트에 해당 두 항목 `[x]` 처리(대체 근거 기록)를 구현 커밋과 같은 턴에 포함. 직접 선례: `plan/in-progress/ws-event-types-extract.md` |
| 3 | convention_compliance | `worktree:` 값이 `.claude/worktrees/masked-marker-contract-7d2e14` 로 절대경로 접두 포함 — 스키마 예시·전 in-progress plan 29개 전수 선례(bare 디렉토리명)와 형식이 다름. 기능은 `plan_guard.py` 정규화로 흡수되어 깨지지 않으나 표기가 규약과 어긋남 | frontmatter `worktree:` 필드 | `.claude/docs/plan-lifecycle.md §4` 스키마 예시 | `worktree: masked-marker-contract-7d2e14` 로 bare 디렉토리명만 남기기 |
| 4 | convention_compliance / plan_coherence (중복 통합) | "등록 표면 실측 7곳 + lockfile" 체크리스트의 "하나라도 빠지면 `internal-package-registration.test.ts` 가 잡는다" 서술이 실제 가드 범위(자동 검증 2항목: `.claude/test-stages.sh`, `packages-checks.yml`)보다 넓음. Dockerfile 2곳(backend/frontend 일반)·package.json workspace 의존 2곳·lockfile 은 자동 가드 없이 수동 확인에 의존 | `## 등록 표면 (실측 7곳 + lockfile)` 섹션 서두 | 가드 실물 `codebase/frontend/src/lib/repo-guards/__tests__/internal-package-registration.test.ts` 및 별도 백스톱(`scripts/check-e2e-playwright-config.py`, docker build) | 문구를 "①②는 자동 검증, Dockerfile 2곳·package.json 2곳·lockfile 은 자동 가드 없음 — PR 리뷰 수동 대조 필요"로 정정. 선택: 가드 확장을 후속 항목으로 남김 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | naming_collision | 이관 후 패키지가 export 할 깊이 상한 상수의 canonical 이름 미정(backend `MAX_REDACT_DEPTH` vs frontend 내부 전용 `MAX_MARKER_SCAN_DEPTH`, 둘 다 값은 10) — 충돌은 아니고 명확화 여지 | `codebase/packages/masked-markers/`(신규) export 설계 | canonical 이름(예: `MAX_MASK_DEPTH`) 하나 정하고 재export 별칭임을 JSDoc 한 줄로 명시 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | LOW | R17 "backend SoT/프런트 미러" 서술이 이관 후 stale — 체크리스트에 갱신 항목 없음(WARNING 1건). 데이터모델·API계약·RBAC 등 직접 모순 없음 |
| rationale_continuity | LOW | 동일 R17 stale 이슈(WARNING) + 관련 tracker 2건 미종결(INFO). 추출 결정 자체는 트래커가 사전에 예견·권고한 경로이며 기각 이력 없음(문제 없음 확인) |
| convention_compliance | HIGH | frontmatter 필수 필드 누락 — build guard 실측 RED(CRITICAL). `worktree:` 형식 불일치, 등록 표면 안전망 서술 과장(WARNING 2건) |
| plan_coherence | MEDIUM | 정본 트래커 미참조/미갱신, spec SoT 서술 stale(둘 다 WARNING) — 직접 선례(`ws-event-types-extract.md`)가 두 패턴 모두 이미 처리한 것과 대비. 등록 표면 서술 과장(INFO). 결정 충돌은 없음 |
| naming_collision | NONE | 신규 식별자는 패키지 경로/이름 하나뿐이며 기존 7개 패키지·등록 목록·명명 컨벤션과 충돌 없음. canonical 상수명 미정 1건(INFO) |

## 권장 조치사항
1. **(BLOCK 해소, 필수)** `plan/in-progress/masked-marker-shared-package.md` frontmatter 에 `started: 2026-08-21`, `owner: <역할/이름>` 추가 — build guard(`plan-frontmatter.test.ts`) RED 해소.
2. `worktree:` 값을 `masked-marker-contract-7d2e14` (bare 디렉토리명)로 정정.
3. `## 작업` 체크리스트에 spec R17 SoT 문장 갱신(+ frontmatter `code:` 목록에 패키지 경로 추가) 항목을 명시 추가.
4. "다른 plan 과의 관계" 절을 추가해 `spec-sync-external-interaction-api-gaps.md:373`·`:757` 을 정본 트래커로 명시하고, 구현 커밋과 같은 턴에 해당 두 항목 `[x]` 처리.
5. "등록 표면" 섹션의 안전망 서술을 실제 가드 커버리지(자동 2항목 / 수동 확인 5항목)에 맞게 정정.
6. (선택) 패키지 내부 깊이 상한 상수의 canonical 이름을 정하고 JSDoc 으로 재export 관계 명시.