# Code Review 통합 보고서

## 전체 위험도
**LOW** — Critical 0건, WARNING 1건(테스트 타이틀의 `%s` placeholder 개수 불일치, 기능 영향 없음). 이번 라운드(`16_29_50`)의 실질 코드 델타는 직전 라운드(`15_58_26`) WARNING 4건에 대한 처방 커밋 2개(`dfc63bbb7`, `a78ab029e`)뿐이며, strip/redact 핵심 로직 자체는 변경되지 않았다. forced(router_safety) 화이트리스트 7명(`documentation`, `maintainability`, `requirement`, `scope`, `security`, `side_effect`, `testing`) 전원 결과 확보 확인 — 강제 목록 미이행 없음.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | documentation | `it.each` 테스트 타이틀의 `%s` placeholder 가 2개인데 배열 원소는 3개(`_label`, `status`, `field`)라, 렌더링된 테스트 설명이 의도와 다르게 나온다(`util.format` 이 두 번째 `%s` 에 `status` 를 채우고 `field` 는 문자열 뒤에 그대로 붙음). 단언 로직(`r[field]`) 자체는 정확해 기능적 결함은 아니나, "실행 결과가 서술과 일치해야 한다"는 이 프로젝트의 반복 원칙(과거 `10_32_27`/`12_06_20` 라운드에서도 같은 클래스 지적)이 신규 테스트에서 재발했다 | `codebase/backend/src/modules/external-interaction/interaction.service.spec.ts:717` | 타이틀 placeholder 개수를 실제 인자 수(3)에 맞추거나, 바로 위(668행) 자매 블록처럼 `%s` 1개만 남기고 `_label` 만 사용하도록 통일 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 범위/스코프 | 이번 라운드 신규 델타는 직전 라운드 WARNING 4건(§6.2 방어 미문서화, null 분기 미검증, 공용 헬퍼 JSDoc 보강, 대용량 payload 미측정)에 대한 처방 커밋 2개뿐이며 전부 문서·테스트 순수 추가, strip 로직(`stripDeep`) 자체는 한 글자도 안 바뀜 (security/architecture/scope/maintainability/api_contract 공통 확인) | 전체 diff (`dfc63bbb7`, `a78ab029e`) | 조치 불요 |
| 2 | 보안 (핵심 결함) | WS fanout(`emitExecutionEvent`/`emitNodeEvent`) + REST `getStatus()` 세 출구(waiting `nodeOutput`/terminal `result`/`error`) 모두 공유 헬퍼로 통일돼 이름 기반·깊이 무관 strip 이 적용됨을 소스·테스트 재실행(150/150 통과)으로 재확인. `__proto__` 오염 방어(스프레드+`defineProperty`), 경계 연산자(`>`) 자매 일치도 유지됨 | `strip-external-only-fields.ts`, `websocket.service.ts`, `interaction.service.ts` | 조치 불요(positive finding) |
| 3 | 성능 | `stripDeep` 이중 전체 순회(+61ms/2.56배 @6.5MB, 선형·이차항 없음) 및 자매 `SANITIZE_CACHE` 대응 identity 캐시 부재는 실측 근거와 함께 3라운드 연속 의도적으로 유예됨("보안 수정 우선, 성능은 관측 후 재평가") | `strip-external-only-fields.ts`, `websocket.service.ts` | 조치 불요 — APM 관측 후 우선순위 재평가 |
| 4 | 아키텍처 | 재귀 트리 순회(clone-on-write) 골격이 `stripDeep`/`sanitizeInner`/`deepRedactObject` 3곳에 독립 구현 중복 — `11_02_16`에서 이미 의도적 defer 합의됨 | `strip-external-only-fields.ts` ↔ `websocket.service.ts` ↔ `sanitize-error-message.ts` | 다음에 셋 중 하나를 실질적으로 만질 때 공통 고차함수 추출 재검토 |
| 5 | 아키텍처 | `maxDepth` 인자와 경계 연산자가 자매 상수와 "짝을 맞춰야 한다"는 불변식이 타입이 아닌 JSDoc 컨벤션+테스트로만 강제됨(현재 호출부 2곳은 올바름) | `strip-external-only-fields.ts` | 3번째 외부 표면 추가 시 정적 강제 장치(타입/헬퍼) 재고 |
| 6 | 유지보수성 | `strip-external-only-fields.ts` 모듈 JSDoc 이 매 라운드 절을 추가하며 계속 비대화(현재 주석:코드 ≈1.6:1) — `10_32_27`부터 6라운드째 추세, 이미 유예된 항목 | `strip-external-only-fields.ts:1-90` | 다음 수정 시 근거 서사를 spec Rationale/decision-log로 분리하고 JSDoc엔 포인터만 남기는 것 고려 |
| 7 | 유지보수성 | JSDoc 이 `review/code/**` 라운드 타임스탬프를 근거로 인용하는데 `review/`엔 보존 정책이 없어(plan/spec과 달리 lifecycle 대상 아님) 향후 정리/스쿼시 시 dangling 참조 위험 | `strip-external-only-fields.ts:35,42` | `review/` 아카이브 작업 착수 시 인용 파일 목록 우선 점검 |
| 8 | 유지보수성 | 신규 null 분기 `it.each` 가 기존 fixture 배열 리터럴(`['completed', ExecutionStatus.COMPLETED, 'result']` 등)을 30여 줄 간격으로 다시 손으로 타이핑 — 소규모 중복 | `interaction.service.spec.ts:669-670`, `:714-715` | 3번째 이상 반복 시 모듈 상단 상수로 추출 |
| 9 | side_effect | `stripExternalOnlyFields` 가 module-private → exported 유틸로 승격되며 시그니처 변경(1→2 인자)됐으나 저장소 전체 grep 결과 호출자는 diff 안에서 전부 함께 갱신돼 breaking 영향 없음. `InteractionService.getStatus()` REST 응답에서 `llmCalls` 가 사라지는 것은 의도된 보안 수정(CHANGELOG 명시)이나 이를 파싱하던 외부 통합자가 있다면 조용히 값이 사라짐 | `strip-external-only-fields.ts:101`, `interaction.service.ts:379,441,445` | 조치 불요(의도된 변경, 이미 문서화됨) |
| 10 | api_contract | §5.3(REST 단발 상태 조회) 본문에 `llmCalls` strip 사실이 인라인으로 없음 — 이번 두 커밋이 §6.2(webhook 페이로드) 절만 갱신해 `15_58_26`부터 이월된 발견성 이슈 | `spec/5-system/14-external-interaction-api.md` §5.3 vs 신규 §6.2 blockquote(`:687-691`) | 급하지 않음 — 다음 §5.3 편집 시 "구현 상태 (V1)" 콜아웃 근처에 한 줄 추가 권고 |
| 11 | documentation | `websocket.service.spec.ts:15` 공유 헬퍼 JSDoc 에 한국어 관례와 어긋나는 일본어 문구 잔존(pre-existing, 이번 diff 밖, `git log -S` 로 기존 커밋 확인) | `websocket.service.spec.ts:15` | 다음에 이 헬퍼를 만질 때 한국어로 통일 |
| 12 | 보안/운영 | 결함이 존재했던 기간 동안 이미 fanout·REST 로 나간 raw 데이터는 이번 수정으로 회수되지 않음 — 코드 결함이 아닌 운영 판단 사안이며 CHANGELOG 에 이미 명시됨 | `CHANGELOG.md` Unreleased 절 | 코드 조치 불요. 워크스페이스별 키/토큰 로테이션 등 운영 대응 여부는 별도 판단 |
| 13 | user_guide_sync | doc-sync-matrix 21개 trigger 및 근접 후보 3개(`backend-api-change`, `run-debug-flow-change`, spec 정합) 전수 대조 결과 동반 갱신 대상 없음 — frontend 미변경, DTO 는 애초에 자유형식(`Record<string, unknown>`)이라 열거 계약 없음 | `.claude/config/doc-sync-matrix.json`, `02-nodes/triggers.mdx` | 조치 불요 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 핵심 보안 결함(depth-1 strip 우회로 인한 `llmCalls` 노출) 완전 해소 재확인, 신규 이슈 없음 |
| performance | LOW | 이중 전체 순회·identity 캐시 부재는 기존 실측·유예 항목 재확인, 이번 라운드 신규 변경 없음 |
| architecture | NONE | 구조 개선(공용 leaf 유틸 승격, REST 3출구 단일 헬퍼화) 확인, 저위험 관찰 2건(중복 스켈레톤 defer, 타입 미강제) |
| requirement | NONE | 요구사항(WS fanout+REST 3출구 대칭 strip) 완전 충족, 소스·spec·테스트 line-level 일치 확인 |
| scope | NONE | 신규 델타는 직전 WARNING 4건 처방에 정확히 스코프됨, 무관 변경 없음 |
| side_effect | LOW | 시그니처 변경은 호출자 전원 갱신돼 영향 없음, REST 응답 변화는 의도된 수정 |
| maintainability | LOW | JSDoc 비대화 추세(유예 중), 소규모 fixture 중복 1건 |
| testing | NONE | null 분기 회귀 테스트 신규 추가·판별력 뮤테이션으로 확인, 5 suites/150 tests 통과 재실행 |
| documentation | LOW | `it.each` 타이틀 `%s` placeholder 불일치 1건(WARNING), 그 외 문서 정합 우수 |
| api_contract | LOW | 응답 계약 breaking change 없음, §5.3 발견성 이슈 이월(INFO) |
| user_guide_sync | NONE | doc-sync-matrix 전수 대조 결과 동반 갱신 대상 없음 |

