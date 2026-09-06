# 문서화(Documentation) 리뷰

## 개요

이 diff(`origin/main...HEAD`, 8개 커밋)는 `User` 엔티티 컬럼 노출 방어 3축(구조 축
`user-entity-exposure-guard.ts`, 이름 축 `user-secret-absence.ts`, JSDoc 인용 축
`dto-jsdoc-citation-guard.ts`) 신설 + 실유출 수정(`WorkflowVersionsService.findOne`) +
`spec/conventions/review-citations.md`·`spec-impl-evidence.md` 자기-반증형 소정정으로
구성된 최종 상태다. 이미 6차례의 `/ai-review`+`/consistency-check` 라운드
(`10_13_22`→`10_53_48`→`11_27_53`→`11_55_36`→`12_28_02`→`12_53_28`, `--spec` 라운드
`13_06_22`→`13_18_59`)를 거쳐 처분된 문서화 결함들을 실제 코드를 직접 열어 재확인했다.

과거 라운드가 지적한 문서화 결함이 전부 실제로 반영돼 있음을 확인했다 — 재발 없음:

- `user-entity-exposure-guard.ts` 의 orphan JSDoc(`findEagerUserRelations` 위에
  `collectUserRelationNames` 를 설명하는 블록이 붙어 있던 것, `11_55_36/documentation.md`
  WARNING)은 현재 각 함수가 자신을 설명하는 JSDoc 을 갖고 있다(`:83-102`, `:140-157`).
- `WorkspaceMemberDto.joinedAt` 필드 JSDoc 의 내부 서사 유출(공개 OpenAPI description 위반,
  `11_55_37` W3)은 공개 문장 한 줄만 남기고 근거·실측·구분을 `//` 로 내렸다(`:81-93`).
- `CHANGELOG.md` 제목의 "검출 2축" vs 실제 3축 불일치(`12_53_29` plan_coherence WARNING)는
  "검출 3축"으로 정정돼 있고, 본문 "택한 것" 목록도 세 항목을 1·2·3 순서(등장 순서와 일치)로
  정확히 나열한다 — `12_53_28/documentation.md` 가 지적한 1·3·2 번호 어긋남도 사라졌다.
- `review-citations.md`/`spec-impl-evidence.md` 의 "시행 코드가 없다" 는 반증된 전제는
  developer 가 쓴 문장이 아니므로(planner 턴 `90c1751e8`) 우회하지 않고 별도 planner 턴으로
  정정됐고, 원문은 취소선으로 남긴 채 축 단위(§2 미강제/§3 DTO 만 강제/§3 컨트롤러 미강제)로
  범위를 좁혀 적었다 — "문서한 보장이 구현보다 넓으면 안 된다" 원칙을 스스로 지킨 사례다.
- `dto-jsdoc-citation-guard.ts`/`.spec.ts` 는 "왜 세 형태 다 필요한가"·"왜 베이스라인이
  0 이 아닌가"·"왜 bare 시각까지 포함하는가"를 실측·과거 리뷰 인용과 함께 정확히 적었다.

## 발견사항

- **[WARNING]** planner 인계 표 자신이 세 줄 아래에서 경고하는 "narrow glob" 결함을, 바로 그 표의 다른 행이 이미 저지르고 있다
  - 위치: `plan/in-progress/spec-draft-nullable-notation-followups.md:396`(표 1행 —
    `구조 (관계 로드 형태) | user-entity-exposure-guard*.ts | ...`) vs 같은 문서
    `:400`(`**glob 은 \`-guard\` 를 붙이지 않는다** — 붙이면 \`.spec.ts\` 가 빠지는데,
    베이스라인과 fixture 대조군이 사는 곳이 그 파일이다`)
  - 상세: 실제 파일명을 확인한 결과 구조 축은 가드 파일이 `user-entity-exposure-guard.ts`,
    소비 스펙이 `user-entity-exposure.spec.ts` 로 **`-guard` 접미어가 스펙 파일명에서
    빠진다**(`find codebase/backend/src/repo-guards/__tests__ -iname '*user-entity-exposure*'`
    로 확인). `user-entity-exposure.spec.ts` 안에는 이 축의 베이스라인 래칫
    `EXPECTED_USER_RELATION_LOADS`(`:70`)가 실제로 산다. 그런데 표 1행이 등재를 지시하는
    glob 은 `user-entity-exposure-guard*.ts` 이고, 이 패턴은 `-guard` 를 요구하므로
    `user-entity-exposure.spec.ts` 를 **매치하지 못한다** — 세 줄 뒤(`:400`)에서 이 문서
    자신이 "이렇게 하면 베이스라인/fixture 대조군이 spec-linked 판정에서 빠진다"고 명시적으로
    경고하는 바로 그 형태다(`review/consistency/2026/09/06/13_06_22` W2 가 JSDoc 축에서
    잡은 것과 동일 패턴). 2행(이름 축, `user-secret-absence*.ts`)은 가드·스펙 파일명이
    같은 접두어를 공유해(`user-secret-absence.ts`/`user-secret-absence.spec.ts`) 이 문제가
    없다 — 1행만 걸린다. 이 표는 다음 planner 턴이 문자 그대로 집행할 지시문이므로, 지금
    고치지 않으면 §5.4 등재 작업이 "구조 축의 스펙/fixture 변경은 여전히 재검토 트리거가
    안 걸린다"는, 이 PR 전체가 고치려던 것과 같은 등급의 사각지대를 새로 심게 된다.
  - 제안: 표 1행의 glob 을 `user-entity-exposure*.ts`(또는 `-guard` 없는 공통 접두어
    기준)로 좁혀 두 파일 모두를 포함하도록 정정한다. `:400` 의 캐비아트를 표 바로 아래가
    아니라 표 각 행 옆에 적용 결과로 반영하면 다음에 이 표만 보고 실행하는 사람이 같은
    실수를 반복하지 않는다.

## 요약

이 diff 는 6차례 이상의 리뷰·컨시스턴시 라운드를 거치며 지적된 문서화 결함(orphan JSDoc,
필드 JSDoc 공개 노출 위반, CHANGELOG 축수 불일치·번호 어긋남, 반증된 spec Rationale 전제)을
전부 실제로 해소했고, 이번 라운드에서 코드·spec·plan 을 직접 열어 재확인한 결과 재발은 없다.
새로 찾은 유일한 결함은 `plan/in-progress/spec-draft-nullable-notation-followups.md` 의
§5.4 등재 인계 표 1행이 사용하는 glob(`user-entity-exposure-guard*.ts`)이, 같은 문서가
세 줄 아래에서 명시적으로 경고하는 "`-guard` 접미어를 붙이면 `.spec.ts` 베이스라인이
빠진다"는 실수를 그대로 재현하고 있다는 점이다. 이 표는 다음 planner 턴이 그대로 집행할
지시문이라 실질적 영향이 있고, 이 저장소가 반복적으로 겪어 온 "narrow glob" 결함 계열과
동형이라 WARNING 으로 판단한다.

## 위험도

LOW
