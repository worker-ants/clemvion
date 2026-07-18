# Code Review 통합 보고서

## 전체 위험도
**LOW** — 내부 패키지 등록 목록 drift 가드(#968 후속) 신설 + 두 기존 파일(`.claude/test-stages.sh`, `.github/workflows/packages-checks.yml`) 헤더 주석 추가. Critical/Warning 급 실질 결함 없음. WARNING 1건(단일 파일 내 3개 파싱 도메인 혼재, 즉시 강제 아님)과 다수의 INFO(문서화된 설계상 경계·낮은 우선순위 테스트 갭)만 존재. forced whitelist(maintainability/requirement/scope/security/side_effect/testing) 전원 결과 확보 확인됨 — 누락 없음.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | maintainability | `internal-package-registration-guard.ts`(304줄) 한 파일에 서로 다른 3개 파싱 도메인(bash 배열/함수본문 파싱, YAML 서브셋 파싱, 두 목록 간 diff 비교)이 공존 — 파일 헤더 주석은 "테스트 파일과의 분리"만 언급하고 내부 도메인 분리는 안 됨 | `codebase/frontend/src/lib/repo-guards/__tests__/internal-package-registration-guard.ts` 전체 | 도메인별 파일 분리 고려(예: `bash-stage-parser.ts` / `yaml-lite.ts` / `package-drift.ts`). 현재 섹션 주석·JSDoc 으로 가독성은 확보돼 즉시 강제할 정도는 아니며, 다음 확장(5번째 등록 목록 추가) 시점에 재검토 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | security | 개발/CI 전용 tooling — 사용자 입력·네트워크·인증·시크릿과 무관, 정규식 파서 입력도 저장소 내 고정 파일로 제한돼 ReDoS 등 실질 공격 벡터 없음 | guard.ts 전체 | 조치 불요 |
| 2 | security | `repoRoot()`/`fnBody()` 등의 에러 메시지가 내부 경로·구조를 노출하나 vitest 로컬/CI 콘솔에만 출력되고 최종 사용자 도달 경로 없음 | guard.ts 에러 메시지 | 조치 불요 |
| 3 | security | `packages-checks.yml` 이 저장소 Actions 레벨에서 비활성(0-run) — 이번 변경(로컬 vitest 가드)이 그 공백을 보완하는 방향으로 오히려 개선 | `.github/workflows/packages-checks.yml` 헤더 주석 | 조치 불요 |
| 4 | requirement | 관련 spec 문서 없음(예상된 결과) — `.claude/` 하네스 도구라 `spec/` fidelity 판단 대상이 아님, grep 결과 매치 없음 확인 | 4개 변경 파일 전체 | 조치 불요 |
| 5 | requirement | `explicitFilterCalls` 의 blind 따옴표 제거는 "따옴표로 감싼 패키지명"(`pnpm --filter "@workflow/x"`)을 지원하지 않음 — 다만 fail-loud(과다검출) 방향이라 안전, 현 `cmd_*` 는 그 스타일을 쓰지 않음 | `explicitFilterCalls` (~130행) | 향후 `cmd_*` 스타일 변경 시 파서 확장 검토, 현재는 조치 불요 |
| 6 | requirement | guard 두 파일이 `tsconfig.json` exclude(`src/**/__tests__/**`)로 tsc/next build 컴파일타임 검증에서 제외 — 런타임은 vitest 45건으로 검증되나 순수 타입 실수는 미검출 갭(PR #912 유사 전례 인지) | 헤더 주석 + `tsconfig.json` | 조치 불요, 타입 사용이 단순해 실질 위험 낮음 |
| 7 | scope/maintainability | 신규 가드+테스트 파일 볼륨이 큼(304+404줄)이나, 커밋 이력상 여러 `/ai-review` WARNING 라운드를 그 안에서 누적 흡수한 결과 — 동일 목적(#968 클래스 drift 차단) 범위 안에 머묾, 스코프 이탈 아님 | guard.ts, test.ts 전체 | 조치 불필요. 향후 라운드에서 "원래 목적을 벗어나는 신규 검증 항목 추가 여부"만 계속 확인 |
| 8 | scope | `test-stages.sh`/`packages-checks.yml` 변경은 순수 주석 추가(+5/+6줄), 로직·설정값(INTERNAL_PACKAGES 값, on.paths, matrix.pkg) 변경 없음 | 두 파일 diff | 없음 |
| 9 | scope | import 전수 사용 확인 — 미사용 임포트 없음, 변경 파일 4개 모두 동일 작업 범위 내(무관 파일 수정 없음) | test.ts import 블록 | 없음 |
| 10 | side_effect | `export const ROOT = repoRoot();` 가 모듈 로드 시점(top-level)에 즉시 실행되는 동기 fs 탐색 — marker 못 찾으면 **import 시점에 throw**. 현재는 test 파일에서만 import 돼 영향 국한 | guard.ts:359 | 현재 구조로 문제 없음. 향후 `__tests__/` 밖 재사용 시 lazy 평가(getter/memoized) 고려 |
| 11 | side_effect | 테스트 파일이 `describe` 블록 최상위(테스트 바디 밖)에서 파일 I/O 수행 — 실패 시 개별 `it` 이 아니라 describe 블록 전체가 뭉뚱그려 실패(fail-loud 의도와 부합, 진단 세밀함은 다소 저하) | test.ts:1002-1006 | 설계 의도상 필수 수정 아님 |
| 12 | side_effect | 신규 모듈의 fs 접근은 전부 읽기 전용(쓰기/삭제 경로 없음) | guard.ts 전체 | 없음 |
| 13 | maintainability | `fnBody` 의 정규식 생성이 함수명(`fn`)을 이스케이프 없이 보간 — 현재 호출부가 리터럴 고정이라 실질 위험 없음, 향후 확장 시 재발 방지 관점 코멘트 | guard.ts:468 | 필요시 특수문자 이스케이프 처리. 현재는 조치 불요 |
| 14 | maintainability | `MAX_DEPTH = 12` 매직넘버지만 근거 주석 동반(임의성 낮음) — 감점 아님, 패턴 유지 권장 | guard.ts | 없음 |
| 15 | maintainability | 두 워크플로/스크립트 파일에 가드 파일 경로를 주석으로 중복 하드코딩 — 파일 이동 시 두 곳 다 갱신 필요하나 문서 갱신 누락에 그침(코드 실패 아님) | `test-stages.sh`, `packages-checks.yml` 헤더 | 없음 |
| 16 | testing | `fnBody` 의 "닫는 `}` 미발견" 에러 분기가 유일하게 테스트로 고정되지 않음(다른 4개 실패 분기는 모두 커버) | guard.ts:158 | 미종료 fixture 로 `.toThrow(/닫는 '\}'/)` 테스트 1건 추가 권장 |
| 17 | testing | `repoRoot()` 의 실패 경로(MAX_DEPTH 초과 → throw)가 미검증 — fs 접근이 `__dirname` 기반이라 순수 unit 테스트 어려움 | guard.ts:14-21 | 낮은 우선순위. fs 코어 분리 시 커버 가능 |
| 18 | testing | 멀티라인 `pnpm --filter \` continuation 시나리오, `listAtPath` 의 flow-style YAML(`paths: ['a','b']`) 미지원 — 둘 다 문서화된 한계이며 vacuity-방지 단언이 fail-loud 로 잡아줌(침묵 실패 아님), 실사용 리스크 낮음 | `explicitFilterCalls` 독스트링, `listAtPath`/`blockRange` | 선택 사항, 필수 아님 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 개발/CI 전용 tooling, 공격 표면 없음 |
| requirement | NONE | spec 대상 아님, #968 급 회귀 구조적 차단 완전 구현 확인(mutation 재현 포함) |
| scope | NONE | 볼륨은 크나 전부 단일 목적(drift 가드) 범위 내, 무관 변경 없음 |
| side_effect | LOW | top-level 동기 fs 탐색 + describe 최상위 I/O — 둘 다 fail-loud 설계 의도와 부합 |
| maintainability | LOW | 단일 파일 내 3개 파싱 도메인 혼재(WARNING), 나머지는 INFO 수준 |
| testing | LOW | 커버리지 매우 촘촘(#968 재현·메타적 파서 자기검증), 잔여 갭은 소수 실패 분기 미검증 |

## 발견 없는 에이전트

없음 (전 6개 forced reviewer 모두 발견사항 보고, 다만 대부분 INFO 등급).

## 권장 조치사항
1. (선택) `internal-package-registration-guard.ts` 를 bash 파싱 / YAML 파싱 / diff 비교 3개 파일로 분리 — 다음 등록 목록 확장 시점에 재검토(WARNING #1).
2. (선택) `fnBody` 의 "닫는 `}` 미발견" 분기에 대한 회귀 테스트 1건 추가.
3. 나머지 INFO 항목은 모두 문서화된 설계상 경계이거나 fail-loud 방향으로 안전한 경계 조건 — 즉시 조치 불요, 향후 확장 시 참고.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security`, `requirement`, `scope`, `side_effect`, `maintainability`, `testing` (6명)
  - **강제 포함(router_safety)**: `maintainability`, `requirement`, `scope`, `security`, `side_effect`, `testing` (forced 전원 결과 확보됨 — 누락 없음)
  - **제외**: 아래 표 (8명)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | router 판단상 해당 diff 와 무관(비-런타임 tooling, 성능 영향 없음) |
  | architecture | router 판단상 해당 diff 와 무관(아키텍처 변경 없음) |
  | documentation | router 판단상 해당 diff 와 무관 |
  | dependency | router 판단상 해당 diff 와 무관(신규 의존성 추가 없음) |
  | database | router 판단상 해당 diff 와 무관(DB 접근 없음) |
  | concurrency | router 판단상 해당 diff 와 무관(동시성 로직 없음) |
  | api_contract | router 판단상 해당 diff 와 무관(API 계약 변경 없음) |
  | user_guide_sync | router 판단상 해당 diff 와 무관(사용자 가이드 대상 아님) |