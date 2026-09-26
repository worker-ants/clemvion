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

## 검토 경고 처리

| 출처 | 지적 | 처분 |
| --- | --- | --- |
| `--impl-prep` `16_14_14` **Critical** | PRD `_product-overview.md` §10.4 ED-AI-19 는 표기 없이, 상세 spec `4-ai-assistant.md` §12.2 는 «(계획) 미구현» — 이 작업과 무관한 기존 모순 | 실측(`ASSISTANT_WORKFLOW_RUNNING` 0건 · 프론트 분기 없음)으로 상세 spec 이 맞음을 확인하고 **planner 턴**으로 PRD 행에 미구현 표기(`802bd61d5`, draft `plan/in-progress/spec-draft-ed-ai-19-status.md`, `--spec` `16_27_26` BLOCK: NO). 우회(검사 범위에서 PRD 빼기)는 하지 않았다 |
| `--impl-prep` `16_14_14` W1 · W2 | §6 표 `sessions/latest` 누락 · §6 RBAC 일괄 서술 | 이미 트래커 planner 항목 |
| `--impl-prep` `16_14_14` W3~W6 · `--spec` `16_27_26` W2 | frontmatter 상태 · 에러 카탈로그 · SSE 봉투 · 배지 i18n · 상위 문서 «전체 구현 완료» | 트래커 한 항목 «`4-ai-assistant.md` 규약 위생 일곱 칸» |
| `--impl-prep` `16_35_16` W1 | §6 표 `sessions/latest` · Rationale «REST API 5개» | 기존 §6 항목에 «5개 → 6개» 덧붙임 |
| `--impl-prep` `16_35_16` W2 · W3 | §4.4 표 `PORT_NOT_FOUND` 누락 · §7 «두 코드» 전칭 | 규약 위생 항목의 6 · 7 칸 |

## 체크리스트

- [x] `--impl-prep` — 첫 라운드 `review/consistency/2026/09/26/16_14_14` BLOCK: YES(위 Critical) → planner 턴 뒤 `16_35_16` BLOCK: NO
- [x] e2e 세 칸
- [x] 공허성 확인 — 도구 호출 «전부 뺌» 원소가 실제로 가르는지 검증자 프로브(H 와 같은 payload)로 봤다:

  | 조건 | 전부 채움 + 전부 뺌 | 전부 채움만(종전) |
  | --- | --- | --- |
  | 원본 DTO | 위반 0 | 위반 0 |
  | 뮤턴트 — `planStepId` 를 `@ApiProperty()`(필수)로 | **`missing messages[0].toolCalls[1].planStepId`** | 위반 0 — 종전 fixture 로는 살아남는다 |

  «선택 키를 필수로 잘못 선언» 하는 회귀는 전부 뺀 원소만 잡는다. F 의 `toStrictEqual({ data: null })` 과 `toBe(sessionId)` 는 값을 그대로
  단언해 제3상태가 없다.
- [x] TEST WORKFLOW (lint · unit · build · e2e) — 전부 PASS(e2e 412 — 새 `it` 없이 F · H 를 고쳐 건수는 그대로)
- [ ] `/ai-review`
- [ ] 트래커 항목 닫기
