# 요구사항(Requirement) 리뷰

## 발견사항

- **[INFO]** 성능 캐비엇 수치의 재현성 — CHANGELOG 가 단언한 "0.0181 → 0.0323 ms(+0.0142, 1.78배)" 수치는 이 diff 안에서 재현 불가능한 실측 서술(별도 벤치마크 스크립트 결과)이라 코드 리뷰 관점에서 직접 검증할 수 없다.
  - 위치: `CHANGELOG.md:52` ("**성능**: emit 당 순회가 2회 → 3회...")
  - 상세: requirement 관점에서는 기능 완전성·spec 정합 문제는 아니고(성능 리뷰어 소관), 다만 수치가 diff 로 검증 불가능한 서술이라는 점만 기록한다.
  - 제안: 조치 불요 (performance reviewer 영역).

## 점검 결과 요약 (관점별)

이번 changeset(§A WS emit 값-패턴 마스킹 wire+fanout, §B 내부 REST `outputData`+노드 레벨 `inputData` 마스킹, `Execution.inputData` 카브아웃, §D 표면 목록 단일 정본화)을 아래 관점으로 독립 검증했다. 이 changeset 은 이미 동일 세션 내 7라운드의 `/ai-review`(CRITICAL 1건 → 0건으로 수렴, WARNING 다수 반영)를 거쳤고, 본 리뷰는 그 이력을 신뢰하지 않고 최종 코드·테스트·spec 을 직접 대조해 독립 재검증했다.

