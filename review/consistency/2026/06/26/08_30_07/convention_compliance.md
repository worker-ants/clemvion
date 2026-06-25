# 정식 규약 준수 검토 결과

**검토 모드**: 구현 완료 후 검토 (--impl-done)
**Target**: `plan/complete/web-chat-loader-iframe-position.md`
**diff-base**: origin/main
**검토일**: 2026-06-26

---

## 발견사항

### INFO: `title` 및 `status` 필드는 plan 규약에서 허용된 선택 필드

- **target 위치**: frontmatter — `title: 웹채팅 로더 — ...`, `status: complete`
- **위반 규약**: `plan-lifecycle.md §4` — 필수 필드는 `worktree`·`started`·`owner` 3개뿐. `title`·`status` 는 "priority/status/title 등 추가 필드 허용" 범주
- **상세**: 규약에서 명시 허용된 추가 필드이므로 위반 아님. 현행 유지가 적절.
- **제안**: 현행 유지.

### INFO: `related_spec` 필드는 규약 미정의 비표준 필드로 `spec_impact` 와 값 중복

- **target 위치**: frontmatter 9~10행 — `related_spec: - spec/7-channel-web-chat/2-sdk.md`
- **위반 규약**: `plan-lifecycle.md §4` + `spec-impl-evidence.md §4.2 Gate C` — 규약이 정의하는 완료 plan frontmatter 추가 필드에 `related_spec` 은 없음. Gate C 는 `spec_impact` 만 정의.
- **상세**: `spec_impact` 와 동일 경로(`spec/7-channel-web-chat/2-sdk.md`)를 `related_spec` 이라는 별도 키로 중복 선언하고 있다. `plan-lifecycle.md §4` 는 추가 필드를 금지하지 않아 형식 위반은 아니지만, 규약에 정의되지 않은 키가 `spec_impact` 와 의미·값이 겹쳐 문서 독자에게 두 필드의 차이를 혼동시킬 수 있다. 파싱 가드(`spec-plan-completion.test.ts`)는 `spec_impact` 만 읽어 동작에는 영향이 없다.
- **제안**: `related_spec` 필드를 제거하고 `spec_impact` 단독으로 유지. 두 필드를 구분하는 의미가 있다면 `plan-lifecycle.md §4` 에 정의를 추가해 공식화할 것.

---

## 규약 준수 요약

`plan/complete/web-chat-loader-iframe-position.md` 는 정식 규약(`plan-lifecycle.md §4`, `spec-impl-evidence.md §4.2 Gate C`)을 전반적으로 준수하고 있다. 필수 frontmatter 3필드(`worktree`·`started`·`owner`) 모두 존재하고 형식도 올바르며, Gate C 의무(`spec_impact`) 또한 실존 spec 경로(`spec/7-channel-web-chat/2-sdk.md`)를 가리키는 유효한 선언이다. 구현 diff 에서 드러난 코드 변경(`bridge.ts`, `index.ts`, 양 spec 파일)은 `spec_impact` 선언 범위와 일치한다. 발견된 두 항목은 모두 INFO 등급으로 — 하나는 규약이 명시 허용하는 선택 필드(`title`/`status`), 다른 하나는 규약 미정의 중복 필드(`related_spec`)로 동작상 문제 없으나 정보 중복으로 인한 혼동 여지가 있다.

## 위험도

NONE
