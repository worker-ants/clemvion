# 문서화(Documentation) 리뷰

## 발견사항

- **[WARNING]** `RESOLUTION.md` 가 "정정 완료" 라고 주장한 항목이 실제로는 정정되지 않았다 — 신규 H2 헤딩 앞 빈 줄 누락이 여전히 존재
  - 위치: `review/code/2026/09/03/16_45_35/RESOLUTION.md:54`(주장) / `plan/in-progress/entity-nullable-column-type-mismatch.md:171`(실제 파일, 미수정 상태)
  - 상세: 전 라운드(`16_45_35`) documentation 리뷰가 INFO 로 "`## 배치 2 — 비대칭 해소 (완료)` 헤딩 앞에 빈 줄이 없다" 를 지적했다. 이번 diff 에 포함된 `RESOLUTION.md` 는 미조치 목록에 "**INFO#8** 새 헤딩 앞 빈 줄 — **W2 정정에 포함됐다**" 라고 적어, W2(체크리스트 분산 수정) 커밋에서 이 빈 줄도 함께 고쳐졌다고 주장한다. 그러나 `git blame -L 168,172 -- plan/in-progress/entity-nullable-column-type-mismatch.md` 로 실측하면 `## 배치 2` 헤딩(171행)은 W2 를 포함한 fix 커밋 `a7b9667bc`(17:08:56)가 아니라 그 이전 커밋 `9b203d4d48`(16:45:27, 배치 2 원본 커밋)에서 도입된 그대로이고, `a7b9667bc` 의 diff(`git show a7b9667bc -- plan/...`)에는 168~171행 근방에 대한 변경이 전혀 없다. 즉 **빈 줄은 지금도 없고**, `RESOLUTION.md` 의 "포함됐다" 서술은 검증되지 않은 채 기록된 거짓 진술이다. 두 라운드 연속으로 같은 자리를 지적받았는데, 정작 그 사이 라운드는 "고쳤다" 고 적어 이 항목을 종결 처리해 버린 셈이라 — 다음 사람이 이 RESOLUTION 문서를 근거로 "이미 해소됨" 으로 오인할 위험이 있다.
  - 제안: (1) `plan/in-progress/entity-nullable-column-type-mismatch.md:170`(문단 끝)과 `:171`(`## 배치 2` 헤딩) 사이에 빈 줄 1개 삽입 — 실제 조치. (2) `RESOLUTION.md` 의 해당 서술을 "미조치로 재확인, 후속 라운드에서 처리" 로 정정해, "정정에 포함됐다" 는 검증되지 않은 주장이 기록으로 남지 않게 한다.

## 참고 (INFO)

- **[INFO]** 그 외 코드 측 문서화는 정확 — 특이사항 없음
  - 위치: `codebase/backend/src/modules/{executions,knowledge-base,node-executions,nodes,notifications,schedules,triggers,users,workflows}/entities/*.entity.ts`
  - 상세: 9개 엔티티 파일의 인라인 주석·JSDoc 을 전수 대조했다 — `nullable: true` 컬럼 옆에 "NULL = …" 류 의미를 설명하는 주석들(`execution.entity.ts` 의 `queuedAt`/`sourceIp`/`conversationThread`/`userVariables`/`resumeCallStack` 등, `trigger.entity.ts` 의 `notificationSecretV2`/`chatChannelSetupAt` 등)은 이번 diff 가 non-null → `| null` 로 넓힌 필드와 겹치지 않거나, 겹치는 자리(`Trigger.endpointPath`/`lastTriggeredAt`, `Notification.resourceType` 등)는 애초에 별도 JSDoc 이 없어 갱신할 오래된 서술 자체가 없었다. 오래된 주석(stale comment)은 발견되지 않았다.

