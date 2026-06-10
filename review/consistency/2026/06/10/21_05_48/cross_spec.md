# Cross-Spec 일관성 검토 결과

**검토 모드**: 구현 완료 후 검토 (--impl-done, scope=perf 백로그 01 최종 상태 재검증)
**diff 기준**: origin/main

---

## 발견사항

### 데이터 모델 충돌

발견 없음.

---

### API 계약 충돌

발견 없음.

---

### 요구사항 ID 충돌

발견 없음.

---

### 상태 전이 충돌

발견 없음.

---

### 권한·RBAC 모델 충돌

발견 없음.

---

### 계층 책임 충돌

- **[INFO]** `PARALLEL_ENGINE` env 읽기 시점: lazy 인스턴스 캐시 vs spec "모듈 로드 시 1회"
  - target 위치: `execution-engine.service.ts` `resolveParallelEngineFlag()` — `parallelEngineFlagOnce ??=` lazy 초기화 (첫 호출 시점)
  - 충돌 대상: `spec/4-nodes/1-logic/10-parallel.md` L14 — "본 env 는 모듈 로드 시 1회 읽음, 변경은 인스턴스 재시작 시 반영"
  - 상세: spec 은 "모듈 로드 시 1회" 라고 표현하고 있으나 구현은 첫 `resolve*` 호출 시점에 lazy 초기화한다. 계약의 본질("인스턴스 수명 동안 불변, 재시작 시 반영")은 동일하고 unit test 에서도 안전한 lazy 방식이 spec 의 의도와 기능 동등하다. 명칭 차이만 존재.
  - 제안: spec/4-nodes/1-logic/10-parallel.md L14 의 "모듈 로드 시 1회"를 "인스턴스 수명 동안 1회 읽음 (lazy 초기화 — 인스턴스 재시작 시 반영)" 으로 동기화하면 drift 제거 가능. 코드 변경 불필요.

- **[INFO]** `spec/3-workflow-editor/4-ai-assistant.md §5` 의 prefix cache 설계 의도와 `nodeCatalogCache` WeakMap 구현의 관계가 spec 본문에 미기재
  - target 위치: `system-prompt.ts` `nodeCatalogCache` WeakMap + `resetNodeCatalogCacheForTesting`
  - 충돌 대상: `spec/3-workflow-editor/4-ai-assistant.md` L843, L855 — "정적 콘텐츠를 앞에 두고 동적 상태를 뒤로 보내 provider prefix cache hit rate 를 높이는 게 설계 의도"
  - 상세: spec 은 provider-side prefix cache(Anthropic/OpenAI 서버의 프롬프트 캐시)를 위해 정적 블록을 앞에 배치하는 설계 의도를 기술하고 있다. 구현의 `nodeCatalogCache` 는 서버 내부 직렬화 중복을 제거하는 in-process 캐시로 다른 레이어다. 모순은 아니나 spec 에 언급이 없어 동일 목적의 표현으로 오해될 수 있다.
  - 제안: spec 본문에 "노드 카탈로그 직렬화는 배열 reference 불변을 전제로 in-process WeakMap 캐시를 사용한다" 한 줄 추가하면 완전 동기화. 낮은 우선순위.

---

## 요약

이번 변경(perf 백로그 01 최종 상태)은 런타임 동작 무변경을 전제로 한 순수 성능 최적화 + 테스트/주석 커밋이다. 주요 변경 영역인 S3 `deleteMany`(`data-flow/4-file-storage.md` — 배치 삭제·best-effort 의미론 완전 일치), Dashboard 집계 쿼리(`2-navigation/0-dashboard.md` — `DashboardSummary` 필드 shape 과 `successRate` 분모 의미론 일치), rehydration 배치 조회(실행 엔진 spec §7.5 `rehydrateContext` 의미론 보존), `importWorkflow` 배치 insert(`Node`/`Edge` hook·cascade 부재 전제 spec 미규정이나 코드 주석으로 명시), frontend `selectSortedNodeResults` accessor 패턴(spec 에 정렬 규약이 별도 없으므로 충돌 없음) 모두 기존 spec 과 일치하거나 spec 이 명시하는 의미론을 보존한다. CRITICAL 또는 WARNING 등급의 충돌은 없으며, 발견된 두 건의 INFO 항목은 spec 텍스트의 명칭 동기화 수준의 개선 사항이다.

---

## 위험도

NONE
