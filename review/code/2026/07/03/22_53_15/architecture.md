### 발견사항

- **[INFO]** DRY 추출 자체는 SRP/응집도 관점에서 긍정적
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:541-556` (`failFirstSegmentSetupBestEffort`), 호출부 `:2872`, `:3409`
  - 상세: "best-effort 마감 호출 + 2차 실패 로그 흡수"라는 하나의 정책(policy)을 캡슐화해 `runExecutionFromQueue`(큐 경로)와 `executeAsync`(fire-and-forget sub-workflow 경로) 두 진입점이 동일 헬퍼에 위임한다. 이전(W7) 상태는 큐 경로에만 인라인으로 존재해 이번 diff가 그대로 복제했다면 로직 중복이 발생했을 것 — RESOLUTION.md 기록대로 WARNING을 받고 헬퍼로 추출한 이력이 diff에 반영되어 있다. 두 호출자 모두 "무엇을 실패로 볼지"에 대한 판단(에러 포맷팅, 로그 문구)을 헬퍼에 위임하고 자신은 "언제 호출할지"만 결정 — 관심사 분리가 적절하다.
  - 제안: 없음. 현재 형태 유지 권장.

- **[INFO]** 예외 흡수 계층이 3중(triple nested)으로 깊어짐 — 의도된 설계이나 향후 4번째 진입점 추가 시 재확인 필요
  - 위치: `runExecution`(자체 내부 catch) → `executeAsync`/`runExecutionFromQueue`의 `.catch` → `failFirstSegmentSetupBestEffort` → `failFirstSegmentSetup` 내부 try/catch (`:497-531`)
  - 상세: 계층마다 "이 레벨에서 잡지 못하면 어떤 상위 컨텍스트로 전파되는가"에 따라 흡수 필요성이 다르다(BullMQ worker 재시도 유발 vs unhandled rejection). 현재는 문서화가 잘 되어 있고(주석에 double-exec/재시도 경로 명시), 실제로 `failFirstSegmentSetup` 내부 try/catch가 이미 모든 에러를 삼키므로 외부 `.catch`가 프로덕션에서 도달할 일은 거의 없다는 점도 SUMMARY.md INFO #3에서 인지되어 있다. 방어적 중복(defense-in-depth)으로는 합리적이나, 계층이 하나 더 늘어나면(예: 3번째 fire-and-forget 진입점) "같은 안전망을 몇 겹 쌓았는지" 추적이 어려워질 수 있다.
  - 제안: 현 시점 조치 불요. 향후 진입점이 3개를 넘으면 (예: park 재개, retry 워커 등) 이 계약을 `docs`/spec 수준으로 한 번 정리해 "fire-and-forget 진입점은 반드시 `failFirstSegmentSetupBestEffort`를 catch 핸들러 마지막에 호출해야 한다"는 규약을 명시하는 것을 고려.

- **[INFO]** `executeAsync`와 `runExecutionFromQueue`의 비대칭 처리(`releaseExecutionRouting` 유무)가 주석으로만 문서화되어 있고 타입/구조로 강제되지 않음
  - 위치: `:2868`(큐 경로 `releaseExecutionRouting` 호출) vs `:3396-3409`(`executeAsync`, 미호출 — 주석 "sub-workflow 는 execution routing 미등록이라 불필요")
  - 상세: 두 catch 블록이 공유 헬퍼(`failFirstSegmentSetupBestEffort`)를 쓰면서도 헬퍼 호출 전 단계에서 서로 다른 부수 로직(routing 해제)을 갖는다. 이는 리스코프 치환 관점의 문제라기보다, "공유 정책 vs 개별 정책"의 경계를 헬퍼가 정확히 그은 것으로 판단된다 — 헬퍼는 오직 공통분모(마킹+로그 흡수)만 캡슐화하고, 호출자별 차이(routing)는 각자 유지한다. 설계는 적절하지만 이 비대칭이 향후 신규 기여자에게 "왜 한쪽만 releaseExecutionRouting을 호출하나"라는 의문을 남길 수 있다.
  - 제안: 현행 인라인 주석으로 충분. 별도 조치 불요.

- **[INFO]** `ExecutionEngineService`가 7,000줄을 넘는 단일 클래스(god-service)로 남아있다는 기존 구조적 부채의 연장
  - 위치: `execution-engine.service.ts` 전체 (7,089줄, private/public 멤버 100개 이상)
  - 상세: 이번 diff는 기존 god-service 내부에 헬퍼 하나를 추가한 것으로, 클래스 자체의 SRP 위반 문제를 확대하지도 축소하지도 않는다. 이 이슈는 이미 refactor 백로그(02-architecture C-1 엔진분할, PR #622-627)에서 별도로 다뤄지고 있으며 M-4는 그 범위 밖이다.
  - 제안: 범위 밖 — 별도 트랙(02-architecture C-1 계열)에서 지속 관리. 이번 변경에 대한 조치 불필요.

### 요약

이번 변경(M-4, Option B)은 이미 검증된 "fire-and-forget catch → best-effort terminal 마감 + 2차 실패 로그 흡수" 패턴을 큐 경로에서 sub-workflow 경로로 대칭 이식하면서, 애초 두 진입점에 중복 코딩될 뻔한 로직을 `failFirstSegmentSetupBestEffort` private 헬퍼로 추출해 DRY를 확보했다(RESOLUTION.md 근거). 헬퍼는 "언제 호출하는가"(호출자 책임)와 "실패를 어떻게 흡수하는가"(헬퍼 책임)를 명확히 분리하고, 호출자별 차이(routing 해제 유무)는 헬퍼 밖에 남겨 과도한 일반화를 피했다 — 적절한 추상화 수준이다. 순환 의존성이나 레이어 경계 위반은 없으며, 3중 예외 흡수 계층은 의도된 방어적 설계로 문서화가 양호하다. 유일한 구조적 잔여 이슈는 `ExecutionEngineService` 자체의 비대함이나 이는 이번 diff의 책임 범위 밖이며 별도 리팩토링 트랙에서 다뤄지고 있다.

### 위험도
NONE
