관련 spec들을 충분히 파악했습니다. Cross-spec 분석을 수행하겠습니다.

---

## 발견사항

---

### **[CRITICAL] `pending_install` 상태가 데이터 모델 Enum에 부재**

- **target 위치**: `spec/2-navigation/4-integration.md §6` (상태 전이 다이어그램 및 전이 표)
- **충돌 대상**: `spec/1-data-model.md §2.10 Integration` — `status | Enum | connected / expired / error`
- **상세**: 통합 spec §6은 `pending_install`을 정규 상태로 사용하며 (`pending_install → connected`, `pending_install → expired`, 삭제 분기 등 세 갈래 전이를 정의), §3.2 Cafe24 Private 흐름에서 `POST /api/integrations/oauth/begin` 응답으로 Integration이 `status=pending_install` 상태로 즉시 생성된다고 명시한다. 그러나 데이터 모델 §2.10의 `status` Enum 정의에는 `connected / expired / error` 세 값만 열거되어 있고 `pending_install`이 없다. 두 spec 중 하나가 올바르게 작동할 수 없는 직접 모순.
- **제안**: `spec/1-data-model.md §2.10` Integration.status Enum에 `pending_install` 값을 추가하고, `§3. 인덱스 전략` 테이블에 `pending_install` 관련 인덱스(예: `(workspace_id, status) WHERE status='pending_install'` — TTL 정리 배치 조회용)를 함께 추가한다. project-planner 위임 후 갱신해야 한다.

---

### **[CRITICAL] `install_token` 컬럼이 데이터 모델에 없음**

- **target 위치**: `spec/2-navigation/4-integration.md §3.2` (Cafe24 Private 앱 흐름 — `integrationId` 응답), `§9.2` (`oauth/begin` 응답 body 명세)
- **충돌 대상**: `spec/1-data-model.md §2.10 Integration` — Integration 엔티티 필드 목록
- **상세**: plan `cafe24-pending-polish.md`의 변경 2 (W1 이슈)는 `install_token` 컬럼이 DB에 이미 존재하지만 식별 키로 활용되지 않는 상태라고 명시한다. AI review(`review/2026-05-14_13-57-48/`)도 동일 컬럼을 W1로 기록했다. 그러나 `spec/1-data-model.md §2.10`의 Integration 엔티티 필드 목록에는 `install_token`(또는 `installToken`) 컬럼이 존재하지 않는다. 코드 및 DB에 실존하는 컬럼이 spec에 없어 단일 진실 원칙 위반.
- **제안**: `spec/1-data-model.md §2.10` Integration 엔티티 필드 목록에 `install_token | String? | Cafe24 Private 앱 설치 흐름 식별 키. 설치 완료 후 NULL 로 소거. Cafe24 private 전용` 항목을 추가한다.

---

### **[WARNING] 계획된 spec 개정 3건이 현 spec에 반영되지 않은 상태로 구현 착수 예정**

- **target 위치**: `spec/2-navigation/4-integration.md §6`, `§9.2`, `§10`
- **충돌 대상**: `plan/in-progress/cafe24-pending-polish.md` — 변경 0, 2, 4
- **상세**: plan은 구현 전 project-planner 위임이 필요한 spec 갱신 세 곳을 명시적으로 표기("**project-planner 위임 후 consistency-check 통과**")하지만, 현재 target spec에는 해당 내용이 없다.
  1. **변경 0** — §10(OAuth callback §10.4): `handleCallback` 실패 시 `markIntegrationCallbackError`로 `last_error`·`status_reason`을 기록하되 `status`는 유지하는 정책이 §10에 명시되어야 한다. 현 §10.4 에러 매핑 표는 이 동작을 기술하지 않는다.
  2. **변경 2** — §9.2: `GET /api/integrations/oauth/install/cafe24` → `GET /api/integrations/oauth/install/cafe24/:installToken` 로 경로가 바뀌며 `oauth/begin` 응답의 `appUrl`이 토큰을 포함한 URL로 변경된다. 현 §9.2는 구 경로(토큰 없는 flat URL)를 API 계약으로 문서화하고 있어 구현과 spec이 불일치하게 된다.
  3. **변경 4** — §6: `pending_install → expired` 자동 전이(24h TTL) 경로가 상태 머신 다이어그램과 전이 표에 추가되어야 한다. 현 §6 상태 머신에는 이 전이가 없다.
