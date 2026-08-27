# Cross-Spec 일관성 검토 — `spec/5-system/` (masking-residuals, impl-done)

## 검토 범위와 방법

프롬프트 번들은 예산 초과로 `spec/5-system/**` 19개 파일 본문이 전부 생략돼 있어, 워킹트리
(`/Volumes/project/private/clemvion/.claude/worktrees/masking-residuals-0b195b`)를 절대경로로
직접 `Read`/`git grep`/`git diff origin/main...HEAD` 한 결과를 근거로 작성했다.

핵심 변경(diff 실측): 노드 `config` echo 마스킹을 **저장 시점(엔진 boundary,
`handler-output.adapter.ts` 의 `maskSensitiveFields`)에서 egress 전용**(REST
`redactStoredDataForResponse` / WS `maskWireEnvelope`, 둘 다 `deepRedactSecrets*` 공유)으로
이전 — 표현식(`$node["X"].config.<field>`)이 마스킹된 리터럴이 아니라 원문을 읽게 하기 위함.
영향받은 spec: `spec/5-system/{4-execution-engine,6-websocket-protocol,14-external-interaction-api}.md`,
`spec/conventions/{node-output,egress-masking}.md`, `spec/2-navigation/14-execution-history.md`
(R-5 정정 블록), `spec/3-workflow-editor/4-ai-assistant.md`, `spec/4-nodes/3-ai/1-ai-agent.md`.

이 PR 은 이미 오늘 3라운드의 `--impl-done` consistency-check(`13_25_45`, `13_47_15`)와 6라운드의
`/ai-review`(마지막 `14_10_42`, CRITICAL 0)를 거쳤다. `13_47_15` cross_spec 이 낸 WARNING
(R-5 W2 "HTTP Request·Send Email" 프레이밍이 두 노드의 기존 config 모델과 어긋남)은 후속 커밋
`69802a686`(`13_47_15` W1)에서 정정됐고, 그 정정의 실측 정확성을 본 라운드에서 독립적으로
재검증했다:

- `spec/4-nodes/4-integration/1-http-request.md` §4 step 2: config echo 가 스키마 필드를
  **명시 열거**하고 `url` 은 `sanitizeUrlCredentials` 로 교체 — `authentication='custom'` 만
  스키마 없는 사용자 자유입력(`headers`/`body`) 경로임을 §1(`58`행 "Custom (직접 헤더 입력)")·
  §4.2/§8.2 에서 확인.
- `spec/4-nodes/4-integration/3-send-email.md` §1/§5.1: 자격증명은 `integrationId` 간접화로만
  해소되고 "자격증명 자체는 echo 되지 않음"을 명시 — config 에 자격증명이 문자열로 앉을 경로
  자체가 없음을 확인.
- `plan/in-progress/spec-sync-external-interaction-api-gaps.md` (515행 이하) 의 정본 트래커
  항목도 동일하게 좁혀진 표(AI Agent/Send Email/HTTP Request `integration`/HTTP Request
  `custom`)로 갱신돼 있어 spec ↔ plan 간 드리프트 없음.

`13_47_15` INFO(코드 주석 `websocket.service.ts:448` 의 구용어 "boundary masking parity"
잔존)도 현재 `egress masking parity` 로 갱신 확인.

## 추가 확인 (본 라운드 신규)

- `maskSensitiveFields` 관련 전 spec 참조 18건(`git grep`)을 전수 대조 — 모두 "2026-08-24 정정"
  각주로 새 사실(storage-time 마스킹 boundary 제거, egress-only)을 일관되게 반영. 스윕
  누락(옛 서술 잔존) 없음.
- `spec/conventions/node-output.md` Principle 0 신규 서술("config: 자격증명도 원문 그대로
  담긴다")과 `1-http-request.md`/`3-send-email.md` 의 "자격증명은 echo 금지" 서술은 **레이어가
  달라 충돌이 아님** — Principle 0 은 스토리지 boundary 의 일반 메커니즘(무엇이 담기든 더는
  자동 strip 하지 않는다)을 기술하고, 개별 노드 spec 은 "핸들러가 애초에 무엇을 담는가"라는
  설계 정책을 기술한다.
- RBAC/viewer 관련 교차 문서(`spec/5-system/1-auth.md`, `spec/7-channel-web-chat/4-security.md`)
  에 이번 마스킹 시점 변경과 상충하는 별도 서술 없음(grep 0건) — Config 탭 viewer 노출 안전성
  결론("egress 를 지나므로 여전히 마스킹된다")은 `spec/2-navigation/14-execution-history.md`
  R-5 단일 SoT 로 유지되고 다른 영역이 이를 재정의하지 않음.
- 요구사항 ID(EH-DETAIL-*, RR-PL-*, R17 하위 불릿) 신규 충돌 없음 — 이번 diff 는 기존 ID 에
  각주/정정만 추가했을 뿐 신규 ID 발급이 없다.

## 발견사항

없음 (CRITICAL/WARNING/INFO 모두 0). 직전 라운드가 남긴 WARNING·INFO 는 후속 커밋에서 해소됐고
그 해소의 실측 정확성도 본 라운드에서 독립 재검증했다.

## 요약

이번 `spec/5-system/` 변경(config 마스킹을 저장 시점에서 egress 전용으로 이전)은 관련 8개 spec
파일 + conventions + 정본 plan 트래커 전역에 걸쳐 grep/직접 대조 기준 잔존 모순이 없다. 직전
라운드(`13_47_15`)가 지적한 R-5 W2 의 부정확한 노드 예시 프레이밍은 후속 커밋에서 실측 기반으로
좁혀졌고(Send Email/HTTP Request `integration` 은 해당 없음, `custom` 만 남는 표면), 그 정정
내용을 본 라운드에서 두 노드의 개별 spec 과 직접 대조해 정확함을 확인했다. 데이터 모델·API
계약·요구사항 ID·상태 전이·RBAC·계층 책임 어느 관점에서도 신규 충돌을 발견하지 못했다.

## 위험도

NONE
