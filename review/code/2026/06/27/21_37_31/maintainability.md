# 유지보수성(Maintainability) 리뷰

## 발견사항

### 발견 1
- **[WARNING]** `trigger-dto-validation.spec.ts` — 동일 구조의 픽스처 상수가 두 개 공존
  - 위치: `/codebase/backend/src/modules/triggers/dto/trigger-dto-validation.spec.ts` 모듈 상단 `const baseCreate`(line 275–279) vs `describe('CreateTriggerDto')` 내부 `const baseTrigger`(line 282–286)
  - 상세: 두 상수 모두 `{ workflowId: VALID_UUID, type: 'webhook', name: 'Test' }` 로 완전히 동일하다. 기존 `CreateTriggerDto` describe 블록이 `baseTrigger`를 쓰고 이번 PR이 추가한 `endpointPath` 테스트 블록은 `baseCreate`를 쓴다. 베이스 구조가 변경될 때 두 곳을 모두 수정해야 한다.
  - 제안: `baseTrigger`를 제거하고 모듈 스코프의 `baseCreate`로 통일한다.

### 발견 2
- **[WARNING]** `trigger-dto-validation.spec.ts` — 동일 값의 검증 옵션 상수가 두 개 공존
  - 위치: 동일 파일 `VALIDATE_OPTIONS`(line 273) vs `VALIDATE_OPTS`(line 811 부근, `WebChatAppearanceDto` describe 블록 안)
  - 상세: `{ whitelist: true, forbidNonWhitelisted: true }` 로 완전히 동일한 값이 이름만 달리해서 같은 파일에 정의되어 있다. 향후 값을 달리할 의도가 없다면 두 상수가 독립적으로 관리되어 우연한 불일치가 생길 수 있다.
  - 제안: 모듈 최상위의 `VALIDATE_OPTIONS` 하나로 통일하고 `VALIDATE_OPTS` 참조를 교체한다.

### 발견 3
- **[WARNING]** `spec/data-flow/12-workspace.md` §3.1 — 이번 PR이 구현한 내용과 정반대인 설명이 §3.1에 잔존
  - 위치: `spec/data-flow/12-workspace.md` §3.1 `workspace_invitation.accepted_at` 상태 전이 섹션 마지막 문단
  - 상세: 같은 PR에서 §1.2에 "매일 04:00 Asia/Seoul에 `WorkspaceInvitationsPrunerService`가 삭제한다"는 내용을 추가했지만, §3.1은 여전히 "**현재 프로덕션 호출자가 없어** 만료 row는 영구 잔존한다. 정리 job 연결은 미구현." 이라고 기술하고 있다. 같은 문서에서 §1.2와 §3.1이 상충한다.
  - 제안: §3.1의 해당 문단을 "만료 row는 `WorkspaceInvitationsPrunerService`(매일 04:00 Asia/Seoul, BullMQ repeatable job)가 주기적으로 삭제한다."로 교체한다.

### 발견 4
- **[INFO]** `create-trigger.dto.ts` `endpointPath` — `@ApiPropertyOptional` description이 4줄 문자열 연결로 과도하게 길어 decorator 블록 가독성 저하
  - 위치: `/codebase/backend/src/modules/triggers/dto/create-trigger.dto.ts` line 130–134
  - 상세: 동일 DTO 내 다른 필드의 description은 한 줄인데, `endpointPath`만 spec ID·보안 근거·클라이언트 발급 방식을 모두 서술해 4줄 연결 문자열이 되었다. Swagger UI 독자에게는 유용하지만, 코드 리더가 클래스를 훑을 때 이 필드에서 시선이 오래 걸린다.
  - 제안: decorator `description`은 "Webhook 트리거 전용. 수신 엔드포인트 경로 — v4 UUID 형식만 허용 (WH-SC-01·WH-MG-02)." 수준으로 간결하게 유지하고, 클라이언트 발급 방식과 보안 근거는 필드 위 JSDoc 주석으로 옮긴다. `update-trigger.dto.ts`도 동일 패턴 적용.

