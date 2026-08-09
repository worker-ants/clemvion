# Architecture Review

### 발견사항

- **[INFO]** `backend-checks.yml` 3개 잡(lint/unit/typecheck-ratchet)에 동일한 5-스텝 셋업 보일러플레이트가 반복
  - 위치: `.github/workflows/backend-checks.yml:71-98`(lint), `:100-127`(unit), `:129-161`(typecheck-ratchet) — 각 잡마다 `actions/checkout` → `pnpm/action-setup` → `actions/setup-node`(+cache) → `Install backend workspace` 가 거의 동일하게 반복되고, 각 스텝마다 `if: needs.changes.outputs.relevant != 'false'` 가 개별 부착됨
  - 상세: `deps-security-checks.yml`·`frontend-checks.yml` 도 같은 skip-job 패턴을 이미 쓰고 있어 이번 추가로 "동일 보일러플레이트가 3개 워크플로에 반복"되는 지점이 rule-of-three 를 넘었다. GitHub Actions 는 YAML 자체에 함수 추상화가 없어 완전한 중복 제거는 어렵지만, composite action(`.github/actions/backend-setup` 류)으로 checkout+pnpm+node+install 4스텝을 묶으면 노드 버전·캐시 전략 변경 시 3~N 곳을 동시에 고쳐야 하는 유지보수 비용을 줄일 수 있다. 다만 이 반복은 이번 diff 가 새로 만든 패턴이 아니라 기존 관례를 그대로 따른 것이므로 즉각적인 결함은 아니다.
  - 제안: 지금 당장 리팩터링할 필요는 없음(과거 `feedback_generated_inputs_vs_curated_corpus`/reaper-engine 사례처럼 axes 가 발산하면 조기 통합이 더 나쁠 수 있음) — 4번째 워크플로가 이 패턴을 따를 때 composite action 추출을 검토할 것.

- **[INFO]** 수기(hand-mirrored) 타입 미러링이 같은 파일에서 두 번째로 drift — 구조적 재발 방지책 부재
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts:5057`(private 메서드 시그니처를 손으로 복제한 타입 정의에 `opts` 파라미터 추가)
  - 상세: diff 주석이 스스로 "같은 drift 가 두 번째다" 라고 명시한다 — 프로덕션 private 메서드 시그니처를 테스트 파일에 손으로 복제해 mock 하는 구조가 SoT 를 두 곳(프로덕션 구현 + 손-미러 타입)으로 만들어 놓았고, 이번 PR 의 ratchet 가드는 이 drift 를 **사후에 잡는** 안전망이지 애초에 발생을 막는 구조는 아니다. 근본적으로는 `Parameters<...>` 류 유틸리티 타입으로 실제 메서드에서 타입을 파생시키면 이 클래스의 결함(SRP/DRY 위반에 가까운 타입 이중 관리)이 구조적으로 사라진다.
  - 제안: 이번 PR 범위는 아니지만(개별 인자 패치로 충분), 같은 파일에서 세 번째 drift 가 나기 전에 해당 mock 타입을 `Parameters<typeof service['updateExecutionStatus']>` 형태로 파생시키는 리팩터를 별도 plan 항목으로 고려할 것.

- **[INFO]** `deleteByPrefix` 입력 검증의 레이어링은 적절 — 참고 확인
  - 위치: `codebase/backend/src/modules/secret-store/secret-resolver.service.ts:169-174`
  - 상세: LIKE 메타문자 거부 로직이 쿼리를 실제로 구성하는 유일한 지점(`SecretResolverService.deleteByPrefix`)에 위치하고, 별도 검증 클래스/유틸을 새로 도입하지 않아 과잉 추상화를 피했다. 프로덕션 호출부가 `triggers.service.ts:875` 단 한 곳이라는 것도 실측(grep) 결과와 일치한다. 코드베이스의 다른 `ILIKE '%...%'` 사용처(`triggers.service.ts:110`, `workflows.service.ts:108`, `knowledge-base.service.ts:86,860`)는 이름 검색용으로 위험 프로파일이 달라(삭제가 아님) 동일 가드를 강제할 필요가 없다 — DRY 위반 아님.

### 요약

이번 변경은 세 가지 축(① backend CI 부재 갭을 메우는 `backend-checks.yml` 신설, ② `*.spec.ts` 가 어떤 게이트에서도 타입체크되지 않던 사각을 닫는 `check-backend-typecheck-ratchet.py` ratchet 가드, ③ 그 사각에서 실제로 자란 결함들의 개별 수정 — 인자 누락·미러 타입 drift·미검증 LIKE prefix)로 구성되며, 세 축 모두 하나의 일관된 목표(`plan/in-progress/backend-lint-gate-broken-on-main.md`)로 수렴한다. 신규 워크플로는 기존 `deps-security-checks.yml`/`frontend-checks.yml` 의 required-check skip-job 계약(`changes` 잡 + `needs: changes` + `if: !cancelled()` + 스텝별 게이팅)을 그대로 따르고 `.claude/tests/test_required_check_skip_jobs.py`·`test_workflow_yaml_structure.py` 레지스트리에도 동반 등재돼 있어 기존 아키텍처 관례와 정합적이다. `check-backend-typecheck-ratchet.py` 는 파싱(`count_by_file`)·baseline 로딩·판정(`main`)이 명확히 분리되어 있고 fail-closed 원칙이 `check-override-floors.py` 와 동일 계열로 일관되게 적용됐다. `SecretResolverService.deleteByPrefix` 의 신규 가드도 소유 서비스 내부에 최소 범위로 배치돼 레이어 경계를 넘지 않는다. CRITICAL/WARNING 급 아키텍처 결함은 발견되지 않았고, 발견된 항목은 모두 향후 확장성/유지보수성 관점의 참고 사항(INFO)이다.

### 위험도
NONE
