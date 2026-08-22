# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음

## 전체 위험도
**LOW** — 신규 식별자 도입 없는 rename 통합(`INVALID_INPUT` → `INVALID_TRIGGER_PARAMETERS`, Manual 3경로 통일). spec·코드·plan 전 영역 정합. 유일한 실질 이슈는 `error-codes.md §5` 신규 행이 §2/§5 가 선언한 admission 기준(client 분기 "확인")을 스스로 "확인 아닌 미발견"이라 인정하면서도, 그 상위 원칙 텍스트는 갱신하지 않은 채 남긴 문서 정합 갭(WARNING, 두 checker 중복 지적).

## Critical 위배 (BLOCK 사유)

(없음)

## planner 인계 (권한 밖 Critical)

(없음)

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | rationale_continuity, convention_compliance | `error-codes.md §5` 신규 행이 "관측 범위 내 미발견(확인 불가)"이라고 스스로 명시하면서도, 그 행이 편입된 §5 서문·`## Rationale` 불릿("client 코드 분기 미존재를 **확인**")과 §2 rename 정책 문구는 diff 로 갱신되지 않아 원칙 텍스트와 신규 행의 실제 근거 수준이 어긋남 | `spec/conventions/error-codes.md` §5 서문 + 하단 `## Rationale` "§5 진입 기준" 불릿 (diff 밖, 기존 문구 유지) / §5 표 신규 행(비고에서 스스로 한계 인정) | §2("이름 정확성 향상만을 위한 rename 금지") · §5 서문("breaking 영향 없음을 확인한 뒤 교체") · 하단 Rationale 이분법(client 분기 0 → §5 흡수 / 하드코딩 분기 존재 → §3·§4 신설·정식 마이그레이션 — "확인 불가"라는 제3상태는 이분법에 없음) | §2 또는 §5 서문/Rationale 에 "내부 인증 REST 엔드포인트처럼 저장소 밖 호출자를 완전히 배제 못 하는 경우, '분기 지점 없음 확인' 대신 '관측 가능 범위(자사 프론트·저장소 grep) 내 미발견 + 잔여 위험 명시 인수(사용자 결정)'를 완화된 §5 흡수 조건으로 허용한다"는 문장을 명시적으로 추가 — 기존 두 문단을 한두 문장 확장하면 충분, target 행 자체(비고)는 오히려 좋은 초안이므로 되돌릴 필요 없음 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | rationale_continuity, convention_compliance, naming_collision | Rename 이력 표 신규 행 PR 컬럼이 `#TBD_PR` placeholder (기존 3행은 `PR4b`/`#566` 등 실제 참조값) | `spec/conventions/error-codes.md` §5 표, 신규 행 4번째 컬럼 | 이 브랜치가 실제 PR 번호를 받는 시점에 `#TBD_PR` 을 그 번호로 치환. 이미 직전 code-review(`17_32_01`)에서도 발견·계획됨 — 별도 조치 불요, 병합 전 자동 해소 예정 |
| 2 | plan_coherence | `plan/in-progress/eia-error-code-unify.md` 의 정본 트래커 진행 카운트 서술 "38 → 34"가 `origin/main` 실측치(37)와 1건 오차 — 산수(37-4+1=34)는 실제 diff 와 일치, 시작값 표기만 어긋남 | `plan/in-progress/eia-error-code-unify.md` §작업 | "38 → 34"를 "37 → 34"로 정정하거나, 38이 가리키는 다른 기준 시점(세션 착수 시점 vs `origin/main` diff-base)을 명시 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | NONE | Manual 3경로 rename 이 카탈로그·도메인 SoT·명명 규약·인접 도메인·코드·프론트·plan 전 영역에서 정합. 폐기 코드(`INVALID_INPUT`) 잔존은 전부 의도된 이력 서술 |
| rationale_continuity | LOW | 결정 번복(RERUN_ prefix 미부여 원칙과의 관계)은 과거 Rationale 을 정확히 재해석해 처리한 모범 사례. §5 신규 행의 admission 근거 수준과 §5 원칙문 텍스트 간 정합 갭 1건(WARNING) |
| convention_compliance | LOW | 표기 규약(UPPER_SNAKE_CASE)·Swagger 데코레이터·문서 3섹션 구조·§4 재구성 전수 준수. §5 원칙문 갱신 누락 1건(WARNING, rationale_continuity 와 동일 사안 다른 각도) |
| plan_coherence | NONE | 정본 트래커가 명시적으로 열어 둔 "결정 필요" 항목에 사용자 결정을 받아 정상 집행. 다른 in-progress plan(EIA 종결 payload·node-cancellation §3)과 절·레이어 비중첩. 진행 카운트 1건 오차(INFO) |
| naming_collision | NONE | 신규 식별자 도입 없음 — 기존 값 `INVALID_TRIGGER_PARAMETERS` 로의 3번째 소비처 통합. `error-codes.md §4` 서브섹션 신설도 앵커 보존형이라 기존 참조 안전. `#TBD_PR` placeholder 1건(INFO) |

## 권장 조치사항
1. (WARNING #1 해소) `spec/conventions/error-codes.md` §2 또는 §5 서문/Rationale 에 "저장소 밖 호출자를 완전히 배제 못 하는 내부 인증 엔드포인트"에 대한 완화된 §5 흡수 조건 문장을 추가해, 신규 행의 실제 근거("확인" 아닌 "관측 범위 내 미발견 + 잔여 위험 인수")가 원칙 텍스트와 정합하도록 갱신.
2. (INFO #1) PR 생성 후 `#TBD_PR` 을 실제 PR 번호로 치환 — 병합 전 자동 해소 예정, 별도 세션 불요.
3. (INFO #2) `plan/in-progress/eia-error-code-unify.md` 의 "38 → 34" 진행 카운트 서술을 실측치(37 → 34) 또는 기준 시점 명시로 정정.