# 신규 식별자 충돌 검토 — `spec/5-system/` (impl-done)

## 조사 방법

`--impl-done` 규약에 따라 프롬프트 번들의 diff 가 절단돼 있어(9개 파일 중 실 diff 는 절단),
워킹트리(`/Volumes/project/private/clemvion/.claude/worktrees/plan-in-progress-items-b0c80b`)에서
직접 `git diff origin/main` 을 절대경로로 재확인했다. scope 델타 2개 파일
(`spec/5-system/14-external-interaction-api.md`, `spec/5-system/6-websocket-protocol.md`) 과
동반 변경된 `spec/data-flow/8-notifications.md`, 그리고 구현 diff 9개 파일 전수를 직접 읽었다.
또한 문서 내부 앵커·전역 cross-ref (`spec/`, `codebase/`, `plan/in-progress/`) 를 grep 으로
전수 대조했다.

## 발견사항

### [INFO] `hmac-sha512` 는 신규 식별자가 아니라 기존 구현을 spec 에 반영한 것

- target 신규 식별자(표면상): `spec/5-system/14-external-interaction-api.md` §8.2 의
  algorithm whitelist 에 추가된 `hmac-sha512`
- 기존 사용처: `codebase/backend/src/modules/triggers/dto/notification-config.dto.ts:39-47`
  (`enum: ['hmac-sha256', 'hmac-sha512']`), `codebase/backend/src/modules/external-interaction/notification-signature.util.ts:11-15`
  (`SupportedHmacAlgorithm = 'hmac-sha256' | 'hmac-sha512'`), `notification-webhook.processor.ts:298`,
  `codebase/packages/sdk/src/signature.ts:3-7` — 전부 diff 이전부터 이미 구현·테스트돼 있었다.
- 상세: 이 변경은 새 식별자를 "도입"하는 것이 아니라, 코드에 이미 존재하는 값을 spec 화이트리스트
  문구가 `hmac-sha256` 단일로 잘못 좁혀 놓았던 것을 정정한 것이다(spec-vs-code drift 정정).
  따라서 충돌 위험은 없다 — 오히려 정정 전 상태(spec 이 `hmac-sha512` 를 미문서화)가 "코드는
  받아들이는데 spec 은 모르는" 잠재 drift 였다.
