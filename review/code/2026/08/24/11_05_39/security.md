# 보안(Security) 코드 리뷰 — `node-output-envelope` (`envelope.output` fail-closed allowlist 확장)

## 리뷰 방법

`_prompts/security.md` 번들이 예산 절단으로 대부분 파일 본문을 못 실었으므로(특히 파일 1·2·3·6·7·9), 실제 보안 로직이 담긴 소스를 저장소에서 직접 `Read`로 전문 확인했다:
`codebase/backend/src/modules/websocket/websocket.service.ts`(전체),
`codebase/backend/src/shared/utils/node-output-allowlist.ts`(전체),
`codebase/backend/src/modules/websocket/websocket.service.spec.ts`(관련 구간),
`git diff origin/main --stat`로 변경 파일 목록 대조.

이 PR 의 실질 보안 표면은 파일 3(`websocket.service.ts`)과 그 캐너리(파일 2)뿐이다. 나머지(파일 1·4~19)는 CHANGELOG/plan/spec 문서와 이전 `/consistency-check` 산출물(신규 생성된 review 아티팩트)로, 보안 관점에서 코드 실행 경로에 영향이 없다.

## 발견사항

- **[INFO]** egress 마스킹 확장은 정보 노출을 **줄이는** 방향의 변경이며 새로운 인젝션/인가/암호화 취약점을 도입하지 않는다
  - 위치: `codebase/backend/src/modules/websocket/websocket.service.ts:182`-`214` (`narrowTopLevelNodeOutput`, `allowlistFanoutNodeOutput`)
  - 상세: 기존 `allowlistFanoutNodeOutput`이 `envelope.nodeOutput`(및 `envelope.buttonConfig.nodeOutput`)에만 걸던 fail-closed allowlist(`allowlistNodeOutputKeys`, `node-output-allowlist.ts:125`)를 `envelope.output`(= `execution.node.completed`/`.failed` 가 `NodeExecution.outputData`를 싣는 최상위 키)까지 확장했다. `narrowTopLevelNodeOutput`은 copy-on-change로 동작하고, 값이 `null`이거나 객체가 아니면 원본을 그대로 반환한다(`188`행) — `allowlistNodeOutputKeys` 자신도 배열/원시값은 통과시키므로 두 함수의 fail-closed 범위가 일치한다. 내부 WS(`gateway.broadcastToChannel`, `328`행)는 `toFanoutEnvelope` 호출 이전에 이미 나가므로 이번 변경으로 영향받지 않는다(에디터 콘솔 디버깅 가치 보존) — 이는 캐너리 테스트(`websocket.service.spec.ts` 신규 `[캐너리]` 케이스, `wire` vs `fanout` 객체 비교)로 고정돼 있다.
  - 값 레벨 마스킹(`sanitizePayloadForWs`/`CREDENTIAL_KEY_PATTERN`, `deepRedactSecretsPreserving`)은 이 allowlist 필터보다 **앞선 단계**(`maskWireEnvelope`, `317`행)에서 이미 실행되므로, allowlist 안에 남는 키라도 credential-like 값은 별도로 마스킹된 상태다 — 두 방어선이 순서상 올바르게 겹친다.
  - 결론: 취약점이 아니라 하드닝(egress allowlist 확장)이다.

