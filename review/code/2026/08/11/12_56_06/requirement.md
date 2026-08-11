# 요구사항(Requirement) 리뷰 — `12_56_06` (재확인 라운드)

## 확인 범위 (호출자 지시)

직전 라운드(`12_37_14`)에서 낸 WARNING — "정정문의 '앞의 둘'이라는 위치 수식어가 실제 지목 대상(나열
1·3번째)과 어긋난다" — 이 커밋 `f5d485a52`로 수정됐는지, 그리고 그 사이 새 회귀(mutation gap 대응
신규 테스트)가 유효한지를 확인한다.

## 1. WARNING 수정 검증 — 두 위치 모두 정확한가 / 같은 오류가 다른 자리에 남았는가

- `codebase/backend/src/modules/audit-logs/audit-action.const.ts:89-91`(현재 파일 기준, 정정 후):
  `// *(주의 — \`notification_secret_rotated\`·\`interaction_token_revoked\` 만 응답에 새 자격증명을 / 1회 평문 반환한다. \`chat_channel_bot_token_rotated\` 는 새 토큰이 **호출자 입력**이라 응답에 / 안 실린다. ...)*`
  — "앞의 둘"이 사라지고 두 액션명을 직접 나열한다. 사실관계(`notification_secret_rotated`·`interaction_token_revoked`만 평문 반환)는 코드(`triggers.service.ts:932-935`, `:980`)와 일치.
- `spec/5-system/1-auth.md:431`(§4.1 "트리거 (시크릿·토큰)" 행): `` `notification_secret_rotated`·`interaction_token_revoked` 는 응답에 새 자격증명을 1회 평문 반환하고, `chat_channel_bot_token_rotated` 는 새 토큰이 **호출자 입력**이라 반환하지 않는다. `` — 동일하게 액션명 직접 표기로 교체됨.
- **두 곳 모두 정정이 정확하다.**
- 저장소 전수 재검색(`grep -rn "앞의 둘\|앞 두\|처음 둘\|앞의 두"` — `.md`/`.ts` 전체) 결과, 이 트리오(`notification_secret_rotated`/`chat_channel_bot_token_rotated`/`interaction_token_revoked`)와 관련된 "앞의 둘" 잔존 표현은 `CHANGELOG.md:67` 한 곳뿐이다.
  - `CHANGELOG.md:67`: `` **`revoked` 는 `rotated` 와 다른 동사다.** 앞의 둘은 24h grace 로 구·신이 공존하지만 per_trigger 토큰 재발급은 이전 토큰을 즉시 무효화한다. `` — 이 문장은 바로 위 엔드포인트 표(`:57-60`, 1행=`notification_secret_rotated`, 2행=`chat_channel_bot_token_rotated`, 3행=`interaction_token_revoked`)의 **나열 순서 1·2번째**(둘 다 `rotated`+24h grace)를 가리키고, `revoked`(3번째)와 대비시키는 문장이다. 지목 대상과 어순이 실제로 일치 — **호출자 지시대로 오탐이며 참**이다. 조치 불필요.
- 그 외 grep 히트는 전부 이 PR과 무관한 과거 리뷰 문서(`review/code/2026/07/**`, `review/consistency/**`) 또는 다른 소재(예: `plan/complete/ci-required-check-skip-jobs.md`, `use-widget-eager-start.test.ts`)의 "앞의 둘/앞 두" 사용으로, 이번 트리오와 무관하다.

## 2. spec 6곳 ↔ 코드 line-level 일치 재확인

| spec 문서 | 확인한 위치 | 코드와의 일치 |
|---|---|---|
| `1-auth.md §4.1` | `:431` | 액션명 3종·기록 시점·평문 반환 여부 모두 `triggers.service.ts:928,976,1116`/응답 shape과 일치 |
| `conventions/audit-actions.md §3` | `:58`(레지스트리 행), `:78`(`revoked` 단독 Rationale) | `revoked`가 grace 없음 이유·"나머지 둘"이 24h grace라는 서술이 코드(`revokePerTriggerToken`에 유예 컬럼 없음, `rotateNotificationSecret`/`rotateBotToken`은 `*V2` dual-accept)와 일치. "앞의" 류 잔존 표현 0건(전수 grep) |
| `data-flow/1-audit.md §1.1` | `:78-80`(Writer 표 3행) | 액션명·리소스타입·grace 유무 서술이 `audit-action.const.ts`·서비스 코드와 문자 그대로 일치 |
| `15-chat-channel.md` | `:378` | `chat_channel_bot_token_rotated` 언더스코어 표기로 정정 완료, PATCH 차단 근거 서술도 일치 |
| `2-navigation/2-trigger-list.md §3` | `:156-158`(엔드포인트 3행) | 각 엔드포인트별 감사 액션 cross-link 3개가 `audit-action.const.ts` 상수값과 문자 그대로 동일 |
| `14-external-interaction-api.md` | `:65`(EIA-NX-12), `:95`(EIA-AU-07) | "감사 기록 필수" + 대상 액션명이 코드·§4.1과 일치, revoked/rotated 구분 서술도 일치 |

6곳 모두 재확인 결과 line-level 불일치 없음. 새 CRITICAL 없음.

## 3. 신규 테스트가 "실패하면 감사를 남기지 않는다" 불변식을 실제로 표현하는가

