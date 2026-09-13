# Code Review 통합 보고서

## 전체 위험도
**MEDIUM** — 기능적 결함(CRITICAL)은 없음. 새 "발행 축" 자체는 GREEN 이고 mdx 문장 정정도 실측과 정확히 일치하지만, (1) 이 PR 이 실제로 완료한 트래커 항목 체크박스 미갱신, (2) 같은 세션 consistency-check 가 "별도 plan 항목 등재"를 명시 권고한 WARNING 2건이 plan 에 반영되지 않음, (3) 핵심 회귀 테스트의 근거 서술이 실제 실행 경로와 다름 — 이 세 건이 겹쳐 MEDIUM 으로 판정. forced 화이트리스트(7명) 전원 결과가 확보되어 라우팅 누락은 없음.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | documentation | 이 PR 이 실제로 완료한 트래커 항목의 체크박스가 갱신되지 않음 — `CONTAINER_MISSING_EMIT`·`CONTAINER_MULTIPLE_EMIT` 문장 정정(선택지 A)을 이번 PR 이 정확히 수행했는데 원 트래커 항목은 여전히 `[ ]` | `plan/in-progress/spec-draft-nullable-notation-followups.md:3404` | `[x]` 로 체크 + "error-code-emission-axis 배치에서 (A) 문장 정정으로 해소" 근거 한 줄 추가. `error-code-emission-axis.md` 도입부 "닫는다" 목록에도 함께 명시 |
| 2 | documentation | 같은 세션 consistency-check 의 WARNING #2(spec 7곳 "메시지/코드" 표기 혼용 통일 + `3-error-handling.md §1.4` 각주 backfill)·#3(§D "코드가 아니다" 서술이 §1.4 앵커-없는 카탈로그 코드 취급 관행과 어긋남) 이 각각 "별도 plan 항목으로 등재" 를 명시 권고했으나 `plan/` 어디에도 옮겨지지 않음 — `review/**` 는 SoT 가 아니라는 저장소 원칙 위반 | `review/consistency/2026/09/13/18_40_54/SUMMARY.md` WARNING #2·#3, `cross_spec.md`, `rationale_continuity.md` | WARNING #1 이 이미 등재된 방식과 동일하게, `spec-draft-nullable-notation-followups.md`(또는 신규 plan 항목)에 #2·#3 각각 한 줄씩 등재 |
| 3 | requirement | `MAX_ITERATIONS_EXCEEDED` "[회귀]" 테스트/JSDoc 이 "카탈로그 덕에 통과한다"고 서술하지만, 실측 결과 이 토큰은 소비자 Set(`execution-failure-classifier.ts`) 에 정확 리터럴로 인용되어 `isMessagePrefixOnly` 단계에서 이미 `false` 가 되므로 카탈로그 검사에 도달하지 않음 — 이 축이 스스로 "함정"이라 이름 붙인 소비자-인용 경로 때문에 통과하는 것 | `guide-identifier-existence.test.ts:200`, `guide-identifier-scan.ts:379-381` (JSDoc), 실제 로직 `execution-failure-classifier.ts:76` | 테스트 제목/JSDoc 을 "소비자 Set 의 정확-리터럴 인용 때문에 카탈로그 단계에 도달하지 않는다"로 정정. `quotedLiterals`/카탈로그 각각이 단독으로 offenders 를 걸러내는 사례(또는 0건이라는 사실)를 vacuity 절에 명시 |
| 4 | requirement | 신규 `GUIDE_NON_EMITTED_VOCABULARY` 가 스스로 "거울상"이라 부르는 `GUIDE_EXTERNAL_VOCABULARY` 대비 강제 항목이 2개(상한, "여전히 인용되는가" 죽은-등록 방지) 부족 — 가이드 문장이 재작성돼 토큰 인용이 사라져도 등록이 무한정 누적될 수 있음 | `guide-identifier-scan.ts:287-329`, `guide-identifier-existence.test.ts:171-198` | `GUIDE_EXTERNAL_VOCABULARY_CAP` 대칭 상한 상수 추가 + "여전히 가이드에 인용되는가" 죽은-항목 검사 추가 |
| 5 | testing | 신규 수집기 3종(`collectQuotedLiterals`/`collectMessagePrefixes`/`collectCatalogCodes`)에 형제 함수(`collectSourceTokens`/`collectEnvDeclarations`) 수준의 손으로 짠 경계 대조군이 없음 — 역참조 제약(따옴표 불일치), 콜론+공백 요구, 백틱-only 조건이 합성 fixture 로 고정되지 않고 실제 코퍼스 통계·이름-하나짜리 회귀 케이스에만 의존 | `guide-identifier-existence.test.ts` (전체, 대응 `describe` 0건), `guide-identifier-scan.ts:344,361,383,260,263,266` | 형제 함수와 같은 형태로 `describe("… — 경계 대조군")` 추가, "두 판정이 갈리는 값"(불일치 따옴표/콜론 유무/공백 유무/백틱 유무)을 명시적으로 고정 |
| 6 | testing | `GUIDE_NON_EMITTED_VOCABULARY` 의 `where` 필드(소스 위치 근거)가 assertion 으로 뒷받침되지 않는 프리텍스트 — 소스가 이동해도 테스트가 못 잡아 조용히 stale 해질 수 있음. 이 저장소는 같은 클래스 문제를 다른 축(`impl-anchor-existence.test.ts`)에선 이미 grep 강제로 막고 있어 이 목록만 예외 | `guide-identifier-scan.ts:308-329` | `where` 의 `file:line` 을 파싱해 해당 줄에 토큰이 실제 등장하는지 grep 검증하는 테스트 추가(최소한 파일명 존재만이라도) |
| 7 | maintainability | 신규 수집 함수 3종이 정규식/capture-group 인덱스만 다를 뿐 구조가 완전히 동일한 근접 중복 — 바로 옆 주석에서 "lastIndex 보일러플레이트 중복을 피한다"고 밝힌 직후에 다른 형태의 중복이 도입됨. 네 번째 축 추가 시 중복이 더 늘어날 위험 | `guide-identifier-scan.ts:344`(`collectQuotedLiterals`), `:361`(`collectMessagePrefixes`), `:383`(`collectCatalogCodes`) | `function collectMatches(texts, rx, group): Set<string>` 공유 헬퍼로 추출, 세 함수는 그 위 얇은 래핑으로 대체 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | side_effect / testing | 카탈로그 SoT(`spec/5-system/3-error-handling.md`) 읽기가 형제 필드(`envExampleTexts`)와 달리 `readIfPresent` 존재 가드 없이 하드 `fs.readFileSync` — 파일 이동 시 스위트 전체가 ENOENT 로 죽음. 다만 같은 파일 내 다른 스위트(`guide-sanitized-message-parity.test.ts`)의 기존 관행과 일치 | `guide-identifier-existence.test.ts:82-87` | 조치 불요(기존 관행). 강화하려면 `readIfPresent` 로 통일하거나 최소 주석으로 "의도적 하드 실패" 명시 |
| 2 | maintainability | 같은 파일 안에 정규식 매치 수집의 두 관용구(`matchAll` vs 수동 `lastIndex`+`exec`)가 공존 — 다섯 번째 축 추가 시 어느 쪽을 따라야 할지 문서를 읽어야 알 수 있음 | `guide-identifier-scan.ts` 전체 | 조치 불요, plan/consistency 세션에 이미 교차 기록됨 |
| 3 | maintainability | `GUIDE_NON_EMITTED_VOCABULARY`/`GUIDE_EXTERNAL_VOCABULARY` 이름이 한 토큰만 다르고 제약은 정반대 — JSDoc 대조표로 오독 위험은 완화돼 있음 | `guide-identifier-scan.ts:275,308` | 세 번째 "거울상" 목록 추가 시 대조표 동반 갱신 |
| 4 | maintainability | 신규 테스트 vacuity 하한(`10`,`30`)이 이름 있는 상수 없이 리터럴, 자매 검사(`2`,`20`)와 값이 다른데 근거 미기재 | `guide-identifier-existence.test.ts:191-192` | 이름 있는 상수로 추출 고려 |
| 5 | documentation | `GUIDE_NON_EMITTED_VOCABULARY` 의 `CONTAINER_MULTIPLE_EMIT` 항목만 `where` 에 줄 번호가 없음("형제 접두"로만 서술, 실제로는 7130행 단일 지점) — 형제 항목(`CONTAINER_MISSING_EMIT`)은 정확한 줄 번호를 지목 | `guide-identifier-scan.ts` (`GUIDE_NON_EMITTED_VOCABULARY`) | `where: "execution-engine.service.ts:7130 — 형제 접두"` 로 보강 |
| 6 | documentation / SPEC-DRIFT | CHANGELOG 의 정밀 표현("구조화된 코드로는 발행되지 않는다")과 가이드 본문(logic.mdx/logic.en.mdx)의 단순화 표현("코드가 아니라"/"rather than the code") 간 격차 — 사용자 가이드 수준에서는 단순화가 실용적으로 정확하나(`finalizeFailedExecution` 이 두 sentinel 타입만 `.error.code` 보존), §1.4 카탈로그가 앵커 없는 문자열을 "코드"로 취급해 온 관행과의 용어 정합(§1.4 backfill)이 아직 plan 미등재 | `CHANGELOG.md` vs `logic.mdx:114`/`logic.en.mdx:103` | 위 WARNING #2(§1.4 backfill) 항목 등재 시 함께 처리, 신규 조치 불요 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 런타임/시크릿/인가 영향 없음, 신규 정규식 ReDoS 안전(재사용 패턴+겹치지 않는 정량자) |
| requirement | MEDIUM | `MAX_ITERATIONS_EXCEEDED` 회귀 테스트 근거 서술이 실제 실행 경로와 다름, `GUIDE_NON_EMITTED_VOCABULARY` 강제 항목이 거울상 목록보다 2개 적음 |
| scope | NONE | 16개 변경 파일 전부 plan 체크리스트와 1:1 대응, 무관한 리팩터/포맷팅 없음 |
| side_effect | NONE | 신규 함수 순수함수, `matchAll` 사용으로 공유 `lastIndex` 오염 회피, 전역상태/네트워크/env 변경 없음 |
| maintainability | LOW | 수집기 3종 근접 중복(공유 헬퍼 미추출), 그 외는 기존 관례와 일관 |
| testing | LOW | 신규 수집기 3종에 형제 함수 수준 합성 경계 대조군 부재, `where` 필드 미검증 프리텍스트 |
| documentation | MEDIUM | 완료된 트래커 체크박스 미갱신, consistency WARNING 2건이 plan 에 미등재(SoT 소실 위험) |

