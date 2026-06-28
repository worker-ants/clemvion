# RESOLUTION — 11_17_48

리뷰 세션: `review/code/2026/06/28/11_17_48`
대상 PR: #745 (`claude/ai-mem-admin-rebase-df13f9`) — agent-memory Batch 3 rebase 후 재검토

---

## 조치 항목

### WARNING 6건 — 전부 DEFERRED (out-of-scope)

| SUMMARY # | 분류 | 조치 | 비고 |
|-----------|------|------|------|
| W1 | 보안 / endpointPath UUID | DEFERRED — out-of-scope | webhook 트랙 (#738/#748/#750). endpointPath mutable 은 알려진 반복 오탐 — 코드/spec 변경 금지 |
| W2 | 보안 / 멤버 Delete RBAC | DEFERRED — out-of-scope | user-profile 트랙 (`spec/5-system/1-auth.md` vs `9-user-profile.md`) |
| W3 | 문서화 / webhook Rationale | DEFERRED — out-of-scope | webhook 트랙 (`spec/5-system/12-webhook.md`) |
| W4 | 문서화 / trigger-list UUID | DEFERRED — out-of-scope | webhook 트랙 (`spec/2-navigation/2-trigger-list.md`) |
| W5 | 문서화 / admin-console UUID | DEFERRED — out-of-scope | webhook 트랙 (`spec/7-channel-web-chat/5-admin-console.md`) |
| W6 | 문서화 / workspace pruner Rationale | DEFERRED — out-of-scope | workspace 트랙 (`spec/data-flow/12-workspace.md`) |

> 위 6건은 원본 PR 의 `/consistency-check --impl-done` 에서 "본 PR 무관 타 track spec 부채"로 triage 된 항목과 동일하다. 본 resolution 에서 ITEMS 카운트에 포함하지 않는다.

### INFO in-scope 적용 — commit `5343b08e9`

| INFO # | 분류 | 조치 commit | 비고 |
|--------|------|-------------|------|
| INFO-4 | 요구사항 | `5343b08e9` | AGM-13 에 `X-Deleted-Count` echo + CORS `exposedHeaders` 요건 추가 |
| INFO-11 | 유지보수성 | `5343b08e9` | §6 API 표 셀 X-Deleted-Count 중복 기술 정리 (간결 요약으로 단순화) |
| INFO-15 | 문서화 | `5343b08e9` | Rationale 에 X-Deleted-Count 헤더 채택 결정 배경 추가 |
| INFO-18 | API 계약 | `5343b08e9` | 동 Rationale 에 scope 전체 삭제 한정 비대칭 이유 명시 |
| INFO-19 | 테스팅 | `5343b08e9` | `web-chat-cors.spec.ts` 에 `exposedHeaders: ['X-Deleted-Count']` 스냅샷 테스트 추가 |

---

## TEST 결과

- lint  : 통과 (50s)
- unit  : 통과 (48 passed, 55s)
- e2e   : 통과 (219/219, 120s)

---

## 보류·후속 항목

### WARNING — 타 트랙으로 이관됨 (DEFERRED)

- W1/W3/W4/W5 — endpointPath·webhook UUID: `#738`/`#748`/`#750` webhook 트랙에서 처리 중. endpointPath mutable 은 알려진 오탐 (MEMORY.md 등록).
- W2 — 멤버 Delete RBAC: `spec/5-system/1-auth.md §3.2` vs `spec/2-navigation/9-user-profile.md §4.2/§6.1` 충돌 → user-profile 트랙에서 확정 필요.
- W6 — workspace pruner Rationale: `spec/data-flow/12-workspace.md` Rationale 누락 → workspace 트랙.

### INFO — 적용 제외 (noise 또는 타 트랙)

- INFO-1: LLM 모델 교체 시 data-fence 재검증 절차 명시 — 비차단, 장기 TODO.
- INFO-2: workspace_id 격리 필터 구현 확인 — 기존 구현에서 확인됨 (spec §5 격리 규약 준수).
- INFO-3: `exposedHeaders` 최소 범위 확인 — 단 1개 헤더(`X-Deleted-Count`)만 노출, 최소 필요 범위.
- INFO-5/6: 리뷰 산출물 `plan_coherence.md` 내부 기술 역전 — 리뷰 산출물 파일(noise), 수정 불요.
- INFO-7: 리뷰 산출물 중복 구조 — orchestrator 산출물, 수정 불요.
- INFO-8/9: `_retry_state.json` 절대경로·1초 불일치 — orchestrator 인프라 개선 사항, 현 세션 외.
- INFO-10: `meta.json` trailing newline — 산출물 파일, 수정 불요.
- INFO-12: 리뷰 세션 완성도 비대칭 — 산출물 규약화 제안, 인프라 개선 사항.
- INFO-13: `plan/in-progress/trigger-review-deferred-fixes.md` W1/W7 기술 갱신 — webhook 트랙.
- INFO-14: `spec/data-flow/12-workspace.md §3.1` pruneExpired 참조 모순 — workspace 트랙.
- INFO-16: `spec/5-system/8-embedding-pipeline.md` 293행 dead-declared 이벤트 — embedding 트랙.
- INFO-17: `spec/5-system/1-auth.md §2.1` Refresh Token 30일 variant 미기술 — auth 트랙.
- INFO-20: `clearScope` 방어 분기 테스트 추가 — 선택적, 다음 batch.
- INFO-21: 프론트엔드 삭제 후 re-fetch 검증 — 선택적, 다음 batch.
