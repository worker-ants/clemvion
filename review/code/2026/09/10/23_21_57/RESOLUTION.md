# RESOLUTION — `review/code/2026/09/10/23_21_57`

**CRITICAL 1 / WARNING 6 / INFO 11** → 조치 완료. reviewer 14명 전원 산출물 확보,
`forced_missing` 0 · `unfinished` 0.

> **`resolution-applier` 위임 대신 main 이 직접 처리했다** (developer SKILL §REVIEW WORKFLOW 5
> "수동 처리"). 이 CRITICAL 의 fix 는 *"한 칸 넓게 고치면 프로덕션이 깨지는"* 축에 정확히
> 놓여 있다 — `inboundSigningRef` 를 `botTokenRef` 처럼 **무조건** 실으면 legacy 트리거의
> fail-open 이 fail-closed 로 뒤집힌다. 그 경계는 이 세션이 planner 턴 두 개를 태워 만든
> 맥락(telegram carve-out) 위에 있어서, 컨텍스트를 가진 쪽이 고치는 편이 안전하다고 판단했다.

## 조치 항목

| # | 등급 | 사안 | 처분 | commit |
|---|---|---|---|---|
| 1 | **CRITICAL** | slack/discord PATCH 후 `inboundSigningRef` 가 config 에서 사라져 인입 서명 검증이 **fail-open** | **수정 + 캐너리 4건** | `771801fca` |
| 2 | WARNING | `assertChatChannelAlreadySetUp` 이 provider 전환을 안 막는다 | **수정** — 전환 시 400 (`details.field='provider'`) | `771801fca` |
| 3 | WARNING | `botToken`/`inboundSigningPlaintext` 의 `null`·`''` 변형이 미검증 | **테스트 3건 추가** — 서비스 가드가 실제로 잡는 것을 확인(둘 다 즉시 GREEN — 방어선은 있었고 **관측만 없었다**) | `771801fca` |
| 4 | WARNING | `assertChatChannelInputSafe` JSDoc 이 `mode` 분기를 반영 못 함 ("필수" ↔ 실제 "금지") | **수정** — `mode==='update'` 절 추가 | `771801fca` |
| 5 | WARNING | 컨트롤러 `@ApiBadRequestResponse` 가 신규 400 사유 미반영 | **수정** — 3사유(비밀 필드 · 최초 setup · provider 전환) 명시 | `771801fca` |
| 6 | WARNING | `type` 선언 2개가 import 블록 한가운데 | **수정** — import 뒤로 이동 | `771801fca` |
| 7 | WARNING (SPEC-DRIFT) | R-CC-21 산문이 telegram carve-out 을 포괄 못 함 | **이미 닫혀 있다 — 오탐**. 아래 §오탐 참조 | — |
| 8–12 | INFO | `update()` 길이 · 캐스팅 중복 · 메시지 중복 · fixture 중복 · degraded 경계 테스트 | **미조치** — 전부 "이 PR 신규 아님/비긴급" 으로 reviewer 자신이 분류 | — |
| 13 | INFO | 신설 에러 메시지 어투 혼용 | **수정** — 해요체로 통일 (DTO 쪽 동일 문구도 함께) | `771801fca` |
| 14 | INFO | plan 의 D-2 줄 번호 인용이 stale | **수정** — `// [쓰기 ①②③]` 앵커 표기로 교체 | `771801fca` |
| 15–17 | INFO | 의도된 breaking change · 관측성 개선 · `details.field` 중첩 경로 | **조치 불요/이미 등재** | — |
| 18 | 절차 | 리뷰 중 plan 파일이 외부에서 갱신되는 것을 두 reviewer 가 관측 | **설명 가능** — main 이 TEST WORKFLOW 통과를 그 시각에 기록했다. 리뷰 대상 코드가 아니라 plan 체크박스다 | — |

## CRITICAL #1 — 무엇이 틀렸고 왜 놓쳤나

