# Code Review 통합 보고서

## 전체 위험도
**LOW** — CRITICAL 0건, WARNING 2건(성능·문서화 각 1건, 둘 다 기능 결함이 아닌 사소한 수치/구조 개선 사항). forced 화이트리스트(documentation, maintainability, requirement, scope, security, side_effect, testing) 전원 결과 확보 완료 — 누락 없음. 이 배치는 이미 5라운드의 `/ai-review`+`--impl-done`을 거친 최종 상태이며, 이번(6번째) 라운드는 신규 CRITICAL을 추가로 찾지 못했다.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 성능 | `where` 필드 검증 테스트가 **같은 파일**을 가리키는 여러 줄 참조에 대해 캐시 없이 매번 `walkTree`로 `codebase/backend/src`(1,304파일) 전체를 재스캔한다. 실측: 현재 등록 3항목 기준 4회 호출 중 3회가 동일 파일(`execution-engine.service.ts`) 재스캔 | `codebase/frontend/src/lib/docs/__tests__/guide-identifier-existence.test.ts:253-267` (walkTree 호출부), `tree-walk.ts:80-102` | `refs`를 `file` 기준으로 중복 제거하거나, 트리를 1회만 순회해 `basename → path[]` 맵을 만들어 재사용. 등록 항목이 늘어나는 방향으로 설계돼 있어 배율이 함께 커질 수 있음(오늘은 낮은 우선순위) |
| 2 | 문서화 | 라운드5가 추가한 설계 근거 주석(JSDoc + 인라인 주석)이 옛 코드의 `.filter()` 체인 호출 횟수를 "네 번/네 개"로 서술하지만 실제 삭제된 코드는 `.filter()` 세 번짜리 체인이었다(offender 판정식의 "네 항"과 필터 호출 횟수를 혼동한 것으로 추정) | `codebase/frontend/src/lib/docs/__tests__/guide-identifier-scan.ts:462-463`, `guide-identifier-existence.test.ts:202` | "네 번/네 개" → "세 번/세 개"로 정정. 결함 진단이나 수정 방향에는 영향 없는 순수 수치 오류 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 요구사항 | spec 6개 파일이 `CONTAINER_MISSING_EMIT`/`CONTAINER_MULTIPLE_EMIT`를 여전히 구조화된 코드처럼 서술 — 이 PR 범위 밖의 spec 내부 문서 간 기존 불일치이며(코드가 spec을 앞서간 SPEC-DRIFT는 아님), 이미 planner 트래커에 등재됨 | `spec/5-system/4-execution-engine.md:332-333`, `spec/3-workflow-editor/2-edge.md:202`, `spec/3-workflow-editor/0-canvas.md:636`, `spec/4-nodes/1-logic/0-common.md:83`, `spec/4-nodes/1-logic/7-map.md:179-180`, `spec/4-nodes/1-logic/9-foreach.md:209-210` | 조치 불필요(PR 범위 밖) — planner가 `plan/in-progress/spec-draft-nullable-notation-followups.md:3446` 등재분 집행 시 §1.4 backfill 여부와 함께 판정 |
| 2 | 요구사항 | `guide-identifier-existence`/`guide-identifier-scan` 가드 패밀리가 `spec/conventions/user-guide-evidence.md §2`의 "Build-time 가드" 표에 미등재(이 PR 이전부터 존재하던 선재 gap) | `spec/conventions/user-guide-evidence.md:68-76` | 조치 불필요(PR 범위 밖, 5라운드 연속 동일 판정) |
| 3 | 아키텍처 | `collectMatches` 제네릭 수집기가 캡처 그룹 위치 인덱스(숫자)에 암묵 결합 — 정규식에 그룹을 추가/재배치해도 컴파일 에러 없이 조용히 잘못된 그룹을 수집할 수 있음 | `guide-identifier-scan.ts:260-266`(정규식 3종), `:281-291`(`collectMatches`), `:373·385·427`(호출부) | 우선순위 낮음 — named capture group(`(?<token>...)`) 전환 시 이 결합 제거 가능. 다음 축 추가 시 고려 |
| 4 | 아키텍처 | 동일 개념(여러 텍스트에서 정규식 매치 전수 수집)에 두 가지 반복 관용구(수동 `lastIndex` 4곳 vs `matchAll` 신규 축)가 공존 — 의도적·문서화·별건 트래커 추적됨 | `guide-identifier-scan.ts:244`(주석), 기존 4곳(`:495·506,509·532·577,585`), 신규(`:281-291`) | 조치 불필요 — 별건 리팩터 실행 시 `collectMatches`로 수렴 권장 |
| 5 | 아키텍처 | 카탈로그 탈출구 분기가 실코퍼스에서 한 번도 발화하지 않음(의도적 확장 지점, `[한계]`/`[대조군]` 테스트로 방어됨) | `guide-identifier-scan.ts:427`(`collectCatalogCodes`), `computeNonEmittedOffenders` 내 필터 항 | 조치 불필요 — backfill 트래커 항목이 최종 won't-do 처분되면 이 분기와 대응 테스트 3개도 제거 대상임을 plan에 후속 조건으로 명시 권장 |
| 6 | 아키텍처 | 테스트 파일이 "존재 축"과 "발행 축" 두 이질적 관심사를 한 파일(900줄+)에 계속 누적 — SRP가 파일 레벨에서 느슨해지는 추세 | `guide-identifier-existence.test.ts` (전체, describe 8개) | 지금 분리 불필요(공유 fixture 재사용 중) — 세 번째 축 추가 시 파일 분리 검토 |
| 7 | 유지보수성 | 신규 합성 진리표 describe 블록의 로컬 상수 `T`가 한 글자 이름 | `guide-identifier-existence.test.ts:547` | 우선순위 낮음 — 이 파일의 기존 관례(`P` 등)와 일관되어 급하지 않음 |
| 8 | 유지보수성 | `computeNonEmittedOffenders`가 `sets` 객체를 스프레드 오버라이드로 3가지 조합 호출 — 축이 늘어나면 오버라이드 조합이 커질 수 있는 지점 | `guide-identifier-scan.ts:471-478`, `guide-identifier-existence.test.ts:206·346-353` | 지금 조치 불필요 — 기존 이월 항목(`classifyToken()` 수렴 검토, 축 추가 시 조건부)의 연장선 |
| 9 | 테스트 | `computeNonEmittedOffenders`의 `new Set` 중복 제거 로직을 겨눈 판별 fixture 없음 — 뮤테이션(`[...citedTokens]`로 치환)이 76/76 GREEN으로 생존함을 직접 실측. 다만 현재 모든 호출부가 존재/멤버십만 검사해 거짓 PASS로 이어지지 않음(진단 품질 저하 가능성만 존재) | `guide-identifier-scan.ts:480`, `guide-identifier-existence.test.ts:539-581` | 급하지 않음 — `[T, T]` 입력에 `toEqual([T])` 단언하는 케이스 하나 추가 시 이 갭이 닫힘 |
| 10 | 성능 | 신규 발행 축 수집기 2종(`collectQuotedLiterals`/`collectMessagePrefixes`)이 기존 `sourceTexts` 코퍼스에 정규식 전체 스캔 2회 추가(파일 I/O 재발생 없음, 모듈 로드 시 1회 고정비용) | `guide-identifier-existence.test.ts:118-119` | 오늘 규모에서 조치 불필요 |