- 부가 확인: outbound `hmac-sha512` 는 inbound webhook 검증([Spec Webhook §4.2](../../spec/5-system/12-webhook.md#42-hmac-서명--authconfigtypehmac))의
  `sha512` 와 "같은 알고리즘, 다른 표기 prefix" 임을 target 문서(§8.2 신설 문장)가 스스로 명시해
  구분했다 — 두 표기 공간이 실제로 섞여 쓰이는 코드 지점이 있는지도 확인했으나
  `AuthConfig.config.algorithm`(inbound, `sha256`/`sha512`)와 `signing.algorithm`(outbound,
  `hmac-sha256`/`hmac-sha512`)는 별개 필드/별개 타입으로 코드에서도 분리돼 있어 실제 혼선 없음.
- 제안: 조치 불필요.

### [INFO] `v2=` 서명 스킴 prefix 와 `notification_secret_v2` 컬럼 — target 이 스스로 선제 disambiguation

- target 신규 식별자: `spec/5-system/14-external-interaction-api.md` §8.2 신설 문장의 `v2=`
  (서명 헤더 `X-Clemvion-Signature` 의 스킴 버전 prefix, 아직 미발행·향후용)
- 기존 사용처: 같은 문서 §7.1 `ALTER TABLE trigger ADD COLUMN notification_secret_v2` (line 896,
  secret rotation 용 DB 컬럼, 기 도입됨)
- 상세: 두 `v2` 는 이름 형태만 겹칠 뿐 서로 다른 축(서명 헤더 스킴 버전 vs DB 컬럼)이다. 일반적으로
  이런 겹침은 WARNING 감이지만, target 자신이 같은 문장 안에서 "**무관하다 — 이름만 겹친다**"
  라고 명시적으로 선을 그어 놓았다 — 다음 독자가 두 `v2` 를 같은 것으로 오인할 소지를 target 이
  스스로 차단했다.
- 제안: 조치 불필요. (좋은 선례로 남길 만한 disambiguation 패턴.)

### [INFO] `6-websocket-protocol.md` §4.4 중복 헤딩 — target 이 pre-existing 충돌을 해소

- 기존 상태(`origin/main`): `### 4.4 사용자 입력 대기 이벤트 상세` (line 453) 와
  `### 4.4 알림 이벤트` (line 855) 가 **같은 문서 안에 동일 절 번호로 중복** 존재했고, 절 순서도
  `4.1 → 4.2 → 4.4(대기 상세) → 4.3(KB) → 4.4(알림) → 4.5 → 4.6` 로 어긋나 있었다 — 이 자체가
  본 검토 관점(요구사항/식별자 충돌)에 해당하는 **선재 CRITICAL 급 결함**이었다(앵커 링크가
  두 후보 중 어느 쪽에 걸리는지 불확정).
- target 조치: §4.3(KB 문서 이벤트, 인용 0건)을 §4.2 뒤·§4.4(대기 상세, 인용 ~190건) 앞으로
  이동하고, 꼬리 3절(알림 4.4→**4.5**, 시스템 4.5→**4.6**, 외부 표면 매핑 4.6→**4.7**)을
  순연시켰다. 결과: `4.1 · 4.1-a · 4.2 · 4.3 · 4.4 · 4.4.5 · 4.4.6 · 4.5 · 4.6 · 4.7` 로 중복 0·
  오름차순 — 직접 재확인 완료(`grep '^### 4\.' spec/5-system/6-websocket-protocol.md`).
- 전역 cross-ref 정합 재검증(본 검토에서 독립 수행): `spec/`, `codebase/`, `plan/in-progress/`
  전수 grep 결과, §4.4 를 인용하는 잔여 지점(`websocket.service.ts`/`.spec.ts`/
  `websocket-events.types.ts` 의 `tool_call_started`/`user_message`/`llmCalls`/
  `nodeOutput.meta.turnDebug` 관련 주석)은 전부 **여전히 §4.4(대기 상세) 소관 내용**이라
  정확하고, 알림 관련 지점은 전부 §4.5 로 갱신 완료(`spec/data-flow/8-notifications.md`
  4곳 · `websocket.service.ts:567/583/585` · `websocket.service.spec.ts:1268/1283` ·
  `websocket-events.types.ts:211/232`). `spec/2-navigation/4-integration.md:1020` 의
  `#44-중복-방지` 는 **다른 문서**(`data-flow/8-notifications.md` 자체의 §4.4)를 가리켜
  무관 — 오탐 후보였으나 대조 결과 충돌 아님.
- 상세: 이 항목은 "target 이 새로 만든 충돌"이 아니라 **target 이 해소한 기존 충돌**이다.
  다만 `plan/in-progress/spec-sync-external-interaction-api-gaps.md` 자체 기록에 따르면 이
  정리 작업 중 2라운드에 걸쳐 잔여 stale 참조가 나왔다 잡혔다(`websocket.service.ts:583/585`,
  `.spec.ts:1283` 등) — 본 검토가 그 이후 최종 상태를 재확인했고 현재는 잔존 불일치가
  발견되지 않았다.
- 제안: 조치 불필요 — 정정 완료 상태 확인.

### [INFO] 외부 REST §11 cross-ref (`§4.6` → `§4.7`) 동기화 확인

- target 신규 식별자: 없음(cross-ref 갱신만).
- 기존 사용처: `spec/5-system/14-external-interaction-api.md` §11 서두가 WS 문서의
  "외부 표면 매핑" 절을 가리킨다. 절 번호 이동에 맞춰 `§4.6` → `§4.7` 및 앵커
  `#46-외부-표면-매핑…` → `#47-외부-표면-매핑…` 로 갱신됨을 확인. 실제 헤딩(`### 4.7 외부
  표면 매핑`)과 앵커가 일치한다.
- 제안: 조치 불필요.

## 검색 대상 코퍼스 확인 메모

target 이 새로 도입하는 요구사항 ID·엔티티/DTO/인터페이스명·API endpoint(method+path)·
webhook/queue/SSE 이벤트명·ENV var·config key·신규 spec 파일 경로는 **전무**하다 — 이번
델타는 (a) spec-vs-code drift 정정(`hmac-sha512` 화이트리스트 반영), (b) 문서 내부 절 번호
재정렬(pre-existing 중복 헤딩 해소)로 구성된다. 신규 식별자 자체가 없으므로 CRITICAL/WARNING
등급 충돌 후보가 구조적으로 없다.

## 요약

target 문서(`spec/5-system/14-external-interaction-api.md`, `spec/5-system/6-websocket-protocol.md`)는
새 식별자를 도입하지 않는다 — `hmac-sha512` 는 이미 코드에 구현·테스트된 값을 spec 화이트리스트에
뒤늦게 반영한 것이고, `§4.3~§4.7` 절 번호 재배치는 origin/main 에 존재하던 `§4.4` 중복 헤딩(진짜
충돌)을 해소하는 작업이다. 전역 cross-ref(spec/codebase/plan/in-progress) 를 직접 grep 대조한
결과 잔여 stale 참조는 발견되지 않았고, `v2=` 서명 스킴 prefix 와 `notification_secret_v2` DB
컬럼 사이의 이름 겹침도 target 문서 스스로 같은 문장에서 명시적으로 구분해 두었다. 신규 식별자
충돌 관점에서는 조치가 필요한 항목이 없다.

## 위험도

NONE
