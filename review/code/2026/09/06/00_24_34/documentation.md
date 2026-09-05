# 문서화(Documentation) 리뷰

## 발견사항

- **[WARNING]** `CHANGELOG.md` 가 "첫 판의 실수"를 실제보다 넓게 일반화해 서술한다 — 23개 필드
  전부가 §5.4 금지 조합으로 선언됐다고 읽히지만, 실제로는 17개만 그 조합이고 6개는 다른
  축의 결함이었다.
  - 위치: `CHANGELOG.md:76-81` (`### 같은 조합이 조용히 넓어지지 못하게 래칫을 세웠다` 절,
    "이 커밋의 **첫 판이 정확히 그 실수를 했다.** 위 필드들을 `@ApiPropertyOptional({ nullable:
    true })` + `field?: T | null` 로 선언했는데..." 문장)
  - 상세: 바로 위 §의 표(`CHANGELOG.md:63-69`)는 5개 DTO에 걸쳐 23개 필드를 나열한다. 이어지는
    문장은 "위 필드들"(즉 23개 전부)이 첫 판에서 `@ApiPropertyOptional({ nullable: true })` +
    `field?: T | null` 조합으로 선언됐다고 말한다. 그러나 첫 판 커밋(`dfb2664af9`)을
    `git show`로 직접 확인하면 `IntegrationDto.consecutiveNetworkFailures`
    (`@ApiPropertyOptional({ example: 0 })` + `consecutiveNetworkFailures?: number` — `nullable`
    옵션도 `| null` 타입도 없음), `KnowledgeBaseDto.documentCount`/`rerankMode`/
    `rerankCandidateK`, `TriggerDto.chatChannelHealth`/`notificationHealth` 6개는 `nullable:
    true`도 `| null` 타입도 쓰지 않은, §5.4의 **다른 축**(상시 존재인데 optional로 과소
    선언)이었다. 정확히 17개(23−6)만 서술된 그 조합이다. 이 정확한 분리는 같은 PR의
    `plan/in-progress/spec-draft-nullable-notation-followups.md:456-458`에 "17개가 §5.4 금지
    조합이었고, 나머지 6개는 별개 축의 과소 선언이었다. 같은 세션의 두 리뷰가 그 둘을 이미
    갈라 놓았는데 이 자리에서 합산해 적었다(`review/code/2026/09/05/22_48_39` W5)"로 이미
    명시적으로 기록돼 있다 — 즉 이 conflation은 이 PR 스스로 한 번 지적받아 plan 트래커에서는
    정정됐는데, 공개 기록인 CHANGELOG 본문에는 그 정정이 반영되지 않아 두 문서가 서로 다른
    말을 하게 됐다.
  - 제안: `CHANGELOG.md`의 해당 문장을 plan 트래커와 같은 수준으로 분리한다 — 예: "위 23개 중
    17개는 `@ApiPropertyOptional({ nullable: true })` + `field?: T | null` (§5.4 금지 조합)로,
    나머지 6개(`documentCount`·`rerankMode`·`rerankCandidateK`·`chatChannelHealth`·
    `notificationHealth`·`consecutiveNetworkFailures`)는 상시 존재 필드를 `@ApiPropertyOptional`
    로 과소 선언한 별개 축이었다."

- **[WARNING]** `schedules.service.ts`의 새 인라인 주석이 `registerJob`과의 인과관계를
  실제 구현과 다르게 서술한다 — `registerJob`은 `trigger`를 전혀 읽지 않는다.
  - 위치: `codebase/backend/src/modules/schedules/schedules.service.ts:198-199`
    ("종전에는 이 대입이 아래 `if (isActive)` 안에 있어서(`registerJob` 이 필요로 하므로),
    `isActive: false` 로 만들면...")
  - 상세: 이 주석은 `saved.trigger = savedTrigger`가 과거 `if (isActive)` 블록 안에 있었던
    이유로 "`registerJob`이 그것을 필요로 해서"를 든다. 그러나
    `ScheduleRunnerService.registerJob(schedule: Schedule)`
    (`codebase/backend/src/modules/schedules/schedule-runner.service.ts:262-277`)의 구현을
    확인하면 `schedule.id`·`schedule.cronExpression`·`schedule.timezone`·
    `schedule.workspaceId` 4개 필드만 읽고 `schedule.trigger`는 전혀 참조하지 않는다.
    `git log -p`로 이 메서드가 최초 도입된 커밋까지 추적해도 `trigger` 관계를 사용한 적이
    없다. 즉 `saved.trigger = savedTrigger`가 `if (isActive)` 안에 있었던 것은 코드 근접
    배치(같은 블록에서 `saved`를 다루다 보니)의 결과일 뿐, `registerJob`의 기능적 요구사항이
    아니다. 이 인과 주장은 검증 없이 쓰인 설계 근거로, 다음에 이 코드를 읽는 사람이
    "`registerJob`은 `trigger`가 로드돼 있어야 한다"는 잘못된 제약을 전제하게 만들 수 있다.
    (`update()` 쪽의 대응 주석 `:260-262`는 같은 인과 주장을 반복하지 않아 이 문제가 없다.)
  - 제안: "`registerJob`이 필요로 하므로" 구절을 삭제하거나, 실제 근거로 교체한다 — 예:
    "종전에는 이 대입이 `registerJob` 호출 직전에 함께 있었을 뿐 그 호출이 `trigger`를
    쓰는 것은 아니다. 단지 같은 `if (isActive)` 블록 안에 있었기 때문에 `isActive: false`
    분기에서는 실행되지 않았다."

## 요약

이번 diff(§5.4 응답-계약 검증자를 4→18개 DTO·14개 e2e로 넓히는 스윕 + 트리거 회전 secret
유출 수정)는 문서화 수준이 전반적으로 매우 높다 — 신설 함수·상수마다 "왜 이 형태인가"·
"이전에 무엇이 틀렸는가"·"어느 검증자가 무엇을 못 보는가"를 실측·리뷰 인용과 함께 적어
두었고(`response-contract.ts`의 `contractForDto` 메모이제이션, `swagger-dto-contract-guard.ts`의
신설 3번째 축, `TriggersService.sanitizeForResponse`의 4축 분해, `SchedulesController.toResponse`
등), 이전 라운드가 지적한 stale 주석·JSDoc 분리 문제들도 이번 diff에서는 재발하지 않았다.
다만 두 군데에서 새로 쓰인 서술이 실제 근거보다 부정확하다 — (1) `CHANGELOG.md`가 "첫 판의
실수"를 23개 필드 전체로 뭉뚱그렸는데, 같은 PR의 plan 트래커는 이미 17개/6개로 정확히 갈라
놓았고 그 분리 자체가 이전 라운드의 지적(W5)으로 확정된 사실이라 CHANGELOG만 뒤처져 있다.
(2) `schedules.service.ts`의 새 주석이 `registerJob`의 실제 구현과 맞지 않는 인과관계
("registerJob이 trigger를 필요로 한다")를 근거로 든다 — 코드를 직접 확인하면 그 함수는
`trigger`를 전혀 읽지 않는다. 둘 다 동작에는 영향이 없는 순수 문서화 결함이지만, 반증
가능한 주장을 검증 없이 적었다는 점에서 다음 사람의 판단 기준을 오도할 수 있다. README·
API 문서·CHANGELOG 형식 자체의 구조적 누락은 없고, 새 공개 옵션(`allowMissing`)과 신설
가드 축은 JSDoc에 사용 예시까지 포함해 충분히 문서화됐다.

## 위험도

LOW
