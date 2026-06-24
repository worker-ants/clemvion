# Code Review 통합 보고서

**대상**: refactor(execution-engine) M-2 — shutdown 중 시작 노드 추적 포기 드리프트 수정  
**파일**: `codebase/backend/src/modules/execution-engine/shutdown/shutdown-state.service.ts`, `shutdown-state.service.spec.ts`  
**검토 일시**: 2026-06-24

---

## 전체 위험도

**LOW** — 핵심 변경(early-return 4줄 제거)은 spec §11.2/§11.4 와 완전 정합하며 보안·동시성·아키텍처 관점 모두 안전. 테스트 커버리지 갭 2건과 유지보수성 개선 2건(WARNING)이 존재하나 즉각 차단 요인은 없음.

---

## Critical 발견사항

_없음_

---

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Testing | shutdown 후 등록된 노드가 grace 내 정상 완료(unregister)되는 경로의 테스트 미존재 — "post-shutdown 등록 + drain 성공 → UPDATE 미호출" 케이스 커버리지 갭 | `shutdown-state.service.spec.ts` 233~256행 | `service.registerInFlight('ne-late', ...)` 후 `setTimeout(() => service.unregisterInFlight('ne-late'), 20)` 패턴으로 drain 성공 시 UPDATE 미호출 테스트 추가 |
| 2 | Testing | WHERE 절 검증이 mock chain을 depth-3 이상 직접 순회해 구현 상세(`.update().set().where()` 순서)에 강 커플링 — 리팩터링 시 테스트가 조용히 깨지거나 undefined 오탐 가능 | `shutdown-state.service.spec.ts` 248~255행, 268~276행 | 중간 단계 null 체크(`expect(whereCall).toBeDefined()`) 추가 또는 QueryBuilder mock을 factory 함수로 교체해 `.where` spy를 외부 노출 |
| 3 | Maintainability | WHERE 절 검증에 사용되는 mock chain 순회 패턴이 3개 테스트에 중복 — 보일러플레이트 반복으로 유지보수 비용 증가 | `shutdown-state.service.spec.ts` 라인 81~88, 218~230, 268~276 | `extractNeWhereArgs(repo)` 헬퍼 함수 추출로 중복 제거 |
| 4 | Maintainability | `pollMs` 기본값 `200`이 인라인 매직 넘버로 잔존 — `graceMs` 는 `DEFAULT_GRACE_MS` 상수화된 반면 `pollMs`는 리터럴 | `shutdown-state.service.ts` 라인 455 | `shutdown.constants.ts`에 `DEFAULT_POLL_MS = 200` 추가 후 `this.pollMs = pollMs ?? DEFAULT_POLL_MS;` 로 변경 |
| 5 | Requirement | 테스트 WHERE 절 단언에 사용된 mock 체인 탐색 패턴에 이론상 undefined 오탐 가능성 존재 (기존 패턴 재사용이므로 신규 위험은 아니나 3개 테스트에 공통) | `shutdown-state.service.spec.ts` 라인 249~257 | 향후 QueryBuilder mock을 factory 함수로 교체해 `.where` spy를 외부 노출하는 방식으로 개선 |

---

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Architecture | `fromConfig` static factory 가 실제 테스트에서 미사용(테스트는 직접 생성자 호출) — dead API 가능성 | `shutdown-state.service.ts` 462~473행 | 사용처 확인 후 미사용이면 제거 검토 |
| 2 | Architecture | `inFlightNodeExecutions` Map 의 lock-free 전제(Node.js 단일 스레드)가 코드 주석에 미명시 — Worker Threads 도입 시 재검토 단서 부재 | `shutdown-state.service.ts` 433행 | `registerInFlight` JSDoc 에 "Node.js 이벤트 루프 단일 스레드 보장 하에 lock-free" 설명 한 줄 추가 권장 |
| 3 | Architecture | drain 상한이 `@nestjs/bullmq WorkerHost` framework 내부 lifecycle에 암묵 의존 — 추상화 경계 외부에 운영 보장이 존재 | `shutdown-state.service.ts` JSDoc §11.2 참조 부분 | 중기적으로 `WorkerControlPort` 추상 인터페이스 주입 패턴 고려 (즉각 조치 불요) |
| 4 | Architecture | `waitForDrain` 폴링 방식 — `unregisterInFlight` 에서 count=0 시 즉시 resolve 하는 이벤트 기반 구조로 개선 여지 | `shutdown-state.service.ts` 551~560행 | 성능 이슈 실측 시 EventEmitter/Promise signal 방식으로 개선 |
| 5 | Documentation | `registerInFlight` JSDoc 에 `@param nodeExecutionId`, `@param executionId` 태그 누락 | `shutdown-state.service.ts` 488~503행 | `@param` 태그 추가 (선택적) |
| 6 | Documentation | 클래스 레벨 JSDoc 항목 2에 "shutdown 중 동일 세그먼트 내 추가 노드도 등록됨" 서술 미반영 | `shutdown-state.service.ts` 408~427행 | 클래스 JSDoc 에 "(shutdown 중 동일 세그먼트 내 추가 시작 노드 포함 — §11.2 세그먼트 완료 보장)" 한 줄 보충 |
| 7 | Documentation | `waitForDrain` private 메서드에 반환 시맨틱(drain 성공 시 true, timeout 시 false) 문서 없음 | `shutdown-state.service.ts` 551행 | 한 줄 JSDoc 추가 (선택적) |
| 8 | Documentation | `spec/5-system/4-execution-engine.md §11 Rationale` 및 `plan/in-progress/refactor/06-concurrency.md` M-2 권장안 갱신 미완료 (consistency SUMMARY.md 권장 조치 1~2 로 추적 중) | `review/consistency/2026/06/24/22_32_23/SUMMARY.md` | 이번 PR 완료 후 planner 경유 spec §11 Rationale 및 plan M-2 옵션 비교표 갱신 |
| 9 | Testing | shutdown 중 `unregisterInFlight` 호출 단위 테스트 미존재(전체 흐름 통합 테스트에 내재됨) | `isShuttingDown / inFlight registry` describe 블록 | shutdown flag 설정 후 unregister 테스트 1케이스 추가 (LOW 우선순위) |
| 10 | Testing | 동일 `nodeExecutionId` shutdown 전 등록 후 shutdown 중 재등록 시 `inFlightCount` 가 2가 아닌 1임을 단언하는 테스트 없음 | 신규 테스트 전반 | Map 중복 등록 시 count 단언 케이스 추가 |
| 11 | Testing | 신규 테스트 `graceMs=50, pollMs=10` 타이밍이 플랫폼 부하 시 flakiness 위험을 내포 (기존 패턴 답습) | `shutdown-state.service.spec.ts` 233행 | graceMs를 150ms 등으로 여유 확보 또는 타이밍 설계 의도 주석 명시 |
| 12 | Concurrency | `waitForDrain` 완료 직후 `Array.from` 스냅샷 전 이론적 race window 존재 — 현재 동기 구간이므로 실제 문제 없으나, 해당 구간에 `await` 삽입 시 스냅샷 누락 위험 | `shutdown-state.service.ts` L538~551 | 향후 `markRemainingAsInterrupted` 앞 `await` 추가 리팩터링 시 스냅샷 시점 재검토 |

