# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음

## 전체 위험도
**MEDIUM** — Critical 없음, 차단 사유 없음. 다만 plan 문서 2건이 이 diff 로 실질적으로 갱신 대상이 됐는데(가드 mutation-coverage 갭 해소, repo-guards 패턴 심화) 아직 반영되지 않은 WARNING 이 있어 다음 세션의 판단을 오도할 수 있음.

## Critical 위배 (BLOCK 사유)

(없음 — 5개 checker 전원 CRITICAL 0건)

## planner 인계 (권한 밖 Critical)

(없음)

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | cross_spec | `spec/1-data-model.md §2.9` `next_run_at` 이 non-null(`Timestamp`)로 표기돼 있으나 실제 스키마·코드(`schedule.entity.ts:41-42`)는 `nullable: true` — 문서 nullable 표기 관례(`?`) 위반 | `spec/1-data-model.md:260-261` | `codebase/backend/src/modules/schedules/entities/schedule.entity.ts:41-42` | 이 PR 자체는 원인 아님 — `plan/in-progress/entity-nullable-column-type-mismatch.md` 가 이미 "후속(planner 턴)" 으로 정확히 기록·게이팅해 둠. 신규 조치 불요, planner 턴에서 `Timestamp?` 로 정정 |
| 2 | cross_spec | `spec/5-system/2-api-convention.md §2.2` 명명 규약에 `/api/auth/*` verb-style 엔드포인트(15개+) 예외 조항 부재 | `spec/5-system/2-api-convention.md:45-54` | `/api/auth/*` 컨트롤러 라우트 전반 | 이 PR 과 무관한 선재 gap. plan 이 "이 작업과 무관" 으로 이미 별도 기록. 별도 planner 턴에서 예외 조항 추가 검토 |
| 3 | plan_coherence | `listProductionSources`(`redis-fail-open-catalog-guard.ts`)의 `node_modules`/`dist`/`.d.ts` 제외 분기가 mutation-coverage 갭으로 열려 있다고 `backend-lint-gate-broken-on-main.md` 가 기록해 뒀는데, 이번 diff 가 그 함수를 `collectTsFiles` 위임으로 바꾸며 `source-scan.spec.ts` 의 합성 fixture(`node_modules/pkg/index.ts`·`dist/bundle.ts`·`types.d.ts`)로 그 분기가 이제 mutation-observable 해졌음에도 해당 plan 이 갱신되지 않음 | `codebase/backend/src/repo-guards/__tests__/redis-fail-open-catalog-guard.ts` (`listProductionSources`) | `plan/in-progress/backend-lint-gate-broken-on-main.md` (`19_53_43` testing INFO 1) | 해당 plan 항목에 "`collectTsFiles` 위임으로 `source-scan.spec.ts` 합성 fixture 가 이 분기를 대신 커버 — 재확인 후 닫음" 각주 추가(또는 체크 완료). 재확인은 `listProductionSources` 되돌리는 뮤턴트가 `source-scan.spec.ts` 에서 RED 되는지 1회 확인이면 충분 |
| 4 | plan_coherence | repo-guards `*-guard.ts`/`*-fixture.ts`/`*.spec.ts` 3파일 패턴이 이번 diff 로 5개 guard 의 공유 walker(`collectTsFiles`, 4개 규칙: `.spec.ts`/`.d.ts` 제외·`node_modules`/`dist` skip·정렬)로 더 굳어졌으나, `spec-conventions-engine-error-code-surface.md` 가 "포인터만 남긴다"며 미룬 `spec/conventions/repo-guards.md` 신설 검토가 독립 plan 항목으로 승격되지 않은 채 방치(2026-08-31 이후 갱신 없음, "5쌍" 수치도 이제 stale) | `spec/conventions/`(신설 없음, 델타 0) | `plan/in-progress/spec-conventions-engine-error-code-surface.md` §관련 | 포인터를 독립 plan 항목(또는 신규 `plan/in-progress/spec-conventions-repo-guards-doc.md`)으로 승격하거나, 최소한 이번 diff 로 늘어난 guard 개수·`collectTsFiles` 통합 사실을 반영해 "5쌍 이상" 수치 갱신 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | cross_spec | `masked-reject-callers-guard.ts` 의 `listSourceFiles` → `collectTsFiles(rootDir, { includeSpec: true })` 위임 후에도 스캔 범위(spec 포함, `node_modules`/`dist` 제외) 동일 — EIA §R17 / manual-trigger spec 인용 보장 보존 확인 | `codebase/backend/src/repo-guards/__tests__/masked-reject-callers-guard.ts` | 확인 목적 기록. `collectTsFiles` 기본값(`includeSpec: false`)이 바뀌면 이 호출부의 명시 override 재확인 |
| 2 | rationale_continuity | `nullable-type-lie-cast-guard.ts` `findStaleSpecCasts` docstring(정규식+명시적 한계, AST 비용 근거)이 `spec/conventions/egress-masking.md` `## Rationale > 기각한 대안`(같은 원칙: "유한한 문제를 무한한 문제와 바꾸지 말 것")을 상호 참조하지 않음 — 방향은 일치, 독립 재발견 | `codebase/backend/src/repo-guards/__tests__/nullable-type-lie-cast-guard.ts` | 선택: docstring 에 `egress-masking.md` Rationale 항 한 줄 상호 참조. 강제 아님 |
| 3 | convention_compliance / plan_coherence | `spec/conventions/raw-query-results.md`(`code: source-scan.ts`)는 "raw SQL 결과 읽기" 축만 규정하는데, 이번 diff 로 그 파일에 무관한 두 번째 책임(`collectTsFiles` 디렉터리 수집, `stripLiterals` 리터럴 마스킹)이 추가돼 `code:` 참조 범위가 문서 스코프보다 넓어짐 — gate(≥1 매치)는 통과, 오독 여지만 존재 | `spec/conventions/raw-query-results.md` frontmatter | 급하지 않음. 다음에 문서 만질 때 `code:` 를 실제 정의 함수로 좁히거나 "여러 규약이 공유하는 인프라" 주석 추가 검토 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | LOW | diff 는 spec 표면 무영향, masked-reject-callers-guard 스캔 범위 보존 확인. 상위 작업의 기존 미해결 항목(next_run_at 표기, `/api/auth/*` 예외) 2건은 이미 plan 에 planner 턴 대기로 정확히 기록됨 |
| rationale_continuity | NONE | spec/conventions 델타 0. 코드·plan 모두 판단 번복 시 새 실측·Rationale 동반. `egress-masking.md` 원칙과 방향 일치 |
| convention_compliance | NONE | spec/conventions 델타 0. diff 는 정식 규약이 규율하는 product-surface 무영향. `raw-query-results.md` `code:` 스코프 관찰만 INFO |
| plan_coherence | MEDIUM | target 자체 델타는 0이나, 이 diff 가 만진 공유 인프라가 두 개의 다른 in-progress plan(`backend-lint-gate-broken-on-main.md`, `spec-conventions-engine-error-code-surface.md`)의 미갱신 상태와 교차. plan 문서가 코드 현재 상태를 못 따라가는 유형 |
| naming_collision | NONE | 신규 export 8개(`collectTsFiles` 등) 전부 backend·frontend·packages·channel-web-chat 전역에서 동명 충돌 0건 확인 |

## 권장 조치사항
1. (선택, 비차단) `plan/in-progress/backend-lint-gate-broken-on-main.md` 의 `listProductionSources` mutation-coverage 갭 항목에 "collectTsFiles 위임 + source-scan.spec.ts 합성 fixture 로 재확인 후 닫음" 각주 반영.
2. (선택, 비차단) `plan/in-progress/spec-conventions-engine-error-code-surface.md` 의 repo-guards 규약 신설 포인터를 독립 항목으로 승격하거나 최신 guard 개수(5+)로 갱신.
3. (선택, 비차단) 이 diff 자체는 병합 차단 사유가 없음 — 위 조치는 다음 세션의 plan 정확도를 위한 것으로, 이번 PR 을 막지 않음.
4. planner 턴에서 (기존 등재 사항 재확인 목적) `spec/1-data-model.md §2.9` `next_run_at` 을 `Timestamp?` 로 정정하고 `spec/5-system/2-api-convention.md §2.2` 에 `/api/auth/*` 예외 조항 추가 검토.