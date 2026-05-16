# 유지보수성(Maintainability) 리뷰

리뷰 대상: consistency-checker 세션 산출물 + spec 변경 (2026-05-16T14:28:20)
분석 파일:
- `review/consistency/2026/05/16/14_28_20/cross_spec/review.md`
- `review/consistency/2026/05/16/14_28_20/meta.json`
- `review/consistency/2026/05/16/14_28_20/naming_collision/review.md`
- `review/consistency/2026/05/16/14_28_20/plan_coherence/review.md`
- `review/consistency/2026/05/16/14_28_20/rationale_continuity/review.md`
- `spec/1-data-model.md` (§2.10 Integration 필드 변경)
- `spec/2-navigation/4-integration.md` (Attention 칩·배너·API 설명 변경)

---

## 발견사항

### 1. 가독성 / 중복 코드

- **[WARNING]** `plan_coherence/review.md` 의 마크다운 구조가 다른 review 파일과 불일치 — H2/H3 헤딩이 누락됨
  - 위치: `review/consistency/2026/05/16/14_28_20/plan_coherence/review.md` 전체
  - 상세: 프로젝트 내 일관성 검토 산출물은 `## 발견사항`, `## 요약`, `## 위험도` 의 H2 헤딩 구조를 사용한다. 그러나 `plan_coherence/review.md` 는 이 H2 헤딩을 사용하지 않고 `### 발견사항`, `### 요약`, `### 위험도` (H3) 를 바로 사용한다. 나머지 세 review 파일(`cross_spec`, `naming_collision`, `rationale_continuity`)은 모두 H2 구조를 따른다. 리뷰 파일 집합을 자동으로 파싱하거나 SUMMARY.md 로 집계할 때 헤딩 레벨 불일치가 파싱 로직 오류를 유발할 수 있다.
  - 제안: `plan_coherence/review.md` 의 `### 발견사항`, `### 요약`, `### 위험도` 를 `## 발견사항`, `## 요약`, `## 위험도` 로 승격한다. 다른 review 파일의 헤딩 레벨 규약을 표준으로 삼고, 향후 orchestrator 가 새 review 파일을 생성할 때 헤딩 레벨을 강제한다.

- **[INFO]** `cross_spec/review.md` 와 `naming_collision/review.md` 에서 전체 발견사항 본문이 diff 섹션과 전체 파일 컨텍스트 섹션에 완전히 중복 수록됨
  - 위치: prompt_file 내 "변경된 코드"와 "전체 파일 컨텍스트" 양쪽
  - 상세: orchestrator 가 신규 파일임에도 diff 와 전체 파일 컨텍스트를 둘 다 기재했다. 신규 파일의 경우 diff 자체가 전체 내용이므로 두 블록이 100% 동일하다. 이로 인해 prompt_file 의 크기가 불필요하게 배증된다.
  - 제안: 신규 파일(`new file mode`)의 경우 orchestrator 가 "전체 파일 컨텍스트" 섹션을 생략하거나 `(신규 파일 — diff 와 동일)` 한 줄로 대체한다.

---

### 2. 네이밍

- **[WARNING]** `CAFE24_PRIVATE_APP_ALREADY_CONNECTED` 에러 코드 — Public 흐름에 재사용 시 이름과 의미 불일치
  - 위치: `naming_collision/review.md` 발견 2 / `backend/src/modules/integrations/integration-oauth.service.ts:1068` / `integrations.controller.ts:170`
  - 상세: `PRIVATE` 을 포함한 에러 코드를 Public 흐름(`app_type='public'`)에도 반환하면, API 클라이언트가 코드 이름만 보고 "Private 전용 오류"로 오인하여 Public 경로의 409 처리를 누락할 수 있다. naming_collision 검토에서도 동일 지적을 했으나, 유지보수성 관점에서 코드 이름이 의미를 정확히 반영하지 않으면 장기적으로 디버깅·문서화 비용이 증가한다.
  - 제안: `CAFE24_MALL_ALREADY_CONNECTED` 로 rename 하여 `PRIVATE` 한정 의미를 제거한다. backend·spec·Swagger doc·프론트엔드 토스트 메시지 키를 일괄 갱신한다.

