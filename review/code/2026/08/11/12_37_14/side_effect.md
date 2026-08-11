# 부작용(Side Effect) 리뷰 — `12_37_14`

## 스코프 정리 (검증 선행)

프롬프트에 실린 22개 파일은 `origin/main` 대비 브랜치 누적 diff(4 커밋: `d71a53127` → `bc569b089` → `8b2ae7164` → `9eb2c6088`)다.
직전 리뷰 라운드(`12_22_23`)는 `8b2ae7164`(feat, controller/service 실동작 변경 포함)까지 이미 검토했고, 이번 라운드가
보는 신규 델타는 **`9eb2c6088` 한 커밋**이다. `git show --stat 9eb2c6088` 로 실측:

```
CHANGELOG.md                                       | 25 ++
audit-action.const.ts                              | 15 (주석만, 로직 불변)
triggers.service.spec.ts                           | 44 (신규 테스트 2건 + 주석 1곳)
plan/in-progress/spec-sync-auth-gaps.md            |  8
spec/5-system/1-auth.md                            |  2 (산문 정정)
```

각 파일 diff 를 직접 열어 확인:
- `audit-action.const.ts`: 주석 블록만 교체. `TRIGGER_*` 상수 값·순서 불변 (`git show 9eb2c6088 -- audit-action.const.ts` 로 실측 — `+`/`-` 라인이 전부 `//` 로 시작).
- `triggers.service.spec.ts`: `rotateBotToken` 6단계 오케스트레이션 describe 에 성공/실패 감사 테스트 2건 추가 + 인접 describe 주석 1줄 정정. production 소스 미접촉.
- `CHANGELOG.md` / `plan/in-progress/spec-sync-auth-gaps.md` / `spec/5-system/1-auth.md`: 산문·표·plan 항목만.
- `codebase/backend/src/modules/triggers/{triggers.controller.ts,triggers.service.ts,triggers.controller.spec.ts}` 는 이번 커밋 `--stat` 목록에 **없다** — 즉 이번 델타에서 손대지 않았다. 프롬프트에 실린 그 파일들의 diff 는 `8b2ae7164`(이전 라운드에서 이미 검토된 커밋)의 내용이다.

**결론: "이번 delta 는 테스트 2건·주석 정정·CHANGELOG·plan 이다 → 동작 변경 0" 주장은 액면가가 아니라 커밋 단위로 실측 검증했고, 사실과 일치한다.** 다만 정확히는 `spec/5-system/1-auth.md` 산문 정정 1건이 주장에 명시적으로 나열되지 않았다 — 이 역시 non-runtime 문서라 "동작 변경 0" 결론 자체에는 영향 없음(INFO 로만 기재).

## `rotateBotToken` 감사 순서 재검증 (fail-closed 여부)

커밋 메시지가 "컬럼 갱신이 끝난 뒤에 기록한다"고 주장하므로, 프롬프트 diff 만 믿지 않고 현재 파일을 직접 열어 재확인했다
(`codebase/backend/src/modules/triggers/triggers.service.ts` line 1010 `await this.secrets.rotate(botTokenRef, ...)` (3단계) →
line 1012 `adapter.setupChannel` (4단계, try/catch) → line 1030 `issuedInboundSigning` 저장 (5단계) →
line 1041 `triggerRepository.update` (6단계, 컬럼 갱신) → line 1053 `this.recordAudit({...})`). `recordAudit` 호출은 6단계
전부 성공한 뒤에만 도달하는 위치에 있다 — 신규 테스트("오케스트레이션이 중간에 실패하면 남기지 않는다", `setupChannel` mock reject)의
전제와 실제 코드 흐름이 일치한다. `rotateNotificationSecret`/`revokePerTriggerToken` 도 각각 `triggerRepository.save` 직후에만
`recordAudit` 를 호출해 같은 fail-closed 패턴이다. 세 메서드 모두 감사 실패가 주 동작에 영향을 주지 않는 방향(호출 순서상 감사가
마지막)이라 "성공 상태 오기록" 부작용은 없다.

## `AuditLogsService.record()` DB 오류 삼킴 — WARNING 처분 타당성 확인

`codebase/backend/src/modules/audit-logs/audit-logs.service.ts:81-96` 를 직접 열어 확인:

```ts
try {
  ...
  await this.auditLogRepository.save(log);
} catch (err) {
  this.logger.warn(`Failed to write audit log: ...`);
}
```

