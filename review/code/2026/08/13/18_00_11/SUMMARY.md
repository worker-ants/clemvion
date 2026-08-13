# Code Review 통합 보고서

## 전체 위험도
**LOW** — CRITICAL/WARNING 없음. `execution-engine.service.ts`/`executions.service.ts` 두 파일에 추가된 4개 `Array.isArray` fail-closed 가드는 이전 라운드(`14_01_46`, `17_15_21`) 지적을 모두 반영했고, 신규 보안·요구사항·스코프 결함은 없다. 남은 지적은 전부 INFO 급(가드 boilerplate 중복, top-level docstring 확대 누락, 구조적 회귀 테스트 부재)이며 병합을 막을 사안이 아니다. forced reviewer 7명(security, requirement, scope, side_effect, maintainability, testing, documentation) 전원 결과 확보 완료 — 화이트리스트 미이행 없음.

## Critical 발견사항

_없음._

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | maintainability | `Array.isArray` fail-closed 가드가 4개 지점(`admitExecutionOrDefer`, `lockNonTerminalExecutionRow`, `updateExecutionStatus`, `computeChainDepth`)에 거의 동일한 골격(`if (!Array.isArray(x)) throw new Error(...)`)과 근거 설명이 손으로 반복 타이핑돼 있다. 향후 5번째 `.query()` 지점 추가 시 가드 누락 위험. | `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:2936-2941, 8206-8211, 8524-8530`; `codebase/backend/src/modules/executions/executions.service.ts:324-329` | `assertIsRowArray<T>(rows: unknown, message: string): asserts rows is T[]` 형태의 최소 helper로 boilerplate만 추출. 사이트별 "왜 다른가" 설명은 인라인 주석에 유지 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | requirement | `updateExecutionStatus` 신규 throw 는 트랜잭션 밖 단일 UPDATE 다음이라 어느 catch 도 특정해 처리하지 않음(상위 catch-all 로 자연 전파, 설계 의도) | `execution-engine.service.ts:8524` | 조치 불요. 전파 경로 문서화하면 운영 대응 빨라짐 |
| 2 | requirement | sibling `.query()` 가드 적용 범위가 이번 backlog 대상 2파일로 정확히 한정됨 — 저장소 내 `RETURNING` 쓰는 다른 모듈(auth-oauth 등)은 스코프 밖으로 정당 | (참고) `grep -rln RETURNING codebase/backend/src` | 조치 불요 |
| 3 | scope | admission 가드 완료 메모가 plan 문서 내 무관한 단락 뒤 배치, 관련 체크박스와 거리 있음 — 3라운드째 반복 지적, 이미 "무조치(서식)"로 처분 | `plan/in-progress/backend-lint-gate-broken-on-main.md:1147-1149` | 조치 불요(재확인만) |
| 4 | scope | plan 문서에 이번 작업과 무관한 "EIA outbound notification payload" CRITICAL 결정 이력이 함께 기록 — impl-done 절차상 선재 CRITICAL 등재이며 실제 spec 집행은 별도 PR(#1166)로 분리, 스코프 위반 아님 | `plan/in-progress/backend-lint-gate-broken-on-main.md` | 조치 불요 |
| 5 | side_effect | `Array.isArray` 가드 4곳이 암묵적 `TypeError`를 명시적 `Error`로 전환 — 문자열 매칭 기반 외부 모니터링이 있다면 매칭 끊길 수 있음(이전 라운드 지적 재확인) | `execution-engine.service.ts:2936, 8206, 8524`; `executions.service.ts:324` | 조치 불요. 운영 알림 규칙 존재 시 문구 갱신 검토 |
| 6 | side_effect | `SNAPSHOT_CACHE_MAX_ENTRIES` 가시성 확대(`const`→`export const`) — 값 불변, 소비처는 정의부·내부·테스트뿐 | `executions.service.ts:63` | 조치 불요 |
| 7 | testing | `updateExecutionStatus` 가드가 `executeSync` timeout 처리 경로에서는 기존 범용 `try/catch`에 흡수돼 `logger.warn`으로만 남고 예외가 전파되지 않음(이번 diff가 만든 새 회귀는 아님) | 가드: `execution-engine.service.ts` `updateExecutionStatus`; 흡수처: `executeSync` timeout catch | (선택) 이 경로를 통한 캐너리 테스트 추가 또는 가드 주석에 흡수 사실 명시 |
| 8 | testing | "하드닝을 자매 함수에 미적용"이라는 이 저장소 반복 결함 클래스를 구조적으로 재발 방지하는 회귀 테스트(예: `.query()` RETURNING 호출 수 vs 가드 수 assert)가 없음 | (부재) `execution-engine.service.ts`, `executions.service.ts` | (선택) 정적 grep 기반 assert 테스트 추가 검토 |
| 9 | testing | LRU 경계값 테스트가 256회 삽입을 `for` 루프에서 순차 `await` — 기능적 결함 아님, 오히려 결정론적 삽입 순서 보장에 올바른 선택 | `executions.service.spec.ts` (256건 상한 테스트) | 조치 불요 |
| 10 | maintainability | `chat-channel.dispatcher.spec.ts` 기존 스타일 항목 4건(JSDoc 위치, 1줄 pass-through 헬퍼, 네이밍 컨벤션 혼재, 캐스트 리터럴 반복)이 이번 diff 범위 밖으로 그대로 잔존 — 이미 의식적으로 유예됨 | `chat-channel.dispatcher.spec.ts` | 조치 불요(이번 라운드). 다음 실질 변경 시 함께 정리 |
| 11 | documentation | 하드닝을 자매 3곳에 확대했지만 "throw도 계약의 일부다"를 top-level docstring에 명시하는 작업은 `admitExecutionOrDefer` 한 곳에만 적용, 나머지 3함수 미확대 | `executions.service.ts` `computeChainDepth` docstring; `execution-engine.service.ts` `lockNonTerminalExecutionRow`/`updateExecutionStatus` `@returns` 절 | 세 함수 docstring에 "배열 아니면 throw" 한 줄씩 추가 |
| 12 | documentation | 이전 라운드(`17_15_21`) documentation.md의 CHANGELOG 미등재 판단("행동 변화 없음")이 4곳을 동질로 묶어 재사용됨 — `computeChainDepth`는 유일하게 fail-open→fail-closed로 판정 자체가 바뀌는 자리라 다른 3곳과 성격이 다름 | `review/code/2026/08/13/17_15_21/documentation.md` "확인된 양호 사항" 절 | 필수 아님. 재사용 시 `computeChainDepth`를 별도 판정하거나 근거를 좁혀 남길 것 |
| 13 | documentation | `plan/in-progress/backend-lint-gate-broken-on-main.md` 파일 끝 trailing newline 없음 | `plan/in-progress/backend-lint-gate-broken-on-main.md` | 선택 — 개행 1개 추가 |
| 14 | user_guide_sync | "실행·디버깅 흐름 변경"(`05-run-and-debug/`) trigger 근접 후보였으나, 방어적 가드일 뿐 사용자 가시 동작(상태값·재시도 정책·로그 화면) 변화 없어 매칭 확정 안 함 | `execution-engine.service.ts`, `executions.service.ts` | 조치 불요. `computeChainDepth`/admission 상태값 자체가 향후 바뀌면 재검토 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 신규 인젝션/인가우회/시크릿노출 없음. `computeChainDepth` 가드는 fail-open(체인깊이 제한 우회) 지점을 fail-closed로 닫는 보안 개선 |
| requirement | NONE | 이전 WARNING 2건 모두 코드 반영 확인(소스 line-level 대조), 3개 spec 테스트 파일 실행 재현(444/45/38 GREEN), spec §9.1과 일치 |
| scope | NONE | 실질 코드 변경 2파일로 한정, 전부 plan 백로그 항목 또는 이전 리뷰 직접 요구 후속조치로 소급 설명됨 |
| side_effect | LOW | routing release/트랜잭션 롤백 비대칭 등 재확인 항목 전부 안전. 신규 CRITICAL/WARNING급 부작용 없음 |
| maintainability | LOW | 4곳 가드 boilerplate 중복(WARNING 1건), 기존 스타일 항목 잔존(INFO) |
| testing | LOW | 4개 가드 전부 대응 테스트+뮤테이션 킬 확인. 구조적 회귀 방지 테스트 부재는 INFO |
| documentation | LOW | 인라인 주석 품질 높음, top-level docstring 확대 누락은 INFO |
| user_guide_sync | NONE | 매트릭스 21개 trigger 중 확정 매칭 없음. "실행·디버깅 흐름" 근접이나 비확정 INFO 1건 |

## 발견 없는 에이전트

security, requirement, scope, user_guide_sync (CRITICAL/WARNING 기준 발견 없음)

## 권장 조치사항
1. (선택, 다음 유사 변경 시) `assertIsRowArray` 류 helper로 4곳 `Array.isArray` 가드 boilerplate 통합 — maintainability WARNING 1
2. (선택) `computeChainDepth`/`lockNonTerminalExecutionRow`/`updateExecutionStatus` top-level docstring에 throw 계약 한 줄씩 추가 — documentation INFO 1
3. (선택) `.query()` RETURNING 호출 수 vs 가드 수를 assert 하는 구조적 회귀 테스트 추가 — testing INFO 2
4. 나머지 INFO 항목은 전부 조치 불요 또는 다음 실질 변경 시 함께 정리 대상

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security, requirement, scope, side_effect, maintainability, testing, documentation, user_guide_sync` (8명)
  - **제외**: 아래 표 (6명)
  - **강제 포함(router_safety)**: `documentation, maintainability, requirement, scope, security, side_effect, testing` (7명, 전원 결과 확보됨 — 미이행 없음)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | router 판단상 이번 diff(방어적 런타임 가드 4곳, LRU 경계 테스트) 와 무관 |
  | architecture | router 판단상 아키텍처 변경 없음(기존 함수 내부 가드 추가) |
  | dependency | router 판단상 신규/변경 외부 의존성 없음 |
  | database | router 판단상 스키마/쿼리 구조 변경 없음(반환값 타입 가드만 추가) |
  | concurrency | router 판단상 동시성 로직 변경 없음 |
  | api_contract | router 판단상 공개 API/REST 계약 변경 없음 |
