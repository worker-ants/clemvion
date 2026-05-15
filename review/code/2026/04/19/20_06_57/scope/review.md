## 변경 범위 분석

### 발견사항

---

**[CRITICAL]** `send-email.handler.ts`: 중복 삼항 연산자 — 양쪽 분기가 동일한 값 반환

- 위치: `send-email.handler.ts` 패치 내 `const code = ...` 블록
- 상세:
  ```typescript
  const code =
    err instanceof IntegrationError
      ? 'EMAIL_SEND_FAILED'
      : 'EMAIL_SEND_FAILED';
  ```
  `IntegrationError` 여부와 무관하게 동일한 코드가 반환된다. 원래 의도는 `IntegrationError` 인 경우에는 `err.code` (예: `INTEGRATION_INCOMPLETE`)를 보존하고, 그 외 SMTP 전송 실패일 때만 `EMAIL_SEND_FAILED` 를 쓰는 것이었을 가능성이 높다. 현재 코드는 `IntegrationError` 의 원래 코드를 소실시킨다.
- 제안: `err instanceof IntegrationError ? err.code : 'EMAIL_SEND_FAILED'` 로 수정하거나, 의도적으로 통합하는 것이라면 삼항 연산자 자체를 제거

---

**[WARNING]** `template.handler.ts` / `template.handler.spec.ts`: `output.content` → `output.rendered` 명칭 변경은 기존 워크플로우 표현식을 파괴

- 위치: `template.handler.ts` payload 구성부
- 상세: `{ type: 'template', format, content }` 에서 `{ rendered }` 로 변경하면, 이미 저장된 워크플로우에서 `$node["X"].output.content` 를 참조하는 표현식이 즉시 깨진다. 이 변경은 "노드 변수 구조 개선"의 범위 내이지만 하위호환 마이그레이션 경로(레거시 `content` 필드 병존 또는 Migration script)가 없다.
- 제안: `migrate-node-output-refs.ts` 스크립트가 `output.content` → `output.rendered` 패스 변환을 포함하는지 확인 필요 (diff가 생략되어 확인 불가)

---

**[WARNING]** `http-request.handler.ts` / `.spec.ts`: URL 크리덴셜 제거(`sanitizeUrlCredentials`)는 요청 범위 외 신규 보안 기능

- 위치: `http-request.handler.ts` 상단 `sanitizeUrlCredentials` 함수 추가, `http-request.handler.spec.ts` 테스트 추가
- 상세: 노드 변수 구조화(CONVENTIONS §7은 "sanitisation of URL-level credentials"로 명시)와는 다른 보안 관심사다. 이 변경이 별도 스펙/PRD에 정의된 항목인지 불명확하며, 독립 커밋 또는 PR로 분리하는 것이 추적 가능성 면에서 낫다.
- 제안: 범위 분리가 어렵다면 커밋 메시지에 명시적으로 기재

---

**[WARNING]** `frontend/src/components/editor/run-results/renderers/presentation-renderers.tsx`: Stage 3 구현 선행 참조

- 위치: `FormSubmittedContent` 컴포넌트
- 상세: `output.interaction.data` 를 읽도록 변경되었으나, `form.handler.ts` 는 `output: {}` 빈 객체만 반환한다. `output.interaction.*` 는 CONVENTIONS §4.5에 따라 Stage 3에서 구현될 예정이다. 현재 코드는 실제로 존재하지 않는 경로를 먼저 참조하며, `legacyData` fallback이 있어 런타임 오류는 없지만 잘못된 기대치를 코드에 심는다.
- 제안: Stage 3 구현 시점에 이 변경을 이동하거나, TODO 주석으로 명확히 표시

---

**[WARNING]** `output-shape.ts` (frontend): Stage 2 미구현 `output.partial.*` 경로 선행 처리

- 위치: `extractIeSnapshot` 함수 내 `partialTopLevel` / `partialNested` 블록
- 상세: spec 주석에 "Stage 2 will replace this with `output.partial.*`"라고 명시되어 있으며 현재 핸들러는 여전히 `conversationConfig.extracted` 를 사용한다. 아직 생성되지 않는 경로에 대한 처리를 미리 추가하는 것은 범위 외 확장이다.
- 제안: Stage 2 구현 시 함께 추가, 또는 dead-code임을 명확히 표시

---

**[WARNING]** `database-query.handler.ts`: `'QUERY_FAILED'` → `'DB_QUERY_FAILED'` 에러 코드 변경은 파괴적 변경

- 위치: `database-query.handler.ts` 패치 단일 라인
- 상세: 이 에러 코드를 구독하는 외부 시스템, 워크플로우 조건 분기, 모니터링 쿼리가 있을 경우 즉각 영향을 받는다. 변경 이유가 코드 주석이나 spec에 기술되지 않아 의도적 변경인지 오타 수정인지 불명확하다.
- 제안: CONVENTIONS에 에러 코드 네이밍 규칙이 정의되어 있다면 해당 규칙을 주석으로 참조; migration script 또는 CHANGELOG에 기재

---

**[INFO]** 프레젠테이션 핸들러 4종 (carousel, chart, table, form): `meta: { durationMs: 0 }` 하드코딩

- 위치: `carousel.handler.ts`, `chart.handler.ts`, `table.handler.ts`, `form.handler.ts` 의 waiting-state 반환값
- 상세: `durationMs: 0` 은 의미 없는 메트릭이다. waiting-state 는 실제로 완료 시점이 없으므로 `undefined` 또는 필드 자체를 생략하는 것이 더 정직하다.
- 제안: `durationMs` 를 생략하거나 `undefined` 로 설정

---

**[INFO]** `carousel.handler.ts`: `configEcho` 에 추가된 필드들이 기존 테스트에 없는 신규 동작

- 위치: `carousel.handler.ts` configEcho 구성 블록
- 상세: `titleField`, `descriptionField`, `imageField`, `buttons`, `itemButtons` 를 configEcho 에 추가했다. 이는 Principle 1.1(config 에 리터럴 설정 echo)에 따른 것이지만, 이 필드들이 이전에는 config 에 없었으므로 `$node["X"].config.*` 를 참조하는 기존 표현식에 영향 없는지 확인이 필요하다.
- 제안: 특별한 문제가 없다면 INFO 수준

---

### 요약

전체 변경은 "노드 출력 구조 표준화"(Principle 11 / CONVENTIONS) 플랜의 다단계 구현으로, 의도된 범위 내에서 일관성 있게 진행되었다. 그러나 두 가지 범위 이탈이 주목된다: HTTP URL 크리덴셜 제거는 별도 보안 관심사이며, 프론트엔드의 `output.interaction.data` 및 `output.partial.*` 경로 처리는 아직 구현되지 않은 Stage 2/3를 선행 참조한다. 또한 `send-email.handler.ts` 의 삼항 연산자 버그는 기능 결함이며, `output.content` → `output.rendered` 명칭 변경에 대한 하위호환 처리가 마이그레이션 스크립트에 포함되는지 검증이 필요하다.

### 위험도

**MEDIUM**