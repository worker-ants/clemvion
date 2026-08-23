# Cross-Spec 일관성 검토 — `spec/5-system/14-external-interaction-api.md`

## 검토 방법 및 범위

target 은 `spec/5-system/14-external-interaction-api.md` 전문(요구사항 §3, Trigger 페이로드 §4, API §5~6, 데이터
모델 §7, 보안 §8, 처리 흐름 §9, 구현 파일 구조 §10, WS 매핑 §11, 호환성 §12, Rationale R1~R19)이며, 조립된
프롬프트는 컨텍스트 예산 초과로 `spec/5-system/` 형제 파일 17개 본문을 생략했다. 이 검토는 그 생략을 "내용
없음"으로 취급하지 않고, target 이 인용하는 앵커·필드·표를 실제 저장소 파일(`Read`/`grep`)로 직접 대조했다.

대조한 대상: `spec/5-system/{1-auth,2-api-convention,3-error-handling,4-execution-engine,
6-websocket-protocol,12-webhook,15-chat-channel}.md`, `spec/conventions/{node-output,secret-store,
egress-masking}.md`, `spec/1-data-model.md`, `spec/7-channel-web-chat/{1-widget-app,3-auth-session}.md`,
`spec/4-nodes/6-presentation/{0-common,4-form}.md`, 그리고 이번 작업(`plan/in-progress/nodeoutput-allowlist.md`)이
겨냥하는 `codebase/backend/src/shared/utils/strip-external-only-fields.ts` 의 작업중 diff.

검토 초점은 (a) 일반적 cross-spec 6관점 전수 스캔, (b) 이번 impl-prep 대상인 `getStatus`/`context.nodeOutput`
allowlist 설계가 다른 영역(`node-output.md` Principle 0, WS §4.4 wire 문서)과 충돌하는지 집중 검증이다.

## 발견사항

검토한 범위에서 **CRITICAL/WARNING 급 cross-spec 충돌을 발견하지 못했다.** 아래는 확인 과정에서 나온 참고
사항(모두 실제 충돌이 아님을 확인)이다.

- **[INFO]** `nodeOutput` allowlist 제외 목록의 문서화가 `_resumeCheckpoint` 를 명시하지 않음
  - target 위치: 없음 (이 항목은 target spec 본문에 아직 등장하지 않는다 — target 은 R17 말미에
    "`nodeOutput` 일반 키 allowlist (미구현·잔여)" 로만 남겨 뒀고, 구체 키 목록 문서화는 plan 체크리스트의
    "(planner 턴) EIA §R17 잔여 문구 flip + allowlist 를 spec 에 정의" 단계에서 이뤄질 예정이다)
  - 충돌 대상: `spec/conventions/node-output.md` Principle 0 / §4.2.1 — `NodeHandlerOutput` 의 top-level
    internal 예외 필드는 `_resumeState` · `_resumeCheckpoint` · `_retryState` **셋**이라고 명시한다
    (`_resumeCheckpoint` 도 `NodeExecution.outputData._resumeCheckpoint` 로 **영속**된다, §4.2.1)
  - 상세: 이번 worktree 의 작업중 코드(`strip-external-only-fields.ts` diff, `NODE_OUTPUT_ALLOWED_KEYS`
    JSDoc)는 제외 대상을 "`_resumeState`·`_retryState` 는 의도적 제외" 라고만 적고 `_resumeCheckpoint` 를
    언급하지 않는다. allowlist 자체는 fail-closed(명시 허용 키만 통과)라 `_resumeCheckpoint` 도 실제로는
    올바르게 차단되므로 **동작 결함은 아니다** — 다만 이후 spec 화 단계에서 제외 근거를 적을 때 이 세 번째
    필드도 함께 열거하지 않으면, 이 저장소가 §R17 에서 여러 차례 겪은 "열거가 총칭으로 뭉개져 잔여를 가리는"
    패턴이 여기서도 반복될 소지가 있다
  - 제안: (developer 턴, 코드 리뷰 성격) JSDoc 예외 목록에 `_resumeCheckpoint` 추가. (project-planner 턴,
    본 항목 spec 화 시) EIA §R17 flip 문구 작성 시 node-output.md Principle 0 의 3-필드 예외 집합을 그대로
    인용해 두 문서가 같은 열거를 공유하게 할 것 — 별도 목록을 만들지 말 것(이 문서 자신의 §R17 이 반복
    강조하는 원칙)

## 요약

target(`14-external-interaction-api.md`)은 데이터 모델·API 계약·요구사항 ID·상태 전이·RBAC·계층 책임 6개
관점 전수에서 인접 spec 영역(WS 프로토콜 §4.4/§4.6, 실행 엔진 §7.5.1, 인증 §4.1 감사 액션, API 규약 §5.4
부재표현, 에러 처리 §1.2/§1.3, secret-store §1 비대상 예외, node-output Principle 0, chat-channel CCH-AD-07/
CCH-ERR-04/R-CC-16, 데이터 모델 §2.2 Workspace.settings, 웹채팅 위젯/인증세션 R4/R6/R9)과 대조했을 때 앵커·
필드명·에러 코드·표가 정확히 일치했다. 이 문서는 자체적으로 과거 cross_spec 라운드의 지적(예: `R-outbound-flood`
말미 "impl-prep cross_spec WARNING 반영", R17 의 `23_49_05`/`01_17_49` cross_spec 발견 이력)을 흡수해 온
이력이 뚜렷하며, 이번 라운드에서도 그 상태가 유지되고 있다. 이번 impl-prep 이 겨냥하는 `nodeOutput` allowlist
설계(공개 5필드 `config/output/meta/port/status` + wire 전용 4필드 `formConfig/conversationConfig/
buttonConfig/interactionType`)는 `node-output.md` Principle 0 의 `NodeHandlerOutput` 정의, WS §4.4 의 실제
wire nesting 규칙과 정합하며 구현을 진행해도 무방하다. 유일한 관찰 사항은 INFO 등급의 문서 완결성 참고(제외
목록에 `_resumeCheckpoint` 미열거)로, 구현을 막을 사유가 아니다.

## 위험도

NONE
