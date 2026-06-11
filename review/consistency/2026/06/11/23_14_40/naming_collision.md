# 신규 식별자 충돌 Check 결과

**검토 모드**: 구현 완료 후 검토 (--impl-done, scope=spec/4-nodes/4-integration/, diff-base=origin/main)

---

## 발견사항

### [WARNING] `HTTP_BLOCKED` 코드가 `spec/5-system/3-error-handling.md` HTTP 카테고리 목록에 미등재

- **target 신규 식별자**: `HTTP_BLOCKED` (에러 코드 — SSRF 차단, `output.error.code`)
- **기존 사용처**: `/Volumes/project/private/clemvion/spec/5-system/3-error-handling.md` §1.4 "노드 수준 런타임 에러" HTTP 카테고리 표 (line 79): `HTTP_TRANSPORT_FAILED · HTTP_4XX · HTTP_5XX · HTTP_TIMEOUT`
- **상세**: `HTTP_BLOCKED` 는 target(`1-http-request.md`) 에서 D4 기준으로 이미 사용되고 있지만, `3-error-handling.md` 의 HTTP 카테고리 정식 목록에 누락되어 있다. 목록에는 `HTTP_TIMEOUT` 은 있으나 `HTTP_BLOCKED` 는 없다. 두 spec 이 코드 목록 불일치 상태.
- **제안**: `3-error-handling.md` §1.4 HTTP 카테고리 행에 `HTTP_BLOCKED` (SSRF 차단) 추가. `HTTP_TIMEOUT` 과 `HTTP_BLOCKED` 모두 HTTP 카테고리에 포함되어야 목록이 완결된다.

---

### [WARNING] `HTTP_BLOCKED` 코드가 `spec/conventions/chat-channel-adapter.md` 분류 표에 미등재

- **target 신규 식별자**: `HTTP_BLOCKED`
- **기존 사용처**: `/Volumes/project/private/clemvion/spec/conventions/chat-channel-adapter.md` §3.1 "execution-failed 분류 알고리즘" 표 (line 381): `HTTP_TIMEOUT` 행은 존재하나 `HTTP_BLOCKED` 행은 없음. `3-error-handling.md` §1.4의 주석은 "본 enum 확장 시 분류 표 행 추가 검토 의무" 라고 명시.
- **상세**: `HTTP_BLOCKED` 가 `error` 포트로 라우팅되어 실행 실패 분류 로직의 입력이 될 때, chat-channel-adapter 분류 표에 매핑이 없으면 `executionFailedUnknown` 혹은 fallback 으로 처리된다. SSRF 차단은 사용자에게 timeout 과 다른 안내를 줄 수 있으므로 분류 행 추가가 필요하다.
- **제안**: `chat-channel-adapter.md` §3.1 표에 `HTTP_BLOCKED` → 적절한 사용자 안내 메시지 카테고리(예: `executionFailedNetwork` 또는 신규 `executionFailedBlocked`) 매핑 행 추가 검토.

---

### [WARNING] `spec/5-system/3-error-handling.md` HTTP 목록에 `HTTP_TIMEOUT` 은 있으나 target 1-http-request 에는 `HTTP_TIMEOUT` 정의 없음 (역방향 불일치)

- **target 신규 식별자**: 해당 없음 (target 에서 `HTTP_TIMEOUT` 를 **제거/미정의** 하고 있다)
- **기존 사용처**: `/Volumes/project/private/clemvion/spec/5-system/3-error-handling.md` line 79 및 222, `/Volumes/project/private/clemvion/spec/conventions/chat-channel-adapter.md` line 381
- **상세**: `3-error-handling.md` 와 `chat-channel-adapter.md` 는 `HTTP_TIMEOUT` 을 HTTP 카테고리 코드로 등재하고 있다. 그러나 target 의 `1-http-request.md` (§6 에러 코드 표) 에는 `HTTP_TIMEOUT` 이 없고, timeout 은 `HTTP_TRANSPORT_FAILED` (`fetch` reject / `AbortController` timeout) 로 통합되어 있다. 즉 `HTTP_TIMEOUT` 이라는 독립 코드의 실체 여부가 두 spec 군 간에 상충한다. 충돌이지만 target 이 새로 도입한 식별자가 아니라 기존 식별자가 target 에서 누락된 방향이므로 역방향 불일치.
- **제안**: `3-error-handling.md` 와 `chat-channel-adapter.md` 에서 `HTTP_TIMEOUT` 이 독립 코드로 존재하는지 `error-codes.ts` 를 기준으로 확인한 뒤, 실제 없다면 두 외부 spec 에서 `HTTP_TIMEOUT` 을 `HTTP_TRANSPORT_FAILED` 로 통합하거나, 실제 있다면 target 에서 누락을 보완해야 한다.

