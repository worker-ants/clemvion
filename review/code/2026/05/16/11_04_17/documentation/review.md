# Documentation Review

## 발견사항

### 긍정적 평가

- **[INFO]** SQL 마이그레이션 파일(V049, V050)에 풍부한 인라인 주석 포함
  - 위치: `backend/migrations/V049__integration_consecutive_network_failures.sql`, `V050__integration_cafe24_connected_rotated_idx.sql`
  - 상세: 설계 의도, 이전 상태, 새 상태, spec 참조(§6, §11)를 모두 기록. `COMMENT ON COLUMN` 으로 DB 수준 문서화까지 완비.
  - 제안: 현 수준 유지. 모범 사례.

- **[INFO]** `OAuthBeginResultDto` JSDoc 대폭 강화
  - 위치: `backend/src/modules/integrations/dto/responses/integration-response.dto.ts` L287–299
  - 상세: 두 분기(일반 흐름 vs Cafe24 Private)를 명시하고 `spec/2-navigation/4-integration.md §9.2` 참조를 추가. 각 필드에도 분기 조건 설명 포함.
  - 제안: 현 수준 유지.

- **[INFO]** Makefile 인라인 주석이 `--build` 추가 배경과 `e2e-test-full` 의 `&&` / `STATUS=$$?` 패턴을 상세 설명
  - 위치: `Makefile` L75–103
  - 상세: "왜 이 플래그가 필요한가", "왜 이 패턴인가"를 모두 서술. 실제 장애 사례(2026-05-15)까지 언급.
  - 제안: 현 수준 유지.

---

### 개선 필요 사항

- **[WARNING]** 스펙 파일(`spec/2-navigation/4-integration.md`)의 업데이트 여부 확인 필요
  - 위치: `V049 SQL`, `integration.entity.ts`, `integration-expiry-scanner.service.ts`, `cafe24-token-refresh.processor.ts` 등 여러 파일에서 `spec/2-navigation/4-integration.md §6`, `§9.2`, `§11`, `§11.1`, `§2.4` 를 참조
  - 상세: 이번 PR 에서 추가된 `consecutiveNetworkFailures` 컬럼, Cafe24 Private OAuth 분기(`OAuthBeginResultDto` 필드 4종), `pending_install` 필터 추가, `status` 검증 범위 확대(`source` 무관) 등 여러 동작 변경이 spec 상의 섹션을 직접 참조하고 있다. diff 범위에 `spec/` 수정이 포함되지 않아 spec 문서가 구현과 일치하게 갱신되었는지 확인할 수 없다.
  - 제안: `spec/2-navigation/4-integration.md` §6(network failure 상태 전이), §9.2(OAuthBeginResult 응답 형태), §11(background refresh), §2.4(`pending_install` 상태) 를 직접 열람해 새 필드·동작이 반영되어 있는지 검증할 것.

- **[WARNING]** `V050__integration_cafe24_connected_rotated_idx.conf` — 주석 전무
  - 위치: `backend/migrations/V050__integration_cafe24_connected_rotated_idx.conf`
  - 상세: `executeInTransaction=false` 한 줄만 있고 왜 이 설정이 필요한지 설명이 없다. Flyway 설정 파일은 `CREATE INDEX CONCURRENTLY` 처럼 트랜잭션 안에서 실행 불가능한 DDL에 필요하다는 사실이 암묵 지식으로만 남는다.
  - 제안: 파일 상단 또는 SQL 파일 내 주석에 "CONCURRENTLY 는 트랜잭션 내 실행 불가 — executeInTransaction=false 필수" 한 줄을 추가할 것.

- **[WARNING]** test describe 이름이 언어 전환 이후에도 "Korean" 을 여전히 언급
  - 위치: `backend/src/nodes/data/code/code.schema.spec.ts` L991 (`it('emits the Korean warning when code body is empty')`), `backend/src/nodes/data/transform/transform.schema.spec.ts` L1074 (`it('emits the Korean warning when no operations are defined')`), `backend/src/nodes/logic/foreach/foreach.schema.spec.ts` L1685 (`it('emits the Korean warning when arrayField is missing')`), `backend/src/nodes/logic/loop/loop.schema.spec.ts` L1847 (`it('emits the Korean warning when count is missing')`), `backend/src/nodes/logic/map/map.schema.spec.ts` L1918 (`it('emits the Korean warning when inputField is missing')`), `backend/src/nodes/logic/merge/merge.schema.spec.ts` L1966 (`it('emits the Korean warning when strategy is missing')`), `backend/src/nodes/logic/if_else/if-else.schema.spec.ts` L1768 (`it('emits both Korean warnings on a freshly-created node')`)
  - 상세: warningRule 메시지가 영문으로 전환되었으나 test description에 "Korean" 이라는 단어가 잔존한다. 메시지가 이제 영어이므로 테스트 이름이 부정확한 문서 역할을 한다.
  - 제안: describe/it 이름에서 "Korean warning" → "warning message" 또는 "blocking error" 등 언어 중립적 표현으로 일괄 정리.

