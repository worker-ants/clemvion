### 발견사항

- **[WARNING]** `loop.handler.ts` — `void parseNumeric()` 호출이 실질적으로 dead code
  - 위치: `loop.handler.ts` diff `+void parseNumeric(count);` / `+void (maxIterations !== undefined ? parseNumeric(maxIterations) : null);`
  - 상세: 주석은 "side-effect of validating the resolved values"라고 설명하지만 `parseNumeric`은 순수 함수(pure function)로 side-effect가 없다. `void` 키워드로 반환값을 버리면 아무 동작도 하지 않는다. 주석이 독자를 오도(mislead)하며, 코드 자체로는 아무 검증도 수행되지 않는다.
  - 제안: 두 `void` 라인을 제거하거나, 실제 validation이 필요하다면 `validate()` 진입 시점에서 수행하도록 한다. 주석도 제거 또는 수정 필요.

- **[WARNING]** `table.handler.ts` — `output`에 `columns: resolvedColumns` 신규 추가가 raw-echo 범위를 초과
  - 위치: `table.handler.ts` diff `+      columns: resolvedColumns,`
  - 상세: 이 PR의 목표는 `config` 에코를 raw로 전환하는 것인데, `output`에 기존에 없던 `columns` 필드가 새로 추가됐다. 이는 다운스트림 소비자에게 새로운 출력 데이터를 노출하는 기능 추가로, raw-echo 마이그레이션 범위를 벗어난다.
  - 제안: `columns: resolvedColumns` 를 `output` 에서 제거하고 별도 PR로 분리하거나, 별도 spec/요구사항으로 명시 후 진행한다.

- **[WARNING]** `parallel.handler.ts` — `maxConcurrency`·`waitAll` 연산 로직 완전 제거 (행동 변경)
  - 위치: `parallel.handler.ts` diff 중 `-const maxConcurrency = ...` / `-const waitAll = ...` 블록 삭제
  - 상세: 이전에는 `maxConcurrency`를 0..16으로 클램핑하고 `waitAll`을 boolean 검증하여 엔진에 전달했다. 변경 후 이 계산이 완전히 제거되고 raw 값이 그대로 에코된다. 클램핑 책임이 명시적으로 엔진으로 이동했는지 확인이 필요하다. `parallel.schema.spec.ts` 테스트를 업데이트한 것은 일관성 있으나, 엔진이 raw 값을 직접 사용할 경우 범위 초과(100, 음수 등)가 런타임에 영향을 줄 수 있다.
  - 제안: 엔진 코드에서 `maxConcurrency` 클램핑 로직 존재 여부를 명시적으로 확인하고, 리뷰 코멘트 또는 연관 엔진 변경 PR을 참조한다.

- **[INFO]** `plan/in-progress/ai-review-deferred-items.md` — PR-B 상세 계획(~160줄) 추가가 이 PR 범위와 무관
  - 위치: `ai-review-deferred-items.md` 하단 `## PR-B 상세 계획` 섹션 전체
  - 상세: 해당 섹션은 수평 확장 인프라(`execution_node_log` 테이블, Redis pub/sub continuation bus)에 관한 상세 설계 문서로, 이번 raw-echo 마이그레이션과 직접 관련이 없다. 문서 변경 자체는 무해하지만 PR diff를 혼잡하게 만든다.
  - 제안: PR-B 계획 문서는 별도 docs-only 커밋 또는 별개 PR로 분리 권장.

- **[INFO]** `information-extractor.handler.ts` — 에코 키 이름과 rawConfig 필드명 불일치
  - 위치: `configEcho` 내 `schema: rawConfig.outputSchema ?? outputSchema`
  - 상세: 에코 객체의 키는 `schema`이지만 rawConfig에서 읽는 필드명은 `outputSchema`다. 이는 의도적 매핑일 수 있으나, `rawConfig`에 `outputSchema`가 없을 경우 `outputSchema`(평가된 값)로 폴백하는 구조라 Principle 7 관점에서 완전한 raw 보존이 아닐 수 있다.
  - 제안: raw config 필드명이 실제로 `outputSchema`인지 스키마에서 확인하고, 불일치라면 키 이름을 통일한다.

- **[INFO]** `chart.handler.ts` — `void chartType; void title;` 불필요한 void 억제문 추가
  - 위치: `chart.handler.ts` diff `+    void chartType; +    void title;`
  - 상세: `chartType`·`title` 변수는 함수 상단에서 추출되지만 rawConfig 전환 후 configEcho에서 사용되지 않아 unused 경고를 억제하기 위해 `void`가 추가됐다. 변수 추출 자체를 제거하거나 rawConfig에서 직접 읽는 방식이 더 깔끔하다.
  - 제안: `const chartType = ...` / `const title = ...` 할당을 제거하고 `rawConfig.chartType` / `rawConfig.title`을 직접 사용한다.

- **[INFO]** 포맷팅 변경 — 빈 줄 제거가 실질적 변경과 혼재
  - 위치: `carousel.handler.ts`, `chart.handler.ts`, `merge.handler.ts`의 파라미터 앞 빈 줄 제거
  - 상세: 기능 변경과 무관한 공백 제거가 포함되어 있어 diff 리뷰를 어렵게 만든다. 해롭지는 않으나 별도 포맷팅 커밋으로 분리하는 것이 관례에 맞다.

---

### 요약

이 PR은 노드 핸들러 전반에 걸쳐 `config` 에코를 평가된 값에서 raw 사용자 입력(`context.rawConfig`)으로 전환하는 Principle 7 마이그레이션 작업으로, 핵심 변경 범위는 명확하고 일관성 있게 적용되었다. 단, `loop.handler.ts`의 dead `void parseNumeric()` 호출(주석과 코드가 불일치), `table.handler.ts`의 `output.columns` 신규 추가(범위 초과), `parallel.handler.ts`의 클램핑 로직 완전 삭제(행동 변경 + 엔진 의존성 암묵적 가정), `ai-review-deferred-items.md`의 무관한 PR-B 계획 문서 추가 등 범위를 벗어나거나 의도를 오도할 수 있는 부분이 혼재한다.

---

### 위험도

**LOW**