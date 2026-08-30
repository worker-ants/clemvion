# Rationale 연속성 검토 — spec-draft-raw-query-results.md

## 검증 방법

target 이 인용하는 과거 결정·수치·PR 번호를 실제 소스에 대조했다:

- `plan/in-progress/update-returning-tuple-shape.md` (developer 가 남긴 `[planner 위임]` 원 항목) 전문 확인
- `spec/conventions/node-cancellation.md` §2.3/§2.4 본문 + Rationale 실제 열람 (번들 프롬프트에는 이 파일이 누락돼 있어 직접 Read)
- `spec/data-flow/2-auth.md`, `spec/5-system/8-embedding-pipeline.md` §7.3, `spec/5-system/10-graph-rag.md` 동시 호출 표의 실제 본문 대조
- `git log --oneline`으로 `#1168`·`#1172`·`#1241` 커밋 실재 확인

## 발견사항

없음. CRITICAL/WARNING 급 발견 없음.

### 확인된 사항 (참고용, 조치 불요)

- **기각한 대안 — 타입 경계 래퍼로 강제** (target Rationale, line 167) 는 `plan/in-progress/update-returning-tuple-shape.md` 의 "완료 (2026-08-30, `raw-update-guard-scope`) — 래퍼가 아니라 발견형 가드로" 절과 축어적으로 일치한다. `#1241` (`84cc53805`) 이 실제 그 커밋이다. `.claude/docs`/메모리가 요구하는 "기각된 대안은 실제 이력 필수" 기준을 충족 — 지어낸 대안이 아니다.
- **소급 각주 5건의 대상 위치**는 실제 spec 본문/Rationale 위치와 모두 일치한다 — `spec/data-flow/2-auth.md`의 `### OAuth state 의 one-shot DELETE`(Rationale 섹션 내부, target 이 정확히 "(Rationale)" 로 라벨링), `spec/5-system/8-embedding-pipeline.md` `### 7.3 재임베딩`, `spec/5-system/10-graph-rag.md` 동시 호출 표의 `re-extract` 행(`409 KB_REEXTRACT_IN_PROGRESS`), `spec/conventions/node-cancellation.md` §2.4 네 번째 불릿("retry 재진입 종결 경로 terminal 가드" — "조건부 UPDATE 가 0행이면 저장·종결 이벤트 발행을 모두 skip") 전부 실측 대조 완료.
- **"12곳/3파일" 실측치**는 원 plan 의 "11곳"(execution-engine.service.ts 6 + ai-turn-orchestrator 3 + retry-turn 2) 에 plan 자신이 남긴 "세 번째 stale" 재분류 지시(`finalizeCancelledExecution` 이 `eia-db-wire-invariant` 로 인해 "영향 없음→있음" 전환)를 반영한 값과 정확히 일치한다(6+1=7, 총 12). target 이 드리프트 사유를 명시(§B 인용문)한 것도 적절하다.
- **"서술을 바꾸는 게 아니라 이력을 붙인다"** 는 target 의 각주 원칙은, execution-engine.md Rationale 에 이미 확립된 두 패턴 — "옛 서술 철회"(주장 자체가 틀렸을 때 취소선+재작성) vs "정정"(설계는 맞고 실측이 갱신될 때 각주 부기) — 중 후자와 정합한다. 이번 경우는 "설계 결정은 옳았고 구현이 4개월간 그 결정을 어겼다"는 상황이므로 후자 패턴 선택이 적절하며 기존 관례와 충돌하지 않는다.
- **node-cancellation.md §2.4 구조** — signal 경로(§2.3)와 DB 관측 경로(§2.4)를 구분하는 표, "노드 경계/turn 경계/park↔resume 짝 전이/retry 재진입 종결" 4개 불릿 구성이 target 의 서술과 정확히 일치한다. target 이 "표 행이 아니라 소비 경로에 건다"고 명시적으로 스코프를 좁힌 것은 §2.3/§2.4 비교표(신호 vs 관측 메커니즘 자체를 다루는 표)와 "영향 있음/없음" 소비 경로 목록을 혼동하지 않겠다는 뜻으로, 실제 문서 구조상 타당하다.
- **pending_plans frontmatter** — 현재 `node-cancellation.md` 의 `pending_plans:` 에는 `node-cancellation-residual-signal-propagation.md` 한 건만 등재돼 있음을 확인. target 의 추가 제안과 충돌 없음.

## 요약

target 문서는 developer 가 `plan/in-progress/update-returning-tuple-shape.md` 에서 `[planner 위임]` 으로 명시한 두 항목(규약 승격 + 소급 각주 5건)을 집행하는 spec draft 다. 인용하는 모든 과거 결정·수치·커밋 번호(`#1168`, `#1172`, `#1241`)를 실제 저장소와 대조한 결과 전부 정확했고, "기각한 대안"(타입 경계 래퍼)은 실제 developer 검토 이력에 근거하며 지어낸 근거가 아니다. 다섯 소급 각주는 모두 "설계는 옳았고 구현이 어겼다"는 원칙을 일관되게 유지하며 원문을 고치지 않고 이력만 붙이는 방식을 택해, 이 저장소의 기존 Rationale 정정 관례(서술 자체가 틀렸을 때만 취소선+재작성, 설계가 맞고 실측이 갱신될 때는 각주 부기)와 정합한다. 기각·폐기된 결정의 재도입, 합의 원칙 위반, 무근거 번복, invariant 우회 중 어느 것도 발견되지 않았다.

## 위험도

NONE
