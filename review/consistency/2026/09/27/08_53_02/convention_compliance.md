# 정식 규약 준수 검토 — `spec/conventions/` (impl-prep, dto-class-jsdoc-citation)

## 검토 대상

이번 라운드(`08_53_02`)는 직전 `--spec` 라운드(`review/consistency/2026/09/27/08_41_33`)가 지적한
WARNING 2건 + INFO 1건이 커밋 `c8bf27c8e`(spec) 에 실제로 반영됐는지, 그리고 그 반영이 `spec/conventions/`
자신의 명명·구조·인용 규약과 다시 어긋나지 않는지를 `--impl-prep` 관점에서 재확인한다. 대상은
`spec/conventions/review-citations.md` §3 신설 행 + Rationale 절, `spec/conventions/swagger.md` §3
문단 수정, 그리고 그 둘을 만든 planner draft(`plan/in-progress/spec-draft-review-citations-class-jsdoc.md`)다.

## 발견사항

이번 라운드에서 새로 지적할 CRITICAL·WARNING 은 없다. 직전 라운드 지적 사항의 반영 상태를 아래에 기록한다.

- **[INFO]** 직전 라운드 WARNING/INFO 전건 반영 확인 (정보성 — 조치 불요)
  - target 위치: `spec/conventions/review-citations.md` §3 표 + 신설 Rationale 절(`### §3 — 응답 DTO 클래스 JSDoc 도 인용을 쓰지 않는다 (2026-09-27)`), `spec/conventions/swagger.md` §3 JSDoc 문단, `plan/in-progress/spec-draft-review-citations-class-jsdoc.md`
  - 위반 규약: 해당 없음 — 직전 라운드(`08_41_33`)가 지적한 항목의 해소 여부 확인
  - 상세: 세 항목 모두 실측으로 확인됨.
    - **W1(swagger.md §3 동기화)** — `git show c8bf27c8e -- spec/conventions/swagger.md` 확인 결과, "플러그인이 `introspectComments` 로 JSDoc 을 `description` 에 그대로 싣는다" → "**프로퍼티** JSDoc" 으로 한정되고, "클래스 JSDoc 은 플러그인이 싣지 않지만 같은 분리를 따른다" 문장이 추가돼 review-citations.md §3 와 짝이 맞다.
    - **W2(draft 자체 `## Rationale` 부재)** — 최종 draft(`plan/in-progress/spec-draft-review-citations-class-jsdoc.md` L89-98)에 `## Rationale (draft)` 섹션이 신설되어 "왜 근거 문장을 고치면서 결론은 유지하나" + `--spec 08_41_33` 세 WARNING·두 INFO 각각의 반영 내역을 열거한다. `spec-draft-nullable-notation-followups.md`·`spec-draft-eia-62-waiting-payload.md` 와 같은 draft-레벨 `## Rationale` 관행을 따른다.
    - **INFO(표 두 번째 칸 산문화)** — 최종 표 행(`review-citations.md` L99)의 두 번째 칸은 `**대상 아님**` 단독이고, "필드와 같이 쓰지 않는다" 근거는 세 번째 칸에만 있다. draft 초안(L43, planner 턴 이전)엔 `대상 아님 — 필드와 같이 쓰지 않는다` 로 산문이 섞여 있었으나 실제 커밋에는 정리돼 반영됐다.
  - 제안: 없음 (확인용 기록)

