## 유지보수성 코드 리뷰

---

### 발견사항

#### **[WARNING]** 상태 enum 중복 정의
- **위치**: `explore-tools.service.ts` (EXECUTION_STATUS_VALUES 배열) ↔ `tool-definitions.ts` (JSON schema enum 배열)
- **상세**: `'pending' | 'running' | 'completed' | 'failed' | 'cancelled' | 'waiting_for_input'` 값이 두 파일에 독립적으로 선언되어 있다. 새 상태(`'paused'` 등)를 추가하거나 기존 값 이름을 변경할 때 한 쪽만 수정하는 실수가 발생할 수 있다. 현재 두 목록이 6개로 일치하지만, diff 확인 없이 동기화가 보장되지 않는다.
- **제안**: `EXECUTION_STATUS_VALUES`를 `tool-definitions.ts`(또는 별도의 `execution-status.constants.ts`)에서 export하고, `tool-definitions.ts`의 JSON schema enum과 `explore-tools.service.ts`의 타입 필터 모두 그 배열을 import해 단일 소스로 관리.

---

#### **[WARNING]** `getExecutionDetails` 내부에서 병렬화 가능한 쿼리가 직렬로 실행됨
- **위치**: `explore-tools.service.ts` — `getExecutionDetails` 메서드 본문
- **상세**: 스코프 통과 후 `loadTimeline(execution.id)`와 `executionRepo.find({ where: { parentExecutionId: execution.id } })`는 서로 의존성이 없다. 현재 코드는 두 쿼리를 순차 실행하여 불필요한 대기가 발생한다. 단위 테스트에서는 차이가 없지만, 실제 실행에서 타임라인이 크거나 자식 실행이 많을 때 응답 지연이 생긴다.
- **제안**:
  ```typescript
  const [timeline, directChildren] = await Promise.all([
    this.loadTimeline(execution.id),
    this.executionRepo.find({ ... }),
  ]);
  ```

---

#### **[WARNING]** `getExecutionDetails`의 메서드 길이 및 책임 범위
- **위치**: `explore-tools.service.ts:getExecutionDetails` (~75 LOC)
- **상세**: 단일 메서드가 ① UUID 검증, ② workspace 체크 포함 조회, ③ scope 검증, ④ 타임라인 로드, ⑤ 직계 자식 조회, ⑥ subExecutions 빌드, ⑦ truncation depth 확인, ⑧ 응답 조립 8단계를 연속으로 수행한다. private helper(`isExecutionInScope`, `loadTimeline`, `toExecutionEnvelope`, `loadNodeStats`)로 잘 위임하고 있으나, orchestration 로직 자체가 여전히 길어 수정 시 전체 흐름 파악 부담이 있다.
- **제안**: 자식 실행 빌드 로직(`directChildren → subExecutions → truncation depth`)을 `buildSubExecutions(parentId): Promise<{ subExecutions, subExecutionsTruncatedDepth }>` 같은 private 메서드로 분리하면 `getExecutionDetails` 본문을 50줄 이하로 유지 가능.

---

#### **[INFO]** `subExecutionsTruncatedDepth` 값 `1` 하드코딩
- **위치**: `explore-tools.service.ts` — `if (deeperExists > 0) subExecutionsTruncatedDepth = 1;`
- **상세**: 숫자 `1`은 "현재 depth 한 단계만 반환하고 그 이후는 생략"을 의미하는 설계 상수다. 코드 맥락에서 유추는 가능하지만, 향후 depth를 동적으로 바꾸거나 설계를 확장할 때 이 리터럴을 모든 곳에서 찾아야 한다.
- **제안**: `const SUB_EXECUTION_INCLUDED_DEPTH = 1;` 상수로 명명해 `getExecutionDetails` 상단 또는 파일 상단에 선언.

---

#### **[INFO]** 테스트 mock 호출 순서 의존성
- **위치**: `explore-tools.service.spec.ts` — `EXECUTION_NOT_IN_SCOPE` 테스트
- **상세**: `repos.execution.findOne.mockResolvedValueOnce(...)` 두 번의 호출 순서가 `isExecutionInScope` 내부 구현의 조회 순서에 암묵적으로 의존한다. `isExecutionInScope` 구현이 변경되면(예: 조회 순서 변경) 테스트가 동일한 에러코드를 반환하지 않을 수 있다. 현재는 주석(`// 두 번째 findOne 은 parent lookup`)으로 의도를 설명하고 있어 허용 범위이나, 깨지기 쉬운 테스트 패턴이다.
- **제안**: `isExecutionInScope`를 별도로 단위 테스트하거나, mock 설정 시 `where` 조건 기반으로 분기하는 구현체(`mockImplementation`)를 사용해 호출 순서 의존성 제거.

---

#### **[INFO]** `workflow-assistant-stream.service.ts` dispatch의 빈 문자열 기본값
- **위치**: `workflow-assistant-stream.service.ts` — `asString(args.id, '')`
- **상세**: `args.id`가 없을 경우 빈 문자열(`''`)을 넘기고, `getExecutionDetails` 내부의 UUID 정규식 검사에서 `INVALID_ID`를 반환한다. 흐름 자체는 안전하지만, 빈 문자열이 "누락"이 아닌 "유효하지 않은 UUID"로 분류되어 에러 메시지가 실제 원인(`id` 미전달)을 감춘다.
- **제안**: dispatch에서 `args.id`가 string인지 먼저 검사해 없으면 `{ok: false, error: 'MISSING_ARGUMENT'}` 를 직접 반환하거나, `asString` fallback을 `null` 처리로 분기.

---

#### **[INFO]** i18n 키가 `tool-call-badge.tsx`에서 사용되지 않음
- **위치**: `tool-call-badge.tsx:summarize` / `en.ts` + `ko.ts`
- **상세**: `en.ts`와 `ko.ts`에 `exploreExecutionsList`, `exploreExecutionDetails`, `executionNotInScope` 3개 키가 추가됐으나, `tool-call-badge.tsx`의 `summarize()` 함수는 직접 문자열 템플릿을 사용한다(`\`executions (${status}): ${count}\``). i18n 키가 등록됐지만 실제 배지 렌더링에 연결되지 않아 유지보수 시 양쪽을 별개로 수정해야 한다.
- **제안**: `summarize()` 내부에서 i18n 훅(예: `useTranslation`)을 사용하거나, 컴포넌트 레벨에서 번역 문자열을 prop으로 주입해 i18n 키와 렌더링을 연결.

---

### 요약

전반적으로 이 변경셋은 기존 `ExploreToolsService` 패턴(Repository 직접 주입, `Promise<unknown>` 반환, Korean JSDoc)을 일관되게 따르고 있으며, private helper 메서드 분리(`loadTimeline`, `toExecutionEnvelope`, `loadNodeStats`, `isExecutionInScope`)와 모듈 레벨 상수(`EXECUTIONS_LIST_DEFAULT_LIMIT`, `clampLimit`, `normalizeStatusFilter`)가 코드 재사용과 가독성을 잘 지원한다. 주요 유지보수성 위험은 두 파일에 걸친 **상태 enum 중복 정의**와 `getExecutionDetails` 내 **직렬 쿼리로 인한 성능/가독성 복합 이슈**이며, 나머지는 개선 권장 수준이다.

---

### 위험도

**LOW–MEDIUM**
> 상태 enum 중복 및 직렬 쿼리 패턴이 해결되지 않으면, 기능 확장 시 동기화 오류 또는 성능 회귀로 이어질 수 있어 MEDIUM에 가깝다. 그 외 사항은 LOW 수준.