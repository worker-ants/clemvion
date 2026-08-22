# Code Review 통합 보고서

## 전체 위험도
**LOW** — CRITICAL/WARNING 없음. 9개 reviewer 전원(all forced whitelist) 정상 실행·전문 확보, 실질 발견은 전부 INFO(설계 참고·확인 기록)이며 architecture·side_effect 두 reviewer 가 트리거 확장/신규 CI 잡의 향후 확장성 관찰로 LOW 를 부여했다. Critical 을 못 본 채 내린 판정이 아님 — forced 8명(dependency, documentation, maintainability, requirement, scope, security, side_effect, testing) + architecture 전원 결과 확보됨.

## Critical 발견사항

(없음)

## 경고 (WARNING)

(없음)

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | maintainability | plan 체크리스트 항목("pathspec 을 되돌리고 주석도 지운다")이 라운드1 정정(997038e94) 이후의 실제 코드(pathspec 유지, 근거만 교체)와 반대로 서술된 채 `[x]` 로 남음 (scope reviewer 도 동일 관찰) | `plan/in-progress/mirror-guard-single-copy.md` 작업 체크리스트; `.github/workflows/frontend-checks.yml:44-53` | 체크리스트 문구를 "유지하되 근거를 typescript-toolchain 소비처로 교체(라운드1 W1 정정)"로 갱신해 plan-코드 불일치 해소 |
| 2 | maintainability | 신규 회귀 테스트의 `REPO_GUARDS_MUST_COVER` 스택 목록이 손으로 나열된 하드코딩 튜플 — 삭제된 `resolveScanDirs` 주석이 세운 "손 목록 지양" 원칙과 반대 방향(단, 실패 방향은 fail-open 아닌 커버리지 검증 범위 축소라 안전) | `.claude/tests/test_required_check_skip_jobs.py:178` (`REPO_GUARDS_MUST_COVER`) | 조치 불요. 신규 `codebase/<stack>` 추가 시 이 튜플도 함께 갱신하라는 한 줄 주석을 남겨두면 향후 드리프트 방지에 도움 |
| 3 | architecture | 크로스스택 CI 불변식 로직(masked-marker-mirror-guard)이 frontend 소스 트리 안에 유일한 정본으로 위치 — 디렉터리 소유권과 실제 책임 범위 불일치(신규 결합 아님, 직전 라운드 관찰의 연속) | `codebase/frontend/src/lib/repo-guards/__tests__/masked-marker-mirror-guard.ts:1-22` | 현 시점 조치 불요. 크로스스택 가드가 더 늘면 `.claude/tests/` 또는 별도 tooling 패키지 재배치 검토 |
| 4 | architecture | `repo-guards.yml` 이 "저장소 전체 스캔 가드 전부의 자리"를 표방하지만 현재 `mirror-guard` 잡 하나 전용 골격 — 두 번째 가드 추가 시 잡 골격 복제 가능성 | `.github/workflows/repo-guards.yml:62-86` | 조치 불요(가드 1개뿐). 두 번째 저장소-전체 가드 추가 시 재검토 |
| 5 | side_effect / dependency | 신규 `repo-guards.yml` 이 `paths:` 필터 없이 모든 codebase PR 에서 상시 실행되고, frontend-touching PR 에서는 `frontend-checks.yml` 과 동일 vitest spec 을 중복 실행(pnpm install 포함) — 워크플로 헤더·plan 문서에 명시적으로 문서화된 트레이드오프 | `.github/workflows/repo-guards.yml:21-31, 62-86` | 조치 불요(수용된 트레이드오프). 두 번째 저장소-전체 가드 추가 시 중복 실행 비용 재검토 가치 있음 |
| 6 | security / dependency | `actions/checkout@v7` 태그(비-SHA) 고정 — 저장소 전역 11개 워크플로 기존 관례이며 이 PR 의 회귀 아님 | `.github/workflows/repo-guards.yml:74` | 조치 불요(비회귀). SHA 핀 전환은 저장소 전체 정책 트래커 대상 |
| 7 | maintainability | `repo-guards.yml` 파일명이 `<영역>-checks.yml` 명명 관례에서 벗어남 — `migration-check.yml` 선례 있고, 직전 라운드(`14_02_49`)에서 이미 INFO 처분됨 | `.github/workflows/repo-guards.yml` (파일명) | 조치 불요(기처분). 통일 원하면 `repo-guards-checks.yml` 개명을 후속 항목으로 |
| 8 | requirement / testing / architecture / dependency | (긍정 확인) 직전 라운드(`14_02_49`) WARNING 2건 — 단일 소비처만 보고 `channel-web-chat` pathspec 제거 / 핵심 불변식 1회성 수동 실측 의존 — 이 diff 에서 코드·자동 회귀 테스트로 실제 해소됨을 소스 대조·테스트 실행(하네스 17+13건, frontend vitest 44건, 뮤테이션 재현 포함)으로 재확인 | `.github/workflows/frontend-checks.yml:44-54`; `.claude/tests/test_required_check_skip_jobs.py:171-208` | 없음 — 기록 목적 |
| 9 | dependency | 신규 외부/내부 패키지 의존성 0건, backend 미러 가드 사본(354줄) 삭제로 오히려 중복 의존 제거. 공유 devDep 패키지 추출안은 등록 표면 실측(8곳/자동검증 2곳 vs 5곳/자동검증 5곳)으로 기각 근거 문서화 | `plan/in-progress/mirror-guard-single-copy.md` "왜 공유 패키지가 아닌가" 절 | 없음 — 근거가 문서에 남아 있어 추후 재론 시 참조 가능 |
| 10 | scope | 이전 라운드 리뷰/일관성 검토 산출물 19개 파일(review/code, review/consistency)이 이번 changeset 에 신규 포함 — 프로젝트 규약상 표준 절차 | `review/code/2026/08/22/14_02_49/*`, `review/consistency/2026/08/22/13_20_18/*` | 조치 불요 — 의도된 범위 |
| 11 | requirement | `spec/` 전체에서 관련 문자열 0건 — 이 영역은 `spec/` 소관 아니고 plan(`spec_impact: none`)으로 충분 | `spec/` | 없음 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | checkout@v7 태그 고정(비회귀) 외 보안 표면 없음 |
| architecture | LOW | 설계(전용 CI 잡으로 원인 제거) 양호, 향후 확장 시 참고할 참고사항 4건 |
| requirement | NONE | 직전 WARNING 2건 해소 재확인, spec 소관 아님 |
| scope | NONE | 핵심 변경은 목적에 정확 대응, plan 체크리스트 텍스트만 stale |
| side_effect | LOW | 신규 워크플로 상시 실행/중복 실행은 문서화된 트레이드오프, backend export 삭제 잔존 참조 없음 확인 |
| maintainability | NONE | 손 목록·파일명 관례 이탈 등 경미한 INFO 뿐, 전반적으로 우수 |
| testing | NONE | 직전 WARNING 뮤테이션으로 해소 확인, 커버리지 손실 없음 |
| documentation | NONE | 실질 발견 없음, 직전 라운드 INFO 도 이미 닫힘 |
| dependency | NONE | 신규 의존성 0건, 중복 제거, 기각 근거 문서화 |

