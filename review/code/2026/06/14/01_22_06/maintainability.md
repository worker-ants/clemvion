# 유지보수성(Maintainability) 리뷰

## 발견사항

### 파일 1: execution-engine.service.ts (핵심 변경)

- **[INFO]** `resumedMeta` 조립 로직의 중첩 삼항 연산
  - 위치: diff +9~+22 (`resumedMeta` 계산 블록)
  - 상세: `resumedMeta` 를 만드는 표현식이 "prevMeta 또는 resumeDurationMs 중 하나라도 있으면 객체, 아니면 undefined" + "durationMs 는 resumeDurationMs 가 있을 때만 spread" 라는 2단 조건을 중첩 삼항과 이중 spread 로 표현한다. 의도 자체는 명확하지만 한 블록 안에서 `?? {}`, `!== undefined ? {durationMs} : {}` 를 겹쳐 쓰면 처음 읽는 사람이 "왜 단순히 `{ ...prevMeta, durationMs: resumeDurationMs }` 가 아닌가?" 를 잠시 고민하게 된다. 실제 이유는 "둘 다 undefined 인 경우 meta 키를 아예 생략" 이지만 그 invariant가 코드 형태에서 바로 드러나지 않는다.
  - 제안: 변수명 또는 짧은 주석으로 "두 값 모두 없으면 meta 키를 생략" 이라는 의도를 명시한다. 또는 동등 가독성을 가진 early-return 패턴으로 교체한다:
    ```typescript
    const resumedMeta: Record<string, unknown> | undefined =
      prevMeta !== undefined || resumeDurationMs !== undefined
        ? { ...(prevMeta ?? {}), ...(resumeDurationMs !== undefined && { durationMs: resumeDurationMs }) }
        : undefined;
    ```
    이 정도 compact 화로도 가독성이 개선된다.

- **[INFO]** `resumeFinishedAt` 변수명 — 충분히 명확하나 맥락 보완 가능
  - 위치: diff +1 (`const resumeFinishedAt = new Date();`)
  - 상세: `resumeFinishedAt` 은 "resume 처리 완료 시각" 을 뜻하는 이름으로 적절하다. 단, DB 컬럼명(`finishedAt`)과 1:1 대응됨을 주석 없이도 읽을 수 있어 별도 조치는 불필요하다. 현재 수준으로 유지보수성에 문제 없음.

- **[INFO]** `resumeDurationMs` 의 `Math.max(0, ...)` 가드 — 의미 서술 필요
  - 위치: diff +3 (`Math.max(0, resumeFinishedAt.getTime() - nodeExec.startedAt.getTime())`)
  - 상세: 시계 역행(NTP 보정 등)에 대한 방어 코드임이 명확하나, 같은 함수 하단(diff +14)의 `resumeDurationMs ?? resumeFinishedAt.getTime() - nodeExec.startedAt.getTime()` 에는 동일한 `Math.max(0, ...)` 가드가 없다. `resumeDurationMs` 가 undefined 인 경우(`nodeExec` 존재 but `startedAt` 없음) fallback 식에 시계 역행 방어가 빠져 있다. 이미 `nodeExec` 가 없을 때는 `resumeDurationMs ?? ...` 의 fallback 자체가 실행되지 않으므로 실질 버그는 아니지만, 코드를 읽는 사람이 두 경로의 가드 일관성을 의심할 수 있다. 주석 또는 `Math.max(0, ...)` 통일로 명확화를 권장한다.

---

### 파일 2: execution-engine.service.spec.ts (테스트 추가)

- **[INFO]** private 메서드 접근을 위한 `as unknown as { ... }` 타입 캐스팅 과다
  - 위치: 추가된 테스트 케이스 (`§5.5 resume 시 meta.durationMs` 블록) 전체
  - 상세: `svc`, `ctSvc`, `context.structuredOutputCache` 접근에서 3회의 `as unknown as {...}` 캐스트가 사용된다. 이는 기존 테스트 파일 전체의 패턴과 일관되어 스타일 위반은 아니다. 그러나 동일 파일 내 `armSlowPathResume` 헬퍼처럼 반복되는 캐스팅 패턴을 별도 헬퍼 타입(`type ServiceUnderTest = ...`)으로 공통화하면 테스트 추가 시 타입 오타 위험을 낮출 수 있다. 현재 변경 범위는 1개 테스트 케이스로 영향이 제한적이므로 즉각 리팩터링보다는 향후 테스트 증가 시 고려 대상으로 남긴다.

