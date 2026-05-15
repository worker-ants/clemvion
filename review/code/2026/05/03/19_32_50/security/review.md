### 발견사항

---

- **[WARNING]** KB 청크 내용이 `turnDebug` 를 통해 프론트엔드에 추가 노출
  - 위치: `ai-agent.handler.ts` L291, L419, L626, L731 — `ragSources: turnRagAcc.getSources()` 추가
  - 상세: 기존에는 노드 전체 누적 `meta.ragSources` 에만 청크 미리보기(200자)가 포함되었으나, 이번 변경으로 동일 데이터가 `meta.turnDebug[].ragSources` 에도 turn 단위로 복제된다. 스펙 주석은 "워크플로우 소유자만 실행 결과 조회 가능하므로 별도 접근 제어 불필요"라고 명시하지만, 이 접근 제어가 실제로 관철되지 않는 엣지케이스(공유 링크, 협업 권한 등)가 존재하면 KB 원문 단편이 추가 경로로 유출된다.
  - 제안: `ragSources` 의 `content` 필드가 이미 200자로 잘리고 있어 피해 범위는 제한적이다. 단, `turnDebug` 전체 오브젝트를 API 응답에 실을 때도 워크플로우 소유자 권한 검증이 적용되는지 integration test 또는 E2E 레벨에서 확인 필요.

---

- **[WARNING]** LLM이 주입한 `query` 문자열이 검색 서비스에 그대로 전달
  - 위치: `kb-tool-provider.ts` `parseKbArgs()` / `execute()` — `args.query` → `ragSearchService.search()`
  - 상세: `parseKbArgs` 는 타입 체크(`typeof parsed.query === 'string'`)만 수행하고 내용 무결성 검증은 없다. 이 문자열은 LLM tool call 인자이므로 프롬프트 인젝션을 통해 공격자가 임의의 쿼리를 제어할 수 있다. 현재 `RagSearchService.search()` 가 벡터 유사도 검색만 수행한다면 SQL 인젝션 위험은 낮지만, 해당 서비스 내부에 full-text search, 로깅, 또는 동적 SQL이 포함된 경우 위험이 증가한다.
  - 제안: `parseKbArgs` 에서 `query` 길이 상한(예: 2,000자)을 추가하고, `RagSearchService.search()` 내부에서 임베딩 생성에만 사용되는지 확인. 쿼리를 직접 SQL에 interpolate 하지 않는지 검토 필요.

---

- **[INFO]** KB tool 이름이 에러 메시지에 그대로 반영
  - 위치: `kb-tool-provider.ts` L157-160
  - 상세: `Unknown knowledge base tool: ${call.name}` 오류는 LLM tool result context로 반환된다. `call.name` 은 LLM 응답에서 온 값이므로, LLM이 악의적인 tool 이름을 생성한 경우 해당 문자열이 그대로 다음 LLM 호출 context에 포함된다. 직접적인 보안 취약점은 아니지만 반사형 정보 노출에 해당한다.
  - 제안: `error: 'unknown_kb_tool'` 같은 고정 코드만 반환하거나, `call.name` 을 로그에만 남기고 응답에서는 제거.

---

- **[INFO]** `sanitizeKbId` 의 다대일 충돌 가능성
  - 위치: `kb-tool-provider.ts` `sanitizeKbId()` — `id.replace(/[^a-zA-Z0-9_]/g, '_')`
  - 상세: `a-b` 와 `a_b` 가 모두 `a_b` 로 sanitize 된다. `extractKbIdFromToolName` 에서 known KB ID 목록 전체를 순회해 비교하므로 실제 충돌이 발생하면 의도한 KB 대신 다른 KB를 검색할 수 있다. UUID 기반 KB ID 는 충돌 가능성이 매우 낮지만 이론적 위험이 존재한다.
  - 제안: UUID 구분자 `-` 는 `_` 로 치환하되, 전체 배열을 순회할 때 첫 번째 매칭 대신 정확히 1건만 매칭되는지 검증하거나, 충돌 시 warn 로그 출력.

---

- **[INFO]** 비-null 단언(`!`) 사용으로 런타임 오류 가능성
  - 위치: `result-detail.tsx` (ReferencesChip render 구간) — `turnRefIndex!.get(item.turnIndex)!`
  - 상세: `(turnRefIndex?.get(item.turnIndex)?.length ?? 0) > 0` 조건부 렌더 직후에 `!` 단언을 사용한다. 조건이 맞으면 안전하지만, 이후 리팩토링 시 조건이 제거되면 런타임 오류로 이어질 수 있다.
  - 제안: `turnRefIndex?.get(item.turnIndex) ?? []` 로 방어적으로 작성.

---

### 요약

이번 변경은 KB 검색 결과를 turn 단위로 `turnDebug`에 추가 노출하는 기능 확장이다. 하드코딩된 시크릿, SQL/XSS 인젝션, 인증 우회 등의 직접적인 취약점은 없으며 입력 검증(타입 체크, 숫자 범위, 배열 여부 확인)도 적절히 수행된다. 다만 KB 청크 내용이 기존보다 더 많은 경로(`turnDebug[].ragSources`)로 프론트엔드에 전달되므로, 워크플로우 실행 결과 API 전반에 걸쳐 소유자 권한 검증이 일관되게 적용되는지 재확인이 권장된다. LLM 제어 하의 `query` 문자열이 검색 서비스로 그대로 전달되는 점도 향후 검색 구현 변경 시 주의가 필요하다.

### 위험도

**LOW**