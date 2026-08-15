# 신규 식별자 충돌 검토 — spec/5-system/ (--impl-prep)

## 조사 방법 메모

프롬프트 번들은 컨텍스트 예산 초과로 `1-auth.md`·`2-api-convention.md`·`3-error-handling.md` 만
전문이 포함되고 나머지 15개 파일(`4-execution-engine.md` 등)은 절단되어 있었다. "여기 없다 = 내용
없다" 로 판정하지 말라는 번들 경고에 따라, `git diff main` 으로 이 브랜치가 실제로 건드린 파일을
먼저 특정한 뒤 해당 파일들을 직접 `Read`/`grep` 했다.

**실제 target diff** (main 대비):
- `spec/5-system/14-external-interaction-api.md` — 종결 이벤트(`completed`/`failed`/`cancelled`)의
  `durationMs` 필드를 "미구현(Planned)" → "구현됨" 으로 전환 + Re-run 엔드포인트 경로 오탈자 정정
  (`/api/v1/executions/:id/re-run` → `/api/executions/:id/re-run`).
- `spec/1-data-model.md`, `spec/2-navigation/0-dashboard.md`, `spec/2-navigation/7-statistics.md`,
  `spec/3-workflow-editor/3-execution.md`, `spec/conventions/chat-channel-adapter.md` — 위 결정의
  미러 반영(Rationale 추가, 타입 union 의 `durationMs` optional→`number | null` 정정 등).
- 코드: `codebase/backend/src/shared/utils/terminal-duration.ts`(신규, 이 커밋에서 도입) ·
  `terminal-error-payload.ts`(직전 커밋에서 이미 도입, frontmatter `code:` 목록에 신규 연결).

## 발견사항

이번 diff 가 실제로 **새로 도입하는 식별자**는 좁다 — 필드명 `durationMs` 자체는 이미 spec 에
"Planned" 로 선언돼 있던 이름이 구현 완료로 상태만 바뀐 것이라 신규 식별자가 아니다. 실질적으로
새로 생긴 식별자는 신규 유틸 파일의 export 뿐이었다. 전수 grep 결과 충돌 없음.

