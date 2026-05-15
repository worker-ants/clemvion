### 발견사항

---

**[INFO] rawConfig 폴백 시 평가된 값이 "raw"로 저장될 수 있음**
- 위치: `information-extractor.handler.ts:288` — `const rawConfig: Record<string, unknown> = context.rawConfig ?? config;`
- 상세: `context.rawConfig`가 없는 경우(레거시 실행 또는 첫 턴) 엔진이 이미 템플릿을 해석한 `config`를 rawConfig로 저장합니다. 이 경우 `{{ vars.model }}`이 아닌 실제 해석 결과(`gpt-4o` 등)가 "raw"로 DB에 저장되고, 이후 resumed 턴에서 원본 템플릿인 것처럼 echo됩니다. 기능 오동작보다는 의도 불일치이지만, 만약 해석된 값에 민감한 자격증명이 포함된 경우 의도치 않게 노출 경로가 생깁니다.
- 제안: `context.rawConfig`가 없을 때 경고 로그를 남기고, `config`가 항상 unevaluated 상태임을 engine 계약으로 보장하거나 명시적으로 문서화.

---

**[INFO] `rendered` HTML과 `items`/`rows` 배열 간 데이터 불일치**
- 위치: `carousel.handler.ts:171` (`rendered = this.renderHtml(items, layout)` → 이후 `cappedItems` 적용), `table.handler.ts:134` (동일 패턴)
- 상세: `rendered` HTML은 캡이 적용되기 전의 전체 배열로 생성되지만 `output.items`/`output.rows`는 잘린 부분집합입니다. 6개 아이템 중 4개만 `output.items`에 있어도 `rendered`에는 6개가 모두 렌더링됩니다. 보안 취약점이라기보다는 "표시된 것"과 "API로 제공되는 것"이 다른 상태입니다. 다운스트림 노드가 `output.items` 기준으로 로직을 처리하면서 사용자는 rendered 기준으로 인터랙션 한다면 예상치 못한 동작이 발생할 수 있습니다.
- 제안: cap 적용 후 `cappedItems.value`로 HTML을 재생성하거나, spec에 "rendered는 items보다 많은 항목을 포함할 수 있다"는 경고를 추가.

---

**[INFO] rawConfig echo로 인한 워크플로우 설정 구조 노출**
- 위치: `ai-agent.handler.ts:1379` `buildMultiTurnConfigEcho`, `information-extractor.handler.ts:824` `buildMultiTurnFinalOutput`
- 상세: `systemPrompt`, `knowledgeBases`, `conditions` 등 워크플로우 저자만 알아야 할 설정 템플릿이 `output.config`에 echo됩니다. `output.output`과 `output.config`의 접근제어 수준이 동일하다면, 워크플로우 결과를 볼 수 있는 최종 사용자가 내부 프롬프트 구조(`You are {{ vars.persona }}`)나 RAG 지식베이스 ID(`kb-1`, `kb-2`)를 볼 수 있게 됩니다.
- 제안: `output.config`를 워크플로우 실행자(author/admin)에게만 노출하고, 최종 사용자에게는 필터링하는 접근제어 레이어를 확인.

---

**[INFO] rawConfig 필드 전체 저장 — 화이트리스트 부재**
- 위치: `information-extractor.handler.ts:305` `stateBase`에 `rawConfig` 추가
- 상세: `context.rawConfig ?? config` 전체가 DB multi-turn state에 저장됩니다. 현재는 알려진 필드만 echo에 사용하지만, 미래에 config에 민감한 필드(e.g., `llmApiKey`, 내부 라우팅 정보)가 추가될 경우 자동으로 DB에 영속됩니다.
- 제안: `rawConfig` 저장 시 명시적 필드 화이트리스트(`mode`, `model`, `systemPrompt`, ...)만 pick하는 방어적 패턴 고려.

---

**[LOW] `truncateArrayForOutput` 전체 배열 직렬화 선행 비용**
- 위치: `truncate-body.util.ts:120` `measure(arr)` 첫 호출
- 상세: cap 여부 판단을 위해 전체 배열을 `JSON.stringify`합니다. 현재 호출 지점(Carousel은 `maxItems`≤100, Table은 `pageSize`≤200)은 상한이 있지만, 향후 다른 핸들러에서 상한 없이 호출할 경우 수백만 개 tiny element 배열에서 선행 직렬화 비용(`O(n)`)이 발생합니다. 배열 총 요소 수 × 평균 크기가 1MB 이하인지 요소 수 기준으로 조기 종료 가능.
- 제안: `if (arr.length > MAX_SAFE_COUNT) { /* skip full measure, go direct to binary search */ }` 형태의 element count guard 추가 또는 호출 전 상한 보장 문서화.

---

### 요약

이번 변경은 multi-turn AI 노드에서 사용자 저작 rawConfig를 output.config에 echo하고, Presentation 노드 배열에 1MB 상한을 적용하는 두 가지 기능을 구현합니다. 외부 입력 경계가 새로 생기지 않고, 주로 내부 데이터 흐름을 변경하므로 전통적인 인젝션·인증 취약점은 없습니다. 가장 주의할 지점은 rawConfig echo로 인해 워크플로우 설정 구조(프롬프트 템플릿, 지식베이스 ID, 조건 목록)가 execution output에 포함되어 접근제어 경계를 넘어 노출될 수 있다는 점이며, `rendered` HTML과 잘린 `items`/`rows` 간의 불일치도 표시 데이터와 프로그래매틱 접근 데이터 사이의 일관성 문제를 야기할 수 있습니다.

### 위험도

**LOW**