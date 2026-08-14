# Code Review 통합 보고서

## 전체 위험도
**LOW** — 이 diff 는 `llmCalls`(raw LLM 프롬프트/대화 이력) 외부 유출 CRITICAL 을 WS fanout·REST `getStatus` 세 출구 모두에서 닫는 보안 수정이다. 신규 CRITICAL 은 없다. 강제(forced) reviewer 7명(`documentation, maintainability, requirement, scope, security, side_effect, testing`) 전원 결과 확보됨 — 화이트리스트 미이행 없음. 남은 4건 WARNING 은 전부 비차단성(테스트 커버리지 갭 1건, 구조적 재발 여지 1건, 성능 미측정 worst-case 1건, plan 완료 선언과 실제 상태 불일치 1건)이다.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | performance / concurrency | `stripExternalOnlyFields`(재귀 전체 순회)가 `llmCalls` 를 가질 수 없는 **모든** node 이벤트(NODE_STARTED/COMPLETED/FAILED/SKIPPED)에도 방어심층화 명목으로 걸리는데, `NODE_COMPLETED` 는 크기 무제한인 `outputData`/`inputData` 전체를 싣는다. 유일한 비용 실측(+20.2 µs/emit, 2.8배)은 AI 대화 payload 한정이며 대용량 non-AI worst-case 는 미측정. 동시성 관점에서는 이 순회 시간만큼 단일 이벤트 루프가 다른 요청 처리를 지연시킬 수 있다 | `codebase/backend/src/modules/websocket/websocket.service.ts:503-538`(`emitNodeEvent`, strip 호출 524-527); 근거 `execution-engine.service.ts:5946-5957`(`output`/`input` 전체 emit) | `plan/in-progress/spec-draft-eia-62-waiting-payload.md:249-252` 백로그 항목("대용량 non-AI payload A/B") 착수 우선순위 상향, 최소 1회 payload 크기 상관 벤치마크 |
| 2 | architecture | "출구마다 각자 조립" 결함 클래스(과거 3라운드 반복)를 이번 diff 가 **필드-삭제(strip) 절반만** 공유 유틸로 승격시켰다. "strip + redact 합성 레시피"(순서·깊이 상수 짝)는 여전히 `interaction.service.ts` 의 module-private `stripAndRedact` 로만 존재해, 세 번째 외부 표면이 생기면 담당자가 strip 만 부르고 redact 짝을 빠뜨릴 구조적 여지가 남는다 | `codebase/backend/src/shared/utils/strip-external-only-fields.ts:11-21`(JSDoc "여기를 부르면 된다"); `interaction.service.ts:98`(`stripAndRedact`, export 없음); `websocket.service.ts:430,450-453`(독자적 별도 합성) | `stripAndRedact` 류 "strip 후 redact, 같은 깊이 상수" 합성을 `shared/utils/`(예: `sanitizeForExternalSurface`)로 승격해 향후 표면이 하나만 부르면 두 방어가 함께 딸려오게 할 것 |
| 3 | testing | REST `stripAndRedact` 리팩터가 `outputData`/`nodeExec.outputData` 의 null-가드 로직을 호출부 3곳 → 헬퍼 1곳으로 재배치했는데(DB 컬럼은 `nullable: true`라 런타임에 실제 null 가능), 이 경로를 태우는 테스트가 없다. 코드 추적으로는 동작 보존이 확인되나 회귀를 잠그는 테스트 부재 | `interaction.service.ts:98`(`stripAndRedact`), `:379`(waiting `?? {}`), `:439-446`(terminal `result`/`error`); `interaction.service.spec.ts` 626/668/876행 전부 non-null fixture 만 사용 | `nodeExec.outputData: null`(waiting) 및 `execution.outputData: null` + COMPLETED/FAILED(terminal) 각 최소 1건 회귀 테스트로 고정 |
| 4 | documentation | `spec-draft-eia-62-waiting-payload.md` 체크리스트가 item (7) 6개 하위 조치를 "(1)~(7) 전부 완료"로 선언하지만 실측하면 3개(③ EIA §6.2 에 strip 명시 문장+§R17 역참조, ④ 수정 이력 addendum, ⑤ 코드 JSDoc SoT 목록에 EIA §6.2 추가) 가 미반영. 정작 이번 보안 결함이 실제로 샜던 §6.2 절에 strip 방어 사실이 문서화돼 있지 않다 | `plan/in-progress/spec-draft-eia-62-waiting-payload.md:158-174,281-284`; `spec/5-system/14-external-interaction-api.md` §6.2(645-720행, grep 0건); `strip-external-only-fields.ts:8-9`(SoT 목록에 EIA §6.2 누락) | §6.2 에 §6.5 와 동형의 strip 캐빗+`#R17` 역참조 추가, WS §4.4 Rationale 에 2026-08-14 수정 이력 addendum, `strip-external-only-fields.ts:9` SoT 목록에 EIA §6.2 추가 후 체크리스트 재확인 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | performance | `stripDeep` 에는 자매 `sanitizePayloadForWs` 의 `SANITIZE_CACHE`(WeakMap identity 캐시)에 대응하는 캐시가 없음 — 이미 인지·의도적으로 유예된 항목(두 캐시 무효화 시점이 갈리는 조합 미검증) | `strip-external-only-fields.ts:84-125` ↔ `websocket.service.ts:237` | 별도 조치 불요(추적 중), 위 WARNING 1 과 결합해 우선순위 재검토 권장 |
| 2 | architecture / maintainability | `stripDeep`/`sanitizeInner`(`websocket.service.ts`)/`deepRedactObject`(`sanitize-error-message.ts`) 가 "재귀 트리 순회+clone-on-write" 골격을 세 벌 독립 구현 — 기존 라운드에서 이미 식별·의도적 defer 됨, 상태 불변 | `strip-external-only-fields.ts:84-125` ↔ `websocket.service.ts:266-292` | 계속 추적, `@see` 상호참조는 다음 편집 때 |
| 3 | side_effect | `EXTERNAL_STRIPPED_FIELDS` 가 private → public export 배열로 승격, 런타임 `Object.freeze` 없음(타입 단언 우회 변형 이론상 가능) — 코드베이스 기존 관례와 일치, 실질 위험 낮음 | `strip-external-only-fields.ts:70` | 강제 아님. export 시점에 `Object.freeze` 고려 가능 |
| 4 | side_effect | `stripExternalOnlyFields` 시그니처 1→2 인자 변경 — 전수 grep 으로 stale 1-인자 호출자 없음 확인 완료 | `strip-external-only-fields.ts:80`, 호출부 3곳 + spec 2개 | 조치 불요 |
| 5 | side_effect / api_contract | REST `getStatus` 응답에서 `llmCalls` 필드가 완전히 사라지는 의도된 API 응답 형태 변경 — CHANGELOG·spec(§6.2/R17)에 이미 문서화, 과거 전송 데이터 운영 판단 필요성도 명시됨 | `interaction.service.ts:379,441,445` | 조치 불요 — 문서화 완료 |
| 6 | maintainability | `InteractionService.getStatus` 가 134줄로 다책임(조회/waiting 재구성/terminal 마스킹) — 이 diff 가 새로 만든 문제 아니고 구조 변경도 없음 | `interaction.service.ts:320-454` | 다음에 이 함수를 건드릴 때 waiting 분기 조립을 별도 메서드로 추출 고려 |
| 7 | testing | plan 체크리스트가 이미 커밋(`7fa12301c`)돼 통과 중인 "배열 부분 clone-on-write" 테스트를 여전히 `[ ]` 미착수로 서술 — stale 체크박스 | `plan/in-progress/spec-draft-eia-62-waiting-payload.md:253` ↔ `strip-external-only-fields.spec.ts:48` | 체크박스 `[x]` 갱신 |
| 8 | documentation | spec frontmatter `code:` 글로브(`external-interaction-api.md`, `6-websocket-protocol.md`)에 신규 SoT 파일 `shared/utils/strip-external-only-fields.ts` 경로가 여전히 없음 — 이월 항목(직전 라운드에서 유예) | `spec/5-system/14-external-interaction-api.md:6-13`, `6-websocket-protocol.md:5-11` | 위 WARNING 4 와 함께 처리, CI 비차단이라 급하지 않음 |
| 9 | api_contract | §5.3(REST 단발 조회) 응답 예시/설명 블록에는 strip 사실이 인라인으로 없고 하단 Rationale 에만 서술 — §5.2(SSE) 는 인라인 콜아웃을 갖는 것과 비대칭 | `spec/5-system/14-external-interaction-api.md:433` 부근 vs 786행/1383행 | §5.3 콜아웃에 §5.2 와 동형 문구 추가(급하지 않음) |
| 10 | requirement / scope | 이 diff 의 실질 범위는 `llmCalls` strip 보안 수정 하나이며, 브랜치/plan 제목이 가리키는 "종결(terminal) payload 정리"(`error` 객체화·`durationMs`·`result.outputs`)는 미착수 — 그러나 3개 plan 문서에 명시적으로 기록된 의도적 우선순위 전환이라 스코프 이탈 아님 | `plan/in-progress/eia-terminal-payload.md`, `spec-draft-eia-62-waiting-payload.md` | 조치 불요, 다음 세션에서 `eia-terminal-payload.md` 재개 시 별건 잔여 체크리스트 확인 |
| 11 | requirement | `interaction.service.spec.ts`/`websocket.service.spec.ts` 의 diff 무관 pre-existing 라인에서 `tsc --noEmit` 타입 에러 4~5건 — 이 PR 이전(2026-07-11)부터 존재, jest 는 전부 GREEN | `interaction.service.spec.ts:580,607,823,1081`, `websocket.service.spec.ts:547` | 이 PR 범위 밖, 조치 불요 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | CRITICAL(외부 raw `llmCalls` 유출) 을 WS fanout+REST 세 출구 전부에서 닫음. `__proto__` 오염 방어·경계 연산자 상호작용 실측 검증. 신규 취약점 없음 |
| performance | LOW | `emitNodeEvent` 가 non-AI 대용량 payload 에도 무조건 재귀 strip — worst-case 미측정 (WARNING 1) |
| architecture | LOW | strip+redact 합성 레시피가 절반만 공유 유틸화 — 3번째 표면 재발 여지 (WARNING 2) |
| requirement | LOW | 코드-spec 일치 확인. diff 범위는 문서화된 의도적 우선순위 전환 |
| scope | LOW | 코드 diff 는 단일 결함에 좁게 스코프됨. 표면적 제목 불일치는 문서로 추적됨 |
| side_effect | LOW | non-mutation·`__proto__` 방어·stale 호출자 부재 확인. export 표면 확대는 저위험 |
| maintainability | LOW | 과거 WARNING 전부 해소 재확인. 신규 결함은 INFO 뿐 |
| testing | LOW | REST null-경로 회귀 테스트 부재 (WARNING 3). 나머지 테스트 스위트는 이례적으로 견고 |
| documentation | LOW | plan 완료 선언과 실제 spec 반영 상태 불일치 — §6.2 strip 미문서화 (WARNING 4) |
| concurrency | NONE | 신규 공유 가변 상태·락 없음. 이벤트 루프 점유 증가는 performance WARNING 1 과 동일 근본원인 |
| api_contract | LOW | OpenAPI 스키마 파괴 없음, REST/WS 계약 대칭화. §5.3 발견성 개선 여지만 |
| user_guide_sync | NONE(해당없음) | 매트릭스 20행 전수 검토, 매칭 trigger `spec-major-change` 1건뿐이며 frontmatter 이미 충족. frontend 변경 없음 |

