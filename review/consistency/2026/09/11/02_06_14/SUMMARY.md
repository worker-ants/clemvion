# Consistency Check 통합 보고서

**BLOCK: NO** — 5개 checker 전원 CRITICAL 0건. 최고 등급은 WARNING 2건(전부 기존 라운드부터 지속 추적 중인 항목).

## 전체 위험도
**LOW** — cross_spec·rationale_continuity 는 LOW(각 WARNING 1건 포함), convention_compliance·plan_coherence·naming_collision 은 NONE. 신규 CRITICAL/WARNING 없음, 전부 5차(cross_spec/rationale)~9차(naming_collision) 재검증에서 지속 확인된 항목.

## Critical 위배 (BLOCK 사유)

(없음)

## planner 인계 (권한 밖 Critical)

(없음) — 이번 라운드 Critical 자체가 없어 인계 대상 없음. 다만 아래 경고 항목들의 근본 조치(spec 본문 갱신)는 developer 권한 밖이라 planner 턴을 요구하며, 이미 `plan/in-progress/spec-draft-nullable-notation-followups.md` 트래커에 등재돼 있음(§권장 조치사항 참고).

| # | 권한 밖인 이유 | 인계 대상 | planner 가 고칠 것 (파일·섹션) | 추적 위치 |
|---|---------------|----------|------------------------------|----------|

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | cross_spec | `details.field` 실제 표현(값 형태에 따라 중첩/flat 분기) vs SoT spec 문면(flat 확정 또는 미확정) 불일치 — 5차 연속 지속, 신규 아님 | `codebase/backend/src/modules/triggers/dto/chat-channel-config.dto.ts`(JSDoc), `triggers.controller.ts`(`@ApiBadRequestResponse`), `triggers.service.ts`(`assertPatchCarriesNoSecrets`·`assertChatChannelAlreadySetUp`) | `spec/5-system/15-chat-channel.md` §5.4.1 표, `spec/2-navigation/2-trigger-list.md` L119-120, L176, R-12 | planner 턴에서 실측 표(값 존재 시 중첩+배열 / null·빈문자열 시 flat+object)로 두 spec 파일 동시 갱신. 이미 `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 등재, 직전 4회 라운드도 동일 판정 |
| 2 | rationale_continuity | 동시 PATCH 레이스가 R-CC-21 이 막 닫은 fail-open invariant 를 다른 경로로 재발시킬 수 있음 | `triggers.service.ts` `update()` → `setupChatChannel()` — 요청 시작 시점 `previousInboundSigningRef` 스냅샷을 트랜잭션/낙관적 잠금 없이 신뢰 | `spec/5-system/15-chat-channel.md` R-CC-21 ("PATCH 는 비밀을 쓰지 않는다 / inbound signing ref 소실 시 서명 검증 fail-open 금지") | 별도 fix PR 필요(advisory lock / `SELECT … FOR UPDATE` / 낙관적 버전 비교). 이 PR 스코프 밖이며 diff 작성자가 이미 `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 미해결 항목으로 등재함(`/ai-review review/code/2026/09/10/23_55_23` concurrency W1 인용) |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | cross_spec, rationale_continuity (중복 통합) | 신규 400 분기 2종(chatChannel 최초 부착 차단 `details.field='chatChannel'`, provider 전환 차단 `details.field='provider'`)이 SoT 표에 미등재 | `triggers.service.ts` `assertChatChannelAlreadySetUp`; `spec/5-system/15-chat-channel.md` §5.4.1 표, `spec/2-navigation/2-trigger-list.md` L118/R-12 | §5.4.1 표에 두 행 추가, R-12 에 400 사유 cross-link 추가 — 이미 트래커 등재 |
| 2 | cross_spec | `SecretResolver.store()` → `rotate()` spec 문면 drift — 코드 측 3곳은 이번 라운드(`84a6aeaa8`)에서 해소, spec 측 9곳 잔존 | `spec/5-system/15-chat-channel.md:200,201,373,390`, `spec/conventions/chat-channel-adapter.md:354,359`, `spec/4-nodes/7-trigger/providers/telegram.md:58,219`, `spec/4-nodes/7-trigger/providers/slack.md:278` | planner 턴에서 9곳 일괄 `rotate()`(UPSERT)로 정정 — 이미 스케줄된 항목 |
| 3 | convention_compliance | `ChatChannelUpdateConfigDto` — "Patch 금지·Update 채택" 상위 규칙은 준수하지만, `Update` 가 접두어가 아니라 클래스명 중간에 위치(저장소 기존 Update DTO 18/18 은 접두어) — 명문 규칙 부재라 위반은 아님 | `chat-channel-config.dto.ts:378` | planner가 백로그(§Update-접두 규약화) 처리 시 위치 축까지 명문화하거나 "부모 DTO 명 보존" 예외를 명시 |
| 4 | convention_compliance | `swagger.md` 줄번호 인용 드리프트(코드 주석 315행 인용, 실제 317행) — 직전 라운드부터 미해소 지속 | `chat-channel-config.dto.ts:365` | 급하지 않음. 다음 편집 시 줄번호 대신 절 이름(`§3`)으로 교체 |
| 5 | plan_coherence | spec `details.field`/`store()` 관련 문구가 "미확정"으로 정확히 유지됨 — 이 PR 의 실측과 모순 없음(조기 확정 없음) | `spec/5-system/15-chat-channel.md:200,201,373,375,390` | 조치 불요. planner 턴에서 실측 표를 그대로 반영하면 종결 |
| 6 | plan_coherence | `pending_plans` frontmatter 참조 무결성 유효 — 과거 dangling 사례는 이미 해소됨 | `spec/5-system/15-chat-channel.md:19-22` | 조치 불요(harness 가드 부재는 별도 백로그, 이 PR 무관) |
| 7 | plan_coherence | 이 PR 이 신설한 후속 항목 5건(동시성 lost-update·함수 비대·DTO 검증 공백 등)이 다른 in-progress plan 과 중복·충돌 없음 | `triggers.service.ts`, `chat-channel-config.dto.ts` | 조치 불요 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | LOW | `details.field` 표기 불일치 WARNING(5차 지속) + 신규 400분기 미등재·`store()` spec drift 9곳 INFO. 코드 측 `store()`→`rotate()` 주석 drift 는 이번 라운드에 해소 |
| rationale_continuity | LOW | 동시 PATCH 레이스로 인한 fail-open 재발 가능성 WARNING(스코프 밖, 이미 추적) — R-CC-10/R-CC-21 기각 대안 재도입 없음 확인 |
| convention_compliance | NONE | CRITICAL/WARNING 0건. `rotate()` 채택·에러코드·`writeOnly`·`OmitType`·i18n 등 전 축 준수 재확인. INFO 2건(DTO 명명 위치, 줄번호 드리프트) |
| plan_coherence | NONE | spec 조기 확정 없음, frontmatter 무결성 유효, 신규 후속 항목 5건 타 plan 과 무충돌 |
| naming_collision | NONE | 9번째 독립 재검증. 신규 export 심볼은 `ChatChannelUpdateConfigDto` 1건뿐이며 충돌 없음. ENV/DB컬럼/엔드포인트/파일경로 신규 0건 |

