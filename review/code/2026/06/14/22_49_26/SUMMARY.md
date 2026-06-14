# Code Review 통합 보고서

## 전체 위험도
**LOW** — 핵심 구현(min/max/pattern 서버측 검증)은 완전하고 정확하다. 주요 문제는 spec 갱신 누락(SPEC-DRIFT 2건)이며, 코드 자체에 Critical 결함은 없다.

> **main 검증 노트 (2026-06-14)**: 아래 WARNING 1·2 (SPEC-DRIFT) 및 INFO 1·REQUIREMENT INFO 2 는 **false positive** 로 확인됨. reviewer 가 `--branch main` diff 의 구(舊) Planned 라인(L329/L332/L354)에 anchor 했으나, 실제 현재 spec 은 이미 갱신돼 있다: form.md §6.2 표(L327-329)·검증지점(L333)·EIA §5.1(L313) 모두 min/max/pattern 이 구현 행으로 이동, `type:'file'` 만 Planned 잔존. 따라서 실제 잔여 actionable 은 WARNING 3(ReDoS, LOW) + 일부 INFO(min>max guard·Rationale 목록·테스트 보강) 뿐.

## Critical 발견사항

해당 없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 | 상태 |
|---|----------|----------|------|------|------|
| 1 | SPEC-DRIFT | form.md §6.2 표·검증 지점 주석이 min/max/pattern 을 "Planned"로 기술 | form.md L329, L332, L354 | spec 갱신 | **false positive — 이미 갱신됨** (reviewer stale-line anchor) |
| 2 | SPEC-DRIFT | EIA §5.1 L313 행이 min/max·pattern 을 "별도 Planned"로 기술 | EIA L313 | spec 갱신 | **false positive — 이미 갱신됨** |
| 3 | SECURITY | `new RegExp(def.pattern)` ReDoS 위험. formConfig(노드 관리자 설정) 신뢰 경계 안이나 미문서화 | form-mode.ts validateFormSubmission | (1) 신뢰 경계 JSDoc 명시 (2) 최대 패턴 길이 제한 | **fix 적용** |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 | 상태 |
|---|----------|----------|------|------|------|
| 1 | SPEC-DRIFT | form.md L350 Rationale "검증 지점" 첫 문장 목록에 min/max·pattern 미포함 | form.md L350 | 목록 확장 | fix 적용 (Rationale 목록에 추가) |
| 2 | REQUIREMENT | plan "spec 동반 갱신" [x] 인데 spec 미갱신 의심 | plan L71 | 확인 | false positive — spec 갱신 완료됨 |
| 3 | REQUIREMENT | `validation.message` 가 min/max/pattern 오류에 미사용 | form-mode.ts | 현 구현 유지(기존 minLength 동작 일치) | accept (기존 동작 일치, 별도 항목) |
| 4 | SECURITY | `min > max` 논리 역전 미검증 | extractFormFields | min>max 시 두 값 미반영 | **fix 적용** |
| 5 | SECURITY | `label`/`description` 새니타이징 없음 (XSS) | extractFormFields | 출력 경로 이스케이프 확인 | accept (기존 필드, 본 PR 무관 — 렌더 경로 책임) |
| 6 | MAINTAINABILITY | number 블록 형식/범위 분리 응집도 | form-mode.ts | 현 규모 허용 | accept |
| 7 | MAINTAINABILITY | RegExp 루프 내 재생성 | form-mode.ts | 현 규모 유지 | accept |
| 8 | MAINTAINABILITY | `FIELD_NAME_RE` 함수 내부 정의 | extractFormFields | 모듈 레벨 이동 | **fix 적용** (cheap) |
| 9 | MAINTAINABILITY | 테스트 인덱스 기반 접근 | form-mode.spec.ts | 현 패턴 수용 | accept |
| 10 | MAINTAINABILITY | `pattern: '['` 테스트 설명 주석 없음 | form-mode.spec.ts | 주석 추가 | **fix 적용** |
| 11 | DOCUMENTATION | `extractFormFields` JSDoc min/max/pattern 미서술 | form-mode.ts | JSDoc 보완 | **fix 적용** |
| 12 | DOCUMENTATION | minLength/maxLength 주석 밀도 불일치 | types.ts | 주석 보강 | accept (경미) |
| 13 | TESTING | Infinity 거부 케이스 미검증 | form-mode.spec.ts | 케이스 추가 | **fix 적용** |
| 14 | TESTING | max only 독립 동작 미검증 | form-mode.spec.ts | 케이스 추가 | **fix 적용** |
| 15 | TESTING | min:0 하한 미검증 | form-mode.spec.ts | 케이스 추가 | **fix 적용** |
| 16 | TESTING | maxLength>pattern 우선순위 미검증 | form-mode.spec.ts | 케이스 추가 | **fix 적용** |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | LOW | ReDoS(신뢰 경계 미문서화), min>max 미검증 |
| requirement | LOW | SPEC-DRIFT 2건 (false positive — 실제 갱신됨) |
| scope | NONE | 의도 범위 내 |
| side_effect | NONE | 순수 함수 유지, FormModalField 하위 호환 |
| maintainability | LOW | 경미한 가독성 이슈 |
| testing | LOW | 커버리지 갭 4건 (INFO) |
| documentation | LOW | JSDoc 미갱신 |
| api_contract | NONE | 내부 pure 함수, API 계약 영향 없음 |
| user_guide_sync | NONE | 동반 갱신 누락 0건 |

## 라우터 결정

라우터 선별 실행 (`routing_status=done`). 실행 9명(security, requirement, scope, side_effect, maintainability, testing, documentation, api_contract, user_guide_sync), 강제 7명, 제외 5명(performance·architecture·dependency·database·concurrency — 순수 함수 확장·DB/동시성/의존성 무변경).
