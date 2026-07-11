# Code Review 통합 보고서

검토 대상: EIA/WS continuation 명령 ↔ 대기 노드 표면(waiting surface) 매트릭스 가드
(`waiting-surface-guard.ts` 신설 + `execution-engine.service.ts::resolveWaitingNodeExecutionId`/
`assertCommandMatchesWaitingSurface` 확장 + `hooks.service.ts` graceful catch + 관련 unit/e2e
테스트 + `plan/in-progress/eia-command-waiting-surface-guard.md`).

diff base: `origin/main` (커밋 `9ba336453`)

## 전체 위험도

**MEDIUM** — Critical 0건, Warning 12건. 핵심 표면 매트릭스 판정 로직 자체는 spec(§7.5.1/§10.9/
interaction-type-registry)과 line-level 로 정합하고 병합을 막을 CRITICAL 급 결함은 없다. 다만 (1)
`hooks.service.ts` 의 신규 warn 로그가 실제로는 진단 정보를 전혀 담지 못하는 실질 코드 결함, (2) 대기
표면 판정 로직이 3~4곳에 독립 정의돼 있어 이 PR 이 고치려는 결함 클래스(다중 사본 중 하나만 갱신되며
조용히 어긋남)를 가드 자신이 축소된 형태로 재도입할 구조적 위험, (3) 이 PR 이 고치는 원 결함 중
buttons 표면 회귀의 e2e 검증 부재, (4) 외부 EIA 클라이언트 대상 breaking behavior 변경의 공지 채널
부재, (5) hot-path DB 비용 증가 등 후속 조치가 필요한 이슈가 다수 reviewer 에 걸쳐 수렴했다.

## Critical 발견사항

(없음)

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 에러처리/로깅 | `hooks.service.ts::forwardToInteractionService` 의 신규 warn 로그가 NestJS `ConflictException` 의 nested-response 처리 방식(`response.message` 가 top-level 이 아니라 `response.error.message` 로 중첩) 때문에 `err.message` 가 항상 고정 문자열 `"Conflict Exception"` 으로 찍혀 실제 진단 정보가 로그에 전혀 남지 않는다. **requirement·side_effect·architecture 3인이 독립 지적** | `hooks.service.ts::forwardToInteractionService` catch 블록 | `err.getResponse()` 를 캐스팅해 구조화된 `error.code`/`error.message` 를 로그에 남길 것 |
| 2 | 에러처리/결합도 | `catch (err instanceof ConflictException)` 이 예외 **타입 전체**로 판정해 신규 "표면 불일치" 뿐 아니라 기존 일반 `STATE_MISMATCH`(0건/다중-row invariant 위반, race)까지 동일하게 삼키고, 향후 `IDEMPOTENCY_KEY_CONFLICT` 등 다른 사유의 409 도 자동 흡수될 위험 | `hooks.service.ts` catch 블록 | `error.code === 'STATE_MISMATCH'` 로 좁혀 매칭 |
| 3 | 유지보수성/아키텍처 | 대기 표면 판정 로직이 `waiting-surface-guard.ts` / `park-entry-dispatch.ts` / `resumeTurnRegistry` / `resumeFromCheckpoint` 인라인 계산 등에 분산. 신규 "registry 대칭" 테스트는 `parkEntryRegistry` 하나만 교차검증하며, 실질 worker-side SoT 인 `resumeTurnRegistry` 는 대칭 테스트 대상에서 빠져 있다 (버그 클래스의 축소 재도입 위험). **architecture·maintainability·requirement 수렴** | `waiting-surface-guard.ts`, `park-entry-dispatch.ts`, `execution-engine.service.ts` | `resumeTurnRegistry` 대칭 테스트 추가 (또는 판정 로직 단일 SoT 화) |
| 4 | 테스트 커버리지 | 원 결함 두 축(form 빈 폼 제출 / buttons 엉뚱한 continue 포트 분기) 중 e2e 회귀는 **form 케이스만**. buttons 표면은 `output_data` 가 실제 Postgres JSONB 로 저장·재조회돼야 판정되는 유일한 비-AI 표면인데(form 은 정적 metadata 로 판정) 이 축의 e2e 가 전무 | `test/execution-park-resume.e2e-spec.ts` | buttons 노드 대기 → 비-`click_button` → 409 + waiting 유지 + 정상 `click_button` 재개 e2e 추가 |
| 5 | 성능/DB | `resolveWaitingNodeExecutionId` 의 select 가 `outputData` JSONB 컬럼 **전체**를 가져오고(AI 멀티턴 `_resumeCheckpoint.messages` 는 turn 마다 누적), 신규 `nodeRepository.findOne` 이 hot-path chokepoint 를 순차 2왕복으로 늘린다. **database + side_effect** | `execution-engine.service.ts` | QueryBuilder 로 JSONB path projection 만 select, `node` relation JOIN 으로 왕복 1회 복귀 |
| 6 | 동시성 | 신규 라운드트립이 `find→publish` 사이 non-atomic(TOCTOU) 구간을 넓혀 §5.6 "second-arrival 409" 직렬화가 근소하게 느슨해질 수 있음. 데이터 무결성(`claimResumeEntry` 원자 claim)은 보존 확인 | `execution-engine.service.ts` | Rationale 문서화 또는 동시 도착 e2e |
| 7 | API 계약 | 202 → 409/422 는 실질 breaking behavior change. "버그 수정" 정당화는 충분하나(EIA-IN-13 이 이미 거부를 약속) 외부 EIA 클라이언트 공지 채널이 diff 범위에 없음 | `execution-engine.service.ts`, EIA §5.1 | project-planner 가 공지 필요 여부 명시 결정 (코드 revert 불요) |
| 8 | **SPEC-DRIFT** | `4-execution-engine.md §7.5.1` 표(2-case)와 EIA `§5.1` `STATE_MISMATCH` 행이 신규 3번째 거부 케이스(표면 불일치)를 미반영. `expectedCommands`(§6.2) 문서 필드도 서버 수용 범위보다 좁음. **의도된 코드-선행 drift** — plan 이 project-planner 위임으로 추적 중 | `spec/5-system/4-execution-engine.md`, `spec/5-system/14-external-interaction-api.md` | planner 가 §7.5.1 표 + Rationale, EIA §5.1/§6.2, `0-common.md §10.9`, `3-execution.md §9` 갱신 |
| 9 | 요구사항/추적성 | plan F-2 가 form 케이스만 명시하나 신규 catch 는 buttons 표면 무응답도 동일하게 삼킨다 (동형 UX 갭 미등재) | `plan/in-progress/eia-command-waiting-surface-guard.md` | F-2 범위를 buttons 까지 확장 |
| 10 | 문서화 | `resolveWaitingNodeExecutionId` JSDoc 에 "표면 불일치" 케이스가 중복 등재되고 무관 문단이 케이스 리스트를 끊음 | `execution-engine.service.ts` | 중복 제거 + 리스트 연속 배치 |
| 11 | 문서화 | `waiting-surface-guard.ts` 상단 spec 상대경로 링크가 1단계 부족해 깨짐(`codebase/spec/...` 을 가리킴) | `waiting-surface-guard.ts:8` | `../../../../../spec/...` 로 수정 |
| 12 | 문서화 | 데이터 무결성 버그 수정임에도 `CHANGELOG.md` 항목 누락 (리포지토리 관례상 기대) | `CHANGELOG.md` | Unreleased 항목 추가 |

