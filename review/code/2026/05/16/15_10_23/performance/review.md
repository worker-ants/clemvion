# 성능(Performance) 코드 리뷰

리뷰 대상 worktree: `cafe24-mall-dup-ux-a7f2c8`
리뷰 시각: 2026-05-16

---

## 발견사항

### 발견사항 1
- **[WARNING]** `§2.4 배너 포함 조건` — 방어 가드 제거로 인한 이중 카운트 및 불필요한 인덱스 스캔 확대
  - 위치: `spec/2-navigation/4-integration.md` §2.4 / §11.4 배너·배지 조건 변경
  - 상세: 변경 전 조건은 `status='connected' AND token_expires_at IS NOT NULL AND token_expires_at > NOW() AND token_expires_at <= NOW() + INTERVAL '7d'` 이었다. 변경 후 조건은 `token_expires_at <= now() + 7d` 로 단순화되어, (a) `status IN (expired, error)` 인 행이 `token_expires_at <= now()` 조건도 동시에 만족하여 "만료 임박" 집합에도 중복 포함되고, (b) `status='pending_install'` 인 행도 `token_expires_at` 값이 있을 경우 필터를 통과한다. 또한 `token_expires_at IS NOT NULL` 가드가 없어지면 NULL 비교가 DB 내부적으로 FALSE 처리되긴 하지만, 인덱스 `(token_expires_at)` 을 사용하는 스캐너 배치 쿼리 플래너가 NULL 행을 range scan 범위에서 명시적으로 제외하지 못해 불필요한 페이지 I/O가 발생할 수 있다. §11.4 배지 카운트 쿼리도 동일 조건을 공유하므로 모든 Integration 목록 페이지 로드 시 사이드바 배지 카운트 쿼리에서 이 비용이 반복된다.
  - 제안: `token_expires_at <= now() + 7d` 조건에 `AND status='connected' AND token_expires_at IS NOT NULL AND token_expires_at > NOW()` 가드를 추가하여 원래 수준으로 복원한다. §2.4 와 §11.4 를 동일 술어로 유지해 두 쿼리 경로가 같은 인덱스 플랜을 공유하도록 한다. 부분 인덱스 `(token_expires_at) WHERE status='connected' AND token_expires_at IS NOT NULL` 를 별도 스캐너 전용으로 두면 배지 카운트 쿼리 비용을 추가로 절감할 수 있다.

---

### 발견사항 2
- **[WARNING]** `§11.4 UI 배지 카운트` — 별도 카운트 API 없이 현재 페이지 rows 기반 계산과 배지 카운트 간 불일치
  - 위치: `spec/2-navigation/4-integration.md` §2.4 "집계 범위 — 현재 페이지 한정" (변경 전 텍스트) vs §11.4 배지 카운트 (spec 변경)
  - 상세: 변경 전 spec §2.4 는 "배너의 합계·분해 카운트는 **현재 페이지의 rows 만** 보고 계산한다 (별도 카운트 API 를 호출하지 않음)"을 명시했다. §11.4 의 사이드바 배지는 전체 카운트 API(`/api/integrations` 에서 카운트를 추출하거나 별도 `/api/integrations/count` 엔드포인트)를 통해 정확한 수치를 보고하는 구조였다. 변경 후 spec 이 배너 클릭 동작 정의를 단순화하면서 §2.4 의 "현재 페이지 한정" 명세가 제거된 상태이고, §11.4 배지 카운트 쿼리에 잘못 단순화된 술어만 남았다. 만약 프론트엔드가 두 카운트를 동일 로직으로 처리하면 배너(페이지 한정)와 배지(전체)가 달라지는 UI 불일치가 나타나고, 반대로 두 카운트 모두 전체 테이블 스캔 방식으로 통일하면 목록 페이지 로드 시마다 추가 전체 스캔이 발생한다.
  - 제안: §2.4 와 §11.4 의 카운트 주체(페이지 한정 vs 전체)를 명시적으로 분리한다. 전체 카운트가 필요하다면 `Integration` 테이블의 `(workspace_id, status)` 인덱스를 활용하는 집계 전용 쿼리를 별도로 두고 캐싱(e.g., Redis TTL 30~60초) 하는 방향을 검토한다. 배너는 현재 페이지 rows 에서 계산해 N+1 전체 스캔을 방지한다.

---