- **[WARNING]** `findExistingConnectedCafe24Mall` helper 이름 — 실제 조회 범위보다 좁은 이름
  - 위치: `naming_collision/review.md` 발견 3 / `integration-oauth.service.ts` (계획 중인 신규 메서드)
  - 상세: 이름이 `connected` 상태만 조회한다는 뜻을 내포하지만 `spec-update-cafe24-public-dup-guard.md` 에 따르면 `pending_install`/`expired`/`error` 도 V045 backstop 이 다룬다. 구현자가 이름을 보고 "이 helper 로 전체 중복 방어가 됐다"고 오해할 여지가 있다.
  - 제안: `findConnectedCafe24MallIntegration` 으로 `connected` 전용임을 명확히 유지하거나, 범용이라면 `findAnyCafe24MallIntegration` 으로 이름을 바꾼다. 어느 쪽이든 caller 위치에 "이 helper 는 connected 만 감지하며 나머지 status 는 별도 조회가 필요하다"는 주석을 남긴다.

---

### 3. 함수 길이 / 코드 복잡도

- **[INFO]** `spec/2-navigation/4-integration.md` §2.4 배너 조건 — 단순화로 인한 암묵적 복잡도 이동
  - 위치: `spec/2-navigation/4-integration.md` §2.4 (line 기준 diff -8줄 → +3줄)
  - 상세: 기존 spec 의 배너 포함 조건은 `status='connected' AND token_expires_at IS NOT NULL AND token_expires_at > NOW() AND token_expires_at <= NOW() + INTERVAL '7d'` 로 방어 조건 4개가 명시적으로 기술되어 있었다. 이번 변경으로 `token_expires_at <= now() + 7d` 한 줄로 단순화됐다. spec 이 짧아졌지만, 방어 조건(status 가드, IS NOT NULL, `> NOW()` 역전 방지)의 책임이 구현 코드로 암묵적으로 이동한다. `cross_spec/review.md` 발견사항 3에서도 지적한 바와 같이 이중 카운트 가능성이 실재한다. spec 을 읽고 구현하는 개발자가 방어 조건을 독립적으로 추론해야 하므로 유지보수 비용이 올라간다.
  - 제안: spec 에 "단순화된 표현이지만 구현 시 `status NOT IN (expired, error, pending_install)` 가드를 반드시 추가하라"는 주석이나 각주를 남긴다. 또는 기존처럼 완전한 SQL 조건을 spec 에 명시해 구현 책임을 줄인다.

---

### 4. 매직 넘버

- **[WARNING]** `token_expires_at <= now() + 7d` — "7d" 가 배너 조건(§2.4), UI 배지 조건(§11.4), 상태 칩 라벨("Expiring (7일 이내)")에 분산
  - 위치: `spec/2-navigation/4-integration.md` §2.3 칩 라벨 / §2.4 배너 조건 / §11.4 UI 배지 조건
  - 상세: "만료 임박"의 기준값인 `7d(7일)` 이 동일 spec 파일의 3개 섹션에 하드코딩되어 있다. 추후 이 임계값을 변경할 때(예: 14일로 확대) 세 곳을 모두 찾아 수정해야 하며, 하나라도 누락되면 동작이 불일치해진다. 현재 `spec/1-data-model.md` 의 `token_expires_at` 설명에도 Notification 발사 정책(§2.19)에 "7d/3d/0d 임계"가 별도로 언급된다.
  - 제안: spec 의 도입부(§1 또는 별도 상수 섹션)에 `EXPIRING_THRESHOLD = 7 일` 을 한 번 정의하고, 나머지 섹션에서는 이 상수명을 참조하도록 기술한다. 구현 코드에서도 같은 값을 상수(`EXPIRING_THRESHOLD_DAYS = 7`)로 한 곳에서만 정의하도록 유도한다.

---

### 5. 중복 코드

