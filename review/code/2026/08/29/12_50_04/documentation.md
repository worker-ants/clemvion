# 문서화(Documentation) 리뷰

## 발견사항

- **[WARNING]** C2 캐너리 인라인 주석이 fixture 개수를 "셋"으로 서술하지만 실제 배열은 넷이다 (동일 결함 패턴의 4번째 재발)
  - 위치: `codebase/backend/src/modules/execution-engine/expression/expression-resolver.service.spec.ts:216`
  - 상세: `it.each` 콜백 안의 `// fixture 판별력 — 셋이 같은 분기로 무너지면 위 it.each 가 무의미해진다.` 주석은 이 `it.each` 가 `ExpressionSyntaxError`/`ExpressionReferenceError`/`ExpressionTypeError` **3종**뿐이던 2라운드(`12_23_45`) 시점에 정확했다. 그러나 3라운드에서 리뷰가 4번째 클래스(`ExpressionFunctionError`)를 뮤테이션(47/47 GREEN)으로 뚫자 fixture 배열에 `['ExpressionFunctionError', '{{ unknownFn() }}', 'EXPR_FUNCTION_ERROR']`을 추가했는데(파일 199-207행, gate), 이 특정 인라인 주석만 "셋이"로 남았다. 바로 위 189-194행의 더 큰 설명 블록은 이미 "네 종"으로 정확히 갱신돼 있어(`이 catch 가 실제로 그런 cause 를 달아 내보내는지를 resolveConfig 경로로 값싸게 트리거되는 네 종으로 확인한다`), 같은 함수 안에서 개수 서술이 서로 다른 상태다. 이 PR 은 정확히 이 클래스의 결함("실측 개수 서술이 실제 코드화된 범위와 어긋난다")을 이미 세 번(1라운드: "4개 호출"→실제 3클래스, 2라운드: "5/5 뮤테이션"→M3 미서술, 3라운드: "세 클래스 전부"→4번째 클래스 누락) 리뷰가 잡아 고쳤는데, 그 세 번째 fix 자체가 같은 형태의 네 번째 사례를 새로 남긴 셈이다.
  - 제안: `// fixture 판별력 — 셋이` → `// fixture 판별력 — 넷이` 로 정정. spec-linked 파일이므로 이 PR 이 이미 확립한 "developer SKILL §수렴 예외" 관례에 따라 plan 후속 항목(`근거 서술 중복 정리 묶음`)에 묶어 다음 편집 라운드에서 함께 처리하거나, 한 단어 정정이므로 이번 라운드에 바로 고쳐도 비용이 낮다.

