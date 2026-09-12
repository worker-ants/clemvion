# 요구사항(Requirement) 충족 리뷰

## 발견사항

- **[INFO]** `[SPEC-DRIFT 후보 — 조사 결과 낮은 확신]` `spec/conventions/chat-channel-adapter.md` frontmatter `pending_plans` 주석이 "§1.1.2 의 `code` 선언 계약은 **미구현**이다 (adapter 3종 전부 developer 후속)" 라고 적고 있는데, 본 PR 이 정확히 그 3종(telegram·slack·discord) 전부에 `code` 부착을 구현했다.
  - 위치: `spec/conventions/chat-channel-adapter.md:7` (frontmatter `pending_plans` 주석), 대응 §1.1.2 "제거 조건"은 `spec/conventions/chat-channel-adapter.md:188-190`
  - 상세: §1.1.2 본문은 "v1 provider 3종이 모두 `code` 를 부착하면 [401/403 message fallback] 이 삭제 후보"라고 조건을 걸어 두었는데, 이 PR 이 그 조건을 충족시켰다. 그런데 frontmatter 의 "미구현" 서술과 `pending_plans` 목록은 그대로다. `review/consistency/2026/09/12/12_54_15/SUMMARY.md` WARNING #4 가 이미 "이 PR 완료가 다른 트래커 항목의 착수 신호를 충족시키는데 plan 에 미반영"이라는 인접 사실을 지적했으나, frontmatter 자체의 "미구현" 문구가 이제 부정확하다는 점은 별도로 언급되지 않았다.
  - 제안: 본 reviewer 는 spec 을 직접 고치지 않는다. `plan/in-progress/impl-setup-error-code.md` 체크리스트에 "§1.1.2 fallback 제거 판정 착수 신호 충족" cross-link 를 추가하는 기존 권고(WARNING #4)를 따르되, 후속 planner 턴에서 `chat-channel-adapter.md` frontmatter 의 "미구현" 서술도 함께 갱신 대상으로 포함시킬 것. 코드 자체는 spec §1.1.2 계약을 정확히 구현했으므로 코드 fix 대상은 아니다.

- **[INFO]** Slack 자격 증명 거부 5값(`invalid_auth`/`not_authed`/`account_inactive`/`token_revoked`/`token_expired`) 열거가 `spec/4-nodes/7-trigger/providers/slack.md §3.1` 의 개방형 서술("...")을 코드가 처음으로 확정한 것으로 보인다.
  - 위치: `codebase/backend/src/modules/chat-channel/providers/slack/slack.adapter.ts:54-60` (`SLACK_CREDENTIAL_REJECTED_ERRORS`)
  - 상세: 이미 `review/consistency/2026/09/12/12_54_15/rationale_continuity.md`(SUMMARY INFO #2)가 동일 항목을 지적했다. 코드 주석 자체가 "이 저장소 안에서 실측할 방법이 없다"고 명시하며 출처(Slack 공식 문서)를 밝히고 있어 근거는 충분하나, slack.md §3.1 의 5값 확정 반영은 아직 spec 에 없다.
  - 제안: 기존 INFO 그대로 후속 spec PR (planner 턴)으로 반영 — 중복 등재 방지 목적으로만 재확인.

## 검증 수행 내역

- `codebase/backend`: 변경 대상 6개 spec 파일 전체 실행 → `6 passed, 241 passed / 1 skipped(pre-existing, 무관)`.
- **뮤테이션 검증**: `chat-channel-input-rules.ts` 의 `translateSetupChannelError` 에서 `isCredentialRejectedError(err) ||` 판별을 제거해 401/403 message fallback 만 남기는 뮤테이션을 적용 → `chat-channel-input-rules.spec.ts` 2건 + `triggers.service.spec.ts` 1건이 정확히 RED (기대 400, 실측 502) — `code` 판별 경로가 vacuous 하지 않고 실제로 이 3개 단언에 걸려 있음을 실측 확인. 뮤테이션은 `cp` 로 원본을 scratch(`/private/tmp/.../scratchpad/mutation-backup/`)에 보관 후 `cp` 로 즉시 원복, `git status --short` 로 clean 확인 완료(잔여물 없음).
- `codebase/backend`: `tsc -p tsconfig.json --noEmit` / `tsc -p tsconfig.build.json --noEmit` 모두 이 diff 대상 파일(`chat-channel/**`, `triggers/**`) 관련 신규 에러 0건. (`telegram-message.renderer.spec.ts` 의 무관한 기존 타입 에러 1건은 이 PR 이전부터 존재 — `git diff origin/main...HEAD --stat` 로 미변경 확인.)
- `codebase/frontend`: `tsc -p tsconfig.json --noEmit` 에서 `backend-labels.ts` 관련 에러 0건.
- 응답 봉투 실측: `GlobalExceptionFilter`(`codebase/backend/src/common/filters/http-exception.filter.ts`)가 `HttpException` 분기에서 `resp.code`/`resp.message` 를 우선 사용하므로 `BadGatewayException({code:'CHAT_CHANNEL_SETUP_FAILED', message:...})` 가 표준 `{error:{code, message, requestId}}` 봉투로 정확히 래핑됨을 코드 경로로 확인 — plan 의 설계 판단 (e) "502 경로는 한 번도 지나간 적이 없다"는 우려가 실제로 안전함을 뒷받침.

## 요구사항 충족 평가

`§1.1.2`(자격 증명 거부는 `Error.code` 프로퍼티로 선언, 호출자는 message 파싱 안 함) 와 `§5.4`/`R-CC-23`(원인 기반 400/502 분류, provider 원문 비노출)의 계약을 세 provider adapter(discord/slack/telegram) + `chat-channel-input-rules.ts` 가 line-level 로 정확히 구현했다. Discord 의 `app.code`(원본 숫자)·`Error.code`(선언 문자열)·Node 시스템 `Error.code` 세 네임스페이스 충돌을 status 기반 판별 + 화이트리스트 정확 일치로 구조적으로 분리했고, 이는 spec §1.1.2 의 3중 네임스페이스 표·정확 일치 원칙과 일치한다. `translateSetupChannelError` 의 502 신설 경로는 실제 필터를 통해 정상 봉투로 응답됨을 확인했고, `details.reason`(provider 원문) 제거는 §7.5.2 보안 게이트 방향과 일치하며 원문은 `TriggersService.rotateBotToken` 의 `logger.warn` 으로만 남도록 배선됐다. 캐너리(옛 502 고정 테스트)를 의도적으로 RED→새 400 단언으로 뒤집은 것도 diff 에서 의도가 분명히 드러난다. 뮤테이션 검증으로 새 단언들이 실제로 `code` 판별 경로를 검사함을 실측했고 vacuous 테스트는 발견되지 않았다. TODO/FIXME/HACK/XXX 잔존 없음, 모든 분기에서 반환/throw 값이 명시적이며 에러 시나리오(401/403/404/other, non-Error throw, DNS 계열 시스템 `Error.code`)가 각각 테스트로 고정돼 있다. 유일한 잔여 사항은 spec 프론트매터(`pending_plans`/"미구현" 서술)가 이 PR 의 완료로 낡아진 것인데, 이는 코드 결함이 아니라 planner 영역의 후속 갱신 대상이며 이미 consistency-check 가 인접 사실을 WARNING 으로 잡아 두었다.

## 위험도

LOW — CRITICAL/WARNING 급 코드 결함 없음. 남은 항목은 spec 문서(frontmatter/§3.1 개방형 서술) 후속 갱신을 위한 INFO 2건뿐이며 모두 planner 턴 대상이고 이미 상당 부분 consistency-check 산출물에 반영돼 있다.
