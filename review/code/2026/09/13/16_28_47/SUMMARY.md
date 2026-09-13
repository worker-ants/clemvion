# Code Review 통합 보고서

## 전체 위험도
**LOW** — CRITICAL/WARNING 없음. 전 항목이 INFO 수준(경계 케이스 미검증·유지보수성 관찰·기존 처분 재확인)이며, 유일한 구조적 항목은 `spec/conventions/user-guide-evidence.md §2` 가드 인벤토리 drift(`[SPEC-DRIFT]`, developer 권한 밖·planner 백로그 기등재)다. forced 7명(`documentation, maintainability, requirement, scope, security, side_effect, testing`) 전원 결과 확보됨 — 강제 화이트리스트 미이행 없음.

## Critical 발견사항

없음.

## 경고 (WARNING)

없음.

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Requirement | `CODE_FIELD` 정규식의 왼쪽 경계 `(?<!\w)` 가 하이픈으로 끝나는 키(`x-code`, `status-code` 류)를 배제하지 못해 축 라벨이 오분류될 수 있다. 다만 실제 판정(`basis.has(token)`)은 축과 무관하게 동일하게 걸려 존재성 검증 자체는 깨지지 않고, 오늘 코퍼스에 해당 형태 0건(실측 확인) | `codebase/frontend/src/lib/docs/__tests__/guide-identifier-scan.ts:135` | 다음 `CODE_FIELD` 경계 개정 시 6갈래 실측표에 하이픈 변형 추가 |
| 2 | Requirement / Testing | `collectEnvDeclarations` 의 compose 정규식이 YAML **매핑 스타일**(`KEY: value`)만 지원하고 **리스트 스타일**(`- KEY=value`)은 매칭되지 않으며, 이를 겨냥한 테스트도 없다. 저장소의 두 compose 파일이 현재 전부 매핑 스타일이라 오늘 판정에는 영향 없음(실측 확인) | `codebase/frontend/src/lib/docs/__tests__/guide-identifier-scan.ts:235` | 리스트 스타일 fixture 로 현재 동작(미지원)을 명시적으로 고정하거나, 두 스타일을 모두 받도록 정규식 확장 |
| 3 | Scope | 공유 트래커 파일(`plan/in-progress/spec-draft-nullable-notation-followups.md`)에 이번 작업과 무관한 별개 결함(`cafe24-api-metadata.md §4` Principle 오인용)이 새로 등재됨 — 프로젝트 관례(impl-prep 중 발견한 무관 항목은 그 턴에 투명하게 백로그 등재)를 정확히 따랐고 항목 자체에 "(선재, 무관)" 명시 | `plan/in-progress/spec-draft-nullable-notation-followups.md` | 조치 불요 — 관례 준수 |
| 4 | Scope | 가드 파일 교체가 파일명 리네임(rename)이 아니라 삭제+신규 생성으로 기록되어 이력 추적이 끊긴다 — 이전 라운드에서 유사도 임계값을 낮춰도 여전히 삭제+추가로 기록됨을 실측하고 "회고적 재작성 비용 > 이익"으로 이미 처분 확정 | `guide-error-code-{existence,scan}` → `guide-identifier-{existence,scan}` | 조치 불요 — 기존 처분 유지 |
| 5 | Maintainability | `collectEnvDeclarations` 내부에 정규식 매칭 루프(리셋 후 반복 exec)가 두 번 반복된다. 같은 파일의 `scanIdentifierCitations` 는 이미 클로저로 이 반복을 추출했는데 이 함수는 미적용이라 파일 내 일관성이 갈린다 | `codebase/frontend/src/lib/docs/__tests__/guide-identifier-scan.ts:222-244` | 공용 헬퍼로 추출(급하지 않음, 다음 축 추가 시 함께 정리 권장) |
| 6 | Maintainability | 삭제된 구 가드의 `FIELD_TABLE_NAME` 정규식이 회귀 테스트 안에 문자열로 손 재복제되어 있어, `guide-identifier-scan.ts` 의 `UPPER_SNAKE` 정의가 바뀌어도 이 사본은 이력으로만 연결된 채 조용히 낡을 수 있다 | `codebase/frontend/src/lib/docs/__tests__/guide-identifier-existence.test.ts:187` | 변수명을 `LEGACY_FIELD_TABLE_NAME` 등으로 구분해 "지금 축"과 "과거 축" 혼동 방지(급하지 않음) |
| 7 | Maintainability | vacuity-floor 단언에 쓰인 임계값 다수(`50/500/800/5/10/100/2/20`)가 이름 없는 매직 넘버 — `EXTERNAL_VOCABULARY_CAP` 하나만 상수화됨 | `codebase/frontend/src/lib/docs/__tests__/guide-identifier-existence.test.ts:75-135` | 값이 재사용되지 않아 압박은 낮음. 축이 하나 더 생기면 `MIN_*` 식 이름 상수로 모으는 것 권장 |
| 8 | Side Effect | 모듈 스코프 `g`-플래그 정규식 3개가 호출 간 공유되는 `lastIndex` 상태를 갖고, 매 호출부에서 손으로 4회 리셋하는 패턴에 의존 — 단일 스레드·동기 실행이라 오늘 레이스는 없으나, 향후 리셋 한 줄 누락 시 두 번째 호출부터 매치가 조용히 누락되는 클래스. 작성자가 이미 공유 헬퍼 리팩터를 백로그(`plan/in-progress/guide-identifier-existence.md:189`)에 등재 | `codebase/frontend/src/lib/docs/__tests__/guide-identifier-scan.ts` (`scanIdentifierCitations`/`collectSourceTokens`/`collectEnvDeclarations`) | 조치 불요(이미 추적 중) — 헬퍼 추출 시 "리셋 제거 뮤턴트 RED" 를 선실측 조건으로 유지 |

