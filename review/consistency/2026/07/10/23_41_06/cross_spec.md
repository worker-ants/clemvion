# Cross-Spec 일관성 검토 — `getStatus()` projection 최적화 (impl-done, 재확인)

- 모드: `--impl-done` (구현 완료 후, mtime-only 재트리거에 대한 독립 재검증)
- 대상 spec 영역: `spec/5-system/14-external-interaction-api.md`
- diff base: `origin/main...HEAD`
- 배경: 직전 `--impl-done` 라운드(`review/consistency/2026/07/10/23_20_43/`)가 `BLOCK: NO` 로 이미 종결. 이후
  fresh-review sub-agent 들의 mutation testing 이 `interaction.service.ts` 의 **mtime 만** 갱신(내용 원복,
  `git diff f2764f3a9 HEAD -- codebase/` 빈 결과) — review guard 재발화分. 코드 내용 변경 0건이므로 동일
  changeset 에 대한 독립 재확인.

## 검토 방법 (직접 실행, 프롬프트 payload 비신뢰)

1. `git diff origin/main...HEAD --stat` / `--stat -- 'spec/**'`
2. `git diff origin/main...HEAD -- codebase/backend/.../interaction.service.ts` 전문 라인 단위 확인
3. `git diff origin/main...HEAD -- codebase/ | grep -E "^\+" | grep -oE "EIA-[A-Z]{2,3}-[0-9]{2}"`
4. `spec/5-system/14-external-interaction-api.md` §5.3 wire 스키마 원문 대조
5. `execution.entity.ts` `@Column({name:...})` 매핑을 직접 grep 해 `STATUS_PROJECTION_COLUMNS` / 2단계 `select` 배열과 1:1 대조
6. `conversation-thread.md` §4/§8.4, `1-widget-app.md` §3.1, `6-websocket-protocol.md` 전문에서 `getStatus`/DB 조회 전략 관련 서술 grep

## 발견사항

### 검토 질문 1 — §5.3 응답 9개 필드가 1·2단계 projection 으로 빠짐없이 커버되는가

**결론: 커버됨. 충돌 없음.**

§5.3 wire 응답 필드(원문 확인): `id` / `workflowId` / `status` / `currentNode` / `context` / `result` / `error` / `seq` / `updatedAt` = 9개.

신규 상수:
```ts
const STATUS_PROJECTION_COLUMNS = [
  'id', 'status', 'workflowId', 'startedAt', 'finishedAt', 'outputData',
] satisfies (keyof Execution)[];
```

| §5.3 필드 | 소스 (구현 라인 확인) | 커버리지 |
|---|---|---|
| `id` | `execution.id` | 1단계 projection |
| `workflowId` | `execution.workflowId` | 1단계 projection |
| `status` | `execution.status` | 1단계 projection |
| `result` (COMPLETED) | `deepRedactSecrets(execution.outputData ?? null)` | 1단계 projection (`outputData`) |
| `error` (FAILED) | 동일 `execution.outputData` | 1단계 projection |
| `updatedAt` | `(execution.finishedAt ?? execution.startedAt ?? new Date()).toISOString()` | 1단계 projection 에 `startedAt`/`finishedAt` 둘 다 포함 — fallback 침묵 회귀(W2) 없음 |
| `context.conversationThread` | `threadRow?.conversationThread` (2단계 `select:['id','conversationThread']`) | `WAITING_FOR_INPUT` 분기 한정 재조회, `redactThreadForPublic` 마스킹 유지 |
| `currentNode` / `context.{buttonConfig,nodeOutput,...}` | `nodeExecutionRepository.findOne(...)` (별도 테이블, `Promise.all` 병렬) | Execution projection 과 무관 — 이번 diff 로 로직 미변경(호출 위치만 병렬화) |
| `seq` | 상수 `SSE_SEQ_PLACEHOLDER` | DB 비의존 |

빠진 필드 없음. `satisfies (keyof Execution)[]` 가 컴파일 타임에 오타(snake_case 등)를 막아 런타임 침묵 누락 경로를 봉쇄.

### 검토 질문 2 — 신규 요구사항 ID(EIA-XX-NN) 신설 0건 실증

**결론: 확인됨.**

```
git diff origin/main...HEAD -- codebase/ | grep -E "^\+" | grep -oE "EIA-[A-Z]{2,3}-[0-9]{2}" | sort -u
```
→ **0건** (코드 diff 전체 범위, exit 0 / 빈 출력).

전체 diff(`review/**` 산출물 포함)에서 `EIA-IN-07`/`EIA-NF-03`/`EIA-NF-05`/`EIA-NX-11` 문자열이 발견되나, 전부
(a) `plan/in-progress/spec-sync-external-interaction-api-gaps.md` 의 기존(unchanged) 컨텍스트 라인이거나
(b) 이번 diff 가 실제로 건드린 것은 그 파일의 소스 라인번호 인용(`interaction.service.ts:247-296` →
심볼 참조로 대체) 1곳뿐, (c) `review/**` 산출 문서 내 서술 인용. 새 ID 신설·기존 ID 의미 변경 없음.

### 검토 질문 3 — `spec/` 파일이 diff 에 포함되는가

**결론: 0건.** `git diff origin/main...HEAD --stat -- 'spec/**'` 결과 없음 — spec 갱신 의무 없음 확인.

### 검토 질문 4 — `conversation-thread.md` §4/§8.4, `1-widget-app.md` §3.1, `6-websocket-protocol.md` 와 충돌 없는지

**결론: 충돌 없음.**

