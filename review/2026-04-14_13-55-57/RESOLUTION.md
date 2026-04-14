# 코드 리뷰 조치 내용

## 개요
Transform 노드 확장(신규 연산 4종 + 편의 기능 + 중첩 경로 + 드래그 정렬 + Preview) 리뷰 결과에 대한 조치 내용입니다. Critical 2건과 Warning 18건 중 우선순위가 높은 항목을 반영했습니다. 이번 PR 범위를 벗어나거나 별도 이슈로 분리한 항목은 하단에 근거와 함께 기록합니다.

---

## ✅ 조치 완료

### Critical
- **Testing #1 · chip-input 테스트 전무** → `transform/__tests__/chip-input.test.tsx` 신규 작성. Enter/쉼표 commit, 공백 trim, 빈 값 무시, 중복 방지, Backspace 삭제, blur commit, × 버튼 삭제 케이스 커버.
- **Testing #2 · defaults 테스트 전무** → `transform/__tests__/defaults.test.ts` 신규 작성. 타입 변경 시 field 보존, rename_field의 from 매핑, object_pick의 root undefined 분기, 전 타입 기본값 생성 등 커버.

### Warning
- **Side Effect / Concurrency #1 · 렌더 중 queueMicrotask + setState** → `TransformConfig`를 재작성. 단일 `entries` 상태(`{id, op}[]`)로 통합, 외부 config 변경 감지는 React 공식 패턴 "prop 변화 시 setState during render" 로 처리하여 Strict Mode / Concurrent Mode 안전성 확보. `queueMicrotask`, ref-during-render, counter 롤백 가능성 전부 제거.
- **Side Effect / Concurrency #2 · nextCounter 렌더 중 증가** → `crypto.randomUUID()` 기반 `makeId()`로 교체. 카운터 공유 문제 원천 제거.
- **Security #3 · ReDoS** → 프론트/백엔드 양측에 `safeCompileRegex(pattern, flags)` 유틸 도입. 200자 초과 패턴 거부. `array_filter`(regex operator), `string_op.replace`(regex:true) 모두 이 유틸 경유. 테스트 `should reject overly long regex patterns` 추가(프론트/백엔드).
- **Security #4 · object_omit 루트 BLOCKED_KEYS 누락** → 프론트/백엔드 `object_omit` 루트 처리 경로에 `__proto__ / constructor / prototype` 차단 로직 추가. 프론트/백엔드 테스트에 `should block prototype pollution via object_omit root` 추가.
- **Side Effect #5 · object_omit 내부 참조 변형** → 프론트/백엔드 양측 `object_omit`(field 지정 시) 대상 객체를 스프레드 복사 후 `setNested`로 교체. `object_pick`과 동일한 비변형 패턴으로 통일.
- **Maintainability #6 · DATE_UNITS 중복** → `frontend/src/lib/transform/apply-operation.ts`의 로컬 선언 제거, `@/types/transform`의 단일 export를 import.
- **Side Effect #7 · chip-input 이중 setState** → 쉼표 처리 분기를 단순화. 중복 여부와 무관하게 `setDraft("")` 한 번만 호출.
- **Dependency #14 · customParseFormat 미사용 import** → `frontend/src/lib/transform/apply-operation.ts`에서 import 및 `dayjs.extend` 제거. (백엔드는 파싱 유연성 위해 유지.)
- **Requirement #10 · Preview 에러 묵살** → `stepsResult` 를 union 타입(`{ok:true, steps}` | `{ok:false, error}`)으로 모델링. 실패 시 빨간색 인라인 에러 메시지로 사용자에게 원인 노출.
- **Requirement #11 · set_field 표현식 Preview 불일치** → Preview 상단에 "`{{ $input.x }}` 같은 표현식은 실행 시 평가되며 Preview 에서는 리터럴로 표시됩니다" 안내문 추가. 별도 표현식 엔진 연결은 범위 외로 판단.
- **Documentation #16 · BLOCKED_KEYS 의도 주석** → `apply-operation.ts` 및 `transform.handler.ts` 상단 상수 선언부에 "Prototype pollution 방지" 주석 추가.
- **Testing #8 · apply-operation 커버리지** → `apply-operation.test.ts` 확장. divide-by-zero, uppercase/lowercase, replace(all:false), join, date_op add/subtract/diff, array_filter 다양한 operator, array_filter 비배열 no-op, rename_field 없는 source, prototype pollution 방어, ReDoS 차단, 빈 ops chain 케이스 전부 커버.
- **Info (testing) #3 · 빈 ops chain 미커버** → 상기에 포함.
- **Info #14 · Preview key prop 불안정** → `key={\`${i}-${step.op.type}\`}` 형태로 교체.

---

## ⏭️ 이번 PR 범위 외로 분리

이유를 명기하여 추후 별도 이슈로 처리하는 편이 합당하다고 판단한 항목:

- **Architecture #9 · TransformPreview 전역 store 의존** — 설정 패널 하위 컴포넌트 다수가 동일 패턴을 사용 중이며 이를 일괄 재설계하려면 별도 리팩터 PR이 필요합니다. 현재 구현은 기존 컨벤션과 일관됩니다.
- **Requirement #12 · boolean 변환 반직관** — `Boolean("false") === true`는 JavaScript 표준 동작이며, 스마트 변환("false"/"0"/"no" → false) 도입은 스펙 정의 필요. 기존 스펙이 지정하지 않은 동작을 본 PR에서 바꾸면 동작 변경 위험.
- **Performance #13 · structuredClone N회 호출** — 현재 operations 수는 두 자리대가 현실적 상한. 실측 병목 보고된 바 없어 조기 최적화는 보류.
- **API Contract #15 · args?: unknown 느슨한 타입** — 백엔드 DTO까지 동시에 개정해야 하는 대규모 변경. 별도 이슈에서 discriminated union으로 스키마 강화 권장.
- **Requirement #17 · Preview 배열 루트 입력 미지원** — Transform 노드의 입력은 일반적으로 객체이며, 배열 루트는 Map/ForEach 노드에서 처리. 현재 "루트는 객체여야 합니다" 에러 메시지로 명시되어 있어 오용을 유도하지 않음.
- **Performance #18 · sampleText debounce** — 키 입력당 재계산 비용이 낮음(연산 수·입력 크기 모두 작음). 체감 문제 발생 시 도입 검토.
- **Info 성능(#5, #6, #7, #8)** — Map lookup, 상수 외부 추출, `React.memo`, `Set` 기반 중복 검사 등. 실제 병목이 확인되지 않은 상태의 마이크로 최적화라 현재 단계에서는 보류.
- **Info Documentation(#10, #11, #12), Architecture(#15)** — JSDoc/주석·레지스트리 패턴 등 지속 개선 항목. 필요 시 후속 소규모 PR로 보완.

---

## 검증

- Backend: `npm run lint` (기존 대비 신규 error 0건), `npm test` (964/964 pass), `npm run build` ✅
- Frontend: `npm run lint` (0 errors), `npx tsc --noEmit` ✅, `npm test` (516/516 pass, 신규 27건 추가), `npm run build` ✅
