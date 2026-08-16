# 유저 가이드 동반 갱신 관점 리뷰

> **이 파일은 main Claude 가 sub-agent 반환 전문으로 재영속화했다.** 해당 reviewer 는
> `STATUS` 라인 대신 보고서 전문을 반환했고 `output_file` 이 디스크에 남지 않았다
> (worktree sub-agent write 격리). 내용 손실은 없다.

## 발견사항

이번 변경 set(EIA 내부 REST/WS 읽기 경로 `Execution.error` 마스킹 후속 + plan/review 정리)을 `.claude/config/doc-sync-matrix.json` `rows[]` 9개 trigger 전부에 대조했다.

- **[INFO]** `run-debug-flow-change` (실행·디버깅 흐름 변경) semantic trigger 와 유사도가 있어 회색지대로 판단, 조치 불요로 결론
  - 변경 파일: `codebase/backend/src/modules/executions/executions.service.ts`, `codebase/backend/src/modules/executions/background-runs/background-runs.service.ts`, `codebase/backend/src/shared/utils/redact-stored-error.ts`(신규)
  - 매트릭스 항목: `run-debug-flow-change` — targets: `"codebase/frontend/src/content/docs/05-run-and-debug/"`
  - 상세: 이 PR 은 내부 REST 읽기 경로(`GET /api/executions/:id`, `getChain`, `stop`, `background-runs` 등)가 반환하는 `Execution.error`/`nodeExecutions[].error` 컬럼 값에 자격증명 패턴 마스킹(`redactStoredErrorForResponse`)을 새로 건다 — 즉 Run Results / 실행 디버깅 화면에 뜨는 에러 메시지의 **내용**이 바뀐다. 다만 (a) `codebase/frontend/src/content/docs/05-run-and-debug/{error-handling,run-results}.mdx`(+`.en.mdx`)를 확인한 결과 에러 메시지에 자격증명이 그대로 노출된다거나 마스킹되지 않는다는 기존 서술이 없어, 이번 변경으로 "문서가 틀리게" 되는 지점이 없다. (b) 직전 선례인 종결 emit 마스킹 PR(#1177, `107c8038f`)도 같은 성격(보안 하드닝, 신규 기능 아님)이었고 `codebase/frontend/src/content/docs/**` / `codebase/frontend/src/lib/i18n/**` 를 건드리지 않았다 — 이 저장소가 이런 egress-마스킹류 변경을 user-guide 갱신 대상으로 취급하지 않아 온 일관된 관행이다. (c) 이번 변경의 정본 문서화는 `spec/2-navigation/14-execution-history.md`(R-5 각주) · `spec/4-nodes/1-logic/12-background.md` · `spec/5-system/{14-external-interaction-api,6-websocket-protocol}.md` · `spec/conventions/secret-store.md` 6곳에 이미 커밋 `4c1f89e55` 로 등재됐다(`spec/` 은 본 reviewer 영역 밖, consistency-checker/project-planner 소관).
  - 제안: 조치 불요. 사용자 응답에 노출되는 텍스트가 "credential-like → `***`" 로 안전해지는 방향의 변경이라 사용자 가이드가 약속을 어기지 않으며, UI 라벨·필드·i18n 키 자체는 전혀 바뀌지 않았다.

## 요약

매트릭스 9개 trigger(신규 노드·노드 schema·신규 UI 문자열·통합/제공자·신규 섹션 디렉토리·인증/세션·표현식 언어·실행/디버깅 흐름·신규 warning/error code) 전부를 이번 변경 파일 54개(백엔드 execution 서비스 3개 + 신규 `redact-stored-error.ts`/`.spec.ts` + spec 문서 5개 + plan 20여개 + consistency review 산출물 20여개)에 대조했다. `codebase/backend/src/nodes/**`, `codebase/frontend/src/**`, `codebase/backend/src/modules/auth/**`, `codebase/packages/expression-engine/**`, `error-codes.ts`/`warningRules` 어느 것도 이번 changeset 에 없어 CRITICAL/WARNING 급 동반 갱신 누락은 0건이다. 유일하게 검토 가치가 있던 `run-debug-flow-change` semantic 회색지대는 위 근거로 조치 불요로 판정했다(INFO 1건).

## 위험도

NONE