- **[INFO]** swagger.md §3 문단이 새 하위 범위(클래스 JSDoc)를 추가하면서 개정 날짜 스탬프를 갱신하지 않음
  - target 위치: `spec/conventions/swagger.md` — "**JSDoc 은 공개 OpenAPI 로 나간다 — 내부 서사를 담지 않는다** (2026-09-05 규약화):" 제목 아래 문단
  - 위반 규약: 명시적 규약 위반은 아님 — 같은 문서 안에서 반복 관찰되는 자기 서술 관행("**반드시 적는다 — 보안·정책 캐비엇** (2026-08-17 규약화 · 2026-08-22 요청 필드까지 확장 · 2026-08-23 "예외"→"적극 지시" 재정의)")과 결이 다르다
  - 상세: 이번 편집으로 이 문단의 적용 범위가 "DTO 필드 JSDoc" 에서 "DTO 필드 + 응답 DTO 클래스 JSDoc" 으로 넓어졌는데, 제목의 날짜 스탬프는 여전히 `(2026-09-05 규약화)` 하나뿐이라 최초 규약화 시점만 보이고 2026-09-27 확장 사실이 제목에서는 드러나지 않는다. 같은 문서의 다른 절(§3 길이 규칙, 보안·정책 캐비엇)은 범위가 넓어질 때마다 날짜를 누적 병기하는 관행을 스스로 세워 두었다. 다만 이 문단은 본문에서 `[review-citations.md §3]` 링크로 실제 Rationale(2026-09-27 날짜가 명시된 곳)을 가리키고 있어 실질적 정보 손실은 없다.
  - 제안: (선택) 제목을 `(2026-09-05 규약화 · 2026-09-27 응답 DTO 클래스 JSDoc까지 확장)` 형태로 병기하면 이 문서 자신의 날짜-스탬프 관행과 완전히 정렬된다. 강제할 사안은 아니다.

## 검증한 사실관계 (반증 시도 결과 — 전부 통과)

- `git log --oneline -S'클래스 JSDoc' -- spec/conventions/review-citations.md spec/conventions/swagger.md` → 커밋 1개(`c8bf27c8e`)만 반환. "규약 두 문서에는 이 절이 처음이다" 주장과 일치.
- `#1291`·`#1292` 참조는 `plan/complete/**`·`plan/in-progress/spec-draft-nullable-notation-followups.md`(L1277-1301, 선행 트래커 항목 원문) 등에서 독립적으로 확인됨 — 지어낸 이력이 아니다.
- `@ApiSchema({ description })` 주장 — `codebase/backend/node_modules/@nestjs/swagger/dist/decorators/api-schema.decorator.d.ts` 에 `ApiSchemaOptions.description` 실재 확인(`@nestjs/swagger ^11.4.5`). Rationale 의 기술적 근거가 정확하다.
- 신설 앵커 `#3--응답-dto-클래스-jsdoc-도-인용을-쓰지-않는다-2026-09-27` — 표 안 링크(§3 신설 행)와 실제 Rationale 헤딩이 GitHub 슬러그 규칙상 정확히 일치(같은 문서 내 기존 앵커 `#1-6-numeric-wire-타입--가드와-규약의-책임-분리` 패턴과 동형 검증).
- 옛 미분할 행("DTO·컨트롤러의 `/** */` JSDoc" 한 행)의 잔존 인용을 `spec/**` 전체에서 grep — 0건. 다른 spec 문서가 옛 문구를 인용해 갈라지는 곳은 없다.
- 코드 쪽 대기 작업(가드 헤더 주석 2곳의 "둘 다 OpenAPI 로 나간다" 오기, 두 DTO 클래스 JSDoc 인용)은 `plan/in-progress/dto-class-jsdoc-citation.md` 체크리스트에 `[ ]` 로 아직 미착수 상태로 정확히 남아 있다 — spec 변경이 코드 상태를 앞질러 "이미 고쳐졌다"고 거짓 서술하는 곳은 없다.

## 요약

직전 `--spec` 라운드가 낸 WARNING 2건(swagger.md §3 미동기화, draft 자체 Rationale 부재)과 INFO 1건(표 칸 산문화)은 병합된 커밋(`c8bf27c8e`, `f1e943be4`)에 모두 정확히 반영됐음을 diff·앵커·git log -S·기술 문서(node_modules 타입 선언)로 직접 대조 확인했다. review-citations.md 는 Overview/본문/Rationale 3섹션 구조를 유지하며 새 Rationale 하위 절이 규약에 맞게 추가됐고, swagger.md 와의 상호 인용도 양방향으로 갈리지 않는다. 유일한 잔여 관찰은 swagger.md §3 제목의 날짜 스탬프가 이번 확장을 반영하지 않는다는 사소한 자기-일관성 결(INFO, 조치 선택적)뿐이며, 코드 쪽 대기 작업(가드 주석·DTO 클래스 JSDoc 이동)은 developer 플랜에 정확히 미착수로 남아 있어 spec-코드 간 허위 서술도 없다.

## 위험도

NONE
