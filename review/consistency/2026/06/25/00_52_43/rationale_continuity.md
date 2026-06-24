# Rationale 연속성 검토 결과

검토 범위: `spec/5-system/14-external-interaction-api.md` — 구현 완료 후 검토 (--impl-done, diff-base=origin/main)

---

## 발견사항

### [WARNING] `getStatus()` null→실값 번복 — Rationale 항목 미추가

- **target 위치**: `spec/5-system/14-external-interaction-api.md` §5.3 구현 상태 주석 (lines 401-409) 및 `## Rationale` 섹션 전체 (R1~R16)
- **과거 결정 출처**: `spec/5-system/14-external-interaction-api.md` 의 과거 §5.3 주석 — `git show 5b468d37` 에서 제거된 줄:
  > "단 **`currentNode` 와 `context` 는 현재 항상 `null`, `seq` 는 항상 `0` placeholder** 로 반환된다 … 자세한 노드 context 와 최신 seq 는 SSE 의 `waiting_for_input` 페이로드·`id:` 필드가 권위이며 … `currentNode`/`context`/`seq` 의 실값 노출은 **미구현 (Planned)**."
- **상세**: 과거 spec은 `currentNode` / `context` 를 항상 null 로 고정하고 "SSE 가 권위, REST 단발은 최소 정보" 를 원칙으로 명시했다. 현재 구현은 `waiting_for_input` 상태에서 `NodeExecution.outputData` 를 역직렬화해 `currentNode` 와 `context` 를 실값으로 채운다. §5.3 구현 상태 주석은 새 동작을 기술하도록 갱신됐으나, `## Rationale` 섹션에 이 번복의 이유(race window 문제·buttons 미표시 회귀·SSE replay 와의 역할 분담)를 기록한 항목이 추가되지 않았다. R1~R16 중 `getStatus()` 실값 복원 결정을 명시한 항목이 없다.
- **제안**: `## Rationale` 에 R17 항목을 추가해 "(a) 과거 'null 고정' 결정의 이유, (b) race window 로 인한 번복 배경, (c) SSE replay(`lastEventId=0`)와의 역할 분담(SSE = seq/thread 권위, REST = 현재 표면 시드), (d) `conversationThread` 는 여전히 SSE 권위로 유지하는 이유" 를 기록한다. Planned → 완료 이행이므로 근본 원칙 위반은 아니나, 미래 독자가 "왜 REST 단발이 이제 실값을 주는가"를 Rationale 없이는 알 수 없다.

---

### [WARNING] `NodeExecution.outputData` 공개 EIA 표면 노출 보안 제약 — Rationale 미문서화

- **target 위치**: `codebase/backend/src/modules/external-interaction/interaction.service.ts` `getStatus()` JSDoc + `codebase/backend/src/modules/node-executions/entities/node-execution.entity.ts` `@Index` JSDoc
- **과거 결정 출처**: `spec/5-system/14-external-interaction-api.md` §8 (보안), `## Rationale` — 어디에도 "실행 노드의 outputData 가 외부 REST/SSE 로 흐를 때 허용 데이터 범위" 를 정의한 항목이 없다.
- **상세**: 구현 JSDoc 은 "outputData 에 민감 중간 결과(API 키, PII 등) 기록 금지 — 허용되는 데이터는 interaction 메타(버튼 설정, 폼 스키마)로 한정" 이라는 중요한 보안 원칙을 명시한다. 그러나 이 제약은 코드 주석에만 존재하고 spec `## Rationale` 에는 기록되지 않았다. 노드 핸들러 개발자가 spec Rationale 만 보면 이 제약을 인지할 방법이 없다.
- **제안**: EIA `## Rationale` (또는 `spec/conventions/` 의 관련 문서) 에 "outputData 공개 표면 노출 범위" 항목을 추가해, EIA 표면으로 흐르는 outputData 의 허용/금지 데이터 유형과 노드 핸들러 의무를 명시한다. 현재는 실행 엔진·노드 핸들러 스펙에서 이 제약을 알 수 없다.

---