- **[WARNING]** 배너 조건(§2.4)과 UI 배지 조건(§11.4)이 사실상 동일한 술어인데 별도로 기술되어 동기화 부담 존재
  - 위치: `spec/2-navigation/4-integration.md` §2.4 vs §11.4
  - 상세: 이번 변경 이전 spec 은 §2.4 배너와 §11.4 배지가 동일 술어임을 "§9.1 `?status=attention` 가상 필터값과 동일한 술어"라는 교차 참조로 명시했다. 변경 후 §2.4 는 `status IN (expired, error) OR token_expires_at <= now() + 7d`, §11.4 는 `status IN (expired, error) OR (token_expires_at <= now() + 7d)` 로 각각 기술되어 있다. 텍스트로 중복 기술된 것이라, 장래에 §2.4 만 수정하고 §11.4 를 누락할 경우 조용한 불일치가 발생한다.
  - 제안: 단일 조건을 spec 의 한 곳(예: §11.4 또는 별도 §Constants 섹션)에 정의하고, §2.4 는 "§11.4 와 동일한 술어"라는 교차 참조로 대체한다. 구현 레벨에서도 동일 함수/상수를 두 곳에서 재사용하도록 패턴을 spec 이 안내한다.

---

### 6. 가독성 — spec 삭제로 인한 맥락 손실

- **[WARNING]** `spec/2-navigation/4-integration.md` §2.3 상태 칩 설명 — 가상 필터값 설명 전체 삭제로 구현자가 `expiring` 처리 방법을 알 수 없음
  - 위치: `spec/2-navigation/4-integration.md` §2.3 diff -5줄 (가상 필터값 설명 삭제)
  - 상세: 기존 spec 은 "`expiring` 과 `attention` 두 값은 DB Enum 에는 없는 가상 필터값이며, 백엔드 쿼리 빌더가 §9.1 의 `status` 파라미터를 받아 합집합 WHERE 절로 변환한다"고 명시했다. 이번 변경으로 이 문단 전체가 삭제됐다. 그런데 §2.3 의 상태 칩 목록에는 `Expiring` 칩이 여전히 남아 있어, 구현자는 `Expiring` 칩이 어떤 쿼리를 발행하는지, 백엔드가 어떻게 처리하는지를 spec 에서 확인할 수 없다. `cross_spec/review.md` 발견사항 4에서도 `expiring` 가상 필터값 변환 규칙 삭제를 WARNING 으로 지적했다.
  - 제안: §9.1 에 `expiring` 가상 필터값 변환 규칙을 복원(`status='connected' AND token_expires_at within 7d`)하거나, §2.3 칩 목록 근처에 `Expiring 칩이 발행하는 쿼리 값과 백엔드 변환 규칙`을 최소한으로 기술한다.

- **[WARNING]** `spec/2-navigation/4-integration.md` §9.1 GET `/api/integrations` — `status` 파라미터 허용값 전체 삭제
  - 위치: `spec/2-navigation/4-integration.md` §9.1 API 표 (diff -3줄 상세 설명 → +1줄 요약)
  - 상세: 기존 API 설명은 `status` 쿼리 파라미터의 허용값(`connected`/`expiring`/`expired`/`error`/`attention`)과 가상 필터값 변환 규칙을 구체적으로 기술했다. 이번 변경에서 해당 설명이 삭제되어 "페이지네이션 응답 형식은 API 규약 §5.2 준수" 한 줄만 남았다. 백엔드 구현자는 `status` 파라미터를 어떻게 처리해야 할지 spec 에서 알 수 없다.
  - 제안: 적어도 "status 허용값과 가상 필터값 변환 규칙은 §2.3 상태 칩 및 §11.4 참조"라는 교차 참조를 남기거나, 허용값 목록을 API 표의 한 줄로 기술한다.

- **[WARNING]** `spec/2-navigation/4-integration.md` §9.1 GET `/api/integrations/:id` — `IntegrationDto.appUrl` 필드 설명 삭제
  - 위치: `spec/2-navigation/4-integration.md` §9.1 API 표 두 번째 행 (diff: 상세 설명 → "상세 조회 (credentials는 마스킹)")
  - 상세: 기존 spec 은 `IntegrationDto` 에 `appUrl: string | null` 필드가 포함되고, Cafe24 Private 통합의 경우 App URL path 를 반환한다는 것을 명시했다. 이번 변경으로 응답 형식 설명이 "credentials 는 마스킹" 한 마디로 축소됐다. 그러나 프론트엔드 테스트(`scope-tab.test.tsx`)는 여전히 `appUrl` 필드를 전제로 작성되어 있다(`cross_spec/review.md` 발견사항 2). 구현자가 spec 과 기존 코드를 함께 보면 서로 모순되는 상황이며, 어느 쪽을 따라야 할지 판단 근거가 없다.
  - 제안: `appUrl` 필드를 spec 에 복원하거나, 제거 결정이 확정이면 해당 사실("appUrl 필드 제거 결정 및 이유")을 Rationale 에 기록하고 "프론트엔드 테스트 코드 갱신 필요"를 TODO 로 명시한다.