- **[INFO]** 매직 숫자 `5000`, `4000`
  - 위치: 추가된 테스트 케이스 라인 `Date.now() - 5000`, `toBeGreaterThanOrEqual(4000)`
  - 상세: `5000` 은 "대기 진입 5초 전 startedAt" 을, `4000` 은 "최소 4초 경과를 기대" 를 의미하는 1초 여유다. 이 숫자들의 의미는 인접 주석("대기 진입 5초 전 startedAt — durationMs 가 0 이 아니라 ~5000 이어야 한다")으로 충분히 설명되어 있다. 명명 상수 추출이 바람직하지만, 단일 테스트 케이스 내 리터럴이므로 심각도는 낮다. 향후 동일 패턴의 타이밍 테스트가 늘어날 경우 공통 상수(`WAIT_ELAPSED_MS`, `WAIT_MARGIN_MS`)로 추출을 권장한다.

- **[WARNING]** `structuredOutputCache` 직접 주입 — 내부 구현 세부사항 노출
  - 위치: 테스트 케이스 내 `(context as { structuredOutputCache: ... }).structuredOutputCache = { ... }` 블록
  - 상세: `ExecutionContextService.createContext` 가 반환하는 `ExecutionContext` 객체의 내부 캐시 필드(`structuredOutputCache`)를 테스트에서 직접 설정한다. 이 접근은 해당 필드가 리네임되거나 타입이 바뀔 때 컴파일 에러 없이 테스트가 깨지거나 잘못된 상태를 주입할 수 있다(`as unknown as` 캐스트가 타입 안전망을 제거). 동일 파일의 다른 테스트들도 유사한 패턴을 사용하는 것을 확인했으나, 추가하는 시점에 `ExecutionContextService` 가 공개 메서드(`setStructuredOutput` 또는 테스트 전용 `injectStructuredOutput`)를 제공한다면 그쪽을 사용하는 것이 바람직하다. 프로덕션 코드가 이미 `setStructuredOutput` spy를 통해 검증하는 구조이므로, 초기 상태도 같은 서비스 메서드를 통해 주입할 수 있는지 검토한다.

---

### 파일 3: plan/in-progress/spec-sync-form-gaps.md

- **[INFO]** 구현 진척 메모가 `## 미구현 항목` 섹션 안에 blockquote 로 삽입됨
  - 위치: diff +4~+7 (구현 진척 blockquote 블록)
  - 상세: 진척 노트를 해당 섹션 상단 blockquote 로 추가하는 패턴은 이 파일 내에서 처음 사용된다. 기존 plan 파일 컨벤션에서 진척 상황은 체크박스(`[x]`) 로 표현하는 것이 표준 패턴이다. blockquote 섹션 메모는 유용하지만 다른 plan 파일과 일관성이 없으면 향후 자동 파싱(plan-lifecycle 스크립트 등)에서 예상치 못한 처리를 받을 수 있다. 단, 해당 blockquote 가 순수 보충 설명이고 파싱 대상이 아니라면 문제없다.

---

## 요약

이번 변경의 핵심인 `processFormResumeTurn` 내 `meta.durationMs` 갱신 로직(파일 2)은 의도가 명확하고, `resumeFinishedAt` 단일 시각 기준으로 DB 컬럼과 structured meta 를 동기화한 설계 결정은 일관성 측면에서 바람직하다. 가독성 면에서는 `resumedMeta` 조립 블록이 중첩 spread 로 다소 난해하지만, 인접 주석이 의도를 보완하고 있어 치명적 수준은 아니다. 테스트 케이스는 기존 파일의 스타일 패턴을 잘 따르며 `structuredOutputCache` 직접 주입 외에 큰 주의사항은 없다. 전반적으로 기존 코드베이스 스타일·패턴 준수 수준이 높다.

## 위험도

LOW
