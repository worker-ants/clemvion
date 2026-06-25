# Cross-Spec 일관성 검토 결과

target: `plan/in-progress/web-chat-snippet-queue-stub.md` (구현 완료 후 검토, --impl-done)
diff-base: origin/main

---

## 발견사항

### [WARNING] `spec/7-channel-web-chat/2-sdk.md §1` 스니펫 예시가 구현과 불일치 — queue stub 누락

- **target 위치**: 구현 diff — `codebase/frontend/src/lib/web-chat/snippet.ts` (QUEUE_STUB_JS 상수 추가) + 4개 mdx 유저 가이드 파일 스니펫 갱신
- **충돌 대상**: `/Volumes/project/private/clemvion/spec/7-channel-web-chat/2-sdk.md §1` (스니펫 로더 예시 코드 블록)
- **상세**: 구현은 `QUEUE_STUB_JS`(`window.ClemvionChat=window.ClemvionChat||function(){(window.ClemvionChat.q=window.ClemvionChat.q||[]).push(arguments)};`)를 로더 IIFE 안 첫 줄에 삽입한다. 그러나 `spec/7-channel-web-chat/2-sdk.md §1`의 스니펫 예시 코드 블록(line 23-42)은 여전히 queue stub 없이 `(function(d,s){var j=d.createElement(s);j.async=1; ...` 형태 그대로다. plan 문서(`plan/in-progress/web-chat-snippet-queue-stub.md §수정 항목 2`)에서 spec 갱신을 명시했으나 실제 diff에 spec 변경이 없다. spec이 "명령 큐 패턴"을 산문(line 43)으로 언급하지만 예시 코드가 그 패턴을 보여주지 않아 산문과 예시가 모순된다.
- **제안**: `spec/7-channel-web-chat/2-sdk.md §1` 스니펫 코드 블록에 queue stub 라인을 추가하고, Rationale 절에 R5(명령 큐 스텁 필수 이유)를 신설해야 한다 (코드 주석이 "spec 2-sdk §1 명령 큐 패턴 / Rationale R5"를 참조하는데 해당 R5가 spec에 존재하지 않음).

---

### [WARNING] `spec/7-channel-web-chat/5-admin-console.md §5` 설치 스니펫 예시가 구현과 불일치

- **target 위치**: 구현 diff — `snippet.ts` `buildWebChatSnippet` 반환값 형태 변경
- **충돌 대상**: `/Volumes/project/private/clemvion/spec/7-channel-web-chat/5-admin-console.md §5` (line 136-145) — 설치 스니펫 예시
- **상세**: `5-admin-console.md §5`는 설치 스니펫 예시를 직접 포함하며 `"출력(SoT: [2-sdk §1](./2-sdk.md))"` 라고 명시한다. 해당 예시도 queue stub 없이 `(function(d,s){var j=d.createElement(s);j.async=1; ...` 형태다. `2-sdk.md §1`이 SoT로 지정되어 있으나 `2-sdk.md §1` 자체가 미갱신이므로 두 spec 파일 모두 구현과 불일치 상태다. 운영자가 admin-console spec을 보고 스니펫 형식을 파악하려 할 때 실제 생성 스니펫과 다른 예시를 보게 된다.
- **제안**: `spec/7-channel-web-chat/5-admin-console.md §5` 스니펫 예시에도 queue stub 라인을 반영하거나, "SoT: 2-sdk §1" 참조를 강조해 직접 예시를 제거(중복 관리 방지)해야 한다.

---

### [INFO] `snippet.ts` 코드 주석이 존재하지 않는 "Rationale R5"를 참조

- **target 위치**: `codebase/frontend/src/lib/web-chat/snippet.ts` — QUEUE_STUB_JS JSDoc 주석 (`spec 2-sdk §1 명령 큐 패턴 / Rationale R5`)
- **충돌 대상**: `/Volumes/project/private/clemvion/spec/7-channel-web-chat/2-sdk.md §Rationale` — R2·R3·R4만 존재, R5 없음
- **상세**: 코드가 참조하는 "Rationale R5"가 `2-sdk.md`에 없다. 다른 spec 파일(`1-widget-app.md`, `0-architecture.md`, `5-admin-console.md`, `3-auth-session.md`)에 각자의 R5가 있지만 `2-sdk.md`의 R5는 빈 슬롯이다. 코드 참조가 dead link 상태.
- **제안**: `spec/7-channel-web-chat/2-sdk.md`에 `### R5. 명령 큐 스텁(command-queue stub) — async 로더 전 boot 호출 버퍼링` Rationale을 신설하거나, 코드 주석을 실제 존재하는 섹션(예: §1 산문)으로 수정한다.

---

## 요약

이번 구현(web-chat-snippet-queue-stub)은 코드(`snippet.ts`)와 유저 가이드 mdx 4파일에 queue stub를 올바르게 추가했으나, plan 문서에서 명시적으로 요구한 spec 갱신(`spec/7-channel-web-chat/2-sdk.md §1` 예시 코드 + Rationale R5 신설)이 diff에 포함되지 않았다. 그 결과 `2-sdk.md §1`과 `5-admin-console.md §5`의 스니펫 예시가 실제 생성 스니펫과 불일치하며, 코드 주석이 존재하지 않는 `Rationale R5`를 참조하는 dead link 상태가 발생했다. spec이 SoT 역할을 하지 못하는 상황이므로 spec 2곳 갱신이 필요하다. 기능 동작(ReferenceError 수정) 자체는 정상 구현되었으며, 기존 spec 다른 영역(데이터 모델·API 계약·RBAC·상태 전이·계층 책임)과의 충돌은 없다.

## 위험도

MEDIUM