- **[INFO]** `redact-stored-error.ts` / `.spec.ts` 의 자기-반증형 소정정은 모범 사례
  - 위치: `codebase/backend/src/shared/utils/redact-stored-error.ts:128-135`(`maskIfPresent` JSDoc), `codebase/backend/src/shared/utils/redact-stored-error.spec.ts:294-305`(테스트 주석)
  - 상세: 두 자리 모두 원문을 삭제하지 않고 취소선으로 보존한 채, 반증 날짜(2026-09-03)·반증 근거(엔티티가 DB 상 처음부터 `nullable: true` 였다)·정정된 결론을 나란히 적었다. 특히 `.spec.ts` 쪽은 전 라운드 W1(컬럼 수 오기)·W4(캐스트 불필요 판정)까지 함께 반영해 "왜 캐스트가 필요 없어졌는가" 를 두 축으로 정확히 분리 서술한다. 직접 `row` 헬퍼 정의(`redact-stored-error.spec.ts:245`)를 대조해 "`row` 파라미터가 이미 `Record<string, unknown>` 이라 컬럼 타입이 강제된 적 없다" 는 주장도 실측과 일치함을 확인했다. CLAUDE.md 자기-반증형 소정정 관례에 정확히 부합.

- **[INFO]** `plan/.../entity-nullable-column-type-mismatch.md` 의 §배치 2 수치·전제 정정은 diff 와 일치
  - 위치: `plan/in-progress/entity-nullable-column-type-mismatch.md:176-221`
  - 상세: "혼재 9파일 · 30필드(column 24 · relation 6)" 수치를 9개 엔티티 diff 에서 직접 셈해 대조 — 정확히 일치(execution 10 · knowledge-base 1 · node-execution 5 · node 3 · notification 3 · schedule 1 · trigger 2 · user 3 · workflow 2 = 30, column 24/relation 6 분해도 일치). W1 정정 후 "`NodeExecution.outputData`/`error` 두 컬럼" 서술도 실제 entity diff(`inputData` 는 `nullable: true` 자체가 없어 미포함)와 일치한다. `(d) Schedule.lastRunAt` 이중 표기(W3) 도 이번 diff 에서 후보 목록 쪽에 취소선(`~~**(d)**~~`)이 걸려 정상 해소됐다.
  - 제안: 조치 불요(확인 목적).

- **[INFO]** CHANGELOG 미기재는 선례와 일치 — 결함 아님
  - 위치: `CHANGELOG.md`(변경 없음)
  - 상세: 이번 diff 는 TypeORM 엔티티 TS 타입을 실제 DB `nullable` 상태에 맞추는 내부 정적 타입 정합화이며 런타임 동작·API 응답에 영향이 없다(9개 reviewer 전원 CRITICAL/риск 0 확인 전례, `tsc` 신규 오류 0). `git log --oneline -- CHANGELOG.md` 로 동일 이니셔티브의 배치 1 커밋(`255aa8597`, `7ce4fa92a`)도 `CHANGELOG.md` 를 건드리지 않았음을 직접 확인했다 — 이번 배치 2 도 그 전례와 일관되게 미기재한 것으로 판단, 결함 아님.

## 요약

코드 측(9개 엔티티 + `redact-stored-error.ts`/`.spec.ts`) 문서화는 오래된 주석·JSDoc 불일치 없이 깨끗하고, `redact-stored-error.ts` 의 자기-반증형 소정정은 모범 사례로 확인됐다. 유일한 문제는 이번 diff 에 포함된 `review/code/2026/09/03/16_45_35/RESOLUTION.md` 자체의 정확성이다 — 전전 라운드가 INFO 로 지적한 "신규 H2 헤딩 앞 빈 줄 누락" 을 "W2 정정에 포함됐다" 고 기록했지만, `git blame`/`git show` 로 실측하면 그 fix 커밋은 해당 줄을 전혀 건드리지 않았고 빈 줄은 지금도 없다. 원래 결함 자체는 INFO 급 사소한 포맷 문제이지만, **검증 없이 "고쳤다" 고 기록한 것**은 이 저장소가 반복적으로 데어 온 "실측하지 않은 완료 주장" 클래스와 정확히 같은 모양이라 WARNING 으로 표기한다 — 다음 세션이 이 RESOLUTION 을 근거로 그 자리를 재검증 없이 넘길 위험이 있기 때문이다.

## 위험도

LOW
