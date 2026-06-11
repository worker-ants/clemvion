# Documentation Review — auth-refresh-rotation-atomic (2차 라운드)

## 발견사항

### [INFO] `refresh()` 메서드 JSDoc — 추가됨, 내용 완전성 양호
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/auth-refresh-rotation-atomic/codebase/backend/src/modules/auth/auth.service.ts` (`refresh()` 직전 JSDoc 블록)
- 상세: 1차 리뷰(08_45_18) INFO 11 / W1 권고에 따라 `refresh()` 상단에 세 분기(reuse / 만료 / 정상 회전) 요약과 05 C-1 원자성 설명을 포함한 JSDoc 블록이 추가됐다. 내용이 구현 로직과 일치하며, 세 분기 설명이 순서대로 기술돼 있다.
- 제안: 없음. 현 상태 적절.

### [INFO] `generateTokens()` JSDoc — 추가됨, `@internal` 및 `manager` 파라미터 설명 포함
- 위치: 동일 파일 `generateTokens()` 직전 JSDoc 블록
- 상세: 1차 리뷰 W1 / INFO 11 권고에 따라 `@internal` 선언 + `manager` optional 전달 경로 설명이 JSDoc 으로 추가됐다. "public 승격 금지" 의도가 명시돼 있어 trust boundary 확장 방지 목적이 문서화됐다.
- 제안: 없음.

### [INFO] 테스트 케이스 맥락 주석 — 패턴 일관성 달성됨
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/auth-refresh-rotation-atomic/codebase/backend/src/modules/auth/auth.service.spec.ts` 신규 `it` 블록 네 개
- 상세: 1차 리뷰 INFO 12 권고에 따라 각 신규 테스트 블록 첫 줄에 `// 05 C-1 회귀 가드:` 형식 주석이 적용됐다. 기존 패턴과 통일성이 확보됐다.
- 제안: 없음.

### [INFO] `spec/data-flow/2-auth.md` 원자성 노트 — 구현 내부 식별자 참조 제거 확인 필요
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/auth-refresh-rotation-atomic/spec/data-flow/2-auth.md` §1.4 원자성 blockquote
- 상세: 1차 리뷰 INFO 10 권고(구현 파라미터명 직접 참조 제거)가 RESOLUTION 에서 "INFO 10 — 구현 수단 언급 제거, `auth.service.ts refresh()` 코드 참조 수준만 유지" 로 반영됐다고 기재돼 있다. 프롬프트 내 diff 에 spec 파일 변경분이 포함되지 않아 실제 텍스트로 직접 확인이 불가능하나, RESOLUTION/plan 체크리스트 양쪽에서 반영 완료로 표기돼 있으므로 이중 기재 위험은 낮다. 다만 spec 파일 원문을 리뷰 diff 에 포함하지 않아 검증에 제한이 있다.
- 제안: 다음 리뷰 사이클 또는 병합 전에 spec 파일 `§1.4` 원자성 노트에서 `generateTokens`, `EntityManager`, `optional` 등 구현 내부 식별자가 실제로 제거됐는지 최종 확인 권장. 현재 이슈 등급은 INFO 유지.

### [INFO] `plan/complete/auth-refresh-rotation-atomic.md` spec 경로 표기 — 규약 준수
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/auth-refresh-rotation-atomic/plan/complete/auth-refresh-rotation-atomic.md` frontmatter + 본문
- 상세: 1차 리뷰 INFO 14 / plan_coherence WARNING 에서 지적된 상대 경로 스타일 문제가 해결됐다. `spec_impact` frontmatter 가 `spec/data-flow/2-auth.md` 전체 경로로 기재돼 있고, 본문 `### Spec` 절도 동일 전체 경로 사용으로 통일됐다.
- 제안: 없음.

### [INFO] 롤백 테스트 주석 — 단위 mock 한계 명시 완료
- 위치: `auth.service.spec.ts` 내 `propagates failure when issuing the new token fails` 테스트 블록
- 상세: 1차 리뷰 W6 / INFO testing 권고에 따라 "단위 mock 은 실제 DB 롤백을 재현하지 못하므로 여기선 에러 전파만 검증하고, revoke+INSERT 가 한 트랜잭션 안에 있어 롤백된다는 사실은 dockerized e2e 로 보장한다." 주석이 추가됐다. 단언·주석 불일치가 해소됐다.
- 제안: 없음.

### [INFO] 영/한 주석 혼용 — 일부 잔존 허용 범위
- 위치: `auth.service.ts` `generateTokens()` 내부 (`expiresIn: 900, // 15분` 및 `// refresh token 생성`)
- 상세: 1차 리뷰 W5 에 따라 신규 주석은 한국어로 통일됐고, 기존 영어 인라인 주석 두 줄(`// 15 minutes` → `// 15분`, `// Create refresh token` → `// refresh token 생성`)도 한국어로 교체됐다. 함수 전체 수준에서 혼용이 최소화됐다. 코드베이스 내 여타 함수의 영어 주석과 혼재하는 파일 수준 혼용은 이번 변경 범위를 초과하므로 수용 가능하다.
- 제안: 없음. 현 수준 허용.

### [INFO] loginHistory 미기록 근거 주석 — 추가됨
- 위치: `auth.service.ts` `refresh()` 내 정상 회전 분기 트랜잭션 블록 인근
- 상세: 1차 리뷰 INFO 4(architecture) / INFO 4(spec 의도) 권고에 따라 "refresh 회전 성공은 loginHistory 에 기록하지 않는다 (spec §1.4 의도)" 취지의 주석이 추가됐음이 RESOLUTION 에서 확인된다. 의도된 누락임을 코드 내에서 명시해 향후 감사(audit) 요건 추가 시 경로가 명확해졌다.
- 제안: 없음.

---

## 요약

이번 변경(refresh 토큰 회전 원자화, 05 C-1)은 1차 리뷰(08_45_18) 에서 지적된 문서화 관련 INFO/WARNING 항목이 거의 전부 반영됐다. `refresh()` 와 `generateTokens()` 에 JSDoc 이 추가됐고, `@internal` 선언으로 trust boundary 가 문서화됐으며, 신규 테스트 케이스에 `// 05 C-1 회귀 가드:` 맥락 주석이 통일됐다. 롤백 테스트의 단언-주석 불일치도 해소됐고, plan 문서의 spec 경로 표기도 규약에 맞게 전체 경로로 수정됐다. 영/한 주석 혼용은 함수 내부 수준에서 한국어로 통일됐다. 유일하게 직접 diff 로 확인되지 않은 항목은 `spec/data-flow/2-auth.md §1.4` 원자성 노트에서 구현 내부 식별자 참조가 실제로 제거됐는지 여부이며, RESOLUTION 기재를 신뢰할 경우 반영 완료로 보나 병합 전 최종 육안 확인을 권장한다. 기능적으로 문서와 코드가 어긋나는 부분은 발견되지 않았다.

## 위험도

LOW
