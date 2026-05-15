# RESOLUTION — AI Review 2026-04-24 12:18:04

대상: `improve-code` 브랜치 중 `26e89b0..HEAD` 범위 (어시스턴트 실행 조회 도구 추가)
리뷰 결과: Critical 0, Warning 11, Info 17

본 문서는 각 항목의 조치 내역을 기록한다. `✅` 는 코드 변경으로 해결, `📎` 는 스펙/문서 변경으로 해결, `🗓` 는 후속 작업으로 이관(이유 기재), `➖` 는 조치 불필요(오판정 또는 기존 자산으로 해결됨).

## Warning (11건)

### W1 — i18n 키가 배지 컴포넌트에 미연결 📎

- **소견**: `assistant.exploreExecutionsList`·`exploreExecutionDetails`·`executionNotInScope` 3개 키가 `ko.ts`/`en.ts` + 스펙 §13 에 선언됐으나 `tool-call-badge.tsx` 의 `summarize()` 는 인라인 영문 문자열을 반환 → 한국어 UI 에 영문 노출.
- **조치**: 배지에 `useTranslation` 을 즉시 연결하지 않고, spec §13 상단에 "배지 라벨은 영문 고정이 현재 관례이며, 3 개 키는 다른 UI 표면(힌트/에러 bubble) 용 contract" 라는 주석을 추가. 기존 `assistant.exploreLookup` 도 동일하게 배지에 미연결 상태로 선언돼 있어 프로젝트 전체 관례와 일치한다. 배지 전면 번역은 별도 i18n 개선 과제로 분리(후속).

### W2 — `isExecutionInScope` 제3 워크플로 분기 테스트 누락 ✅

- **소견**: `parentExecutionId` 가 있지만 부모의 `workflowId` 가 현재 세션 WF 가 아닌 "제3 워크플로" 분기 미검증. 기존 `EXECUTION_NOT_IN_SCOPE` 테스트는 `parentExecutionId: null` 만 덮음.
- **조치**: `explore-tools.service.spec.ts` 에 두 케이스 신규 추가: (a) parent 가 제3 WF 인 경우 → `EXECUTION_NOT_IN_SCOPE`, (b) parent 가 다른 workspace 인 경우 → `EXECUTION_NOT_IN_SCOPE`. 기존 `null parent` 케이스는 별도 it 으로 분리돼 유지.

### W3 — `tool-call-badge.tsx` 신규 분기 테스트 전무 🗓

- **소견**: `summarize()` 에 `get_workflow_executions`/`get_execution_details` 분기 추가 후 유닛 테스트 없음.
- **조치**: 현재 `tool-call-badge.test.ts` 는 `groupToolCalls` 공개 함수만 테스트하고 `summarize` 는 모듈 내부 private. 테스트를 위해 export 를 추가하면 API 표면이 확장되고, 배지 자체는 DOM 렌더 시 검증되는 얇은 맵핑이라 단위 가치가 낮다. **본 이슈는 `summarize` 의 테스트 가능한 export 로의 승격 + 3 케이스 추가** 로 별도 후속 커밋으로 이관. 현재 커버는 `workflow-assistant-stream.service.spec.ts` 의 2 건 e2e 테스트 + 런타임 확인.

### W4 — `loadTimeline` row 상한 없음 ✅ 📎

- **소견**: 루프 노드 수천 회 회전 시 `getExecutionDetails` 가 수만 row 를 메모리에 올리고 자식 실행에도 재귀. 토큰/메모리 폭주.
- **조치**: `TIMELINE_ROW_CAP = 500` 상수 도입, `loadTimeline` 과 자식 배치 버전 모두 `TIMELINE_ROW_CAP + 1` 을 페치해 초과 시 앞 500 만 담고 `timelineTruncated: true` 플래그 발행. 스펙 §4.1.1 의 응답 구조 / "페이로드 크기 정책" 단락에 신규 필드·동작 반영.

### W5 — 자식 timeline N+1 쿼리 ✅

