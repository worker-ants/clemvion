# Plan 정합성 검토 — spec/2-navigation/ (patch-null-validation, --impl-prep)

## 발견사항

- **[WARNING]** 신규 공용 데코레이터 `optional-non-null.ts` 가 `omit-undefined.ts` 와 똑같이 "spec `code:` 미등재" 라는 이미 열려 있는 planner 결정 항목을 확장하는데, `patch-null-validation.md` 는 이를 인지·등재하지 않는다
  - target 위치: `spec/2-navigation/2-trigger-list.md` frontmatter `code:` (트리거 `dto/**` 는 등재돼 있으나 `codebase/backend/src/common/utils/optional-non-null.ts` 는 없음), 동일하게 `1-workflow-list.md`(폴더·워크플로) · `3-schedule.md` 등도 이 데코레이터를 쓰게 될 DTO 를 갖는다
  - 관련 plan: `plan/in-progress/spec-draft-nullable-notation-followups.md` 의 열린 항목 "`code:` 파서 두 벌…" 이 아니라, 같은 트래커의 `spec/2-navigation/` 목록 API 항목(6348번째 줄 부근) 아래 "(6) 공용 헬퍼 `omit-undefined.ts` 가 어느 spec 의 `code:` 에도 없다 … 둘 곳은 planner 가 정한다"(2026-09-27 보강) — 그리고 같은 절 "모집단 확장" 각주가 이미 폴더→트리거→워크플로→노드→인증설정 5문서로 넓어졌다고 적어 둔 바로 그 미해결 결정
  - 상세: `2-trigger-list.md` 는 이미 "헬퍼도 등재 — 단언의 정본이 헬퍼에 있어 e2e 만 넣으면 그 정본이 `code:` 밖에 남는다" 는 원칙을 `trigger-workflow-ref*.ts` 에 대해 명시적으로 적용하고 있다. `optional-non-null.ts` 는 정확히 같은 형태의 SoT다 — null 거부 로직의 정본이 13개 라우트(폴더·워크플로·노드·트리거·스케줄·알림·통합·모델설정·지식베이스·인증설정·users/me·테스트데이터셋·어시스턴트 세션)에 걸쳐 있는데, 그중 어느 도메인 spec 의 `code:` 에도 등재 계획이 `patch-null-validation.md` 본문·체크리스트("데코레이터 · DTO · e2e · 단위 · CHANGELOG · 트래커")에 없다. `omit-undefined.ts` 사례(5문서로 이미 "모집단 확장" 이력이 남음)보다 더 넓은 축(13라우트)이라 같은 drift 가 반복될 가능성이 크다
  - 제안: `plan/in-progress/spec-draft-nullable-notation-followups.md` 의 해당 항목(공용 헬퍼 `code:` 미등재)에 `optional-non-null.ts` 를 새 모집단으로 추가해 등재하거나, `patch-null-validation.md` 체크리스트의 "트래커" 항목에 이 파일을 명시. 등재 위치(도메인 spec 각각 vs `spec/5-system/2-api-convention.md` §5.4 한 곳) 자체는 이미 planner 결정 대상으로 열려 있으므로 이 PR 이 스스로 결정할 필요는 없으나, **결정이 나올 때까지 이 신규 파일도 같은 대기열에 있다는 사실**은 지금 남겨야 다음 세션이 두 헬퍼를 따로 재발견하지 않는다

- **[INFO]** `details[].code` 세분화 미결정이 이 PR 의 400 응답에도 동일하게 적용된다
  - target 위치: `spec/2-navigation/2-trigger-list.md` §3 PATCH 註 (`details.field`/`details.code` 형식을 필드별로 상세히 등재하는 관행)
  - 관련 plan: `plan/in-progress/spec-draft-nullable-notation-followups.md` "`details` 의 도메인 특화 세부 코드를 신설할지 — `INVALID_FIELD` 하나로는 사유가 안 갈린다" (2026-09-11 등재, planner + 결정, 미해결)
  - 상세: `patch-null-validation.md` 가 신설하는 43필드 null 거부는 모두 class-validator 기본 `INVALID_FIELD` 로 나갈 것으로 보인다(플랜 본문에 별도 세부 코드 설계 없음). 열린 항목이 지적한 "이유가 다른 400 을 같은 코드로 뭉뚱그린다" 는 우려와 같은 축이지만, 이 PR 의 43필드는 거부 사유가 전부 "null 은 이 필드에서 허용 안 됨" 하나로 동질적이라 그 항목이 문제 삼는 *"triggers.service.ts 의 서로 다른 사유"* 케이스와는 다르다 — 충돌이 아니라 모집단이 늘어난다는 참고
  - 제안: 별도 조치 불필요. 위 planner 결정 항목이 "소비자가 실제로 갈라 쓰는가" 를 판단 기준으로 이미 적어 뒀으므로, 이 PR 은 등재만으로 충분

- **[INFO]** `keyset-cursor-uuid-validation.md` §A 선례와의 정합은 확인됨 — 별도 조치 불필요
  - target 위치: `plan/in-progress/patch-null-validation.md` "처방 — 입구 검증(필터 매핑 아님)"
  - 관련 plan: `plan/in-progress/keyset-cursor-uuid-validation.md` §A (필터에 SQLSTATE 매핑 기각, 입구마다 조기 거부 전략 채택 — 이미 `[x]` 로 해소·`--impl-done` 만 남음)
  - 상세: `patch-null-validation.md` 가 이 선례를 정확히 인용하고 있고, 선례 자체는 이미 결론이 난 상태(전체 체크리스트 완료, `--impl-done` 만 미체크)라 미해결 전제에 기대는 것이 아니다. 충돌 없음을 확인차 기록

## 요약

`spec/2-navigation/` 번들과 `plan/in-progress/**` 를 대조한 결과, `patch-null-validation.md` 가 겨냥하는 43필드(폴더·트리거·워크플로 등)에 대해 **미해결 결정을 우회하는 CRITICAL 항목은 없다** — 필터-매핑 대신 입구 검증을 택한 설계는 `keyset-cursor-uuid-validation.md` §A 가 이미 확정한 선례를 정확히 따르고, `triggers.endpointPath`(D2, DB 는 nullable) 처럼 언뜻 원칙 예외로 보이는 항목도 실제 DTO(`update-trigger.dto.ts`)를 확인하면 이미 `nullable` 미선언 상태라 그룹 A 와 동일한 "선언은 맞고 런타임이 느슨했다" 패턴이다. 다만 신규 공용 데코레이터 `optional-non-null.ts` 는 `omit-undefined.ts` 가 이미 열어 둔 "공용 헬퍼가 spec `code:` 어디에도 등재되지 않는다" 는 planner 미해결 결정을 13라우트 규모로 재현하는데, 이 사실이 plan 에 반영돼 있지 않아 WARNING 하나로 등재를 권고한다.

## 위험도

MEDIUM
