# 유지보수성(Maintainability) 리뷰

## 발견사항

- **[WARNING]** 저장 payload(`{...defined, config: mergedConfig}`)가 한 트랜잭션 콜백 안에 두 번 리터럴로 중복 작성되어 있다.
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts:707-713` (`update()` 창 1)
  - 상세: `m.save(Trigger, { id: target.id, ...defined, config: mergedConfig })` 와 바로 다음 줄의 `Object.assign(target, defined, { config: mergedConfig })` 가 "이 요청이 바꾸는 필드 집합"을 두 곳에 각각 하드코딩한다. 지금은 우연히 일치하지만, 다음 사람이 저장 대상 필드를 늘리거나 줄일 때(예: 새 optional 필드 추가, 혹은 `config` 병합 방식 변경) 한쪽만 고치고 다른 쪽을 놓치면 "DB 에 쓴 값"과 "응답에 반영한 값"이 조용히 어긋난다 — 이 PR 이 막으려는 클래스(락 밖 컬럼이 옛 값으로 되써지는 것)와 증상은 다르지만 원인 계열은 같은 "두 곳에 같은 필드 집합을 따로 유지"다. 주석은 왜 부분 객체여야 하는지는 아주 상세히 설명하지만, 이 중복 자체는 언급하지 않는다.
  - 제안: `const patch = { ...defined, config: mergedConfig };` 로 한 번만 만들고, `m.save(Trigger, { id: target.id, ...patch })` 와 `Object.assign(target, patch)` 양쪽에서 재사용한다. 필드 집합이 하나의 소스로 좁혀져 드리프트를 원천 차단한다.

- **[INFO]** `update()` 가 이미 컸던 단일 메서드(약 215줄, 551~766행)에 이번 PR 이 주석 28줄 + 코드 8줄을 더 얹어 계속 커지고 있다.
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts:679-714`
  - 상세: 트랜잭션 콜백 안에 "병합 → 저장 → 응답 재구성" 세 단계가 한 함수에 섞여 있고, 이번 추가분은 "왜 부분 객체인가"·"왜 반환값 전체를 안 쓰는가" 두 개의 독립된 역사적 이유를 같은 블록에 이어 붙였다. 저장소 관례상(메모: 과거 버그 이력을 인라인 주석으로 촘촘히 남기는 정책, `sanitizeForResponse` 리팩터 선례도 "78줄 단일 메서드"를 축마다 순수 함수로 쪼갠 전례가 있음) 이 밀도 자체는 이 코드베이스의 의도된 스타일이라 CRITICAL 로 볼 이유는 없다. 다만 저장 payload 구성(`patch` 조립)과 저장 뒤 응답 재구성(`updatedAt` 만 취하는 부분)을 이름 있는 private 헬퍼로 분리하면, 다음 사람이 "왜 저장 객체가 이 모양인가"와 "왜 응답이 반환값 전체를 안 쓰는가"를 각각 독립적으로 읽고 수정할 수 있다. 지금은 두 결정이 한 블록의 연속된 주석 안에 얽혀 있어 한쪽만 바꾸려 해도 전체 맥락을 다시 읽어야 한다.
  - 제안: 여유가 있을 때(이번 PR 스코프는 아님) `buildTriggerUpdatePatch(defined, mergedConfig)` 류로 payload 조립을, `applyWrittenTimestamp(target, written)` 류로 응답 재구성을 분리하는 후속을 고려.