- **마스킹 불변식 유지**: `conversation-thread.md` §8.4 는 "SSE emit 과 REST `getStatus` 가 공유하는 단일 helper
  `redactThreadForPublic` 가 egress 시 마스킹"을 런타임 강제 불변식으로 규정. diff 는
  `threadRow?.conversationThread ? redactThreadForPublic(threadRow.conversationThread) : undefined` 로
  소스 객체(`execution` → `threadRow`)만 바뀌고 마스킹 호출은 그대로 보존.
- **waiting-only 노출 범위 유지**: 세 문서 모두 "`waiting_for_input` 한정 노출"로 일관 규정. diff 의 2단계
  조회는 정확히 `execution.status === ExecutionStatus.WAITING_FOR_INPUT` 분기 안에서만 실행되어 합치.
- **`1-widget-app.md` §3.1** "버퍼(5분) 만료 후 재연결이면 `GET /:id` 로 durable 스냅샷 재동기화" 는 wire
  응답 계약에 대한 서술이지 DB 조회 방식과 무관 — 응답 shape 는 §5.3 그대로라 위배 없음.
- **`6-websocket-protocol.md`**: `getStatus` 문자열 자체가 grep 0건 — `getStatus`/`Execution` DB 조회 형태에
  의존하는 서술 자체가 없음. 충돌 표면 없음.
- **W2(camelCase 컬럼명) 독립 재검증**: `execution.entity.ts` 를 직접 grep 확인 —
  `workflowId`→`@Column({name:'workflow_id'})`, `startedAt`→`started_at`, `finishedAt`→`finished_at`,
  `outputData`→`output_data`, `conversationThread`→`conversation_thread`, `status`→`@Column({length:30,...})`
  (컬럼명 미지정 시 기본 snake_case 자동 변환, `status` 는 camelCase=snake_case 라 오기 여지 없음) 전부 매핑 정확.
  `STATUS_PROJECTION_COLUMNS`/2단계 `select` 배열 모두 엔티티 프로퍼티명(camelCase) 사용 — 오기 없음.

### 검토 질문 5 — spec frontmatter `status: partial` / `pending_plans` 갱신 필요 여부

**결론: 불필요.** 이번 PR 은 `spec/**` 파일을 전혀 건드리지 않았고, wire 계약·에러코드·엔드포인트 무변경인
순수 내부 조회 최적화라 미구현 표면을 새로 남기지 않는다 — `pending_plans` 목록
(`spec-sync-external-interaction-api-gaps.md`, 다른 gap 들이 여전히 열려있어 `partial` 유지가 맞음)에
항목 추가/제거 대상도 아니다. 해당 plan 파일 자체는 (spec 이 아닌 plan 문서로서) 기존 완료 항목의 소스
라인번호 인용 1곳만 심볼 참조로 정정됐을 뿐 완결성에 영향 없음.

## 추가 관찰 (INFO, 비차단)

- **[INFO] 재확인 라운드 간 완전 일치**: 직전 impl-done 라운드(`23_20_43`) 및 그 이전 impl-prep 라운드
  (`22_25_21`)의 결론과 본 독립 재검증 결과가 라인 단위로 동일 — mtime-only 재트리거가 실제 회귀를
  드러내지 않았음을 재확인.
- **[INFO] `execution.entity.ts` 컬럼 JSDoc(155-165행 부근)** 은 "EIA `getStatus` 는 waiting_for_input 시 이
  스냅샷을 read-only 로 노출한다"는 소비처 서술을 담고 있으며 2단계 조회로도 여전히 참(眞) — 갱신 불요.

## 요약

`getStatus()` 의 1단계 얇은 projection(`id`/`status`/`workflowId`/`startedAt`/`finishedAt`/`outputData`) +
`waiting_for_input` 조건부 2단계 `conversationThread` 재조회(NodeExecution 조회와 `Promise.all` 병렬) 리팩터는
`spec/5-system/14-external-interaction-api.md` §5.3/§R17 이 규정하는 9개 응답 필드를 빠짐없이 커버하며,
HTTP wire 응답 형식·에러코드·엔드포인트를 전혀 바꾸지 않는다(`spec/**` diff 0건 직접 확인). 코드 diff 의 신규
추가(`^\+`) 라인에서 `EIA-XX-NN` 요구사항 ID 는 0건 발견 — 과거 impl-done 오탐 클래스(신규 ID 신설)가 이번
changeset 에는 해당하지 않음을 실증했다. `redactThreadForPublic` 마스킹 불변식(conversation-thread.md §8.4)과
waiting-only 노출 범위(1-widget-app.md §3.1)는 소스 객체만 `execution` row 에서 `threadRow`(2단계 재조회
결과)로 바뀌었을 뿐 정확히 보존되며, `6-websocket-protocol.md` 는 `getStatus` 조회 방식에 대한 서술 자체가
없어 충돌 표면이 존재하지 않는다. 엔티티 `@Column` 매핑을 직접 재검증해 W2(camelCase 오기에 의한 침묵
`updatedAt` fallback 회귀) 우려도 실제 구현에서 해소됨을 확인했다. spec frontmatter(`status: partial`/
`pending_plans`)는 이번 변경이 미구현 표면을 남기지 않는 순수 내부 최적화이므로 갱신 대상이 아니다.
CRITICAL/WARNING 급 cross-spec 충돌 없음 — 직전 라운드의 `BLOCK: NO` 결론이 독립 재검증으로도 뒤집히지 않는다.

## 위험도

NONE

---

STATUS: OK
