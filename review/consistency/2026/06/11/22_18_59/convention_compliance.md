# 정식 규약 준수 검토 결과

대상: `plan/in-progress/spec-update-embedding-testconnection.md`
검토 모드: spec draft 검토 (--spec)

---

## 발견사항

### 1. [CRITICAL] spec/1-data-model.md 제안 링크의 상대 경로 오류 (`../2-navigation/`)

- **target 위치**: 제안 변경 §6 (`spec/1-data-model.md §2.16` 주석 추가)
  ```
  (embedding 연결 테스트 성공 시 probe embed 로 자동 감지·자동 저장 가능 — 상세 [Config §B.3](../2-navigation/6-config.md))
  ```
- **위반 규약**: `spec/conventions/spec-impl-evidence.md §4.2` → `spec-link-integrity.test.ts` — `spec/**.md` 본문 in-repo 링크 타깃 실존 의무
- **상세**: `spec/1-data-model.md` 는 `spec/` 루트에 위치한다. 해당 파일에서 `../2-navigation/6-config.md` 는 `spec/` 의 한 단계 위인 프로젝트 루트로 올라간 뒤 `2-navigation/6-config.md` 를 찾는 경로 — 즉 `/Volumes/project/private/clemvion/2-navigation/6-config.md` 로 해석되어 존재하지 않는 경로다. 실존하는 경로는 `spec/2-navigation/6-config.md` 이며, `spec/1-data-model.md` 에서의 올바른 상대 경로는 `./2-navigation/6-config.md` 이다. 기존 `spec/1-data-model.md` 의 링크 패턴(예: `[Spec LLM Client §4](./5-system/7-llm-client.md)`, `[Spec 설정 §Part B](./2-navigation/6-config.md)`)과도 불일치한다. `spec-link-integrity.test.ts` build 가드가 이 링크를 포함한 spec 파일을 검증하므로 실제 삽입 시 빌드 실패를 유발한다.
- **제안**: 주석의 링크를 `[Config §B.3](./2-navigation/6-config.md)` 로 수정한다.

---

### 2. [WARNING] spec/2-navigation/6-config.md §3 API 표 제안의 path 파라미터 표기 불일치 (`{id}` vs `:id`)

- **target 위치**: 제안 변경 §5 (`spec/2-navigation/6-config.md §3 API 표 — test 엔드포인트 응답 shape 주석`)
  ```
  | POST | /api/model-configs/{id}/test | ...
  ```
  및 제안 변경 §3 (§B.3 본문):
  ```
  PATCH /api/model-configs/{id} { dimension }
  ```
- **위반 규약**: `spec/conventions/swagger.md` 의 path 파라미터 표기 및 `spec/5-system/2-api-convention.md` 의 기존 spec 표 관용 — `spec/2-navigation/6-config.md` L263-L286 의 API 표 전체가 `:id` 표기를 사용한다. 동일 파일의 기존 행 예: `| POST | /api/model-configs/:id/test | 연결 테스트 (chat/embedding 만 — rerank 미제공) |` (L283).
- **상세**: 제안이 "API path parameter 는 OpenAPI 스타일 `{id}` 표기(swagger 규약)" 라고 자체 근거를 명시하지만, 실제 `spec/conventions/swagger.md` 에는 `{id}` 강제 규정이 없고, `spec/5-system/2-api-convention.md` 는 추상 URL 패턴에서 `{id}`, 표 예시에서 `:id` 를 혼용한다. 반면 `spec/2-navigation/6-config.md` API 표는 `:id` 로 일관되므로, 제안대로 `{id}` 를 삽입하면 동일 표 안에서 표기가 혼재된다. `spec-link-integrity.test.ts` 가 anchor 를 검증하지 path 표기를 강제하지는 않으나, 표 내 표기 불일치는 spec 가독성·유지보수 정합성을 해친다.
- **제안**: 제안 변경 §5 의 표 행을 기존 패턴에 맞춰 `:id` 로 통일 — `| POST | /api/model-configs/:id/test | 연결 테스트 (chat/embedding 만 — rerank 미제공). 응답: chat \`{ success }\`, embedding \`{ success, dimension? }\`(probe embed 감지 차원). 설정 조회는 kind 무관(\`ModelConfigService.findEntity\`) |`. §B.3 본문 산문의 `PATCH /api/model-configs/{id}` 도 `PATCH /api/model-configs/:id` 로 정렬. 혹은 규약 자체에 `{id}` 를 공식 채택하려면 `spec/5-system/2-api-convention.md` 를 먼저 갱신해야 한다.

---

### 3. [INFO] plan 본문 내 `../../spec/` 상대 링크 — build 가드 밖이나 경로는 유효

- **target 위치**: "핵심 구분" 절 링크:
  ```
  [5-knowledge-base 생성 폼](../../spec/2-navigation/5-knowledge-base.md)
  [9-rag-search §5·Rationale ...](../../spec/5-system/9-rag-search.md)
  [9-rag-search Rationale](../../spec/5-system/9-rag-search.md)
  ```
- **위반 규약**: 없음 — `spec-link-integrity.test.ts` 는 `spec/**.md` 만 검증하며 `plan/**.md` 내 링크는 대상 외다. 경로 자체도 `plan/in-progress/` 에서 `../../` = 프로젝트 루트이므로 실제 파일 존재가 확인됐다.
- **상세**: 위반은 아니지만, plan 본문에서 spec 을 참조할 때 `../../spec/` 상대 경로와 worktree 절대 경로 혼용 가능성 — 현재는 모두 `../../spec/` 로 일관돼 있고 실존 확인됨. 참고 수준 기재.
- **제안**: 해당 없음 (현행 유지).

---

### 4. [INFO] 문서 구조 — plan 문서에 3섹션 규약은 미적용, 현행 구조 적합

- **target 위치**: 문서 전체 구조
- **위반 규약**: 없음 — CLAUDE.md 의 "Spec 문서 3섹션 구성(Overview/본문/Rationale)" 는 `spec/` 문서에만 적용된다. `plan/in-progress/` 문서는 `plan-lifecycle.md §4` 의 frontmatter(worktree/started/owner) 만 필수이며 내부 섹션 구조는 자유. 본 target 은 frontmatter 3 필드를 모두 보유한다.
- **상세**: 참고 수준 기재. 위반 없음.

---

## 요약

`plan/in-progress/spec-update-embedding-testconnection.md` 는 plan frontmatter 규약(`worktree`/`started`/`owner` 3필드, ISO 날짜, 올바른 worktree 값)을 완전히 준수하며, `spec_impact` 에 기재된 3개 spec 파일도 모두 실존한다. 그러나 제안 변경 §6 에서 `spec/1-data-model.md` 에 삽입하려는 상대 링크 `../2-navigation/6-config.md` 는 해당 파일의 위치(`spec/` 루트)에서 프로젝트 루트 바깥을 향하는 잘못된 경로로, `spec-link-integrity.test.ts` build 가드를 실제 삽입 시 트리거한다 — 이는 CRITICAL 위반이다. 제안 변경 §5 에서 `{id}` path 파라미터 표기를 `spec/2-navigation/6-config.md` API 표에 삽입하려는 것은 동일 표의 기존 `:id` 관용과 불일치하며 WARNING 으로 분류된다. 두 항목 모두 spec 파일에 실제 반영하기 전 수정이 필요하다.

---

## 위험도

**MEDIUM** — CRITICAL 1건(상대 링크 오류, build 가드 직접 트리거)이 존재하나 spec 삽입 단계 이전에 수정 가능하며, WARNING 1건은 표기 일관성 문제로 기능 동작에 영향은 없다.
