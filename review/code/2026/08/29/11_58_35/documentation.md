# 문서화(Documentation) 리뷰

## 발견사항

- **[WARNING]** C2 캐너리 주석의 "실측 대상 개수" 서술이 실제 열거와 어긋난다
  - 위치: `codebase/backend/src/modules/execution-engine/expression/expression-resolver.service.spec.ts:173-176` (신규 추가분)
  - 상세: "화이트리스트는 실측이다 (2026-08-29, `evaluate()` 를 **4개** 오류 종류로 직접 호출)" 라고 적어 놓고 바로 다음 줄에서 실제로 열거하는 것은 `ExpressionSyntaxError`·`ExpressionReferenceError`·`ExpressionTypeError` **3개**뿐이다(`전부 ['name','code','position']`). `packages/expression-engine/src/errors.ts` 에는 이 외에도 `FunctionError`·`TimeoutError`·`DepthExceededError` 가 더 있어 "4개" 자체는 불가능한 수는 아니지만, 어떤 4번째 타입을 호출했고 그 결과가 같은 화이트리스트였는지가 주석에서 확인되지 않는다. 같은 문구("4개 오류 종류로 직접 호출")가 `plan/in-progress/deps-peer-gating-and-eslint10.md:426-429` 에도 그대로 복제돼 있어, 개수 오기라면 두 곳 다 정정이 필요하다.
  - 제안: 실제로 4개를 호출했다면 누락된 4번째 클래스명과 그 결과를 마저 적고, 3개만 호출했다면 "4개" 를 "3개" 로 정정한다. 이 저장소가 반복적으로 강조해 온 "실측 수치는 재현 가능해야 한다" 원칙에 비춰 사소해 보여도 남겨두면 다음 사람이 존재하지 않는 4번째 케이스를 찾아 헤매게 된다.

- **[WARNING]** 뮤테이션 검증표의 "5/5 RED" 주장이 본문에서 4건만 설명된다
  - 위치: `plan/in-progress/deps-peer-gating-and-eslint10.md:430-433` (신규 추가분)
  - 상세: "뮤테이션 5/5 RED (예측과 전부 일치)" 라고 선언한 뒤 실제로 서술하는 것은 `M1·M2`(민감 속성 추가, 1건씩 실패)와 `M4·M5`(`cause: err` 제거, 2건씩 실패) 뿐이다. `M3` 은 파일 전체를 검색해도(`grep -n "M1\|M2\|M3\|M4\|M5"`) 한 번도 등장하지 않는다. "5/5" 라는 구체적 분모를 명시했으므로 독자가 검증하려면 5개 전부의 정체와 결과가 필요한데, 3번째 뮤턴트가 무엇이었는지·RED 였는지가 텍스트만으로는 확인 불가능하다.
  - 제안: `M3` 이 무엇을 뮤테이션했고 어떤 결과였는지 한 줄 보강하거나, 실제로 4개 뮤턴트만 돌렸다면 "5/5" 를 "4/4" 로 정정한다.

- **[INFO]** `secret-resolver.service.ts` 의 "형제 N곳" 카운트가 실제 사례 수와 다를 수 있다 (사전 존재 문맥 — 이번 diff 로 새로 생긴 건 아님)
  - 위치: `codebase/backend/src/modules/secret-store/secret-resolver.service.ts:93` (unchanged context line, 이번 diff 의 바로 위 문맥)
  - 상세: "형제 3곳이 `C1 — … C2 — …` 두 줄인 것과 형식이 다른 이유" 라고 적혀 있는데, `grep -rln "C1 —"` 로 실제 C1/C2 두 항목을 모두 서술하는 "cause 부착" 형제 지점을 세면 `expression-resolver.service.ts` · `expression-resolver.service.spec.ts` · `code.handler.ts` · `code.handler.spec.ts` **4곳**이 나온다(plan 문서 자신도 "`expression-resolver.service.ts` · `code.handler.ts` · `secret-resolver.service.ts` + 두 spec 파일" 다섯 파일을 한 세트로 언급한다 — `secret-resolver` 자신을 빼면 4). 이번 PR 이 그 4곳 중 2곳(두 `.spec.ts`)에 새 C2 캐너리 단락을 추가하며 "3곳" 문구를 그대로 두고 넘어갔다. 새로 건드린 코드는 아니라 우선순위는 낮지만, 바로 옆에 새 단락을 얹은 자리라 함께 손볼 기회였다.
  - 제안: 다음에 이 파일을 열 때 "형제 3곳" → "형제 4곳" (또는 정확한 개수) 로 정정.

