# RESOLUTION — A-1 form min/max·pattern 검증 코드리뷰 (22_49_26)

전체 위험도 LOW, Critical 0, Warning 3. Warning 2건은 false positive, 1건 + 주요 INFO fix 적용.

## 조치 항목

| SUMMARY # | 분류 | 발견 | 조치 |
|---|---|---|---|
| W1 | SPEC-DRIFT | form §6.2 가 min/max/pattern Planned | **false positive** — 실제 form.md §6.2 표(L327-329)·검증지점(L333)는 이미 구현으로 갱신됨. reviewer 가 `--branch main` diff 의 구 Planned 라인에 anchor. 조치 불요 |
| W2 | SPEC-DRIFT | EIA §5.1 가 min/max·pattern Planned | **false positive** — EIA L313 이미 구현 반영(file 만 Planned). 조치 불요 |
| W3 | SECURITY (ReDoS) | `new RegExp(def.pattern)` 신뢰 경계 미문서화 | **fix** — `validateFormSubmission`/JSDoc 에 "pattern 은 노드 관리자 config 전용(신뢰 경계), 폼 제출자 입력 아님" 명시 + `MAX_PATTERN_LENGTH=512` cap 추가(과길이 패턴 컴파일 skip, defense-in-depth) |
| I1 | SPEC-DRIFT(INFO) | form §Rationale 검증지점 목록에 min/max·pattern 미포함 | **fix** — form.md Rationale 목록에 min/max·pattern 추가 |
| I4 | SECURITY(INFO) | `min > max` 논리 역전 미검증 | **fix** — `extractFormFields` 에서 min>max 시 두 경계 모두 무시(min==max 는 유지). 테스트 추가 |
| I10 | MAINTAINABILITY(INFO) | `pattern:'['` 테스트 설명 주석 없음 | **fix** — 주석 추가 |
| I11 | DOCUMENTATION(INFO) | `extractFormFields` JSDoc min/max/pattern 미서술 | **fix** — JSDoc 보완 |
| I13 | TESTING(INFO) | Infinity 거부 미검증 | **fix** — `-Infinity`/`Infinity` 거부 테스트 추가 |
| I14 | TESTING(INFO) | max only 미검증 | **fix** — max 단독 동작 테스트 추가 |
| I15 | TESTING(INFO) | min:0 하한 미검증 | **fix** — min:0 하한 테스트 추가 |
| I16 | TESTING(INFO) | maxLength>pattern 순서 미검증 | **fix** — maxLength>pattern FIRST 순서 + 과길이 패턴 skip 테스트 추가 |
| I2 | REQUIREMENT(INFO) | plan "spec 동반 갱신" [x] 인데 미갱신 의심 | **false positive** — spec 갱신 완료됨 |
| I3 | REQUIREMENT(INFO) | `validation.message` 미사용 | **accept** — 기존 minLength/maxLength 동작과 일치(FormModalField 가 message 미보유). 별도 항목, 본 PR 범위 밖 |
| I5 | SECURITY(INFO) | `label`/`description` XSS | **accept** — 기존 필드(본 PR 신규 아님). 새니타이징은 출력/렌더 경로 책임 |
| I6,I7,I9 | MAINTAINABILITY(INFO) | number 블록 분리·RegExp 재생성·테스트 인덱스 접근 | **accept** — 현 규모(+10줄)에서 과한 추상화. 가독성 충분 |
| I8 | MAINTAINABILITY(INFO) | `FIELD_NAME_RE` 함수 내부 정의 | **accept** — inline 정의가 사용처와 locality 가 높아 의도적 유지(EMAIL_RE/NUMBER_RE 는 별도 함수에서 공유돼 모듈 레벨) |
| I12 | DOCUMENTATION(INFO) | minLength/maxLength 주석 밀도 | **accept** — 경미, §3.3 참조로 충분 |

## TEST 결과

resolution fix 적용 후 TEST WORKFLOW 전수 재수행:

- lint: 통과 (eslint --fix 가 무관 backend 3파일 수정 → `git checkout` revert, PR 범위 유지)
- unit: 통과 (form-mode.spec 42 케이스 포함 전 suite green; spec-link-integrity 11/11)
- build: 통과 (backend/frontend/web-chat + docker 이미지 빌드)
- e2e: 통과 (192 passed)

## 보류·후속 항목

없음. accept 항목은 모두 본 PR 범위 밖 또는 현 규모 과한 추상화로 의도적 미적용 — 별도 plan 이관 불요.
