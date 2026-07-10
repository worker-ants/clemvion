# Cross-Spec 일관성 검토 — `getStatus()` projection 최적화 (impl-done, 사후)

- 모드: `--impl-done` (구현 완료 후)
- 대상 spec 영역: `spec/5-system/14-external-interaction-api.md`
- diff base: `origin/main...HEAD` (직접 `git diff` 로 실제 변경분 확인, 프롬프트 payload 미신뢰)
- 실제 변경 파일: `codebase/backend/src/modules/external-interaction/interaction.service.ts` (`getStatus()` 만) +
  단위테스트(`interaction.service.spec.ts`) + `plan/in-progress/eia-getstatus-column-projection.md`(신규) +
  `plan/in-progress/spec-sync-external-interaction-api-gaps.md`(라인번호 인용 정정 1줄) + `review/code/**`·`review/consistency/**`(직전 라운드 산출물)
- **`spec/**` 파일은 이번 diff 에서 0건 변경** (`git diff origin/main...HEAD --stat -- 'spec/**'` 결과 없음)

## 검토 방법

1. `git diff origin/main...HEAD -- codebase/backend/src/modules/external-interaction/interaction.service.ts` 로 실제 코드 변경을 라인 단위로 확인.
2. §5.3 응답 스키마(9개 필드: `id`/`workflowId`/`status`/`currentNode`/`context`/`result`/`error`/`seq`/`updatedAt`)와 신규 `STATUS_PROJECTION_COLUMNS` + 2단계 `select`를 1:1 대조.
3. `git diff ... | grep -oE "EIA-[A-Z]{2,3}-[0-9]{2}"` 로 diff 내 요구사항 ID 등장 여부를 신규 추가분(`^\+` 라인)에 한정해 확인.
4. `spec/conventions/conversation-thread.md` §4/§8.4, `spec/7-channel-web-chat/1-widget-app.md` §3.1, `spec/5-system/6-websocket-protocol.md` 전문에서 `getStatus`/DB 조회 전략 관련 서술 확인.
5. `execution.entity.ts` 의 `@Column({name:...})` 매핑과 `STATUS_PROJECTION_COLUMNS`/2단계 `select` 배열의 camelCase 프로퍼티명 일치 여부 확인 (W2 재검증).
6. frontmatter (`status: partial`/`pending_plans`) 변경 필요성 — spec 파일 diff 유무로 직접 판정.

## 발견사항

### 검토 질문 1 — §5.3 응답 스키마와 diff 의 실제 필드 커버리지 (라인 대조)

**결론: 충돌 없음. 완전 일치.**

신규 상수(라인 66-73):
```ts
const STATUS_PROJECTION_COLUMNS = [
  'id', 'status', 'workflowId', 'startedAt', 'finishedAt', 'outputData',
] satisfies (keyof Execution)[];
```

§5.3 wire 의 9개 필드와의 대조:

| §5.3 필드 | 소스 | diff 후 커버리지 |
|---|---|---|
| `id` | `execution.id` | 1단계 projection 포함 |
| `workflowId` | `execution.workflowId` | 1단계 projection 포함 |
| `status` | `execution.status` | 1단계 projection 포함 |
| `result`(COMPLETED)/`error`(FAILED) | `execution.outputData` | 1단계 projection 포함 |
| `updatedAt` | `finishedAt ?? startedAt ?? new Date()` | 1단계 projection 에 `startedAt`/`finishedAt` 둘 다 포함 — fallback 회귀 없음 |
| `context.conversationThread` | `Execution.conversation_thread`(2단계 `select:['id','conversationThread']`) | `WAITING_FOR_INPUT` 분기에서만 재조회, `redactThreadForPublic` 마스킹 유지(라인 39, 313) |
| `currentNode`/`context.{buttonConfig,nodeOutput,...}` | `NodeExecution` 별도 테이블(`nodeExecutionRepository.findOne`, 라인 296-301) | Execution projection 과 무관 — 이번 diff 로 미변경 |
| `seq` | 상수 `SSE_SEQ_PLACEHOLDER` | DB 비의존, 미변경 |

빠진 필드 없음. `satisfies (keyof Execution)[]` 컴파일 타임 가드로 오타(snake_case 등) 는 빌드가 깨지므로 런타임 침묵 누락 경로가 봉쇄됨.

### 검토 질문 2 — 신규 요구사항 ID 미부여 확인

**결론: 확인됨, BLOCK 사유 아님.**

`git diff origin/main...HEAD -- codebase/backend/src/modules/external-interaction/interaction.service.ts | grep -E "^\+" | grep -oE "EIA-[A-Z]{2,3}-[0-9]{2}"` 실행 결과 **0건**. 전체 diff 범위에서 `EIA-IN-07`/`EIA-NF-03`/`EIA-NF-05`/`EIA-NX-11` 문자열이 발견되지만, 전부 `plan/in-progress/spec-sync-external-interaction-api-gaps.md` 의 **기존(unchanged) 컨텍스트 라인**에 있던 참조이며, 이번 diff 가 건드린 것은 그 파일의 라인번호 인용(`interaction.service.ts:247-296` → `:276-351`) 정정 1곳뿐이다. 새 ID 신설·재사용 없음.

### 검토 질문 3 — `conversation-thread.md` §4/§8.4, `1-widget-app.md` §3.1, `6-websocket-protocol.md` 와의 충돌

**결론: 충돌 없음.**