---

### [INFO] frontmatter `id: common` 이 여러 카테고리 폴더에 중복 사용됨

- **target 신규 식별자**: `id: common` (`spec/4-nodes/4-integration/0-common.md` frontmatter)
- **기존 사용처**: `/Volumes/project/private/clemvion/spec/4-nodes/1-logic/0-common.md`, `3-ai/0-common.md`, `5-data/0-common.md`, `7-trigger/0-common.md`, `2-flow/0-common.md` 모두 `id: common`
- **상세**: `id: common` 은 카테고리 내부 기술 공통 규약 파일의 관용적 식별자로 이미 전 카테고리에서 동일하게 사용 중이다. target 이 새로 도입한 것이 아니라 기존 패턴을 따른 것이므로 의미 충돌은 없다. 그러나 도구/자동화가 전역 유일 id 를 가정한다면 혼동이 발생할 수 있다.
- **제안**: 현재 관용적 중복 패턴으로 다른 카테고리와 동형이므로 즉각 조치 불필요. 도구 수준에서 전역 id 유일성을 강제할 계획이 있다면 `integration-common` 등 카테고리-prefix 방식으로 통일 검토.

---

### [INFO] `ALLOW_PRIVATE_HOST_TARGETS` 의 SSRF 범위 설명이 origin/main 의 `1-http-request.md` 와 target 간 의미 불일치

- **target 신규 식별자**: `ALLOW_PRIVATE_HOST_TARGETS` 의 적용 범위를 "전 인증 방식 공통" 으로 확장
- **기존 사용처**: `/Volumes/project/private/clemvion/spec/4-nodes/4-integration/1-http-request.md` (origin/main, line 96): `8. SSRF 가드 (authentication='integration' 일 때만)`
- **상세**: origin/main 의 `1-http-request.md` §4 step 8 은 SSRF 가드를 `authentication='integration'` 에만 적용한다고 명시한다. target 은 이를 "`none` / `integration` / `custom` 모두" 로 확장한다. 환경변수 식별자 자체(`ALLOW_PRIVATE_HOST_TARGETS`)의 중복이 아니라, 동일 식별자에 대한 적용 범위 의미가 두 버전 간 달라지는 것이다. worktree 에 spec 파일이 갱신된 것이라면 충돌이 아니라 의도된 갱신이므로, merge 시 origin/main 의 구 정의가 완전히 교체되는지 확인이 필요하다.
- **제안**: target 이 origin/main `spec/4-nodes/4-integration/1-http-request.md` 를 덮어쓰는 것이 맞다면 충돌 없음. merge 후에도 origin/main 버전의 구 정의(line 96 의 "integration 일 때만")가 다른 spec/convention 파일에 복사·인용된 곳이 없는지 확인 (`spec/5-system/3-error-handling.md` line 81 은 이미 `HTTP_BLOCKED` + `EMAIL_HOST_BLOCKED` 로 일관성 있게 업데이트되어 있어 안전).

---

## 요약

target(`spec/4-nodes/4-integration/`) 이 도입·변경하는 식별자 중 타 영역과 의미 충돌하는 경우는 발견되지 않았다. 주요 에러 코드(`HTTP_BLOCKED`, `EMAIL_HOST_BLOCKED`, `INVALID_PARAMETERS`, `INTEGRATION_AUTH_UNSUPPORTED`, `DB_*`, `EMAIL_*`)는 모두 기존 카탈로그(`error-codes.ts`, `3-error-handling.md`)와 동일 의미로 사용되거나 신규 추가로 구분된다. Redis 채널 `integration:cache:invalidate` 와 환경변수 `ALLOW_PRIVATE_HOST_TARGETS` 도 기존 spec(`0-overview.md`, `4-execution-engine.md`, `data-flow/5-integration.md`)에서 이미 같은 의미로 정의된 식별자를 재사용하고 있다. 다만 (1) `HTTP_BLOCKED` 가 `3-error-handling.md` HTTP 목록에 미등재, (2) `3-error-handling.md`·`chat-channel-adapter.md` 에 `HTTP_TIMEOUT` 등재 vs target 에 해당 코드 미정의 역방향 불일치, (3) `HTTP_BLOCKED` 가 `chat-channel-adapter.md` 분류 표에 누락된 세 가지 문서 간 불일치가 WARNING 수준으로 존재한다.

## 위험도

MEDIUM