### [INFO] `@Index(['executionId', 'status'])` TypeORM 데코레이터 vs Flyway V095 partial index 의 관계 — Rationale 부재

- **target 위치**: `codebase/backend/src/modules/node-executions/entities/node-execution.entity.ts` — `@Index` 데코레이터 추가
- **과거 결정 출처**: `spec/0-overview.md` Rationale "DB 마이그레이션 도구로 Flyway 채택" — "Prisma client 의 schema 와 Flyway SQL 의 schema 가 이중으로 존재 — drift 위험. `migrations.spec.ts` 가 CI 마다 schema_history vs 파일 정합성을 검증해 silent skip 을 차단한다."
- **상세**: Flyway forward-only 원칙 아래 V095 마이그레이션이 이미 partial index 를 생성한 상황에서 TypeORM `@Index` 데코레이터를 추가하면 "schema 정의 이중 출처" 가 생긴다. 코드 JSDoc 은 "중복 DDL 방지를 위해 새 마이그레이션 없이 TypeORM 스키마 인식만 선언" 이라고 설명하나, 이것이 기존 "Flyway 가 DDL SoT" 원칙과 어떻게 조화되는지 spec Rationale 에 기록이 없다. `@Index` 와 Flyway partial index 가 실제로 같은 인덱스를 가리키는지, TypeORM schema sync 가 부작용을 일으키지 않는지에 대한 명시적 정당화가 Rationale 에 없다.
- **제안**: `spec/0-overview.md` Rationale "Flyway 채택" 항 또는 `spec/conventions/migrations.md` 에 "TypeORM `@Index` 데코레이터와 Flyway SQL index 의 관계 — TypeORM schema sync 비활성화 전제 하에 `@Index` 는 schema 인식 전용, DDL SoT 는 Flyway 유지" 를 한 단락 추가한다.

---

### [INFO] `seedWaitingFromStatus` soft-fail 정책 — 코드에만 존재, Rationale 부재

- **target 위치**: `codebase/channel-web-chat/src/widget/use-widget.ts` `seedWaitingFromStatus` `useCallback` JSDoc
- **과거 결정 출처**: `spec/5-system/14-external-interaction-api.md` Rationale — SSE 가 1차 복구 경로임을 암묵 전제하나, REST 단발 getStatus 의 실패 정책을 별도 기록한 항목이 없다.
- **상세**: `seedWaitingFromStatus` 는 "HTTP 오류·네트워크 실패 시 console.warn 후 진행(soft-fail)" 이라는 실패 정책을 JSDoc 에 명시한다. 이 정책은 "SSE replay 가 1차 복구 경로이므로 REST 시드는 best-effort" 라는 설계 결정을 전제하나, 이 trade-off(soft-fail 시 캐러셀 미표시 가능성 vs SSE replay 의존)가 spec Rationale 에 기록되지 않았다.
- **제안**: EIA Rationale R17(위 WARNING) 내에 soft-fail 정책의 근거("SSE replay 가 1차, REST 시드는 보강—실패 시에도 SSE replay 로 복구 가능하므로 블로킹하지 않음")를 포함한다.

---

## 요약

target 구현 변경(getStatus 실값 복원, seedWaitingFromStatus 시드, lastEventId=0 replay)은 EIA spec Rationale의 기존 원칙(R10 facade, R3 SSE, R4 per_execution)을 직접 위반하지 않으며, 과거 "currentNode/context null 고정" 결정은 "Planned" 태그가 붙어 있어 번복 예정이 예고된 사항이다. 그러나 이 Planned→완료 이행의 설계 근거(race window, SSE와의 역할 분담, outputData 보안 제약)가 `## Rationale` 에 기록되지 않아, 미래 독자나 노드 핸들러 개발자가 spec Rationale 만 보고 이 결정의 맥락을 파악하기 어렵다. 원칙 위반·합의 파괴 수준의 충돌은 없으나, Rationale 갱신 미비로 "결정의 무근거 번복" 패턴(WARNING 기준)에 해당하는 항목 1건과 정보 보완 항목 3건이 있다.

---

## 위험도

MEDIUM
