이제 충분한 정보를 확보했습니다. Cross-Spec 일관성 검토를 수행합니다.

---

# Cross-Spec 일관성 검토 결과

**검토 대상**: `plan/in-progress/spec-draft-cafe24-pending-polish.md`
**검토 모드**: `--spec` (spec draft 적용 전 사전 검토)
**검토 기준**: 5개 관점 중 cross-spec, naming collision, plan coherence 중점

---

## 발견사항

---

### [WARNING] `spec/4-nodes/4-integration/4-cafe24.md` §9.4 — App URL 경로 미갱신

- **target 위치**: DRAFT 2E (§9.2 install/cafe24 엔드포인트 교체) + DRAFT 2C (§3.2 step 3 텍스트 교체)
- **충돌 대상**: `spec/4-nodes/4-integration/4-cafe24.md` §9.4 Private 앱 연동 흐름 요약 step 3
- **상세**: `spec/4-nodes/4-integration/4-cafe24.md` §9.4는 현재 다음을 기술 중:
  ```
  3. Cafe24 가 `GET /api/integrations/oauth/install/cafe24?mall_id=...&hmac=...` 로 App URL 호출
  ```
  draft는 이 경로를 `GET /api/integrations/oauth/install/cafe24/<installToken>?...` 로 교체하지만, `4-cafe24.md` §9.4는 **"영향받는 연관 문서"에 포함되지 않아** 교체 대상에서 누락됨.
- **제안**: `spec/4-nodes/4-integration/4-cafe24.md` §9.4 step 3을 "영향받는 연관 문서"에 추가하고, `install_token` path segment를 반영한 URL로 교체.

---

### [WARNING] `spec/4-nodes/4-integration/4-cafe24.md` §9.8 — HMAC 검증 로직 미갱신

- **target 위치**: DRAFT 2E §9.2 신규 install endpoint 설명 ("install_token으로 단일 row 조회 → client_secret 1회 검증")
- **충돌 대상**: `spec/4-nodes/4-integration/4-cafe24.md` §9.8 — "Private 앱 App URL HMAC 검증 (알고리즘, 타이밍 안전 비교, replay 공격 방어)"
- **상세**: HMAC 검증 알고리즘이 근본적으로 변경됨 — 기존: `mall_id`로 `pending_install` 후보군 스캔(O(N)) → 각 `client_secret`으로 HMAC trial, 신규: `install_token`으로 단일 row 조회 → 해당 row의 `client_secret`으로 1회 검증. §9.8은 이 새 알고리즘의 canonical 명세이나 **"영향받는 연관 문서"에 미포함**.
- **제안**: `spec/4-nodes/4-integration/4-cafe24.md` §9.8을 "영향받는 연관 문서"에 추가하고, 새 단일-row 조회 + 1회 HMAC 검증 알고리즘으로 교체.

---

### [WARNING] `spec/data-flow/integration.md` §1.4 — 만료 스캐너 쿼리 미갱신

- **target 위치**: DRAFT 3A (§3.1 상태 전이 — `pending_install → expired`) + DRAFT 3C (§1.2 sub-diagram note: "일일 만료 스캐너가 `created_at < now - 24h AND status='pending_install'` 처리")
- **충돌 대상**: `spec/data-flow/integration.md` §1.4 만료 스캐너 cron sweep
- **상세**: 현재 §1.4는 다음 쿼리만 명시:
  ```sql
  SELECT integration WHERE token_expires_at < now + Δ AND status='connected'
  ```
  draft는 `pending_install` TTL 24h 초과 시 `expired` 전이를 추가하지만, §1.4 스캐너 쿼리가 `pending_install` 대상을 포함하도록 변경되지 않음. DRAFT 3C의 note는 §1.2 sub-diagram 끝에만 삽입되어 §1.4 공식 명세와 불일치.
- **제안**: `spec/data-flow/integration.md` §1.4 "영향받는 연관 문서"에 추가. 스캐너 로직에 두 번째 스캔 조건 (`created_at < now - 24h AND status='pending_install'` → `status='expired', status_reason='install_timeout', install_token=NULL`) 명시.

---

### [INFO] §9.2 `oauth/begin` 응답 — `appUrl` 내 install_token 포함 미명시

- **target 위치**: DRAFT 2C (§3.2 응답 예시 교체 — `appUrl` 형식 변경)
- **충돌 대상**: `spec/2-navigation/4-integration.md` §9.2 `POST /api/integrations/oauth/begin` 설명
- **상세**: §9.2 `oauth/begin` Cafe24 Private 설명은 `{ mode:'cafe24_private_pending', integrationId, appUrl, callbackUrl }` 응답을 명시하지만, `appUrl`이 이제 `install_token` path segment를 포함한다는 사실이 §9.2에서 명시되지 않음 (§3.2 예시에서만 확인 가능). 구현자가 §9.2만 보면 `appUrl` 형식 변경을 놓칠 수 있음.
- **제안**: §9.2 `oauth/begin` Cafe24 Private 설명에 "appUrl 형식: `...install/cafe24/<installToken>`" 한 줄 추가.

