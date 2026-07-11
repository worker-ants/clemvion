# 변경 범위(Scope) 리뷰 — EIA-RL-07 공개 웹채팅 위젯 idle-wait execution 회수 reaper

대상 커밋 범위: 26개 파일. 핵심 기능(백엔드 `WebchatIdleReaperService` + engine `markWebchatIdleTimeout` + `InteractionTokenService.findIdleWebchatExecutionIds`)과 그 필연적 부수 변경(모듈 배선, env, 큐 모니터링 등록, CHANGELOG, plan 체크박스, spec 상태 마커 flip, 단위/e2e 테스트, impl-prep consistency-check 산출물)으로 구성.

### 발견사항

- **[INFO]** 신규 BullMQ 큐 등록에 따른 파생 변경(`system-status.constants.ts`, `system-status.e2e-spec.ts` 의 `EXPECTED_QUEUE_NAMES`, `spec/data-flow/0-overview.md` 큐 카탈로그·개수, `spec/data-flow/15-external-interaction.md` BullMQ 표)은 기능 자체와 직접 관련은 없어 보이지만, repo 기존 컨벤션상 "신규 큐 추가 시 system-status 레지스트리 + e2e 기대 목록 + data-flow 카탈로그 동시 갱신"이 의무(다른 큐들도 동일 패턴, 예: `terminal-revoke-reconcile`). 범위 이탈이 아니라 필수 동반 갱신.
  - 위치: `codebase/backend/src/modules/system-status/system-status.constants.ts`, `codebase/backend/test/system-status.e2e-spec.ts`, `spec/data-flow/0-overview.md`, `spec/data-flow/15-external-interaction.md`
  - 제안: 조치 불요.

- **[WARNING]** impl-prep consistency-check 산출물(`review/consistency/2026/07/11/19_12_18/**`, 6개 파일)이 이번 PR 의 실제 변경 영역(EIA §14 reaper)과 무관한 `spec/5-system/1-auth.md`(WebAuthn RPC 경로), `spec/5-system/10-graph-rag.md`(KB 토큰 통계 CRITICAL, `LlmUsageLog`/`Entity` casing WARNING 등)를 광범위하게 분석한 내용을 담고 있다. `SUMMARY.md` 자신이 "worktree 명이 타겟 선정을 편향시켜 `spec/5-system/` 전체가 딸려옴 — 실제 PR-2 는 EIA-RL-07 reaper 뿐" 이라고 명시적으로 인정한다.
  - 위치: `review/consistency/2026/07/11/19_12_18/SUMMARY.md`, `convention_compliance.md`, `naming_collision.md`, `plan_coherence.md`, `meta.json`(`target_path: spec/5-system/`), `_retry_state.json`
  - 상세: `review/` 산출물은 프로젝트 규약상 커밋 대상이 맞고(`CLAUDE.md`/memory: "review/ 는 gitignored 아님"), impl-prep 단계 자체도 developer 의무 절차라 절차 위반은 아니다. 다만 Scope 관점에서는 이 PR 의 diff 에 EIA-RL-07 과 무관한 auth §5/graph-rag §10 관련 자유 텍스트 분석(그 중 1건은 CRITICAL 로 별건 flag)이 그대로 실려 diff 노이즈가 크다. 코드 자체를 건드리진 않았으나, 리뷰어가 "이 PR 이 auth/graph-rag 도 다루나?" 오인할 소지가 있다.
  - 제안: 조치는 이미 SUMMARY 가 "PR-2 와 무관 → 별도 task" 로 self-triage 했으므로 재작업 불요. 다만 향후에는 `--impl-prep` 호출 시 target_path 를 실제 착수 spec(`spec/5-system/14-external-interaction-api.md`)으로 좁혀 무관 산출물 혼입을 줄이는 편이 바람직(별도 개선 항목, 이번 PR 블로킹 아님).

- **[INFO]** 나머지 코드 변경(엔진 `markWebchatIdleTimeout`, 토큰 서비스 `findIdleWebchatExecutionIds`, 신규 `WebchatIdleReaperService`/`webchat-idle-reaper.types.ts` + 각 대응 단위/e2e 테스트, 모듈 배선, `.env.example`, `CHANGELOG.md`, plan 체크박스, EIA/widget-app/auth-session spec 상태 마커 flip)은 모두 EIA-RL-07 단일 기능에 정확히 스코핑돼 있다. 불필요한 리팩토링·포맷팅 변경·주석 잡음·미사용 임포트·기능 확장(over-engineering) 징후는 발견되지 않았다.

### 요약
핵심 기능 코드(엔진·토큰서비스·신규 reaper 서비스·모듈 배선·env·테스트)는 EIA-RL-07 단일 목적에 정확히 부합하며 무관한 리팩토링·포맷팅·주석·임포트 변경은 없다. 신규 큐에 따른 system-status/데이터플로 문서 동반 갱신은 기존 컨벤션상 필수적 파생 변경이라 스코프 이탈이 아니다. 유일하게 눈에 띄는 점은 impl-prep consistency-check 산출물이 광범위한 `spec/5-system/` 타겟 선정으로 인해 EIA-RL-07 과 무관한 auth/graph-rag 분석을 diff 에 포함시킨 것인데, 이는 review 산출물 커밋 의무·절차상 정상이고 SUMMARY 자체가 이를 out-of-scope 로 명시적으로 self-triage 했으므로 실질 위험은 낮다.

### 위험도
LOW
