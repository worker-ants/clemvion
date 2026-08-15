# Cross-Spec 일관성 검토 — spec/5-system/ (--impl-prep)

## 컨텍스트 메모 (판정 신뢰도에 영향)

이 impl-prep 검토를 유발한 작업은 `plan/in-progress/ws-event-types-extract.md`
(`websocket.service.ts` 의 값/타입 선언을 의존성-프리 모듈로 분리하는 순수 리팩터,
`spec_impact: none`, 코드 동작 불변)이다. 그런데 조립된 prompt 는 예산 초과로
**정확히 이 작업과 가장 관련 깊은 파일들을 전부 생략**했다 — `6-websocket-protocol.md`
(83,857자), `14-external-interaction-api.md`(107,799자), `4-execution-engine.md`
(222,996자) 모두 스텁 처리되고, 대신 `1-auth.md`(무관한 인증/RBAC 도메인, 가장 큼)가
예산을 소모해 전문 로딩됐다. `related_specs` 섹션도 사실상 전량(spec/2-navigation/**,
spec/data-flow/**, spec/4-nodes/** 등)이 스텁이다. 기존에 알려진 동일 패턴
(`consistency --spec 기본 예산이 conventions 를 통째로 떨군다`)의 재발이다.

이 갭을 메우기 위해 아래 파일들은 `Read`/`grep` 로 저장소에서 직접 확인했다:
`spec/5-system/6-websocket-protocol.md`, `spec/5-system/14-external-interaction-api.md`,
`spec/5-system/4-execution-engine.md`(§4.4 발췌), `codebase/backend/src/modules/websocket/websocket.service.ts`,
그리고 1-auth.md 가 인용하는 `spec/data-flow/12-workspace.md`·`spec/2-navigation/9-user-profile.md`·
`spec/conventions/audit-actions.md`·`spec/conventions/error-codes.md`.

## 발견사항

### [INFO] impl-prep 번들 예산이 실제 작업 관련 파일을 전부 생략

- target 위치: 조립 프롬프트 헤더 (`### ⚠️ 컨텍스트 예산 초과로 생략된 파일 15개`)
- 충돌 대상: `spec/5-system/6-websocket-protocol.md`·`14-external-interaction-api.md`·
  `4-execution-engine.md` (websocket.service 리팩터와 직접 관련된 세 문서 전부 스텁)
- 상세: `--impl-prep scope=spec/5-system/` 번들러가 디렉토리 내 파일을 (아마 알파벳/크기)
  순서로 적재하다 예산을 소진해, 이번 작업과 무관한 `1-auth.md`/`2-api-convention.md`/
  `3-error-handling.md` 만 전문 실리고 정작 리팩터 대상 서비스를 설명하는 문서들이 빠졌다.
  하위 checker 가 "여기 없다 = 문제 없다" 로 오판하면 거짓 음성(false negative) 위험이 있다.
- 제안: 직접 Read 로 보완 확인한 결과(아래 항목들)는 CRITICAL/WARNING 없음. 다만 harness 측에서
  코드 `code:` 프론트매터 글롭과 실제로 겹치는 spec 파일을 예산 우선순위로 올리는 개선을 권고
  (기존 `feedback_consistency_spec_mode_budget` 메모와 동일 클래스).

### 리팩터 대상(R10 "WebsocketService 단일 sink" 원칙) — 충돌 없음, 확인 완료

- target: `websocket-events.types.ts` 신설 + `websocket.service.ts` re-export (plan 조치안)
- 대조: [`spec/5-system/14-external-interaction-api.md` §R10](spec/5-system/14-external-interaction-api.md#r10-websocketservice-단일-sink-정책의-확장),
  [`spec/5-system/4-execution-engine.md` §4.4](spec/5-system/4-execution-engine.md)
- 상세: R10/§4.4 은 "엔진은 `WebsocketService.emitToExecution`(emit\*) **호출** 한 곳만" 이라는
  **call-site(런타임 sink)** 불변식이지, enum/interface 선언이 물리적으로 어느 `.ts` 파일에
  있어야 하는가를 규정하지 않는다. plan 은 13곳(서비스 호출부)의 import 를 그대로 두고, **타입만
  쓰는 12곳**만 새 모듈 직접 import 로 돌리며 `forwardRef` 제거는 명시적으로 범위 밖으로 뒀다 —
  R10/§4.4 이 봉인한 `ws.service↔gateway↔retry↔event-emitter` 순환의 실제 원인
  (`4-execution-engine.md` Rationale, "import 재배치로 노출된 ... 순환은 ...forwardRef 지연
  해석으로 봉인")과 정확히 같은 문제의식이며 반대되지 않는다. 결론: 충돌 없음, `spec_impact: none`
  판단과 정합.
- 참고(비-차단, INFO 성격): 리팩터가 착지하면 `spec/5-system/10-graph-rag.md` 552행의
  "`KbEventType` union 은 `websocket.service.ts` 에 있다" 서술은 **re-export 덕에 여전히 참**이지만
  canonical 선언 위치는 `websocket-events.types.ts` 로 바뀐다. 문서 자체가 틀리지는 않으나,
  이후 spec-sync 시 "canonical 위치" 를 새 모듈로 갱신할지는 developer/planner 재량.

### 1-auth.md 전문에 대한 cross-spec 대조 — 충돌 없음 (표본 검증)

전문이 로딩된 `1-auth.md`(RBAC·2FA/WebAuthn·세션·감사)에 대해, 문서가 스스로 인용하는
외부 spec(스텁이라 프롬프트엔 없음)을 직접 열어 대조했다. 전부 일치했다:

- §3.2 "멤버 관리" Admin=CRUD ↔ `spec/2-navigation/9-user-profile.md:235`(`✅|✅|❌|❌`),
  `spec/data-flow/12-workspace.md:246`(`admin ✓ (owner 제외)`) — 표 3곳 모두 owner-대상
  제약을 각주/열 처리로 동일하게 반영.
- §1.5.4 초대 API `lower_snake_case` historical-artifact ↔
  `spec/conventions/error-codes.md:66` 레지스트리 — 코드 집합·사유·SoT 링크 완전 일치.
- §2.2 `activeWorkspaceId` 클레임·dual-read·header-first 모델 ↔
  `spec/data-flow/12-workspace.md`(§Overview·§1.5)·`spec/5-system/2-api-convention.md §2.3` —
  세 문서 모두 동일한 우선순위(header-first → 토큰 클레임)·동일 rollover 설명.
- §4.1 감사 액션 카탈로그(`trigger.notification_secret_rotated` 등 3종, `user.*` 4종) ↔
  `spec/conventions/audit-actions.md` — 명명 규약·구현일자·근거 정합.
- §5·§Rationale 이 인용하는 `3-error-handling.md §1.2.1`(2FA/재인증 코드) ·
  `2-api-convention.md §5.3/§5.4`(에러 봉투·null vs 키생략) — 본 프롬프트에 전문 포함된
  두 문서와 상호 참조 완전 일치(코드 목록·HTTP status·SoT 포인터 1:1).

CRITICAL·WARNING 급 데이터 모델/API 계약/요구사항 ID/상태 전이/RBAC 충돌은 발견되지 않았다.

## 요약

impl-prep 대상 `spec/5-system/`(및 대조 대상 spec) 자체에서 CRITICAL/WARNING 급 cross-spec
모순은 발견되지 않았다 — RBAC 매트릭스·에러 코드 레지스트리·감사 액션 카탈로그·워크스페이스
클레임 모델은 표본 대조한 모든 인접 문서와 일치했고, 이번 작업이 건드리는 R10 "단일 sink" 아키텍처
불변식도 plan 의 범위(타입 선언 재배치, 호출부 불변)와 충돌하지 않는다. 다만 조립 프롬프트의
예산 초과로 이번 작업과 가장 관련 깊은 세 문서(`6-websocket-protocol.md`·
`14-external-interaction-api.md`·`4-execution-engine.md`)가 전부 생략된 채 무관한 `1-auth.md`
가 예산을 소모한 점은 이 checker 실행 자체의 커버리지 신뢰도를 낮추는 프로세스 갭이며(INFO), 직접
Read 로 보완했으나 harness 예산 배분 로직의 개선 여지로 남겨 둔다.

## 위험도

LOW
