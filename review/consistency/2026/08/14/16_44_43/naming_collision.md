# 신규 식별자 충돌 검토 — spec/5-system/ (impl-done)

## 조사 방법

`origin/main` 대비 실제 diff 는 `spec/5-system/14-external-interaction-api.md`,
`spec/5-system/6-websocket-protocol.md` 두 파일과, 대응 구현
(`codebase/backend/src/shared/utils/strip-external-only-fields.ts`(신규) +
`websocket.service.ts`/`interaction.service.ts` 리팩터)로 한정된다. 워킹트리
절대경로로 `git diff origin/main` 을 직접 실행해 실 변경분을 확정한 뒤, 그 변경분이
도입하는 식별자만 대상으로 점검했다 (bundle 안의 "구현 변경 사항" 섹션은 비어 있어
diff 자체를 1차 근거로 사용).

## 발견사항

이번 변경이 새로 도입하는 식별자는 다음 소수에 그친다 — 전부 기존 사용처와 충돌 없이
확인됨:

- `stripExternalOnlyFields` / `EXTERNAL_STRIPPED_FIELDS` (신규 공유 유틸
  `codebase/backend/src/shared/utils/strip-external-only-fields.ts`) — 기존
  `websocket.service.ts` 안에 있던 동명 로컬 함수/상수를 그대로 이 파일로 옮긴 것이며,
  두 호출부(`websocket.service.ts`, `interaction.service.ts`)가 동일 함수를 import 해서
  쓴다. `grep` 전수 확인 결과 다른 의미의 동명 정의 없음(구식 `dist/` 컴파일 산출물의
  구버전 정의는 빌드 아티팩트라 무관).
- `stripAndRedact` (신규 모듈-로컬 함수, `interaction.service.ts`) — export 되지 않는
  파일 내부 헬퍼, 다른 파일에 동명 정의 없음.
- EIA §6.2 `interaction` 블록의 4개 URL 필드값을 기존 절대 URL(`https://api.clemvion.ai/v1/...`)
  에서 §5.1~§5.5 가 이미 쓰는 정식 상대경로(`/api/external/executions/{id}/interact` 등)로
  **정정**했다 — 이는 새 endpoint 도입이 아니라 기존 endpoint 표기와의 **불일치를 해소**한
  변경이라 충돌이 아니라 충돌 제거에 해당한다.
- §6.2 blockquote 가 새로 문서화하는 평면 필드명(`waitingNodeType`/`waitingNodeLabel`/
  `nodeExecutionId`/`startedAt`/`status`)은 모두 WS §4.4 가 이미 소유해 온 기존 wire
  식별자이며, 이번 diff 는 "EIA 표면도 같은 이름을 그대로 쓴다" 는 사실을 추가 문서화한
  것뿐이다 — 새 이름을 만들지 않았다.
- Rationale 섹션 표제 하나가 리네임됐다(`ai_message.llmCalls[] 외부 수신자 strip` →
  `llmCalls 외부 수신자 strip — 위치·이벤트·표면 무관`). 옛 표제 텍스트/앵커를 가리키는
  참조가 spec·codebase 전체에 없음을 확인 — dangling 없음.
- `CCH-ERR-04`, `§R17`, `MAX_SANITIZE_DEPTH`, `MAX_REDACT_DEPTH` 등 diff 가 새로 인용하는
  ID·상수는 모두 diff 이전부터 존재하던 기존 정의이며 의미가 그대로 유지된 상태로
  인용됐다 — 새 ID 발급이 아니다.
- 새 ENV var, 새 queue/webhook/SSE 이벤트명, 새 spec 파일 경로는 이번 diff 에 없다
  (frontmatter `code:` 목록에 기존 파일 경로 1개를 추가 등재했을 뿐 — 파일 자체는
  이미 두 spec 문서에 걸쳐 code 로 연결돼 있던 것과 이번에 함께 쓰는 신규 공유 파일).

이번 diff 는 성격상 순수 doc-sync + 보안 누출(§6.2/§R17 raw `llmCalls` 노출) 봉합이라
새 개념/새 명명 표면을 만들지 않고, 기존에 흩어져 있던 로직을 공유 유틸로 추출하며
이름을 그대로 이어받았다. 사전에 존재하던 "4.4" 섹션 번호 중복(§4.4 사용자 입력 대기 /
§4.4 알림 이벤트)은 `origin/main` 에도 동일하게 존재하는 pre-existing drift 로,
이번 diff 가 만들거나 건드린 것이 아니라 범위 밖으로 판단해 제외했다.

## 요약

이번 target 변경은 `spec/5-system/14-external-interaction-api.md` 와
`6-websocket-protocol.md` 두 문서, 그리고 대응 backend 유틸/서비스 리팩터로 범위가
좁고, 새로 도입하는 식별자(`stripExternalOnlyFields`/`EXTERNAL_STRIPPED_FIELDS`/
`stripAndRedact`)는 모두 단일 정의·일관된 재사용이며 기존 코드베이스·spec 어디에도
다른 의미로 쓰이는 동명 항목이 없다. 오히려 §6.2 URL 필드를 기존 §5.1~§5.5 endpoint
표기와 맞춰 사전에 있던 불일치를 없앴다. 신규 요구사항 ID·엔드포인트·이벤트명·환경변수·
spec 파일 경로 신설은 없어 신규 식별자 충돌 관점에서 지적할 사항이 없다.

## 위험도
NONE
