# Cross-Spec 일관성 검토 — `spec-draft-review-citations-enforcement.md`

## 발견사항

- **[WARNING]** 변경안 (A) 의 Rationale 표가 "§3 (DTO·컨트롤러 JSDoc 카브아웃)" 전체를
  "예 — 위 가드" 로 묶어 **컨트롤러까지 강제되는 것처럼** 적는다 — 실제 가드는 응답 DTO 만
  본다
  - target 위치: `plan/in-progress/spec-draft-review-citations-enforcement.md` 변경안 (A)
    표 (프롬프트 라인 78-81) — `| §3 (DTO·컨트롤러 JSDoc 카브아웃) | **예** — 위 가드 |`
  - 충돌 대상: `codebase/backend/src/repo-guards/__tests__/dto-jsdoc-citation-guard.ts`
    (`isResponseDtoFile` — `/dto/responses/` 경로만 매치, `swagger-dto-contract-guard.ts` 에서
    import) 및 그 소비처 `dto-jsdoc-citation.spec.ts`
  - 상세: `review-citations.md §3` 의 기존 표는 "DTO·컨트롤러의 `/** */` JSDoc" 을 **한 행**으로
    묶어 "대상 아님" 이라 적는다. 이번에 신설된 가드는 그중 **응답 DTO 클래스·프로퍼티
    JSDoc** 만 AST 로 스캔한다 (`findDtoJsDocCitations` → `isResponseDtoFile`). 컨트롤러
    파일(`*.controller.ts`)을 검사하는 코드는 저장소 어디에도 없다(`grep` 0건). 그런데
    변경안 (A) 는 그 결합 라벨("DTO·컨트롤러")을 그대로 두고 "예 — 위 가드" 라고 적어,
    **컨트롤러 JSDoc 카브아웃까지 이제 강제된다**는 인상을 준다. 같은 초안 안에서도
    변경안 (C) 는 "§3 의 **DTO** 카브아웃은 … 강제된다" 로 더 좁게 적어, (A)·(C) 사이에
    표현 정밀도가 어긋난다. 이는 이 프로젝트가 반복 지적해 온 "문서화된 보장이 구현보다
    넓으면 안 된다" 패턴과 같은 결이다 — 이번 정정 자체가 "예고가 실측에 반증됐다" 는
    사유로 열린 턴인데, 그 정정문 안에 새로운 (더 작은 폭의) 과대주장을 심는 모양이 된다.
    다만 이 gap 자체는 새 사실은 아니다 — 자매 파일 `dto-jsdoc-citation.spec.ts` 헤더가
    "필드/클래스 구분을 §3 표가 안 가른다" 는 **인접한** 질문을 이미
    `plan/in-progress/spec-draft-nullable-notation-followups.md` (라인 637-638) 에 등재해
    뒀지만, 그 항목은 "DTO 안에서 필드 vs 클래스" 축이지 **"DTO vs 컨트롤러"** 축은 아니다 —
    별개 gap 이라 그 후속 항목이 이것까지 덮지 않는다.
  - 제안: (A) 표의 행 라벨을 "§3 (**응답 DTO** JSDoc 카브아웃)" 처럼 좁히거나, 같은 행 안에
    "컨트롤러는 미검증(§3 표가 필드/컨트롤러 구분을 안 함 — 후속 항목)" 각주를 붙인다. 근본
    수정을 원하면 `review-citations.md §3` 본문 표 자체를 "DTO(응답)" / "컨트롤러" 두 행으로
    쪼개고 각각의 강제 여부를 적는다 — 다만 그 표 자체를 쪼개는 일은 이번 target 의 스코프
    밖일 수 있으므로, 최소한 (A) 의 새 표 라벨만이라도 실제 가드 스코프(응답 DTO 한정)에
    맞춰 정정할 것을 권고한다.

- **[INFO]** 변경안 (B) 가 `dto-jsdoc-citation*.ts` 를 `review-citations.md` 의 `code:` 에만
  등재하고 `swagger.md` 의 `code:` 에는 등재하지 않는 것은 — **의도된 것으로 확인됨**, 충돌
  아님
  - target 위치: 변경안 (B) YAML 블록
  - 충돌 대상: `spec/conventions/swagger.md` frontmatter `code:` (현재
    `swagger-dto-contract-guard*.ts` · `response-contract*.ts` · `swagger-probe*.ts` 만
    등재, `dto-jsdoc-citation*.ts` 없음) — 이 가드의 헤더 주석이 `swagger.md §3` 을 함께
    인용하고 있어 처음엔 이중 등재 누락으로 보였다
  - 상세: `plan/in-progress/spec-draft-nullable-notation-followups.md` 라인 398-401 이 이미
    같은 질문을 검토해 "셋째 축(JSDoc 인용)은 등재할 문서가 다르다 — §5.4 가 아니라
    `review-citations.md` 다. 그 가드가 강제하는 것은 응답 계약이 아니라 **주석 형태
    규약**이기 때문" 이라고 명시적으로 결론 내렸다. target 의 변경안 (B) 는 이 결론과
    정확히 일치한다 — swagger.md 쪽에 추가 등재할 필요가 없다는 판단이 이미 내려져 있다.
  - 제안: 조치 불요. 다만 target 문서(또는 커밋 메시지)에 "swagger.md 미등재는
    의도"라는 한 줄 교차 참조를 남기면, 이후 리뷰어가 같은 의문을 다시 조사하는 비용을
    아낀다.

- **[INFO]** "함께 처리할 것" 절의 3개 항목(§5.4 나열형 전환 · `User` 7컬럼 노출 금지 규범 ·
  `spec-draft-api-convention-verifier-registration.md` 이동)은 실제로 모두
  `spec-draft-nullable-notation-followups.md` 에 등재돼 있음을 확인 — 중복·누락 없음
  - target 위치: target 문서 "함께 처리할 것" 절
  - 충돌 대상: `plan/in-progress/spec-draft-nullable-notation-followups.md` 라인 391-427
    (§5.4/swagger.md §5-1 "두 검증자" 문구 + `User` 7컬럼 항목)
  - 상세: grep 으로 세 항목 모두 실존을 확인했다. target 이 이 항목들의 상세 내용을
    반복하지 않고 포인터만 두는 것은 이 저장소의 관례(중복 비용 회피)와 일치한다.
  - 제안: 없음 — 정보성.

## 요약

target 문서는 두 개의 convention 문서(`review-citations.md`, `spec-impl-evidence.md`)의
Rationale 정정에 국한돼 있어 데이터 모델·API 계약·요구사항 ID·상태 전이·RBAC 축에서는
다른 spec 영역과 충돌하지 않는다. 유일한 실질적 이슈는 변경안 (A) 의 정정 표가 "DTO·컨트롤러
JSDoc 카브아웃" 을 한 덩어리로 "예" 라 적어, 실제로는 응답 DTO 만 보는 신규 가드의 범위보다
넓게 강제 여부를 주장한다는 점이다 — 이 PR 이 고치려는 바로 그 "예고가 구현보다 넓다" 류의
결함을 정정문 안에서 축소된 형태로 재생산할 위험이 있다. `code:` 이중 등재 여부(swagger.md
미등재)는 이미 자매 plan 문서에서 명시적으로 검토·결정된 사안이라 충돌이 아니다.

## 위험도

LOW