### 발견사항 3
- **[WARNING]** `GET /api/integrations/cafe24/precheck` — NestJS 라우트 매칭 순서 오류 시 ParseUUIDPipe 연산 낭비
  - 위치: `review/consistency/2026/05/16/14_28_20/naming_collision/review.md` 발견 1, `spec-update-cafe24-public-dup-guard.md` §9.2 신규 엔드포인트
  - 상세: NestJS 컨트롤러가 `@Get(':id')` 보다 `@Get('cafe24/precheck')` 를 나중에 선언하면 `cafe24` 가 UUID 파싱 파이프(`ParseUUIDPipe`)를 통과하게 되어 400 에러가 발생한다. 에러 자체의 성능 문제 외에도, UUID 파싱 실패 경로는 파이프 인스턴스 생성 → UUID 정규식 검사 → 예외 객체 생성 → 필터 체인 실행의 순서를 거치며 불필요한 연산을 반복한다. 또한 path segment 가 `cafe24/precheck` 2개이므로 `@Get(':id/usages')` 패턴과도 충돌할 수 있어, 잘못 배치된 경우 `@Get(':id/usages')` 핸들러가 실수로 호출될 위험이 있다.
  - 제안: `@Get('cafe24/precheck')` 를 컨트롤러 선언 순서에서 `@Get('services')` 바로 아래, `@Get(':id')` 와 `@Get(':id/usages')`, `@Get(':id/activity')` 보다 앞에 위치시킨다. `ParseUUIDPipe` 는 이 라우트에 적용하지 않는다. integration 테스트에서 실제 라우팅이 올바른 핸들러로 매칭되는지 검증하는 케이스를 추가한다.

---

### 발견사항 4
- **[WARNING]** `mall_id` 중복 체크 helper — `findExistingConnectedCafe24Mall` 의 제한적 범위와 precheck 엔드포인트 전체 스캔 이중성
  - 위치: `review/consistency/2026/05/16/14_28_20/naming_collision/review.md` 발견 3, `cafe24-mall-dup-ux.md` §Backend (1)
  - 상세: `findExistingConnectedCafe24Mall(workspaceId, mallId)` helper 는 `status='connected'` row 만 조회하도록 설계되어 있다. 그런데 `GET /api/integrations/cafe24/precheck` 엔드포인트는 중복 감지 UX를 위해 `pending_install` / `expired` / `error` 포함 전체 상태를 반환해야 한다. 이는 precheck 호출 시 helper 로 한 번 조회하고, 나머지 상태를 위해 추가로 별도 조회를 해야 하는 2회 DB 쿼리 구조로 이어진다. `(workspace_id, mall_id)` 부분 UNIQUE 인덱스(`WHERE service_type='cafe24' AND mall_id IS NOT NULL`)는 이미 존재하므로 단일 조회로 전체 상태를 가져오고 caller 측에서 필터링하는 방식이 더 효율적이다.
  - 제안: helper 를 `findAnyCafe24MallIntegration(workspaceId, mallId)` 로 범용화하여 단일 쿼리로 전체 상태를 반환하고, begin 가드에서는 `status='connected'` 여부를 caller 가 필터링한다. 기존 UNIQUE 인덱스를 활용하면 O(1) lookup 이 보장된다. precheck 엔드포인트와 begin 가드 양쪽에서 동일 helper 를 재사용해 DB 왕복을 1회로 줄인다.

---

### 발견사항 5
- **[INFO]** `spec/data-flow/5-integration.md` — `install_token=NULL` 로 변경된 callback 성공 경로와 스캐너 성능 영향
  - 위치: `spec/data-flow/5-integration.md` line 87–90 (callback 성공 시 UPDATE 명세 변경)
  - 상세: 변경 전 spec 은 callback 성공 시 `install_token` 과 `install_token_issued_at` 을 **보존**하여 post-install navigation 식별 키로 활용했다. 변경 후 data-flow spec 은 `install_token=NULL` 로 업데이트한다. 이 변경이 `(install_token) WHERE install_token IS NOT NULL` 부분 인덱스의 크기와 스캐너 쿼리 성능에 직접 영향을 준다. callback 성공 후 즉시 NULL 처리하면 인덱스에서 해당 row 가 제거되어 인덱스 크기가 줄고, `pending_install` TTL 스캐너(`WHERE install_token IS NOT NULL` 조건으로 동작)가 더 적은 row 를 스캔한다. 이는 성능상 긍정적이나, 변경 전 spec(`spec/2-navigation/4-integration.md`)의 `install_token` 라이프사이클 기술(`callback 성공 시 보존`)과 data-flow spec 이 현재 불일치 상태다. 두 spec 이 서로 다른 동작을 기술하면 구현이 어느 쪽을 따르는지 불명확하여 잘못된 구현 시 인덱스 누락 또는 스캐너 오동작이 발생할 수 있다.
  - 제안: `spec/1-data-model.md` §2.10 의 `install_token_issued_at` 설명에서 "callback 성공 시 NULL"로 기술된 내용과 `spec/2-navigation/4-integration.md` 의 기술을 정합시킨다. 어느 쪽이 최신 결정인지 확인 후 Rationale 에 명시적으로 기록한다. `(install_token) WHERE install_token IS NOT NULL` 부분 인덱스 동작과의 정합성도 spec 에 한 줄 언급을 추가한다.

---

