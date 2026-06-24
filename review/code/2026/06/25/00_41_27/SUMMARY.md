# Code Review 통합 보고서

## 전체 위험도
**LOW** — 기능 무변경의 리팩터링·문서화 개선 커밋. 직접적인 신규 취약점 없음. 개발 환경 `@Index` 이중 인덱스 가능성과 미커버 테스트 경로가 LOW 수준 잔존.

---

## Critical 발견사항

_없음_

---

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 테스트 커버리지 | `getStatus()` 의 `form`, `ai_conversation`, 알 수 없는 interactionType(→ null) 세 경로가 테스트되지 않음. `rawInteractionType` 화이트리스트 검증 분기 3/4 미커버 | `interaction.service.spec.ts` `describe('InteractionService.getStatus')` | `form`/`ai_conversation`/알 수 없는 값 케이스 3개 추가 |
| 2 | DB / 부작용 | `@Index(['executionId','status'])` 데코레이터는 partial 조건 없는 full index 선언이므로 `synchronize: true` 개발 환경에서 Flyway V095 partial index와 별도 full index가 중복 생성될 수 있음 | `node-execution.entity.ts` L752 | `synchronize: false` 확인 또는 `@Index` 에 `where: "status IN ('waiting_for_input','running')"` 옵션 추가하여 Flyway 인덱스와 동기화 |
| 3 | 요구사항 | spec §5.4 cancel 응답 필드명 drift — spec은 `{ executionId, status }`, 코드는 `InteractAckDto({ executionId, accepted, currentStatus })` 반환. 의도적 설계인지 표기 오류인지 모호 (사전 존재, 본 커밋 미도입) | `interaction.service.ts` `cancel()` + `responses.dto.ts InteractAckDto` | spec 담당자 확인 후 spec 또는 코드 중 하나를 일치시킬 것 |
| 4 | 유지보수성 | `getStatus()` 메서드가 약 85줄로 단일 메서드로서 복잡도 높음. `buildWaitingContext()` private 헬퍼 분리 시 관심사 분리 및 단위 테스트 용이성 향상 가능 | `interaction.service.ts` L200-552 | `buildButtonsContext`, `buildNodeOutputContext` 등 private 헬퍼 추출 고려 (우선순위 낮음) |
| 5 | 유지보수성 | `useWidget` 훅 전체 길이 약 435줄 (본 커밋 이전 존재 부채) | `use-widget.ts` L966-1400 | 중장기 리팩터링 과제로 등록 |

---

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 보안 | `outputData` 전체를 allowlist 없이 공개 EIA 표면(`getStatus()` REST + SSE fanout)에 동봉. JSDoc 규약만으로 노드 핸들러 실수를 막을 수 없어 런타임 필터 부재 | `interaction.service.ts` L493-528 | 단기: 허용 키 allowlist 필터 추가. 중기: NodeHandlerOutput 타입 분리 및 SSE fanout seam에서 internal 섹션 strip |
| 2 | 보안 | `itk_*` 트리거 토큰이 `Trigger.config` JSONB에 평문 저장 (기존 설계 결정, spec이 이미 인식) | `spec/5-system/14-external-interaction-api.md` §7.1 / §8.3 | `notification.signing.secretRef` 패턴과 동일하게 secret_store AES-256-GCM 암호화 후 ref만 저장하는 migration backlog에 명확한 priority 부여 |
| 3 | 보안 | `configFromQuery()` 에서 `apiBase` query param이 schema 제한 없이 `EiaClient` 생성자에 직접 주입. 공격자가 `?apiBase=https://evil.example` 로 토큰·세션 탈취 가능 (직접 URL 접근 시나리오 한정) | `use-widget.ts` L957-964, `applyConfig()` L1318-1341 | `apiBase` 값을 `https:` schema로 제한하거나, dev/preview 환경에서만 활성화하도록 빌드 플래그 제어 |
| 4 | 보안 | `getStatus()` 첫 번째 `findOne` 이 `select` 필드 미지정으로 전체 컬럼 로드 | `interaction.service.ts` L468-470 | 필요 컬럼(`id`, `workflowId`, `status`, `outputData`, `finishedAt`, `startedAt`, `createdAt`)을 `select` 로 명시 |
| 5 | 요구사항 | `getStatus()` running/waiting_for_input 상태에서 `updatedAt`이 "마지막 상태 변경 시각"이 아닌 `startedAt` 반환 — spec §5.3은 계산 규칙 미정의. 클라이언트 오해 가능성 (사전 존재) | `interaction.service.ts` `updatedAt` fallback 계산 | spec §5.3에 계산 규칙 명시 또는 `Execution` 엔티티에 `updatedAt` 컬럼 추가 고려 |
| 6 | 요구사항 | `seedWaitingFromStatus` + `openStream` 순서에서 SSE replay가 동일 `WAITING` 이벤트를 중복 dispatch 할 수 있음. `widgetReducer` 멱등성 확인 필요 (soft-fail 의도 설계와 일치) | `use-widget.ts` `start()` 내 순서 | `widgetReducer` `WAITING` 케이스 멱등 처리 확인. 이미 멱등이면 무시 가능 |
| 7 | SPEC-DRIFT | [SPEC-DRIFT] spec `EIA-IN-07`에 `?lastEventId=0` 첫 연결 시 seq≥1 전체 replay 동작 설명 추가 — 이미 구현된 동작을 spec이 따라잡은 갱신. 코드 변경 불필요, 본 커밋에서 이미 갱신 완료 | `spec/5-system/14-external-interaction-api.md` §3.2 EIA-IN-07 | 완료. spec §5.2 SSE 스트림 절에도 `?lastEventId=0` 첫 연결 의미론 1줄 보강하면 §3.2와 대칭 달성 가능 |
| 8 | 테스트 | `SSE_SEQ_PLACEHOLDER` 도입 후에도 테스트에서 리터럴 `0` 사용 중. 상수 값 변경 시 테스트가 실제 동작을 반영 못할 수 있음 | `interaction.service.spec.ts` L475 | `SSE_SEQ_PLACEHOLDER` export 후 테스트에서 참조하거나 현 상태를 주석으로 문서화 |
| 9 | 테스트 | `seedWaitingFromStatus` soft-fail 케이스 (getStatus 실패 시 SSE 스트림 계속 진행) 프론트엔드 테스트 미커버 | `use-widget-eager-start.test.ts` | soft-fail 케이스 테스트 1개 추가 |
| 10 | 문서화 | public 메서드 `interact()`, `cancel()`, `refreshToken()`에 JSDoc 미작성 (이번 커밋 범위 외 기존 누락) | `interaction.service.ts` | 각 메서드에 최소 spec 참조 (`[Spec EIA §5.1]` 등)와 1줄 요약 추가 |
| 11 | 문서화 | spec §5.2 SSE 스트림 절에 `?lastEventId=0` 첫 연결 의미론 미명시 (`=0` 특수 의미). §3.2와 비대칭 | `spec/5-system/14-external-interaction-api.md` §5.2 | §5.2 `규약` 섹션에 `?lastEventId=0` 첫 연결 동작 1줄 보강 |

