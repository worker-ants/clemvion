# 문서화(Documentation) Review

## 검토 범위

이번 changeset 은 `trigger.config` lost-update(동시 PATCH 가 `chatChannel.inboundSigningRef`
를 지워 인입 서명 검증이 fail-open 으로 되돌아가는 결함)를 advisory lock + 락 안 재읽기로
닫는 7라운드째 `/ai-review` 다. 코드/문서 변경 파일은 `CHANGELOG.md` · `hooks.service.ts`
(+spec) · `trigger-config-lock.ts`(신규, +spec) · `chat-channel-binder.service.ts` ·
`chat-channel-input-rules.ts`(+spec) · `triggers.service.ts`(+spec, `.web-chat.spec.ts`) ·
`trigger-transaction-mock.ts`(신규) · `endpoint-path-conflict-wrap-guard.ts`(+spec, fixture) ·
`trigger-config-lost-update.e2e-spec.ts`(신규) · `plan/in-progress/trigger-config-lost-update.md`
이다. 나머지 변경 파일(~93개)은 과거 라운드의 `review/code/**`·`review/consistency/**`
산출물이며 그 자체가 리뷰 보고서라 이번 문서화 관점의 대상이 아니다.

직전 라운드(`review/code/2026/09/14/21_18_21`)가 지적한 2건의 WARNING을 최신 커밋
(`bf2becd0c`)에서 실제로 어떻게 고쳤는지 코드를 직접 열어 대조했다.

## 발견사항

발견 없음(CRITICAL/WARNING 급 문서화 결함 없음).

### 직전 라운드 WARNING 2건 — 수정 확인

- **고아(orphaned) JSDoc**: `hooks.service.ts` 에서 `touchLastTriggeredAt` 을 끼워 넣으며
  `markChatChannelRateLimited` 를 설명하던 CCH-NF-03 docblock 이 엉뚱한 함수 위로 밀려났던
  문제 — `bf2becd0c` 에서 CCH-NF-03 docblock 을 `markChatChannelRateLimited`(현재
  `hooks.service.ts:981-984`) 바로 위로 되돌리고, `touchLastTriggeredAt` 용 JSDoc
  (`:957-972`)은 그 함수 바로 위에만 남도록 정정된 것을 직접 Read 로 확인했다.
- **CHANGELOG "대기 상한은 없다"가 삭제 경로의 5초 예외를 언급하지 않던 문제** —
  `CHANGELOG.md` 가 "**대기 상한은 없다 — 단 삭제는 예외다.**" 로 수정되고, 바로 다음
  문단에 "삭제(`DELETE /api/triggers/:id`)만 5초 상한을 둔다" 및 그 사유(되돌릴 수 없는
  teardown 이 락 이전에 끝남 → 무한 대기 시 반쯤 삭제된 상태가 굳음)가 추가된 것을 확인했다.
  `trigger-config-lock.ts` 의 `TRIGGER_DELETE_LOCK_TIMEOUT_MS = 5_000` 과 일치한다.

### 교차 검증한 그 외 문서화 항목 (문제 없음)

- `trigger-config-lock.ts` 의 `rewriteTriggerConfigLocked`/`acquireTriggerConfigLock` JSDoc —
  스프레드 순서·`!fresh` 처리·창 1~4 배선·Cafe24 advisory-lock 기각 선례 인용·
  `SET LOCAL lock_timeout` 의 실제 적용 범위(advisory lock 뿐 아니라 같은 트랜잭션의 `DELETE`
  행 잠금·CASCADE 연쇄까지)가 전부 실제 코드와 일치한다.
- `triggers.service.ts` `assertTriggerFound`/`throwTriggerNotFound` 분리 — JSDoc 이 주장하는
  "`RESOURCE_NOT_FOUND` 리터럴이 사는 유일한 자리"를 grep 으로 재확인(정확히 1곳).
- `extractInboundSigningRef` JSDoc 의 "세 자리 복제" 주장 — 정의 자리를 뺀 인라인 캐스트
  `{ chatChannel?: { inboundSigningRef?: string } }` grep 결과 0건, 즉 세 호출부가 전부
  이 함수로 통합돼 있음을 확인했다(과거의 복제가 실제로 해소됨).
