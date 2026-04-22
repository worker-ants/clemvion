## 발견사항

### [INFO] `handleSseEvent` / `summarizePlanState` 내보내기 (assistant-store.ts)
- **위치**: `frontend/src/lib/stores/assistant-store.ts` — 함수 선언부
- **상세**: 두 함수가 테스트 목적으로 `export` 키워드를 추가해 공개 API가 됐다. 기능 변경은 아니지만 모듈 경계를 넓히는 리팩토링이 feature 커밋에 혼재된 케이스.
- **평가**: 테스트 파일(`__tests__/assistant-store.test.ts`) 추가가 이를 직접 유발했고, 이 테스트는 이번 변경의 핵심 검증이므로 범위 내 변경으로 수용 가능하다. 단, 추후 `export` 범위가 의도치 않게 외부에 노출되지 않도록 배럴(index.ts)에 재노출하지 않는 것이 좋다.

### [INFO] 힌트 우선순위 주석과 코드 순서의 표현 불일치 (assistant-store.ts)
- **위치**: `frontend/src/lib/stores/assistant-store.ts` `:506` 주석 vs 실제 `else-if` 체인
- **상세**: 주석은 `error > stalled > planApprove > completed` 순서로 기술하나, 코드의 분기 순서는 `stalled → completed → planApprove`이다. 실제 동작은 `summarizePlanState`가 `none / pending / completed`를 반환하므로 `planApprove`는 status가 `none`(미승인·미시작)일 때만 도달한다 — 즉 `completed`와 `planApprove`는 상호 배타적이어서 최종 동작은 주석과 일치한다.
- **제안**: 오해를 막으려면 주석을 `error > stalled > completed > planApprove(status=none)`으로 수정하거나, 코드 순서를 주석대로 재배치한다.

### [INFO] 기존 테스트 이름 변경 (workflow-assistant-stream.service.spec.ts)
- **위치**: `it('does not block finish twice in a row...')` → `it('does not block finish twice in a row when no progress is made...')`
- **상세**: 새 guard 로직 도입으로 기존 테스트가 더 이상 "두 번 block 금지"가 아니라 "진척 없이 두 번 → 탈출"을 검증하므로 이름 수정은 적절하다. feature 변경에 종속된 테스트 명 수정으로 scope 범위 내.

### [WARNING] `systemHint` 우선순위 코드 순서가 spec §3.2 표와 불일치 (assistant-store.ts)
- **위치**: `assistant-store.ts` done 분기 / `spec/3-workflow-editor/4-ai-assistant.md` §3.2 표
- **상세**: spec의 표에서는 행 순서가 `Stalled → Plan approval → Turn completion`이지만 코드에서는 `stalled → completed → planApprove`이다. 동작은 동일하지만 spec 표 순서가 코드 분기 순서와 다르게 보여 유지보수 시 혼란을 줄 수 있다.
- **제안**: spec 표의 순서를 코드 분기 순서(`stalled → completed → planApprove`)에 맞게 조정하거나, 코드 분기 순서를 spec에 맞게 재배치한다(동작 변화 없음).

---

## 요약

모든 변경은 두 가지 명확한 목적(① plan-only 턴에서 prose 생략 + 클라이언트 hint 자동 주입, ② 진척 기반 finish guard 강화)으로 수렴된다. 각 파일의 수정 범위가 해당 목적에 충실하며, 관련 없는 리팩토링이나 무관한 코드 영역 변경은 발견되지 않는다. `handleSseEvent` export 추가는 동반 테스트 파일이 요구한 최소 변경이고, 기존 테스트 이름 변경도 로직 변경에 종속된 조정이다. 힌트 우선순위 표현의 주석/코드/spec 간 사소한 불일치가 있으나 실제 동작에는 영향이 없다.

## 위험도

**LOW**