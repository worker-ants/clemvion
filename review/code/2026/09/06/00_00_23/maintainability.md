# 유지보수성(Maintainability) 리뷰

## 발견사항

- **[WARNING]** `sanitizeForResponse` 가 4개 축(chatChannel JSONB·notification.signing
  JSONB·interaction JSONB·엔티티 컬럼) + workflow ref 좁히기까지 총 5개 책임을 한 함수에
  모으면서 78줄짜리 단일 private 메서드가 됐고, 중첩 조건문이 3단(`if (cfg) { if
  (cfg.chatChannel) { ... } }`)까지 내려간다.
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts:627-705` (메서드 전체),
    특히 639-683 (config 축 3개가 순차 if-블록으로 나열됨).
  - 상세: 메서드 자신의 JSDoc(611-625행)이 "이 메서드가 두 번 좁게 틀렸다… 세 번 같은
    형태로 좁았다"고 스스로 이력을 적어 둘 만큼 이미 반복적으로 커진 이력이 있고, "다음에
    비밀 축이 하나 더 생기면 목록을 늘리지 말고 선언적 SoT 로 옮길 것"이라는 경고까지
    남겼다. 즉 성장 궤적이 코드 자체에 기록돼 있는데도, 정작 함수 분해는 하지 않고 하나의
    메서드 안에 축마다 `if` 블록을 추가하는 방식으로 대응해 왔다. `omitKeys` 헬퍼가 이미
    추출돼 있어 반복 로직 자체는 DRY 하지만, 4개의 서로 다른 관심사(세 JSONB 축 + 컬럼
    삭제 + workflow 좁히기)를 한 함수가 오케스트레이션까지 겸하고 있어 순환 복잡도가
    높고, 신규 기여자가 "이 함수가 지금 정확히 몇 가지 일을 하는가"를 한눈에 파악하기
    어렵다.
  - 제안: 각 축을 `stripChatChannelSecrets(cfg)` · `stripNotificationSigningSecrets(cfg)` ·
    `stripInteractionSecrets(cfg)` · `narrowWorkflowRef(trigger)` 같은 작은 이름 있는
    함수로 뽑고, `sanitizeForResponse` 는 그것들을 순서대로 호출해 합치는 얇은
    오케스트레이터로 남긴다. RESOLUTION.md 가 "순수 함수 추출은 검증 수단을 바꾸지 않으면서
    diff 만 넓힌다"며 별도 매퍼 파일 추출은 명시적으로 보류했지만, 그것은 "파일 분리" 판단이지
    "같은 파일 안에서 메서드를 쪼갤지"의 판단과는 다르다 — 후자는 이번 라운드에 아직
    검토되지 않은 것으로 보인다.

- **[WARNING]** JSDoc 블록이 대상 테스트에서 떨어져 나가 있다 — 같은 패턴이 이 PR 안에서
  이미 여러 차례(문서 리뷰·RESOLUTION 자체가 "네 번째 재발"이라 기록) 지적된 것과 동일한
  결함이 테스트 파일에도 남아 있다.
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.spec.ts:191-208`
  - 상세: 191-197행 JSDoc("응답 정화 회귀 — e2e 만이 이 결함을 물던 상태였다… fixture 에
    비밀을 채워 그 사각지대를 없앤다")은 내용상 233행 `it('응답에서 회전 secret 컬럼과
    notification.signing 비밀이 제거된다', ...)`과 287행 `it('chat-channel 이 아닌
    트리거도 정화를 거친다 — 조기 return 회귀 방지', ...)`를 설명하는 글인데, 실제로는
    바로 아래(198-206행)의 또 다른 JSDoc과 함께 208행 `it('PATCH 에서 생략된 필드는 로드된
    값을 유지한다', ...)` 바로 위에 붙어 있다. 208행 테스트를 실제로 설명하는 것은
    198-206행 블록뿐이고, 191-197행 블록은 그 자리에서 보면 맥락 없이 붙은 곁다리 주석으로
    읽힌다 — "값 없는 필드를 undefined 로 덮어쓰는 문제"를 읽다가 갑자기 "e2e 만 이 결함을
    물던 상태" 이야기가 끼어드는 형태. RESOLUTION.md(`review/code/2026/09/05/22_24_58`)
    W3가 "`triggers.service.ts` 상수·`response-contract.ts` 함수·가드 스펙 `describe`
    둘"에서 같은 실수(새 선언을 기존 JSDoc과 그 대상 사이에 끼워 넣음)를 이미 4회 재발로
    기록했는데, 이 자리는 그 목록에 없는 다섯 번째 사례다.
  - 제안: 191-197행 블록을 233행 테스트 바로 위로 옮긴다.

- **[INFO]** `SchedulesController.create`/`update` 두 unit 테스트에 동일한 6줄짜리 단언
  블록(`Object.keys(res.trigger).sort()).toEqual([...])` + `not.toHaveProperty` 2회)이
  글자 그대로 반복된다.
  - 위치: `codebase/backend/src/modules/schedules/schedules.controller.spec.ts:72-78`,
    `92-98`
  - 상세: 두 테스트가 "응답 경계가 조인된 트리거를 참조 필드로 좁히는가"라는 같은 불변식을
    검증하고, 주석도 "`create` 와 같은 단언"이라고 스스로 명시한다. 리터럴 중복은 아주
    작고 테스트 가독성/독립성을 위해 남기는 것이 흔한 선택이라 CRITICAL 은 아니지만,
    셋째 소비 경로가 생기면(예: 신규 컨트롤러 액션) 세 번째 복사가 생길 자리다.
  - 제안: `expectNarrowedScheduleTrigger(res.trigger)` 같은 작은 헬퍼로 추출.

- **[INFO]** 조인된 자식 엔티티를 응답 경계에서 좁히는 계층이 모듈마다 다르다 —
  `TriggersService.sanitizeForResponse`(서비스 계층)와
  `SchedulesController.toResponse`(컨트롤러 계층).
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts:627` vs
    `codebase/backend/src/modules/schedules/schedules.controller.ts:67`
  - 상세: 두 곳 모두 "왜 이 계층에서 좁히는가"를 JSDoc에 명시적으로 적어 뒀고(서비스는
    "내부 로직도 같은 값을 소비하므로 반환 타입을 못 좁힌다", 컨트롤러는 "서비스가
    응답 전용이 아니라 내부 로직도 소비하므로 나가는 자리에서 좁힌다") 근거 자체는
    합리적이라 버그는 아니다. 다만 두 문서가 사실상 같은 이유를 대면서도 결론(서비스 vs
    컨트롤러)이 갈려, "이 저장소에서 조인 좁히기는 어느 계층 책임인가"라는 질문에 대한
    단일한 답이 없다. 다음에 비슷한 조인-좁히기가 필요한 세 번째 모듈이 생기면 어느 쪽
    선례를 따를지 판단 비용이 든다.
  - 제안: 조치 불요(둘 다 근거 있는 판단). 다만 세 번째 사례가 생기면 그때 컨벤션을
    `spec/conventions/` 에 명문화할 것을 권고.

## 요약

이번 스윕은 §5.4 응답-계약 검증자를 넓히는 작업이 실제 보안 결함(트리거 회전 secret 유출
2경로)과 DTO 선언 drift(5개 DTO 24필드)를 함께 드러내고 고친, 응집력 있는 변경이다. 각
수정마다 "왜 이 형태인가"·"왜 이전엔 안 잡혔는가"를 상세히 남긴 주석/JSDoc이 전반적인
가독성과 향후 유지보수에 크게 기여하며, `omitKeys` 헬퍼 추출·`contractForDto` 메모이제이션·
`§5.4` 래칫 가드 등 반복을 줄이려는 설계 판단도 대체로 합리적이다. 다만 핵심 정화 로직인
`sanitizeForResponse` 는 반복적으로 성장해 온 이력을 스스로 인정하면서도 여전히 하나의
긴 메서드에 4개 이상의 축을 몰아넣고 있어 순환 복잡도·가독성 면에서 추가 분해가 필요하고,
이 PR이 여러 라운드에 걸쳐 스스로 지적해 온 "JSDoc이 삽입 편집으로 대상에서 떨어져 나가는"
패턴이 테스트 파일에서 다섯 번째로 재발했다. 나머지는 사소한 테스트 중복과, 근거는 있지만
암묵적인 계층 선택 불일치 정도로 전반적 위험은 낮다.

## 위험도

LOW
