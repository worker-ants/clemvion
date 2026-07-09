# 보안(Security) Review

검토 대상: 워크스페이스 슬러그 URL 라우팅(`/w/[slug]/...`) 구현 배치 — 본 batch 는 신규 공용 헬퍼(`buildWorkspaceHref`, `useWorkspaceSlug`, `useWorkspaces`), cafe24/makeshop pending-polling 훅의 리다이렉트 slug 화, 관련 unit test, spec/plan 문서 갱신, consistency-check 산출물로 구성된다. `(main)/w/[slug]/layout.tsx`(resolve+reconcile gate), `(main)/[...rest]/page.tsx`(catch-all 리다이렉트) 등 실제 gate/redirect 로직 파일 자체는 이 batch 페이로드에 포함되어 있지 않아 직접 검증하지 못했다 — 해당 파일들은 별도 리뷰 배치 대상일 가능성이 높다.

## 발견사항

- **[WARNING]** `buildWorkspaceHref` 가 protocol-relative(`//host`) path 를 걸러내지 않아 잠재적 오픈 리다이렉트 표면
  - 위치: `codebase/frontend/src/lib/workspace/href.ts`
    ```ts
    export function buildWorkspaceHref(slug, path) {
      const clean = path.startsWith("/") ? path : `/${path}`;
      return slug ? `/w/${slug}${clean}` : clean;
    }
    ```
  - 상세: `path.startsWith("/")` 검사는 `//evil.com/x` 같은 protocol-relative 문자열도 그대로 통과시킨다. `slug` 가 존재하는 정상 경로에서는 `` `/w/${slug}//evil.com/x` `` 형태로 앞에 `/w/<slug>` 가 붙어 여전히 같은 오리진 경로 문자열이 되므로 즉시 취약하지는 않지만, 문서 주석이 명시하듯(`slug` 가 없으면 "bare path 를 반환") **slug 가 null/undefined 인 폴백 분기**에서는 caller 가 넘긴 `path` 를 검증 없이 그대로 반환한다. 만약 어떤 호출부가 attacker-influenced 문자열(예: URL 그대로를 흡수하는 `(main)/[...rest]` catch-all 리다이렉트가 원본 rest 세그먼트를 이 함수의 `path` 인자로 넘기는 경우, 혹은 향후 `?next=` 류 쿼리 파라미터를 그대로 전달하는 호출부)을 `path` 로 넘기면, `router.replace("//evil.com/...")` 는 브라우저가 이를 현재 프로토콜(`https:`) 기준 절대 URL로 해석해 **다른 오리진으로 이탈**시키는 고전적 오픈 리다이렉트 패턴이 된다. 이 batch 에는 catch-all 페이지 코드가 포함되어 있지 않아 실제로 그렇게 연결되는지 확인하지 못했다 — plan 상 "`(main)/[...rest]` catch-all 이 구 무-slug 경로·알림 딥링크·로그인후 `/dashboard` 를 활성 slug 로 흡수" 한다고 되어 있어, 사용자가 직접 입력/클릭한 임의 경로를 소비하는 지점이라는 점에서 이 우려가 근거 없지 않다.
  - 제안: `buildWorkspaceHref` 진입 시 선두 슬래시를 정규화(예: `path.replace(/^\/+/, "/")`) 하거나, `//` 로 시작하는 입력을 명시적으로 거부/치환할 것. 특히 slug 가 falsy 인 폴백 분기에서도 동일하게 정규화된 `clean` 을 반환하도록 하여, 이 헬퍼를 사용하는 향후 ~22개 이상 호출부 전체에 걸쳐 일관된 방어를 제공해야 한다. `(main)/[...rest]/page.tsx` catch-all 구현이 원본 URL 세그먼트를 이 함수(또는 동등 로직)에 넘기는지 별도로 확인 권장.

- **[INFO]** cafe24/makeshop pending-polling 훅 간 `integrationId` 인코딩 비대칭 (pre-existing, 이번 diff 는 `buildWorkspaceHref` 로 감싸며 노출면만 유지)
  - 위치: `codebase/frontend/src/lib/integrations/use-cafe24-pending-polling.ts:82` vs `codebase/frontend/src/lib/integrations/use-makeshop-pending-polling.ts:99-104`
  - 상세: makeshop 훅은 `encodeURIComponent(integrationId)` 로 감싸고 "INFO4 — UUID format expected; encode as an additional belt-and-suspenders" 주석을 남긴 반면, cafe24 훅은 동일한 리다이렉트 경로 조립에서 `integrationId` 를 인코딩 없이 그대로 템플릿 리터럴에 삽입한다(`` `/integrations/${integrationId}` ``). 이번 diff 는 두 훅 모두 `buildWorkspaceHref(slug, ...)` 로 감싸도록 수정했으나 기존의 인코딩 비대칭은 그대로 남아 있다. `integrationId` 는 API 응답으로 얻은 UUID 형식이 기대되어 실제 착취 가능성은 낮지만, 방어 심층화 관점에서 두 훅의 취급을 일치시키는 편이 안전하다.
  - 제안: cafe24 훅에도 `encodeURIComponent(integrationId)` 적용해 makeshop 과 동일한 belt-and-suspenders 방어를 갖출 것.

