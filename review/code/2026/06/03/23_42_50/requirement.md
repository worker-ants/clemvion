# 요구사항(Requirement) 리뷰 결과

## 발견사항

### [WARNING] `§3.4.2` 표시 텍스트 미갱신 — 앵커만 수정, 링크 레이블 불일치
- 위치: `spec/5-system/15-chat-channel.md` 86행 (파일 16 변경, CCH-SE-01 행)
- 상세: diff 는 앵커를 `#342-trigger-테이블-신규-컬럼` → `#42-trigger-테이블-신규-컬럼` 로 수정해 실제 heading §4.2 를 올바르게 가리키도록 했다. 그러나 링크 표시 텍스트는 `§3.4.2` 그대로 남아 있다. 클릭하면 §4.2 로 이동하지만, 독자에게는 §3.4.2 라고 표시된다. 이는 섹션 번호 체계 변경(구 §3.4.2 → 현 §4.2)을 반영하지 못한 오기다.
- 제안: `[§3.4.2](#42-trigger-테이블-신규-컬럼)` → `[§4.2](#42-trigger-테이블-신규-컬럼)` 로 표시 텍스트 수정

### [WARNING] R-CC-16 앵커에서 `render_` 언더스코어 누락
- 위치: `spec/5-system/14-external-interaction-api.md` (파일 15, R10 단락 내 링크)
- 상세: 변경 전 앵커 `#r-cc-16-chat-channel-outbound-의-비-blocking-presentation--ai-render_-presentations-발화` 는 heading `### R-CC-16. chat-channel outbound 의 비-blocking presentation + AI render_* presentations[] 발화` 에서 `render_*` 의 언더스코어(`_`)를 올바르게 보존했다. 변경 후 `#r-cc-16-...-ai-render-presentations-발화` 는 `_` 를 누락해 GitHub Markdown 앵커 파생 규칙(언더스코어 유지, 별표만 제거)과 불일치한다. 결과적으로 이 링크는 실제 heading 앵커 `#r-cc-16-...-ai-render_-presentations-발화` 를 찾지 못한다.
- 제안: `#r-cc-16-chat-channel-outbound-의-비-blocking-presentation--ai-render-presentations-발화` → `#r-cc-16-chat-channel-outbound-의-비-blocking-presentation--ai-render_-presentations-발화` (언더스코어 복원)

### [INFO] `spec/conventions/node-cancellation.md` 의 기존 경로 문제 (이번 PR 미도입)
- 위치: `spec/conventions/node-cancellation.md` §5.1 (파일 27)
- 상세: 이번 PR 이 변경한 앵커(`#44-사용자-입력-대기-이벤트-상세-executionwaiting_for_input`)는 올바르다. 그러나 이 파일은 `../../spec/5-system/6-websocket-protocol.md` 와 같이 `../../spec/` prefix 가 붙은 경로를 이미 사용 중이다. `spec/conventions/` 에서 `../../spec/` 는 프로젝트 루트를 벗어나 `spec/` 디렉토리를 재진입하는 의도로 보이나, 실제 렌더링 환경에 따라 깨질 수 있다. 이번 PR 이 만든 문제가 아니므로 INFO 로 분류하며, 별도 링크 정합 작업(spec-link-integrity.test.ts)에서 검출 대상이다.

---

## 파일별 검증 결과 요약

### 기능 완전성 — 모두 충족

이번 변경은 spec 문서 내 **교차 링크 앵커 수정 + 플랜 파일명 변경 반영 + 카운트 수정**으로 구성된다. 구현 코드 변경은 없으며, spec 문서 링크 정합성 개선이 전부다. 각 파일별 의도된 기능:

