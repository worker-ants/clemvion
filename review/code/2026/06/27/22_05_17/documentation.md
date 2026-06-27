# 문서화(Documentation) 리뷰

## 발견사항

### [INFO] `saveMemories` 런타임 가드 인라인 주석 — 태그 참조 코드 독자 진입 장벽
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/ai-mem-backend-refactor/codebase/backend/src/modules/agent-memory/agent-memory.service.ts` — 신규 guard 블록 (line 108)
- 상세: 추가된 주석 `// 옵션 객체 계약 가드 (I3 review W-1):` 이 guard 목적·문제 시나리오·결과를 상세히 설명하는 점은 긍정적이다. 그러나 `I3`·`W-1` 태그는 `plan/in-progress/ai-context-memory-followup-v2.md` 를 알아야만 의미를 파악할 수 있어 코드만 읽는 기여자에게 비직관적이다. 이는 이전 리뷰(21_40_18)에서도 INFO 로 지적된 프로젝트 전반 패턴이며 이 커밋에서도 동일하게 유지된다.
- 제안: 주석을 `// 옵션 객체 계약 가드 (saveMemories I3 리팩터 후속, W-1):` 으로 수정하거나, `spec/conventions/` 또는 CONTRIBUTING 에 "I-번호/W-번호 = plan/in-progress 세부 항목" 한 줄 범례를 추가하면 진입 장벽이 낮아진다. 현재 기능 영향 없음.

---

### [INFO] `saveMemories` options 객체 — `workspaceId`·`scopeKey`·`items` 인라인 JSDoc 여전히 부재
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/ai-mem-backend-refactor/codebase/backend/src/modules/agent-memory/agent-memory.service.ts` — options 객체 시그니처
- 상세: 이전 리뷰(21_40_18) INFO 에서 `embedCfgSource`·`ttlDays` 에는 인라인 JSDoc 이 있으나 `workspaceId`·`scopeKey`·`items` 에는 없다고 지적했다. 이번 W-1 resolution 커밋이 해당 영역(guard 추가)을 건드렸음에도 세 필드의 JSDoc 은 여전히 추가되지 않았다. `scopeKey` 의 형식 제약·네임스페이스 격리 의미, `items` 의 `content.trim()` 필터링 규칙을 코드 독자가 구현을 직접 탐색해야 파악할 수 있다.
- 제안: 최소 한 줄씩 — `/** 네임스페이스 격리 키 (§5, AGM-07) */`, `/** 저장할 메모리 항목 배열 — 빈 content 는 필터링됨 */` — 수준으로 추가하면 `embedCfgSource`·`ttlDays` 와 품질이 일치한다.

---

### [INFO] RESOLUTION.md commit 참조 자리 표시자 — 추적 가능성 제한
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/ai-mem-backend-refactor/review/code/2026/06/27/21_40_18/RESOLUTION.md` — 조치 항목 테이블 `commit` 열
- 상세: W-1·I-10 항목의 commit 열이 `<resolution2>` 자리 표시자로 남아 있다. 실제 커밋 해시(`20771c845c0b929336dfb0c20df2bb4ea5d09cad`)로 교체되면 향후 bisect·blame 추적 시 직접 참조가 가능해진다.
- 제안: `<resolution2>` → `20771c845c0b929336dfb0c20df2bb4ea5d09cad` (또는 단축 해시 `20771c8`) 로 업데이트한다. 기능 영향 없음, 추적성 개선.

---

### [POSITIVE] 런타임 가드 주석 — 목적·시나리오·결과 전부 포함
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/ai-mem-backend-refactor/codebase/backend/src/modules/agent-memory/agent-memory.service.ts` — guard 블록 3행 주석
- 상세: "포지셔널→옵션 마이그레이션을 놓친 동적/spyOn 호출이 첫 인자로 문자열을 넘기면 destructure 가 전부 undefined 가 되어 무음 no-op 으로 삼켜진다 — 그런 프로그래밍 오류를 조용히 묻지 않고 throw." 라는 설명이 문제 발생 경로·결과·해결 의도를 모두 기술한다. 인라인 주석으로서 충분히 자기 문서화된다.
- 제안: 없음.

---

### [POSITIVE] 테스트 설명 문자열 — I3/W-1 태그와 한국어 의도 기술 조화
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/ai-mem-backend-refactor/codebase/backend/src/modules/agent-memory/agent-memory.service.spec.ts` — `'I3/W-1: 옵션 객체가 아닌 인자(구 포지셔널 오용)면 throw 한다'`
- 상세: 테스트 레이블이 추적 태그(I3/W-1)·원인(구 포지셔널 오용)·기대 동작(throw) 을 단일 문장에 모두 담는다. `@ts-expect-error` 주석도 시뮬레이션 의도(`구 포지셔널 호출 시뮬레이션 — 런타임 계약 가드 검증`)를 명확히 설명한다.
- 제안: 없음.

---

### [POSITIVE] `readExtractionWatermark` 원시값 폴백 테스트 — 내부 주석으로 복합 케이스 설명
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/ai-mem-backend-refactor/codebase/backend/src/nodes/ai/shared/agent-memory-injection.spec.ts` — 신규 primitive fallback 테스트 블록
- 상세: `memoryState 원시값 + 구 평면 키 동시 → 평면 키 폴백` 인라인 주석이 세 번째 어설션의 복합 조건을 명확히 설명한다. 이전 리뷰(21_40_18 testing.md INFO)에서 "비객체 memoryState 케이스 미테스트"로 지적된 갭을 채우면서 동시에 주석 품질도 높다.
- 제안: 없음.

---

### [POSITIVE] plan 백로그 별건 후속 기록 — 맥락과 이유 명시
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/ai-mem-backend-refactor/plan/in-progress/ai-context-memory-followup-v2.md` — "Batch 2 후속 — 별건 spec PR" 섹션
- 상세: 신규 섹션이 impl-done 세션 ID(21_39_37)·BLOCK:NO 판정 근거·별도 PR 로 분리하는 이유(behind-base 충돌 회피)·두 항목의 정확한 수정 내용을 모두 기재한다. 향후 추적자가 왜 이 항목이 이 PR 에 포함되지 않았는지 계획 파일만 보고 파악할 수 있다.
- 제안: 없음.

---

## 요약

이번 resolution 커밋(W-1 saveMemories 런타임 가드 + I-10 원시값 폴백 테스트)은 문서화 관점에서 전반적으로 양호하다. 새로 추가된 guard 블록의 3행 주석은 문제 시나리오·결과·해결 의도를 명확히 기술하며, 테스트 설명문과 `@ts-expect-error` 주석도 의도를 충분히 자기 문서화한다. RESOLUTION.md 는 WARNING 5건 전부의 처분 근거와 별건 후속 항목을 체계적으로 기록한다. 잔존 미결 사항은 두 가지 INFO 수준이다: (1) `saveMemories` 옵션 객체의 `workspaceId`·`scopeKey`·`items` 필드 인라인 JSDoc 부재는 이전 리뷰부터 미채택 상태로 이어지고 있으며, (2) RESOLUTION.md 의 commit 참조 자리 표시자(`<resolution2>`)가 실제 해시로 교체되면 추적성이 개선된다. 두 사항 모두 기능 정확성에 영향이 없는 개선 권고다.

## 위험도

LOW

STATUS: SUCCESS
