# 정식 규약 준수 검토 — convention_compliance

## 검토 범위와 방법

`spec/conventions/**` 자체는 이번 PR에서 **변경되지 않았다** (diff-base `origin/main` 대비 델타 0개 파일 — 정상, 코드 전용 PR). 번들(`_prompts/convention_compliance.md`)은 `spec/conventions/` 전체를 실었으나 예산상 대부분(`error-codes.md`·`node-output.md`·`swagger.md` 등 포함, cafe24 카탈로그 하위 트리 다수)이 "본문 생략됨 — 컨텍스트 예산 초과"로 절단되어 있었다. 실제 구현 diff(6개 파일 / 490줄, `codebase/backend/src/repo-guards/__tests__/trigger-secret-columns-{guard,spec}.ts` 신설 + `trigger-workflow-ref.spec.ts`/`*.e2e-spec.ts` 3건 수정)는 워킹트리(`.claude/worktrees/trigger-canary-hardening-a71e04`)에서 `git diff origin/main...HEAD -- codebase/` 로 직접 재확인했고, 그 diff가 실제로 참조하는 conventions 문서(`review-citations.md`, `secret-store.md`, `spec-impl-evidence.md`, `raw-query-results.md`)는 절단분과 무관하게 전문을 직접 Read 로 대조했다. 따라서 판정 관점 1(명명)·2(출력 포맷)·4(API 문서)는 이번 diff에 해당 표면(신규 API/DTO/에러코드/식별자 규약)이 없어 **해당 사항 없음**이고, 실질 검토는 관점 5(금지 항목 준수 — 특히 review-citations.md·secret-store.md)에 집중됐다.

## 발견사항

이번 diff(codebase 6파일)에서 spec/conventions/** 위반은 **발견되지 않았다.**

- **review-citations.md 준수 확인** — 신규/수정 파일의 모든 리뷰 인용이 전체 경로 형태(`review/code/2026/09/14/11_27_40` 등, §2 "권장" 형)를 쓰고 있고 bare `hh_mm_ss` 형태는 0건이다 (`trigger-secret-columns-guard.ts`/`.spec.ts`의 `11_27_40`/`11_52_13`/`12_17_14` 인용, `trigger-workflow-ref.spec.ts`의 `2026/09/10/16_26_57` 인용 모두 날짜 포함). `trigger-workflow-ref.spec.ts`에서 두 개의 리뷰 인용 문장이 통째로 제거됐으나(§1 "인용은 유지한다"의 주어는 `review/**` 산출물 자체의 보존이지 소스 주석에서 인용을 지우지 말라는 규칙이 아니므로) 위반 아님 — 개발자 스스로도 plan(`plan/in-progress/trigger-canary-hardening.md` INFO#3)에서 동일하게 판단해 등재해 두었고, 그 판단은 §1 원문과 일치한다.
- **secret-store.md §R4 인용 정확성 확인** — `trigger-workflow-ref.e2e-spec.ts`의 새 주석이 "이 판단은 테스트 인프라 한정이고 `secret-store.md §R4`(explicit application 경로 정리, implicit cascade 기각)와 충돌하지 않는다"고 주장하는데, §R4 원문("`ON DELETE CASCADE` 는 채택하지 않는다 … trigger 삭제 시의 명시적 cleanup 책임은 `TriggersService.delete()` 가 진다")과 대조한 결과 그 구분(프로덕션 삭제 경로 vs e2e teardown 관례)은 정확하다. 다만 §R4 원문이 실제 메서드명 `remove()` 대신 옛 이름 `delete()`를 쓰고 있는 것은 spec 자체의 기존 오기이며, 이는 이번 diff가 만든 문제가 아니라 이미 `plan/in-progress/spec-draft-nullable-notation-followups.md`에 planner 항목으로 정확히 등재되어 있다 (developer는 `spec/**` 쓰기 권한이 없으므로 직접 수정하지 않고 등재만 한 것이 CLAUDE.md 역할 경계와 일치).
- **raw-query-results.md 비대상 확인** — 수정된 e2e 파일들의 `db.query('DELETE FROM trigger …')` / `db.query('SELECT is_active FROM schedule …')` 는 `RETURNING` 절이 없어 이 규약(튜플 반환 규약)의 적용 대상이 아니다.
- **spec-impl-evidence.md 관련 — 위반 아님, 이미 추적됨** — 신규 가드(`trigger-secret-columns-{guard,spec}.ts`)가 어떤 spec의 frontmatter `code:` 에도 등재돼 있지 않다. 그러나 `spec-impl-evidence.md`는 "spec의 `status: partial/implemented` 가 ≥1 매치를 요구"할 뿐 "모든 구현 파일이 어느 spec `code:` 에 등재돼야 한다"는 전수 의무를 두지 않는다. 개발자가 plan에서 이미 전수 실측(repo-guard 14개 중 5개만 등재, 9개 미등재 — cafe24 계열 가드 3개 포함)해 "관례 자체가 존재하지 않는다"는 근거로 planner 항목으로 넘겼다 — 새로운 결함이 아니라 정확히 스코프된 기존 갭의 재확인이다.
- **인용 라벨 형식(`WARNING#2` vs `W2`) — 규약 미규정, 문제 아님** — 신규 가드 주석은 `WARNING#2` 형태를 쓰는데 저장소 다수(43곳)는 `W2` 축약형을 쓴다. `review-citations.md`는 "지적 번호를 함께 적으면 더 좁혀진다"고만 하고 라벨 표기 형식 자체는 규정하지 않으며, `WARNING#N` 형태도 기존 5개 파일(`guide-identifier-existence.test.ts` 등)에 이미 선례가 있다 — 규약 위반이 아니다.

## 요약

이번 PR은 `spec/conventions/**` 을 직접 건드리지 않는 코드 전용(테스트/가드) 변경이며, 실제로 참조·인용하는 정식 규약(review-citations.md의 인용 형식, secret-store.md §R4의 프로덕션/테스트 경계, raw-query-results.md의 적용 범위, spec-impl-evidence.md의 `code:` 등재 의무 범위) 을 전부 원문과 대조한 결과 위반이 없다. 오히려 개발자가 스스로 규약 원문을 정확히 재확인하며(§R4 오기, `code:` 미등재 관례 부재, §1 인용-유지의 진짜 주어 등) 여러 차례 자기 주장을 반증·정정한 흔적이 plan에 남아 있어, 정식 규약 준수 관점에서는 이례적으로 견고하다. 발견된 것은 전부 개발자가 이미 planner 항목으로 정확히 등재해 둔 기존(pre-existing) spec 결함들뿐이며 이번 diff가 새로 만든 위반은 없다.

## 위험도

NONE
