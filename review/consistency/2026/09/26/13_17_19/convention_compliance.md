# 정식 규약 준수 검토 — `spec/conventions/swagger.md` (§2-4 · §5-2 신규 절)

검토 모드: `--impl-prep` (scope: `sa-prep-scope/spec`, 대응 구현 plan `plan/in-progress/success-advert.md`).
target 의 실질 변경분은 commit `24084fd0e`(`docs(spec): swagger §2-4 — 라우트는 성공 응답을
하나 이상 광고한다 · §5-2 ApiOkWrappedNullableResponse`)가 `spec/conventions/swagger.md` 에
넣은 §2-4 규칙 문단·상태 코드 표 3xx 행·§5-2 래퍼 표 신규 행·§5-4 체크리스트 한 줄·Rationale
불릿 교체 5곳이다. 나머지 번들 파일(trigger-list·ai-assistant·auth·api-convention·EIA)은
이번 커밋에서 변경되지 않은 참조용 컨텍스트라 별도 지적 없음.

## 발견사항

- **[WARNING]** `## Rationale` §2-4 절이 아직 끝나지 않은 구현을 완료형으로 서술한다
  - target 위치: `spec/conventions/swagger.md` `### §2-4 광고한 성공 코드 ↔ 실제 성공 코드 — 왜 가드로 세는가` 절, 불릿 `**«광고가 있어야 한다» 는 광고를 채운 뒤 조였다.**`
    (현재 라인 697-700 부근): *"이 규칙과 같은 변경에서 11곳을 채웠고(응답 DTO 가 없던
    workflow-assistant 세션 6곳 포함)... 새 라우트가 광고 없이 들어오는 순간 가드가
    실패한다."*
  - 위반 규약: `spec/conventions/spec-impl-evidence.md` §3 상태 라이프사이클 — `status: implemented`
    는 "**모든 약속 구현 완료**"를 뜻하고, 그 문서가 서술하는 규칙·수치는 현재 실측과
    일치해야 한다(같은 문서 Overview 의 존재 이유: *"spec 가 약속한 surface 가 **지금**
    구현됐는가"*를 가리기 위함).
  - 상세: 이 문장은 세 가지를 "이미 됐다"고 단언한다 — (1) 11곳 응답 DTO·광고 완료,
    (2) `ApiOkWrappedNullableResponse` 래퍼 존재, (3) 가드가 "하나 이상 광고" 를 이미 강제.
    그러나 이 세션에서 실측한 결과 셋 다 아직 아니다.
    - `grep -rn "ApiOkWrappedNullableResponse" codebase/backend/src/common/swagger/` → 0건 (헬퍼 미생성)
    - `plan/in-progress/success-advert.md` 체크리스트 — `- [ ] 래퍼 · DTO · 광고 11곳`,
      `- [ ] 가드 강화(RED 확인) · docstring 정정` 모두 미체크
    - `http-status-advertised-guard.ts` 주석: *"대조한 핸들러 수 — 성공 응답을 **하나 이상
      광고하는** 라우트만 센다(광고가 없으면 대조할 것이 없어 통과)"* — 여전히 옛 동작
      그대로다. "새 라우트가 광고 없이 들어오는 순간 가드가 실패한다"는 지금 거짓이다.
    - `webauthn`·`workflow-assistant` 컨트롤러도 아직 해당 엔드포인트에 성공 응답 데코레이터가
      없다(플랜의 실측 표와 일치, 즉 미착수).
    이 지적은 새로운 것이 아니다 — 같은 draft 를 대상으로 한 직전 라운드
    (`review/consistency/2026/09/26/13_07_11` WARNING #1)가 "완료형·완료 경로 선인용"을
    이미 지적했다. draft 저자는 `plan/complete/success-advert.md` 경로 인용만 지우고
    ("spec 과 구현이 한 PR 로 머지되므로 머지 시점에 참이다"라는 전제로) 완료형 시제는
    그대로 남겼다(`plan/in-progress/spec-draft-swagger-success-advert.md` 줄 78-79).
    이 전제는 검증되지 않았다 — 이 레포의 최근 두 선례(`dde7c3013`, `1335f8174`)는 정확히
    같은 문서(`swagger.md`)의 규약 문구와 그 규약을 채우는 코드를 **같은 커밋**에 넣었는데,
    이번 건은 spec 문구만 먼저 별도 커밋(`24084fd0e`, `docs(spec)` 전용, `codebase/` 변경 0줄)으로
    올라갔다. 지금 이 커밋을 단독으로 읽는 누구에게나(다른 병렬 세션 포함) "가드가 이미
    강제한다"는 문장이 거짓 안전망을 준다 — 그 시점에 광고 없이 새 라우트를 추가해도 이
    가드는 걸리지 않는다.
  - 제안: 다음 중 하나.
    (a) 이 Rationale 불릿의 시제를 예정형으로 낮춘다 — "이 규칙과 같은 변경에서 11곳을
    채운다(진행 중, `plan/in-progress/success-advert.md`)" 처럼 완료 단언을 피하고, "가드가
    실패한다"도 "가드를 조인 뒤에는 실패한다"로 조건화.
    (b) `spec-impl-evidence.md` §3 이 정한 정식 경로를 따라 이 구간 동안 `status: partial` +
    `pending_plans: [plan/in-progress/success-advert.md]` 로 내려 "일부 구현됨" 임을 frontmatter
    로 명시하고, 가드·DTO·11곳이 실제로 채워지는 커밋에서 완료형 문장과 함께
    `status: implemented` 로 복귀시킨다.
    (c) (선호) 이 문서 구절 자체를 가드/DTO 커밋에 합쳐 커밋하고, 지금 커밋에서는 규칙
    정의(§2-4 문단·표·체크리스트)만 반영한 채 이 Rationale 불릿 교체는 보류한다 — 직전
    두 선례(`dde7c3013`/`1335f8174`)와 같은 시퀀싱.

- **[INFO]** §5-2 신규 래퍼 행이 §1-4 가 이미 문서화한 `nullable`+`$ref` 형제 키 무시 함정을 반복 언급하지 않는다
  - target 위치: `spec/conventions/swagger.md` §5-2 공용 래퍼 표, `ApiOkWrappedNullableResponse(Dto)` 행
  - 위반 규약: 직접 위반은 아님 — `swagger.md` §1-4 Rationale(*"OpenAPI 3.0 은 `$ref` 옆의
    형제 키를 무시한다"*)가 이미 세운 원칙과의 **일관성** 문제.
  - 상세: 이 구현 함정과 회피법(`allOf:[{$ref}]` 에 `nullable` 부착)은 `plan/in-progress/spec-draft-swagger-success-advert.md` 의 "Rationale (이 draft 의)" 절에만 있고, 정식으로 남는
    `spec/conventions/swagger.md` 본문에는 옮겨지지 않았다. 이 draft 파일은 plan 완료 시
    `plan/complete/`로 이동하거나 정리될 수 있어 영구 참조처가 아니다. 직전 라운드
    (`review/consistency/2026/09/26/13_07_11` INFO #2)가 이미 같은 취지로 "구현 형태 미규정"을
    지적했고 "여유가 있으면"으로 낮춰 처리해 지금도 미반영 상태다 — 재확인 겸 기록.
  - 제안: `ApiOkWrappedNullableResponse` 를 실제로 구현하는 커밋에서 §5-2 표 행 또는 그
    아래 주석에 "구현은 `allOf` 로 감싸 `nullable` 을 붙인다(§1-4 와 같은 `$ref` 형제 키
    무시 사정)"을 한 줄 추가해 §1-4 의 교훈이 영구 문서에도 남게 한다.

- **[INFO]** `swagger.md` 에 명시적 `## Overview` 섹션이 없음 (기존 상태, 이번 diff 범위 밖)
  - target 위치: `spec/conventions/swagger.md` 최상단 (frontmatter 직후 도입 문단)
  - 위반 규약: CLAUDE.md "Spec 문서 3섹션 구성(Overview / 본문 / Rationale) 권장"
  - 상세: `## 0)`~`## 6)` + `## Rationale` 구조로, 저장소의 다른 conventions 문서
    (`spec/conventions/review-citations.md`·`spec-impl-evidence.md` 등)가 갖는 `## Overview
    (제품 정의)` 헤딩이 없다. 다만 이는 이번 커밋이 새로 만든 구조가 아니라 문서 신설
    시점부터의 기존 상태이고, 이번 PR 의 변경분(§2-4·§5-2·§5-4·Rationale)과 무관하다.
  - 제안: 권장 사항일 뿐이라 즉시 조치 불요. 이 문서를 다음에 구조적으로 손볼 일이 있으면
    도입 문단을 `## Overview` 로 승격하는 것을 함께 고려.

## 요약

이번 커밋이 추가한 §2-4 규칙 문단·상태 코드 표 3xx 행·§5-2 `ApiOkWrappedNullableResponse`
래퍼 행·§5-4 체크리스트 문구는 명명·출력 포맷·데코레이터 사용(`@ApiFoundResponse` 실존 확인함) 축에서
저장소 conventions 와 잘 맞는다. 유일하게 뚜렷한 문제는 `## Rationale` 의 §2-4 불릿이 아직
착수 전인 작업(래퍼·11곳 DTO·가드 강화 — 전부 `plan/in-progress/success-advert.md` 미체크)을
완료형으로 서술해, `spec-impl-evidence.md` 가 `status: implemented` 문서에 요구하는 "지금
구현됨" 원칙과 어긋난다는 점이다. 이는 직전 `--spec` 라운드가 이미 지적했던 문제(WARNING #1)가
불충분하게만 봉합된 채(경로 인용만 제거, 시제는 유지) 그대로 커밋된 것이다. 자동 가드
(`spec-code-paths.test.ts`)는 이를 잡지 못하므로 사람이 다음 커밋(가드·DTO 반영) 전까지
이 문구를 신뢰하지 않도록 별도 확인이 필요하다. 나머지는 INFO 두 건(§1-4 구현 함정 전달
누락, Overview 섹션 부재)으로 차단 사유가 아니다.

## 위험도

LOW
