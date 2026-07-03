### 발견사항

- **[INFO]** `failFirstSegmentSetupBestEffort` 2차 실패 경로는 프로덕션에서 사실상 도달 불가 — 테스트가 이를 mock 으로 강제 재현
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:497-531` (`failFirstSegmentSetup` 내부 try/catch), `execution-engine.service.spec.ts:2239-2264` (`M-4: failFirstSegmentSetup 2차 실패는 로그로 흡수` 테스트)
  - 상세: `failFirstSegmentSetup` 자체가 이미 내부 try/catch 로 모든 예외를 흡수하고 절대 재throw 하지 않는다(`markErr` 는 로그만). 따라서 `failFirstSegmentSetupBestEffort` 의 외부 `.catch()` 는 실제 코드 경로에서는 트리거될 수 없고, 테스트는 `jest.spyOn(svc, 'failFirstSegmentSetup').mockRejectedValueOnce(...)` 로 인위적으로 reject 시켜야만 이 분기를 커버한다. Mock 이 실제 동작(항상 resolve)과 괴리된 시나리오를 검증하는 셈이라, 이 테스트는 "안전망이 실제로 작동하는지"보다는 "코드가 문서화된 계약대로 작성됐는지" 를 확인하는 방어적 회귀 테스트에 가깝다.
  - 제안: 이미 RESOLUTION.md 의 INFO(`requirement/concurrency`)에 동일 사실이 기록돼 있어 신규 이슈는 아니다. 다만 테스트 주석에 "이 경로는 현재 프로덕션에서 도달 불가하며, 테스트는 계약(향후 `failFirstSegmentSetup` 구현이 재throw 하도록 바뀌어도 안전)을 검증하는 안전망" 이라는 점을 한 줄 추가하면 이후 리뷰어가 "왜 도달 불가 경로를 mock 으로 테스트하나" 를 재발견하는 것을 방지할 수 있다. 액션 아님, 참고용.

- **[INFO]** `failFirstSegmentSetupBestEffort` 헬퍼 자체를 직접 대상으로 하는 단위 테스트 부재 (간접 커버만 존재)
  - 위치: `execution-engine.service.ts:541-556` (헬퍼), 테스트는 `executeAsync`(M-4 신규 2건)와 `runExecutionFromQueue`(W5/W7 기존 2건) 두 진입점을 통해서만 간접 검증
  - 상세: private 메서드이므로 직접 호출 테스트는 TS 캐스팅이 필요해 두 호출부를 통한 간접 테스트가 합리적인 선택이다. 현재 4개 테스트(M-4 2건 + W5/W7 2건)가 동일 헬퍼의 "정상 마감"·"2차 실패 흡수" 두 분기를 각 진입점에서 반복 검증하고 있어 실질적으로 헬퍼 로직은 충분히 커버된다.
  - 제안: 조치 불요. 헬퍼 추출 전/후 로그 문구·호출 시그니처가 동일하게 유지됐고 회귀 테스트(W5/W7)가 그대로 통과하는 것으로 실질적 검증은 충분.

- **[INFO]** M-4 신규 테스트 2건의 mock 캐스팅 패턴(`as unknown as M4AsyncFailSubject`)이 기존 W5/W7 패턴과 정확히 대칭
  - 위치: `execution-engine.service.spec.ts:2202-2264` vs `:15221-15254`, `:15323-15359`
  - 상세: `spyOn(svc, 'runExecution')`/`spyOn(svc, 'failFirstSegmentSetup')` 조합, `setImmediate` flush, `mockRestore()` 순서까지 W5/W7 테스트와 동일 관용구를 사용해 가독성·일관성이 높다. 각 테스트가 독립적으로 spy 를 생성·복원(`mockRestore()`)하므로 테스트 간 격리도 양호.
  - 제안: 없음. 참고로 좋은 패턴 재사용 사례.

### 요약

이번 diff 는 큐 경로(`runExecutionFromQueue`)에서 이미 검증된 `failFirstSegmentSetup` best-effort 마감 + 2차 실패 로그 흡수 패턴을 `failFirstSegmentSetupBestEffort` private 헬퍼로 추출해 `executeAsync`(sub-workflow fire-and-forget) 경로에 대칭 이식한 것이다. 신규 M-4 테스트 2건(`setup throw → best-effort 마감`, `2차 실패 → 로그 흡수`)이 W5/W7 기존 테스트와 동일한 spy/mock 관용구로 정확히 미러링돼 있고, 실행 결과 8개 테스트(M-4 신규 2 + W5/W7 회귀 2 등 관련 스펙) 전부 PASS 를 직접 확인했다. 헬퍼 추출 후에도 로그 문구·호출 시그니처가 불변이라 기존 W5/W7 테스트가 수정 없이 통과하는 것으로 회귀 안전성이 실증됐다. `failFirstSegmentSetup` 내부 try/catch 가 이미 모든 예외를 흡수해 재throw 하지 않으므로 헬퍼의 외부 `.catch()` 분기(및 이를 검증하는 테스트)는 프로덕션에서 사실상 도달 불가한 방어적 안전망이라는 점이 있으나, 이는 이미 RESOLUTION.md 에 INFO 로 기록된 기지 사실이며 mock 이 그 계약을 정확히 반영해 작성됐으므로 문제로 재분류하지 않는다. 테스트 격리·가독성·회귀 커버리지 모두 양호하며 추가 액션이 필요한 CRITICAL/WARNING 은 없다.

### 위험도
NONE
