# Code Review 통합 보고서

## 전체 위험도
**LOW** — 전체 변경은 backend lint 게이트를 report-only 로 전환하고 plan 메타데이터를 정비하는 소범위 변경이다. Critical 발견 없음. WARNING 3건 모두 구조적 개선 권고 수준이며 즉시 차단 요인은 없다. security·side_effect·maintainability 결과 파일 3건은 디스크에 기록되지 않아 재시도 필요로 처리한다.

---

## Critical 발견사항

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| — | — | Critical 발견사항 없음 | — | — |

---

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Testing | `plan-frontmatter.test.ts` 의 sentinel 파일명 하드코딩 — `competitive-analysis-n8n-flowise.md` 가 `plan/complete/` 로 이동하면 테스트가 다시 깨지는 구조적 취약성 | `codebase/frontend/src/lib/docs/__tests__/plan-frontmatter.test.ts` line 362 | sentinel 검증을 특정 파일명에서 분리해 count 검증(`> 20`)만 남기거나, 안정적인 index 파일 기준으로 대체할 것 |
| 2 | Documentation | `codebase/backend/README.md` 스크립트 표에 `lint:fix` 항목 누락 — `lint` 의 의미가 report-only 로 바뀌었으나 README 에 미반영 | `codebase/backend/README.md` line 19 (`lint` 행) | `lint` 설명을 "ESLint (report-only)"로 수정하고 `lint:fix` 행(`ESLint + 자동 수정 (--fix)`) 추가 |
| 3 | Dependency | `jsonwebtoken` 이 `9.0.3` 으로 caret 없이 정확 고정 — 이후 패치에 보안 수정이 있어도 업데이트가 차단됨. 이번 diff 범위 외 기존 설정이나 주의 필요 | `codebase/backend/package.json` line 219 | 의도적 고정이라면 inline 주석으로 근거 명시. 아니라면 `"^9.0.3"` 으로 패치 허용 |

---

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | SPEC-DRIFT | [SPEC-DRIFT] `plan-lifecycle.md §5 Gate C` 의 `spec_impact` 항목 형식 명세 불완전 — 코드(`exec-single-node.md`)는 YAML 리스트(파일경로만)로 올바르게 수정됐으나, spec 은 섹션 참조 허용 여부를 침묵함 | `plan/complete/exec-single-node.md` frontmatter; `.claude/docs/plan-lifecycle.md §5 Gate C` | 코드 유지. `project-planner` 가 `plan-lifecycle.md §5` 에 "리스트 항목은 파일 경로만 허용(섹션 참조 불포함)" 을 명시하도록 spec 갱신 위임 |
| 2 | Requirement | known-file 교체는 올바른 필수 수정 — `knowledge-base-quality-improvements.md` 가 `plan/complete/` 로 이동됨 | `plan-frontmatter.test.ts` line 53 | 현행 diff 적용으로 해소됨, 추가 조치 불필요 |
| 3 | Requirement | `plans.length > 20` 임계값이 경직적 — 현재 61개로 여유롭지만 대규모 정리 시 vacuous pass 방어 약화 | `plan-frontmatter.test.ts` line 360 | 임계값을 `> 30` 등으로 올리거나 주석으로 의도 설명 |
| 4 | Scope | `plan/complete/exec-single-node.md` 의 `spec_impact` 포맷 변경은 이번 작업 주요 목적(lint 게이트 전환)과 직접 관련 없는 완료 파일 소급 수정 — 세부 섹션 참조 정보가 제거됨 | `plan/complete/exec-single-node.md` frontmatter | 변경 배경 주석 추가 권고 (선택사항) |
| 5 | Testing | `no-unnecessary-type-assertion: warn` 으로 인해 `*.spec.ts` 내 방어적 `as T` 단언에서 warn 노이즈 발생 가능 | `codebase/backend/eslint.config.mjs` test override block | `*.spec.ts` / `*.e2e-spec.ts` override 블록에 `'@typescript-eslint/no-unnecessary-type-assertion': 'off'` 추가 검토 (선택적, CI 차단 아님) |
| 6 | Dependency | `gray-matter` 가 frontend `dependencies`(프로덕션) 에 선언 — `registry.ts` 서버사이드 사용으로 정당하나, Next.js 클라이언트 번들 포함 여부 미검증 | `codebase/frontend/package.json` `dependencies."gray-matter"` | `next build --debug` 또는 번들 분석기로 클라이언트 번들 포함 여부 확인 권장 |
| 7 | Documentation | `codebase/backend/README.md` 의 `npm install` / `npm run start:dev` 가 pnpm 전환 미반영 (이번 PR 범위 외 기존 이슈) | `codebase/backend/README.md` lines 7–9 | `lint:fix` 수정 시 함께 `npm` → `pnpm` 교체 권장 |
| 8 | Dependency | `@nestjs/swagger` 가 workspace 루트 `pnpm.overrides` 에서 `11.2.7` 로 고정 — 주석에 이유 명시됨, 의도적 고정으로 문제 없음 | 루트 `package.json` `pnpm.overrides` | 없음 |

---

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| requirement | LOW | SPEC-DRIFT 1건(spec_impact 형식 명세 불완전), WARNING 1건(known-file 교체 — 이미 해소됨), INFO 2건 |
| scope | LOW | plan/complete 파일 소급 수정이 이번 작업 범위와 직접 연관 없음 (INFO 수준) |
| testing | LOW | sentinel 파일명 하드코딩 구조적 취약 (WARNING 1건) |
| documentation | LOW | README 스크립트 표 미갱신 (WARNING 1건) |
| dependency | LOW | jsonwebtoken 정확 버전 고정 (WARNING 1건, 이번 diff 외 기존 이슈), gray-matter 번들 확인 권고 (INFO) |
| security | — | 결과 파일 없음 (재시도 필요) |
| side_effect | — | 결과 파일 없음 (재시도 필요) |
| maintainability | — | 결과 파일 없음 (재시도 필요) |

---

## 라우터 결정

라우터가 reviewer 를 선별 실행함 (`routing_status=done`).

- **실행**: `security`, `requirement`, `scope`, `side_effect`, `maintainability`, `testing`, `documentation`, `dependency` (8명 — router_safety 강제 포함)
- **제외**: `performance`, `architecture`, `database`, `concurrency`, `api_contract`, `user_guide_sync` (6명 — 해당 변경 성격 없음)

> 참고: `security`, `side_effect`, `maintainability` 는 실행 완료(`status=success`)로 기록되었으나 결과 파일이 디스크에 존재하지 않아(workflow terminal write 차단) 통합 보고서에서 "재시도 필요" 로 처리됨. CRITICAL=0 / WARNING=3 은 디스크 기록된 reviewer 기준.