---

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | LOW | `outputData` allowlist 없음(INFO), `itk_*` 평문 저장(INFO), `apiBase` query param 미검증(INFO) |
| requirement | LOW | cancel 응답 `status` vs `currentStatus` 필드명 drift(WARNING), `seedWaitingFromStatus` 중복 WAITING dispatch 멱등성 미확인(INFO) |
| scope | NONE | 모든 변경이 선언된 범위 내, 무관 파일 수정 없음 |
| side_effect | LOW | `@Index` 데코레이터가 `synchronize: true` 환경에서 중복 full index 생성 가능성(WARNING) |
| maintainability | LOW | `getStatus()` ~85줄 메서드 복잡도(WARNING), `useWidget` 훅 435줄 부채(WARNING) |
| testing | LOW | `getStatus()` form/ai_conversation/unknown interactionType 경로 미커버(WARNING), `seedWaitingFromStatus` soft-fail 미커버(INFO) |
| documentation | NONE | 모든 JSDoc 변경이 코드와 정합. public 메서드 JSDoc 부재는 기존 누락(INFO) |
| database | LOW | `@Index` full/partial 불일치로 dev 환경 중복 인덱스 가능성(INFO), 쿼리 패턴·마이그레이션 안전성 양호 |

---

## 발견 없는 에이전트

- **scope**: 변경 범위 완전히 적합, Critical/WARNING 없음
- **documentation**: 주요 문서화 변경 모두 정합, Critical/WARNING 없음

---

## 권장 조치사항

1. **[WARNING-1] 테스트 보강 (interaction.service.spec.ts)**: `getStatus()` 의 `form`, `ai_conversation`, 알 수 없는 interactionType(→ null) 케이스 3개 추가. 변경된 `rawInteractionType` 화이트리스트 로직의 회귀 방지에 필수.
2. **[WARNING-2] `@Index` partial 조건 동기화 또는 `synchronize: false` 명시 확인**: 개발 환경에서 Flyway V095 partial index와 ORM full index 중복 생성 방지를 위해 `@Index` 에 `where` 옵션 추가 또는 팀 내 `synchronize: false` 적용 상태 재확인.
3. **[WARNING-3] spec §5.4 cancel 응답 필드명 확인**: `status` vs `currentStatus` 의도적 설계 여부를 spec 담당자와 확인하고 spec 또는 코드 일치 처리.
4. **[INFO-1] `outputData` allowlist 런타임 필터 추가 검토**: JSDoc 규약만으로는 노드 핸들러 오용을 막을 수 없음. 단기 allowlist 필터를 backlog 아이템으로 등록.
5. **[INFO-7] spec §5.2 `?lastEventId=0` 보강**: §3.2와 대칭을 이루도록 SSE 스트림 절에 첫 연결 의미론 1줄 추가 (저비용 문서 개선).
6. **[INFO-9] soft-fail 테스트 추가**: `seedWaitingFromStatus` getStatus 실패 시 SSE 스트림 계속 진행 케이스 프론트엔드 테스트 1개.

---

## 라우터 결정

라우터가 reviewer 를 선별하여 실행함 (`routing_status=done`).

- **실행 (forced by router_safety)**: `security`, `requirement`, `scope`, `side_effect`, `maintainability`, `testing`, `documentation`, `database` (8명 전원 강제 포함)
- **제외**: 6명

| 제외된 reviewer | 이유 |
|-----------------|------|
| performance | 라우터 선별 제외 |
| architecture | 라우터 선별 제외 |
| dependency | 라우터 선별 제외 |
| concurrency | 라우터 선별 제외 |
| api_contract | 라우터 선별 제외 |
| user_guide_sync | 라우터 선별 제외 |

- **강제 포함(router_safety)**: `documentation`, `maintainability`, `requirement`, `scope`, `security`, `side_effect`, `testing` (7명 — database는 일반 선별)