- **[INFO]** "enumerable own key" 측정 축 설명이 spec 이 아니라 두 test 파일에 각각 복제돼 있다
  - 위치: `codebase/backend/src/modules/execution-engine/expression/expression-resolver.service.spec.ts:167-171`, `codebase/backend/src/nodes/data/code/code.handler.spec.ts:238-239`
  - 상세: `spec/5-system/3-error-handling.md §6.3.1` 의 C2 조건 원문("message·name 밖의 민감 정보를 속성으로 들고 있지 않다")에는 "enumerable" 이라는 한정이 없다(`grep -n "enumerable" spec/5-system/3-error-handling.md` = 0건). "왜 enumerable own key 를 축으로 골랐는가"(직렬화 채널이 enumerable 만 본다는 근거)라는 테스트 설계 판단이 두 파일에 거의 동일한 문장으로 중복 서술돼 있다. 정책 텍스트 자체를 요약한 것은 아니라서 이 PR 이 경계했던 "정본 요약 재서술" 문제와는 다르지만, 이 축 선택이 향후 바뀌면(예: non-enumerable 속성도 막아야 하는 사례가 생기면) 두 자리를 동시에 고쳐야 하는 잠재적 drift 지점이다.
  - 제안: 급하지 않음. 다음에 이 근처를 다시 만질 때 한쪽이 다른 쪽을 참조하는 형태로(이미 "형제 expression-resolver 와 같은 축" 이라고 code.handler.spec.ts 가 부분적으로 하고 있음) 완전히 단일화하거나, `§6.3.1` Rationale 에 "enumerable 한정" 근거를 한 줄 추가해 두 test 주석이 그걸 인용하게 하는 편이 유지보수에 유리하다.

## 검증한 것 (문제 없음 확인)

- `expression-resolver.service.spec.ts` / `code.handler.spec.ts` 의 C2 캐너리 주석이 인용하는 "실측 근거는 `expression-resolver.service.ts`/`code.handler.ts` 의 같은 주석" 참조는 실제로 그 두 프로덕션 파일에 대응하는 C1/C2 주석이 존재해 정확했다.
- `ExpressionError` 계열(`packages/expression-engine/src/errors.ts`)이 `code`/`name`/`position` 을 전부 `this.xxx = …` 인스턴스 대입으로 설정해 enumerable own key 가 된다는 점, `position` 이 `number | undefined` 라 "정수 또는 미설정" 서술과 일치한다는 점을 소스에서 확인했다.
- `secret-resolver.service.ts` 에 새로 추가된 단락("서버 로그에만 남는 것도 아니다"는 C1 의 보조 근거일 뿐 판정축이 아니다)은 뒤따르는 "아래" 문단을 정확히 전방 참조하며, 리뷰 INFO #2 가 지적한 오인 소지(§6.3.1 이 기각한 "소비처가 직렬화하는가" 기준과 헷갈릴 위험)를 정확히 해소한다.
- `plan/in-progress/deps-peer-gating-and-eslint10.md` 의 체크박스 갱신은 본문에 중복 체크리스트가 없어 "두 군데 동기화" 문제가 발생하지 않았고, `complete/` 로 옮기지 않은 이유(병렬 PR `#1231` 이 §2 에 후속 3건을 추가로 등재할 예정)도 명시적으로 근거가 남아 있다.
- CHANGELOG.md 는 사용자 대면 동작 변경/회귀만 기록하는 패턴이며 이번 변경(테스트 추가 + 주석 정정 + plan 갱신)은 런타임 동작을 바꾸지 않으므로 CHANGELOG 업데이트 불요로 판단.

## 요약

이번 diff 는 코드 동작 변경이 없는 테스트·주석·plan 문서 전용 변경이며, 전반적으로 문서화 품질이 매우 높다 — 각 단언이 왜 그 값을 검증하는지, C1/C2 판정 기준이 어디(spec §6.3.1)에 있는지, 과거에 스스로 낸 오류(Jest realm 오귀속 등)를 취소선으로 정정한 이력까지 자기 참조가 촘촘하다. 다만 이번에 새로 쓴 "실측" 서술 두 곳(스펙 파일의 "4개 오류 종류" vs 3개 열거, plan 의 "뮤테이션 5/5" vs M1·M2·M4·M5 만 서술)에서 숫자와 실제 열거가 어긋나 검증 가능성이 떨어진다 — 이 저장소가 스스로 여러 번 짚어 온 "정량 주장은 재현 가능해야 한다" 원칙에 정확히 해당하는 결함이다. 그 외에는 인접한 기존 문맥의 사소한 카운트(형제 3곳→4곳)와 테스트 설계 근거의 경미한 중복 정도만 눈에 띈다.

## 위험도

LOW
