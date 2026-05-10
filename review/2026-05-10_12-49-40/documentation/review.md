## 발견사항

---

### [WARNING] `TRIGGER_SOURCE_INPUT_KEY` 익스포트되지만 실제 사용처 없음
- **위치**: `manual-trigger.handler.ts:26`
- **상세**: `export const TRIGGER_SOURCE_INPUT_KEY = '__triggerSource'` 가 선언되어 있으나, 4개 어댑터(hooks.service.ts, schedule-runner.service.ts, schedules.service.ts, workflows.controller.ts) 모두 이 상수를 import하지 않고 문자열 리터럴 `'__triggerSource'` 를 직접 사용한다. 핸들러 내부에서도 인터페이스 프로퍼티 접근(`input.__triggerSource`)으로 처리하므로 상수 자체가 참조되는 곳이 없다.
- **제안**: JSDoc에 "어댑터는 이 상수를 import하여 매직 스트링 대신 사용해야 한다" 는 의도를 명시하거나, 의도 없는 dead export라면 제거. 현재 상태는 문서상 계약과 실제 사용 간의 간극이다.

---

### [WARNING] `schedule-runner.service.ts` 마커 추가에 설명 주석 없음
- **위치**: `schedule-runner.service.ts` `process()` 내부, 변경 라인
- **상세**: hooks.service.ts(주석 4행), schedules.service.ts(주석 3행), workflows.controller.ts(주석 4행) 모두 `__triggerSource` 스탬프 이유를 인라인 주석으로 설명하는데, `schedule-runner.service.ts` 만 주석 없이 `{ __triggerSource: 'schedule', parameters }` 로 변경되었다. 이 파일을 처음 읽는 개발자는 마커 존재 이유를 추적해야 한다.
- **제안**: 다른 어댑터와 동일한 패턴으로 한 줄 주석 추가. 예: `// __triggerSource: BullMQ job 실행이므로 'schedule' — 핸들러가 meta.source 결정 후 제거 (CONVENTIONS Principle 2)`

---

### [INFO] spec §5.1 케이스 예시가 Section 제목과 불일치
- **위치**: `spec/4-nodes/7-trigger/1-manual-trigger.md` §5.1
- **상세**: 섹션 제목은 "Manual / Schedule 어댑터" 이지만 JSON 예시의 `meta.source` 값은 `"manual"` 만 표시. Schedule 어댑터를 통해 실행되면 `"source": "schedule"` 이 나온다는 사실이 예시에는 나타나지 않아 독자가 혼동할 수 있다. 필드 표에는 "schedule 어댑터는 `"schedule"`" 이 기재되어 있어 모순은 아니지만, JSON 예시와 표가 다른 경우를 안내하는 방식이 어색하다.
- **제안**: JSON 블록 아래에 `// Schedule 어댑터의 경우 meta.source 는 "schedule"` 노트를 추가하거나, 섹션 제목을 "Manual 어댑터" 로 좁히고 Schedule은 별개 §5.3 로 분리.

---

### [INFO] spec §5.2 `output.request.headers` 소문자 키 보장 미검증
- **위치**: `spec/4-nodes/7-trigger/1-manual-trigger.md` §5.2 필드 표
- **상세**: 표에 `output.request.headers` 설명으로 "HTTP headers (소문자 키)" 가 기재되어 있으나, `hooks.service.ts` 에서 `input.headers` 를 그대로 전달하므로 소문자 정규화 로직이 없다. 클라이언트/리버스 프록시에 따라 `X-Source` 혹은 `x-source` 로 수신될 수 있다.
- **제안**: spec에서 "(소문자 키)" 표기를 제거하거나, `hooks.service.ts` 에서 headers를 `Object.fromEntries(Object.entries(input.headers).map(([k,v]) => [k.toLowerCase(), v]))` 로 정규화하는 코드를 추가.

---

### [INFO] `detectTriggerSource` fallback 동작이 spec에 미반영
- **위치**: `manual-trigger.handler.ts` `detectTriggerSource()` 주석 step 3
- **상세**: 코드 주석에는 "schedule 어댑터가 마커를 생략하면 manual과 구별 불가" 라는 중요한 엣지 케이스가 문서화되어 있지만, spec `1-manual-trigger.md` §4 step 4 에는 fallback 우선순위만 기술되고 이 케이스의 의미(잘못된 `meta.source` 가능성)가 언급되지 않는다.
- **제안**: spec §4 step 4 에 "(단, 마커 없이 파라미터만 전달된 경우 schedule/manual 구별 불가 — 어댑터는 반드시 마커를 동봉해야 한다)" 주의 문구 추가.

---

### [INFO] `resolveScheduleParameters` JSDoc이 실제 사용 패턴을 반영하지 않음
- **위치**: `schedule-runner.service.ts` 메서드 JSDoc (변경되지 않은 기존 주석)
- **상세**: 기존 주석에 "Exposed as a public method *primarily* for unit testing" 이라 명시되어 있으나, `schedules.service.ts:runNow()` 에서도 프로덕션 코드로 호출된다. 이번 PR 에서 `schedules.service.ts` 가 수정되었으므로 이 JSDoc과의 불일치가 더욱 두드러진다.
- **제안**: JSDoc을 "unit testing 및 `SchedulesService.runNow` 에서 호출" 으로 정정.

---

## 요약

전반적으로 문서화 품질이 높다. 새로운 `__triggerSource` 마커 계약이 spec·주석·테스트 이름 모두에 일관되게 반영되어 있고, CONVENTIONS 참조와 CHANGELOG도 빠짐없이 갱신되었다. 가장 주목할 문제는 `TRIGGER_SOURCE_INPUT_KEY` 상수가 익스포트만 되고 실제로는 어떤 어댑터도 사용하지 않아 문서상 계약과 실제 코드 사이에 간극이 생긴 점이며, 나머지는 spec 예시 보완·소문자 헤더 보장 여부·주석 일관성 수준의 LOW 수준 이슈다.

## 위험도

**LOW**