# 유지보수성(Maintainability) 리뷰

## 발견사항

### 파일 1: interaction.guard.spec.ts

- **[INFO]** 새 테스트 케이스의 구조가 기존 케이스와 일관됨
  - 위치: 라인 56–74 (추가된 diff 블록)
  - 상세: `makeGuard` + `makeContext` 팩토리 함수 재사용 패턴이 파일 전체에서 일관되게 적용되어 있으며, 새 케이스도 같은 패턴을 따른다. 테스트 설명(it 문자열)도 "family — 조건 → 기대결과 [spec ref]" 형식을 유지.
  - 제안: 이대로 유지.

- **[INFO]** `ctx as never` 타입 캐스팅이 파일 전체에 걸쳐 반복됨
  - 위치: 전체 파일 다수 위치 (라인 66, 138, 146, 161, 177, 197, 214, 247, 268, 286, 312, 325, 340)
  - 상세: 기존 코드 패턴과 완전히 일치하므로 신규 추가 케이스가 일관성을 깨지 않았다. 단, `ExecutionContext`를 위한 최소 타입 헬퍼를 별도 정의하면 `as never` 남용 없이 타입 안전성이 높아질 수 있다. 이는 이번 변경과 무관한 기존 부채이다.
  - 제안: 이번 변경 범위 밖. 추후 테스트 유틸 리팩터 시 `makeContext` 반환 타입에 `ExecutionContext` 부분 구현을 명시하는 방향 검토.

- **[INFO]** 토큰 값 `'Bearer iext_revoked'`는 의도가 명확한 픽스처 문자열
  - 위치: 라인 64
  - 상세: `iext_revoked` 는 "revoke된 토큰"임을 나타내는 테스트 픽스처 명칭으로 가독성이 높다. 매직 스트링 아님.
  - 제안: 이대로 유지.

---

### 파일 2: notification-fanout.service.spec.ts (신규 파일)

- **[INFO]** 파일 레벨 JSDoc이 테스트 목적과 핵심 invariant를 명확히 설명
  - 위치: 라인 3–10 (파일 상단 블록 주석)
  - 상세: 어떤 규칙을 검증하는지, 왜 그 검증이 필요한지가 주석으로 명시되어 있어 향후 유지보수 시 context를 읽지 않아도 의도 파악 가능.
  - 제안: 이대로 유지.

- **[INFO]** `invoke` 헬퍼의 private 메서드 강제 접근 캐스팅은 유지보수 부채가 될 수 있음
  - 위치: 라인 440–446
  - 상세: `fanout as unknown as { handle: ... }` 로 private `handle()` 메서드를 직접 호출한다. 이는 주석에 "결정적 테스트"의 이유로 명시되어 있으나, 구현에서 메서드 이름이나 시그니처가 변경될 경우 컴파일 에러 없이 런타임에서만 실패한다. TypeScript 안전망이 없는 구간.
  - 제안: 허용 가능한 트레이드오프이나, 향후 `handle`을 `protected` 또는 `@VisibleForTesting` 패턴으로 노출하면 캐스팅 없이 타입 안전하게 접근 가능. 이번 변경 범위에서 즉각 수정보다는 기술 부채로 기록.

- **[INFO]** `makeFanout`의 기본값 처리가 간결하고 일관됨
  - 위치: 라인 400–424
  - 상세: `deps.dispatcher ?? { enqueue: jest.fn() }` 패턴으로 선택적 의존성을 처리. `makeGuard`와 동일한 관용구를 사용해 두 파일 간 스타일 일관성이 높다.
  - 제안: 이대로 유지.

- **[INFO]** `event()` 헬퍼의 `executionId`가 항상 `'exec-1'`로 고정
  - 위치: 라인 426–436
  - 상세: 모든 테스트가 동일한 executionId를 사용하므로 하드코딩이 문제가 되지 않는다. 단, 복수 execution 간 격리 검증이 필요한 케이스가 생기면 파라미터화가 필요해진다. 현재 테스트 목적 내에서는 적절.
  - 제안: 이대로 유지. 향후 케이스 확장 시 `executionId` 파라미터 옵션 추가 고려.