### 발견 5
- **[INFO]** `workspace-invitations-pruner.service.ts` — `removeOnComplete`·`removeOnFail` age 값이 인라인 산술로만 표현됨
  - 위치: `/codebase/backend/src/modules/workspaces/jobs/workspace-invitations-pruner.service.ts` line 1271–1272
  - 상세: `7 * 24 * 60 * 60`, `30 * 24 * 60 * 60` 은 산술 자체가 의미를 전달하므로 심각한 매직넘버는 아니다. 그러나 동일 코드베이스의 `login-history-pruner` 가 동일 패턴을 쓴다면 각 파일에서 독립적으로 값이 관리되어 불일치가 생길 수 있다.
  - 제안: 두 서비스가 공유하는 시간 상수(`ONE_WEEK_SECONDS = 7 * 24 * 60 * 60` 등)를 공통 상수 파일로 추출하거나, 최소한 같은 파일 내 named const로 선언한다.

### 발견 6
- **[INFO]** `chat-channel-trigger-create.e2e-spec.ts` — `uniqueEndpoint(_label)` 파라미터가 무시되지만 시그니처에 잔존
  - 위치: `/codebase/backend/test/chat-channel-trigger-create.e2e-spec.ts` line 1499 (변경 diff 기준)
  - 상세: 언더스코어 prefix(`_label`)는 TypeScript/ESLint 관행상 "의도적 미사용"을 나타내며 주석도 충분하다. 그러나 콜 사이트에서 `uniqueEndpoint('tg')`처럼 의미 있어 보이는 인자를 전달하면 미래 독자가 그 값이 실제로 쓰인다고 오해할 수 있다.
  - 제안: 콜 사이트 호환성 유지가 목적이라면 현 상태를 유지해도 무방하나, 리팩터링 기회가 생기면 `uniqueEndpoint(): string`으로 파라미터를 제거하고 모든 콜 사이트에서 인자를 삭제하는 것이 더 명확하다.

### 발견 7
- **[INFO]** `workspace-invitations-pruner.service.spec.ts` — `(service as any).logger` 타입 우회
  - 위치: `/codebase/backend/src/modules/workspaces/jobs/workspace-invitations-pruner.service.spec.ts` lines 1084, 1088, 1097, 1103
  - 상세: private `logger`에 접근하기 위해 `as any`를 사용한다. NestJS 단위 테스트에서 흔한 패턴이고 기능상 문제없으나, TypeScript 타입 보호가 우회된다. `login-history-pruner` 테스트도 동일 패턴을 쓴다면 코드베이스 내 일관성은 있다.
  - 제안: 패턴 변경이 필요하다면 `Logger`를 DI 주입받도록 서비스를 변경하거나, 테스트 대상 메서드가 로거를 호출하는지만 검증하는 방식으로 전환한다. 현 수준에서는 허용 범위 내.

---

## 요약

이번 변경셋은 `endpointPath`의 UUID 형식 강제라는 단일 목적에 집중되어 있으며, 신규 `WorkspaceInvitationsPrunerService`는 `login-history-pruner` 패턴을 그대로 따라 구조적 일관성이 높다. 유지보수성 관점의 주요 문제는 코드 구조보다 테스트 파일 내 중복 상수(`baseCreate`/`baseTrigger`, `VALIDATE_OPTIONS`/`VALIDATE_OPTS`)와 같은 PR에서 §1.2만 업데이트하고 §3.1을 그대로 남긴 spec 문서 불일치다. DTO 필드 description의 장황함은 가독성 관점에서 개선 여지가 있으나 기능 정확성에는 영향이 없다. 전반적으로 기존 코드베이스의 스타일·패턴을 잘 따르고 있으며 심각한 구조 문제는 없다.

---

## 위험도

LOW