- **[INFO]** cafe24 훅의 `lastErrorMessage` 가 백엔드 원문 에러 메시지를 그대로 노출 (pre-existing, 이번 diff 의 변경 범위 밖)
  - 위치: `codebase/frontend/src/lib/integrations/use-cafe24-pending-polling.ts:666-671` (`lastErrorMessage = poll.lastError?.message ?? poll.statusReason ?? null`)
  - 상세: makeshop 훅은 `STATUS_REASON_I18N_KEY` 매핑 테이블로 알려진 `statusReason` 만 안전한 i18n 메시지로 변환하고 "raw backend error text (HMAC 상세, token exchange trace) 는 절대 UI 로 전달하지 않는다(W7)" 는 명시적 정책을 갖고 있다. 반면 cafe24 훅은 `poll.lastError.message` 원문을 가공 없이 그대로 반환하며, 첨부된 테스트(`use-cafe24-pending-polling.test.tsx`)도 `"Failed: invalid_grant"` 같은 OAuth 원문 에러를 그대로 노출하는 것을 기대 동작으로 단언하고 있다. 이는 OAuth 교환 실패 상세(예: 내부 트레이스, 특정 실패 사유 문자열)를 최종 사용자에게 그대로 노출할 수 있는 정보 노출 소지다. 이번 diff 가 건드린 라인은 아니므로 이번 PR 의 결함으로 분류하지는 않으나, makeshop 쪽에 이미 존재하는 W7 정책과 비교하면 cafe24 쪽이 뒤처져 있어 별도 후속 조치 대상으로 기록해 둘 만하다.
  - 제안: cafe24 훅에도 makeshop 과 동일한 `STATUS_REASON_I18N_KEY` 매핑(또는 공용 매핑 모듈 추출)을 적용해 원문 에러 메시지 직통 노출을 막을 것.

- **[INFO]** URL `slug` 파라미터를 그대로 신뢰하는 라우팅 SoT — 백엔드 인가와 분리되어 있어 낮은 리스크
  - 위치: `codebase/frontend/src/lib/workspace/use-workspace-slug.ts`
  - 상세: `useWorkspaceSlug()` 은 `useParams().slug` (URL 문자열)를 store 값보다 우선하는 SoT 로 취급한다. 이 훅 자체는 해당 slug 에 대한 사용자의 멤버십/권한을 검증하지 않는다. 다만 프로젝트 결정 기록(§ "URL slug=FE 라우팅 SoT ≠ backend 소스, backend 는 header-first 무변경")에 따르면 백엔드 API 인가는 이 URL slug 를 신뢰하지 않고 별도 메커니즘(헤더 기반 워크스페이스 컨텍스트)을 그대로 사용하므로, FE 가 잘못된/타인의 slug 를 URL 에 넣더라도 그것만으로 크로스-워크스페이스 IDOR 로 이어지지는 않는 구조로 보인다. 다만 이 batch 에는 실제 멤버십 불일치 시 리다이렉트/차단을 수행한다는 `(main)/w/[slug]/layout.tsx` (resolve+reconcile gate) 파일이 포함되어 있지 않아, 잘못된 slug 진입 시 클라이언트가 다른 워크스페이스의 캐시된 데이터(react-query 캐시 등)를 순간적으로 렌더링하지 않는지는 이 리뷰에서 직접 확인하지 못했다.
  - 제안: 별도 배치에서 `(main)/w/[slug]/layout.tsx` 를 검토해 (a) 존재하지 않거나 접근 권한이 없는 slug 진입 시 안전하게 리다이렉트되는지, (b) 전환 사이 다른 워크스페이스 데이터가 화면에 노출되는 race 가 없는지 확인할 것.

- **[INFO]** 신규 코드/문서/consistency-check 산출물 전반에 하드코딩 시크릿·SQL/커맨드 인젝션·안전하지 않은 암호화 패턴 없음
  - 위치: 전체 리뷰 대상(신규 훅 3종, 테스트 5종, mdx/spec 문서 20여 종, plan/consistency 산출물)
  - 상세: 이번 batch 는 FE-only 순수 라우팅/링크-빌더 변경과 문서 경로 갱신으로, 백엔드 코드·DB 쿼리·인증 로직 변경이 없다. API 키/토큰/자격증명 하드코딩, 안전하지 않은 해시 사용, 평문 전송 등은 발견되지 않았다.

## 요약

이번 batch 는 워크스페이스 슬러그 라우팅을 위한 FE 전용 헬퍼(`buildWorkspaceHref`/`useWorkspaceSlug`/`useWorkspaces`)와 cafe24/makeshop 폴링 훅의 리다이렉트 slug 화, 그리고 문서/plan/consistency 산출물로 구성되어 있어 전형적인 인젝션·하드코딩 시크릿·인증 우회류의 직접적 취약점은 발견되지 않았다. 다만 신규 공용 URL 빌더 `buildWorkspaceHref` 가 protocol-relative(`//host`) 입력을 걸러내지 않아, 향후 카탈로그-와이드로 재사용되거나(특히 사용자 입력 경로를 그대로 흡수한다고 서술된 `(main)/[...rest]` catch-all 리다이렉트와 결합될 경우) 오픈 리다이렉트로 이어질 수 있는 방어 공백이 있다 — 이번 batch 페이로드에는 그 catch-all 구현 자체가 포함되지 않아 실제 연결 여부는 별도 검증이 필요하다. 그 외 cafe24/makeshop 훅 간 `integrationId` 인코딩·에러 메시지 노출 취급의 비대칭은 이번 diff 이전부터 존재하던 낮은 우선순위 정보 노출/방어심층화 갭으로, 이번 변경이 새로 만든 결함은 아니다.

## 위험도
LOW
