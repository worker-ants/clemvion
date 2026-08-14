### 발견사항

- **[WARNING]** `it.each` 테스트 타이틀의 `%s` placeholder 개수가 배열 원소 개수와 안 맞아, 실제 렌더된 테스트 제목이 의도와 다르게 나온다
  - 위치: `codebase/backend/src/modules/external-interaction/interaction.service.spec.ts:717` (`'%s — outputData 가 null 이면 %s 는 {} 가 아니라 null'`, `it.each([['completed', ExecutionStatus.COMPLETED, 'result'], ['failed', ExecutionStatus.FAILED, 'error']])`)
  - 상세: 타이틀 문자열에 `%s` 가 2개뿐인데 배열 원소는 3개(`_label`, `status`, `field`)다. Jest/Node `util.format` 은 `%s` 를 인자 순서대로 소비하므로 두 번째 `%s` 는 의도한 `field`(`'result'`/`'error'`)가 아니라 `status`(enum 값, 우연히 `_label` 과 동일 문자열)를 채우고, 소비되지 않은 세 번째 인자(`field`)는 포맷 문자열 뒤에 그대로 덧붙는다. 실측(`util.format` 직접 호출):
    - `completed — outputData 가 null이면 completed 는 {} 가 아니라 null result`
    - `failed — outputData 가 null이면 failed 는 {} 가 아니라 null error`
    즉 테스트 리포트에는 "result 는 {} 가 아니라 null" 이 아니라 "completed 는 {} 가 아니라 null result" 로 뜬다. 단언 로직(`r[field]`) 자체는 정확해 기능적 결함은 아니지만, 실행 결과 문서(테스트 리포트)가 저자의 의도를 반영하지 못한다. 바로 위 668번째 줄의 자매 `it.each` 블록은 `%s` 1개만 써서 이 문제가 없다 — 같은 파일 안에서 패턴이 갈린다. 이 커밋 계열은 "같은 커밋이 고친 것을 JSDoc/테스트 서술이 부정확하게 말한다" 는 클래스의 결함을 이미 두 라운드(`10_32_27` testing W7, `12_06_20` W1)에 걸쳐 잡아 왔는데, 이번 라운드에 신규 추가된 테스트에서 같은 클래스의 결함이 문서(타이틀)와 실행(포맷) 사이에서 다시 발생했다.
  - 제안: 타이틀을 `'%s — outputData 가 null 이면 %s 는 {} 가 아니라 null'` → `'%s — outputData 가 null 이면 %s 는 {} 가 아니라 null'` 대신 placeholder 를 3개로 맞추거나(`'%s (%s) — outputData 가 null 이면 %s 는 {} 가 아니라 null'`), 가장 간단하게는 668번째 줄 자매 블록처럼 `%s` 1개만 남기고 `_label` 만 쓰도록 통일. `field` 값을 타이틀에 노출하고 싶다면 `%s` 를 3개로 늘려 `(_label, status, field)` 순서와 맞출 것.

- **[INFO]** `websocket.service.spec.ts` 최상위 공유 헬퍼 JSDoc 에 한국어 문서 관례와 어긋나는 일본어 문구가 섞여 있다 (이번 diff 범위 밖, 참고용)
  - 위치: `codebase/backend/src/modules/websocket/websocket.service.spec.ts:15` (`/** Fanout Subject から次の 1件を取り出す共有ヘルパー (W-5: 중복 정의 통합). */`)
  - 상세: `git log -S"から次の"` 로 확인한 결과 이 줄은 기존 커밋(`4a262935c`, PR #430)에서 이미 존재하던 pre-existing 코드이고, 이번 diff(226줄 순수 추가)는 이 줄을 건드리지 않는다. 그러나 이번 라운드에서 바로 아래(`:573` 이후)에 대량의 새 한국어 JSDoc/테스트가 이 파일에 추가되면서 같은 공유 헬퍼를 반복 참조하므로, 다음에 이 파일을 손대는 사람이 자연스럽게 마주치게 된다. 이 저장소의 문서는 거의 전부 한국어이고 이 한 줄만 일본어 조사(`から`/`を`)가 섞여 있어 이례적이다.
  - 제안: 이번 라운드의 필수 수정 대상은 아니다(diff 밖). 다음에 이 헬퍼를 만질 때 `"Fanout Subject 에서 다음 1건을 꺼내는 공유 헬퍼 (W-5: 중복 정의 통합)."` 등으로 한국어로 통일 권장.

- **[INFO]** JSDoc/CHANGELOG/spec 3중 문서화가 이번 diff 의 핵심 결함(깊이 무관 strip)에 대해 이례적으로 정확하고 상호 일관됨 — 확인했으나 문제 없음(positive finding)
  - 위치: `codebase/backend/src/shared/utils/strip-external-only-fields.ts:1-90`(모듈 JSDoc) ↔ `codebase/backend/src/modules/external-interaction/interaction.service.ts:82-108`(`stripAndRedact`) ↔ `CHANGELOG.md:3-35` ↔ `spec/5-system/6-websocket-protocol.md:520`·`spec/5-system/14-external-interaction-api.md:688-693,1386-1399`
  - 상세: 다섯 문서 모두 "값 마스킹(`deepRedactSecrets`)만으로는 필드 자체가 남는다", "fanout 과 REST 두 출구 모두 열려 있었다", "출구를 각자 조립하면 한 번에 하나씩만 고쳐진다" 는 동일한 인과 서술을 반복 없이 어긋남 없이 유지한다. `notification-fanout.service.ts:134` 의 `payload: event.payload` 인용도 실제 코드와 정확히 일치함을 직접 열어 확인했다. 경계 연산자(`>` vs `>=`) 차이·순서 무관성·성능 실측치(2.80배, +20.2 µs)도 JSDoc·plan·RESOLUTION 세 곳에서 동일한 숫자로 일관된다.
  - 제안: 없음.

### 요약
이번 diff 의 실질 코드 변경(`strip-external-only-fields.ts`/`websocket.service.ts`/`interaction.service.ts` 및 대응 스펙 파일)은 여섯 라운드에 걸친 반복 리뷰-수정 사이클을 거치며 문서화 정확성 측면에서 매우 높은 성숙도에 도달해 있다 — JSDoc·CHANGELOG·spec·plan 이 서로 참조하며 동일한 인과·경계 조건·실측치를 일관되게 서술하고, 앞선 라운드들이 지적한 "코드가 고쳐진 시점과 JSDoc 이 그 사실을 반영하는 시점의 어긋남" 클래스의 결함들은 대부분 해소되었음을 직접 대조로 확인했다. 다만 이번 라운드에서 새로 추가된 `interaction.service.spec.ts` 의 null-분기 회귀 테스트 하나가 `it.each` 타이틀의 `%s` 개수 불일치로 렌더링될 테스트 설명이 저자 의도와 다르게 나오는, 같은 결함 클래스(서술-실행 불일치)의 소규모 재발이 있다 — 기능에는 영향 없으나 이 프로젝트가 반복적으로 중요하게 다뤄 온 "실행 결과가 서술과 일치하는가" 원칙에 어긋난다. 그 외 README/API 문서/CHANGELOG 갱신 필요성은 이미 충족되어 추가 조치가 필요 없다.

### 위험도
LOW