- **[INFO]** `if (written.updatedAt) target.updatedAt = written.updatedAt;` 의 truthy 가드가 무엇을 방어하는지 코드만으로는 불명확하다.
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts:713`
  - 상세: 바로 위 주석(698~706행)은 "실값은 `updatedAt` 뿐이다"라고 실측을 근거로 단정한다. 즉 이 필드는 TypeORM `save` 가 항상 채우는 값이라는 전제인데, 코드는 그 전제를 신뢰하지 않고 `if` 로 방어한다. 실측이 "항상 있다"인데 코드가 "없을 수도 있다"고 다르게 말하면, 다음 사람은 어느 쪽을 믿어야 할지 애매해진다(저장소 메모의 "truthiness 가드는 이름 있는 근거가 필요" 교훈과 같은 결의 사안). 기능상 해는 없다(방어적 코드가 조용히 통과할 뿐).
  - 제안: 정말 `undefined`/`null` 이 가능한 경우가 있다면 그 이유를 한 줄 주석으로 남기고, 아니면 가드를 없애거나 `written.updatedAt` 을 non-null 로 단언(주석의 실측을 그대로 코드 신뢰도로 승격)하는 편이 "실측 문장 = 코드의 전제"를 일치시킨다.

- **[INFO]** e2e 신규 파일의 Postgres 에러 코드(`'23503'`, `'23502'`)가 매직 스트링으로 두 번 등장한다.
  - 위치: `codebase/backend/test/trigger-update-save-window.e2e-spec.ts:135`, `149`
  - 상세: 저장소 안에 이 코드들을 이름으로 감싼 기존 상수/유틸이 없어(`pg-error-fixtures.ts` 는 unique violation 만 다룸) 이 파일만의 새 관례는 아니다. 다만 주석이 "코드가 23503 이 아니라 23502 로 바뀐다"처럼 숫자 자체를 근거로 서술하고 있어, 리터럴을 그대로 두더라도 `// FK violation` / `// NOT NULL violation` 같은 한 단어 라벨을 상수로 옆에 붙이면 코드 값과 의미를 매번 주석까지 왕복하지 않고도 읽을 수 있다. 차단 사유는 아니다.
  - 제안: 필요시 `const PG_FOREIGN_KEY_VIOLATION = '23503'` 형태의 지역 상수화. 우선순위 낮음.

- **[INFO]** `triggers.service.spec.ts` 신규 두 테스트가 키 목록(`['config', 'id', 'name']`)과 반환 모양(`endpointPath: null` 등)을 리터럴로 하드코딩해 회귀에 강하게 결합되어 있다.
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.spec.ts:3881`, `3895-3902`
  - 상세: 이는 결함이 아니라 의도된 설계다(주석이 "값이 아니라 무엇을 실었는가가 계약" 이라고 명시) — 저장 필드 집합이 바뀌면 테스트가 고의로 깨지도록 만든 회귀 가드다. 다만 위 WARNING 처럼 `update()` 쪽 저장 필드 목록이 `patch` 변수 하나로 좁혀지면, 이 테스트의 기대값(`['config', 'id', 'name']`)이 "그 `patch` 의 키 목록과 항상 같아야 한다"는 대응 관계가 코드상으로도 더 뚜렷해진다. 현재는 두 파일에 각각 필드 목록이 따로 등장(WARNING 항목과 연결).
  - 제안: 별도 조치 불요 — 위 WARNING 해소 시 자연히 대응 관계가 명확해짐.

## 요약

이번 변경은 `TriggersService.update()` 의 저장 대상을 통째 엔티티에서 부분 객체로 좁히는 국소적이고 목적이 뚜렷한 수정이며, 각 결정(왜 부분 객체인가·왜 반환값 전체를 안 쓰는가·형제 mock 을 왜 async 로 바꿨는가)에 실측 근거를 상세히 남겨 가독성 자체는 나쁘지 않다. 다만 저장 시 쓰는 필드 집합(`{...defined, config: mergedConfig}`)이 `save` 호출과 `Object.assign` 호출에 리터럴로 두 번 반복돼, 향후 필드 추가/제거 시 한쪽만 고치는 드리프트 위험이 있다(WARNING 1건). 이미 크던 `update()` 메서드가 이번 PR 로 더 길어진 점, truthy 가드의 근거 불일치, e2e 매직 스트링 등은 저장소의 기존 스타일(장문 히스토리 주석, 지역 헬퍼 중복 허용)에 부합하는 수준이라 INFO 로만 남긴다. 신규 e2e/unit 테스트의 키·값 리터럴 하드코딩은 의도된 회귀 가드로, 유지보수성을 해치기보다 다음 실수를 미리 막는 장치로 보인다.

## 위험도
LOW