- 이 파일은 이번 브랜치의 어느 커밋에서도 diff 에 등장하지 않는다(`git log -p --follow` 대상 아님 — 4개 커밋 stat 목록 어디에도 없음). 즉 **이번 PR 이 만든 코드가 아니라 기존 설계** — plan 서술("이 PR 이 만든 회귀가 아니라 17개 감사 producer 전체의 기존 설계")과 실측이 일치한다.
- 세 회전 메서드가 부르는 `TriggersService.recordAudit`(private helper, `triggers.service.ts:212`)은 이 `record()` 를 그대로 호출하는 위임 래퍼이고, 다른 CRUD 액션(`TRIGGER_CREATED` 등)과 동일 경로를 공유한다 — "세 회전 메서드만 별도로 삼킴을 도입"한 게 아니라 **기존 공용 producer 계약을 그대로 따른 것**.
- 실무 영향: 회전 API 는 200 을 반환하고 감사 행만 조용히 비는 시나리오가 가능하지만, 이는 회전 자체의 실패/부분실패가 아니라 **관측성 갭**이며 요청측 side effect(과금·인가·데이터 정합성) 는 없다 — CRITICAL 등급 요건(동작 오류·데이터 손상·보안 우회)에 해당하지 않는다.
- `plan/in-progress/spec-sync-auth-gaps.md` 항목(gate 69-76)이 이 WARNING 을 정확한 근거(파일·동작·"회귀 아님" 명시)로 등재했고 체크박스도 미해결 상태(`- [ ]`)로 정직하게 남겼다 — 등재 처분 타당함.

## 그 외 부작용 관점 점검 (전체 diff 기준)

- **시그니처 변경** (`rotateNotificationSecret`/`revokePerTriggerToken`/`rotateBotToken` 에 `userId` 파라미터 추가, 파일 5/7 — `8b2ae7164`, 이전 라운드 기 검토): 호출부는 `TriggersController` 세 메서드가 유일하며 모두 함께 갱신됨을 재확인(`grep -rn` 으로 전 backend 소스에서 다른 호출부 0건). 이번 라운드 신규 이슈 아님.
- **전역 변수/환경 변수**: diff 22개 파일 전체에서 `process.env`/모듈 스코프 mutable 전역 도입 없음.
- **파일시스템**: 신규 파일은 `review/consistency/2026/08/11/11_48_48/**`(컨벤션대로 review 산출물 경로) 뿐 — 예상 밖 위치에 쓰기 없음.
- **네트워크 호출**: `rotateBotToken` 의 `adapter.setupChannel`(Telegram 등 외부 API) 은 기존 오케스트레이션의 일부이며 이번 델타에서 신규 도입되지 않음.
- **이벤트/콜백**: `recordAudit` 호출 추가가 유일한 신규 "이벤트 발생" 이고, 위에서 확인한 대로 실패 시 미발화(fail-closed) — 의도와 일치.

## 발견사항

- **[INFO]** 위치: `plan/in-progress/spec-sync-auth-gaps.md` (신규 항목, gate 69-76) — 상세: `record()` DB 오류 삼킴 WARNING 의 등재 처분은 실측(비-diff 기존 코드, 공용 producer 경로)과 일치하며 타당함. 제안: 없음(현행 유지).
- **[INFO]** 위치: `codebase/backend/src/modules/triggers/triggers.service.ts` `rotateBotToken` (recordAudit 호출부, 현재 파일 기준 line 1053 부근) — 상세: 감사 기록이 6단계 컬럼 갱신 이후에만 도달하도록 배치되어 있음을 소스 직접 열람으로 재확인. 신규 실패-경로 테스트의 전제와 일치. 제안: 없음.
- CRITICAL 등급 발견 없음.

## 요약

이번 라운드가 실제로 검토해야 할 델타(`9eb2c6088`)는 커밋 stat·파일별 diff 를 직접 열어 확인한 결과 테스트 추가 2건 + 주석/문서 정정(코드 주석 1곳, spec 산문 1곳) + CHANGELOG + plan 뿐이며, production 코드(`triggers.controller.ts`/`triggers.service.ts`)는 이번 커밋에 포함되지 않아 동작 변경은 0 이다. 프롬프트에 실린 production 코드 diff 는 이전 라운드(`8b2ae7164`)에서 이미 검토된 부분이고, 이번에 재확인한 결과 `rotateBotToken` 의 감사 기록은 6단계 오케스트레이션이 전부 성공한 뒤에만 발화하도록 배치되어 fail-closed 원칙을 지킨다. `AuditLogsService.record()` 가 DB 오류를 삼키는 것은 이 PR 의 변경 범위 밖 기존 공용 설계이고, plan 에 정확한 근거로 등재된 처분은 타당하다.

## 위험도

NONE
