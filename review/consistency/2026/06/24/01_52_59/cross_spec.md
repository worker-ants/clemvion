# Cross-Spec 일관성 검토 결과

검토 모드: `--impl-done` (구현 완료 후 검토)
대상 spec: `spec/5-system/15-chat-channel.md`
diff 범위: `origin/main...HEAD` — C-2 chat-channel↔triggers 순환 의존 해소 리팩토링

---

## 발견사항

### [INFO] `spec/5-system/15-chat-channel.md` frontmatter `code:` 경로 미갱신

- target 위치: `spec/5-system/15-chat-channel.md` frontmatter line 5 (`code: - codebase/backend/src/modules/chat-channel/**`)
- 충돌 대상: `spec/data-flow/14-chat-channel.md` line 28 (`codebase/backend/src/modules/triggers/chat-channel-token-rotator.service.ts` — C-2 이전 명시)
- 상세: `ChatChannelTokenRotatorService` 가 `chat-channel/` 모듈에서 `triggers/` 모듈로 이전됐다. 현재 `15-chat-channel.md` frontmatter 의 `code:` 목록에 `codebase/backend/src/modules/chat-channel/**` 는 있으나 새 위치 `codebase/backend/src/modules/triggers/chat-channel-token-rotator.service.ts` 와 `codebase/backend/src/modules/triggers/chat-channel-token-rotator.service.spec.ts` 가 누락돼 있다. `triggers.controller.ts` (line 8) 와 `triggers.service.ts` (line 7) 는 이미 목록에 있어 엔드포인트 이전은 반영됐으나, rotator 서비스 파일 2종이 빠졌다.
- 제안: `spec/5-system/15-chat-channel.md` frontmatter `code:` 에 두 줄 추가.
  ```
  - codebase/backend/src/modules/triggers/chat-channel-token-rotator.service.ts
  - codebase/backend/src/modules/triggers/chat-channel-token-rotator.service.spec.ts
  ```

### [INFO] `spec/5-system/15-chat-channel.md` §7 파일 구조 미갱신

- target 위치: `spec/5-system/15-chat-channel.md` §7 "구현 파일 구조" (lines 449–475)
- 충돌 대상: 없음 (기존 §7 도 `chat-channel-token-rotator.service.ts` 를 명시하지 않았으므로 신규 불일치가 아니라 기존 갭이 구조 변경으로 더 두드러진 것)
- 상세: §7 의 `chat-channel/` 하위 파일 목록에 `chat-channel-token-rotator.service.ts` 가 처음부터 없고, `triggers/` 하위 목록도 rotator 파일을 포함하지 않는다. `data-flow/14-chat-channel.md` 는 이미 C-2 이전을 반영해 새 경로를 명시하고 있어 data-flow 쪽은 일관됨.
- 제안: `spec/5-system/15-chat-channel.md` §7 `triggers/` 블록에 `chat-channel-token-rotator.service.ts` (및 spec 파일) 을 추가해 파일 구조 표를 현행화. 단, 이 갱신은 기능 정확도에 영향을 주지 않으므로 다음 spec-sync 작업 시 일괄 처리해도 무방하다.

---

## 비-충돌 확인 사항 (검토 완료, 문제 없음)

1. **API 계약**: `POST /api/triggers/:id/chat-channel/rotate-bot-token` 엔드포인트는 `ChatChannelController` → `TriggersController` 이전 후에도 URL·HTTP method·request body (`newBotToken`)·response shape 전부 스펙 정의(`CCH-SE-04`, `spec/5-system/15-chat-channel.md §5.4`)와 일치한다.

2. **모듈 오너십**: `spec/data-flow/0-overview.md` line 201 은 `chat-channel-token-rotator` 큐를 이미 `triggers.module.ts` 소유로 기재하고 있어 구현의 `TriggersModule` 등록과 일치한다.

3. **순환 의존 해소**: `TriggersModule` 이 `ChatChannelModule` 을 단방향 import 하는 구조는 `spec/5-system/15-chat-channel.md §7` 가 `triggers/` 를 독립 모듈로 두는 설계와 부합하며, 이 변경이 spec 의 다른 모듈 경계 정의(`external-interaction`, `websocket`, `secret-store`)와 충돌하지 않는다.

4. **`system-status.constants.ts` import 경로 변경**: `CHAT_CHANNEL_TOKEN_ROTATOR_QUEUE` 상수 import 를 `chat-channel/` → `triggers/` 로 변경한 것은 `spec/5-system/16-system-status-api.md` 의 큐 모니터링 목록과 충돌 없이 정합적이다.

5. **데이터 모델**: diff 에 DB 스키마 변경이 없고, `Trigger` 엔티티의 `chat_channel_token_v2`/`chat_channel_rotated_at` 컬럼 의미는 `spec/1-data-model.md §2.8` 정의와 무변이다.

6. **RBAC**: 엔드포인트가 `TriggersController` 로 이전됐지만 `@WorkspaceId()` 데코레이터 사용과 `workspaceId` 파라미터 처리 방식이 유지돼 `spec/5-system/15-chat-channel.md §R-CC-18` 의 `400 WORKSPACE_ID_REQUIRED` 정책과 일치한다.

---

## 요약

C-2 리팩토링(순환 의존 해소)은 기능 계약·API 계약·데이터 모델·RBAC 어느 측면에서도 spec 과 직접 모순되지 않는다. `spec/data-flow/14-chat-channel.md` 와 `spec/data-flow/0-overview.md` 가 이미 새 구조(triggers 모듈 소유)를 반영하고 있어 data-flow 영역은 정합적이다. 유일한 미갱신 지점은 `spec/5-system/15-chat-channel.md` frontmatter `code:` 목록에 새 rotator 서비스 파일 경로 2종이 누락된 것이며, 이는 spec-coverage 도구의 탐지 오탐 방지용 동기화 권장 수준(INFO)이다. 별도 §7 파일 구조 표도 동기화가 권장되나 기능 정확도에 영향 없다.

---

## 위험도

LOW
