# 변경 범위(Scope) 리뷰

## 발견사항

### 파일 1: execution-seq-allocator.service.spec.ts

- **[INFO]** `as never` → `as unknown as RedisConnectionProvider` 타입 캐스트 교체
  - 위치: 라인 41, 52, 63, 74, 85, 100, 115 (diff 기준)
  - 상세: 동반 임포트(`import type { RedisConnectionProvider }`) 추가와 함께 기존 unsafe `as never` 패턴을 더 안전한 `as unknown as RedisConnectionProvider`로 교체. 의미상 동일하지만 타입 안전성이 향상됨. 워크트리명 `eia-seq-const-never`의 "never" 부분이 이 수정을 가리키므로 주요 의도 범위 내.
  - 제안: 없음. 범위 적합.

- **[INFO]** 일부 `expect(ttlOf(...)).toBe(...)` 표현식의 포맷팅 변경
  - 위치: `양수 정수 env → 채택`, `NaN/음수/0 env → default 86400`, `미설정 → default 86400` 테스트 케이스
  - 상세: `as never` → `as unknown as RedisConnectionProvider` 교체로 인해 한 줄에 담기 어려워진 중첩 표현식을 여러 줄로 나눔. 기능 변경 없는 포맷팅 재배치이며 캐스트 교체의 자연스러운 연쇄 변경.
  - 제안: 없음. 범위 적합.

### 파일 2: execution-seq-allocator-load.e2e-spec.ts

- **[INFO]** 인라인 매직 넘버 → 모듈 상수 추출 (`WARMUP=20` → `LATENCY_WARMUP_COUNT`, `SAMPLES=200` → `LATENCY_SAMPLE_COUNT`)
  - 위치: 라인 491-494 (새 상수 선언), 라인 506-513 (사용처 치환), 라인 521-522 (로그 문자열 치환)
  - 상세: 기능 변경 없는 리팩토링. 워크트리명의 "const" 부분이 이 상수 추출을 가리키는 것으로 해석되어 주요 의도 범위 내. 다른 모듈 상수(`ALLOC_COUNT`, `NS_PER_MS`, `LOG_PREFIX`, `P95_PERCENTILE`)와 스타일 통일.
  - 제안: 없음. 범위 적합.

### 파일 3: test/system-status.e2e-spec.ts

- **[WARNING]** `EXPECTED_QUEUE_NAMES`에 `'workspace-invitations-pruner'` 추가
  - 위치: 라인 788 (diff 기준)
  - 상세: 이 변경은 `WorkspaceInvitationsPrunerService` 신설 + `MONITORED_QUEUES` 등록(W7 fix)에 대응하는 e2e 갱신이다. 워크트리명 `eia-seq-const-never`이 가리키는 주요 작업(seq allocator `as never` 교체 + 상수 추출)과 도메인이 다르다. `trigger-review-deferred-fixes.md`의 W7 항목 완료에 수반하는 변경으로, 별개 fix의 산출물이 같은 커밋에 혼입된 패턴.
  - 제안: W7 관련 변경(이 파일 + `WorkspaceInvitationsPrunerService` 구현 파일 등)은 별도 커밋/PR로 분리하는 것이 이상적. 단, W7이 이미 완료 표시(`plan/complete/`)된 상황이라면 기능 자체는 완전하며 테스트 정합성 측면의 위험은 없음. **범위 위반이나 결함은 아니고, 커밋 원자성(atomic commit) 원칙상 지적.**

### 파일 4: plan/complete/trigger-review-deferred-fixes.md

- **[INFO]** frontmatter에 `spec_impact` 필드 추가
  - 위치: 라인 5-8 (diff 기준)
  - 상세: W7 fix 완료 시 영향받은 spec 파일들을 frontmatter에 기록. `plan/` 문서는 개발자 쓰기 권한 범위이며, 완료 항목의 영향 spec 추적은 적절한 메타데이터 갱신. 기능 코드 변경 없음.
  - 제안: 없음. 범위 적합.

---

## 요약

4개 파일 중 3개(파일 1·2·4)는 워크트리의 주요 의도(`eia-seq-const-never` — `as never` 캐스트 교체 + 상수 추출)에 부합하거나 plan 문서 갱신으로 타당하다. 파일 3(`system-status.e2e-spec.ts`)의 `workspace-invitations-pruner` 큐 추가는 W7(WorkspaceInvitationsPrunerService) 작업의 e2e 동기화로, 이 워크트리의 seq allocator 수정과 도메인이 다른 변경이 혼입된 것이다. 기능적 결함이나 회귀 위험은 없으나 단일 커밋의 변경 범위 명확성 관점에서 분리가 권장된다.

## 위험도

LOW