## 발견 없는 에이전트

- security — 신규 취약점 없음(검증 메모만 존재)
- user_guide_sync — 매칭 trigger 없음, "해당 없음" 판정

## 권장 조치사항
1. `spec/5-system/14-external-interaction-api.md` §6.2 에 `llmCalls` strip 명시 캐빗 + `#R17` 역참조 추가, WS §4.4 Rationale 에 수정 이력 addendum, `strip-external-only-fields.ts:9` SoT 목록에 EIA §6.2 추가 — 정작 유출이 실제로 있었던 절에 방어 사실이 문서화되지 않은 갭을 닫는다 (WARNING 4)
2. REST `getStatus` 의 `outputData: null` 경로(waiting/terminal 각 1건 이상)를 회귀 테스트로 고정 (WARNING 3)
3. `stripAndRedact`(strip+redact 합성)를 `shared/utils/` 로 승격해 향후 외부 표면이 필드-삭제만 부르고 값-마스킹을 빠뜨리는 구조적 재발 경로를 차단 (WARNING 2)
4. `emitNodeEvent` 의 대용량 non-AI `nodeOutput`/`inputData` worst-case 를 최소 1회 벤치마크하고 `plan/in-progress/spec-draft-eia-62-waiting-payload.md` 백로그 우선순위를 재평가 (WARNING 1)
5. (저비용) plan 체크박스 stale 항목(`배열 clone-on-write` 테스트 이미 존재) 갱신, spec frontmatter `code:` 글로브에 신규 SoT 파일 경로 추가

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security, performance, architecture, requirement, scope, side_effect, maintainability, testing, documentation, concurrency, api_contract, user_guide_sync` (12명)
  - **제외**: 아래 표 (2명)
  - **강제 포함(router_safety)**: `documentation, maintainability, requirement, scope, security, side_effect, testing` (7명, 전원 결과 확보됨 — 화이트리스트 미이행 없음)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | dependency | 라우터가 이번 diff 스코프에서 신규/변경 의존성 관련 위험 낮다고 판단해 제외 (프롬프트 미상세 사유) |
  | database | 라우터가 이번 diff 스코프에서 스키마/쿼리 변경 관련 위험 낮다고 판단해 제외 (프롬프트 미상세 사유) |