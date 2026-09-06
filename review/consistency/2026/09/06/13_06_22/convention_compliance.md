# 정식 규약 준수 검토 — `plan/in-progress/spec-draft-review-citations-enforcement.md`

## 발견사항

- **[CRITICAL]** 변경안 (A) 표가 컨트롤러까지 강제되는 것처럼 §3 을 넓혀 적는다 — 실제 가드는 DTO 만 본다
  - target 위치: `## 변경안 (A)` 삽입 markdown 블록의 표 —
    `| §3 (DTO·컨트롤러 JSDoc 카브아웃) | **예** — 위 가드 |`
  - 위반 규약: `spec/conventions/spec-impl-evidence.md` §2.1 (`code:` 는 *"본 spec 이 약속한
    surface 의 구현 경로"*이므로 등재/서술된 강제 범위는 실제 코드가 검사하는 범위와
    일치해야 한다) + `spec/conventions/review-citations.md` 자신의 `## Rationale` 마지막
    소절("이 수치를 처음 셀 때 거짓 0 을 냈다" — *"이 문서의 모든 수치는 그 절차[실측]를
    거쳤다"*)이 세운 이 문서 내부의 실측 원칙
  - 상세: 실제로 세운 `codebase/backend/src/repo-guards/__tests__/dto-jsdoc-citation-guard.ts`
    는 `isResponseDtoFile()` — 즉 `swagger-dto-contract-guard.ts` 의 판정을 그대로 재사용해
    파일 경로에 `/dto/responses/` 가 포함된 파일만 스캔한다. `findDtoJsDocCitations()` 의
    `visit()` 은 `ClassDeclaration`/`PropertyDeclaration` 만 순회하며, 어디에도 컨트롤러
    파일(`*.controller.ts`)을 스캔하는 경로가 없다 — 소비 테스트
    `dto-jsdoc-citation.spec.ts` 도 스캔 루트를 `collectTsFiles(SRC_ROOT, 'modules')` 전체로
    잡지만 필터가 DTO 로만 좁힌다. 즉 **가드는 "§3 의 DTO 카브아웃"만 강제하고 컨트롤러
    JSDoc 은 전혀 보지 않는다.**

    바로 위 변경안 (A) 의 산문(*"`dto-jsdoc-citation-guard.ts` 가 §3 의 DTO 카브아웃 —
    '응답 DTO 의 `/** */` JSDoc 에 리뷰 인용을 쓰지 않는다' — 을 AST 로 센다"*)과 변경안
    (C)(*"§3 의 DTO 카브아웃은 2026-09-06 이후 강제된다"*)는 정확히 "DTO" 축으로만
    좁혀 적었는데, 유독 변경안 (A) 의 표 왼쪽 열만 `review-citations.md §3` 원문 행의 이름
    (*"DTO·컨트롤러의 `/** */` JSDoc"*) 을 그대로 가져와 "예" 로 표시했다. 같은 변경안 안에서
    산문과 표가 서로 다른 스코프를 주장하는 내적 불일치이자, 표만 놓고 읽으면 컨트롤러
    JSDoc 인용도 이제 자동으로 걸러진다고 오해하게 만든다.

    이 문서 자체가 고치려는 문제(*"같은 위반이 세 번 났고 세 번 다 사람이 읽고 잡았다"* —
    수동 검토는 신뢰할 수 없다는 전제)를 감안하면, 커버되지 않는 컨트롤러 축을 "커버된다"고
    SoT 에 새로 적는 것은 실제보다 넓은 보장을 문서화하는 것과 같은 결함 패턴이다 — 이
    저장소에서 이미 반복 지적된 유형("문서한 보장이 구현보다 넓으면 안 된다")과 동형이다.
  - 제안: 표의 해당 행을 `§3 DTO 카브아웃(응답 DTO JSDoc, dto/responses/**)` 처럼 실제
    스캔 범위로 좁히고, 값을 "예 — 단 컨트롤러 JSDoc 은 미검증(수동 검토 유지)" 등으로
    정정한다. 컨트롤러까지 강제할 필요가 있다면 그것은 이 정정 범위를 벗어나는 별도
    변경(가드 확장)이므로 이번 Rationale 정정에서는 "부분 강제"로만 적어야 한다.

## 요약

이 target 은 `plan/**` 문서라 `review-citations.md §3` 적용 범위 밖(스스로 명시 예외)이고,
인용 형태(전체 경로 + 지적 번호)·근거 실측(git blame 으로 조건 1 확인, `spec-impl-evidence.md`
줄 번호 인용, 인용된 리뷰 세션 경로 2건 모두 실존 확인)은 견고해 정식 규약을 대체로 잘
따른다. 다만 이 문서가 제안하는 spec 정정문 자체에 정확성 결함이 하나 있다 — 변경안 (A)
의 "강제 여부" 표가 실제 가드 스캔 범위(DTO 전용)보다 넓게 "DTO·컨트롤러" 전체가 강제된다고
적어, 같은 변경안의 산문·변경안 (C) 와도 어긋난다. 이 표현이 그대로 `spec/conventions/`
SoT 에 반영되면 커버리지가 실제보다 넓다는 새로운 부정확이 심어지므로, `--spec` 게이트
반영 전에 반드시 정정해야 한다.

## 위험도
MEDIUM