## SPEC-DRIFT

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | SPEC-DRIFT | [SPEC-DRIFT] `spec/conventions/user-guide-evidence.md §2` 가 "Build-time 가드 3건"(`impl-anchor-existence`/`integrations-coverage`/`triggers-coverage`)이라 명시하지만, 실제 가드 인벤토리는 이번 PR 이 다루는 `guide-identifier-existence`/`guide-sanitized-message-parity` 가드 가족을 포함해 그보다 넓다. 이전부터 있던 선재 갭이며, 코드(가드 확장)는 의도적·합리적이고 spec 쪽이 낡은 방향 — developer 권한 밖(`spec/` 쓰기는 project-planner 소관)이라 이 PR 은 되돌릴 대상이 아니다. `plan/in-progress/guide-identifier-existence.md` 와 `spec-draft-nullable-notation-followups.md` 양쪽에 이미 planner 백로그로 등재(plan 자체가 "통산 8~9회 확인"이라 기록) | `spec/conventions/user-guide-evidence.md:155` | 코드 변경 없음. project-planner 턴에서 §2 표에 신규 가드 2건 추가 + "가드 3건" 표제를 실제 건수로 갱신 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 발견 없음 — 외부 입력/시크릿/인증/암호화 접점 전무, ReDoS 형태 아님, env 값 미캡처 |
| requirement | LOW | CODE_FIELD 하이픈 경계 미검출(INFO#1), compose 리스트 미지원(INFO#2), spec 인벤토리 drift(SPEC-DRIFT#1) |
| scope | LOW | 무관 백로그 항목 등재(관례 준수, INFO#3), 이력단절(기처분, INFO#4) |
| side_effect | NONE | stateful regex lastIndex 리셋 반복(이미 추적 중, INFO#8), 그 외 순수함수·부작용 없음 |
| maintainability | NONE | 정규식 루프 중복(INFO#5), legacy 축 손-복제(INFO#6), 매직넘버(INFO#7) |
| testing | LOW | compose 리스트 스타일 미지원+무테스트(INFO#2 중복), 그 외 5라운드 뮤테이션 처분 재확인(직접 재현으로 유효성 검증) |
| documentation | NONE | spec 인벤토리 drift(SPEC-DRIFT#1 중복), 이전 라운드 결함 전부 정정 확인 |

## 발견 없는 에이전트

- security — CRITICAL/WARNING/INFO 어느 것도 없음("해당 없음")

## 권장 조치사항

1. (project-planner, 낮은 우선순위) `spec/conventions/user-guide-evidence.md §2` 의 "build-time 가드 3건" 표를 `guide-identifier-existence`/`guide-sanitized-message-parity` 포함한 실제 건수로 갱신 — 코드 revert 아님, spec 갱신만.
2. (선택, 급하지 않음) `collectEnvDeclarations` 의 compose 파싱을 리스트 스타일(`- KEY=value`)까지 지원하도록 확장하거나, 현재 미지원 동작을 합성 fixture 로 명시적으로 고정.
3. (선택, 급하지 않음) `collectEnvDeclarations` 의 반복 매칭 루프를 `scanIdentifierCitations` 와 같은 공용 헬퍼로 추출 — 다음 축 추가 시점에 함께 정리 권장.
4. (선택, 급하지 않음) 회귀 테스트 내 `FIELD_TABLE_NAME` 손-복제 변수명을 `LEGACY_` 접두로 구분해 두 파일 간 혼동 방지.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security, requirement, scope, side_effect, maintainability, testing, documentation` (7명)
  - **제외**: 표 아래 (7명)
  - **강제 포함(router_safety)**: `documentation, maintainability, requirement, scope, security, side_effect, testing` (7명 전원 — 즉 실행된 7명 모두 router_safety 에 의해 강제 포함되었고, 전원 결과 확보됨. 강제 화이트리스트 미이행 없음)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | 라우터 판단 — 변경분이 순수 정적 텍스트 스캐너(빌드/CI 시점)로 런타임 성능 표면 없음 |
  | architecture | 라우터 판단 — 기존 파일 구조·계층 경계 변경 없음 |
  | dependency | 라우터 판단 — 신규 외부 패키지·lockfile 변경 없음 |
  | database | 라우터 판단 — DB 스키마/쿼리 접점 없음 |
  | concurrency | 라우터 판단 — 동기 단일 스레드 테스트 코드, 동시성 표면 없음 |
  | api_contract | 라우터 판단 — HTTP/API 계약 변경 없음 |
  | user_guide_sync | 라우터 판단 — 가이드 문서(MDX) 자체는 변경 대상 아니고 가이드를 검증하는 도구만 변경 |