- **[WARNING]** `llm-provider-rule.ts` 모듈 수준 JSDoc 에 SoT 전환 배경이 미반영
  - 위치: `backend/src/nodes/ai/llm-provider-rule.ts` L23 주석
  - 상세: 파일 상단의 기존 주석("메시지 상수를 공유해 typo / 표현 변형을 막는다")은 여전히 한국어로 기술되어 있고, 이번 영문 전환의 이유(SoT 정책, `WARNING_KO` 번역 위임)가 추가되지 않았다. `metadata-validation.ts` 는 이미 JSDoc 에 SoT 전환 이유를 명시했지만 `llm-provider-rule.ts` 는 아직이다.
  - 제안: 모듈 상단 주석에 "English SoT — frontend `WARNING_KO` 가 한국어 번역을 담당" 한 줄을 추가해 `metadata-validation.ts` 의 설명과 일관성을 맞출 것.

- **[INFO]** `integration.entity.ts` 에 `consecutiveNetworkFailures` 필드 JSDoc 은 충분하나 임계값(3) 문서화 위치가 엔티티에만 있음
  - 위치: `backend/src/modules/integrations/entities/integration.entity.ts` L370–383
  - 상세: "3 도달 시점에 markStatus 호출" 이 엔티티 JSDoc 에만 기록되고, 실제로 3을 소비하는 `Cafe24ApiClient` 에 같은 임계값이 문서화되어 있는지 diff 범위에서 확인 불가(파일 37·38 diff 생략됨).
  - 제안: `Cafe24ApiClient` 소스에서 임계값을 magic number 가 아닌 named constant(`CONSECUTIVE_FAILURE_THRESHOLD = 3`)로 추출하고 해당 상수에 spec 참조 주석을 달 것. 엔티티 JSDoc 과 상수 이름이 SoT 역할을 나눠 가지지 않도록 단일 위치로 집중.

- **[INFO]** `integrations.service.ts` 의 `lastRotatedAt: new Date()` 인라인 주석이 상세하나 spec 링크 미포함
  - 위치: `backend/src/modules/integrations/integrations.service.ts` L619–626
  - 상세: `PR #56` 을 언급하지만 spec 섹션 참조가 없다. `enqueueCafe24BackgroundRefresh` 와의 관계는 `spec/2-navigation/4-integration.md §11` 에 정의된 내용이므로 참조를 추가하면 가독성이 높아진다.
  - 제안: 주석 끝에 `// spec/2-navigation/4-integration.md §11` 를 추가.

- **[INFO]** CHANGELOG `### Test infrastructure` 항목이 단일 섹션에 두 가지 사항(Makefile `--build` 추가 + e2e 타겟 설명)을 혼합
  - 위치: `CHANGELOG.md` L45–48
  - 상세: 내용 자체는 정확하고 충분히 상세하나, 한 bullet 에 인프라 재빌드 이유, 발생했던 회귀 사례, BuildKit 캐시 동작까지 모두 포함해 가독성이 다소 낮다.
  - 제안: bullet 을 둘로 분리하거나 주요 사실(자동 rebuild 추가) + 배경(stale 이미지 회귀)으로 구조화 권장. 필수 수정은 아님.

---

## 요약

이번 변경은 문서화 품질이 전반적으로 높다. SQL 마이그레이션 주석, `OAuthBeginResultDto` JSDoc, Makefile 인라인 주석 모두 설계 의도·spec 참조·실제 장애 사례까지 기록한 모범적 수준이다. README 는 폴더 구조 갱신 및 `make e2e-*` 신기능 사용법을 적절히 추가했고, CHANGELOG 도 경로 수정과 Test infrastructure 항목을 기록했다. 다만 warningRule 영문 전환에도 test describe 이름에 "Korean" 이 7군데 잔존하는 불일치가 가장 눈에 띄는 문서 정확성 문제이며, `spec/2-navigation/4-integration.md` 가 이번 다수의 동작 변경(연속 실패 카운터, Private OAuth 분기, pending_install 필터)을 실제로 반영했는지 diff 에 포함되지 않아 확인이 필요하다. 나머지는 경미한 일관성 개선 사항이다.

## 위험도

LOW