## 확인 후 문제 없음 (참고)

- **보안**: ReDoS 없음(신규 정규식 3종 전부 선형 패턴), 경로 탐색 벡터 없음(하드코딩 경로만 사용), 하드코딩 시크릿 없음, 인증/인가·인젝션·암호화 경로 변경 없음.
- **부작용**: `computeNonEmittedOffenders`는 순수 함수(인자 비변경, 새 배열/Set만 반환), 기존 export 시그니처 무변경, 전역 상태·파일시스템·네트워크·이벤트 부작용 없음.
- **범위**: 실질 코드 변경이 6개 커밋 내내 정확히 2개 파일(`guide-identifier-scan.ts`, `guide-identifier-existence.test.ts`)에 고정, 문서 변경은 목표와 1:1 대응, plan/review 산출물 누적은 저장소 관례와 일치.
- **문서화**: JSDoc 자기모순 개명 이력(`staleGuideEntries`↔`staleEntries`) 정정 재확인, plan 체크박스·CHANGELOG·가드 스위트 카운트("71→76") 전부 실측과 일치.
- **user_guide_sync**: doc-sync-matrix 21개 trigger 전수 재확인 — 누락된 동반 갱신 0건. `CONTAINER_MISSING_EMIT`/`CONTAINER_MULTIPLE_EMIT`는 구조화된 error/warning code가 아니므로 `backend-labels.ts` 동반 갱신 의무 자체가 성립하지 않음.

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | ReDoS/경로탐색/시크릿/인증 변경 없음 — dev-tooling 전용 |
| performance | LOW | `where` 검증 테스트의 동일 파일 반복 전체 트리 스캔(WARNING 1건) |
| architecture | LOW | 캡처그룹 위치 결합·반복 관용구 공존·카탈로그 탈출구 미발화 등 INFO 다수(모두 방어됨) |
| requirement | NONE | 신규 CRITICAL/WARNING 없음, pre-existing spec 갭 2건은 PR 범위 밖·이미 등재 |
| scope | NONE | 실질 코드 2파일 고정, 스코프 이탈 없음 |
| side_effect | NONE | 순수 함수, mutation 없음 |
| maintainability | LOW | `computeNonEmittedOffenders` 정본 추출은 긍정적 개선, 사소한 네이밍/조합폭발 우려만 INFO |
| testing | NONE | dedup 로직 뮤테이션 생존하나 거짓PASS 위험 없어 INFO 처리 |
| documentation | LOW | 라운드5 신규 주석의 `.filter()` 호출 횟수 서술 오류(WARNING 1건) |
| user_guide_sync | NONE | doc-sync-matrix 21행 전수 확인, 누락 0건 |

