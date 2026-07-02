# Code Review 통합 보고서

## 전체 위험도
**LOW** — Critical 발견 없음. WARNING 2건은 모두 이번 PR 이전부터 존재하는 구조적 부채(pre-existing)이며 이번 변경이 신규 도입한 위험 없음.

## Critical 발견사항

해당 없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 아키텍처 (pre-existing) | `ExecutionEngineService` God Class — 생성자 주입 15+개, 4200줄, SRP 위반 및 높은 결합도. 이번 변경과 무관하며 JSDoc에 "PR-H/I 점진적 책임 분해 예정" 명시됨 | `execution-engine.service.ts` 전체 | PR 범위 외. 후속 리팩터 M 시리즈에서 계획 진행 |
| 2 | 아키텍처 (pre-existing) | `forwardRef` 순환 DI 3쌍 — `AiTurnOrchestrator`, `FormInteractionService`, `ButtonInteractionService` 모두 엔진을 역방향 주입해 양방향 의존성 형성. 초기화 순서 추론 어렵고 단위 테스트 모킹 복잡도 증가 | `execution-engine.service.ts` constructor | `ENGINE_DRIVER` 인터페이스 범위 최소화 검토를 후속 리팩터에서 수행 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 아키텍처 | `isRecord`/`toRecord` 가 도메인 무관 순수 유틸임에도 execution-engine 모듈 내 배치. 후속 클러스터에서 재사용 시 cross-module import 유발 가능 | `execution-engine/utils/to-record.ts` | 현 PR 범위에서는 단일 사용이므로 현 위치 적절. 인접 서비스 확산 시점에 `src/common/utils/record.ts` 승격 검토 |
| 2 | 요구사항/동작 | `toRecord` 는 배열·원시값도 `{}` 로 수렴(기존 `??` 는 null/undefined만 수렴). 그러나 해당 호출 사이트 downstream은 `.interactionType` property 접근 뿐이므로 동작 동치 성립 | `execution-engine.service.ts:1478-1481` | 향후 `cachedMeta` 를 `Object.keys()`·spread·배열 순회로 소비하는 코드 추가 시 사이트별 동작 차이 확인 필요 |
| 3 | 요구사항 | `isRecord` 는 class 인스턴스(Date, RegExp, Map)도 `true` 반환(plain object 가드 아님). 현 사이트는 DB JSONB 역직렬화 결과이므로 위험 없음 | `to-record.ts:10-11` | 향후 재사용 사이트에서 진정한 plain-object 가드가 필요한 경우 `constructor === Object` 추가 검토. JSDoc 보완 권장(필수 아님) |
| 4 | 요구사항 | `cachedMeta.interactionType as string \| undefined` (line 1480) — `toRecord` 변환 이후에도 property 접근 시 `as` 단언 잔류. 의도적 범위 외(후속 클러스터 배정) | `execution-engine.service.ts:1480-1481` | 후속 클러스터에서 처리 예정 |
| 5 | 테스팅 | `isRecord(new Date())`, `isRecord(new Map())`, `Object.create(null)` 에 대한 명시적 테스트 케이스 없음. 의도된 동작이지만 문서화 목적 테스트 부재 | `to-record.spec.ts` | 빌트인 인스턴스·null-prototype 케이스 테스트 1-2건 추가(낮은 우선순위) |
| 6 | 테스팅 | `execution-engine.service.ts` 변경 사이트(line 1478)에 대한 엔진 레벨 통합/유닛 테스트가 diff에 미포함. 유틸 테스트가 의미론을 커버하므로 실질 위험 낮음 | `execution-engine.service.ts:1475-1478` | 기존 `execution-engine.service.spec.ts` 커버 여부 확인 |
| 7 | 유지보수성 | `to-record.spec.ts:105` 에서 `toRecord(null)['missing']` bracket-notation 사용 — 동 파일 다른 테스트는 dot-notation 사용하여 스타일 불일치 | `to-record.spec.ts:105` | 통일하거나 bracket-notation 선택 이유 인라인 주석 명시 |
| 8 | 보안 | `toRecord` 대체로 기존 무검증 `as` 단언 제거 — 런타임 형태 검증 추가로 보안 개선 | `execution-engine.service.ts:1478` | 추가 조치 불필요 (긍정적 변경) |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 보안 취약점 없음. `toRecord` 대체로 런타임 검증 추가 — 긍정적 변경 |
| architecture | LOW | pre-existing God Class(4200줄) + forwardRef 순환 DI 3쌍. 이번 변경 아키텍처 자체는 적절 |
| requirement | LOW | 동작 동치 성립. class 인스턴스 isRecord 동작 미문서화, 잔류 as 단언은 의도적 후속 배정 |
| scope | NONE | 변경 범위 정확. M-7 첫 클러스터 명세와 완전 일치 |
| side_effect | NONE | 순수 리팩터링. 공개 API·함수 시그니처 변경 없음. 관측 가능한 동작 변화 없음 |
| maintainability | NONE | 유틸 위치 현 시점 적절. 테스트 bracket-notation 소소한 불일치 외 이슈 없음 |
| testing | LOW | 빌트인 인스턴스·null-prototype 테스트 미포함. 엔진 레벨 통합 테스트 부재 |
| documentation | NONE | JSDoc·plan 문서·테스트 인라인 주석 모두 충실 |

## 권장 조치사항

1. (선택, 낮은 우선순위) `to-record.spec.ts` 에 빌트인 객체 인스턴스·`Object.create(null)` 동작 문서화 테스트 추가
2. (선택, 낮은 우선순위) `to-record.spec.ts:105` bracket→dot notation 통일
3. (후속 클러스터 착수 전) `to-record.ts` 모듈 배치 위치 결정 (execution-engine 로컬 vs 공유 레이어)
4. (후속 클러스터 중) 잔류 `as` 단언 25건 각 사이트 특성에 맞게 처리
5. (장기, 기존 부채) `ExecutionEngineService` God Class 점진적 분해 — 이미 계획 중

## 라우터 결정

라우터 선별 실행 (`routing=done`). 실행 8명(security·architecture·requirement·scope·side_effect·maintainability·testing·documentation), 제외 6명(performance·dependency·database·concurrency·api_contract·user_guide_sync — 해당 변경 없음).

_(SUMMARY 는 main 이 workflow 반환 summary_markdown 을 idempotent persist — workflow terminal write=write_blocked.)_
