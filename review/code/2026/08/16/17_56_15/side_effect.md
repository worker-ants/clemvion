# 부작용(Side Effect) Review

## 범위 확인

`git diff origin/main...HEAD --stat` 로 대상 89개 파일 중 실행 경로가 있는 파일은 8개
TypeScript 파일뿐이다. 나머지는 `plan/**`·`review/**`·`spec/**`·`CHANGELOG.md`·
`.claude/docs/plan-lifecycle.md` 로 전부 문서/메타데이터라 부작용 관점에서 해당 없음.

- `codebase/backend/src/shared/utils/redact-stored-error.ts` (신규)
- `codebase/backend/src/shared/utils/redact-stored-error.spec.ts` (신규)
- `codebase/backend/src/modules/executions/executions.service.ts`
- `codebase/backend/src/modules/executions/executions.service.spec.ts`
- `codebase/backend/src/modules/executions/background-runs/background-runs.service.ts`
- `codebase/backend/src/modules/executions/background-runs/background-runs.service.spec.ts`
- `codebase/backend/src/modules/executions/dto/responses/execution-response.dto.ts` (JSDoc만)
- `codebase/backend/src/modules/executions/background-runs/dto/background-run-response.dto.ts` (JSDoc만)

프롬프트에서 diff 가 생략된 `executions.service.ts`/`executions.service.spec.ts` 는
`git diff origin/main...HEAD -- <path>` 로 전문을 직접 확인했고, 아래 인용 줄 번호는
`grep -n`/파일 직독으로 현재 소스에 대해 재검증한 실제 줄 번호다(프롬프트에 게이트가
없는 구간이라 문서 오프셋을 세지 않고 소스를 직접 열어 확정했다).

이 diff 는 직전 두 라운드(`review/code/2026/08/16/17_12_34/side_effect.md`,
`review/code/2026/08/16/17_35_49/side_effect.md`)가 이미 같은 코드 경로를 검토했고,
`17_12_34` 의 WARNING("`stop()` 반환값 정체성 변경 미문서화")이 문서화+실측으로
해소된 것을 `17_35_49` 가 재검증했다. 이번 라운드는 그 결론을 독립적으로 재확인하고,
이번에 추가된 `background-runs` 마스킹·CHANGELOG·plan 이동분까지 포함해 다시 훑었다.

## 발견사항

- **[INFO]** `ExecutionsService.stop()` 공개 메서드 시그니처·반환 계약 변경 — 이미 문서화·검증됨
  - 위치: `codebase/backend/src/modules/executions/executions.service.ts:817`(`stop`),
    `:830`(`stopInternal`), `:990`(`toResponseExecution`)
  - 상세: `stop(id): Promise<Execution>` → `Promise<ResponseExecution>` 로 반환 타입이
    좁아졌고, 반환값 자체가 "재조회한 엔티티 참조"에서 "마스킹된 새 plain object
    (relation 2개 제거 + `error` 마스킹)"로 바뀌었다 — 참조 동일성·엔티티 prototype이
    사라진다. 외부 호출부는 3곳으로 grep 확인됨: `interaction.service.ts:226,248`,
    `hooks.service.ts:407` 는 `await this.executionsService.stop(...)` 로 반환값을
    버리므로 무영향. `executions.controller.ts:145` 는 반환값을 그대로 HTTP 응답으로
    흘리는데, `Execution` 엔티티에 `@Exclude`/`@Expose`/커스텀 getter 가 없고(grep 0건)
    `stopInternal` 의 `findOne({ where: { id } })` 가 `relations` 를 지정하지 않아
    `trigger`/`executor` 는 이 경로에서 애초에 로드되지 않았다(직접 확인) — 즉 타입에서
    빠진 두 필드가 실제로 응답에서 사라지는 값이 아니다. JSDoc(`stop`/`stopInternal`/
    `toResponseExecution` 메서드 doc comment)에 이 계약 변경과 실측 근거가 명시돼 있고,
    `executions.service.spec.ts` 의 `expect(result).toBe(afterCancel)` → `toMatchObject`
    교체 및 `Execution.error 응답 마스킹 — 표면 전수` describe 블록의 `④`/`④-b` 케이스가
    회귀 테스트로 고정한다.
  - 제안: 조치 불필요 — 이미 문서화·테스트·호출부 검증이 갖춰져 있다. 기록만 남긴다.