## 발견 없는 에이전트

security, scope, side_effect, user_guide_sync — 모두 "확인 후 문제 없음" 성격의 항목만 보고, 조치가 필요한 발견사항 없음.

## 권장 조치사항

1. `guide-identifier-existence.test.ts`의 `where` 검증 루프가 동일 파일을 가리키는 참조에 대해 `walkTree` 전체 트리 스캔을 중복 실행하지 않도록 파일명 기준 캐시/중복 제거를 적용한다(WARNING #1).
2. `computeNonEmittedOffenders` JSDoc과 인접 인라인 주석의 "옛 `.filter()` 체인 네 번/네 개" 서술을 "세 번/세 개"로 정정한다(WARNING #2).
3. (급하지 않음) `computeNonEmittedOffenders`의 `new Set` 중복 제거를 겨눈 판별 fixture(`[T, T]` → `toEqual([T])`)를 추가해 남은 뮤테이션 갭을 닫는다.
4. (급하지 않음) `collectMatches` 캡처 그룹 인덱스를 named capture group으로 전환해 정규식-호출부 간 암묵적 위치 결합을 제거한다 — 다음 발행 축 추가 시 함께 고려.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: security, performance, architecture, requirement, scope, side_effect, maintainability, testing, documentation, user_guide_sync (10명)
  - **제외**: 표 참조 (4명)
  - **강제 포함(router_safety)**: documentation, maintainability, requirement, scope, security, side_effect, testing — 전원 결과 확보 완료(누락 없음)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | dependency | router 판단상 이번 변경(테스트/문서 전용)과 무관 |
  | database | router 판단상 DB 계층 변경 없음 |
  | concurrency | router 판단상 동시성 관련 코드 변경 없음 |
  | api_contract | router 판단상 API 계약 변경 없음 |