## 참고 (INFO)

| # | 발견사항 |
|---|----------|
| 13 | `readPersistedInteractionType` 의 배열/빈 문자열 edge case 미검증 (fail-closed 로 수렴) |
| 14 | AI 표면 `it.each` 가 4개 명령을 단일 블록 루프로 묶어 실패 원인 특정이 덜 명확 |
| 15 | `ExecutionEngineService` god-class 에 신규 메서드 누적 (후속 refactor 후보) |
| 16 | `resolveWaitingSurface` 가 if-chain 이라 컴파일타임 exhaustiveness 부재 |
| 17 | `hooks.service.ts` command-kind→DTO 매핑이 중첩 삼항 (Phase 4 확장 시 switch 전환 권장) |
| 18 | 노드 정의 동시 편집 시나리오는 본 가드 스코프 밖 (기존 아키텍처) |
| 19 | [보안 확인됨] 409 client 응답에 내부 상세 미노출 — client-safe 고정 message / `serverDetail` 분리 자동 적용 (CWE-209 안전) |
| 20 | [보안 확인됨] hooks catch 가 인증/인가 실패를 삼키지 않음 (`interact()` 는 인증 미수행, 토큰 검증은 Guard 책임) |
| 21 | [부작용 확인됨] `resolveWaitingNodeExecutionId` 시그니처 확장의 3개 진입점 전수 확인 — 기존 `InvalidExecutionStateError` 매핑 재사용, 회귀 없음 |
| 22 | [동시성 확인됨] `claimResumeEntry` 원자 claim 계약 불변, "이중 실행 0" 보존 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | LOW | catch 범위(#2 기여). 지정 점검 2건 모두 안전 확인(#19, #20) |
| requirement | MEDIUM | err.message 진단정보 유실(#1), registry 미러링 갭(#3), SPEC-DRIFT(#8), F-2 범위(#9) |
| side_effect | LOW | #1·#2 기여, DB 왕복 증가(#5 기여), 진입점 3개 전수 확인(#21) |
| testing | MEDIUM | buttons 표면 e2e 부재(#4) |
| scope | NONE | 의도된 범위 이탈 없음 |
| maintainability | MEDIUM | 표면 판정 로직 분산, drift 위험(#3) |
| architecture | MEDIUM | 파싱 규칙 triplication·registry 대칭 절반(#3), HooksService 계층 결합(#2) |
| api_contract | MEDIUM | breaking behavior change 공지 부재(#7) |
| database | MEDIUM | outputData 전체 select + 신규 findOne 왕복(#5) |
| concurrency | LOW | TOCTOU 윈도우 소폭 확장(#6), claimResumeEntry 계약 불변(#22) |
| documentation | LOW | JSDoc 중복(#10)/링크 깨짐(#11)/CHANGELOG 누락(#12) |

## Skip 된 reviewer

router 가 제외 (변경 성격 미매칭):

| reviewer | 이유 |
|----------|------|
| performance | DB lookup 1건 추가는 minor overhead (단, database reviewer 가 #5 로 포착) |
| dependency | 의존성 파일 변경 없음 |
| user_guide_sync | doc-sync-matrix trigger 미매칭, 유저 가이드 문서 변경 없음 |

> `concurrency` 는 router 가 제외 판정했으나, 가드가 `find → findOne → publish` 사이의
> non-atomic 구간을 넓히는 TOCTOU 형태라 main 이 명시적으로 추가 실행했다.

## 위험도 집계

- Critical: **0**
- Warning: **12**
- 전체 위험도: **MEDIUM**
