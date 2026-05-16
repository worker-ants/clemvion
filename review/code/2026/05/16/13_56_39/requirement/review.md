# Requirement Review — Integration "Attention" Filter

분석 대상: `integration-attention-filter-053b74` worktree (12개 파일 diff)

---

## 발견사항

### [WARNING] 프론트엔드 "expiring" 판단 기준과 백엔드 SQL 조건의 경계값 미묘한 차이
- **위치**: `frontend/src/app/(main)/integrations/_shared/status-badge.tsx` L81 vs `backend/src/modules/integrations/integrations.service.ts` L195-198, L211-213
- **상세**: 프론트엔드 `isExpiringSoon(at)`은 `ms > 0 && ms <= 7 * 24 * 60 * 60 * 1000`으로 "정확히 7일 이내"를 체크한다. 백엔드 `expiring` 단일 필터도 `token_expires_at > NOW()` AND `<= NOW() + INTERVAL '7 days'`로 동일하다. 그런데 `attention` 가상 필터 SQL은 같은 조건(`AND i.token_expires_at > NOW() AND i.token_expires_at <= NOW() + INTERVAL '7 days'`)을 사용하므로 이론상 일치한다. 그러나 프론트엔드 `needsAttention`은 **현재 페이지에 이미 로드된 rows**에 대해서만 계산하고, 실제 DB에는 `?status=attention` 서버 필터를 별도로 전송한다. 즉, "attention 배너 카운트"(클라이언트 계산)와 "attention 필터 결과 목록"(서버 계산)이 두 경로로 나뉜다. 페이지가 부분 로드(pagination)된 상태에서 attention 배너를 클릭하면, 배너가 보여주는 count(현재 페이지 rows 기준)와 필터 결과 total이 다를 수 있다. 이는 UX 혼란의 원인이 될 수 있다.
- **제안**: 배너의 count를 별도 API 집계 엔드포인트나 `?status=attention` 응답의 `pagination.totalItems`로 표시하는 방식을 spec에서 명시하거나, 현재 접근법(현재 페이지 rows 기준)을 spec §2.4에 명시적으로 문서화하여 의도된 동작임을 드러낼 것.

### [WARNING] "1개 행일 때 detail 점프" 판정이 클라이언트 현재 페이지 rows 기준
- **위치**: `frontend/src/app/(main)/integrations/page.tsx` L554-559
- **상세**: `attention.total === 1 && attention.mostUrgentId`를 조건으로 detail 페이지로 직접 점프하는데, 이 `total`은 `computeAttentionBreakdown(integrations)` 즉 현재 페이지에 로드된 rows만을 본다. DB 전체에 attention 대상이 1개인지 여부는 서버에만 알려져 있다. 예를 들어 현재 페이지에 1개만 보이더라도 다른 페이지에 더 있을 수 있으며, 그 경우에도 detail 점프가 발생한다. 반대로, 전체 DB에 1개뿐이지만 페이지에 안 보이면 배너 자체가 숨겨진다.
- **제안**: 비즈니스 규칙 "DB 전체 attention 이 정확히 1개일 때만 detail 점프"가 의도라면 서버에서 totalItems를 받아 판정해야 한다. 현재 "현재 페이지 rows 1개일 때 점프"가 의도된 동작이라면 spec §2.4에 명시할 것. 테스트(`integrations-page.test.tsx`)는 `totalItems: 1`로 작성되어 있어 사실상 양쪽 모두를 커버하지만, 실제 코드는 페이지 rows만 본다는 점에서 테스트 픽스처가 혼선을 유발한다.

### [INFO] `needsAttention`의 암묵적 기본값 — "expired" 상태 외 미분류 status 처리
- **위치**: `frontend/src/app/(main)/integrations/_shared/status-badge.tsx` L89-93
- **상세**: `needsAttention`은 `connected` → `isExpiringSoon`, `pending_install` → false, 그 외 → `true`로 처리한다. 현재 DB 상태 enum이 `connected/expired/error/pending_install`이라 실질적 문제는 없으나, 향후 새로운 status 값이 추가되면 자동으로 attention 대상이 된다. `computeAttentionBreakdown`은 이 값들을 `expiring` 카운터가 아닌 별도 처리 없이 else 브랜치(`expiring += 1`)로 집계하므로 잘못된 분류가 발생할 수 있다.
- **제안**: `computeAttentionBreakdown`의 else 브랜치에 주석 또는 exhaustiveness 체크를 추가하거나, `needsAttention`이 `true`를 반환하는 예상 상태를 명시적으로 열거하는 것을 권장.

