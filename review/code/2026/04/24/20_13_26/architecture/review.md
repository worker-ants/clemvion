### 발견사항

---

**[INFO]** `optional()` → `default('')` 타입 계약 변경  
- 위치: `send-email.schema.ts` L113~121  
- 상세: Zod 파싱 결과의 TypeScript 타입이 `string | undefined` → `string`으로 변경된다. 이미 `bodyType: .default('text')`, `to/cc/bcc: .default([])` 등 동일 패턴이 적용되어 있어 **스키마 내 일관성은 향상**되었으나, 다운스트림 소비자가 `config.subject === undefined` 분기를 직접 체크하는 경우 silent type mismatch가 발생할 수 있다. plan 문서가 "모든 소비자가 빈 문자열/undefined를 동치 처리"라고 확인했으므로 현재는 안전하다.  
- 제안: 핸들러(`send-email.handler.ts`)에서 `config.subject === undefined` 분기 패턴이 없는지 grep 확인 후 종료. 없으면 조치 불필요.

---

**[WARNING]** 동적 포트 노드 간 stable-id 패턴 불완전 적용  
- 위치: `switch.schema.ts` + `plan/node-schema-audit.md` F-1  
- 상세: 아키텍처적으로 동적 포트 노드(`switch`, `ai_agent`, `information_extractor`, `text-classifier`, `carousel/chart/table/template`)는 모두 동일한 edge 안정성 보장 책임을 진다. 이번 커밋이 `switch`에 `id`를 추가했지만 `text-classifier`는 스키마·핸들러·resolver 3곳 모두 미조치 상태다. **패턴이 부분 적용된 상태에서 코드베이스가 배포되면, 동일 추상화 계층의 노드들이 서로 다른 edge 안정성 보장을 제공하는 구조적 불일치가 고착된다.**  
- 제안: plan F-1의 스코프(스키마 1 + resolver 1 + handler 2 + 테스트)가 이미 정확히 명시되어 있다. 별도 태스크로 분리해 다음 버그 픽스 배치에 포함시키는 것이 적절하다.

---

**[INFO]** `id` 필드의 이중 역할 (라우팅 키 + UI 설정 필드)  
- 위치: `switch.schema.ts` `caseDefSchema.id`  
- 상세: `id` 필드가 (1) resolver/LLM의 포트 라우팅 키, (2) config의 저장 필드로 동시에 동작한다. `hidden: true` meta가 UI 관심사를 스키마에 인라인하는 방식은 기존 `ai_agent`/`information_extractor`의 `conditionDefSchema.id`와 동일 패턴이므로 **프로젝트 내 일관성은 유지**된다. 그러나 이 패턴은 schema 레이어에 UI presentation 관심사가 혼재하는 구조다. 현 규모에서는 수용 가능하나, 노드 수가 증가할수록 meta.ui 분리를 고려할 수 있다.  
- 제안: 현 단계에서는 변경 불필요. 노드 수 확장 시점에 `NodeUiMeta` 레지스트리 분리 여부를 재평가.

---

**[INFO]** `http-request.keyValueSchema` `.passthrough()` 누락 (F-4)  
- 위치: `plan/node-schema-audit.md` F-4  
- 상세: 이번 변경 범위는 아니지만, `send-email`·`switch`·`form`·`carousel` 등이 `.passthrough()`를 명시하는 일관된 확장성 포지션을 취하는 반면, `http-request`의 headers/queryParams/cookies sub-schema는 Zod 기본 strict mode다. 런타임 오류보다는 forward-compatibility 위험으로, 향후 sub-field shape 변경 시 기존 저장 데이터가 조용히 strip된다.  
- 제안: plan F-4에 이미 조치안이 정리되어 있다. 1줄 수정이므로 다음 schema 관련 커밋에 끼워 넣는 것이 효율적.

---

**[INFO]** `sendEmailNodeOutputSchema`와 configSchema 간 `subject` 타입 의도적 비대칭  
- 위치: `send-email.schema.ts` L24 vs L113  
- 상세: output schema에서 `subject: z.string().optional()`이고, config schema에서 `subject: z.string().default('')`다. 이는 **입력 설정(config) vs 실행 결과 관찰(output)**이라는 서로 다른 계층을 표현하는 의도적 분리이므로 아키텍처적으로 올바르다. config는 항상 렌더링 가능한 값이 필요하고, output은 발생하지 않을 수 있는 필드를 선택적으로 포함한다.  
- 제안: 조치 불필요. 다만 향후 유지보수 시 혼동을 줄이기 위해 두 스키마의 파일 내 주석이 이 분리 의도를 명시하면 좋다.

---

### 요약

이번 변경은 두 가지 국소적 스키마 보강으로 구성된다: `send-email`의 `subject`/`body` default 추가는 기존 배열 필드 패턴과의 일관성을 회복하며 LLM의 "optional = 생략 가능" 오독을 차단하는 방어적 조치다. `switch.caseDefSchema`의 `id` 필드 추가는 `ai_agent`/`information_extractor`에 이미 적용된 stable-port-id 패턴을 논리 노드까지 확장한다. 두 변경 모두 기존 아키텍처 패턴을 따르며 호환성을 유지한다. 주요 아키텍처 리스크는 **동적 포트 노드 간 stable-id 패턴이 아직 `text-classifier`에 적용되지 않아 edge 안정성 보장 수준이 노드 종류에 따라 달라지는 구조적 불일치**이며, 이는 plan F-1로 추적 중이다.

### 위험도

**LOW**