# Plan 정합성 검토 — SECRET_LEAK_PATTERNS 확장 (bare JWT + URI userinfo)

## 검토 범위 보정

프롬프트의 target 은 `spec/5-system/`(범용 다이제스트, 1-auth.md·10-graph-rag.md 등)로 지정돼 있으나,
`git diff origin/main...HEAD` 실측 결과 이번 변경은 **spec 파일을 전혀 건드리지 않는다** — 변경분은
`codebase/backend/src/shared/utils/sanitize-error-message.ts`(+spec 파일 아님, 테스트 파일) 와
`review/code/2026/07/10/{10_05_20,10_14_41}/**` 뿐이다(commit `f5dff4799`→`2ea285408`→`707fa9c04`).
따라서 target 다이제스트에 있는 `1-auth.md`/`10-graph-rag.md` 섹션은 이번 diff 와 직접 관련이 없다.
`SECRET_LEAK_PATTERNS`(shared SoT)를 실제로 참조하는 spec 은 `spec/5-system/14-external-interaction-api.md`
§R17 과 `spec/5-system/11-mcp-client.md` §8.3/Rationale 이며, 아래 분석은 이 두 문서 + 관련
`plan/in-progress/**`(`spec-sync-external-interaction-api-gaps.md`, `spec-sync-mcp-client-gaps.md`)를
절대경로로 직접 재확인해 수행했다.

## 발견사항

- **[INFO]** `spec-sync-mcp-client-gaps.md` 의 `task_fa96e218(에러 message redaction)` 잔여 항목과 교차 확인 누락 가능성
  - target 위치: `codebase/backend/src/shared/utils/sanitize-error-message.ts` (`SECRET_LEAK_PATTERNS` bare-JWT/URI-userinfo 패턴 추가)
  - 관련 plan: `plan/in-progress/spec-sync-mcp-client-gaps.md` L79 — "잔여(별건 follow-up, plan in-progress 유지): … / task_fa96e218(에러 message redaction) / …"
  - 상세: `spec/5-system/11-mcp-client.md` §8.3 Rationale("에러 message redaction 은 공용 패턴 재사용")은 MCP 의 에러 메시지 redaction 이 **공용 `SECRET_LEAK_PATTERNS` 재사용 + MCP 전용 패턴 얇게 얹기**라는 설계를 명시한다. 이번 diff 는 정확히 그 공용 SoT 에 bare JWT·URI-userinfo 패턴을 추가했고, 선행 ai-review(INFO, `review/code/2026/07/10/09_17_14/SUMMARY.md` #1)가 "SoT 패턴 한계(bare JWT·non-DB URI userinfo) → 별도 follow-up" 으로 명시적으로 분리한 항목을 닫은 것이다. 이는 `spec-sync-mcp-client-gaps.md` 가 추적하는 `task_fa96e218` 잔여와 동일 범주(MCP 에러 메시지 redaction 갭)로 보이나, 두 항목이 실제로 동일한지(즉 `task_fa96e218` 가 정확히 이 bare-JWT/URI-userinfo 갭을 가리키는지)는 plan 문서 자체에 세부 서술이 없어 본 diff 만으로는 확정할 수 없다.
  - 제안: `task_fa96e218` 의 실제 스코프를 확인해 이번 diff 로 해소됐다면 `spec-sync-mcp-client-gaps.md` L79 잔여 목록에서 제거(또는 완료 표기)하고, 별개 스코프라면 현행 유지. 어느 쪽이든 이번 세션에서 plan 파일이 갱신되지 않은 채 남아 있다는 점만 추적 메모로 남긴다.

- **[INFO]** target 다이제스트(spec/5-system/ 범용 덤프)와 실제 diff 의 불일치
  - target 위치: 프롬프트 `## Target 문서` — `spec/5-system/1-auth.md`, `10-graph-rag.md` 등
  - 관련 plan: 해당 없음 (orchestrator 스코프 선정 이슈)
  - 상세: 이번 diff 가 code: frontmatter 로 매핑되는 특정 spec 파일이 없어(변경 파일이 `shared/utils/`) target 이 `spec/5-system/` 디렉터리 전체로 넓게 잡힌 것으로 보인다. 실제로 `SECRET_LEAK_PATTERNS` 를 SoT 로 참조하는 문서는 `14-external-interaction-api.md`/`11-mcp-client.md` 인데 두 파일 모두 프롬프트 다이제스트에 노출되지 않았다(용량 cap 으로 truncate). 본 검토는 두 파일을 절대경로로 직접 읽어 보완했다.
  - 제안: 조치 불필요(본 세션 한정 기록). 참고로 이후 유사 diff(공용 유틸 변경)에서 target 선정 시 `SECRET_LEAK_PATTERNS`/`redactSecrets` 를 언급하는 spec 파일을 grep 기반으로 우선 포함하면 다이제스트 낭비를 줄일 수 있다.

## 미충돌 확인 (참고)

- `plan/complete/eia-secret-masking-residuals.md`(2026-07-10 완료)의 명시적 잔여 목록 — observer-vs-participant 분리(P1-1, 현행유지 확정)·DB-at-rest(P1-3, 보류)·일반 `nodeOutput` allowlist·author-config 값-embedded — 이번 diff 는 이 중 어느 결정도 재론하거나 우회하지 않는다. 패턴 정밀화(bare JWT/URI-userinfo)는 탐지 범위 확장일 뿐, P1-1 의 "패턴 정밀화로 FP 감소" 방향(오탐 축소)과는 반대로 매칭 표면을 넓히는 변경이라 P1-1 재론의 근거로도 쓰이지 않는다 — 결정과 무관.
- `plan/in-progress/spec-sync-external-interaction-api-gaps.md`(SSE 분산 fan-out 등) 는 이번 diff 와 무관한 항목만 추적하며 충돌 없음.
- `plan/in-progress/spec-sync-mcp-client-gaps.md` 의 나머지 항목(capability 캐시·타입 확장 cluster)도 이번 diff 와 무관.
- `plan/in-progress/node-output-redesign/http-request.md` 등 노드별 credential redaction(`sanitizeUrlCredentials`, `sanitizeResponseHeaders`)은 `shared/utils/sanitize-error-message.ts` 와 별개 메커니즘(§8.3 Rationale 이 명시하는 "공용 SoT vs 특화 얇은 레이어" 구조와 일치)이라 충돌 없음.
- 코드 리뷰 체인(`09_17_14`→`09_29_31`→`10_05_20`→`10_14_41`)이 INFO→구현→처분까지 자기 완결적으로 추적돼 있어, 이번 diff 자체는 선행 미해결 결정을 우회하지 않는다.

## 요약

이번 diff(shared `SECRET_LEAK_PATTERNS` 에 bare JWT·URI-userinfo 패턴 추가)는 `plan/complete/eia-secret-masking-residuals.md` 의 완료 결정이나 `plan/in-progress/**` 의 미해결 결정과 정면 충돌하지 않는다. 선행 ai-review INFO(09:17 세션)가 명시적으로 분리한 후속 과제를 그대로 닫는 자기완결적 follow-up 이며, `spec/5-system/11-mcp-client.md` §8.3 이 문서화한 "공용 SoT 확장 우선" 설계 원칙과도 부합한다. 유일한 잔여 이슈는 `spec-sync-mcp-client-gaps.md` 의 `task_fa96e218` 잔여 항목과의 교차 확인이 이번 세션에서 이뤄지지 않았다는 점으로, 실질적 충돌이라기보다 추적 정리(INFO) 수준이다.

## 위험도

LOW
