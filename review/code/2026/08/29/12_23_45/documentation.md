# 문서화(Documentation) 리뷰

## 배경

이 diff 는 직전 리뷰 라운드(`review/code/2026/08/29/11_58_35`)의 documentation/requirement/
testing WARNING 3건에 대한 fix 커밋(`89e9b5d53` 등)이다. 아래는 그 fix 가 실제로 정확한지
소스를 직접 열어 재검증한 결과다.

## 발견사항

없음 — Critical·Warning 없음.

## 검증한 것 (문제 없음 확인)

- **직전 라운드 WARNING #1 ("4개 오류 종류" vs 3개 열거) — 정확히 고쳐졌다.**
  `expression-resolver.service.spec.ts` 의 C2 캐너리 주석이 이제 "**세 하위 클래스 전부**가
  `['name','code','position']`" 로 서술하며 개수·나열이 일치한다(`Read` 로 직접 확인,
  func `it.each` 3-tuple 과 대응). "4개" 문구는 이 diff 어디에도 남아 있지 않다.
- **직전 라운드 WARNING #2 ("뮤테이션 5/5" vs M3 누락) — 정확히 고쳐졌다.**
  `plan/in-progress/deps-peer-gating-and-eslint10.md` 의 뮤테이션 표에 M1~M5 다섯 행이 모두
  있고, M3("캐너리 화이트리스트에서 `position` 제거 (캐너리 자기 유효성)")가 새로 채워졌다.
- **직전 라운드 WARNING #3 (캡처 보일러플레이트 반복) — 정확히 고쳐졌다.**
  `captureThrown`(동기, `expression-resolver.service.spec.ts`) / `captureRejected`(비동기,
  `code.handler.spec.ts`) 로 추출됐고, vacuity-guard 설명이 각 헬퍼의 JSDoc 한 곳에만 남아
  케이스마다 반복되지 않는다. 두 헬퍼의 JSDoc 이 서로를 "형제" 로 정확히 상호 참조한다.
- **`code.handler.spec.ts` 의 신규 C2 캐너리 근거가 소스와 일치.** 주석은 "빈 화이트리스트"의
  근거를 `isolate.compileScript` 경로로 명시하는데, `code.handler.ts:451`
  (`script = await isolate.compileScript(wrapUserCode(code));`)가 실제로 그 지점이다 —
  직전 라운드에서 `requirement` 리뷰어가 "`evaluate()` 가 아니라 `isolate.compileScript()`"
  라고 지적한 근본 원인이 정확히 반영됐다.
- **`secret-resolver.service.ts` 신규 문단의 §6.3.1 인용이 정확.**
  "§6.3.1 은 '소비처가 직렬화하는가' 를 기준으로 삼는 안을 명시적으로 기각했다" 는 서술은
  `spec/5-system/3-error-handling.md:575-586`(Rationale "`Error.cause` 부착 기준을 '소비처가
  직렬화하는가' 로 잡지 않은 이유")과 line-level 로 일치한다.
- 새 `it.each` 테스트 타이틀(`'C2 캐너리 — %s 의 ...'`)의 `%s` 는 Jest 포맷 스펙과 호환되고
  fixture 배열의 첫 요소(className)로 정확히 치환된다.
- CHANGELOG 업데이트 불요 판단 유지: 4개 파일 모두 테스트·주석·plan 전용이고 런타임 동작 변경이
  없다(`CHANGELOG.md` 는 사용자 대면 동작 변경만 기록하는 확립된 관례).

## 남아있는 항목 (이번 diff 의 결함 아님 — 참고용)

- **[INFO]** `secret-resolver.service.ts:93` 의 "형제 3곳" 카운트가 여전히 실제 4곳
  (`expression-resolver.service.ts`/`.spec.ts`, `code.handler.ts`/`.spec.ts`)과 어긋난다.
  직전 라운드 INFO #3 로 이미 지적됐고, `RESOLUTION.md`(§보류 항목)와
  `plan/in-progress/deps-peer-gating-and-eslint10.md`(§2, "다음에 그 파일을 열 때" 절)에
  developer SKILL §수렴 예외 (a)~(d) 근거와 함께 명시적으로 등재돼 있다 — 이번 diff 가
  새로 만든 결함이 아니고 유실도 아니다. 조치 불요.
- **[INFO]** "enumerable own key" 축 선택 근거 설명이 두 spec 파일에 거의 동일한 문장으로
  중복된다. 직전 라운드 INFO #4 로 이미 지적됐고 같은 plan 위치에 후속 항목으로 등재돼 있다.
  조치 불요.
- 위 두 항목 모두 spec-linked 파일(주석 한 줄만 고쳐도 `/ai-review`·`--impl-done` 이
  freshness 로 재무장되는 파일)에 걸려 있어, plan 에 등재해 다음 라운드로 미루는 처리 방식이
  이 저장소의 확립된 수렴 관례(§수렴 예외)와 일치한다.

## 요약

직전 라운드에서 documentation/requirement/testing 세 리뷰어가 독립적으로 지적한 "실측 개수가
실제 코드화된 커버리지·서술과 어긋난다"는 결함 3건 전부가 이번 diff 에서 근본 원인까지 정확히
고쳐졌다 — 소스(`code.handler.ts:451`, `it.each` fixture, 뮤테이션 표, spec §6.3.1 원문)를
직접 대조해 확인했다. 새로 도입된 문서(JSDoc, 인라인 주석, plan 갱신)는 모두 실제 코드·spec
과 정확히 일치하고, 남은 두 INFO 는 이번 diff 의 결함이 아니라 이미 정당한 근거로 plan 에
후속 등재된 기지의 항목이다. 문서화 관점에서 이 라운드는 clean 하다.

## 위험도

NONE
