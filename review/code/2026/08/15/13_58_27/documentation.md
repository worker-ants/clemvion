# 문서화(Documentation) 리뷰

## 발견사항

- **[WARNING]** §6.5 "알려진 예외 1건" 해소 편집에서 취소선 대신 **완전 삭제**된 문장이 있다 — 정확히 같은 PR 이 스스로 세운 보존 원칙과 어긋난다
  - 위치: `spec/5-system/14-external-interaction-api.md:816-818` (해소 노트로 바뀐 지점). 실제로 삭제된 원문("추적: [`spec-sync-external-interaction-api-gaps.md`](../../plan/in-progress/spec-sync-external-interaction-api-gaps.md) — 이 문서의 관행대로 **알려진 갭은 invariant 옆에 적는다**(R14·R17·§6.4 와 동형)")은 diff 상 `-` 줄이라 게이트 번호가 없다(구 파일 809~819행, 신 파일 기준으로는 존재하지 않음). `Read` 로 직접 대조 확인 완료.
  - 상세: 이 절의 핵심 클레임("retry-turn 재진입 시 DB≠emit")은 올바르게 `~~취소선~~` + `**(2026-08-15 해소)**` 패턴으로 보존됐다(577행 durationMs 캐비엇과 동일 패턴 — 관행 준수). 그런데 바로 다음 문장, 즉 "추적: [트래커 링크] — 이 문서의 관행대로 알려진 갭은 invariant 옆에 적는다" 는 취소선 없이 **통째로 사라졌다**. 이 문장은 (a) 이슈를 추적하던 plan 문서로의 링크이자 (b) "왜 지우지 않고 옆에 적어 두는가"를 설명하는 이 저장소 자체의 컨벤션 근거 문장이다 — 아이러니하게도 "이력 보존 원칙"을 설명하는 바로 그 문장이 이력 보존 없이 삭제됐다. 이 편집이 겨냥한 plan 체크리스트(`plan/in-progress/eia-db-wire-invariant.md` 항목 ② 두 번째 체크박스, 게이트 `78-80`)는 스스로 "삭제가 아니다. … 원문을 지우면 *왜* 그 예외가 있었는지가 사라진다"고 명시했는데, 실제 spec 편집은 그 "왜"에 해당하는 부분(트래커 링크 + 관행 근거)을 지운 셈이라 plan 이 밝힌 의도와 실제 실행이 어긋난다. 같은 라운드의 `node-cancellation.md` 정정(§2.4 Rationale, 209~217행)은 `> ~~원문~~` + `> **(2026-08-15 정정)** ...` 패턴으로 원문을 온전히 보존해 대비된다.
  - 제안: 삭제된 세 줄을 취소선(`~~...~~`) 처리해 복원하거나, 최소한 트래커 링크만이라도 "(해소, 상세 이력은 링크 참조)" 형태로 남길 것. planner 소관(spec/ 쓰기 권한)이라 developer 턴에서 직접 고치기보다 후속 spec 정정으로 등재 권장.

