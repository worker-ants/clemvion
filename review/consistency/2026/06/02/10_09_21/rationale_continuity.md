# Rationale 연속성 검토 결과

검토 모드: `--impl-prep` (구현 착수 전)
검토 대상: `spec/4-nodes/4-integration/` 전체 (0-common / 1-http-request / 2-database-query / 3-send-email / 4-cafe24)
주요 구현 계획: `plan/in-progress/cafe24-allowlist-ui.md` (AI Agent allowlist UI, §8.3)

---

## 발견사항

- **[INFO]** `enabledTools` materialize-on-first-edit 동작 — 신규 operation 추가 시의 semantic 미명시
  - target 위치: `plan/in-progress/cafe24-allowlist-ui.md` 구현 항목 — `"첫 편집 시 전체 id 로 materialize 후 토글"`
  - 과거 결정 출처: `spec/5-system/11-mcp-client.md §5.6` — `['*'] 또는 미설정 = 전부 허용 (기본)` / `spec/4-nodes/4-integration/4-cafe24.md §8.3` — `"frontend 가 enabledTools 배열로 펼쳐 저장한다"`
  - 상세: spec §5.6 은 `undefined/absent` 와 `['*']` 를 동일 의미("전부 허용")로 정의한다. 계획이 제안하는 "첫 편집 시 전체 operation id 배열로 materialize" 는 이후 메타데이터에 새 operation 이 추가됐을 때 이 통합의 allowlist 가 자동 확장되지 않는(기존 explicit 배열 고정) 결과를 낳는다. 반면 `undefined` 를 유지하면 새 operation 이 자동 포함된다. 두 동작 중 어느 쪽이 정책인지 spec 어디에도 명시되지 않았다. `4-cafe24.md §8.3` 의 `"펼쳐 저장"` 문구는 UI short-form 을 배열로 펼친다는 의미로 쓰였으나, "처음 UI 를 열어 아무것도 바꾸지 않아도 `undefined` → 전체 explicit 배열로 저장" 을 authorize 하는 문구는 아니다.
  - 제안: `4-cafe24.md §8.3` 또는 `11-mcp-client.md §5.6` 에 "사용자가 allowlist 를 처음 편집할 때 `undefined` → explicit 배열로 materialize 한다 (이후 신규 operation 은 포함되지 않음)" 또는 "편집 완료 시 여전히 전부 선택 상태이면 `undefined` 를 유지한다 (신규 operation 자동 포함 보장)" 의 결정을 명시. 구현 착수 전에 둘 중 어느 쪽이 의도인지 확인이 필요.

- **[INFO]** `restrictedApproval.level='program'` 의 AI Agent allowlist ⚠ 렌더 정책 미정의
  - target 위치: `plan/in-progress/cafe24-allowlist-ui.md` 항목 — `"level==='operation'`(+`program`)"
  - 과거 결정 출처: `spec/4-nodes/4-integration/4-cafe24.md §8.3` / `spec/conventions/cafe24-api-metadata.md §2` (level enum: `'scope' | 'operation' | 'program'`)
  - 상세: `4-cafe24.md §8.3` 의 AI Agent allowlist ⚠ 렌더 정책은 `level='scope'` (그룹 헤더 ⚠) 와 `level='operation'` (operation 행 ⚠) 두 가지만 명시한다. `level='program'` (Analytics 등) 에 대한 allowlist UI 처리는 spec 에 기술되어 있지 않다. 계획은 `operation` 과 동일하게 operation 행 ⚠ 로 처리하려는 의도로 읽히나, `cafe24-api-metadata.md §2` 에서 `level='program'` 은 "catalog 화 대상이 아닌 별도 트랙, UI 라벨링은 향후 도입 시 동일 메타데이터 차원을 재사용" 이라고만 되어있어 "향후 도입" 이 본 작업 범위 안인지 불분명하다.
  - 제안: `4-cafe24.md §8.3` 에 `level='program'` operation 이 allowlist UI 에 나타날 때의 처리 방침(operation 행 ⚠ 적용 여부, 또는 "현재 cafe24 catalog 에 해당 row 없으므로 구현 대상 외" 명시)을 한 줄 추가. 구현에서 `program` 을 `operation` 과 동일하게 처리한다면 무해하지만, spec 에서 "향후 도입" 으로 유예했던 것을 선행 구현하는 것이므로 Rationale 이 명시되어야 한다.

---

## 요약

`spec/4-nodes/4-integration/` 의 핵심 Rationale 결정들(D4: 모든 실행 실패를 `port:'error'` 로 라우팅 / `meta.durationMs` 명명 통일 / `to`/`cc`/`bcc` array-only 정준화 / SSRF 가드 `ALLOW_PRIVATE_HOST_TARGETS` 통일 / Cafe24 단일 노드 + 메타데이터 테이블 / install_token persistent 격상 / allowlist bare-id 배열 저장)은 target 문서와 구현 계획 안에서 일관되게 유지된다. 기각된 대안의 재도입이나 합의 원칙의 명시적 위반은 발견되지 않는다. 다만 AI Agent allowlist UI 구현 계획에서 "첫 편집 시 전체 id 로 materialize" 동작이 `undefined` 유지 시의 신규 operation 자동 포함 semantics 와 충돌할 수 있으며, `level='program'` 의 UI 처리가 spec 의 "향후 도입" 유예를 조용히 앞당기는 형태로 들어올 가능성이 있다. 두 항목 모두 구현 착수 전 spec 명시로 해소 가능한 INFO 수준이다.

## 위험도

LOW
