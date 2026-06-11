# Rationale 연속성 검토 결과

검토 모드: 구현 완료 후 검토 (--impl-done, scope=spec/4-nodes/4-integration/, diff-base=origin/main)
검토 일시: 2026-06-11

---

## 발견사항

### 1. [INFO] `isolated-vm` → `node:vm` 전환 — Rationale 존재하나 기각된 대안과의 경계 확인 필요

- **target 위치**: `spec/4-nodes/5-data/2-code.md` §4 실행 로직, §7.1 격리 방식, §7.2 리소스 제한, §5.3.3 삭제
- **과거 결정 출처**: `spec/4-nodes/5-data/2-code.md` `## Rationale` "격리 방식 `isolated-vm` 전환 — 위협 모델과 결정 (2026-06-11)"
- **상세**: target diff 는 `code.md` 의 `isolated-vm` 기술을 `node:vm` 기술로 **되돌리고**, `§5.3.3 메모리 초과` 예제와 `CODE_MEMORY_LIMIT` 에러 코드를 삭제하며, 4-nodes/0-overview 의 "실행 격리" / "메모리 제한" 행도 후퇴시켰다. 그런데 동일 파일의 `## Rationale` 섹션에는 `isolated-vm` 으로 **전환한다**는 결정(`사용자 결정(2026-06-11)`)이 명시되어 있고, `node:vm` 의 한계가 "기존 `node:vm` 의 한계"로 기각 사유로 기록되어 있다. 즉 **Rationale 은 `isolated-vm` 전환을 결정으로 기록하는데, 본문은 `node:vm` 을 현재 구현으로 기술하는 모순**이 발생했다.

  - §7.1 표 현재 구현 행: "현재 구현: `node:vm` context" 로 기술됨 (diff +)
  - Rationale 섹션: "사용자 결정(2026-06-11)으로 spec 로드맵이 지정했던 `isolated-vm`(V8 Isolate) 으로 전환한다 — 이로써 구 §7.1 '선택 근거'가 '추후 재검토'로 남겨둔 로드맵 항목을 본 결정으로 **종결**한다" (기존 원본에서도 동일 존재)

  이 diff 가 "코드 현실이 `node:vm`이라 spec 을 현행화한 것"이라면 Rationale 의 `isolated-vm` 전환 결정 섹션을 함께 갱신하거나 철회해야 한다. 현재 상태는 본문(구현 사실)과 Rationale(결정 기록)이 서로 반대 방향을 가리키고 있다.

  참고: `spec/4-nodes/5-data/2-code.md` §7.1 "선택 근거"에는 "단, 메모리 하드 리밋과 완벽한 sandbox escape 방어는 불가하므로 추후 `isolated-vm` 등으로 재검토한다"고 명시되어 있어, `node:vm` 이 현재 구현이고 `isolated-vm` 이 로드맵임은 §7.1 선택 근거와 정합한다. 그러나 Rationale 섹션 "격리 방식 `isolated-vm` 전환 (2026-06-11)"은 이 전환이 **이미 결정/완료**됐다고 기록한다. 둘이 공존하면 혼란스럽다.

- **제안**: 다음 두 가지 중 하나로 정리한다.
  (A) `isolated-vm` 전환이 이 PR 의 scope 가 아니라면, Rationale "격리 방식 `isolated-vm` 전환" 섹션을 "결정됨 미구현" 으로 명시하거나 `(Planned)` 표기 추가.
  (B) `isolated-vm` 전환이 이 PR 에서 실제로 이루어졌다면, §7.1 본문을 `isolated-vm` 기술로 복원하고 `CODE_MEMORY_LIMIT` 예제도 복원.

---

### 2. [INFO] `CODE_MEMORY_LIMIT` 삭제 — `spec/5-system/3-error-handling.md` 에서도 제거, `spec/4-nodes/5-data/2-code.md` 에는 (로드맵) 참조 잔류

