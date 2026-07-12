# Rationale 연속성 검토 결과

## 검토 범위 확인

`origin/main` 대비 실제 diff(`git diff origin/main --stat`)를 확인한 결과, `spec/7-channel-web-chat/**` 문서는
**이번 diff 에서 전혀 변경되지 않았다**. 변경분은 다음으로 한정된다:

- `codebase/channel-web-chat/src/lib/widget-state.ts` — `mergeMessages` 함수의 **JSDoc 주석만** 정정
  (`git diff` 확인 결과 함수 본문 `if (snapshot.length >= local.length) return snapshot; return local;` 은 무변경).
  구 주석("합치되... 중복(동일 role+text 연속)을 회피")이 실제 동작(snapshot vs local 중 하나를 통째로 select,
  interleave/dedup 아님)을 부정확하게 서술하던 것을 `/ai-review` WARNING #2 로 적발 → 정정.
- `codebase/channel-web-chat/src/lib/widget-state.test.ts` / `.../use-widget-eager-start.test.ts` — 기존 동작을
  characterize 하는 신규 unit/통합 테스트만 추가(제품 코드 로직 변경 없음).
- `plan/in-progress/webchat-multiturn-restore-test.md` — 위 test-only 작업의 plan 문서.
- `review/code/2026/07/12/01_10_15/**` — 선행 `/ai-review` 산출물.

즉 본 PR 은 **신규 설계 결정이나 spec 변경을 포함하지 않는 순수 test-only PR**이며, target spec 문서(`spec/7-channel-web-chat/**`)
자체도 이번 diff 로 수정되지 않았다.

## 발견사항

없음.

- **기각된 대안의 재도입**: 해당 없음. 코드/spec 모두 결정 변경이 없다.
- **합의된 원칙 위반**: `mergeMessages` 의 정정된 JSDoc 은 `1-widget-app.md §2` "메시지 리스트" 행의
  "1차 소스 = `waiting_for_input.conversationThread.turns` snapshot + 로컬 라이브 dispatch" 서술과 상충하지 않는다 —
  spec 은 병합 알고리즘의 세부(interleave 여부)까지 규정하지 않으므로, "snapshot 을 신뢰 가능한 정본으로 우선하되
  로컬이 더 앞서 있으면(streaming 중 더 최신) 로컬을 보존한다"는 length-기반 select 정책은 그 상위 서술의 정상적인
  세부 구현이다. `1-widget-app.md §3.1` 의 "새로고침 복원 시에도 이 매핑으로 과거 user/assistant 구분을 유지한다"
  요건도 신규 테스트(`role`/`text`/순서 보존, `[user-input]` marker strip)로 오히려 강화 검증됐다.
  `widget-state.test.ts` 신규 테스트 상단 주석은 `spec/7-channel-web-chat/1-widget-app §2·§3` 를 SoT 로 명시 참조한다.
- **결정의 무근거 번복**: 없음 — 로직 변경 자체가 없다(주석만 실제 동작에 맞게 정정). 이는 과거 "복원 presentation 렌더러
  무시" 오기재를 정정한 R8 사례(`1-widget-app.md §R8` "한때 기록됐던... 제약은 사실이 아니었다")와 같은 패턴 —
  검증 없이 남아있던 부정확한 서술을 실측에 맞게 바로잡는 것으로, 결정 번복이 아니라 **최초 정직화**다.
- **암묵적 가정 충돌**: 없음. `WAITING` 액션의 `threadMessages` 처리(§3.1 durable snapshot 복원, EIA `getStatus`
  invariant)와 정합하며, EIA/§3.1 이 규정하는 durable thread 우선 원칙(길이 동률 시 snapshot 우선 — 신규 테스트가
  `>=` 경계를 명시적으로 고정)도 그대로 보존된다.

## 요약

이번 diff 는 `spec/7-channel-web-chat` 문서를 변경하지 않는 test-only PR 이며, 유일한 제품 코드 변경은 기존 로직을
그대로 둔 채 부정확했던 JSDoc 주석을 실제 동작(snapshot/local length-기반 select)에 맞게 정정한 것이다. 신규 테스트는
`1-widget-app.md §2·§3·§3.1` 이 규정하는 복원 시 role/text/순서 보존 요건을 SoT 로 명시 참조하며 그 요건을 characterize
할 뿐, 어떤 기각된 대안을 재도입하거나 Rationale 에 명시된 원칙(§R6 eager-start, §R8 presentation 복원 범위, §R9
single-flight coalesce 등)과 충돌하지 않는다. Rationale 연속성 관점에서 우려할 사항이 없다.

## 위험도

NONE
