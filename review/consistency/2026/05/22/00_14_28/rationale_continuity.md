# Rationale 연속성 검토 결과

검토 대상: `spec/0-overview.md`
검토 모드: spec draft (--spec)
검토 일시: 2026-05-22

---

## 발견사항

### [WARNING] §6.3 "Internal MCP Bridge 패턴 확장" 행의 §6.2 dangling 참조
- **target 위치**: `spec/0-overview.md` §6.3 표, 라인 101
  ```
  | **Internal MCP Bridge 패턴 확장** | Cafe24 (구현 완료, §6.2) 이후 ...
  ```
- **과거 결정 출처**: `spec/0-overview.md ## Rationale` 의 "Cafe24 통합을 §6.1 (완료) 분류로 (§6)" 항
  - "채택: Cafe24 항목을 §6.1 (구현 완료 ✅) 로 이동. 미래 확장 (Internal MCP Bridge 패턴을 Shopify·Naver Smartstore 등으로) 은 §6.3 의 별도 행으로 유지."
- **상세**: Rationale 에서 Cafe24 완료 항목을 §6.1 로 이동했다고 명시했지만, §6.3 본문에서는 "Cafe24 (구현 완료, **§6.2**)" 라고 쓰여 있다. 분류 결정이 Rationale 에는 정확히 기록됐으나 §6.3 본문은 이전 위치(`§6.2`)를 여전히 가리킨다. 이는 Rationale 의 분류 결정과 본문 내 참조가 직접 모순되는 잔존 오기다.
  - §6.1 행(라인 82)에서는 `다른 first-party 이커머스(Shopify·Naver Smartstore)로의 Internal MCP Bridge 패턴 확장은 §6.3 참조` 로 올바르게 기술되어 있어 두 방향 참조가 엇갈린다.
- **제안**: §6.3 표 해당 행에서 `§6.2` 를 `§6.1` 로 수정.
  ```
  | **Internal MCP Bridge 패턴 확장** | Cafe24 (구현 완료, §6.1) 이후 ...
  ```

---

### [INFO] Rationale 항목들의 본문 반영 — 정합 확인

아래 항목들은 Rationale 결정이 본문에 올바르게 반영되어 있음을 확인했다.

- **S3 KB 키 prefix 설계**: §2.7 버킷 구조가 `kb/{kbId}/{documentId}/...` 패턴을 정확히 기술하고, 기각된 `{workspaceId}/kb/...` 패턴은 Form/Avatar 영역에만 사용한다는 원칙이 본문·Rationale 양쪽에서 일관된다.
- **Flyway 채택**: §2.8 이 Flyway 만 기술하며 기각된 `prisma migrate` 는 Rationale 에서만 언급된다. 본문에 `prisma migrate` 사용을 암시하는 내용 없음.
- **실행 엔진 Redis 큐 + BullMQ**: §2.4 본문이 Redis 기반 BullMQ 를 기술하며 기각된 in-process 실행 / Postgres LISTEN/NOTIFY 큐는 Rationale 에만 기록된다. 단, §6.3 라인 101 에서 `§5-system/11-mcp-client.md` 의 `#23-internal-bridge-in-process` 앵커를 참조하는데, 여기서 `in-process` 는 MCP Internal Bridge 패턴명이지 실행 엔진 대안이 아니므로 충돌 아님.
- **Inline Alert 위치**: §3.4 본문이 `0-overview.md` cross-cutting 자리에 정의를 두고, `spec/2-navigation/_layout.md` 에는 Inline Alert 정의가 없음을 확인. 기각된 대안(`_layout.md` 에 두기)이 재도입되지 않았다.

---

## 요약

`spec/0-overview.md` 의 Rationale 연속성은 대체로 양호하다. S3 KB 키, Flyway, 실행 엔진, Inline Alert 위치 등 주요 결정 항목은 본문과 Rationale 간 정합이 유지된다. 단 §6.3 "Internal MCP Bridge 패턴 확장" 행에서 Cafe24 참조 위치가 `§6.2` 로 남아 있어, Rationale 에 기록된 분류 결정(`§6.1` 이동)과 직접 모순된다. 이는 Rationale "Cafe24 통합을 §6.1 (완료) 분류로" 항에서 명시적으로 결론 내린 사항이 §6.3 본문에 전파되지 않은 잔존 오기로, WARNING 수준이며 즉각 수정이 가능하다.

---

## 위험도

LOW