- **제안**: 변경 2·4는 구현 시 기존 spec과의 API 계약·상태 머신 모순을 직접 유발하므로 구현 착수 전 project-planner가 target spec을 갱신하고 재검토를 거쳐야 한다. 변경 0은 구현 동작의 추가이므로 선행 spec 갱신 후 구현이 원칙에 맞다.

---

### **[WARNING] `pending_install` 상태 Integration의 목록 화면 표시 방식 미정의**

- **target 위치**: `spec/2-navigation/4-integration.md §2.2 항목 요소`
- **충돌 대상**: 동일 문서 §6 (pending_install 상태 존재), §3.2 (Private 흐름에서 생성)
- **상세**: §2.2 항목 요소 표는 상태 아이콘을 `🟢 connected / 🟡 expiring/expired / 🔴 error(reason)` 세 가지만 정의한다. `pending_install` 상태의 Integration은 목록에 표시될 수 있으나(생성 직후 사용자가 목록으로 돌아올 경우) 어떤 아이콘/상태 텍스트를 사용하는지, 더보기(⋮) 메뉴에 어떤 액션이 허용되는지, "Need attention" 배너(§2.4) 포함 여부가 모두 미기술이다. plan 변경 1의 FE 폴링은 이 화면에서 상태를 갱신해야 하는데 목표 UI 상태가 없다.
- **제안**: §2.2 항목 요소 표에 `⏳ pending_install` 아이콘·라벨, 허용 액션(삭제만 허용, 사용 불가 뱃지 등)을 추가한다. §2.4 배너 조건에서 `pending_install` 포함 여부도 명시한다.

---

### **[INFO] Rate limit 헤더 목록 — 내비게이션 spec(§5.8)이 Cafe24 노드 spec(§4.1)보다 불완전**

- **target 위치**: `spec/2-navigation/4-integration.md §5.8` Rate Limit 정책
- **충돌 대상**: `spec/4-nodes/4-integration/4-cafe24.md §4.1 Rate Limit 처리 상세`
- **상세**: 내비게이션 spec §5.8은 `X-Cafe24-Call-Remain`, `X-Cafe24-Call-Usage`, `X-Api-Call-Limit` 세 헤더만 언급한다. Cafe24 노드 spec §4.1은 이 세 헤더 외에 `X-Cafe24-Time-Usage`(처리시간 사용률)와 `X-Cafe24-Time-Remain`(처리시간 재개 시간)을 추가로 정의하며, 429 처리 시 `max(X-Cafe24-Call-Remain, X-Cafe24-Time-Remain)` 조합을 사용한다고 명시한다. 두 spec이 같은 `Cafe24ApiClient` wrapper를 기술하므로 정보가 일치해야 한다.
- **제안**: 내비게이션 spec §5.8 Rate Limit 정책 절에 `X-Cafe24-Time-Usage`와 `X-Cafe24-Time-Remain`을 추가하거나, §5.8에서 Cafe24 노드 spec §4.1을 cross-reference하고 중복 기술을 최소화하는 방향 중 하나를 선택해 동기화한다.

---

## 요약

`spec/2-navigation/4-integration.md`의 **가장 심각한 문제는 두 CRITICAL 항목** — `pending_install` 상태와 `install_token` 컬럼이 `spec/1-data-model.md §2.10`에 존재하지 않는 직접 모순이다. 구현이 진행되면 마이그레이션·ORM 엔티티가 spec 없이 존재하게 되어 단일 진실 원칙이 무너진다. 추가로 plan이 명시한 세 spec 개정(변경 0/2/4)이 반영되지 않은 채 구현 착수가 이루어지면 구현 완료 시점에 spec과 코드가 세 군데서 불일치하게 된다. **구현 착수 전 project-planner가 `spec/1-data-model.md §2.10`과 `spec/2-navigation/4-integration.md §6·§9.2·§10`을 갱신해야 한다.**

## 위험도

**HIGH**