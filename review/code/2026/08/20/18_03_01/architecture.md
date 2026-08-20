# 아키텍처 리뷰 — `Execution.inputData` 카브아웃 폐지 + 프런트 마커 가드 3소비처

## 발견사항

- **[WARNING]** 스키마-드리프트 orphan 마스킹 필드가 강제로 `"string"` 타입이 되어, 원래 값이 object/array 였던 경우 `displayValue` 가 `[object Object]` 를 렌더한다
  - 위치: `codebase/frontend/src/components/executions/rerun-modal.tsx:323` (원인), `:169-175`(`displayValue`), `:117-139`(`splitMaskedParameters`)
  - 상세: `fields` 파생 로직은 스키마에 선언되지 않은(=드리프트로 사라진) `maskedKeys` 를 `{ name, type: "string" as const }` 로 되살린다(323행). 그런데 `splitMaskedParameters` 는 마스킹된 값이 **object/array 안쪽**의 leaf 인 경우 `prefill[k] = v`(원본 객체 그대로, 133행)를 넣는다 — 스칼라 마커일 때만 `""` 로 비운다. 즉 스키마 드리프트로 사라진 필드가 마침 object 타입(예: `headers: {"apiKey":"***"}`)이었다면 `paramValues[name]` 은 객체인데 `field.type` 은 강제로 `"string"` 이 되고, `displayValue("string", <object>)` 는 `isStructuredType` 분기를 타지 않아 `String(value)` → 리터럴 `"[object Object]"` 를 렌더한다. 사용자는 실제로 무엇이 가려졌는지 재구성할 수 없고, 그 텍스트를 편집해도 `coerceInput("string", raw)` 가 raw 문자열을 그대로 돌려주므로 원래 object 구조가 복구되지 않는다.
  - 이것은 프로젝트가 이미 **인지하고 받아들인** "스키마가 아예 없을 때(no-schema fallback)" 의 `[object Object]` 케이스(같은 파일 테스트 `object 파라미터 안쪽 마커도 제출을 막고, 값은 지우지 않는다` 주석 "기존 동작")와는 **다른 코드 경로**다 — round9(`d446ab7ad`)에서 새로 추가된 "스키마는 있지만 그 필드만 사라진" orphan 분기가 같은 증상을 별도로 재생산한다. 가드 자체(터치 여부·마커 잔존 여부 판정)는 깨지지 않지만, `RerunField` 추상화가 *"차단 대상 키는 렌더된다"* 라는 새 불변식은 지켰어도 *"렌더된 필드의 타입이 실제 값 shape 을 반영한다"* 는 기존 불변식(`isStructuredType` 로 세 곳이 공유하는 계약)은 이 합성 경로에서 깨진다.
  - 제안: orphan 필드 타입을 원본 값의 shape 으로 추론(`typeof v === "object" && v !== null ? (Array.isArray(v) ? "array" : "object") : "string"`)하거나, 최소한 이 특정 경로를 겨눈 회귀 테스트(스키마 존재 + 해당 키만 드리프트 + 원본이 object)를 추가해 의도된 동작인지 확정할 것.