- **마스킹 불변식 유지**: `conversation-thread.md` §8.4 는 "SSE emit 과 REST `getStatus` 가 공유하는 단일 helper `redactThreadForPublic` 가 egress 시 마스킹"을 **런타임 강제 불변식**으로 규정한다. diff 는 `threadRow?.conversationThread ? redactThreadForPublic(threadRow.conversationThread) : undefined` (라인 312-314)로 소스 객체(`execution` → `threadRow`)만 바뀌었을 뿐 마스킹 호출 자체는 그대로 보존됨 — impl-prep W1 우려사항이 실제 구현에서 해소됨을 재확인.
- **waiting-only 노출 범위 유지**: 세 문서 모두 `conversationThread` 를 "`waiting_for_input` 한정 노출"로 일관 규정(§8.4, §5.3, §3.1 각주). diff 의 2단계 조회는 정확히 `execution.status === ExecutionStatus.WAITING_FOR_INPUT` 분기 안에서만 실행되어 이 제약과 합치.
- **`GET /:id` 재조회 계약 유지**: `1-widget-app.md` §3.1 은 "버퍼(5분) 만료 후 재연결이면 `GET /api/external/executions/:id` 로 durable 스냅샷 재동기화"를 규정하는데, 이는 wire 응답 계약에 대한 것이지 DB 조회 방식과 무관 — 응답 shape 는 §5.3 그대로이므로 위배 없음.
- **`6-websocket-protocol.md`**: `getStatus`/`Execution` DB 조회 형태에 의존하는 서술 없음 (기존 impl-prep grep 결과와 diff 범위 모두 동일 결론).
- **W2(camelCase 컬럼명) 검증**: `execution.entity.ts` 확인 결과 `workflowId`→`@Column({name:'workflow_id'})`, `startedAt`→`started_at`, `finishedAt`→`finished_at`, `outputData`→`output_data`, `conversationThread`→`conversation_thread` 전부 매핑 정확. `STATUS_PROJECTION_COLUMNS`/2단계 `select` 배열 모두 엔티티 프로퍼티명(camelCase) 사용 — 오기 없음.

### 검토 질문 4 — frontmatter `status: partial` / `pending_plans` 갱신 필요 여부

**결론: 불필요, 확인됨.** `git diff origin/main...HEAD --stat -- 'spec/**'` 결과 이번 PR 은 `spec/` 파일을 **전혀 건드리지 않았다**. 변경은 순수 내부 조회 최적화이고 wire 계약·에러코드·엔드포인트 무변경이므로 미구현 표면을 새로 남기지 않는다 — `pending_plans` 목록(`spec-sync-external-interaction-api-gaps.md`)에 항목 추가/제거 대상도 아니다. 그 plan 파일 자체는 (spec 이 아닌 plan 문서로서) 기존 항목의 소스 라인번호 인용 1곳만 정정됐고 이는 완결성에 영향 없음.

### 검토 질문 5 — spec 본문이 `getStatus` 의 DB 조회 방식을 규정하는가

**결론: 규정하지 않음, spec 갱신 불요.** §5.3/§R17 은 (a) 응답 wire 필드·shape, (b) 노출 범위(`waiting_for_input` 한정), (c) 마스킹 불변식만 계약으로 규정한다. `[interaction.service.ts getStatus()]` 링크는 "구현 상태(V1)" 각주의 참조 링크(파일 단위, 라인번호 아님)일 뿐 조회 전략(단일 쿼리 vs 2단계)을 명세하지 않는다. 따라서 1단계/2단계 projection 전환은 spec 문서 갱신 의무를 발생시키지 않는다.

## 추가 관찰 (INFO, 비차단)

- **[INFO] impl-prep 리뷰의 결론이 실제 구현으로 그대로 실현됨**: `review/consistency/2026/07/10/22_25_21/cross_spec.md` (직전 impl-prep 라운드)가 예측한 설계(1단계 6-필드 projection + waiting-only 2단계 병렬 조회)가 diff 와 완전히 일치 — 구현 단계에서 계획 이탈 없음.
- **[INFO] `execution.entity.ts` 컬럼 JSDoc(라인 156-165)** 은 "EIA `getStatus` 는 waiting_for_input 시 이 스냅샷을 read-only 로 노출한다"는 소비처 서술을 담고 있으며 2단계 조회로도 여전히 참(眞) — 갱신 불요, cross-spec 범위 밖.

## 요약

`getStatus()` 의 1단계 얇은 projection(`id`/`status`/`workflowId`/`startedAt`/`finishedAt`/`outputData`) + `waiting_for_input` 조건부 2단계 `conversationThread` 재조회 리팩터는 `spec/5-system/14-external-interaction-api.md` §5.3/§R17 이 규정하는 9개 응답 필드를 라인 단위로 빠짐없이 커버하며, HTTP wire 응답 형식·에러코드·엔드포인트를 전혀 바꾸지 않았다(`spec/**` diff 0건으로 직접 확인). `redactThreadForPublic` 마스킹 불변식(`conversation-thread.md` §8.4)과 waiting-only 노출 범위(`1-widget-app.md` §3.1, `6-websocket-protocol.md` 무관계)는 소스만 `execution` row 에서 `threadRow`(2단계 재조회 결과)로 바뀌었을 뿐 정확히 보존됨. `git diff` 의 추가(`^\+`) 라인에서 신규 `EIA-XX-NN` 요구사항 ID 는 발견되지 않았고, 컬럼명(camelCase)도 엔티티 `@Column` 매핑과 전수 일치해 W2 침묵 회귀 우려는 실제 구현에서 해소됐다. spec frontmatter(`status: partial`/`pending_plans`)는 이번 변경이 미구현 표면을 남기지 않는 순수 내부 최적화이므로 갱신 대상이 아니며, spec 본문 어디에도 `getStatus` 의 DB 조회 전략(단일 vs 2단계)을 규정하는 문구가 없어 spec 갱신 의무 자체가 발생하지 않는다. CRITICAL/WARNING 급 cross-spec 충돌 없음.

## 위험도

NONE

---

STATUS: OK
