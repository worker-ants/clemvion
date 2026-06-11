# 성능(Performance) 리뷰

리뷰 대상: `prod-fail-closed-guards` 브랜치 — production fail-closed 가드 응집 (refactor 04 C-1·M-4·M-7)

주요 구현 파일:
- `/Volumes/project/private/clemvion/.claude/worktrees/prod-fail-closed-guards/codebase/backend/src/common/config/production-guards.ts`
- `/Volumes/project/private/clemvion/.claude/worktrees/prod-fail-closed-guards/codebase/backend/src/main.ts` (부분)
- spec/review 산출물 (md 파일 다수)

---

## 발견사항

### [INFO] `INSECURE_JWT_SECRETS` / `KNOWN_EXAMPLE_ENCRYPTION_KEYS` — `Set` 조회: O(1), 적절한 자료구조
- 위치: `production-guards.ts` 라인 32–48
- 상세: 두 상수를 `ReadonlySet<string>` 으로 선언해 `.has()` 검색이 O(1)이다. 원소 수가 2~3개로 배열(`Array.includes`)로도 성능 차이가 없는 규모이지만, 구조적으로 확장 시에도 성능이 유지된다는 점에서 적합한 선택이다.
- 제안: 없음.

### [INFO] `assertProductionConfig` 부팅 1회 호출 — 런타임 핫패스 없음
- 위치: `production-guards.ts` 전체, `main.ts` bootstrap
- 상세: `assertProductionConfig` 는 `main.ts` bootstrap 최초 1회만 호출된다. 함수 내부는 단순 문자열 비교와 정수 비교로 구성되며 I/O, DB, 외부 호출이 없다. 반복 호출 경로(요청 핸들러, DI 팩토리)에 위치하지 않으므로 런타임 성능에 영향이 없다. 부팅 시 오버헤드는 무시 가능한 수준(나노초 단위)이다.
- 제안: 없음.

### [INFO] `isFlagOn` 함수 인라인 비용 없음
- 위치: `production-guards.ts` 라인 55–57
- 상세: `isFlagOn` 은 `=== 'true' || === '1'` 두 번 비교로 구성된 순수 함수다. 부팅 시 2회(`LLM_STUB_MODE`, `MCP_ALLOW_INSECURE_URL`), warn 경로 1회(`ALLOW_PRIVATE_HOST_TARGETS`) 호출된다. V8 JIT 가 즉시 인라인 처리할 수준으로, 성능 비용이 없다.
- 제안: 없음.

### [INFO] fail-fast 설계 — 첫 위반에서 즉시 throw, 누적 없음
- 위치: `production-guards.ts` 라인 72–122
- 상세: 위반 항목을 배열에 모아서 한 번에 throw 하지 않고 첫 위반에서 즉시 throw 하는 패턴이다. 부팅 실패 경로에서는 성능 우위가 없으나(어차피 종료), 정상 경로에서는 모든 검사를 순차 통과한다. 현재 검사 수(5개)가 적어 배열 누적 패턴 대비 성능 차이가 없다. 운영자는 한 건씩 고치며 재부팅해야 하는 UX 비용이 있으나 이는 성능이 아닌 UX 영역이다.
- 제안: 없음 (성능 관점).

### [INFO] `SetReadonly` 상수가 모듈 레벨 싱글턴 — GC 부담 없음
- 위치: `production-guards.ts` 라인 32–48
- 상세: `INSECURE_JWT_SECRETS`, `KNOWN_EXAMPLE_ENCRYPTION_KEYS` 가 모듈 최상위 `const` 로 선언돼 프로세스 수명 동안 단 1회만 생성된다. 요청마다 재생성하는 패턴이 아니므로 GC 압박이 없다.
- 제안: 없음.

### [INFO] spec/review 산출물 파일 다수(약 14개) — 워크트리 내 정적 파일 추가, 런타임 무관
- 위치: `review/consistency/2026/06/11/` 하위 md/json 파일 14개
- 상세: 이 파일들은 코드 실행 경로와 무관한 정적 산출물이다. 서버 시작 시 로드되지 않으며 런타임 성능에 영향이 없다.
- 제안: 없음.

---

## 요약

이번 변경의 핵심 구현체인 `production-guards.ts` 는 성능 관점에서 문제가 없다. 부팅 시 1회 실행되는 순수 함수 구조이며, 자료구조(`ReadonlySet`)·분기 수(5개)·I/O 부재 등 모든 요소가 적절하다. `INSECURE_JWT_SECRETS`·`KNOWN_EXAMPLE_ENCRYPTION_KEYS` 의 `Set` 선택은 현재 원소 수에서 효과는 미미하나 확장 안정성을 갖춘다. 나머지 변경은 spec 문서와 review 산출물로 런타임과 무관하다. 성능 관점에서 지적할 사항이 없는 변경이다.

---

## 위험도

NONE

STATUS: OK
