# 유지보수성(Maintainability) Review — priority 3-tier (triggerType threading)

## 검토 대상 요약

`ExecuteOptions.triggerType` 필드 신설 + `execute()` 의 priority 계산 로직을 2-tier(manual/webhook)에서
3-tier(manual/webhook/schedule)로 확장. 호출부 3곳(`hooks.service.ts` webhook·chat-channel, `schedule-runner.service.ts`)에
`triggerType` 리터럴 전달, 테스트 갱신, plan/review 문서 갱신 포함. 실질 로직 변경은
`execution-engine.service.ts` 의 `triggerType` 판별 3줄과 타입 유니온에 필드 1개 추가가 전부이고,
나머지는 호출부 리터럴 전달 + 테스트 + 문서.

## 발견사항

- **[WARNING]** 인라인 주석이 diff 편집으로 인해 문장이 끊겨 앞뒤가 맞지 않음 (병합 잔여물)
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` 약 3243-3245번째 줄
    (`await this.executionRunQueue.add(...)` 바로 위 주석 블록)
  - 상세: 기존 주석은 다음과 같이 한 문장으로 이어졌었다 — `"priority: 수동 실행(executedBy)을
    트리거 실행보다 앞세운다(§4.3). webhook\n//    vs schedule 의 세부 3-tier 구분은 ExecuteOptions 가
    trigger type 을 싣지 않아 후속(triggerType threading)으로 미룬다 — 현재는 manual > 그 외."`.
    이번 diff 는 두 번째 줄부터를 새 3-tier 설명으로 교체했지만, 첫 줄
    `"priority: 수동 실행(executedBy)을 트리거 실행보다 앞세운다(§4.3). webhook"` 은 그대로 남아 있다.
    그 결과 현재 코드에는 "webhook" 이라는 단어로 갑자기 끊기는 문장 조각 바로 다음 줄에
    `"3-tier(§4.3): **executedBy 우선** — ..."` 로 시작하는 새 문단이 이어져, 읽는 사람이 "webhook"
    뒤에 무엇이 생략됐는지, 두 문단이 어떻게 연결되는지 파악하기 어렵다. 새 주석 자체(3-tier 설명)는
    명확하고 정확하지만, 선행 잔여 조각 때문에 전체 블록의 가독성이 떨어진다.
  - 제안: 첫 줄의 dangling 조각(`priority: 수동 실행(executedBy)을 트리거 실행보다 앞세운다(§4.3). webhook`)을
    제거하거나 새 3-tier 설명 문단에 자연스럽게 흡수시켜 하나의 일관된 주석으로 정리. 예:
    ```
    //    priority — 3-tier(§4.3): **executedBy 우선** — 수동 실행(schedule "지금 실행" runNow 포함)은
    //    `manual`. 트리거 발화(triggerId)는 호출부가 전달한 `options.triggerType`
    //    (`Trigger.type`: webhook/schedule)을 쓰고, 미전달 시 `webhook` fallback(비-HTTP
    //    트리거 방어). `manual`(1) > `webhook`(2) > `schedule`(3).
    ```

- **[INFO]** `triggerType`(priority 계산 입력, 3-way) vs 기존 `triggerSource`(실행 이력 표시 파생 필드, 5-way)
  간 이름 유사도로 인한 향후 혼동 가능성
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` `ExecuteOptions`
    의 `triggerId` variant (`triggerType?: ExecutionRunTriggerType;` 필드 및 인접 JSDoc)
  - 상세: 이미 JSDoc 에 "`Execution.triggerSource`(5-way)와 다른 별개 필드" 라는 명시적 구분 주석이
    붙어 있어 즉시 위험하지는 않다(consistency-check convention_compliance 검토에서도 동일 지적,
    INFO 처리됨). 다만 접미사 `-Type` / `-Source` 만으로 구분되는 두 필드가 같은 파일·같은 도메인
    (트리거 메타데이터)에 공존하므로, 향후 이 JSDoc 주석이 리팩터링 중 유실되면 재발 혼동 소지가
    남는다. 이미 다른 리뷰 경로(consistency-check)에서 다뤄진 사안이라 여기서는 참고 표기만 한다.
  - 제안: 별도 조치 불요(이미 JSDoc 로 완화됨). 향후 필드 근처 코드를 손댈 때 JSDoc 구분 주석이
    함께 유지되는지만 확인.

- **[INFO]** 판별 유니온(discriminated union) 세 분기 모두에 `triggerType` optional-never 필드를 반복
  선언 — 사소한 반복이나 타입 안전성과 의도적으로 맞바꾼 패턴
  - 위치: `ExecuteOptions` 의 세 variant 전부(`executedBy` variant, `triggerId` variant, 빈 variant)에
    `triggerType?: never` 또는 `triggerType?: ExecutionRunTriggerType` 필드가 각각 등장
  - 상세: 세 갈래 모두 `triggerId?: never`/`triggerId: string`/`triggerId?: never` 패턴을 이미 따르고
    있었으므로, `triggerType` 을 같은 판별 유니온 컨벤션으로 추가한 것은 기존 스타일과 일관된다.
    코드 중복이라기보다 TypeScript 판별 유니온에서 상호 배타 필드를 표현하는 정석 패턴이라 문제
    삼을 정도는 아니다.
  - 제안: 조치 불요 — 기존 컨벤션(§`executedBy`/`triggerId` 배타 패턴) 그대로 확장한 것으로 일관성 있음.

- **[INFO]** 테스트 신규 케이스의 이름에 PR 번호가 하드코딩됨
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts` 3021번째 줄
    `it('triggerType threading — manual>webhook>schedule 3-tier + fallback (PR2)', ...)`
  - 상세: 테스트 설명에 `(PR2)` 라는 구현 단계 식별자가 박혀 있다. 기능 자체를 설명하는 이름
    (`triggerType threading — manual>webhook>schedule 3-tier + fallback`)만으로 충분히 명확하고,
    PR 번호는 시간이 지나면 의미를 잃는 메타데이터다. 같은 파일의 다른 테스트들은 PR 번호를
    이름에 넣지 않는 관례를 따르고 있어 이 건만 약간 어긋난다(사소한 일관성 편차).
  - 제안: 급하지 않음 — 굳이 정정한다면 `(PR2)` 접미사를 제거하고 커밋 메시지/PR 설명에서만 추적.

## 요약

이번 변경은 순수 스코프의 리팩터링/확장으로, 실질 로직은 `execute()` 내부 3줄짜리 3항 연산자와
타입 유니온 필드 1개 추가에 그친다. 가독성·네이밍·함수 길이·중첩·복잡도 모두 문제없고, 판별
유니온을 이용한 상호 배타 필드 확장은 기존 컨벤션과 일관된다. 유일하게 실질적인 지적사항은
`execution-engine.service.ts` 의 priority 주석 블록에서 diff 편집이 이전 주석 문장을 절반만
교체해 문장이 중간에 끊기는 병합 잔여물(readability regression)을 남긴 점이며, 이는 간단한
주석 정리로 해결 가능한 WARNING 수준이다. 나머지는 이미 JSDoc 로 완화된 네이밍 유사성 관찰과
테스트명의 PR 번호 하드코딩 같은 사소한 INFO 뿐이다.

## 위험도
LOW

STATUS: SUCCESS
