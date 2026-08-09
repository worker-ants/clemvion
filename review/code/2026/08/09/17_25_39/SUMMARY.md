# Code Review 통합 보고서

## 전체 위험도
**MEDIUM** — Critical 은 없다. scope 리뷰가 지적한 "PR 밖" 표시 기능(secret 삭제 가드)이 문서 갱신 없이 함께 실린 스코프 이탈 1건과, ratchet 스크립트의 fail-closed 핵심 경로 3곳 + baseline 갱신 경로가 테스트로 뒷받침되지 않는 커버리지 갭이 MEDIUM 판정의 근거다. forced reviewer 7명 전원 결과 확보됨(누락 없음) — 아래 낮은 위험도 판정은 신뢰 가능.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | scope | `deleteByPrefix()` LIKE 메타문자 거부 기능이 plan 이 스스로 "이 PR 밖" 이라 명시한 채로 이번 PR 에 함께 실림 — typecheck gap 대응이라는 PR 단일 목적과 무관한 프로덕션 동작 변경(신규 throw 표면)이 문서 갱신 없이 포함 | `plan/in-progress/backend-lint-gate-broken-on-main.md:174`, `codebase/backend/src/modules/secret-store/secret-resolver.service.ts:169-174`, `secret-resolver.service.spec.ts:236-272` | 별도 PR 로 분리하거나, 포함 결정이 최종이면 plan 헤딩의 "(이 PR 밖)" 문구를 "(이 PR 에 포함, 근거: …)" 로 갱신 |
| 2 | testing | `run_tsc()` 의 fail-closed(exit 2) 분기 3곳(tsc timeout, OSError, non-zero exit + empty stdout)이 `VerdictTest` 에서 `run_tsc` 자체를 mock 으로 통째로 대체해 전혀 실행되지 않음 — 모듈 docstring 이 보장하는 핵심 불변식의 절반이 무증거 | `.claude/tests/test_backend_typecheck_ratchet.py` `FailClosedTest`, `scripts/check-backend-typecheck-ratchet.py::run_tsc()` (71-101행) | `mock.patch("subprocess.run", side_effect=...)` 로 timeout/OSError/empty-stdout 3케이스에 대해 exit 2 를 확정하는 테스트 추가 |
| 3 | testing | `--update` 플래그 / `write_baseline()` 정상 경로가 전혀 테스트되지 않음(파일 내 "update" 문자열 0건) — 정렬·JSON 포맷·total 재계산 로직 결함이 로컬 수동 실행으로만 드러남 | `.claude/tests/test_backend_typecheck_ratchet.py` (전체), `scripts/check-backend-typecheck-ratchet.py::write_baseline()` (137-148행), `main()` `--update` 분기(162-165행) | `sys.argv=["ratchet","--update"]` 로 `main()` 구동해 exit 0·기록 JSON이 `count_by_file` 결과와 일치·round-trip 하는지 검증하는 테스트 추가 |
| 4 | documentation | 신설 `backend-checks.yml` 의 `typecheck-ratchet` 잡이 `PROJECT.md` TEST WORKFLOW 표/CI 게이트 문서에 반영되지 않음 — `run-test.sh` 에 대응 로컬 명령이 없어 개발자가 push 후 CI 에서 처음 실패를 볼 수 있음 | `PROJECT.md:25-28`, `.github/workflows/backend-checks.yml` (typecheck-ratchet 잡) | `deps-security-checks.yml` 선례처럼 "typecheck-ratchet 은 run-test.sh 에 없음, 로컬 확인은 `python3 scripts/check-backend-typecheck-ratchet.py`, 갱신은 `--update`" 한 문단 추가 |
| 5 | documentation | `check-backend-typecheck-ratchet.py` 모듈 docstring 의 baseline 수치("199건/**39**파일")가 같은 PR 이 커밋한 실제 baseline(199건/**38**파일, `json.load` 실측 확인)과 파일 개수가 어긋남 | `scripts/check-backend-typecheck-ratchet.py:24` | "39파일"을 "38파일"로 정정하거나 `--update` 후 재계산해 docstring 을 baseline 과 동기화 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | security | `deleteByPrefix()` 신규 검증이 예외 메시지에 `prefix` 원문을 절단 없이 포함 — 같은 파일의 기존 SS-SE-05(값 절단) 정책과 불일치. 현재 유일한 호출부는 서버 생성 UUID 라 실질 위험 없음 | `secret-resolver.service.ts:166,171` vs `assertRefFormat()` (56-70행) | `assertRefFormat` 처럼 길이+앞 N자만 에러 메시지에 포함하도록 통일 |
| 2 | security | `deleteByPrefix()` LIKE 메타문자(`%`/`_`/`\`) 거부 로직 자체는 적절 — TypeORM 파라미터 바인딩이라 SQLi 는 원래 없었고, 과다삭제 방지 입력검증으로 정당한 보강, 정상 호출부 보존도 테스트로 고정 | `secret-resolver.service.ts:169-174` | 조치 불요(긍정적 확인) |
| 3 | security | `backend-checks.yml` 은 `${{ }}` 값을 `run:` 문자열에 직접 삽입하지 않고 `env:` 경유로만 전달해 스크립트 인젝션 패턴을 정확히 회피, 시크릿 미참조 | `.github/workflows/backend-checks.yml:25-69` | 조치 불요(확인 완료) |
| 4 | architecture | `backend-checks.yml` 3개 잡의 checkout/pnpm/setup-node/install 5단계 보일러플레이트가 `deps-security-checks.yml`/`frontend-checks.yml` 에 이미 있는 패턴을 세 번째로 반복 | `.github/workflows/backend-checks.yml:71-161` | 즉각 조치 불요. 4번째 워크플로가 패턴을 따를 때 composite action 추출 검토 |
| 5 | architecture/testing | private 메서드 hand-mirror 타입이 같은 스펙 파일에서 두 번째로 drift(주석이 스스로 명시) — `Parameters<...>` 파생으로 구조적 재발 방지 가능 | `execution-engine.service.spec.ts:5057` (vs 2047행 부근 느슨한 미러) | 이번 PR 범위 아님. 세 번째 drift 전에 타입 파생 리팩터 별도 plan 고려 |
| 6 | maintainability | `backend-checks.yml` 3개 잡 이름의 언어 스타일 불일치(`backend lint`/`backend unit` 영문 vs `backend 타입체크 ratchet` 한국어 혼용) | `.github/workflows/backend-checks.yml:72,101,130` | 같은 파일 내 스타일 통일(전부 영문 또는 전부 한국어 서술형) |
| 7 | testing | `deleteByPrefix` 신규 가드 테스트의 mock 이 실제 SQL LIKE 와일드카드 의미론을 재현하지 않아, "가드 없으면 실제 Postgres 가 과다삭제" 라는 존재 근거를 증명하는 실행 가능 테스트가 없음(근거는 주석뿐) | `secret-resolver.service.spec.ts` `createInMemoryRepository()` (43-66행) | 여유 있으면 와일드카드 해석 stub 또는 e2e 로 근거를 테스트로 고정 |
| 8 | documentation | README/테스트 docstring 의 "209건/40파일"(착수 시점)과 커밋된 baseline "199건/38파일"(수정 후) 사이 델타가 어느 문서에도 명시적으로 연결되어 있지 않음 | `.claude/tests/README.md:44`, `test_backend_typecheck_ratchet.py:153` | "이 PR 이 진짜 결함 10건을 수정해 199/38 로 커밋됐다" 한 문장 추가 |
| 9 | documentation | `slack-message.renderer.spec.ts` 의 인자 제거 2곳만 다른 4개 spec 수정과 달리 "왜 지워지는지" 설명하는 인라인 주석이 없음(스타일 불일치) | `slack-message.renderer.spec.ts` (182-186, 192-196행 부근) | 다른 4곳과 동일한 근거 주석 추가 |
| 10 | side_effect | `deleteByPrefix()` 동작 변경(신규 throw)은 기존 호출부(UUID 기반)에 무해하나 향후 사용자 입력 기반 호출부가 생기면 예외 표면이 새로 생김 — fail-closed 방향의 의도된 강화, 이미 문서화·테스트됨 | `secret-resolver.service.ts:169` | 별도 조치 불요, 향후 호출부 추가 시 인지 필요 |
| 11 | requirement | `deleteByPrefix` 신규 invariant 가 `spec/conventions/secret-store.md` §2.1 호출 규약 표에는 반영되지 않음(JSDoc·plan 문서에는 충분히 기록). 내부 전용 계약이라 spec 충돌은 없음 | `secret-resolver.service.ts` JSDoc, `spec/conventions/secret-store.md` §2.1 | 급하지 않음. 다음 secret-store.md 갱신 시 각주 한 줄 추가 |
| 12 | scope | "spec 파일이 타입체크되지 않는다" plan 헤딩이 "별 항목, 이 PR 밖" 이라 적혀 있지만 실제로는 이 PR 의 핵심 내용이 됨 — 인과적으로 연결돼 있어 scope 위반은 아니나 문구가 stale | `plan/in-progress/backend-lint-gate-broken-on-main.md:138` | 헤딩을 "본 PR 의 핵심 작업으로 승격" 등으로 갱신 |
| 13 | requirement | `review/consistency/2026/08/09/16_45_26/**` (spec/conventions 대상) 이 이번 코드 커밋에 함께 포함 — 산출물 자신이 이미 self-flag, CRITICAL 0건, 요구사항 판단에 영향 없음 | `review/consistency/2026/08/09/16_45_26/*` | 조치 불요 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | `deleteByPrefix` LIKE 가드는 정당한 보강, 에러 메시지 절단 정책 불일치만 INFO |
| architecture | NONE | CI 보일러플레이트 반복·hand-mirror 타입 drift 재발은 모두 INFO, 구조적 결함 없음 |
| requirement | NONE | 실측(tsc/pytest/jest 전부 통과)으로 baseline·게이트 정합 확인, spec 문서 미세 갭만 INFO |
| scope | MEDIUM | `deleteByPrefix` 가 plan 이 "PR 밖" 이라 명시한 채 포함된 스코프 이탈 (유일한 WARNING) |
| side_effect | LOW | `deleteByPrefix` 예외 표면 확대는 의도된 fail-closed 강화, 파일시스템 쓰기는 `--update` 로만 격리 |
| maintainability | LOW | CI 보일러플레이트 3중 복제, 잡 이름 언어 스타일 불일치만 INFO |
| testing | MEDIUM | `run_tsc()` fail-closed 3분기 + `--update`/`write_baseline` 정상 경로 테스트 커버리지 갭 (WARNING 2건) |
| documentation | LOW | baseline 수치 문서 간 불일치(39 vs 38파일), CI 게이트 PROJECT.md 미반영 (WARNING 2건) |
| user_guide_sync | NONE | 매트릭스 22개 trigger 전수 대조, 매칭 0건 — harness/CI/테스트 인프라 범주만 |

## 발견 없는 에이전트

없음 (전원 최소 INFO 이상 발견 보고).

## 권장 조치사항
1. `deleteByPrefix()` LIKE 메타문자 거부를 이번 PR 에 유지하기로 최종 결정했다면, `plan/in-progress/backend-lint-gate-broken-on-main.md` 의 "(이 PR 밖)" 문구를 근거와 함께 정정할 것(WARNING #1).
2. `run_tsc()` 의 fail-closed 3개 실패 분기(timeout/OSError/empty-stdout)에 대한 단위 테스트를 `FailClosedTest` 에 추가할 것(WARNING #2).
3. `--update`/`write_baseline()` 정상 경로에 대한 end-to-end 테스트를 추가할 것(WARNING #3).
4. `PROJECT.md` 에 `typecheck-ratchet` 게이트의 로컬 확인 방법을 `deps-security-checks.yml` 선례 형식으로 문서화할 것(WARNING #4).
5. `check-backend-typecheck-ratchet.py` 모듈 docstring 의 "39파일"을 커밋된 baseline 과 일치하는 "38파일"로 정정할 것(WARNING #5).
6. (선택) `secret-resolver.service.ts` 의 `deleteByPrefix`/`assertRefFormat` 에러 메시지 정책을 통일(prefix 절단), README/테스트 docstring 간 209→199 델타 설명 추가, `slack-message.renderer.spec.ts` 주석 스타일 통일.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: security, architecture, requirement, scope, side_effect, maintainability, testing, documentation, user_guide_sync (9명)
  - **제외**: 아래 표 (5명)
  - **강제 포함(router_safety)**: documentation, maintainability, requirement, scope, security, side_effect, testing — 전원 결과 확보됨 (누락 없음)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | router 판단상 이번 diff 범위와 무관(진단 스크립트/CI/테스트 정합 변경 위주) |
  | dependency | 의존성 추가/변경 없음 |
  | database | 스키마/쿼리 구조 변경 없음(LIKE 가드는 기존 쿼리에 대한 입력 검증) |
  | concurrency | 동시성 관련 변경 없음 |
  | api_contract | 공개 API 계약 변경 없음(`deleteByPrefix` 는 내부 서비스 메서드) |