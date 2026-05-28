---
worktree: cafe24-catalog-i18n-stacked
started: 2026-05-28
owner: developer
parent_branch: claude/integration-activity-api-label-ed0a6e
---

# Cafe24 catalog 라벨 i18n 채우기 (follow-up)

## 배경

`plan/in-progress/integration-activity-api-label.md` 에서 통합 활동 로그의 `apiLabel` (`cafe24.<resource>.<operation>`) → 사람 친화 라벨 변환 인프라를 도입했다. 그 PR 에서:

- backend metadata `Cafe24OperationMetadata.label` 은 한국어 hardcoded ('주문 목록 조회' 등)
- catalog endpoint (`GET /api/integrations/services/cafe24/catalog`) 는 `labelKey` (catalog key 와 동일) 만 노출
- frontend dict `dict/{ko,en}/cafe24Catalog.ts` 는 빈 dict 로 도입 — i18n parity 가드만 통과

→ ActivityTab 에서 cafe24 호출도 endpoint subtext (`GET /admin/orders`) 한 줄로만 표시되고 사람 친화 라벨 (`주문 목록 조회`) 은 미노출.

## 작업 범위

1. 100+ cafe24 operation 의 KO 라벨을 backend metadata 의 `label` 필드에서 추출해 `dict/ko/cafe24Catalog.ts` 에 적재
2. 동일 키 set 의 EN 번역을 `dict/en/cafe24Catalog.ts` 에 추가 (cafe24 docs 의 영문 endpoint summary 참조)
3. backend metadata 의 한국어 `label` 필드는 한 차례에 모두 옮긴 후 deprecate 표시 (소비처가 i18n dict 로 일원화되면 제거 가능)
4. i18n parity 가드 + hardcoded-korean-ratchet 가드 통과 확인
5. ActivityTab UI 의 라벨+endpoint subtext 2줄 렌더가 cafe24 호출에서 정상 동작 확인 (수동 + 가능하면 단위 test)

## 비고

- 본 plan 은 분기 시점 (2026-05-28) 에 cafe24 metadata 가 18 카테고리, 100+ operation 을 보유. 신규 operation 이 추가되면 같은 PR 안에서 i18n dict 도 동반 갱신해야 한다.
- 라벨이 빈 dict 로 도입된 상태에서도 ActivityTab 의 endpoint-only fallback 으로 API 식별은 충분히 가능 — 본 follow-up 은 UX 개선 측면. blocking 아님.

## Phase

- [x] dict/ko/cafe24Catalog.ts 적재 — backend metadata.label 에서 정규식 추출, 500 operations (18 카테고리)
- [x] dict/en/cafe24Catalog.ts 영문 번역 — operation.id (snake_case) → verb-first phrasing (e.g. orders_list → "List orders")
- [x] i18n parity 가드 통과 (ko/en 동일 500 keys), ratchet 영향 없음 (TSX 외 .ts dict 파일은 ratchet 검사 대상 아님)
- [x] TEST WORKFLOW 통과: lint 27s / unit 32s 4975 tests / build 58s / e2e 47s 123 tests
- [ ] backend metadata 의 한국어 `label` 필드 deprecate 처리 — 본 PR scope 밖, 별 follow-up 으로 분리 (소비처는 MCP tool description 자동 생성에서 여전히 사용 중이라 단순 제거 불가, 신규 plan 필요)
- [x] plan complete 이동

## 작업 후 결정

- backend metadata `Cafe24OperationMetadata.label` 의 한국어 hardcoded 는 본 PR 에서 제거하지 않음. MCP bridge (`Cafe24McpBridge.buildTools`) 가 LLM 의 tool description 에 그대로 사용 중이라, frontend i18n dict 와 별개의 소비처를 가진다. label 일원화는 backend metadata 의 label 을 i18n key 로 바꾸고 MCP bridge 가 lookup 하는 별 plan 으로 분리.
- ActivityTab 단위 test 추가는 본 PR 의 mechanical 한 dict 적재 변경 범위 밖. 별 follow-up 가능.
