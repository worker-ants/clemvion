# Consistency Check 통합 보고서

**BLOCK: YES** — Critical 발견이 있어 호출자가 차단해야 합니다.

## 전체 위험도
**HIGH** — npm 패키지 scope "확정" 선언이 plan·코드 단일 진실을 동시에 깨뜨리며, spec·코드 간 `on()`/`off()` 계약 불일치가 누적된 상태입니다.

---

## Critical 위배 (BLOCK 사유)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | Convention Compliance | npm scope `@workflow/web-chat`을 "확정"으로 선언했으나 `eia-sdk-publish.md §결정 #3`이 미채움 상태이고 `package.json`도 `@clemvion/web-chat` 유지 — spec·plan·코드 단일 진실 동시 위반 | `spec/7-channel-web-chat/2-sdk.md` 도입부 확정 블록 및 §2 헤더 | `plan/in-progress/eia-sdk-publish.md §결정 #3` (미결), `codebase/packages/web-chat-sdk/package.json` (`@clemvion/web-chat`) | `eia-sdk-publish.md §결정 #3` 채움 + `package.json` rename + spec 갱신을 동일 commit에 묶거나, 그 전까지 spec 내 "확정" 표기를 잠정(`eia-sdk-publish.md 결정 종속`)으로 되돌린다. |

---

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | Cross-Spec | `wc:command` 페이로드 표에 `show`/`hide` 누락 — 표가 실제 프로토콜보다 좁음 | `2-sdk.md §3` postMessage 표 `wc:command` 행 | `2-sdk.md §1` 메서드 목록, `index.ts` 94-97행 | 표 페이로드 열을 `open`/`close`/`show`/`hide`/`sendMessage(text)`/`updateProfile`/`shutdown` 7개로 갱신 |
| 2 | Cross-Spec | `show`/`hide` vs `open`/`close` 의미 차이가 spec 어디에도 정의되지 않음 | `2-sdk.md §1` 메서드 목록 | `1-widget-app.md` 상태기계 (`show`/`hide` 언급 없음) | `2-sdk.md §1`에 두 쌍의 의미 차이 명시; `1-widget-app.md` 상태기계에 반영하거나 중복 메서드 통합 |
| 3 | Cross-Spec | `on()` 반환값 — spec·타입은 `Unsubscribe` 반환 선언, `bridge.on()`은 `void` 반환 — SPA cleanup 패턴 동작 안 함 | `2-sdk.md §2 · §R3` | `bridge.ts WidgetBridge.on()` (void), `index.ts` 100행 | `bridge.ts`에서 `Unsubscribe` 반환 구현 + `index.ts` 전달 — developer 범위 |
| 4 | Cross-Spec | `off()` — spec·타입 정의 있으나 `index.ts` 반환 객체에 누락 | `2-sdk.md §1 · §2` | `index.ts` boot() 반환 객체 93-103행 | `WidgetBridge`에 `off()` 구현 후 `index.ts`에 노출 — developer 범위 |
| 5 | Convention Compliance | Overview 섹션 없음 — 3섹션 권장(Overview / 본문 / Rationale) 미준수 | `2-sdk.md` 전체 구조 | CLAUDE.md "Spec 문서 3섹션 구성" 권장 | 본문 앞에 `## Overview` 추가해 spec 범위(CDN 로더 + npm SDK + postMessage + BootConfig)를 한 문단 명시 |
| 6 | Convention Compliance | Rationale이 R2부터 시작 — R1 없음, cross-reference 앵커 깨짐 가능 | `2-sdk.md §Rationale` R2, R3 | 프로젝트 관행 R1 순차 시작 (chat-channel-adapter.md 등) | (a) Rationale 섹션 도입에 번호 체계 주석 추가, 또는 (b) R1·R2로 renumber |
| 7 | Convention Compliance | 공개 SDK 인스턴스 메서드 TypeScript 타입 계약 미명시 (`on()`/`off()` 포함) | `2-sdk.md §1 · §2` | CLAUDE.md "기술 명세 본문 명시" 의무 | `§4` 또는 별도 `§5`에 `interface ClemvionChatInstance` 추가해 모든 공개 메서드 시그니처 명시 |
| 8 | Plan Coherence | `channel-web-chat-followups.md §7-b` `on()` 구독 해제·전역명 충돌 방지 체크박스 미갱신 | `plan/in-progress/channel-web-chat-followups.md §7-b` | `2-sdk.md §1` (`data-global`, `on()` unsubscribe, `off()`) | 해당 체크박스를 `[x]`로 갱신하고 "spec 2-sdk 반영 완료" 메모 추가 |
| 9 | Plan Coherence | `wc:resize` "(필수)" 격상이 plan 우선순위에 미반영 | `plan/in-progress/channel-web-chat-followups.md §7-b` wc:resize 항목 | `2-sdk.md §3` wc:resize "(필수)" | plan 항목에 "spec §3 '필수' 격상 완료" 주석 추가 및 구현 우선순위 상향 표기 |

