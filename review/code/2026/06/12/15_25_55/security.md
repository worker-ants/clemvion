# Security Review

## 발견사항

### 파일 1–2: chat-channel.controller.ts / .spec.ts

- **[INFO]** `@WorkspaceId()` 데코레이터로 workspace 컨텍스트 추출 통일
  - 위치: `chat-channel.controller.ts:44` (`@WorkspaceId() workspaceId: string`)
  - 상세: 이전 구현(`@Headers('x-workspace-id')` + 수동 `UnauthorizedException`)은 JWT `workspaceId` fallback 이 누락되어 있었고, HTTP status 도 401(인증 실패)를 잘못 사용하고 있었다. 공용 `@WorkspaceId()` 데코레이터로 교체함으로써 (1) JWT fallback 버그 해소, (2) 에러 코드 `WORKSPACE_ID_REQUIRED` / 400으로 정합, (3) 중앙 집중 검증 로직 재사용 — 세 가지 보안 개선이 동시에 이루어진다.
  - 제안: 현재 구현 양호. `workspace.decorator.ts`에서 `x-workspace-id` 헤더 값에 대한 별도 형식·길이 검증은 없으나, 이는 이 PR 범위 밖의 선재 정책이며 `workspaceId`가 DB 조회에 직접 사용될 때 TriggersService 레이어에서 `findById` 내부 UUID/PK 검증으로 커버되는 구조이므로 별도 조치 불필요.

- **[INFO]** 테스트에서 `UnauthorizedException` 케이스 제거
  - 위치: `chat-channel.controller.spec.ts` (삭제된 라인 54–59)
  - 상세: 제거된 테스트는 데코레이터가 Nest param 파이프라인에서만 동작하므로 직접 호출 단위 테스트로 검증할 수 없는 구조다. 검증 책임이 `workspace.decorator.spec.ts`로 명시 이관되어 있어 보안 커버리지 공백이 발생하지 않는다.
  - 제안: 문제 없음.

### 파일 3–4: triggers.mdx / triggers.en.mdx (사용자 문서)

- **[INFO]** 에러 코드 문서 동기화 (`WORKSPACE_REQUIRED` → `WORKSPACE_ID_REQUIRED`)
  - 위치: 두 문서의 Chat Channel API error code 목록 Callout
  - 상세: 실제 반환 코드와 문서가 정합되었다. 이전에 문서가 `WORKSPACE_REQUIRED` (존재하지 않는 코드)를 노출하고 있어 클라이언트 에러 처리 로직 오작동 가능성이 있었다. 수정 후 정확한 코드 제공.
  - 제안: 문제 없음.

### 파일 5: plan/complete/code-node-isolated-vm.md

- **[INFO]** isolated-vm 전환 완료 기록 — 보안 맥락 확인
  - 위치: 전체 문서 (plan 완료 기록)
  - 상세: `node:vm` 에서 `isolated-vm@6.1.2` (V8 Isolate) 로 전환한 이전 PR 의 완료 기록이다. `this.constructor.constructor('return process')()` 류 prototype-chain escape 가 V8 Isolate 경계로 구조적 차단되었으며, 128MB 메모리 하드 리밋이 추가되었음을 확인. 이 PR 자체에서 코드 변경은 없으나, 기록된 위협 모델과 완화 조치는 보안 맥락상 중요하다.
  - 제안: 문서 자체는 plan 아카이브이므로 별도 조치 불필요.

### 파일 6–7: plan/in-progress/chat-channel-workspace-code-unify.md / spec/5-system/15-chat-channel.md

- **[INFO]** spec §5.4 에러 표 동기화
  - 위치: `15-chat-channel.md` 라인 338 표 행 (`401 WORKSPACE_REQUIRED` → `400 WORKSPACE_ID_REQUIRED`)
  - 상세: 실제 동작과 spec 문서가 정합되었다. 이전에 spec 이 401(인증 실패)로 잘못 기술하고 있어 클라이언트 구현 오류를 유발할 수 있었다.
  - 제안: 문제 없음.

- **[INFO]** `botIdentity.teamId` 필드 추가 (spec 데이터 모델)
  - 위치: `15-chat-channel.md` 라인 593
  - 상세: `teamId`는 Slack 등의 workspace/team 식별자로, 설계 상 `botIdentity` 캐시 블록에 저장된다. 이 필드 자체는 secret이 아니며 (팀 ID는 공개 식별자), `CCH-SE-03`에 따라 민감 자격증명(botToken 등)은 여전히 secret store AES-256-GCM으로 별도 관리된다.
  - 제안: 문제 없음.

---

## 요약

이번 변경은 `rotateBotToken` 엔드포인트의 workspace ID 검증을 인라인 수동 로직에서 공용 `@WorkspaceId()` 데코레이터로 통일한 리팩터링이다. 보안 관점에서 이 변경은 (1) JWT workspaceId fallback 누락 잠재 버그 해소, (2) HTTP 상태코드 오용(401 → 400) 수정, (3) 에러 코드 일관성 확보라는 세 가지 보안 개선을 가져온다. 하드코딩된 시크릿, 인젝션 취약점, 위험한 입력 처리, OWASP Top 10 해당 취약점은 발견되지 않았다. 인증 우회 위험 없음 — 오히려 공용 데코레이터 경로로 통일함으로써 검증 경로가 단순화되어 감사가 용이해졌다. 동봉된 plan 완료 문서는 직전 PR의 isolated-vm 전환(prototype-chain escape 구조적 차단)을 기록한 것으로 추가적인 보안 개선 맥락을 제공한다.

## 위험도

NONE
