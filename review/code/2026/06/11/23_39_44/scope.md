# 변경 범위(Scope) 리뷰 결과

**리뷰 대상**: `http-ssrf-all-auth` 브랜치 vs `origin/main`
**작업 의도**: HTTP Request 노드 SSRF 가드를 `authentication='integration'` 한정에서 전 인증 방식 공통으로 확장 (refactor 04 C-3)

---

## 발견사항

### [INFO] 파일 38–47 (spec/1-data-model.md 외): origin/main 머지 동반 파일 — 범위 초과 아님
- 위치: `spec/1-data-model.md`, `spec/2-navigation/6-config.md`, `spec/4-nodes/0-overview.md`, `spec/4-nodes/5-data/2-code.md`, `spec/5-system/1-auth.md`, `spec/data-flow/1-audit.md`, `spec/data-flow/6-knowledge-base.md`, `spec/data-flow/7-llm-usage.md`
- 상세: 이 8개 파일은 이 브랜치의 자체 커밋(429d32d5·961f79a5·8f9af9e0)이 아니라 `62db84da Merge remote-tracking branch 'origin/main'` 커밋을 통해 진입했다. 각각 PR #545(model cleanup), PR #546(isolated-vm), PR #547(auth audit)에서 기원한다. 작업 계획(`http-ssrf-all-auth.md`)에 "origin/main 머지(#546·#545·#547) — 브랜치 현행화로 stale-base FP 해소"가 명시되어 있어 의도된 머지다. 범위 초과 변경이 아니다.
- 제안: 없음. 단, 리뷰어가 이 파일들을 "본 PR이 추가한 변경"으로 오해하지 않도록 PR 설명에 머지 커밋의 역할을 명시하면 좋다.

---

### [INFO] 파일 1–37 (review/consistency/**): 다른 워크트리의 consistency review 산출물 — 범위 초과 아님
- 위치: `review/consistency/2026/06/11/21_19_55/`, `22_00_31/`, `22_04_01/`, `22_46_26/`
- 상세: 타임스탬프 21_19_55(code-node-isolated-vm), 22_00_31(audit-coverage-naming), 22_04_01(code-node-isolated-vm), 22_46_26(audit-coverage-naming) 의 consistency 산출물은 각각 다른 워크트리에서 작성돼 이미 main에 머지된 커밋의 일부다. 이 브랜치의 기여가 아니라 origin/main 머지를 통해 git diff 에 나타난 것이다. 타임스탬프 23_14_40은 이 브랜치의 `--impl-done` 산출물로 정상적인 개발 프로세스 결과물이다.
- 제안: 없음.

---

### [INFO] `spec/4-nodes/4-integration/2-database-query.md` — 직접 변경 범위 경계선 사항
- 위치: `spec/4-nodes/4-integration/2-database-query.md` (커밋 `961f79a5`)
- 상세: Database Query 노드 spec 의 `INTEGRATION_NOT_FOUND` → `INTEGRATION_CALL_FAILED` 정정이 포함됐다. 커밋 메시지는 "선재 INTEGRATION_NOT_FOUND/D4 drift 정합(C-3 가 cross-spec 검토로 표면화)"으로 설명한다. 이는 SSRF 구현 자체와 직접 관련 없는 파일이나, impl-done consistency check가 표면화한 선재 spec drift 수정이며 plan의 체크리스트에 반영("impl-done Critical: 2-navigation §14.1 … 정정")되어 있다. 과도한 리팩토링이나 기능 확장이 아니라 cross-spec 정합 의무(프로세스 규약)에 따른 수반 수정이다.
- 제안: 없음. 단, 차후 리뷰어가 Database Query 변경이 SSRF와 관련 있는지 의아해할 수 있으므로 커밋 메시지처럼 PR 본문에도 "선재 drift 수정" 사유를 명시하면 명확하다.

---

### [INFO] `spec/conventions/node-output.md` Principle 3.1 수정 — 의도된 부수 정합
- 위치: `spec/conventions/node-output.md` Principle 3.1 (커밋 `429d32d5`)
- 상세: SSRF/credential resolve 실패를 Runtime error 포트(D4)로 분류하는 수정이다. plan `spec 반영` 항목에 "node-output.md Principle 3.1(SSRF/credential→Runtime port, D4)"로 명시된 의도된 변경이다. SSRF 가드 구현의 에러 분류 모델과 직결되므로 범위 내다.
- 제안: 없음.

---

### [INFO] `codebase/backend/src/nodes/integration/http-request/http-request.handler.ts` — config-echo spread→열거 변경 포함
- 위치: `http-request.handler.ts` 의 config-echo 방식 변경 (커밋 `429d32d5`)
- 상세: `{ ...rawConfig }` spread를 스키마 필드 명시 열거로 교체한 변경이 SSRF 가드 변경과 동일 커밋에 포함됐다. plan에 "부수(Principle 7 D1): config echo를 spread→명시 열거로 교체 — 향후 credential-shape 필드 auto-leak 차단"으로 기술되어 있고 consistency check 반영 사항이다. SSRF 보안 강화와 성격이 유사한 보안 정합 수정으로 plan에 명시됐으므로 범위 내다.
- 제안: 없음.

---

## 요약

변경 범위 관점에서 이 PR은 전반적으로 의도된 범위(HTTP Request SSRF 가드 전 인증 공통화)를 잘 준수하고 있다. git diff에 나타나는 파일 수가 많아 보이는 이유는 origin/main 머지 커밋(PR #545·#546·#547)이 동반됐기 때문이며, 이는 plan에 명시된 의도적 조치다. 이 브랜치 자체의 변경은 `http-request.handler.ts`/`.spec.ts`, `error-codes.ts`, `backend-labels.ts`, `spec/4-nodes/4-integration/` 2개 파일, `spec/5-system/3-error-handling.md`, `spec/conventions/node-output.md`, `spec/conventions/chat-channel-adapter.md`로 핵심 SSRF 구현과 직결된다. `2-database-query.md` 등 부수 수정은 plan의 체크리스트에 기록된 선재 spec drift 정합이며 over-engineering이나 무관한 리팩토링에 해당하지 않는다.

## 위험도

NONE

---

STATUS=success ISSUES=0 PATH=/Volumes/project/private/clemvion/.claude/worktrees/http-ssrf-all-auth/review/code/2026/06/11/23_39_44/scope.md RESET_HINT=
