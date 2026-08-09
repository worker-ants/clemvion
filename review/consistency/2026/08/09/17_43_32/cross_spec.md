# Cross-Spec 일관성 검토 — `spec/conventions/` (--impl-done)

## 검토 방법 및 핵심 관찰

meta 상 검토 모드는 `--impl-done, scope=spec/conventions/, diff-base=origin/main` 이다. 그러나
실제 워킹트리(`/Volumes/project/private/clemvion/.claude/worktrees/backend-typecheck-gap-3d7a91`)에서
`git diff origin/main...HEAD --name-only` 를 절대경로 기준으로 직접 실행해 확인한 결과, **이 diff 에는
`spec/**` 하위 파일이 단 1개도 포함되어 있지 않다** (`grep -c '^spec/'` = 0, 총 38개 변경 파일은 전부
`.claude/tests/**`, `.github/workflows/**`, `PROJECT.md`, `codebase/backend/src/modules/**`(6개 spec
테스트 + `secret-resolver.service.ts` 1개), `plan/in-progress/backend-lint-gate-broken-on-main.md`,
`review/**`(이전 코드/일관성 리뷰 산출물), `scripts/backend-typecheck-baseline.json`,
`scripts/check-backend-typecheck-ratchet.py` 뿐이다).

즉 프롬프트에 번들된 `spec/conventions/` 전문(및 "관련 spec 본문" 비교 대상)은 **이번 diff 로 신규
작성·수정된 target 문서가 아니라 기존 상태 그대로**다. Cross-Spec 검토가 전제하는 "target 문서(draft)가
다른 spec 영역과 충돌하는가" 라는 질문 자체가 이 diff 에는 적용되지 않는다 — 새로 도입되거나 변경된
spec 서술이 없으므로 새로 발생할 수 있는 cross-spec 모순도 없다.

## 참고: 유일한 프로덕션 코드 변경에 대한 spec 정합성 스팟체크

target 스코프 밖이지만, 이 diff 의 유일한 프로덕션 코드 변경(`secret-resolver.service.ts`)이
`spec/conventions/secret-store.md` 가 규정하는 `SecretResolver` 컨트랙트와 상충하지 않는지 참고로
확인했다:

- 변경 내용: `deleteByPrefix(prefix)` 가 `secret://` 접두 검증에 더해 `LIKE` 메타문자(`%`, `_`, `\`)를
  포함한 prefix 를 거부하도록 방어 코드 추가 (범위 초과 삭제 방지).
- `secret-store.md §5.3`(Trigger 삭제 시 prefix 일괄 삭제) 의 유일한 실사용 예시는
  `secrets.deleteByPrefix('secret://triggers/${triggerId}/')` 이며 `triggerId` 는 UUID — 신규 검증이
  거부하는 문자 집합(`%_\`)을 포함할 수 없는 구조라 기존 호출부와 충돌하지 않는다.
- `secret-store.md §2` 의 `SecretResolver` 인터페이스 표(§2.1/§2.2)에는 애초에 `deleteByPrefix` 가
  포함되어 있지 않다(구현체 전용 부가 메서드) — 이번 변경이 인터페이스 표를 stale 하게 만들지 않는다.
  (이 갭 자체는 diff 이전부터 있던 것이라 본 diff 가 새로 만든 문제는 아니다.)

결론: 충돌 없음.

## 발견사항

없음. 이번 diff 는 `spec/conventions/` 를 포함해 `spec/**` 전체를 전혀 건드리지 않으므로 Cross-Spec
관점에서 신규로 보고할 CRITICAL/WARNING/INFO 가 없다.

## 요약

meta.json 이 지정한 target(`spec/conventions/`, --impl-done, diff-base=origin/main)과 달리, 실제
`origin/main...HEAD` diff 에는 `spec/**` 변경이 전무하다 — 이번 PR(backend-lint-gate-broken-on-main
플랜: backend CI/typecheck ratchet 신설 + `secret-resolver.service.ts` 방어 코드 + 테스트 타입 결함
수정)은 순수 codebase/CI 변경이다. 따라서 "target 문서가 다른 spec 영역과 충돌하는가" 를 판단할 신규
target 서술 자체가 없어 cross-spec 충돌도 없다. 유일한 프로덕션 코드 변경(`SecretResolverService
.deleteByPrefix` 의 LIKE 메타문자 거부)을 관련 컨벤션(`secret-store.md §2/§5.3/§6`)과 대조했으나 기존
호출부(`secret://triggers/{uuid}/`)와 상충하지 않는다. 참고로 직전 세션(`review/consistency/2026/08/09
/16_45_26`, --impl-prep, 동일 scope)도 `spec/conventions/` 표본 4개 문서에 대해 CRITICAL/WARNING 없음으로
결론 낸 바 있어, 이번 결과와 일관된다. 다만 orchestrator 의 scope 판정(`spec/conventions/`)이 실제 diff
내용과 불일치하는 점은 harness 쪽에서 참고할 만한 절차적 관찰이다(스펙 콘텐츠 충돌은 아님).

## 위험도

NONE
