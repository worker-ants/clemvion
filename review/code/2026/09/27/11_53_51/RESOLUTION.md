# RESOLUTION — `/ai-review` 1R (`review/code/2026/09/27/11_53_51`)

판정 기준 HEAD: `44f3a310d`(리뷰 대상). 리뷰 뒤 `git status --short` · `git diff --stat HEAD` 가 이 세션 디렉터리 외 변경 0 — 리뷰어
transcript 의 Write 는 전부 자기 산출물(`<role>.md`)이었다.

## 조치 항목

| SUMMARY # | 심각도 | 조치 | 커밋 |
|---|---|---|---|
| W1 | Warning | `undefined` 필터 관용구를 `src/common/utils/omit-undefined.ts` 로 추출(근거 JSDoc 한 곳). 폴더 · 트리거 `update()` 가 헬퍼를 호출한다. 헬퍼 단위 스펙 추가. 뮤턴트 H1~H4 전부 KILLED(plan §뮤턴트) | `692f1e8fd` |
| W2 | Warning | 트래커의 `plan/complete/folders-contract-e2e.md` 인용은 이 PR 의 마무리 커밋(`git mv`)이 경로를 만든다 — 코드 수정 없음. push 전 `git show HEAD:plan/complete/folders-contract-e2e.md` 로 실재 확인 | 마무리 커밋 |
| INFO 7 | Info | 서비스 주석의 e2e 케이스 문자 인용 → 파일명만 남김(헬퍼 추출로 주석 축소) | `692f1e8fd` |
| INFO 8 | Info | 폴더 «allows moving to root» 가 `toBeDefined()` → `expect(result.parentId).toBeNull()`. H1(null 까지 거르는 필터)을 이 테스트가 죽인다 | `692f1e8fd` |
| INFO 9 | Info | 폴더 «빈 본문이면 로드한 값을 그대로 저장한다» 추가 — 표의 어느 뮤턴트도 단독으로 가르지 않는 경계 문서화용 | `692f1e8fd` |
| INFO 1~6 | Info | 조치 불요 — 근거는 plan §`/ai-review` 1R | `55aaf0e1e`(plan · 트래커) |

## TEST 결과

- lint: 통과 (`_test_logs/lint-20260927-120737.log`)
- unit: 통과 (`_test_logs/unit-20260927-120835.log`)
- build: 통과 (`_test_logs/build-20260927-120958.log` — 타입체크 ratchet 포함)
- e2e: 통과 — 418 passed (`_test_logs/e2e-20260927-121245.log`, HEAD `55aaf0e1e`)

## 보류·후속 항목

- 헬퍼를 남은 세 곳(`workflows` · `nodes` · `auth-configs` 의 `update()`)에 적용하는 것 · 형태 금지 가드 판단 — 트래커
  `plan/in-progress/spec-draft-nullable-notation-followups.md` «`Object.assign(엔티티, DTO)` … 남은 세 곳» 항목에 헬퍼 존재와
  INFO 1(컨트롤러 `@Body()` 가 타입 있는 DTO 인지)을 반영해 갱신했다(`55aaf0e1e`).