- **소견**: `Promise.all(directChildren.map(child => loadTimeline(child.id)))` 가 자식 수만큼 개별 쿼리 발행. `loadNodeStats` 의 `In()` 패턴과 불일치.
- **조치**: 신규 private 메서드 `loadTimelinesByExecutionIds(ids)` — `nodeExecutionRepo.find({ where: { executionId: In(ids) }, order: { executionId: 'ASC', startedAt: 'ASC' } })` 단일 쿼리로 전 자식 timeline 을 로드한 뒤 executionId 키로 그룹핑. 스펙 테스트에 "자식 timeline 조회가 `find` 를 2회만 호출" assertion 을 추가해 N+1 재발 회귀 방어.

### W6 — 인덱스 존재 미확인 ➖

- **소견**: `parent_execution_id` 및 `(workflow_id, started_at DESC)` 복합 인덱스 필요.
- **조치**: 마이그레이션 V006 이 `idx_execution_parent` 를, V002 가 `idx_execution_workflow_started` (workflow_id, started_at DESC) 를 이미 제공 — 추가 마이그레이션 불필요. `grep CREATE INDEX` 로 확인 완료.

### W7 — 상태 enum 중복 정의 ✅

- **소견**: `'pending'|'running'|...'waiting_for_input'` 가 `explore-tools.service.ts` 와 `tool-definitions.ts` JSON schema 에 각각 선언.
- **조치**: `EXECUTION_STATUS_VALUES` 를 `explore-tools.service.ts` 에서 `export const` 로 노출. `tool-definitions.ts` 는 `enum: [...EXECUTION_STATUS_VALUES]` 로 import.

### W8 — `getExecutionDetails` 내 독립 쿼리 직렬 실행 ✅

- **소견**: scope 통과 후 `loadTimeline` 과 `findChildren` 이 의존성 없음에도 순차 실행.
- **조치**: `Promise.all([loadTimeline, executionRepo.find(children)])` 로 1차 병렬화. 2차로 `Promise.all([loadTimelinesByExecutionIds, deeperExistsProbe])` 로 자식 timeline 배치 + 2-depth 존재 프로브를 병렬 실행. 총 왕복 3 → 2 round-trip.

### W9 — `loadNodeStats` 앱 레벨 집계 ✅

- **소견**: 최대 50건의 모든 `node_execution` row 를 메모리로 로드 후 JS 루프. DB GROUP BY 로 row 수 상한화 가능.
- **조치**: `createQueryBuilder('ne').select('execution_id').addSelect('status').addSelect('COUNT(*)').groupBy('ne.execution_id').addGroupBy('ne.status').getRawMany()` 로 전환. 반환 row 수는 `|executionIds × 실제 status 종류|` 로 고정. 테스트의 mock 도 `getRawMany` 로 맞춰 업데이트.

### W10 — `tsconfig.json` 테스트 제외로 타입 가드 약화 🗓

- **소견**: 빌드 typecheck 에서 `*.spec.ts`·`*.test.tsx` 제외로 mock 타입 불일치가 CI 에서 누락될 수 있음.
- **조치**: tsconfig 제외는 Next 빌드에서 vitest 4.1.4 의 `dist/index.d.ts` chunk export 이슈(`.js` 확장자 사용) 를 우회하기 위한 최소 조치였다. 완전한 해결책은 `tsconfig.test.json` 을 별도 생성해 vitest 전용 typecheck 파이프라인(예: `npm run typecheck:test` 을 lint 단계에 추가) 을 붙이는 것. **본 후속은 별도 개선 이슈로 이관** (vitest 업그레이드 또는 tsconfig.test.json 설정). 현 상태에서도 `npx tsc --noEmit -p tsconfig.test.json` 용 config 는 추가 시 즉시 CI 에 연결 가능.

### W11 — plan 문서 체크박스 미갱신 ✅

