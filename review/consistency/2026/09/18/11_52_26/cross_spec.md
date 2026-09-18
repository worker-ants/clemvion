# Cross-Spec 일관성 검토 — spec/2-navigation/ (impl-done)

## 검토 범위 및 전제

- scope(`spec/2-navigation/`) 델타: **0개 파일** — 이 PR 은 spec 을 바꾸지 않는다(plan frontmatter `spec_impact: none` 과 일치).
- 구현 diff 9개 파일 217줄은 전부 `codebase/backend/src/modules/{secret-store,triggers,workspaces}/**` 의 **주석·메서드 이름 정정**이다(`teardownChannelConfig` → `teardownRegisteredChannel`, JSDoc 문면 정정). 동작 변경 없음(plan 명시).
- 따라서 본 검토는 "target 이 새 계약을 도입해 다른 영역과 충돌하는가"가 아니라, **정정된 주석이 인용하는 spec 문면(§4.3 · secret-store.md §2.1/§5.3)과 실제 spec 텍스트가 일치하는가**를 중심으로 확인했다.

## 확인한 교차 참조 (결과: 모두 일치)

1. **`secret-resolver.service.ts` deleteByPrefix JSDoc** → "워크스페이스 단위 접두는 없다 — 워크스페이스 삭제도 트리거마다 이 함수를 부른다 (spec `secret-store.md` §2.1 · §5.3)". `spec/conventions/secret-store.md` §2.1(호출 규약 표) · §5.3(트리거 행이 없어질 때 — prefix 일괄 삭제) · §6("이 컬럼을 조건으로 지우는 경로는 두지 않는다") 을 직접 대조 — 문면과 일치.
2. **`trigger-config-lock.ts` `TRIGGER_DELETE_LOCK_TIMEOUT_MS` JSDoc** → "그 SoT 는 spec 트리거 목록 §4.3 의 자원 표". `spec/2-navigation/2-trigger-list.md` §4.3 의 "트리거 행을 없애는 모든 경로는 그 트리거의 자원을 정리한다" 표(자원/시점/이유)와 대조 — 일치. 외부 해제(행 삭제 전) vs `secret_store`(커밋 후) 2단 시점 서술도 코드 주석과 spec 표가 동일하게 갈린다.
3. **`trigger-workflow-ref.e2e-spec.ts` teardown JSDoc** → "그 정리는 트리거 행을 없애는 애플리케이션 삭제 경로(트리거·스케줄·워크플로·워크스페이스 삭제 — 커밋 뒤 `deleteByPrefix`)만 하고" / "그 경로(네 삭제 경로 → 커밋 뒤 `deleteByPrefix`, spec 트리거 목록 §4.3)는 R4 대로 동작한다". `secret-store.md` §6 의 "트리거 행이 없어지는 **모든 경로**(트리거·스케줄·워크플로·워크스페이스 삭제)" 및 트리거 목록 §4.3 의 "경로는 트리거 화면 삭제 · 스케줄 화면 삭제 · 워크플로·워크스페이스 삭제" 서술과 개수(4)·목록이 일치.
4. **메서드 rename (`teardownChannelConfig` → `teardownRegisteredChannel`)**: `spec/**` 전체를 grep 했으나 옛 이름을 인용하는 spec 문서는 없다(0건) — spec 이 코드 식별자를 직접 인용하지 않으므로 rename 이 spec-doc 참조를 stale 하게 만들지 않는다. 유지되는 `teardownChatChannel`(공개 메서드, rename 대상 아님)을 인용하는 `spec/data-flow/14-chat-channel.md:29` 도 그대로 유효.
5. **`spec/2-navigation/2-trigger-list.md` frontmatter `code:`**: `trigger-resource-release.ts` / `trigger-resource-releaser.service.ts` 둘 다 이미 등재되어 있어, 이번 diff 가 건드린 파일이 target spec 의 시행 코드 목록 밖으로 벗어나지 않는다.

## 데이터 모델 / API 계약 / 요구사항 ID / 상태 전이 / RBAC / 계층 책임

- 이번 diff 는 엔티티·필드·endpoint·request/response shape·요구사항 ID·상태 머신·권한 규칙을 하나도 바꾸지 않는다(순수 주석 + private 메서드 rename). 위 6개 관점에서 신규 충돌을 만들 표면 자체가 없다.
- 계층 책임 관점: rename 은 `ChatChannelBinderService` 내부에서 "저장된 config 로 해제"(`teardownChatChannel`)와 "넘겨받은 config 로 해제"(`teardownRegisteredChannel`, 신규 이름)의 책임 분리를 **이름으로 명확히** 한 것 — 기존에도 존재하던 두 갈래 책임(트리거 목록 §4.3 / secret-store.md §5.3 이 요구하는 "저장된 config" vs "보상 경로의 이번 요청 config") 분담과 일치하며, 오히려 이전보다 spec 의 의도를 코드 이름이 더 잘 반영한다.

## 요약

이 PR 은 `spec/2-navigation/` 에 대한 델타가 없고, 변경된 217줄은 전부 `#1346`(트리거 자원 정리 구현) 머지 뒤 낡거나 틀려진 코드 주석·내부 메서드 이름 하나를 정정하는 것으로 동작을 바꾸지 않는다. 정정된 주석이 인용하는 `spec/2-navigation/2-trigger-list.md §4.3` 과 `spec/conventions/secret-store.md §2.1/§5.3/§6` 을 직접 대조한 결과 문면과 정확히 일치하며, rename 된 메서드명을 인용하는 spec 문서도 없어(0건) 문서 참조 stale 화가 발생하지 않는다. 데이터 모델·API 계약·요구사항 ID·상태 전이·RBAC·계층 책임 어느 관점에서도 target 영역과 다른 spec 영역 사이의 신규 충돌을 발견하지 못했다.

## 위험도

NONE
