# Rationale 연속성 검토 — `impl-setup-error-code` (--impl-done, scope=spec/5-system/)

## 검증 방법

`spec/5-system/` 델타는 0개 파일(이 PR 은 코드 전용, `spec_impact: none`)이라, 대신 이 PR 의 실제
구현(`git diff origin/main...HEAD`, 21파일/1012줄, 프롬프트 예산에서 절단됨 — 워킹트리를
절대경로로 직접 읽어 확인)이 이미 확정된 `spec/5-system/15-chat-channel.md` §5.4 · R-CC-23,
`spec/conventions/chat-channel-adapter.md` §1.1.2 · R-CCA-9, `spec/5-system/2-api-convention.md`
§5.3(top-level `code` vs `details[].code`) · §6, `spec/5-system/3-error-handling.md`(CWE-209 원문
미노출 원칙)를 재도입 없이 따르는지 대조했다. 아울러 같은 세션의 두 선행 라운드
(`12_54_15` --impl-prep, `14_11_58` --spec)가 남긴 INFO 2건이 이번 diff 에서 실제로 해소됐는지
재확인했다.

## 발견사항

없음.

## 교차검증 (반증 시도 — 전부 실패, 정합 확인)

1. **R-CCA-9 기각 대안 재도입 없음** — `discord.adapter.ts` 는 종전 `'BOT_TOKEN_INVALID: …'`
   message 접두(R-CCA-9 가 "관례 승격" 안으로 검토 후 기각)를 제거하고
   `credentialRejectedError(message)` (code 프로퍼티)로 교체했다. `chat-channel-input-rules.ts`
   의 `translateSetupChannelError` 도 1차 판별을 `isCredentialRejectedError(err)`(code 정확 일치)로
   바꿨다 — "message 에서 status 숫자를 찾는다"(R-CCA-9 가 기각한 첫 대안)는 **한시적 fallback**
   으로만, §1.1.2 가 명시적으로 허용한 범위 안에서만 잔존한다.
2. **§1.1.2 "제거 조건" 게이트를 앞지르지 않음** — v1 provider 3종 모두 `code` 부착이 이 PR 로
   끝났지만, 구현은 401/403 message fallback 을 **그대로 유지**했다(`chat-channel-input-rules.ts`
   diff). §1.1.2 의 2026-09-12 갱신("신호는 켜졌고, 실측 판정은 「아직 제거하지 말 것」")과
   정확히 같은 결론이며, `spec-draft-nullable-notation-followups.md` 에 "Slack 비-JSON 4xx 합성
   에러" 등 fallback 이 유일 방어인 잔여 경로 3개를 표로 남겨 후속 판정을 위임했다 — 조건 충족을
   자동 삭제로 잘못 해석하지 않았다.
3. **CWE-209 원문 미노출 원칙 확장 적용** — `translateSetupChannelError` 는 두 분기 모두
   `details: { reason: message.slice(0,256) }` 를 제거했다. 이는 R-CC-23 이 인용한
   `4-execution-engine.md §7.5.2`·`3-error-handling.md`(§5.3 "내부 구현 원문을 echo 하지 않는다 —
   CWE-209 방지", `PAYLOAD_TOO_LARGE`·`EXECUTION_INTERNAL_ERROR` 고정 문구 선례)와 같은 방향이고,
   `TriggersService.rotateBotToken` 이 호출부에서 `this.logger.warn` 으로 원문을 서버 로그에만
   남기도록 대칭 이동했다 — 보안 원칙을 우회하지 않고 오히려 결여됐던 지점을 정렬했다.
4. **`chat-channel-input-rules.ts` 의 "의존 0" invariant 보존** — `15-chat-channel.md` 가 명시하는
   순수 함수 계약을 어기지 않는다. `credentialRejectedError`/`isCredentialRejectedError` import 는
   같은 계층의 타입/헬퍼(`chat-channel/types.ts`)이고 `Logger` 는 여전히 그 파일에 없다 — 로깅은
   설계 판단대로 호출자(`TriggersService`)로 이동했다.
5. **top-level `code` vs `details[].code` 택일 기준(2-api-convention §5.3) 위반 없음** —
   `BOT_TOKEN_INVALID`/`CHAT_CHANNEL_SETUP_FAILED` 는 "한 요청에 사유가 하나뿐"인 top-level 교체
   사례(§5.3 표의 `DUPLICATE_NODE_LABEL` 등과 동형)이고, `details` 를 아예 비워 "field 있으면
   code 도" 규칙의 대상도 아니다.
6. **502 신설이 기존 502/503 축(4-execution-engine C-1)과 충돌하지 않음** — C-1 은 "우리 인프라
   장애=503"(대상 전부 자체 서비스), 이 PR 의 502 는 "외부 provider 실패"(R-CC-23 스코프) —
   서로 다른 축이며 R-CC-23 본문이 이 비충돌을 이미 정본화했다. `getCodeFromStatus`(502 미매핑,
   현재 도달 불가) · `teardownChannel`/`revokeBotToken` 미부착 · swagger 404/200 잔여는 모두
   무근거 방치가 아니라 `spec-draft-nullable-notation-followups.md` 에 사유(스코프·발명 코드
   회피)와 함께 새 항목으로 등재돼 추적된다 — 결정 번복이 아니라 명시적 스코프 한정.
7. **선행 라운드 INFO 2건 해소 확인** — (`12_54_15`) fallback 제거 판정 트래커와의 cross-link
   부재는 이번 PR 의 `impl-setup-error-code.md` "완료 시 착수 신호가 켜지는 다른 항목" 절과
   followups 문서의 2026-09-12 업데이트로 연결됐다. Slack 5값 열거의 spec 미반영은
   `slack.md §3.1 의 개방형 열거를 확정 5값으로`(planner, 2026-09-12 등재) 항목으로 followups
   트래커에 신설 등재됐다 — 둘 다 방치 없이 처분됨.

## 요약

이 PR 은 spec 을 건드리지 않는 코드 전용 구현이며, 직전 `--spec` 3라운드로 확정된 R-CC-23
(setupChannel 실패는 transport 가 아니라 원인으로 분류)·R-CCA-9(`code` 프로퍼티 선언, message
파싱/접두 기각)·CWE-209 원문 미노출 원칙을 정확히 따른다. 기각된 대안(message 접두·status 숫자
파싱)의 재도입, §1.1.2 제거 조건의 성급한 집행, top-level/`details[].code` 택일 기준 위반, 502/503
축 혼동 중 어느 것도 발견되지 않았다. 새로 생긴 스코프 한정(teardown/revoke 미부착,
getCodeFromStatus 미변경 등)은 전부 근거와 함께 후속 트래커에 등재돼 무근거 번복이 아니다.

## 위험도

NONE