### 발견사항 6
- **[INFO]** `spec/1-data-model.md` §2.10 — `install_token` 필드 설명 단순화로 TTL 스캐너 쿼리 최적화 근거 소실
  - 위치: `spec/1-data-model.md` §2.10 Integration 테이블 `install_token` / `install_token_issued_at` 필드 설명 (diff 적용 후)
  - 상세: 변경 전 `install_token` 설명에는 "통합 lifetime 동안 보존 (post-install navigation 의 식별 키) — callback 성공 시 보존, `pending_install → expired (install_timeout)` 24h TTL 만료 또는 통합 삭제 시에만 NULL/소거"라는 TTL 스캐너의 쿼리 최적화 근거가 포함되어 있었다. 변경 후 설명은 "callback 성공 또는 TTL 만료 시 NULL"로 단순화되어 스캐너가 `WHERE install_token IS NOT NULL` 조건을 사용해 `connected` 상태 행을 자동 제외할 수 있다는 부분 인덱스 활용 근거가 명시적으로 제거됐다. 이 정보가 없으면 향후 스캐너 쿼리를 작성하는 개발자가 `status='pending_install'` 조건 없이 전체 테이블 스캔으로 작성할 가능성이 있다.
  - 제안: `install_token_issued_at` 필드 설명 또는 §3 인덱스 전략의 `(install_token) WHERE install_token IS NOT NULL` 항목에 "callback 성공 후 NULL 처리되므로 `pending_install` TTL 스캐너는 이 인덱스만으로 `connected` 행을 자동 제외 가능"이라는 설명을 추가한다.

---

### 발견사항 7
- **[INFO]** `spec/4-nodes/4-integration/4-cafe24.md` §9.9 — 편집 버퍼 재동기화 시 불필요한 렌더 사이클
  - 위치: `spec/4-nodes/4-integration/4-cafe24.md` §2 설정 UI "편집 버퍼" 설명, §9.9 내부 버퍼 분리 Rationale
  - 상세: spec §2 설명에서 "외부에서 `config.fields` 가 다른 reference 로 바뀌면 (undo/redo, 프로그래밍적 reset) 다음 렌더에서 버퍼를 재동기화한다"라고 기술하고 있다. `Array<{key, value}>` 형태의 편집 버퍼를 React state 로 유지하는 구조에서 외부 reference 변경을 감지하기 위해 `useEffect` 또는 `useMemo` 를 활용하는데, 이 과정에서 config.fields 의 object reference 비교(`===`)가 매 렌더마다 수행된다. Operation 변경 시 교집합 키 보존 로직에서 `Object.keys()` 비교가 추가로 발생하며, fields 수가 많을수록(18 카테고리 × 평균 10 operation × N 필드) 비교 비용이 선형 증가한다. 현재 spec 에 이 동기화 비용을 줄이는 전략(예: 버퍼 버전 카운터, 메모이제이션 기준 명세)이 기술되어 있지 않다.
  - 제안: §9.9 에 "외부 reset 감지 기준으로 `config.fields` object reference 비교 외에 버전 카운터(`configVersion: number`)를 사용하는 방안"을 Rationale 대안으로 추가 기재한다. Operation 변경 시 교집합 키 보존 로직은 `Set` 자료구조를 사용해 O(N) lookup 에서 O(1) 교집합 판별로 최적화할 수 있음을 구현 가이드로 명시한다.

---

## 요약

이번 변경 셋(`cafe24-mall-dup-ux-a7f2c8` worktree)은 spec 문서와 리뷰 산출물을 대상으로 하여 실행 코드 자체는 포함되지 않는다. 성능 관점에서 가장 주목할 사항은 **§2.4 배너 조건 단순화**로, `status='connected'` 가드와 `token_expires_at IS NOT NULL` 가드가 제거되어 배너·배지 쿼리에서 이중 카운트와 불필요한 인덱스 스캔 확대가 발생할 수 있다(WARNING 1). 사이드바 배지 카운트가 전체 Integration 테이블을 대상으로 목록 페이지 로드마다 실행되는 구조에서 이 조건 완화는 누적 I/O 비용으로 이어진다. `GET /api/integrations/cafe24/precheck` 신규 엔드포인트는 NestJS 라우트 선언 순서를 잘못 배치하면 `ParseUUIDPipe` 의 불필요한 연산이 반복 실행되는 문제를 내포한다(WARNING 3). `mall_id` 중복 감지 helper 가 `connected` 상태만 조회하도록 설계되어 precheck 에서 이중 DB 쿼리가 발생하는 구조도 개선 여지가 있다(WARNING 4). `install_token` 라이프사이클 기술의 spec 간 불일치는 TTL 스캐너 부분 인덱스 활용을 위협하는 간접 성능 위험으로 분류했다(INFO 5, 6). 전반적으로 CRITICAL 수준의 성능 위험은 없으나, 배너·배지 쿼리 조건 정합이 구현 착수 전 확정되어야 중복 I/O를 방지할 수 있다.

---

## 위험도

MEDIUM
