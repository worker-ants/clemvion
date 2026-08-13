# Cross-Spec 일관성 검토 — `spec/5-system/` (impl-done, diff-base=origin/main)

## 사전 확인: 검토 대상 delta 실측

검토 착수 전 `git diff origin/main...HEAD` 를 워크트리(`/Volumes/project/private/clemvion/.claude/worktrees/eia-r8-cache-scope-4ae434`, 이 세션의 실제 CWD)에서 직접 실측했다.

```
$ git diff origin/main...HEAD --stat -- spec/5-system/ spec/
(출력 없음 — 변경분 0)
```

`git log origin/main..HEAD` 로 확인한 9개 커밋은 전부 `spec/` 밖 영역(`auth-oauth.service`, `execution-engine.service`, `knowledge-base.service`, `update-returning-rows`, `plan/**`, `review/**`)이며 `spec/5-system/**` 을 전혀 건드리지 않는다.

프롬프트 payload 가 서술하는 "target 문서" — `spec/5-system/` 의 EIA §R8(Idempotency-Key 캐시 스코프) 변경분 — 은 이미 `origin/main` 의 조상 커밋이다:

```
$ git merge-base --is-ancestor a80599700 origin/main && echo "IS ancestor"
IS ancestor
```

`a80599700 fix(eia): §R8 이 열거한 409·410 이 멱등 캐시에서 빠져 있었다`, `8a2d13031 fix(eia): 멱등 캐시 키가 헤더 값 하나뿐이라 남의 응답이 재생될 수 있었다`, `f59e2343d fix(eia): 캐시 엔트리 안쪽이 깨지면 요청이 500 이 됐다`, `1e74f26a6 fix(eia): Redis 가 런타임에 죽으면 API 가 같이 죽었다` 등 이번 작업(`eia-r8-cache-scope`)이 다루는 커밋군은 모두 PR 번호(#1153/#1155/#1157/#1158)가 붙어 이미 개별 PR 로 병합 완료됐다. 이 워크트리는 그사이 다른 작업(`raw-query-audit-followups` 브랜치, `retry-turn-terminal-guard` 등)으로 재사용되어 branch tip 이 앞서 있을 뿐, `spec/5-system/` 관점에서는 **더 이상 리뷰할 신규 delta 가 없다**.

이는 MEMORY 의 "병렬 세션이 먼저 머지" 패턴과 일치한다 — 이 checker 가 받은 payload 는 이미 병합·완료된 변경분의 스냅샷이다.

## 참고: 이미 병합된 §R8 내용의 상호 일관성 (delta 밖, 백스톱 확인)

혹시 이 리뷰가 "현재 main 상태" 자체를 게이트하려는 의도라면 도움이 되도록, 이미 병합된 `spec/5-system/14-external-interaction-api.md` §R8 (Idempotency-Key 캐시 스코프) 내용을 관련 영역과 대조했다:

- **`spec/data-flow/15-external-interaction.md`** (§2.2 시퀀스, 데이터 스토어 표) — 캐시 키 포맷 `interaction:idempotency:<executionId>:<route>:<key>`, TTL 24h, 캐시 대상 닫힌 목록(`2xx`/`409`/`410`, `400 VALIDATION_ERROR` 제외), 손상 엔트리 fail-open 처리가 EIA §R8 rationale 과 **문구·수치 모두 일치**한다. 충돌 없음.
- **`spec/5-system/4-execution-engine.md#13-블로킹재개-컨트랙트-nodehandleroutput-status`** — EIA §R8 이 인용하는 "검증 실패 → `waiting_for_input` 유지 → 재제출 가능" 앵커가 실제로 §1.3 "블로킹/재개 컨트랙트" 절에 존재한다 (참조 유효).
- `spec/3-workflow-editor/3-execution.md#9` (본 프롬프트에 번들된 유일한 관련 문서) 은 EIA/WS 종결 이벤트 필드를 EIA §6 로 위임한다고 명시하고 있어(§8.1 상단 경고문) idempotency 캐시 스코프(§R8)와는 별개 관심사 — 교차 지점 없음.

이 세 지점에서 데이터 모델·API 계약·상태 전이 충돌은 발견되지 않았다.

## 결론

이번 checker 호출이 받은 target(`spec/5-system/` EIA §R8 캐시 스코프 변경)은 `origin/main` 대비 **delta 0** — 이미 개별 PR 로 병합 완료된 상태다. 신규로 도입되는 콘텐츠가 없으므로 "다른 spec 영역과의 충돌"을 판정할 대상 자체가 없다. Orchestrator 는 본 리뷰 세션을 병합-완료 사유로 폐기하거나, 실제로 검토가 필요한 최신 diff 범위로 재기동할 것을 권한다.

## 위험도

NONE — 검토 대상 delta 부재. (백스톱 확인한 기존 병합 내용에서도 CRITICAL/WARNING 없음.)
