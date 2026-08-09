# 유지보수성(Maintainability) 코드 리뷰

## 발견사항

- **[WARNING]** `danglingSpecImpact` 가 자매 함수 `hasValidSpecImpact` 와 다른 설계 패턴을 쓴다 — 콜백 주입 대신 `fs.existsSync` 를 하드코딩해 실 파일시스템에 결합됨
  - 위치: `codebase/frontend/src/lib/docs/__tests__/plan-scan.ts:95-99`(`danglingSpecImpact`) 대비 `codebase/frontend/src/lib/docs/__tests__/spec-plan-completion.test.ts:67-81`(`hasValidSpecImpact`, `specExists` 콜백 주입)
  - 상세: `hasValidSpecImpact(impact, specExists)` 는 존재 확인을 `specExists` 콜백으로 주입받아 합성 fixture 로 완전히 격리 테스트할 수 있는 반면, `danglingSpecImpact(root, impact)` 는 같은 파일 안 자기 자신의 독스트링(`spec-plan-completion.test.ts:91-93`: "순수 함수로 뺀 이유... 합성 fixture 로 겨눌 수 있어야 한다")이 명시한 목표와 달리 `fs.existsSync(path.join(root, p))` 를 인라인으로 호출해 실 파일시스템에 결합돼 있다. 실제로 `spec-plan-completion.test.ts:248-249` 의 테스트("flags non-string spec_impact entries as dangling")는 `repoRoot()` 를 불러 실 저장소의 `spec/conventions/spec-impl-evidence.md` 존재에 의존한다 — 그 파일이 이동·삭제되면 이 유닛 테스트가 무관한 이유로 깨진다. 같은 파일에서 이미 확립된 "주입 가능한 predicate" 패턴이 있는데 한쪽만 벗어난 것은 일관성 위반이며, 향후 새 판정 함수를 추가할 때 어느 패턴을 따라야 할지 혼선을 준다.
  - 제안: `danglingSpecImpact(root, impact)` 도 `hasValidSpecImpact` 처럼 `specExists: (p: string) => boolean` 콜백을 받도록 시그니처를 통일하면, 해당 테스트도 완전히 합성 fixture 로 격리되고 실 저장소 파일 존재 여부에 우발적으로 결합되지 않는다.

- **[INFO]** 매직 넘버 — sanity-check 임계값 `10` 의 선택 근거 미기재
  - 위치: `codebase/frontend/src/lib/docs/__tests__/spec-plan-completion.test.ts:176`
  - 상세: `expect(plans.length).toBeGreaterThan(10);` 위 주석(172-175줄)은 "이 검사가 왜 필요한지"(repoRoot 오탐지 → 빈 스캔 → vacuous pass 방지)는 설명하지만, 왜 하필 `10` 인지는 설명하지 않는다. `>0` 이면 목적 달성에 충분해 보이는데 `10` 을 고른 근거가 없어 향후 plan 이 줄어드는 리팩터 시 이 임계값이 왜 깨졌는지 추적하기 어렵다.
  - 제안: 임계값 선택 근거(예: "현재 완료 plan 수의 안전 마진")를 주석에 한 줄 추가하거나, `>0` 으로 낮춰 목적과 값을 일치시킨다.

- **[INFO]** `rawScalar` 가 `key` 를 이스케이프 없이 정규식 리터럴에 직접 삽입
  - 위치: `codebase/frontend/src/lib/docs/__tests__/plan-scan.ts:196-200`(`rawScalar` 함수, `new RegExp` 구성부)
  - 상세: `new RegExp(`^[ \\t]*${key}:[ \\t]*(.*)$`, "m")` 는 `key` 에 정규식 메타문자(`.`, `*`, `(` 등)가 들어오면 의도와 다르게 매칭되거나 예외를 던질 수 있다. 현재는 `"started"` 리터럴로만 호출돼 위험이 없지만, 향후 호출부가 늘면서(파일 자체 주석이 "다섯 번째 파서 호출이 추가될 때" 를 명시적으로 경계하는 만큼) 특수문자가 포함된 키를 넘기면 조용히 깨질 수 있다.
  - 제안: `key` 를 항상 안전한 리터럴로만 호출한다는 계약을 JSDoc 에 명시하거나, 방어적으로 정규식 이스케이프를 적용한다.

