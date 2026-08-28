# Code Review 통합 보고서

## 전체 위험도
**LOW** — CRITICAL/WARNING 없음. 프로덕션 소스 변경 없이 devDependency(`@eslint/eslintrc`) 정리 + `preserve-caught-error` 대응 `cause: err` 를 잠그는 회귀 테스트 2건만 추가된 변경으로, 전 reviewer 가 NONE~LOW 를 보고했고 실질 결함은 발견되지 않았다. 유일하게 LOW 를 매긴 scope 리뷰어도 "성격이 다른 두 후속 작업이 한 changeset 에 묶임"이라는 절차적 지적일 뿐 기능 결함이 아니다. forced 화이트리스트(8명) 전원이 실제 보고서 전문을 확보했으며 누락된 reviewer 는 없다 — router 가 제외한 6명(performance/architecture/database/concurrency/api_contract/user_guide_sync)은 이번 diff 특성(비-프로덕션 devDependency 정리·테스트 추가 위주)상 관련성이 낮다고 판단된 것으로 보이며, 8개 forced reviewer 의 발견 내용을 검토한 결과 그 판단을 뒤집을 만한 단서는 없었다.

## Critical 발견사항

없음.

## 경고 (WARNING)

없음.

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 의존성 | `@eslint/eslintrc` devDependency 제거 — backend 전체에서 import/`FlatCompat`/`.eslintrc*` 사용처 0건을 grep 으로 재확인. eslint 10 이 더 이상 이를 번들하지 않아 죽은 선언이었음. dependabot 노이즈 감소 부수 이익 | `codebase/backend/package.json` (devDependencies) | 조치 불요 |
| 2 | 보안/요구사항/테스트 | `cause: err` 부착의 정보 노출 안전성 검증 — wrapping 메시지가 이미 `err.message` 를 포함해 `cause` 가 추가 정보를 노출하지 않음을 소스 확인 + 뮤테이션 실측(cause 제거 시 신규 2건만 RED, 기존 131건 GREEN)으로 재현. `secret-resolver.service.ts` 는 반대로 `cause` 부착을 의도적으로 억제(SS-SE-05, crypto 에러 상세 비노출)해 구분이 유지됨 | `expression-resolver.service.spec.ts:141`, `code.handler.spec.ts:202` (신규 테스트), 대응 프로덕션 `cause: err` (diff 밖, 이전 PR #1219 반영분) | 조치 불요 — 긍정적 회귀 테스트 |
| 3 | 의존성 | `pnpm-lock.yaml` 의 `@jest/core`/`jest-config` 계열 스냅샷이 파라미터 없는 변형에서 `(ts-node@10.9.2(...))` 파라미터화 변형으로 dedupe — `@eslint/eslintrc` 제거에 따른 peer 재해석 부수효과, 기능적 버전 변경 없음 | `pnpm-lock.yaml` (snapshots 섹션, 여러 hunk) | 조치 불요 |
| 4 | 문서화 | `cause` 안전성 판별 기준("message 가 원문을 이미 담고 있으면 cause 안전")이 인라인 주석 3곳(신규 테스트 2곳 + 기존 secret-resolver)에만 존재하고 `spec/conventions/` 정본화는 아직 안 됨 — developer 권한상 이번 턴에 처리 불가, plan 에 이미 planner 턴 후속으로 등재됨 | `plan/in-progress/deps-peer-gating-and-eslint10.md:264`, `expression-resolver.service.spec.ts:133-140`, `code.handler.spec.ts:198-201` | 다음 세션에서 planner 턴으로 `spec/conventions/` 명문화 (이미 계획됨) |
| 5 | 변경범위 | 성격이 다른 두 후속 작업(회귀 테스트 추가 + 죽은 devDependency 제거)이 한 changeset 에 묶임 — 각각 plan 에 개별 근거는 있으나 독립적으로 되돌릴 수 있는 변경이 합쳐짐 | `codebase/backend/package.json`, 신규 테스트 2건, `plan/in-progress/deps-peer-gating-and-eslint10.md` 체크리스트 | 향후 유사 상황은 별도 커밋으로 분리 권장 |
| 6 | 프로세스 관찰 (코드 결함 아님) | 리뷰 진행 중 공유 worktree 에서 `expression-resolver.service.ts`/`code.handler.ts` 의 `cause: err` 가 일시적으로 제거된 상태(+ `.bak` untracked 파일)가 관측됐다가 수 초 후 자체 복원됨 — 병렬로 뮤테이션 검증을 수행 중이던 다른 리뷰 서브에이전트의 작업으로 판단, 이번 diff(5개 파일) 자체와는 무관 | `codebase/backend/src/.../expression-resolver.service.ts`, `code.handler.ts` (diff 밖, 일시적) | 오케스트레이터: 뮤테이션 검증(원본 변경→확인→복원)을 수행하는 서브에이전트는 격리된 scratch 사본에서 작업하거나 복원을 원자적으로 완료 후 다음 단계 진행하도록 재확인 |
| 7 | 유지보수성 | try/catch 로 `cause` 를 꺼내는 5~9줄 보일러플레이트가 신규 테스트 2곳에 복제됨 — 현재 2곳뿐이라 추출 압력 낮음(rule of three 미충족) | `expression-resolver.service.spec.ts:142-146`, `code.handler.spec.ts:203-212` | 3번째 유사 케이스 추가 시 공용 헬퍼(`captureThrown` 등) 고려 |
| 8 | 테스트 | `code.handler.spec.ts` 신규 케이스가 직전 케이스와 동일 fixture(`'this is ( not valid js'`)를 재사용 — 의도적 "같은 입력, 다른 축" 설계이며 뮤테이션 재현으로 확인(기존 케이스는 cause 제거해도 GREEN 유지, 신규만 RED) | `code.handler.spec.ts:202` | 조치 불요 |
| 9 | 테스트 | 두 신규 테스트의 `cause` 단언 강도 차이(`toBeInstanceOf(Error)` vs `toBeDefined()`+타입 체크) — `isolated-vm` realm 경계로 인해 `code.handler` 쪽 `SyntaxError` 가 호스트 `Error` 를 상속하지 않음을 실측(단언을 바꿔 실제 실패 재현)으로 확인, 근거 있는 비대칭 | `expression-resolver.service.spec.ts` vs `code.handler.spec.ts:216-220` | 조치 불요 — 긍정 기록 |
| 10 | 문서화 | plan 문서의 뮤테이션 실측 수치("신규 2건 RED, 기존 131건 GREEN")가 실행 로그 인용 없이 서술로만 존재 — 이후 다른 커밋이 케이스를 추가하면 "131건" 절대 수치가 stale 해질 수 있음 | `plan/in-progress/deps-peer-gating-and-eslint10.md:259` | 상대적 표현("기존 케이스는 전부 GREEN") 또는 커밋 SHA 병기 고려 |
| 11 | 유지보수성 | `code.handler.spec.ts` 신규 테스트의 `handler.execute(...)` 인자가 인접 기존 호출과 달리 여러 줄로 개행됨 | `code.handler.spec.ts:205-209` | 조치 불요 — prettier 자동 포맷 산출물 |
| 12 | 의존성 | 워크스페이스 간 eslint 메이저 버전 분리(backend/packages=10, frontend/channel-web-chat=9 유지) — 이번 PR 범위 밖이나 유지보수 축 증가 사실은 인지 필요 | `codebase/backend/package.json:116` | 조치 불요 — 해제 조건이 이미 plan §2 에 명문화됨 |
| 13 | 보안 | 신규 테스트 코드 내 시크릿·자격증명 없음(더미 잘못된 표현식/문법 오류 코드만 사용) | `expression-resolver.service.spec.ts:141-156`, `code.handler.spec.ts:202-224` | 조치 불요 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | `cause` 정보 노출 없음(소스 확인), devDependency 제거로 공격표면 축소, 신규 테스트 내 시크릿 없음 |
| requirement | NONE | 소스-테스트 정합성 및 뮤테이션 재현(신규 2건 RED/기존 131건 GREEN) 검증, spec 은 이 구현 디테일에 침묵 |
| scope | LOW | 두 성격의 후속 작업이 한 changeset 에 병합됨(INFO), 병렬 리뷰어의 일시적 worktree 오염 관측(코드 결함 아님) |
| side_effect | NONE | 프로덕션 코드 미변경, 신규 테스트는 격리되어 교차 오염 없음, lockfile 변경은 기능 영향 없는 dedup |
| maintainability | NONE | 경미한 보일러플레이트/근거주석 중복, 포맷터 산출 개행 차이 — 모두 INFO 수준 |
| testing | NONE | 뮤테이션 실측 독립 재현(cause 제거→RED), fixture 공유/단언 강도 차이 모두 의도적 설계로 확인 |
| documentation | NONE | 신규 테스트 인라인 주석 우수, `spec/conventions/` 정본화는 이미 추적 중인 planner 턴 후속 |
| dependency | NONE | 죽은 devDependency 제거 적절, 신규 외부 패키지 없음, lockfile 부수변경은 기능 영향 없음 |

## 발견 없는 에이전트

없음 — 8개 forced reviewer 모두 최소 1건 이상의 INFO 관찰을 보고했으며(문제 지적이 아닌 긍정 확인 포함), CRITICAL/WARNING 을 보고한 reviewer 는 없음.

## 권장 조치사항

1. (이미 plan 에 등재, 후속 세션) `cause` 안전성 판별 기준("message 가 원문을 이미 담고 있으면 cause 안전")을 `spec/conventions/`에 planner 턴으로 명문화.
2. (프로세스) 오케스트레이터: 뮤테이션 검증(소스 변경→확인→복원)을 수행하는 리뷰 서브에이전트는 격리된 scratch 사본에서 작업하거나, 복원을 원자적으로 완료한 뒤 다음 단계로 넘어가도록 재확인 — 이번 세션에서도 공유 worktree 일시 오염이 관측됨.
3. (선택) 향후 유사 PR 에서 "회귀 테스트 추가"와 "죽은 의존성 제거"처럼 독립적으로 되돌릴 수 있는 변경은 별도 커밋으로 분리해 리뷰 단위를 좁게 유지.
4. (선택) plan 문서의 뮤테이션 실측 절대 수치("131건")를 상대적 표현이나 커밋 SHA 병기로 남겨 향후 drift 시비 방지.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security, requirement, scope, side_effect, maintainability, testing, documentation, dependency` (8명)
  - **강제 포함(router_safety)**: `dependency, documentation, maintainability, requirement, scope, security, side_effect, testing` (8명 — 실행 목록과 동일, 전원 결과 전문 확보됨. 누락 없음)
  - **제외**: 아래 표 (6명)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | 프롬프트에 개별 사유 미제공 — diff 가 devDependency 정리 + 순수 테스트 추가로 성능 경로 변경 없음에 따른 router 비관련 판단으로 추정 |
  | architecture | 상동 — 아키텍처 구조 변경 없음(신규 모듈/레이어 없음) |
  | database | 상동 — DB 접근 코드 변경 없음 |
  | concurrency | 상동 — 동시성/레이스 관련 코드 변경 없음 |
  | api_contract | 상동 — 공개 API/스키마 변경 없음 |
  | user_guide_sync | 상동 — 사용자 대면 문서/가이드 영향 없음(내부 devDependency 정리) |