- **[INFO]** 문서화된 잔여 위험(미해결) — `finalAdapted ?? context.nodeOutputCache[node.id]` flat 폴백
  - 위치: 코드 자체는 이번 diff 범위 밖(`ai-turn-orchestrator.service.ts`, 미변경). 해당 위험은 `plan/in-progress/node-output-envelope.md`(파일 5) "남은 위험" 절과 `websocket.service.spec.ts`의 `[잔여 고정]` 캐너리(`976`행 부근, 게이트 숫자는 diff상 `976`)에 명시돼 있다.
  - 상세: 이 폴백 경로가 살아있는 코드 경로로는 존재하지만(e2e 285건 실측에서 0회 발현), 발현 시에도 이번에 확장된 fail-closed allowlist를 그대로 통과하므로 **egress 마스킹 관점의 우회는 아니다** — `[잔여 고정]` 테스트가 "목록 안 키는 남고 목록 밖 키는 떨어진다"를 그 shape 에 대해서도 확인한다. 남은 것은 "flat view가 영속 컬럼에 저장되는 것이 계약상 옳은가"라는 별건 데이터 무결성 문제이며 트래커에 별도 항목으로 등재돼 있다(`spec-sync-external-interaction-api-gaps.md`). 보안 등급으로 보면 이 잔여는 egress 노출 위험이 아니라 INFO 수준의 추적 사안이다.
  - 제안: 이번 PR 범위에서 추가 조치 불요 — 이미 트래커에 등재·캐너리로 고정됨. 후속 세션에서 그 경로가 실제 발현하면(재개 신호로 문서화됨) 재검토.

- **[INFO]** allowlist가 넓히는 방향(추가된 4개 chat-channel 키: `payload`/`title`/`rendered`/`nodeType`)은 이번 PR의 변경이 아니라 선행 PR(#1208)에서 도입된 것이며, 이번 diff는 그 목록을 재사용할 뿐 넓히지 않는다
  - 위치: `codebase/backend/src/shared/utils/node-output-allowlist.ts:66`-`96` (`NODE_OUTPUT_ALLOWED_KEYS`, 미변경 파일)
  - 상세: 확인 목적으로만 기재 — 이번 diff가 목록 자체를 건드리지 않았음을 `git diff origin/main --stat`으로 확인했다(해당 파일이 변경 목록에 없음). 신규 배선(`envelope.output`)이 기존 목록을 그대로 재사용하므로 새로운 필드 노출면은 추가되지 않는다.

- **[INFO]** 하드코딩된 시크릿 없음 / SQL·커맨드 인젝션 표면 없음
  - 상세: 이번 diff는 순수 in-memory 객체 필드 필터링 로직(WS/SSE fanout envelope 조립)이며 외부 입력을 SQL/셸/파일 경로에 연결하지 않는다. `plan/in-progress/node-output-envelope.md`에 포함된 SQL(`SELECT k, count(*) FROM node_execution ...`)은 실측을 위해 작업자가 수동 실행한 진단 쿼리이고 애플리케이션 코드 경로가 아니며, 파라미터 바인딩이 필요한 사용자 입력이 없다(고정 쿼리 텍스트).

## 요약

이 PR은 `#1208`이 닫은 fail-closed egress allowlist(`nodeOutput`/`buttonConfig.nodeOutput`)를 `execution.node.completed`/`.failed`가 다른 키(`output`)로 싣는 동일 `NodeExecution.outputData`까지 확장해, 이전에 deny-list(fail-open) 상태로 남아 있던 표면(`_retryState` 등 엔진 내부 필드 노출 가능)을 닫는 순수 방어 강화(hardening) 변경이다. 값 레벨 credential 마스킹은 allowlist 필터보다 앞 단계에서 이미 적용되고, 내부 WS(에디터 콘솔) 경로는 fanout 분기 이전에 분리돼 영향받지 않음이 캐너리 테스트로 고정돼 있다. 새로운 인젝션·인증/인가 우회·하드코딩 시크릿·안전하지 않은 암호화·민감정보 에러 노출 표면은 발견되지 않았다. 유일하게 남는 잔여 위험(`nodeOutputCache` flat 폴백)은 이번 allowlist 확장 이후에도 여전히 fail-closed로 걸러지며, 별건(영속 계약) 문제로 트래커에 명시적으로 등재·캐너리로 고정돼 있어 은닉된 결함이 아니다. 나머지 변경 파일(plan/spec/CHANGELOG, `review/consistency/**` 신규 산출물)은 문서 성격이라 실행 경로 보안에 영향이 없다.

## 위험도

NONE
