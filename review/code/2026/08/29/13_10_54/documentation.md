# 문서화(Documentation) 리뷰

## 배경

이 diff 는 `#1233`(및 그 후속 3라운드 fix)의 누적 산출물이다 — 실 코드 변경 3건
(`expression-resolver.service.spec.ts`, `secret-resolver.service.ts`, `code.handler.spec.ts`),
신규 파일 1건(`error-shape.spec.ts`), plan 문서 갱신 1건, 그리고 이전 3개 리뷰 라운드
(`11_58_35`, `12_23_45`, `12_50_04`)의 산출물(`RESOLUTION.md`/`SUMMARY.md`/각 reviewer `.md`
등)이 감사 기록으로 함께 커밋됐다. 실 코드·plan 파일 5개는 `Read`/`Grep` 로 현재 저장소
상태를 직접 열어 diff 와 대조했고, 이전 라운드가 지적했던 "실측 개수 서술이 실제 코드화된
범위와 어긋난다" 패턴(1~4라운드에 걸쳐 4회 재발한 결함 클래스)이 최종 상태에서 전부
해소됐는지를 중점적으로 재검증했다.

## 발견사항

없음 — Critical·Warning 없음.

## 검증한 것 (문제 없음 확인)

- **"셋이" → "넷이" drift (4라운드 WARNING #2) — 정확히 고쳐졌다.**
  `expression-resolver.service.spec.ts` 를 직접 열어 확인한 결과, `it.each` 콜백 내부 인라인
  주석(게이트 216행)이 `// fixture 판별력 — 넷이 같은 분기로 무너지면 위 it.each 가
  무의미해진다.` 로 이미 정정돼 있고, 바로 위 189-194행의 설명 블록("네 종으로 확인한다")과
  더 이상 어긋나지 않는다.
- **`error-shape.spec.ts` 의 `EXPECTED_CODE`/`SUBCLASSES` — 소스와 1:1 일치.**
  `packages/expression-engine/src/errors.ts` 를 직접 읽어 하위 클래스 6개
  (`SyntaxError`·`ReferenceError`·`TypeError`·`FunctionError`·`TimeoutError`·`DepthExceededError`)
  와 각 클래스가 `super()` 에 넘기는 `ErrorCode` 값이 테스트 파일의 `EXPECTED_CODE` 표·
  `it('하위 클래스를 전부 집어냈다 (여섯 종)')` 의 하드코딩 배열과 정확히 일치함을 확인했다.
  "표가 하위 클래스와 1:1" 단언(73-77행)도 실제로 두 목록을 대조하는 구조라 새 클래스가
  표에 안 실리면 `undefined` 로 조용히 통과하지 않고 먼저 RED 가 난다는 주석 설명이 맞다.
- **`position` vacuous-disjunction 정정(4라운드 INFO #1) — 정확히 반영.**
  `error-shape.spec.ts:87-90` 의 `expect(err.position).toBeUndefined()` 와 그 주석("정수
  분기는 아래 base 케이스가 지나간다")이 실제 코드 구조와 일치한다 — `it.each(SUBCLASSES)`
  fixture 는 `position` 인자를 넘기지 않고, base `ExpressionError` 케이스(94-98행)만
  `position=7` 을 넘겨 정수 분기를 실제로 실행시킨다.
- **`code.handler.ts` 참조가 정확.** `code.handler.spec.ts` 의 C2 캐너리 주석이 인용하는
  "실측 근거는 `code.handler.ts` 의 같은 주석"은 실제로 `code.handler.ts:454-455` 의
  `// cause 부착 기준: spec/5-system/3-error-handling.md §6.3.1 (C1 AND C2).` 주석과
  대응하며, "빈 화이트리스트" 근거로 인용하는 `isolate.compileScript` 호출도 같은 파일
  451행에 실재한다.
- **`secret-resolver.service.ts` 신규 문단의 §6.3.1 인용이 정확.**
  "§6.3.1 은 '소비처가 직렬화하는가' 를 기준으로 삼는 안을 명시적으로 기각했다"는 서술은
  `spec/5-system/3-error-handling.md` Rationale(580-586행, "`Error.cause` 부착 기준을
  '소비처가 직렬화하는가' 로 잡지 않은 이유")과 line-level 로 일치한다. C1/C2 정의(492-494행)
  도 두 spec 파일·프로덕션 파일 주석의 서술과 정확히 대응한다.
- **enumerable own-key 축 근거의 정확성.** `this.name = ...` 대입으로 생성된 서브클래스
  인스턴스의 `name` 이 `Error.prototype.name`(non-enumerable)을 가리는 **own enumerable**
  속성이 된다는 점, `message`/`stack` 은 `Error` 생성자·V8 이 non-enumerable 로 두는 표준
  속성이라는 점을 소스 구조로 재확인했다 — `error-shape.spec.ts:100-113` 의
  `getOwnPropertyNames` vs `Object.keys` 대조 단언이 이 사실을 정확히 실측·고정한다.
- **CHANGELOG 업데이트 불요 — 유효.** `CHANGELOG.md` 는 사용자 대면 런타임 동작 변경만
  기록하는 확립된 관례(예: `system_error` 배너 복구, `config` echo 마스킹 이관 항목)이고,
  이번 diff 5개 파일은 전부 테스트·주석·plan 문서 전용이라 이 관례상 CHANGELOG 대상이
  아니다.
- **README 업데이트 불요.** `codebase/packages/expression-engine/README.md` 는
  `ExpressionError`/`ErrorCode` 를 개수 언급 없이 일반적으로만 설명하고 있어(35행), 이번
  하위 클래스 열거·전수성 단언 추가로 stale 해지는 서술이 없다.

## 남아있는 항목 (이번 diff 의 결함 아님 — 이미 plan 에 추적 중)

- **[INFO]** `secret-resolver.service.ts:93` 의 "형제 3곳" 이 실제로는 4곳
  (`expression-resolver.service.ts`/`.spec.ts`, `code.handler.ts`/`.spec.ts`)이다. 1라운드부터
  지적됐고 `plan/in-progress/deps-peer-gating-and-eslint10.md` §2 에 "다음에 그 파일을 열 때"
  항목으로 developer SKILL §수렴 예외 근거와 함께 명시적으로 등재돼 있다(체크박스 `[ ]`
  상태로 미착수임도 plan 서술과 실제 코드 상태가 일치).
- **[INFO]** "enumerable own key 를 축으로 쓰는 이유" 설명이 이제 3곳
  (`expression-resolver.service.spec.ts:178-181`, `code.handler.spec.ts:245-246`(참조만),
  `error-shape.spec.ts:19-22`)에 거의 동일 문장으로 있다. `code.handler.spec.ts` 는 참조만
  해 중복을 피하는 선례를 보이는데 신규 패키지 파일은 전문을 다시 썼다. 같은 plan §2 항목
  ("근거 서술 중복 정리 묶음")이 이 세 곳을 명시적으로 포함해 이미 추적 중이다.
- **[INFO]** `captureThrown`(`expression-resolver.service.spec.ts:20-24`)·
  `captureRejected`(`code.handler.spec.ts:9-14`) 두 헬퍼의 vacuity-guard JSDoc 이 동사
  (던지다/reject)와 형제 참조 문구만 다르고 나머지는 거의 동일 문장이다. 저장소에 이미
  `__test-utils__` 공유 헬퍼 관례가 존재함에도 이번엔 각 spec 파일에 독립 정의됐다. 같은
  plan §2 항목("근거 서술 중복 정리 묶음")이 이 중복을 명시적으로 포함하고 있어 새로운
  유실이 아니다.

세 항목 모두 spec-linked 파일(주석 한 줄만 고쳐도 `/ai-review`·`--impl-done` 이 freshness
로 동시에 재무장됨)에 걸려 있고, plan 이 developer SKILL §수렴 예외 (a)~(d) 근거를 명시한
채로 다음 편집 라운드로 미뤄 두고 있다 — 이 저장소의 확립된 수렴 관례와 일치하는 처리다.

## 요약

`#1233` 이후 4라운드에 걸쳐 반복 지적된 "실측 개수·나열 서술이 실제 코드화된 범위와
어긋난다"는 결함 클래스(1라운드: "4개 호출"→3클래스, 2라운드: "5/5 뮤테이션"→M3 누락,
3라운드: "세 클래스 전부"→4번째 클래스 누락, 4라운드: "셋이"→실제 넷)가 최종 상태에서는
전부 소스 대조로 정확함이 확인됐다. 신규 파일 `error-shape.spec.ts` 의 JSDoc·표·전수성
단언도 `errors.ts` 의 실제 클래스·enum 구조와 1:1 로 일치하고, `secret-resolver.service.ts`
의 신규 문단도 §6.3.1 Rationale 원문과 line-level 로 정합한다. CHANGELOG·README 갱신도
불요 판단이 유효하다. 남은 세 INFO(형제 3곳→4곳, enumerable 축 근거 3중 중복, 캡처 헬퍼
JSDoc 2중 중복)는 전부 이번 diff 가 새로 만든 결함이 아니라 이전 라운드부터 plan §2 에
정확히 추적되고 있는 기지의 항목이며, spec-linked 파일 재편집 비용을 근거로 한 명시적
유예(§수렴 예외)가 성립한다. 문서화 관점에서 이 라운드는 사실상 clean 하다.

## 위험도

LOW