- `endpoint-path-conflict-wrap-guard.ts` 의 `TRIGGER_ENTITY`·콜백 경계 확장 주석은 실제 조건식
  (`ts.isFunctionLike(cur) && !ts.isCallExpression(cur.parent)`, `first.getText(sf) ===
  TRIGGER_ENTITY`)과 정확히 대응한다.
- `bf2becd0c` 가 추가한 `remove() 실패는 삼키지 않고 던진다` 테스트의 docstring
  ("삭제됨 감사도 남기지 않는다")은 실제 구현 순서(트랜잭션 `.catch` 에서 `throw err` →
  이후 `recordAudit` 호출)와 일치하고, 단언 문자열 `'trigger.deleted'` 도
  `AUDIT_ACTIONS.TRIGGER_DELETED` 의 실제 값과 일치한다(기존 테스트 `:2904` 대조).
- `trigger-transaction-mock.ts` 의 "이 수는 시점 의존이다 … 이 파일을 고칠 땐 다시 재라"
  각주는 스스로 낡을 수 있음을 미리 인정해 둔 좋은 관행이고, 최신 커밋에서도 유지된다.
- README·API 문서·설정 문서: 컨트롤러·DTO·라우트·환경변수 변경 없음(순수 서비스/영속성
  계층 동시성 수정) — 갱신 대상 없음. 새 상수(`TRIGGER_CONFIG_LOCK_PREFIX`,
  `TRIGGER_DELETE_LOCK_TIMEOUT_MS`)는 코드 내부 상수이지 환경변수가 아니다.
- `plan/in-progress/trigger-config-lost-update.md` — 라운드별 리뷰 처분·뮤테이션 실측·
  자기 서술 반증(예: "창이 셋이 아니라 넷", "뮤턴트 두 방향 RED 확인했다"는 문장이 거짓이었음)을
  모두 투명하게 남기고 정정 이력을 취소선으로 보존하는 등, 이 저장소의 plan 관례를 모범적으로
  따른다.

### 참고 (블로킹 아님, 이미 planner 범위로 트래킹됨)

- `spec/5-system/15-chat-channel.md` 의 `code:` glob 이 신규 `trigger-config-lock.ts` /
  `trigger-config-lost-update.e2e-spec.ts` 를 잡지 못하는 추적성 갭은 1라운드부터 지적돼
  왔고, `spec/` 이 developer 쓰기 권한 밖이라 plan §D "planner 범위" 표에 정확히 등재된 채
  남아 있다 — 새로 발견한 것이 아니라 기존 트래킹 상태를 재확인한 것.
- `plan/` 체크리스트 하단 3개 항목(트래커 각주·`run-test-all.sh`·`/ai-review`+`--impl-done`)이
  아직 `[ ]` 인 것은 결함이 아니라, plan 이 스스로 선언한 정지 규칙("마지막 라운드가
  `codebase/**` 수정 0 으로 끝날 것")이 바로 이번 라운드의 결과에 달려 있기 때문이다 — 이
  라운드가 Critical 0·WARNING 0 으로 수렴하면 종결 커밋에서 갱신될 항목이다.

## 요약

이 PR 의 문서화 수준은 이 저장소 평균을 크게 웃돈다. 직전 라운드(21_18_21)가 지적한 2건의
실제 문서-코드 불일치(고아 JSDoc, CHANGELOG의 삭제-타임아웃 누락)는 최신 커밋 `bf2becd0c`
에서 정확히 그 자리에 코드를 열어 확인한 결과 모두 해소됐다. JSDoc(`trigger-config-lock.ts`,
`triggers.service.ts`, `chat-channel-binder.service.ts`)은 설계 근거·기각된 대안(Cafe24
advisory lock)·라운드별 리뷰 처분·뮤테이션 실측을 코드 자체에 촘촘히 남기고 있고, 표본
검증한 모든 서술(리터럴 유일성, 복제 해소, 콜백 경계 조건, 테스트 docstring)이 실제 코드와
정확히 일치했다. CHANGELOG는 동작 변경(대기 상한·삭제 예외·응답 신선도 개선)을 사용자
관점에서 정확히 서술한다. README·API 문서·설정 문서 갱신 대상은 없다(컨트롤러·DTO·라우트·
환경변수 무변경). 남아 있는 항목(spec glob 추적성 갭, plan 체크리스트 잔여)은 모두 이미
올바르게 planner 범위 또는 라운드 종결 시점으로 트래킹되어 있어 이번 changeset 을 막을
사유가 아니다.

## 위험도

NONE