---

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | SQL 파라미터 바인딩 사용, 외부 공격 표면 없음, 시크릿 없음 |
| architecture | NONE | SRP·레이어 경계 유지, drain 상한 framework 암묵 의존은 중장기 개선 사항 |
| requirement | LOW | spec §11.2/§11.4/§3.3 line-level 정합, mock chain 오탐 가능성(WARNING) |
| scope | NONE | early-return 4줄 제거 + JSDoc 교체 + 테스트 1:1 교체로 범위 내 완결 |
| side_effect | NONE | 시그니처 변경 없음, 전역 변수 없음, 의도하지 않은 부작용 없음 |
| maintainability | LOW | mock chain 중복 3건(WARNING), pollMs 매직 넘버(WARNING) |
| testing | LOW | post-shutdown drain 성공 경로 미커버(WARNING), mock chain 커플링(WARNING) |
| documentation | NONE | JSDoc 품질 양호, @param 태그·클래스 요약 소규모 개선 여지 |
| concurrency | LOW | Node.js 단일 스레드로 실질 race 없음, TOCTOU DB 조건으로 방어됨 |

---

## 발견 없는 에이전트

- **security**: 보안 취약점 해당 없음 (INFO 전량)
- **scope**: 범위 이탈 없음 (INFO 전량)
- **side_effect**: 의도하지 않은 부작용 없음 (INFO 전량)
- **documentation**: Critical/WARNING 없음 (INFO 전량)
- **architecture**: 즉각 조치 필요 항목 없음 (INFO 전량)
- **concurrency**: 실질 동시성 결함 없음 (INFO 전량)

---

## 권장 조치사항

1. **(WARNING-1 · Testing)** post-shutdown 등록 노드의 grace 내 drain 성공 케이스 테스트 추가 — `registerInFlight('ne-late', ...)` + `setTimeout(unregister, 20)` 패턴으로 UPDATE 미호출 단언.
2. **(WARNING-2/3 · Testing/Maintainability)** mock chain 순회 헬퍼 함수(`extractNeWhereArgs`) 추출 + 중간 단계 `expect(...).toBeDefined()` null 체크 추가 — 3개 테스트의 중복 제거 및 undefined 오탐 방지.
3. **(WARNING-4 · Maintainability)** `shutdown.constants.ts`에 `DEFAULT_POLL_MS = 200` 상수 추가 및 인라인 리터럴 교체.
4. **(INFO-8 · Documentation)** PR 완료 후 planner 경유 `spec/5-system/4-execution-engine.md §11 Rationale` 및 `plan/in-progress/refactor/06-concurrency.md` M-2 옵션 비교표 갱신 (consistency SUMMARY.md 권장 조치 1~2 이행).
5. **(INFO-2 · Architecture)** `registerInFlight` JSDoc에 "Node.js 단일 스레드 lock-free" 근거 한 줄 추가 — Worker Threads 도입 시 재검토 단서 제공.
6. **(INFO-6 · Documentation)** 클래스 레벨 JSDoc 항목 2에 shutdown 중 추가 등록 허용 서술 보충.

---

## 라우터 결정

라우터가 reviewer 를 선별하여 실행함 (`routing_status=done`).

- **실행** (9명): `security`, `architecture`, `requirement`, `scope`, `side_effect`, `maintainability`, `testing`, `documentation`, `concurrency`
- **강제 포함(router_safety)** (7명): `documentation`, `maintainability`, `requirement`, `scope`, `security`, `side_effect`, `testing`
- **제외** (5명):

| 제외된 reviewer | 이유 |
|-----------------|------|
| performance | 라우터 판단으로 생략 |
| dependency | 라우터 판단으로 생략 |
| database | 라우터 판단으로 생략 |
| api_contract | 라우터 판단으로 생략 |
| user_guide_sync | 라우터 판단으로 생략 |