- **[INFO]** `getChain()`/`findById()` 반환 타입도 함께 좁아짐 (`Execution[]` → `ResponseExecution[]`, `ExecutionDetailWithTrigger` 의 베이스가 `Execution` → `ResponseExecution`)
  - 위치: `codebase/backend/src/modules/executions/executions.service.ts:531`(`getChain`),
    `:567`(`findById`), `:87`(`export type ResponseExecution`), `:101`(`export type ResponseNodeExecution`)
  - 상세: 저장소 전체 grep 결과 두 신규 export 타입(`ResponseExecution`,
    `ResponseNodeExecution`)의 소비처는 `executions.service.ts` 자신과 그 `.spec.ts`
    뿐이다. `getChain`/`findById` 의 유일한 외부 호출부는 각각
    `executions.controller.ts:311`, `:88`, 그리고 `websocket.gateway.ts:399`
    (`execution.snapshot` emit) 인데 셋 다 반환값을 그대로 응답/payload 에 실을 뿐
    타입 분기 로직이 없어 컴파일 타임 영향 외 런타임 부작용은 없다.
  - 제안: 조치 불필요.

- **[INFO]** 응답 wire 값(`error.message`/`error.details`) 변경이 다수 표면에 파급 — 의도된 보안 수정, 이미 6개 spec 문서 + CHANGELOG 에 캐비엇으로 등재됨
  - 위치: `executions.service.ts:643`(`findById` 의 `nodeExecutions[]` 마스킹),
    `:946`(`toExecutionDto`), `:994`(`toResponseExecution`),
    `codebase/backend/src/modules/executions/background-runs/background-runs.service.ts:302`
  - 상세: `GET /api/executions/:id`·`/chain`·`/stop`·목록·WS `execution.snapshot`·
    `GET .../background-runs/:id` 6개 표면에서 자격증명 형태 부분 문자열이 `***` 로
    치환된다. `GET /api/executions/:id` 계열에 `@Roles` 게이트가 없어 워크스페이스
    멤버 전원(viewer 포함)이 영향을 받지만, 이는 인가 로직을 바꾸는 게 아니라 값
    마스킹을 추가하는 것이고 이미 CHANGELOG "⚠️ wire 변화" 캐비엇 +
    `execution-response.dto.ts`/`background-run-response.dto.ts` JSDoc + spec
    §R17/§2.14/§8.2/§6-websocket-protocol 6곳에 정본 등재돼 있다.
  - 제안: 조치 불필요 — 문서화 요건 충족.

- **[INFO]** 신설 함수가 기존 모듈 레벨 `WeakMap` 캐시(`DEEP_REDACT_CACHE`)의 소비자를 4곳 늘림 — 새 전역 상태 도입이 아니라 기존 인프라 확장
  - 위치: `codebase/backend/src/shared/utils/redact-stored-error.ts` (`deepRedactSecrets(err)` 호출부 — 캐시 정의 자체는 이번 diff 밖의 `sanitize-error-message.ts` `DEEP_REDACT_CACHE`)
  - 상세: `toResponseExecution`·`findById` 의 `nodeExecutions[]` map·`toExecutionDto`·
    `background-runs.service.ts` `toNodeExecutionDto` 4개 신규 호출 지점이 이 공유
    캐시를 탄다. 키는 매 쿼리마다 새로 생성되는 TypeORM row 객체(object identity)라
    요청 간 교차 오염 가능성은 없고, `redact-stored-error.spec.ts` "입력 객체를
    변이하지 않는다" 테스트 및 `executions.service.spec.ts` "DB 원문은 건드리지 않는다
    — egress-only (§R17)" 테스트가 무변이를 독립적으로 고정한다.
  - 제안: 조치 불필요.