- **[INFO]** `durationMs` 의미가 계층별로 갈리지만 이미 문서가 명시적으로 캐비엇 처리함
  - target 신규/변경 식별자: `spec/5-system/14-external-interaction-api.md` §6 `durationMs`
    (Execution 종결 이벤트 레벨 — 취소·타임아웃 3경로는 "실행 시간"이 아니라 "대기 시간")
  - 기존 사용처: `spec/5-system/6-websocket-protocol.md:514,517` (`llmCalls[].durationMs` = 단일
    LLM 호출 소요, 턴 레벨 `durationMs` = 모든 LLM 호출+tool 합산), `4-execution-engine.md:514`
    (부가 실행 정보 `durationMs`) — 모두 "실제 소요 시간"을 뜻해 이번에 구현된 취소 경로의
    "대기 시간" 의미와 결이 다르다.
  - 상세: 같은 이름이 상위(Execution)·하위(노드/LLM 호출) 스코프에서 서로 다른 시간 종류를
    가리키는 형태는 이미 `6-websocket-protocol.md:206`("WS 계열은 `duration`으로 적는다 — 같은
    값") 로 표기 차이만 문서화돼 있었는데, 이번 diff 는 여기에 더해 "값의 종류(실행 시간 vs 대기
    시간)까지 갈릴 수 있다"는 새 캐비엇을 **target 문서 자신이 명시적으로 경고**한다
    (`14-external-interaction-api.md` §6.5 "수신자가 실행 소요로 읽으면 오해할 수 있다" 문단,
    `1-data-model.md` `duration_ms` 행에도 동일 캐비엇 미러). 즉 충돌은 실재하지만 target 이
    스스로 인지·문서화했으므로 별도 조치 불요 — 이름 변경(예: `elapsedMs` 분리)까지는 이번 스코프
    밖이라 판단되며 target 이 이미 내린 판단과 같다.
  - 제안: 조치 불요(참고용). 추후 별도 리네임 논의가 나오면 이 노트를 근거로 삼을 것.

## 충돌 없음 확인 (grep 실측)

- **엔티티/타입명**: `TerminalErrorPayload`(interface), `toTerminalErrorPayload`,
  `resolveTerminalDurationMs`, `toFiniteNumber`, `TERMINAL_DURATION_MS_SQL`,
  `TERMINAL_FINISHED_AT_PARAM`, `PG_INT4_MAX` — 전부 `codebase/backend/src` 전역에서 정의처
  1곳 + 호출처만 존재. 동명 타입/함수/상수가 다른 의미로 이미 쓰이는 곳 없음. frontend 에도
  동명 없음.
- **파일 경로**: `shared/utils/terminal-duration.ts`·`terminal-error-payload.ts` — 기존
  `shared/utils/*.ts`(bcrypt-format · retry-after · sanitize-error-message ·
  strip-external-only-fields) 와 동일한 kebab-case 명명 컨벤션을 따르며 겹치는 파일 없음.
  `modules/external-interaction/terminal-revoke-reconciler.*` 와 `terminal-` 접두어를 공유하나
  둘 다 "실행 종결(terminal state)" 이라는 같은 도메인 의미로 일관되게 쓰여 오히려 컨벤션 부합.
- **API endpoint**: Re-run 경로 정정(`/api/v1/executions/:id/re-run` → `/api/executions/:id/re-run`)은
  `spec/5-system/13-replay-rerun.md:200`·`spec/2-navigation/14-execution-history.md:346` 의 기존
  SoT 표기와 **일치시키는 수정**이다 — 종전 `/api/v1/...` 표기가 다른 어떤 spec 에도 존재하지
  않는 유령 경로였으므로, 이번 diff 는 충돌을 만드는 게 아니라 기존 (미검출) 불일치를 해소한다.
- **요구사항 ID**: 이번 diff 는 신규 `Rxx`/`EIA-xx-nn` ID 를 도입하지 않는다(기존 §6/§R8/Rationale
  번호 체계 재사용). 신규 ID 충돌 없음.
- **이벤트/메시지명**: 신규 webhook/queue/SSE 이벤트명 없음 — 기존 `execution.completed` /
  `execution.failed` / `execution.cancelled` 페이로드에 필드만 추가.
- **환경변수·설정키**: 신규 ENV/설정 키 없음.
- **plan 참조 무결성**: `plan/in-progress/spec-sync-external-interaction-api-gaps.md`,
  `plan/in-progress/retry-turn-terminal-guard.md`, `plan/in-progress/eia-terminal-payload.md` —
  diff 가 인용하는 plan 파일 전부 실재 확인.
- **DB 타입 정합**: `terminal-duration.ts` 의 `PG_INT4_MAX`(2147483647) 근거로 인용한
  `duration_ms INTEGER` 타입을 `codebase/backend/migrations/V001__initial_schema.sql:223,242` 에서
  실측 대조 — 일치.

## 요약

target diff 는 spec/5-system/ 전체가 아니라 `14-external-interaction-api.md` 의 `durationMs`
구현 반영(및 그 미러 4곳) + Re-run 경로 오탈자 정정으로 스코프가 좁고, 새로 도입하는 식별자도
`terminal-duration.ts`/`terminal-error-payload.ts` 의 export 소수에 그친다. 이 export 들과 변경된
엔드포인트 경로, 그리고 재사용된 `durationMs` 필드명 모두 codebase/spec 전역 grep 으로 대조했을 때
다른 의미로 이미 쓰이는 충돌 사례를 찾지 못했다. 유일한 주의점(`durationMs` 의 상위/하위 스코프
간 의미 차이)은 target 문서 자신이 이미 명시적 캐비엇으로 경고해 두었으므로 추가 조치가 필요한
결함으로 보지 않는다.

## 위험도

NONE
