# Consistency Check 통합 보고서

**BLOCK: YES** — Critical 발견이 있어 호출자가 차단해야 합니다.

## 전체 위험도
**HIGH** — npm scope 미확정 결정을 확정으로 선언한 직접 모순이 복수 checker 에서 CRITICAL 로 수렴. 나머지 WARNING 은 구현 갭이며 실행 가능한 수정 경로가 명확합니다.

---

## Critical 위배 (BLOCK 사유)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | Cross-Spec / Rationale Continuity / Naming Collision (공통) | npm 패키지명 `@workflow/web-chat` 을 확정으로 선언 — `eia-sdk-publish.md §결정 #3` 이 미결 상태이며 해당 섹션 자체가 plan 에 존재하지 않음. 기존 spec 3파일 · `package.json` 은 `@clemvion/web-chat`(잠정)을 유지해 동시에 두 이름이 SoT 역할 | `spec/7-channel-web-chat/2-sdk.md` 상단 callout · §2 · §Rationale R2 | `plan/in-progress/eia-sdk-publish.md` §사용자 결정 사항 #3 (미결); `spec/7-channel-web-chat/_product-overview.md` §2·§4; `spec/7-channel-web-chat/0-architecture.md` §4; `codebase/packages/web-chat-sdk/package.json` `name` 필드 | (a) `eia-sdk-publish.md` 에 §결정 사항 표를 실제 작성·확정한 뒤 target 표기 유지, 또는 (b) target 을 "잠정" 표기로 되돌리고 Rationale R2 "확정" 문구 제거. 어느 경로든 `_product-overview.md`·`0-architecture.md`·`package.json` 을 일괄 동기화해야 함 |

---

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | Cross-Spec / Naming Collision | `wc:command` 에 `show`/`hide` action 추가 — `1-widget-app.md` 상태기계에 수신 전이 미정의, `host-bridge.ts` 핸들러에 case 없음 | `spec/7-channel-web-chat/2-sdk.md` §3 postMessage 표 | `spec/7-channel-web-chat/1-widget-app.md` §3 상태기계; `codebase/channel-web-chat/src/widget/host-bridge.ts` | `1-widget-app.md` 에 `show`→런처 표시·`hide`→런처 숨김 전이 추가. spec 확정 후 `host-bridge.ts` `wc:command` 핸들러에 `show`/`hide` case 추가 및 테스트 보강 |
| 2 | Cross-Spec / Naming Collision | `on()` 반환 타입 `void → Unsubscribe` 변경, `off()` 메서드 신설 — 기존 코드 인터페이스와 갭 | `spec/7-channel-web-chat/2-sdk.md` §1·§5 | `codebase/packages/web-chat-sdk/src/types.ts` line 62 (`on()` 반환 `void`); `loader.ts` line 50; `index.ts` line 100; `ClemvionChatMethod` 열거에 `"off"` 없음 | `types.ts` `ChatInstance.on()` 반환 타입을 `Unsubscribe` 로 변경; `ChatInstance` 에 `off()` 추가; `ClemvionChatMethod` 에 `"off"` 추가; `createGlobalApi` switch 에 `"off"` case 추가 |
| 3 | Rationale Continuity | `show`/`hide` 메서드 추가 근거가 R3 에 누락 — `open`/`close`(패널)와 `show`/`hide`(런처)를 분리한 설계 결정 근거 없음 | `spec/7-channel-web-chat/2-sdk.md` §Rationale R3 | 없음 (R3 서술 누락) | R3 에 "런처 가시성(show/hide)과 패널 열림(open/close)을 두 축으로 분리한 이유" 항목 추가 |
| 4 | Rationale Continuity | `off()` 신설 연속성 불명확 — 기존 spec 이 `off()` 없이 `on()` 만 둔 이유(미결정 vs 의도적 단순화)를 R3 가 언급하지 않음 | `spec/7-channel-web-chat/2-sdk.md` §Rationale R3 | 기존 `2-sdk.md §1` (`off()` 부재) | R3 에 "기존 v1 spec에서 `off()` 없이 `on()` 만 두었던 것은 미결정 상태였으며, SPA 통합 피드백으로 cleanup 패턴 명시 요구에 따라 추가한다" 맥락 한 줄 추가 |
| 5 | Rationale Continuity | `data-global` 확정 — 기존 "구현 단계 검토" 보류에서 확정으로 전환한 맥락이 R3 에 불연속적 | `spec/7-channel-web-chat/2-sdk.md` §1 · §Rationale R3 | 기존 `2-sdk.md §1` "(전역명 충돌 방지 패턴은 구현 단계 검토)" | R3 `data-global` 관련 서술에 "구현 단계 검토로 보류했던 패턴을 `data-global` opt-in 재지정으로 확정한다"는 연결 한 줄 추가 |
| 6 | Convention Compliance | frontmatter `code:` 경로 `codebase/packages/web-chat-sdk/**` 가 실제 구현 위치와 일치하는지 미검증 — 불일치 시 `status: partial` 의 `code:` ≥1 매치 가드 위반 | `spec/7-channel-web-chat/2-sdk.md` frontmatter `code:` | `spec/conventions/spec-impl-evidence.md §2.1` | 실제 경로 확인 후 frontmatter `code:` 갱신 또는 경로 미생성 시 `status: spec-only` 로 조정 |
| 7 | Plan Coherence | `eia-sdk-publish.md §결정 #3` 비실체적 인용 — 코드 레벨 결정은 worktree 커밋에 있으나 plan 에 미반영 | `plan/in-progress/eia-sdk-publish.md` | `spec/7-channel-web-chat/2-sdk.md` 상단 callout (인용 대상) | `eia-sdk-publish.md` 에 §결정 사항 표를 추가해 결정 #1(publish 시점)·#2(registry)·#3(scope: `@workflow/*`) 기록. Critical #1 과 공동 해소 |
| 8 | Plan Coherence | plan frontmatter `worktree` 필드가 삭제된 branch 를 가리킴 | `plan/in-progress/channel-web-chat-followups.md` line 2; `plan/in-progress/channel-web-chat-impl.md` line 2 | 실존하지 않는 branch `channel-web-chat-spec-3b22b3` | 두 plan frontmatter `worktree` 필드를 `.claude/worktrees/channel-web-chat-followups-1feff2` 로 갱신 |

