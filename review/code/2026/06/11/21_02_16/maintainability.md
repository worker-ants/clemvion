# 유지보수성(Maintainability) Review

## 발견사항

- **[INFO]** 테스트 설명 문자열에 매직 스트링이 반복된다
  - 위치: `model-config.controller.spec.ts` L82, L97, L107, L117 — `'ws-1'`, `'cfg-1'`, `'cfg-2'`, `'id-x'`
  - 상세: 픽스처 ID(`'ws-1'`, `'cfg-1'`, `'cfg-2'`, `'id-x'`)가 여러 테스트에 인라인 리터럴로 분산된다. 이 값들 자체는 의미 없지만, 동일한 값이 3~4개 `it()` 블록에 반복되면 나중에 픽스처 구조를 바꿀 때 일괄 변경 누락 위험이 생긴다.
  - 제안: `describe` 블록 상단에 `const WS_ID = 'ws-1'` 등 상수로 추출하거나, `beforeEach`에서 이미 세팅하는 방식과 통일.

- **[INFO]** `'ws-1'`을 매개변수로 받는 `as any` 캐스팅이 `findAll / parseKind` describe 블록 5개 테스트 모두에 중복된다
  - 위치: L82, L98, L108, L118 등
  - 상세: `controller.findAll('ws-1', ... as any)` 패턴이 매 케이스마다 반복된다. `as any`가 필요한 이유(쿼리 DTO 타입 불일치)는 주석이 있지만, 공통 헬퍼(`callFindAll(kind)`)를 추출하면 보일러플레이트가 줄고 의도가 명확해진다.
  - 제안: 선택적. 테스트가 간결하고 개수가 많지 않으므로 현 수준은 수용 가능하다.

- **[INFO]** 파일 최상단 주석(`// Expose the module-private parseKind function…`)이 실제 코드와 불일치한다
  - 위치: L35–37
  - 상세: 주석은 "parseKind를 GET / 엔드포인트를 통해 노출"한다고 설명하나, `parseKind`는 컨트롤러 파일 모듈 스코프 함수이며 테스트가 직접 접근할 수 없어 `findAll`을 경유하는 것이다. "expose"라는 단어가 오해를 유발한다. "parseKind is tested indirectly via findAll" 정도가 더 정확하다.
  - 제안: 주석을 `// parseKind is tested indirectly via controller.findAll — it is a module-scope function not exported directly.`로 교정.

- **[INFO]** `ListModelConfigsQueryDto whitelist` describe 내부 `beforeEach`가 외부 `beforeEach`와 병렬로 존재해 중첩 setup 구조가 생긴다
  - 위치: L138–143
  - 상세: 이중 `beforeEach` 구조 자체는 Jest에서 정상 패턴이고, 깊이도 2단계라 복잡도 문제는 없다. 현 구조는 명시적 격리 의도(WARNING#1 fix 주석)가 달려 있어 가독성은 양호하다. 문제 없음.

- **[INFO]** `WARNING#1 fix`, `WARNING#2 fix`, `WARNING#3 fix` 레퍼런스가 테스트 주석에 남아 있다
  - 위치: L133, L161, L171, L180, L187
  - 상세: `WARNING#1 fix`, `WARNING#2 fix` 등의 주석은 리뷰 사이클 내부 레퍼런스다. 코드가 리포지토리에 영구 합류한 뒤 이 주석들은 컨텍스트 없이 떠있는 참조가 된다. 미래 개발자에게 "어느 WARNING인가?" 라는 의문만 남긴다.
  - 제안: 주석을 "이슈 참조"가 아닌 "의도 서술"로 바꾼다. 예: `// WARNING#2 fix: page default value when omitted` → `// page omitted → defaults to 1 (PaginationQueryDto default)`.

- **[INFO]** `'ws-1'` 등 픽스처 ID 패턴이 `update`, `remove`, `previewModels` describe에도 하드코딩되어 있다
  - 위치: L213, L226, L235
  - 상세: 앞서 언급한 매직 스트링 반복과 동일한 맥락. `update` 블록은 `'cfg-1'`과 `'id-x'`를 다르게 쓰는데, 두 케이스가 일부러 다른 ID를 쓰는지(경계값 의도) 단순 복붙 차이인지 주석이 없으면 알기 어렵다.
  - 제안: 두 케이스가 같은 ID를 쓸 필요가 없다면(의도적으로 다른 ID) 짧은 인라인 주석(`// different id to confirm per-call isolation`)을 추가하면 의도가 명확해진다.

## 요약

전반적으로 테스트 파일의 구조·네이밍·중첩 깊이는 양호하다. 각 describe 블록이 단일 책임을 가지고, 주석으로 회귀 목적이 설명되어 있으며, `beforeEach` 격리 패턴도 일관성 있게 적용되어 있다. 개선 여지는 (1) 리뷰 내부 레퍼런스(`WARNING#N fix`)가 영구 코드 주석으로 남는 점, (2) 픽스처 ID 리터럴이 분산된 점, (3) 파일 상단 주석의 "expose"라는 오해 소지 단어 세 가지로 한정되며 모두 심각도 낮은 INFO 수준이다.

## 위험도

LOW
