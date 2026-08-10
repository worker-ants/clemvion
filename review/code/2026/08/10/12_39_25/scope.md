# 변경 범위(Scope) Review

## 발견사항

없음. 두 파일의 변경이 동일한 단일 작업 항목("seed 게이트 + openStream 게이트 짝의 구조적 강제", `plan/in-progress/webchat-usewidget-extraction.md` 체크리스트)에 정확히 대응하며, 그 범위를 벗어나는 수정을 찾지 못했다.

- **[INFO]** `openStream` JSDoc 이 상당히 길다(23줄)
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts:344`-`366` (JSDoc 블록)
  - 상세: 신규 게이트의 의도·동작 보존 근거·mutation 검증 결과까지 담아 분량이 크다. 다만 이 파일의 기존 함수들(`teardownSession`, `finalizeEnded`, `seedWaitingFromStatus`, `pendingResetRef` 등, 예: 143-217, 267-292, 395-461)도 동일하게 재현·ai-review 근거·불변식 경고를 포함한 장문 JSDoc 스타일을 일관되게 쓰고 있어(이 파일이 "가드를 규율이 아니라 구조로 강제"하는 반복 결함 클래스를 다뤄온 이력, plan 문서 §배경 참고), 이번 추가는 코드베이스 기존 컨벤션과 부합한다. 범위 위반이 아니라 참고용으로만 기록.
  - 제안: 조치 불필요.

## 세부 확인 내역

1. **`use-widget.ts` 변경 4개 hunk 전부 동일 목적**
   - `openStream` 시그니처를 `void` → `boolean` 으로 바꾸고, 함수 내부에 소유권 재확인 가드(`streamRef.current !== null` → `false`, `client` 미확립 → `true`)를 추가(gate 367-391). `client` 미확립 시 `true` 를 반환해 기존 "client 없으면 내부 no-op 후 `scheduleRefresh()` 그대로 실행" 동작을 보존한다고 JSDoc 이 명시(gate 362-365) — 실제로 기능 변경이 없다는 주장과 코드가 일치한다.
   - 두 호출부(`start()` gate 601, `applyConfig` 복원 경로 gate 950)에서 종전에 손으로 복제됐던 `if (sessionEstablished()) return; openStream(...)` 3줄을 `if (!openStream(...)) return;` 한 줄로 교체 — plan 체크리스트가 요구한 정확히 그 리팩토링이다.
   - 인접 주석(gate 594-600, 942-949)과 `seedWaitingFromStatus` JSDoc 의 "staleness 정책 표"(gate 439-450)는 설계가 실제로 바뀌었으므로(게이트 위치 이동) 갱신이 불가피한 부수 편집이지, 무관한 주석 손질이 아니다.
   - `openStream` 의 `useCallback` 의존성 배열(gate 392: `[closeStream, handleEiaEvent]`)은 변경 없음 — 새로 추가된 `streamRef.current` 읽기는 ref 라 의존성에 안 잡혀도 안전, 별도 조치 불필요.
   - 이 4개 hunk 밖에서 import·설정·무관한 코드 영역·포맷팅만 바뀐 흔적은 없다(전체 파일 컨텍스트 대조 결과 diff 범위 밖 라인은 모두 원문과 동일).

2. **`plan/in-progress/webchat-usewidget-extraction.md` 변경**
   - 미착수(`[ ]`) 체크리스트 항목 하나를 완료(`[x]`)로 바꾸고, 그 안에 결정 근거·뮤테이션 검증 결과·`tsc --noEmit` 통과 사실을 기록(gate 60-79) — 정확히 코드 변경과 짝을 이루는 "진행 중 작업 문서" 갱신이며 CLAUDE.md 의 plan 라이프사이클 규약과 일치한다.
   - 이 diff 는 해당 체크리스트 항목의 텍스트만 교체했고, frontmatter(`worktree`/`started`/`owner`/`status`)·다른 섹션(§1차 slice, §남은 slice 등)·다른 체크리스트 항목은 손대지 않았다.
   - 문서에 적힌 근거(ai-review `02_25_54`, `01_44_21` 참조 번호, mutation 결과, 동등 뮤턴트 판단)는 코드 쪽 JSDoc 의 동일 인용과 일치해 지어낸 서술이 아니다.

3. **임포트/설정**: 두 파일 모두 import 문·설정 파일 변경 없음.
4. **포맷팅**: 변경된 줄은 실질 코드/문서 내용이며, 공백·줄바꿈만 바뀐 순수 포맷팅 hunk는 없음.

## 요약

diff 전체가 plan 체크리스트에 명시된 단일 목표—`openStream` 내부로 스트림 소유권 게이트를 옮겨 두 호출부의 손 복제 가드를 구조적으로 통합하는 것—에만 집중되어 있다. 코드(`use-widget.ts`)와 그 작업을 추적하는 plan 문서 갱신이 1:1로 대응하며, 무관한 파일·기능 확장·불필요한 리팩토링·의미 없는 포맷팅·부적절한 임포트/설정 변경은 발견되지 않았다. JSDoc 이 다소 길지만 이는 파일 전반의 기존 문서화 컨벤션과 일치하므로 범위 위반으로 보지 않는다.

## 위험도

NONE