---

### [INFO] `cafe24-api-metadata.md#6-도구-allowlist` 참조 — "카테고리" 용어 정의 부재

- **target 위치**: DRAFT 2H (§14.2 "Resource 단위 grouping" → "카테고리 단위 grouping") + 4-cafe24.md §337 교정
- **충돌 대상**: `spec/conventions/cafe24-api-metadata.md` §6 — "allowlist 와의 관계 (enabledTools 가 bare id 배열로 저장)"
- **상세**: 두 위치의 cross-reference `[Spec Cafe24 API 메타데이터 §6](./cafe24-api-metadata.md#6-도구-allowlist)` 가 "카테고리 단위 grouping" 용어의 출처로 지정되어 있으나, §6는 allowlist 구조(bare id 배열)를 정의하며 "카테고리"를 UI 용어로 정의하지 않음. "카테고리"는 §5.8 scope 테이블에서 이미 사용 중이므로 무의미한 링크는 아니나, 참조 대상 섹션이 용어 출처로서 부적절함.
- **제안**: `cafe24-api-metadata.md` §6에 "UI grouping 단위 = 카테고리 (= resource 파일 1개)" 한 줄 추가하거나, cross-reference를 `4-integration.md#58-cafe24`의 scope 테이블로 변경.

---

### [INFO] `CAFE24_PRIVATE_APP_ALREADY_CONNECTED` 비즈니스 룰 — 데이터 모델 spec 미반영

- **target 위치**: DRAFT 2F §9.4 에러 코드 추가 — `CAFE24_PRIVATE_APP_ALREADY_CONNECTED` (400)
- **충돌 대상**: `spec/1-data-model.md` §2.10 — UNIQUE 제약은 `(workspace_id, name)` 만 존재
- **상세**: 에러 코드는 `(workspaceId, mall_id, app_type='private')` 조합 중복을 체크하는 비즈니스 로직을 전제하지만, 이 규칙이 데이터 모델 spec이나 `oauth/begin` 엔드포인트 명세에 명시되지 않음. DB 제약인지 애플리케이션 레벨 검증인지도 불명확.
- **제안**: `spec/2-navigation/4-integration.md` §9.2 `oauth/begin` Cafe24 Private 설명에 "동일 (workspaceId, mall_id, app_type='private')에 connected 행 존재 시 400 CAFE24_PRIVATE_APP_ALREADY_CONNECTED" 선행 조건 명시. 데이터 모델에 비고 추가 여부는 선택.

---

### [INFO] §2.3 필터 칩 — `Pending Install` 상태 옵션 미추가

- **target 위치**: DRAFT 2A (§2.2 상태 아이콘·텍스트에 `⏳ pending_install` 추가), DRAFT 2B (§2.4 배너에서 제외)
- **충돌 대상**: `spec/2-navigation/4-integration.md` §2.3 — 상태 칩: `All / Connected / Expiring / Expired / Error`
- **상세**: `pending_install` 통합이 목록에 표시되어 사용자가 볼 수 있으나(DRAFT 2A), §2.3 필터 칩에 `Pending` 옵션이 없어 해당 상태만 선별하는 방법이 없음. DRAFT 2B는 배너 제외 이유를 설명하지만 필터 칩 제외 이유는 명시 없음.
- **제안**: 의도적으로 필터 칩을 추가하지 않는다면 draft에 "Pending Install은 정상 전환 상태이므로 필터 칩 미추가" 결정을 Rationale에 명시.

---

## 요약

draft의 핵심 변경(install_token 도입, pending_install 상태 명세 보강, callback 실패 시 상태 보존, install TTL → expired 전이)은 `spec/2-navigation/4-integration.md`와 `spec/data-flow/integration.md`, `spec/1-data-model.md` 간 내적 일관성을 갖추고 있다. 그러나 **`spec/4-nodes/4-integration/4-cafe24.md` §9.4(URL 교체)와 §9.8(HMAC 알고리즘 변경)**이 "영향받는 연관 문서"에서 누락되어, 구현자가 두 섹션을 구버전 로직으로 구현할 구체적 위험이 있다. `spec/data-flow/integration.md` §1.4 스캐너 쿼리도 pending_install TTL 처리 조건이 빠져 있어 일관성 결함이 있다. 이 세 WARNING 항목을 draft에 반영하면 패치 준비 완료.

---

## 위험도

**MEDIUM**

`4-cafe24.md` §9.4 / §9.8 누락(W1, W2)은 구현 phase에서 개발자가 서로 다른 URL·HMAC 알고리즘으로 각 파일을 구현할 직접적 위험이 있고, `data-flow` §1.4 누락(W3)은 pending_install 행이 만료되지 않고 누적되는 런타임 결함으로 이어질 수 있다. 현재 CRITICAL 위배는 없으므로 spec write를 차단하지 않으나, **W1·W2·W3를 "영향받는 연관 문서"에 추가하고 해당 섹션을 draft에 포함한 뒤 적용**을 권장한다.