## 발견 없는 에이전트

- documentation — 이번 라운드 실질 발견사항 없음(직전 라운드 지적 사항도 이미 반영·종결 확인)

## 권장 조치사항
1. `plan/in-progress/mirror-guard-single-copy.md` 작업 체크리스트의 pathspec 항목 문구를 라운드1 정정 이후 실제 코드(유지 + 근거 교체)에 맞게 갱신 (maintainability/scope #1) — 낮은 우선순위, plan-코드 불일치 해소 목적.
2. (선택) `REPO_GUARDS_MUST_COVER` 하드코딩 튜플 옆에 "신규 `codebase/<stack>` 추가 시 갱신 필요" 한 줄 주석 추가 (maintainability #2).
3. 그 외 항목은 전부 조치 불요(기처분/문서화된 트레이드오프/긍정 확인)로, 이번 라운드에서 병합을 막는 요인 없음.

## 라우터 결정

- `routing=all`:
  - **실행**: `security, architecture, requirement, scope, side_effect, maintainability, testing, documentation, dependency` (9명)
  - **제외**: 없음
  - **강제 포함(router_safety)**: `dependency, documentation, maintainability, requirement, scope, security, side_effect, testing` (8명) — 전원 결과 확보됨, 미이행 없음

| 제외된 reviewer | 이유 |
|------------------|------|
| (없음) | — |