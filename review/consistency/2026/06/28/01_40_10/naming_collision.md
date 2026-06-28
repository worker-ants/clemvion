# 신규 식별자 충돌 Check — 결과

## 검토 범위

- 대상: `spec/7-channel-web-chat/` (impl-done, diff-base=origin/main)
- 구현 변경: `use-token-refresh.ts` 신설, `use-pending-message-queue.ts` 신설, `use-widget.ts` 리팩터 (behavior-preserving God hook 분리)
- spec 변경: 없음 (`spec_impact: []`)

---

## 발견사항

충돌 없음. 아래는 검토한 6개 관점별 결과다.

### 1. 요구사항 ID 충돌

target 이 신규로 부여하는 요구사항 ID 없음 (spec 변경 없음). 코드 주석에서 기존 `§R6`, `§B`, `C1`, `I1`, `W9` 등을 참조하나 이는 기존 spec 절 참조이고 신규 ID 부여가 아니다. 충돌 없음.

### 2. 엔티티/타입명 충돌

신규 도입 타입/인터페이스:

| 식별자 | 파일 | 스코프 |
|---|---|---|
| `PendingMessageQueueDeps` | `use-pending-message-queue.ts` | 파일-local (비공개 `interface`) |
| `TokenRefreshDeps` | `use-token-refresh.ts` | 파일-local (비공개 `interface`) |
| `SessionRef = PersistedSession` | `use-widget.ts` | 파일-local `type` alias (공개 아님) |

- `PendingMessageQueueDeps` / `TokenRefreshDeps`: 파일-local 비공개 인터페이스. 채널 웹챗 외 패키지에서 동명 타입 사용 없음(전체 `codebase/` grep 결과 해당 이름은 위 두 파일에만 존재).
- `SessionRef = PersistedSession`: 기존 `use-widget.ts` 내에 있던 `SessionRef { executionId, token, expiresAt, endpoints }` 독자 인터페이스를 `PersistedSession` 재사용 타입 alias 로 교체. 외부 노출 없음, 파일-내부 로컬 타입. 충돌 없음.

### 3. API endpoint 충돌

본 PR 은 API endpoint 를 신설/변경하지 않는다. 위젯 내부 hook 코드 분리에 그치며 EIA 표면 호출 패턴은 불변. 충돌 없음.

### 4. 이벤트/메시지명 충돌

postMessage 이벤트(`wc:*`) 및 SSE 이벤트명 변경 없음. 내부 `USER_MESSAGE` dispatch action 은 기존과 동일(이동이 아닌 재사용). 충돌 없음.

### 5. 환경변수·설정키 충돌

신규 ENV var / config key 없음. 충돌 없음.

### 6. 파일 경로 충돌

신규 파일:

| 파일 경로 | 기존 존재 여부 |
|---|---|
| `codebase/channel-web-chat/src/widget/use-token-refresh.ts` | 신규 생성 (origin/main 에 없음) |
| `codebase/channel-web-chat/src/widget/use-pending-message-queue.ts` | 신규 생성 (origin/main 에 없음) |

기존 `src/widget/` 디렉토리의 파일 명명 컨벤션(`use-*.ts`, `host-bridge.ts`, `wc-protocol.ts` 등)과 일치. 파일 경로 충돌 없음.

**하위호환 re-export 검토**: `use-widget.ts` 가 기존 공개 export(`TOKEN_REFRESH_LEAD_MS`, `TOKEN_REFRESH_MIN_DELAY_MS`, `refreshDelayMs`)를 `use-token-refresh` 로 위임하는 영구 re-export 를 유지한다. `use-widget.test.ts` 가 이 re-export 경로를 검증하고 있어 기존 소비처 보호가 확인됨. 이름 이동이지 충돌이 아니다.

---

## 요약

이번 PR 은 `useWidget` God hook 을 `useTokenRefresh` / `usePendingMessageQueue` 두 전용 hook 으로 추출하는 behavior-preserving 리팩터다. spec 변경 없음 (`spec_impact: []`). 신규 도입된 식별자(`usePendingMessageQueue`, `useTokenRefresh`, `PendingMessageQueueDeps`, `TokenRefreshDeps`, 내부 `SessionRef` alias)는 모두 `codebase/channel-web-chat/src/widget/` 스코프에 국한되며, 기존 spec·코드 영역의 동명 식별자와 의미 충돌이 없다. 공개 export(`refreshDelayMs` 등)는 기존 import 경로를 보호하는 re-export 로 유지되어 소비처 깨짐도 없다.

## 위험도

NONE