`mergeExternalConfig` 는 `config.chatChannel` 을 **통째로 교체**한다. `botTokenRef` 는
`buildSecretRef(trigger.id)` 로 매번 재유도돼 무조건 다시 실리지만, `inboundSigningRef` 는
*"이번 호출에서 값을 새로 썼을 때만"* 실리게 짜여 있었다. **D-2 가 그 쓰기를 게이팅하자
slack/discord PATCH 에서 그 조건이 구조적으로 항상 거짓**이 됐다.

그리고 `ChatChannelInboundAuthenticator` 는 세 provider 전부
`if (!config.inboundSigningRef) return;` — **fail-open** 이다(실측). 즉 이 PR 이 고치려던 바로
그 카드 편집 PATCH 한 번으로 그 트리거의 인입 웹훅이 **서명 없이 통과**하게 된다.

**왜 놓쳤나**: D-3 캐너리를 `botTokenRef` **하나만** 걸었다. 자매 ref 는 안 봤다 —
이 세션이 이미 네 번 반복한 *"한 칸 좁게 잡는다"* 의 다섯 번째다. 이번엔 **축이 대칭인데
한쪽만 고정**한 형태였다.

**고칠 때도 한 번 더 좁혔다**: 처음 fix 는 `trigger.config` 에서 옛 ref 를 읽었는데, 그
시점의 `trigger` 는 **이미 병합된 `saved`** 라 옛 ref 가 없다. 테스트 3건이 여전히 RED 로
그것을 잡았고, 호출자가 **병합 전에** 집어 인자로 넘기도록 바꿨다.

**넓게 고치지 않은 이유**: `botTokenRef` 처럼 무조건 싣지 않았다. 이 ref 의 존재는
*"signing 비밀이 저장돼 있다"* 는 신호이기도 해서, 행이 없는 legacy 트리거에 붙이면
**fail-open 을 fail-closed 로 바꾸는 별개의 동작 변경**이 된다. `"새로 썼거나 · 이미
있었으면 보존"` 으로 좁혔고 그 근거를 코드 주석에 남겼다.

**뮤테이션 검증**: 보존 항(`|| Boolean(preservedInboundSigningRef)`)을 제거한 뮤턴트를
주입 → `tsc` 0오류(유효) → 캐너리 **RED 3건**. `cp` 로 원복 후 205 GREEN.

## 오탐 — WARNING #7

*"R-CC-21 산문이 telegram carve-out 을 포괄 못 한다"* 는 **이미 닫혀 있다.** 이 브랜치는
`c0f2a885c`(planner PR #1313) 위에 rebase 돼 있고, 그 커밋이 §5.4.1.1 에 telegram 행을
신설하고 R-CC-21 첫 문단에 두 축 한정 caveat 를 넣었다 — 실측으로 둘 다 존재 확인(각 1건).
reviewer 가 plan 체크리스트의 서술을 보고 미해소로 읽은 것으로 보인다. **조치 불요.**

## TEST 결과

| 단계 | 결과 |
|---|---|
| lint | **PASS** (불필요 타입 단언 2건을 제거해 통과 — `ChatChannelInput` 도입으로 캐스팅이 redundant 해졌다) |
| unit | **PASS** — backend jest **9,544** · frontend vitest **6,378** · packages 48+451, triggers 모듈 205 |
| build | **PASS** |
| e2e | **통과** — 305, `trigger-workflow-ref.e2e-spec.ts` PASS |

부수: **타입체크 ratchet 2종** 재실행 — backend 197건/36파일 · frontend 52건/15파일,
둘 다 baseline 일치.

## 보류·후속 항목

INFO #8–#12 는 reviewer 자신이 *"이 PR 신규 아님 / 비긴급"* 으로 분류했고 전부 **동작
결함이 아니다**(구조·중복·문서 층). developer SKILL §ISSUE FIX 정책의 수렴 예외
(a)(b)(c) 에 해당한다 — 고치면 게이트 freshness 가 재무장돼 라운드가 한 번 더 돌고,
그 라운드가 또 같은 성격의 잔여를 낼 형태다. `plan/in-progress/impl-chat-channel-patch-token.md`
에 등재했다.
