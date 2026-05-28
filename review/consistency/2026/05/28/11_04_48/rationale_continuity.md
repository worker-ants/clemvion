# Rationale 연속성 검토 결과

검토 대상: `spec/conventions/cafe24-api-metadata.md`
검토 모드: `--impl-prep` (구현 착수 전)
검토 시각: 2026-05-28

---

## 발견사항

- **[INFO]** `description` 필드 주석의 "또는 다국어 키" 표현이 i18n 책임 분리 원칙과 혼동 가능
  - target 위치: `spec/conventions/cafe24-api-metadata.md` §2 `Cafe24OperationMetadata.description` 필드 주석 (line 52)
  - 과거 결정 출처: 본 문서 `## Rationale` "backend `label` 필드 제거 — frontend i18n dict 단일 SoT (2026-05-28)" — "backend metadata 가 영문 식별자 (id, catalog key) 만 보유. 한국어/영문 라벨은 dict 하나가 SoT."
  - 상세: `description: string` 주석이 "MCP tool description (영문 권장) **또는 다국어 키**" 라고 적혀 있다. `description` 은 UI 라벨이 아닌 LLM 에게 전달되는 MCP tool description 으로, `label` 제거 결정의 직접 대상이 아닌 것은 맞다. 그러나 "다국어 키" 라는 표현이 metadata 작성자로 하여금 한국어 문자열이나 i18n 키를 `description` 에 넣어도 된다는 인상을 줄 수 있다. Rationale 의 i18n 책임 분리 원칙 — "backend 는 catalog key 만 노출하고 i18n 을 매 frontend 렌더 시점에 수행" — 과 거리감이 생긴다.
  - 제안: 주석을 "MCP tool description. **영문 권장** — LLM tool-calling 에 직접 노출되므로 언어 혼용 금지. 사람 친화 UI 라벨은 frontend i18n dict (`cafe24Catalog.<key>`) 가 SoT (§7.5)." 로 교체해 MCP description 과 UI 라벨의 역할을 명확히 분리한다. "또는 다국어 키" 표현 제거.

- **[INFO]** catalog endpoint 응답의 `descriptionKey` 파생 규칙이 metadata 인터페이스에서 명시되지 않음
  - target 위치: `spec/conventions/cafe24-api-metadata.md` §7.5 책임 분리 표 (line 417), §2 `Cafe24OperationMetadata` 인터페이스
  - 과거 결정 출처: 본 문서 `## Rationale` "backend `label` 필드 제거 — frontend i18n dict 단일 SoT (2026-05-28)" + `spec/2-navigation/4-integration.md` Rationale "활동 로그 API 식별 — 3컬럼 (label/method/path) + catalog endpoint 신설 (2026-05-28)" — catalog endpoint 는 `{ key, method, path, labelKey, descriptionKey }` 를 노출하고, `labelKey`/`descriptionKey` 는 frontend dict 의 lookup key (영문 ID).
  - 상세: `Cafe24OperationMetadata` 인터페이스에는 `id`, `description`, `scopeType`, `method`, `path` 등이 있지만 `descriptionKey` 필드는 없다. catalog endpoint 가 응답하는 `descriptionKey` 가 메타데이터의 어느 필드에서 파생되는지, 아니면 별도 관례(`cafe24.<resource>.<operation>.description` 형식의 dict 키인지)가 spec 에 명시되어 있지 않다. `labelKey` 는 `cafe24.<resource>.<operation>` 형식으로 catalog key 와 동일하다고 §7.5 가 명시하지만, `descriptionKey` 에 대해서는 동일 설명이 없다. i18n 책임 분리 원칙("backend 는 영문 ID 만 보유")의 구체적 적용이 `descriptionKey` 에서는 미완성 상태다.
  - 제안: §7.5 책임 분리 표의 `descriptionKey` 항 또는 §6 절차에 "catalog endpoint 의 `descriptionKey` 는 `cafe24.<resource>.<operation>.description` (예: `cafe24.product.product_list.description`) 형식으로 구성되며, frontend dict 가 이 키로 사람 친화 설명을 lookup 한다" 같은 파생 규칙을 명시한다. 이 명시가 없으면 backend 구현자가 `Cafe24OperationMetadata.description` 의 영문 MCP description 문자열을 `descriptionKey` 로 그대로 보내거나, `labelKey` 와 동일 값을 보내는 등 임의 구현을 선택할 수 있다.

---

## 요약

`spec/conventions/cafe24-api-metadata.md` 의 Rationale 연속성은 전반적으로 양호하다. 2026-05-28 에 추가된 두 결정 — §7.5 catalog key 형식 명문화와 `label` 필드 완전 제거 — 은 모두 각자의 Rationale 항을 함께 작성했고, 기각된 대안(deprecated 점진 이주, 노드 에디터만 이주)을 명시적으로 나열했으며, `spec/2-navigation/4-integration.md` Rationale 의 "DB Enum 비확장·영속 상태와 화면 술어 분리" 원칙과 모순되는 내용이 없다. 다만 두 가지 경미한 INFO 사항이 있다: `description` 필드 주석의 "또는 다국어 키" 표현이 i18n 책임 분리 원칙과 혼동을 일으킬 수 있고, catalog endpoint 응답의 `descriptionKey` 파생 규칙이 spec 어디에도 명시되어 있지 않다. 두 항목 모두 기존 결정을 번복하거나 invariant 를 위반하는 것은 아니므로 구현 착수를 차단하지 않는다.

## 위험도

LOW
