# Consistency Check 통합 보고서

**BLOCK: NO** — 5개 checker(Cross-Spec / Rationale Continuity / Convention Compliance / Plan Coherence / Naming Collision) 전원 CRITICAL 없음.

## 전체 위험도
**LOW** — `spec/**` 변경 0건(`origin/main...HEAD` 4커밋, `codebase/backend/**` + `plan/`·`review/` 산출물만). 실질 코드 변경은 execution-engine admission 게이트 방어 가드 1건(직전 코드리뷰가 defer→throw 로 정정 완료)과 테스트용 상수 export 1건뿐이라 5개 관점 전부 CRITICAL/WARNING 없음. 유일한 관측(plan_coherence LOW)은 이번 diff 범위 밖 별도 파일의 문서 잔재.

## Critical 위배 (BLOCK 사유)

(없음)

## planner 인계 (권한 밖 Critical)

(없음)

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | plan_coherence | `plan/in-progress/spec-draft-eia-notification-payload-contract.md`(이번 diff 밖, 이미 origin/main에 병합된 #1166 커밋으로 신설) L245-255에 깨진 헤딩 + 자기모순 체크리스트 잔재 — "### 실행 (2026-08-13)" 절(L224-243)에서 `[x]` 완료 처리된 항목(§6.3~§6.5 축약·WS §4.1 갱신·`chat-channel-adapter.md` 축약·`retry-turn-terminal-guard.md` 역포인터·Planned gap 등재)이 이후 잔재 블록에서 다시 `[ ]`(미완료)로 나열됨 | `plan/in-progress/spec-draft-eia-notification-payload-contract.md` L224-255 | 실제 spec 상태(§6 도입부 존재, WS §4.1 포인터 형태, `chat-channel-adapter.md` EIA §6 위임)와 모순 — 자기 파일 내 완료/미완료 서술 불일치 | 잔재(중복) 체크리스트 블록 삭제. 다음에 이 파일을 여는 사람이 이미 끝난 작업을 다시 하거나 반대로 spec 완료 여부를 의심할 위험 방지 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | cross_spec | `spec/5-system/14-external-interaction-api.md` §R8 과 `spec/5-system/15-chat-channel.md` R8 이 서로 다른 결정에 동일 로컬 레이블 `R8` 사용(파일별 독립 번호 매김 컨벤션, 실질 모호성 없음, 이번 diff 기인 아님) | 두 문서의 `## Rationale` R8 항목 | 액션 불필요 — 참고용 기록 |
| 2 | rationale_continuity | `admitExecutionOrDefer` 의 `Array.isArray(rows)` 가드(throw)가 "데이터 정합성 게이트=fail-closed" 원칙(`4-execution-engine.md` Rationale L1351-1356)의 새 적용처 | `execution-engine.service.ts` `admitExecutionOrDefer` | spec Rationale에 교차 참조 한 줄 추가 고려(강제 아님, 방어적 구현 디테일 수준) |
| 3 | convention_compliance | 신규 내부 guard `Error` 메시지 스타일이 파일 내 기존 관례와 완전 통일되지 않음(이전 라운드 `14_18_42`에서도 지적됨, 재확인만) | `execution-engine.service.ts` `admitExecutionOrDefer` 내부 `throw new Error(...)` | `error-codes.md` 는 REST 응답 봉투만 규율해 적용 범위 밖. 통일 원하면 "내부 전용 진단 Error" 절 신설 고려 |
| 4 | naming_collision | `SNAPSHOT_CACHE_MAX_ENTRIES` export 가시성 변경 — 신규 식별자 아님, 동명 충돌 없음 확인 | `executions.service.ts:63` | 조치 불필요 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | NONE | `spec/5-system/**` 변경 0건. EIA §R8 idempotency 캐시와 `SNAPSHOT_CACHE_MAX_ENTRIES`(별개 인스턴스-로컬 LRU)를 task명 유사성에도 혼동 없이 구분 확인. admission throw 는 HTTP 계약과 무관(BullMQ consumer). WS sticky-session 전제와도 정합 |
| rationale_continuity | NONE | admission throw 는 "데이터 정합성 게이트=fail-closed" 기존 Rationale과 정합, 직전 `return false`(defer) 번복은 근거 있는 정정. plan CRITICAL 종결 서술도 결정 이력 보존 관행 준수 |
| convention_compliance | NONE | spec 문서 변경 0건, 코드도 API 표면·payload·에러 코드 봉투·Redis 키 등 정식 규약 표면을 만들지 않음. plan 등재→종결이 `redis-keys.md` SoT/포인터 원칙과 동형으로 이미 해소됨을 확인 |
| plan_coherence | LOW | 4커밋 diff 자체는 문제 없음(권한 밖 CRITICAL 등재→planner 인계 없이 별도 PR #1166이 이미 해소, 이번 diff는 사후 기록뿐). diff 범위 밖 별도 파일에 자기모순 체크리스트 잔재 발견(WARNING) |
| naming_collision | NONE | `spec/` 전체 diff 0건이라 신규 식별자 도입 자체가 없음(scope 공백). 유일한 가시성 변경(export)도 동명 충돌 없음 |

## 권장 조치사항
1. (선택, 비차단) `plan/in-progress/spec-draft-eia-notification-payload-contract.md` L224-255 의 중복·자기모순 체크리스트 블록 정리 — 이번 diff 범위 밖이라 이번 PR을 막을 사유는 아니나, 다음 열람자의 오독을 막기 위해 별도로 정리 권장.
2. (선택, INFO) 내부 진단 `Error` 메시지 스타일 통일을 원하면 `spec/conventions/error-codes.md` 에 "내부 전용 진단 Error" 절 신설 검토.
3. (선택, INFO) `admitExecutionOrDefer` throw 가드와 "데이터 정합성 게이트=fail-closed" 원칙 간 교차 참조를 spec Rationale 에 한 줄 추가 검토.
