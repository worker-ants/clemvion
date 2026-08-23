# 부작용(Side Effect) 리뷰

## 발견사항

- **[INFO]** 공개 REST 응답(`getStatus` waiting `nodeOutput`)의 필드 구성이 fail-closed 로 좁아짐 — 의도된 인터페이스 변경이지만 기존/미지 외부 소비자 영향 고지
  - 위치: `codebase/backend/src/modules/external-interaction/interaction.service.ts:392-394` (`allowlistNodeOutputKeys(stripAndRedact(nodeExec.outputData) ?? {})`)
  - 상세: `GET /api/external/executions/:id` 가 `WAITING_FOR_INPUT` 상태일 때 반환하던 `context.nodeOutput`/`context.buttonConfig.nodeOutput` 이 이전에는 `stripAndRedact`(deny-list, `llmCalls` 한 칸)만 거쳐 그 외 모든 최상위 키가 그대로 나갔다. 이 변경으로 `NODE_OUTPUT_ALLOWED_KEYS`(9개: `config`·`output`·`meta`·`port`·`status`·`formConfig`·`conversationConfig`·`buttonConfig`·`interactionType`) 밖의 모든 최상위 키가 조용히 제거된다. 의도된 보안 하드닝(`_retryState` 누출 차단)이고 spec(`spec/5-system/14-external-interaction-api.md` §R17)·plan 에 범위가 명시돼 있어 "의도치 않은" 부작용은 아니지만, 이 엔드포인트를 쓰는 외부 클라이언트(위젯 외 다른 소비자가 있다면)가 문서화되지 않은 다른 최상위 키에 의존하고 있었다면 그 필드를 조용히 잃는다 — 공개 API 표면(interface) 변경이므로 기록해 둔다.
  - 제안: 이미 spec §R17 표와 plan 트래커에 범위(REST `getStatus` 1곳 · terminal 2곳 제외 · SSE 잔여)가 명시돼 문서화 요건은 충족됨. 추가 조치 불필요 — 참고용 기록.

- **[INFO]** 신규 export `NODE_OUTPUT_ALLOWED_KEYS` 가 `Object.freeze` 없이 모듈 레벨 배열로 노출됨
  - 위치: `codebase/backend/src/shared/utils/strip-external-only-fields.ts:138-150` (`export const NODE_OUTPUT_ALLOWED_KEYS = [...] as const;`)
  - 상세: `as const` 는 컴파일타임 리터럴 타입만 부여할 뿐 런타임 불변성을 주지 않는다. 이 배열은 `allowlistNodeOutputKeys`(`strip-external-only-fields.ts:179-192`)가 매 호출마다 참조하는 보안 경계(fail-closed allowlist)인데, 어떤 소비 코드가 실수로 `.push()`/`.splice()` 등으로 변형하면 이후 모든 호출의 필터링 결과가 전역적으로 바뀐다. 다만 자매 상수 `EXTERNAL_STRIPPED_FIELDS`(같은 파일, 기존 패턴)도 동일하게 freeze 없이 노출돼 있어 이 PR 이 새로 만든 위험 패턴은 아니다 — 기존 관례를 그대로 따른 것.
  - 제안: 현재 유일한 소비처는 같은 파일의 `allowlistNodeOutputKeys` 뿐이라(실측: `grep -rn "NODE_OUTPUT_ALLOWED_KEYS" codebase/backend/src` → 정의·타입가드·함수 내부 3곳만) 즉시 위험은 낮음. 후속으로 `EXTERNAL_STRIPPED_FIELDS` 와 함께 `Object.freeze` 를 고려할 수 있으나 이 PR 범위 밖.

## 점검했으나 문제 없음으로 판단한 항목

- **함수 시그니처/공개 API**: `stripExternalOnlyFields` 의 시그니처·동작은 무변경. `allowlistNodeOutputKeys` 는 순수 추가 export 이며 기존 호출자에 영향 없음(신규 함수).
- **순수성/변형 없음**: `allowlistNodeOutputKeys` 는 copy-on-change 이며(`strip-external-only-fields.spec.ts` 의 "원본을 변이시키지 않는다" 테스트로 고정) 입력을 in-place 변형하지 않는다. 삭제할 키가 없으면 동일 참조를 반환하는 기존 자매 함수(`stripDeep`)의 관례를 그대로 따른다.
- **호출 스코프**: `grep -rn "allowlistNodeOutputKeys" codebase/backend/src` 로 실측 — `strip-external-only-fields.ts`(정의) 와 `interaction.service.ts`(호출 1곳, `getStatus` waiting 분기)뿐. SSE/fanout 경로(`websocket.service.ts` `toFanoutEnvelope`)는 이 PR 이 건드리지 않으며, 그 사실이 plan(`plan/in-progress/spec-sync-external-interaction-api-gaps.md`)과 spec(§R17 표)에 "잔여" 로 명시돼 있어 "부분 수정만 하고 안 알린" 형태의 부작용은 아니다.
- **컴파일타임 assertion**: `assertAllowlistCoversHandlerContract`(`strip-external-only-fields.ts:160-168`)는 런타임 부작용이 없는 타입 전용 canary — `void` 로 unused 경고만 억제, 상태 변경 없음.
- **환경 변수 / 네트워크 / 파일시스템**: 코드 변경분(4개 `.ts`/`.spec.ts` 파일)에서 env 읽기·쓰기, 외부 호출, 파일 I/O 없음. `plan/`·`review/`·`spec/` 마크다운 파일 변경은 이 저장소의 워크플로 규약(plan 트래커·consistency 산출물·spec 갱신)상 예상된 문서 변경으로, 코드 부작용이 아니다.
- **`getStatus` 내부 하위 소비**: 필터링 이후 `out.meta`(line 395)·`structured.config?.buttonConfig`/`structured.buttonConfig`(line 409-413) 접근은 모두 allowlist 에 남는 키(`meta`/`config`/`buttonConfig`)만 읽으므로 이 변경으로 인한 downstream 로직 파손 없음.
- **다른 소비처와의 격리**: `EXTERNAL_STRIPPED_FIELDS`/`stripExternalOnlyFields` 를 쓰는 다른 소비처(WS fanout 등)는 새 import 구문(`strip-external-only-fields.ts:46-49`)이 named export 를 하나 더 추가한 것뿐이라 영향 없음.

## 요약

핵심 변경은 `NodeExecution.outputData` 가 REST `getStatus` 의 waiting `nodeOutput` 출구로 나갈 때 최상위 키를 deny-list(`llmCalls` 한 칸)에서 fail-closed allowlist(`NODE_OUTPUT_ALLOWED_KEYS`, `NodeHandlerOutput` 공개 키 + wire 전용 키)로 좁히는 것이다. 신규 함수 `allowlistNodeOutputKeys` 는 순수·비변형(테스트로 고정)이고, 컴파일타임 assertion 은 런타임 부작용이 없으며, 호출 스코프는 `getStatus` 단일 지점으로 grep 실측 확인됐다. 유일하게 기록할 가치가 있는 부작용은 (1) 이 필터링이 공개 REST 응답의 필드 구성을 실제로 좁히는 **의도된 인터페이스 변경**이라는 점 — spec/plan 에 범위가 이미 명시돼 문서화 요건은 충족하지만 미지의 외부 소비자에게는 실질적 동작 변화이며, (2) 신규 export 배열이 자매 상수와 같은 관례로 freeze 없이 노출돼 있다는 점(기존 패턴 답습, 신규 위험 아님)이다. 둘 다 CRITICAL/WARNING 수준의 의도치 않은 부작용은 아니다.

## 위험도

LOW
