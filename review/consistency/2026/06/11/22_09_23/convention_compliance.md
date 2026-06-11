# 정식 규약 준수 검토 결과

**대상 문서**: `plan/in-progress/spec-update-embedding-testconnection.md`
**검토 모드**: spec draft (--spec)
**검토 일시**: 2026-06-11

---

## 발견사항

### [INFO] plan frontmatter 필수 3필드 — 적합
- target 위치: frontmatter (`worktree`, `started`, `owner`)
- 위반 규약: 없음 (준수)
- 상세: `worktree: fix-embedding-test-dimension-a3d42a`, `started: 2026-06-11`, `owner: resolution-applier` 모두 존재. `plan-lifecycle.md §4` 및 `plan-frontmatter.test.ts` 가드 요건 충족.
- 제안: 해당 없음.

---

### [WARNING] `spec_impact` 필드 누락 — Gate C 선행 선언 권장
- target 위치: frontmatter 전체
- 위반 규약: `.claude/docs/plan-lifecycle.md §5 Gate C`, `spec/conventions/spec-impl-evidence.md §4.2`
- 상세: `started: 2026-06-11` 은 Gate C grandfather cutoff `2026-06-04` 이후이므로 이 plan 이 `complete/` 로 이동될 때 `spec_impact` 선언이 **build guard 강제 대상**이다. 현재 in-progress 단계라 즉각 위반은 아니나, 해당 plan 의 spec 수정 대상이 명확하게 이미 기술되어 있음에도 (`spec/5-system/7-llm-client.md`, `spec/2-navigation/6-config.md §B.3·§B.5`) frontmatter 에 `spec_impact` 초안이 없어 완료 시 누락 리스크가 있다.
- 제안: in-progress 단계라도 frontmatter 에 아래 초안 선언을 추가해두면 완료 이동 시 가드 통과가 보장된다.
  ```yaml
  spec_impact:
    - spec/5-system/7-llm-client.md
    - spec/2-navigation/6-config.md
  ```

---

### [WARNING] 제안 변경 내 API endpoint 표기 — `POST /api/model-configs/:id/test` 형식 확인 필요
- target 위치: `## 제안 변경 §3` — "§3 API 표 각주 또는 §B.5 말미" 블록
- 위반 규약: `spec/conventions/swagger.md §2` (Controller 패턴), `spec/5-system/2-api-convention.md` (API 명명 규약)
- 상세: 문서 본문에 `POST /api/model-configs/:id/test` 가 명시되어 있다. 이 endpoint 명칭이 실제 구현 (`model-configs.controller.ts`) 의 라우트 경로와 일치하는지 spec 초안 단계에서 검증 근거가 없다. spec/conventions/swagger.md §2-3 에 따라 path parameter 는 `:id` (NestJS 라우트 스타일) 가 아니라 `{id}` (OpenAPI 스타일) 가 spec 문서 표기 표준이다 — 실제 `spec/5-system/2-api-convention.md` 에서도 OpenAPI path parameter 표기를 사용한다.
- 제안: spec 문서에 삽입될 최종 본문에서 path parameter 표기를 `POST /api/model-configs/{id}/test` 로 통일할 것. plan 초안 내 코드블록이므로 현 단계에서는 주의 수준이나, spec 본문 반영 시 수정 필요.

---

### [INFO] `spec/5-system/7-llm-client.md` 참조 — frontmatter `pending_plans` 미등록
- target 위치: `## 제안 변경 §1` — `spec/5-system/7-llm-client.md` 갱신 제안
- 위반 규약: `spec/conventions/spec-impl-evidence.md §2.1` (`pending_plans` 역방향 링크 규약)
- 상세: `spec/5-system/7-llm-client.md` 의 frontmatter 를 확인하면 `status: partial`이고 `pending_plans`에 `plan/in-progress/rag-rerank-followup.md`만 등록되어 있다. 본 plan(`spec-update-embedding-testconnection.md`)은 해당 spec 을 수정하는 주체이지만 `7-llm-client.md` 의 `pending_plans:` 에 등록되지 않은 상태다. spec 이 partial 이므로 미등록이 build 를 즉시 깨지는 않지만, spec ↔ plan 역방향 링크 규약 (R-5) 의 취지에서 보면 관리 갭이다.
- 제안: spec 수정 PR 에서 `spec/5-system/7-llm-client.md` frontmatter `pending_plans:` 에 `plan/in-progress/spec-update-embedding-testconnection.md` 를 추가하거나, 수정 완료 즉시 제거. 단순 spec 갱신 plan 이고 pending 이 짧을 것으로 예상되므로 `spec-only` → `implemented` 단번 전이도 가능.

---

### [INFO] 문서 구조 규약 — Overview / 본문 / Rationale 3섹션 미채용
- target 위치: plan 문서 전체 구조
- 위반 규약: CLAUDE.md `## 정보 저장 위치` (spec 문서 3섹션 권장)
- 상세: 본 문서는 `plan/in-progress/` 문서이므로 spec 3섹션 규약은 직접 적용 대상이 아니다. 3섹션 (Overview / 본문 / Rationale) 권장은 `spec/` 문서에 해당하며 plan 문서는 체크리스트·드래프트 형식을 따로 취한다. 따라서 위반 아님, 안내 수준으로 기록.
- 제안: 해당 없음.

---

### [INFO] `plan/in-progress/unified-model-management.md §7 W4` 백로그 참조 — 링크 정합 미검증
- target 위치: `## 제안 변경 §1·§3` 본문 내 백로그 참조
- 위반 규약: `spec/conventions/spec-impl-evidence.md §4.2` (`spec-link-integrity.test.ts` — spec 문서 내 in-repo 링크 실존 검증)
- 상세: 제안 변경 텍스트 블록 내에 `` `plan/in-progress/unified-model-management.md §7 W4` `` 가 backtick 인라인 코드로 명시된다. 이 내용이 spec 본문(`spec/5-system/7-llm-client.md`, `spec/2-navigation/6-config.md`)에 마크다운 링크(`[...](path)`) 형태로 삽입되면 `spec-link-integrity.test.ts` 가 해당 경로 실존을 검증한다. 현재 plan 이 worktree 에만 존재하고 main 에 머지되지 않은 상태라면, spec 본문에 이 경로를 링크로 추가할 경우 링크 무결성 가드가 fail 할 수 있다.
- 제안: spec 본문에 삽입 시 `plan/in-progress/unified-model-management.md` 경로가 main 브랜치에 실존하는지 확인. 백로그 참조는 마크다운 링크 대신 백틱 인라인 텍스트로 유지하거나, 해당 plan 이 main 에 있을 때만 링크화할 것.

---

## 요약

`plan/in-progress/spec-update-embedding-testconnection.md` 는 plan frontmatter 필수 3필드(worktree/started/owner)를 모두 올바르게 갖추고 있으며, 정식 규약의 명백한 CRITICAL 위반은 없다. 주요 주의 사항은 두 가지다: (1) `started: 2026-06-11`이 Gate C 적용 cutoff 이후이므로 완료 이동 시 `spec_impact` 선언이 build guard 강제 대상이 되는데, 초안 선언이 없어 이동 시점에 누락 리스크가 있다(WARNING). (2) 제안 변경 내 API endpoint path parameter 표기가 NestJS 라우트 스타일(`:id`)로 기술되어 있어, spec 본문에 반영 시 OpenAPI 스타일(`{id}`)로 통일해야 한다(WARNING). 나머지 발견사항은 INFO 수준이며 spec 작성 단계에서 점검하면 충분하다.

## 위험도

LOW

---

STATUS: DONE
