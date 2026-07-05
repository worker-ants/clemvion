# 요구사항(Requirement) Review — V-10 트리거 목록 Schedule cron/nextRunAt enrichment

## 발견사항

- **[INFO]** `findAll` 이 워크스페이스 필터를 이중 스코프 하지만 정확히 일치
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts:834-838` (`scheduleRepository.find({ where: { triggerId: In(scheduleTriggerIds), workspaceId } })`)
  - 상세: `findOneDetail` 의 기존 단건 enrichment(`triggers.service.ts:879-881`, `where: { triggerId: id, workspaceId }`)와 동일하게 `workspaceId` 를 재확인한다. `trigger.workspaceId` 로 이미 필터링된 목록의 `id` 만 모으므로 cross-workspace 유출 가능성은 없고, 이 재확인은 정합성 방어를 한 겹 더할 뿐 — 문제 아님. 두 경로(`findAll`/`findOneDetail`)의 enrichment semantics(필드 3개: `cronExpression`/`timezone`/`nextRunAt`, `Object.assign` 후 `sanitizeChatChannelForResponse`)가 line-level 로 대칭.
  - 제안: 없음(정보성 확인).

- **[INFO]** `Object.assign(t, {...})` 이 fetched TypeORM entity 를 in-place mutate
  - 위치: `triggers.service.ts:846-851`
  - 상세: `Trigger` 엔티티에는 `cronExpression`/`timezone`/`nextRunAt` 컬럼이 없어(entity 파일 확인, `@Column` 없음) 이 mutation 은 순수 ad-hoc 속성 부착이며 이후 `save()` 호출이 없어 DB 영속에 영향 없음. `findOneDetail` 도 동일 패턴(`Object.assign(trigger, {...})`, `triggers.service.ts:884-888`)이라 신규 변경이 아니라 기존 컨벤션 재사용. 문제 아님.
  - 제안: 없음.

- **[INFO]** N+1 회피가 실제로 구현되고 테스트로 검증됨
  - 위치: `triggers.service.spec.ts:537-578`(`scheduleRepo.find` 정확히 1회 호출 + `In(['s-trig'])` 인자 단언), `triggers.service.ts:830-839`
  - 상세: `data` 배열에서 `type==='schedule'` id 만 추려 배치 조회, `getMany()` 이후에만 실행 — 페이지당 1회. changelog 주장(N+1 회피)과 구현이 일치.

- **[INFO]** 엣지 케이스 커버리지 확인 (unit test 3건 모두 통과, 실행 확인 완료)
  - 위치: `triggers.service.spec.ts:537-608` — (a) schedule+webhook 혼재 목록에서 schedule 행만 enrichment, webhook 행은 `cronExpression` 등 필드 자체가 `undefined`(오염 없음), (b) 목록에 schedule 행이 0건이면 `scheduleRepository.find` 자체를 skip(빈 `In([])` 쿼리 방지 — 불필요 DB 라운드트립 회피), (c) schedule 트리거는 있으나 매칭되는 `Schedule` row 가 없는(orphan) 경우 cron 필드 without throw — `undefined` 로 graceful degrade. 세 경로 모두 반환값 정의됨(빈 배열 시나리오 없음: `data` 자체가 이미 페이지네이션된 배열이라 빈 페이지도 정상 처리 — `scheduleTriggerIds.length > 0` 가드가 빈 배열도 처리).
  - `npx jest triggers.service.spec.ts -t "V-10"` 실행 결과 3 passed 확인.

- **[INFO]** spec §2.1 (spec fidelity) 일치 확인
  - 위치: `spec/2-navigation/2-trigger-list.md` §2.1 "Schedule 태그" 행("Schedule 유형 트리거에 `[Schedule]` 태그 표시 + Cron 표현식 + 다음 실행 시각") + §2.3.1 "Schedule Configuration" 행(`cronExpression`/`timezone`/`nextRunAt` read-only)
  - 상세: spec 이 목록 행에 cron·다음 실행 시각 표시를 명시하고 있고, 프런트 `triggers/page.tsx:215-216`(`cronExpression: t.cronExpression, nextRunAt: t.nextRunAt`)가 이미 이 필드를 목록 API 응답에서 읽고 있었다(변경 전에는 값이 항상 `undefined` 였을 3자 어긋남을 changelog 가 정확히 서술). 이번 diff 는 `findAll` 응답이 실제로 이 필드를 채우도록 만들어 spec-코드-FE 3자 정합을 완성한다. `TriggerDto` JSDoc 정정("단건 조회 시에만" → "목록·단건 모두")도 실제 동작과 일치.
  - 제안: 없음 — CRITICAL/WARNING 없음.

- **[INFO]** 반환값/타입 시그니처 변경 확인
  - 위치: `triggers.service.ts:82`(diff), `TriggerDetail` export(`triggers.service.ts:732-736`)
  - 상세: `findAll` 반환 타입이 `Promise<PaginatedResponseDto<Trigger>>` → `Promise<PaginatedResponseDto<TriggerDetail>>` 로 정직하게 갱신됐다(실제 반환 shape 과 시그니처 일치 — 이전엔 암묵적으로 `Trigger` 라고 거짓 선언했던 것을 바로잡음). 컨트롤러 `@ApiOkPaginatedResponse(TriggerDto, ...)` swagger 문서화는 두 필드가 이미 `TriggerDto` 정의에 존재해 응답 문서와 실 데이터가 일치. `tsc --noEmit` 확인 결과 이 변경으로 인한 신규 컴파일 에러 없음(잔여 에러 2건은 `auth-configs.service.spec.ts`/`review-workflow.spec.ts` — 본 diff 와 무관한 사전 존재 이슈).

## 요약

`TriggersService.findAll()` 의 schedule 목록 enrichment 는 spec §2.1 "Schedule 태그" 요구(목록 행에 cron·다음 실행 시각 표시)를 정확히 충족하며, 이미 이 필드를 소비 중이던 프런트(`triggers/page.tsx`)와의 3자 어긋남을 해소한다. 구현은 `findOneDetail` 의 기존 단건 enrichment 패턴(동일 필드 3개, 동일 `Object.assign`+`sanitizeChatChannelForResponse` 파이프라인, 동일 `workspaceId` 스코프)을 배치화한 것으로 semantics 가 line-level 로 대칭이다. N+1 회피(`In(...)` 배치 1회), schedule 없음/미매칭 orphan 등 엣지 케이스가 신규 unit test 3건으로 커버되고 실제 실행 통과가 확인됐다. TODO/FIXME 없음, 반환 타입 시그니처(`TriggerDetail`)도 실제 shape 과 일치하도록 정직하게 갱신됐다. CRITICAL/WARNING 급 결함을 발견하지 못했다.

## 위험도

NONE
