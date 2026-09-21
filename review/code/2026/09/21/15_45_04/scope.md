# 변경 범위(Scope) 리뷰

## 발견사항

- **[INFO]** `CHANGELOG.md` 에 이번 PR(auth-configs, 일곱 번째)과 **무관한 별도 PR(#1373, `member.removed`, 여섯 번째)의 backfill 항목**이 함께 추가됨
  - 위치: `CHANGELOG.md:46-90`("## Unreleased — 동시 DELETE 두 건이 `member.removed` 감사 행을 두 번 남기던 것 (#1373 CHANGELOG 누락 backfill)")
  - 상세: 이번 PR 의 핵심 목표는 `AuthConfigsService.remove()` 하나다. 그런데 `CHANGELOG.md` diff 는 (a) 이번 PR 자체의 항목(46행 이전, gate 3-45)에 더해 (b) 이미 병합된 별도 PR(#1373)이 당시 빠뜨린 `CHANGELOG.md` 항목을 이번 diff 에서 대신 채워 넣는다. 이 자체는 은닉된 변경이 아니다 — 항목 제목에 "#1373 CHANGELOG 누락 backfill" 이라 명시했고, 커밋(`197425f51`)·`RESOLUTION.md`(WARNING1 조치)에도 명시적으로 남아 있으며, 직전 리뷰 라운드(15_18_16)의 WARNING1 이 지시한 조치를 그대로 집행한 것이다. 다만 "이번 PR 이 실제로 무엇을 바꾸는가" 기준으로 보면 다른 완료 PR 의 문서 부채를 이번 PR 의 커밋 이력에 끼워 넣은 것이라, 순수 스코프 관점에서는 여전히 경계 밖 확장이다. 코드 변경은 없고 문서(docs) 전용이라 리스크는 낮다.
  - 제안: 조치 불요 — 근거·출처가 이미 충분히 disclose 됐다. 다만 향후 "다른 PR 의 관례 누락 backfill" 은 이번처럼 같은 커밋에 이번 PR 항목과 묶기보다 별도 커밋으로 분리하면(이미 `197425f51` 은 별도 커밋이라 이 지적은 파일 내용 자체에 대한 것) 각 항목의 소유 PR 을 더 명확히 추적할 수 있다.

- **[INFO]** (직전 라운드 15_18_16 scope.md 의 확인을 재확인) `plan/in-progress/spec-draft-nullable-notation-followups.md`(다른 트래커) 편집 2건이 이번 라운드에서도 그대로 유지됨 — 신규 이슈 아님
  - 위치: `plan/in-progress/spec-draft-nullable-notation-followups.md:4845-4873`(RolesGuard 근거 정정), `:4947-4963`(열거 항목 일반화)
  - 상세: 두 편집 모두 이전 리뷰 라운드에서 이미 INFO 로 검토·수용됐고 이번 라운드에서 추가 변경이 없다. `plan/**` 범위 내이고 `plan/in-progress/authconfig-dup-delete.md` 체크리스트에 "부수 발견"으로 disclose 돼 있어 은닉성 문제는 없다.
  - 제안: 조치 불요 — 기존 판정 유지.

- **[INFO]** `auth-configs.service.spec.ts` 의 mock 정리(죽은 `remove` 필드 제거, no-op `mockClear` 제거)와 `auth-configs.service.ts` 의 `findById` JSDoc 재작성·주석 보강은 전부 이번 PR 이 만지는 두 파일 내부의 변경이고, 직전 리뷰(15_18_16)의 INFO1/3/5/9 조치를 그대로 집행한 것 — 새로운 범위 확장 없음
  - 위치: `codebase/backend/src/modules/auth-configs/auth-configs.service.spec.ts`(mock 팩토리 `delete`), `codebase/backend/src/modules/auth-configs/auth-configs.service.ts`(`findById` JSDoc, `remove()` 주석)
  - 상세: 모두 이번 PR 이 이미 수정 대상으로 삼은 두 파일 안에서 일어난 후속 정리이며, 대상 파일 밖으로 번지지 않았다.
  - 제안: 조치 불요.

- **[INFO]** `review/code/2026/09/21/15_18_16/**`(17개 산출물) · `review/consistency/2026/09/21/14_41_01/**`(8개 산출물)는 코드 변경이 아니라 `CLAUDE.md` 가 의무화한 `/ai-review`·`/consistency-check --impl-prep` 프로세스 산출물이며, `review/` 는 gitignore 대상이 아니므로 커밋에 포함되는 것이 관례와 일치한다 — 범위 이탈 아님.
  - 위치: `review/code/2026/09/21/15_18_16/*`, `review/consistency/2026/09/21/14_41_01/*`
  - 제안: 조치 불요.

- **[INFO]** 포맷팅·임포트·설정 파일 변경 없음. 신규 `import { DeleteResult } from 'typeorm'`(spec 파일)은 새 mock 반환 타입 명시에 실제로 쓰인다.
  - 제안: 없음.

## 요약

핵심 코드 변경(`auth-configs.service.ts` 의 `remove()` 원자적 `DELETE` 전환 + 회귀 테스트)은 명시된 목표(동시 삭제 이중 감사 로그 제거)에 정확히 대응하며, 이번 라운드에서 새로 추가된 후속 커밋들(mock 정리, JSDoc 재작성, e2e 필터, CHANGELOG 추가)도 대부분 직전 리뷰가 지시한 조치를 그대로 집행한 것으로 이미 수정 대상인 파일 범위 안에 머문다. 유일하게 스코프 경계를 넘는 새 항목은 `CHANGELOG.md` 에 **다른 완료 PR(#1373)의 문서 부채를 backfill** 한 부분인데, 커밋·항목 제목·RESOLUTION.md 에 출처가 명확히 disclose 돼 있고 코드 변경이 없어 리스크는 낮다. `plan/in-progress/spec-draft-nullable-notation-followups.md` 편집은 직전 라운드에서 이미 검토·수용된 상태 그대로다. 전반적으로 스코프는 잘 지켜졌다.

## 위험도

LOW
