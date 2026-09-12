# Cross-Spec 일관성 검토 — `spec/5-system/` (impl-prep)

## 컨텍스트 확인

이번 `--impl-prep spec/5-system/` 호출 시점에 실제로 착수 대상인 작업은
`plan/in-progress/keyset-cursor-uuid-validation.md` 다(worktree `filter-pg-invalid-text`
자체가 이 plan 의 `worktree:` 프런트매터와 일치). 이 plan 은 애초 트래커에 등재됐던 처방
(*"`GlobalExceptionFilter` 에 `invalid_text_representation`(22P02) → 400 `VALIDATION_ERROR`
전역 분기 추가"*)을 **자체 실측으로 기각**하고, 대신 `login-history.service.ts`·
`background-runs.service.ts` 두 keyset 커서 디코더의 `id` 성분에 `isUuidShaped` 검증을
추가하는 좁은 수정으로 대체했다. 아래 발견사항은 이 좁은 수정 방향이 `spec/**` 다른 영역과
충돌하는지를 점검한 결과다 — 원 처방(전역 필터 분기)은 이미 기각됐으므로 그 자체는 발견사항에
넣지 않았다.

## 발견사항

- **[WARNING]** `INVALID_CURSOR`/`INVALID_LIMIT` 가 선언된 에러 코드 카탈로그 SoT 에 미등재
  - target 위치: `spec/5-system/3-error-handling.md` §1.3 (유효성 검증 에러 표)
  - 충돌 대상: `spec/4-nodes/1-logic/12-background.md` §8.7 (`400 INVALID_CURSOR` · `400
    INVALID_LIMIT`) · `spec/conventions/error-codes.md` Overview ("카탈로그·분류·트리거:
    `5-system/3-error-handling.md §1` (SoT)")
  - 상세: `error-codes.md` 는 명시적으로 "카탈로그·분류·트리거"의 **단일 SoT** 가
    `3-error-handling.md §1` 이라고 선언한다. 그런데 그 §1.3 표는 WS commands(§1.5)·EIA
    REST(§1.6)·webhook(§1.7)처럼 도메인 SoT 코드도 "공용 카탈로그 가시성"을 위해 등재하는
    관례를 갖고 있음에도, 실재하고 이미 구현된 `INVALID_CURSOR`/`INVALID_LIMIT`(둘 다
    `background-runs` §8.7)은 등재돼 있지 않다(grep 0건). 지금 착수하는 작업이 바로
    `INVALID_CURSOR` 의 트리거 조건을 하나 더 늘린다(날짜/형식 실패에 더해 **id 미검증** 실패)
    — 카탈로그가 이미 낡아 있는 코드의 의미를 넓히는 시점이라 등재 공백이 더 눈에 띈다.
  - 제안: 이번 배치(또는 뒤이은 등재)에서 §1.3 에 `INVALID_CURSOR`·`INVALID_LIMIT` 행을
    "도메인 SoT: [background §8.7](../4-nodes/1-logic/12-background.md#8-모니터링-api)" 형태로
    추가한다. 이번 PR 범위가 아니면 `spec-draft-nullable-notation-followups.md` 에 등재만이라도
    해 둘 것 — 다른 WARNING 항목들과 같은 처리 패턴이다.

- **[WARNING]** Cursor 페이지네이션 컨벤션(§8.2)이 두 번째 cursor 패턴(`login_history`)을
  누락해 "하나의 표준"처럼 보인다
  - target 위치: (간접) `plan/in-progress/keyset-cursor-uuid-validation.md` 가 두 커서
    디코더(`login-history`·`background-runs`)의 **서로 다른 실패 계약**(무시 vs 400)을
    "각자 유지"하기로 결정 — 이 결정이 기대는 cross-cutting 문서가 아래
  - 충돌 대상: `spec/5-system/2-api-convention.md` §8.2 "Cursor 기반 (대량 NodeExecution
    등)" vs `spec/data-flow/1-audit.md` §2.2 (`GET /users/me/login-history`)
  - 상세: §8.2 는 cursor 페이지네이션을 **단일 패턴**으로만 서술한다 — opaque base64 인코딩,
    실패 시 `INVALID_CURSOR`(400) (`background-runs` 예시 그대로). 그런데
    `data-flow/1-audit.md §2.2` 는 실제로 다른 cursor 패턴을 쓴다 — 평문 `<iso>|<id>`
    파이프 구분 인코딩, **손상된 cursor 는 무시하고 첫 페이지부터**(에러 없음, 200). 두
    패턴은 인코딩도 실패 계약도 다른데 §8.2 는 이 두 번째 패턴의 존재 자체를 언급하지
    않는다. `data-flow/1-audit.md` 쪽도 §8.2 를 역참조하지 않아 "이 API 가 표준과 다른
    이유"를 설명하는 문장이 없다 — `data-flow/12-workspace.md` 의 "UUID 검증 강도 비대칭"
    처럼 의도적 비대칭이면 그렇게 명시해야 할 자리인데 지금은 조용하다. 지금 착수하는
    작업이 이 두 계약을 (통일하지 않고) 각각 **강화**하는 방향이라, 이 비대칭이 앞으로도
    계속 유지될 것이 이번에 사실상 확정된다 — 그런데 그 확정이 문서화되지 않으면 다음
    cursor 엔드포인트 작성자가 §8.2 만 보고 세 번째 변형을 또 만들 위험이 있다.
  - 제안: §8.2 에 "`login_history` 는 예외 — 다른 인코딩·다른 실패 계약, 근거는
    [data-flow §1-audit §2.2]" 한 줄을 추가하거나, `data-flow/1-audit.md §2.2` 에 §8.2 와의
    차이와 그 의도(무엇을 얻기 위한 비대칭인가)를 적는다. 이번 PR 의 스코프가 아니면
    `spec-draft-nullable-notation-followups.md` 에 위 WARNING 과 함께 등재.

- **[INFO]** 전역 필터 분기 기각 근거가 기존 Rationale 과 중복 서술되고 상호 참조가 없다
  - target 위치: `plan/in-progress/keyset-cursor-uuid-validation.md` §A (필터 처방을
    won't-do 로 되돌리는 근거 — "JWT 클레임은 검증하지 않는다... 서버 버그를 클라이언트
    오류로 보고하게 된다")
  - 충돌 대상: `spec/data-flow/12-workspace.md` `## Rationale` → "`X-Workspace-Id` 헤더 vs
    `:id` 경로 파라미터 — UUID 검증 강도 비대칭 (2026-08-09)"
  - 상세: 두 문장이 사실상 같은 원칙("입력 출처를 모르고 일괄 강화하면 인가/서버-신뢰
    입력을 클라이언트 오류로 뒤바꾼다")을 각자 다른 자리에서 독립적으로 서술한다. 기존
    Rationale 은 이미 이 원칙의 **정식 SoT**(캐너리·회귀 테스트까지 지목)인데, plan 의
    새 서술은 그것을 인용하지 않고 재도출했다. 트래커 항목 자체가 "다음 사람이 같은
    제안을 다시 하지 않도록" 근거를 남기겠다고 명시하는데, 그 근거가 기존 정식 Rationale
    과 연결되지 않으면 두 문서가 같은 결론을 다른 말로 두 번 낸 것처럼 보여 향후 한쪽만
    개정되고 다른 쪽이 낡을 위험이 있다(이 저장소가 이미 여러 번 겪은 "같은 원칙의 분산
    서술" 패턴).
  - 제안: 트래커 won't-do 기록 문장에 `data-flow/12-workspace.md` Rationale 링크를 병기.
    spec 자체를 고칠 필요는 없음(자기-반증형 소정정 조건 미충족·이번 배치는 코드 전용) —
    plan/트래커 레벨의 상호 참조만으로 충분.

## 확인 — 충돌 없음(참고용)

아래는 이번 구현 방향이 다른 spec 영역과 **정합**함을 직접 실측 확인한 항목이다(발견사항
아님, 근거로 남긴다):

- `LoginHistory.id`·`NodeExecution.id` 는 둘 다 `spec/1-data-model.md` §2.14/§2.18.2 상
  `UUID` 컬럼 — plan 이 전제한 "22P02 를 낼 수 있는 `uuid` 컬럼" 진단과 일치.
- `login-history` 커서 실패 시 "무시하고 첫 페이지" 로 두는 처분은 `data-flow/1-audit.md
  §2.2` 가 이미 그렇게 규정한 기존 계약과 일치(신규 동작 아님, 커버리지 확장일 뿐).
- `background-runs` 커서 실패 시 `400 INVALID_CURSOR` 로 두는 처분은
  `spec/4-nodes/1-logic/12-background.md §8.7` 의 "cursor 디코딩 실패 → `INVALID_CURSOR`"
  기존 계약과 일치.
- 같은 문서 §8.7 하단 "본 API 는 외부 부수효과를 일으키지 않으므로 5xx 는 표준 NestJS
  핸들러에 위임(DB 장애 등)" 이라는 문장은, 만약 원래 처방대로 `GlobalExceptionFilter` 에
  22P02 전역 분기를 넣었다면 이 도메인이 명시적으로 "표준 핸들러에 위임"하기로 한 5xx
  분류 결정과도 충돌했을 자리다 — plan 이 필터를 건드리지 않기로 한 결정이 이 문장과도
  간접적으로 정합한다.
- `isUuidShaped`(느슨한 predicate) 재사용 근거로 든 "인가 판정 입력이면 형식 검증을 조이면
  안 된다" 논리는 커서 `id` 성분에는 적용 대상이 아니다(커서 id 는 인가 입력이 아니라 정렬
  tie-breaker) — 하지만 그렇다고 틀린 선택도 아니다: "Postgres 가 파싱할 수 있는가"라는
  판정 축 자체는 여기서도 정확히 필요한 질문이고, 더 엄격한 `isValidUuid` 를 썼어도
  결과(500 회피)는 동일했을 것이라 실질적 충돌이나 회귀는 없다.

## 요약

이번 impl-prep 대상은 애초 트래커 처방(전역 `GlobalExceptionFilter` 22P02→400 분기)을
개발자가 스스로 실측 반증하고 더 좁은 두 지점(keyset 커서 디코더) 수정으로 대체한 상태이며,
그 대체안은 데이터 모델·도메인별 기존 에러 계약(`login_history`·`background-runs`)과 직접
충돌하지 않는다. 다만 그 과정에서 손댈 코드(`INVALID_CURSOR`)가 이미 시스템 전체 에러
카탈로그 SoT(`3-error-handling.md §1`)에 등재돼 있지 않았다는 점, 그리고 두 커서 패턴의
계약 차이가 cross-cutting API 컨벤션 문서(§8.2)에 반영돼 있지 않다는 점을 새로 확인했다 —
둘 다 이번 작업이 만든 결함은 아니지만 이번 작업이 그 자리를 더 깊이 건드리므로 지금
등재/동기화해 두는 편이 싸다. CRITICAL 급 모순은 없다.

## 위험도

LOW
