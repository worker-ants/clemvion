# Cross-Spec 일관성 검토 결과

검토 모드: 구현 완료 후 (--impl-done)
대상 plan: `plan/in-progress/web-chat-snippet-queue-stub.md`
diff-base: origin/main

---

## 발견사항

### [WARNING] spec 스니펫 예시에 queue stub 미반영 — 두 spec 문서가 구현과 불일치

- **target 위치**: `codebase/frontend/src/lib/web-chat/snippet.ts` — `QUEUE_STUB_JS` 상수 추가 및 `buildWebChatSnippet()` 의 첫 블록에 삽입. 코드 주석에 "spec 2-sdk §1 명령 큐 패턴 / Rationale R5" 를 참조로 명시.
- **충돌 대상 1**: `spec/7-channel-web-chat/2-sdk.md` §1 스니펫 예시 (line 24-28)
  queue stub(`window.ClemvionChat=...`) 행이 없다. 구현은 이 블록에 stub 을 추가했으나 spec §1 예시는 갱신되지 않았다.
- **충돌 대상 2**: `spec/7-channel-web-chat/5-admin-console.md` §5 설치 스니펫 (line 136-138)
  마찬가지로 queue stub 없음. 이 파일은 "출력(SoT: 2-sdk §1)" 라고 명시해 2-sdk §1 을 SoT 로 참조하므로 2-sdk 가 갱신되면 자동 정합되어야 하나, inline 예시 자체도 불일치 상태다.
- **충돌 대상 3**: 코드 주석이 "Rationale R5" 를 참조하지만 `spec/7-channel-web-chat/2-sdk.md` 에 R5 섹션이 존재하지 않는다(R2·R3·R4 까지만 있음). 이 참조는 dead link 다.
- **상세**: 구현이 `buildWebChatSnippet()` 출력에 queue stub 을 필수로 삽입했고, 프론트엔드 사용자 가이드 docs(.mdx 4개)도 stub 포함 예시로 갱신됐다. 그러나 두 spec 문서의 스니펫 예시는 여전히 stub 없는 형태라 spec-구현이 불일치한다. spec 이 스니펫 SoT 를 표방하므로(5-admin-console §5 상단 "출력(SoT: 2-sdk §1)") 이 불일치는 spec 을 읽는 독자에게 구현과 다른 스니펫을 기준으로 삼게 만든다.
- **제안**:
  1. `spec/7-channel-web-chat/2-sdk.md` §1 의 스니펫 블록에 queue stub 행 추가.
  2. `spec/7-channel-web-chat/5-admin-console.md` §5 의 인라인 스니펫 예시도 동일하게 갱신.
  3. `spec/7-channel-web-chat/2-sdk.md` Rationale 에 R5 섹션(queue stub 필요성 근거)을 추가하거나, 코드 주석의 "Rationale R5" 참조를 실제 존재하는 섹션으로 교정.

---

### [INFO] 프론트엔드 사용자 가이드 .mdx 가 spec 보다 먼저 갱신 — SDD 순서 역전

- **target 위치**: `codebase/frontend/src/content/docs/06-integrations-and-config/web-chat-sdk.en.mdx`, `web-chat-sdk.mdx`, `web-chat.en.mdx`, `web-chat.mdx` — stub 포함 스니펫으로 갱신.
- **충돌 대상**: `spec/7-channel-web-chat/2-sdk.md` §1, `spec/7-channel-web-chat/5-admin-console.md` §5.
- **상세**: .mdx 가이드 문서는 구현에 포함되어 스니펫을 업데이트했다. spec 이 갱신되지 않은 상태에서 가이드가 먼저 갱신됐으므로, spec-가이드 사이에도 일시적 불일치가 발생하고 있다. 가이드 변경 자체는 정합성 방향으로 진행됐으므로 블로커는 아니나, spec 을 SoT 로 선(先) 갱신하는 SDD 규약과 순서가 역전됐다.
- **제안**: WARNING 항목의 spec 갱신으로 함께 해소된다.

---

## 요약

이번 변경은 `buildWebChatSnippet()` 에 command-queue stub(`QUEUE_STUB_JS`)을 삽입하고 4개 .mdx 사용자 가이드에도 동일 stub 을 반영한 좁은 범위의 구현이다. 데이터 모델·API 계약·RBAC·상태 머신 영역에는 변경이 없으며 cross-spec 충돌은 발생하지 않는다. 다만 `spec/7-channel-web-chat/2-sdk.md §1` 과 `5-admin-console.md §5` 의 스니펫 예시가 구현과 불일치한 채 남아 있고, 코드가 참조하는 "Rationale R5" 가 해당 spec 에 존재하지 않는 것이 WARNING 급 동기화 누락이다. spec 갱신(stub 예시 추가 + R5 Rationale 신설)이 이루어지면 모든 불일치가 해소된다.

---

## 위험도

LOW
