# 테스트(Testing) 리뷰

## 발견사항

- **[INFO]** 변경 범위가 전부 주석/문서(JSDoc → `//` 이동, docstring 정정)와 이미 존재하는 래칫 테스트의 기대값 배열(`EXPECTED_DTO_JSDOC_CITATIONS`)을 `[]` 로 비우는 것뿐이다. 새 로직이 추가되지 않았으므로 새 테스트가 필요한 코드 경로는 없다.
  - 위치: `codebase/backend/src/repo-guards/__tests__/dto-jsdoc-citation.spec.ts:49` (`const EXPECTED_DTO_JSDOC_CITATIONS: readonly string[] = [];`)
  - 상세: 실제로 `npx jest src/repo-guards/__tests__/dto-jsdoc-citation.spec.ts` 를 로컬에서 재실행해 5개 테스트 전부 통과함을 확인했다(`Tests: 5 passed, 5 total`). `TriggerWorkflowRefDto`·`ScheduleTriggerWorkflowRefDto` 클래스 JSDoc 에서 인용 문자열이 실제로 제거되고 바로 위 `//` 블록으로 옮겨졌음을 두 DTO 파일 모두 직접 열어 대조했다 — 가드 정규식이 매치할 패턴이 클래스 JSDoc 안에 더는 없다.
  - 제안: 없음(확인 완료).

- **[INFO]** 이 변경으로 기존 5개 테스트가 커버 범위를 그대로 유지한다: (1) "정확히 일치" 래칫(빈 배열과 대조), (2) 대조군 fixture 의 양성/음성 5+3 케이스, (3) 세 인용 형태(전체경로·날짜+시각·bare 시각) 각각 최소 1회 관측, (4) fixture 스캔이 비어있지 않다는 전제 가드(vacuous-pass 방지), (5) `dto/responses/` 경로 스코프 판정. 회귀 관점에서 이 변경이 5개 중 어느 것도 무효화하지 않는다 — 5번은 로직 무변경, 1번은 값만 `[]` 로 바뀌었을 뿐 assertion 구조는 동일, 2~4는 fixture 파일 자체가 이번 diff 에 포함되지 않아(`git log` 로 확인, 최근 5커밋에 해당 fixture 변경 없음) 그대로 유효하다.
  - 위치: `codebase/backend/src/repo-guards/__tests__/dto-jsdoc-citation.spec.ts:60-124`
  - 상세: 실제 DTO 파일의 클래스 인용 두 자리가 사라지면서 "정확히 일치" 테스트가 실제 프로덕션 파일에 의존하던 상태에서 완전히 빈 배열 기대치로 단순화됐고, 클래스 JSDoc 인용 패턴 자체의 검출은 대조군 fixture(`ViolationClassCitationDto`)가 별도로 계속 커버한다 — 실제 코드 변경과 검출 로직 테스트가 분리되어 있어 "베이스라인이 우연히 0이라 클래스 분기가 죽어도 못 잡는다"는 우려가 실제로는 대조군이 흡수한다. plan(`plan/in-progress/dto-class-jsdoc-citation.md`)의 뮤턴트 표 M3가 정확히 이 지점을 명시하고 있으며, 그 추론은 가드 코드 구조(`visit` 함수 안에서 클래스 분기 제거 시 `push(className, node)` 호출만 사라지고 멤버 순회는 별도 라인이라 유지됨)와 일치한다.
  - 제안: 없음(설계·근거 확인).

- **[INFO]** plan 문서(`plan/in-progress/dto-class-jsdoc-citation.md`)의 뮤턴트 표(M1~M3)는 "저장소 파일 제자리 치환 → 실행 → `cp` 복원" 절차를 스스로 명시하고 결과를 KILLED 로 보고했다. 이번 리뷰에서는 그 세 뮤턴트를 독립적으로 재실행하지는 않았고(현재 fan-out 리뷰 중 저장소 뮤테이션 금지 규약 준수), 대신 정적으로 가드 코드 구조를 읽어 M1~M3의 예측이 코드 흐름과 모순되지 않음만 확인했다. 값이 이상하면(예: M2 처럼 필드 JSDoc에 인용을 넣는 뮤턴트가 필드 스캔 로직과 무관하게 통과할 가능성) 추가 검증이 필요하지만, 본 가드는 클래스·프로퍼티 JSDoc을 동일한 `findCitations(jsDocText(node))` 함수로 처리하므로 필드 인용도 동일하게 검출된다 — 예측과 코드가 부합한다.
  - 위치: `plan/in-progress/dto-class-jsdoc-citation.md:40-46` (뮤턴트 표)
  - 상세: 독립 재실행 없이 정적 검토만 수행했음을 명시.
  - 제안: 없음 — 정보 제공 목적.

- **[INFO]** `EXPECTED_DTO_JSDOC_CITATIONS` 를 빈 배열로 만든 것은 더 이상 실제 DTO 이름(`TriggerWorkflowRefDto` 등)에 의존하지 않는 테스트 형태로, 향후 DTO 이름이 리팩터링돼도 이 테스트가 깨질 이유가 사라졌다 — 테스트 용이성/안정성 관점에서 개선이다. 다만 반대급부로 "실제 프로덕션 코드에 클래스 JSDoc 인용이 남아있지 않다"는 사실 자체를 검증하는 것은 이제 이 래칫 테스트 하나(빈 배열과의 정확 일치)뿐이며, 검출 로직 자체의 정확성은 fixture 대조군이 담당한다는 책임 분리가 명확하다.
  - 위치: 없음(설계 관찰, 특정 결함 아님)
  - 상세: 조치 불요.

## 요약

이번 변경은 응답 DTO 클래스 JSDoc 두 곳의 리뷰 인용을 `//` 주석으로 옮기고, 이미 존재하는 래칫 테스트의 예외 허용 목록을 빈 배열로 비우는 순수 주석/문서 정정이다. 새로운 실행 경로나 분기가 추가되지 않았고, 기존 `dto-jsdoc-citation.spec.ts` 의 5개 테스트(정확 일치 래칫·대조군 fixture 양성/음성·3형태 인용 관측·비어있지 않음 전제·경로 스코프)가 변경 전후 모두 유효함을 로컬 재실행(5 passed)과 두 DTO 파일 직접 대조로 확인했다. 대조군 fixture 가 변경 대상이 아니어서 검출 로직 자체의 커버리지는 그대로 유지되고, 실제 코드 값(빈 배열)과 검출 로직 검증(fixture)이 분리되어 있어 "우연히 통과" 위험이 낮다. plan 문서의 뮤턴트 표(M1~M3)는 정적으로 코드 구조와 부합하지만 이번 리뷰에서 독립 재실행은 하지 않았다. 테스트 관점에서 추가 조치가 필요한 항목은 없다.

## 위험도
NONE
