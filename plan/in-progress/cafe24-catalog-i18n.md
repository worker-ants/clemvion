---
worktree: cafe24-catalog-i18n
started: 2026-05-28
owner: planner-developer
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

- [ ] dict/ko/cafe24Catalog.ts 적재 — backend metadata.label → key/value 매핑
- [ ] dict/en/cafe24Catalog.ts 영문 번역
- [ ] i18n parity 가드 + hardcoded-korean-ratchet 가드 통과
- [ ] ActivityTab 수동 검증 + 가능하면 단위 test 추가
- [ ] backend metadata 의 한국어 `label` 필드 deprecate 처리 (선택적)
- [ ] plan complete 이동
