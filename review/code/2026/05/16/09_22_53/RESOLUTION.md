# Review Resolution — bg-monitoring-e2e-fix 2026-05-16

세션: `review/code/2026/05/16/09_22_53`

## 결과

Critical 0건. Warning 1건은 미조치(의도)로 RESOLUTION 에 사유 기록. Info ~40건은 추적 항목.

## Warning — 미조치 사유

### W1 — stale 이미지 회귀 방지 smoke test 미존재 (testing reviewer)

**권고** 컨트롤러 등록을 검증하는 별도 smoke test (예: `GET /api/executions/<uuid>/background-runs/<uuid>` 가 404 가 아닌 401/200 을 반환하는지) 추가.

**미조치 사유**

1. **중복 검증**: 기존 e2e 스위트(12 suites, 66 tests)가 이미 컨트롤러 등록을 간접 검증함. background-monitoring.e2e-spec.ts 의 2 테스트가 사전 결함을 발견한 매커니즘이 곧 smoke test 역할.
2. **유효 범위**: 본 fix 는 인프라 수준(`Makefile --build`)에서 stale 이미지 자체를 차단함. 코드 레이어 smoke test 는 인프라 결함을 검출하는 적절한 위치가 아님.
3. **유지보수 비용**: 28개 컨트롤러 각각에 smoke test 를 추가하면 28건의 코드 추가가 발생. 새 컨트롤러 추가 시마다 동기화 부담.
4. **원칙 위반 우려**: SKILL.md "Don't add features, refactor, or introduce abstractions beyond what the task requires" 와 충돌.

대안: 본 Makefile fix 가 적용된 후에는 stale 이미지 시나리오가 구조적으로 차단되므로 별도 smoke test 추가의 비용 대비 효용이 낮음.

## Info — 추적

- **performance / scope**: runner 서비스 `--build` 의 필요성 재검토 (host volume mount 사용 시) — 일관성·예외상황 대비 차원에서 현 결정 유지.
- **documentation**: README.md / CHANGELOG.md 에 `make e2e-*` 타겟 안내 누락. `help` 메시지에 `--build` 동작 안내 추가 권고. 다음 문서 사이클 처리.
- **testing**: `e2e-test-full` 의 `&&` vs `; STATUS=$$?` 패턴 혼재 (backend runner 실패 시 playwright skip, 그러나 STATUS 는 playwright 만 반영). 사전 결함, 본 PR 범위 밖. 후속 후보.
- **maintainability**: `review/consistency/**/_prompts/*.md` 가 spec snapshot 을 복제해 저장소 크기에 누적. CLAUDE.md "review/** 시점 기록" 정책에 따른 의도된 형태.
- **scope**: 사전 lint fix 동반 포함은 SKILL.md ISSUE FIX 정책 (TEST WORKFLOW 에서 발견되는 사전 결함도 해결) 에 부합.

## TEST WORKFLOW 재검증

- **backend lint** ✅ 0 errors (사전 17 warnings 잔존 — 본 PR 범위 밖, 별도 후속)
- **backend unit (jest)** ✅ 3580/3580 PASS (205 suites)
- **backend build (nest)** ✅ PASS
- **backend e2e (`make e2e-test`)** ✅ 12/12 suites, 66/66 tests PASS — 기존 stale 이미지가 삭제된 상태에서 자동 rebuild 가 성공적으로 동작함을 확인.
