# Consistency Check 통합 보고서 (impl-prep)

**BLOCK: NO** — Critical 발견 없음. 구현 착수 가능.

## 전체 위험도
**LOW** — WARNING 4건 전부 **spec 텍스트의 stale `console.warn` 처방**(코드 무관, planner spec-sync). 나머지 INFO. 차단 사유 없음.

> **핵심 (main 보강)**: WARNING W-1·W-2·W-3·W-4 는 전부 **spec 파일 라인**(ai-agent §6.2.c.fallback·presentation/0-common·EIA·data-flow/1-audit)을 가리킨다. **정의적 grep 결과 ai-agent/presentation/EIA 코드에 console.* 0건** — spec 텍스트만 stale(코드는 이미 logger 사용 또는 해당 호출 미존재; W-4 가 audit-logs 에 대해 "코드 이미 전환, spec 원문만 stale" 로 명시). 즉 본 PR 의 **코드 변경과 무관**하며, 이미 존재하던 spec drift 다. no-console 룰은 코드에만 적용되므로 lint 실패 유발 안 함. spec 텍스트 정정은 **planner 위임**(plan §m-1 point3 = ai-agent; presentation/EIA/audit 는 추가 위임 묶음으로 plan 등록).

## Critical 위배 (BLOCK 사유)
없음.

## 경고 (WARNING) — 처분

| # | Checker | 위배 | 처분 |
|---|---------|------|------|
| W-1·W-5 | Cross-Spec/Rationale | ai-agent spec §6.2.c.fallback `console.warn` 처방 | **코드에 console.* 없음**(grep 0). spec 텍스트 stale → planner(plan §m-1 point3). 본 PR 코드 무관. |
| W-2 | Cross-Spec | presentation/0-common.md §processAiResumeTurn console.warn 처방 | 동일 — presentation 코드 console.* 0. planner spec-sync 묶음. |
| W-3 | Cross-Spec | EIA spec console.warn 처방 | 동일 — EIA 코드 console.* 0. planner spec-sync 묶음. |
| W-4 | Cross-Spec/Rationale | data-flow/1-audit.md audit-logs console.warn 명기(코드 이미 전환) | spec 원문 stale → planner. |

## 참고 (INFO) — 처분

| # | Checker | 항목 | 처분 |
|---|---------|------|------|
| I-1 | Cross-Spec | 3-error-handling.md §6.2 구조화 로그 정합 | 본 PR 방향 정합 확인. |
| I-2 | Cross-Spec/Convention | chat-channel-adapter.md swallow(logger.warn) 정합 | telegram/language-hint 전환이 정합. |
| I-3 | Cross-Spec | 2-code.md console.* 사용자 샌드박스 맥락 — code.handler 면제 | **현상유지**(inline eslint-disable, pre-bootstrap). |
| I-4 | Rationale | pre-bootstrap 면제 Rationale spec 미기록 | planner 후속(비차단). |
| I-5 | Convention | 모듈레벨 Logger context 이름 | `new Logger('ChatChannel.Telegram')` 등 명시적 context 사용. |
| I-6 | Plan | plan §m-1 audit-logs:85 stale(이미 전환) | plan 갱신 시 제거. |
| I-7 | Plan | main.ts·code.handler inline 면제 방식 plan 미명시 | plan 갱신 시 명시. (구현: main.ts 는 Bootstrap Logger 전환, code.handler 는 inline 면제.) |
| I-8 | Plan | plan telegram:416 → 실제 :427 | plan 갱신 시 수정. |
| I-9·I-10 | Naming | `logger` 필드·`no-console` 키 충돌 없음 | 없음. |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | LOW | spec 4곳 stale console.warn 처방(코드 무관, planner). 데이터모델·API·RBAC 모순 없음. |
| Rationale Continuity | LOW | ai-agent §6.2.c.fallback spec 정정 선행 권고(코드 무관). pre-bootstrap 면제 Rationale(INFO). |
| Convention Compliance | LOW | 직접 위반 없음. 모듈 Logger 패턴·audit stale 목록(INFO). |
| Plan Coherence | NONE | 설계 충실. stale 라인번호·목록(INFO). |
| Naming Collision | NONE | 식별자 충돌 없음. |

## 권장 조치사항 → 구현 반영

1. 전환 5: main.ts(Bootstrap Logger)·node-handler.registry·mcp-test(this.logger)·telegram·language-hint(모듈 Logger, 명시적 context).
2. inline 면제 3: code.handler.ts:44/50/121 `// eslint-disable-next-line no-console -- pre-bootstrap config/module-load`.
3. 파일 override 면제: scripts/**·instrumentation.ts·*.spec.
4. planner spec-sync 묶음(W-1~4): ai-agent §6.2.c.fallback + presentation/EIA/audit-flow 의 stale console.warn 처방 정정 — plan §m-1 에 위임 등록.

**최종: BLOCK: NO — 착수 가능.**