- **소견**: `plan/workflow-assistant-execution-tools.md` 의 Phase 1~4 체크박스가 `[ ]` 상태.
- **조치**: 모든 Phase 항목을 `[x]` 로 갱신하고 각 항목에 실제 산출 요약(테스트 건수, 메서드명 등) 을 병기.

## Info (17건) — 선별 조치

- **I8 — `triggerId` 필드 spec 누락** 📎: spec §4.1 의 `get_workflow_executions` 응답 컬럼에 `triggerId` 추가.
- **I9 — `subExecutionsTruncatedDepth` 하드코딩 `1`** ✅: `SUB_EXECUTION_INCLUDED_DEPTH = 1` 상수로 승격.
- **I13 — `getCount() + limit(1)` 효과 없음** ✅: `.getMany().then(r => r.length > 0)` 로 교체해 실제로 한 건만 페치.
- **I14 — 빈 결과 케이스 미명시** ✅: `getWorkflowExecutions` 에 "no executions" 전용 테스트 추가, `statsQb.groupBy` 미호출 assertion 까지 포함.
- **I15 — 단일 자식만 테스트** ✅: 다중 자식(completed + failed 혼합) 케이스 신규 추가. 배치 쿼리 call count assertion 포함.
- **I17 — memory 문서 구현 괴리** 📎: `ExecutionsService` 어댑터 → Repository 직접 주입 전환의 trade-off 를 memory 에 기록.
- **I1 — workspace 검증 쿼리 레벨로 이동**: 현재 `workflow` relation 을 fetch 한 뒤 앱 레이어에서 `workspaceId` 비교. 쿼리 레벨(`where: { workflow: { workspaceId } }`) 로 이동하면 미묘하게 더 안전하나 TypeORM nested-where 는 JOIN 을 강제하고 EXPLAIN 변화가 있어 벤치 후 결정. 후속.
- **I2 — 부모 실행 workspace 검증**: W2 조치에 포함 — `isExecutionInScope` 가 부모 fetch 시 `relations: ['workflow']` 로 가져와 `workspaceId` 일치를 확인한다(테스트로 고정).
- **I3 — 마스킹 suffix 로 패턴 노출 우려**: `'****last4'` 관례는 전역 `maskSensitiveFields` 유틸의 동작이며, LLM 출력 컨텍스트에서는 디버깅 가치가 보안 위험보다 높다(4자리로 특정값 역산 불가능). 변경 보류.
- **I4 — Running 스냅샷 비원자성 프롬프트 명시**: spec §4.1.1 에 "Running 실행 응답은 스냅샷" 단락 추가. 시스템 프롬프트는 스펙 문구를 옮겨 반영하지 않고 "running / waiting_for_input partial timeline" 한 줄로 유지.
- **I5 — Fat Service 경향**: 현 규모 8 메서드. 도구 2~3개 추가 시점에 `ExecutionExploreService` 분리 검토. 지금은 리팩토링 비용 > 이득.
- **I6 — Shotgun Surgery**: 동일 판단. 레지스트리 패턴 도입은 도구 10개 돌파 시 재평가.
- **I7·I10·I11·I12·I16**: 관례·스타일·doc 세분화 영역으로 현 리뷰 범위에서는 조치 생략. 후속 개선 큐에 포함.

## 후속 개선 큐 (별도 이슈로 분리)

1. W3 — `summarize` export + 배지 분기 단위 테스트 3 케이스
2. W10 — `tsconfig.test.json` 분리 + CI 에 typecheck:test 단계
3. I1/I2 — workspace 검증을 쿼리 레벨로 이동(벤치 후)
4. I4 — 시스템 프롬프트에 "running 응답은 스냅샷" 한 줄 추가 여부 실사용 피드백 후 결정
5. 배지 라벨 i18n 전면 적용 (W1 의 근본 해결)

## 테스트 재검증

조치 후:

- backend lint: clean (`--max-warnings=0`)
- backend unit: **1868/1868** passed
- backend build: green
- frontend lint: clean
- frontend vitest: **1075/1075** passed
- frontend build: green
