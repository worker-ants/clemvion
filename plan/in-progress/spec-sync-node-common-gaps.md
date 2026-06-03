---
worktree: spec-sync-audit
started: 2026-06-03
owner: planner
---

# node-common — spec 약속 대비 미구현 surface

> 출처: 2026-06-03 spec-vs-code audit (review/spec-coverage/2026/06/03/08_05_49). 본 spec 을 `partial` 로 강등하며 분리한 미구현 항목 추적.
> 관련 spec: spec/3-workflow-editor/1-node-common.md

## 미구현 항목
- [ ] §2.5.1 "Use Default Output" 기본값 설정 UI — 정책 select 에서 `Use Default Output` 선택 시 조건부 JSON 에디터 + 구문 강조/유효성 검증 + "Reset to Type Default" 버튼. 현재 `node-settings-panel.tsx` 의 Error Handling 은 단일 select 만 렌더링.
- [ ] §2.4 Retry 설정 입력 UI — `Retry` 정책 선택 시 `maxRetries`/`retryInterval` 입력 필드. 현재 select 옵션만 존재하고 입력 UI 없음.

## 비고
- §1.3 노드별 포트표 불일치(Parallel done, Text Classifier fallback/error, Info Extractor 모드별, AI Agent cond_N+시스템+error, Workflow out+error, Filter 누락)는 코드에 이미 구현된 surface 이며 spec 서술만 stale 했던 건이라 본 audit 에서 본문 패치로 정정 완료(이 plan 의 미구현 항목 아님). SoT: codebase/frontend/src/lib/node-definitions/resolve-dynamic-ports.ts + codebase/backend/src/nodes/**/*.schema.ts.
- 각 항목의 근거(claim→코드부재)는 review/spec-coverage 산출 findings 참조.

## ⚠ 재분류 (2026-06-03 groom): decision-free 아님 → planner 결정 필요
- **config shape 불일치(핵심)**: 패널은 `config.errorPolicy`(flat string) 저장(`node-settings-panel.tsx:183`), 그러나 엔진은 `config.errorHandling.{policy, defaultOutput, retryConfig.{maxRetries, retryInterval}}`(nested, policy 값 `stop_workflow`) 를 읽음(`execution-engine.service.ts:6625-6644`, retry default 3/1000ms :6594). **현재 패널 저장값을 엔진이 소비하지 않음.**
- **결정 필요**: config 스키마 통일(flat vs nested) + policy 값 vocabulary + "Reset to Type Default" 의 type-default 출처 정의. spec §2.4/§2.5.1 자체가 "Planned" 표기. JSON 에디터+검증 패턴: 동 파일 `CodeTab`(:278-335).
