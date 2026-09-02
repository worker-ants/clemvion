# 신규 식별자 충돌 검토 — `spec-draft-error-code-two-surfaces.md`

## 검토 범위 요약

target 은 `spec/conventions/error-codes.md` §Overview "적용 범위" 문단에 새 문장을 추가하는
spec draft 다. 제안 문구를 실측한 결과, target 이 **새로 만드는 식별자는 없다** — 도입하려는
두 이름 `ErrorCode`·`EngineErrorCode` 는 이미 `codebase/backend/src/nodes/core/error-codes.ts`
(`:8`, `:147`)에 존재하는 const 이고, target 은 그 존재를 규약 문서에 **사후 기술**할 뿐이다.
따라서 본 리뷰의 초점은 "새 이름이 기존과 겹치는가" 가 아니라 "기존 이름을 문서화하면서 다른
기존 사용처와 의미 충돌을 일으키는가" 로 옮겨 확인했다.

## 실측

| 항목 | 결과 |
|---|---|
| `EngineErrorCode` 를 언급하는 다른 spec 파일 | `grep -rn "EngineErrorCode" spec/` → **0건**(현재 `error-codes.md` 자신에도 없음 — target 이 처음 등재) |
| `ErrorCode` 를 언급하는 다른 spec 파일 | 10개 파일, 전부 **같은 enum**(`nodes/core/error-codes.ts` 의 `ErrorCode`)을 가리킴 — 의미 분기 없음 |
| `WsErrorCode` (제3의 후보 sibling) | `codebase/backend/src/modules/websocket/ws-error-codes.ts:12` — **다른 파일**. target 의 "같은 파일의 자매 const" 주장 범위 밖이며, 착수 근거 plan(`spec-conventions-engine-error-code-surface.md`)이 "세 번째 자매 const 판정은 재개 시점"으로 **이미 명시 유보**함 |
| `pgErrorCode` (`node-output.md:183`) | DB 레벨 필드명, `ErrorCode` enum 과 문자열 유사도만 있고 참조 관계 없음 — 기존 문서가 이미 분리 표기 |
| `cafe24ErrorCode` (`4-cafe24.md:266,285`) | `IntegrationTestResult` 네임스페이스 필드, `spec/2-navigation/4-integration.md:1095` 가 이미 "노드 런타임 `ErrorCode` enum 과 별개"라고 명시 구분 |
| `"대표 surface"` 표현 | `error-codes.md:26` 에만 존재(현재 단수 → target 이 복수로 조정). 다른 spec 파일에서 이 문구를 다른 의미로 쓰는 곳 없음 |
| plan 파일 경로 `spec-draft-error-code-two-surfaces.md` | `plan/in-progress/` 내 `spec-draft-*` 3건 중 유일한 이름, 중복 없음. 짝이 되는 tracker `spec-conventions-engine-error-code-surface.md` 도 유일 |

## 발견사항

### INFO — `WsErrorCode` 가 §Overview 병기 범위 밖에 남는다 (이미 문서화된 유보)

- target 신규 식별자: 해당 없음 (target 은 `WsErrorCode` 를 언급하지 않음)
- 기존 사용처: `codebase/backend/src/modules/websocket/ws-error-codes.ts:12` (선언),
  `spec/5-system/6-websocket-protocol.md:989,996,998` (spec 참조)
- 상세: `ErrorCode`/`EngineErrorCode` 와 이름 패턴(`*ErrorCode`)이 같은 세 번째 const 가 이미
  코드베이스에 존재하는데, target 은 "같은 파일의 자매 const" 라는 좁은 정의로 이를 범위
  밖에 둔다. 이는 새 충돌이 아니라 — 착수 근거 plan
  (`plan/in-progress/spec-conventions-engine-error-code-surface.md` §"판단 기준은 이번에 안
  쓴다")이 이미 "세 번째 자매 const 가 생길 때가 재개 신호"라고 명시하며, `WsErrorCode` 가
  그 세 번째에 해당하는지 판정을 **의도적으로 유보**한 상태다. §Overview 만 읽는 독자가 "대표
  surface 는 둘뿐" 이라 오해할 여지는 남지만, 이는 target 이 만든 결함이 아니라 이미 별도
  planner 결정 트랙으로 분리된 사안이다.
- 제안: 조치 불요. 다만 §Overview 최종 문구에 "현재 `nodes/core/error-codes.ts` 파일 내"처럼
  파일 스코프를 명시하면(target 초안이 이미 "같은 파일의 자매 const" 라고 적어 이 조건을
  충족하고 있음을 확인) `WsErrorCode` 와의 혼동 가능성이 구조적으로 닫힌다 — 현재 초안 문구
  그대로 두면 충분.

### INFO — `pgErrorCode`/`cafe24ErrorCode` 는 이름 유사도만 있고 실질 충돌 없음

- target 신규 식별자: 해당 없음 (기존 식별자 문서화)
- 기존 사용처: `spec/conventions/node-output.md:183`(`pgErrorCode`), `spec/4-nodes/4-integration/4-cafe24.md:266,285`(`cafe24ErrorCode`)
- 상세: 두 필드 모두 `*ErrorCode` 접미 패턴을 공유하지만 각각 DB 드라이버 원본 코드/Cafe24
  응답 바디 필드로, `ErrorCode`/`EngineErrorCode` 네임스페이스와 무관하다. `cafe24ErrorCode`
  는 인접 spec(`4-integration.md:1095`)이 이미 "노드 런타임 `ErrorCode` enum 과 별개"라고
  명시적으로 갈라 두어 혼동 방지가 선재한다.
- 제안: 조치 불요. target 이 §Overview 에 "대표 surface" 를 열거해도 이 두 필드는 그 열거
  범주(`error.code` 명명 규약이 적용되는 enum 표기 이름) 밖이라 충돌 표면이 생기지 않는다.

## 요약

target 이 §Overview 에 병기하려는 두 이름(`ErrorCode`, `EngineErrorCode`)은 **신규 식별자가
아니라 이미 코드베이스에 존재하는 const 명**이며, spec 전역에서 `ErrorCode` 를 가리키는 다른
10개 파일 모두 동일한 enum 을 지칭해 의미 분기가 없다. `EngineErrorCode` 는 spec 어디에도
아직 등장하지 않아 target 이 최초 등재하는 자리이고 충돌할 기존 서술이 없다. 이름 패턴이
비슷한 제3의 후보(`WsErrorCode`, `pgErrorCode`, `cafe24ErrorCode`)는 모두 다른 파일·다른
네임스페이스이며 그중 `WsErrorCode` 는 착수 근거 plan 이 이미 "세 번째 자매 const 판정 유보"
로 명시 처리해 두었다. 파일 경로(`plan/in-progress/spec-draft-error-code-two-surfaces.md`)도
기존 `spec-draft-*`/`spec-conventions-*` 명명 관례와 충돌 없이 유일하다. CRITICAL·WARNING
등급 발견사항 없음.

## 위험도

NONE
