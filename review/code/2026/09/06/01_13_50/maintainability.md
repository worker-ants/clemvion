# 유지보수성(Maintainability) 리뷰

## 발견사항

- **[INFO]** 트리거 응답 정화 로직이 여전히 **수기 deny-list 4벌**로 나뉘어 있다 — 이미 세 라운드 연속 "한 축을 빠뜨렸다"가 반복된 패턴.
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts:53`(`CHAT_CHANNEL_RESPONSE_STRIP_KEYS`), `:74`(`NOTIFICATION_SIGNING_STRIP_KEYS`), `:94`(`TRIGGER_RESPONSE_STRIP_COLUMNS`), `:114`(`INTERACTION_RESPONSE_STRIP_KEYS`)
  - 상세: 네 개의 독립된 `Set`/배열 상수가 각각 JSONB 두 축, `config.interaction`, 엔티티 컬럼 축을 담당한다. JSDoc(`sanitizeForResponse` 위, `:650`~`:690` 부근)이 스스로 "세 번 같은 형태로 좁았다"고 자백하고 있고, `plan/in-progress/spec-draft-nullable-notation-followups.md`에 "deny-list 4벌 → 선언적 SoT" 항목이 이미 등재돼 있다. 즉 이 결함은 **알려져 있고 유예된 것**이라 새로 지적할 사안은 아니지만, 다음 축이 생기면 또 같은 실패 모드가 재발할 구조라는 점은 리뷰 기록에 남긴다.
  - 제안: 조치 불요(이미 유예 근거·후속 항목 존재). 다음에 다섯 번째 축이 생기면 목록 확장 대신 `plan`에 적힌 대로 선언적 SoT(`@Sensitive()` 데코레이터 등)로 전환할 것.

- **[INFO]** §5.4 금지-조합 래칫이 **두 개의 부분·전체 목록**으로 나뉘어 있어 한쪽만 상환하면 다른 쪽이 조용히 낡는다.
  - 위치: `codebase/backend/src/repo-guards/__tests__/swagger-dto-contract.spec.ts`의 `EXPECTED_OPTIONAL_NULLABLE_DRIFT`(78건 하드코딩 배열) vs `codebase/backend/src/modules/executions/dto/responses/execution-response.dto.spec.ts:72`의 `OPTIONAL_NULLABLE_DRIFT`(`ExecutionDto` 10건, 부분집합)
  - 상세: 두 목록 모두 자기 자신의 JSDoc(`execution-response.dto.spec.ts:59-71`)에서 "한쪽만 상환하면 다른 쪽이 낡는다"고 명시하고 있어 인지된 트레이드오프다. 다만 이는 실질적으로 **동일한 사실을 두 곳에서 유지보수**해야 하는 구조이며, `ExecutionDto` 필드가 바뀔 때마다 두 파일을 동시에 고쳐야 한다는 부담이 실재한다.
  - 제안: 조치 불요(문서화된 트레이드오프). 세 번째 부분 래칫이 생기면 그때는 파생 방식(전수 목록에서 파일별 필터링)으로 전환을 검토할 만하다.

- **[INFO]** `SchedulesController.toResponse`에서 `schedule.trigger`를 가리키는 변수명이 `t` 한 글자다.
  - 위치: `codebase/backend/src/modules/schedules/schedules.controller.ts:72`(`const t = schedule.trigger;`)
  - 상세: 메서드 나머지 부분에서 `t.id`, `t.name`, `t.workflowId`, `t.workflow` 등으로 여러 번 참조되는데 한 글자 이름이라 가독성이 살짝 떨어진다. 다만 주변 JSDoc이 매우 상세해서 문맥 파악에는 지장이 없고, `triggers.service.ts`의 `cfg`, `wf` 등 같은 파일군에서 이미 쓰이는 짧은 이름 컨벤션과 결이 같다.
  - 제안: 선택 사항. `trigger`로 바꾸면 조금 더 명확해지지만 강제할 정도는 아니다.

- **[INFO]** 신규 unit 테스트가 같은 예외 상황을 만들기 위해 `controller.update`를 두 번 호출한다.
  - 위치: `codebase/backend/src/modules/schedules/schedules.controller.spec.ts:103-129` (`it('trigger 미로드 행은 던지되 응답에 진단을 싣지 않는다', ...)`)
  - 상세: 첫 번째 호출은 `.rejects.toMatchObject(...)`로, 두 번째 호출은 `.catch((err) => { thrown = err; })`로 같은 입력에 대해 컨트롤러를 다시 부른다. 동일 로직을 두 번 실행하는 것은 (a) 테스트 실행 시간을 불필요하게 늘리고 (b) `this.logger.error(...)` 같은 부수효과가 있는 경로라면 로그가 두 번 남는다는 점에서 약간의 낭비다. 기능적으로는 문제없다(멱등적인 순수 예외 경로).
  - 제안: 한 번의 `try/catch` 또는 `await controller.update(...).catch(err => err)`로 잡은 뒤 `toMatchObject`와 `JSON.stringify` 단언을 같은 변수에 대해 수행하면 중복 호출을 없앨 수 있다.

- **[INFO]** `ScheduleTriggerWorkflowRefDto`(`name`만)와 `TriggerWorkflowRefDto`(`id`+`name`)가 이름이 접두어 하나만 다른 채 나란히 존재한다.
  - 위치: `codebase/backend/src/modules/schedules/dto/responses/schedule-response.dto.ts:20`, `codebase/backend/src/modules/triggers/dto/responses/trigger-response.dto.ts:23`
  - 상세: 두 타입은 겉보기엔 "워크플로우 참조 DTO"로 통합하고 싶은 유혹이 들 만큼 이름이 비슷하지만, 필드 구성이 실제로 다르고(소비처가 다른 필드를 읽음) 각 파일에 "한쪽을 다른 쪽으로 갈아 끼우지 말 것"이라는 명시적 경고 주석이 있다. 향후 리팩터링 시도가 이 둘을 통합하면 회귀가 날 수 있다는 점을 리뷰 기록으로 남긴다.
  - 제안: 조치 불요 — 의도된 분리이고 이미 경고 주석이 있다.

## 요약

응답-계약 검증자 배선(§5.4)을 4→18개 DTO로 넓히는 스윕과, 그 과정에서 드러난 트리거 회전 secret 유출(엔티티 컬럼 미스트립 + 스케줄 조인을 통한 2차 유출) 수정이 핵심이다. 실제 프로덕션 코드 변경분(`triggers.service.ts`의 `sanitizeForResponse`, `schedules.controller.ts`의 `toResponse`, `schedules.service.ts`의 트리거 대입 위치 이동)은 모두 함수 단위로 잘 쪼개져 있고 순수 헬퍼(`omitKeys`/`stripChatChannelSecrets`/`stripInteractionSecrets`/`stripNotificationSigningSecrets`/`deleteSecretColumns`/`narrowWorkflowRef`)로 책임을 분리해 두어, 오케스트레이터 함수(`sanitizeForResponse`, `toResponse`) 자체의 순환 복잡도는 낮다. 나머지 대부분의 diff(30여 개 e2e 스펙에 `assertMatchesContract`/`contractForDto` 두 줄 추가, DTO에 필드 선언 추가, `response-contract.ts`의 `allowMissing` 옵션과 `contractForDto` 메모이제이션)는 반복적이지만 기계적이고 각 자리마다 "왜"를 설명하는 주석이 충실하다. 이 브랜치는 이미 10여 라운드의 리뷰·수정을 거쳤고, 그 과정에서 나온 실질적 유지보수성 결함(78-line 단일 메서드, JSDoc 위치 어긋남, 조기 return, deny-list 누락 등)은 이번 diff 시점에는 대부분 리팩터·수정이 끝난 상태로 확인된다. 새로 지적할 만한 항목은 모두 이미 문서화·유예된 기존 부채(deny-list 4벌, 78건/10건 이중 래칫)의 재확인 수준이거나 사소한 스타일 흠(테스트 중복 호출, 한 글자 변수명)에 그친다. `review/**`·`plan/**`에 함께 커밋된 다수의 과거 리뷰 산출물(마크다운 200여 개)은 프로세스 기록이라 코드 유지보수성 평가 범위 밖으로 보았다.

## 위험도
LOW
