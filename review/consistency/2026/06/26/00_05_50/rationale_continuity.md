# Rationale 연속성 검토 결과

## 검토 대상

- **Target**: `plan/in-progress/web-chat-snippet-queue-stub.md` (구현 완료 후 검토)
- **Diff 범위**: `codebase/frontend/src/lib/web-chat/snippet.ts`, `snippet.test.ts`, 유저 가이드 4파일 (`web-chat.mdx` 외)
- **관련 Spec**: `spec/7-channel-web-chat/2-sdk.md` (및 동 폴더 전체)

---

## 발견사항

### [INFO] spec 2-sdk.md §1 스니펫 예시는 worktree 내에서 이미 갱신됨 — 확인 완료

- target 위치: `plan/in-progress/web-chat-snippet-queue-stub.md §수정` 항목 2
- 과거 결정 출처: `spec/7-channel-web-chat/2-sdk.md §1` 스니펫 예시 (origin/main 기준 큐 스텁 누락)
- 상세: plan 은 "spec §1 예시도 수정" 을 명시했고, 실제로 worktree 의 `spec/7-channel-web-chat/2-sdk.md §1` 에 큐 스텁이 추가됐으며 R5 Rationale 도 신설됐다. origin/main 의 spec §1 예시에는 스텁이 없었으나 이는 의도된 drift 수정이다.
- 제안: 추가 조치 불필요. spec 과 구현·문서가 일치한다.

### [INFO] QUEUE_STUB_JS 코드 주석의 "Rationale R5" 참조가 spec 2-sdk.md R5 와 정합

- target 위치: `codebase/frontend/src/lib/web-chat/snippet.ts` — `QUEUE_STUB_JS` JSDoc `(spec 2-sdk §1 명령 큐 패턴 / Rationale R5)`
- 과거 결정 출처: `spec/7-channel-web-chat/2-sdk.md ## Rationale` — origin/main 에는 R2·R3·R4 까지만 존재, R5 없음
- 상세: 구현 코드 주석이 "R5" 를 참조하나 worktree 에서 spec 에 R5 가 신설됐으므로 참조가 유효하다. 다만 origin/main 에는 아직 R5 가 없는 상태이므로 spec 변경이 함께 PR 되어야 참조 무결성이 보장된다. worktree 에서 spec 도 함께 변경했으므로 같은 PR 로 머지되면 문제없다.
- 제안: spec 변경을 동일 PR 에 포함 확인 — diff 에는 spec 파일이 빠져 있으나 worktree 에 변경이 이미 존재한다. PR 시 `spec/7-channel-web-chat/2-sdk.md` 를 스테이징에 포함해야 한다.

---

## 기각된 대안·합의 원칙 위반 검토 결과

**기각된 대안 재도입 없음.** origin/main spec 2-sdk.md 의 Rationale(R2·R3·R4)은 각각 (R2) CDN+npm 이중 제공, (R3) SPA cleanup/전역명 opt-in, (R4) show/hide vs open/close 분리 결정이다. 이번 변경은 이 세 결정 중 어느 것도 뒤집지 않는다. 큐 스텁 추가는 R2 의 "단일 코어 공유" 원칙과 정합하며, loader.js 가 이미 `.q` replay 를 구현한 상태에서 스니펫 쪽 스텁만 누락된 버그를 수정하는 것이다.

**합의 원칙 위반 없음.** `spec/7-channel-web-chat/0-architecture.md R5` 의 "EIA client-consumer 로 한정, 신규 facade 미신설" 원칙은 이 변경과 무관하다. `spec/7-channel-web-chat/0-architecture.md R7` 의 "v1 단일 iframe" 결정도 영향받지 않는다. 스니펫 생성 함수(`buildWebChatSnippet`)와 문서의 HTML 블록만 수정됐으며 아키텍처·브리지·상태기계는 불변이다.

**암묵적 invariant 충돌 없음.** `spec/7-channel-web-chat/2-sdk.md §1` 본문이 이미 "명령 큐 패턴"을 단일 전역 진입점의 특성으로 명시하고 있었다(`loader.js 책임: … 명령 큐(boot 전 호출 버퍼링)`). 큐 스텁은 그 명세의 구현 전제이지 새 원칙이 아니다. 이번 수정은 spec 이 약속한 invariant 를 코드·문서에서 복원한 것이다.

**새 Rationale 함께 작성됨.** worktree 의 `spec/7-channel-web-chat/2-sdk.md` 에 R5 가 신설돼 "스텁을 생략할 수 없는 이유"와 "세 경로 모두 포함해야 하는 이유" 가 명문화됐다. 결정 번복이 아니라 기존 §1 명세의 필수 전제를 Rationale 로 승격한 것이다.

---

## 요약

이번 구현은 `spec/7-channel-web-chat/2-sdk.md §1` 이 이미 묘사한 "명령 큐 패턴" 의 전제 조건(큐 스텁 동기 설치)을 코드·유저 가이드에 실제로 반영한 버그 수정이다. 기존 Rationale(R2~R4)이 정의한 어떤 결정도 번복하지 않으며, 기각됐던 대안을 재도입하지 않는다. 신규 R5 Rationale 도 worktree 내 spec 에 함께 추가돼 결정 근거가 명문화됐다. Rationale 연속성 관점에서 위반 또는 충돌은 발견되지 않았다. 단, PR 시 `spec/7-channel-web-chat/2-sdk.md` 변경도 포함돼야 코드 주석의 `Rationale R5` 참조가 main 브랜치에서 유효해진다 — 현재 worktree 에는 이미 존재한다.

---

## 위험도

NONE
