STATUS=success scope review complete — 4 files reviewed, risk=LOW
===REPORT_MARKDOWN_BELOW===
# 변경 범위(Scope) 리뷰

## 컨텍스트 검증

`plan/in-progress/review-info-followups.md` 는 이전 리뷰(`review/code/2026/07/30/17_54_27/RESOLUTION.md` §보류·후속 항목)가 "요청 범위 밖" 으로 미룬 INFO 10건(#1/#2/#3/#6/#8/#9/#10/#11/#12/#13)을 전수 재검토해 4건만 조치하고 6건은 근거를 남겨 종결하는 작업이다. `git diff main...HEAD` 로 실제 변경 파일을 대조한 결과 `codebase/backend/src/modules/workflows/{workflows.controller.ts, workflows.service.ts, workflows.service.spec.ts}` + `plan/in-progress/review-info-followups.md` 4개 파일로, 프롬프트에 제시된 diff 와 정확히 일치했다(추가로 감춰진 변경 없음). 원본 리뷰(`17_54_27/RESOLUTION.md` 91~102줄)의 INFO 10건 목록도 이번 plan 문서가 인용한 내용과 정확히 일치함을 확인했다.

## 발견사항

- **[INFO]** Swagger `duplicate` 엔드포인트 description 을 배열+`join(' ')` 로 재구성 — 동작 변경이 전혀 없는 순수 포맷팅(INFO #12)이 동작성 변경(#9/#10)과 같은 커밋에 번들됨
  - 위치: `codebase/backend/src/modules/workflows/workflows.controller.ts:214-220` (`@ApiOperation({ description: [...] })`)
  - 상세: 문자열을 배열로 쪼개 `.join(' ')` 했을 뿐 최종 문자열은 원본과 동일(가독성 개선만). 코드 자체의 리스크는 0 이지만, "동작 결함 수정" PR 에 "무관한 포맷팅" 이 섞이지 않았는지가 이 리뷰의 관점이라 표기해둔다.
  - 제안: 실질 위험 없음 — plan 문서 §1.4 에 이 항목이 이전 리뷰의 INFO #12 로 명시적으로 추적되고 있어 "의도 이상의 변경"이 아니라 이번 작업(백로그 10건 처분)이 명시적으로 커버하는 항목이다. 별도 조치 불요.

- **[INFO]** 네이밍 통일(INFO #8)이 이번 결함의 직접 대상인 `duplicate()` 가 아니라 이번 결함과 무관한 `importWorkflow()` 내부 변수명(`nodeEntities`→`nodeRows`, `edgeEntities`→`edgeRows`)까지 변경 — 그 여파로 `manager.insert(...)` 호출이 한 줄로 재포맷됨(식별자가 짧아져 줄 길이 제한 안으로 들어온 자연스러운 결과, `duplicate()` 의 기존 스타일과 동일)
  - 위치: `codebase/backend/src/modules/workflows/workflows.service.ts:433,477-478,484,500-501` (`importWorkflow()` 본문), 그리고 상호참조 주석 4곳(`:284`, `:307`, `:968`, `:1010` — `duplicate()`/`syncNodes()`/`syncEdges()` 에서 `importWorkflow()` 변수명을 인용하는 주석들)
  - 상세: `duplicate()` 를 고치던 중 그 함수의 주석이 `importWorkflow()` 의 변수명(`nodeEntities`/`edgeEntities`)을 상호참조하고 있었는데, 실제 코드의 변수명은 이미 그와 다르게 어긋나 있었다(주석은 "plain literal" 이라 적는데 이름은 `Entities`). 그대로 두면 이번에 새로 손대는 `duplicate()` 쪽 주석도 잘못된 이름을 가리키게 되므로 `importWorkflow()` 쪽 변수명을 `nodeRows`/`edgeRows` 로 통일했다는 것이 plan 의 Rationale. `grep -rn "nodeEntities\|edgeEntities" codebase/` 로 전체 코드베이스를 검색해 잔존 참조가 없음을 확인했고(리네임 누락 없음), 4곳의 주석도 전부 새 이름으로 동기화되어 불일치가 남지 않았다.
  - 제안: 조치 불필요. 이 변경은 plan 문서에 사전에 선언된 4건 중 하나(§1.3)이고, 이번 작업 자체가 "이전 리뷰의 INFO 10건을 전수 재판정" 하는 작업이라 정의상 요청 범위 안에 있다. 다만 "직접 결함이 있는 함수" 밖(형제 함수)까지 손댄 변경이라는 점은 스코프 리뷰 관점에서 투명성 차원에 기록해둔다.

## 확인된 항목 (문제 없음)

- 파일 범위: 코드 3개 + plan 문서 1개, 총 4개 파일. `git diff --stat main...HEAD` 로 대조해 무관한 파일(설정·lockfile·다른 모듈) 변경 없음을 확인.
- 임포트: 3개 코드 파일 모두 import 구문 변경 없음.
- 신규 테스트 2건(`workflows.service.spec.ts` +28줄)은 plan 이 선언한 INFO #9(엣지 0건 조합 단언), #10(condition 참조 격리 단언)에 정확히 대응하며 그 외 기존 테스트 수정 없음.
- 핵심 동작 변경은 `condition: edge.condition` → `condition: edge.condition ? { ...edge.condition } : edge.condition`(`workflows.service.ts:325`) 단 한 줄이며, INFO #10 그대로.
- plan 문서가 "조치하지 않음" 으로 분류한 6건(#1/#2/#3/#6/#11/#13)에 대응하는 코드 변경은 diff 어디에도 없음 — 문서상 주장과 실제 diff 가 일치.

## 요약

`review-info-followups` 브랜치는 이전 리뷰가 "필수 아님" 으로 미룬 INFO 10건 중 4건(#8/#9/#10/#12)만 선별 조치하고 나머지 6건은 근거를 남겨 종결하는, 스스로 스코프를 명시한 작업이다. 실제 diff(4개 파일)를 plan 문서의 선언과 대조한 결과 완전히 일치했고, 코드 3개 파일 모두 대상 범위(`workflows.controller.ts`/`workflows.service.ts`/`workflows.service.spec.ts`) 안에 머물렀으며 임포트·설정 변경이나 무관한 리팩토링은 없었다. 유일하게 눈에 띄는 점은 네이밍 통일(#8)이 결함의 직접 위치(`duplicate()`)를 넘어 형제 함수 `importWorkflow()`(및 그 결과로 파생된 한 줄 재포맷)까지 건드렸다는 것인데, 이는 "고치는 함수의 주석이 다른 함수의 변수명을 인용하는데 그 이름이 이미 코드와 어긋나 있었다" 는 구체적 근거로 plan 에 명시돼 있고 grep 으로 리네임의 완전성도 확인돼, 실질적인 스코프 이탈이라기보다 문서화된 부수 정리에 가깝다. Swagger description 포맷팅(#12)도 동작 변경이 없는 순수 개선이라는 점에서 마찬가지다.

## 위험도

LOW