## 발견 없는 에이전트

security, scope, side_effect — 조치가 필요한 WARNING/CRITICAL 없음(전부 INFO 또는 확인 후 "문제 없음").

## 권장 조치사항

1. `plan/in-progress/spec-draft-nullable-notation-followups.md:3404` 체크박스를 `[x]` 로 갱신하고 완료 근거를 추가한다 (documentation #1).
2. 같은 세션 consistency-check WARNING #2(spec 7곳 메시지/코드 표기 통일 + `§1.4` backfill)·#3(§D "코드가 아니다" 서술 정정)을 plan tracker 에 각각 등재한다 (documentation #2) — `review/**` 는 SoT 가 아니므로 지금 옮기지 않으면 소실된다.
3. `MAX_ITERATIONS_EXCEEDED` "[회귀]" 테스트 제목과 `collectCatalogCodes` JSDoc 을 실제 메커니즘(소비자 Set 정확-리터럴 인용)으로 정정한다 (requirement #3).
4. `GUIDE_NON_EMITTED_VOCABULARY` 에 상한 상수 + "여전히 가이드에 인용되는가" 죽은-항목 방지 테스트를 추가해 `GUIDE_EXTERNAL_VOCABULARY` 와 강제 수준을 대칭시킨다 (requirement #4).
5. `collectQuotedLiterals`/`collectMessagePrefixes`/`collectCatalogCodes` 각각에 형제 함수 수준의 합성 경계 대조군(fixture)을 추가한다 (testing #5).
6. `GUIDE_NON_EMITTED_VOCABULARY` 의 `where` 필드를 `file:line` 파싱 후 grep 검증하는 테스트를 추가한다 (testing #6).
7. 신규 수집 함수 3종을 공유 헬퍼(`collectMatches(texts, rx, group)`)로 추출해 근접 중복을 제거한다 (maintainability #7).

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security, requirement, scope, side_effect, maintainability, testing, documentation` (7명, 전원 forced)
  - **강제 포함(router_safety)**: `documentation, maintainability, requirement, scope, security, side_effect, testing` (7명 전원 — forced 화이트리스트 전원 결과 확보됨, 미이행 없음)
  - **제외**: 아래 표 (7명)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | router 판단상 이번 diff(문서/테스트/스캐너 정적 로직)에 성능 영향 표면 없음 |
  | architecture | 아키텍처 구조 변경 없음(테스트 파일 내 함수 추가) |
  | dependency | 의존성 변경 없음 |
  | database | DB 접근 코드 변경 없음 |
  | concurrency | 동시성 관련 코드 변경 없음 |
  | api_contract | API 계약 변경 없음 |
  | user_guide_sync | 가이드 문장 변경은 있으나 router 가 documentation/requirement 로 충분히 커버 판단 |