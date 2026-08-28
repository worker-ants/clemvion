# 유지보수성(Maintainability) 리뷰

## 발견사항

- **[INFO]** 두 spec 파일의 신규 테스트가 `let thrown: unknown; try { ... } catch (err) { thrown = err; } expect(thrown).toBeInstanceOf(Error); const cause = (thrown as Error).cause; ...` 패턴을 그대로 복제
  - 위치: `codebase/backend/src/modules/execution-engine/expression/expression-resolver.service.spec.ts:142-146`, `codebase/backend/src/nodes/data/code/code.handler.spec.ts:203-212`
  - 상세: jest 에 `.cause` 전용 매처가 없어 두 파일 모두 "던지게 하고 잡아서 `thrown`/`cause` 를 꺼내 단언" 하는 5~9줄짜리 보일러플레이트를 직접 작성했다. 현재는 2곳뿐이라 추출 압력이 크지 않지만("rule of three" 미충족), 세 번째 자리가 생기면 중복이 늘어난다.
  - 제안: 지금 당장 추출을 요구할 정도는 아님(현상 유지로 충분). 다만 세 번째 `cause` 보존 테스트가 추가될 때 `captureThrown(fn)` 류의 공용 헬퍼로 묶는 것을 고려.

- **[INFO]** 두 신규 테스트 케이스 앞의 근거 주석이 서로 다른 파일에 거의 동일한 문장으로 중복 기재됨
  - 위치: `expression-resolver.service.spec.ts:133-140` vs `code.handler.spec.ts:198-201` — 둘 다 "`preserve-caught-error`(eslint 10 recommended) 대응", "바로 위 케이스는 `.message` 만 보므로 cause 를 떼도 GREEN", "감싼 message 가 이미 원본 `err.message` 를 싣고 있어 cause 가 새 정보를 노출하지 않는다" 를 반복
  - 상세: 두 주석 모두 같은 판별 기준("message 가 원문을 이미 담고 있으면 cause 안전")을 설명하는데, `code.handler.spec.ts` 쪽은 "형제 케이스와 같다"고 명시적으로 참조해 완전 중복은 피했다. 다만 판별 기준 자체가 두 곳(및 plan 문서)에 흩어져 있어, 기준이 바뀌면 갱신 지점이 여러 곳이 된다. plan 문서(`plan/in-progress/deps-peer-gating-and-eslint10.md:253-264`)에도 이미 "판별 기준을 `spec/conventions/`에 명문화하는 것은 여전히 planner 턴으로 남는다"고 스스로 기록해 뒀으므로 별도 지적이 아니라 기존에 인지된 후속 항목이다.
  - 제안: 조치 불요(이미 plan에 후속으로 등재됨). 향후 `spec/conventions/`에 판별 기준이 명문화되면 두 주석은 그 문서를 가리키는 짧은 참조로 축약 가능.

- **[INFO]** `code.handler.spec.ts` 신규 테스트의 `handler.execute(...)` 호출이 인접한 동일 호출(`code.handler.spec.ts:193-195`)과 달리 인자를 여러 줄로 개행
  - 위치: `code.handler.spec.ts:205-209`
  - 상세: 바로 위 기존 테스트(190-196)는 `handler.execute(null, { code: 'this is ( not valid js' }, context)` 를 한 줄에 쓰는데, 신규 테스트는 같은 인자 리터럴을 4줄로 펼쳤다. `await` 접두사로 줄 길이가 늘어나 prettier 개행 임계값을 넘긴 것으로 보이며(lint/format PASS 보고됨), 실질적 가독성 문제는 아니고 포매터 산출물이라 판단됨.
  - 제안: 별도 조치 불요 — prettier 자동 포매팅 결과로 일관성 위반이 아님.

## 요약

이번 diff 는 (1) 사용처 0건이 확인된 `@eslint/eslintrc` devDependency 제거, (2) `preserve-caught-error` 규칙 대응으로 붙인 `cause: err` 를 회귀 잠금하는 신규 테스트 2건 추가, (3) 해당 작업 이력을 기록한 plan 문서 갱신, (4) 자동 생성된 lockfile 갱신으로 구성된다. 신규 테스트는 각각 5~10줄 내외로 짧고 단일 책임을 지키며, jest 매처가 없는 `.cause` 검증을 위한 try/catch 패턴과 vacuity 방지 주석까지 갖춰 기존 코드베이스의 "실측 기반 회귀 고정" 컨벤션(예: `text-chunker.spec.ts` 의 "(...제거 시 RED)" 네이밍)을 그대로 따른다. 매직 넘버·과도한 중첩·긴 함수·순환 복잡도 문제는 발견되지 않았고, 지적할 만한 항목은 두 파일 간 근거 주석의 경미한 중복과 사소한 보일러플레이트 반복 정도이며 둘 다 심각도가 낮고 일부는 plan 문서에 이미 후속 항목으로 인지되어 있다.

## 위험도

NONE