## 발견 없는 에이전트

없음 — 전 11개 에이전트가 최소 1건 이상 기록했으나, 대다수는 positive finding/재확인성 INFO이며 실질 조치가 필요한 항목은 documentation 의 WARNING 1건뿐이다.

## 권장 조치사항
1. `interaction.service.spec.ts:717` 의 `it.each` 타이틀 `%s` placeholder 개수를 실제 인자 수(3)에 맞추거나 1개로 통일한다(documentation WARNING).
2. (선택, 급하지 않음) `spec/5-system/14-external-interaction-api.md` §5.3 에 `llmCalls` strip 사실을 인라인 한 줄로 보강한다.
3. (선택) `websocket.service.spec.ts:15` 의 일본어 JSDoc 문구를 다음 수정 시 한국어로 통일한다.
4. (모니터링) `stripDeep` 이중 순회 비용과 identity 캐시 부재는 이미 실측·유예된 사안이므로 APM 관측 지표가 쌓이면 우선순위를 재평가한다.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security`, `performance`, `architecture`, `requirement`, `scope`, `side_effect`, `maintainability`, `testing`, `documentation`, `api_contract`, `user_guide_sync` (11명)
  - **제외**: 아래 표 (3명)
  - **강제 포함(router_safety)**: `documentation`, `maintainability`, `requirement`, `scope`, `security`, `side_effect`, `testing` (7명) — 전원 결과 확보 확인, 미이행 없음

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | dependency | 이번 diff 에 신규/변경 패키지 의존성 없음(router 판단) |
  | database | 이번 diff 에 스키마/쿼리 변경 없음, 순수 in-memory 객체 변환(router 판단) |
  | concurrency | 이번 diff 에 동시성/락/트랜잭션 관련 코드 변경 없음(router 판단) |