---

### 7. 일관성

- **[INFO]** `spec/1-data-model.md` §2.10 `install_token` / `install_token_issued_at` — 필드 설명이 callback 성공 시 동작에서 불일치
  - 위치: `spec/1-data-model.md` §2.10 두 필드 (diff: 각 1행씩 변경)
  - 상세: `install_token` 설명이 "callback 성공 또는 TTL 만료 시 NULL"로 단순화됐다. `install_token_issued_at` 설명은 "재사용/새 발급 시 갱신, callback 성공 시 NULL"로 변경됐다. 그런데 기존 spec(main)은 `install_token` 에 대해 "callback 성공 시 보존 (post-install navigation 의 식별 키) — callback 성공 시 보존, TTL 만료 또는 통합 삭제 시에만 NULL"이라고 했고, `install_token_issued_at` 에 대해서도 "callback 성공 시 보존 (`install_token` 과 동행)"을 명시했었다. 변경 후 두 필드가 callback 성공 시 서로 다른 동작(token은 NULL, issued_at도 NULL)을 갖는데, 이것이 의도적 변경인지 기존 동작 유지인지 spec 에서 읽기 어렵다. 또한 두 필드의 생명주기가 "함께 NULL"이 된다면 한 필드 설명에서 다른 필드를 교차 참조했던 "동행" 표현이 삭제되어 독자가 연관 관계를 파악하기 어렵다.
  - 제안: 두 필드가 callback 성공 시 동시에 NULL 이 되는지, 아니면 `install_token` 만 NULL 이 되고 `issued_at` 은 보존되는지를 spec 에 명확히 기술한다. 의도적 변경이라면 Rationale 에 "callback 성공 시 install_token 및 issued_at 을 NULL 로 정리하는 이유" 항을 추가한다.

- **[INFO]** `rationale_continuity/review.md` — orchestrator 가 target 문서 내용을 "(없음)"으로 전달한 버그 기록
  - 위치: `rationale_continuity/review.md` 발견사항 2
  - 상세: orchestrator 의 파일 수집 로직에 버그가 있어 `spec/2-navigation/4-integration.md` 의 내용이 prompt_file 에 "(없음)"으로 기재됐다. 해당 checker 는 파일을 직접 Read 해 분석을 보완했으나, 이는 일관된 입력 경로를 벗어난 것이다. 다른 checker 에서 같은 버그가 발생하면 분석 누락이 발생할 수 있다.
  - 제안: orchestrator 의 파일 수집 단계에서 파일 존재 여부 + 내용 존재 여부를 검증하고, 빈 결과가 반환되면 에러를 발생시켜 세션을 중단하거나 경고를 남긴다. reviewer 가 입력 누락을 자력으로 보완하는 것은 재현 불가능한 분석 패턴이다.

---

## 요약

이번 변경의 유지보수성 관점 핵심 문제는 **설명 삭제로 인한 맥락 손실**과 **불완전한 단순화로 인한 암묵적 책임 이전**이다. `spec/2-navigation/4-integration.md` 의 §2.3 가상 필터값 설명, §2.4 배너 방어 조건, §9.1 `status` 파라미터 허용값, §9.1 `appUrl` 응답 필드 설명이 모두 삭제됐으나 해당 기능의 구현체(칩, 쿼리, DTO)가 코드베이스에 그대로 남아있다. spec 을 보고 구현에 착수하는 개발자는 `Expiring` 칩이 어떤 쿼리를 발행하는지, 배너 조건에 status 가드가 필요한지, 응답 DTO 에 `appUrl` 필드가 있는지 없는지를 spec 만으로는 판단할 수 없다. 또한 `7d` 임계값이 3개 섹션에 분산 하드코딩되어 있고, 배너·배지 조건이 중복 기술되어 있어 향후 변경 시 누락 위험이 있다. review 파일 간 헤딩 레벨 불일치와 orchestrator 의 target 문서 수집 버그는 리뷰 프로세스 자체의 재현성을 저하시킨다.

---

## 위험도

MEDIUM
