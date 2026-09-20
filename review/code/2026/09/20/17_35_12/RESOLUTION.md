# RESOLUTION — 17_35_12

## 조치 항목

| SUMMARY # | 분류 | 조치 commit | 비고 |
|-----------|------|-------------|------|
| WARNING 1 | 테스트 | `ab0988f7f` | 락 안 재검증(`freshErrors`) 삭제 뮤턴트를 잡는 단위 테스트 추가 |
| WARNING 2 | 테스트 | `ab0988f7f` | 락 안 재읽기 `where` 의 `workspaceId` 스코핑 단언 추가 |
| WARNING 3 | 아키텍처/유지보수성 | `af6cc0d2c` | `assertCanRotate(row, userRole)` private 헬퍼로 권한 재검사 로직 통일 |
| WARNING 4 | 아키텍처/유지보수성 | `af6cc0d2c` | `mergeAndValidateCredentials(row, patch)` private 헬퍼로 병합+검증 로직 통일 |
| WARNING 5 | 유지보수성 | `af6cc0d2c` | 위 두 헬퍼 추출만으로 `rotate()` 144줄 → 약 105줄 축소(요청대로 3·4와 함께 처리) |
| WARNING 6 | 부작용/테스트 | `154e17d31` | e2e `BEGIN`~`COMMIT` 구간을 `try/finally` 로 감싸고 `pending` 을 드레인 |
| WARNING 7 | 범위 | (조치 없음 — 의도적) | main 의 Gate C red 수정(`e22d5a9ee` 계열)은 되돌리지 않는다. 아래 "보류·후속 항목" 참고 |
| WARNING 8 | 문서화 | `d532184f5` | `CHANGELOG.md` 에 선례(`trigger-config-lost-update`)와 같은 형식으로 Unreleased 항목 추가 |

## TEST 결과

- lint  : 통과
- unit  : 통과 (14 suite wrapper 집계, `integrations/` 범위 단독 실행은 19 suite / 567 test 통과 — WARNING 1·2 신규 테스트 2건 포함)
- build : 통과
- e2e   : 통과 (367/367 — 기존 `integration-rotate-concurrency.e2e-spec.ts` 포함 전량 GREEN)

### 뮤테이션 검증 (WARNING 1, 2 신규 테스트)

`cp` 백업 후 `integrations.service.ts` 를 두 갈래로 각각 뮤테이트해 `jest -t "rotate"` 로 확인, 이후 `cp` 로 원복(`git checkout` 미사용):

1. 락 안 재읽기 `where: { id: entity.id, workspaceId }` → `where: { id: entity.id }` (workspaceId 스코핑 제거)
   → `142 total: 1 failed, 129 skipped, 12 passed` (신규 WARNING 2 단언이 RED)
2. 락 안 `freshErrors` 재검증 블록(계산 + `if (freshErrors.length) throw ...`) 전체 삭제
   → `142 total: 1 failed, 129 skipped, 12 passed` (신규 WARNING 1 테스트가 RED)

원복 후 재확인: `integrations/` 전 스위트 567 test 전부 GREEN.

## 보류·후속 항목

- **WARNING 7 (범위, 조치 없음)**: 이번 PR 의 `5c694cc5f`/`f3ea25d02` 는 rotate lost-update 수정과 무관한
  main 의 Gate C(`spec-plan-completion.test.ts`) red(직전 PR #1367 이 `plan/complete/` 에 넣은 draft 의
  YAML 파싱 깨짐)도 함께 고쳤다. 이미 커밋돼 있고, 그 수정을 되돌리면 frontend/harness 게이트가 다시
  red 가 되므로 **되돌리지 않았다** — SUMMARY 의 권장 조치(향후 별도 PR 로 분리)는 이번 PR 범위에서는
  적용하지 않는다. 다음에 유사 상황(선행 PR 이 깨뜨린 게이트 수정 + 이번 기능 변경)이 생기면 커밋을
  분리할 것.
- INFO 5 (락 대기 상한 없음), INFO 7 (테스트한 조합 ≠ 커밋 조합)은 `plan/in-progress/rotate-lost-update.md`
  §B·§D 에 명시적으로 유예된 결정이라 이번 조치에서 되돌리거나 재지적하지 않았다.
- 그 외 INFO 항목(1~4, 6, 8~17)은 전부 긍정 기록/조치 불요/선택 사항으로 SUMMARY 자체가 표시하고
  있어 추가 조치를 하지 않았다.