### [INFO] 백엔드 `attention` SQL — `token_expires_at > NOW()` 조건의 의미
- **위치**: `backend/src/modules/integrations/integrations.service.ts` L209-214
- **상세**: `attention` SQL에서 `connected` + expiring 행을 `i.token_expires_at > NOW()`로 필터링한다. 이는 "이미 만료된 connected 행"을 제외하기 위함인데, 비즈니스 관점에서 DB status가 `connected`이지만 `token_expires_at`이 과거인 행은 어떻게 처리되어야 하는지(status 정합성 문제) spec에 명확히 기술되지 않았다. 해당 행이 실제로 존재할 수 있다면 `expired` 집합에 포함되지 않고 `attention`에도 잡히지 않는 dead zone이 생긴다.
- **제안**: status=`connected`이지만 `token_expires_at`이 과거인 데이터 정합성 보장 정책(백그라운드 갱신 작업 등)을 spec에 명시하거나, `attention` SQL에서 이 케이스를 명시적으로 처리할 것.

### [INFO] plan 체크리스트 항목 일부 미완료 상태로 리뷰 진행
- **위치**: `plan/in-progress/integration-attention-filter.md` L849-856
- **상세**: 리뷰 대상 diff에는 체크리스트의 모든 항목 구현이 포함되어 있으나, plan 파일 자체의 체크박스는 i18n/backend/frontend 구현 및 TEST WORKFLOW 항목이 `[ ]`로 남아 있다. 이는 diff와 plan 파일이 동시 커밋되어 plan 갱신이 누락된 것으로 보인다. 코드 변경만 선행 커밋된 상태라면 문제 없으나, plan 파일이 live 상태라면 갱신이 필요하다.
- **제안**: 리뷰 완료 후 plan 체크리스트를 실제 완료 상태로 갱신할 것.

### [INFO] `AttentionBanner`에서 `callToAction` 문자열이 breakdown 줄과 같이 join됨
- **위치**: `frontend/src/app/(main)/integrations/page.tsx` L611-632
- **상세**: `breakdown.expired/expiring/error` 별 카운트 텍스트와 `callToAction`("Click to filter" / "Click to open")이 배열로 합쳐져 `" · "` 구분자로 렌더링된다. breakdown 카운트가 모두 0인 경우 (= `total > 0`인데 개별 카운트가 0인 경우는 불가하나 논리적으로 filter 결과가 빈 경우) callToAction만 남게 된다. `attention.total > 0`이 보장되므로 실제로는 문제없지만, 렌더링 결과 "· Click to filter" 형태로 앞에 구분자가 붙는 경우가 없는지 확인 필요하다. 현재 구현에서 `callToAction`은 배열 마지막에 항상 포함되어 null 필터 없이 추가되므로 "Expiring 1 · Click to filter" 형태가 되어 의도대로 동작한다.
- **제안**: 단일 건(total=1)이고 breakdown이 하나의 카테고리만 있을 때 "Expiring 1 · Click to open" 텍스트가 과도하게 반복적으로 느껴질 수 있다. UX 차원에서 단일 건일 때 breakdown 줄을 생략하는 방안을 고려할 것. (기능 결함은 아님)

---

## 요약

요구사항(Requirement) 관점에서 핵심 기능인 `attention` 가상 필터의 백엔드 SQL 구현, 프론트엔드 `computeAttentionBreakdown` 헬퍼, `AttentionBanner` 컴포넌트, 클릭 동작(단일 건 detail 점프 vs. 다중 건 필터), 색상 톤 분기(error=red, 그 외=amber), i18n ko/en 키 추가·구 키 제거 등 spec §2.4가 요구한 기능들은 전반적으로 충실히 구현되어 있다. 그러나 **배너의 attention 카운트와 detail-점프 판정이 모두 현재 페이지 rows 기준**이라는 중요한 암묵적 가정이 코드 어디에도 명시되지 않아, 페이지네이션 환경에서 서버 집계값과 불일치가 발생할 수 있다. 이 가정이 의도된 것이라면 spec에 명문화가 필요하고, 의도된 것이 아니라면 서버 totalItems 기반으로 판정 로직을 수정해야 한다. 나머지 발견사항은 INFO 수준으로 기능 결함보다는 명확성 강화 권고에 해당한다.

---

## 위험도

MEDIUM
