# 변경 범위(Scope) 리뷰 — scope.md

## 분석 방법

`review 대상 파일` 3건은 프롬프트에 "전체 파일 컨텍스트"로만 제공되어 diff 가 없었다.
실제 변경분을 정확히 식별하기 위해 `git show HEAD -- <3 files>` 로 이번 커밋(`22b437873`,
"fix(harness): Gate C 의 fail-open 을 닫고, 뮤테이션이 그 수정을 한 번 반려했다")의 diff 를
직접 확인하고, 커밋 메시지가 선언한 수정 항목(W1/W2/W3/W5, W4 는 의도적 defer)과 대조했다.

## 발견사항

없음. 세 파일의 실제 diff 를 커밋 메시지의 항목별 서술과 1:1 대조한 결과, 선언 범위를
벗어나는 수정은 발견되지 않았다.

- `codebase/frontend/src/lib/docs/__tests__/plan-scan.ts` — 파일 상단 주석 재작성만
  (13~24행 부근). "collectCompletePlans 는 아직 독립 구현" 이라던 stale 주석을, 같은 커밋에서
  실제로 위임으로 통합했음에도 갱신하지 않았던 것을 바로잡은 것(W1, 직전 리뷰 5명 중복 지적).
  로직 변경은 없고 순수 문서 정정이라 범위 내.
- `codebase/frontend/src/lib/docs/__tests__/spec-plan-completion.test.ts` —
  `danglingSpecImpact()` 신설(59~75행)은 비-문자열 `spec_impact` 원소가 게이트를 조용히
  통과하던 fail-open(W3)을 순수 함수로 추출해 합성 fixture 로 겨눈 것이고, 인라인 필터를
  이 함수 호출로 교체한 지점(127~130행 부근)·`isGateCEnforced` 위임으로 바꾼 컷오프 판정
  (92~98행 부근)도 각각 W3·W2 로 커밋 메시지에 명시돼 있다. 새 `it(...)` 블록(178~190행)은
  같은 W3 수정의 뮤테이션 검증용 테스트로 별도 기능 추가가 아니다.
- `codebase/frontend/src/lib/docs/__tests__/plan-scan.test.ts` — `parseFrontmatterSafe` 신규
  import(10행 부근)와 신규 `describe("parseFrontmatterSafe", ...)` 블록(212~239행 부근)은
  "캐시 우회 계약 커버리지가 다른 describe 블록의 우연에 기대고 있었다"는 W5 를 겨냥한 독립
  테스트로, 커밋 메시지에 명시돼 있다.
- W4(Gate C 이중 파싱)는 커밋 메시지에서 "현재 비용 0 이고 선재라 등재" 라고 명시적으로
  defer 처리했고, 실제로 diff 에도 그에 대응하는 코드 변경이 없다 — 미착수 항목을 손대지
  않은 것도 범위 준수의 일부로 확인.
- 임포트·설정 파일·포맷팅 변경 없음. 세 파일 모두 실질 변경(로직 또는 그 로직을 직접
  검증하는 테스트/문서)과 무관한 코드 정리·리팩토링·무관한 파일 수정은 없었다.

## 요약

이번 커밋은 직전 `/ai-review` (04_22_01, LOW, Critical 0, WARNING 5)가 지적한 W1·W2·W3·W5
네 항목만을 목표로 한 후속 fix 로, 실제 diff 전부가 커밋 메시지에 서술된 항목과 정확히
대응한다. 의도치 않은 추가 수정, 관련 없는 리팩토링, 기능 확장, 포맷팅/주석/임포트/설정의
잡음이 섞인 흔적은 확인되지 않았다. W4 는 의도적으로 손대지 않았다는 서술과 실제 diff 부재가
일치해, 스코프 관리가 특히 신중했다는 점도 확인된다.

## 위험도

NONE
