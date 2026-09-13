# Code Review 통합 보고서

## 전체 위험도
**MEDIUM** — Critical 은 없다. `CHANGELOG.md` 가 이 배치 자신이 라운드 1에서 반증한 틀린 메커니즘 설명을 그대로 남겨 같은 항목 안에서 자기모순을 이루고 있고(documentation·requirement 중복 지적), 신규 발행 축 가드에 판별력이 낮은 테스트 갭 2건(`where` 다중 위치 검증 누락, 핵심 술어 합성 대조군 부재)이 뮤테이션으로 확인됐다. 모든 forced reviewer(`documentation`·`maintainability`·`requirement`·`scope`·`security`·`side_effect`·`testing`) 결과는 정상 확보됐다 — 강제 화이트리스트 미이행 없음.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Documentation / Requirement | `CHANGELOG.md` 가 라운드 1에서 반증된 `MAX_ITERATIONS_EXCEEDED` 통과 메커니즘("카탈로그가 정식 코드로 인정해서 통과")을 그대로 남겨, 같은 항목의 바로 다음 문단("소비자·분류기 목록의 인용 때문에 통과")과 서로 모순된다. 코드(`collectCatalogCodes` JSDoc)·테스트 제목·plan §E 는 모두 정정됐는데 CHANGELOG 만 반영되지 않음 | `CHANGELOG.md:19-21` (모순 대상: `:23-26`) | 해당 문단을 "잔여 한계" 문단과 같은 방향(소비자-인용이 원인, 카탈로그는 오늘 한 번도 발화하지 않음)으로 재작성해 자기모순 제거 |
| 2 | Testing | 신규 "`where` 프리텍스트 방지" 검증이 정규식 단일 매치(`.exec`, 전역 플래그 없음)만 써서, `where` 필드가 **복수 위치**를 인용하는 항목(`CONTAINER_MISSING_EMIT` — `7121·7125`)의 **둘째 위치(7125)는 한 번도 검증되지 않는다**. 뮤테이션으로 확인: 둘째 줄 번호를 존재하지 않는 값으로 바꿔도 63/63 GREEN 그대로 | `guide-identifier-existence.test.ts:202-231`, 대상 데이터 `guide-identifier-scan.ts:346` | `.exec()` 대신 `matchAll`로 `where` 안 모든 `파일:줄` 쌍을 걷어 각각 grep 검증하거나, 등록 규약을 단일 위치로 좁힐 것 |
| 3 | Testing | 발행 축의 핵심 게이트 술어 `isMessagePrefixOnly`(`messagePrefixes.has(token) && !quotedLiterals.has(token)`)에 직접 겨눈 합성 진리표 대조군이 없다. 뮤테이션(AND 항 제거)은 RED 를 내지만 "8종 offender 폭증"이라는 뭉툭한 진단이고, `(F,T)`·`(F,F)` 조합은 어떤 테스트에서도 직접 관측되지 않아 약화 형태 뮤턴트는 통과할 여지가 있음(미확정, 우려) | `guide-identifier-existence.test.ts:98-100`(정의부) | `isMessagePrefixOnly` 를 `guide-identifier-scan.ts` 로 export 하고 네 조합(진리표)을 합성 문자열로 직접 고정하는 대조군 `describe` 추가 |
| 4 | Maintainability | 직전 라운드에서 고친 것과 같은 클래스의 근접 중복이 테스트 파일에 재발 — "여전히 인용되는가(죽은 등록 방지)" 판정 3줄짜리 로직이 `GUIDE_NON_EMITTED_VOCABULARY`용·`GUIDE_EXTERNAL_VOCABULARY`용 두 `it()` 에 그대로 복제됨 | `guide-identifier-existence.test.ts:242-249`, `:363-367` | `assertAllCited(list)` 지역 헬퍼로 추출해 두 `it()` 가 호출만 하도록 정리 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Architecture | 발행 축 핵심 분류 술어(`isMessagePrefixOnly`)와 offenders 필터 체인이 스캐너 모듈이 아니라 테스트 파일에만 존재 — 존재 축이 확립한 "스캐너가 판정 로직 소유" 관례와 불일치, 재사용·격리 유닛테스트 불가 | `guide-identifier-existence.test.ts:98-100`, `:161-167` | 스캐너 모듈로 export 이전 (WARNING #3 조치와 동일 작업으로 묶어서 처리 가능) |
| 2 | Architecture | 거울상으로 문서화된 두 허용목록(`GUIDE_EXTERNAL_VOCABULARY`/`GUIDE_NON_EMITTED_VOCABULARY`)이 공통 필드(`token`/`why`)를 공유하지만 타입 수준 공유 인터페이스가 없음 | `guide-identifier-scan.ts:300-310`, `:333-338` | 세 번째 거울상 목록이 생기는 시점에 공유 베이스 인터페이스로 추출 고려 |
| 3 | Architecture | 발행 축 "위반" 판정이 세 독립 예외 채널(존재축 allowed·카탈로그·발행축 등록목록)의 체인 합성 — 이번 배치 자신의 리뷰 라운드에서 채널 간 상호작용 오판이 실제로 한 번 발생함 | `guide-identifier-existence.test.ts:161-167` | 축 추가 시 단일 `classifyToken()` 판정 함수로 수렴 검토 |
| 4 | Maintainability | `where` grep 검증(정규식 파싱+트리 탐색+줄 포함 확인) 30줄이 이름 있는 헬퍼로 추출되지 않고 `it()` 안에 인라인 — 자매 파일(`impl-anchor-existence.test.ts`) 관용구(모듈 최상위 헬퍼+독립 유닛테스트)와 다름 | `guide-identifier-existence.test.ts:202-231` | `parseWhereRef()` 로 분리하고 파싱 실패·다중 매치·불일치 대조군 추가 |
| 5 | Maintainability | `GUIDE_NON_EMITTED_VOCABULARY` 등록 항목 수만큼 루프 내부에서 `walkTree(codebase/backend/src)` 를 반복 호출(루프 불변 연산 미분리). 상한 5건으로 강제돼 현재 실질 비용은 낮음 | `guide-identifier-existence.test.ts:207-217` | 상한 유지되는 한 급한 조치 아님, 참고만 |
| 6 | Maintainability | vacuity 하한값이 자매 검사와 다름(`10`/`30` vs `2`/`20`)이고 근거 주석 없음 — 라운드 1에도 지적됐고 그대로 남음 | `guide-identifier-existence.test.ts:197-198` vs `:351-352` | 저위험, 교차 기록만 |
| 7 | Side Effect | 신규 카탈로그 하드 리드(`spec/5-system/3-error-handling.md`)가 describe 최상위(모듈 평가 시점)에서 실행돼, 파일이 사라지면 스위트 전체가 개별 실패가 아니라 일괄 collection-error 로 죽음. 기존 관행의 확장(직전 라운드에서 이미 조치 불요로 처분) | `guide-identifier-existence.test.ts` describe 콜백 최상위 | 신규 조치 불요, 기존 하드 리드 전체 정리 시 함께 처리 |
| 8 | Performance | `matchAll` 채택으로 정규식 객체가 파일마다(500+ 소스 파일 × 2 정규식) 재클론됨 — 공유 `lastIndex` 오염을 피하기 위한 의도적·문서화된 트레이드오프, 테스트 전용 코드라 실질 영향 미미 | `guide-identifier-scan.ts` `collectMatches`(281-291) 호출부 | 조치 불요, 코퍼스가 크게 늘거나 5번째 축이 추가될 때 `lastIndex` 재사용 방식 재검토 |
| 9 | Scope | 리뷰/일관성-검토 산출물 27개(`review/code/19_23_22/**`, `review/consistency/{18_40_54,19_23_31}/**`) 및 별개 트래커 `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 3건 추가 — CLAUDE.md 의무 게이트 산출물/정상 트래커 반영으로 스코프 이탈 아님 | 해당 경로 전체 | 조치 불요 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | dev-time 정적 스캐너만 변경, 프로덕션 런타임/인증/DB/네트워크 无영향. 신규 정규식 ReDoS 불가 구조적으로 확인 |
| performance | NONE | I/O 없음(기존 적재 재사용), describe 최상위 1회 계산, `matchAll` 재클론은 미세 트레이드오프 |
| architecture | LOW | 발행 축 판정 로직 소유권이 테스트 파일에 있음, 거울상 목록 타입 미공유, 3-채널 판정 체인 누적(모두 INFO) |
| requirement | LOW | 기능 요구사항은 line-level 로 정확히 구현·검증(63/63 GREEN). `CHANGELOG.md` 자기모순 1건(WARNING, documentation과 중복) |
| scope | NONE | 36개 파일 전부 plan 체크리스트/게이트 산출물/기존 트래커에 1:1 대응, 스코프 이탈 없음 |
| side_effect | NONE | 순수함수·읽기전용 I/O만, 상태변경/시그니처변경/네트워크 없음. 카탈로그 하드 리드 기존 관행 반복(INFO) |
| maintainability | LOW | 직전 라운드 중복 해소는 모범적이나 같은 커밋이 테스트 파일에 같은 클래스 중복 재발(WARNING) + INFO 3건 |
| testing | LOW | 라운드1 WARNING 2건은 실제로 해소됐으나 그 fix 자체가 새 갭 2건(where 다중매치, 핵심 술어 무대조군) 생성 |
| documentation | MEDIUM | `CHANGELOG.md` 가 이 PR 자신이 반증한 주장을 그대로 남겨 같은 항목 안에서 자기모순(WARNING). 그 외 라운드1 지적 4건은 전부 해소 확인 |
| user_guide_sync | NONE | doc-sync-matrix 21행 전수 대조, backend 소스 변경 0건이라 대부분 트리거 미성립, GUI-flow/spec-defect 후보 2건도 실측 후 미해당/이관 불요 확정 |

## 발견 없는 에이전트

security, performance, scope, side_effect, user_guide_sync — 실질 결함 없음(INFO/확인-완료 항목만 존재).

## 권장 조치사항

1. `CHANGELOG.md:19-21` 을 라운드 1 정정과 일치시켜 자기모순 제거 — `MAX_ITERATIONS_EXCEEDED` 통과 원인은 카탈로그가 아니라 소비자·분류기 목록의 정확 인용임을 명시 (documentation WARNING #1 / requirement WARNING).
2. `where` grep 검증을 `matchAll` 기반 전체 위치 검증으로 바꿔 `CONTAINER_MISSING_EMIT` 둘째 위치(7125)도 실제로 확인되게 한다 (testing WARNING #2).
3. `isMessagePrefixOnly` 를 스캐너 모듈로 export 하고 진리표 4조합을 겨눈 합성 대조군을 추가한다 — architecture INFO #1 과 동일 작업으로 한 번에 처리 가능 (testing WARNING #3).
4. "여전히 인용되는가" 판정을 `assertAllCited(list)` 헬퍼로 추출해 두 목록 테스트의 중복을 제거한다 (maintainability WARNING #4).
5. (선택, 저우선) `where` grep 로직을 이름 있는 헬퍼로 분리하고 vacuity 임계값 근거를 주석으로 남기는 등, INFO 항목은 다음 축 추가 시점에 함께 정리한다.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: security, performance, architecture, requirement, scope, side_effect, maintainability, testing, documentation, user_guide_sync (10명)
  - **제외**: 표 (reviewer · 이유, 4명)
  - **강제 포함(router_safety)**: documentation, maintainability, requirement, scope, security, side_effect, testing (forced 전원 결과 확보됨 — 강제 화이트리스트 미이행 없음)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | dependency | router 판단 — 이 배치는 의존성 변경 없음 |
  | database | router 판단 — DB 스키마/쿼리 변경 없음 |
  | concurrency | router 판단 — 동시성 관련 코드 변경 없음 |
  | api_contract | router 판단 — API 계약 변경 없음 |