---

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | Cross-Spec | npm scope 확정 후 `_product-overview.md` §2·§4 동기화 필요 | `spec/7-channel-web-chat/_product-overview.md` | Critical #1 해소 시 `@clemvion/web-chat`(잠정) → `@workflow/web-chat` 일괄 갱신 |
| 2 | Cross-Spec | npm scope 확정 후 `0-architecture.md` §4 잠정 표기 제거 필요 | `spec/7-channel-web-chat/0-architecture.md` §4 | Critical #1 해소 시 함께 갱신 |
| 3 | Convention Compliance | `spec/7-channel-web-chat/` 영역이 `spec-impl-evidence.md §1` inclusive list 미포함 — build-time 가드 미적용 | `spec/conventions/spec-impl-evidence.md §1` | `spec/7-channel-web-chat/**.md` 를 inclusive list 에 추가하거나 의도적 제외라면 주석으로 명시 |
| 4 | Convention Compliance | 문서 `## Overview` 섹션 부재 (3섹션 권장 구조 중 Overview 생략) | `spec/7-channel-web-chat/2-sdk.md` 최상위 구조 | `## Overview` 섹션 추가로 3섹션 구조 완성 (엄격한 위반 아님) |
| 5 | Convention Compliance | npm scope 확정 내용이 서두 callout 과 Rationale §R2 양쪽에 중복 서술 — 단일 진실 원칙상 Rationale 집중 권장 | `spec/7-channel-web-chat/2-sdk.md` 상단 callout · §Rationale R2 | 서두 블록을 "확정 결과 + SoT 링크" 한 줄로 축소, 근거는 R2 에만 유지 |
| 6 | Rationale Continuity | §5 공개 인스턴스 타입 계약 신설 — §1 산문과 §5 타입 중 SoT 우선순위 Rationale 미명시 | `spec/7-channel-web-chat/2-sdk.md` §5 · §Rationale | R3 또는 R5 로 "§5 타입 계약이 §1 산문보다 우선하는 타입 SoT" 임을 한 줄 기술 |
| 7 | Naming Collision | `@workflow/web-chat` 과 `@workflow/sdk` — 같은 scope 다른 패키지, 충돌 없음 | `codebase/packages/sdk/package.json` | 조치 불필요 |
| 8 | Naming Collision | `data-global` 신규 HTML 속성 — 기존 spec/코드 충돌 없음 (구현 추가 필요) | `codebase/packages/web-chat-sdk/src/loader.ts` `installGlobal` | 구현 단계에서 `loader-entry.ts` 에 `document.currentScript?.dataset.global` 읽기 경로 추가 |
| 9 | Plan Coherence | main branch plan 파일이 worktree 완료 반영본보다 stale — PR 머지 전 정상 과도 상태 | `plan/in-progress/channel-web-chat-followups.md` §7-b | PR 머지 후 완료 항목 정리 또는 plan split(완료→`complete/`, 미완 #1~#6 잔류) |

---

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | HIGH | npm scope `@workflow/web-chat` 확정 선언 vs 기존 spec 3파일 `@clemvion/web-chat`(잠정) 직접 모순 (CRITICAL 1건); `show`/`hide`·`off()` 추가로 `1-widget-app.md` 와 책임 공백 (WARNING 2건) |
| Rationale Continuity | HIGH | npm scope 미결 상태를 plan 앞질러 확정 처리 — 단일 진실 원칙 위반 (CRITICAL 1건, Cross-Spec 과 동일 사안); R3 Rationale 스레드 불연속 3건 (WARNING) |
| Convention Compliance | LOW | frontmatter `code:` 경로 검증 필요 (WARNING 1건); inclusive list·Overview·중복 서술 (INFO 3건) |
| Plan Coherence | LOW | `eia-sdk-publish.md §결정 #3` 비실체적 인용 (WARNING); plan frontmatter `worktree` stale (WARNING); main branch plan stale (INFO) |
| Naming Collision | MEDIUM | `@workflow/web-chat` vs `@clemvion/web-chat` spec·코드 불일치 (CRITICAL — Cross-Spec 과 동일 사안 통합); `on()` 반환 타입·`off()` 구현 갭 (WARNING 2건) |

---

## 권장 조치사항

1. **(BLOCK 해소 필수)** `plan/in-progress/eia-sdk-publish.md` 에 `§결정 사항` 표를 추가해 결정 #1(publish 시점)·#2(registry: internal-only)·#3(scope: `@workflow/*`, `@workflow/web-chat`) 을 실제 기록한다. 이후 `_product-overview.md`·`0-architecture.md`·`codebase/packages/web-chat-sdk/package.json` 의 `@clemvion/web-chat`(잠정) 표기를 `@workflow/web-chat` 으로 일괄 교체한다. target `2-sdk.md` 의 "확정" 선언은 plan 갱신 완료 후 유효해진다.
2. `spec/7-channel-web-chat/1-widget-app.md` §3 상태기계에 `show`/`hide` 커맨드 수신 전이를 추가한다 (런처 표시/숨김, `hide` 상태에서 `open` 무효 등). 이후 `host-bridge.ts` 에 `wc:command` `show`/`hide` case 를 구현·테스트한다.
3. `codebase/packages/web-chat-sdk/src/types.ts` 의 `ChatInstance.on()` 반환 타입을 `Unsubscribe` 로 변경하고, `off()` 메서드 및 `ClemvionChatMethod` `"off"` 열거를 추가한다. `createGlobalApi` switch 에 `"off"` case 를 추가한다.
4. `spec/7-channel-web-chat/2-sdk.md §Rationale R3` 에 (a) `show`/`hide` 두 축 분리 근거, (b) `off()` 미결→명시 전환 맥락, (c) `data-global` 보류→확정 전환 문구를 각각 한 줄씩 추가한다.
5. `plan/in-progress/channel-web-chat-followups.md` · `channel-web-chat-impl.md` frontmatter `worktree` 필드를 `.claude/worktrees/channel-web-chat-followups-1feff2` 로 갱신한다.
6. frontmatter `code: codebase/packages/web-chat-sdk/**` 경로가 실제로 존재하는지 확인하고, 없으면 `status: spec-only` 로 조정한다.
7. (선택) `spec/conventions/spec-impl-evidence.md §1` inclusive list 에 `spec/7-channel-web-chat/**.md` 추가 여부를 결정한다. 추가 시 build-time 가드가 적용된다.
---

## main 판정 — BLOCK override (검증된 false-positive, 2026-06-02 재실행)

> 본 재실행은 commit `258afc65`(C-2) 이후 상태를 대상으로 했으나 **CRITICAL #1 이 또 stale 근거**를 들었다.
> CRITICAL 은 "`eia-sdk-publish.md §결정 #3` 미결 + 섹션 부재 + spec 3파일·package.json 이 `@clemvion/web-chat` 유지"
> 라고 주장하나, **디스크 사실로 3회 검증한 결과 전부 거짓**이다:
>
> | 주장 (checker) | 실제 (디스크, commit 258afc65) |
> |---|---|
> | `package.json` = `@clemvion/web-chat` | **`@workflow/web-chat`** (commit e64d84be) |
> | `eia-sdk-publish §결정 #3` 미결/섹션 부재 | **`## 결정 사항` 표 존재**, 행 #3 = `@workflow/*` 확정 (e64d84be) |
> | spec 3파일 `@clemvion/web-chat` 유지 | `2-sdk`·`0-architecture`·`_product-overview` 전부 `@workflow/web-chat` |
>
> 원인: 의사결정 헤딩을 `## 사용자 결정 사항` → `## 결정 사항` 으로 rename 하여 checker(LLM)가 옛 헤딩을
> 못 찾고 "섹션 부재"로 hallucinate. spec draft prompt 자체는 올바른 `@workflow` 를 담고 있으며, 세 SoT 는
> 실제로 완전 동기화돼 있다. → **CRITICAL #1 은 무효. 본 항목 기준 BLOCK 을 해제(override)한다.**
>
> **유효 발견 처리** (override 와 무관하게 반영):
> - WARNING #2/#3/#4/#5 (`on()` 반환·`off()`·R3 연속성): C-2 코드(`Unsubscribe`/`off()`/loader `off` case)는 이미
>   구현·테스트 완료. Rationale R3 연속성 문구는 본 커밋에서 보강.
> - WARNING #1 (`show`/`hide` 상태기계/handler): `show`/`hide` 는 기존 spec §1 공개 메서드였고 이번엔 §3 표에
>   명시만 추가. 위젯 SPA handler/상태기계 반영은 widget-app 완성도 영역(followup #4 인접)으로 분리.
> - WARNING #8 / Plan: plan frontmatter `worktree` 갱신 완료(258afc65).
> - INFO 다수(Overview 부재 등): 영역 sibling spec 관행(blockquote intro)과 일치시키기 위해 의도적 미적용.
>
> 결론: **실질 BLOCK 없음.** 남은 Rationale 보강만 반영 후 구현 진행.
