# Code Review 통합 보고서 (fresh — resolution 커버)

## 전체 위험도
**LOW** — CRITICAL 0, WARNING 1(jsonwebtoken 버전 고정, **이번 diff 범위 밖 기존 설정**). 나머지는 전부 INFO 수준 개선 제안. 새 보안 취약점·기능 회귀·데이터 소실 위험 없음.

## Critical 발견사항
_없음_

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 의존성/보안 | `jsonwebtoken` 이 `"9.0.3"` (caret 없이) 정확 고정 — 보안 패치 자동 반영 안 됨. **이번 diff 외 기존 설정**(lint 툴링과 무관). | `codebase/backend/package.json` line 67 | 의도적 고정이면 주석 명시, 아니면 `"^9.0.3"`. → 본 PR 범위 밖, 별도 dependency 백로그 (RESOLUTION 참조). |

## 참고 (INFO) — 비차단 advisory
- README 전반 `npm`→`pnpm` 미반영(이번 diff 는 lint 행만 갱신; 전수 교체는 별도).
- `lint` 에서 `--fix` 제거로 훅 자동수정 동작 변화(의도된 변경; `lint:fix` 로 대체 가능).
- `eslint.config.mjs` 인라인 주석 압축 / test override 그룹 주석 / `plan-frontmatter.test.ts` 임계값·경로검증 명시성 — 모두 선택적 개선.
- SPEC-DRIFT: `plan-lifecycle.md §5 Gate C` 의 `spec_impact` 섹션-참조 불허 명문화 → project-planner 위임.
- `gray-matter` frontend deps 분류 확인 / 프로덕션 281 no-unnecessary-type-assertion warn 정리 백로그 / swagger pin(주석 충분).

## 에이전트별 위험도 요약
| 에이전트 | 위험도 | 핵심 |
|---|---|---|
| security | LOW | jsonwebtoken 고정(diff 외), no-unsafe-* warn 유지 |
| requirement | LOW | SPEC-DRIFT 1(형식 명세) — 코드 옳음 |
| scope | LOW | (output_file write_blocked — 라우터 success) |
| side_effect | LOW | lint --fix 제거 동작변화(의도) |
| maintainability | LOW | 주석·경로검증 INFO |
| testing | LOW | 임계값 주석·281 warn 백로그 INFO |
| documentation | LOW | README npm→pnpm INFO |
| dependency | LOW | jsonwebtoken WARNING(diff 외) |

## 라우터 결정
router_safety 강제 8명 실행(security/requirement/scope/side_effect/maintainability/testing/documentation/dependency), 6명 제외(performance/architecture/database/concurrency/api_contract/user_guide_sync). `scope.md` 는 terminal write_blocked 로 디스크 미기록(라우터 success).

> CRITICAL=0 / WARNING=1(diff 외 pre-existing). 본 변경에서 비롯된 신규 actionable 결함 없음.
