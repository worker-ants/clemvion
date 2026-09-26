---
title: workflow-assistant e2e 의 남은 계약 대조 세 칸 — latest 의 null · 테스트 F 상태 단언 · 도구 호출 선택 키 생략
status: in-progress
owner: developer
worktree: assistant-e2e-contract-gaps
spec_impact: none
started: 2026-09-26
---

# workflow-assistant e2e — 남은 계약 대조 세 칸

트래커 `plan/in-progress/spec-draft-nullable-notation-followups.md` 항목 «workflow-assistant e2e 의 남은 계약 대조 세 칸» 을 닫는다
(`/ai-review` `review/code/2026/09/26/14_07_11` INFO7 · 8 · 9). `success-advert`(#1405)가 붙인 응답 DTO 를
`codebase/backend/test/workflow-assistant.e2e-spec.ts` 가 대조하는데 세 칸이 비어 있다. 테스트만 바뀐다 — 제품 코드 · spec 변경 없음.
이 e2e 파일은 어떤 spec 의 `code:` 에도 등재되지 않았다(`review_guard._spec_linked_changes` 실측 — 빈 목록).

## 실측 (2026-09-26)

- `sessions/latest` 는 `findLatestActive` — 같은 사용자 · 워크스페이스 · 워크플로의 `status: 'active'` 세션을 `lastInteractionAt` 내림차순으로
  하나 고른다. 생성은 `lastInteractionAt: now` 를 싣는다. 없으면 `null` 을 반환하고 `TransformInterceptor` 가 `{ data: null }` 로 싼다.
- 테스트 F 는 조회 직전에 세션을 만들어 **늘 «있음» 분기**만 탄다. 상태는 `[200, 204, 404]` 를 받는데 이 컨트롤러는 200 만 낸다.
- 테스트 H 의 도구 호출은 선택 키(`result` · `planStepId` · `planStepIds` · `signature`)를 **전부 채운** 하나뿐이다.

## 처방

1. **`data: null`** — 세션이 없는 새 워크플로로 `sessions/latest` 를 물어 `{ data: null }` 을 본다(`ApiOkWrappedNullableResponse` 의 null 쪽).
2. **테스트 F** — `toBe(200)` 로 좁히고 조건 분기를 걷는다. 돌아온 세션이 **방금 만든 그 세션**인지 id 로 본다 — `:id` 라우트가
   `latest` 를 가로채는 라우트 순서 회귀(`sessions/:id` 가 먼저 매칭되면 `ParseUUIDPipe` 가 400)도 이 단언이 가른다.
3. **도구 호출 선택 키 생략** — H 의 assistant 메시지에 선택 키를 전부 뺀 도구 호출을 하나 더 넣는다. 검증자는 배열 원소마다 내려가므로
   두 끝(전부 채움 · 전부 생략)이 같은 대조에 걸린다.

CHANGELOG 없음 — 한 기능의 동작을 고정하는 테스트 추가(가드가 아닌 커버리지)는 항목을 내지 않는다(`CHANGELOG.md` 기준 머리말).

## 체크리스트

- [ ] `--impl-prep`
- [ ] e2e 세 칸
- [ ] 공허성 확인 — 각 단언이 실제로 가르는지(뮤턴트 · 프로브)
- [ ] TEST WORKFLOW (lint · unit · build · e2e)
- [ ] `/ai-review`
- [ ] 트래커 항목 닫기