- **[INFO]** `walkPlanMarkdown` 의 `bucket` 파라미터가 넓은 `string` 타입이라 오타가 컴파일타임에 잡히지 않음
  - 위치: `codebase/frontend/src/lib/docs/__tests__/plan-scan.ts:59-63`(`walkPlanMarkdown` 시그니처)
  - 상세: 현재 두 호출부(`plan-scan.ts:90`, `plan-scan.ts:95`)는 `"in-progress"`/`"complete"` 리터럴만 넘겨 안전하지만, `bucket: string` 이 아니라 좁은 유니온이 아니므로 오타(`"in-progres"` 등)를 넘겨도 타입 체커가 잡지 못하고 `fs.existsSync(dir)` 가 `false` 를 반환해 조용히 빈 배열을 돌려준다 — 스캔 대상이 통째로 빠지는 fail-open 실패 모드다.
  - 제안: `bucket: "in-progress" | "complete"` 로 좁혀 향후 세 번째 bucket 추가 시 오타를 컴파일타임에 방지한다.

- **[INFO]** `startedDate`/`hasMalformedStarted` 가 같은 원문 값을 각각 독립적으로 재계산
  - 위치: `codebase/frontend/src/lib/docs/__tests__/spec-plan-completion.test.ts:47`(`startedDate` 내부 `rawScalar` 호출), `:63`(`hasMalformedStarted` 내부 `rawScalar` 호출)
  - 상세: 두 함수 모두 `rawScalar(block, "started")` 를 독립 호출하고, 같은 plan 에 대해 테스트 쪽(`:146`)에서 메시지 조립을 위해 세 번째로 다시 호출한다. 비용은 미미하나(`plan/complete/**` 전수 스캔 시 매 plan 마다 최대 3회), 두 판정 함수가 "같은 raw 값" 을 각자 재조회하는 구조라 향후 한쪽만 수정되면(예: trim 정책 변경) 서로 미묘하게 갈릴 여지가 있다 — 이 파일 자체가 "판정 이중화" 를 반복해서 경계하는 취지와 결이 다르다.
  - 제안: 필요 시 `{ raw, isValid }` 를 한 번에 계산해 공유하는 내부 헬퍼로 묶는 것을 고려(현재 규모에서는 필수는 아님).

## 요약

두 파일 모두 명명 규칙(`has*`/`is*`/`collect*`/`find*` 접두 일관성), 함수 크기, 중첩 깊이 면에서 양호하며, 과거 실측 버그(gray-matter 캐시 오염, js-yaml 날짜 롤오버, 비-문자열 `spec_impact` fail-open)를 근거로 한 상세한 근거 주석이 코드의 "왜" 를 잘 보존하고 있어 유지보수 시 의도 파악이 쉽다. 유일하게 눈에 띄는 구조적 흠은 `danglingSpecImpact` 가 같은 파일의 자매 함수 `hasValidSpecImpact` 와 달리 존재-확인 로직을 콜백 주입이 아닌 `fs.existsSync` 하드코딩으로 처리해 자신의 독스트링이 명시한 "합성 fixture 로 격리 가능해야 한다" 는 목표를 스스로 어기고, 결과적으로 관련 테스트가 실 저장소 파일 존재에 우발적으로 결합된 점이다. 나머지는 매직 넘버 임계값 근거 부족, 정규식 키 이스케이프 미비, `bucket` 파라미터 타입 협소화 여지 등 경미한 개선 여지 수준이다.

## 위험도
LOW
