# 변경 범위(Scope) 리뷰

## 발견사항

### [INFO] review/ 산출물 파일 3개가 동일 커밋에 포함
- 위치: `review/consistency/2026/06/21/21_00_17/SUMMARY.md`, `_retry_state.json`, `convention_compliance.md`
- 상세: 이 파일들은 impl-prep 단계의 일관성 검토 산출물로, 코드 변경과 동일 커밋에 묶였다. CLAUDE.md "코드 리뷰 산출물" 정책상 `review/` 는 gitignored 가 아니며 커밋 대상이다. 본 리뷰의 주요 변경(핸들러 리팩토링 + 신규 manager)과 논리적으로 연결된 부속 산출물이므로 범위 이탈로 보기 어렵다.
- 제안: 무관한 수정은 아님. 단, review/ 산출물 파일이 코드 커밋과 동시에 포함될 경우 diff 를 넓혀 리뷰 노이즈를 유발할 수 있으므로 향후에는 review 커밋과 코드 커밋을 분리하는 것을 검토 가능.

### [INFO] `ConversationTurn` 타입 임포트 제거 (핸들러 → 매니저로 이동)
- 위치: `ai-agent.handler.ts` diff, `-import type { ConversationTurn, ... }`
- 상세: `ConversationTurn` 타입이 핸들러에서 제거되었고 `ai-memory-manager.ts` 에서 새로 임포트된다. 이동된 메서드(`injectMemoryContext`)가 이 타입을 사용하므로 임포트 이동은 이동 리팩토링에 직결되는 필연적 변경이다. 불필요한 임포트 추가/제거 아님.
- 제안: 적절한 임포트 이동. 조치 불필요.

### [INFO] `applyCap`, `renderThreadAsSystemText` 임포트 제거 (핸들러)
- 위치: `ai-agent.handler.ts` diff, `-import { applyCap, renderThreadAsSystemText, ... }`
- 상세: 두 함수를 사용하던 메서드(`injectMemoryContext`)가 매니저로 이동했으므로 핸들러의 임포트 제거는 자연스럽다. 매니저(`ai-memory-manager.ts`)에서 동일 경로로 다시 임포트된다.
- 제안: 조치 불필요.

## 요약

이번 변경은 `ai-agent.handler.ts` 에서 메모리 관련 3개 메서드(`resolveMemoryStrategy`, `injectMemoryContext`, `scheduleMemoryExtraction`)를 신규 파일 `ai-memory-manager.ts` 로 추출하는 behavior-preserving 리팩토링이다. 핸들러의 임포트 정리·타입 제거는 모두 이동한 메서드에 귀속된 종속적 변경이며, 콜 사이트 4개를 `this.memoryManager.*` 로 교체한 것도 직접적 위임 변경이다. `review/consistency/` 산출물 3개 파일이 동일 커밋에 포함된 점은 프로젝트 규약상 허용 범위이며 코드 로직과 논리적으로 연결된다. 의도하지 않은 기능 추가, 무관한 파일 수정, 불필요한 포맷팅 변경은 발견되지 않는다.

## 위험도

NONE