- **[WARNING]** 테스트 인라인 주석의 "트래커 등재" 주장이 실제 트래커에서 확인되지 않는다
  - 위치: `codebase/backend/src/modules/external-interaction/interaction.service.spec.ts:95-97`
  - 상세: 새 주석은 "엔티티는 `finishedAt: Date` / `durationMs: number` 로 선언하지만 두 컬럼 모두 `nullable: true` 다 — 타입이 DB 를 정확히 말하지 않는다. … 엔티티 정정은 이 PR 범위 밖 — **트래커 등재**." 라고 적는다. `codebase/backend/src/modules/executions/entities/execution.entity.ts:56-63` 을 직접 대조하면 `finishedAt: Date`/`durationMs: number` 선언과 `@Column({ nullable: true })` 불일치는 실측 사실과 맞다. 그러나 `plan/in-progress/*.md` 전체(및 `eia-db-wire-invariant.md` 자신의 "## 범위 밖 (등재됨)" 절 — `finalizeStalledExhausted` 트랜잭션·관용구 헬퍼 추출·종결 emit 타입 파사드·프런트엔드 Duration 컬럼 4건만 등재)를 grep 해도 이 엔티티 타입-nullable 불일치를 가리키는 항목을 찾지 못했다. "등재됨" 이라는 주장이 실제로는 어디에도 걸려 있지 않다면, 이 코멘트가 유일한 흔적이 되어 향후 아무도 이 갭을 백로그로 못 찾는다("미측정 전제가 백로그 항목을 만든다"는 이 저장소가 이미 겪은 패턴과 같은 결이다).
  - 제안: 실제로 등재할 계획이면 어느 plan/트래커 항목인지 파일명:섹션으로 주석에 명시하거나, `eia-db-wire-invariant.md` "## 범위 밖 (등재됨)" 절에 5번째 항목으로 추가할 것. 등재할 계획이 없다면 "트래커 등재"라는 확정적 표현 대신 "추후 별도 처리 필요(미등재)"로 낮출 것.

## 양호한 점 (참고)

- `CHANGELOG.md` 신규 항목이 "수신자 영향" 절을 포함해 이 저장소의 기존 CHANGELOG 관행을 그대로 따르고, additive/breaking 여부를 명시한다.
- `execution-status-response.dto.ts` 의 `durationMs` 필드는 JSDoc 과 `@ApiPropertyOptional` description 이 내용·문구까지 정확히 일치하며, 종결 전 `null`(키 present) 규약(§5.4)과 취소·타임아웃 캐비엇(§6.5)을 모두 명시한다.
- `execution-engine.service.ts`/`retry-turn.service.ts` 의 신규 인라인 주석은 복잡한 guarded-UPDATE·COALESCE 로직의 "왜"를 상세히 설명하고, 자매 함수 주석이 과거 대칭을 잘못 주장했던 사실까지 정확히 기록한다.
- `spec/conventions/node-cancellation.md` 의 §2.4 Rationale 정정(209-217행)은 원문을 취소선으로 보존한 뒤 정정 사유·날짜를 덧붙이는 모범적인 처리다 — 위 첫 번째 발견사항과 대비된다.
- `plan/in-progress/eia-db-wire-invariant.md` 는 "다른 plan 과의 관계" 절로 정본 트래커(`spec-sync-external-interaction-api-gaps.md`)를 명시적으로 링크하고, 자매 트래커(`spec-sync-external-interaction-api-gaps.md:228-244,307-310`)도 같은 커밋 계열에서 `[x]` + "처방 정정" 노트로 동기화됐다.
- 신규 REST `durationMs` 필드는 CHANGELOG·DTO JSDoc·spec §5.3 예시(482-489행) 세 곳에서 예시값(`4242`)·의미·null 규약이 모두 일치한다.

## 요약

이번 diff 는 문서화 관점에서 전반적으로 우수하다 — CHANGELOG·spec·plan·JSDoc·인라인 주석이 서로 잘 교차 참조되고, 특히 "과거 주석이 절반만 참이었다"는 사실을 자매 코드·spec·트래커 세 곳 모두에서 정직하게 기록한 점이 눈에 띈다. 다만 §6.5 캐비엇 해소 편집에서 핵심 클레임은 취소선으로 보존했지만 바로 옆 트래커 링크+관행 근거 문장은 취소선 없이 완전 삭제되어, 이 PR 이 스스로 명시한 "삭제가 아니라 보존" 원칙이 부분적으로만 지켜졌다. 또한 테스트 주석의 "트래커 등재" 주장은 실제 plan 파일 전수 검색으로 뒷받침되지 않아 미등재 갭을 등재된 것처럼 오인시킬 위험이 있다. 둘 다 기능에 영향은 없는 WARNING 수준이며 spec/plan 쓰기 권한(planner) 또는 짧은 주석 수정으로 해소 가능하다.

## 위험도

LOW
