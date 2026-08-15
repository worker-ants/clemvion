# 변경 범위(Scope) 리뷰 — eia-db-wire-invariant (누적 diff, origin/main..HEAD)

## 조사 방법

`git log --oneline origin/main..HEAD`(5커밋) + `git diff --stat origin/main..HEAD`(55파일,
+3222/-20)로 프롬프트의 `meta.json` 파일 목록(55개)과 전량 대조했다. 프롬프트에서 diff 가
생략된 대용량 파일(`retry-turn.service.spec.ts`, `plan/in-progress/eia-db-wire-invariant.md`
등)은 `git diff origin/main..HEAD -- <path>` 로 직접 열어 확인했다. `plan/in-progress/eia-db-wire-invariant.md`
의 ①②③ 항목과 "범위 밖(등재됨)" 절을 기준선으로 각 파일이 어디에 대응하는지 대조했다.

## 발견사항

없음. CRITICAL/WARNING 급 스코프 이탈을 찾지 못했다.

## 확인했으나 문제 없음 (스코프 정합 — 참고용)

- **핵심 코드 11개 파일**(`execution-engine.service.ts/.spec.ts`, `retry-turn.service.ts/.spec.ts`,
  `execution-status-response.dto.ts/.spec.ts`, `interaction.service.ts/.spec.ts`,
  `terminal-duration.ts/.spec.ts`, `CHANGELOG.md`)의 모든 hunk 가 plan 의 ①(`finalizeCancelledExecution`
  guarded UPDATE 결과 미확인) · ②(retry-turn CANCELLED 재진입 `RETURNING`) · ③(REST `durationMs`)
  중 정확히 하나에 대응한다. drive-by 리팩토링·무관한 함수 수정 없음.
- `retry-turn.service.ts` 의 신규 임포트(`toFiniteNumber`, `toPersistedDate`)는 둘 다 같은 파일
  664·670행에서 즉시 소비된다 — 미사용 임포트 없음.
- `.returning()` 되읽기가 `duration_ms` 뿐 아니라 `finished_at` 도 되쓴다 — plan 표제(`durationMs`)보다
  한 컬럼 넓지만, 같은 `COALESCE` UPDATE 문이 기존부터 `newFinishedAt` 파라미터를 이미 쓰고 있었고
  (반쪽만 되읽으면 in-memory 가 두 시각을 섞어 갖는 새 불일치가 생김), 회귀 테스트
  (`retry-turn.service.spec.ts` "emit 은 로컬 재계산값이 아니라..." 케이스)가 `finished_at` 되쓰기도
  단언한다 — 기능 확장이 아니라 기존 COALESCE 대상 컬럼의 완전한 처리다. 직전 라운드(`13_58_27`
  scope.md)도 동일 결론(INFO/조치 불요).
- `retry-turn.service.spec.ts` 의 mock 체인(`setParameter`/`returning`) 확장이 새 테스트 하나에
  그치지 않고 파일 전역 기본 mock·다른 describe 블록까지 퍼져 있으나, 프로덕션 코드가 같은
  query builder 체인에 `.returning()` 을 추가했으므로 **불완전한 mock 이 무관한 테스트를 조용히
  vacuous 하게 만드는 것을 막는 방어**(#1171 선례를 명시 인용)다 — 무관한 정리가 아니라 이번
  프로덕션 변경의 직접 파급.
- `spec/5-system/14-external-interaction-api.md` · `spec/conventions/node-cancellation.md` 편집은
  각각 §5.3 REST 필드(③) · §6.5 캐비엇 해소(②) · §2.4 매트릭스+Rationale 정정(①)에 정확히
  대응하고, 저장소 관행(취소선+해소노트 보존)을 그대로 따른다 — 원문 무단 삭제 없음.
- `plan/in-progress/spec-sync-external-interaction-api-gaps.md` 갱신은 자매 트래커 동시 갱신
  요구(plan 체크리스트, `13_43_10` consistency WARNING 대응)에 정확히 대응한다.
- `plan/in-progress/eia-db-wire-invariant.md` 자체가 "범위 밖(등재됨)" 절에서
  `finalizeStalledExhausted` 트랜잭션 · 관용구 헬퍼 추출 · 종결 emit 타입 파사드 · 프런트엔드
  Duration 컬럼 · 엔티티 nullable 타입 정정을 명시적으로 제외해 뒀고, 실제 diff 에 이들이
  전혀 나타나지 않는다 — 스코프 규율이 스스로 검증됨.
- `review/code/2026/08/15/{13_58_27,14_47_14}/**`(30파일) 와
  `review/consistency/2026/08/15/13_43_10/**`(8파일)는 developer 가 직접 작성한 것이 아니라,
  이 작업의 "구현 완료 후 자동 review/fix" 강제 워크플로(CLAUDE.md — impl-prep consistency-check
  의무, 구현 후 `/ai-review` + resolution-applier 상시 의무)가 생성한 정규 산출물이며, 브랜치의
  같은 작업 이력에 함께 커밋됐다. `RESOLUTION.md` 두 건이 실제로 그 라운드들의 Critical/Warning
  을 조치했음을 문서화하고 있어 무관한 편집이 아니라 이 PR 착수·검증 과정 자체다.
- `codebase/frontend/src/content/docs/02-nodes/triggers.mdx`/`.en.mdx` 1줄씩 추가는 `13_58_27`
  라운드에서 `user_guide_sync` 리뷰어가 지적한 REST 재조회 경로 문서 갱신(③의 직접 파급)이다.
- 포맷팅·주석 전용 변경, 사용하지 않는 임포트, 설정 파일(`.eslintrc`, `tsconfig`, `package.json`
  등) 변경은 55개 파일 전체에서 발견되지 않았다.

## 요약

`origin/main..HEAD` 55개 파일·3222(+)/20(-) 전량이 `plan/in-progress/eia-db-wire-invariant.md`
의 ①(finalizeCancelledExecution guarded UPDATE 결과 미확인) · ②(retry-turn CANCELLED 재진입
RETURNING) · ③(REST durationMs 추가) 세 항목, 그 스펙/트래커 미러, 그리고 이 작업 자체가
거친 두 라운드의 상시 의무 리뷰(`/ai-review` 13_58_27·14_47_14)·consistency-check(`13_43_10`)
산출물로 정확히 설명된다. 요청 외 리팩토링, 기능 확장(over-engineering), 무관한 파일 수정,
포맷팅 뒤섞임, 불필요한 주석/임포트 변경, 의도치 않은 설정 변경은 발견되지 않았다. 유일하게
표제보다 넓어 보이는 지점(retry-turn 되읽기가 `finished_at` 도 포함)도 실측 결과 기존 COALESCE
대상 컬럼의 완전한 처리로, 새 기능이 아니라 반쪽 되쓰기로 인한 새 불일치를 막는 방어였다.

## 위험도

NONE
