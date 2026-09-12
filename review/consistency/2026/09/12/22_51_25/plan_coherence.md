# Plan 정합성 검토 — spec/5-system/ (--impl-prep)

## 검토 대상

- target: `spec/5-system/**` (구현 착수 전 검토, 실질적으로는 `plan/in-progress/keyset-cursor-uuid-validation.md`
  — worktree `filter-pg-invalid-text` — 가 이 spec 번들을 근거로 착수하려는 구현)
- 초점 plan: `plan/in-progress/keyset-cursor-uuid-validation.md`

## 발견사항

- **[WARNING]** 22P02 트래커 항목의 종결 대상 파일이 체크리스트에 명시되지 않아 — 열린 모순 항목이 남을 위험
  - target 위치: `spec/5-system/3-error-handling.md §1.3` (`VALIDATION_ERROR` 행 — "JWT 클레임은 검증하지 않는다" 원칙. `keyset-cursor-uuid-validation.md` §A 가 이 문장을 근거로 필터 won't-do 를 결정한다)
  - 관련 plan: `plan/in-progress/spec-draft-nullable-notation-followups.md:3190-3201` — *"`GlobalExceptionFilter` 가 SQLSTATE 22P02 를 분류하지 않는다 — 파이프 밖 유입 경로는 여전히 500 마스킹"* 항목. 처분 제안이 명시적으로 *"필터에 `invalid_text_representation`(22P02) → `400 VALIDATION_ERROR` 분기"* 이고, 착수 조건으로 *"지금 22P02 로 500 을 받는 자리가 어디이고 그중 400 이 맞지 않은 곳이 있는지를 먼저 세라"* 를 적어 두었다.
  - 상세: `keyset-cursor-uuid-validation.md` 는 스스로 *"트래커 항목 '`GlobalExceptionFilter` 가 SQLSTATE 22P02 를 분류하지 않는다' 로 착수했는데, 등재할 때 적어 둔 처방이 실측에 반증됐다"* 고 밝히며 위 항목을 정확히 지목한다(문구가 사실상 동일). §A 의 처분은 *"필터는 건드리지 않는다. 트래커 항목은 won't-do 로 종결하되 근거를 함께 남긴다"* 이고, 이는 `spec-draft-nullable-notation-followups.md` 의 열린 "처분 제안"과 **정면으로 반대**되는 결론이다(하나는 "분기를 추가하라", 다른 하나는 "건드리지 말라"). 그런데 체크리스트에는 `- [ ] A: 필터 won't-do 근거를 트래커에 기록 + 항목 종결` 이라고만 적혀 있어 **어느 파일의 어느 항목을 닫아야 하는지 명시하지 않는다.** 대상 파일(`spec-draft-nullable-notation-followups.md`)은 이름만 봐서는 "널러블 표기" 트래커로 보여 주제와 무관해 보이고, grep(`22P02`) 없이는 발견하기 어렵다. `- [ ] C: 트래커 2건 등재` (두 커서 디코더의 실패 계약 불일치·중복 구현) 도 같은 형태로 대상 파일이 없다. 이 배치를 집행하고 A/C 항목을 다른 곳에(또는 아무 데도) 기록하면, `spec-draft-nullable-notation-followups.md:3190-3201` 에는 이미 처리(won't-do)된 사안에 대해 "분기를 추가하라"는 처분 제안이 계속 **열린 채로** 남아, 두 plan 문서가 같은 사안에 대해 모순되는 상태로 `plan/in-progress/` 에 공존하게 된다. 이 저장소는 실제로 같은 형태(대상 문서 미명시로 인한 후속 항목 유실)를 반복 학습한 이력이 있다(비교: 같은 22P02 계열의 자매 항목을 다룬 `trigger-uuid-and-guide-error-codes.md` 는 *"두 항목 모두 `spec-draft-nullable-notation-followups.md` 에 등재한다"* 로 대상 파일을 **명시**했다 — 이 plan 만 관례를 벗어난다).
  - 제안: `keyset-cursor-uuid-validation.md` 체크리스트 A·C 에 대상 경로를 `plan/in-progress/spec-draft-nullable-notation-followups.md` 로 명시하고, 실행 시 해당 항목(3190-3201행)을 취소선 처리한 뒤 "해소(won't-do, 근거: keyset-cursor-uuid-validation.md §A)" 각주를 남기도록 고정한다. C 의 두 신규 등재 항목도 같은 파일(또는 대체 SoT)에 실제로 적었는지 실행 후 재확인.

- **[INFO]** `spec_impact` frontmatter 필드 부재
  - target 위치: `plan/in-progress/keyset-cursor-uuid-validation.md` frontmatter (`worktree`/`started`/`owner` 만 있고 `spec_impact` 없음)
  - 관련 plan: 동일 문서. 본 plan 은 spec 문서를 직접 쓰지 않는 것으로 보이므로(§A 는 기존 spec 문장을 근거로만 인용, §B 는 이미 등재된 `INVALID_CURSOR` 코드를 재사용) `spec_impact: none` 이 타당해 보이지만, 필드 자체가 없어 `--impl-done` 단계의 Gate C 판정이 이를 명시적으로 확인할 근거가 비어 있다.
  - 상세: 결정 우회나 후속 누락과 직접 연결되지는 않으나, Gate C 관례(`spec_impact` 는 리스트 또는 bare `none`)를 따르지 않아 이후 게이트 실행 시 재작업 소지가 있다.
  - 제안: 구현 착수 전에 `spec_impact: none` 을 frontmatter 에 명시.

## 요약

`keyset-cursor-uuid-validation.md` 는 스스로 착수 전제("22P02 로 500 을 받는 자리 전수")를 충실히 이행했고, 그 결과 도출한 결론(필터는 건드리지 않는다 · keyset id 는 각 디코더 자리에서 `isUuidShaped` 로 검증)은 `spec/5-system/3-error-handling.md §1.3` 이 이미 명문화한 "JWT/서버 기원 값은 400 으로 재분류하지 않는다" 원칙 및 기존에 확정된 UUID 검증 강도 비대칭 선례(`auth-guard-reflection-hardening.md`, 완료·머지됨)와 정합한다 — 새로운 결정을 우회하거나 미해소 선행조건에 기대는 부분은 없다. 다만 이 plan 이 종결·신규 등재하려는 두 트래커 항목(§A: `spec-draft-nullable-notation-followups.md` 의 22P02 필터 처분 제안 / §C: 커서 디코더 계약 불일치·중복 구현)이 체크리스트에서 대상 파일 없이 "트래커에 기록"으로만 적혀 있어, 실행 후에도 다른 plan 문서에 모순되는 열린 항목이 남을 위험이 있다. 이는 코드 착수 자체를 막을 사안은 아니지만 plan 갱신이 필요한 WARNING 급 정합성 리스크다.

## 위험도

MEDIUM
