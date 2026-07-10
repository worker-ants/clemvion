# Consistency Check SUMMARY — `--impl-prep`

- **모드**: `--impl-prep`
- **대상 spec 영역**: `spec/5-system/14-external-interaction-api.md` (§5.3 / §R17)
- **대상 변경**: `codebase/backend/src/modules/external-interaction/interaction.service.ts` `getStatus()` 2단계 컬럼 projection
- **plan**: `plan/in-progress/eia-getstatus-column-projection.md`
- **일시**: 2026-07-10 22:25:21

## BLOCK: NO

Critical 0건. 5개 checker 전원 `STATUS: OK`.

## checker 결과

| checker | STATUS | 위험도 | Critical | Warning |
| --- | --- | --- | --- | --- |
| cross_spec | OK | NONE | 0 | 0 |
| rationale_continuity | OK | LOW | 0 | 0 |
| convention_compliance | OK | LOW | 0 | 1 |
| plan_coherence | OK | LOW | 0 | 1 |
| naming_collision | OK | LOW | 0 | 1 |

## 핵심 확인 (Critical 부재 근거)

1. **응답 필드 완전성** — `getStatus()` 가 `execution` 엔티티에서 실제 읽는 필드는 `id`/`workflowId`/`status`/`outputData`/`finishedAt`/`startedAt` + 조건부 `conversationThread` 7개뿐. 계획된 projection 이 누락 없이 커버 (cross_spec 이 line 단위 확인).
2. **waiting-only fetch 는 기존 계약과 합치** — `conversationThread` 노출은 spec 5곳(EIA §5.3·§R17, conversation-thread §8.4, widget §3.1, entity 주석) 모두 예외 없이 `waiting_for_input` 한정. 변경 **전** 코드가 오히려 계약보다 넓게 fetch 하고 있었다.
3. **R17 기각 대안 재도입 아님** — (a) SSE 전용 회귀, (b) NodeExecution 분산 재구성 어느 쪽도 아님. durable 컬럼 직접 SELECT 를 유지하고 **fetch 시점만** 조건화.
4. **타 영역 의존 없음** — `6-websocket-protocol` / `4-execution-engine` / `data-flow/15-external-interaction` 에 `getStatus` DB 조회 형태 의존 서술 없음. 호출자는 `interaction.controller.ts` 단일 진입점.
5. **PROJECT.md 동반 갱신 매핑 해당 행 없음** — DTO/엔드포인트/에러코드 무변경이라 i18n·swagger·user-guide 갱신 의무 없음.

## Warning (비차단 — 구현 단계에서 반드시 처리)

### W1. `redactThreadForPublic` egress 마스킹 재배선 (convention_compliance + rationale_continuity 중복 지적)

R17 "표면 제약(보안)" 은 REST `getStatus` 와 SSE `waiting_for_input` 이 **공유하는 단일 helper `redactThreadForPublic`** 로 마스킹하는 것을 **런타임 강제 불변식**으로 규정한다. `conversationThread` 를 별도 partial entity 에서 읽도록 소스 객체를 바꾸는 과정에서 마스킹 호출이 누락되면 **secret egress 회귀**(Critical 급)가 된다.

→ **조치**: 2단계 재조회 결과에도 `redactThreadForPublic` 적용. TDD 로 고정 (마스킹 단언 테스트).

### W2. TypeORM `select` 는 엔티티 프로퍼티명(camelCase) (naming_collision)

`@Column({ name: 'workflow_id' })` 매핑 탓에 snake_case 오기 함정이 있다. 선례: `notification-fanout.service.ts:109`.
또한 `updatedAt` = `finishedAt ?? startedAt ?? new Date()` 이므로 두 컬럼을 projection 에서 누락하면 **`new Date()` fallback 으로 침묵 회귀**하는데, 기존 테스트는 `typeof r.updatedAt === 'string'` 만 단언해 잡지 못한다.

→ **조치**: `startedAt`/`finishedAt` projection 포함 + `updatedAt` 실값 단언 테스트 추가.

### W3. `spec-sync-external-interaction-api-gaps.md` line-range 인용 stale (plan_coherence)

해당 plan line 17 이 "완료/정합 확인" 근거로 `interaction.service.ts:247-296` 을 인용한다. 2단계 조회로 블록이 재배치되면 line-range 가 stale 화된다. 실질 주장(currentNode/context 복원 로직 존재)은 유지되므로 결정 번복은 아니다.

→ **조치**: 본 구현 PR 안에서 인용 위치 정정.

## Info (참고)

- 1·2단계 사이 TOCTOU 간극은 **새 위험 클래스가 아님** — 기존 코드도 `execution` 스냅샷 이후 `nodeExecutionRepository.findOne` 을 별도 쿼리로 호출하는 동일 패턴. 응답은 스냅샷이며 row 부재 시 기존 "durable thread 없음" graceful 경로와 동일.
- 재사용 가능한 기존 Execution projection 공용 상수는 프로젝트 전역에 없음 → 지역 상수 신설이 중복 SoT 를 만들지 않음. `TERMINAL_STATUSES`/`SSE_SEQ_PLACEHOLDER` 와 동일하게 파일 상단 비-export SCREAMING_SNAKE_CASE 권장.
- `getStatus()` 상단 JSDoc 이 단일 `findOne` 전제로 서술 → 구현 커밋에서 동반 갱신 필요 (spec 무변경, 코드 주석만).
- `spec` frontmatter `pending_plans` 에 신규 plan 등재 불필요 — `pending_plans` 는 "미구현 surface" 전용이고 본 변경은 wire 무변경 최적화.