- **target 위치**: `spec/5-system/3-error-handling.md` §1.4 노드 수준 코드 카테고리 표 (diff 에서 `CODE_MEMORY_LIMIT` 제거)
- **과거 결정 출처**: 원본 `spec/4-nodes/5-data/2-code.md` §5.3.3, §7.2 리소스 제한 표, Rationale "격리 방식 전환"
- **상세**: `spec/5-system/3-error-handling.md` 의 Code 카테고리에서 `CODE_MEMORY_LIMIT` 가 삭제됐다. 그러나 `spec/4-nodes/5-data/2-code.md` §7.2 에는 여전히 "`isolated-vm` 전환 시 128MB 적용 예정 (`CODE_MEMORY_LIMIT`)"라는 참조가 남아있고, §5.3 에러 코드 정규화 매핑에도 `EXECUTION_MEMORY_EXCEEDED` (로드맵) → `CODE_MEMORY_LIMIT` 행이 남아있다. 즉 `3-error-handling.md` 에서는 코드를 제거했으나 `2-code.md` 안의 두 군데 참조가 dangling 상태다.
- **제안**: (a) `CODE_MEMORY_LIMIT` 를 로드맵 코드로 유지할 의도라면 `3-error-handling.md` 에서 제거하되 `2-code.md` 에도 "(미구현 Planned)" 표기를 명확히 할 것. (b) 완전 제거 의도라면 `2-code.md` §5.3, §7.2 잔류 참조도 같이 제거할 것.

---

### 3. [INFO] `MODEL_CONFIG_INVALID` / `MODEL_CONFIG_NOT_FOUND` 코드 `3-error-handling.md` 에서 삭제 — 다른 spec 참조와의 일관성

- **target 위치**: `spec/5-system/3-error-handling.md` API 레벨 에러 코드 표 (diff 에서 두 코드 삭제)
- **과거 결정 출처**: `spec/5-system/9-rag-search.md` "에러 레이어 구분" 주석 ("구분: … `MODEL_CONFIG_INVALID` / `MODEL_CONFIG_NOT_FOUND` 은 설정 CRUD 레이어 전용")
- **상세**: `3-error-handling.md` 에서 해당 두 코드가 삭제됐으나, `9-rag-search.md` 에는 여전히 이 코드들을 "API 레이어 에러" 로 언급하는 주석이 잔류한다. `3-error-handling.md` 가 에러 코드 vocabulary 의 단일 진실 역할을 한다면 다른 spec 에서 이를 참조하는 구절도 함께 정합성 갱신이 필요하다.
- **제안**: `9-rag-search.md` 의 해당 주석이 여전히 유효한지 확인 후, 유효하다면 `3-error-handling.md` 에 해당 코드를 유지하거나, 해당 주석을 재작성할 것.

---

### 4. [CRITICAL] `spec/4-nodes/5-data/2-code.md` Rationale 의 `isolated-vm` 전환 결정 — 기각된 대안으로 `node:vm` 이 명시됐는데 target 이 `node:vm` 으로 재채택

- **target 위치**: `spec/4-nodes/5-data/2-code.md` §4, §7.1, §7.2, §5.3.3 (diff 에서 `isolated-vm` → `node:vm` 역행)
- **과거 결정 출처**: `spec/4-nodes/5-data/2-code.md` `## Rationale` "격리 방식 `isolated-vm` 전환 (2026-06-11)" — "**기각된 대안**: …현상 유지 + frozen-prototype 단기완화 — 우회 경로가 다수라 근본 차단이 아니며 다중 워크스페이스에서 수용 불가." / "기존 `node:vm` 의 한계: … `this.constructor.constructor('return process')()` 류의 prototype-chain 으로 host 의 `Function` 생성자에 도달 … escape 가 가능했다"
- **상세**: Rationale 에서 `node:vm` 은 prototype-chain escape 가 가능해 기각·폐기된 격리 방식으로 기록되어 있다. 그러나 이번 diff 는 `spec/4-nodes/5-data/2-code.md` 의 본문을 다시 `node:vm` 으로 기술하고, `CODE_MEMORY_LIMIT` 에러 예시와 `isolated-vm` 메모리 하드 리밋 섹션을 삭제했다. Rationale 은 갱신되지 않아 본문과 Rationale 이 직접 모순 상태다.

  만약 이 변경이 "코드 현실(아직 `node:vm` 사용 중)에 spec 을 맞추는 현행화"라면, Rationale 의 "`isolated-vm` 전환 결정(2026-06-11)"을 "(결정됨, 구현 미완료 — Planned)" 으로 수정하거나, 기각된 대안과 현재 구현 섹션을 분리해야 한다. Rationale 의 "결정으로 종결" 문구가 그대로이면 독자는 `isolated-vm` 이 이미 운용 중이라고 읽을 수밖에 없다.