- **[WARNING]** `describe` 블록이 단일 그룹으로만 구성됨 — 케이스 분류 구조 부재
  - 위치: 라인 448–542
  - 상세: 7개 케이스가 단일 `describe` 아래 나열되어 있다. "terminal revoke 게이트" vs "notification enqueue 게이트" vs "triggerId 없는 manual 실행" 등의 하위 그룹이 암묵적으로 존재하지만 중첩 `describe`로 분리되어 있지 않다. 케이스가 늘어날 경우 탐색 비용이 증가한다.
  - 제안: 아래와 같이 중첩 describe로 의미적 그룹화 고려.
    ```
    describe('terminal revoke (EIA-AU-04)', () => { ... })
    describe('notification enqueue 게이트', () => { ... })
    describe('triggerId 없는 실행', () => { ... })
    ```
    현재 케이스 수(7개)에서는 즉각 필수는 아니며, 케이스 증가 시 적용 권장.

---

### 파일 3: notification-fanout.service.ts

- **[INFO]** `handle()` 메서드 내 revoke 블록의 위치 이동이 의도와 완전히 일치하고, 주석이 "왜 여기에"를 명시
  - 위치: 라인 900–912 (전체 파일 기준)
  - 상세: `// 따라서 아래 notification 게이트의 early return 보다 반드시 먼저 수행한다.` 주석이 이동 이유를 코드 내에서 자기 문서화. 미래 리뷰어가 블록 순서를 잘못 판단하거나 리팩터 중 실수로 이동시킬 가능성을 낮춘다.
  - 제안: 이대로 유지.

- **[INFO]** `notificationCfg` 관련 연속 타입 단언(`as { events?: unknown }`, `as { events: unknown[] }`)이 중첩되어 가독성 저하
  - 위치: 라인 918–927 (전체 파일 기준)
  - 상세: 이번 변경에서 수정된 코드는 아니나 동일 메서드 내에 위치. Trigger 엔티티의 `config` 필드를 typed JSON 또는 별도 인터페이스로 선언하면 이 캐스팅 체인을 제거할 수 있다. 이는 기존 부채이며 이번 diff 범위 밖.
  - 제안: 향후 `TriggerConfig` 타입 정의로 개선 권장.

- **[INFO]** `handle()` 메서드 길이가 약 60줄로 단일 메서드치고 적절한 수준
  - 위치: 라인 885–944
  - 상세: 책임이 "이벤트 라우팅 + revoke + enqueue 결정"으로 하나의 흐름으로 읽힌다. 분리보다 단일 읽기 흐름 유지가 낫다고 판단.
  - 제안: 이대로 유지. 향후 enqueue 준비 로직이 복잡해지면 `prepareEnqueuePayload()` 추출 가능.

- **[INFO]** `TERMINAL_EVENTS`와 `FANOUT_EVENTS`가 파일 상단 모듈 레벨 상수로 적절히 선언됨
  - 위치: 라인 825–837
  - 상세: Set으로 선언하여 `has()` 룩업이 O(1). 매직 스트링이 상수로 집약되어 있어 이벤트 유형 추가/변경 시 단일 위치만 수정.
  - 제안: 이대로 유지.

---

## 요약

이번 변경은 `revokeAllForExecution` 호출 위치를 notification 게이트 위로 이동한 단순하고 목적이 명확한 버그 픽스다. 프로덕션 코드(`notification-fanout.service.ts`) 변경은 최소화되어 있고 주석이 이동 이유를 자기 문서화하고 있어 가독성과 유지보수성 모두 양호하다. 신규 작성된 `notification-fanout.service.spec.ts`는 팩토리 함수와 헬퍼를 적절히 분리했으며 기존 스펙 파일(`interaction.guard.spec.ts`)과 동일한 관용구를 채택해 스타일 일관성이 높다. 주요 개선 기회는 (1) `invoke` 헬퍼의 `as unknown as` 캐스팅으로 인한 타입 안전망 공백, (2) 단일 `describe` 블록 내 케이스 분류 부재로, 둘 다 현재 규모에서는 허용 가능한 수준이며 즉각적인 차단 이슈는 없다.

## 위험도

LOW