- **[INFO]** `secret-resolver.service.ts:93` 의 "형제 3곳" 카운트 — 확인 결과 이번 diff 의 신규 결함 아님, 이미 정확히 추적 중
  - 위치: `codebase/backend/src/modules/secret-store/secret-resolver.service.ts:93` (unchanged context)
  - 상세: 직접 열어 보니 여전히 "형제 3곳이 `C1 — … C2 — …` 두 줄인 것과 형식이 다른 이유" 라고 서술돼 있고, 실제 형제 지점(`expression-resolver.service.ts`/`.spec.ts`, `code.handler.ts`/`.spec.ts`)은 4곳이다. 다만 이 불일치는 1라운드(`11_58_35` INFO #3)부터 이미 지적됐고, `plan/in-progress/deps-peer-gating-and-eslint10.md` §2 에 "다음에 그 파일을 열 때" 항목(`- [ ] (작음) secret-resolver.service.ts 의 "형제 3곳" → 4곳`)으로 developer SKILL §수렴 예외 (a)~(d) 근거와 함께 명시적으로 등재돼 있음을 재확인했다 — 새로운 유실이 아니다.
  - 제안: 조치 불요. 이미 tracked.

- **[INFO]** "enumerable own key" 축 선택 근거 문장의 파일 간 중복 — 확인 결과 이미 정확히 추적 중
  - 위치: `codebase/backend/src/modules/execution-engine/expression/expression-resolver.service.spec.ts:178-181`, `codebase/packages/expression-engine/src/__tests__/error-shape.spec.ts:19-22`
  - 상세: `grep` 대조 결과 "`detail`/`hint`, HTTP 응답 헤더, 커넥션 문자열처럼 **직렬화에 딸려 나오는** 값이다" 문장이 두 파일에 거의 동일하게 반복된다. 이 역시 plan §2 "근거 서술 중복 정리 묶음" 항목에 신규 패키지 캐너리까지 포함해 이미 등재돼 있다.
  - 제안: 조치 불요. 이미 tracked.

## 검증한 것 (문제 없음 확인)

- `packages/expression-engine/src/errors.ts` 를 직접 읽어 `ExpressionError` 하위 클래스가 정확히 **여섯**(`SyntaxError`·`ReferenceError`·`TypeError`·`FunctionError`·`TimeoutError`·`DepthExceededError`) 임을 확인했다 — `error-shape.spec.ts` 의 `SUBCLASSES` 전수성 단언·plan 의 "여섯" 서술과 정확히 일치.
- `error-shape.spec.ts` 의 JSDoc(왜 패키지 레벨에 두는지, 왜 enumerable 을 축으로 골랐는지)이 실제 코드(`SUBCLASSES` 필터·`ALLOWED_KEYS`)와 정확히 대응한다.
- `code.handler.spec.ts` 의 C2 캐너리 주석("빈 화이트리스트", `isolate.compileScript` 근거)이 실측(`Object.keys=[]`, `getOwnPropertyNames=['stack','message']`) 서술과 일치하며, 형제 파일 참조("그쪽 주석에 있다")도 정확히 성립한다.
- `plan/in-progress/deps-peer-gating-and-eslint10.md` 의 누적 서술(1~3라운드 로그, 뮤테이션 표 M1~M5·M9~M10, 체크박스 `[x]`/`[ ]` 상태)을 전문 대조한 결과 내부 일관성이 유지된다 — 특히 이번 라운드에 새로 닫힌 두 체크박스(`C2 를 단언으로 잠그기`, `secret-resolver 보조 근거 한 문장`)가 각각 코드 상태와 실제로 대응한다.
- 프로덕션 동작 변경이 없는 테스트/주석/plan 전용 diff 이므로 CHANGELOG.md 업데이트 불요라는 1·2라운드 판단이 여전히 유효함을 재확인했다.
- `packages/expression-engine/README.md` 는 `ExpressionError`/`ErrorCode` 를 개수 언급 없이 일반적으로만 설명하고 있어, 이번에 늘어난 하위 클래스 열거로 인해 stale 해지는 부분이 없다.

## 요약

이번 diff 는 순수 테스트/주석/plan 문서 변경으로, 자기 참조가 촘촘하고 근거(§6.3.1, 실측 수치, 과거 오류의 취소선 정정)가 매우 꼼꼼한 편이다. 다만 이 PR 이 이미 세 라운드에 걸쳐 반복 지적·수정해 온 "실측 개수 서술이 실제 코드화된 범위와 어긋난다"는 결함 패턴이, 그 세 번째 수정 자체 안에서 네 번째로 재발했다 — `it.each` 배열을 3개에서 4개로 늘리면서 바로 옆의 요약 설명(189-194행)은 갱신했지만 `it.each` 콜백 내부의 국소 주석(216행)은 "셋이"로 남았다. 한 단어 수준의 사소한 drift이지만, 이 PR 자체가 "정량 주장은 재현 가능해야 한다"를 반복해서 강조해 온 맥락을 감안하면 놓치기 아까운 지점이라 WARNING 으로 보고한다. 그 외 이미 알려진 두 INFO 항목("형제 3곳"→4곳, enumerable 근거 중복)은 직접 파일을 열어 재확인한 결과 실제로 plan 에 정확히 추적되고 있어 추가 조치가 필요 없다.

## 위험도

LOW