---

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | Cross-Spec | `BootConfig.locale` 필드가 `0-architecture.md §4` 배포 설정 표에 미반영 | `2-sdk.md §4` / `0-architecture.md §4` | `0-architecture.md §4` 표에 `locale` boot config 필드 추가 |
| 2 | Cross-Spec | `0-overview.md §6.3` 로드맵 행에 `@workflow/web-chat` 패키지명 미기재 | `0-overview.md §6.3` | 해당 행에 `@workflow/web-chat` 괄호 병기 |
| 3 | Rationale Continuity | Rationale 번호 R1 미존재 — 문서 로컬 vs 영역 공유 번호 공간 불명확 | `2-sdk.md §Rationale` | 문서 prefix 추가(`SDK-R2`/`SDK-R3`) 또는 R1 생략 이유 주석 |
| 4 | Rationale Continuity | postMessage 프로토콜 설계 Rationale 부재 (`wc:` prefix 선택 이유, origin 검증 필수 이유, resize host 의무 이유) | `2-sdk.md §3` | `§Rationale`에 `R-postMessage` 항목 추가 |
| 5 | Rationale Continuity | `BootConfig.appearance` 현 phase 제한 근거 미기재 | `2-sdk.md §4` | Rationale에 appearance 현 phase 제한 이유 간략 기술 |
| 6 | Convention Compliance | 마크다운 표 셀 내 파이프 문자 이스케이프 누락 (`state: 'collapsed'\|'expanded'`) | `2-sdk.md §3` wc:resize 행 | `\|` 이스케이프 또는 페이로드 상세를 코드 블록으로 이동 |
| 7 | Convention Compliance | frontmatter `id: web-chat-sdk` — 파일 basename `2-sdk`와 불일치 (권장 벗어남) | `2-sdk.md` frontmatter | 현행 유지 가능; 영역 내 다른 파일 id 패턴과 정비 시 일관성 향상 |
| 8 | Plan Coherence | `channel-web-chat-impl.md` / `channel-web-chat-followups.md` frontmatter `worktree`가 stale branch 참조 (`channel-web-chat-spec-3b22b3`, PR #384 MERGED) | 두 plan frontmatter | `worktree` 필드를 `.claude/worktrees/channel-web-chat-followups-1feff2`로 갱신; `channel-web-chat-impl.md` `plan/complete/` 이동 검토 |
| 9 | Naming Collision | `ChatInstance.on()` 반환 타입 — `types.ts`에서 `void`로 선언, spec은 `Unsubscribe` 요구 (Cross-Spec WARNING #3과 동일 위배, INFO로 통합) | `codebase/packages/web-chat-sdk/src/types.ts` `ChatInstance` | `types.ts` `ChatInstance.on` 반환 타입을 `Unsubscribe`로 변경 |
| 10 | Naming Collision | `ChatInstance` 인터페이스에 `off()` 선언 누락 (Cross-Spec WARNING #4와 동일 위배, INFO로 통합) | `codebase/packages/web-chat-sdk/src/types.ts` | `ChatInstance`에 `off(event, cb?)` 추가 |

---

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | MEDIUM | `wc:command` 표 `show`/`hide` 누락, `on()` 반환값 및 `off()` 구현 불일치 (spec→코드 4건 WARNING) |
| Rationale Continuity | LOW | Rationale 번호 gap·postMessage·appearance 설계 근거 미기재 (3건 INFO) |
| Convention Compliance | HIGH | npm scope "확정" 선언이 단일 진실 위반 (1건 CRITICAL); Overview 누락·Rationale 번호·타입 계약 미명시 (3건 WARNING) |
| Plan Coherence | LOW | plan 체크박스 미갱신·wc:resize 우선순위 미반영·stale worktree 참조 (2건 WARNING, 1건 INFO) |
| Naming Collision | LOW | `on()` 반환 타입·`off()` 인터페이스 누락 (2건 INFO — Cross-Spec과 동일 원인) |

---

## 권장 조치사항

1. **(BLOCK 해소 — 즉시 필수)** `plan/in-progress/eia-sdk-publish.md §결정 #3` scope 항목을 채우고(`@workflow/web-chat` 또는 최종 결정값), `codebase/packages/web-chat-sdk/package.json` `name` rename, `spec/7-channel-web-chat/2-sdk.md` 내 "확정" 표기를 동일 commit에 묶어 처리. 세 파일이 동시에 갱신되지 않으면 단일 진실 위반이 잔존한다.
2. **(developer 즉시)** `bridge.ts WidgetBridge.on()`이 `Unsubscribe` 반환하도록 수정 → `index.ts` 전달 → `types.ts ChatInstance.on` 반환 타입 `Unsubscribe`로 변경.
3. **(developer 즉시)** `WidgetBridge`에 `off(event, cb?)` 구현 → `index.ts` 반환 객체에 노출 → `types.ts ChatInstance`에 `off` 선언 추가.
4. **(spec 작업 중 처리)** `2-sdk.md §3` `wc:command` 페이로드 표에 `show`/`hide` 추가 및 `show`/`hide` vs `open`/`close` 의미 차이 §1에 명시; `1-widget-app.md` 상태기계 동기화.
5. **(spec 작업 중 처리)** `2-sdk.md` 앞에 `## Overview` 섹션 추가 및 Rationale 번호 정비 (renumber 또는 prefix 추가).
6. **(plan 즉시)** `channel-web-chat-followups.md §7-b` 체크박스 갱신 및 wc:resize 우선순위 주석 추가; 두 plan frontmatter `worktree` 필드 현행 worktree로 수정.
7. **(low-priority)** `0-architecture.md §4`에 `locale` boot config 필드 추가; `2-sdk.md §3` wc:resize 표 파이프 이스케이프 수정; Rationale에 postMessage 설계 근거 항목 추가.

---

## main 후속 주석 (BLOCK 재평가 — 2026-06-02)

> 본 SUMMARY 의 5개 checker 는 main worktree 의 **uncommitted 편집 도중** 병렬 실행되어, **commit e64d84be + 진행 중 worktree 편집 이전 스냅샷**을 일부 참조했다. 아래는 BLOCK 사유·핵심 WARNING 의 실제 상태 재평가다 (main 이 디스크 사실로 검증).
>
> - **CRITICAL #1 (BLOCK 사유) = 해소됨 (stale false-positive)**: 세 SoT 모두 `@workflow/web-chat` 로 동기화 완료 — `package.json`(commit e64d84be), `eia-sdk-publish.md §결정 #3`(채움, e64d84be), `spec 2-sdk`(확정 표기). checker 가 인용한 "package.json `@clemvion/web-chat` 유지"·"§결정 #3 미채움" 은 commit 이전 상태로, 현재 디스크와 불일치한다. → **BLOCK 해소**.
> - **Cross-Spec #3/#4, Naming #9/#10 (on() 반환·off() 누락) = 해소됨**: `bridge.ts on()` → `Unsubscribe` 반환, `off(event, cb?)` 구현, `index.ts` 노출, `types.ts ChatInstance` 갱신 모두 완료(C-2 코드). typecheck/lint/37 tests/build ✓.
> - **Plan #8/#9 (followups §7-b 체크박스·wc:resize 우선순위) = 해소됨**: §7-b `[x]` 갱신 + 메모 반영 완료.
>
> 잔여 유효 WARNING (commit 후 추가 처리): Cross-Spec #1(`wc:command` 표 show/hide 누락), #2(show/hide vs open/close 의미), Convention #7(ClemvionChat 인스턴스 인터페이스 명시), Plan INFO #8(plan frontmatter stale worktree), Cross-Spec INFO #1(locale). → 후속 커밋에서 반영 후 **consistency-check 재실행으로 BLOCK:NO 확정**.