- **[INFO]** `redactStoredErrorForResponse` 가 "마스킹할 것이 없으면 입력과 동일한 참조를 반환"하는 copy-on-change 특성상, 응답 payload 와 원본 DB 엔티티 값이 객체 identity 를 공유하는 경우가 있음 — 종결 상태 `snapshotCache` 재사용과 결합 시 잠재적 오염 표면(현재 코드에는 실제 뮤테이션 지점 없음)
  - 위치: `codebase/backend/src/shared/utils/redact-stored-error.ts:57-64`
    (`export function redactStoredErrorForResponse`, JSDoc 의 "같은 참조를 돌려주므로"
    문구), `executions.service.ts:174`(`snapshotCache`)·`:208`(`writeSnapshotCache`)
  - 상세: 평범한 에러 메시지(자격증명 형태가 없는 경우 — 실무상 절대다수)는
    `deepRedactSecrets` 가 아무것도 바꾸지 않아 `redactStoredErrorForResponse` 가
    입력과 **동일한 객체 참조**를 그대로 반환한다. `findById` 가 COMPLETED/FAILED/
    CANCELLED 종결 상태 결과를 인스턴스 LRU `snapshotCache` 에 저장하므로, 캐시에
    보관되는 `error` 필드는 (마스킹할 것이 없었다면) 조회 당시 TypeORM 이 만든
    엔티티의 `error` 객체와 같은 참조일 수 있다. 이번 diff 안에는 이 참조를 이후에
    in-place 로 변이하는 코드가 없고(전용 테스트로 무변이 확인됨), 이 저장소는 같은
    함수 안에서 이미 "무조건 spread 금지·참조 공유 시 캐시 오염" 문제를 인지하고
    있다(`reconcilePreParkWaitingStatus` 의 JSDoc — "`snapshotCache` 에 저장될 때
    변이된 참조가 공유되는 캐시 오염을 방지한다"). 따라서 이번 diff 가 새로 만든
    취약점은 아니고 기존 copy-on-change 관례의 자연스러운 연장이지만, 마스킹된 값이
    "항상 새 복사본"이 아니라 "때로는 원본과 동일 참조"라는 사실은 향후 이 반환값을
    소비하는 코드가 실수로 `result.error.foo = ...` 식 in-place 수정을 하면 DB 조회
    엔티티(및 캐시된 스냅샷)까지 조용히 오염될 수 있다는 뜻이라 기록해 둔다.
  - 제안: 조치 불필요(현재 코드에 실제 뮤테이션 지점 없음) — 다만 향후 이 반환값을
    다루는 코드를 추가할 때는 "복사본이 보장되지 않는다"는 전제를 유지할 것.

- **[검토했으나 문제 없음]** 전역 변수·환경 변수·파일시스템·네트워크 호출
  - 위치: 위 8개 TS 파일 diff hunk 전체
  - 상세: `console.`/`process.env`/`fs.`/`fetch(`/`axios`/`http.request` 패턴을
    diff hunk 전체에 대해 확인 — 매치 0건. 신규 파일 `redact-stored-error.ts` 는
    `deepRedactSecrets` 위임 순수 함수로 I/O 가 없다.

- **[검토했으나 문제 없음]** `getChain`/`toResponseExecution` 이 DB 에 값을 되쓰지 않음
  - 위치: `executions.service.ts:557-561`(`getChain` 의 `rows.map((e) => this.toResponseExecution(e))`)
  - 상세: `getChain`/`findById`/`toExecutionDto` 모두 조회 결과를 응답 형태로만
    변환하고 `save`/`update`/`createQueryBuilder().update(...)` 등 쓰기 경로에
    연결되지 않는다 — 마스킹된 값이 실수로 영속화될 경로가 없다(§R17 egress-only
    원칙이 실제로 지켜짐).

- **[검토했으나 문제 없음]** `explore-tools.service.ts`(workflow-assistant LLM 도구) — RESOLUTION 이 "처방을 되돌렸다"고 기록한 항목이 실제로 diff 밖에 있음
  - 위치: (해당 파일은 이번 diff 에 없음)
  - 상세: `git diff origin/main...HEAD --stat -- '**explore-tools*'` 결과 0건으로,
    `review/code/2026/08/16/17_12_34/RESOLUTION.md` 의 "#7 — 고치려다 되돌렸다" 서술과
    실제 코드 상태가 일치함을 재확인했다. 이 표면은 트래커에 별건으로 등재됐을 뿐
    이번 diff 의 부작용 표면이 아니다.

- **[검토했으나 문제 없음]** `.claude/docs/plan-lifecycle.md` 의 `pending_plans` 신규 convention
  - 위치: `.claude/docs/plan-lifecycle.md` §80-101 부근(plan 레벨 `pending_plans` 표)
  - 상세: 코드가 아니라 사람이 읽는 plan frontmatter 관행 문서화다. 문서 스스로 "이
    값은 완료 판정에 쓰이지 않고 build guard 가 없다"를 명시해 예상치 못한 강제 동작을
    새로 만들지 않는다 — 부작용 관점에서 해당 없음(INFO 조차 아님).

## 요약

이번 diff 의 실질 런타임 부작용은 egress 마스킹 유틸(`redactStoredErrorForResponse`)
신설과 그 소비처(`ExecutionsService` 4경로 + `BackgroundRunsService` 1경로) 배선으로
국한된다. 함수 자체는 순수하고 무변이가 전용 테스트로 고정돼 있다. 유일하게 실질적인
계약 변경인 `ExecutionsService.stop()` 의 반환 타입/값 정체성 변경은 직전 두 라운드가
이미 지적·검증한 항목이며, 이번 라운드에서도 문서화(JSDoc)·회귀 테스트·호출부 3곳
전수 확인이 그대로 유지돼 있음을 재확인했다. `getChain`/`findById` 의 반환 타입 축소도
외부 소비처가 컨트롤러/WS gateway 뿐이라 실질 영향이 없다. 새로 발견한 것은 "마스킹
결과가 항상 새 복사본은 아니고 때로는 원본과 참조를 공유한다"는 특성이 종결 상태
`snapshotCache` 재사용과 만나는 지점인데, 현재 코드에는 그 참조를 변이하는 지점이
없어 INFO 로만 기록한다. 전역 변수 신설, 환경 변수 읽기/쓰기, 파일시스템 부작용,
의도치 않은 네트워크 호출, 이벤트/콜백 발생 패턴 변경은 발견되지 않았다.

## 위험도

LOW