## 권장 조치사항
1. planner 턴에서 `plan/in-progress/spec-draft-nullable-notation-followups.md` 트래커를 근거로 `spec/5-system/15-chat-channel.md` §5.4.1/§5.4.1.1 과 `spec/2-navigation/2-trigger-list.md` 를 갱신: (a) `details.field` 표기를 실측된 값-형태별 분기(중첩+배열 / flat+object)로 확정, (b) 신규 400 분기 2종(`chatChannel`·`provider`) 표에 추가, (c) `SecretResolver.store()` 잔존 9곳을 `rotate()`(UPSERT)로 일괄 정정.
2. 동시 PATCH 레이스(WARNING #2) 해소를 위한 별도 fix PR — advisory lock 또는 `SELECT … FOR UPDATE` 또는 `config` 낙관적 버전 비교. 이번 PR 병합을 막을 필요는 없으나 우선순위 높은 후속으로 plan 에 유지.
3. (경미) `ChatChannelUpdateConfigDto` 명명 위치 규약화 여부와 `swagger.md` 줄번호 인용 drift 정정은 다음 관련 편집 시 함께 처리.

---

## 호출자(main) 주석 — INFO 4 는 오탐이다

> 위 본문은 `consistency-summary` 가 쓴 정본이다. 아래만 호출자가 덧붙인다.

**INFO 4 (`swagger.md` 줄번호 드리프트, "코드가 315 인용 / 실제 317")는 오탐이다.** 두 라운드
연속 같은 주장이 나와 두 번 다 실측했다:

```
315| **JSDoc 은 공개 OpenAPI 로 나간다 — 내부 서사를 담지 않는다** (2026-09-05 규약화):
316|
317| 플러그인이 `introspectComments` 로 JSDoc 을 `description` 에 그대로 싣는다(문서 상단).
```

내 주석이 인용하는 것은 **규약 제목 줄(315)** 이고 317 은 그 다음 문단이다. `grep -n` 도
315 를 준다. **코드를 고치지 않는다** — 고치면 틀린 값으로 바꾸는 것이고, 이 라운드가
`codebase/**` 수정 0건으로 수렴한 것도 깨진다.

다만 checker 가 두 번 같은 지적을 한 것은 **줄 번호 인용 자체가 읽는 쪽에 모호하다**는
신호다. 이 저장소 메모리도 *"편집 대상 파일은 줄 대신 앵커로"* 라고 적는다 —
`swagger.md` 는 이 PR 이 편집하지 않으므로 그 규칙의 대상은 아니지만, **다음에 그 주석을
건드릴 때 `§3` 절 참조로 바꾸는 것**을 후속으로 남긴다(트래커의 `swagger.md` 항목에 병기).

**INFO 3**(`Update` 가 접두어가 아니라 중간에 위치)도 checker 스스로 *"명문 규칙 부재라
위반은 아님"* 이라 적었다. 이름을 `ChatChannelUpdateConfigDto` 로 둔 이유는 형제 nested DTO
(`ChatChannelUiMappingDto` 등)가 쓰는 **로컬 `ChatChannel<Role>Dto` 패턴**에 맞춘 것이고,
`naming_collision` 이 세 라운드에 걸쳐 그 판단을 정합으로 확인했다. 규약화 여부는
트래커의 `swagger.md §1 Update 접두` 항목에서 함께 결정한다.
