# 문서화(Documentation) Review

## 발견사항

### [INFO] reconcilePreParkWaitingStatus JSDoc 이 함수 시그니처에 @param/@returns 태그 미포함
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/fix-carousel-waiting-status-4d4ed3/codebase/backend/src/modules/executions/executions.service.ts` — `reconcilePreParkWaitingStatus` 함수 위 JSDoc 블록
- 상세: 함수 본문 설명은 충분히 상세하지만, `@param nodeExecutions`, `@returns void` 태그가 없다. 프로젝트의 다른 공개 메서드(`verifyOwnership`, `getChain`, `assertDryRunSupported` 등)는 `@param`/`@throws` 태그를 일관되게 사용하고 있다. 본 함수는 `export` 가 아닌 모듈 내부 함수이므로 규범상 요구사항은 낮지만, 동일 파일의 관행과 약간의 불일치가 있다.
- 제안: 최소한 `@param nodeExecutions — 정규화할 NodeExecution 배열 (in-place 변경)` 한 줄 추가.

### [INFO] isNodeWaitingForInput JSDoc 이 frontend/backend 양쪽에서 거의 동일하게 복제됨 — 단일 진실 참조 없음
- 위치:
  - `/Volumes/project/private/clemvion/.claude/worktrees/fix-carousel-waiting-status-4d4ed3/codebase/frontend/src/lib/websocket/apply-execution-snapshot.ts` — `isNodeWaitingForInput` JSDoc
  - `/Volumes/project/private/clemvion/.claude/worktrees/fix-carousel-waiting-status-4d4ed3/codebase/backend/src/modules/executions/executions.service.ts` — `reconcilePreParkWaitingStatus` JSDoc
- 상세: 두 JSDoc 은 동일한 "intra-row inconsistency" 메커니즘을 설명하며 내용이 거의 중복된다. spec 문서(`spec/5-system/4-execution-engine.md`)에 이 정규화 계약이 기술돼 있다면 두 JSDoc 이 spec 섹션을 교차 참조하는 한 줄을 추가하면 이후 동기화 실수를 방지할 수 있다. 현재 backend JSDoc 은 `spec/5-system/4-execution-engine.md §전이 표 "원자성 보장"` 을 언급하지만 frontend JSDoc 은 `spec §전이 원자성` 만 언급 — 참조 형식이 다르다.
- 제안: 두 JSDoc 모두 동일한 spec 절(`spec/5-system/4-execution-engine.md §전이 원자성 / "원자성 보장"`) 참조 형식을 통일. 내용 자체는 충분함.

### [INFO] e2e 파일의 모듈 레벨 JSDoc 이 diff 에서 변경되지 않았으나 새 시나리오(intra-row inconsistency)를 커버하지 않음
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/fix-carousel-waiting-status-4d4ed3/codebase/backend/test/execution-park-resume.e2e-spec.ts` — 파일 상단 `/** e2e: spec/5-system/4-execution-engine.md §4.x ... */` 블록 (변경 없음)
- 상세: 이번 diff 의 변경은 코드 포맷팅 수정(줄바꿈)만이다. 실제 intra-row inconsistency 회귀 가드는 backend unit spec(`executions.service.spec.ts`)과 frontend unit spec(`apply-execution-snapshot.test.ts`)에서 다루므로 e2e 파일 JSDoc 업데이트 누락은 문서화상 미미한 사항. 단, e2e 파일 상단 JSDoc 에 이번 변경 배경(intra-row inconsistency)을 한 줄 언급하면 다음 독자가 어떤 e2e 가 어떤 회귀를 덮는지 더 빠르게 파악할 수 있다.
- 제안: 생략 가능(INFO 수준). 추가 시 `// 이번 포맷 정리와 함께 관련 intra-row inconsistency 가드는 unit 계층(executions.service.spec.ts L42, apply-execution-snapshot.test.ts L598)에서 다룬다.` 정도의 한 줄 메모.

### [INFO] plan 문서 말미에 잘못된 XML 태그 잔재(`</content>`, `</invoke>`)
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/fix-carousel-waiting-status-4d4ed3/plan/in-progress/fix-carousel-waiting-status.md` — 파일 마지막 3줄
- 상세: 파일 하단에 `</content>` 와 `</invoke>` 태그가 그대로 노출돼 있다. 이는 plan 문서 본문이 아닌 편집 아티팩트로 보이며, plan 문서의 가독성을 해치고 다른 도구가 이 파일을 파싱할 때 오류를 일으킬 수 있다.
- 제안: 해당 두 줄 제거. 체크리스트 마지막 항목(`/consistency-check --impl-done`) 이후에 아무 내용도 없어야 한다.

### [INFO] use-widget-eager-start.test.ts 변경 — 테스트 내 race 수정 주석이 충분히 상세함, 추가 문서화 불필요
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/fix-carousel-waiting-status-4d4ed3/codebase/channel-web-chat/src/widget/use-widget-eager-start.test.ts` L288–L292
- 상세: 추가된 인라인 주석이 race condition 원인과 수정 방향을 명확히 설명하고 있어 문서화 관점에서 적절하다. 추가 조치 불필요.

### [INFO] README/CHANGELOG 업데이트 불필요
- 상세: 이번 변경은 외부 API 시그니처 변경이 없고 내부 read-side 정규화 로직만 추가됐다. 새 환경변수·설정 옵션도 없으며, `isNodeWaitingForInput`/`reconcilePreParkWaitingStatus` 는 내부 헬퍼다. 사용자 향 문서(README, CHANGELOG, API doc) 업데이트 의무는 없다.

---

## 요약

변경된 코드 전체에 걸쳐 문서화 수준은 양호하다. 핵심 신규 함수(`reconcilePreParkWaitingStatus`, `isNodeWaitingForInput`)는 모두 상세한 JSDoc 을 갖추고 있고, 복잡한 intra-row inconsistency 메커니즘, 발생 조건, 방어 범위를 명확하게 서술하고 있다. test 파일들도 각 케이스에 맥락 설명 주석이 잘 달려 있다. 실질적인 문제는 plan 문서 말미의 XML 아티팩트 잔재(두 줄) 한 건이며, 나머지 발견사항은 모두 INFO 등급의 스타일·일관성 개선사항이다.

## 위험도

LOW