`triggers.service.spec.ts:2434` `it('저장이 실패하면 감사를 남기지 않는다 (회전 2종 — 검증이 아니라
save 가 던진다)')`:

- `triggerRepo.save`를 `mockRejectedValue(new Error('db down'))`로 고정한 뒤, `rotateNotificationSecret`엔 `config: { notification: { url: 'https://x.example/hook' } }`(서비스의 `NOTIFICATION_NOT_CONFIGURED` 사전검증을 통과하는 유효한 config, `triggers.service.ts:910-920` 확인)를, `revokePerTriggerToken`엔 `config: { interaction: { tokenStrategy: 'per_trigger' } }`(서비스의 `NOT_PER_TRIGGER_STRATEGY` 사전검증을 통과, `:954-965` 확인)를 각각 주입해 **실패 지점이 사전 validation이 아니라 `save()` 자체**임을 보장한다.
- 실제 소스 순서(`:921-931`, `:966-979`)는 `save()` → `recordAudit()`이므로, `save()`가 거부되면 그 뒤의 `recordAudit`(`auditLogs.record`) 호출부에 도달하지 않는다 — 테스트가 검증하는 시나리오가 실제 실행 가능 경로와 부합.
- 커밋 메시지가 명시한 2회 독립 뮤테이션 실측(`둘 다 audit→save 순서 반전 → RED :2444`, `revokePerTriggerToken 만 반전 → RED :2453`)과 부합하는 구조 — 한 `it` 안에 두 어서션 블록이 순차 배치돼 있지만, 앞 블록이 실패해도(`await expect(...).rejects.toThrow(...)`가 즉시 throw) 어느 쪽이 원인이든 테스트 전체가 RED로 전이되므로 두 뮤턴트 모두 탐지된다. 뮤턴트가 `revokePerTriggerToken`에만 있는 경우 앞 블록(정상 코드)은 통과하고 뒤 블록에서 정확히 잡힌다.
- 기존 테스트(`:2410`, `rotateNotificationSecret 가 던지면 감사를 남기지 않는다`)는 사전 validation 예외만 검증해 `12_37_14`가 지적한 갭(검증-뒤·저장-앞 삽입 뮤턴트가 생존)을 못 막았는데, 신규 테스트가 실패 지점을 `save()`로 옮겨 그 갭을 닫는다. `revokePerTriggerToken`은 실패 테스트가 아예 없었던 것도 이번에 함께 채워졌다.
- `rotateBotToken`의 5→6 구간(감사 직전 구간) 뮤턴트 생존은 이번 커밋이 다루지 않았고(코드·테스트 diff에 `rotateBotToken` 관련 변경 없음, `describe('TriggersService.rotateBotToken — 6단계 오케스트레이션'` 블록 미변경 확인), `plan/in-progress/spec-sync-auth-gaps.md:77-82`에 INFO로 정확히 등재돼 있다 — 직전 라운드 판정과 모순 없음.

**결론: 신규 테스트는 spec이 약속한 불변식("실패하면 감사를 남기지 않는다")을 실제 실행 가능한 코드 경로에서 정확히 표현한다.**

## 4. 그 외 확인

- 신규 diff에 TODO/FIXME/HACK/XXX 없음(전수 grep 0건, report 파일 자체의 "0건" 서술 문구 제외).
- `plan/in-progress/spec-sync-auth-gaps.md`의 체크박스 상태(회전 3종 감사 `[x]` 완료, 잔여 갭 2건 `[ ]`)는 이번 커밋의 실제 처분(테스트 추가 1건, spec/코드 문구 정정 2건, 미해결 항목 그대로 유지)과 정확히 일치.

## 요약

직전 라운드 WARNING(정정문 "앞의 둘"의 위치-대상 불일치)은 `audit-action.const.ts:89-91`과
`spec/5-system/1-auth.md:431` 두 곳 모두 액션명을 직접 나열하는 형태로 정확히 수정됐고, 저장소
전수 재검색으로 같은 오류가 다른 자리에 남아 있지 않음을 확인했다(`CHANGELOG.md:67`의 "앞의 둘"은
호출자 지시대로 다른 — 참인 — 짝을 가리켜 오탐이다). spec 6곳(`1-auth §4.1`·`audit-actions.md
§3`·`data-flow/1-audit.md §1.1`·`15-chat-channel.md`·`2-trigger-list.md`·
`14-external-interaction-api.md`)은 재확인 결과 여전히 코드와 line-level로 일치한다. 신규 추가된
`저장이 실패하면 감사를 남기지 않는다 (회전 2종)` 테스트는 실패 주입점을 사전 validation에서
`save()` 자체로 옮겨 직전 라운드가 지적한 뮤테이션 갭(검증-뒤·저장-앞 삽입 뮤턴트 생존)을 실제로
닫으며, 두 config fixture 모두 사전 validation을 통과하도록 구성돼 있어 "실패하면 감사를 남기지
않는다"는 spec 불변식을 실행 가능한 경로에서 정확히 검증한다. `rotateBotToken`의 5→6 구간 잔여
뮤턴트 생존은 이번 커밋이 다루지 않았으나 plan에 INFO로 정확히 등재돼 있어 모순 없음. 새 CRITICAL
없음.

## 위험도

NONE

STATUS: OK
