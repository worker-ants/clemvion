# 유저 가이드 동반 갱신(User Guide Sync) 리뷰

## 매트릭스 적재

- `.claude/config/doc-sync-matrix.json` (`rows[]`, 20개 행) + `PROJECT.md` §변경 유형 → 갱신 위치 매핑 (155~223행) 을 Read 했다.

## 변경 파일 식별

리뷰 payload 의 대상 파일은 다음 12개 — 실제 `codebase/` 애플리케이션 코드 변경은 없다:

1. `codebase/backend/package.json` — `@nestjs/typeorm` 버전 스펙 `^11.0.3` → `^12.0.1` (한 줄)
2. `plan/in-progress/deps-typeorm12.md` — 신규 plan 문서
3. `plan/in-progress/nestjs-v12-coordinated-upgrade.md` — 기존 plan 문서 갱신
4. `pnpm-lock.yaml` — lockfile 갱신 (`@nestjs/typeorm` 12.0.1 리졸브 + 무관한 `libc:` 메타데이터 정리)
5~12. `review/consistency/2026/09/24/17_31_27/*` — consistency-check 산출물 (SUMMARY / retry_state / convention_compliance / cross_spec / meta / naming_collision / plan_coherence / rationale_continuity)

## 매칭 결과

매트릭스 20개 행의 trigger(`codebase/backend/src/nodes/**`, `*.tsx`, `codebase/frontend/src/content/docs/**`, `codebase/backend/src/modules/auth/**`, `codebase/packages/expression-engine/**`, warningRules/`error-codes.ts`, `system-status.constants.ts` 등) 를 위 12개 파일에 전수 대조했다. 이 PR 은 **`@nestjs/typeorm` 라이브러리 버전 스펙만 올리는 순수 의존성 범프**이고, 노드·프론트엔드 UI·docs·i18n dict·backend-labels·auth 모듈·expression-engine·warning/error 코드 어느 것도 건드리지 않는다. 따라서 20개 행 중 **매칭되는 trigger 가 하나도 없다.**

- `codebase/backend/package.json`, `pnpm-lock.yaml` — 순수 버전 문자열 변경. 노드 신규/schema 변경 아님(코드 로직 변화 없음), API 변경 아님, cross-cutting enum 아님
- `plan/*.md`, `review/consistency/*` — 둘 다 매트릭스가 참조하는 어떤 trigger glob 에도 걸리지 않는 harness/plan 산출물

## 범위 밖 관측 (doc-sync 판정에는 미반영)

리뷰 payload 에 포함되지 않았지만, 워킹트리에 다음과 같은 **미커밋 변경**이 관측된다 (`git status --short`):

```
M codebase/backend/src/common/decorators/workspace.decorator.ts
```

내용은 `handlerConsumesWorkspaceId` 본문 전체를 `return false; // MUTATION` 으로 치환한 것이다. 이는 `plan/in-progress/nestjs-v12-coordinated-upgrade.md` §C "업그레이드 전 기준값" 절이 기술한 **판별자(MB) 뮤턴트** — `handlerConsumesWorkspaceId` 를 항상 false 로 만들어 reflection 보안 회귀를 검증하는 절차 — 와 정확히 일치한다. 같은 문서는 "원복은 `cp` + 절대경로, 원복 후 워킹트리 diff 빈 출력 확인" 이라고 적었지만, 실제로는 **원복되지 않은 채 워킹트리에 남아 있다.**

이 파일은 (a) 이번 리뷰 payload 의 대상 파일 목록에 없고 (b) `@nestjs/typeorm` 버전 범프와 무관한 별도 사안이므로 본 리뷰어의 doc-sync 매칭 결론(위)에는 포함하지 않았다. 다만 이 상태로 커밋되면 `codebase/backend/src/common/decorators/**` 는 인가·세션 미들웨어의 핵심 판별 로직이라 매트릭스의 `auth-session-flow-change` (semantic, `codebase/backend/src/modules/auth/**` 및 권한·세션 미들웨어) trigger 에 해당할 소지가 있고, 그 전에 보안적으로 `RolesGuard` 를 fail-open 시키는 결함이다. doc-sync 범위 밖이므로 다른 리뷰어/사람이 확인해야 할 사항으로만 남긴다.

## 요약

매트릭스 20개 trigger 전수 대조 결과, 이 변경 set(`@nestjs/typeorm` 버전 범프 + 동반 plan 문서 + lockfile + consistency 산출물)은 **어떤 trigger 에도 매칭되지 않는다** — 노드·UI·docs·i18n·auth·expression-engine·warning/error 코드 변경이 전무한 순수 의존성 업그레이드이므로 유저 가이드 동반 갱신 관점에서는 해당 없음이다. 다만 payload 밖에서 `workspace.decorator.ts` 의 미원복 뮤테이션이 관측되어 참고로 기록한다(별도 사안, 이 판정에 미반영).

## 위험도

NONE