- **제안**: 다음 중 하나를 택해 Rationale 을 동기화한다.
  - **옵션 A (현행화 + Planned)**: Rationale "격리 방식 `isolated-vm` 전환" 항의 "본 결정으로 종결한다" 표현을 "결정은 완료됐으나 코드 반영은 후속 PR 예정 (현재 구현: `node:vm` 현행화 — Planned)"으로 수정.
  - **옵션 B (구현 완료)**: `isolated-vm` 전환 코드가 실제로 구현됐다면 spec 본문을 `isolated-vm` 기술로 복원하고 이번 diff 를 되돌림.

---

### 5. [INFO] `spec/4-nodes/4-integration/` 범위 핵심 변경 — SSRF 가드 전 인증 공통화 Rationale 적정

- **target 위치**: `spec/4-nodes/4-integration/1-http-request.md` §4 step 8, §8.2
- **과거 결정 출처**: 종전 `spec/4-nodes/4-integration/1-http-request.md` §4 SSRF opt-out callout ("이 플래그는 통합 노드 전반의 SSRF 가드를 공통 제어한다"), `spec/2-navigation/4-integration.md` "SMTP SSRF 가드를 http/db 와 동일 `ALLOW_PRIVATE_HOST_TARGETS` 로 통일" Rationale
- **상세**: 기존 spec 의 SSRF opt-out callout 에는 "이 플래그는 통합 노드 전반의 SSRF 가드를 공통 제어한다"고 이미 명시돼 있었다. `none`/`custom` 에 가드가 없었던 것은 spec 기록된 결정(기각된 대안 없음)이 아니라 코드 주석이 spec 에 근거 없이 정당화한 구현 이탈이었다. target 은 §8.2 에 Rationale 을 신설해 (B), (C) 대안을 명시 기각하고 결정 근거를 적절히 기록했다. **Rationale 연속성 관점에서 문제 없음** — 기각된 Rationale 을 재도입하는 것이 아니라 spec 내 모순을 제거하는 방향이다.
- **제안**: 별도 조치 불필요.

---

### 6. [INFO] D4 결정 (`INTEGRATION_NOT_FOUND` → `INTEGRATION_CALL_FAILED` fallback) 보정 — 기존 Rationale 과 무충돌

- **target 위치**: `spec/4-nodes/4-integration/1-http-request.md` §5.8, §6; `spec/4-nodes/4-integration/2-database-query.md` §5.8, §6.2
- **과거 결정 출처**: `spec/4-nodes/4-integration/0-common.md` §4.2 D4 결정 callout
- **상세**: D4 결정은 "모든 IntegrationError.code 가 output.error.code 로 surface 된다"는 원칙을 세웠다. 이번 diff 는 `INTEGRATION_NOT_FOUND` 가 실제로는 `INTEGRATION_CALL_FAILED` 로 surface 된다는 구현 사실을 명문화했다 — 이는 D4 결정의 **refinement**(코드 동작 반영)이지 번복이 아니다. 기존 표에 `INTEGRATION_NOT_FOUND` 가 독립 코드로 있던 것이 오기였고, 수정이 더 정확하다. 0-common.md D4 callout 에는 이 케이스 처리 방식이 이미 주석("integrationId 부재/소속 오류" 박스)으로 기록됐다.
- **제안**: 별도 조치 불필요.

---

## 요약

이번 diff 의 핵심인 **HTTP Request SSRF 가드 전 인증 공통화(`none`/`custom` 무가드 폐지)**는 기존 spec SSRF opt-out callout 의 "통합 노드 전반 공통 제어" 원칙을 코드에도 일치시키는 방향이며, §8.2 Rationale 에 기각 대안과 결정 근거를 명시해 Rationale 연속성 요건을 충족한다. 주요 우려 사항은 **Code 노드 격리 방식**이다. `spec/4-nodes/5-data/2-code.md` Rationale 에는 `isolated-vm` 전환이 "사용자 결정(2026-06-11)으로 종결"됐다고 기록하는 반면, 이번 diff 는 본문을 다시 `node:vm` 기술로 되돌리고 `CODE_MEMORY_LIMIT` 예시를 삭제했다. Rationale 이 갱신되지 않아 기각된 방식(`node:vm`)이 현재 구현으로 기술되는 모순 상태가 발생했다 — Rationale 내 "기각된 대안" 섹션과 정면으로 충돌한다. `CODE_MEMORY_LIMIT` / `MODEL_CONFIG_INVALID` 등 에러 코드 삭제도 일부 cross-spec 참조가 잔류해 dangling 상태이나 심각도는 낮다. 전체 위험도는 Code 노드 Rationale 모순으로 인해 MEDIUM 으로 판단한다.

---

## 위험도

MEDIUM