1. **기능 완전성** — `redactStoredDataForResponse`(신설)가 `redactStoredErrorForResponse` 와 동일 프리미티브(`deepRedactSecrets`)를 사용해 `inputData`/`outputData` 컬럼에 적용된다. `executions.service.ts` 의 `toResponseExecution`(findById/getChain/stop 공유 관문) · `toExecutionDto`(목록) · `nodeExecutions[]` map · `background-runs.service.ts` `toNodeExecutionDto` 여섯 표면 전부에 실제로 걸려 있음을 소스에서 직접 확인했다(`git diff origin/main...HEAD` 로 각 파일 재확인). WS 쪽은 `maskWireEnvelope`(wire, `deepRedactSecretsPreserving` + `llmCalls` 예외)와 `toFanoutEnvelope`(fanout, strip 후 조립)가 `emitExecutionEvent`/`emitNodeEvent` 양쪽에서 호출된다. 선언된 범위 전체가 구현되어 있다.
2. **엣지 케이스** — `redactStoredDataForResponse(null|undefined)` → `null` 정규화, `maskIfPresent` 의 `== null` 방어(TypeORM 런타임 undefined 대응), 마커 멱등(`[REDACTED]`/`***`/`[REDACTED_DEPTH]` 재마스킹 방지)과 그 반대 캐너리("마커 아닌 진짜 값은 계속 마스킹")가 `sanitize-error-message.spec.ts`/`redact-stored-error.spec.ts` 양쪽에 있다. `deepRedactSecretsPreserving` 의 `preserveKeys` 는 캐시를 공유하지 않음(교차 오염 방지)을 별도 테스트로 고정했다.
3. **TODO/FIXME** — `git diff origin/main...HEAD -- codebase/` 전체에서 TODO/FIXME/HACK/XXX 마커 신규 추가 없음(grep 확인).
4. **의도와 구현 간 괴리** — 함수명(`maskIfPresent`, `toFanoutEnvelope`, `maskWireEnvelope`, `redactStoredDataForResponse`)과 JSDoc 서술이 실제 동작과 일치. 유일하게 반복 지적됐던 "自매 표면 개수 불일치"(4→6, describe 제목의 "비대상"/"대상" 오분류) 문제는 `10_50_14` 라운드에서 방향별 표로 재작성되며 해소됐고, 이번 diff 의 최종 상태(`executions.service.spec.ts` describe 제목 `outputData + 노드 레벨 inputData 마스킹 — 표면 전수 (Execution.inputData 는 카브아웃)`)는 실제 동작(`Execution.inputData` 원문, `NodeExecution.inputData` 마스킹)과 정확히 일치함을 직접 대조했다.
5. **에러 시나리오** — DB 원문 보존(egress-only) 원칙이 전 표면에서 일관됨(`redactStoredDataForResponse`/`redactStoredErrorForResponse` 모두 read 시점에만 적용, write 경로 미접촉). `stop()` 의 세 반환 경로(waiting/재조회 두 갈래)가 전부 `toResponseExecution` 단일 관문을 통과.
6. **데이터 유효성** — `maskIfPresent` 의 non-null 정적 계약과 런타임 방어(`== null`) 분리가 JSDoc 에 명시되고 실제로 구현과 일치.
7. **비즈니스 로직** — 카브아웃 축("표시 전용이 아니라 재제출되는가")이 `Execution.inputData`(Re-run 프리필 재제출 경로 실측: `page.tsx` → `rerun-modal.tsx` `useOriginalInput` 기본 `false` → `inputOverride` 제출)에는 정확히 적용되고, `NodeExecution.inputData`(재제출 소비처 없음, WS↔REST flip-flop 방지)에는 반대로 적용된다. 이 레벨 분리는 `spec/1-data-model.md:471,550`, `spec/5-system/14-external-interaction-api.md` §R17 "잔여 ②" 표, `executions.service.spec.ts`/`background-runs.service.spec.ts` 세 층 모두에서 완전히 일치한다.
8. **반환값** — `redactStoredDataForResponse`/`maskIfPresent` 등 모든 경로가 명시적으로 값을 반환(암묵적 `undefined` 반환 경로 없음). copy-on-change 최적화(무변화 시 동일 참조 반환)가 `toResponseExecution`·`nodeExecutions[]` map·`toExecutionDto` 세 자리 모두에서 참조 동일성 테스트(`⑥-b`, `⑦`)로 고정돼 있다.
9. **spec fidelity** — `spec/5-system/14-external-interaction-api.md` §R17("적용 범위는 총칭이 아니라 열거다" 여섯 표면 표, "잔여 ②" 레벨 표), `spec/5-system/6-websocket-protocol.md` §4.1("값-패턴 마스킹" 캐비엇 + WIRE_PRESERVED_FIELDS 언급), `spec/1-data-model.md` §Execution/§NodeExecution 필드 설명, `spec/conventions/swagger.md`(DTO description 길이 예외 규약화)를 코드와 line-level 로 대조했다. 전부 일치 — 표면 개수(6)·컬럼별 마스킹 함수명(`redactStoredDataForResponse`/`redactStoredErrorForResponse`)·레벨별 정책(Execution.inputData 비대상/NodeExecution.inputData 대상)·`llmCalls` wire 예외가 spec 본문과 구현 사이에 어긋나는 지점을 찾지 못했다. spec 결함도 발견되지 않았다(과거 라운드가 이미 §2.13 거짓 진술·"4곳"→"6곳" 표면 수·"emit 미포함" 오기재를 전부 정정 완료).

## 요약

WS emit(wire+fanout) 값-패턴 마스킹, 내부 REST `outputData`+노드 레벨 `inputData` 마스킹, `Execution.inputData` 카브아웃이 선언된 범위대로 완전히 구현돼 있고, 코드·테스트(신규 회귀 테스트 실측 12개 + WS 8개 + sanitize-error-message 자매 describe)·spec(`14-external-interaction-api.md` §R17, `6-websocket-protocol.md` §4.1, `1-data-model.md`, `conventions/swagger.md`) 네 층이 line-level 로 서로 일치함을 직접 대조해 확인했다. 이 changeset 은 이미 7라운드의 `/ai-review`(1건의 CRITICAL — `inputData` 무차별 마스킹으로 인한 Re-run 재제출 오염 — 이 레벨 분리로 해소)를 거쳤으며, 본 독립 재검증에서도 새로운 CRITICAL/WARNING 을 발견하지 못했다. TODO/FIXME 등 미완성 마커 없음, 모든 경로에서 반환값 정의됨, null/undefined 등 엣지 케이스가 캐너리 테스트로 고정됨.

## 위험도
NONE