| 파일 | 변경 의도 | 충족 여부 |
|---|---|---|
| parallel.md (파일 1) | `parallel-p2.md` → `parallel-p2-followups.md` 링크 갱신 | ✅ (파일 존재 확인) |
| switch.md (파일 2) | `#1-conditiongroup-구조` → `#1-condition-구조` (실제 heading 일치) | ✅ |
| filter.md (파일 3) | 동일 앵커 수정 | ✅ |
| ai/0-common.md (파일 4) | §2.3 앵커 `v1-적용-범위` 제거, §11 앵커, §6.2 앵커, §6.2 링크 텍스트 수정 | ✅ |
| ai-agent.md (파일 5) | §2 KB 링크, presentation §10 앵커, WS §4.4 앵커, §5.5, §8.2 앵커 | ✅ |
| integration/0-common.md (파일 6) | Integration 노드 3종 → 4종 (product overview 와 일치) | ✅ |
| database-query.md (파일 7) | 재실행 §7.1 앵커 (`#71` → `#71-외부-부수효과-노드-분류`) | ✅ |
| send-email.md (파일 8) | §7 dry-run 앵커 (`#7-dry-run` → `#7-dry-run-모드-정의`) | ✅ |
| cafe24.md (파일 9) | §11 AI 노드 앵커, §9.3 슬래시 제거 앵커 | ✅ |
| integration/_product-overview.md (파일 10) | 3종→4종 링크 수정 | ✅ |
| presentation/0-common.md (파일 11) | 6종→5종 앵커 수정 (product overview 5종 확인) | ✅ |
| manual-trigger.md (파일 12) | §2 앵커 (미구현 Planned 포함) | ✅ |
| discord.md (파일 13) | R-D-3 앵커(는 추가), §3 adapter 앵커 | ✅ |
| slack.md (파일 14) | R-S-6 앵커(이하 제거), §3 adapter 앵커 | ✅ |
| 14-EIA.md (파일 15) | HMAC §4.2 앵커, R10 R-CC-16 링크 수정 | ⚠️ R-CC-16 앵커 오류 |
| 15-chat-channel.md (파일 16) | §4.2 앵커, HMAC 앵커, R-CC-13 앵커, §3.2 경로 수정, §R-CC-16 링크 | ⚠️ §3.4.2 표시 텍스트, R-CC-16 앵커 오류 |
| 4-execution-engine.md (파일 17) | WS §4.4 앵커, §8.2 앵커 | ✅ |
| expression-language.md (파일 18) | §1 Condition 앵커 | ✅ |
| 5-system/_product-overview.md (파일 19) | 시스템 spec 맵 확장 | ✅ |
| 7-channel-web-chat/_product-overview.md (파일 20) | 구성요소 spec 링크 추가 | ✅ |
| cafe24-api-metadata.md (파일 21) | §11 AI 앵커 (System Context Prefix) | ✅ |
| cafe24-restricted-scopes.md (파일 22) | §8.3 앵커 (괄호·점 제거) | ✅ |
| chat-channel-adapter.md (파일 23) | 다수 앵커 수정 (R-CCA-5, R-CCA-6, R-CCA-7, §3) | ✅ |
| conversation-thread.md (파일 24) | WS §4.4 앵커 다수 | ✅ |
| cross-node-warning-rules.md (파일 25) | `parallel-p2-followups.md` 링크 갱신 | ✅ |
| interaction-type-registry.md (파일 26) | WS §4.4 앵커 | ✅ |
| node-cancellation.md (파일 27) | WS §4.4 앵커 | ✅ |
| spec-impl-evidence.md (파일 28) | Gate C (5번째 가드) + §4.0 인접 가드 문서화 | ✅ |
| 8-notifications.md (파일 29) | 알림 WS §4.4 앵커 (`계획·미구현` 포함) | ✅ |

### 엣지 케이스 / TODO / 에러 시나리오

- 모든 변경이 문서 링크 메타데이터 수정이라 실행 경로 엣지케이스는 해당 없다.
- TODO/FIXME/HACK 주석: 변경된 diff 내에 없음.
- `spec-impl-evidence.md` (파일 28) 의 Gate C 설명에서 `started ≥ 2026-06-04` cutoff grandfather 정책이 명시되어, 기존 plan 에 소급 적용하지 않음이 문서화됨. 이 설계는 의도와 구현 간 괴리 없음.

### 비즈니스 로직 정합

- Integration 노드 4종 (HTTP Request, Database Query, Send Email, Cafe24) 의 카운트 수정(3종→4종)은 `spec/4-nodes/_product-overview.md` §7 의 현행 텍스트(4종)와 일치한다.
- Presentation 노드 5종 링크는 `spec/4-nodes/_product-overview.md` §9 의 현행 텍스트(5종)와 일치한다.
- `parallel-p2-followups.md` 는 `plan/in-progress/` 에 실존 확인됨.
- `spec-plan-completion.test.ts`, `spec-link-integrity.test.ts`, `spec-area-index.test.ts`, `plan-frontmatter.test.ts` 모두 `codebase/frontend/src/lib/docs/__tests__/` 에 실존 확인됨.

---

## 요약

이번 변경은 29개 spec 문서의 교차 링크 앵커를 실제 heading 과 일치하도록 일괄 수정한 정합성 개선 작업이다. 대부분의 앵커 수정은 올바르며 — 특히 `spec/5-system/6-websocket-protocol.md §4.4` 의 실제 heading(`사용자 입력 대기 이벤트 상세 (execution.waiting_for_input)`)에 맞게 광범위하게 정정한 것, Logic 노드 §1의 `ConditionGroup` → `Condition` 앵커 수정, plan 파일명 변경 반영 등이 모두 검증됐다. 그러나 두 개의 오류가 발견됐다: (1) `spec/5-system/15-chat-channel.md` CCH-SE-01 행에서 앵커는 §4.2 를 올바르게 가리키지만 링크 표시 텍스트가 구버전 `§3.4.2` 로 남아 있어 독자 혼란을 초래한다. (2) `spec/5-system/14-external-interaction-api.md` 의 R-CC-16 링크에서 `render_*` heading 의 언더스코어(`_`)가 누락돼 실제 앵커와 불일치하며 브라우저에서 해당 섹션으로 이동하지 못한다. Gate C 및 §4.0 인접 가드 문서화(파일 28)는 참조 테스트 파일 실존과 일치하며 요구사항을 완전히 충족한다.

## 위험도

LOW

두 개의 문서 링크 오류(표시 텍스트 불일치, 앵커 언더스코어 누락)는 spec 탐색 편의성에만 영향을 주며 기능 구현 코드 변경이 없다. R-CC-16 링크 오류는 해당 섹션으로 이동이 안 되는 사용성 결함이지만, 본문 내용이나 구현 규약 자체는 변경되지 않는다.