- **[INFO]** 마스킹 마커 집합·깊이 상한이 backend/frontend 양쪽에 손 복제되어 있고 동기화는 주석 관례에만 의존한다 — 단, 이미 트래커에 등재된 항목
  - 위치: `codebase/frontend/src/lib/utils/masked-markers.ts:18-22`(`MASKED_MARKERS`), `:96`(`MAX_MARKER_SCAN_DEPTH`) ↔ `codebase/backend/src/shared/utils/sanitize-error-message.ts` 의 `MASKED_MARKERS`/`MAX_REDACT_DEPTH`
  - 상세: 두 값 집합·깊이 상수는 이름을 맞추고 JSDoc 으로 "함께 갱신하라" 고 적어 두는 것 외에 컴파일타임·런타임 동등성 검증이 없다(각 패키지 테스트가 자기 상수만 스냅샷). 과거 라운드에서 실제로 이 클래스의 어긋남이 CRITICAL(object/array 안쪽 마커 누락)로 잡힌 전례가 있다. 이미 `plan/in-progress/spec-sync-external-interaction-api-gaps.md:315` 에 "`inputData` 마스킹 게이트 4곳을 단일 헬퍼로 통합" 으로 등재돼 있어 새 이슈는 아니다.
  - 참고: 이 모노레포에는 정확히 이 문제(FE/BE 양쪽이 같은 상수를 공유해야 하는 상황)를 위한 선례 패턴이 이미 있다 — `codebase/packages/chat-channel-validation` 이 `@workflow/chat-channel-validation` 로 frontend·backend 양쪽에 배포돼 동일한 검증 상수를 공유한다. 트래커 항목을 실제로 착수할 때 "헬퍼 통합" 보다 "공유 패키지로 승격" 이 동기화 실패 클래스 자체를 구조적으로 없앤다는 점을 옵션에 반영할 것을 제안.
  - 제안: 조치 불요(트래커 이월). 신규 액션 아님.

- **[INFO]** 마스킹 재제출 차단 가드가 프레젠테이션 레이어에만 존재하고 서비스 레이어에 방어선이 없다 — 이미 판정 완료된 사안
  - 위치: `codebase/frontend/src/components/executions/rerun-modal.tsx` 의 `blockedByMaskedInput`(392-399행) vs `codebase/backend/.../executions.service.ts` 의 `inputOverride` 처리 경로
  - 상세: `inputOverride` 는 서버 측에서 마스킹 마커 값을 별도로 거부하지 않는다 — 재제출 오염 방지가 순수히 UI 정상 흐름 가드에 의존한다(레이어 책임 분리 관점에서는 방어-in-depth 부재). 다만 이는 이번 PR 이 만든 갭이 아니고, security reviewer 가 여러 라운드에 걸쳐 독립적으로 INFO 판정("기밀성 문제 아님·피해는 호출자 자기 자신")했으며 `review/code/2026/08/20/14_44_08/RESOLUTION.md` 트래커 항목 #6 으로 이미 등재·이월돼 있다. 새 조치 불요.

## 요약

이번 변경은 `Execution.inputData` egress 마스킹 카브아웃을 닫으면서 backend 마스킹 관문을 `error`/`outputData` 와 동일 규칙으로 단순화(특수 케이스 분기 제거, `MASKED_INPUT_DATA_REASON` 앵커 전량 삭제로 죽은 문서 참조 없음 확인)했고, 프런트 마커 판별 유틸을 컴포넌트(`dynamic-form-ui.tsx`) 내부에서 `lib/utils/masked-markers.ts` 로 승격해 모달·툴바가 무관한 프레젠테이션 컴포넌트를 import 해야 했던 역방향 의존을 올바르게 제거했다 — 레이어 경계 개선으로 평가한다. 순환 의존성·SoT 충돌은 발견되지 않았고, DTO/서비스/DB 세 계층에 걸친 마스킹 정책이 이번에 하나로 통일돼 이전의 "레벨별로 반대 정책" 이라는 반직관적 분기가 사라졌다(개방-폐쇄 관점에서도 호출부 특수화가 줄어 개선). 유일하게 신규로 발견한 실질 결함은 round9 에서 추가된 "스키마 드리프트로 사라진 마스킹 키를 강제로 string 타입 필드로 되살리는" 경로가, 원본 값이 object/array 였던 경우 `[object Object]` 렌더로 귀결되는 타입 불일치이며 — 보안 가드 자체는 깨지지 않으나 `RerunField` 추상화가 값 shape 정보를 유실하는 인터페이스 갭이다. 나머지 두 관찰(FE/BE 상수 손-복제, 클라이언트 전용 방어선)은 이미 트래커에 등재·판정된 기존 사안이라 참고용 INFO 로만 남긴다.

## 위험도
LOW
