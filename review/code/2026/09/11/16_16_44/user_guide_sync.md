# User Guide Sync 리뷰

## 매트릭스 적재

`.claude/config/doc-sync-matrix.json` (`rows[]`, 21행) 을 SoT 로 Read. `PROJECT.md` §변경 유형 → 갱신 위치 매핑 본문을 보조로 확인(두 문서는 `test_doc_sync_matrix.py` 가 1:1 로 묶어 두므로 행 집합 동일).

## 변경 파일 식별 (실측)

`git diff origin/main --stat` 으로 이번 브랜치(`3796c7308` → `HEAD=81d2a8c18`) 전체 changeset 47개를 확인했다. 실제 코드 파일은 3개뿐이고 전부 `codebase/backend/src/modules/triggers/` 아래다:

- `codebase/backend/src/modules/triggers/chat-channel-input-rules.ts` (신규 → 이번 라운드에서 +6줄 JSDoc 추가)
- `codebase/backend/src/modules/triggers/triggers.service.ts` (private 메서드 6개 삭제 → import 로 대체)
- `codebase/backend/src/modules/triggers/chat-channel-input-rules.spec.ts` (신규 단위 테스트, 이번 라운드에서 커버리지 공백 보강)

나머지 44개는 `plan/**`(2개, 체크리스트/트래커 갱신), `review/code/2026/09/11/{15_31_54,15_57_42}/**`(40개, 직전 두 리뷰 라운드 산출물), `review/consistency/2026/09/11/14_59_33/**`(7개) — 전부 마크다운/JSON 산출물이며 매트릭스가 감시하는 `codebase/frontend/src/content/docs/**` · `dict/{ko,en}` · `backend-labels.ts` · `locale.ts` 어느 것도 아니다.

## 트리거 매칭 분석 (이번 라운드 증분 = JSDoc 6줄 + 테스트 커버리지 보강)

이번 라운드(`81d2a8c18`)가 이전 두 라운드(`15_31_54`, `15_57_42`) 대비 추가한 유일한 코드 변경은 `chat-channel-input-rules.ts`의 `translateSetupChannelError` JSDoc 에 "discord verify_key 불일치는 502 로 떨어지는 알려진 예외" 를 문서화한 6줄 주석과, `chat-channel-input-rules.spec.ts` 의 신규 assertion(정규식 스왑 판별용 교차 케이스, 대칭 필드, 필드 부재 분기 등)이다. 둘 다:

- **새 errorCode/warningCode 발행 없음** — `BOT_TOKEN_INVALID`/`CHAT_CHANNEL_SETUP_FAILED` 는 기존 값이고 `error-codes.ts` 자체는 이번 changeset 에 없다(`git diff origin/main --stat -- codebase/backend/src/nodes/core/error-codes.ts` 무출력). 분기 판별식(`/\b(401|403)\b/`)도 코드 레벨에서 변경되지 않았다 — 이번 diff 는 **기존 동작(알려진 결함)을 문서화**했을 뿐 새 코드/메시지를 만들지 않았다.
- **provider 신규/변경 아님** — telegram/slack/discord 검증 로직 문자열은 무변경, 테스트만 추가.
- **노드/스키마/UI 문자열/인증 흐름/표현식 언어/실행-디버그 흐름** 어느 매트릭스 축과도 무관.

매트릭스 21행 전수 대입 결과는 이전 두 라운드와 동일하게 **미매칭**이다(new-node, node-schema-change, new-ui-string, integration-provider-change, new-userguide-section-dir, backend-api-change, new-warning-code, new-error-code, auth-session-flow-change, expression-language-change, run-debug-flow-change, spec-major-change, userguide-gui-flow-section 등 전부 확인).

## i18n / backend-labels 확인 (grep 실측)

```
grep -rln "assertInboundSigningPlaintextByProvider\|translateSetupChannelError\|BOT_TOKEN_INVALID\|CHAT_CHANNEL_SETUP_FAILED" \
  codebase/frontend/src/content/docs codebase/frontend/src/lib/i18n
```
→ 매치 없음. `BOT_TOKEN_INVALID`/`CHAT_CHANNEL_SETUP_FAILED` 는 controller 에러 응답 코드일 뿐 프론트엔드가 표시하는 `WARNING_KO`/`ERROR_KO` 매핑 대상이 아니며(이번 diff 가 만든 신규 코드도 아님), 관련 사용자 안내 문구가 있다면 이전 PR(#1314/#1317)에서 이미 다뤘어야 할 사안이지 이번 리팩터/문서화/테스트 강화 라운드의 스코프가 아니다.

## 참고 — 이 리뷰어 영역 밖의 관측 (스코프 아님, 참고용)

`plan/in-progress/impl-chat-channel-binder.md` 체크리스트가 이번 라운드에서 `run-test.sh` 통과 수치를 `9,568` → `9,580`(측정 시점 명시)으로 정정한 것, `spec-draft-nullable-notation-followups.md` 에 discord verify_key 502 캐너리·구조 정리 6건이 트래커 항목으로 등재된 것은 모두 `plan/**` 위생·`spec/4-nodes/7-trigger/providers/*.md` 축의 사안이며 본 리뷰어 대상(`codebase/frontend/src/content/docs/**` 유저 가이드 MDX·`dict/{ko,en}`·`backend-labels.ts`·`locale.ts`)과는 무관하다.

## 요약

매트릭스 21개 trigger 행 중 이번 changeset(코드 3파일 + plan 2파일 + 직전 라운드 리뷰/consistency 산출물 42파일)에 매칭되는 행은 **0개**다. 이번 라운드의 유일한 코드 증분은 기존 동작을 설명하는 JSDoc 6줄과 단위 테스트 커버리지 보강이며, 노드/스키마/UI 문자열/제공자/신규 섹션/인증 흐름/표현식 언어/실행-디버그 흐름/신규 warning·error 코드 중 어느 것도 신규 도입하거나 변경하지 않는다. 이전 두 라운드(`15_31_54`, `15_57_42`)의 동일 판정과 일치한다 — 유저 가이드 MDX·i18n dict·backend-labels.ts·locale.ts 동반 갱신 누락 없음. 해당 없음.

## 위험도

NONE
