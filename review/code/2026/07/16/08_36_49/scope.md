# 변경 범위(Scope) Review

## 컨텍스트

대상 plan: `plan/in-progress/ai-agent-tool-payload-budget-followups.md` "항목 A (config-time 저장 경고, PR #1)". 체크리스트가 다음을 명시: pure 도구 재현 함수 추출(cafe24/makeshop) + config-time 평가 모듈 신설 + `WorkflowsService` 배선(Integration repo 주입, `getGraphWarnings(workspaceId)`, `saveCanvas` 차단 게이트) + `toolBudgetStrictSave()` + i18n KO 매핑 + spec 마감(status partial→implemented, Planned 문구 제거). `git diff main...HEAD --stat` 결과 19개 파일이 이 payload 19개 파일과 정확히 1:1 일치 — 체크리스트 밖 파일 변경 없음.

## 발견사항

- **[INFO]** `workflows.service.ts` 내 `settings` 타입 캐스팅 제거는 기능과 무관
  - 위치: `codebase/backend/src/modules/workflows/workflows.service.ts` (`createWorkflow`, 변경 hunk 상단 `@@ -302,7 +311,7 @@`) — `settings: { ...dto.settings } as Record<string, unknown>,` → `settings: { ...dto.settings },`
  - 상세: AI Agent tool-payload 예산 기능과 무관한 `createWorkflow` 경로의 불필요 타입 단언 제거. `git log`로 확인한 결과 별도 커밋 `808017aaf test(ai-agent): rebase 후 jest 캐시 무효화로 표면화된 3건 fix + prettier 정규화`의 "eslint --fix 로 신규 lockfile(prettier) 기준 포맷 정규화" 항목으로 명시적으로 설명됨(리베이스로 lint/prettier 버전이 바뀌며 `@typescript-eslint` 규칙이 불필요 단언을 잡아낸 것으로 추정). 기능적 영향 없음(런타임 동일), 커밋 메시지에 사유가 투명하게 기록돼 은닉된 변경이 아님.
  - 제안: 별도 조치 불필요. 다만 향후에는 이런 lint-driven 부수 diff는 별도의 `chore(lint): ...` 커밋으로 완전히 분리하면 기능 PR diff가 더 깨끗해짐(이미 부분적으로 그렇게 함 — 별도 커밋으로는 분리됐으나 해당 커밋 자체에 기능 관련 파일들과 포맷 정규화가 섞여 있음).

- **[INFO]** 동일 커밋(`808017aaf`)에 테스트 단정문 줄바꿈 포맷 변경이 fix 변경과 섞임
  - 위치: `workflows.controller.spec.ts`, `workflows.service.spec.ts`의 `toHaveBeenCalledWith(...)` / `getGraphWarnings(...)` 호출부가 한 줄 → 여러 줄로 재포맷
  - 상세: 순수 prettier 재포맷(내용 불변)이 "rebase 후 캐시 무효화로 드러난 fix" 커밋에 함께 커밋됨. 커밋 메시지에 "eslint --fix 로 포맷 정규화"라고 명시돼 있어 review 상 추적 가능하나, 리뷰어가 diff를 훑을 때 실질 변경(3건 fix)과 포맷 변경이 같은 커밋/같은 파일 안에서 섞여 눈으로 구분하기 다소 번거로움.
  - 제안: 문제 없음(현행 유지 가능) — 다만 순수 포맷 전용 변경은 별도 커밋으로 완전히 분리하는 편이 리뷰 가독성에 더 유리하다는 참고 사항.

- **[INFO]** cafe24/makeshop tool-provider의 인스턴스 메서드 → module-level pure 함수 승격은 대규모 리팩터링이지만 plan에 명시된 필수 설계
  - 위치: `codebase/backend/src/nodes/ai/ai-agent/tool-providers/cafe24-mcp-tool-provider.ts`, `makeshop-mcp-tool-provider.ts` (`applyAllowlist`/`buildJsonSchema` 제거 → `applyCafe24Allowlist`/`buildCafe24JsonSchema`/`buildCafe24ToolDefsForIntegration` 등 export)
  - 상세: plan 문서가 "Cafe24/Makeshop 정적 도구 재현: … operation→ToolDef 매핑을 pure 함수로 추출(세션 state 없이) 후 config-time·runtime 공유"를 명시적으로 요구. 각 provider 별 회귀 테스트("produces the exact same tools as buildTools")로 동작 불변을 검증. 순수 기계적 추출(로직 변경 없음, side-effect만 caller로 이동)로 확인됨 — 요청 범위를 벗어난 임의 리팩토링이 아니라 기능 구현에 필요한 설계.
  - 제안: 없음(정상 범위).

## 범위 밖 변경 없음 확인

- `workflows.controller.ts`/`.spec.ts`, `workflows.module.ts`(Integration TypeOrmModule 등록), `workflows.service.ts`/`.spec.ts`(Integration repo 주입·`getGraphWarnings(workspaceId)`·`saveCanvas` 차단), `tool-payload-budget.ts`/`.spec.ts`(`toolBudgetStrictSave`), 신규 `tool-payload-save-warning.ts`/`.spec.ts`, 신규 e2e, frontend `backend-labels.ts`/`.test.ts`(KO 매핑+P3-C-1 목록), plan 체크리스트 갱신, spec 2건(status/Planned 문구 정리) — 모두 plan 체크리스트 항목과 1:1 대응.
- import 변경은 전부 신규 기능이 실사용하는 심볼(예: `Integration`, `isUnreadableCredentials`, `evaluateAiAgentToolPayloadWarnings`, `type GraphWarningRuleResult`)이며 미사용 import 없음(`eslint` 재실행으로 확인, 에러 0).
- 주석 추가는 모두 backend-only rule의 설계 근거·SoT 참조(§4.2/§10, cross-node-warning-rules §5/§8)를 설명하는 실질적 문서화이며, 불필요한 주석 추가/삭제는 없음.
- 설정 파일(package.json, tsconfig, CI 등) 변경 없음.
- spec 변경(`spec/4-nodes/3-ai/1-ai-agent.md`, `spec/conventions/cross-node-warning-rules.md`)은 "Planned" 문구 제거 및 status 승격으로, 구현 완료를 반영하는 필수 동반 변경(plan-lifecycle 관례에 부합).

## 요약

19개 변경 파일이 `plan/in-progress/ai-agent-tool-payload-budget-followups.md` "항목 A" 체크리스트와 정확히 1:1 대응하며, 의도 밖 파일·기능 확장·불필요한 임포트/설정 변경은 발견되지 않았다. cafe24/makeshop tool-provider의 인스턴스 메서드 → pure 함수 추출은 규모가 크지만 plan에 명시된 필수 설계(런타임/config-time drift-0 공유)이고 회귀 테스트로 동작 불변이 검증됨. 유일하게 눈에 띄는 항목은 리베이스 후속 fix 커밋(`808017aaf`)에 섞인 `workflows.service.ts`의 무관한 타입 단언 제거 1줄과 일부 순수 포맷 변경으로, 둘 다 커밋 메시지에 "eslint --fix 포맷 정규화"로 투명하게 설명되어 있고 기능적 영향이 없어 informational 수준이다.

## 위험도

LOW
