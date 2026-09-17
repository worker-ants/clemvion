# RESOLUTION — `/ai-review` 1라운드 (HIGH · Critical 1 · Warning 10)

## 조치 항목

| SUMMARY # | 처분 | 커밋 |
|---|---|---|
| 1 (CRITICAL) 부모 삭제의 schedule job 배치 해제가 중간 실패 시 일부만 해제된 채 삭제 취소 | **수정** — 전부 시도 → 실패가 있으면 이미 해제한 **활성** job 재등록 → 던짐. 복구 실패는 error 로그. 테스트 2건 + 뮤턴트 M16(첫 실패에서 던짐)·M17(비활성까지 재등록) RED | `097e583e1` |
| 2 · 4 워크스페이스 선검사 뒤 역할 변경 시 외부 해제 미복구 | **수정(가시화)** — 트랜잭션 실패 시 «외부 해제는 이미 끝났다» error 로그 후 던짐. 외부 해제는 provider 쪽 부작용이라 되돌릴 수 없다. 역할 변경 재현 테스트(INFO 23) + 뮤턴트 M19 RED. 새 테스트가 **logger 필드 누락**을 잡았다(그대로였으면 403 대신 TypeError) | `097e583e1` |
| 3 외부 해제 스냅샷 ↔ 잠금 열거 시차 | **문서화** — spec §4.3 이 적어 둔 잔여(외부 해제용 열거 뒤 생긴 트리거)다. 닫으려면 외부 해제를 커밋 뒤로 옮겨야 하는데 그러면 schedule 행이 CASCADE 로 사라져 job id 를 못 찾는다 — `releaseExternalForParent` JSDoc 에 명시, sweeper 재판단 트래커 항목에 시나리오로 등재(plan 체크리스트) | `097e583e1` |
| 5 `deleteWorkspace` ↔ `transferOwnership` 잠금 순서 반대 | **수정** — 워크스페이스 → 멤버십으로 통일(판정 순서는 유지). 순서 테스트 + 뮤턴트 M20 RED | `097e583e1` |
| 6 지연 해석 헬퍼 두 벌 | **수정** — `resolveTriggerResourceReleaser(moduleRef)` 하나 | `097e583e1` |
| 7 binder 보상 블록 중복 | **수정** — 로컬 `undoWrite` | `097e583e1` |
| 8 `triggerSecretPrefix` 가 URI 빌더 미재사용 | **수정** — `secret-ref.ts` `buildSecretRefPrefix` 신설(형식 검증 재사용) + 테스트 3건 | `097e583e1` |
| 9 binder 보상이 binder 자기 스펙에 없음 | **변경 없음** — `chat-channel-binder.service.spec.ts` 머리 주석이 «`setupChatChannel` 은 여기서 다시 덮지 않는다, 정본은 `triggers.service.spec.ts`(공개 진입점)» 를 명시적으로 결정해 두었다. 같은 것을 두 곳에서 단언하면 정본이 흐려진다는 근거다. 보상 두 자리는 그 하네스에서 뮤턴트 M5·M6 가 RED 로 물었다 | — |
| 10 CHANGELOG 미갱신 | **수정** — Unreleased 항목 | `097e583e1` |
| 11 binder 로그 접두 `TriggersService:` | **수정** — `ChatChannelBinderService:` 4곳 + 클래스 JSDoc 갱신. 트래커 후속 항목 해소 표시(plan 체크리스트) | `097e583e1` |
| 12 (INFO) 워크스페이스 재검사 TOCTOU | #2 로 가시화 | `097e583e1` |
| 13 (INFO) 커밋 뒤 비밀 삭제 실패 누적 | sweeper 재판단 항목에 등재(plan 체크리스트) | — |
| 14 (INFO) ModuleRef Service Locator | 의도된 순환 회피. `4-execution-engine.md §4.4` 표에 throw 사례를 더하는 planner 후속에 포함(impl-prep INFO 2) | — |
| 15·16·17·25 (INFO) 포트의 `EntityManager` 노출 · 안무 순서 관례 · 타입 분기 인라인 · if/else 반복 | **유지** — 호출부 2개·부모 타입 2종·트리거 타입 분기 1개에서 추상화는 복제보다 읽기 어렵다. 늘어나면 재검토 | — |
| 18 (INFO/SPEC-DRIFT) §4.3 과도기 문구 · Planned 태그 · `secret-store.md` partial | 머지 뒤 planner 후속(plan 체크리스트에 이미 등재) | — |
| 19·21 (INFO) `lockParentAndListTriggerIds` 가 부모 부재를 무시 → 동시 중복 DELETE 시 감사 중복 | **변경 없음** — 이 PR 전에도 `findById`(잠금 없음) → `repository.remove` 로 같은 중복이 났다. 새 결함이 아니고 데이터 손상도 없다. 후속 등재 | — |
| 20 (INFO) 트랜잭션 안 워크스페이스 행 이중 잠금 | 같은 트랜잭션의 재잠금은 no-op — 유지 | — |
| 22 (INFO) 혼합 타입 부분 실패 | #1 테스트가 덮는다(스케줄 실패 시 webhook teardown 미호출 단언) | `097e583e1` |
| 23 (INFO) 이중 검사 사이 역할 변경 테스트 | #2 와 함께 추가 | `097e583e1` |
| 24·26 (INFO) 지연 해석 비교 문구 · `TriggerParent` 키=컬럼 계약 | **수정** | `097e583e1` |

## TEST 결과

- lint: 통과
- unit: 통과 — backend jest 9,755 (스위트 전체)
- build: 통과 + 타입 ratchet baseline 일치(197건 / 36파일)
- e2e: 통과 — backend 321(`trigger-deletion-releases-resources.e2e-spec.ts` 7건 포함) + playwright 51

## 보류·후속 항목

`plan/in-progress/trigger-deletion-release.md` 의 체크리스트 «트래커 반영» 에서 종결 때 트래커로 옮긴다:
sweeper 재판단(#3 시나리오 · #13) · 동시 중복 DELETE 감사 중복(#19·#21) · planner 후속(#14·#18).
